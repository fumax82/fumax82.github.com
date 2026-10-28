/* ══════════════════════════════════════════════════════════════════
   MODULO v54 — "Finestra" · widget più utile
   ------------------------------------------------------------------
   Il widget Android (parte nativa dell'APK) riceve dall'app un pacchetto
   JSON con le righe dell'agenda. La parte nativa non cambia: questo
   modulo arricchisce ciò che le viene mandato.

   1. FASCE LIBERE: per i prossimi giorni, tra gli impegni compaiono righe
      verdi «🟢 Libero 9:30–12:00 · 2h30» (le più lunghe, fino a due al
      giorno). Così dal widget si vede a colpo d'occhio quando si è
      liberi, senza aprire l'app. Si disattiva in Impostazioni →
      Funzionalità («Fasce libere nel widget»).
   2. RIEPILOGO DEL GIORNO: la prima riga di ogni giornata con impegni
      riassume «3 impegni · 4h liberi» (attivabile a parte).
   3. Tutte le parole del widget passano dal dizionario della lingua
      (già previsto); qui si aggiungono le etichette nuove.

   Tecnica: il ponte nativo KalendNative.updateWidget viene avvolto da
   una funzione che legge il JSON, aggiunge le righe e lo passa oltre.
   Chiavi delle righe: k = giorno, s/e = minuti inizio/fine, t = testo,
   c = colore, h = 1 per le festività (0 altrimenti).
══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const KX=window.KX=window.KX||{};
const tr=(s,p)=>{try{return typeof T==='function'?T(s,p):s;}catch(e){return s;}};

/* ── CONFIGURAZIONE (modificabile) ── */
const GIORNI=7;          /* giornate in cui cercare fasce libere          */
const INIZIO=8*60;       /* finestra utile: dalle 8:00…                    */
const FINE=21*60;        /* …alle 21:00                                    */
const MIN_FASCIA=60;     /* fasce più corte di un'ora non si mostrano      */
const MAX_PER_GIORNO=2;  /* al massimo due fasce per giornata              */
const COLORE_LIBERO='#3E9E78';
const COLORE_RIEPILOGO='#5B6475';

const pad2=n=>String(n).padStart(2,'0');
const hm=m=>{m=Math.max(0,Math.round(m));let h=Math.floor(m/60)%24,mi=m%60;
  try{if(L10N.hour12){const ap=h>=12?'pm':'am';h=h%12||12;return h+(mi?':'+pad2(mi):'')+ap;}}catch(e){}
  return pad2(h)+':'+pad2(mi);};
