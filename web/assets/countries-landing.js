(()=>{
'use strict'
if(!document.querySelector('#destinations'))return
var BADGE={free:'Без визы',arrival:'Виза по прилёте',advance:'Виза заранее'}
var FILES=['/assets/visa-data-0.js','/assets/visa-data-1.js','/assets/visa-data-2.js','/assets/visa-data-3.js','/assets/visa-data-4.js']
var CSS='#countries{padding:56px 0}#countries .c-head{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;justify-content:space-between}#countries .c-head p{margin:6px 0 0;color:var(--muted);max-width:640px}#countries .c-search{margin:18px 0 10px;width:100%;max-width:360px;padding:12px 16px;border:1px solid var(--line);border-radius:999px;font:inherit;background:#fff}#countries .c-filters{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 18px}#countries .c-filters button{border:1px solid var(--line);background:#fff;color:var(--ink);border-radius:999px;padding:8px 16px;font:inherit;font-size:14px;cursor:pointer}#countries .c-filters button.is-active{background:var(--deep);border-color:var(--deep);color:#fff}#countries .c-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}#countries .c-tile{display:flex;align-items:center;gap:12px;padding:14px 16px;background:#fff;border:1px solid var(--line);border-radius:var(--radius);text-align:left;font:inherit;color:inherit;cursor:pointer}#countries .c-tile:hover{border-color:var(--aqua);box-shadow:0 8px 20px rgba(6,78,99,.10)}#countries .c-flag{font-size:24px;line-height:1}#countries .c-name{display:block;font-weight:600}#countries .c-visa{display:block;font-size:13px;margin-top:2px}#countries .c-visa.free{color:#0f8f6c}#countries .c-visa.arrival{color:#b26a00}#countries .c-visa.advance{color:#b03a4b}#countries .c-empty{color:var(--muted);padding:14px 0}#countries .c-note{margin-top:16px;color:var(--muted);font-size:14px}#c-panel{position:fixed;inset:0;z-index:1200;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(16,47,56,.55)}#c-panel.is-open{display:flex}#c-panel .c-card{background:#fff;border-radius:var(--radius);max-width:560px;width:100%;max-height:86vh;overflow:auto;padding:24px;box-shadow:0 24px 60px rgba(6,78,99,.28);position:relative}#c-panel .c-close{position:absolute;top:12px;right:12px;width:36px;height:36px;border-radius:50%;border:1px solid var(--line);background:#fff;font-size:20px;line-height:1;cursor:pointer;color:var(--muted)}#c-panel .c-title{display:flex;align-items:center;gap:12px;margin:0 40px 4px 0;font-size:24px}#c-panel .c-region{color:var(--muted);font-size:14px;margin:0 0 12px}#c-panel .c-tag{display:inline-block;border-radius:999px;padding:6px 14px;font-size:14px;font-weight:600;margin-bottom:16px}#c-panel .c-tag.free{background:#e4f6ef;color:#0f8f6c}#c-panel .c-tag.arrival{background:#fdf0dc;color:#b26a00}#c-panel .c-tag.advance{background:#fdeaee;color:#b03a4b}#c-panel dl{margin:0}#c-panel dl>div{padding:12px 0;border-top:1px solid var(--line)}#c-panel dt{font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}#c-panel dd{margin:4px 0 0}#c-panel .c-btn{display:inline-block;margin-top:18px;background:var(--orange);color:#fff;border:0;border-radius:999px;padding:13px 24px;font:inherit;font-weight:600;cursor:pointer}#c-panel .c-btn:hover{background:var(--orange2)}#c-panel .c-fine{margin:14px 0 0;font-size:13px;color:var(--muted)}'
function esc(v){return String(v||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function norm(v){return String(v||'').toLowerCase().replace(/\u0451/g,'\u0435').trim()}
function load(src){return new Promise(function(d){var s=document.createElement('script');s.src=src;s.onload=d;s.onerror=d;document.head.appendChild(s)})}
function build(list){
var style=document.createElement('style');style.textContent=CSS;document.head.appendChild(style)
var section=document.createElement('section');section.id='countries'
section.innerHTML='<div class="wrap"><div class="c-head"><div><h2>Страны и правила въезда</h2><p>'+list.length+' направлений: нажмите на страну — сразу покажем, нужна ли виза, на какой срок можно въехать и какой нужен загранпаспорт.</p></div></div><input class="c-search" type="search" placeholder="Поиск страны" aria-label="Поиск страны"><div class="c-filters"><button type="button" data-f="all" class="is-active">Все страны</button><button type="button" data-f="free">Без визы</button><button type="button" data-f="arrival">Виза по прилёте</button><button type="button" data-f="advance">Виза заранее</button></div><div class="c-grid"></div><p class="c-empty" hidden>По запросу ничего не нашлось. Напишите нам — подберём любое направление.</p><p class="c-note">Данные носят справочный характер. Перед бронированием менеджер проверяет требования на дату вашей поездки.</p></div>'
var grid=section.querySelector('.c-grid')
grid.innerHTML=list.map(function(c,i){return '<button type="button" class="c-tile" data-i="'+i+'" data-visa="'+c.visa+'" data-q="'+esc(norm(c.name+' '+c.region))+'"><span class="c-flag" aria-hidden="true">'+esc(c.flag)+'</span><span><span class="c-name">'+esc(c.name)+'</span><span class="c-visa '+c.visa+'">'+BADGE[c.visa]+'</span></span></button>'}).join('')
document.querySelector('#destinations').insertAdjacentElement('afterend',section)

var overlay=document.createElement('div');overlay.id='c-panel'
overlay.innerHTML='<div class="c-card" role="dialog" aria-modal="true"><button type="button" class="c-close" aria-label="Закрыть">×</button><div class="c-body"></div></div>'
document.body.appendChild(overlay)
var body=overlay.querySelector('.c-body')
var close=function(){overlay.classList.remove('is-open');document.body.style.overflow=''}
overlay.addEventListener('click',function(e){if(e.target===overlay||e.target.classList.contains('c-close'))close()})
document.addEventListener('keydown',function(e){if(e.key==='Escape')close()})
var open=function(c){
body.innerHTML='<h3 class="c-title"><span aria-hidden="true">'+esc(c.flag)+'</span> '+esc(c.name)+'</h3><p class="c-region">'+esc(c.region)+'</p><span class="c-tag '+c.visa+'">'+BADGE[c.visa]+'</span><dl><div><dt>Визовый режим и срок</dt><dd>'+esc(c.stay)+'</dd></div><div><dt>Загранпаспорт</dt><dd>'+esc(c.passport)+'</dd></div><div><dt>Что важно учесть</dt><dd>'+esc(c.extra)+'</dd></div></dl><button type="button" class="c-btn">Подобрать тур в '+esc(c.name)+'</button><p class="c-fine">Информация справочная. Менеджер подтвердит актуальные требования на дату поездки.</p>'
var btn=body.querySelector('.c-btn')
btn.addEventListener('click',function(){
close()
var modal=document.querySelector('#tour-request')
if(modal&&modal.showModal){var f=modal.querySelector('[name="destination"],[name="country"],[name="comment"],textarea');if(f&&!f.value)f.value=c.name;modal.showModal()}
else location.hash='#lead'
})
overlay.classList.add('is-open');document.body.style.overflow='hidden'
}
var tiles=Array.prototype.slice.call(grid.children)
tiles.forEach(function(t){t.addEventListener('click',function(){open(list[Number(t.getAttribute('data-i'))])})})

var filter='all',search=section.querySelector('.c-search'),empty=section.querySelector('.c-empty')
var apply=function(){
var q=norm(search.value),shown=0
tiles.forEach(function(t){
var ok=(filter==='all'||t.getAttribute('data-visa')===filter)&&(!q||t.getAttribute('data-q').indexOf(q)!==-1)
t.hidden=!ok;if(ok)shown++
})
empty.hidden=shown!==0
}
search.addEventListener('input',apply)
Array.prototype.slice.call(section.querySelectorAll('.c-filters button')).forEach(function(b){
b.addEventListener('click',function(){
filter=b.getAttribute('data-f')
Array.prototype.slice.call(section.querySelectorAll('.c-filters button')).forEach(function(x){x.classList.toggle('is-active',x===b)})
apply()
})
})
apply()
var fromHash=function(){
var id=(location.hash||'').replace('#','')
if(!id)return
for(var i=0;i<list.length;i++)if(list[i].id===id){open(list[i]);return}
}
fromHash()
window.addEventListener('hashchange',fromHash)
}
Promise.all(FILES.map(load)).then(function(){
var seen={},list=[]
;(Array.isArray(window.VISA_EXTRA)?window.VISA_EXTRA:[]).forEach(function(c){
if(!c||!c.id||seen[c.id])return
seen[c.id]=1
list.push({id:c.id,flag:c.flag,name:c.name,region:c.region||'',visa:BADGE[c.visa]?c.visa:'advance',stay:c.stay||'',passport:c.passport||'',extra:c.extra||''})
})
list.sort(function(a,b){return String(a.name).localeCompare(String(b.name),'ru')})
if(list.length)build(list)
})
})()
