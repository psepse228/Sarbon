# Wedding Restaurant Chatbot — Контекст для Claude Code
> Проект Solura | Июль 2026 | Клиент: свадебный ресторан (партнёрский проект с владельцем)

---

## Цель проекта

AI-бот, отвечающий клиентам в директе (Instagram + Telegram) свадебного ресторана: цены, пакеты, доступность дат, партнёры (кортеж, флористы и т.д.). Плюс dashboard для владельцев (Telegram Mini App) и периодическая отчётность.

**Стратегическая цель:** это pilot для будущего SaaS-продукта Solura — подписочный бот для нескольких свадебных ресторанов. Архитектура проектируется мультитенантной с первого дня.

---

## Архитектура

| Слой | Технология | Почему |
|---|---|---|
| Диалоговый движок | Railway + Python (FastAPI) | Стейтфул-логика диалогов, async обработка, не n8n |
| БД | Supabase (Postgres) | tenant_id в каждой таблице — мультитенантность с нуля |
| AI (ответы клиенту) | GPT-4o | Цена ошибки высокая, экономия на mini не оправдана |
| AI (вспомогательное) | GPT-4o-mini | Суммаризация client_profiles, классификация intent — дёшево и достаточно |
| Защита от галлюцинаций | Function calling | Модель НЕ хранит цены/факты в промпте — вызывает функции к Supabase |
| Календарь | Google Calendar API | Синхронизация в `availability_cache`, не прямые вызовы на каждый запрос |
| Отчётность | n8n (rizobot.app.n8n.cloud) | Только периодическая агрегация + отправка, не диалоговая логика |
| Dashboard | Telegram Mini App (Vercel) | Авторизация через initData, данные напрямую из Supabase |
| Каналы | Telegram (сразу) + Instagram (после App Review) | Telegram не требует review — стартуем там первым |

---

## Instagram — критичный блокер (не забыть)

- Аккаунт должен быть Business/Creator, привязан к Facebook Page
- Нужен Meta App Review на `instagram_business_manage_messages` — 1-4 недели за попытку, часто отклоняют с первого раза (нужен чёткий скринкаст + обоснование каждого permission)
- 24-часовое окно: бот отвечает свободно, пока клиент сам писал последним в пределах 24ч. Бот НЕ может первым писать после суток тишины без `human_agent` тега или opt-in (Marketing Messages API)
- Для продукта на несколько ресторанов в будущем понадобится Meta Tech Provider status (не просто Business Partner)

**Действие:** подать заявку на App Review как только будет доступ к Facebook Page, параллельно со сборкой остального.

---

## Схема Supabase (черновик)

```sql
-- Мультитенантность с первого дня
create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  telegram_bot_token text,
  instagram_account_id text,
  created_at timestamptz default now()
);

create table company_profile (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  packages jsonb,        -- пакеты и цены
  faq jsonb,             -- частые вопросы и ответы
  partners jsonb,        -- кортеж, флористы, фотографы
  policies text,         -- отмена, предоплата и т.д.
  updated_at timestamptz default now()
);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  channel text check (channel in ('telegram', 'instagram')),
  client_id text not null,   -- IG-scoped ID или Telegram chat_id
  status text default 'active', -- active / escalated / closed
  last_message_at timestamptz,
  created_at timestamptz default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id),
  role text check (role in ('client', 'bot', 'human')),
  content text not null,
  created_at timestamptz default now()
);

create table client_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  client_id text not null,
  summary text,           -- краткая суммаризация прошлых обращений (GPT-4o-mini)
  tags text[],
  last_interaction timestamptz
);

create table availability_cache (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  date date not null,
  is_available boolean,
  event_details text,
  synced_at timestamptz default now()
);

create table escalations (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id),
  reason text,             -- price_negotiation / complaint / out_of_scope / unknown
  notified_owner boolean default false,
  created_at timestamptz default now()
);
```

---

## Function calling — обязательные функции движка

Модель не отвечает "из головы" по фактам — только через вызовы:

- `get_package_price(tenant_id, package_name)` → company_profile.packages
- `check_date_availability(tenant_id, date)` → availability_cache
- `get_faq(tenant_id, topic)` → company_profile.faq
- `get_partners(tenant_id, category)` → company_profile.partners
- `escalate_to_human(conversation_id, reason)` → создаёт запись в escalations + уведомление владельцу

**Жёсткое правило в system prompt:** если функция не вернула данные — бот обязан сказать "уточню и вернусь", запрещено домысливать цену, дату или условия.

---

## Тестирование (порядок обязателен)

1. Staging Telegram-бот (не live-аккаунт ресторана) — тестируем внутри команды
2. Прогон реальных вопросов от друга (15-20 шт) — проверка на точность и корректную эскалацию
3. Стресс-тест на границы: намеренные вопросы вне company_profile → должен эскалировать, не выдумывать
4. Подключение к боевому Telegram — первая неделя в режиме ручной модерации/тихого мониторинга
5. Instagram — по той же схеме на staging-аккаунте, пока идёт App Review для боевого

---

## Фазы разработки

**Фаза 0 (сейчас, не ждём данных от друга):**
- Supabase схема (таблицы выше)
- Скелет Python-сервиса на Railway (FastAPI, вебхук-роуты, заглушки function calling)
- Базовый Telegram-бот (echo-режим для проверки инфраструктуры)
- Каркас Mini App (UI + Telegram initData авторизация, без реальных данных)

**Фаза 1 (как только доступ к Facebook Page):**
- Подача заявки Meta App Review (`instagram_business_manage_messages`)

**Фаза 2 (как только данные от друга — прайс, партнёры, вопросы):**
- Наполнение company_profile
- Подключение function calling к реальным данным
- Тестирование по плану выше (шаги 1-3)

**Фаза 3 (параллельно):**
- Google Calendar API интеграция → availability_cache
- Требует: доступ (Service Account) к аккаунту с календарём, уточнить формат событий

**Фаза 4 (после обкатки Telegram + одобрения Instagram):**
- Подключение Instagram Messaging API к тому же движку (второй вебхук-приёмник)
- Финальное тестирование обоих каналов
- Запуск

---

## Открытые вопросы (ждём от друга)

- [ ] Тип IG-аккаунта (Business/Creator) + привязка к Facebook Page + доступ администратора
- [ ] 15-20 реальных вопросов клиентов из директа
- [ ] Прайс, пакеты, что входит/не входит
- [ ] Список партнёров (кортеж, флористы, фотографы)
- [ ] Доступ к Google Calendar (Service Account) + формат событий (просто "занято" или с деталями)
- [ ] Какие метрики важны владельцу на dashboard

---

## Дизайн-система (стандарт Solura)

Фон `#080C12`, белый `#F1F5F9`, sky blue `#38BDF8`, indigo `#818CF8`, gray `#94A3B8`. Шрифты: Syne + DM Sans. Клиентский тон — "вы", без "привет"-приветствий, открывать "Добрый день" (для любых client-facing сообщений/шаблонов).
