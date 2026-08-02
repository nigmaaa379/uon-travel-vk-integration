import test from'node:test';import assert from'node:assert/strict';import{readFile,mkdtemp}from'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';
import{JsonStore}from'../src/store.js';import{BotCore}from'../src/bot-core-v4.js';import{BotAdminServiceV2}from'../src/bot-admin-v2.js';
const adminHtml=await readFile(new URL('../web/admin/index.html',import.meta.url),'utf8');const serverJs=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
async function freshStore(){const dir=await mkdtemp(join(tmpdir(),'uon-test-'));const store=new JsonStore(join(dir,'store.json'));await store.init?.();return store}
function makeCore(store){let id=500;const uon={createQualifiedLead:async t=>({id:++id,...t}),createLead:async t=>({id:++id,...t})};return new BotCore({store,uon,notifier:{notify:async()=>({ok:true})},logger:{error(){},warn(){},info(){}},config:{}})}
const QUALIFY=[{text:'/start'},{callback:'qualify'},{callback:'consent:pd'},{callback:'consent:travel'},{callback:'v4:city:Москва'},{callback:'a:Турция'},{callback:'a:Июль, 10 ночей'},{callback:'a:2 взрослых + 1 ребёнок'},{text:'Мария +7 900 111-22-33'}];
const SUBSCRIBE=[{text:'/start'},{callback:'subscribe'},{callback:'consent:ads'},{callback:'v4:city:Казань'},{callback:'a:Египет'},{callback:'a:Сентябрь'},{callback:'a:2 взрослых'}];

test('admin panel shows the consent journal', ()=>{assert.ok(adminHtml.includes('data-tab="consents"'),'Нет вкладки журнала согласий');assert.ok(adminHtml.includes('id="consents-tab"'));assert.ok(adminHtml.includes("api(`/api/admin/consents"),'Журнал не запрашивает записи');assert.ok(adminHtml.includes('/api/admin/consents/revoke'),'Нет фиксации отзыва согласия');assert.ok(adminHtml.includes('countryInfoAcknowledged'),'В журнале не видно ознакомления с правилами по стране');assert.ok(adminHtml.includes('id="consent-lead"')&&adminHtml.includes('id="consent-evidence"'),'Нет фильтров журнала')});

test('consent endpoints stay behind the admin password', ()=>{const handler=serverJs.slice(serverJs.indexOf("/api/admin/consents"));assert.ok(handler.includes("req.headers['x-admin-password'] !== config.adminPassword"),'Журнал согласий должен требовать пароль администратора')});

test('bot writes users, consents and the country acknowledgement', async()=>{const store=await freshStore();const core=makeCore(store);
for(const step of QUALIFY) await core.handle('telegram',555,step);
const users=store.listBotUsers();assert.equal(users.length,1,'Пользователь бота не попал в список');assert.equal(users[0].platform,'telegram');assert.ok(users[0].firstSeenAt&&users[0].lastSeenAt,'Нет отметок о первом и последнем контакте');
const evidence=store.listConsentEvidence();assert.equal(evidence.length,1,'Согласие из бота не записано в журнал');
assert.equal(evidence[0].personalConsent,true,'Не зафиксировано согласие на обработку ПД');
assert.equal(evidence[0].countryInfoAcknowledged,true,'Не зафиксировано ознакомление с правилами по стране');
assert.ok(evidence[0].uonLeadId,'Запись согласия не связана с обращением U-ON')});

test('qualified bot leads are segmented, not just hot-tour subscribers', async()=>{const store=await freshStore();const core=makeCore(store);
for(const step of QUALIFY) await core.handle('telegram',555,step);
for(const step of SUBSCRIBE) await core.handle('max',777,step);
const dir=await mkdtemp(join(tmpdir(),'uon-admin-'));
const admin=new BotAdminServiceV2({store,dataFile:join(dir,'admin.json'),config:{adminPassword:'x'},logger:{error(){},warn(){}},platforms:{}});
await admin.store?.init?.();
const clients=admin.clients();
assert.equal(clients.length,2,'В списке клиентов должны быть оба пользователя');
const lead=clients.find(c=>c.key==='telegram:555');
assert.equal(lead.country,'Турция','Страна из квалификации не попала в сегментацию');
assert.equal(lead.dates,'Июль, 10 ночей','Даты из квалификации не попали в сегментацию');
assert.equal(lead.group,'2 взрослых + 1 ребёнок','Состав группы не попал в сегментацию');
assert.ok(lead.lastLeadId,'Не сохранён номер последнего обращения');
const subscriber=clients.find(c=>c.key==='max:777');
assert.equal(subscriber.country,'Египет');assert.equal(subscriber.active,true,'Подписчик горящих туров должен быть активен');
assert.equal(admin.filterClients({country:'турция'}).length,1,'Фильтр по стране не находит квалифицированного клиента');
assert.equal(admin.filterClients({platform:'max'}).length,1,'Фильтр по платформе не работает')});

test('a subscription never blanks out data collected during qualification', async()=>{const store=await freshStore();const core=makeCore(store);
for(const step of QUALIFY) await core.handle('telegram',555,step);
await store.addSubscription({platform:'telegram',userId:'555',params:{destination:'',dates:'',group:'',budget:''},consent:{ads:true}});
const dir=await mkdtemp(join(tmpdir(),'uon-admin2-'));
const admin=new BotAdminServiceV2({store,dataFile:join(dir,'admin.json'),config:{adminPassword:'x'},logger:{error(){},warn(){}},platforms:{}});
await admin.store?.init?.();
const client=admin.clients().find(c=>c.key==='telegram:555');
assert.equal(client.country,'Турция','Пустая подписка не должна затирать страну из квалификации');
assert.equal(client.active,true,'Подписка должна помечать клиента активным')});
