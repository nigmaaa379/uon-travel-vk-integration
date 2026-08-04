import test from'node:test';import assert from'node:assert/strict';import{readFile,mkdtemp}from'node:fs/promises';import{readFileSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';
import{JsonStore}from'../src/store.js';import{SiteComplianceService}from'../src/site-compliance.js';
const html=await readFile(new URL('../web/index.html',import.meta.url),'utf8');const css=await readFile(new URL('../web/assets/styles.css',import.meta.url),'utf8');
const completion=await readFile(new URL('../web/assets/completion.js',import.meta.url),'utf8');
const payment=await readFile(new URL('../web/legal/payment.html',import.meta.url),'utf8');const refund=await readFile(new URL('../web/legal/refund.html',import.meta.url),'utf8');
const section=html.slice(html.indexOf('id="installment"'),html.indexOf('</section>',html.indexOf('id="installment"')));

test('the site states the credit terms it was given',()=>{for(const fact of['3 000 – 500 000 ₽','3 – 36 месяцев','от 6,709 до 70% годовых','Не требуется','АО «ТБанк»','Т-Финанс','www.tbank.ru'])assert.ok(section.includes(fact),`Нет условия: ${fact}`);
for(const fact of['от 21 года до 65 лет','не менее 3 месяцев','+79','положительная кредитная история'])assert.ok(section.includes(fact),`Нет требования к заёмщику: ${fact}`);
for(const fact of['4 часа','48 часов','до 50 000 ₽'])assert.ok(section.includes(fact),`Нет условия периода охлаждения: ${fact}`);
assert.ok(section.includes('не является офертой'),'Нужна оговорка, что это не оферта')});

test('rate and total cost of credit share one font, as 353-FZ requires',()=>{const lines=section.match(/class="inst-rate-line"/g)||[];assert.equal(lines.length,2,'Ставка и ПСК должны быть двумя однотипными строками');
assert.ok(section.includes('Процентная ставка')&&section.includes('Полная стоимость кредита'));
const rule=css.slice(css.indexOf('.inst-rate-line,'),css.indexOf('}',css.indexOf('.inst-rate-line,')));
assert.ok(rule.includes('.inst-rate-line b'),'Правило должно охватывать и жирный текст внутри строки');
assert.ok(rule.includes('font-size: 1rem'),'У ставки и ПСК должен быть один размер шрифта');
const sizes=new Set();for(const block of css.match(/[^{}]*\.inst-rate-line[^{}]*\{[^}]*\}/g)||[]){for(const size of block.match(/font-size:\s*([^;}]+)/g)||[])sizes.add(size.split(':')[1].trim())}
assert.deepEqual([...sizes],['1rem'],'У ставки и ПСК должен быть ровно один размер шрифта, без переопределений')});

test('both lead forms offer the installment checkbox',()=>{const boxes=html.match(/name="installment"/g)||[];assert.equal(boxes.length,2,'Чекбокс нужен в обеих формах');
const main=html.slice(html.indexOf('value="main"'),html.indexOf('</form>',html.indexOf('value="main"')));
const modal=html.slice(html.indexOf('value="modal"'),html.indexOf('</form>',html.indexOf('value="modal"')));
assert.ok(main.includes('name="installment"'),'Нет чекбокса в форме «Личная подборка»');
assert.ok(modal.includes('name="installment"'),'Нет чекбокса в модальной форме «Подберём отдых под вашу семью»');
for(const form of [main,modal]){const box=form.indexOf('name="installment"');const consent=form.indexOf('name="personalConsent"');assert.ok(box<consent,'Выбор оплаты не должен смешиваться с согласиями');assert.ok(!form.slice(box-200,box).includes('class="consents"'),'Чекбокс рассрочки не должен лежать внутри блока согласий')}
assert.ok(!/name="installment"[^>]*required/.test(html),'Рассрочка — добровольный выбор, обязательной быть не может');
assert.match(completion,/d\.installment=d\.installment==='on'/,'Флаг рассрочки не уходит на сервер')});

test('a ticked checkbox lands in the U-ON note',async()=>{const dir=await mkdtemp(join(tmpdir(),'inst-'));const store=new JsonStore(join(dir,'store.json'));await store.init?.();
const leads=[];const svc=new SiteComplianceService({siteRoot:new URL('../web',import.meta.url).pathname,store,uon:{createQualifiedLead:async t=>{leads.push(t);return{id:6001}}},notifier:{notify:async()=>({ok:true})},evidenceSecret:'s'.repeat(32),logger:{error(){},warn(){}}});
const http=await import('node:http');const srv=http.createServer(async(q,r)=>{if(await svc.handle(q,r))return;r.writeHead(404);r.end('{}')});
await new Promise(r=>srv.listen(0,r));const url=`http://127.0.0.1:${srv.address().port}/api/site/leads-v2`;
const base={name:'Мария Иванова',phone:'+79001112233',personalConsent:true,countryInfoAcknowledged:true};
const send=body=>fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
await send({...base,installment:true});await send({...base,installment:false});await send({...base});
srv.close();
assert.match(leads[0].wishes,/РАССРОЧКА/,'Пометка о рассрочке не попала в примечание U-ON');
assert.match(leads[0].wishes,/ТБанк/,'В примечании должен быть кредитор');
assert.ok(!/РАССРОЧКА/.test(leads[1].wishes),'Без галочки пометки быть не должно');
assert.ok(!/РАССРОЧКА/.test(leads[2].wishes),'Отсутствие поля не должно включать рассрочку')});

test('payment and refund documents cover the credit',()=>{for(const fact of['Рассрочка и кредит','АО «ТБанк»','от 6,709 до 70% годовых','от 3 000 до 500 000 ₽','период охлаждения не устанавливается','www.tbank.ru'])assert.ok(payment.includes(fact),`«Условия оплаты»: нет пункта ${fact}`);
for(const fact of['Возврат при оплате в рассрочку','кредитор','период охлаждения'])assert.ok(refund.toLowerCase().includes(fact.toLowerCase()),`«Возврат средств»: нет пункта ${fact}`);
assert.ok(refund.includes('/legal/payment.html'),'Из возврата должна быть ссылка на условия оплаты')});

test('the block is reachable from the menu',()=>{assert.ok(html.includes('href="#installment">Рассрочка'),'Нет пункта меню');
assert.ok(html.indexOf('id="installment"')<html.indexOf('lead-card'),'Блок должен идти перед формой заявки')});

test('the block has a working call to action',()=>{const cta=section.slice(section.indexOf('class="inst-cta"'),section.indexOf('</div>',section.indexOf('inst-cta-note')));
assert.match(cta,/Оформить тур в кредит/,'Нет кнопки оформления');
assert.match(cta,/href="#lead-form"/,'Без JS кнопка должна вести к форме заявки');
assert.match(cta,/data-open-modal="tour-request"/,'С JS кнопка должна открывать форму заявки');
assert.match(cta,/data-installment/,'Кнопка должна помечать заявку как кредитную');
assert.ok(html.includes('id="lead-form"'),'Нет якоря формы заявки');
const siteJs=readFileSync(new URL('../web/assets/app.js',import.meta.url),'utf8');
assert.match(siteJs,/dataset\.installment/,'Обработчик не отмечает галочку рассрочки');
assert.match(siteJs,/event\.preventDefault\(\)/,'Ссылка-кнопка не должна прыгать к форме, когда открывается модальное окно')});
