import json
from functools import lru_cache
from typing import Any

from openai import AsyncOpenAI

from app.config import get_settings
from app.functions import handlers
from app.notifications import notify_admin

MODEL = "gpt-4o"
MAX_TOOL_ROUNDS = 4

SYSTEM_PROMPT = (
    "Ты — ассистент свадебного ресторана «Сарбон», отвечаешь клиентам в Telegram.\n"
    "Обращайся на «вы», без приветствий вроде «привет» — начинай с «Добрый день», если уместно.\n"
    "ЖЁСТКОЕ ПРАВИЛО: ты не хранишь цены, даты, условия, партнёров и любые факты о ресторане в "
    "памяти — только вызовы функций дают тебе факты. Если функция не вернула данные (пусто/None) — "
    "прямо скажи, что уточнишь у администратора и вернёшься с ответом. ЗАПРЕЩЕНО домысливать цену, "
    "дату доступности, условия пакета, а также ЗАПРЕЩЕНО придумывать описания ресторана (интерьер, "
    "кухня, атмосфера и т.п.), которых нет в ответах функций — не сочиняй маркетинговые формулировки "
    "от себя. Если клиент спрашивает про пакеты в целом (без названия) — вызови list_packages, а не "
    "переспрашивай название.\n"
    "ВАЖНО: если вопрос выходит за рамки company_profile, ни одна функция не вернула данные по теме, "
    "или это жалоба/торг по цене — ты ОБЯЗАН вызвать escalate_to_human с кратким описанием вопроса в "
    "reason, прежде чем ответить клиенту. Нельзя просто сказать «уточню и вернусь», не вызвав "
    "escalate_to_human — иначе администратор никогда не узнает, что нужно связаться с клиентом."
)

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
]


@lru_cache
def get_openai_client() -> AsyncOpenAI:
    settings = get_settings()
    return AsyncOpenAI(api_key=settings.openai_api_key)


async def _call_tool(name: str, arguments: dict[str, Any], tenant_id: str, conversation_id: str) -> Any:
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
        result = await handlers.escalate_to_human(conversation_id, arguments["reason"])
        await notify_admin(
            f"🔔 Эскалация по диалогу {conversation_id}:\n{arguments['reason']}"
        )
        return result
    raise ValueError(f"Unknown tool: {name}")


async def generate_reply(tenant_id: str, conversation_id: str, history: list[dict[str, str]]) -> str:
    client = get_openai_client()
    messages: list[dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT}, *history]

    for _ in range(MAX_TOOL_ROUNDS):
        response = await client.chat.completions.create(model=MODEL, messages=messages, tools=TOOLS)
        choice = response.choices[0].message
        if not choice.tool_calls:
            return choice.content or ""

        messages.append(
            {"role": "assistant", "content": choice.content, "tool_calls": choice.tool_calls}
        )
        for tool_call in choice.tool_calls:
            arguments = json.loads(tool_call.function.arguments)
            result = await _call_tool(tool_call.function.name, arguments, tenant_id, conversation_id)
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(result, ensure_ascii=False),
                }
            )

    return "Уточню детали у администратора и вернусь с ответом."
