import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "AWS Cost Management Platform"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "k8s-cost-mgmt-super-secret-key-change-in-production-2024")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    SESSION_TIMEOUT_MINUTES: int = 10
    MAX_ACTIVE_SESSIONS: int = 2
    MAX_LOGIN_ATTEMPTS: int = 5
    DATABASE_URL: str = "sqlite:///./cost_platform.db"
    ENCRYPTION_KEY: str = os.getenv("ENCRYPTION_KEY", "VGhpcyBpcyBhIDMyIGJ5dGUga2V5ISEhISEhIQ==")
    CACHE_TTL_SECONDS: int = 300  # 5 minutes
    AWS_NEWS_REFRESH_INTERVAL: int = 900  # 15 minutes

    class Config:
        env_file = ".env"


settings = Settings()
