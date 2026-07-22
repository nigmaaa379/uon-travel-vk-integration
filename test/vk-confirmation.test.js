import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { buildServer } from '../src/app.js';

test('VK confirmation works without secret', async () => {
  const server = buildServer({
    config: { vk: { groupId: '228564119', secret: 'configured-secret', confirmationCode: 'e9e9e72f' }, telegram: null, max: null, tourvisor: null },
    store: {}, vk: {}, uon: {}, notifier: {}, botCore: {}, platforms: {}, logger: { warn() {}, error() {} },
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/vk/callback`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'confirmation', group_id: 228564119 }) });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'e9e9e72f');
  } finally { server.close(); await once(server, 'close'); }
});
