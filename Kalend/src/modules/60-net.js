/* ══════════════════════════════════════════════════════════════════
   MODULO v54 — "Chiave" · meteo per uso commerciale
   ------------------------------------------------------------------
   Il meteo dell'app arriva da Open-Meteo, che è gratuito SOLO per uso
   non commerciale. Per vendere l'app serve il piano commerciale, che
   dà una chiave API e usa altri indirizzi (customer-api.open-meteo.com,
   customer-geocoding-api.open-meteo.com). Questo modulo:
   · aggiunge in Impostazioni → Funzionalità il campo «Chiave API
     Open-Meteo»;
   · se la chiave è impostata, riscrive al volo ogni richiesta meteo e
     di geocodifica verso gli indirizzi del piano commerciale aggiungendo
     la chiave (sia quelle via Net.get, sia quelle via fetch).
   Senza chiave tutto funziona come prima (piano gratuito).
══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const tr=(s,p)=>{try{return typeof T==='function'?T(s,p):s;}catch(e){return s;}};
const key=()=>{try{return String(AppSettings.openMeteoKey||'').trim();}catch(e){return '';}};
function rewrite(url){
  const k=key();if(!k||typeof url!=='string')return url;
  let u=url;
  if(/^https:\/\/api\.open-meteo\.com\//.test(u))u=u.replace('https://api.open-meteo.com/','https://customer-api.open-meteo.com/');
  else if(/^https:\/\/geocoding-api\.open-meteo\.com\//.test(u))u=u.replace('https://geocoding-api.open-meteo.com/','https://customer-geocoding-api.open-meteo.com/');
  else return url;
  return u+(u.includes('?')?'&':'?')+'apikey='+encodeURIComponent(k);
}
function hook(){
  try{if(typeof Net==='object'&&typeof Net.get==='function'&&!Net.get._v54){const _g=Net.get.bind(Net);Net.get=function(url,ms){return _g(rewrite(url),ms);};Net.get._v54=true;}}catch(e){}
  try{if(typeof window.fetch==='function'&&!window.fetch._v54){const _f=window.fetch.bind(window);const f=function(input,init){if(typeof input==='string')input=rewrite(input);return _f(input,init);};f._v54=true;window.fetch=f;}}catch(e){}
}
function installSetting(){
  const ref=document.getElementById('set-feat-meteo');if(!ref||document.getElementById('set-openmeteo-key'))return;
  const host=ref.closest('.toggle-wrap')?ref.closest('.toggle-wrap').parentElement:ref.parentElement;
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const box=document.createElement('div');box.className='form-group';box.style.marginTop='8px';
  box.innerHTML=`<div class="form-label">🔑 ${esc(tr('Chiave API Open-Meteo (uso commerciale)'))}</div>
    <input type="text" class="form-input" id="set-openmeteo-key" autocomplete="off" spellcheck="false" placeholder="${esc(tr('Lascia vuoto per il piano gratuito (solo uso non commerciale)'))}">
    <div class="set-caption">${esc(tr('Con la chiave le richieste meteo passano dal piano commerciale di Open-Meteo.'))}</div>`;
  host.appendChild(box);
  const inp=box.querySelector('input');inp.value=key();
  inp.addEventListener('change',()=>{try{AppSettings.openMeteoKey=inp.value.trim();AppSettings.save();}catch(e){}try{toast(key()?tr('🔑 Chiave salvata'):tr('🔑 Chiave rimossa'));}catch(e){}});
}
hook();
if(document.readyState==='complete')setTimeout(installSetting,300);else addEventListener('load',()=>setTimeout(installSetting,300));
})();
