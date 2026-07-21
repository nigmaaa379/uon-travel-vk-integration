import { setTimeout as sleep } from 'node:timers/promises';

async function fetchJson(url, options = {}, timeoutMs = 10000) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
  return data;
}

export class UonClient {
  constructor(config) { this.config = config; }

  async createLead(tourist) {
    const summary = [
      `Направление: ${tourist.destination}`,
      `Даты: ${tourist.dates}`,
      `Туристы: ${tourist.travelers}`,
      `Бюджет: ${tourist.budget}`,
      `VK ID: ${tourist.vkUserId}`,
    ].join('\n');
    const body = new URLSearchParams({
      source: this.config.source,
      u_name: tourist.name,
      u_phone: tourist.phone,
      u_email: tourist.email,
      [this.config.commentField]: summary,
    });
    const url = 'https://api.u-on.ru/' + encodeURIComponent(this.config.apiKey) + '/lead/create.json';
    let lastError;
    for (let attempt = 0; attempt <= this.config.retries; attempt += 1) {
      try {
        const data = await fetchJson(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body }, this.config.timeoutMs);
        const leadId = data.id ?? data.lead_id ?? data.result?.id ?? data.result;
        if (!leadId) throw new Error(`U-ON response has no lead id: ${JSON.stringify(data)}`);
        return { id: String(leadId), raw: data };
      } catch (error) {
        lastError = error;
        if (attempt < this.config.retries) await sleep(300 * 2 ** attempt);
      }
    }
    throw lastError;
  }
}

export class VkClient {
  constructor(config) { this.config = config; }
  async sendMessage(peerId, message) {
    const body = new URLSearchParams({ access_token: this.config.token, v: this.config.apiVersion, peer_id: String(peerId), random_id: String(Math.floor(Math.random() * 2_147_483_647)), message });
    const data = await fetchJson('https://api.vk.com/method/messages.send', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
    if (data.error) throw new Error(`VK API: ${JSON.stringify(data.error)}`);
    return data.response;
  }
}

export class Notifier {
  constructor(email, telegram) { this.email = email; this.telegram = telegram; }

  format(leadId, tourist) {
    return [
      `Новое обращение №${leadId} из ВКонтакте`,
      `Имя: ${tourist.name}`,
      `Телефон: ${tourist.phone}`,
      `Email: ${tourist.email}`,
      `Направление: ${tourist.destination}`,
      `Даты: ${tourist.dates}`,
      `Туристы: ${tourist.travelers}`,
      `Бюджет: ${tourist.budget}`,
      `VK ID: ${tourist.vkUserId}`,
    ].join('\n');
  }

  async notify(leadId, tourist) {
    const text = this.format(leadId, tourist);
    const emailPromise = fetchJson('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${this.email.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: this.email.from, to: this.email.to, subject: `Новое обращение U-ON №${leadId}`, text }),
    });
    const telegramUrl = 'https://api.telegram.org/bot' + this.telegram.botToken + '/sendMessage';
    const telegramPromise = fetchJson(telegramUrl, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: this.telegram.chatId, text, disable_web_page_preview: true }),
    });
    const results = await Promise.allSettled([emailPromise, telegramPromise]);
    return { email: results[0].status, telegram: results[1].status };
  }
}
