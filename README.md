# U-ON Travel × VK, Telegram и MAX

Сервис интеграции чат-ботов ВКонтакте, Telegram и MAX с CRM U-ON Travel и Tourvisor. После завершения квалификации туриста создаётся карточка именно в разделе **«Обращения»**, а руководителю отправляются email- и Telegram-уведомления.

## Раздел 1. ВКонтакте и U-ON Travel

- [x] Callback API ВКонтакте с проверкой секретного ключа.
- [x] Квалификация туриста и валидация контактов.
- [x] Создание обращения через `POST /lead/create.json`.
- [x] Защита от повторной обработки событий.
- [x] Email- и Telegram-уведомления руководителя.

## Раздел 2. Telegram, MAX и горящие туры

### 2.1 Квалификация

- [x] Общая бизнес-логика для Telegram и MAX.
- [x] Защищённые webhook endpoints `/telegram/webhook` и `/max/webhook`.
- [x] Опрос: направление, даты, бюджет, состав группы, дети и пожелания.
- [x] Сбор имени, телефона и email.
- [x] Структурированный запрос в U-ON Travel.
- [x] Создание карточки в «Обращениях».
- [x] Уведомление руководителя.

### 2.2 Горящие туры

- [x] Кнопка подписки и сохранение параметров туриста.
- [x] Проверка Tourvisor в 09:00, 14:00 и 19:00 по Москве.
- [x] Сортировка туров по минимальной цене.
- [x] Защита от повторной отправки одинаковых предложений.
- [x] Выдача предложений в Telegram и MAX.
- [x] Переход на сайт агентства с параметрами конкретного тура.
- [x] Бронирование выполняется только на сайте.
- [x] Сбор контактов при намерении забронировать.
- [x] Создание обращения U-ON с параметрами выбранного тура.

Подробный технический чек-лист: [`docs/SECTION-2-TODO.md`](docs/SECTION-2-TODO.md).

## Быстрый запуск

Требуется Node.js 20+ или Docker.

```bash
cp .env.example .env
# заполните .env
npm test
npm start
```

С Docker:

```bash
docker compose up -d --build
curl http://localhost:3000/health
```

## Настройка U-ON Travel

1. Откройте **Настройки → Интеграции → API / Webhooks**.
2. Разрешите POST-запросы.
3. Добавьте ключ в `UON_API_KEY`.
4. При необходимости настройте API-имя комментария через `UON_COMMENT_FIELD`.

Используется метод создания обращения:

```text
POST https://api.u-on.ru/KEY/lead/create.json
```

## Webhook Telegram

Установите webhook на `https://ВАШ-ДОМЕН/telegram/webhook` и передайте `TELEGRAM_WEBHOOK_SECRET` как `secret_token`.

## Webhook MAX

Создайте webhook-подписку на `https://ВАШ-ДОМЕН/max/webhook` для событий:

- `message_created`;
- `message_callback`;
- `bot_started`.

Значение `secret` должно совпадать с `MAX_WEBHOOK_SECRET`. Используется актуальный API-домен `https://platform-api2.max.ru`.

## Tourvisor и «Правило 3 секунд»

Доступ к API поиска и горящих туров Tourvisor является отдельной коммерческой услугой. Заполните:

- `TOURVISOR_SEARCH_ENDPOINT` — endpoint, выданный Tourvisor;
- `TOURVISOR_API_TOKEN` — токен аккаунта;
- `AGENCY_TOUR_SEARCH_URL` — страница поиска на сайте агентства.

Бот добавляет к ссылке параметры `tourId`, `destination`, `dates` и `group`. Страница сайта должна прочитать их и автоматически открыть результаты выбранного тура. Реальное бронирование внутри мессенджера не выполняется.

## Основные переменные окружения

| Переменная | Назначение |
|---|---|
| `VK_GROUP_ID` | ID сообщества VK |
| `VK_CALLBACK_SECRET` | Секрет Callback API VK |
| `VK_GROUP_TOKEN` | Токен сообщества VK |
| `TELEGRAM_BOT_TOKEN` | Токен клиентского Telegram-бота |
| `TELEGRAM_WEBHOOK_SECRET` | Секрет webhook Telegram |
| `MAX_BOT_TOKEN` | Токен бота MAX |
| `MAX_WEBHOOK_SECRET` | Секрет webhook MAX |
| `UON_API_KEY` | Ключ API U-ON Travel |
| `RESEND_API_KEY` | Ключ email-сервиса |
| `NOTIFY_EMAIL_TO` | Email руководителей через запятую |
| `NOTIFY_TELEGRAM_BOT_TOKEN` | Токен бота уведомлений |
| `NOTIFY_TELEGRAM_CHAT_ID` | Чат руководителя |
| `TOURVISOR_SEARCH_ENDPOINT` | Endpoint Tourvisor |
| `TOURVISOR_API_TOKEN` | Токен Tourvisor |
| `AGENCY_TOUR_SEARCH_URL` | Страница поиска туров агентства |
| `HOT_TOURS_HOURS` | Часы проверки по Москве |

## Проверка

```bash
npm test
npm run check
```

Автоматические тесты проверяют квалификацию Telegram, подписку MAX, нормализацию и сортировку предложений Tourvisor, телефон и email.

## Что требуется для реального запуска

- [ ] Получить коммерческий доступ и схему API Tourvisor.
- [ ] Сопоставить поля ответа с тарифом и аккаунтом Tourvisor.
- [ ] Добавить обработку deep-link параметров на сайте с виджетом.
- [ ] Получить токены реальных ботов Telegram и MAX.
- [ ] Заполнить ключи U-ON Travel и получателей уведомлений.
- [ ] Развернуть сервис на публичном HTTPS-домене.
- [ ] Выполнить сквозное приёмочное тестирование.

## Безопасность

- Секреты находятся только в `.env` и не коммитятся.
- Webhook-запросы проверяются секретными заголовками.
- События дедуплицируются.
- Состояние хранится в файле с правами `0600`.
- API-ключи и полные анкеты не выводятся в логи.
