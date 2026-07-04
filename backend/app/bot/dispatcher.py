import logging

from aiogram import Bot, Dispatcher, F, Router
from aiogram.filters import Command
from aiogram.types import Message

from app.ai.engine import generate_reply
from app.config import get_settings
from app.conversations import get_or_create_conversation, get_recent_messages, save_message
from app.notifications import notify_admin
from app.tenant import get_tenant_id

logger = logging.getLogger(__name__)

router = Router()

_DB_ROLE_TO_OPENAI_ROLE = {"client": "user", "bot": "assistant", "human": "assistant"}
_FALLBACK_REPLY = "Извините, у нас технический сбой. Администратор уже уведомлён и скоро вернётся с ответом."


@router.message(Command("whoami"))
async def whoami_handler(message: Message) -> None:
    await message.answer(f"Ваш chat_id: {message.chat.id}")


@router.message(F.text)
async def handle_message(message: Message) -> None:
    settings = get_settings()
    tenant_id = get_tenant_id(settings.telegram_bot_token)
    client_id = str(message.chat.id)

    conversation_id = get_or_create_conversation(tenant_id, client_id)
    save_message(conversation_id, "client", message.text)

    history = [
        {"role": _DB_ROLE_TO_OPENAI_ROLE[row["role"]], "content": row["content"]}
        for row in get_recent_messages(conversation_id)
    ]

    try:
        reply = await generate_reply(tenant_id, conversation_id, history)
    except Exception:
        logger.exception("generate_reply failed for conversation %s", conversation_id)
        reply = _FALLBACK_REPLY
        await notify_admin(f"⚠️ Ошибка обработки диалога {conversation_id} — смотри логи сервера.")

    save_message(conversation_id, "bot", reply)
    await message.answer(reply)


def create_bot() -> Bot:
    settings = get_settings()
    return Bot(token=settings.telegram_bot_token)


def create_dispatcher() -> Dispatcher:
    dp = Dispatcher()
    dp.include_router(router)
    return dp


bot = create_bot()
dp = create_dispatcher()
