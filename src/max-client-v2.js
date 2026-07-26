import { MaxClient } from './platforms.js';

const DEFAULT_WEBHOOK_URL = 'https://tursbezhimnamore.ru/max/webhook';

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
        update_types: ['message_created', 'message_callback', 'bot_started'],
        secret: this.config.webhookSecret,
      }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    if (!response.ok || data.success === false) {
      throw new Error(`MAX subscription HTTP ${response.status}: ${JSON.stringify(data)}`);
    }
    return data;
  }

  parse(update) {
    if (update?.update_type === 'bot_started') {
      const id = update.user?.user_id ?? update.user_id;
      return id ? {
        eventId: `max:start:${update.timestamp || Date.now()}:${id}`,
        userId: String(id),
        input: { text: '/start' },
      } : null;
    }
    return super.parse(update);
  }
}
