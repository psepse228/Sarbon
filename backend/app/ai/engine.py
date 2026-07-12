import json
from datetime import date
from functools import lru_cache
from typing import Any, NamedTuple

from openai import AsyncOpenAI

from app.config import get_settings
from app.functions import handlers
from app.notifications import notify_admin

MODEL = "gpt-4o"
SUMMARY_MODEL = "gpt-4o-mini"
MAX_TOOL_ROUNDS = 4
RECENT_WINDOW = 12


class ToolCallRecord(NamedTuple):
    name: str
    arguments: dict[str, Any]
    result: Any


class GeneratedReply(NamedTuple):
    reply: str
    tool_calls: list[ToolCallRecord]


SUMMARY_PROMPT = (
    "Кратко перескажи (3-5 предложений) суть этой части переписки клиента с ботом ресторана: "
    "какие факты уже обсуждались (цены, пакеты, даты), что хотел клиент, была ли эскалация. "
    "Только факты, без оценок и домыслов. Если в переписке было несколько подряд коротких, "
    "неясных или не по теме сообщений — одной фразой отметь это, не перечисляя их по отдельности."
)

SYSTEM_PROMPT_BASE = (
    "Ты — ассистент свадебного ресторана «Сарбон», отвечаешь клиентам в Telegram.\n"
    "ФОРМАТ ОТВЕТА: ты пишешь РОВНО ОДНУ реплику ассистента в ответ на последнее сообщение клиента. "
    "ЗАПРЕЩЕНО придумывать, писать или продолжать реплики клиента, изображать диалог целиком, "
    "добавлять команды вроде /start от имени клиента, или отвечать на вопрос, которого клиент не "
    "задавал. Если сообщение клиента короткое, странное или бессмысленное (например «?», одно "
    "слово) — отвечай кратко по существу или вежливо переспроси, что именно интересует клиента; "
    "не выдумывай продолжение переписки.\n"
    "Отвечай клиенту только на русском языке, всегда — независимо от того, на каком языке он "
    "написал.\n"
    "Обращайся на «вы», без приветствий вроде «привет» — начинай с «Добрый день», если уместно.\n"
    "ЖЁСТКОЕ ПРАВИЛО: ты не хранишь цены, даты, условия, партнёров и любые факты о ресторане в "
    "памяти — только вызовы функций дают тебе факты. Если функция не вернула данные (пусто/None) — "
    "прямо скажи, что уточнишь у администратора и вернёшься с ответом. ЗАПРЕЩЕНО домысливать цену, "
    "дату доступности, условия пакета, а также ЗАПРЕЩЕНО придумывать описания ресторана (интерьер, "
    "кухня, атмосфера и т.п.), которых нет в ответах функций — не сочиняй маркетинговые формулировки "
    "от себя. Если клиент спрашивает про пакеты в целом (без названия) — вызови list_packages, а не "
    "переспрашивай название.\n"
    "ВАЖНО: если вопрос выходит за рамки company_profile, или это жалоба/торг по цене — ты ОБЯЗАН "
    "вызвать escalate_to_human с кратким описанием вопроса в reason, прежде чем ответить клиенту. "
    "Нельзя просто сказать «уточню и вернусь», не вызвав escalate_to_human — иначе администратор "
    "никогда не узнает, что нужно связаться с клиентом.\n"
    "ЕСЛИ КЛИЕНТ ЗАДАЛ ФАКТИЧЕСКИЙ ВОПРОС (не жалоба, не торг), а функции (get_faq, list_packages и "
    "т.д.) не вернули по нему данных — вызови flag_knowledge_gap с текстом вопроса клиента, чтобы "
    "администратор мог добавить ответ на будущее, и скажи клиенту, что уточнишь и вернёшься с "
    "ответом. Используй escalate_to_human для жалоб/торга/эскалаций к человеку, а flag_knowledge_gap "
    "— для обычных вопросов, на которые у бота просто нет данных.\n"
    "ЕСЛИ ДАТА, КОТОРУЮ СПРОСИЛ КЛИЕНТ, ОКАЗАЛАСЬ СВОБОДНА (check_date_availability вернул "
    "доступность), или клиент явно говорит, что хочет забронировать — в этом же ответе попроси "
    "у него имя и номер телефона, чтобы администратор мог связаться и оформить бронь. Как только "
    "клиент их укажет — вызови capture_lead с этими данными и любыми другими деталями, которые он "
    "упомянул (дата, кол-во гостей, бюджет). Не спрашивай контакты повторно в каждом сообщении, "
    "если клиент уже дал их или проигнорировал вопрос — просто продолжай отвечать по существу.\n"
    "ДАТЫ: сегодняшняя дата указана ниже отдельной строкой — используй именно её как точку отсчёта. "
    "Если клиент называет относительную дату («завтра», «через неделю», «в эти выходные») — сначала "
    "вычисли конкретную дату ГГГГ-ММ-ДД от сегодняшней даты и только потом вызывай "
    "check_date_availability с этой датой. Никогда не угадывай год или дату наугад."
)


