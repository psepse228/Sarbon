from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    telegram_bot_token: str = "123456:TEST-fake-token-for-local-dev"
    supabase_url: str = "https://example.supabase.co"
    supabase_key: str = "test-service-role-key"
    environment: str = "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()
