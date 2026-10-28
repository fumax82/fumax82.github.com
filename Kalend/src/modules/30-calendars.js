/* ══════════════════════════════════════════════════════════════════
   MODULO v54 — "Lune" · calendari del mondo
   ------------------------------------------------------------------
   1. CALENDARIO SECONDARIO: accanto alla data gregoriana l'app può
      mostrare la data di un altro calendario (islamico, ebraico,
      cinese/lunare, coreano, persiano, buddhista, indiano, ere
      giapponesi, etiope, copto, Minguo). È ciò che un utente in Arabia
      Saudita, Israele, Cina, Iran, Thailandia o Giappone si aspetta da
      un calendario: la scelta «Automatico» segue paese e lingua.
      Tutto è calcolato sul dispositivo con Intl (nessuna rete).
      · nel mese: il giorno del calendario secondario in piccolo in alto
        a destra di ogni cella (il nome del mese quando cambia);
      · nel riepilogo giornata e nel dettaglio giornata: la data completa;
      · impostazioni → Lingua e paese → «Calendario secondario».
   2. FESTIVITÀ OFFLINE in più per i paesi delle lingue supportate che il
      servizio in rete non copre o copre male: Bangladesh, Thailandia,
      Pakistan, Indonesia, Vietnam (feste fisse + feste islamiche e
      buddhiste calcolate con i calendari alternativi).
   Niente del codice precedente viene rimosso.
══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const KX=window.KX=window.KX||{};
const $id=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tr=(s,p)=>{try{return typeof T==='function'?T(s,p):s;}catch(e){return s;}};
const locale=()=>{try{return L10N.locale||'en';}catch(e){return 'en';}};
const lang=()=>{try{return L10N.resolvedLang||'en';}catch(e){return 'en';}};

/* ══ 1. CALENDARIO SECONDARIO ══ */
/* id Intl → etichetta (chiave italiana, tradotta da T) */
const CALENDARS=[
  ['islamic-umalqura','☪️ Islamico (Umm al-Qura)'],
  ['islamic-civil','☪️ Islamico (civile)'],
  ['hebrew','✡️ Ebraico'],
  ['chinese','🏮 Cinese (lunare)'],
  ['dangi','🏮 Coreano (lunare)'],
  ['persian','🌸 Persiano (solare)'],
  ['buddhist','☸️ Buddhista (Thailandia)'],
  ['indian','🪔 Indiano (Saka)'],
  ['japanese','🎌 Giapponese (ere)'],
  ['ethiopic','🇪🇹 Etiope'],
  ['coptic','⛪ Copto'],
  ['roc','🇹🇼 Minguo (Taiwan)'],
];
/* scelta automatica: prima il paese, poi la lingua */
const BY_COUNTRY={SA:'islamic-umalqura',AE:'islamic-umalqura',QA:'islamic-umalqura',KW:'islamic-umalqura',BH:'islamic-umalqura',OM:'islamic-umalqura',YE:'islamic-umalqura',
  EG:'islamic-civil',JO:'islamic-civil',IQ:'islamic-civil',SY:'islamic-civil',LB:'islamic-civil',MA:'islamic-civil',DZ:'islamic-civil',TN:'islamic-civil',LY:'islamic-civil',PK:'islamic-civil',BD:'islamic-civil',AF:'islamic-civil',SD:'islamic-civil',
  IL:'hebrew',CN:'chinese',TW:'chinese',HK:'chinese',MO:'chinese',SG:'chinese',VN:'chinese',MY:'chinese',KR:'dangi',JP:'japanese',TH:'buddhist',IR:'persian',ET:'ethiopic'};
