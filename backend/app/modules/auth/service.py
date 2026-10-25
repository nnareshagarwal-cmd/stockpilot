import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.common.exceptions import (
    ConflictException,
    UnauthorizedException,
    NotFoundException,
    ValidationException,
)
from app.common.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.modules.auth.models import Business, User, Role, BusinessUser, Permission, RolePermission
from app.modules.settings.models import StockCondition, TaxRate, UnitOfMeasure
from app.modules.audit.service import log_audit
from app.modules.auth.schemas import (
    RegisterRequest,
    LoginRequest,
    ChangePasswordRequest,
    UpdateProfileRequest,
    AuthData,
    UserSummary,
    BusinessSummary,
    CurrentUserData,
    RoleSummary,
)


DEFAULT_STOCK_CONDITIONS = [
    {"name": "New / Sellable", "code": "new_sellable", "is_sellable": True, "sort_order": 1},
    {"name": "Good / Sellable", "code": "good_sellable", "is_sellable": True, "sort_order": 2},
    {"name": "Open Box / Display", "code": "open_box_display", "is_sellable": True, "sort_order": 3},
    {"name": "Damaged", "code": "damaged", "is_sellable": False, "sort_order": 4},
    {"name": "Under Inspection", "code": "under_inspection", "is_sellable": False, "sort_order": 5},
    {"name": "Returned Pending", "code": "returned_pending", "is_sellable": False, "sort_order": 6},
    {"name": "Written Off", "code": "written_off", "is_sellable": False, "sort_order": 7},
]

DEFAULT_TAX_RATES = [
    {"name": "GST 0%", "rate": 0.00, "description": "Nil rate"},
    {"name": "GST 5%", "rate": 5.00, "description": "Standard 5% GST"},
    {"name": "GST 12%", "rate": 12.00, "description": "Standard 12% GST"},
    {"name": "GST 18%", "rate": 18.00, "description": "Standard 18% GST"},
    {"name": "GST 28%", "rate": 28.00, "description": "Standard 28% GST"},
    {"name": "Exempt", "rate": 0.00, "description": "Exempted goods"},
]

DEFAULT_UNITS = [
    {"code": "PC", "name": "Piece", "decimal_places": 0},
    {"code": "BOX", "name": "Box", "decimal_places": 0},
    {"code": "PKT", "name": "Packet", "decimal_places": 0},
    {"code": "MTR", "name": "Meter", "decimal_places": 2},
    {"code": "SQFT", "name": "Square Foot", "decimal_places": 2},
    {"code": "KG", "name": "Kilogram", "decimal_places": 3},
    {"code": "LTR", "name": "Litre", "decimal_places": 3},
    {"code": "SET", "name": "Set", "decimal_places": 0},
    {"code": "ROLL", "name": "Roll", "decimal_places": 0},
]


async def seed_tenant_defaults(db: AsyncSession, tenant_id: uuid.UUID):
    """Seed initial master data for a freshly registered tenant."""
    for item in DEFAULT_STOCK_CONDITIONS:
        db.add(StockCondition(tenant_id=tenant_id, **item))
    for item in DEFAULT_TAX_RATES:
        db.add(TaxRate(tenant_id=tenant_id, **item))
    for item in DEFAULT_UNITS:
        db.add(UnitOfMeasure(tenant_id=tenant_id, **item))


async def get_or_create_system_role(db: AsyncSession, name: str, display_name: str, description: str = "") -> Role:
    result = await db.execute(select(Role).where(Role.name == name))
    role = result.scalar_one_or_none()
    if not role:
        role = Role(
            name=name,
            display_name=display_name,
            description=description,
            is_system=True,
        )
        db.add(role)
        await db.flush()
    return role


async def register_business(db: AsyncSession, data: RegisterRequest) -> AuthData:
    # 1. Validate email is unique globally
    result = await db.execute(select(User).where(User.email == data.email.lower()))
    if result.scalar_one_or_none():
        raise ConflictException(f"Email '{data.email}' is already registered")

    # 2. Create business
    business = Business(
        name=data.business_name,
        email=data.email.lower(),
        phone=data.phone,
    )
    db.add(business)
    await db.flush()

    # 3. Create user
    user = User(
        email=data.email.lower(),
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        phone=data.phone,
    )
    db.add(user)
    await db.flush()

    # 4. Get or create admin role
    admin_role = await get_or_create_system_role(db, "admin", "Administrator", "Full administrative access")
    await get_or_create_system_role(db, "staff", "Staff", "Operational access to products, stock, and sales")

    # 5. Link user to business with admin role
    membership = BusinessUser(
        business_id=business.id,
        user_id=user.id,
        role_id=admin_role.id,
    )
    db.add(membership)

    # 6. Seed defaults for this tenant
    await seed_tenant_defaults(db, business.id)

    # 7. Audit log
    await log_audit(
        db=db,
        tenant_id=business.id,
        user_id=user.id,
        action="REGISTER",
        entity_type="business",
        entity_id=business.id,
        description=f"Business registered: {business.name}",
    )

    await db.commit()
    await db.refresh(business)
    await db.refresh(user)

    # 8. Generate JWTs
    token_claims = {
        "sub": str(user.id),
        "tenant_id": str(business.id),
        "role": "admin",
    }
    access_token = create_access_token(token_claims)
    refresh_token = create_refresh_token(token_claims)

    return AuthData(
        user=UserSummary(id=user.id, email=user.email, full_name=user.full_name, phone=user.phone, role="admin"),
        business=BusinessSummary(id=business.id, name=business.name, currency=business.currency, timezone=business.timezone),
        access_token=access_token,
        refresh_token=refresh_token,
    )


