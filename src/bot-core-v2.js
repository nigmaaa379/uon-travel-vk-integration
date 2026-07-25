import { BotCore as Legacy } from './bot-core.js';
import { normalizePhone,isEmail } from './qualification.js';
const S='https://tursbezhimnamore.ru',L={privacy:`${S}/page/privacy`,pd:`${S}/legal/consent.html`,ads:`${S}/legal/marketing-consent.html`,travel:`${S}/legal/travel-information.html`,terms:`${S}/legal/service-terms.html`,contract:`${S}/legal/tour-contract.html`};
const b=(text,callback)=>({text,callback}),u=(text,url)=>({text,url});
const home=()=>({text:'🌊 Сбежим на море\n\nПомогу подобрать семейный отдых, найти подходящие предложения и передать запрос менеджеру.\n\nЧто вы хотите сделать?',buttons:[[b('🔎 Подобрать тур','qualify')],[b('🔥 Горящие предложения','subscribe')],[b('💬 Связаться с менеджером','manager')],[b('📄 Документы и согласия','documents')]]});
const help=()=>({text:'ℹ️ Помощь\n\n/start — главное меню\n/help — помощь и документы\n\nВсе действия выбираются кнопками под сообщениями. Менеджер обязательно проверит наличие, цену и условия до бронирования.',buttons:[[b('🔎 Подобрать тур','qualify'),b('🔥 Горящие туры','subscribe')],[b('📄 Документы','documents'),b('💬 Менеджер','manager')],[b('🏠 В меню','menu')]]});
const docs=()=>({text:'📄 Правовая информация\n\nПеред заявкой бот отдельно запросит обязательные подтверждения. Рекламная подписка всегда добровольная.',buttons:[[u('Политика конфиденциальности',L.privacy)],[u('Согласие на обработку ПД',L.pd)],[u('Согласие на рассылку',L.ads)],[u('Правила въезда и пребывания',L.travel)],[u('Условия услуг',L.terms),u('Шаблон договора',L.contract)],[b('🏠 В меню','menu')]]});
const manager=()=>({text:'💬 Связь с менеджером\n\nТелефон: +7 (920) 124-20-33\nEmail: l_g_goreva@mail.ru\nПн–Сб, 10:00–19:00 по Москве.',buttons:[[u('Написать в WhatsApp','https://wa.me/79201242033')],[u('Открыть сайт',S)],[b('🏠 В меню','menu')]]});
const pd=()=>({text:'🔐 Для подбора тура понадобятся имя, телефон, email и параметры поездки. Нажимая «Согласен», вы подтверждаете согласие на обработку персональных данных и ознакомление с Политикой. Рекламная рассылка сюда не входит.',buttons:[[b('✅ Согласен, продолжить','consent:pd')],[u('Согласие',L.pd),u('Политика',L.privacy)],[b('↩️ В меню','menu')]]});
const travel=()=>({text:'🛂 До бронирования проверьте паспорт, визовые и транзитные требования, правила поездки с детьми, медицинские и таможенные ограничения. Подтвердите ознакомление с памяткой.',buttons:[[b('✅ Ознакомлен, продолжить','consent:travel')],[u('Открыть памятку',L.travel)],[b('↩️ В меню','menu')]]});
const ads=()=>({text:'🔥 Будем присылать только предложения по вашим параметрам. Подписка добровольная; отказаться можно командой /stop. Подтвердите отдельное согласие на рекламные сообщения.',buttons:[[b('✅ Согласен на рассылку','consent:ads')],[u('Условия согласия',L.ads)],[b('Нет, вернуться в меню','menu')]]});
const dest=()=>({text:'Куда хотите отправиться? Выберите направление или напишите своё.',buttons:[[b('Турция','a:Турция'),b('Египет','a:Египет')],[b('ОАЭ','a:ОАЭ'),b('Мальдивы','a:Мальдивы')],[b('Таиланд','a:Таиланд'),b('Вьетнам','a:Вьетнам')],[b('Пока не определились','a:Пока не определились')]]});
const budget={text:'На какой бюджет ориентируемся?',buttons:[[b('до 150 000 ₽','a:до 150 000 ₽'),b('150–250 тыс. ₽','a:150–250 тыс. ₽')],[b('250–400 тыс. ₽','a:250–400 тыс. ₽'),b('Нужна консультация','a:Нужна консультация')]]},group={text:'Кто поедет? Для детей укажите возраст.',buttons:[[b('2 взрослых','a:2 взрослых'),b('2 взрослых + ребёнок','a:2 взрослых и ребёнок')],[b('2 взрослых + 2 детей','a:2 взрослых и 2 детей')]]};
const steps={destination:['dates','destination',{text:'Когда планируете поездку?',buttons:[[b('Даты гибкие','a:Даты гибкие')]]}],dates:['budget','dates',budget],budget:['group','budget',group],group:['wishes','group',{text:'Что важно учесть: первая линия, детский клуб, питание, отдельная спальня?',buttons:[[b('Особых пожеланий нет','a:Особых пожеланий нет')]]}],wishes:['name','wishes',{text:'Как к вам обращаться?'}],name:['phone','name',{text:'Укажите телефон: +7XXXXXXXXXX.'}],phone:['email','phone',{text:'Укажите email для получения подборки.'}]};
export class BotCore{
 constructor(d){Object.assign(this,d);this.legacy=new Legacy(d)}
 async save(k,flow,state,answers){await this.store.saveBotSession(k,{flow,state,answers,updatedAt:Date.now()})}
 async handle(platform,userId,input={}){
  const k=`${platform}:${userId}`,raw=String(input.text||'').trim(),cmd=raw.split(/\s+/)[0].toLowerCase().split('@')[0];let a=input.callback||'',s=this.store.getBotSession(k);
  if(a.startsWith('booking:')||s?.flow==='booking')return this.legacy.handle(platform,userId,input);
  if(cmd==='/start'||!raw&&!a)a='menu';else if(cmd==='/help')a='help';else if(cmd==='/search')a='qualify';else if(cmd==='/hot')a='subscribe';else if(cmd==='/manager')a='manager';else if(['/privacy','/documents'].includes(cmd))a='documents';else if(cmd==='/stop')a='stop';
  if(a==='menu'){await this.store.clearBotSession(k);return home()}if(a==='help')return help();if(a==='documents')return docs();if(a==='manager')return manager();
  if(a==='stop'){const n=await this.store.deactivateSubscriptions?.(platform,userId)||0;await this.store.clearBotSession(k);return{text:n?'Рассылка остановлена.':'Активных подписок не найдено.',buttons:[[b('🏠 В меню','menu')]]}}
  if(a==='qualify'){await this.save(k,'lead','pd',{});return pd()}if(a==='subscribe'){await this.save(k,'sub','ads',{});return ads()}
  s=this.store.getBotSession(k);if(!s)return home();
  if(a==='consent:pd'&&s.state==='pd'){await this.save(k,s.flow,'travel',{...s.answers,pd:true});return travel()}
  if(a==='consent:travel'&&s.state==='travel'){await this.save(k,s.flow,'destination',{...s.answers,travel:true});return dest()}
  if(a==='consent:ads'&&s.state==='ads'){await this.store.saveConsentEvidence?.({receivedAt:new Date().toISOString(),channel:platform,messengerUserId:String(userId),consentType:'marketing',marketingConsent:true,marketingConsentVersion:'2026-07-24'});await this.save(k,'sub','destination',{...s.answers,ads:true});return dest()}
  let v=a.startsWith('a:')?a.slice(2):raw;if(!v)return{text:'Введите ответ или выберите кнопку.'};
  if(s.flow==='sub')return this.sub(k,platform,userId,s,v);
  if(s.state==='phone'){v=normalizePhone(v);if(!v)return{text:'Проверьте номер. Пример: +79991234567.'}}
  if(s.state==='email')return this.finish(k,platform,userId,s,v);
  const x=steps[s.state];if(!x)return home();await this.save(k,'lead',x[0],{...s.answers,[x[1]]:v});return x[2]
 }
 async sub(k,platform,userId,s,v){
  const map={destination:['dates','destination',{text:'Укажите даты.',buttons:[[b('Даты гибкие','a:Даты гибкие')]]}],dates:['budget','dates',budget],budget:['group','budget',group]};
  if(map[s.state]){const x=map[s.state];await this.save(k,'sub',x[0],{...s.answers,[x[1]]:v});return x[2]}
  if(s.state==='group'){const{ads:ok,...params}={...s.answers,group:v};await this.store.addSubscription({platform,userId,params,consent:{marketingConsent:!!ok,version:'2026-07-24'}});await this.store.clearBotSession(k);return{text:'✅ Подписка настроена. Цена и наличие подтверждаются менеджером.',buttons:[[b('🔎 Подобрать тур','qualify')],[b('Остановить рассылку','stop')],[b('🏠 В меню','menu')]]}}return ads()
 }
 async finish(k,platform,userId,s,email){
  if(!isEmail(email))return{text:'Проверьте email.'};const{pd:personalConsent,travel:travelInfoAcknowledged,...answers}=s.answers,lead=await this.uon.createQualifiedLead({...answers,email:email.toLowerCase(),platform,messengerUserId:userId});await this.store.saveConsentEvidence?.({receivedAt:new Date().toISOString(),channel:platform,messengerUserId:String(userId),consentType:'personal',personalConsent,travelInfoAcknowledged,consentVersion:'2026-07-24',privacyPolicyVersion:'2026-07-24',travelInformationVersion:'2026-07-24',uonLeadId:String(lead.id)});await this.notifier.notify(lead.id);await this.store.clearBotSession(k);return{text:`✅ Обращение №${lead.id} создано. Менеджер свяжется с вами.`,buttons:[[b('🔥 Получать предложения','subscribe')],[b('💬 Менеджер','manager')],[b('🏠 В меню','menu')]]}
 }
}
