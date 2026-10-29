/* ══════════════════════════════════════════════════════════════════
   MODULO v54 — "Bussola 2" · le cose frequenti a portata di tocco
   ------------------------------------------------------------------
   1. POPUP DELL'EVENTO: oltre a Modifica · Catena · Condividi · Elimina
      (e la lista collegata, già presente) compare «🟢 Libero»: apre la
      Disponibilità di quella giornata, per rispondere subito a «quando
      sei libero?» senza cambiare vista.
   2. RIEPILOGO GIORNATA (un tocco sul giorno): una riga di azioni
      «🟢 Libero · ☑ Liste · 🎤 Detta»: disponibilità della giornata,
      liste di cose, dettatura di un nuovo evento già datato.
   3. MENU ⋯: voce «Disponibilità» nel gruppo Organizza e «Calendario
      secondario» in Vista e atmosfera, così le funzioni si raggiungono
      anche da lì.
   4. SUGGERIMENTI AL MOMENTO GIUSTO: i suggerimenti contestuali (le
      schede 💡 e i piccoli consigli) non compaiono mai sopra un pannello
      aperto, mai nei primi secondi dopo l'avvio, mai più di uno ogni
      45 secondi: vengono messi in coda e mostrati quando l'utente è
      "fermo" sulla vista giusta. Due suggerimenti nuovi: Disponibilità
      e Calendario secondario.
   Niente del codice precedente viene rimosso.
══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const KX=window.KX=window.KX||{};
const $id=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tr=(s,p)=>{try{return typeof T==='function'?T(s,p):s;}catch(e){return s;}};
const COVER=['.bottom-sheet.open','#kx-menu-ov','#kx-dlg','#kx-voice','#kx-alert','#ev-popup-overlay[style*="block"]','#day-detail-overlay.open:not(.inline-mode)','#kx-stack-ov','#kx-dev-ov','#hint-overlay','#onboard-overlay','#sync-pair-overlay','#year-view.show','#search-panel.open','#search-overlay.show','#kx-intro','#kx-qs','#confirm-dialog.show','#kx-av.open','#kx-lists.open'];
const busy=()=>COVER.some(sel=>{try{return !!document.querySelector(sel);}catch(e){return false;}});
const T0=Date.now();

/* ══ 1. popup dell'evento: «Libero» ══ */
function popupButton(key){
  const del=$id('evp-delete');if(!del||!key)return;
  let b=$id('evp-avail');
  if(!b){b=document.createElement('button');b.id='evp-avail';b.type='button';del.parentElement.insertBefore(b,del);}
  b.textContent='🟢 '+tr('Libero');b.title=tr('Disponibilità della giornata');
  b.onclick=()=>{try{const ov=$id('ev-popup-overlay');if(ov)ov.style.display='none';}catch(e){}openAvail([key]);};
}
function hookPopup(){
  if(typeof openEvPopup!=='function'||openEvPopup._v54ux)return;
  const _o=openEvPopup;
  openEvPopup=function(ev,key){const r=_o.apply(this,arguments);try{popupButton(key);}catch(e){}return r;};
  openEvPopup._v54ux=true;
}

/* ══ 2. riepilogo giornata: riga di azioni ══ */
function openAvail(keys){
  if(KX.openAvailability){KX.openAvailability(keys);try{HINTS.show('availability');}catch(e){}}
  else{try{toast(tr('Disponibilità non disponibile'));}catch(e){}}
}
function summaryActions(key){
  const box=$id('day-summary-box');const add=$id('ds-add');if(!box||!add)return;
  box.querySelector('.kx-ds-acts')?.remove();
  const row=document.createElement('div');row.className='kx-ds-acts';
  row.innerHTML=`<button class="free" data-a="free">🟢 ${esc(tr('Libero'))}</button><button data-a="lists">☑ ${esc(tr('Liste'))}</button><button data-a="voice">🎤 ${esc(tr('Detta'))}</button>`;
  add.insertAdjacentElement('beforebegin',row);
  const closeDs=()=>{try{$id('ds-close')?.click();}catch(e){}};
  row.querySelector('[data-a=free]').onclick=()=>{closeDs();setTimeout(()=>openAvail([key]),120);};
  row.querySelector('[data-a=lists]').onclick=()=>{closeDs();setTimeout(()=>{if(KX.openLists)KX.openLists();else $id('btn-todo')?.click();},120);};
  row.querySelector('[data-a=voice]').onclick=()=>{closeDs();setTimeout(()=>{
    try{window.__dsKey=key;}catch(e){}
    if(KX.voice&&KX.voice.open)KX.voice.open();else{try{$id('ds-add')?.click();}catch(e){}}
  },120);};
}
function hookSummary(){
  if(typeof openDaySummary!=='function'||openDaySummary._v54ux)return;
  const _o=openDaySummary;
  openDaySummary=function(key){const r=_o.apply(this,arguments);try{summaryActions(key);}catch(e){}return r;};
  openDaySummary._v54ux=true;
}

