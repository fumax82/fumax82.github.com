/* ──────────────────────────────────────────────────────────────────
   i18n-audit.js — misura la copertura delle traduzioni.

   Apre l'app (Playwright), intercetta ogni chiamata a T(), apre i
   pannelli principali e raccoglie:
     · le stringhe sorgente passate a T() durante l'uso,
     · i testi statici del markup (quelli che localizeStatic traduce),
     · le chiavi già presenti nel dizionario inglese.
   Poi confronta con i dizionari di ogni lingua e scrive:
     · <out>/keys.json      → elenco chiavi sorgente (italiano)
     · <out>/missing-<xx>.json → chiavi senza traduzione per lingua
   Uso: node Kalend/tools/i18n-audit.js <cartella-uscita> [--lang xx]
   Con --lang xx apre l'app in quella lingua ed elenca i testi rimasti
   in italiano (stringhe dinamiche che non passano da T()).
   ────────────────────────────────────────────────────────────────── */
const fs=require('fs');const path=require('path');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..');
const PAGE='file://'+path.join(ROOT,'www','index.html');
const out=process.argv[2]||path.join(ROOT,'docs','i18n');
const li=process.argv.indexOf('--lang');const LANG=li>0?process.argv[li+1]:null;

const STUB=`window.KalendNative={updateWidget(){},setReminders(){},vibrate(){},setBarColor(){},setSecure(){},openSettings(){},testReminder(){},reliability(){return'{}'},vaultDel(){},takeListQueue(){return'[]'},speechStop(){},speechCancel(){},snoozeAlert(){}};`;

/* raccolta dei testi visibili nel DOM (come localizeStatic) */
const DOM_TEXTS=`(()=>{const out=new Set();
  const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  while(w.nextNode()){const t=(w.currentNode.nodeValue||'').trim();if(t.length>1)out.add(t);}
  document.querySelectorAll('[placeholder]').forEach(el=>out.add(el.getAttribute('placeholder').trim()));
  document.querySelectorAll('[title]').forEach(el=>out.add(el.getAttribute('title').trim()));
  document.querySelectorAll('[aria-label]').forEach(el=>out.add(el.getAttribute('aria-label').trim()));
  return [...out];})()`;

/* passi di esplorazione: ogni passo apre qualcosa, poi si raccolgono i testi */
const STEPS=[
  "document.getElementById('btn-settings')?.click()",
  "document.querySelectorAll('#settings-sheet .kx-nav-row').forEach(r=>r.click())",
  "document.getElementById('btn-settings-close')?.click()",
  "document.getElementById('btn-search')?.click()","document.getElementById('btn-search-close')?.click()",
  "document.getElementById('btn-todo')?.click()","document.getElementById('btn-todo')?.click()",
  "document.getElementById('btn-alerts')?.click()","document.getElementById('btn-alerts-close')?.click()",
  "document.getElementById('btn-tag-mgr')?.click()","document.getElementById('btn-tag-mgr-close')?.click()",
  "document.getElementById('btn-participant-mgr')?.click()","document.getElementById('btn-participant-mgr-close')?.click()",
  "document.getElementById('btn-add')?.click()","document.getElementById('btn-add-close')?.click()",
  "document.getElementById('btn-filter')?.click()","document.getElementById('btn-filter-close')?.click()",
  "document.getElementById('kx-btn-menu')?.click()","document.getElementById('kx-menu-ov')?.remove()",
  "document.getElementById('kx-btn-filters')?.click()",
  "try{KX.quickStart()}catch(e){}","try{document.getElementById('kx-qs')?.remove()}catch(e){}",
  "try{showOnboarding()}catch(e){}","try{document.getElementById('onboard-overlay')?.remove()}catch(e){}",
  "try{KX.openFamilies&&KX.openFamilies()}catch(e){}",
  "try{KX.openLists&&KX.openLists()}catch(e){}",
  "try{KX.av&&KX.av.open&&KX.av.open()}catch(e){}",
  "try{Object.keys(HINTS.DEFS).forEach(k=>{T(HINTS.DEFS[k].t);T(HINTS.DEFS[k].b);})}catch(e){}",
  "try{const k=dateKey(new Date());const c=document.querySelector('.day-cell[data-key=\"'+k+'\"]');c&&c.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))}catch(e){}",
  "try{const b=document.querySelector('.tl-bar');b&&b.click()}catch(e){}",
  "try{document.getElementById('btn-view-toggle')?.click()}catch(e){}",
];

