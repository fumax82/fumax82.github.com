/* ══════════════════════════════════════════════════════════════════
   MODULO v55 — «Viste»: settimana, giorno e anno più utili
   ------------------------------------------------------------------
   1. SETTIMANA: ogni barra mostra, se c'è spazio, orario completo
      (inizio–fine), luogo, persone e tag; le barre dei calendari
      collegati portano il contrassegno di provenienza (🔗 📱 ☑).
      L'intestazione di ogni giorno mostra i pallini dei colori degli
      eventi e il loro numero.
   2. GIORNO: in fondo al pannello una riga di azioni rapide, così le
      funzioni dell'app sono a un tocco dal giorno aperto:
      🟢 Libero (disponibilità) · ☑ Liste · 🎤 Detta (con la data già
      pronta) · 📋 Riepilogo · ＋ Nuovo; più il tempo libero del giorno.
   3. ANNO: nei mini-mesi, pallini colorati per gli eventi (fino a 3),
      festività in rosso, weekend evidenziati, totale eventi del mese.
   Il modulo non modifica il codice storico: avvolge le funzioni
   globali openWeeklyView / relayoutWeek / openDayDetail / renderYearView
   e lavora sul DOM appena costruito.
══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const KX=window.KX=window.KX||{};
const tr=(s,p)=>{try{return typeof T==='function'?T(s,p):s;}catch(e){return s;}};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ft=m=>{try{return fmtTime(m);}catch(e){return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');}};
const key=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const evsOf=k=>{try{return getEventsForKey(k)||[];}catch(e){try{return (S.events[k]||[]);}catch(x){return [];}}};
const srcMark=ev=>{try{const C=KX.CalPrefs;if(!C)return '';const inf=C.info(C.sourceOf(ev),ev);return inf.mark||'';}catch(e){return '';}};
const safeColor=c=>/^#[0-9a-f]{3,8}$/i.test(c||'')?c:'#3870B8';

/* ══ 1. settimana ══ */
function enrichWeek(){
  const body=document.getElementById('wv-body');if(!body)return;
  body.querySelectorAll('.kx-wv-ev').forEach(b=>{
    const ev=b.__ev;if(!ev||b.dataset.kxRich)return;b.dataset.kxRich='1';
    const h=parseFloat(b.style.height)||0;
    const small=b.querySelector('small');
    if(small&&h>=40&&ev.durationMin>0&&ev.durationMin<1440)small.textContent=ft(ev.startMin)+'–'+ft(ev.startMin+ev.durationMin);
    if(h>=58&&(ev.location||'').trim()){const l=document.createElement('span');l.className='kx-wv-loc';l.textContent='📍 '+ev.location.trim();b.appendChild(l);}
    if(h>=76&&(ev.participants||[]).length){const p=document.createElement('span');p.className='kx-wv-ppl';p.textContent='👥 '+ev.participants.slice(0,3).join(', ')+(ev.participants.length>3?' +'+(ev.participants.length-3):'');b.appendChild(p);}
    if(h>=92&&(ev.tags||[]).filter(Boolean).length){const t=document.createElement('span');t.className='kx-wv-tags';t.textContent=ev.tags.filter(Boolean).slice(0,3).map(x=>'#'+x).join(' ');b.appendChild(t);}
    const mark=srcMark(ev);if(mark){const i=document.createElement('i');i.className='kx-wv-src';i.textContent=mark;b.appendChild(i);}
    b.title=(ev.title||'')+(ev.location?' · '+ev.location:'');
  });
  /* intestazioni: pallini e totale */
  const hdrs=[...document.querySelectorAll('#wv-day-header .wv-day-col-hdr')];
  let week=null;try{week=S.weeks[wvCurrentWIdx];}catch(e){}
  if(!week||hdrs.length!==7)return;
  hdrs.forEach((h,i)=>{
    if(h.querySelector('.kx-wv-dots'))return;
    const evs=evsOf(key(week[i]));if(!evs.length)return;
    const colors=[...new Set(evs.map(e=>safeColor(e.color)))].slice(0,4);
    const dots=document.createElement('div');dots.className='kx-wv-dots';dots.innerHTML=colors.map(c=>`<b style="background:${esc(c)}"></b>`).join('');
    const n=document.createElement('div');n.className='kx-wv-n';n.textContent=String(evs.length);
    h.appendChild(dots);h.appendChild(n);
  });
}
function hookWeek(){
  try{const o=window.relayoutWeek;if(typeof o==='function'&&!o._kxV){const w=function(){const r=o.apply(this,arguments);try{enrichWeek();}catch(e){}return r;};w._kxV=true;window.relayoutWeek=w;}}catch(e){}
  try{const o=window.openWeeklyView;if(typeof o==='function'&&!o._kxV){const w=function(){const r=o.apply(this,arguments);try{enrichWeek();}catch(e){}return r;};w._kxV=true;window.openWeeklyView=w;}}catch(e){}
}

