import test from'node:test';import assert from'node:assert/strict';import{readFile,mkdtemp}from'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';
import{JsonStore}from'../src/store.js';import{SiteComplianceService}from'../src/site-compliance.js';
const html=await readFile(new URL('../web/index.html',import.meta.url),'utf8');
const completion=await readFile(new URL('../web/assets/completion.js',import.meta.url),'utf8');
const adminHtml=await readFile(new URL('../web/admin/index.html',import.meta.url),'utf8');
const serverJs=await readFile(new URL('../src/app.js',import.meta.url),'utf8');

// Собираем функцию отбивки из боевого файла и подменяем часы, чтобы проверить обе ветки.
function makeReceipt(fakeIso){const start=completion.indexOf('const WORK=');const end=completion.indexOf('const esc=v=>');
const src=completion.slice(start,end).replace(/esc\(/g,'String(');
const receipt=new Function(`${src}; return receipt;`)();
const RealDate=Date;class FakeDate extends RealDate{constructor(...args){super(...(args.length?args:[fakeIso]))}static now(){return new RealDate(fakeIso).getTime()}}
// Часы подменяем на время самого вызова: иначе проверялось бы реальное «сейчас».
return(...args)=>{globalThis.Date=FakeDate;try{return receipt(...args)}finally{globalThis.Date=RealDate}}}

test('both forms require a contact channel and offer a call window',()=>{const main=html.slice(html.indexOf('value="main"'),html.indexOf('</form>',html.indexOf('value="main"')));
const modal=html.slice(html.indexOf('value="modal"'),html.indexOf('</form>',html.indexOf('value="modal"')));
for(const [name,form] of [['Личная подборка',main],['модальная',modal]]){
 assert.match(form,/name="messenger"[^>]*required/,`Форма «${name}»: способ связи должен быть обязательным`);
 assert.ok(form.includes('name="contactTime"'),`Форма «${name}»: нет выбора удобного времени`);
 for(const option of ['WhatsApp','Telegram','Только звонок'])assert.ok(form.includes(`<option>${option}</option>`),`Форма «${name}»: нет варианта ${option}`);
 assert.ok(form.includes('Вечером, 16:00–19:00'),`Форма «${name}»: нет вечернего окна`)}
assert.match(completion,/d\.messenger=/,'Способ связи не уходит на сервер');
assert.match(completion,/d\.contactTime=/,'Удобное время не уходит на сервер')});

test('the receipt never promises a call at night',()=>{const receipt=makeReceipt('2026-08-04T20:30:00Z');// 23:30 МСК
const note=receipt(1043,'WhatsApp');
assert.match(note.text,/№1043/,'В отбивке должен быть номер обращения');
assert.match(note.text,/нерабочее время/i,'Ночью нельзя обещать связь «в течение дня»');
assert.match(note.text,/10:00 до 19:00/,'Нужно назвать рабочее время');
assert.match(note.text,/ночью беспокоить не станем/,'Стоит прямо успокоить человека');
assert.ok(!/выходной/.test(note.text),'Вторник не выходной');
assert.match(note.text,/напишем в WhatsApp/i,'Отбивка должна учитывать выбранный способ связи')});

test('during working hours the receipt promises the same day',()=>{const receipt=makeReceipt('2026-08-04T11:00:00Z');// 14:00 МСК, вторник
const note=receipt(1044,'Только звонок');
assert.match(note.text,/в течение рабочего дня/,'В рабочее время обещаем связь сегодня');
assert.match(note.text,/позвоним/,'Для варианта «только звонок» пишем про звонок');
assert.ok(!/нерабочее время/i.test(note.text),'В рабочее время не должно быть слов о нерабочем времени')});

test('the U-ON note leads with how and when to reach the client',async()=>{const dir=await mkdtemp(join(tmpdir(),'contact-'));const store=new JsonStore(join(dir,'store.json'));await store.init?.();
const leads=[];const contexts=[];
const svc=new SiteComplianceService({siteRoot:new URL('../web',import.meta.url).pathname,store,uon:{createQualifiedLead:async t=>{leads.push(t);return{id:8001}}},notifier:{notify:async(id,ctx)=>{contexts.push(ctx);return{ok:true,email:{ok:true}}}},evidenceSecret:'s'.repeat(32),logger:{error(){},warn(){}}});
const http=await import('node:http');const srv=http.createServer(async(q,r)=>{if(await svc.handle(q,r))return;r.writeHead(404);r.end('{}')});
await new Promise(r=>srv.listen(0,r));const url=`http://127.0.0.1:${srv.address().port}/api/site/leads-v2`;
const base={name:'Наталья',phone:'+79001112233',personalConsent:true,countryInfoAcknowledged:true};
const send=body=>fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const first=await (await send({...base,messenger:'WhatsApp',contactTime:'Вечером, 16:00–19:00'})).json();
await send({...base,messenger:'<script>alert(1)</script>',contactTime:'ночью'});
srv.close();
assert.equal(first.contact,'WhatsApp · Вечером, 16:00–19:00','Ответ сервера должен подтверждать способ связи');
assert.equal(first.workingHours,'Пн–Сб, 10:00–19:00 МСК');
const lines=leads[0].wishes.split('\n');
assert.equal(lines[0],'Связь: WhatsApp','Способ связи должен быть первой строкой примечания');
assert.equal(lines[1],'Удобное время: Вечером, 16:00–19:00','Удобное время должно быть второй строкой');
assert.ok(!leads[1].wishes.includes('script'),'Произвольные значения не должны попадать в карточку');
assert.equal(contexts[0],'WhatsApp · Вечером, 16:00–19:00','Уведомление менеджеру должно нести способ связи');
assert.ok(!contexts[0].includes('Наталья')&&!contexts[0].includes('7900'),'В уведомлении не должно быть персональных данных')});

test('a failed notification is recorded and surfaced in the panel',async()=>{const dir=await mkdtemp(join(tmpdir(),'notify-'));const store=new JsonStore(join(dir,'store.json'));await store.init?.();
await store.saveNotificationResult({leadId:1043,delivery:{ok:false,skipped:true,reason:'No domestic notification channel configured'}});
const saved=store.getNotificationResult();
assert.equal(saved.ok,false);assert.equal(saved.leadId,'1043');assert.deepEqual(saved.channels,[]);
await store.saveNotificationResult({leadId:1044,delivery:{ok:true,email:{ok:true}}});
assert.deepEqual(store.getNotificationResult().channels,['email'],'Канал доставки должен фиксироваться');
assert.ok(serverJs.includes("req.url === '/api/admin/notifications'"),'Нет маршрута диагностики уведомлений');
assert.ok(adminHtml.includes('id="notify-banner"'),'В панели нет баннера о уведомлениях');
assert.ok(adminHtml.includes('NOTIFY_EMAIL_TO'),'Баннер должен подсказывать, что заполнить в .env')});

test('a day off is not called night',()=>{const receipt=makeReceipt('2026-08-09T11:00:00Z');// воскресенье, 14:00 МСК
const note=receipt(1045,'Telegram');
assert.match(note.text,/выходной/,'В воскресенье нужно сказать про выходной, а не про ночь');
assert.match(note.text,/ближайший рабочий день/);
assert.ok(!/ночью/.test(note.text),'Днём в выходной про ночь писать нельзя')});
