#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   COLLAUDO DEL MODULO LEGALE (src/modules/90-legal.js) E DELLA CSP
   · 20 lingue in window.KX_LEGAL, stessa struttura, segnaposto sostituiti
   · pagina «Informazioni legali»: apertura, schede, lingua
   · informativa PRIMA della posizione: appare, «Continua» chiama il
     sistema, «Non ora» no; la seconda volta non appare più
   · informativa prima della dettatura (ponte nativo) e delle notifiche
   · avviso di aggiornamento dei testi; pulsante nelle impostazioni
   · CSP connect-src ristretta agli host dei servizi
   Uso: node Kalend/tools/legal-test.js
══════════════════════════════════════════════════════════════════ */
const path=require('path');const fs=require('fs');const {chromium}=require('playwright');const ROOT=path.resolve(__dirname,'..');
const PAGE='file://'+path.join(__dirname,'..','www','index.html');
const STUB=`window.__native=[];
window.KalendNative={httpGet:(id,u)=>setTimeout(()=>window.__knCb(id,false,'HTTP 404'),5),
  speech:(id,...a)=>{window.__native.push(['speech',id]);},speechLive:(id)=>{window.__native.push(['speechLive',id]);},
  calPermission:(id)=>{window.__native.push(['calPermission',id]);setTimeout(()=>window.__knCb(id,true,'granted'),5);},
  notifPermission:(id)=>{window.__native.push(['notifPermission',id]);setTimeout(()=>window.__knCb(id,true,'granted'),5);},
  updateWidget:()=>{},setReminders:()=>{},vibrate:()=>{},setBarColor:()=>{},setSecure:()=>{},openSettings:()=>{},testReminder:()=>{},reliability:()=>'{}',vaultDel:()=>{},takeListQueue:()=>'[]',speechStop:()=>{},speechCancel:()=>{},snoozeAlert:()=>{}};
window.__geo=[];
Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition:(ok,err)=>{window.__geo.push('called');ok({coords:{latitude:45.46,longitude:9.19,accuracy:50}});}},configurable:true});
try{localStorage.setItem('cal_onboard_v1','1');localStorage.setItem('kx_qs_v1','1');}catch(e){}`;
let fails=0;const check=(n,ok,i)=>{console.log((ok?'  ✔ ':'  ✘ ')+n+(ok?'':'   → '+i));if(!ok)fails++;};
(async()=>{
  const b=await chromium.launch({args:['--allow-file-access-from-files']});const p=await (await b.newContext({locale:'it'})).newPage();
  const errors=[];p.on('pageerror',e=>errors.push(String(e.message||e)));
  await p.addInitScript(STUB);await p.goto(PAGE);await p.waitForTimeout(2800);
  /* chiude il sipario di apertura come farebbe l'utente */
  await p.evaluate(()=>{document.getElementById('kx-intro')?.click();document.querySelector('#kx-tip button')?.click();});await p.waitForTimeout(900);

  console.log('1. Testi');
  /* v55 · 1.13: italiano e inglese sono nella pagina, le altre lingue nel file i18n/<lingua>.json */
  let r=await p.evaluate(()=>{const L=Object.assign({},window.KX_LEGAL||{});return {inline:Object.keys(L),lang:KX.Legal.lang()};});
  {const L={};const dir=path.join(ROOT,'www','i18n');
    for(const f of fs.readdirSync(dir).filter(f=>/^[a-z]{2}\.json$/.test(f))){const j=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));if(j.legal)L[f.slice(0,2)]=j.legal;}
    const langs=Object.keys(L);const bad=langs.filter(l=>!(L[l].eula&&L[l].eula.sections.length===10&&L[l].privacy.sections.length===10&&Object.keys(L[l].disclose).length===5&&L[l].ui&&L[l].ui.ok));
    const ph=langs.filter(l=>/\{\{[A-Z_]+\}\}/.test(JSON.stringify(L[l])));r=Object.assign(r,{n:langs.length,bad,ph});}
  check('20 lingue, 10+10 sezioni e 5 informative ciascuna (file per lingua)',r.n===20&&r.bad.length===0&&r.inline.length===2,JSON.stringify(r));
  check('nessun segnaposto {{…}} rimasto',r.ph.length===0,JSON.stringify(r.ph));
  check('lingua corrente riconosciuta (it)',r.lang==='it',r.lang);

  console.log('2. Pagina legale');
  r=await p.evaluate(()=>{KX.Legal.open('privacy');const el=document.getElementById('kx-legal-sheet');const out={open:el&&el.classList.contains('open'),h2:el&&el.querySelector('h2')&&el.querySelector('h2').textContent,n:el?el.querySelectorAll('h3').length:0};
    el.querySelector('[data-tab="credits"]').click();out.cr=el.querySelectorAll('.kx-legal-cr li').length;KX.Legal.close();out.closed=!el.classList.contains('open');out.btn=!!document.getElementById('set-legal');return out;});
  check('si apre sulla privacy con 10 sezioni',r.open&&/privacy/i.test(r.h2||'')&&r.n===10,JSON.stringify(r));
  check('scheda crediti con attribuzioni (MET Norway, GeoNames…)',r.cr>=4,String(r.cr));
  check('chiusura e pulsante «Informazioni legali» nelle impostazioni',r.closed&&r.btn,JSON.stringify([r.closed,r.btn]));

  console.log('3. Informativa prima della posizione');
  r=await p.evaluate(async()=>{
    const out={};
    /* all'avvio l'app chiede la posizione: deve apparire PRIMA l'informativa, senza chiamate al sistema */
    const st=document.querySelector('.kx-disc');out.startupShown=!!st;out.calledAtStart=window.__geo.length;
    if(st){st.querySelector('.kx-disc-no').click();await new Promise(r=>setTimeout(r,150));}
    const p1=new Promise(res=>navigator.geolocation.getCurrentPosition(()=>res('ok'),()=>res('err')));
    await new Promise(r=>setTimeout(r,100));const ov=document.querySelector('.kx-disc');out.shown=!!ov;out.calledBefore=window.__geo.length;
    if(ov)ov.querySelector('.kx-disc-no').click();out.first=await p1;out.calledAfterNo=window.__geo.length;
    const p2=new Promise(res=>navigator.geolocation.getCurrentPosition(()=>res('ok'),()=>res('err')));
    await new Promise(r=>setTimeout(r,100));const ov2=document.querySelector('.kx-disc');out.shown2=!!ov2;if(ov2)ov2.querySelector('.kx-disc-ok').click();out.second=await p2;out.calledAfterOk=window.__geo.length;
    const p3=new Promise(res=>navigator.geolocation.getCurrentPosition(()=>res('ok'),()=>res('err')));
    await new Promise(r=>setTimeout(r,100));out.shown3=!!document.querySelector('.kx-disc');out.third=await p3;
    return out;});
  check('all\'avvio: informativa mostrata e nessuna chiamata al sistema prima di essa',r.startupShown&&r.calledAtStart===0,JSON.stringify([r.startupShown,r.calledAtStart]));
  check('appare prima della richiesta; «Non ora» → nessuna chiamata al sistema, errore all\'app',r.shown&&r.calledBefore===0&&r.first==='err'&&r.calledAfterNo===0,JSON.stringify(r));
  check('«Continua» → chiamata al sistema; la terza volta nessuna informativa',r.shown2&&r.second==='ok'&&r.calledAfterOk===1&&!r.shown3&&r.third==='ok',JSON.stringify(r));

  console.log('4. Informativa prima della dettatura e delle notifiche (ponte nativo)');
  r=await p.evaluate(async()=>{
    const out={};window.KalendNative.speech(777,'it');await new Promise(r=>setTimeout(r,80));
    const ov=document.querySelector('.kx-disc');out.shown=!!ov;out.title=ov&&ov.querySelector('b').textContent;out.before=window.__native.filter(x=>x[0]==='speech').length;
    if(ov)ov.querySelector('.kx-disc-ok').click();await new Promise(r=>setTimeout(r,80));out.after=window.__native.filter(x=>x[0]==='speech').length;
    window.KalendNative.notifPermission(778);await new Promise(r=>setTimeout(r,80));const ov2=document.querySelector('.kx-disc');out.notifShown=!!ov2;if(ov2)ov2.querySelector('.kx-disc-ok').click();await new Promise(r=>setTimeout(r,80));out.notifCalled=window.__native.some(x=>x[0]==='notifPermission');
    return out;});
  check('dettatura: informativa «Microfono», nativo chiamato solo dopo «Continua»',r.shown&&/Microfono/.test(r.title||'')&&r.before===0&&r.after===1,JSON.stringify(r));
  check('notifiche: informativa mostrata, poi richiesta al sistema',r.notifShown&&r.notifCalled,JSON.stringify(r));

  console.log('5. Avviso di aggiornamento e CSP');
  r=await p.evaluate(()=>({bar:!!document.getElementById('kx-legal-bar'),txt:(document.getElementById('kx-legal-bar')||{}).textContent}));
  check('barra «termini aggiornati» presente',r.bar&&/aggiornat/i.test(r.txt||''),JSON.stringify(r));
  const html=fs.readFileSync(path.join(__dirname,'..','www','index.html'),'utf8');const csp=(html.match(/connect-src ([^;]*);/)||[])[1]||'';
  check('CSP connect-src: solo self + host dei servizi (niente https: generico)',/api\.met\.no/.test(csp)&&/photon\.komoot\.io/.test(csp)&&!/\shttps:(\s|$)/.test(csp),csp);
  check('nessun errore JS',errors.length===0,errors.join(' | '));
  await b.close();console.log(fails?`\n${fails} controlli FALLITI`:'\nTUTTO OK');process.exit(fails?1:0);
})();