/* ══ 2. giorno: azioni rapide ══ */
function freeMinutes(k){
  const evs=evsOf(k).filter(e=>e.durationMin>0&&e.durationMin<1440&&!e._allday);
  const busy=[];evs.forEach(e=>busy.push([e.startMin,Math.min(1440,e.startMin+e.durationMin)]));
  busy.sort((a,b)=>a[0]-b[0]);let tot=0,cur=null;
  busy.forEach(([s,e])=>{if(!cur||s>cur[1]){if(cur)tot+=cur[1]-cur[0];cur=[s,e];}else cur[1]=Math.max(cur[1],e);});if(cur)tot+=cur[1]-cur[0];
  const DAY=[8*60,20*60];           /* ore «utili» della giornata */
  let free=DAY[1]-DAY[0];busy.forEach(([s,e])=>{const a=Math.max(s,DAY[0]),b=Math.min(e,DAY[1]);if(b>a)free-=b-a;});
  return {busy:tot,free:Math.max(0,free)};
}
function actionsBar(k){
  const panel=document.getElementById('day-detail-panel');if(!panel)return;
  let bar=document.getElementById('kx-dd-actions');
  if(!bar){bar=document.createElement('div');bar.id='kx-dd-actions';bar.setAttribute('role','toolbar');panel.appendChild(bar);}
  const f=freeMinutes(k);const hh=m=>(m/60).toFixed(m%60?1:0).replace('.0','')+'h';
  bar.innerHTML=`<span class="kx-dd-free" title="${esc(tr('Ore libere fra le 8 e le 20'))}">🟢 ${esc(hh(f.free))} ${esc(tr('libere'))}</span>
    <button type="button" data-a="avail">🟢 ${esc(tr('Libero'))}</button>
    <button type="button" data-a="lists">☑ ${esc(tr('Liste'))}</button>
    <button type="button" data-a="voice">🎤 ${esc(tr('Detta'))}</button>
    <button type="button" data-a="summary">📋 ${esc(tr('Riepilogo'))}</button>
    <button type="button" data-a="add" class="pri">＋ ${esc(tr('Nuovo'))}</button>`;
  panel.classList.add('kx-has-actions');
  bar.onclick=e=>{
    const b=e.target.closest('button');if(!b)return;const a=b.dataset.a;
    try{
      if(a==='avail'){if(KX.openAvail)KX.openAvail([k]);else if(KX.openAvailability)KX.openAvailability([k]);}
      else if(a==='lists'){KX.openLists&&KX.openLists();}
      else if(a==='voice'){let lbl=k;try{lbl=fmtDateLabel(k);}catch(x){}if(KX.voice&&KX.voice.open)KX.voice.open(lbl);}
      else if(a==='summary'){try{closeDayDetail();}catch(x){}setTimeout(()=>{try{openDaySummary(k);}catch(x){}},150);}
      else if(a==='add'){const btn=document.getElementById('dd-add-event');if(btn)btn.click();}
    }catch(x){}
  };
}
function hookDay(){
  try{const o=window.openDayDetail;if(typeof o==='function'&&!o._kxV){const w=function(k,events){const r=o.apply(this,arguments);try{actionsBar(k);}catch(e){}return r;};w._kxV=true;window.openDayDetail=w;}}catch(e){}
}

/* ══ 3. anno ══ */
function enrichYear(){
  const yv=document.getElementById('year-view');if(!yv)return;
  let year=new Date().getFullYear();try{year=yearViewCurrentYear;}catch(e){}
  const hol=k=>{try{return (KX.dayHolidays&&KX.dayHolidays(k)||[]).some(h=>h.type==='public');}catch(e){return false;}};
  let wk=[0,6];try{wk=L10N.weekendDows||wk;}catch(e){}
  yv.querySelectorAll('.yv-month').forEach((card,m)=>{
    let tot=0;
    card.querySelectorAll('.yv-day:not(.empty)').forEach(el=>{
      if(el.dataset.kxV)return;el.dataset.kxV='1';
      const d=parseInt(el.textContent,10);if(!d)return;
      const k=`${year}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dow=new Date(year,m,d).getDay();
      if(wk.includes(dow))el.classList.add('kx-yv-wknd');
      if(hol(k))el.classList.add('kx-yv-hol');
      const evs=evsOf(k);if(!evs.length)return;tot+=evs.length;
      const colors=[...new Set(evs.map(e=>safeColor(e.color)))].slice(0,3);
      const dots=document.createElement('i');dots.className='kx-yv-d';dots.innerHTML=colors.map(c=>`<b style="background:${esc(c)}"></b>`).join('');
      el.classList.add('kx-dots');el.appendChild(dots);
    });
    if(tot&&!card.querySelector('.kx-yv-sum')){const s=document.createElement('div');s.className='kx-yv-sum';s.textContent=tr('{n} eventi',{n:tot});card.appendChild(s);}
  });
}
function hookYear(){
  try{const o=window.renderYearView;if(typeof o==='function'&&!o._kxV){const w=function(){const r=o.apply(this,arguments);try{enrichYear();}catch(e){}return r;};w._kxV=true;window.renderYearView=w;}}catch(e){}
}

function init(){hookWeek();hookDay();hookYear();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
KX.Views={enrichWeek,enrichYear,actionsBar,freeMinutes};
})();