(async()=>{
  const browser=await chromium.launch();
  const ctx=await browser.newContext({viewport:{width:412,height:915},locale:LANG||'it'});
  const page=await ctx.newPage();
  await page.addInitScript(STUB);
  await page.addInitScript(l=>{try{const k='cal_settings_v1';const c=JSON.parse(localStorage.getItem(k)||'{}');c.language=l;localStorage.setItem(k,JSON.stringify(c));localStorage.setItem('cal_onboard_v1','1');localStorage.setItem('kx_qs_v1','1');}catch(e){}},LANG||'it');
  await page.goto(PAGE);await page.waitForTimeout(2500);
  /* intercetta T() */
  await page.evaluate(()=>{window.__tk=new Set();const o=L10N.T.bind(L10N);L10N.T=function(s,p){if(typeof s==='string')window.__tk.add(s);return o(s,p);};});
  const texts=new Set(await page.evaluate(DOM_TEXTS));
  for(const st of STEPS){try{await page.evaluate(st);}catch(e){}await page.waitForTimeout(350);(await page.evaluate(DOM_TEXTS)).forEach(t=>texts.add(t));}
  const tk=await page.evaluate(()=>[...window.__tk]);
  const dicts=await page.evaluate(()=>{const o={};Object.keys(L10N.DICT).forEach(l=>o[l]=Object.keys(L10N.DICT[l]));return o;});
  const supported=await page.evaluate(()=>L10N.supported);
  const EN=await page.evaluate(()=>Object.assign({},L10N.DICT.en));
  /* nomi di mesi/giorni/festività: contenuto, non interfaccia */
  const MESI_RE=(await page.evaluate(()=>MESI.join('|')));
  const dyn=new Set(await page.evaluate(()=>{const s=new Set();
    try{const dn=new Intl.DisplayNames([L10N.locale],{type:'region'});[...document.querySelectorAll('#set-country option')].forEach(o=>{s.add(o.textContent.trim());});}catch(e){}
    try{Object.values(L10N.ENDONYMS).forEach(x=>s.add(x));}catch(e){}MESI.forEach(m=>s.add(m));GIORNI_FULL.forEach(d=>s.add(d));DAY_LABELS.forEach(d=>s.add(d));DAY_ABBR1.forEach(d=>s.add(d));
    try{Object.values(AppSettings.holidays||{}).flat().forEach(h=>s.add(h.name));}catch(e){}
    try{document.querySelectorAll('.holiday-label,.tl-bar,.ev-title,.kx-hol').forEach(el=>s.add(el.textContent.trim()));}catch(e){}
    try{Object.values(S.events||{}).flat().forEach(ev=>{s.add(ev.title);(ev.tags||[]).forEach(t=>s.add(t));(ev.participants||[]).forEach(t=>s.add(t));s.add(ev.location);});}catch(e){}
    return [...s];}));
  await browser.close();
  if(LANG){
    /* modalità verifica: testi ancora in italiano nella lingua scelta */
    const it=JSON.parse(fs.readFileSync(path.join(out,'keys.json'),'utf8'));
    const itSet=new Set(it);
    const left=[...texts].filter(t=>itSet.has(t)&&!dyn.has(t)&&!/^[\d\s:.,\-–—/+%°'·]+$/.test(t));
    console.log(`[${LANG}] testi ancora in italiano: ${left.length}`);left.forEach(t=>console.log('  · '+t));
    return;
  }
  /* i testi statici che non passano da T() si tengono solo se sembrano
     interfaccia: iniziano con maiuscola, emoji o simbolo (le parole chiave
     dell'auto-tag sono minuscole e vengono localizzate a parte) */
  const monthRe=new RegExp('^('+MESI_RE+')\\s+\\d{4}$','u');
  const isUi=t=>!dyn.has(t)&&/\p{L}{2}/u.test(t)&&!/^\d/.test(t)&&t.length<=600&&!monthRe.test(t)&&!/^\p{Ll}/u.test(t)&&!/ · usata da |KX_I18N|^\/\*/.test(t);
  const suspects=[...texts].filter(t=>isUi(t)&&!dicts.en.includes(t)&&!tk.includes(t)&&/[\d"«»]/.test(t));
  const keys=new Set([...dicts.en,...tk,...[...texts].filter(t=>isUi(t)&&!suspects.includes(t))]);
  fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'dynamic-suspects.json'),JSON.stringify(suspects,null,1));
  fs.mkdirSync(out,{recursive:true});
  const list=[...keys].sort((a,b)=>a.localeCompare(b,'it'));
  fs.writeFileSync(path.join(out,'keys.json'),JSON.stringify(list,null,1));
  const rows=[];
  for(const l of supported){if(l==='it')continue;const have=new Set(dicts[l]||[]);const miss=list.filter(k=>!have.has(k));
    const enMap=await (async()=>null)();
    const obj={};miss.forEach(k=>{obj[k]=EN[k]??null;});
    fs.writeFileSync(path.join(out,`missing-${l}.json`),JSON.stringify(obj,null,1));rows.push(`${l}: ${list.length-miss.length}/${list.length} tradotte, ${miss.length} mancanti`);}
  console.log('chiavi sorgente:',list.length,'(T():',tk.length,', statiche:',texts.size,', en:',dicts.en.length,')');
  console.log(rows.join('\n'));
})().catch(e=>{console.error(e);process.exit(2);});