const dur=m=>{const h=Math.floor(m/60),r=m%60;return h?(r?h+'h'+pad2(r):h+'h'):r+'′';};
const keyOf=d=>`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const on=k=>{try{return AppSettings[k]!==false;}catch(e){return true;}};

/* impegni con orario di una giornata (eventi del calendario + liste con orario) */
function busyOf(k){
  let evs=[];try{evs=getEventsForKey(k)||[];}catch(e){try{evs=(S.events[k]||[]);}catch(x){}}
  return evs.filter(ev=>ev&&!ev._notime&&!ev._allday&&ev.durationMin>0&&ev.durationMin<1440&&ev.startMin!=null)
    .map(ev=>[ev.startMin,ev.startMin+ev.durationMin]).sort((a,b)=>a[0]-b[0]);
}
/* fasce libere ≥ MIN_FASCIA nella finestra utile, le più lunghe prima */
function freeOf(k,fromMin){
  const busy=busyOf(k);const out=[];let cur=Math.max(INIZIO,fromMin||0);
  busy.forEach(([s,e])=>{if(s>cur&&s-cur>=MIN_FASCIA)out.push([cur,Math.min(s,FINE)]);cur=Math.max(cur,e);});
  if(FINE-cur>=MIN_FASCIA)out.push([cur,FINE]);
  return out.filter(([a,b])=>b-a>=MIN_FASCIA).sort((a,b)=>(b[1]-b[0])-(a[1]-a[0])).slice(0,MAX_PER_GIORNO).sort((a,b)=>a[0]-b[0]);
}
/* righe da aggiungere */
function extraRows(){
  const rows=[];const now=new Date();const nowM=now.getHours()*60+now.getMinutes();
  for(let i=0;i<GIORNI;i++){
    const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()+i);const k=keyOf(d);
    const busy=busyOf(k);
    if(on('widgetFree')){
      freeOf(k,i===0?Math.ceil(nowM/15)*15:0).forEach(([a,b])=>rows.push({k,s:a,e:b,t:'🟢 '+tr('Libero')+' · '+dur(b-a),c:COLORE_LIBERO,h:0,free:1}));
    }
    if(on('widgetSummary')&&busy.length){
      const busyMin=busy.reduce((s,[a,b])=>s+(b-a),0);const free=Math.max(0,(FINE-INIZIO)-busyMin);
      rows.push({k,s:-1,e:-1,t:'▦ '+tr('{n} impegni',{n:busy.length})+' · '+tr('{h} liberi',{h:dur(free)}),c:COLORE_RIEPILOGO,h:0,sum:1});
    }
  }
  return rows;
}
/* unisce le righe nuove a quelle dell'app mantenendo l'ordine per giorno e ora */
function merge(items,extra){
  const all=(items||[]).concat(extra);
  const rank=r=>r.h?0:r.sum?1:r.s<0?2:3;
  return all.sort((a,b)=>a.k<b.k?-1:a.k>b.k?1:(rank(a)-rank(b))||((a.s<0?-1:a.s)-(b.s<0?-1:b.s)));
}
function enrich(json){
  let p;try{p=JSON.parse(json);}catch(e){return json;}
  if(!p||typeof p!=='object')return json;
  try{
    if(on('widgetFree')||on('widgetSummary'))p.items=merge(p.items,extraRows());
    p.s=p.s||{};p.s.free=tr('Libero');p.s.busy=tr('Occupato');
    p.v54=1;
  }catch(e){console.warn('[v54 widget]',e);return json;}
  return JSON.stringify(p);
}

/* ── aggancio al ponte nativo ── */
function hook(){
  const N=window.KalendNative;if(!N||typeof N.updateWidget!=='function'||N.__kx54)return;
  const orig=N.updateWidget.bind(N);
  try{
    /* su alcuni ponti nativi le proprietà non si riassegnano: si prova, poi si ripiega su un Proxy */
    N.updateWidget=function(j){return orig(enrich(j));};
    if(N.updateWidget.toString().indexOf('enrich')<0)throw new Error('ponte in sola lettura');
    N.__kx54=1;
  }catch(e){
    try{
      const proxy=new Proxy(N,{get(t,prop){if(prop==='updateWidget')return j=>orig(enrich(j));if(prop==='__kx54')return 1;const v=t[prop];return typeof v==='function'?v.bind(t):v;}});
      window.KalendNative=proxy;
    }catch(x){console.warn('[v54 widget] ponte non avvolgibile',x);}
  }
}

/* ── impostazioni: due interruttori nella sezione Funzionalità ── */
function installSettings(){
  const ref=document.getElementById('set-feat-fullscreen');if(!ref||document.getElementById('set-widget-free'))return;
  const host=ref.closest('.toggle-wrap')?ref.closest('.toggle-wrap').parentElement:ref.parentElement;
  const mk=(id,key,label,caption)=>{
    const w=document.createElement('div');w.className='toggle-wrap';
    w.innerHTML=`<div class="toggle-sw${on(key)?' on':''}" id="${id}" role="switch" aria-checked="${on(key)}"></div><span class="toggle-label">${label}<small style="display:block;font-size:9px;color:var(--text-dim);font-family:var(--font-mono)">${caption}</small></span>`;
    host.appendChild(w);
    const sw=w.querySelector('.toggle-sw');
    sw.addEventListener('click',()=>{const v=!sw.classList.contains('on');sw.classList.toggle('on',v);sw.setAttribute('aria-checked',String(v));
      try{AppSettings[key]=v;AppSettings.save();}catch(e){}try{KX.Widget&&KX.Widget.push&&KX.Widget.push();}catch(e){}});
  };
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  mk('set-widget-free','widgetFree','🟢 '+esc(tr('Fasce libere nel widget')),esc(tr('Le ore libere dei prossimi giorni tra gli impegni')));
  mk('set-widget-summary','widgetSummary','▦ '+esc(tr('Riepilogo del giorno nel widget')),esc(tr('Impegni e ore libere in una riga per ogni giornata')));
}
/* valori predefiniti: fasce libere sì, riepilogo no (meno righe) */
try{if(typeof AppSettings!=='undefined'){if(AppSettings.widgetFree===undefined)AppSettings.widgetFree=true;if(AppSettings.widgetSummary===undefined)AppSettings.widgetSummary=false;}}catch(e){}

KX.WidgetPlus={freeOf,extraRows,enrich};
function start(){hook();try{installSettings();}catch(e){console.error('[v54 widget set]',e);}try{KX.Widget&&KX.Widget.push&&KX.Widget.push();}catch(e){}}
if(document.readyState==='complete')setTimeout(start,200);else addEventListener('load',()=>setTimeout(start,200));
})();