/* ══ 3. menu ⋯ ══ */
function menuRow(ic,lbl,sub,onclick){
  const b=document.createElement('button');b.className='kx-mrow kx-v54';
  b.innerHTML=`<span>${ic}</span><div><b>${esc(tr(lbl))}</b>${sub?`<small>${esc(tr(sub))}</small>`:''}</div>`;
  b.onclick=()=>{try{const ov=$id('kx-menu-ov');if(ov){ov.classList.remove('open');setTimeout(()=>ov.remove(),260);}}catch(e){}setTimeout(onclick,180);};
  return b;
}
function hookMenu(){
  if(typeof openMenu!=='function'||openMenu._v54ux)return;
  const _o=openMenu;
  openMenu=function(){const r=_o.apply(this,arguments);try{
    const ov=$id('kx-menu-ov');if(!ov)return r;
    const groups=[...ov.querySelectorAll('details.kx-grp')];
    const org=groups[0],view=groups[2];
    if(org&&!org.querySelector('[data-v54=avail]')){const b=menuRow('🟢','Disponibilità','Quando sei libero: giornate selezionate o prossimi giorni',()=>{let keys=[];try{keys=getSelectedKeys();}catch(e){}openAvail(keys);});b.dataset.v54='avail';
      const first=org.querySelector('.kx-mrow');org.insertBefore(b,first||null);}
    if(view&&!view.querySelector('[data-v54=altcal]')){const b=menuRow('🗓','Calendario secondario','Islamico, ebraico, cinese, persiano, buddhista…',()=>{if(KX.openSettingsAt)KX.openSettingsAt('#set-altcal');else $id('btn-settings')?.click();});b.dataset.v54='altcal';view.appendChild(b);}
  }catch(e){}return r;};
  openMenu._v54ux=true;
}

/* ══ 4. suggerimenti al momento giusto ══ */
const QUEUE=[];let timer=0,lastShown=0;
const GAP=45000,START_DELAY=6000;
function pump(){
  clearTimeout(timer);
  if(!QUEUE.length)return;
  const now=Date.now();
  const wait=Math.max(0,START_DELAY-(now-T0),GAP-(now-lastShown));
  if(wait>0||busy()){timer=setTimeout(pump,Math.max(800,wait||1500));return;}
  const job=QUEUE.shift();lastShown=Date.now();
  try{job();}catch(e){}
  if(QUEUE.length)timer=setTimeout(pump,GAP);
}
function enqueue(fn){QUEUE.push(fn);pump();}
function hookHints(){
  if(typeof HINTS!=='object'||HINTS._v54ux)return;
  /* nuovi suggerimenti */
  HINTS.DEFS.availability={i:'🟢',t:'Disponibilità',b:'Le fasce libere delle giornate scelte, fianco a fianco. «Condividi» prepara il messaggio per chi ti ha chiesto un appuntamento; tocca una fascia per creare lì un evento.'};
  HINTS.DEFS.altcal={i:'🗓',t:'Calendario secondario',b:'Il numero piccolo in alto a destra di ogni giorno è la data nel calendario della tua regione (islamico, ebraico, lunare…). Si cambia in Impostazioni → Lingua e paese.'};
  const _show=HINTS.show.bind(HINTS);
  HINTS.show=function(key){
    if(this.state.off||this.state.seen[key]||!this.DEFS[key])return;
    /* la scheda compare solo quando la vista è "ferma": niente pannelli sopra, non subito all'avvio */
    enqueue(()=>{if(this.state.seen[key])return;_show(key);});
  };
  if(KX.tip&&!KX.tip._v54ux){const _tip=KX.tip;KX.tip=function(k){enqueue(()=>_tip(k));};KX.tip._v54ux=true;}
  HINTS._v54ux=true;
}
/* il suggerimento sul calendario secondario arriva la prima volta che ne compare uno */
function altcalHint(){
  try{if(KX.AltDate&&KX.AltDate.chosen()&&document.querySelector('.day-cell .kx-alt'))HINTS.show('altcal');}catch(e){}
}

