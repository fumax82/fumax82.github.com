/* ──────────────────────────────────────────────────────────────────
   harness.js — apre l'app in un Chromium headless (Playwright) con
   un finto ponte nativo "KalendNative", così si può collaudare la
   pagina come se girasse nell'APK.

   Uso:  node Kalend/tools/harness.js <comando> [opzioni]
     errors   [--lang xx]   → stampa gli errori JS all'avvio
     strings                → elenca i testi statici del markup
     shot <file.png> [--lang xx] [--w 412 --h 915]  → screenshot
   ────────────────────────────────────────────────────────────────── */
const path=require('path');
const fs=require('fs');
const {chromium}=require('playwright');

const ROOT=path.resolve(__dirname,'..');
const PAGE='file://'+path.join(ROOT,'www','index.html');

/* ponte nativo finto: registra le chiamate invece di eseguirle */
const NATIVE_STUB=`
  window.__native=[];
  window.KalendNative={
    updateWidget:j=>{window.__native.push(['updateWidget',j]);},
    setReminders:j=>{window.__native.push(['setReminders',j]);},
    vibrate:()=>{}, setBarColor:()=>{}, setSecure:()=>{}, openSettings:()=>{},
    testReminder:()=>{}, reliability:()=>'{}', vaultDel:()=>{}, takeListQueue:()=>'[]',
    speechStop:()=>{}, speechCancel:()=>{}, snoozeAlert:()=>{},
  };
`;

async function open({lang='it',w=412,h=915,settle=2500,stub=true}={}){
  const browser=await chromium.launch();
  const ctx=await browser.newContext({viewport:{width:w,height:h},locale:lang,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const page=await ctx.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e&&e.message||e)));
  page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|ERR_TUNNEL|net::/.test(m.text()))errors.push('console: '+m.text());});
  if(stub)await page.addInitScript(NATIVE_STUB);
  /* lingua scelta nelle impostazioni salvate, così l'app parte già tradotta */
  await page.addInitScript(l=>{try{
    const k='cal_settings_v1';
    const cur=JSON.parse(localStorage.getItem(k)||'{}');
    cur.language=l;localStorage.setItem(k,JSON.stringify(cur));
    localStorage.setItem('cal_onboard_v1','1');localStorage.setItem('kx_qs_v1','1');
  }catch(e){}},lang);
  await page.goto(PAGE);
  await page.waitForTimeout(settle);
  return {browser,page,errors};
}

async function main(){
  const [cmd,...rest]=process.argv.slice(2);
  const opt=(name,def)=>{const i=rest.indexOf('--'+name);return i>=0?rest[i+1]:def;};
  if(cmd==='errors'){
    const {browser,errors}=await open({lang:opt('lang','it')});
    console.log(errors.length?errors.join('\n'):'OK: nessun errore JS');
    await browser.close();process.exit(errors.length?1:0);
  }else if(cmd==='strings'){
    const {browser,page}=await open({lang:'it'});
    const list=await page.evaluate(()=>{
      const out=new Set();
      const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
      while(walker.nextNode()){const t=(walker.currentNode.nodeValue||'').trim();if(t.length>1)out.add(t);}
      document.querySelectorAll('[placeholder]').forEach(el=>out.add(el.getAttribute('placeholder').trim()));
      document.querySelectorAll('[title]').forEach(el=>out.add(el.getAttribute('title').trim()));
      document.querySelectorAll('[aria-label]').forEach(el=>out.add(el.getAttribute('aria-label').trim()));
      return [...out];
    });
    console.log(JSON.stringify(list,null,0));
    await browser.close();
  }else if(cmd==='shot'){
    const file=rest.find(x=>/\.png$/.test(x))||'shot.png';
    const {browser,page,errors}=await open({lang:opt('lang','it'),w:+opt('w',412),h:+opt('h',915)});
    /* --tap: chiude il sipario d'apertura e il suggerimento, così si vede il mese */
    if(rest.includes('--tap')){try{await page.evaluate(()=>{document.getElementById('kx-intro')?.click();document.querySelector('#kx-tip button')?.click();});await page.waitForTimeout(1400);}catch(e){}}
    await page.screenshot({path:file});
    console.log('salvato',file,errors.length?('\nERRORI:\n'+errors.join('\n')):'');
    await browser.close();
  }else{
    console.log('comandi: errors | strings | shot <file.png>');
  }
}
main().catch(e=>{console.error(e);process.exit(2);});
