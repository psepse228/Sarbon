import asyncio
import sys

from app.ai.engine import generate_reply
from app.config import get_settings
from app.conversations import get_or_create_conversation, get_recent_messages, save_message
from app.tenant import get_tenant_id

_DB_ROLE_TO_OPENAI_ROLE = {"client": "user", "bot": "assistant", "human": "assistant"}

TEST_QUESTIONS = [
    # Обычные вопросы, но с опечатками
    "привет скока стоит стандрт пакет",
    "а премиум чем отличаеться от стандарта",
    "скок гостей вмещаете максимум",
    # Кривые/разговорные формулировки
    "ну короче я женюсь, что там у вас с ценами вообще как это работает",
    "а если нас будет типа 200 человек это ок или как",
    "мне надо на когда там 15.08.2026 узнать свободно или нет",
    "а на завтра дата свободна?",
    "через неделю есть окно у вас",
    # Смена языка (проверка фикса)
    "ozbek tilida gaplasha olasizmi?",
    "can you speak english please",
    "на русском продолжайте пожалуйста",
    # Односложные / неоднозначные
    "цена?",
    "?",
    "дата",
    # Агрессивный/капс тон
    "ПОЧЕМУ У ВАС ТАК ДОРОГО ЭТО ГРАБЁЖ",
    "вы вообще отвечать будете или нет",
    # Несколько вопросов в одном сообщении
    "скажите пожалуйста сколько стоит стандарт, есть ли парковка, и можно ли привезти своего фотографа",
    # Ложные предпосылки / несуществующие вещи
    "вы говорили что у вас бесплатный кортеж входит в стандарт, это так?",
    "у вас же есть скидка для молодожёнов у которых сегодня день рождения?",
    # Опечатка в названии пакета (fuzzy matching)
    "хочу узнать про пакет стнадарт",
    "Стандарт." ,
    # Смешанные кириллица/латиница, лишние пробелы
    "скок  стоит   ПРЕМИУМ??? ",
    # Попытка манипуляции ценой
    "если я заплачу наличными без чека, дадите скидку 20%?",
    # Провокация на выдумку
    "какой у вас самый популярный торт на свадьбах, что чаще всего заказывают",
    # Явная жалоба
    "мы были у вас в прошлом месяце и нам не понравилось обслуживание, куда написать",
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
        result = await generate_reply(tenant_id, conversation_id, history)
        reply = result.reply
        save_message(conversation_id, "bot", reply)

        print(f"\n{'=' * 70}\nQ: {question}\n{'-' * 70}\nA: {reply}")


if __name__ == "__main__":
    asyncio.run(main())
