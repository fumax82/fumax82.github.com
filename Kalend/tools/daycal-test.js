/* ──────────────────────────────────────────────────────────────────
   daycal-test.js — collaudo del modulo «Calendari nella giornata»
   (src/modules/45-daycal.js): barra dei calendari, nascondi/mostra,
   scheda di personalizzazione (icona, colore, dettagli, promemoria),
   contrassegni di provenienza, backup.
   Uso: node Kalend/tools/daycal-test.js [--shots <cartella>]
   ────────────────────────────────────────────────────────────────── */
const path=require('path');const fs=require('fs');const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..');
const PAGE='file://'+path.join(ROOT,'www','index.html');
const args=process.argv.slice(2);const si=args.indexOf('--shots');const SHOTS=si>=0?path.resolve(args[si+1]):null;
if(SHOTS)fs.mkdirSync(SHOTS,{recursive:true});
let fails=0;const check=(name,ok,info)=>{console.log(`  ${ok?'✔':'✘'} ${name}${ok||info==null?'':'   → '+(typeof info==='string'?info:JSON.stringify(info))}`);if(!ok)fails++;};
const STUB=`window.KalendNative={updateWidget(){},setReminders(){},vibrate(){},setBarColor(){},setSecure(){},openSettings(){},testReminder(){},reliability(){return'{}'},vaultDel(){},takeListQueue(){return'[]'},speechStop(){},speechCancel(){},snoozeAlert(){}};
localStorage.setItem('cal_onboard_v1','1');localStorage.setItem('kx_qs_v1','1');localStorage.setItem('kx_legal_seen_v1','1');`;
(async()=>{
  const b=await chromium.launch({args:['--allow-file-access-from-files']});
  const ctx=await b.newContext({viewport:{width:412,height:915},locale:'it',deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(String(e.message||e)));
  await p.addInitScript(STUB);await p.goto(PAGE);await p.waitForTimeout(2500);
  await p.evaluate(()=>{try{document.getElementById('kx-intro')?.remove();}catch(e){}});

  console.log('1. Dati di prova: eventi miei, di un calendario collegato e del telefono');
  const key=await p.evaluate(()=>{
    const d=new Date();d.setDate(d.getDate()+1);const k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    KX.SUBS.list=KX.SUBS.list.filter(s=>s.id!=='sub_test');KX.SUBS.list.push({id:'sub_test',name:'Google Casa',color:'#C85838',url:'',last:Date.now(),count:1,device:false});KX.SUBS.save();
    S.events[k]=[
      {title:'Riunione mia',startMin:9*60,durationMin:60,color:'#1E8A95',tags:['lavoro'],location:'Ufficio',description:'Portare il portatile',participants:[]},
      {title:'Dentista',startMin:11*60,durationMin:45,color:'#C85838',tags:[],location:'Via Roma 5',description:'',participants:[],_sub:'sub_test',_icsUid:'u1'},
      {title:'Call cliente',startMin:15*60,durationMin:30,color:'#3870B8',tags:[],location:'Teams',description:'Preventivo',participants:[],_sub:'device',_devId:7,_devCal:'Lavoro'},
    ];
    openDayDetail(k,S.events[k]);return k;});
  await p.waitForTimeout(800);
  let r=await p.evaluate(()=>({chips:[...document.querySelectorAll('#kx-dc-bar .kx-dc-chip')].map(c=>c.textContent.trim()),bars:document.querySelectorAll('#dd-body .dd-ev-bar').length,marks:[...document.querySelectorAll('#dd-body .kx-dc-src')].map(m=>m.textContent)}));
  check('barra con 3 calendari (miei, collegato, telefono)',r.chips.length===3&&/Google Casa/.test(r.chips[1])&&/Lavoro/.test(r.chips[2]),r);
  check('3 barre, contrassegni 🔗 e 📱 sui collegati',r.bars===3&&r.marks.join('')==='🔗📱',r);
  if(SHOTS)await p.screenshot({path:path.join(SHOTS,'daycal-1-barra.png')});

  console.log('2. Un tocco sul chip nasconde il calendario');
  await p.evaluate(()=>document.querySelectorAll('#kx-dc-bar .kx-dc-chip')[2].click());await p.waitForTimeout(600);
  r=await p.evaluate(()=>({bars:document.querySelectorAll('#dd-body .dd-ev-bar').length,off:document.querySelectorAll('#kx-dc-bar .kx-dc-chip.off').length,prefs:localStorage.getItem('kx_calprefs_v1')}));
  check('eventi del telefono nascosti e chip barrato',r.bars===2&&r.off===1&&/dev:Lavoro/.test(r.prefs),r);
  await p.evaluate(()=>document.querySelectorAll('#kx-dc-bar .kx-dc-chip')[2].click());await p.waitForTimeout(600);
  r=await p.evaluate(()=>document.querySelectorAll('#dd-body .dd-ev-bar').length);
  check('secondo tocco: di nuovo visibili',r===3,r);

  console.log('3. Scheda di personalizzazione del calendario collegato');
  await p.evaluate(()=>KX.CalPrefs.open('sub:sub_test'));await p.waitForTimeout(400);
  r=await p.evaluate(()=>({sheet:!!document.getElementById('kx-dc-sheet'),title:document.querySelector('#kx-dc-sheet b')?.textContent,rows:document.querySelectorAll('#kx-dc-sheet .kx-dc-row').length,hasRemind:!!document.querySelector('#kx-dc-sheet select[data-k=remind]'),hasColor:!!document.querySelector('#kx-dc-sheet input[data-k=color]')}));
  check('scheda aperta con nome, colore, icone, dettagli, promemoria',r.sheet&&r.title==='Google Casa'&&r.hasRemind&&r.hasColor&&r.rows>=7,r);
  if(SHOTS)await p.screenshot({path:path.join(SHOTS,'daycal-2-scheda.png')});
  await p.evaluate(()=>{document.querySelector('#kx-dc-sheet .kx-dc-ic[data-ic="🏥"]').click();
    const c=document.querySelector('#kx-dc-sheet input[data-k=color]');c.value='#7848A8';c.dispatchEvent(new Event('input'));
    const l=document.querySelector('#kx-dc-sheet input[data-k=label]');l.value='Casa (Google)';l.dispatchEvent(new Event('input'));
    const s=document.querySelector('#kx-dc-sheet select[data-k=remind]');s.value='30';s.dispatchEvent(new Event('change'));
    document.querySelector('#kx-dc-sheet .kx-dc-sw[data-k=loc]').click();
    document.querySelector('#kx-dc-sheet .kx-dc-ok').click();});
  await p.waitForTimeout(700);
  r=await p.evaluate(k=>{const bars=[...document.querySelectorAll('#dd-body .dd-ev-bar')];const bar=bars.find(x=>x._evData.ev._sub==='sub_test');
    return{title:bar.querySelector('.dd-ev-title').textContent,color:bar.style.backgroundColor,locHidden:getComputedStyle(bar.querySelector('.dd-ev-loc')).display==='none',chip:document.querySelectorAll('#kx-dc-bar .kx-dc-chip')[1].textContent.trim(),
      ev:S.events[k].find(e=>e._sub==='sub_test'),sub:KX.SUBS.list.find(s=>s.id==='sub_test').color,sheetGone:!document.getElementById('kx-dc-sheet')};},key);
  check('icona davanti al titolo, nome e chip aggiornati',/^🏥 Dentista$/.test(r.title)&&/Casa \(Google\)/.test(r.chip)&&r.sheetGone,r);
  check('colore applicato all\'evento, alla barra e al collegamento',String(r.ev.color).toLowerCase()==='#7848a8'&&String(r.sub).toLowerCase()==='#7848a8'&&/120, 72, 168/.test(r.color),{ev:r.ev.color,sub:r.sub,bar:r.color});
  check('luogo nascosto per quel calendario',r.locHidden,r.locHidden);
  check('promemoria 30 min impostato sull\'evento collegato',r.ev.reminder===30&&r.ev._calRem===1,{rem:r.ev.reminder});
  if(SHOTS)await p.screenshot({path:path.join(SHOTS,'daycal-3-personalizzato.png')});

  console.log('4. Backup e azzeramento');
  r=await p.evaluate(()=>{const bk=buildFullBackup();return{has:!!(bk.calPrefs&&bk.calPrefs['sub:sub_test']),icon:bk.calPrefs&&bk.calPrefs['sub:sub_test']&&bk.calPrefs['sub:sub_test'].icon};});
  check('le preferenze entrano nel backup completo',r.has&&r.icon==='🏥',r);
  await p.evaluate(()=>{KX.CalPrefs.open('sub:sub_test');});await p.waitForTimeout(300);
  await p.evaluate(()=>document.querySelector('#kx-dc-sheet .kx-dc-reset').click());await p.waitForTimeout(600);
  r=await p.evaluate(k=>({pref:KX.CalPrefs.get('sub:sub_test'),title:[...document.querySelectorAll('#dd-body .dd-ev-bar')].find(x=>x._evData.ev._sub==='sub_test').querySelector('.dd-ev-title').textContent,rem:S.events[k].find(e=>e._sub==='sub_test').reminder}),key);
  check('azzera: preferenze tolte, titolo e promemoria ripristinati',!r.pref.icon&&r.pref.loc===true&&r.title==='Dentista'&&r.rem===undefined,r);
  check('nessun errore JS',errors.length===0,errors);
  await b.close();
  console.log(fails?`\n${fails} controlli FALLITI`:'\nTUTTO OK');process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
