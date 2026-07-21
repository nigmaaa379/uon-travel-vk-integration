import { createServer } from 'node:http';
import { nextStep } from './qualification.js';

function json(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error('Payload too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

export function buildServer({ config, store, vk, uon, notifier, logger = console }) {
  return createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') return json(res, 200, { ok: true });
    if (req.method !== 'POST' || req.url !== '/vk/callback') return json(res, 404, { error: 'Not found' });

    try {
      const event = await readJson(req);
      if (String(event.group_id) !== String(config.vk.groupId) || event.secret !== config.vk.secret) return json(res, 403, { error: 'Forbidden' });
      if (event.type === 'confirmation') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end(config.vk.confirmationCode); }
      if (event.type !== 'message_new') { res.writeHead(200); return res.end('ok'); }

      const eventId = event.event_id || `${event.object?.message?.id}:${event.object?.message?.peer_id}`;
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('ok');
      if (store.isProcessed(eventId)) return;

      const message = event.object?.message;
      if (!message?.from_id || !message?.text) return;
      const userId = String(message.from_id);
      const result = nextStep(store.getSession(userId), message.text);
      await store.saveSession(userId, result.session);

      if (result.complete) {
        try {
          const tourist = { ...result.session.answers, vkUserId: userId };
          const lead = await uon.createLead(tourist);
          const completed = { ...result.session, state: 'complete', leadId: lead.id, completedAt: Date.now() };
          await store.saveSession(userId, completed);
          await vk.sendMessage(message.peer_id, `Спасибо! Обращение №${lead.id} создано. Куратор свяжется с вами.`);
          const delivery = await notifier.notify(lead.id, tourist);
          logger.info('Lead created', { leadId: lead.id, delivery });
        } catch (error) {
          await store.saveSession(userId, { ...result.session, state: 'email', updatedAt: Date.now() });
          await vk.sendMessage(message.peer_id, 'Не удалось создать обращение. Попробуйте отправить email ещё раз через минуту.');
          logger.error('Lead creation failed', { eventId, error: error.message });
        }
      } else if (result.reply) {
        await vk.sendMessage(message.peer_id, result.reply);
      }
      await store.markProcessed(eventId);
    } catch (error) {
      logger.error('Callback processing failed', { error: error.message });
      if (!res.headersSent) json(res, 400, { error: 'Bad request' });
    }
  });
}