const BY_LANG={ar:'islamic-umalqura',he:'hebrew',zh:'chinese',ko:'dangi',ja:'japanese',th:'buddhist',vi:'chinese',fa:'persian',ur:'islamic-civil'};
function autoCal(){
  let c='';try{c=AppSettings.country||'';}catch(e){}
  return BY_COUNTRY[c]||BY_LANG[lang()]||'';
}
function chosen(){
  let v='auto';try{v=AppSettings.altCal||'auto';}catch(e){}
  if(v==='none')return '';
  if(v==='auto')return autoCal();
  return CALENDARS.some(c=>c[0]===v)?v:'';
}
/* formattatori con cache: {giorno}, {mese breve}, {data completa} */
const FMT={};
function fmt(cal,kind){
  const k=cal+'|'+kind+'|'+locale();if(FMT[k]!==undefined)return FMT[k];
  const loc=locale()+'-u-ca-'+cal;
  const opts=kind==='day'?{day:'numeric'}:kind==='month'?{month:'short'}:kind==='era'?{era:'short',year:'numeric'}:{weekday:'long',day:'numeric',month:'long',year:'numeric'};
  try{FMT[k]=new Intl.DateTimeFormat(loc,opts);}catch(e){try{FMT[k]=new Intl.DateTimeFormat('en-u-ca-'+cal,opts);}catch(x){FMT[k]=null;}}
  return FMT[k];
}
const pk=k=>{const[y,m,d]=String(k).split('-').map(Number);return new Date(y,m-1,d,12);};
/* parti della data secondaria per una chiave AAAA-MM-GG */
function altParts(k,cal){
  cal=cal||chosen();if(!cal)return null;
  const d=pk(k);const fd=fmt(cal,'day'),fm=fmt(cal,'month');if(!fd)return null;
  try{
    const day=fd.format(d);
    const month=fm?fm.format(d):'';
    /* primo giorno del mese secondario: cambia il mese rispetto al giorno prima */
    const prev=new Date(d);prev.setDate(prev.getDate()-1);
    const first=fm?fm.format(prev)!==month:false;
    return{day,month,first};
  }catch(e){return null;}
}
function altFull(k,cal){
  cal=cal||chosen();if(!cal)return '';
  const f=fmt(cal,'full');try{return f?f.format(pk(k)):'';}catch(e){return '';}
}
KX.AltDate={chosen,autoCal,parts:altParts,full:altFull,CALENDARS};

/* ── celle del mese ── */
let decorating=false;
function decorateCells(){
  if(decorating)return;decorating=true;
  try{
    const cal=chosen();
    const cells=document.querySelectorAll('.day-cell[data-key]');
    cells.forEach(cell=>{
      const old=cell.querySelector(':scope > .kx-alt');
      if(!cal){if(old)old.remove();cell.dataset.kxAlt='';return;}
      const key=cell.dataset.key;const stamp=cal+'|'+key;
      if(cell.dataset.kxAlt===stamp&&old)return;
      const p=altParts(key,cal);if(!p){if(old)old.remove();return;}
      const el=old||document.createElement('span');el.className='kx-alt'+(p.first?' m':'');
      /* ere giapponesi: la data cambia solo con l'anno; si mostra il mese secondario solo quando cambia */
      /* ere giapponesi: il giorno è lo stesso del gregoriano, conta l'anno dell'era («令和9年») sul 1° del mese */
      if(cal==='japanese'){let era='';if(/-01$/.test(key)){const f=fmt(cal,'era');try{era=f?f.format(pk(key)):'';}catch(e){}}el.textContent=era;}
      else el.textContent=(p.first&&p.month?p.month+' '+p.day:p.day);
      el.title=altFull(key,cal);
      if(!old)cell.appendChild(el);
      cell.dataset.kxAlt=stamp;
    });
  }catch(e){console.warn('[v54 altcal]',e);}
  decorating=false;
}
let dT=0;const soon=()=>{clearTimeout(dT);dT=setTimeout(decorateCells,160);};

