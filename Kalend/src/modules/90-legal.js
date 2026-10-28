/* ══════════════════════════════════════════════════════════════════
   MODULO v55 — "Legale" · termini, privacy, crediti e informative
   ------------------------------------------------------------------
   COSA FA
   1. Pagina «Informazioni legali» (Impostazioni → Aiuto): Termini d'uso,
      Informativa sulla privacy e Crediti nella lingua dell'app, dai testi
      di src/legal/<lingua>.json inseriti dal build in window.KX_LEGAL.
   2. Avviso una tantum dopo un aggiornamento dei testi («Termini e
      privacy aggiornati · Leggi»), non bloccante: Google Play ha già fatto
      accettare i suoi termini all'acquisto.
   3. Informative PRIMA dei permessi sensibili (posizione, microfono,
      calendario del telefono, notifiche): una schermata breve che dice
      cosa serve, a cosa, e cosa esce dal telefono; poi la richiesta di
      sistema. Si mostra una volta per permesso (localStorage
      'kx_disclosed_v1'); «Non ora» annulla senza chiedere al sistema.
      Si aggancia avvolgendo navigator.geolocation.getCurrentPosition e i
      metodi del ponte nativo (speech, speechLive, calPermission,
      notifPermission), così vale per ogni punto dell'app.
   Niente di tutto questo invia dati da nessuna parte.
══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const KX=window.KX=window.KX||{};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lang=()=>{try{const l=L10N.resolvedLang||'en';return (window.KX_LEGAL&&KX_LEGAL[l])?l:'en';}catch(e){return 'en';}};
const texts=()=>(window.KX_LEGAL&&(KX_LEGAL[lang()]||KX_LEGAL.en))||null;
const ui=k=>{const t=texts();return (t&&t.ui&&t.ui[k])||k;};
const isRTL=()=>['ar','he'].includes(lang());

/* ──────────────────────────────────────────────────────────────────
   1. PAGINA «INFORMAZIONI LEGALI»
────────────────────────────────────────────────────────────────── */
function sheet(){
  let el=document.getElementById('kx-legal-sheet');
  if(el)return el;
  el=document.createElement('div');el.id='kx-legal-sheet';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');
  document.body.appendChild(el);
  return el;
}
function creditsHTML(){
  const cr=document.getElementById('kx-credits');
  const lines=cr?[...cr.querySelectorAll('div')].map(d=>d.textContent.trim()).filter(t=>t&&!/^Informazioni e crediti$/i.test(t)):[];
  try{if(KX.Weather&&KX.Weather.attribution())lines.unshift(KX.Weather.attribution());}catch(e){}
  try{if(KX.Geo&&KX.Geo.attribution())lines.unshift(KX.Geo.attribution());}catch(e){}
  return `<ul class="kx-legal-cr">${[...new Set(lines)].map(l=>`<li>${esc(l)}</li>`).join('')}</ul>`;
}
function render(tab){
  const t=texts();if(!t)return;
  const el=sheet();el.dir=isRTL()?'rtl':'ltr';
  const doc=tab==='privacy'?t.privacy:tab==='credits'?null:t.eula;
  const body=doc?doc.sections.map(([h,p])=>`<h3>${esc(h)}</h3><p>${esc(p)}</p>`).join(''):creditsHTML();
  el.innerHTML=`<div class="kx-legal-card">
    <div class="kx-legal-h"><b>⚖️ ${esc(ui('legal'))}</b><button type="button" class="kx-legal-x" aria-label="×">✕</button></div>
    <div class="kx-legal-tabs">${['terms','privacy','credits'].map(k=>`<button type="button" data-tab="${k}" class="${tab===k?'on':''}">${esc(ui(k))}</button>`).join('')}</div>
    <div class="kx-legal-b">${doc?`<h2>${esc(doc.title)}</h2>`:''}${body}</div>
  </div>`;
  el.querySelector('.kx-legal-x').onclick=close;
  el.addEventListener('click',e=>{if(e.target===el)close();});
  el.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>render(b.dataset.tab));
  el.classList.add('open');
}
function open(tab){render(tab||'terms');}
function close(){const el=document.getElementById('kx-legal-sheet');if(el)el.classList.remove('open');}
document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});

/* pulsante nella sezione Aiuto delle impostazioni */
function installButton(){
  const ref=document.getElementById('set-reset-hints');
  if(!ref||document.getElementById('set-legal'))return;
  const wrap=document.createElement('div');wrap.style.marginTop='8px';
  wrap.innerHTML=`<button class="form-input" id="set-legal" style="width:100%;cursor:pointer;text-align:center;font-weight:600">⚖️ ${esc(ui('legal'))}</button>`;
  ref.parentElement.insertAdjacentElement('afterend',wrap);
  wrap.querySelector('button').addEventListener('click',()=>open('terms'));
}

/* ──────────────────────────────────────────────────────────────────
   2. AVVISO UNA TANTUM DOPO L'AGGIORNAMENTO DEI TESTI
────────────────────────────────────────────────────────────────── */
function updateNotice(){
  const t=texts();if(!t)return;
  const ver=(t.privacy.sections.slice(-1)[0]||[])[1]||'';   /* contiene la data di aggiornamento */
  const key='kx_legal_seen_v1';
  let seen='';try{seen=localStorage.getItem(key)||'';}catch(e){}
  if(seen===ver)return;
  const bar=document.createElement('div');bar.id='kx-legal-bar';bar.dir=isRTL()?'rtl':'ltr';
  bar.innerHTML=`<span>⚖️ ${esc(ui('updated'))}</span><button type="button" class="kx-legal-read">${esc(ui('read'))}</button><button type="button" class="kx-legal-ok" aria-label="OK">✓</button>`;
  document.body.appendChild(bar);
  const done=()=>{try{localStorage.setItem(key,ver);}catch(e){}bar.remove();};
  bar.querySelector('.kx-legal-read').onclick=()=>{done();open('terms');};
  bar.querySelector('.kx-legal-ok').onclick=done;
  setTimeout(()=>bar.classList.add('show'),8000);   /* dopo il sipario di apertura */
}

