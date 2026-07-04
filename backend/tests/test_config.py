from app.config import Settings


def test_settings_reads_from_env(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "999:real-token")
    monkeypatch.setenv("SUPABASE_URL", "https://tenant.supabase.co")
    monkeypatch.setenv("SUPABASE_KEY", "secret-key")

    settings = Settings()

    assert settings.telegram_bot_token == "999:real-token"
    assert settings.supabase_url == "https://tenant.supabase.co"
    assert settings.supabase_key == "secret-key"
