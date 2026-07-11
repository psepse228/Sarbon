import hmac
from typing import Any, Literal

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.ai.engine import generate_reply
from app.config import get_settings

router = APIRouter(prefix="/internal")


class TestChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class TestChatRequest(BaseModel):
    tenant_id: str
    history: list[TestChatTurn]


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
        body.tenant_id, f"test-{body.tenant_id}", history, test_mode=True
    )
    return TestChatResponse(
        reply=result.reply,
        tool_calls=[
            ToolCallOut(name=tc.name, arguments=tc.arguments, result=tc.result)
            for tc in result.tool_calls
        ],
    )
