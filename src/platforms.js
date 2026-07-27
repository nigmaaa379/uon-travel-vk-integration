// Telegram API недоступен напрямую с российских серверов, поэтому адрес API берётся из
// TELEGRAM_API_BASE (реверс-прокси на зарубежном сервере), а исходящие запросы при необходимости
// идут через HTTP-прокси из TELEGRAM_PROXY_URL.
const DEFAULT_TELEGRAM_API = 'https://api.telegram.org';
const NETWORK_HINT = '\u0421еть недоступна. С российских серверов api.telegram.org заблокирован: укажите TELEGRAM_API_BASE (реверс-прокси) или TELEGRAM_PROXY_URL.';

let proxyDispatcherPromise = null;
let proxyWarningShown = false;

// undici входит в Node, но как отдельный пакет может быть не установлен.
// Если его нет, работаем напрямую и пишем предупреждение вместо падения сервиса.
async function proxyDispatcher(proxyUrl, logger = console) {
  if (!proxyUrl) return undefined;
  if (!proxyDispatcherPromise) {
    proxyDispatcherPromise = import('undici')
      .then(({ ProxyAgent }) => new ProxyAgent(proxyUrl))
      .catch((error) => {
        if (!proxyWarningShown) {
          proxyWarningShown = true;
          logger.warn?.('Telegram proxy is not available', { error: error.message, hint: 'npm i undici или используйте TELEGRAM_API_BASE' });
        }
        return undefined;
      });
  }
  return proxyDispatcherPromise;
}

async function fetchJson(url, options = {}) {
  let response;
  try {
    response = await fetch(url, { ...options, signal: AbortSignal.timeout(options.timeoutMs || 10000) });
  } catch (error) {
    throw new Error(`Platform API request failed: ${error.message}`);
  }
  const data = await response.json();
  if (!response.ok || data.ok === false) throw new Error(`Platform API ${response.status}: ${JSON.stringify(data)}`);
  return data;
}

export class TelegramClient {
  constructor(config, logger = console) {
    this.config = config;
    this.logger = logger;
    this.apiBase = (config.apiBase || DEFAULT_TELEGRAM_API).replace(/\/$/, '');
  }

  get base() {
    return `${this.apiBase}/bot${this.config.token}`;
  }

  async call(method, payload) {
    const dispatcher = await proxyDispatcher(this.config.proxyUrl, this.logger);
    try {
      return await fetchJson(`${this.base}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        ...(dispatcher ? { dispatcher } : {}),
      });
    } catch (error) {
      if (error.message.includes('request failed')) throw new Error(`${error.message}. ${NETWORK_HINT}`);
      throw error;
    }
  }

  async configure() {
    await this.call('setMyCommands', {
      commands: [
        { command: 'start', description: 'Главное меню' },
        { command: 'help', description: 'Помощь и документы' },
      ],
    });
    await this.call('setChatMenuButton', { menu_button: { type: 'commands' } });
  }

  async send(userId, output) {
    const inline_keyboard = (output.buttons || []).map((row) => row.map((button) => button.url ? { text: button.text, url: button.url } : { text: button.text, callback_data: button.callback }));
    return this.call('sendMessage', {
      chat_id: userId,
      text: output.text,
      disable_web_page_preview: true,
      reply_markup: inline_keyboard.length ? { inline_keyboard } : undefined,
    });
  }

  async ack(callbackId) {
    if (!callbackId) return;
    await this.call('answerCallbackQuery', { callback_query_id: callbackId });
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
