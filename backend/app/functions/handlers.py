from typing import Any

from app.db import get_supabase_client


def _fetch_company_profile(tenant_id: str) -> dict[str, Any] | None:
    client = get_supabase_client()
    response = (
        client.table("company_profile")
        .select("packages,faq,partners,policies,active_notice,company_name,address,phone,socials")
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    )
    rows = response.data
    return rows[0] if rows else None


async def get_active_notice(tenant_id: str) -> str | None:
    """A short-lived announcement the owner's AI assistant can post (see
    dashboard's /assistant), e.g. "we have a promotion starting tomorrow" —
    woven into the client bot's system prompt when present."""
    profile = _fetch_company_profile(tenant_id)
    if profile is None:
        return None
    return profile.get("active_notice") or None


async def get_company_info(tenant_id: str) -> dict[str, str] | None:
    """Company name/address/phone/socials, woven into the client bot's
    system prompt when any field is set (see engine._system_message)."""
    profile = _fetch_company_profile(tenant_id)
    if profile is None:
        return None
    fields = {
        "name": profile.get("company_name"),
        "address": profile.get("address"),
        "phone": profile.get("phone"),
        "socials": profile.get("socials"),
    }
    info = {key: value for key, value in fields.items() if value}
    return info or None


async def get_package_price(tenant_id: str, package_name: str) -> dict[str, Any] | None:
    profile = _fetch_company_profile(tenant_id)
    if profile is None:
        return None
    target = package_name.strip().lower()
    for package in profile.get("packages") or []:
        if (package.get("name") or "").strip().lower() == target:
            return package
    return None


async def list_packages(tenant_id: str) -> list[dict[str, Any]] | None:
    profile = _fetch_company_profile(tenant_id)
    if profile is None:
        return None
    packages = profile.get("packages") or []
    return packages or None


async def check_date_availability(tenant_id: str, date: str) -> dict[str, Any] | None:
    client = get_supabase_client()
    response = (
        client.table("availability_cache")
        .select("is_available,event_details")
        .eq("tenant_id", tenant_id)
        .eq("date", date)
        .limit(1)
        .execute()
    )
    rows = response.data
    return rows[0] if rows else None


async def get_faq(tenant_id: str, topic: str) -> dict[str, Any] | None:
    profile = _fetch_company_profile(tenant_id)
    if profile is None:
        return None
    target = topic.strip().lower()
    for entry in profile.get("faq") or []:
        if target in (entry.get("question") or "").lower():
            return entry
    return None


async def get_partners(tenant_id: str, category: str) -> list[dict[str, Any]] | None:
    profile = _fetch_company_profile(tenant_id)
    if profile is None:
        return None
    target = category.strip().lower()
    matches = [
        partner
        for partner in profile.get("partners") or []
        if (partner.get("category") or "").strip().lower() == target
    ]
    return matches or None


async def escalate_to_human(conversation_id: str, reason: str) -> dict[str, Any] | None:
    client = get_supabase_client()
    response = (
        client.table("escalations")
        .insert({"conversation_id": conversation_id, "reason": reason})
        .execute()
    )
    rows = response.data
    return rows[0] if rows else None
