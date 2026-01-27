"""Application configuration via pydantic-settings."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # API Key for authentication
    api_key: str = "dev-key"

    # Database
    database_url: str = "sqlite:///./data/familylist.db"

    # Environment
    environment: str = "development"

    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # AI Model
    embedding_model: str = "all-MiniLM-L6-v2"

    @property
    def is_development(self) -> bool:
        return self.environment == "development"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
