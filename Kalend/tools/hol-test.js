#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   COLLAUDO DELLE FESTIVITÀ OFFLINE (src/modules/31-holidays.js)
   Confronta alcune date note del 2026 con quelle calcolate dall'app:
   giorni sostitutivi (USA, Regno Unito, Giappone), feste mobili
   (Pasqua, ennesimo lunedì), lunari (Chuseok, Capodanno cinese),
   islamiche (Eid), da tabella (Diwali, Holi, Matariki), e verifica che
   nessuna richiesta parta verso Nager.Date; prova anche nascondi/aggiungi.
   Uso: node Kalend/tools/hol-test.js
══════════════════════════════════════════════════════════════════ */
const path=require('path');const {chromium}=require('playwright');
const PAGE='file://'+path.join(__dirname,'..','www','index.html');
const STUB=`window.__http=[];window.KalendNative={httpGet:(id,u)=>{window.__http.push(u);setTimeout(()=>window.__knCb(id,false,'HTTP 404'),5);},updateWidget:()=>{},setReminders:()=>{},vibrate:()=>{},setBarColor:()=>{},setSecure:()=>{},openSettings:()=>{},testReminder:()=>{},reliability:()=>'{}',vaultDel:()=>{},takeListQueue:()=>'[]',speechStop:()=>{},speechCancel:()=>{},snoozeAlert:()=>{}};try{localStorage.setItem('cal_onboard_v1','1');localStorage.setItem('kx_qs_v1','1');}catch(e){}`;
let fails=0;const check=(n,ok,i)=>{console.log((ok?'  ✔ ':'  ✘ ')+n+(ok?'':'   → '+i));if(!ok)fails++;};
/* [paese, anno, nome (parte), data attesa] */
const CASES=[
  ['US',2026,'Independence Day','2026-07-03'],      /* 4 luglio di sabato → venerdì */
  ['US',2026,'Thanksgiving','2026-11-26'],
  ['US',2026,'Juneteenth','2026-06-19'],
  ['GB',2026,'Boxing Day','2026-12-28'],            /* 26 dicembre di sabato → lunedì */
  ['GB',2026,'Christmas Day','2026-12-25'],
  ['GB',2026,'Spring Bank','2026-05-25'],
  ['JP',2026,'憲法記念日','2026-05-03'],
  ['JP',2026,'こどもの日','2026-05-05'],
  ['JP',2026,'海の日','2026-07-20'],
  ['KR',2026,'추석','2026-09-25'],
  ['CN',2026,'春节','2026-02-17'],
  ['IN',2026,'Diwali','2026-11-08'],
  ['IN',2026,'Holi','2026-03-03'],
  ['NZ',2026,'Matariki','2026-07-10'],
  ['CA',2026,'Victoria Day','2026-05-18'],
  ['PH',2026,'National Heroes','2026-08-31'],
  ['BR',2026,'Carnaval','2026-02-16'],
  ['DE',2026,'Ostermontag','2026-04-06'],
  ['BY',2026,'Радаўніца','2026-04-21'],
  ['SR',2026,'Holi','2026-03-03'],
  ['ID',2026,'Idul Fitri','2026-03-20'],
  ['MO',2026,'冬至','2026-12-22'],
  ['AU',2026,'Boxing Day','2026-12-28'],
  ['ZA',2026,'Day of Goodwill','2026-12-26'],       /* sabato: in Sudafrica resta */
  ['ZA',2026,'Women','2026-08-10'],                 /* 9 agosto di domenica → lunedì sostitutivo */
  ['US',2026,'Independence Day','2026-07-04'],      /* la festa resta nel suo giorno */
];
(async()=>{
  const b=await chromium.launch();const p=await (await b.newContext({locale:'it'})).newPage();
  const errors=[];p.on('pageerror',e=>errors.push(String(e.message||e)));
  await p.addInitScript(STUB);await p.goto(PAGE);await p.waitForTimeout(2600);
  console.log('1. Date note del 2026');
  const r=await p.evaluate(cases=>cases.map(([cc,y,name,exp])=>{const l=KX.Holidays.list(cc,y);const hit=l.filter(h=>h.name.includes(name));return {cc,name,exp,got:hit.map(h=>h.date),ok:hit.some(h=>h.date===exp)};}),CASES);
  r.forEach(x=>check(`${x.cc} ${x.name} = ${x.exp}`,x.ok,JSON.stringify(x.got)));
  console.log('2. Giorno sostitutivo giapponese 2026: 3 maggio di domenica → 6 maggio');
  const jp=await p.evaluate(()=>KX.Holidays.list('JP',2026).filter(h=>h.date>='2026-05-03'&&h.date<='2026-05-06').map(h=>h.date+' '+h.name));
  check('振替休日 il 6 maggio',jp.some(x=>x.startsWith('2026-05-06')),JSON.stringify(jp));
  console.log('3. Copertura e rete');
  const cov=await p.evaluate(()=>{const cc=['IT','US','GB','DE','FR','ES','PT','BR','MX','AR','NL','PL','RU','UA','TR','SA','AE','EG','MA','IL','IN','BD','ID','JP','KR','CN','TW','HK','TH','VE','CO','PE','CL','PH','NG','KE','KZ','BY','IQ','JO','KW','QA','MO','SG','MY','VN','PK'];return cc.map(c=>[c,KX.Holidays.list(c,2026).length]).filter(x=>x[1]<4);});
  check('ogni paese dei 20 mercati ha almeno 4 festività',cov.length===0,JSON.stringify(cov));
  const net=await p.evaluate(()=>window.__http.filter(u=>/nager/.test(u)));
  check('nessuna richiesta a Nager.Date',net.length===0,JSON.stringify(net));
  console.log('4. Personalizzazioni');
  const u=await p.evaluate(()=>{const H=KX.Holidays;H.user.hide('IT','Ferragosto',true);H.user.add('IT','Festa del paese','04-25');const l=KX.Holidays.list('IT',2026);const out={hid:!l.some(h=>h.name==='Ferragosto'),added:l.some(h=>h.name==='Festa del paese'&&h.date==='2026-04-25')};H.user.reset('IT');out.back=KX.Holidays.list('IT',2026).some(h=>h.name==='Ferragosto');return out;});
  check('nascondi Ferragosto, aggiungi festa propria, ripristina',u.hid&&u.added&&u.back,JSON.stringify(u));
  const card=await p.evaluate(()=>{const c=document.getElementById('kx-hol-card');return c?c.querySelectorAll('.kx-hol-it').length:-1;});
  check('scheda festività con elenco (≥ 10 voci per IT)',card>=10,String(card));
  check('nessun errore JS',errors.length===0,errors.join(' | '));
  await b.close();console.log(fails?`\n${fails} controlli FALLITI`:'\nTUTTO OK');process.exit(fails?1:0);
})();
