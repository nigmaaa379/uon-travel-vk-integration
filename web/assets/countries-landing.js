(()=>{
'use strict'
if(!document.querySelector('#destinations'))return
var BADGE={free:'Без визы',arrival:'Виза по прилёте',advance:'Виза заранее'}
var BASE=[['abhaziya','🇦🇧','Абхазия','free'],['turkey','🇹🇷','Турция','free'],['egypt','🇪🇬','Египет','arrival'],['uae','🇦🇪','ОАЭ','free'],['thailand','🇹🇭','Таиланд','free'],['maldives','🇲🇻','Мальдивы','arrival'],['vietnam','🇻🇳','Вьетнам','free'],['seychelles','🇸🇨','Сейшелы','arrival'],['china','🇨🇳','Китай','free'],['oman','🇴🇲','Оман','free'],['qatar','🇶🇦','Катар','arrival'],['cuba','🇨🇺','Куба','free'],['india','🇮🇳','Индия','advance']]
var CSS='#countries{padding:56px 0}#countries .c-head{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;justify-content:space-between}#countries .c-head p{margin:6px 0 0;color:var(--muted);max-width:620px}#countries .c-all{display:inline-flex;gap:8px;font-weight:600;color:var(--ocean);text-decoration:none;white-space:nowrap}#countries .c-all:hover{color:var(--orange2)}#countries .c-filters{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}#countries .c-filters button{border:1px solid var(--line);background:#fff;color:var(--ink);border-radius:999px;padding:8px 16px;font:inherit;font-size:14px;cursor:pointer}#countries .c-filters button.is-active{background:var(--deep);border-color:var(--deep);color:#fff}#countries .c-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}#countries .c-tile{display:flex;align-items:center;gap:12px;padding:14px 16px;background:#fff;border:1px solid var(--line);border-radius:var(--radius);text-decoration:none;color:inherit}#countries .c-tile:hover{border-color:var(--aqua);box-shadow:0 8px 20px rgba(6,78,99,.10)}#countries .c-flag{font-size:24px;line-height:1}#countries .c-name{font-weight:600}#countries .c-visa{display:block;font-size:13px;margin-top:2px}#countries .c-visa.free{color:#0f8f6c}#countries .c-visa.arrival{color:#b26a00}#countries .c-visa.advance{color:#b03a4b}#countries .c-note{margin-top:16px;color:var(--muted);font-size:14px}'
function esc(v){return String(v||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function load(src){return new Promise(function(done){var s=document.createElement('script');s.src=src;s.onload=done;s.onerror=done;document.head.appendChild(s)})}
function build(list){
var style=document.createElement('style');style.textContent=CSS;document.head.appendChild(style)
var section=document.createElement('section');section.id='countries'
section.innerHTML='<div class="wrap"><div class="c-head"><div><h2>Страны и правила въезда</h2><p>'+list.length+' направлений с актуальными визовыми требованиями: нужна ли виза, на какой срок можно въехать и какой нужен загранпаспорт.</p></div><a class="c-all" href="/visa.html">Полный справочник →</a></div><div class="c-filters"><button type="button" data-f="all" class="is-active">Все страны</button><button type="button" data-f="free">Без визы</button><button type="button" data-f="arrival">Виза по прилёте</button><button type="button" data-f="advance">Виза заранее</button></div><div class="c-grid"></div><p class="c-note">Данные носят справочный характер. Перед бронированием менеджер проверяет требования на дату поездки.</p></div>'
var grid=section.querySelector('.c-grid')
grid.innerHTML=list.map(function(c){return '<a class="c-tile" data-visa="'+c.visa+'" href="/visa.html#'+esc(c.id)+'"><span class="c-flag" aria-hidden="true">'+esc(c.flag)+'</span><span><span class="c-name">'+esc(c.name)+'</span><span class="c-visa '+c.visa+'">'+BADGE[c.visa]+'</span></span></a>'}).join('')
var dest=document.querySelector('#destinations')
dest.insertAdjacentElement('afterend',section)
var tiles=Array.prototype.slice.call(grid.children)
Array.prototype.slice.call(section.querySelectorAll('.c-filters button')).forEach(function(btn){
btn.addEventListener('click',function(){
var f=btn.getAttribute('data-f')
Array.prototype.slice.call(section.querySelectorAll('.c-filters button')).forEach(function(b){b.classList.toggle('is-active',b===btn)})
tiles.forEach(function(t){t.hidden=f!=='all'&&t.getAttribute('data-visa')!==f})
})
})
}
var list=BASE.map(function(r){return {id:r[0],flag:r[1],name:r[2],visa:r[3]}})
Promise.all(['/assets/visa-data-1.js','/assets/visa-data-2.js','/assets/visa-data-3.js','/assets/visa-data-4.js'].map(load)).then(function(){
var seen={};list.forEach(function(c){seen[c.id]=1})
var extra=Array.isArray(window.VISA_EXTRA)?window.VISA_EXTRA:[]
extra.forEach(function(c){if(!c||!c.id||seen[c.id])return;seen[c.id]=1;list.push({id:c.id,flag:c.flag,name:c.name,visa:BADGE[c.visa]?c.visa:'advance'})})
list.sort(function(a,b){return String(a.name).localeCompare(String(b.name),'ru')})
build(list)
})
})()
