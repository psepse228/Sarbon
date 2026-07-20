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


@pytest.fixture(autouse=True)
def _no_company_info(monkeypatch):
    """Default for every test in this file — override in a specific test to
    exercise the company-info injection path."""

    async def fake_get_company_info(tenant_id):
        return None

    monkeypatch.setattr(engine.handlers, "get_company_info", fake_get_company_info)


@pytest.fixture(autouse=True)
def _no_disabled_skills(monkeypatch):
    """Default for every test in this file — override in a specific test to
    exercise the skill-filtering path."""

    async def fake_get_disabled_skills(tenant_id):
        return []

    monkeypatch.setattr(engine.handlers, "get_disabled_skills", fake_get_disabled_skills)


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

    assert result.reply == "Хорошо, вот ответ на ваш последний вопрос."
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

    assert result.reply == "Да, сейчас у нас скидка 10% на будние дни в июле."
    system_message = client.chat.completions.calls[0]["messages"][0]
    assert "Акция: скидка 10% на банкеты по будням в июле." in system_message["content"]


async def test_generate_reply_injects_company_info_into_system_prompt(monkeypatch):
    async def fake_get_company_info(tenant_id):
        assert tenant_id == "tenant-1"
        return {"name": "Cortège", "address": "Ташкент, ул. Examples 12", "phone": "+998 90 000-00-00"}

    monkeypatch.setattr(engine.handlers, "get_company_info", fake_get_company_info)

    client = _FakeOpenAIClient([_final_response("Мы находимся по адресу: Ташкент, ул. Examples 12.")])
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    result = await engine.generate_reply("tenant-1", "conv-1", [{"role": "user", "content": "Где вы находитесь?"}])

    assert result.reply == "Мы находимся по адресу: Ташкент, ул. Examples 12."
    system_message = client.chat.completions.calls[0]["messages"][0]
    assert "Ташкент, ул. Examples 12" in system_message["content"]
    assert "+998 90 000-00-00" in system_message["content"]


async def test_generate_reply_returns_content_directly_when_no_tool_call(monkeypatch):
    client = _FakeOpenAIClient([_final_response("Добрый день! Чем помочь?")])
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    result = await engine.generate_reply("tenant-1", "conv-1", [{"role": "user", "content": "Привет"}])

    assert result.reply == "Добрый день! Чем помочь?"
    assert result.tool_calls == []
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

    assert result.reply == "Пакет «Стандарт» стоит 250 000 ₽."
    assert result.tool_calls == [
        engine.ToolCallRecord(
            "get_package_price",
            {"package_name": "Стандарт"},
            {"name": "Стандарт", "price": 250000, "currency": "RUB"},
        )
    ]
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

    assert result.reply == "У нас есть пакеты «Стандарт» и «Премиум»."


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

    assert result.reply == "Передал администратору, он свяжется с вами."
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

    assert result.reply == "Уточню детали у администратора и вернусь с ответом."
    assert len(client.chat.completions.calls) == engine.MAX_TOOL_ROUNDS


async def test_generate_reply_test_mode_escalation_does_not_write_or_notify(monkeypatch):
    tool_call = _FakeToolCall("call_1", "escalate_to_human", {"reason": "вопрос вне темы"})
    client = _FakeOpenAIClient(
        [
            _tool_call_response(tool_call),
            _final_response("Уточню и вернусь с ответом."),
        ]
    )
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    escalate_calls = []

    async def fake_escalate(conversation_id, reason):
        escalate_calls.append((conversation_id, reason))
        return {"conversation_id": conversation_id, "reason": reason}

    monkeypatch.setattr(engine.handlers, "escalate_to_human", fake_escalate)

    notified = []

    async def fake_notify_admin(text):
        notified.append(text)

    monkeypatch.setattr(engine, "notify_admin", fake_notify_admin)

    result = await engine.generate_reply(
        "tenant-1", "test-conv", [{"role": "user", "content": "вопрос не по теме"}], test_mode=True
    )

    assert result.reply == "Уточню и вернусь с ответом."
    assert escalate_calls == []
    assert notified == []
    assert result.tool_calls == [
        engine.ToolCallRecord("escalate_to_human", {"reason": "вопрос вне темы"}, {"would_escalate": True, "reason": "вопрос вне темы"})
    ]


async def test_generate_reply_flags_knowledge_gap_with_tenant_and_conversation_id(monkeypatch):
    tool_call = _FakeToolCall("call_1", "flag_knowledge_gap", {"question": "есть ли парковка для автобуса?"})
    client = _FakeOpenAIClient(
        [
            _tool_call_response(tool_call),
            _final_response("Уточню это и вернусь с ответом."),
        ]
    )
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    async def fake_flag(tenant_id, conversation_id, question):
        assert tenant_id == "tenant-1"
        assert conversation_id == "conv-1"
        assert question == "есть ли парковка для автобуса?"
        return {"tenant_id": tenant_id, "conversation_id": conversation_id, "question": question}

    monkeypatch.setattr(engine.handlers, "flag_knowledge_gap", fake_flag)

    result = await engine.generate_reply("tenant-1", "conv-1", [{"role": "user", "content": "Есть парковка для автобуса?"}])

    assert result.reply == "Уточню это и вернусь с ответом."


