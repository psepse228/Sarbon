from typing import Any

from app.db import get_supabase_client


def get_or_create_conversation(tenant_id: str, client_id: str, channel: str = "telegram") -> str:
    client = get_supabase_client()
    response = (
        client.table("conversations")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("client_id", client_id)
        .eq("channel", channel)
        .limit(1)
        .execute()
    )
    rows = response.data
    if rows:
        return rows[0]["id"]

    insert_response = (
        client.table("conversations")
        .insert({"tenant_id": tenant_id, "client_id": client_id, "channel": channel})
        .execute()
    )
    return insert_response.data[0]["id"]


def save_message(conversation_id: str, role: str, content: str) -> None:
    client = get_supabase_client()
    client.table("messages").insert(
        {"conversation_id": conversation_id, "role": role, "content": content}
    ).execute()


def get_recent_messages(conversation_id: str, limit: int = 30) -> list[dict[str, Any]]:
    client = get_supabase_client()
    response = (
        client.table("messages")
        .select("role,content")
        .eq("conversation_id", conversation_id)
        .order("created_at")
        .limit(limit)
        .execute()
    )
    return response.data
