import asyncio
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import AppException, ForbiddenException, UnauthorizedException
from app.common.security import create_access_token, create_refresh_token, verify_password
from app.modules.audit.service import log_audit
from app.modules.auth.models import Business, BusinessUser, Role, User
from app.modules.auth.schemas import BusinessSummary, UserSummary
from app.modules.mobile.constants import (
    MAX_PIN_FAILED_ATTEMPTS,
    PIN_LOCKOUT_HOURS,
    enabled_mobile_tiles,
    normalize_mobile_pages,
)
from app.modules.mobile.schemas import (
    MobileBusinessChoice,
    MobileLoginRequest,
    MobileLoginResponseData,
    MobileMeData,
)


def _format_duration(seconds: float) -> str:
    total = max(1, int(seconds))
    if total >= 3600:
        hours = total // 3600
        mins = (total % 3600) // 60
        if mins > 0:
            return f"{hours} hr {mins} min"
        return f"{hours} hour{'s' if hours > 1 else ''}"
    mins = max(1, total // 60 + (1 if total % 60 else 0))
    return f"{mins} minute{'s' if mins > 1 else ''}"


def _phone_digits(value: str) -> str:
    return re.sub(r"\D", "", value or "")


async def _find_user_by_identifier(db: AsyncSession, identifier: str) -> User | None:
    ident = (identifier or "").strip()
    if not ident:
        return None

    if "@" in ident:
        res = await db.execute(select(User).where(func.lower(User.email) == ident.lower()))
        return res.scalar_one_or_none()

    # Match phone number cleanly (exact, stripped digits, or last 10 digits)
    res = await db.execute(select(User).where(User.phone.isnot(None)))
    candidates = res.scalars().all()
    target_digits = _phone_digits(ident)
    for candidate in candidates:
        raw_phone = (candidate.phone or "").strip()
        if raw_phone == ident:
            return candidate
        cand_digits = _phone_digits(raw_phone)
        if target_digits and cand_digits:
            if cand_digits == target_digits:
                return candidate
            if len(target_digits) >= 10 and len(cand_digits) >= 10 and cand_digits[-10:] == target_digits[-10:]:
                return candidate

    # Fallback: allow email without '@' check just in case
    res = await db.execute(select(User).where(func.lower(User.email) == ident.lower()))
    return res.scalar_one_or_none()


async def _check_and_auto_reset_lock(membership: BusinessUser, now: datetime) -> None:
    if membership.pin_locked_until is not None:
        if membership.pin_locked_until > now:
            remaining = (membership.pin_locked_until - now).total_seconds()
            raise AppException(
                429,
                "ACCOUNT_LOCKED",
                f"Account locked due to too many failed PIN attempts. Try again in {_format_duration(remaining)} or ask your admin to unlock.",
            )
        # Auto-reset expired 24h lock
        membership.pin_locked_until = None
        membership.pin_failed_attempts = 0


async def _record_failed_pin(
    db: AsyncSession,
    memberships: List[BusinessUser],
    now: datetime,
) -> None:
    await asyncio.sleep(1)
    max_attempts = 0
    locked_now = False
    for m in memberships:
        m.pin_failed_attempts = (m.pin_failed_attempts or 0) + 1
        if m.pin_failed_attempts >= MAX_PIN_FAILED_ATTEMPTS:
            m.pin_locked_until = now + timedelta(hours=PIN_LOCKOUT_HOURS)
            m.pin_failed_attempts = 0
            locked_now = True
        else:
            max_attempts = max(max_attempts, m.pin_failed_attempts)

    await db.commit()

    if locked_now:
        raise AppException(
            429,
            "ACCOUNT_LOCKED",
            "Too many failed attempts. Account locked for 24 hours. Contact your admin to unlock.",
        )

    remaining = max(1, MAX_PIN_FAILED_ATTEMPTS - max_attempts)
    raise UnauthorizedException(
        f"Invalid credentials or PIN. ({remaining} attempt{'s' if remaining > 1 else ''} remaining before 24-hour lockout)"
    )


async def mobile_login(db: AsyncSession, data: MobileLoginRequest) -> MobileLoginResponseData:
    now = datetime.now(timezone.utc)
    user = await _find_user_by_identifier(db, data.identifier)
    if not user or not user.is_active:
        await asyncio.sleep(1)
        raise UnauthorizedException("Invalid phone/email or PIN")

    stmt = (
        select(BusinessUser, Business, Role)
        .join(Business, Business.id == BusinessUser.business_id)
        .join(Role, Role.id == BusinessUser.role_id)
        .where(
            BusinessUser.user_id == user.id,
            BusinessUser.is_active == True,
            Business.is_active == True,
        )
    )
    if data.business_id is not None:
        stmt = stmt.where(BusinessUser.business_id == data.business_id)

    rows = (await db.execute(stmt)).all()
    if not rows:
        await asyncio.sleep(1)
        raise UnauthorizedException("No active business membership found for this account")

    mobile_rows: List[Tuple[BusinessUser, Business, Role]] = [
        (bu, biz, role) for bu, biz, role in rows if bu.mobile_access and bu.mobile_pin_hash
    ]
    if not mobile_rows:
        await asyncio.sleep(1)
        raise UnauthorizedException("Mobile app access or PIN is not configured for this account")

    # Check lockouts first across matching memberships
    for bu, _, _ in mobile_rows:
        await _check_and_auto_reset_lock(bu, now)

    # Verify PIN across candidate memberships
    matched: List[Tuple[BusinessUser, Business, Role]] = [
        (bu, biz, role) for bu, biz, role in mobile_rows if verify_password(data.pin, bu.mobile_pin_hash)
    ]

    if not matched:
        await _record_failed_pin(db, [bu for bu, _, _ in mobile_rows], now)

    if len(matched) > 1 and data.business_id is None:
        return MobileLoginResponseData(
            requires_business_selection=True,
            businesses=[MobileBusinessChoice(id=biz.id, name=biz.name) for _, biz, _ in matched],
        )

    membership, business, role = matched[0]
    membership.pin_failed_attempts = 0
    membership.pin_locked_until = None
    user.last_login_at = now

    token_data = {
        "sub": str(user.id),
        "tenant_id": str(business.id),
        "role": role.name,
        "mobile": True,
    }
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    await log_audit(
        db=db,
        tenant_id=business.id,
        user_id=user.id,
        action="MOBILE_LOGIN",
        entity_type="user",
        entity_id=user.id,
        description=f"Mobile PIN login for {user.email}",
    )
    await db.commit()

    pages = normalize_mobile_pages(membership.mobile_pages)
    return MobileLoginResponseData(
        requires_business_selection=False,
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserSummary(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=role.name,
        ),
        business=BusinessSummary(
            id=business.id,
            name=business.name,
            currency=business.currency,
        ),
        mobile_pages=pages,
        allowed_tiles=enabled_mobile_tiles(pages),
    )


async def get_mobile_me(db: AsyncSession, user: User) -> MobileMeData:
    res = await db.execute(
        select(BusinessUser, Business, Role)
        .join(Business, Business.id == BusinessUser.business_id)
        .join(Role, Role.id == BusinessUser.role_id)
        .where(
            BusinessUser.user_id == user.id,
            BusinessUser.business_id == user.current_tenant_id,
            BusinessUser.is_active == True,
            Business.is_active == True,
        )
    )
    row = res.first()
    if not row:
        raise ForbiddenException("Inactive business membership")
    membership, business, role = row
    if not membership.mobile_access:
        raise ForbiddenException("Mobile app access is disabled for your account")

    pages = normalize_mobile_pages(membership.mobile_pages)
    return MobileMeData(
        user=UserSummary(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=role.name,
        ),
        business=BusinessSummary(
            id=business.id,
            name=business.name,
            currency=business.currency,
        ),
        mobile_access=membership.mobile_access,
        mobile_pages=pages,
        allowed_tiles=enabled_mobile_tiles(pages),
    )
