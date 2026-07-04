import pytest
from pydantic import ValidationError

from app.config import Settings


def test_settings_reads_from_env(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "999:real-token")
    monkeypatch.setenv("SUPABASE_URL", "https://tenant.supabase.co")
    monkeypatch.setenv("SUPABASE_KEY", "secret-key")

    settings = Settings()

    assert settings.telegram_bot_token == "999:real-token"
    assert settings.supabase_url == "https://tenant.supabase.co"
    assert settings.supabase_key == "secret-key"


def test_settings_requires_telegram_credentials(monkeypatch):
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_KEY", raising=False)

    with pytest.raises(ValidationError):
        Settings()
