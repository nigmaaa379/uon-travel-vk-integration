import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { nextStep } from './qualification.js';
function json(res, status, payload) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(payload)); }
async function readJson(req) { const chunks = []; let size = 0; for await (const chunk of req) { size += chunk.length; if (size > 1_000_000) throw new Error('Payload too large'); chunks.push(chunk); } return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
const siteRoot = join(process.cwd(), 'web');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
async function serveSite(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const requested = pathname === '/' ? '/index.html' : pathname;
  const safePath = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = join(siteRoot, safePath);
  if (!filePath.startsWith(siteRoot)) return false;
  try {
    if (!(await stat(filePath)).isFile()) return false;
    res.writeHead(200, { 'content-type': mime[extname(filePath).toLowerCase()] || 'application/octet-stream', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', 'cache-control': extname(filePath) === '.html' ? 'no-cache' : 'public, max-age=86400' });
    if (req.method === 'HEAD') return res.end(), true;
    createReadStream(filePath).pipe(res); return true;
  } catch { return false; }
}
function validateSiteLead(body) {
  if (body.website) return { spam: true };
  if (!body.personalConsent || !body.marketingConsent) return { error: 'Подтвердите согласие на обработку данных и рассылку.' };
  if (typeof body.name !== 'string' || body.name.trim().length < 2) return { error: 'Укажите имя.' };
  if (typeof body.phone !== 'string' || !/^\+?[0-9\s()\-]{10,20}$/.test(body.phone.trim())) return { error: 'Проверьте номер телефона.' };
  return null;
}
export function buildServer({ config, store, vk, uon, notifier, botCore, platforms, logger = console }) {
  const processBot = async (platform, parsed) => {
    if (!parsed || !(await store.claimEvent(parsed.eventId))) return;
    try {
      try { await platforms[platform].ack?.(parsed.ackId); } catch (error) { logger.warn('Callback acknowledgement failed', { platform, error: error.message }); }
      const output = await botCore.handle(platform, parsed.userId, parsed.input); await platforms[platform].send(parsed.userId, output); await store.markProcessed(parsed.eventId);
    } catch (error) { await store.releaseEvent(parsed.eventId); logger.error('Bot processing failed', { platform, eventId: parsed.eventId, error: error.message }); }
  };
  return createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') return json(res, 200, { ok: true, platforms: ['vk', 'telegram', 'max'] });
    try {
      if (req.method === 'POST' && req.url === '/api/site/leads') {
        const body = await readJson(req); const invalid = validateSiteLead(body);
        if (invalid?.spam) return json(res, 200, { ok: true, leadId: 'accepted' });
        if (invalid) return json(res, 422, invalid);
        const tourist = { name: body.name.trim(), phone: body.phone.trim(), email: body.email?.trim() || undefined, destination: body.destination?.trim() || 'Не указано', dates: 'Уточнить', budget: 'Уточнить', group: body.group?.trim() || 'Уточнить', wishes: body.wishes?.trim() || 'Заявка с сайта', platform: 'website', messengerUserId: 'site-form' };
        const lead = await uon.createQualifiedLead(tourist); await notifier.notify(lead.id, { ...tourist, travelers: tourist.group, vkUserId: 'website' }); return json(res, 201, { ok: true, leadId: lead.id });
      }
      if (req.method === 'POST' && req.url === '/telegram/webhook') { if (req.headers['x-telegram-bot-api-secret-token'] !== config.telegram.webhookSecret) return json(res, 403, { error: 'Forbidden' }); const body = await readJson(req); const parsed = platforms.telegram.parse(body); json(res, 200, { ok: true }); void processBot('telegram', parsed); return; }
      if (req.method === 'POST' && req.url === '/max/webhook') { if (req.headers['x-max-bot-api-secret'] !== config.max.webhookSecret) return json(res, 403, { error: 'Forbidden' }); const body = await readJson(req); const parsed = platforms.max.parse(body); json(res, 200, { ok: true }); void processBot('max', parsed); return; }
      if (req.method === 'POST' && req.url === '/vk/callback') {
        const event = await readJson(req); if (String(event.group_id) !== String(config.vk.groupId) || event.secret !== config.vk.secret) return json(res, 403, { error: 'Forbidden' });
        if (event.type === 'confirmation') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end(config.vk.confirmationCode); }
        if (event.type !== 'message_new') { res.writeHead(200); return res.end('ok'); }
        const eventId = event.event_id || `${event.object?.message?.id}:${event.object?.message?.peer_id}`; res.writeHead(200); res.end('ok'); const message = event.object?.message; if (!message?.from_id || !message?.text) return; if (!(await store.claimEvent(eventId))) return;
        try { const userId = String(message.from_id); const result = nextStep(store.getSession(userId), message.text); await store.saveSession(userId, result.session); if (result.complete) { try { const tourist = { ...result.session.answers, vkUserId: userId }; const lead = await uon.createLead(tourist); await store.saveSession(userId, { ...result.session, state: 'complete', leadId: lead.id }); await vk.sendMessage(message.peer_id, `Спасибо! Обращение №${lead.id} создано.`); await notifier.notify(lead.id, tourist); } catch { await store.saveSession(userId, { ...result.session, state: 'email' }); await vk.sendMessage(message.peer_id, 'Не удалось создать обращение. Отправьте email ещё раз позже.'); } } else if (result.reply) await vk.sendMessage(message.peer_id, result.reply); await store.markProcessed(eventId); } catch (error) { await store.releaseEvent(eventId); logger.error('VK processing failed', { eventId, error: error.message }); } return;
      }
      if (await serveSite(req, res)) return; return json(res, 404, { error: 'Not found' });
    } catch (error) { logger.error('HTTP processing failed', { error: error.message }); if (!res.headersSent) json(res, 400, { error: 'Bad request' }); }
  });
}
