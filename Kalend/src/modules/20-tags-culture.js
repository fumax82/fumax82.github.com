/* ══════════════════════════════════════════════════════════════════
   MODULO v54 — "Radici" · tag e famiglie nella lingua e nella cultura
   ------------------------------------------------------------------
   Le famiglie di tag (Lavoro, Famiglia, Salute…) nascono in italiano e
   restano salvate sul telefono (chiave kx_tagfam_v1). Questo modulo,
   usando il pacchetto culturale della lingua (src/i18n/xx.json →
   culture), fa tre cose al primo avvio in una lingua e a ogni cambio:

   1. NOMI DELLE FAMIGLIE: se il nome è ancora quello predefinito (non
      personalizzato dall'utente) viene mostrato nella lingua in uso.
   2. PAROLE CHIAVE DELL'AUTO-TAG: le parole predefinite della lingua
      precedente lasciano il posto a quelle della nuova lingua; quelle
      aggiunte a mano dall'utente restano.
   3. TAG CULTURALI: i tag che un utente di quella cultura si aspetta
      già pronti (es. «ramadan», «nomikai», «imieniny»…) vengono creati
      una sola volta per lingua, nella loro famiglia, con le loro parole
      chiave. Se l'utente li cancella non vengono ricreati.
   4. TAG PREDEFINITI: al cambio lingua propone (con conferma) di
      rinominare i tag predefiniti («lavoro» → «work», ecc.) in tutti gli
      eventi; l'utente può rifiutare e tenere i suoi.

   Tutto resta personalizzabile dalla pagina «Tag e famiglie».
══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const KX=window.KX=window.KX||{};
const FAM_KEY='kx_tagfam_v1';
const lang=()=>KX.Lang?KX.Lang.lang():((typeof L10N!=='undefined'&&L10N.resolvedLang)||'it');
const pack=l=>KX.Lang?KX.Lang.pack(l):null;
const FAMILY_IDS=['lavoro','famiglia','amici','salute','sport','tavola','colazione','aperitivo','appuntamenti','feste','amore','cultura','commissioni','natura','bambini','pagamenti','studio','viaggi','relax','altro'];
/* nomi italiani di fabbrica (per riconoscere un nome non personalizzato) */
const IT_NAMES={lavoro:'Lavoro',famiglia:'Famiglia',amici:'Amici',salute:'Salute',sport:'Sport',tavola:'A tavola',colazione:'Colazione',aperitivo:'Aperitivo',appuntamenti:'Appuntamenti',feste:'Feste',amore:'Amore',cultura:'Cultura e spettacoli',commissioni:'Commissioni',natura:'Natura',bambini:'Bambini',pagamenti:'Pagamenti e scadenze',studio:'Studio',viaggi:'Viaggi',relax:'Relax',altro:'Altro'};
const norm=s=>String(s||'').toLowerCase().trim();

