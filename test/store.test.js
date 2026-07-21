import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonStore } from '../src/store.js';

test('event claim prevents concurrent duplicate processing', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'travel-bot-'));
  try {
    const store = new JsonStore(join(dir, 'store.json'));
    await store.init();
    assert.equal(await store.claimEvent('event-1'), true);
    assert.equal(await store.claimEvent('event-1'), false);
    await store.markProcessed('event-1');
    assert.equal(store.isProcessed('event-1'), true);
    assert.equal(await store.claimEvent('event-1'), false);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('failed event can be released and retried', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'travel-bot-'));
  try {
    const store = new JsonStore(join(dir, 'store.json'));
    await store.init();
    assert.equal(await store.claimEvent('event-2'), true);
    await store.releaseEvent('event-2');
    assert.equal(await store.claimEvent('event-2'), true);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
