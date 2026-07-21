const START_WORDS = new Set(['начать', 'старт', 'start', 'поехали', 'заново']);

export function newSession() {
  return { state: 'destination', answers: {}, leadId: null, updatedAt: Date.now() };
}

export function normalizePhone(value) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) return `+7${digits.slice(1)}`;
  if (digits.length === 10) return `+7${digits}`;
  return null;
}

export function isEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }

export function nextStep(session, input) {
  const text = input.trim();
  if (START_WORDS.has(text.toLowerCase())) return { session: newSession(), reply: 'Куда вы хотите отправиться?' };
  if (!session) return { session: newSession(), reply: 'Начнём подбор тура. Куда вы хотите отправиться?' };
  if (session.state === 'complete') return { session, reply: `Ваше обращение №${session.leadId} уже создано. Напишите «заново», чтобы пройти опрос ещё раз.` };
  const answers = { ...session.answers };
  const update = (state, key, value, reply) => ({ session: { ...session, state, answers: { ...answers, [key]: value }, updatedAt: Date.now() }, reply });
  switch (session.state) {
    case 'destination': return update('dates', 'destination', text, 'Укажите желаемые даты поездки.');
    case 'dates': return update('travelers', 'dates', text, 'Сколько взрослых и детей поедет?');
    case 'travelers': return update('budget', 'travelers', text, 'Какой ориентировочный бюджет поездки?');
    case 'budget': return update('name', 'budget', text, 'Как к вам обращаться?');
    case 'name': return update('phone', 'name', text, 'Укажите номер телефона для связи.');
    case 'phone': {
      const phone = normalizePhone(text);
      if (!phone) return { session, reply: 'Не удалось распознать номер. Введите его в формате +7XXXXXXXXXX.' };
      return update('email', 'phone', phone, 'Укажите ваш email.');
    }
    case 'email': {
      if (!isEmail(text)) return { session, reply: 'Проверьте email и введите его ещё раз.' };
      return { session: { ...session, state: 'submitting', answers: { ...answers, email: text.toLowerCase() }, updatedAt: Date.now() }, reply: null, complete: true };
    }
    case 'submitting': return { session, reply: 'Обращение создаётся. Пожалуйста, подождите.' };
    default: return { session: newSession(), reply: 'Начнём заново. Куда вы хотите отправиться?' };
  }
}
