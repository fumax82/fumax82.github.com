/* ──────────────────────────────────────────────────────────────────
   nl-limits.js — genera docs/PARSER-LIMITI.md dai casi del banco di
   prova marcati "skip" (limiti noti del parser, con la causa scritta
   nella nota del caso). Uso: node Kalend/tools/nl-limits.js
   ────────────────────────────────────────────────────────────────── */
const fs=require('fs');const path=require('path');
const ROOT=path.resolve(__dirname,'..');const DIR=path.join(__dirname,'nl-suite');
const NAMES={it:'Italiano',en:'English',es:'Español',fr:'Français',de:'Deutsch',pt:'Português',pl:'Polski',ru:'Русский',uk:'Українська',tr:'Türkçe',ar:'العربية',he:'עברית',hi:'हिन्दी',bn:'বাংলা',id:'Bahasa Indonesia',ja:'日本語',ko:'한국어',zh:'中文',th:'ไทย'};
let out=['# Parser in linguaggio naturale — limiti noti per lingua','','Generato da `tools/nl-limits.js` dai casi marcati `skip` in `tools/nl-suite/<lingua>.json`.',
  'Ogni riga: la frase, cosa ci si aspetterebbe e la causa (come annotata nel banco di prova).','Per rilanciare il banco: `node Kalend/tools/nl-suite.js all`.',''];
let tot=0,skips=0;
for(const f of fs.readdirSync(DIR).filter(f=>/^[a-z]{2}\.json$/.test(f)).sort()){
  const l=f.slice(0,2);const d=JSON.parse(fs.readFileSync(path.join(DIR,f),'utf8'));
  const sk=d.cases.filter(c=>c.skip);tot+=d.cases.length;skips+=sk.length;
  out.push(`## ${NAMES[l]||l} (${l}) — ${d.cases.length} frasi, ${sk.length} limiti noti`,'');
  sk.forEach(c=>{const e=c.expect||{};const want=Object.entries(e).map(([k,v])=>`${k}: ${JSON.stringify(v)}`).join(', ');out.push(`- «${c.s}»  \n  atteso: ${want}  \n  ${(c.note||'').replace(/^PARSER:\s*/i,'')}`);});
  out.push('');
}
out.unshift(`**Totale**: ${tot} frasi in ${fs.readdirSync(DIR).filter(f=>/^[a-z]{2}\.json$/.test(f)).length} lingue, ${skips} limiti noti.`,'');
out.splice(0,0,'# Parser in linguaggio naturale — limiti noti per lingua','');out.splice(3,2);
fs.writeFileSync(path.join(ROOT,'docs','PARSER-LIMITI.md'),out.join('\n'),'utf8');
console.log('docs/PARSER-LIMITI.md:',tot,'frasi,',skips,'limiti noti');
