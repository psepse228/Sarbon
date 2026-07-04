from functools import lru_cache

from app.db import get_supabase_client


@lru_cache
def get_tenant_id(bot_token: str) -> str:
    client = get_supabase_client()
    response = (
        client.table("tenants")
        .select("id")
        .eq("telegram_bot_token", bot_token)
        .limit(1)
        .execute()
    )
    rows = response.data
    if not rows:
        raise RuntimeError("No tenant found for this bot token")
    return rows[0]["id"]
