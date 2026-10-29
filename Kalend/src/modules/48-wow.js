/* ══════════════════════════════════════════════════════════════════
   MODULO v55 — «Wow»: la giornata espansa prende vita (vedi 48-wow.css)
   ------------------------------------------------------------------
   1. PIÙ CIELO: in verticale la riga della giornata espansa diventa
      più alta (circa un terzo dello schermo, massimo 330 px) così la
      scena (cielo, meteo, paesaggio) ha spazio per respirare. In
      orizzontale non si interviene: ci pensa 47-landscape.css.
      Si avvolge la funzione storica applyRowH, che calcola l'altezza
      minima necessaria alle barre: qui si alza solo il minimo, mai
      si riduce ciò che serve agli eventi.
   2. ENTRATA SCAGLIONATA delle barre: ogni barra riceve l'indice
      --kx-i e il CSS le fa comparire una dopo l'altra (massimo 12
      scaglioni, poi tutte insieme: nessuna attesa lunga).
   3. INTERRUTTORE: se nelle impostazioni il cielo è «statico» (skyFx
      = off) o il sistema chiede meno movimento, il body riceve la
      classe kx-fx-off e tutte le animazioni nuove si spengono.
   Il modulo non modifica il codice storico: avvolge le funzioni
   globali openWide e applyRowH.
══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const KX=window.KX=window.KX||{};
const MAX_H=330, SHARE=.36;        /* altezza massima e quota di schermo della riga espansa */

/* ── 3. interruttore ── */
const reduced=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){return false;}};
const fxOff=()=>{try{return (AppSettings.skyFx==='off')||reduced();}catch(e){return reduced();}};
function applyFx(){document.body.classList.toggle('kx-fx-off',fxOff());}

/* ── 1. riga espansa più alta in verticale ── */
function wantedH(){
  if(document.body.classList.contains('kx-land'))return 0;   /* orizzontale: regola del CSS */
  return Math.round(Math.min(window.innerHeight*SHARE,MAX_H));
}
function hookRowH(){
  try{
    const o=window.applyRowH;if(typeof o!=='function'||o._kxWow)return;
    const w=function(wIdx){
      const r=o.apply(this,arguments);
      try{
        const row=S.rows[wIdx];
        if(row&&S.wideSets[wIdx]&&S.wideSets[wIdx].size){
          const cur=parseFloat(row.style.height)||0,want=wantedH();
          if(want>cur)row.style.height=want+'px';
        }
      }catch(e){}
      return r;
    };
    w._kxWow=true;window.applyRowH=w;
  }catch(e){}
}

/* ── 2. indice delle barre per l'entrata scaglionata ── */
function stagger(cell){
  try{cell.querySelectorAll('.tl-bar').forEach((b,i)=>b.style.setProperty('--kx-i',String(Math.min(i,12))));}catch(e){}
}
function hookWide(){
  try{
    const o=window.openWide;if(typeof o!=='function'||o._kxWow)return;
    const w=function(wIdx,dIdx){
      const r=o.apply(this,arguments);
      try{const c=S.cells[wIdx]&&S.cells[wIdx][dIdx];if(c)stagger(c);}catch(e){}
      return r;
    };
    w._kxWow=true;window.openWide=w;
  }catch(e){}
}

function init(){
  applyFx();
  hookRowH();hookWide();
  try{matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',applyFx);}catch(e){}
  /* l'impostazione del cielo può cambiare dal menu Impostazioni: si ricontrolla
     alla chiusura dei fogli (evento già usato dall'app) e, per sicurezza, ogni 5 s */
  document.addEventListener('visibilitychange',applyFx);
  setInterval(applyFx,5000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
KX.Wow={applyFx,stagger,wantedH};
})();