/* ══ 5. localizzazione tardiva ══
   Alcuni pannelli (sincronizzazione QR, To Do, schede costruite dai moduli)
   nascono DOPO la traduzione del markup statico, con testi italiani fissi.
   Qui si traducono i testi dei soli elementi di interfaccia (pulsanti,
   etichette, titoli, didascalie), mai il contenuto dell'utente (titoli di
   eventi o attività), e solo se il dizionario ha davvero una traduzione. */
const UI_SEL='button,label,summary,legend,option,h1,h2,h3,h4,h5,small,.sync-pair-title,.sync-pair-status,.sync-section-label,#sync-pair-overlay p,#sync-pair-overlay textarea,.todo-card-title,.todo-badge-pill,.todo-empty,.sheet-title,.form-label,.set-caption,.todo-hint,.todo-section-title,.kx-note,.kx-h,.ds-stat-label,.ds-section,.set-section-h,.kx-page-h b,.mode-btn,.seg-btn,.view-mode-opt span,.kx-chip,.kx-nav-row b,.kx-nav-row small,.sdr-t,.sdr-d,.kx-q-act button,[data-kx-ui]';
const NO_SEL='.tl-bar,.ev-title,#evp-title,.todo-task-title,.todo-task-text,.kx-ls-row,.ev-compact,.day-cell,input,textarea,.kx-tf-tag,.ftag-chip,.chain-chip,.participant-chip,.tag-chip';
const done=new WeakSet();
function lateLocalize(root){
  if(typeof L10N==='undefined'||L10N.resolvedLang==='it')return;
  let n=0;
  (root||document).querySelectorAll(UI_SEL).forEach(el=>{
    if(done.has(el)||el.closest(NO_SEL))return;done.add(el);
    el.childNodes.forEach(node=>{
      if(node.nodeType!==3)return;const raw=node.nodeValue||'';const t=raw.trim();if(t.length<2)return;
      const tr=L10N.T(t);if(tr===t)return;node.nodeValue=raw.replace(t,tr);n++;
    });
    ['title','aria-label','placeholder'].forEach(a=>{const v=el.getAttribute&&el.getAttribute(a);if(!v)return;const tr=L10N.T(v.trim());if(tr!==v.trim())el.setAttribute(a,tr);});
  });
  return n;
}
let llT=0;
function installLateLocalize(){
  if(typeof L10N==='undefined'||L10N.resolvedLang==='it')return;
  lateLocalize();
  new MutationObserver(()=>{clearTimeout(llT);llT=setTimeout(()=>lateLocalize(),200);}).observe(document.body,{childList:true,subtree:true});
}
KX.lateLocalize=lateLocalize;

function start(){
  try{installLateLocalize();}catch(e){console.error('[v54 late l10n]',e);}
  try{hookHints();}catch(e){console.error('[v54 ux hints]',e);}
  try{hookPopup();}catch(e){console.error('[v54 ux popup]',e);}
  try{hookSummary();}catch(e){console.error('[v54 ux summary]',e);}
  try{hookMenu();}catch(e){console.error('[v54 ux menu]',e);}
  setTimeout(altcalHint,12000);
}
if(document.readyState==='complete')setTimeout(start,400);else addEventListener('load',()=>setTimeout(start,400));
/* alcuni moduli storici riassegnano le stesse funzioni poco dopo l'avvio: si riaggancia */
setTimeout(()=>{try{hookPopup();hookSummary();hookMenu();}catch(e){}},2500);
KX.UX={enqueueTip:enqueue,busy};
KX.openAvail=openAvail;   /* v55: usata dalla riga delle azioni del giorno (49-views.js) */
})();