/* ──────────────────────────────────────────────────────────────────
   3. INFORMATIVE PRIMA DEI PERMESSI
────────────────────────────────────────────────────────────────── */
const SEEN_KEY='kx_disclosed_v1';
function seen(){try{return JSON.parse(localStorage.getItem(SEEN_KEY)||'{}')||{};}catch(e){return {};}}
function markSeen(k){try{const s=seen();s[k]=1;localStorage.setItem(SEEN_KEY,JSON.stringify(s));}catch(e){}}
/* risolve true (continua) o false (non ora); se già mostrata, true subito */
/* il sipario di apertura (prima accensione) ha la precedenza: l'informativa
   aspetta che venga chiuso, così non si sovrappone al benvenuto */
function introOpen(){
  const i=document.getElementById('kx-intro');if(!i||!i.isConnected)return false;
  if(i.classList.contains('out'))return false;            /* in dissolvenza: considerato chiuso */
  const cs=getComputedStyle(i);return cs.display!=='none'&&cs.visibility!=='hidden'&&parseFloat(cs.opacity||'1')>0.05;
}
/* al massimo 30 secondi di attesa: poi l'informativa compare comunque */
function whenIntroClosed(){return new Promise(res=>{let n=0;const t=()=>{if(!introOpen()||n++>150)res();else setTimeout(t,200);};t();});}
let queue=Promise.resolve();   /* una informativa alla volta */
function disclose(kind){
  const t=texts();const d=t&&t.disclose&&t.disclose[kind];
  if(!d||seen()[kind])return Promise.resolve(true);
  const run=()=>whenIntroClosed().then(()=>seen()[kind]?true:show(kind,d));
  const p=queue.then(run,run);queue=p.catch(()=>{});return p;
}
function show(kind,d){
  return new Promise(res=>{
    const ov=document.createElement('div');ov.className='kx-disc';ov.dir=isRTL()?'rtl':'ltr';ov.setAttribute('role','alertdialog');ov.setAttribute('aria-modal','true');
    const icon={location:'📍',mic:'🎤',calendar:'📅',notif:'🔔'}[kind]||'ℹ️';
    ov.innerHTML=`<div class="kx-disc-card"><div class="kx-disc-ic">${icon}</div><b>${esc(d[0])}</b><p>${esc(d[1])}</p>
      <div class="kx-disc-b"><button type="button" class="kx-disc-no">${esc(ui('notnow'))}</button><button type="button" class="kx-disc-ok">${esc(ui('continue'))}</button></div></div>`;
    document.body.appendChild(ov);
    ov.querySelector('.kx-disc-ok').onclick=()=>{markSeen(kind);ov.remove();res(true);};
    ov.querySelector('.kx-disc-no').onclick=()=>{ov.remove();res(false);};
  });
}
function hookPermissions(){
  /* posizione: tutte le chiamate dell'app passano da qui */
  try{
    const g=navigator.geolocation;
    if(g&&g.getCurrentPosition&&!g.getCurrentPosition._kx55){
      const orig=g.getCurrentPosition.bind(g);
      const wrapped=function(ok,err,opt){disclose('location').then(go=>{if(go)orig(ok,err,opt);else if(typeof err==='function')err({code:1,message:'declined',PERMISSION_DENIED:1});});};
      wrapped._kx55=true;
      try{Object.defineProperty(g,'getCurrentPosition',{value:wrapped,configurable:true,writable:true});}catch(e){try{g.getCurrentPosition=wrapped;}catch(x){}}
    }
  }catch(e){}
  /* ponte nativo: la richiesta parte solo dopo l'informativa */
  try{
    const N=window.KalendNative;if(!N)return;
    const map={speech:'mic',speechLive:'mic',calPermission:'calendar',notifPermission:'notif'};
    const wrap={};
    Object.keys(map).forEach(m=>{
      if(typeof N[m]!=='function')return;
      const orig=N[m].bind(N);
      wrap[m]=function(id,...a){disclose(map[m]).then(go=>{if(go)orig(id,...a);else{try{window.__knCb&&__knCb(id,false,'declined');}catch(e){}}});};
    });
    if(!Object.keys(wrap).length)return;
    let ok=false;
    try{Object.keys(wrap).forEach(m=>{N[m]=wrap[m];});ok=Object.keys(wrap).every(m=>N[m]===wrap[m]);}catch(e){}
    if(!ok){
      try{window.KalendNative=new Proxy(N,{get(t,prop){if(wrap[prop])return wrap[prop];const v=t[prop];return typeof v==='function'?v.bind(t):v;}});}catch(e){console.warn('[legale] ponte non avvolgibile',e);}
    }
  }catch(e){}
}

KX.Legal={open,close,disclose,texts,lang};
/* gli agganci ai permessi vanno messi SUBITO: l'app chiede la posizione
   già all'avvio, prima che il resto della pagina sia pronto */
try{hookPermissions();}catch(e){}
function boot(){try{installButton();}catch(e){}try{updateNotice();}catch(e){}}
if(document.readyState==='complete')setTimeout(boot,400);else addEventListener('load',()=>setTimeout(boot,400));
})();
