/* ══════════════════════════════════════════════════════════════════
   MODULO v55 — «Guscio»: ordine di sovrapposizione e barre di sistema
   ------------------------------------------------------------------
   1. ORDINE DI SOVRAPPOSIZIONE. Nella pagina convivono decine di pannelli
      (schede dal basso, finestre di conferma, menu, dettaglio del giorno,
      informative, liste, disponibilità…) ognuno con un suo z-index fisso.
      Quando da un pannello se ne apre un secondo con z-index più basso,
      il secondo finisce SOTTO e non si può usare. Qui un osservatore del
      DOM assegna a ogni pannello, nel momento in cui si apre, un z-index
      più alto di tutti i precedenti: l'ultimo aperto sta sempre sopra.
      Lo sfondo scuro delle schede (#main-overlay) resta subito sotto la
      sua scheda.
   2. BARRE DI SISTEMA. Nell'app Android (v55) la pagina sta fra due strisce
      che occupano lo spazio della barra di stato e di quella di navigazione.
      La striscia in basso prende il colore dello sfondo della pagina (tema
      chiaro o scuro): il modulo lo comunica al nativo con setNavColor().
   KX.Stack = { bump(el), top() } per chi volesse portare in cima un elemento.
══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const KX=window.KX=window.KX||{};

/* ── 1. ordine di sovrapposizione ── */
/* [selettore, come capire se è aperto] · '' = visibile secondo gli stili */
const CANDIDATES=[
  ['.bottom-sheet','open'],['#main-overlay','show'],['#day-detail-overlay','open'],['#day-summary-popup','show'],
  ['#ev-popup-overlay',''],['#confirm-dialog','show'],['#dd-date-picker','show'],['#search-overlay','show'],['#search-panel','open'],
  ['#kx-dlg',''],['#kx-tdlg',''],['#kx-menu-ov',''],['#kx-dc-ov',''],['#kx-lists','open'],['#kx-av','open'],['#kx-voice',''],
  ['#kx-alert',''],['#kx-qs',''],['#kx-stack-ov',''],['#kx-dev-ov',''],['#sync-pair-overlay',''],['#kx-legal-sheet',''],
  ['.kx-disc',''],['.kx-pw',''],['#hint-overlay',''],['#onboard-overlay',''],['#kx-mpanel',''],['.kx-conf',''],
  ['#todo-context-menu',''],['#kx-zoom',''],['#kx-undo','show'],['#kx-tip',''],['#toast','show'],['#kx-intro',''],
];
const SEL=CANDIDATES.map(c=>c[0]).join(',');
let Z=60000;                       /* sopra ogni z-index scritto nei fogli di stile (massimo 50000) */
const state=new WeakMap();
function visible(el){
  if(!el||!el.isConnected)return false;
  if(el.hidden)return false;
  const cs=getComputedStyle(el);
  return cs.display!=='none'&&cs.visibility!=='hidden'&&parseFloat(cs.opacity||'1')>0.02;
}
function isOpen(el,how){return how?el.classList.contains(how):visible(el);}
function bump(el){
  Z+=2;
  el.style.setProperty('z-index',String(Z),'important');
  /* lo sfondo scuro delle schede va subito sotto la scheda appena aperta */
  if(el.classList&&el.classList.contains('bottom-sheet')){const ov=document.getElementById('main-overlay');if(ov)ov.style.setProperty('z-index',String(Z-1),'important');}
  return Z;
}
function scan(){
  CANDIDATES.forEach(([sel,how])=>{
    document.querySelectorAll(sel).forEach(el=>{
      const open=isOpen(el,how);const prev=state.get(el)||false;
      if(open&&!prev){
        /* #main-overlay segue sempre la sua scheda: non si "alza" da solo */
        if(el.id!=='main-overlay')bump(el);
      }
      state.set(el,open);
    });
  });
}
let pending=false;
function schedule(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;try{scan();}catch(e){}});}
function watch(){
  try{
    const mo=new MutationObserver(records=>{
      for(const r of records){
        const t=r.target;
        if(r.type==='childList'||(t&&t.nodeType===1&&(t.matches(SEL)||t.closest(SEL)))){schedule();return;}
      }
    });
    mo.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden']});
  }catch(e){}
  schedule();
}

/* ── 2. colore della barra di navigazione (app Android) ── */
function rgbToHex(rgb){
  const m=String(rgb||'').match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if(!m)return null;return '#'+[m[1],m[2],m[3]].map(n=>(+n).toString(16).padStart(2,'0')).join('').toUpperCase();
}
let lastNav='';
function navColor(){
  try{
    const N=window.KalendNative;if(!N||typeof N.setNavColor!=='function')return;
    const hex=rgbToHex(getComputedStyle(document.body).backgroundColor)||(document.documentElement.dataset.theme==='dark'?'#0E1424':'#F5F0EB');
    if(hex===lastNav)return;lastNav=hex;N.setNavColor(hex);
  }catch(e){}
}
function watchTheme(){
  try{new MutationObserver(()=>setTimeout(navColor,80)).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','class']});}catch(e){}
  setTimeout(navColor,600);setTimeout(navColor,3000);
}

/* gli avvisi brevi (toast) possono susseguirsi mentre il precedente è ancora visibile:
   ogni chiamata li riporta in cima */
function hookToast(){
  try{const t0=window.toast;if(typeof t0!=='function'||t0._kxStack)return;
    const w=function(){const r=t0.apply(this,arguments);try{const el=document.getElementById('toast');if(el)bump(el);}catch(e){}return r;};
    w._kxStack=true;window.toast=w;}catch(e){}
}
/* ── 3. orizzontale: altezza di intestazione + riga dei giorni, per la vista d'insieme (47-landscape.css) ── */
function chrome(){
  try{
    const h=document.getElementById('header'),d=document.getElementById('dh-wrap'),sub=document.getElementById('header-sub-row');
    let px=0;[h,sub,d].forEach(el=>{if(el&&el.offsetParent!==null)px+=el.getBoundingClientRect().height;});
    px=Math.round(px);if(px>0)document.documentElement.style.setProperty('--kx-chrome',px+'px');
  }catch(e){}
}
function watchChrome(){
  let t=0;const go=()=>{clearTimeout(t);t=setTimeout(chrome,120);};
  addEventListener('resize',go);addEventListener('orientationchange',go);
  try{matchMedia('(orientation: landscape)').addEventListener('change',go);}catch(e){}
  try{const h=document.getElementById('header');if(h)new ResizeObserver(go).observe(h);}catch(e){}
  setTimeout(chrome,300);setTimeout(chrome,1500);
}
function init(){watch();watchTheme();hookToast();watchChrome();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();

KX.Stack={bump,top:()=>Z,scan,chrome};
})();
