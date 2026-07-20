from datetime import datetime, timedelta, timezone

from app.db import get_supabase_client

MIN_SECONDS_BETWEEN_MESSAGES = 2
MAX_MESSAGES_PER_DAY = 200


class RateLimitExceeded(Exception):
    """Raised when a tenant's guest-facing bot traffic exceeds the cooldown
    or daily cap. Mirrors Tender Agent's app/chat/rate_limit.py -- bounds
    worst-case OpenAI cost exposure from a scripted spam loop (there is no
    per-tenant cap on this path otherwise) without getting in the way of a
    real conversation."""


def enforce_chat_rate_limit(tenant_id: str, client=None) -> None:
    """Scoped by tenant_id, not by individual guest/conversation -- since one
    Telegram bot token maps to exactly one tenant here, this bounds total
    cost for that tenant's bot regardless of how many distinct (real or
    forged) chat_ids a burst of traffic spreads across."""
    if client is None:
        client = get_supabase_client()

    conversation_rows = (
        client.table("conversations").select("id").eq("tenant_id", tenant_id).execute().data or []
    )
    conversation_ids = [row["id"] for row in conversation_rows]
    if not conversation_ids:
        return

    since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    rows = (
        client.table("messages")
        .select("created_at")
        .in_("conversation_id", conversation_ids)
        .eq("role", "client")
        .gte("created_at", since)
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )

    if len(rows) >= MAX_MESSAGES_PER_DAY:
        raise RateLimitExceeded("Daily message limit reached for this tenant, try again tomorrow")

    if rows:
        last_sent = datetime.fromisoformat(rows[0]["created_at"])
        elapsed = (datetime.now(timezone.utc) - last_sent).total_seconds()
        if elapsed < MIN_SECONDS_BETWEEN_MESSAGES:
            raise RateLimitExceeded("Messages arriving too quickly for this tenant, slow down")
