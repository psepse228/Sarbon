from unittest.mock import AsyncMock

from app.bot.dispatcher import echo_handler


async def test_echo_handler_replies_with_same_text():
    message = AsyncMock()
    message.text = "hello"

    await echo_handler(message)

    message.answer.assert_awaited_once_with("hello")