function save(FAM){try{localStorage.setItem(FAM_KEY,JSON.stringify(FAM));}catch(e){}}
function allTags(){try{return [...new Set([...(S.tagDB||[]),...Object.keys(TAG_CONFIG||{})])].filter(t=>t&&!t.startsWith('__'));}catch(e){return [];}}
function addTag(t,famId,FAM){
  t=norm(t).replace(/^#/,'').slice(0,40);if(!t)return null;
  try{if(typeof addTagToDb==='function')addTagToDb(t);else if(S.tagDB)S.tagDB.add(t);}catch(e){}
  try{if(!TAG_CONFIG[t])TAG_CONFIG[t]={music:null,fx:null};}catch(e){}
  if(famId&&FAM.families[famId])FAM.map[t]=famId;
  return t;
}
/* rinomina un tag ovunque (eventi, archivio tag, configurazione, famiglie) */
function renameTag(o,n,FAM){
  o=norm(o);n=norm(n).replace(/^#/,'').slice(0,40);if(!o||!n||o===n)return false;
  try{Object.values(S.events||{}).forEach(l=>(l||[]).forEach(ev=>{if(ev&&ev.tags&&ev.tags.map(norm).includes(o))ev.tags=[...new Set(ev.tags.map(t=>norm(t)===o?n:t))];}));}catch(e){}
  try{S.tagDB.delete(o);S.tagDB.add(n);}catch(e){}
  try{if(TAG_CONFIG[o]&&!TAG_CONFIG[n])TAG_CONFIG[n]=TAG_CONFIG[o];delete TAG_CONFIG[o];}catch(e){}
  FAM.map[n]=FAM.map[o]||FAM.map[n]||'altro';delete FAM.map[o];
  return true;
}
function refreshUI(){
  try{if(typeof updateTagDatalist==='function')updateTagDatalist();}catch(e){}
  try{EventsStore.scheduleSave();}catch(e){}
  try{renderAll();}catch(e){}
  try{KX.Widget&&KX.Widget.push&&KX.Widget.push();}catch(e){}
}
const idle=()=>!document.querySelector('#onboard-overlay,#hint-overlay,.bottom-sheet.open,#kx-intro,#kx-menu-ov,#kx-qs,#kx-dlg,#confirm-dialog.show,#kx-voice');

/* ── 1+2+3: adattamento alla lingua ── */
function localize(FAM){
  const l=lang();const p=pack(l);const c=(p&&p.culture)||{};
  FAM.v54=FAM.v54||{lang:'it',names:{},kw:{},extra:[]};
  const prevLang=FAM.v54.lang||'it';
  const prevPack=pack(prevLang);const prevC=(prevPack&&prevPack.culture)||{};
  let changed=false;
  /* nomi delle famiglie */
  const names=c.families||{};
  FAMILY_IDS.forEach(id=>{const f=FAM.families[id];if(!f)return;
    const wasDefault=!f.name||f.name===IT_NAMES[id]||f.name===FAM.v54.names[id]||f.name===(prevC.families||{})[id];
    const want=names[id]||(l==='it'?IT_NAMES[id]:null);
    if(wasDefault&&want&&f.name!==want){f.name=want;changed=true;}
    if(want)FAM.v54.names[id]=want;});
  /* parole chiave dell'auto-tag (solo quando la lingua cambia) */
  if(prevLang!==l&&p){
    const prevAuto=(prevPack&&prevPack.autotag)||{};
    FAMILY_IDS.forEach(id=>{const f=FAM.families[id];if(!f)return;
      const newWords=((p.autotag||{})[id]||[]).map(norm).filter(Boolean);
      const oldDefaults=new Set([...(FAM.v54.kw[id]||[]),...(prevAuto[id]||[])].map(norm));
      /* al primo passaggio dall'italiano, le parole di fabbrica sono quelle attuali */
      if(prevLang==='it'&&!FAM.v54.kw[id])(f.kw||[]).forEach(w=>oldDefaults.add(norm(w)));
      const custom=(f.kw||[]).filter(w=>!oldDefaults.has(norm(w)));
      if(newWords.length){f.kw=[...new Set([...custom,...newWords])];FAM.v54.kw[id]=newWords;changed=true;}
    });
  }
  /* tag culturali, una volta per lingua */
  if(!(FAM.v54.extra||[]).includes(l)&&Array.isArray(c.extraTags)){
    c.extraTags.forEach(x=>{if(!x||!x.tag)return;const fam=FAM.families[x.family]?x.family:'altro';
      const t=norm(x.tag).replace(/\s+/g,'-');if(allTags().map(norm).includes(t))return;
      addTag(t,fam,FAM);changed=true;});
    FAM.v54.extra=[...(FAM.v54.extra||[]),l];changed=true;
  }
  const langChanged=prevLang!==l;
  FAM.v54.lang=l;
  if(changed||langChanged)save(FAM);
  if(changed){try{KX.famData&&applyFamProps(FAM);}catch(e){}refreshUI();}
  if(langChanged&&prevLang!=='__none')proposeRename(FAM,prevLang,l);
}
/* le proprietà della famiglia (musica/effetto) passano ai tag nuovi */
function applyFamProps(FAM){
  allTags().forEach(t=>{const f=FAM.families[FAM.map[t]]||FAM.families.altro;if(!f)return;TAG_CONFIG[t]=Object.assign(TAG_CONFIG[t]||{},{music:f.music||null,fx:f.fx||null});});
  try{localStorage.setItem('kx_tagcfg_v1',JSON.stringify(TAG_CONFIG));}catch(e){}
}

/* ── 4: proposta di rinominare i tag predefiniti nella nuova lingua ── */
function proposeRename(FAM,prevLang,l){
  const pp=pack(prevLang),np=pack(l);
  const oldTags=(pp&&pp.culture&&pp.culture.familyTag)||{};
  const newTags=(np&&np.culture&&np.culture.familyTag)||{};
  const have=new Set(allTags().map(norm));
  const pairs=[];
  FAMILY_IDS.forEach(id=>{const o=norm(oldTags[id]),n=norm(newTags[id]);
    if(o&&n&&o!==n&&have.has(o)&&!have.has(n))pairs.push([o,n]);});
  /* anche i tag «#lavoro» ecc. degli eventi di esempio nella lingua precedente */
  if(!pairs.length)return;
  const ask=()=>{
    if(!idle()){setTimeout(ask,2500);return;}
    const T_=(s,p)=>{try{return typeof T==='function'?T(s,p):s;}catch(e){return s;}};
    const list=pairs.slice(0,6).map(([o,n])=>'#'+o+' → #'+n).join(', ')+(pairs.length>6?' …':'');
    const go=()=>{let n=0;pairs.forEach(([o,nw])=>{if(renameTag(o,nw,FAM))n++;});save(FAM);refreshUI();
      try{toast(T_('🏷 {n} tag rinominati nella nuova lingua',{n}));}catch(e){}};
    try{showConfirm(T_('Tradurre i tag predefiniti?'),T_('I tag predefiniti possono prendere il nome della nuova lingua in tutti gli eventi: {l}. Potrai sempre rinominarli da «Tag e famiglie».',{l:list}),go);}
    catch(e){if(confirm(T_('Tradurre i tag predefiniti?')+'\n'+list))go();}
  };
  setTimeout(ask,4000);
}

/* ── avvio: appena le famiglie sono caricate ── */
let tries=0;
function start(){
  const FAM=KX.famData&&KX.famData();
  if(!FAM||!FAM.families){if(tries++<20)setTimeout(start,500);return;}
  try{localize(FAM);}catch(e){console.error('[v54 tag]',e);}
}
if(document.readyState==='complete')setTimeout(start,800);else addEventListener('load',()=>setTimeout(start,800));
KX.Culture={localize:()=>{const F=KX.famData&&KX.famData();if(F)localize(F);},renameTag:(o,n)=>{const F=KX.famData&&KX.famData();if(!F)return false;const r=renameTag(o,n,F);if(r){save(F);refreshUI();}return r;}};
})();
