import test from'node:test';import assert from'node:assert/strict';import{readFile,mkdtemp}from'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';
import{JsonStore}from'../src/store.js';import{BotCore}from'../src/bot-core-v4.js';import{BotFunnelReminder,funnelRows,stepLabel}from'../src/bot-funnel.js';
const botsHtml=await readFile(new URL('../web/admin/bots.html',import.meta.url),'utf8');const botAdminJs=await readFile(new URL('../src/bot-admin.js',import.meta.url),'utf8');
async function freshStore(){const dir=await mkdtemp(join(tmpdir(),'funnel-'));const store=new JsonStore(join(dir,'store.json'));await store.init?.();return store}
function makeCore(store){let id=700;const uon={createQualifiedLead:async t=>({id:++id,...t}),createLead:async t=>({id:++id,...t})};return new BotCore({store,uon,notifier:{notify:async()=>({ok:true})},logger:{error(){},warn(){},info(){}},config:{}})}
const DROPPED=[{text:'/start'},{callback:'qualify'},{callback:'consent:pd'},{callback:'consent:travel'},{callback:'v4:city:Москва'},{callback:'a:Турция'}];
const FINISHED=[...DROPPED,{callback:'a:Август'},{callback:'a:2 взрослых'},{text:'Олег +7 900 555-44-33'}];
const silent={error(){},warn(){},info(){}};

test('bot records every step a person takes', async()=>{const store=await freshStore();const core=makeCore(store);
for(const step of DROPPED) await core.handle('telegram',111,step);
const user=store.listBotUsers().find(u=>u.key==='telegram:111');
assert.equal(user.trail.length,DROPPED.length,'Записаны не все действия');
assert.deepEqual(user.trail.map(e=>e.action),['/start','qualify','consent:pd','consent:travel','v4:city:Москва','a:Турция']);
assert.ok(user.trail.every(e=>e.at&&e.step!==undefined),'У события нет времени или шага')});

test('the step in the funnel is the one the person is waiting on', async()=>{const store=await freshStore();const core=makeCore(store);
for(const step of DROPPED) await core.handle('telegram',111,step);
const [row]=funnelRows(store.listBotUsers());
assert.equal(row.step,'dates','После выбора направления человек стоит на шаге дат');
assert.equal(row.stepLabel,'Даты поездки');
assert.equal(row.abandoned,true,'Незавершённый сценарий должен быть виден как брошенный')});

test('personal data never lands in the step log', async()=>{const store=await freshStore();const core=makeCore(store);
for(const step of FINISHED) await core.handle('telegram',222,step);
const actions=store.listBotUsers().flatMap(u=>(u.trail||[]).map(e=>e.action));
assert.ok(actions.includes('свободный ответ'),'Свободный текст должен записываться пометкой');
assert.ok(!actions.some(a=>/\d{6,}/.test(a)),'В журнале не должно быть цифр телефона');
assert.ok(!actions.some(a=>a.includes('Олег')),'В журнале не должно быть имени')});

test('finishing the scenario closes the funnel', async()=>{const store=await freshStore();const core=makeCore(store);
for(const step of FINISHED) await core.handle('telegram',222,step);
const [row]=funnelRows(store.listBotUsers());
assert.ok(row.completedAt,'Завершение не зафиксировано');
assert.equal(row.abandoned,false,'Дошедший до конца не должен считаться брошенным');
assert.ok(row.leadId,'Не сохранён номер обращения')});

test('just opening the menu is not treated as an abandoned scenario', async()=>{const store=await freshStore();const core=makeCore(store);
await core.handle('max',333,{text:'/start'});
const [row]=funnelRows(store.listBotUsers());
assert.equal(row.abandoned,false,'Человек ничего не выбирал — напоминать не о чем')});

test('reminder waits, fires once and respects quiet hours', async()=>{const store=await freshStore();const core=makeCore(store);
for(const step of DROPPED) await core.handle('telegram',111,step);
const sent=[];const clients={telegram:{send:async(userId,message)=>sent.push({userId,text:message.text})}};
const reminder=new BotFunnelReminder({store,clients,delayMinutes:120,maxAgeHours:72,quietFrom:24,quietTo:0,logger:silent});
assert.equal(await reminder.tick(new Date()),0,'Сразу после ухода напоминать рано');
const later=new Date(Date.now()+3*3600e3);
assert.equal(await reminder.tick(later),1,'Через три часа простоя напоминание должно уйти');
assert.match(sent[0].text,/Даты поездки/,'В напоминании должен быть шаг, на котором человек остановился');
assert.match(sent[0].text,/\/stop/,'Должен быть способ отказаться от напоминаний');
assert.equal(await reminder.tick(new Date(Date.now()+5*3600e3)),0,'Напоминание должно быть однократным');
const night=new BotFunnelReminder({store,clients,delayMinutes:1,quietFrom:0,quietTo:24,logger:silent});
assert.equal(await night.tick(later),0,'В тихие часы бот не должен писать')});

test('a stale scenario is left alone', async()=>{const store=await freshStore();const core=makeCore(store);
for(const step of DROPPED) await core.handle('telegram',111,step);
const clients={telegram:{send:async()=>{throw new Error('писать не должны')}}};
const reminder=new BotFunnelReminder({store,clients,delayMinutes:120,maxAgeHours:72,quietFrom:24,quietTo:0,logger:silent});
assert.equal(await reminder.tick(new Date(Date.now()+10*24*3600e3)),0,'Через десять дней тревожить человека не нужно')});

test('stop switches reminders off', async()=>{const store=await freshStore();const core=makeCore(store);
for(const step of DROPPED) await core.handle('telegram',111,step);
await core.handle('telegram',111,{text:'/stop'});
const clients={telegram:{send:async()=>{throw new Error('писать не должны')}}};
const reminder=new BotFunnelReminder({store,clients,delayMinutes:1,quietFrom:24,quietTo:0,logger:silent});
assert.equal(await reminder.tick(new Date(Date.now()+3*3600e3)),0,'После /stop напоминания не отправляются')});

test('admin panel shows the funnel', ()=>{assert.ok(botsHtml.includes('data-tab="funnel"'),'Нет вкладки «Воронка»');assert.ok(botsHtml.includes('id="funnel-tab"'));assert.ok(botsHtml.includes('/api/bot-admin/funnel'),'Панель не запрашивает воронку');assert.ok(botsHtml.includes('data-trail='),'Нельзя посмотреть цепочку действий');assert.ok(botAdminJs.includes("url.pathname==='/api/bot-admin/funnel'"),'Нет маршрута воронки');assert.ok(botAdminJs.includes("need('clients')"),'Воронка должна требовать прав на клиентов')});

test('step labels are human readable', ()=>{assert.equal(stepLabel('_contacts'),'Имя и телефон');assert.equal(stepLabel('destination'),'Направление');assert.equal(stepLabel('menu'),'Главное меню')});
