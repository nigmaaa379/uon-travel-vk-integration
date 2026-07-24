import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

const EMPTY = { sessions: {}, botSessions: {}, processedEvents: {}, subscriptions: [], offers: {}, consentEvidence: [] };
export class JsonStore {
  #file; #data = structuredClone(EMPTY); #queue = Promise.resolve();
  constructor(file) { this.#file = file; }
  async init() { await mkdir(dirname(this.#file), { recursive: true }); try { this.#data = { ...structuredClone(EMPTY), ...JSON.parse(await readFile(this.#file, 'utf8')) }; if (!Array.isArray(this.#data.consentEvidence)) this.#data.consentEvidence = []; } catch (e) { if (e.code !== 'ENOENT') throw e; await this.#persist(); } }
  getSession(id) { return structuredClone(this.#data.sessions[id] || null); }
  async saveSession(id, value) { this.#data.sessions[id] = structuredClone(value); await this.#persistQueued(); }
  getBotSession(id) { return structuredClone(this.#data.botSessions[id] || null); }
  async saveBotSession(id, value) { this.#data.botSessions[id] = structuredClone(value); await this.#persistQueued(); }
  async clearBotSession(id) { delete this.#data.botSessions[id]; await this.#persistQueued(); }
  isProcessed(id) { return this.#data.processedEvents[id]?.status === 'done' || typeof this.#data.processedEvents[id] === 'number'; }
  async claimEvent(id) {
    const current = this.#data.processedEvents[id];
    const timestamp = typeof current === 'number' ? current : current?.at;
    if (current && (current.status === 'done' || typeof current === 'number')) return false;
    if (current?.status === 'processing' && Date.now() - timestamp < 5 * 60_000) return false;
    this.#data.processedEvents[id] = { status: 'processing', at: Date.now() };
    await this.#persistQueued();
    return true;
  }
  async markProcessed(id) {
    this.#data.processedEvents[id] = { status: 'done', at: Date.now() };
    const cutoff = Date.now() - 7 * 86400000;
    for (const [key, value] of Object.entries(this.#data.processedEvents)) {
      const timestamp = typeof value === 'number' ? value : value?.at;
      if (!timestamp || timestamp < cutoff) delete this.#data.processedEvents[key];
    }
    await this.#persistQueued();
  }
  async releaseEvent(id) {
    if (this.#data.processedEvents[id]?.status === 'processing') {
      delete this.#data.processedEvents[id];
      await this.#persistQueued();
    }
  }
  async addSubscription({ platform, userId, params }) { const existing = this.#data.subscriptions.find((s) => s.platform === platform && s.userId === userId && JSON.stringify(s.params) === JSON.stringify(params)); if (existing) return existing; const item = { id: randomUUID(), platform, userId, params, active: true, sentOfferIds: [], createdAt: Date.now() }; this.#data.subscriptions.push(item); await this.#persistQueued(); return item; }
  listSubscriptions() { return structuredClone(this.#data.subscriptions.filter((s) => s.active)); }
  async markSubscriptionSent(id, offerIds) { const item = this.#data.subscriptions.find((s) => s.id === id); if (item) { item.sentOfferIds = [...new Set([...item.sentOfferIds, ...offerIds])].slice(-100); item.lastRunAt = Date.now(); await this.#persistQueued(); } }
  async saveOffer(offer) { this.#data.offers[offer.id] = { ...structuredClone(offer), savedAt: Date.now() }; await this.#persistQueued(); }
  getOffer(id) { return structuredClone(this.#data.offers[id] || null); }
  async saveConsentEvidence(record) {
    const item = { evidenceId: record.evidenceId || randomUUID(), revokedAt: null, revocationReason: null, ...structuredClone(record) };
    this.#data.consentEvidence.push(item);
    await this.#persistQueued();
    return structuredClone(item);
  }
  listConsentEvidence({ uonLeadId, evidenceId } = {}) {
    return structuredClone(this.#data.consentEvidence.filter((item) => (!uonLeadId || item.uonLeadId === String(uonLeadId)) && (!evidenceId || item.evidenceId === String(evidenceId))));
  }
  async revokeConsentEvidence({ uonLeadId, evidenceId, reason, revokedAt = new Date().toISOString() }) {
    const item = this.#data.consentEvidence.find((entry) => (evidenceId && entry.evidenceId === String(evidenceId)) || (uonLeadId && entry.uonLeadId === String(uonLeadId)));
    if (!item) return null;
    item.revokedAt = revokedAt;
    item.revocationReason = String(reason || 'Отзыв согласия субъектом персональных данных').slice(0, 500);
    await this.#persistQueued();
    return structuredClone(item);
  }
  #persistQueued() { this.#queue = this.#queue.catch(() => {}).then(() => this.#persist()); return this.#queue; }
  async #persist() { const temp = `${this.#file}.tmp`; await writeFile(temp, JSON.stringify(this.#data, null, 2), { mode: 0o600 }); await rename(temp, this.#file); }
}