def _system_message(
    active_notice: str | None = None, company_info: dict[str, str] | None = None
) -> dict[str, str]:
    content = f"{SYSTEM_PROMPT_BASE}\nСегодняшняя дата: {date.today().isoformat()}."
    if company_info:
        lines = []
        if company_info.get("name"):
            lines.append(f"Название: {company_info['name']}")
        if company_info.get("address"):
            lines.append(f"Адрес: {company_info['address']}")
        if company_info.get("phone"):
            lines.append(f"Телефон: {company_info['phone']}")
        if company_info.get("socials"):
            lines.append(f"Соцсети/сайт: {company_info['socials']}")
        content += (
            "\n\nО ЗАВЕДЕНИИ (используй при вопросах об адресе/контактах, не выдумывай "
            "сверх этого):\n" + "\n".join(lines)
        )
    if active_notice:
        content += (
            "\n\nАКТУАЛЬНОЕ ОБЪЯВЛЕНИЕ ОТ ВЛАДЕЛЬЦА (упоминай при уместных вопросах клиента, "
            f"не выдумывай детали сверх этого текста): {active_notice}"
        )
    return {"role": "system", "content": content}

TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "get_package_price",
            "description": "Найти пакет и его цену по названию (например «Стандарт», «Премиум»).",
            "parameters": {
                "type": "object",
                "properties": {"package_name": {"type": "string"}},
                "required": ["package_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_packages",
            "description": "Получить список всех пакетов, если клиент не назвал конкретный пакет.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_date_availability",
            "description": "Проверить, свободна ли дата (формат YYYY-MM-DD) для мероприятия.",
            "parameters": {
                "type": "object",
                "properties": {"date": {"type": "string"}},
                "required": ["date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_faq",
            "description": "Найти ответ на частый вопрос по теме (например «алкоголь», «парковка»).",
            "parameters": {
                "type": "object",
                "properties": {"topic": {"type": "string"}},
                "required": ["topic"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_partners",
            "description": "Найти партнёров по категории (например «Кортеж», «Флористы»).",
            "parameters": {
                "type": "object",
                "properties": {"category": {"type": "string"}},
                "required": ["category"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "escalate_to_human",
            "description": "Передать разговор администратору, когда вопрос вне компетенции бота.",
            "parameters": {
                "type": "object",
                "properties": {"reason": {"type": "string"}},
                "required": ["reason"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "flag_knowledge_gap",
            "description": "Зафиксировать вопрос клиента, на который нет данных в базе знаний, чтобы администратор мог позже добавить ответ.",
            "parameters": {
                "type": "object",
                "properties": {"question": {"type": "string"}},
                "required": ["question"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "capture_lead",
            "description": "Сохранить или дополнить данные клиента, проявившего намерение забронировать (имя, телефон, дата, кол-во гостей, бюджет).",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "phone": {"type": "string"},
                    "preferred_date": {"type": "string", "description": "YYYY-MM-DD"},
                    "guest_count": {"type": "integer"},
                    "budget": {"type": "string"},
                },
                "required": [],
            },
        },
    },
]


@lru_cache
def get_openai_client() -> AsyncOpenAI:
    settings = get_settings()
    return AsyncOpenAI(api_key=settings.openai_api_key)


async def _call_tool(
    name: str,
    arguments: dict[str, Any],
    tenant_id: str,
    conversation_id: str,
    test_mode: bool = False,
) -> Any:
    if name == "get_package_price":
        return await handlers.get_package_price(tenant_id, arguments["package_name"])
    if name == "list_packages":
        return await handlers.list_packages(tenant_id)
    if name == "check_date_availability":
        return await handlers.check_date_availability(tenant_id, arguments["date"])
    if name == "get_faq":
        return await handlers.get_faq(tenant_id, arguments["topic"])
    if name == "get_partners":
        return await handlers.get_partners(tenant_id, arguments["category"])
    if name == "escalate_to_human":
        if test_mode:
            # No DB row, no admin notification — the Test Console (see
            # backend/app/routers/internal.py) surfaces this as "would
            # escalate" in its own UI instead of a real handoff.
            return {"would_escalate": True, "reason": arguments["reason"]}
        result = await handlers.escalate_to_human(conversation_id, arguments["reason"])
        await notify_admin(
            f"🔔 Эскалация по диалогу {conversation_id}:\n{arguments['reason']}"
        )
        return result
    if name == "flag_knowledge_gap":
        if test_mode:
            # No DB row — the Test Console surfaces this as "would flag" in
            # its own UI, same treatment as escalate_to_human's test_mode path.
            return {"would_flag": True, "question": arguments["question"]}
        return await handlers.flag_knowledge_gap(tenant_id, conversation_id, arguments["question"])
    if name == "capture_lead":
        # Filtered to the tool's own schema keys so a stray "tenant_id" or
        # "conversation_id" in the model's output can't collide with the
        # fixed positional arguments below (TypeError: multiple values).
        lead_fields = {
            k: v for k, v in arguments.items() if k in {"name", "phone", "preferred_date", "guest_count", "budget"}
        }
        if test_mode:
            # No DB row — Test Console surfaces this as "would capture" in
            # its own UI, same treatment as the other two tools' test_mode.
            return {"would_capture_lead": True, **lead_fields}
        return await handlers.capture_lead(tenant_id, conversation_id, **lead_fields)
    raise ValueError(f"Unknown tool: {name}")


async def _summarize(client: AsyncOpenAI, older_messages: list[dict[str, str]]) -> str:
    transcript = "\n".join(f"{m['role']}: {m['content']}" for m in older_messages)
    response = await client.chat.completions.create(
        model=SUMMARY_MODEL,
        messages=[
            {"role": "system", "content": SUMMARY_PROMPT},
            {"role": "user", "content": transcript},
        ],
    )
    return response.choices[0].message.content or ""


async def _build_messages(
    client: AsyncOpenAI,
    history: list[dict[str, str]],
    active_notice: str | None,
    company_info: dict[str, str] | None,
) -> list[dict[str, Any]]:
    """Compacts long conversations so the model isn't handed a long run of raw,
    possibly-repetitive short turns — which was observed to make gpt-4o anchor on
    repeating its own last reply for later, unrelated questions. Older turns get
    folded into a short summary (via the cheap model) instead of growing forever."""
    if len(history) <= RECENT_WINDOW:
        return [_system_message(active_notice, company_info), *history]

    older, recent = history[:-RECENT_WINDOW], history[-RECENT_WINDOW:]
    summary = await _summarize(client, older)
    return [
        _system_message(active_notice, company_info),
        {"role": "system", "content": f"Краткое содержание начала переписки с этим клиентом: {summary}"},
        *recent,
    ]


async def generate_reply(
    tenant_id: str,
    conversation_id: str,
    history: list[dict[str, str]],
    test_mode: bool = False,
) -> GeneratedReply:
    client = get_openai_client()
    active_notice = await handlers.get_active_notice(tenant_id)
    company_info = await handlers.get_company_info(tenant_id)
    messages: list[dict[str, Any]] = await _build_messages(client, history, active_notice, company_info)
    tool_calls_made: list[ToolCallRecord] = []

    for _ in range(MAX_TOOL_ROUNDS):
        response = await client.chat.completions.create(model=MODEL, messages=messages, tools=TOOLS)
        choice = response.choices[0].message
        if not choice.tool_calls:
            return GeneratedReply(choice.content or "", tool_calls_made)

        messages.append(
            {"role": "assistant", "content": choice.content, "tool_calls": choice.tool_calls}
        )
        for tool_call in choice.tool_calls:
            arguments = json.loads(tool_call.function.arguments)
            result = await _call_tool(
                tool_call.function.name, arguments, tenant_id, conversation_id, test_mode
            )
            tool_calls_made.append(ToolCallRecord(tool_call.function.name, arguments, result))
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(result, ensure_ascii=False),
                }
            )

    return GeneratedReply("Уточню детали у администратора и вернусь с ответом.", tool_calls_made)
