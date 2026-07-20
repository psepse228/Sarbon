from unittest.mock import AsyncMock

from app.ai.engine import GeneratedReply
from app.bot import dispatcher
from app.rate_limit import RateLimitExceeded


async def test_handle_message_persists_conversation_and_replies_with_generated_content(monkeypatch):
    message = AsyncMock()
    message.text = "Сколько стоит Стандарт?"
    message.chat.id = 12345

    monkeypatch.setattr(dispatcher, "get_tenant_id", lambda bot_token: "tenant-1")
    monkeypatch.setattr(
        dispatcher, "get_or_create_conversation", lambda tenant_id, client_id: "conv-1"
    )
    monkeypatch.setattr(dispatcher, "enforce_chat_rate_limit", lambda tenant_id: None)

    saved_messages = []
    monkeypatch.setattr(
        dispatcher,
        "save_message",
        lambda conversation_id, role, content: saved_messages.append(
            (conversation_id, role, content)
        ),
    )
    monkeypatch.setattr(
        dispatcher,
        "get_recent_messages",
        lambda conversation_id, limit=20: [
            {"role": "client", "content": "Сколько стоит Стандарт?"}
        ],
    )

    async def fake_generate_reply(tenant_id, conversation_id, history):
        assert tenant_id == "tenant-1"
        assert conversation_id == "conv-1"
        assert history == [{"role": "user", "content": "Сколько стоит Стандарт?"}]
        return GeneratedReply("Пакет «Стандарт» стоит 250 000 ₽.", [])

    monkeypatch.setattr(dispatcher, "generate_reply", fake_generate_reply)

    await dispatcher.handle_message(message)

    message.answer.assert_awaited_once_with("Пакет «Стандарт» стоит 250 000 ₽.")
    assert saved_messages == [
        ("conv-1", "client", "Сколько стоит Стандарт?"),
        ("conv-1", "bot", "Пакет «Стандарт» стоит 250 000 ₽."),
    ]


async def test_handle_message_replies_with_fallback_and_notifies_admin_on_error(monkeypatch):
    message = AsyncMock()
    message.text = "Привет"
    message.chat.id = 12345

    monkeypatch.setattr(dispatcher, "get_tenant_id", lambda bot_token: "tenant-1")
    monkeypatch.setattr(
        dispatcher, "get_or_create_conversation", lambda tenant_id, client_id: "conv-1"
    )
    monkeypatch.setattr(dispatcher, "enforce_chat_rate_limit", lambda tenant_id: None)

    saved_messages = []
    monkeypatch.setattr(
        dispatcher,
        "save_message",
        lambda conversation_id, role, content: saved_messages.append(
            (conversation_id, role, content)
        ),
    )
    monkeypatch.setattr(
        dispatcher, "get_recent_messages", lambda conversation_id, limit=20: []
    )

    async def failing_generate_reply(tenant_id, conversation_id, history):
        raise RuntimeError("OpenAI is down")

    monkeypatch.setattr(dispatcher, "generate_reply", failing_generate_reply)

    notified = []

    async def fake_notify_admin(text):
        notified.append(text)

    monkeypatch.setattr(dispatcher, "notify_admin", fake_notify_admin)

    await dispatcher.handle_message(message)

    message.answer.assert_awaited_once_with(dispatcher._FALLBACK_REPLY)
    assert saved_messages[-1] == ("conv-1", "bot", dispatcher._FALLBACK_REPLY)
    assert len(notified) == 1
    assert "conv-1" in notified[0]


async def test_handle_message_stops_and_replies_when_rate_limited(monkeypatch):
    """Regression guard for the no-rate-limit finding: when the tenant's cap
    is hit, generate_reply must never be called at all (that's the whole
    point -- bounding GPT-4o cost), and the guest gets a short notice."""
    message = AsyncMock()
    message.text = "Привет"
    message.chat.id = 12345

    monkeypatch.setattr(dispatcher, "get_tenant_id", lambda bot_token: "tenant-1")
    monkeypatch.setattr(
        dispatcher, "get_or_create_conversation", lambda tenant_id, client_id: "conv-1"
    )
    saved_messages = []
    monkeypatch.setattr(
        dispatcher,
        "save_message",
        lambda conversation_id, role, content: saved_messages.append(
            (conversation_id, role, content)
        ),
    )

    def raise_rate_limited(tenant_id):
        raise RateLimitExceeded("too fast")

    monkeypatch.setattr(dispatcher, "enforce_chat_rate_limit", raise_rate_limited)

    generate_reply_mock = AsyncMock()
    monkeypatch.setattr(dispatcher, "generate_reply", generate_reply_mock)

    await dispatcher.handle_message(message)

    generate_reply_mock.assert_not_awaited()
    message.answer.assert_awaited_once_with(dispatcher._RATE_LIMIT_REPLY)
    assert saved_messages == [("conv-1", "client", "Привет")]


async def test_whoami_handler_replies_with_chat_id():
    message = AsyncMock()
    message.chat.id = 98765

    await dispatcher.whoami_handler(message)

    message.answer.assert_awaited_once_with("Ваш chat_id: 98765")
