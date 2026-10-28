/* ══════════════════════════════════════════════════════════════════
   MODULO v55 · 1.14 — «Testo grande»
   ------------------------------------------------------------------
   Scheda «Dimensione del testo» nelle impostazioni (sezione Aspetto)
   con tre livelli: normale · grande · molto grande.
   · La scelta è salvata in localStorage (kx_textsize_v1) e applicata
     come attributo data-textsize su <html>; il CSS del modulo fa il resto.
   · All'avvio l'attributo viene già impostato dal caricatore in testa
     alla pagina (tools/build.js), così non c'è nessuno "scatto" visivo.
   · KX.TextSize.{get,set,levels} per gli altri moduli.
══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const KX=window.KX=window.KX||{};
const KEY='kx_textsize_v1';
const LEVELS=['normal','big','xl'];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tr=(s,p)=>{try{return typeof T==='function'?T(s,p):s;}catch(e){return s;}};
const LABEL={normal:()=>tr('Normale'),big:()=>tr('Grande'),xl:()=>tr('Molto grande')};

function get(){try{const v=localStorage.getItem(KEY);return LEVELS.includes(v)?v:'normal';}catch(e){return 'normal';}}
function apply(v){
  const el=document.documentElement;
  if(v==='normal')el.removeAttribute('data-textsize');else el.setAttribute('data-textsize',v);
}
function set(v){
  if(!LEVELS.includes(v))v='normal';
  try{if(v==='normal')localStorage.removeItem(KEY);else localStorage.setItem(KEY,v);}catch(e){}
  apply(v);
  const card=document.getElementById('kx-ts-card');
  if(card)card.querySelectorAll('.kx-ts-btn').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
  try{document.dispatchEvent(new CustomEvent('kx-textsize',{detail:{level:v}}));}catch(e){}
}

/* scheda nelle impostazioni: subito dopo il colore d'accento (sezione Aspetto) */
function installCard(){
  if(document.getElementById('kx-ts-card'))return;
  const accent=document.getElementById('set-accent-wrap');
  const host=accent?accent.closest('.form-group'):null;
  if(!host)return;
  const card=document.createElement('div');card.id='kx-ts-card';card.className='form-group';
  card.innerHTML=`<div class="form-label">🔠 ${esc(tr('Dimensione del testo'))}</div>
    <div class="kx-ts-seg" role="radiogroup" aria-label="${esc(tr('Dimensione del testo'))}">${LEVELS.map(v=>`<button type="button" class="kx-ts-btn" data-v="${v}" role="radio">${esc(LABEL[v]())}</button>`).join('')}</div>
    <div class="set-caption">${esc(tr('Vale per schede, giornata, liste, finestre e impostazioni. La griglia del calendario resta invariata.'))}</div>`;
  host.insertAdjacentElement('afterend',card);
  card.querySelectorAll('.kx-ts-btn').forEach(b=>{b.addEventListener('click',()=>set(b.dataset.v));b.setAttribute('aria-checked',String(b.dataset.v===get()));});
  card.querySelectorAll('.kx-ts-btn').forEach(b=>b.classList.toggle('on',b.dataset.v===get()));
}

apply(get());
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installCard);else installCard();
/* le impostazioni vengono ricostruite in alcune situazioni: la scheda si reinstalla da sola */
document.addEventListener('click',e=>{if(e.target&&e.target.id==='btn-settings')setTimeout(installCard,50);},true);

KX.TextSize={get,set,levels:LEVELS.slice()};
})();
