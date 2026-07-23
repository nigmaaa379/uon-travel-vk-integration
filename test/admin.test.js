import test from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../src/app.js';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function mockDeps(overrides = {}) {
  return {
    config: {
      publicSiteEnabled: true,
      adminPassword: 'secret_password_123',
      strictMode: true,
      vk: { groupId: '123', confirmationCode: 'code', secret: 'sec', token: 'tok' },
      uon: { apiKey: 'key', source: 'vk', commentField: 'note', managerId: 3, timeoutMs: 10000, retries: 3 }
    },
    store: { claimEvent: async () => true, markProcessed: async () => {}, releaseEvent: async () => {} },
    vk: { sendMessage: async () => {} },
    uon: {},
    notifier: { notify: async () => ({ ok: true }) },
    botCore: {},
    ...overrides
  };
}

test('serves admin page at /admin', async () => {
  const server = buildServer(mockDeps());
  await new Promise((res) => server.listen(0, '127.0.0.1', res));
  const { port } = server.address();

  const response = await fetch(`http://127.0.0.1:${port}/admin`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
  const text = await response.text();
  assert.match(text, /Панель управления/);

  server.close();
});

test('rejects GET /api/admin/sales-accents without password', async () => {
  const server = buildServer(mockDeps());
  await new Promise((res) => server.listen(0, '127.0.0.1', res));
  const { port } = server.address();

  const response = await fetch(`http://127.0.0.1:${port}/api/admin/sales-accents`);
  assert.equal(response.status, 401);
  const data = await response.json();
  assert.equal(data.error, 'Неверный пароль администратора.');

  server.close();
});

test('allows GET and POST /api/admin/sales-accents with correct password', async () => {
  const server = buildServer(mockDeps());
  await new Promise((res) => server.listen(0, '127.0.0.1', res));
  const { port } = server.address();

  const getRes = await fetch(`http://127.0.0.1:${port}/api/admin/sales-accents`, {
    headers: { 'x-admin-password': 'secret_password_123' }
  });
  assert.equal(getRes.status, 200);
  const getData = await getRes.json();
  assert.equal(getData.ok, true);
  assert.ok(Array.isArray(getData.accents));

  const postRes = await fetch(`http://127.0.0.1:${port}/api/admin/sales-accents`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-password': 'secret_password_123'
    },
    body: JSON.stringify({
      accents: [
        { label: 'Тур дня', title: 'Мальдивы', text: 'Премиальные виллы на океане.', button: 'Забронировать' }
      ]
    })
  });

  assert.equal(postRes.status, 200);
  const postData = await postRes.json();
  assert.equal(postData.ok, true);

  const defaultAccents = [
    { label: 'Тур дня', title: 'Семейная Турция', text: 'Отели с продуманной детской инфраструктурой и комфортным перелётом.', button: 'Узнать варианты' },
    { label: 'На этой неделе выбирают', title: 'ОАЭ и Таиланд', text: 'Тёплое море, семейные номера и насыщенный досуг для любого возраста.', button: 'Получить подборку' },
    { label: 'Персональный подбор', title: 'Отдых под ваш ритм', text: 'Сравним предложения и объясним, за что действительно стоит платить.', button: 'Обсудить поездку' }
  ];
  await writeFile(join(process.cwd(), 'web/data/sales-accents.json'), JSON.stringify(defaultAccents, null, 2) + '\n', 'utf8');

  server.close();
});
