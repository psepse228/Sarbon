from typing import Any


async def get_package_price(tenant_id: str, package_name: str) -> dict[str, Any] | None:
    return None


async def check_date_availability(tenant_id: str, date: str) -> dict[str, Any] | None:
    return None


async def get_faq(tenant_id: str, topic: str) -> dict[str, Any] | None:
    return None


async def get_partners(tenant_id: str, category: str) -> dict[str, Any] | None:
    return None


async def escalate_to_human(conversation_id: str, reason: str) -> dict[str, Any] | None:
    return None
