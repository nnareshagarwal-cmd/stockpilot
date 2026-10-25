from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://stockpilot:stockpilot_dev@localhost:5433/stockpilot"
    DATABASE_URL_SYNC: str = "postgresql://stockpilot:stockpilot_dev@localhost:5433/stockpilot"

    # Auth
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"

    # App
    ENVIRONMENT: str = "development"
    APP_NAME: str = "StockPilot"

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # File Storage
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 10

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "allow"


settings = Settings()
