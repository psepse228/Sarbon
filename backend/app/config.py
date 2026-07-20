from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    telegram_bot_token: str
    supabase_url: str
    supabase_key: str
    openai_api_key: str
    admin_telegram_chat_id: str | None = None
    internal_api_secret: str | None = None
    telegram_webhook_secret: str | None = None
    google_service_account_json: str | None = None
    environment: str = "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()