async def test_generate_reply_test_mode_gap_does_not_write(monkeypatch):
    tool_call = _FakeToolCall("call_1", "flag_knowledge_gap", {"question": "работает ли зимой открытая веранда?"})
    client = _FakeOpenAIClient(
        [
            _tool_call_response(tool_call),
            _final_response("Уточню и вернусь с ответом."),
        ]
    )
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    flag_calls = []

    async def fake_flag(tenant_id, conversation_id, question):
        flag_calls.append((tenant_id, conversation_id, question))
        return {"tenant_id": tenant_id, "conversation_id": conversation_id, "question": question}

    monkeypatch.setattr(engine.handlers, "flag_knowledge_gap", fake_flag)

    result = await engine.generate_reply(
        "tenant-1", "test-conv", [{"role": "user", "content": "работает ли зимой открытая веранда?"}], test_mode=True
    )

    assert result.reply == "Уточню и вернусь с ответом."
    assert flag_calls == []
    assert result.tool_calls == [
        engine.ToolCallRecord(
            "flag_knowledge_gap",
            {"question": "работает ли зимой открытая веранда?"},
            {"would_flag": True, "question": "работает ли зимой открытая веранда?"},
        )
    ]


async def test_generate_reply_captures_lead_with_tenant_and_conversation_id(monkeypatch):
    tool_call = _FakeToolCall("call_1", "capture_lead", {"name": "Анна", "phone": "+998901234567"})
    client = _FakeOpenAIClient(
        [
            _tool_call_response(tool_call),
            _final_response("Спасибо, Анна! Передал заявку администратору."),
        ]
    )
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    async def fake_capture(tenant_id, conversation_id, **fields):
        assert tenant_id == "tenant-1"
        assert conversation_id == "conv-1"
        assert fields == {"name": "Анна", "phone": "+998901234567"}
        return {"tenant_id": tenant_id, "conversation_id": conversation_id, **fields}

    monkeypatch.setattr(engine.handlers, "capture_lead", fake_capture)

    result = await engine.generate_reply(
        "tenant-1", "conv-1", [{"role": "user", "content": "Меня зовут Анна, номер +998901234567"}]
    )

    assert result.reply == "Спасибо, Анна! Передал заявку администратору."


async def test_generate_reply_test_mode_lead_does_not_write(monkeypatch):
    tool_call = _FakeToolCall("call_1", "capture_lead", {"name": "Анна", "phone": "+998901234567"})
    client = _FakeOpenAIClient(
        [
            _tool_call_response(tool_call),
            _final_response("Спасибо, Анна!"),
        ]
    )
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    capture_calls = []

    async def fake_capture(tenant_id, conversation_id, **fields):
        capture_calls.append((tenant_id, conversation_id, fields))
        return {"tenant_id": tenant_id, "conversation_id": conversation_id, **fields}

    monkeypatch.setattr(engine.handlers, "capture_lead", fake_capture)

    result = await engine.generate_reply(
        "tenant-1",
        "test-conv",
        [{"role": "user", "content": "Меня зовут Анна, номер +998901234567"}],
        test_mode=True,
    )

    assert result.reply == "Спасибо, Анна!"
    assert capture_calls == []
    assert result.tool_calls == [
        engine.ToolCallRecord(
            "capture_lead",
            {"name": "Анна", "phone": "+998901234567"},
            {"would_capture_lead": True, "name": "Анна", "phone": "+998901234567"},
        )
    ]


async def test_generate_reply_captures_review_with_tenant_and_conversation_id(monkeypatch):
    tool_call = _FakeToolCall("call_1", "capture_review", {"rating": 5, "comment": "Всё супер!"})
    client = _FakeOpenAIClient(
        [
            _tool_call_response(tool_call),
            _final_response("Спасибо большое за отзыв!"),
        ]
    )
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    async def fake_capture_review(tenant_id, conversation_id, rating, comment=None):
        assert tenant_id == "tenant-1"
        assert conversation_id == "conv-1"
        assert rating == 5
        assert comment == "Всё супер!"
        return {"tenant_id": tenant_id, "conversation_id": conversation_id, "rating": rating, "comment": comment}

    monkeypatch.setattr(engine.handlers, "capture_review", fake_capture_review)

    result = await engine.generate_reply(
        "tenant-1", "conv-1", [{"role": "user", "content": "Спасибо, всё было супер! Оценю на 5"}]
    )

    assert result.reply == "Спасибо большое за отзыв!"


