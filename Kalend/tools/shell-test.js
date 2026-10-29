/* ──────────────────────────────────────────────────────────────────
   shell-test.js — collaudo del modulo «Guscio» (46-shell.js):
   l'ultimo pannello aperto sta sempre sopra gli altri.
   Uso: node Kalend/tools/shell-test.js
   ────────────────────────────────────────────────────────────────── */
const path=require('path');const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..');
const PAGE='file://'+path.join(ROOT,'www','index.html');
let fails=0;const check=(name,ok,info)=>{console.log(`  ${ok?'✔':'✘'} ${name}${ok||info==null?'':'   → '+(typeof info==='string'?info:JSON.stringify(info))}`);if(!ok)fails++;};
const STUB=`window.__nav=[];window.KalendNative={updateWidget(){},setReminders(){},vibrate(){},setBarColor(){},setNavColor(h){window.__nav.push(h);},setSecure(){},openSettings(){},testReminder(){},reliability(){return'{}'},vaultDel(){},takeListQueue(){return'[]'},speechStop(){},speechCancel(){},snoozeAlert(){}};
localStorage.setItem('cal_onboard_v1','1');localStorage.setItem('kx_qs_v1','1');localStorage.setItem('kx_legal_seen_v1','1');`;
const z=(p,sel)=>p.evaluate(s=>{const el=document.querySelector(s);return el?parseInt(getComputedStyle(el).zIndex,10):null;},sel);
(async()=>{
  const b=await chromium.launch({args:['--allow-file-access-from-files']});
  const ctx=await b.newContext({viewport:{width:412,height:915},locale:'it',isMobile:true,hasTouch:true});
  const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(String(e.message||e)));
  await p.addInitScript(STUB);await p.goto(PAGE);await p.waitForTimeout(2500);
  await p.evaluate(()=>{document.getElementById('kx-intro')?.remove();});

  console.log('1. Scheda → finestra di conferma → informativa: ognuna sopra la precedente');
  await p.evaluate(()=>openSheet('settings-sheet'));await p.waitForTimeout(500);
  const zSheet=await z(p,'#settings-sheet'),zOv=await z(p,'#main-overlay');
  check('scheda sopra il suo sfondo scuro',zSheet>zOv&&zSheet>=60000,{zSheet,zOv});
  p.evaluate(()=>KX.dialog('Prova','',[{t:'Ok',v:1}]));await p.waitForTimeout(400);
  const zDlg=await z(p,'#kx-dlg');
  check('finestra di conferma sopra la scheda',zDlg>zSheet,{zDlg,zSheet});
  await p.evaluate(()=>{localStorage.removeItem('kx_disclosed_v1');KX.Legal.disclose('calendar');});await p.waitForTimeout(600);
  const zDisc=await z(p,'.kx-disc');
  check('informativa (z fisso 9100) sopra finestra e scheda',zDisc>zDlg,{zDisc,zDlg});
  await p.evaluate(()=>{document.querySelector('.kx-disc .kx-disc-ok')?.click();document.querySelector('#kx-dlg button')?.click();});await p.waitForTimeout(400);

  console.log('2. Scheda per calendario (z fisso 26000) aperta sopra una finestra (z fisso 46000)');
  p.evaluate(()=>KX.dialog('Prova 2','',[{t:'Ok',v:1}]));await p.waitForTimeout(300);
  await p.evaluate(()=>KX.CalPrefs.open('own'));await p.waitForTimeout(400);
  const zDc=await z(p,'#kx-dc-ov'),zDlg2=await z(p,'#kx-dlg');
  check('personalizzazione calendario sopra la finestra',zDc>zDlg2,{zDc,zDlg2});
  await p.evaluate(()=>{document.querySelector('#kx-dc-sheet .kx-dc-ok')?.click();document.querySelector('#kx-dlg button')?.click();});await p.waitForTimeout(400);

  console.log('3. Riapertura: la scheda torna in cima');
  await p.evaluate(()=>document.getElementById('btn-settings-close').click());await p.waitForTimeout(400);
  await p.evaluate(()=>openSheet('add-event-sheet'));await p.waitForTimeout(500);
  const zAdd=await z(p,'#add-event-sheet');
  check('nuova scheda sopra tutto ciò che è stato aperto prima',zAdd>zDc,{zAdd,zDc});
  const toastZ=await p.evaluate(()=>{toast('ciao');return new Promise(r=>setTimeout(()=>r(parseInt(getComputedStyle(document.getElementById('toast')).zIndex,10)),200));});
  check('avviso (toast) sopra la scheda',toastZ>zAdd,{toastZ,zAdd});

  console.log('4. Colore della barra di navigazione comunicato al nativo');
  const nav=await p.evaluate(()=>window.__nav);
  check('setNavColor chiamato con un colore esadecimale',nav.length>0&&/^#[0-9A-F]{6}$/.test(nav[nav.length-1]),nav);
  check('nessun errore JS',errors.length===0,errors);
  await b.close();
  console.log(fails?`\n${fails} controlli FALLITI`:'\nTUTTO OK');process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
