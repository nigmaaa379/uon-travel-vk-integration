// Проверка токена сообщества VK. Запуск из корня проекта:
//   node --env-file=.env test/test-vk-token.mjs
const token = process.env.VK_GROUP_TOKEN?.trim();
if (!token) {
    console.error('ERROR: VK_GROUP_TOKEN отсутствует в .env');
    process.exit(1);
}
const v = process.env.VK_API_VERSION || '5.199';
const url = 'https://api.vk.com/method/groups.getById?access_token=' + encodeURIComponent(token) + '&v=' + v;

try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    if (data.error) {
        console.error('\nОШИБКА VK API:', JSON.stringify(data.error));
        process.exit(1);
    }
    const group = data.response?.groups?.[0] || data.response?.[0] || data.response;
    console.log('\nТОКЕН РАБОЧИЙ.');
    if (group?.id) console.log('VK_GROUP_ID =', group.id);
    if (group?.name) console.log('Сообщество:', group.name);
    if (group?.screen_name) console.log('screen_name:', group.screen_name);
    console.log('\nСырой ответ:', JSON.stringify(data));
} catch (e) {
    console.error('\nСБОЙ запроса:', e.message);
    process.exit(1);
}