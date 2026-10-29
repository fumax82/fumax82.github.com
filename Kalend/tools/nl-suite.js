/* ──────────────────────────────────────────────────────────────────
   nl-suite.js — banco di prova del parser in linguaggio naturale,
   una lingua alla volta, con frasi e risultati ATTESI.

   Le frasi stanno in tools/nl-suite/<lingua>.json:
   {
     "lang": "de",
     "cases": [
       { "s": "Abendessen mit Anna am Freitag um 20 Uhr in Berlin #familie",
         "expect": { "title": "Abendessen", "date": "wd:5", "start": "20:00",
                     "loc": "Berlin", "people": ["Anna"], "tags": ["familie"] },
         "note": "frase tipica" },
       …
     ]
   }
   Chiavi di "expect" (tutte facoltative; si controllano solo quelle presenti):
     title            titolo esatto (confronto senza maiuscole/minuscole)
     titleIncludes    il titolo contiene questo testo
     titleNot         il titolo NON contiene questo testo (prova di conflitto)
     date             "+N" (oggi+N giorni) · "wd:N" (prossimo giorno N, 0=dom)
                      · "YYYY-MM-DD" · "md:M-D" (prossimo M/D) · "nextweek"
                      · "weekend" · "today" · "dom:N" (prossimo giorno N del mese) · "none" (nessuna data)
     dates            numero di date attese (ricorrenze espanse)
     start, end       "HH:MM" (end "auto" = calcolata dalla durata predefinita)
     allDay           true/false
     loc              luogo esatto (senza maiuscole/minuscole) · "" = nessuno
     people           elenco (ordine libero) · [] = nessuno
     tags             elenco · [] = nessuno
     rem              minuti di preavviso (numero)
     rrule            { "freq": "WEEKLY", "interval": 2, "byday": [1,4], "count": 5, "until": "md:12-20" }
                      · null = nessuna ricorrenza
     pri              "urgent" | "important" | null
     desc             descrizione (contiene)

   Uso:  node Kalend/tools/nl-suite.js <lingua|all> [--page <index.html>] [--only <n>] [--verbose]
   Esce con 1 se qualche caso fallisce. Serve www/index.html costruito
   (node Kalend/tools/build.js), o la pagina passata con --page.
   ────────────────────────────────────────────────────────────────── */
const path=require('path');const fs=require('fs');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..');
const args=process.argv.slice(2);
const opt=(n,d)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:d;};
const VERBOSE=args.includes('--verbose');
const PAGE='file://'+(opt('page')?path.resolve(opt('page')):path.join(ROOT,'www','index.html'));
const SUITE_DIR=path.join(__dirname,'nl-suite');
const want=args[0]&&!args[0].startsWith('--')?args[0]:'all';
const ONLY=opt('only')?+opt('only'):null;

const STUB=`window.KalendNative={updateWidget(){},setReminders(){},vibrate(){},setBarColor(){},setSecure(){},openSettings(){},testReminder(){},reliability(){return'{}'},vaultDel(){},takeListQueue(){return'[]'},speechStop(){},speechCancel(){},snoozeAlert(){}};
try{localStorage.setItem('cal_onboard_v1','1');localStorage.setItem('kx_qs_v1','1');localStorage.setItem('kx_legal_seen_v1','1');}catch(e){}`;

/* date attese, calcolate come fa il parser (giorno locale) */
const pad=n=>String(n).padStart(2,'0');
const key=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const addD=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
function expectDate(spec){
  const today=new Date();today.setHours(0,0,0,0);
  if(spec==='today')return key(today);
  if(/^[+-]\d+$/.test(spec))return key(addD(today,+spec));
  if(/^\d{4}-\d{2}-\d{2}$/.test(spec))return spec;
  let m;
  if((m=spec.match(/^wd:(\d)$/))){let d=addD(today,0);if(d.getDay()===+m[1])d=addD(d,7);while(d.getDay()!==+m[1])d=addD(d,1);return key(d);}
  if((m=spec.match(/^md:(\d{1,2})-(\d{1,2})$/))){let d=new Date(today.getFullYear(),+m[1]-1,+m[2]);if(d<today)d=new Date(today.getFullYear()+1,+m[1]-1,+m[2]);return key(d);}
  if((m=spec.match(/^dom:(\d{1,2})$/))){const n=+m[1];let d=new Date(today.getFullYear(),today.getMonth(),n);if(d<today)d=new Date(today.getFullYear(),today.getMonth()+1,n);return key(d);}   /* v56: prossimo giorno N del mese */
  if(spec==='nextweek'){let d=addD(today,1);while(d.getDay()!==1)d=addD(d,1);return key(d);}
  if(spec==='weekend'){let d=new Date(today);while(d.getDay()!==6)d=addD(d,1);return key(d);}
  return spec;
}
const hm=m=>m==null?null:pad(Math.floor(m/60))+':'+pad(m%60);
const low=s=>String(s==null?'':s).toLowerCase().replace(/\s+/g,' ').trim();
const sameSet=(a,b)=>{a=(a||[]).map(low).sort();b=(b||[]).map(low).sort();return a.length===b.length&&a.every((x,i)=>x===b[i]);};

