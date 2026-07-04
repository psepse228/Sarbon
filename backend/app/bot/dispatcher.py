from aiogram import Bot, Dispatcher, F, Router
from aiogram.types import Message

from app.config import get_settings

router = Router()


@router.message(F.text)
async def echo_handler(message: Message) -> None:
    await message.answer(message.text)


def create_bot() -> Bot:
    settings = get_settings()
    return Bot(token=settings.telegram_bot_token)


def create_dispatcher() -> Dispatcher:
    dp = Dispatcher()
    dp.include_router(router)
    return dp


bot = create_bot()
dp = create_dispatcher()
