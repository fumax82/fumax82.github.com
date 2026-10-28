#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   build.js — assembla l'app Kalend in un unico file www/index.html

   COME FUNZIONA
   1. legge src/index.html (il sorgente "storico" dell'app, v53 + ritocchi);
   2. inserisce PRIMA del primo <script> il blocco <script id="kx-i18n">
      con tutti i dizionari di src/i18n/*.json (window.KX_I18N);
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
const OUT=path.join(ROOT,'www','index.html');
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
const i18nBlock=`<script id="kx-i18n">
/* generato da tools/build.js — NON modificare a mano: le traduzioni
   stanno in src/i18n/<lingua>.json (chiave = testo italiano sorgente) */
window.KX_I18N=${safeJSON(dict)};
/* pacchetti per lingua: lessico del parser, parole chiave auto-tag, cultura */
window.KX_PACKS=${safeJSON(packs)};
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

/* ── 3b. testi legali (v55): un oggetto per lingua, segnaposto sostituiti ── */
let legal={},legalLangs=[];
if(fs.existsSync(LEGAL_DIR)){
  let seller={};try{seller=JSON.parse(fs.readFileSync(path.join(LEGAL_DIR,'seller.json'),'utf8'));}catch(e){}
  const fill=s=>s.replace(/\{\{([A-Z_]+)\}\}/g,(m,k)=>seller[k]!=null?String(seller[k]):m);
  for(const f of fs.readdirSync(LEGAL_DIR).filter(f=>/^[a-z]{2}\.json$/.test(f)).sort()){
    const lang=f.slice(0,2);
    const txt=fill(fs.readFileSync(path.join(LEGAL_DIR,f),'utf8'));
    legal[lang]=JSON.parse(txt);legalLangs.push(lang);
  }
  const block=`<script id="kx-legal">\nwindow.KX_LEGAL=${safeJSON(legal)};\n</script>\n`;
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
console.log(`  moduli: ${mods.length}${mods.length?' ('+mods.map(m=>m.f).join(', ')+')':''}`);
console.log(`  script inline: ${scripts.length}, hash CSP: ${hashes.length}`);
console.log(`  testi legali: ${legalLangs.length} lingue · CSP connect-src: ${WEB?'https: (web)':'host elencati (Android)'}`);
console.log(`  dimensione: ${(Buffer.byteLength(html,'utf8')/1024/1024).toFixed(2)} MB`);
