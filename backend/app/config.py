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

    # Clerk authentication
    clerk_publishable_key: str = ""
    clerk_secret_key: str = ""
    clerk_jwt_issuer: str = ""  # e.g., "https://your-domain.clerk.accounts.dev"
    clerk_authorized_parties: list[str] = []  # e.g., ["https://yourapp.com"]
    auth_mode: str = "api_key"  # "api_key" | "clerk" | "hybrid"

    # Database
    database_url: str = "sqlite:///./data/familylist.db"

    # Environment
    environment: str = "development"

    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # AI Model - Embeddings
    embedding_model: str = "all-MiniLM-L6-v2"

    # AI Model - LLM for natural language parsing
    enable_llm_parsing: bool = True
    llm_backend: str = "openai"  # "openai", "ollama", or "local"
    llm_model_path: str = ""  # Path to GGUF model file (for local backend)
    llm_ollama_url: str = "http://localhost:11434"  # Ollama API URL
    llm_ollama_model: str = "phi3:mini"  # Ollama model name
    llm_openai_api_key: str = ""  # OpenAI API key
    llm_openai_model: str = "gpt-4o-mini"  # OpenAI model name
    llm_max_tokens: int = 512
    llm_temperature: float = 0.1  # Low temp for consistent parsing

    @property
    def is_development(self) -> bool:
        return self.environment == "development"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
