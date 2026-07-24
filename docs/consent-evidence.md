# Журнал доказательств согласия

Согласия из форм сайта сохраняются в постоянном Docker-томе `app-data` внутри файла `/app/data/store.json` с правами `0600`.

Для каждой принятой заявки фиксируются:

- уникальный `evidenceId`;
- точное время `receivedAt` в UTC;
- версии согласия и политики;
- тип формы и путь страницы;
- отдельные значения `personalConsent` и `marketingConsent`;
- HMAC-SHA256 хеши IP-адреса и User-Agent;
- идентификатор обращения U-ON;
- дата и основание отзыва, если согласие отозвано.

Исходные IP-адрес и User-Agent в журнал не записываются. Для HMAC задайте отдельный случайный `CONSENT_EVIDENCE_SECRET` длиной не менее 32 символов и не меняйте его без документированной ротации.

## Просмотр записи

```bash
curl -H "x-admin-password: $ADMIN_PASSWORD" \
  "http://127.0.0.1:3000/api/admin/consents?uonLeadId=SITE-99"
```

## Фиксация отзыва

```bash
curl -X POST http://127.0.0.1:3000/api/admin/consents/revoke \
  -H 'content-type: application/json' \
  -H "x-admin-password: $ADMIN_PASSWORD" \
  -d '{"uonLeadId":"SITE-99","reason":"Отзыв получен по email"}'
```

Доступ к административным маршрутам должен быть ограничен сетью сервера. Резервные копии Docker-тома должны храниться на территории РФ с теми же ограничениями доступа.
