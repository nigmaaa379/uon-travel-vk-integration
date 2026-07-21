import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const EMPTY = { sessions: {}, processedEvents: {} };

export class JsonStore {
  #file;
  #data = structuredClone(EMPTY);
  #queue = Promise.resolve();

  constructor(file) { this.#file = file; }

  async init() {
    await mkdir(dirname(this.#file), { recursive: true });
    try { this.#data = JSON.parse(await readFile(this.#file, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; await this.#persist(); }
  }

  getSession(userId) { return structuredClone(this.#data.sessions[userId] || null); }
  isProcessed(eventId) { return Boolean(this.#data.processedEvents[eventId]); }

  async saveSession(userId, session) {
    this.#data.sessions[userId] = structuredClone(session);
    await this.#persistQueued();
  }

  async markProcessed(eventId) {
    this.#data.processedEvents[eventId] = Date.now();
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const [id, timestamp] of Object.entries(this.#data.processedEvents)) {
      if (timestamp < cutoff) delete this.#data.processedEvents[id];
    }
    await this.#persistQueued();
  }

  #persistQueued() {
    this.#queue = this.#queue.then(() => this.#persist());
    return this.#queue;
  }

  async #persist() {
    const temp = `${this.#file}.tmp`;
    await writeFile(temp, JSON.stringify(this.#data, null, 2), { mode: 0o600 });
    await rename(temp, this.#file);
  }
}