async def test_generate_reply_test_mode_review_does_not_write(monkeypatch):
    tool_call = _FakeToolCall("call_1", "capture_review", {"rating": 5, "comment": None})
    client = _FakeOpenAIClient(
        [
            _tool_call_response(tool_call),
            _final_response("Спасибо!"),
        ]
    )
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    capture_calls = []

    async def fake_capture_review(tenant_id, conversation_id, rating, comment=None):
        capture_calls.append((tenant_id, conversation_id, rating, comment))
        return {"tenant_id": tenant_id, "conversation_id": conversation_id, "rating": rating, "comment": comment}

    monkeypatch.setattr(engine.handlers, "capture_review", fake_capture_review)

    result = await engine.generate_reply(
        "tenant-1", "test-conv", [{"role": "user", "content": "5 из 5!"}], test_mode=True
    )

    assert result.reply == "Спасибо!"
    assert capture_calls == []
    assert result.tool_calls == [
        engine.ToolCallRecord("capture_review", {"rating": 5, "comment": None}, {"would_capture_review": True, "rating": 5, "comment": None})
    ]


async def test_generate_reply_offers_all_tools_when_nothing_disabled(monkeypatch):
    client = _FakeOpenAIClient([_final_response("Добрый день!")])
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    await engine.generate_reply("tenant-1", "conv-1", [{"role": "user", "content": "Привет"}])

    tools_used = client.chat.completions.calls[0]["tools"]
    names = {t["function"]["name"] for t in tools_used}
    assert names == {
        "get_package_price",
        "list_packages",
        "check_date_availability",
        "get_faq",
        "get_partners",
        "escalate_to_human",
        "flag_knowledge_gap",
        "capture_lead",
        "capture_review",
    }


async def test_generate_reply_excludes_tools_for_disabled_skills(monkeypatch):
    async def fake_get_disabled_skills(tenant_id):
        assert tenant_id == "tenant-1"
        return ["partners", "faq"]

    monkeypatch.setattr(engine.handlers, "get_disabled_skills", fake_get_disabled_skills)

    client = _FakeOpenAIClient([_final_response("Добрый день!")])
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    await engine.generate_reply("tenant-1", "conv-1", [{"role": "user", "content": "Привет"}])

    tools_used = client.chat.completions.calls[0]["tools"]
    names = {t["function"]["name"] for t in tools_used}
    assert "get_partners" not in names
    assert "get_faq" not in names
    assert names == {
        "get_package_price",
        "list_packages",
        "check_date_availability",
        "escalate_to_human",
        "flag_knowledge_gap",
        "capture_lead",
        "capture_review",
    }


async def test_generate_reply_uses_disabled_skills_override_in_test_mode(monkeypatch):
    async def fail_if_called(tenant_id):
        raise AssertionError("get_disabled_skills should not be called when an override is provided")

    monkeypatch.setattr(engine.handlers, "get_disabled_skills", fail_if_called)

    client = _FakeOpenAIClient([_final_response("Добрый день!")])
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    await engine.generate_reply(
        "tenant-1",
        "test-conv",
        [{"role": "user", "content": "Привет"}],
        test_mode=True,
        disabled_skills_override=["faq", "partners"],
    )

    tools_used = client.chat.completions.calls[0]["tools"]
    names = {t["function"]["name"] for t in tools_used}
    assert "get_faq" not in names
    assert "get_partners" not in names
    assert names == {
        "get_package_price",
        "list_packages",
        "check_date_availability",
        "escalate_to_human",
        "flag_knowledge_gap",
        "capture_lead",
        "capture_review",
    }


async def test_generate_reply_treats_empty_list_override_as_all_enabled(monkeypatch):
    async def fail_if_called(tenant_id):
        raise AssertionError("get_disabled_skills should not be called when an override is provided, even an empty one")

    monkeypatch.setattr(engine.handlers, "get_disabled_skills", fail_if_called)

    client = _FakeOpenAIClient([_final_response("Добрый день!")])
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    await engine.generate_reply(
        "tenant-1",
        "test-conv",
        [{"role": "user", "content": "Привет"}],
        test_mode=True,
        disabled_skills_override=[],
    )

    tools_used = client.chat.completions.calls[0]["tools"]
    names = {t["function"]["name"] for t in tools_used}
    assert names == {
        "get_package_price",
        "list_packages",
        "check_date_availability",
        "get_faq",
        "get_partners",
        "escalate_to_human",
        "flag_knowledge_gap",
        "capture_lead",
        "capture_review",
    }


async def test_generate_reply_ignores_override_when_none(monkeypatch):
    real_disabled_skills_called = []

    async def fake_get_disabled_skills(tenant_id):
        real_disabled_skills_called.append(tenant_id)
        return []

    monkeypatch.setattr(engine.handlers, "get_disabled_skills", fake_get_disabled_skills)

    client = _FakeOpenAIClient([_final_response("Добрый день!")])
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    await engine.generate_reply("tenant-1", "conv-1", [{"role": "user", "content": "Привет"}])

    assert real_disabled_skills_called == ["tenant-1"]


def test_prompt_requires_flag_knowledge_gap_before_telling_client_it_will_check():
    # Regression guard: a live eval caught the model saying "I'll check with
    # the administrator" for an unlisted package's price without actually
    # calling flag_knowledge_gap -- the promise was hollow, the admin would
    # never learn about the question. The prompt must forbid that gap.
    assert "ты ОБЯЗАН вызвать" in engine.SYSTEM_PROMPT_BASE
    assert "ничем не подкреплено" in engine.SYSTEM_PROMPT_BASE
