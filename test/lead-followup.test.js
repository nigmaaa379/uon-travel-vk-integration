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
 assert.match(form,/В каком мессенджере вам удобно общаться\?/,`Форма «${name}»: вопрос должен быть задан словами Любови`);
 for(const option of ['ВКонтакте','MAX','Telegram','WhatsApp'])assert.ok(form.includes(`<option>${option}</option>`),`Форма «${name}»: нет мессенджера ${option}`);
 assert.ok(form.includes('Только звонок, без мессенджеров'),`Форма «${name}»: нужен вариант для тех, у кого мессенджеров нет`);
 assert.ok(form.includes('Вечером, 16:00–19:00'),`Форма «${name}»: нет вечернего окна`)}
assert.match(completion,/d\.messenger=/,'Способ связи не уходит на сервер');
assert.match(completion,/d\.contactTime=/,'Удобное время не уходит на сервер')});

test('the receipt keeps the agency wording',()=>{const receipt=makeReceipt('2026-08-04T11:00:00Z');// вторник, 14:00 МСК
const note=receipt(1043,'WhatsApp');
assert.equal(note.title,'Отлично!');
assert.equal(note.lines[0],'Заявка принята и уже обрабатывается.');
assert.equal(note.lines[1],'Менеджер свяжется с вами совсем скоро, чтобы мы могли начать работу.');
assert.equal(note.lines[2],'⏰ Напоминаем: мы работаем с понедельника по субботу — с 10 до 19 часов. Всегда рады помочь!');
assert.equal(note.number,'Обращение №1043','Номер обращения должен остаться на виду')});

test('the receipt never promises a call at night',()=>{const receipt=makeReceipt('2026-08-04T20:30:00Z');// 23:30 МСК
const note=receipt(1043,'WhatsApp');
assert.match(note.text,/нерабочее время/i,'Ночью нельзя обещать связь «совсем скоро»');
assert.ok(!/совсем скоро/.test(note.text),'Обещание «совсем скоро» ночью недопустимо');
assert.match(note.text,/в начале рабочего дня/);
assert.match(note.text,/с понедельника по субботу — с 10 до 19 часов/,'Строка о графике остаётся всегда');
assert.ok(!/выходной/.test(note.text),'Вторник не выходной');
assert.match(note.text,/напишет/,'Для мессенджера пишем «напишет»')});

test('call-only clients are told about a call, not a message',()=>{const receipt=makeReceipt('2026-08-04T20:30:00Z');
const note=receipt(1044,'Только звонок, без мессенджеров');
assert.match(note.text,/позвонит/,'Тому, кто выбрал только звонок, нельзя обещать сообщение');
assert.ok(!/напишет/.test(note.text))});

test('the U-ON note leads with how and when to reach the client',async()=>{const dir=await mkdtemp(join(tmpdir(),'contact-'));const store=new JsonStore(join(dir,'store.json'));await store.init?.();
const leads=[];const contexts=[];
const svc=new SiteComplianceService({siteRoot:new URL('../web',import.meta.url).pathname,store,uon:{createQualifiedLead:async t=>{leads.push(t);return{id:8001}}},notifier:{notify:async(id,ctx)=>{contexts.push(ctx);return{ok:true,email:{ok:true}}}},evidenceSecret:'s'.repeat(32),logger:{error(){},warn(){}}});
const http=await import('node:http');const srv=http.createServer(async(q,r)=>{if(await svc.handle(q,r))return;r.writeHead(404);r.end('{}')});
await new Promise(r=>srv.listen(0,r));const url=`http://127.0.0.1:${srv.address().port}/api/site/leads-v2`;
const base={name:'Наталья',phone:'+79001112233',personalConsent:true,countryInfoAcknowledged:true};
const send=body=>fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const first=await (await send({...base,messenger:'ВКонтакте',contactTime:'Вечером, 16:00–19:00'})).json();
await send({...base,messenger:'<script>alert(1)</script>',contactTime:'ночью'});
srv.close();
assert.equal(first.contact,'ВКонтакте · Вечером, 16:00–19:00','Ответ сервера должен подтверждать способ связи');
assert.equal(first.workingHours,'Пн–Сб, 10:00–19:00 МСК');
const lines=leads[0].wishes.split('\n');
assert.equal(lines[0],'Связь: ВКонтакте','Способ связи должен быть первой строкой примечания');
assert.equal(lines[1],'Удобное время: Вечером, 16:00–19:00','Удобное время должно быть второй строкой');
assert.ok(!leads[1].wishes.includes('script'),'Произвольные значения не должны попадать в карточку');
assert.equal(contexts[0],'ВКонтакте · Вечером, 16:00–19:00','Уведомление менеджеру должно нести способ связи');
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
assert.match(note.text,/Сегодня выходной/,'В воскресенье нужно сказать про выходной');
assert.match(note.text,/ближайший рабочий день/);
assert.ok(!/нерабочее время/.test(note.text),'В выходной формулировка другая')});
