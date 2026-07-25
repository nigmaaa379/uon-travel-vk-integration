async function fetchJson(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
  const data = await response.json();
  if (!response.ok || data.ok === false) throw new Error(`Platform API ${response.status}: ${JSON.stringify(data)}`);
  return data;
}

export class TelegramClient {
  constructor(config) { this.config = config; }
  async configure() {
    const base = `https://api.telegram.org/bot${this.config.token}`;
    await fetchJson(`${base}/setMyCommands`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ commands: [
        { command: 'start', description: 'Главное меню' },
        { command: 'help', description: 'Помощь и документы' },
      ] }),
    });
    await fetchJson(`${base}/setChatMenuButton`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ menu_button: { type: 'commands' } }),
    });
  }
  async send(userId, output) {
    const inline_keyboard = (output.buttons || []).map((row) => row.map((button) => button.url ? { text: button.text, url: button.url } : { text: button.text, callback_data: button.callback }));
    return fetchJson(`https://api.telegram.org/bot${this.config.token}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: userId, text: output.text, disable_web_page_preview: true, reply_markup: inline_keyboard.length ? { inline_keyboard } : undefined }) });
  }
  async ack(callbackId) {
    if (!callbackId) return;
    await fetchJson(`https://api.telegram.org/bot${this.config.token}/answerCallbackQuery`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ callback_query_id: callbackId }) });
  }
  parse(update) {
    if (update.callback_query) return { eventId: `tg:cb:${update.callback_query.id}`, ackId: update.callback_query.id, userId: String(update.callback_query.from.id), input: { callback: update.callback_query.data } };
    const message = update.message;
    return message?.from?.id ? { eventId: `tg:msg:${message.message_id}:${message.chat.id}`, userId: String(message.from.id), input: { text: message.text || '' } } : null;
  }
}

export class MaxClient {
  constructor(config) { this.config = config; }
  async send(userId, output) {
    const buttons = (output.buttons || []).map((row) => row.map((button) => button.url ? { type: 'link', text: button.text, url: button.url } : { type: 'callback', text: button.text, payload: button.callback }));
    const body = { text: output.text, attachments: buttons.length ? [{ type: 'inline_keyboard', payload: { buttons } }] : undefined };
    return fetchJson(`${this.config.apiUrl}/messages?user_id=${encodeURIComponent(userId)}`, { method: 'POST', headers: { Authorization: this.config.token, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  }
  parse(update) {
    if (update.update_type === 'message_callback') {
      const callback = update.callback || update.message_callback || {};
      const id = callback.user?.user_id ?? callback.user_id ?? update.user?.user_id;
      const payload = callback.payload ?? callback.callback_data;
      const callbackId = callback.callback_id ?? `${update.timestamp}:${id}:${payload}`;
      return id && payload ? { eventId: `max:cb:${callbackId}`, userId: String(id), input: { callback: payload } } : null;
    }
    if (update.update_type === 'bot_started') {
      const id = update.user?.user_id;
      return id ? { eventId: `max:start:${update.timestamp}:${id}`, userId: String(id), input: { text: '/start' } } : null;
    }
    if (update.update_type !== 'message_created') return null;
    const message = update.message || {};
    const id = message.sender?.user_id ?? message.user?.user_id ?? update.user?.user_id;
    return id ? { eventId: `max:msg:${message.body?.mid || message.mid || update.timestamp}:${id}`, userId: String(id), input: { text: message.body?.text || message.text || '' } } : null;
  }
}
