import test from 'node:test';
import assert from 'node:assert/strict';
import { nextStep, normalizePhone } from '../src/qualification.js';

test('normalizes Russian phone numbers', () => {
  assert.equal(normalizePhone('8 (999) 123-45-67'), '+79991234567');
  assert.equal(normalizePhone('9991234567'), '+79991234567');
  assert.equal(normalizePhone('123'), null);
});

test('runs the complete qualification flow', () => {
  let session = nextStep(null, 'старт').session;
  for (const input of ['Турция', '10–17 августа', '2 взрослых', '200000', 'Иван', '+79991234567']) {
    const result = nextStep(session, input);
    session = result.session;
    assert.equal(Boolean(result.complete), false);
  }
  const result = nextStep(session, 'ivan@example.com');
  assert.equal(result.complete, true);
  assert.equal(result.session.state, 'submitting');
  assert.equal(result.session.answers.destination, 'Турция');
  assert.equal(result.session.answers.phone, '+79991234567');
});

test('rejects invalid email without losing state', () => {
  const session = { state: 'email', answers: { phone: '+79991234567' } };
  const result = nextStep(session, 'bad-email');
  assert.equal(result.session.state, 'email');
  assert.match(result.reply, /email/i);
});
