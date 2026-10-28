#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   COLLAUDO DI SICUREZZA (modulo 95-security.js + sincronizzazione QR)
   · backup cifrato: cifra/decifra, password errata rifiutata, formato
   · export in chiaro senza posizione di casa, località e chiavi
   · lista bianca delle impostazioni: chiavi ignote e valori assurdi scartati
   · sincronizzazione: codice di verifica uguale per i due lati e diverso
     per un terzo; QR scaduto rifiutato; coordinate di casa tolte dal
     pacchetto; testo del QR non più salvato; stato in arrivo ignorato
     dal cellulare
   · un solo gestore dell'import; campi ostili ancora innocui (XSS)
   Uso: node Kalend/tools/sec-test.js
══════════════════════════════════════════════════════════════════ */
const path=require('path');const fs=require('fs');const {chromium}=require('playwright');
const PAGE='file://'+path.join(__dirname,'..','www','index.html');
const STUB=`window.KalendNative={httpGet:(id,u)=>setTimeout(()=>window.__knCb(id,false,'HTTP 404'),5),updateWidget:()=>{},setReminders:()=>{},vibrate:()=>{},setBarColor:()=>{},setSecure:()=>{},openSettings:()=>{},testReminder:()=>{},reliability:()=>'{}',vaultDel:()=>{},takeListQueue:()=>'[]',speechStop:()=>{},speechCancel:()=>{},snoozeAlert:()=>{}};try{localStorage.setItem('cal_onboard_v1','1');localStorage.setItem('kx_qs_v1','1');localStorage.setItem('kx_disclosed_v1','{"location":1,"mic":1,"calendar":1,"notif":1}');localStorage.setItem('kx_legal_seen_v1','x');}catch(e){}`;
let fails=0;const check=(n,ok,i)=>{console.log((ok?'  ✔ ':'  ✘ ')+n+(ok?'':'   → '+i));if(!ok)fails++;};
(async()=>{
  const b=await chromium.launch();const p=await (await b.newContext({locale:'it'})).newPage();
  const errors=[];p.on('pageerror',e=>errors.push(String(e.message||e)));
  await p.addInitScript(STUB);await p.goto(PAGE);await p.waitForTimeout(2600);
  await p.evaluate(()=>{document.getElementById('kx-intro')?.click();});

  console.log('1. Backup cifrato');
  let r=await p.evaluate(async()=>{
    const S=KX.Secure;const obj={app:'lavagna-cal',version:23,events:{'2026-10-28':[{title:'Segreto',startMin:600,durationMin:60}]},settings:{homeGeo:{lat:45.46,lon:9.19},defaultLocation:'Milano',theme:'sky'}};
    const t0=Date.now();const env=await S.encryptBackup(obj,'password-lunga');const t1=Date.now();
    const out={app:env.app,iter:env.iter,hasPlain:JSON.stringify(env).includes('Segreto')||JSON.stringify(env).includes('45.46'),ms:t1-t0};
    const back=await S.decryptWith(env,'password-lunga');out.round=JSON.stringify(back)===JSON.stringify(obj);
    try{await S.decryptWith(env,'password-sbagliata');out.wrong='accettata';}catch(e){out.wrong='rifiutata';}
    try{await S.decryptWith({app:'lavagna-cal-enc',kdf:'altro'},'x');out.fmt='accettato';}catch(e){out.fmt='rifiutato';}
    const plain=S.stripPrivate(obj);out.stripped=!plain.settings.homeGeo&&!plain.settings.defaultLocation&&plain.settings.theme==='sky'&&!!plain.events['2026-10-28'];
    return out;});
  check('formato lavagna-cal-enc, 600.000 iterazioni, nessun testo in chiaro',r.app==='lavagna-cal-enc'&&r.iter===600000&&!r.hasPlain,JSON.stringify(r));
  check('cifra/decifra identico; password errata e formato ignoto rifiutati',r.round&&r.wrong==='rifiutata'&&r.fmt==='rifiutato',JSON.stringify(r));
  check('export in chiaro senza posizione di casa e località predefinita',r.stripped,'');

  console.log('2. Lista bianca delle impostazioni');
  r=await p.evaluate(()=>{const c=KX.Secure.cleanSettings({language:'ja',country:'JP',theme:'sky',accent:'#2AABB8',defDuration:45,featMeteo:true,wxSource:'owm',tempUnit:'F',homeGeo:{lat:35.69,lon:139.69},
    __proto__x:1,sconosciuta:'x',openMeteoKey:'chiave',holidays:{a:1},country2:'ITALIA',defDurationBad:1,accentBad:'url(x)',language2:'<script>'});
    const bad=KX.Secure.cleanSettings({language:'<script>alert(1)</script>',country:'italia',accent:'javascript:x',defDuration:99999,wxSource:'pirata',homeGeo:{lat:999,lon:1},featMeteo:'sì',defaultLocation:'a\u0000b'.repeat(100)});
    return {ok:c,bad};});
  check('chiavi note conservate con i loro valori',r.ok.language==='ja'&&r.ok.country==='JP'&&r.ok.defDuration===45&&r.ok.wxSource==='owm'&&r.ok.homeGeo&&r.ok.homeGeo.lat===35.69,JSON.stringify(r.ok));
  check('chiavi ignote, chiave API e festività scartate',!('sconosciuta' in r.ok)&&!('openMeteoKey' in r.ok)&&!('holidays' in r.ok)&&!('country2' in r.ok),JSON.stringify(Object.keys(r.ok)));
  check('valori assurdi scartati o ripuliti',!('language' in r.bad)&&!('country' in r.bad)&&!('accent' in r.bad)&&!('defDuration' in r.bad)&&!('wxSource' in r.bad)&&!('homeGeo' in r.bad)&&!('featMeteo' in r.bad)&&r.bad.defaultLocation.length<=120&&!/\u0000/.test(r.bad.defaultLocation),JSON.stringify(r.bad));

  console.log('3. Sincronizzazione QR');
  r=await p.evaluate(async()=>{
    const Y=KX.Sync;const A='AB:CD:EF:01',B='12:34:56:78',C='99:99:99:99';
    const out={ab:await Y.sasFor(A,B),ba:await Y.sasFor(B,A),ac:await Y.sasFor(A,C),empty:await Y.sasFor(A,'')};
    out.fp=Y.fingerprintOf({sdp:'v=0\\r\\na=fingerprint:sha-256 ab:cd:EF:01\\r\\n'});
    out.expired=Y.isExpired({exp:Date.now()-1});out.fresh=Y.isExpired({exp:Date.now()+60000});out.legacy=Y.isExpired({});
    out.strip=JSON.parse(Y.stripPrivate(JSON.stringify({homeGeo:{lat:1,lon:2},theme:'sky',openMeteoKey:'k'})));
    out.ttl=Y.QR_TTL;
    return out;});
  check('codice di verifica: 6 cifre, uguale nei due versi, diverso con un terzo',/^\d{3} \d{3}$/.test(r.ab)&&r.ab===r.ba&&r.ab!==r.ac&&r.empty==='',JSON.stringify(r));
  check('impronta DTLS letta dall\'SDP (maiuscola)',r.fp==='AB:CD:EF:01',r.fp);
  check('QR scaduto rifiutato; QR fresco e QR vecchi (senza scadenza) accettati; durata 2 minuti',r.expired&&!r.fresh&&!r.legacy&&r.ttl===120000,JSON.stringify(r));
  check('pacchetto di sincronizzazione senza coordinate di casa né chiavi',!r.strip.homeGeo&&!r.strip.openMeteoKey&&r.strip.theme==='sky',JSON.stringify(r.strip));
  const html=fs.readFileSync(path.join(__dirname,'..','www','index.html'),'utf8');
  check('testo del QR non più salvato in localStorage',!/localStorage\.setItem\(LS_LAST/.test(html),'');
  check('il cellulare ignora gli stati in arrivo; il tablet chiede conferma',/if\(syncRole!=='tablet'\) return;/.test(html)&&/Ricevere il calendario da questo dispositivo\?/.test(html),'');
  check('un solo gestore dell\'import nel sorgente',(html.match(/getElementById\('import-file'\)\.addEventListener\('change'/g)||[]).length===0&&/inp\.addEventListener\('change'/.test(html),'');

  console.log('4. Campi ostili restano innocui');
  r=await p.evaluate(async()=>{
    window.__xss=0;const bad='<img src=x onerror="window.__xss++">';
    const k=new Date().toISOString().slice(0,10);
    const ev=KX.cleanEvent({title:bad,description:bad,location:bad,tags:[bad],participants:[bad],color:'red;background:url(x)',startMin:600,durationMin:60});
    (S.events[k]=S.events[k]||[]).push(ev);renderAll();await new Promise(r=>setTimeout(r,400));
    try{KX.openEventById(ev.id,k);}catch(e){}await new Promise(r=>setTimeout(r,500));
    return {xss:window.__xss,imgs:document.querySelectorAll('img[src="x"]').length,title:ev.title};});
  check('nessuna esecuzione né elemento iniettato da titolo/descrizione/luogo/tag',r.xss===0&&r.imgs===0,JSON.stringify(r));
  check('nessun errore JS',errors.length===0,errors.join(' | '));
  await b.close();console.log(fails?`\n${fails} controlli FALLITI`:'\nTUTTO OK');process.exit(fails?1:0);
})();
