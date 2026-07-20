import hmac
import logging
from typing import Any, Literal

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.ai.engine import generate_reply
from app.calendar_sync import get_service_account_email, sync_calendar
from app.config import get_settings
from app.db import get_supabase_client
from app.notifications import get_notifier_bot

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/internal")


class TestChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class TestChatRequest(BaseModel):
    tenant_id: str
    history: list[TestChatTurn]
    disabled_skills: list[str] | None = None


class ToolCallOut(BaseModel):
    name: str
    arguments: dict[str, Any]
    result: Any


class TestChatResponse(BaseModel):
    reply: str
    tool_calls: list[ToolCallOut]


@router.post("/test-chat", response_model=TestChatResponse)
async def test_chat(
    body: TestChatRequest,
    x_internal_secret: str = Header(..., alias="X-Internal-Secret"),
) -> TestChatResponse:
    """Owner-only: lets the dashboard's Test Console exercise the real
    guest-bot engine without writing real conversation/escalation rows or
    paging the admin. Never used by real guests — see
    dashboard/src/app/api/test-chat/route.ts for the only caller."""
    settings = get_settings()
    if not settings.internal_api_secret or not hmac.compare_digest(
        x_internal_secret, settings.internal_api_secret
    ):
        raise HTTPException(status_code=401, detail="Invalid internal secret")

    history = [{"role": turn.role, "content": turn.content} for turn in body.history]
    result = await generate_reply(
        body.tenant_id,
        f"test-{body.tenant_id}",
        history,
        test_mode=True,
        disabled_skills_override=body.disabled_skills,
    )
    return TestChatResponse(
        reply=result.reply,
        tool_calls=[
            ToolCallOut(name=tc.name, arguments=tc.arguments, result=tc.result)
            for tc in result.tool_calls
        ],
    )


class BroadcastRequest(BaseModel):
    chat_ids: list[str]
    message: str


class BroadcastResponse(BaseModel):
    sent_count: int


@router.post("/broadcast", response_model=BroadcastResponse)
async def broadcast(
    body: BroadcastRequest,
    x_internal_secret: str = Header(..., alias="X-Internal-Secret"),
) -> BroadcastResponse:
    """Owner-triggered, send-now message to a filtered guest audience — see
    dashboard/src/lib/broadcasts.ts for the only caller. Per-recipient
    failures (blocked bot, invalid chat id) don't abort the batch."""
    settings = get_settings()
    if not settings.internal_api_secret or not hmac.compare_digest(
        x_internal_secret, settings.internal_api_secret
    ):
        raise HTTPException(status_code=401, detail="Invalid internal secret")

    bot = get_notifier_bot()
    sent_count = 0
    for chat_id in body.chat_ids:
        try:
            await bot.send_message(chat_id=chat_id, text=body.message)
            sent_count += 1
        except Exception:
            logger.exception("broadcast send failed for chat_id %s", chat_id)

    return BroadcastResponse(sent_count=sent_count)


@router.get("/calendar-service-account-email")
async def calendar_service_account_email(
    x_internal_secret: str = Header(..., alias="X-Internal-Secret"),
) -> dict[str, str]:
    """The email the owner shares their Google Calendar with — see
    dashboard/src/lib/calendar.ts for the only caller."""
    settings = get_settings()
    if not settings.internal_api_secret or not hmac.compare_digest(
        x_internal_secret, settings.internal_api_secret
    ):
        raise HTTPException(status_code=401, detail="Invalid internal secret")

    return {"email": get_service_account_email()}


class SyncCalendarRequest(BaseModel):
    tenant_id: str


class SyncCalendarResponse(BaseModel):
    synced_count: int


def _get_tenant_calendar_id(tenant_id: str) -> str | None:
    client = get_supabase_client()
    response = (
        client.table("company_profile")
        .select("google_calendar_id")
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    )
    rows = response.data
    return rows[0]["google_calendar_id"] if rows else None


@router.post("/sync-calendar", response_model=SyncCalendarResponse)
async def sync_calendar_endpoint(
    body: SyncCalendarRequest,
    x_internal_secret: str = Header(..., alias="X-Internal-Secret"),
) -> SyncCalendarResponse:
    """Manual, owner-triggered sync — no automatic/scheduled runs (no job
    scheduler exists in this repo). See dashboard/src/lib/calendar.ts.

    Deliberately does not accept a calendar_id from the caller -- it was
    previously taken from the request body and forwarded straight to Google,
    which let any authenticated tenant sync (and read back) any other
    tenant's real calendar just by naming it. The calendar to sync is always
    this tenant's own saved company_profile.google_calendar_id."""
    settings = get_settings()
    if not settings.internal_api_secret or not hmac.compare_digest(
        x_internal_secret, settings.internal_api_secret
    ):
        raise HTTPException(status_code=401, detail="Invalid internal secret")

    calendar_id = _get_tenant_calendar_id(body.tenant_id)
    if not calendar_id:
        raise HTTPException(status_code=400, detail="No calendar connected for this tenant")

    synced_count = await sync_calendar(body.tenant_id, calendar_id)
    return SyncCalendarResponse(synced_count=synced_count)
