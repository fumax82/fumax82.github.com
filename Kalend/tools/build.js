#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   build.js — assembla l'app Kalend in un unico file www/index.html

   COME FUNZIONA
   1. legge src/index.html (il sorgente "storico" dell'app, v53 + ritocchi);
   2. inserisce PRIMA del primo <script> il blocco <script id="kx-i18n">
      con i dizionari di italiano e inglese (window.KX_I18N) e un
      caricatore che legge la lingua in uso da i18n/<lingua>.json
      (v55 · 1.13: un file per lingua accanto alla pagina);
   3. inserisce PRIMA di </body> i moduli di src/modules/, in ordine di
      nome file: ogni NN-nome.css diventa <style id="kx-mod-nome">,
      ogni NN-nome.js diventa <script id="kx-mod-nome">, ogni NN-nome.html
      viene copiato com'è (markup);
   4. ricalcola gli hash SHA-256 di TUTTI gli script inline e riscrive la
      Content-Security-Policy (senza hash corretti la WebView blocca gli
      script);
   5. scrive www/index.html e stampa un riepilogo.

   6. (v55) inserisce i testi legali di src/legal/*.json (window.KX_LEGAL)
      con i dati del venditore di src/legal/seller.json al posto dei
      segnaposto {{SELLER}} ecc.;
   7. (v55) restringe la Content-Security-Policy «connect-src» ai soli
      host dei servizi usati dall'app Android (nell'app le richieste di
      rete passano dal ponte nativo: la pagina parla solo con l'atlante
      locale e, nel browser, con i fornitori). Con --web resta «https:»
      per la versione da browser, dove i calendari collegati si
      scaricano dalla pagina stessa.

   USO:  node Kalend/tools/build.js [--web]
   ══════════════════════════════════════════════════════════════════ */
'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const ROOT=path.resolve(__dirname,'..');
const SRC=path.join(ROOT,'src','index.html');
const I18N_DIR=path.join(ROOT,'src','i18n');
const MOD_DIR=path.join(ROOT,'src','modules');
/* --out <file>: pagina di uscita (di serie www/index.html); i dizionari per
   lingua finiscono nella cartella i18n/ accanto alla pagina */
const OUT_I=process.argv.indexOf('--out');
const OUT=OUT_I>0&&process.argv[OUT_I+1]?path.resolve(process.argv[OUT_I+1]):path.join(ROOT,'www','index.html');
const OUT_DIR=path.dirname(OUT);
/* lingue incorporate nella pagina: l'italiano (sorgente) e l'inglese (riserva);
   tutte le altre vengono caricate dal file i18n/<lingua>.json all'avvio */
const INLINE_LANGS=['it','en'];
const LEGAL_DIR=path.join(ROOT,'src','legal');
const WEB=process.argv.includes('--web');
/* host che la pagina può contattare direttamente (build Android) */
const CONNECT_HOSTS=['https://api.met.no','https://customer-api.open-meteo.com','https://customer-geocoding-api.open-meteo.com','https://api.openweathermap.org','https://photon.komoot.io'];

/* ── 1. sorgente ── */
let html=fs.readFileSync(SRC,'utf8');

/* ── 2. dizionari ── */
const dict={};const packs={};
if(fs.existsSync(I18N_DIR)){
  for(const f of fs.readdirSync(I18N_DIR).sort()){
    if(!/^[a-z]{2}\.json$/.test(f))continue;
    const lang=f.slice(0,2);
    const data=JSON.parse(fs.readFileSync(path.join(I18N_DIR,f),'utf8'));
    /* "strings" → dizionario UI; lexicon/autotag/culture → pacchetto per i moduli */
    dict[lang]=data.strings||{};
    packs[lang]={name:data.name||lang,lexicon:data.lexicon||{},autotag:data.autotag||{},culture:data.culture||{}};
  }
}
/* ── 2b. stringhe aggiuntive dei moduli v54: src/i18n/extra/*.json con la forma
   { "testo italiano": { "en": "...", "fr": "...", ... } } → si uniscono ai dizionari
   (le voci già presenti nel file della lingua hanno la precedenza) ── */
const EXTRA_DIR=path.join(ROOT,'src','i18n','extra');
let extraCount=0;
if(fs.existsSync(EXTRA_DIR)){
  for(const f of fs.readdirSync(EXTRA_DIR).sort()){
    if(!/\.json$/.test(f))continue;
    const data=JSON.parse(fs.readFileSync(path.join(EXTRA_DIR,f),'utf8'));
    for(const [key,byLang] of Object.entries(data)){
      if(!byLang||typeof byLang!=='object')continue;
      for(const [lang,val] of Object.entries(byLang)){
        if(typeof val!=='string'||!val)continue;
        dict[lang]=dict[lang]||{};
        if(!dict[lang][key]){dict[lang][key]=val;extraCount++;}
      }
    }
  }
}
/* "</script" dentro una stringa chiuderebbe il blocco: si spezza in modo sicuro */
const safeJSON=o=>JSON.stringify(o).replace(/<\/script/gi,'<\\/script').replace(/<!--/g,'<\\!--');

/* ── 2b2. testi legali (v55): un oggetto per lingua, segnaposto sostituiti ── */
let legal={},legalLangs=[];
if(fs.existsSync(LEGAL_DIR)){
  let seller={};try{seller=JSON.parse(fs.readFileSync(path.join(LEGAL_DIR,'seller.json'),'utf8'));}catch(e){}
  const fill=s=>s.replace(/\{\{([A-Z_]+)\}\}/g,(m,k)=>seller[k]!=null?String(seller[k]):m);
  for(const f of fs.readdirSync(LEGAL_DIR).filter(f=>/^[a-z]{2}\.json$/.test(f)).sort()){
    const lang=f.slice(0,2);
    const txt=fill(fs.readFileSync(path.join(LEGAL_DIR,f),'utf8'));
    legal[lang]=JSON.parse(txt);legalLangs.push(lang);
  }
}

/* ── 2c. (v55 · 1.13) un file per lingua: i18n/<lingua>.json accanto alla pagina.
   La pagina incorpora solo italiano e inglese; la lingua in uso viene letta
   all'avvio dal suo file (vedi il caricatore qui sotto). Così la pagina pesa
   ~2 MB in meno e si avvia prima. ── */
const I18N_OUT=path.join(OUT_DIR,'i18n');
fs.mkdirSync(I18N_OUT,{recursive:true});
let langFiles=0;
for(const lang of Object.keys(dict)){
  const file={lang,name:(packs[lang]||{}).name||lang,strings:dict[lang],lexicon:(packs[lang]||{}).lexicon||{},autotag:(packs[lang]||{}).autotag||{},culture:(packs[lang]||{}).culture||{},legal:legal[lang]||null};
  fs.writeFileSync(path.join(I18N_OUT,lang+'.json'),JSON.stringify(file),'utf8');langFiles++;
}
const inlineDict={},inlinePacks={};
INLINE_LANGS.forEach(l=>{if(dict[l])inlineDict[l]=dict[l];if(packs[l])inlinePacks[l]=packs[l];});
/* ── 2d. (v56) INDICE PER IL RICONOSCIMENTO DELLA LINGUA della frase: per ogni lingua
   un centinaio di parole "spia" del lessico (oggi, domani, alle, con, parenti, parole
   funzionali, momenti, numeri…). Serve al modulo 11-nl-smart.js per capire in che
   lingua è scritta o dettata una frase SENZA avere in memoria tutti i dizionari: solo
   dopo il riconoscimento la lingua trovata viene caricata dal suo file. ── */
const DETECT_KEYS={strong:['today','tomorrow','after','tonight','thisMorning','at','from','with','withStrong','every','remind','weekend','nextWeek','relatives'],
  normal:['to','until','for','in','place','pm','am','half','quarter','plus','minus','before','and','note','urgent','important','stopwords','lead','venues','dayOf','lowPriority','oneDay','birthday','hours','minutes','days','weeks']};
const detectIndex={};
for(const lang of Object.keys(packs)){
  const L=(packs[lang]||{}).lexicon||{};const take=(k,n)=>(Array.isArray(L[k])?L[k]:[]).filter(w=>typeof w==='string'&&w.trim().length>=2).slice(0,n);
  const strong=new Set(),normal=new Set();
  DETECT_KEYS.strong.forEach(k=>take(k,k==='relatives'?14:6).forEach(w=>strong.add(w.toLowerCase())));
  DETECT_KEYS.normal.forEach(k=>take(k,k==='stopwords'?24:5).forEach(w=>normal.add(w.toLowerCase())));
  Object.values(L.moments||{}).forEach(v=>(Array.isArray(v)?v:[]).slice(0,2).forEach(w=>normal.add(String(w).toLowerCase())));
  Object.keys(L.numbers||{}).slice(0,12).forEach(w=>normal.add(w.toLowerCase()));
  (L.weekdays||[]).forEach(p=>{if(Array.isArray(p)&&typeof p[0]==='string'&&p[0].length>=2)strong.add(p[0].toLowerCase());});
  Object.values(L.fields||{}).forEach(v=>(Array.isArray(v)?v:[]).slice(0,2).forEach(w=>normal.add(String(w).toLowerCase())));
  strong.forEach(w=>normal.delete(w));
  detectIndex[lang]={s:[...strong],w:[...normal]};
}
const SUPPORTED=['it','en','zh','hi','es','fr','de','pt','ru','ja','ar','ko','tr','bn','pl','id','vi','th','he','uk'];
const i18nBlock=`<script id="kx-i18n">
/* generato da tools/build.js — NON modificare a mano: le traduzioni
   stanno in src/i18n/<lingua>.json (chiave = testo italiano sorgente) */
window.KX_I18N=${safeJSON(inlineDict)};
/* pacchetti per lingua: lessico del parser, parole chiave auto-tag, cultura */
window.KX_PACKS=${safeJSON(inlinePacks)};
/* v56: parole spia per riconoscere la lingua di una frase (vedi 11-nl-smart.js) */
window.KX_DETECT=${safeJSON(detectIndex)};
/* ── caricatore della lingua in uso (v55 · 1.13) ──
   Le altre lingue stanno in i18n/<lingua>.json accanto alla pagina. La
   lingua si decide come fa L10N.detect (impostazione salvata, altrimenti
   quella del dispositivo) e il file viene letto in modo SINCRONO: deve
   essere pronto prima che parta lo script principale, che traduce il
   markup appena nasce. Se il file manca, l'interfaccia resta in inglese. */
(function(){
  var SUP=${JSON.stringify(SUPPORTED)},INLINE=${JSON.stringify(INLINE_LANGS)};
  function pick(){
    var pref='auto';try{var s=JSON.parse(localStorage.getItem('cal_settings')||'{}');if(s&&typeof s.language==='string')pref=s.language;}catch(e){}
    var nav=(navigator.language||'it-IT');var loc=pref==='auto'?nav:(nav.toLowerCase().indexOf(pref)===0?nav:pref);
    var l=String(loc).slice(0,2).toLowerCase();return SUP.indexOf(l)>=0?l:'en';
  }
  function read(l){
    var url=new URL('i18n/'+l+'.json',location.href).href;
    var x=new XMLHttpRequest();x.open('GET',url,false);x.send(null);
    if(x.status&&x.status!==200)throw new Error('HTTP '+x.status);
    if(!x.responseText)throw new Error('file vuoto');
    return JSON.parse(x.responseText);
  }
  function merge(l,d){
    window.KX_I18N[l]=d.strings||{};
    window.KX_PACKS[l]={name:d.name||l,lexicon:d.lexicon||{},autotag:d.autotag||{},culture:d.culture||{}};
    if(d.legal){window.KX_LEGAL_EXTRA=window.KX_LEGAL_EXTRA||{};window.KX_LEGAL_EXTRA[l]=d.legal;}
  }
  /* preferenze che devono valere PRIMA del primo disegno: dimensione del testo (v55 · 1.14) */
  try{var ts=localStorage.getItem('kx_textsize_v1');if(ts==='big'||ts==='xl')document.documentElement.setAttribute('data-textsize',ts);}catch(e){}
  var lang=pick();var info={lang:lang,inline:INLINE.indexOf(lang)>=0,loaded:false,error:''};
  if(!info.inline){try{merge(lang,read(lang));info.loaded=true;}catch(e){info.error=String(e&&e.message||e);try{console.warn('[i18n] dizionario '+lang+' non caricato: '+info.error);}catch(_){}}}
  window.KX_I18N_INFO=info;
  /* per usi futuri (anteprime in un'altra lingua): carica un'altra lingua su richiesta */
  window.KX_I18N_LOAD=function(l){return new Promise(function(res,rej){if(window.KX_I18N[l])return res(true);try{merge(l,read(l));res(true);}catch(e){rej(e);}});};
})();
</script>
`;
const firstScript=html.indexOf('<script');
if(firstScript<0)throw new Error('nessun <script> nel sorgente');
html=html.slice(0,firstScript)+i18nBlock+html.slice(firstScript);

/* ── 3. moduli ── */
const mods=[];
if(fs.existsSync(MOD_DIR)){
  for(const f of fs.readdirSync(MOD_DIR).sort()){
    const m=f.match(/^(\d+)-([a-z0-9-]+)\.(css|js|html)$/i);
    if(!m)continue;
    const body=fs.readFileSync(path.join(MOD_DIR,f),'utf8');
    const id='kx-mod-'+m[2];
    let block;
    if(m[3]==='css')block=`<style id="${id}">\n${body}\n</style>`;
    else if(m[3]==='js')block=`<script id="${id}">\n${body}\n</script>`;
    else block=body;
    mods.push({f,block});
  }
}
if(mods.length){
  const end=html.lastIndexOf('</body>');
  if(end<0)throw new Error('manca </body>');
  const bundle='\n<!-- ═══ moduli v54 (da src/modules/, assemblati da tools/build.js) ═══ -->\n'
    +mods.map(m=>`<!-- src/modules/${m.f} -->\n${m.block}\n`).join('');
  html=html.slice(0,end)+bundle+html.slice(end);
}

/* ── 3b. testi legali (v55): incorporati per italiano e inglese; le altre
   lingue viaggiano nel file i18n/<lingua>.json (chiave "legal") ── */
{
  const inlineLegal={};INLINE_LANGS.forEach(l=>{if(legal[l])inlineLegal[l]=legal[l];});
  const block=`<script id="kx-legal">\nwindow.KX_LEGAL=${safeJSON(inlineLegal)};\n</script>\n`;
  const end=html.lastIndexOf('</body>');
  html=html.slice(0,end)+block+html.slice(end);
}

/* ── 3c. CSP connect-src (v55) ── */
if(!WEB){
  html=html.replace(/connect-src 'self' https:;/,`connect-src 'self' ${CONNECT_HOSTS.join(' ')};`);
}

/* ── 4. CSP: un hash per ogni script inline ── */
const scripts=[];
html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/g,(all,body)=>{scripts.push(body);return all;});
const hashes=scripts.map(s=>"'sha256-"+crypto.createHash('sha256').update(s,'utf8').digest('base64')+"'");
html=html.replace(/(<meta http-equiv="Content-Security-Policy" content="[^"]*?script-src )[^;]*(;)/,
  (all,a,b)=>a+hashes.join(' ')+b);

/* ── 5. uscita ── */
fs.mkdirSync(path.dirname(OUT),{recursive:true});
fs.writeFileSync(OUT,html,'utf8');
console.log(`build ok → ${path.relative(process.cwd(),OUT)}`);
console.log(`  lingue: ${Object.keys(dict).length} (${Object.keys(dict).join(', ')||'nessuna'}) · stringhe extra dei moduli: ${extraCount}`);
console.log(`  dizionari per lingua: ${langFiles} file in ${path.relative(process.cwd(),I18N_OUT)}/ · incorporate nella pagina: ${INLINE_LANGS.join(', ')}`);
console.log(`  moduli: ${mods.length}${mods.length?' ('+mods.map(m=>m.f).join(', ')+')':''}`);
console.log(`  script inline: ${scripts.length}, hash CSP: ${hashes.length}`);
console.log(`  testi legali: ${legalLangs.length} lingue · CSP connect-src: ${WEB?'https: (web)':'host elencati (Android)'}`);
console.log(`  dimensione: ${(Buffer.byteLength(html,'utf8')/1024/1024).toFixed(2)} MB`);
