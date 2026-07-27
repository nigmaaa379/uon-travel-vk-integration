import { BotCore as BaseBotCore } from './bot-core-v3.js';
const b=(text,callback)=>({text,callback});
const DEPARTURE_STATES=['_departureLead','_departureSub'];
const cityPrompt=()=>({text:'Из какого города планируете вылет? Выберите вариант или напишите город сообщением.',buttons:[[b('Москва','v4:city:Москва'),b('Санкт-Петербург','v4:city:Санкт-Петербург')],[b('Казань','v4:city:Казань'),b('Екатеринбург','v4:city:Екатеринбург')],[b('Сочи','v4:city:Сочи'),b('Новосибирск','v4:city:Новосибирск')],[b('Другой город','v4:city:Другой город')]]});
const destinationPrompt=()=>({text:'Какое направление рассматриваете в первую очередь? Выберите вариант или напишите своё.',buttons:destinationButtons});
const destinationButtons=[[b('Россия','a:Россия'),b('Турция','a:Турция')],[b('Египет','a:Египет'),b('ОАЭ','a:ОАЭ')],[b('Таиланд','a:Таиланд'),b('Вьетнам','a:Вьетнам')],[b('Китай','a:Китай'),b('Шри-Ланка','a:Шри-Ланка')],[b('Другое направление','a:Другое направление')]];
const groupButtons=[[b('1 взрослый','a:1 взрослый'),b('2 взрослых','a:2 взрослых')],[b('Семья + 1 ребёнок','a:Семья с 1 ребёнком'),b('Семья + 2 детей','a:Семья с 2 детьми')],[b('Компания друзей','a:Компания друзей'),b('Другой состав','a:Другой состав')]];
const datesPrompt=(text)=>({text,buttons:[[b('Даты пока гибкие','a:Даты пока гибкие')]]});
export class BotCore extends BaseBotCore{
 constructor(deps){const uon={createQualifiedLead:t=>deps.uon.createQualifiedLead({...t,wishes:`Город вылета: ${t.departureCity||'не указан'}\n${t.wishes||''}`.trim()})};super({...deps,uon});this.v4Store=deps.store}
 async setDepartureCity(key,session,departureCity){await this.v4Store.saveBotSession(key,{...session,state:'destination',answers:{...session.answers,departureCity},updatedAt:Date.now()});return destinationPrompt()}
 async handle(platform,userId,input={}){const key=`${platform}:${userId}`,before=this.v4Store.getBotSession(key),action=String(input.callback||''),typed=String(input.text||'').trim();
  if(action.startsWith('v4:city:')){const departureCity=action.slice(8),session=this.v4Store.getBotSession(key);if(!session||!DEPARTURE_STATES.includes(session.state))return super.handle(platform,userId,{text:'/start'});return this.setDepartureCity(key,session,departureCity)}
  // Город вылета можно написать текстом: без этого служебное состояние сбрасывало диалог в главное меню.
  if(!action&&typed&&!typed.startsWith('/')&&DEPARTURE_STATES.includes(before?.state))return this.setDepartureCity(key,before,typed.slice(0,120));
  const output=await super.handle(platform,userId,input),after=this.v4Store.getBotSession(key);
  if(action==='consent:travel'&&before?.flow==='lead'&&after?.state==='destination'){await this.v4Store.saveBotSession(key,{...after,state:'_departureLead'});return cityPrompt()}
  if(action==='consent:ads'&&before?.flow==='sub'&&after?.state==='destination'){await this.v4Store.saveBotSession(key,{...after,state:'_departureSub'});return cityPrompt()}
  if(output?.text?.startsWith('Куда хотите отправиться'))return{...output,...destinationPrompt()};
  if(output?.text?.startsWith('Когда планируете поездку'))return{...output,...datesPrompt('Когда планируете поездку? Напишите месяц или даты сообщением — например, «октябрь» или «10–20 августа».')};
  if(output?.text?.startsWith('Укажите диапазон дат'))return{...output,...datesPrompt('На какой период искать горящие туры? Напишите месяц или даты сообщением — например, «октябрь».')};
  if(output?.text?.startsWith('Кто отправится'))return{...output,text:'Кто отправится в поездку? Для детей укажите возраст — кнопкой или сообщением.',buttons:groupButtons};
  if(output?.text?.startsWith('Что особенно важно'))return{...output,text:'Что особенно важно: первая линия, детский клуб, питание, короткий трансфер? Напишите своими словами или выберите вариант.'};
  if(output?.text?.startsWith('Как к вам обращаться'))return{...output,text:'Как к вам обращаться? Напишите имя сообщением.'};
  if(output?.text?.startsWith('На какой бюджет')){const buttons=output.buttons?.map(row=>row.map(button=>button.text==='Нужна консультация'?b('Без ограничений','a:Без ограничений'):button));return{...output,buttons}}
  return output}
}