/* ── riepilogo giornata e dettaglio giornata: data completa ── */
function hookPanels(){
  if(typeof openDaySummary==='function'&&!openDaySummary._v54alt){
    const _o=openDaySummary;
    openDaySummary=function(key){const r=_o.apply(this,arguments);try{
      const t=$id('ds-title');const full=altFull(key);
      if(t&&full&&!t.querySelector('.kx-altdate')){const s=document.createElement('span');s.className='kx-altdate';s.style.display='block';s.textContent=full;t.appendChild(s);}
    }catch(e){}return r;};
    openDaySummary._v54alt=true;
  }
  if(typeof openDayDetail==='function'&&!openDayDetail._v54alt){
    const _d=openDayDetail;
    openDayDetail=function(key){const r=_d.apply(this,arguments);try{
      const t=$id('dd-title');const full=altFull(key);
      if(t&&full&&!t.querySelector('.kx-altdate')){const s=document.createElement('span');s.className='kx-altdate';s.textContent=full;t.appendChild(s);}
    }catch(e){}return r;};
    openDayDetail._v54alt=true;
  }
}

/* ── impostazione «Calendario secondario» ── */
function installSetting(){
  const country=$id('set-country');if(!country||$id('set-altcal'))return;
  const grp=country.closest('.form-group')||country.parentElement;
  const box=document.createElement('div');box.className='form-group';box.id='kx-altcal-group';
  const auto=autoCal();const autoName=auto?(CALENDARS.find(c=>c[0]===auto)||[])[1]:'';
  box.innerHTML=`<div class="form-label">🗓 ${esc(tr('Calendario secondario'))}</div>
    <select class="form-input" id="set-altcal">
      <option value="auto">${esc(tr('Automatico (lingua e paese)'))}${autoName?' · '+esc(tr(autoName).replace(/^\S+\s/,'')):''}</option>
      <option value="none">${esc(tr('Nessuno'))}</option>
      ${CALENDARS.map(([id,name])=>`<option value="${id}">${esc(tr(name))}</option>`).join('')}
    </select>
    <div class="set-caption">${esc(tr('La data di un secondo calendario accanto a quella gregoriana: nel mese, nel riepilogo e nel dettaglio della giornata.'))}</div>`;
  grp.insertAdjacentElement('afterend',box);
  const sel=box.querySelector('#set-altcal');
  try{sel.value=AppSettings.altCal||'auto';}catch(e){}
  sel.addEventListener('change',()=>{try{AppSettings.altCal=sel.value;AppSettings.save();}catch(e){}
    document.querySelectorAll('.day-cell .kx-alt').forEach(x=>x.remove());document.querySelectorAll('.day-cell[data-key]').forEach(c=>{c.dataset.kxAlt='';});
    decorateCells();try{toast(chosen()?tr('🗓 Calendario secondario attivo'):tr('🗓 Calendario secondario disattivato'));}catch(e){}});
  /* cambiando paese cambia anche la scelta automatica */
  country.addEventListener('change',()=>{document.querySelectorAll('.day-cell[data-key]').forEach(c=>{c.dataset.kxAlt='';});setTimeout(decorateCells,300);});
}

/* ══ 2. FESTIVITÀ OFFLINE IN PIÙ ══
   Regole con la stessa sintassi di HOL_RULES (MM-GG, E±n…) più feste
   calcolate con i calendari alternativi: I(mese,giorno) islamico,
   C(mese,giorno) cinese/lunare (≈ calendario thai spostato di due mesi). */
