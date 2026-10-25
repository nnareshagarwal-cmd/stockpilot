from fastapi import Request
from fastapi.responses import JSONResponse


class AppException(Exception):
    def __init__(self, status_code: int, code: str, message: str, details: list = None):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details or []


class NotFoundException(AppException):
    def __init__(self, resource: str, id: str = None):
        detail = f"{resource} not found" + (f": {id}" if id else "")
        super().__init__(404, "NOT_FOUND", detail)


class ConflictException(AppException):
    def __init__(self, message: str):
        super().__init__(409, "CONFLICT", message)


class ForbiddenException(AppException):
    def __init__(self, message: str = "You do not have permission to perform this action"):
        super().__init__(403, "FORBIDDEN", message)


class UnauthorizedException(AppException):
    def __init__(self, message: str = "Authentication required"):
        super().__init__(401, "UNAUTHORIZED", message)


class ValidationException(AppException):
    def __init__(self, message: str, details: list = None):
        super().__init__(400, "VALIDATION_ERROR", message, details)


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
            }
        },
    )
