import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonStore } from '../src/store.js';

test('persists consent evidence and records revocation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'consent-evidence-'));
  const file = join(dir, 'store.json');
  try {
    const store = new JsonStore(file);
    await store.init();
    const saved = await store.saveConsentEvidence({ evidenceId: 'E-1', receivedAt: '2026-07-24T12:00:00.000Z', consentVersion: '2026-07-24', privacyPolicyVersion: '2026-07-24', formType: 'main', formPage: '/', personalConsent: true, marketingConsent: false, ipHash: 'ip-hash', userAgentHash: 'ua-hash', uonLeadId: 'SITE-42' });
    assert.equal(saved.evidenceId, 'E-1');
    assert.equal(saved.marketingConsent, false);
    const revoked = await store.revokeConsentEvidence({ uonLeadId: 'SITE-42', reason: 'Отзыв по email', revokedAt: '2026-07-25T10:00:00.000Z' });
    assert.equal(revoked.revokedAt, '2026-07-25T10:00:00.000Z');
    const reloaded = new JsonStore(file);
    await reloaded.init();
    const [record] = reloaded.listConsentEvidence({ uonLeadId: 'SITE-42' });
    assert.equal(record.personalConsent, true);
    assert.equal(record.revocationReason, 'Отзыв по email');
    const raw = await readFile(file, 'utf8');
    assert.doesNotMatch(raw, /127\.0\.0\.1|Mozilla/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
