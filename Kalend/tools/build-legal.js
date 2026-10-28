#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   build-legal.js — pagine web dei testi legali (per Google Play e il sito)
   Google Play richiede un indirizzo pubblico per l'informativa sulla
   privacy. Questo script genera, da src/legal/*.json e seller.json,
   la cartella Kalend/legal/ con:
     index.html                 elenco delle lingue
     privacy-<lingua>.html      informativa sulla privacy
     terms-<lingua>.html        termini d'uso
   Pubblicate con GitHub Pages diventano ad esempio
   https://<utente>.github.io/Kalend/legal/privacy-it.html (da verificare
   con l'impostazione Pages del repository).
   Uso: node Kalend/tools/build-legal.js
══════════════════════════════════════════════════════════════════ */
'use strict';
const fs=require('fs');const path=require('path');
const ROOT=path.resolve(__dirname,'..');const SRC=path.join(ROOT,'src','legal');const OUT=path.join(ROOT,'legal');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let seller={};try{seller=JSON.parse(fs.readFileSync(path.join(SRC,'seller.json'),'utf8'));}catch(e){}
const fill=s=>s.replace(/\{\{([A-Z_]+)\}\}/g,(m,k)=>seller[k]!=null?String(seller[k]):m);
const NAMES={it:'Italiano',en:'English',es:'Español',fr:'Français',de:'Deutsch',pt:'Português',nl:'Nederlands',pl:'Polski',ru:'Русский',uk:'Українська',tr:'Türkçe',ar:'العربية',he:'עברית',hi:'हिन्दी',bn:'বাংলা',id:'Bahasa Indonesia',ja:'日本語',ko:'한국어',zh:'中文',th:'ไทย'};
const RTL=['ar','he'];
const CSS=`body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:720px;margin:0 auto;padding:24px 18px 48px;line-height:1.6;color:#1b1b1b;background:#fff}h1{font-size:1.5em}h2{font-size:1.05em;margin:1.4em 0 .3em}p{margin:0 0 .6em}nav{font-size:.9em;margin-bottom:1.4em}nav a{margin-inline-end:10px}footer{margin-top:2.5em;font-size:.85em;color:#666}ul{padding-inline-start:20px}@media(prefers-color-scheme:dark){body{color:#eee;background:#141414}footer{color:#aaa}a{color:#8cc}}`;
fs.mkdirSync(OUT,{recursive:true});
const langs=fs.readdirSync(SRC).filter(f=>/^[a-z]{2}\.json$/.test(f)).map(f=>f.slice(0,2)).sort((a,b)=>a==='it'?-1:b==='it'?1:a==='en'?-1:b==='en'?1:a.localeCompare(b));
function page(lang,title,doc,other){
  const dir=RTL.includes(lang)?'rtl':'ltr';
  return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kalend — ${esc(title)}</title><style>${CSS}</style></head><body>
<nav><a href="index.html">Kalend</a> · <a href="${other.href}">${esc(other.title)}</a></nav>
<h1>${esc(title)}</h1>
${doc.sections.map(([h,p])=>`<h2>${esc(h)}</h2><p>${esc(p)}</p>`).join('\n')}
<footer>Kalend · ${esc(seller.UPDATED||'')}</footer>
</body></html>\n`;
}
const rows=[];
for(const lang of langs){
  const d=JSON.parse(fill(fs.readFileSync(path.join(SRC,lang+'.json'),'utf8')));
  fs.writeFileSync(path.join(OUT,`privacy-${lang}.html`),page(lang,d.privacy.title,d.privacy,{href:`terms-${lang}.html`,title:d.eula.title}));
  fs.writeFileSync(path.join(OUT,`terms-${lang}.html`),page(lang,d.eula.title,d.eula,{href:`privacy-${lang}.html`,title:d.privacy.title}));
  rows.push(`<li><b>${esc(NAMES[lang]||lang)}</b>: <a href="privacy-${lang}.html">${esc(d.privacy.title)}</a> · <a href="terms-${lang}.html">${esc(d.eula.title)}</a></li>`);
}
fs.writeFileSync(path.join(OUT,'index.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kalend — Privacy Policy &amp; Terms of Use</title><style>${CSS}</style></head><body>
<h1>Kalend — Privacy Policy &amp; Terms of Use</h1>
<p>Kalend is a calendar app for Android that keeps your data on your device. Choose your language:</p>
<ul>${rows.join('\n')}</ul>
<footer>Kalend · ${esc(seller.UPDATED||'')}</footer>
</body></html>\n`);
console.log(`pagine legali: ${langs.length} lingue × 2 + indice → ${path.relative(process.cwd(),OUT)}/`);
