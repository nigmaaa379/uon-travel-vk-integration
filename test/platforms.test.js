import test from 'node:test';
import assert from 'node:assert/strict';
import { TelegramClient, MaxClient } from '../src/platforms.js';

test('Telegram callback contains acknowledgement id', () => {
  const client = new TelegramClient({ token: 'test' });
  const parsed = client.parse({ callback_query: { id: 'cb-1', from: { id: 10 }, data: 'qualify' } });
  assert.equal(parsed.ackId, 'cb-1');
  assert.equal(parsed.input.callback, 'qualify');
});

test('MAX bot_started without user is ignored', () => {
  const client = new MaxClient({ token: 'test', apiUrl: 'https://platform-api2.max.ru' });
  assert.equal(client.parse({ update_type: 'bot_started', timestamp: 1 }), null);
});

test('MAX callback uses stable callback id', () => {
  const client = new MaxClient({ token: 'test', apiUrl: 'https://platform-api2.max.ru' });
  const parsed = client.parse({ update_type: 'message_callback', timestamp: 1, callback: { callback_id: 'max-cb-1', payload: 'subscribe', user: { user_id: 20 } } });
  assert.equal(parsed.eventId, 'max:cb:max-cb-1');
  assert.equal(parsed.userId, '20');
});
