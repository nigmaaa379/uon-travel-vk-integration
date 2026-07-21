const required = (name) => { const value = process.env[name]?.trim(); if (!value) throw new Error(`Missing required environment variable: ${name}`); return value; };
const integer = (name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => { const value = Number(process.env[name] ?? fallback); if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid integer environment variable: ${name}`); return value; };
const httpsUrl = (name, fallback) => { const value = process.env[name]?.trim() || fallback; let url; try { url = new URL(value); } catch { throw new Error(`Invalid URL environment variable: ${name}`); } if (url.protocol !== 'https:') throw new Error(`${name} must use HTTPS`); return url.toString().replace(/\/$/, ''); };
const oneOf = (name, fallback, values) => { const value = (process.env[name] || fallback).toUpperCase(); if (!values.includes(value)) throw new Error(`${name} must be one of: ${values.join(', ')}`); return value; };
const scheduleHours = () => { const hours = [...new Set((process.env.HOT_TOURS_HOURS || '9,14,19').split(',').map((value) => Number(value.trim())))]; if (!hours.length || hours.some((hour) => !Number.isInteger(hour) || hour < 0 || hour > 23)) throw new Error('HOT_TOURS_HOURS must contain hours from 0 to 23'); return hours; };

export function loadConfig() {
  return {
    port: integer('PORT', 3000, { min: 1, max: 65535 }),
    dataFile: process.env.DATA_FILE || './data/store.json',
    vk: { groupId: required('VK_GROUP_ID'), confirmationCode: required('VK_CONFIRMATION_CODE'), secret: required('VK_CALLBACK_SECRET'), token: required('VK_GROUP_TOKEN'), apiVersion: process.env.VK_API_VERSION || '5.199' },
    telegram: { token: required('TELEGRAM_BOT_TOKEN'), webhookSecret: required('TELEGRAM_WEBHOOK_SECRET') },
    max: { token: required('MAX_BOT_TOKEN'), webhookSecret: required('MAX_WEBHOOK_SECRET'), apiUrl: httpsUrl('MAX_API_URL', 'https://platform-api2.max.ru') },
    uon: { apiKey: required('UON_API_KEY'), source: process.env.UON_SOURCE || 'Чат-бот', commentField: process.env.UON_COMMENT_FIELD || 'note', timeoutMs: integer('UON_TIMEOUT_MS', 10000, { min: 1000, max: 120000 }), retries: integer('UON_RETRIES', 3, { min: 0, max: 10 }) },
    email: { apiKey: required('RESEND_API_KEY'), from: required('NOTIFY_EMAIL_FROM'), to: required('NOTIFY_EMAIL_TO').split(',').map((x) => x.trim()).filter(Boolean) },
    notifierTelegram: { botToken: required('NOTIFY_TELEGRAM_BOT_TOKEN'), chatId: required('NOTIFY_TELEGRAM_CHAT_ID') },
    tourvisor: {
      searchEndpoint: httpsUrl('TOURVISOR_SEARCH_ENDPOINT'),
      token: required('TOURVISOR_API_TOKEN'),
      method: oneOf('TOURVISOR_HTTP_METHOD', 'POST', ['GET', 'POST']),
      siteSearchUrl: httpsUrl('AGENCY_TOUR_SEARCH_URL'),
      limit: integer('HOT_TOURS_LIMIT', 3, { min: 1, max: 10 }),
    },
    hotToursHours: scheduleHours(),
  };
}
