/* ══════════════════════════════════════════════════════════════════
   MODULO v55 — «Calendari nella giornata»
   ------------------------------------------------------------------
   Quando si apre una giornata, gli eventi arrivano da più calendari:
     · i MIEI eventi (creati in Kalend),
     · i calendari COLLEGATI (link iCal: Google, Outlook, iCloud…),
     · i calendari del TELEFONO (Google, Samsung, Exchange… già sul dispositivo),
     · le attività TO DO con scadenza.
   Questo modulo aggiunge, nel dettaglio del giorno:
   1. una BARRA DEI CALENDARI: un «chip» per ogni calendario presente in
      quel giorno, con colore, nome e numero di eventi. Un tocco lo
      nasconde/mostra nella giornata; una pressione lunga (o il tasto ⋯)
      apre la scheda di personalizzazione;
   2. una SCHEDA PER CALENDARIO con: nome mostrato, colore, icona davanti
      al titolo, quali dettagli mostrare (luogo, descrizione, tag), barre
      compatte, promemoria per gli eventi di quel calendario (che di suo
      non ne avrebbero: si modificano nel calendario d'origine), nascondi;
   3. un piccolo contrassegno di provenienza sulle barre (🔗 collegato,
      📱 telefono, ☑ To Do).
   Tutto è salvato sul dispositivo (localStorage «kx_calprefs_v1»), entra
   nel backup completo e non modifica mai il calendario d'origine.
   Collegamento alla pagina: il modulo avvolge la funzione globale
   openDayDetail(chiave, eventi) e lavora PRIMA (filtro degli eventi
   nascosti, colori e promemoria) e DOPO (barra e contrassegni sul DOM).
   KX.CalPrefs = { get, set, reset, sources, sourceOf, open, apply }.
══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const KX=window.KX=window.KX||{};
const KEY='kx_calprefs_v1';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tr=(s,p)=>{try{return typeof T==='function'?T(s,p):s;}catch(e){return s;}};
const $id=id=>document.getElementById(id);
const ICONS=['','📌','⭐','💼','👨‍👩‍👧','🏋️','🎓','🏥','✈️','🎵','🛒','🎂','⚽','🍽️','🐾'];
const REMIND=[['',()=>tr('Nessun promemoria')],['0',()=>tr("all'ora dell'evento")],['5',()=>tr('{n} min prima',{n:5})],['15',()=>tr('{n} min prima',{n:15})],['30',()=>tr('{n} min prima',{n:30})],['60',()=>tr('{n} h prima',{n:1})],['1440',()=>tr('1 giorno prima')]];
const DEF={hidden:false,color:'',label:'',icon:'',loc:true,desc:true,tags:true,compact:false,remind:''};

/* ── memoria ── */
let cache=null;
function all(){if(cache)return cache;try{cache=JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(e){cache={};}return cache;}
function save(){try{localStorage.setItem(KEY,JSON.stringify(all()));}catch(e){}}
function get(src){return Object.assign({},DEF,all()[src]||{});}
function isCustom(src){const p=all()[src];return !!p&&Object.keys(p).some(k=>p[k]!==DEF[k]);}
function set(src,patch){const p=Object.assign({},all()[src]||{},patch);Object.keys(p).forEach(k=>{if(p[k]===DEF[k])delete p[k];});if(Object.keys(p).length)all()[src]=p;else delete all()[src];save();}
function reset(src){delete all()[src];save();}

/* ── da quale calendario viene un evento ── */
function sourceOf(ev){
  if(!ev)return 'own';
  if(ev._source==='todo')return 'todo';
  if(ev._sub==='device')return 'dev:'+(ev._devCal||'');
  if(ev._sub)return 'sub:'+ev._sub;
  return 'own';
}
function subById(id){try{const L=(KX.SUBS&&KX.SUBS.list)||[];return L.find(s=>s.id===id)||null;}catch(e){return null;}}
/* descrizione del calendario: etichetta, colore di base, icona, tipo */
function info(src,sample){
  const p=get(src);
  if(src==='own')return{src,kind:'own',label:p.label||tr('I miei eventi'),color:p.color||(typeof AppSettings!=='undefined'&&AppSettings.accent)||'#2AABB8',icon:'🗓',mark:''};
  if(src==='todo')return{src,kind:'todo',label:p.label||'To Do',color:p.color||(sample&&sample.color)||'#4A8030',icon:'☑',mark:'☑'};
  if(src.startsWith('dev:')){const n=src.slice(4);return{src,kind:'dev',label:p.label||n||tr('Calendario del telefono'),color:p.color||(sample&&sample.color)||'#4A8030',icon:'📱',mark:'📱'};}
  const s=subById(src.slice(4));
  return{src,kind:'sub',label:p.label||(s&&(s.name||s.mask))||tr('Calendario collegato'),color:p.color||(s&&s.color)||(sample&&sample.color)||'#3870B8',icon:s&&s.vault?'🔒':'🔗',mark:'🔗'};
}
/* calendari presenti in un elenco di eventi (ordine: miei, collegati, telefono, To Do) */
function sources(events){
  const m=new Map();
  (events||[]).forEach(ev=>{const k=sourceOf(ev);const e=m.get(k)||{src:k,n:0,sample:ev};e.n++;m.set(k,e);});
  const rank=k=>k==='own'?0:k.startsWith('sub:')?1:k.startsWith('dev:')?2:3;
  return [...m.values()].sort((a,b)=>rank(a.src)-rank(b.src)||a.src.localeCompare(b.src)).map(e=>Object.assign(e,info(e.src,e.sample)));
}

/* ── colori e promemoria applicati agli eventi (in memoria: la riapertura
   del giorno e il salvataggio li portano con sé; il calendario d'origine
   non cambia) ── */
function apply(events){
  let changed=false;
  (events||[]).forEach(ev=>{
    const src=sourceOf(ev);if(src==='own'||src==='todo')return;
    const p=get(src);
    if(p.color&&ev.color!==p.color){ev.color=p.color;changed=true;}
    if(p.remind!==''){const v=+p.remind;if(ev.reminder!==v||!ev._calRem){ev.reminder=v;ev.reminderType=ev.reminderType||'notification';ev._calRem=1;changed=true;}}
    else if(ev._calRem){delete ev.reminder;delete ev._calRem;changed=true;}
  });
  return changed;
}
function applyAll(){
  let changed=false;
  try{Object.values(S.events||{}).forEach(list=>{if(apply(list))changed=true;});}catch(e){}
  if(changed){try{EventsStore.scheduleSave();}catch(e){}try{ReminderEngine.scheduleRescan();}catch(e){}}
  return changed;
}

/* ── aggancio: openDayDetail(chiave, eventi) ── */
let last=null;
function hook(){
  const orig=window.openDayDetail;
  if(typeof orig!=='function'||orig._kxDC)return;
  const wrapped=function(key,events){
    const list=Array.isArray(events)?events:[];
    last={key,events:list};
    try{if(apply(list)){try{EventsStore.scheduleSave();}catch(e){}try{ReminderEngine.scheduleRescan();}catch(e){}}}catch(e){}
    const visible=list.filter(ev=>!get(sourceOf(ev)).hidden);
    const r=orig.call(this,key,visible);
    try{decorate(key,list);}catch(e){console.warn('[daycal]',e);}
    return r;
  };
  wrapped._kxDC=true;window.openDayDetail=wrapped;
}
function reopen(){if(last)window.openDayDetail(last.key,last.events);}

/* barra dei calendari + contrassegni e dettagli sulle barre */
function decorate(key,list){
  const panel=$id('day-detail-panel'),body=$id('dd-body');if(!panel||!body)return;
  let bar=$id('kx-dc-bar');
  const srcs=sources(list);
  const hiddenN=list.filter(ev=>get(sourceOf(ev)).hidden).length;
  const show=srcs.length>1||hiddenN>0||srcs.some(s=>isCustom(s.src));
  if(!show){if(bar)bar.remove();}
  else{
    if(!bar){bar=document.createElement('div');bar.id='kx-dc-bar';bar.setAttribute('role','toolbar');bar.setAttribute('aria-label',tr('Calendari nella giornata'));body.parentElement.insertBefore(bar,body);}
    bar.innerHTML='';
    srcs.forEach(s=>{
      const p=get(s.src);
      const b=document.createElement('button');b.type='button';b.className='kx-dc-chip'+(p.hidden?' off':'')+(isCustom(s.src)?' custom':'');
      b.title=tr('Tocca per nascondere o mostrare · tieni premuto per personalizzare');
      b.innerHTML=`<span class="kx-dc-dot" style="background:${esc(s.color)}"></span><span>${esc((p.icon?p.icon+' ':'')+s.label)}</span><span class="kx-dc-n">${s.n}</span>`;
      let lp=null,held=false;
      const press=()=>{held=false;lp=setTimeout(()=>{held=true;lp=null;try{haptic&&haptic(15);}catch(e){}open(s.src);},480);};
      const release=()=>{if(lp){clearTimeout(lp);lp=null;}};
      b.addEventListener('pointerdown',press);b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('pointerleave',release);
      b.addEventListener('contextmenu',e=>{e.preventDefault();});
      b.addEventListener('click',()=>{if(held){held=false;return;}set(s.src,{hidden:!get(s.src).hidden});reopen();});
      bar.appendChild(b);
    });
    const more=document.createElement('button');more.type='button';more.className='kx-dc-more';more.textContent='⋯';more.title=tr('Personalizza calendario');
    more.onclick=()=>{if(srcs.length===1)open(srcs[0].src);else pickSource(srcs);};
    bar.appendChild(more);
  }
  /* barre degli eventi: contrassegno, icona, dettagli, compattezza */
  const tl=body.querySelector('.dd-timeline');const toY=tl&&tl.__kxToY;
  body.querySelectorAll('.dd-ev-bar').forEach(el=>{
    const ev=el._evData&&el._evData.ev;if(!ev)return;
    const src=sourceOf(ev),p=get(src),inf=info(src,ev);
    const t=el.querySelector('.dd-ev-title');
    if(t&&p.icon&&!t.dataset.kxIcon){t.dataset.kxIcon='1';t.textContent=p.icon+' '+t.textContent;}
    if(inf.mark&&!el.querySelector('.kx-dc-src')){const m=document.createElement('span');m.className='kx-dc-src';m.textContent=inf.mark;m.title=inf.label;el.appendChild(m);}
    if(!p.loc)el.querySelectorAll('.dd-ev-loc').forEach(x=>x.style.display='none');
    if(!p.desc)el.querySelectorAll('.dd-ev-desc').forEach(x=>x.style.display='none');
    if(!p.tags)el.querySelectorAll('.dd-ev-tags').forEach(x=>x.style.display='none');
    if(p.compact&&toY&&ev.durationMin>0){
      const s=ev.durationMin>=1440?0:ev.startMin,e=ev.durationMin>=1440?1440:ev.startMin+ev.durationMin;
      const real=Math.max(34,toY(e)-toY(s));el.classList.add('kx-dc-compact');el.style.height=real+'px';
    }
  });
}
function pickSource(srcs){
  const dlg=KX.dialog;if(typeof dlg!=='function'){open(srcs[0].src);return;}
  dlg(tr('Personalizza calendario'),'',srcs.map(s=>({t:s.icon+' '+s.label,v:s.src})).concat([{t:tr('Annulla'),v:null}])).then(v=>{if(v)open(v);});
}

/* ── scheda di personalizzazione ── */
function open(src){
  $id('kx-dc-ov')?.remove();
  const sample=(last&&last.events||[]).find(ev=>sourceOf(ev)===src);
  const inf=info(src,sample);const p=get(src);const linked=inf.kind==='sub'||inf.kind==='dev';
  const ov=document.createElement('div');ov.id='kx-dc-ov';
  const sw=(id,on,label)=>`<div class="kx-dc-row"><span>${esc(label)}</span><button type="button" class="kx-dc-sw${on?' on':''}" data-k="${id}" role="switch" aria-checked="${on}"></button></div>`;
  ov.innerHTML=`<div id="kx-dc-sheet" role="dialog" aria-modal="true" aria-label="${esc(tr('Personalizza calendario'))}">
    <div class="kx-dc-h"><span style="font-size:22px">${inf.icon}</span><div style="flex:1;min-width:0"><b>${esc(inf.label)}</b><small>${esc(inf.kind==='own'?tr('I miei eventi'):inf.kind==='todo'?'To Do':inf.kind==='dev'?tr('Calendario del telefono'):tr('Calendario collegato'))}</small></div><button type="button" class="kx-dc-x" aria-label="${esc(tr('Chiudi'))}">✕</button></div>
    ${linked?`<div class="kx-dc-row"><span>${esc(tr('Nome mostrato'))}</span><input type="text" class="form-input" data-k="label" maxlength="40" value="${esc(p.label)}" placeholder="${esc(inf.label)}"></div>`:''}
    ${linked?`<div class="kx-dc-row"><span>${esc(tr('Colore'))}</span><input type="color" data-k="color" value="${esc(p.color||inf.color)}"></div>`:''}
    <div class="kx-dc-row" style="flex-wrap:wrap"><span style="flex-basis:100%">${esc(tr('Icona davanti al titolo'))}</span><div class="kx-dc-icons">${ICONS.map(ic=>`<button type="button" class="kx-dc-ic${p.icon===ic?' on':''}" data-ic="${esc(ic)}" aria-label="${esc(ic||tr('Nessuna'))}">${ic||'—'}</button>`).join('')}</div></div>
    ${sw('loc',p.loc,tr('Mostra luogo'))}${sw('desc',p.desc,tr('Mostra descrizione'))}${sw('tags',p.tags,tr('Mostra tag'))}${sw('compact',p.compact,tr('Barre compatte'))}
    ${linked?`<div class="kx-dc-row"><span>🔔 ${esc(tr('Promemoria per questi eventi'))}</span><select class="form-input" data-k="remind">${REMIND.map(([v,l])=>`<option value="${v}"${String(p.remind)===v?' selected':''}>${esc(l())}</option>`).join('')}</select></div>`:''}
    ${sw('hidden',p.hidden,tr('Nascondi nella giornata'))}
    <div class="kx-dc-note">${esc(linked?tr("Le modifiche valgono solo in Kalend: il calendario d'origine non cambia."):tr('Tocca un calendario nella barra per nasconderlo o mostrarlo; tieni premuto per personalizzarlo.'))}</div>
    <div class="kx-dc-b"><button type="button" class="kx-dc-reset">${esc(tr('Azzera'))}</button><button type="button" class="kx-dc-ok pri">${esc(tr('Chiudi'))}</button></div>
  </div>`;
  document.body.appendChild(ov);requestAnimationFrame(()=>ov.classList.add('on'));
  const close=()=>{ov.classList.remove('on');setTimeout(()=>ov.remove(),200);applyAll();reopen();};
  ov.onclick=e=>{if(e.target===ov)close();};
  ov.querySelector('.kx-dc-x').onclick=close;ov.querySelector('.kx-dc-ok').onclick=close;
  ov.querySelector('.kx-dc-reset').onclick=()=>{reset(src);if(inf.kind==='sub'){/* il colore del collegamento torna quello scelto quando fu aggiunto */}close();};
  ov.querySelectorAll('.kx-dc-sw').forEach(b=>b.onclick=()=>{const on=!b.classList.contains('on');b.classList.toggle('on',on);b.setAttribute('aria-checked',String(on));set(src,{[b.dataset.k]:on});});
  ov.querySelectorAll('.kx-dc-ic').forEach(b=>b.onclick=()=>{ov.querySelectorAll('.kx-dc-ic').forEach(x=>x.classList.remove('on'));b.classList.add('on');set(src,{icon:b.dataset.ic});});
  const lab=ov.querySelector('input[data-k=label]');if(lab)lab.oninput=()=>set(src,{label:lab.value.trim().slice(0,40)});
  const col=ov.querySelector('input[data-k=color]');if(col)col.oninput=()=>{set(src,{color:col.value});
    /* il colore vale anche nella griglia: si aggiorna il collegamento e si ricolorano gli eventi */
    try{if(inf.kind==='sub'){const s=subById(src.slice(4));if(s){s.color=col.value;KX.SUBS.save();}}}catch(e){}};
  const rem=ov.querySelector('select[data-k=remind]');if(rem)rem.onchange=()=>set(src,{remind:rem.value});
}

/* ── backup completo: le preferenze viaggiano con i dati ── */
function hookBackup(){
  try{
    const orig=window.buildFullBackup;if(typeof orig!=='function'||orig._kxDC)return;
    const w=function(){const b=orig.apply(this,arguments);try{b.calPrefs=all();}catch(e){}return b;};w._kxDC=true;window.buildFullBackup=w;
  }catch(e){}
}
/* al ripristino: se il backup porta le preferenze, si applicano */
function restoreFrom(obj){try{if(obj&&obj.calPrefs&&typeof obj.calPrefs==='object'){cache=obj.calPrefs;save();applyAll();}}catch(e){}}

function init(){hook();hookBackup();setTimeout(applyAll,1500);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();

KX.CalPrefs={get,set,reset,sources,sourceOf,info,open,apply:applyAll,restoreFrom,KEY};
})();
