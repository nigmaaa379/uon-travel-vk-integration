import { MaxClient } from './platforms.js';

const DEFAULT_WEBHOOK_URL = 'https://tursbezhimnamore.ru/max/webhook';
const START_EVENTS = new Set(['bot_started', 'bot_added']);
const DEFAULT_ACK_NOTIFICATION = 'Принято, обрабатываю…';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function unwrap(update) {
  if (Array.isArray(update?.updates)) return update.updates[0] || null;
  return update;
}

async function requestJson(url, options, attempts = 2) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(5000) });
      const text = await response.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
      if (response.ok && data.success !== false && data.ok !== false) return data;
      const error = new Error(`MAX API ${response.status}: ${JSON.stringify(data)}`);
      if (response.status < 500 && response.status !== 429) throw error;
      lastError = error;
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) await delay(250 * attempt);
  }
  throw lastError;
}

function messageBody(output) {
  const buttons = (output.buttons || []).map((row) => row.map((button) => button.url
    ? { type: 'link', text: button.text, url: button.url }
    : { type: 'callback', text: button.text, payload: button.callback }));
  return { text: output.text, attachments: buttons.length ? [{ type: 'inline_keyboard', payload: { buttons } }] : undefined };
}

// MAX требует в теле ответа на callback ровно одно из полей: message или notification.
// Пустой объект приводит к ошибке 400 proto.payload.
function ackBody(options = {}) {
  if (options.output) return { message: messageBody(options.output) };
  const notification = typeof options.notification === 'string' && options.notification.trim()
    ? options.notification.trim()
    : DEFAULT_ACK_NOTIFICATION;
  return { notification };
}

export class MaxClientV2 extends MaxClient {
  async configure() {
    const webhookUrl = process.env.MAX_WEBHOOK_URL?.trim() || DEFAULT_WEBHOOK_URL;
    const data = await requestJson(`${this.config.apiUrl}/subscriptions`, {
      method: 'POST',
      headers: { Authorization: this.config.token, 'content-type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        update_types: ['message_created', 'message_callback', 'bot_started', 'bot_added'],
        secret: this.config.webhookSecret,
      }),
    });
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
    if (event?.update_type === 'message_callback') {
      const callback = event.callback || event.message_callback || {};
      const id = callback.user?.user_id ?? callback.user_id ?? event.user?.user_id;
      const target = id ?? (event.chat_id ? `chat:${event.chat_id}` : null);
      const payload = callback.payload ?? callback.callback_data;
      const callbackId = callback.callback_id ?? event.callback_id;
      return target && payload ? {
        eventId: `max:cb:${callbackId || `${event.timestamp}:${target}:${payload}`}`,
        ackId: callbackId,
        userId: String(target),
        input: { callback: payload },
      } : null;
    }
    if (event?.update_type === 'message_created') {
      const parsed = super.parse(event);
      if (parsed) return parsed;
      // Резервный разбор: текстовые ответы не должны теряться из-за другого расположения идентификатора.
      const message = event.message || {};
      const id = message.sender?.user_id ?? message.from?.user_id ?? message.recipient?.user_id ?? event.user?.user_id ?? event.user_id;
      const chatId = message.recipient?.chat_id ?? message.chat_id ?? event.chat_id;
      const target = id ?? (chatId ? `chat:${chatId}` : null);
      const text = message.body?.text ?? message.text ?? '';
      if (target) {
        return {
          eventId: `max:msg:${message.body?.mid || message.mid || event.timestamp || Date.now()}:${target}`,
          userId: String(target),
          input: { text },
        };
      }
      console.warn('MAX message could not be parsed', { eventKeys: Object.keys(event), messageKeys: Object.keys(message) });
      return null;
    }
    return super.parse(event);
  }

  ack(callbackId, options = {}) {
    if (!callbackId) return;
    void requestJson(`${this.config.apiUrl}/answers?callback_id=${encodeURIComponent(callbackId)}`, {
      method: 'POST',
      headers: { Authorization: this.config.token, 'content-type': 'application/json' },
      body: JSON.stringify(ackBody(options)),
    }, 1).catch((error) => console.warn('MAX callback acknowledgement failed', { error: error.message }));
  }

  async send(target, output) {
    const value = String(target);
    const query = value.startsWith('chat:')
      ? `chat_id=${encodeURIComponent(value.slice(5))}`
      : `user_id=${encodeURIComponent(value)}`;
    return requestJson(`${this.config.apiUrl}/messages?${query}`, {
      method: 'POST',
      headers: { Authorization: this.config.token, 'content-type': 'application/json' },
      body: JSON.stringify(messageBody(output)),
    });
  }
}