async def login_user(db: AsyncSession, data: LoginRequest) -> AuthData:
    result = await db.execute(select(User).where(User.email == data.email.lower()))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise UnauthorizedException("Invalid email or password")

    if not user.is_active:
        raise UnauthorizedException("User account is inactive")

    # Find active membership
    bu_result = await db.execute(
        select(BusinessUser, Business, Role)
        .join(Business, Business.id == BusinessUser.business_id)
        .join(Role, Role.id == BusinessUser.role_id)
        .where(
            BusinessUser.user_id == user.id,
            BusinessUser.is_active == True,
            Business.is_active == True,
        )
    )
    membership = bu_result.first()
    if not membership:
        raise UnauthorizedException("No active business membership found for this user")

    business_user, business, role = membership

    user.last_login_at = datetime.now(timezone.utc)

    # Audit log
    await log_audit(
        db=db,
        tenant_id=business.id,
        user_id=user.id,
        action="LOGIN",
        entity_type="user",
        entity_id=user.id,
        description=f"User {user.email} logged in",
    )
    await db.commit()

    token_claims = {
        "sub": str(user.id),
        "tenant_id": str(business.id),
        "role": role.name,
    }
    access_token = create_access_token(token_claims)
    refresh_token = create_refresh_token(token_claims)

    return AuthData(
        user=UserSummary(id=user.id, email=user.email, full_name=user.full_name, phone=user.phone, role=role.name),
        business=BusinessSummary(id=business.id, name=business.name, currency=business.currency, timezone=business.timezone),
        access_token=access_token,
        refresh_token=refresh_token,
    )


async def refresh_tokens(db: AsyncSession, token: str) -> AuthData:
    try:
        payload = decode_token(token)
        if payload.get("type") != "refresh":
            raise UnauthorizedException("Invalid refresh token")
        user_id = uuid.UUID(payload["sub"])
        tenant_id = uuid.UUID(payload["tenant_id"])
    except Exception:
        raise UnauthorizedException("Invalid or expired refresh token")

    result = await db.execute(
        select(BusinessUser, Business, User, Role)
        .join(Business, Business.id == BusinessUser.business_id)
        .join(User, User.id == BusinessUser.user_id)
        .join(Role, Role.id == BusinessUser.role_id)
        .where(
            BusinessUser.user_id == user_id,
            BusinessUser.business_id == tenant_id,
            BusinessUser.is_active == True,
            Business.is_active == True,
            User.is_active == True,
        )
    )
    row = result.first()
    if not row:
        raise UnauthorizedException("Invalid token session")

    _, business, user, role = row
    token_claims = {
        "sub": str(user.id),
        "tenant_id": str(business.id),
        "role": role.name,
    }
    new_access_token = create_access_token(token_claims)
    new_refresh_token = create_refresh_token(token_claims)

    return AuthData(
        user=UserSummary(id=user.id, email=user.email, full_name=user.full_name, phone=user.phone, role=role.name),
        business=BusinessSummary(id=business.id, name=business.name, currency=business.currency, timezone=business.timezone),
        access_token=new_access_token,
        refresh_token=new_refresh_token,
    )


async def get_current_user_info(db: AsyncSession, user: User) -> CurrentUserData:
    b_result = await db.execute(select(Business).where(Business.id == user.current_tenant_id))
    business = b_result.scalar_one_or_none()
    if not business:
        raise NotFoundException("Business")

    r_result = await db.execute(
        select(Role)
        .options(selectinload(Role.permissions).selectinload(RolePermission.permission))
        .where(Role.name == user.current_role)
    )
    role = r_result.scalar_one_or_none()

    perms = []
    if role and role.permissions:
        perms = [rp.permission.code for rp in role.permissions if rp.permission]

    return CurrentUserData(
        user=UserSummary(id=user.id, email=user.email, full_name=user.full_name, phone=user.phone, role=user.current_role),
        business=BusinessSummary(id=business.id, name=business.name, currency=business.currency, timezone=business.timezone),
        role=RoleSummary(name=user.current_role, display_name=role.display_name if role else user.current_role),
        permissions=perms,
    )


async def change_password(db: AsyncSession, user: User, data: ChangePasswordRequest):
    if not verify_password(data.current_password, user.password_hash):
        raise ValidationException("Current password is incorrect")

    user.password_hash = hash_password(data.new_password)
    await log_audit(
        db=db,
        tenant_id=user.current_tenant_id,
        user_id=user.id,
        action="CHANGE_PASSWORD",
        entity_type="user",
        entity_id=user.id,
        description="Password changed successfully",
    )
    await db.commit()


async def update_profile(db: AsyncSession, user: User, data: UpdateProfileRequest) -> UserSummary:
    if data.full_name is not None:
        user.full_name = data.full_name
    if data.phone is not None:
        user.phone = data.phone

    await db.commit()
    await db.refresh(user)
    return UserSummary(id=user.id, email=user.email, full_name=user.full_name, phone=user.phone, role=user.current_role)
