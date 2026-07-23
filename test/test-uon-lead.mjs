// Безопасный одиночный тест-лид в U-ON.
// Запуск из корня проекта:
//   node --env-file=.env test/test-uon-lead.mjs
import { UonClient } from '../src/clients.js';

const apiKey = process.env.UON_API_KEY?.trim();
if (!apiKey) {
    console.error('ERROR: UON_API_KEY отсутствует. Добавь его в .env (не коммить .env).');
    process.exit(1);
}

const uon = new UonClient({
    apiKey,
    source: process.env.UON_SOURCE || 'ВКонтакте',
    commentField: process.env.UON_COMMENT_FIELD || 'note',
  managerId: Number(process.env.UON_MANAGER_ID || 0) || null,
    timeoutMs: Number(process.env.UON_TIMEOUT_MS || 10000),
    retries: Number(process.env.UON_RETRIES || 2),
});

const stamp = new Date().toISOString();
console.log('Создаю ТЕСТ-лид в U-ON, source =', uon.config.source);

try {
    const result = await uon.createLead({
        name: 'ТЕСТ ИНТЕГРАЦИЯ — НЕ ОБРАБАТЫВАТЬ',
        phone: '+7 999 000-00-00',
        email: 'integration-test@sbezhim-na-more.test',
        destination: 'ТЕСТ (проверка интеграции ВКонтакте → U-ON)',
        dates: 'ТЕСТ',
        travelers: 'ТЕСТ',
        budget: 'ТЕСТ',
        vkUserId: `integration-test ${stamp}`,
    });
    console.log('\nУСПЕХ. Лид создан.');
    console.log('Lead id:', result.id);
    console.log('Ответ API:', JSON.stringify(result.raw));
    console.log('\nПроверь в U-ON: лид есть, source = ' + uon.config.source + ', статус = Новый, контакты и комментарий заполнены.');
} catch (e) {
    console.error('\nОШИБКА создания лида:', e.message);
    process.exit(1);
}