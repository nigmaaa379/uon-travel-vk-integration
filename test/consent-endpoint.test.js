import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { buildServer } from '../src/app.js';

test('site lead stores minimized consent evidence linked to U-ON', async () => {
  const records = [];
  const server = buildServer({
    config: { publicSiteEnabled: true, adminPassword: 'admin-secret', consentEvidenceSecret: 'evidence-secret-with-enough-entropy', vk: { groupId: '1', secret: 'vk-secret', confirmationCode: 'c' } },
    store: { async saveConsentEvidence(record) { records.push(record); return record; } },
    vk: {}, botCore: {}, platforms: {},
    uon: { async createQualifiedLead() { return { id: 'SITE-99' }; } },
    notifier: { async notify() { return { ok: true }; } },
    logger: { warn() {}, error() {} }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/site/leads`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.12', 'user-agent': 'Consent-Test-UA', referer: 'https://tursbezhimnamore.ru/countries/turkey.html' },
      body: JSON.stringify({ name: 'Ирина', phone: '+7 999 123-45-67', personalConsent: true, marketingConsent: false, formType: 'modal' })
    });
    assert.equal(response.status, 201);
    assert.equal(records.length, 1);
    const record = records[0];
    assert.equal(record.uonLeadId, 'SITE-99');
    assert.equal(record.personalConsent, true);
    assert.equal(record.marketingConsent, false);
    assert.equal(record.consentVersion, '2026-07-24');
    assert.equal(record.privacyPolicyVersion, '2026-07-24');
    assert.equal(record.formType, 'modal');
    assert.equal(record.formPage, '/countries/turkey.html');
    assert.equal(record.ipHash.length, 64);
    assert.equal(record.userAgentHash.length, 64);
    assert.notEqual(record.ipHash, '203.0.113.12');
    assert.notEqual(record.userAgentHash, 'Consent-Test-UA');
  } finally { server.close(); await once(server, 'close'); }
});
