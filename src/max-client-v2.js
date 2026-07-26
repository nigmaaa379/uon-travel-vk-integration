import { MaxClient } from './platforms.js';

const DEFAULT_WEBHOOK_URL = 'https://tursbezhimnamore.ru/max/webhook';
const START_EVENTS = new Set(['bot_started', 'bot_added']);

function unwrap(update) {
  if (Array.isArray(update?.updates)) return update.updates[0] || null;
  return update;
}

export class MaxClientV2 extends MaxClient {
  async configure() {
    const webhookUrl = process.env.MAX_WEBHOOK_URL?.trim() || DEFAULT_WEBHOOK_URL;
    const response = await fetch(`${this.config.apiUrl}/subscriptions`, {
      method: 'POST',
      headers: {
        Authorization: this.config.token,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
        update_types: ['message_created', 'message_callback', 'bot_started', 'bot_added'],
        secret: this.config.webhookSecret,
      }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    if (!response.ok || data.success === false) {
      throw new Error(`MAX subscription HTTP ${response.status}: ${JSON.stringify(data)}`);
    }
    console.info('MAX webhook subscription configured', { webhookUrl });
    return data;
  }

  parse(update) {
    const event = unwrap(update);
    if (START_EVENTS.has(event?.update_type)) {
      const id = event.user?.user_id ?? event.user_id;
      const target = id ?? (event.chat_id ? `chat:${event.chat_id}` : null);
      return target ? {
        eventId: `max:start:${event.update_type}:${event.timestamp || Date.now()}:${target}`,
        userId: String(target),
        input: { text: '/start' },
      } : null;
    }
    return super.parse(event);
  }

  async send(target, output) {
    if (!String(target).startsWith('chat:')) return super.send(target, output);
    const chatId = String(target).slice(5);
    const buttons = (output.buttons || []).map((row) => row.map((button) => button.url
      ? { type: 'link', text: button.text, url: button.url }
      : { type: 'callback', text: button.text, payload: button.callback }));
    const response = await fetch(`${this.config.apiUrl}/messages?chat_id=${encodeURIComponent(chatId)}`, {
      method: 'POST',
      headers: { Authorization: this.config.token, 'content-type': 'application/json' },
      body: JSON.stringify({ text: output.text, attachments: buttons.length ? [{ type: 'inline_keyboard', payload: { buttons } }] : undefined }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(`MAX send HTTP ${response.status}: ${JSON.stringify(data)}`);
    return data;
  }
}
