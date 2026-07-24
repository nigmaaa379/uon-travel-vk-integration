const ACCEPT_KEY='seaEscapeCookieConsent';
const REJECT_KEY='seaEscapeCookieRejected';
const METRIKA_ID=110979041;
const banner=document.querySelector('#cookie-banner');
const accept=document.querySelector('#accept-cookies');

function initializeTourvisorAfterLoad(element){
  if(element.tagName!=='SCRIPT'||!String(element.dataset.consentSrc||'').includes('tourvisor.ru'))return;
  element.async=false;
  element.addEventListener('load',()=>{
    document.dispatchEvent(new Event('DOMContentLoaded',{bubbles:true}));
    window.dispatchEvent(new Event('load'));
    setTimeout(()=>{
      const form=document.querySelector('.tv-search-form');
      if(form&&!form.children.length){
        const retry=document.createElement('script');
        retry.src='https://tourvisor.ru/module/init.js?retry='+Date.now();
        retry.async=false;
        document.head.append(retry);
      }
    },1200);
  },{once:true});
}

function loadOptionalContent(){
  document.querySelectorAll('[data-consent-src]').forEach(element=>{
    if(!element.getAttribute('src')){
      initializeTourvisorAfterLoad(element);
      element.setAttribute('src',element.dataset.consentSrc);
    }
  });
  document.querySelector('.tourvisor-consent-note')?.setAttribute('hidden','');
}

function stopOptionalContent(){
  if(typeof window.ym==='function'){
    try{window.ym(METRIKA_ID,'destruct')}catch{}
  }
  document.querySelector(`script[data-yandex-metrika="${METRIKA_ID}"]`)?.remove();
  document.querySelectorAll('[data-consent-src]').forEach(element=>element.removeAttribute('src'));
  document.querySelector('.tv-search-form')?.replaceChildren();
  document.querySelector('.tourvisor-consent-note')?.removeAttribute('hidden');
  try{delete window.ym}catch{window.ym=undefined}
}

let reject=document.querySelector('#reject-cookies');
if(banner&&!reject){reject=document.createElement('button');reject.type='button';reject.id='reject-cookies';reject.className='btn cookie-reject';reject.textContent='Отклонить необязательные';banner.append(reject)}
let settings=document.querySelector('#cookie-settings');
if(!settings){settings=document.createElement('button');settings.type='button';settings.id='cookie-settings';settings.className='cookie-settings';settings.textContent='Настройки cookie';document.querySelector('footer')?.append(settings)}
if(localStorage.getItem(ACCEPT_KEY))loadOptionalContent();
if(localStorage.getItem(REJECT_KEY)&&!localStorage.getItem(ACCEPT_KEY)){stopOptionalContent();requestAnimationFrame(()=>banner?.classList.remove('visible'))}
accept?.addEventListener('click',()=>{localStorage.removeItem(REJECT_KEY);loadOptionalContent()});
reject?.addEventListener('click',()=>{localStorage.removeItem(ACCEPT_KEY);localStorage.setItem(REJECT_KEY,new Date().toISOString());banner?.classList.remove('visible');stopOptionalContent()});
settings?.addEventListener('click',()=>banner?.classList.add('visible'));
const style=document.createElement('style');style.textContent='.cookie-reject{background:#eef4f5;color:#064e63;border-color:#b8d0d5}.cookie-settings{display:block;margin:0 auto 24px;border:0;background:none;color:#c2d9de;text-decoration:underline;cursor:pointer}.cookie-settings:hover{color:#fff}@media(max-width:560px){.cookie-banner{align-items:stretch;flex-direction:column}.cookie-banner .btn{width:100%}}';document.head.append(style);
