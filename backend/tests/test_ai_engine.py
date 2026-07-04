import json
from types import SimpleNamespace

import pytest

from app.ai import engine


@pytest.fixture(autouse=True)
def _no_active_notice(monkeypatch):
    """Default for every test in this file — override in a specific test to
    exercise the active_notice injection path."""

    async def fake_get_active_notice(tenant_id):
        return None

    monkeypatch.setattr(engine.handlers, "get_active_notice", fake_get_active_notice)


class _FakeToolCall:
    def __init__(self, id_, name, arguments):
        self.id = id_
        self.function = SimpleNamespace(name=name, arguments=json.dumps(arguments))


def _tool_call_response(tool_call):
    message = SimpleNamespace(content=None, tool_calls=[tool_call])
    return SimpleNamespace(choices=[SimpleNamespace(message=message)])


def _final_response(content):
    message = SimpleNamespace(content=content, tool_calls=None)
    return SimpleNamespace(choices=[SimpleNamespace(message=message)])


class _FakeCompletions:
    def __init__(self, responses):
        self._responses = list(responses)
        self.calls = []

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        return self._responses.pop(0)


class _FakeOpenAIClient:
    def __init__(self, responses):
        self.chat = SimpleNamespace(completions=_FakeCompletions(responses))


async def test_generate_reply_summarizes_long_history_before_main_call(monkeypatch):
    long_history = [
        {"role": "user" if i % 2 == 0 else "assistant", "content": f"сообщение {i}"} for i in range(20)
    ]
    client = _FakeOpenAIClient(
        [
            _final_response("Краткое содержание: клиент спрашивал про цены."),
            _final_response("Хорошо, вот ответ на ваш последний вопрос."),
        ]
    )
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    result = await engine.generate_reply("tenant-1", "conv-1", long_history)

    assert result == "Хорошо, вот ответ на ваш последний вопрос."
    calls = client.chat.completions.calls
    assert len(calls) == 2
    assert calls[0]["model"] == engine.SUMMARY_MODEL
    assert calls[1]["model"] == engine.MODEL

    main_messages = calls[1]["messages"]
    assert len(main_messages) == 2 + engine.RECENT_WINDOW
    assert "Краткое содержание" in main_messages[1]["content"]
    assert main_messages[-1] == long_history[-1]


async def test_generate_reply_injects_active_notice_into_system_prompt(monkeypatch):
    async def fake_get_active_notice(tenant_id):
        assert tenant_id == "tenant-1"
        return "Акция: скидка 10% на банкеты по будням в июле."

    monkeypatch.setattr(engine.handlers, "get_active_notice", fake_get_active_notice)

    client = _FakeOpenAIClient([_final_response("Да, сейчас у нас скидка 10% на будние дни в июле.")])
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    result = await engine.generate_reply("tenant-1", "conv-1", [{"role": "user", "content": "Есть скидки?"}])

    assert result == "Да, сейчас у нас скидка 10% на будние дни в июле."
    system_message = client.chat.completions.calls[0]["messages"][0]
    assert "Акция: скидка 10% на банкеты по будням в июле." in system_message["content"]


async def test_generate_reply_returns_content_directly_when_no_tool_call(monkeypatch):
    client = _FakeOpenAIClient([_final_response("Добрый день! Чем помочь?")])
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    result = await engine.generate_reply("tenant-1", "conv-1", [{"role": "user", "content": "Привет"}])

    assert result == "Добрый день! Чем помочь?"
    assert len(client.chat.completions.calls) == 1


async def test_generate_reply_dispatches_tool_call_and_returns_final_content(monkeypatch):
    tool_call = _FakeToolCall("call_1", "get_package_price", {"package_name": "Стандарт"})
    client = _FakeOpenAIClient(
        [
            _tool_call_response(tool_call),
            _final_response("Пакет «Стандарт» стоит 250 000 ₽."),
        ]
    )
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    async def fake_get_package_price(tenant_id, package_name):
        assert tenant_id == "tenant-1"
        assert package_name == "Стандарт"
        return {"name": "Стандарт", "price": 250000, "currency": "RUB"}

    monkeypatch.setattr(engine.handlers, "get_package_price", fake_get_package_price)

    result = await engine.generate_reply(
        "tenant-1", "conv-1", [{"role": "user", "content": "Сколько стоит Стандарт?"}]
    )

    assert result == "Пакет «Стандарт» стоит 250 000 ₽."
    second_call_messages = client.chat.completions.calls[1]["messages"]
    tool_messages = [m for m in second_call_messages if m["role"] == "tool"]
    assert tool_messages[0]["tool_call_id"] == "call_1"
    assert json.loads(tool_messages[0]["content"]) == {
        "name": "Стандарт",
        "price": 250000,
        "currency": "RUB",
    }


async def test_generate_reply_dispatches_list_packages_with_no_arguments(monkeypatch):
    tool_call = _FakeToolCall("call_1", "list_packages", {})
    client = _FakeOpenAIClient(
        [
            _tool_call_response(tool_call),
            _final_response("У нас есть пакеты «Стандарт» и «Премиум»."),
        ]
    )
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    async def fake_list_packages(tenant_id):
        assert tenant_id == "tenant-1"
        return [{"name": "Стандарт", "price": 250000, "currency": "RUB"}]

    monkeypatch.setattr(engine.handlers, "list_packages", fake_list_packages)

    result = await engine.generate_reply("tenant-1", "conv-1", [{"role": "user", "content": "Какие у вас пакеты?"}])

    assert result == "У нас есть пакеты «Стандарт» и «Премиум»."


async def test_generate_reply_escalates_with_conversation_id_not_tenant_id(monkeypatch):
    tool_call = _FakeToolCall("call_1", "escalate_to_human", {"reason": "жалоба"})
    client = _FakeOpenAIClient(
        [
            _tool_call_response(tool_call),
            _final_response("Передал администратору, он свяжется с вами."),
        ]
    )
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    async def fake_escalate(conversation_id, reason):
        assert conversation_id == "conv-1"
        assert reason == "жалоба"
        return {"conversation_id": conversation_id, "reason": reason}

    monkeypatch.setattr(engine.handlers, "escalate_to_human", fake_escalate)

    notified = []

    async def fake_notify_admin(text):
        notified.append(text)

    monkeypatch.setattr(engine, "notify_admin", fake_notify_admin)

    result = await engine.generate_reply("tenant-1", "conv-1", [{"role": "user", "content": "Жалоба"}])

    assert result == "Передал администратору, он свяжется с вами."
    assert len(notified) == 1
    assert "conv-1" in notified[0]
    assert "жалоба" in notified[0]


async def test_generate_reply_gives_up_after_max_tool_rounds(monkeypatch):
    tool_call = _FakeToolCall("call_1", "get_faq", {"topic": "неизвестно"})
    responses = [_tool_call_response(tool_call) for _ in range(engine.MAX_TOOL_ROUNDS)]
    client = _FakeOpenAIClient(responses)
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    async def fake_get_faq(tenant_id, topic):
        return None

    monkeypatch.setattr(engine.handlers, "get_faq", fake_get_faq)

    result = await engine.generate_reply("tenant-1", "conv-1", [{"role": "user", "content": "?"}])

    assert result == "Уточню детали у администратора и вернусь с ответом."
    assert len(client.chat.completions.calls) == engine.MAX_TOOL_ROUNDS