/* confronta risultato e attese: restituisce l'elenco delle differenze */
function diff(r,e){
  const out=[];
  if(!r){out.push('nessun risultato');return out;}
  if(e.title!=null&&low(r.title)!==low(e.title))out.push(`titolo «${r.title}» ≠ «${e.title}»`);
  if(e.titleIncludes!=null&&!low(r.title).includes(low(e.titleIncludes)))out.push(`titolo «${r.title}» non contiene «${e.titleIncludes}»`);
  if(e.titleNot!=null&&low(r.title).includes(low(e.titleNot)))out.push(`titolo «${r.title}» contiene «${e.titleNot}»`);
  if(e.date!=null){const d0=(r.dates||[])[0]||null;if(e.date==='none'){if(d0)out.push(`data ${d0} ma non attesa`);}else{const ex=expectDate(e.date);if(d0!==ex)out.push(`data ${d0} ≠ ${ex}`);}}
  if(e.dates!=null&&(r.dates||[]).length!==e.dates)out.push(`${(r.dates||[]).length} date ≠ ${e.dates}`);
  if(e.start!==undefined){const s=hm(r.start);if(e.start===null?s!==null:s!==e.start)out.push(`inizio ${s} ≠ ${e.start}`);}
  if(e.end!==undefined&&e.end!=='auto'){const s=hm(r.end);if(e.end===null?s!==null:s!==e.end)out.push(`fine ${s} ≠ ${e.end}`);}
  if(e.allDay!=null&&!!r.allDay!==!!e.allDay)out.push(`tutto il giorno ${!!r.allDay} ≠ ${e.allDay}`);
  if(e.loc!=null&&low(r.location)!==low(e.loc))out.push(`luogo «${r.location||''}» ≠ «${e.loc}»`);
  if(e.people!=null&&!sameSet(r.people,e.people))out.push(`persone [${(r.people||[]).join(', ')}] ≠ [${e.people.join(', ')}]`);
  if(e.tags!=null&&!sameSet(r.tags,e.tags))out.push(`tag [${(r.tags||[]).join(', ')}] ≠ [${e.tags.join(', ')}]`);
  if(e.rem!==undefined){const got=Array.isArray(r.reminders)&&r.reminders.length?r.reminders[0]:r.reminder;if(e.rem===null?got!=null:got!==e.rem)out.push(`preavviso ${got} ≠ ${e.rem}`);}
  if(e.pri!==undefined&&(r.priority||null)!==(e.pri||null))out.push(`priorità ${r.priority||null} ≠ ${e.pri||null}`);
  if(e.desc!=null&&!low(r.desc).includes(low(e.desc)))out.push(`descrizione «${r.desc||''}» non contiene «${e.desc}»`);
  if(e.rrule!==undefined){
    if(e.rrule===null){if(r.rrule)out.push(`ricorrenza ${JSON.stringify(r.rrule)} ma non attesa`);}
    else if(!r.rrule)out.push('nessuna ricorrenza');
    else{const x=e.rrule,g=r.rrule;
      if(x.freq&&g.freq!==x.freq)out.push(`ricorrenza ${g.freq} ≠ ${x.freq}`);
      if(x.interval!=null&&(g.interval||1)!==x.interval)out.push(`intervallo ${g.interval||1} ≠ ${x.interval}`);
      if(x.byday&&!sameSet((g.byday||[]).map(String),x.byday.map(String)))out.push(`giorni [${(g.byday||[]).join(',')}] ≠ [${x.byday.join(',')}]`);
      if(x.count!=null&&g.count!==x.count)out.push(`conteggio ${g.count} ≠ ${x.count}`);
      if(x.until!=null&&g.until!==expectDate(x.until))out.push(`fine ${g.until} ≠ ${expectDate(x.until)}`);
      if(x.nth!=null&&g.nth!==x.nth)out.push(`ordinale ${g.nth} ≠ ${x.nth}`);}
  }
  return out;
}

