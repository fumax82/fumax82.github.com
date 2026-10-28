/* ──────────────────────────────────────────────────────────────────
   nl-test.js — prova il parser in linguaggio naturale in una lingua.
   Apre l'app con la lingua scelta e fa leggere al parser le frasi di
   esempio del pacchetto (sampleSentence / sampleVoice / sampleFull)
   più quelle passate sulla riga di comando.
   Uso: node Kalend/tools/nl-test.js <lingua> ["frase" ...]
   ────────────────────────────────────────────────────────────────── */
const path=require('path');const fs=require('fs');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..');
const PAGE='file://'+path.join(ROOT,'www','index.html');
const lang=process.argv[2]||'it';const extra=process.argv.slice(3);
(async()=>{
  const browser=await chromium.launch({args:['--allow-file-access-from-files']});
  const page=await (await browser.newContext({viewport:{width:412,height:915},locale:lang})).newPage();
  await page.addInitScript(`window.KalendNative={updateWidget(){},setReminders(){},vibrate(){},setBarColor(){},setSecure(){},openSettings(){},testReminder(){},reliability(){return'{}'},vaultDel(){},takeListQueue(){return'[]'},speechStop(){},speechCancel(){},snoozeAlert(){}};`);
  await page.addInitScript(l=>{try{const k='cal_settings_v1';const c=JSON.parse(localStorage.getItem(k)||'{}');c.language=l;localStorage.setItem(k,JSON.stringify(c));localStorage.setItem('cal_onboard_v1','1');localStorage.setItem('kx_qs_v1','1');}catch(e){}},lang);
  const errors=[];page.on('pageerror',e=>errors.push(String(e.message||e)));
  await page.goto(PAGE);await page.waitForTimeout(3500);
  const res=await page.evaluate((extra)=>{
    const p=(KX.Lang&&KX.Lang.pack())||{};const c=p.culture||{};
    const phrases=[c.sampleSentence,c.sampleVoice,c.sampleFull].filter(Boolean).concat(extra);
    return{lang:L10N.resolvedLang,locale:L10N.locale,hasPack:!!(window.KX_PACKS||{})[L10N.resolvedLang],
      out:phrases.map(s=>{let canon='',r=null,err='';try{canon=KX.Lang.canonicalize(s);r=KX.NL2.parse(s);}catch(e){err=String(e);}
        return{s,canon,err,title:r&&r.title,dates:r&&r.dates,start:r&&r.start,end:r&&r.end,loc:r&&r.location,people:r&&r.people,tags:r&&r.tags,rem:r&&(r.reminders||r.reminder),rrule:r&&r.rrule,allDay:r&&r.allDay,pri:r&&r.priority};})};
  },extra);
  console.log(`lingua ${res.lang} (${res.locale}) pacchetto: ${res.hasPack?'sì':'NO'}`);
  res.out.forEach(o=>{console.log('\n» '+o.s);if(o.canon&&o.canon!==o.s)console.log('  canon: '+o.canon);if(o.err)console.log('  ERRORE: '+o.err);
    const hm=m=>m==null?'':String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
    console.log(`  titolo: ${o.title} | date: ${(o.dates||[]).slice(0,3).join(',')}${(o.dates||[]).length>3?'…('+o.dates.length+')':''} | ora: ${hm(o.start)}${o.end!=null?'–'+hm(o.end):''}${o.allDay?' (tutto il giorno)':''}`);
    console.log(`  luogo: ${o.loc||''} | persone: ${(o.people||[]).join(', ')} | tag: ${(o.tags||[]).join(', ')} | preavviso: ${JSON.stringify(o.rem)} | ricorrenza: ${o.rrule?JSON.stringify(o.rrule).slice(0,80):''} | priorità: ${o.pri||''}`);});
  if(errors.length)console.log('\nERRORI JS:\n'+errors.join('\n'));
  await browser.close();
})().catch(e=>{console.error(e);process.exit(2);});
