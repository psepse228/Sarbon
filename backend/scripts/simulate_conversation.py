import asyncio
import sys

from app.ai.engine import generate_reply
from app.config import get_settings
from app.conversations import get_or_create_conversation, get_recent_messages, save_message
from app.tenant import get_tenant_id

_DB_ROLE_TO_OPENAI_ROLE = {"client": "user", "bot": "assistant", "human": "assistant"}

TEST_QUESTIONS = [
    "Добрый день! Расскажите, свободна ли дата 15 августа 2026 года?",
    "А 22 августа 2026?",
    "Какие у вас есть пакеты вообще?",
    "Сколько стоит пакет Премиум и что в него входит?",
    "Можно привезти своего диджея или только через вас?",
    "Есть ли у вас блины на десерт и живая музыка каждый вечер?",
    "Хочу устроить корпоратив на 300 человек завтра, скидка 70% возможна?",
    "Куда жаловаться, если официант нахамит на банкете?",
]


async def main() -> None:
    settings = get_settings()
    tenant_id = get_tenant_id(settings.telegram_bot_token)
    client_id = "claude-simulated-test-" + sys.argv[1] if len(sys.argv) > 1 else "claude-simulated-test-1"
    conversation_id = get_or_create_conversation(tenant_id, client_id)

    for question in TEST_QUESTIONS:
        save_message(conversation_id, "client", question)
        history = [
            {"role": _DB_ROLE_TO_OPENAI_ROLE[row["role"]], "content": row["content"]}
            for row in get_recent_messages(conversation_id)
        ]
        reply = await generate_reply(tenant_id, conversation_id, history)
        save_message(conversation_id, "bot", reply)

        print(f"\n{'=' * 70}\nQ: {question}\n{'-' * 70}\nA: {reply}")


if __name__ == "__main__":
    asyncio.run(main())