async function runLang(browser,lang){
  const file=path.join(SUITE_DIR,lang+'.json');
  if(!fs.existsSync(file)){console.log(`\n[${lang}] nessun file ${path.relative(ROOT,file)}`);return{lang,n:0,fail:0,missing:true};}
  const suite=JSON.parse(fs.readFileSync(file,'utf8'));
  const ctx=await browser.newContext({viewport:{width:412,height:915},locale:suite.locale||lang});
  const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e.message||e)));
  await page.addInitScript(STUB);
  await page.goto(PAGE);await page.waitForTimeout(2500);
  const info=await page.evaluate(()=>({lang:L10N.resolvedLang,locale:L10N.locale,pack:!!(window.KX_PACKS||{})[L10N.resolvedLang]}));
  const cases=suite.cases.filter((c,i)=>ONLY==null||i+1===ONLY);
  const results=await page.evaluate(cs=>cs.map(c=>{let r=null,err='',canon='';try{canon=KX.Lang&&KX.Lang.canonicalize?KX.Lang.canonicalize(c.s):'';r=KX.NL2.parse(c.s);}catch(e){err=String(e&&e.stack||e);}
    return r?{title:r.title,dates:r.dates,start:r.start,end:r.end,allDay:!!r.allDay,location:r.location,people:r.people,tags:r.tags,reminder:r.reminder,reminders:r.reminders,rrule:r.rrule,priority:r.priority,desc:r.desc,_canon:canon,_err:err}:{_err:err,_canon:canon};}),cases);
  let fail=0;
  console.log(`\n[${lang}] ${info.lang} (${info.locale}) pacchetto: ${info.pack?'sì':'NO'} · ${cases.length} frasi`);
  cases.forEach((c,i)=>{
    const r=results[i];const d=r._err?['ERRORE '+r._err.split('\n')[0]]:diff(r,c.expect||{});
    const idx=ONLY!=null?ONLY:i+1;
    if(d.length){fail++;console.log(`  ✘ ${idx}. ${c.s}`);d.forEach(x=>console.log('      · '+x));if(r._canon&&r._canon!==c.s)console.log('      canon: '+r._canon);
      console.log(`      ottenuto: titolo «${r.title}» · date ${(r.dates||[]).slice(0,3).join(',')} · ${hm(r.start)}${r.end!=null?'–'+hm(r.end):''}${r.allDay?' (giornata)':''} · luogo «${r.location||''}» · persone [${(r.people||[]).join(', ')}] · tag [${(r.tags||[]).join(', ')}] · preavviso ${r.reminder} · ricorrenza ${r.rrule?JSON.stringify(r.rrule).slice(0,70):'—'}`);}
    else if(VERBOSE)console.log(`  ✔ ${idx}. ${c.s}`);
  });
  if(errors.length)console.log('  ERRORI JS: '+errors.join(' | '));
  console.log(`  → ${cases.length-fail}/${cases.length} ok`);
  await ctx.close();
  return{lang,n:cases.length,fail,jsErrors:errors.length};
}

(async()=>{
  const langs=want==='all'?fs.readdirSync(SUITE_DIR).filter(f=>/^[a-z]{2}\.json$/.test(f)).map(f=>f.slice(0,2)).sort():[want];
  const browser=await chromium.launch({args:['--allow-file-access-from-files']});
  const tot=[];
  for(const l of langs)tot.push(await runLang(browser,l));
  await browser.close();
  const n=tot.reduce((a,b)=>a+b.n,0),f=tot.reduce((a,b)=>a+b.fail,0);
  console.log(`\nTOTALE: ${n-f}/${n} frasi ok in ${tot.length} lingue`+(f?` · ${f} FALLITE (${tot.filter(t=>t.fail).map(t=>t.lang+':'+t.fail).join(', ')})`:' · TUTTO OK'));
  process.exit(f?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