const EXTRA_RULES={
  BD:'02-21 শহীদ দিবস / Language Martyrs Day|03-17 বঙ্গবন্ধুর জন্মদিন / Mujib Day|03-26 স্বাধীনতা দিবস / Independence Day|04-14 পহেলা বৈশাখ / Bengali New Year|05-01 মে দিবস / May Day|08-15 জাতীয় শোক দিবস / National Mourning Day|12-16 বিজয় দিবস / Victory Day|12-25 বড়দিন / Christmas',
  TH:'01-01 วันขึ้นปีใหม่ / New Year|04-06 วันจักรี / Chakri Day|04-13 สงกรานต์ / Songkran|04-14 สงกรานต์ / Songkran|04-15 สงกรานต์ / Songkran|05-01 วันแรงงาน / Labour Day|05-04 วันฉัตรมงคล / Coronation Day|06-03 วันเฉลิมพระชนมพรรษาพระราชินี / Queen\'s Birthday|07-28 วันเฉลิมพระชนมพรรษา ร.10 / King\'s Birthday|08-12 วันแม่ / Mother\'s Day|10-13 วันนวมินทรมหาราช / King Bhumibol Memorial Day|10-23 วันปิยมหาราช / Chulalongkorn Day|12-05 วันพ่อ / Father\'s Day|12-10 วันรัฐธรรมนูญ / Constitution Day|12-31 วันสิ้นปี / New Year\'s Eve',
  PK:'02-05 Kashmir Day|03-23 یومِ پاکستان / Pakistan Day|05-01 یومِ مزدور / Labour Day|08-14 یومِ آزادی / Independence Day|11-09 یومِ اقبال / Iqbal Day|12-25 یومِ قائد / Quaid-e-Azam Day',
  ID:'01-01 Tahun Baru|05-01 Hari Buruh|06-01 Hari Lahir Pancasila|08-17 Hari Kemerdekaan|12-25 Hari Natal|E-2 Wafat Isa Al Masih|E39 Kenaikan Isa Al Masih',
  VN:'01-01 Tết Dương lịch|04-30 Ngày Giải phóng miền Nam|05-01 Ngày Quốc tế Lao động|09-02 Quốc khánh',
  LK:'02-04 Independence Day|04-13 Sinhala & Tamil New Year Eve|04-14 Sinhala & Tamil New Year|05-01 May Day|12-25 Christmas',
  NP:'01-11 Prithvi Jayanti|04-14 Nepali New Year|05-01 Labour Day|09-20 Constitution Day',
  MY:'05-01 Hari Pekerja|08-31 Hari Kebangsaan|09-16 Hari Malaysia|12-25 Krismas',
  IR:'03-21 نوروز / Nowruz|03-22 نوروز|03-23 نوروز|03-24 نوروز|04-01 روز جمهوری اسلامی|04-02 سیزده‌به‌در|06-04 رحلت امام خمینی|02-11 پیروزی انقلاب',
};
/* feste calcolate con i calendari alternativi, per paese */
const EXTRA_CALC={
  BD:[['I',10,1,'ঈদুল ফিতর / Eid al-Fitr'],['I',12,10,'ঈদুল আযহা / Eid al-Adha'],['I',3,12,'ঈদে মিলাদুন্নবী / Mawlid'],['I',1,10,'আশুরা / Ashura'],['C',4,15,'বুদ্ধ পূর্ণিমা / Buddha Purnima']],
  TH:[['C',1,15,'วันมาฆบูชา / Makha Bucha'],['C',4,15,'วันวิสาขบูชา / Visakha Bucha'],['C',6,15,'วันอาสาฬหบูชา / Asalha Bucha'],['C',6,16,'วันเข้าพรรษา / Khao Phansa']],
  PK:[['I',10,1,'عید الفطر / Eid al-Fitr'],['I',10,2,'عید الفطر'],['I',12,10,'عید الاضحیٰ / Eid al-Adha'],['I',12,11,'عید الاضحیٰ'],['I',1,10,'عاشورہ / Ashura'],['I',3,12,'عید میلاد النبی / Eid Milad un-Nabi']],
  ID:[['I',10,1,'Idul Fitri'],['I',10,2,'Idul Fitri'],['I',12,10,'Idul Adha'],['I',1,1,'Tahun Baru Islam'],['I',3,12,'Maulid Nabi'],['I',7,27,'Isra Mikraj'],['C',1,1,'Tahun Baru Imlek'],['C',4,15,'Hari Raya Waisak']],
  VN:[['C',1,1,'Tết Nguyên Đán'],['C',1,2,'Tết Nguyên Đán'],['C',1,3,'Tết Nguyên Đán'],['C',3,10,'Giỗ Tổ Hùng Vương'],['C',8,15,'Tết Trung thu']],
  MY:[['I',10,1,'Hari Raya Aidilfitri'],['I',12,10,'Hari Raya Aidiladha'],['C',1,1,'Tahun Baru Cina'],['C',4,15,'Hari Wesak']],
  LK:[['C',4,15,'Vesak Poya'],['I',10,1,'Eid al-Fitr']],
  SA:[['I',10,1,'عيد الفطر'],['I',10,2,'عيد الفطر'],['I',10,3,'عيد الفطر'],['I',12,10,'عيد الأضحى'],['I',12,11,'عيد الأضحى'],['I',12,12,'عيد الأضحى']],
  AE:[['I',10,1,'عيد الفطر'],['I',10,2,'عيد الفطر'],['I',12,9,'يوم عرفة'],['I',12,10,'عيد الأضحى'],['I',12,11,'عيد الأضحى'],['I',1,1,'رأس السنة الهجرية'],['I',3,12,'المولد النبوي']],
  EG:[['I',10,1,'عيد الفطر'],['I',10,2,'عيد الفطر'],['I',12,10,'عيد الأضحى'],['I',12,11,'عيد الأضحى'],['I',1,1,'رأس السنة الهجرية'],['I',3,12,'المولد النبوي']],
  TR:[['I',10,1,'Ramazan Bayramı'],['I',10,2,'Ramazan Bayramı'],['I',10,3,'Ramazan Bayramı'],['I',12,10,'Kurban Bayramı'],['I',12,11,'Kurban Bayramı'],['I',12,12,'Kurban Bayramı'],['I',12,13,'Kurban Bayramı']],
  IN:[['I',10,1,'Eid al-Fitr / ईद उल-फ़ित्र'],['I',12,10,'Eid al-Adha / बकरीद'],['C',4,15,'Buddha Purnima / बुद्ध पूर्णिमा']],
  IL:[['H','Tishri',1,'ראש השנה'],['H','Tishri',2,'ראש השנה'],['H','Tishri',10,'יום כיפור'],['H','Tishri',15,'סוכות'],['H','Tishri',22,'שמיני עצרת'],['H','Nisan',15,'פסח'],['H','Nisan',21,'שביעי של פסח'],['H','Sivan',6,'שבועות']],
};
function calcHolidays(cc,y){
  const list=EXTRA_CALC[cc];const AltCal=(window.KX&&KX.HolRules&&KX.HolRules.altCal)?KX.HolRules.altCal():null;if(!list||!AltCal)return[];
  const out=[];
  list.forEach(([kind,mo,da,name])=>{
    let k=null;
    try{
      if(kind==='I')k=AltCal.find('islamic-umalqura',y,String(mo),da);
      else if(kind==='C')k=AltCal.find('chinese',y,String(mo),da);
      else if(kind==='H')k=AltCal.find('hebrew',y,mo,da)||(mo==='Adar'?AltCal.find('hebrew',y,'Adar II',da):null);
    }catch(e){}
    if(k)out.push({date:k,name});
  });
  return out;
}
function installHolidays(){
  /* v55: le regole di base stanno in KX.HolRules.rules (chiusura del sorgente
     storico); le feste calcolate (islamiche, lunari, ebraiche) vengono
     chieste dal modulo 31-holidays.js tramite KX.AltDate.calcHolidays */
  try{
    const H=window.KX&&KX.HolRules;
    if(H&&H.rules){Object.keys(EXTRA_RULES).forEach(cc=>{if(!H.rules[cc])H.rules[cc]=EXTRA_RULES[cc];});}
    KX.AltDate=KX.AltDate||{};KX.AltDate.calcHolidays=calcHolidays;KX.AltDate.EXTRA_RULES=EXTRA_RULES;
    /* il selettore dei paesi include anche quelli aggiunti qui */
    if(typeof buildCountryOptions==='function'){try{buildCountryOptions();}catch(e){}}
  }catch(e){console.warn('[v54 feste]',e);}
}

/* ── avvio ── */
function start(){
  installHolidays();
  try{installSetting();}catch(e){console.error('[v54 altcal set]',e);}
  try{hookPanels();}catch(e){}
  decorateCells();
  const vs=$id('v-scroll')||document.body;
  new MutationObserver(soon).observe(vs,{childList:true,subtree:true});
  addEventListener('kx-holidays',soon);
  setTimeout(decorateCells,1500);setTimeout(decorateCells,4000);
}
if(document.readyState==='complete')setTimeout(start,300);else addEventListener('load',()=>setTimeout(start,300));
})();
