# Перенос на tursbezhimnamore.ru

Конфигурация рассчитана на сервер `155.212.171.128`, приложение Docker на `127.0.0.1:3000` и Nginx на портах 80/443.

## 1. Подготовить сервер до изменения DNS

```bash
ssh root@155.212.171.128
cd /opt/uon-travel-vk-integration
git pull --ff-only origin main
```

Проверьте `/opt/uon-travel-vk-integration/.env`:

```dotenv
PUBLIC_SITE_ENABLED=true
TRUST_PROXY=true
ALLOWED_HOSTS=tursbezhimnamore.ru,www.tursbezhimnamore.ru,test.tursbezhimnamore.ru,127.0.0.1,localhost
AGENCY_TOUR_SEARCH_URL=https://tursbezhimnamore.ru/tours
```

Затем:

```bash
sudo bash deploy/prepare-production-domain.sh
```

Команда пересоберёт контейнер, проверит `/health`, установит HTTP-конфигурацию Nginx и выполнит `nginx -t`. Старый сайт при этом не переключается: DNS ещё не менялся.

## 2. Переключить DNS в согласованное время

Перед переключением сохраните резервную копию старого сайта.

- A-запись корня (`@` или пустой поддомен): `155.212.171.128`, TTL 300.
- A-запись `www`: `155.212.171.128`, TTL 300.
- Запись `test` можно временно оставить.
- Не изменяйте MX/TXT-записи почты и записи сторонних сервисов.

## 3. Выпустить HTTPS после обновления DNS

Когда оба домена возвращают `155.212.171.128`:

```bash
cd /opt/uon-travel-vk-integration
sudo CERTBOT_EMAIL=ВАШ_EMAIL bash deploy/activate-production-domain.sh
```

Скрипт остановится без изменений, если DNS ещё указывает на старый сервер. После успешной проверки он выпустит сертификат Let's Encrypt, включит перенаправление HTTP → HTTPS и проверит оба адреса.

## 4. Проверка после переключения

```bash
curl -I https://tursbezhimnamore.ru/
curl -I https://www.tursbezhimnamore.ru/
curl -I https://tursbezhimnamore.ru/admin
curl -sS http://127.0.0.1:3000/health
sudo nginx -t
sudo ss -lntp
```

Проверьте вручную главную страницу, Tourvisor, обе формы заявки, админ-панель, favicon и юридические страницы. После успешной приёмки обновите webhook URL Telegram/MAX/VK, если они всё ещё используют тестовый домен.

## Откат

Если после переключения возникнет критическая ошибка, верните A-записи `@` и `www` на прежний IP. При TTL 300 обратное переключение обычно начинает распространяться в течение нескольких минут.
