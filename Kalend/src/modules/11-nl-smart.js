/* ══════════════════════════════════════════════════════════════════
   MODULO v56 — «Dettatura intelligente»: lo strato esterno del parser
   ------------------------------------------------------------------
   Si mette DAVANTI a tutto il motore (parser storico + pacchetti lingua
   del modulo 10) e lavora sulla frase così come l'utente l'ha scritta o
   dettata, nella sua lingua:
   1. RICONOSCE LA LINGUA della frase (alfabeto + parole del lessico): se
      è diversa da quella dell'app, il motore legge con il lessico giusto.
      Così si può dettare in inglese con l'app in italiano, o viceversa,
      senza cambiare nulla nelle impostazioni.
   2. COMANDI INIZIALI/FINALI tolti dal titolo: «ricordami di…»,
      «aggiungi…», «remind me to…», «〜を追加して» (lessico lead/leadEnd).
      Un «ricordami di» senza altro preavviso = avviso all'ora dell'evento.
   3. LUOGHI COMUNI in minuscolo: «in palestra», «at the gym», «im Büro»,
      «al bar Centrale», e gli incontri a distanza («online», «su Zoom»)
      (lessico venues/online).
   4. GIORNO SENZA MESE: «il 15», «on the 15th», «am 15.», «15日» → il
      prossimo 15 del mese (lessico dayOf, suffissi del giorno).
   5. NOTE SENZA DUE PUNTI: «… nota portare i documenti» → descrizione.
   6. PRIORITÀ BASSA: «quando puoi», «low priority» → normale e via dal
      titolo (lessico lowPriority); urgente/importante sono già nel lessico.
   7. SICUREZZA SERALE: un orario fra le 1:00 e le 7:59 detto insieme a
      parole serali («stasera», «abends», «вечером») e senza «di mattina»
      diventa pomeriggio/sera.
   8. SCHEDA DI DETTATURA: scelta della lingua con un tocco (chip 🌐),
      lingua rilevata, anteprima dal vivo dei campi capiti; impostazione
      «Lingua della dettatura» nelle impostazioni.
   Il modulo non modifica il motore: avvolge KX.NL2.parse (dopo il modulo
   10-lang-packs) e la scheda vocale (KX.voice). Le parole nuove del
   lessico sono documentate in src/i18n/SCHEMA.md.
══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const KX=window.KX=window.KX||{};
const PACKS=window.KX_PACKS||{};
const tr=(s,p)=>{try{return typeof T==='function'?T(s,p):s;}catch(e){return s;}};
const ui=()=>{try{return KX.Lang.uiLang();}catch(e){return 'it';}};
const lex=l=>{try{return KX.Lang.lexicon(l)||{};}catch(e){return {};}};
const arr=x=>Array.isArray(x)?x.filter(w=>typeof w==='string'&&w.trim()):[];
const esc=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const R=(src,flags)=>new RegExp(src,flags||'giu');
const LB='(?<![\\p{L}\\p{M}\\p{N}])',LA='(?![\\p{L}\\p{M}\\p{N}])';
const A=list=>{try{return KX.Lang.alt(list);}catch(e){return '';}};
const cap=s=>s?s.charAt(0).toUpperCase()+s.slice(1):s;
const NOSPACE=/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]/u;
/* come alt(), ma la prima lettera vale sia maiuscola sia minuscola (per regex SENZA il flag i,
   dove \p{Lu} deve restare davvero maiuscolo) */
const altCI=list=>arr(list).slice().sort((a,b)=>b.length-a.length).map(w=>{
  const a=w[0],u=a.toUpperCase(),lo=a.toLowerCase();const head=u!==lo?'['+esc(u)+esc(lo)+']':esc(a);
  return (NOSPACE.test(a)?'':LB)+head+esc(w.slice(1))+(NOSPACE.test(w[w.length-1])?'':LA);}).join('|');

/* ══════════════════════════════════════════════════════════════════
   1. RICONOSCIMENTO DELLA LINGUA DELLA FRASE
   Alfabeto prima di tutto (hiragana/katakana → ja, han → zh, hangul → ko,
   thai, devanagari → hi, bengalese, arabo, ebraico); fra le lingue latine
   e fra russo/ucraino decidono le parole del lessico (giorni, mesi,
   «domani», «alle», «con», parenti, parole funzionali…) e qualche lettera
   tipica (ñ, ß, ł, ğ, ã, le vocali vietnamite). Si cambia lingua solo
   quando il punteggio è netto: in caso di dubbio resta quella dell'app.
══════════════════════════════════════════════════════════════════ */
const SCRIPTS=[[/[\p{Script=Hiragana}\p{Script=Katakana}]/u,'ja'],[/\p{Script=Han}/u,['zh','ja']],[/\p{Script=Hangul}/u,'ko'],[/\p{Script=Thai}/u,'th'],
  [/\p{Script=Devanagari}/u,'hi'],[/\p{Script=Bengali}/u,'bn'],[/\p{Script=Arabic}/u,'ar'],[/\p{Script=Hebrew}/u,'he']];
const LATIN=['it','en','es','fr','de','pt','pl','tr','id','vi'],CYRIL=['ru','uk'];
const HINT={vi:[/[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/iu,3],pl:[/[ąćęłńśźż]/iu,2],tr:[/[ğışİ]/u,2],de:[/[äöüß]/iu,1.5],es:[/[ñ¿¡]/u,2],pt:[/[ãõ]/iu,2],fr:[/[œçêû]/iu,1],uk:[/[іїєґ]/iu,2],ru:[/[ыэъё]/iu,2]};
const KEYS=['today','tomorrow','after','tonight','thisMorning','next','nextWeek','weekend','allday','remind','every','until','at','from','to','for','in','with','withStrong','place','pm','am','half','quarter','plus','minus','before','and','note','urgent','important','relatives','stopwords','hours','minutes','days','weeks','lead','leadEnd','venues','dayOf','lowPriority','oneDay','birthday'];
const STRONG=new Set(['today','tomorrow','after','tonight','at','from','with','withStrong','relatives','every','remind','weekend','nextWeek']);
const MARK={};
/* il pacchetto della lingua è in memoria? Dalla v55 la pagina carica solo la lingua dell'app:
   le altre arrivano dal loro file i18n/<lingua>.json quando servono (lettura sincrona, una volta) */
function hasPack(l){return !!PACKS[l]||l==='it';}
function ensurePack(l){
  if(hasPack(l))return true;
  try{if(window.KX_I18N_LOAD){window.KX_I18N_LOAD(l).catch(()=>{});}}catch(e){}   /* la lettura dentro è sincrona: al ritorno il pacchetto c'è */
  if(PACKS[l]){delete MARK[l];return true;}
  return false;
}
function markers(l){
  if(MARK[l])return MARK[l];
  const L=lex(l);const w=new Map();const put=(x,v)=>{x=String(x).toLowerCase().trim();if(x.length<2||!/\p{L}/u.test(x))return;if(x.length===2&&!NOSPACE.test(x))v*=.5;if(/\s/.test(x))v+=.5;if(!w.has(x)||w.get(x)<v)w.set(x,v);};
  if(!PACKS[l]&&l!=='it'){
    /* lingua non caricata: si usano le parole spia dell'indice (tools/build.js) + i nomi di giorni e mesi */
    const D=(window.KX_DETECT||{})[l];if(D){(D.s||[]).forEach(x=>put(x,1.5));(D.w||[]).forEach(x=>put(x,1));}
    try{const N=KX.Lang.namesFor(l);N.wdn.concat(N.mon).forEach(x=>put(x,2));}catch(e){}
    const words=[...w.keys()].sort((a,b)=>b.length-a.length);
    const re=words.length?R('(?:'+words.map(x=>(NOSPACE.test(x[0])?'':LB)+esc(x)+(NOSPACE.test(x[x.length-1])?'':LA)).join('|')+')'):null;
    return MARK[l]={re,w};
  }
  KEYS.forEach(k=>{const v=STRONG.has(k)?1.5:1;const x=L[k];if(Array.isArray(x))x.forEach(y=>put(y,v));else if(x&&typeof x==='object')Object.values(x).forEach(y=>arr(y).forEach(z=>put(z,v)));});
  Object.keys(L.numbers||{}).forEach(x=>put(x,.8));Object.keys(L.ordinals||{}).forEach(x=>put(x,.8));
  (L.weekdays||[]).concat(L.months||[]).forEach(p=>{if(Array.isArray(p)&&typeof p[0]==='string')put(p[0],1.5);});
  Object.values(L.moments||{}).forEach(y=>arr(y).forEach(z=>put(z,1)));
  (L.fields&&typeof L.fields==='object')&&Object.values(L.fields).forEach(y=>arr(y).forEach(z=>put(z,1)));
  try{const N=KX.Lang.namesFor(l);N.wdn.concat(N.mon).forEach(x=>put(x,2));}catch(e){}
  const words=[...w.keys()].sort((a,b)=>b.length-a.length);
  const re=words.length?R('(?:'+words.map(x=>(NOSPACE.test(x[0])?'':LB)+esc(x)+(NOSPACE.test(x[x.length-1])?'':LA)).join('|')+')'):null;
  return MARK[l]={re,w};
}
function score(text,l){
  const m=markers(l);if(!m.re)return 0;let s=0;const seen=new Set();let x;m.re.lastIndex=0;
  while((x=m.re.exec(text))){const k=x[0].toLowerCase();if(seen.has(k))continue;seen.add(k);s+=m.w.get(k)||1;if(seen.size>40)break;}
  const h=HINT[l];if(h&&h[0].test(text))s+=h[1];
  return s;
}
const DET=new Map();
function detect(text){
  text=String(text||'');const u=ui();
  if(DET.has(text))return DET.get(text);
  let out=u;
  try{
    const has=l=>hasPack(l)||!!(window.KX_DETECT||{})[l];
    let fam=null;
    for(const[re,l]of SCRIPTS){if(re.test(text)){fam=Array.isArray(l)?l.slice():[l];break;}}
    if(!fam){const cy=/\p{Script=Cyrillic}/u.test(text),la=/\p{Script=Latin}/u.test(text);fam=cy&&!la?CYRIL:la&&!cy?LATIN:cy&&la?CYRIL.concat(LATIN):[u];}
    fam=fam.filter(has);
    if(fam.length===1)out=fam[0];
    else if(fam.length){
      const low=text.toLowerCase();let best=null,bs=0;const sc={};
      fam.forEach(l=>{const s=score(low,l);sc[l]=s;if(s>bs){bs=s;best=l;}});
      const us=fam.includes(u)?(sc[u]||0):-1;
      if(best===u)out=u;
      else if(us>=0)out=(bs>=3&&bs>=us*1.6+1)?best:u;            /* l'app parla una lingua della famiglia: serve un vantaggio netto */
      else out=bs>=1.5?best:(fam.includes('en')?'en':fam[0]);     /* alfabeto diverso da quello dell'app: la migliore, altrimenti la più diffusa */
    }
  }catch(e){out=u;}
  if(out!==u&&!ensurePack(out))out=u;   /* la lingua trovata serve con il suo lessico: se il file manca si resta a quella dell'app */
  if(DET.size>60)DET.clear();DET.set(text,out);
  return out;
}

/* ══════════════════════════════════════════════════════════════════
   2–6. PRIMA DEL MOTORE: comandi, luoghi comuni, giorno senza mese,
        note, priorità bassa, parole «tag»/«partecipanti» della lingua
══════════════════════════════════════════════════════════════════ */
/* articoli fra preposizione e luogo comune («al bar», «at the gym», «im Büro», «w biurze») */
const ARTS={it:"il lo la i gli le l' un una",en:'the a an my our',es:'el la los las un una mi',fr:"le la les l' un une au aux mon ma",de:'dem der den das die einem einer meinem meiner',pt:'o a os as um uma no na',pl:'',ru:'',uk:'',tr:'',id:'',vi:'',he:'ה',ar:'ال'};
/* piattaforme per incontri a distanza (valgono in ogni lingua) */
const ONLINE_SAFE=['online','zoom','skype','webex','facetime','whatsapp','telegram','discord'];           /* valgono anche da sole */
const ONLINE_PRE_ONLY=['google meet','meet','teams','microsoft teams','slack','call','hangouts'];      /* solo dopo una preposizione: «meet Anna» è un verbo */
const ONLINE_PRE='(?:su|sur|on|via|per|in|a|al|über|ueber|auf|по|через|em|en|durch|op|в|у|di|lewat|qua|trên|ב|على|عبر|দিয়ে|पर|で|으로|로|ผ่าน|pelo|pela|por|par|mit|con|через)';
const STR_SUF=/^(?:de|da|te|ta|nde|nda)$/;
function preProcess(text,l){
  const L=lex(l);const info={lead:null,leadEnd:null,remind:false,loc:null,pri:null};
  let t=' '+String(text||'').replace(/\s+/g,' ').trim()+' ';
  const remindW=new Set(arr(L.remind).map(x=>x.toLowerCase()));
  /* 2. comandi iniziali («ricordami di», «aggiungi», «remind me to») e finali («〜を追加して», «ekle») */
  const LD=arr(L.lead).slice().sort((a,b)=>b.length-a.length).map(w=>(NOSPACE.test(w[0])?'':LB)+esc(w)+(/['’]$/.test(w)||NOSPACE.test(w[w.length-1])?'':LA)).join('|');const ARTW=(ARTS[l]||'').trim();
  if(LD)for(let k=0;k<3;k++){const m=t.match(R('^\\s*(?:'+LD+')(?!\\s*[:：])\\s*(?=\\S)','iu'));if(!m||t.trim().length-m[0].trim().length<2)break;info.lead=((info.lead||'')+' '+m[0]).trim();t=' '+t.slice(m[0].length);
    /* «schedule a meeting» → «meeting»: l'articolo dopo il comando non serve */
    if(ARTW){const a=t.match(R('^\\s*(?:'+ARTW.split(' ').map(esc).join('|')+')\\s+(?=\\S)','iu'));if(a&&!/['’]$/.test(a[0].trim()))t=' '+t.slice(a[0].length);}
    /* «aggiungi un evento spesa» → «spesa»: il sostantivo generico dopo il comando (lessico leadNoun) */
    const LN=A(L.leadNoun);if(LN){const n=t.match(R('^\\s*(?:'+LN+')\\s+(?=\\S)','iu'));if(n&&t.trim().length-n[0].trim().length>=2)t=' '+t.slice(n[0].length);}}
  const LE=A(L.leadEnd);
  if(LE){const m=t.match(R('\\s*(?:'+LE+')\\s*[.!。]?\\s*$','iu'));if(m&&m.index>=2){info.leadEnd=m[0].trim();t=t.slice(0,m.index)+' ';}}
  const leadTxt=((info.lead||'')+' '+(info.leadEnd||'')).toLowerCase();
  if(leadTxt.trim()){info.remind=[...remindW].some(w=>w&&leadTxt.includes(w))||/ricord|remind|erinner|rappel|recu[eé]rd|lembr|напомн|нагада|hatırlat|ingatkan|nhắc|याद|মনে|思い出|リマインド|알려|提醒|เตือน|תזכיר|ذكّر|ذكر/u.test(leadTxt);}
  /* «ricordami domani alle 8 DI prendere le medicine»: il «di/che/to/zu…» dell'infinito può restare dopo data e ora */
  if(info.remind)t=t.replace(/^(\s*(?:\S+\s+){0,6}?)(di|d'|d’|ad|che|to|zu|de|que|om te|om|щоб|чтобы|для|untuk|để|कि|যে)\s+(?=\p{Ll}{3,})/iu,(m,a,w)=>{
    if(/\b(?:alle|at|um|à|a las|às|dalle|from|von|de|desde)\s*$/i.test(a))return m;          /* «alle di»? mai: si lascia */
    if(/^(?:to|de)$/i.test(w)&&/\d\s*$/.test(a))return m;                                   /* «from 8 to 9» non è l'infinito */
    return a+' ';});
  /* 3. luoghi comuni in minuscolo */
  const V=altCI(L.venues),PL=altCI(L.place),ART=(ARTS[l]||'').trim();
  const after=L.noSpaces?'':'(?:\\s+\\p{Lu}[\\p{L}\\p{M}\'’.-]*){0,3}';
  if(V&&!['ja','ko','zh','th'].includes(l)){
    let m=null;
    if(['hi','bn'].includes(l)){m=t.match(R('((?:'+V+')'+after+')\\s+(?:'+(PL||'(?!x)x')+')'+LA,'u'));}
    else if(l==='tr'){m=t.match(R('((?:'+V+'))(?:\'?(?:de|da|te|ta|nde|nda))(?![\\p{L}])','u'));}
    else if(PL){m=t.match(R(LB+'(?:'+PL+')\\s+(?:(?:'+(ART?ART.split(' ').map(esc).join('|'):'(?!x)x')+')\\s+)?((?:'+V+')'+after+')'+LA,'u'));
      /* «at Luigi's restaurant», «im Hotel Adlon» scritto come «at Central Park»: nome proprio prima del tipo di luogo */
      if(!m&&!L.noSpaces)m=t.match(R(LB+'(?:'+PL+')\\s+((?:\\p{Lu}[\\p{L}\\p{M}\'’.-]*\\s+){1,3}(?:'+V+'))'+LA,'u'));}
    /* «chiamare il dentista», «call the office»: il luogo è l'oggetto dell'azione, resta nel titolo */
    if(m){const before=t.slice(0,t.indexOf(m[0]));if(/(?:chiam|telefon|richiam|call|ring|phone|anruf|appel|téléphon|telephon|llam|ligar|liga|zadzwoń|zadzwon|dzwoń|позвон|подзвон|звон|ara\s|hubungi|telepon|gọi|goi)\S*\s+$/iu.test(before))m=null;}
    if(m){info.loc=cap(m[1].trim());info.locSpan=m[0].trim();t=t.replace(m[0],' ');}
  }
  /* incontri a distanza: «online», «su Zoom», «auf Teams» */
  if(!info.loc){const OS=A(ONLINE_SAFE.concat(arr(L.online).filter(w=>/\s/.test(w)))),OP=A(ONLINE_PRE_ONLY.concat(arr(L.online).filter(w=>!/\s/.test(w))));
    let m=OP?t.match(R(LB+ONLINE_PRE+'\\s+(?:'+OP+'|'+(OS||'(?!x)x')+')'+LA,'iu')):null;
    if(!m&&OS){m=t.match(R('(?:'+ONLINE_PRE+'\\s+)?(?:'+OS+')'+LA,'iu'));if(m&&m.index<=1&&/\s/.test(m[0].trim()))m=null;}
    if(m){const w=m[0].replace(R('^\\s*'+ONLINE_PRE+'\\s+','iu'),'').trim();info.loc=w.replace(/(^|\s)(\p{Ll})/gu,(x,a,b)=>a+b.toUpperCase());t=t.replace(m[0],' ');}}
  /* 4. giorno senza mese: «il 15», «on the 15th», «am 15.», «15日», «5 तारीख» → prossimo 15 del mese */
  if(l!=='it'){
    let mon=[];try{mon=KX.Lang.namesFor(l).mon.map(x=>x.toLowerCase());}catch(e){}
    (L.months||[]).forEach(p=>{if(Array.isArray(p)&&typeof p[0]==='string')mon.push(p[0].toLowerCase());});
    const hasMonth=mon.length&&R('(?:'+mon.map(esc).join('|')+')','iu').test(t);
    const hasNum=/\d{1,2}[\/.-]\d{1,2}|\d{4}-\d{2}/.test(t);
    if(!hasMonth&&!hasNum){
      const DO=A(L.dayOf),DS=A((L.daySuffix||[]).filter(w=>!/\s/.test(w)));
      const UNIT='(?!\\s*(?:[:.h]\\d|'+[A(L.hours),A(L.minutes),A(L.hourSuffix),A(L.minuteSuffix),A(L.days),A(L.weeks),A(L.months),A(L.pm),A(L.am)].filter(Boolean).join('|')+'))';
      const ORD='(?:º|°|\\.|st|nd|rd|th|-го|-е|e|er|ème|ème|\\u0e17\\u0e35\\u0e48)?';
      const toDate=d=>{const n=+d;if(!n||n>31)return null;const now=new Date();now.setHours(0,0,0,0);let dt=new Date(now.getFullYear(),now.getMonth(),n);if(dt<now)dt=new Date(now.getFullYear(),now.getMonth()+1,n);
        let M=[];try{M=MESI;}catch(e){}return ' '+n+' '+String(M[dt.getMonth()]||'').toLowerCase()+' '+(dt.getFullYear()!==now.getFullYear()?dt.getFullYear():'')+' ';};
      let done=false;
      if(DO)t=t.replace(R(LB+'(?:'+DO+')\\s*(\\d{1,2})'+ORD+'(?![\\d:.,])'+UNIT,'iu'),(m,d)=>{const r=toDate(d);if(!r||done)return m;done=true;return r;});
      const NOTDAY='(?!\\s*(?:間|以内|'+[A(L.in),A(L.before),A(L.every),A(L.until),A(L.for)].filter(Boolean).join('|')+'))';
      if(!done&&DS)t=t.replace(R('(?<![\\d:.])(\\d{1,2})\\s*(?:'+DS+')(?![\\p{N}])'+NOTDAY,'u'),(m,d)=>{const r=toDate(d);if(!r||done)return m;done=true;return r;});
      const DOS=arr(L.dayOrdinal).map(esc).join('|');   /* «the 5th», «le 1er» */
      if(!done&&DOS)t=t.replace(R('(?<![\\d:.])(\\d{1,2})(?:'+DOS+')(?![\\p{L}\\p{N}])'+UNIT,'u'),(m,d)=>{const r=toDate(d);if(!r||done)return m;done=true;return r;});
    }
  }
  /* «il primo del mese», «the first of the month», «am Ersten des Monats» → ogni mese, giorno 1 */
  try{const OM=A(L.ofMonth);const o1=Object.keys(L.ordinals||{}).filter(k=>L.ordinals[k]===1);const O1=A(o1.concat(['1º','1°','1st','1er','1.']));
    let WD='';try{const N=KX.Lang.namesFor(l);WD=A(N.wdn.concat((L.weekdays||[]).map(p=>Array.isArray(p)?p[0]:'').filter(Boolean)));}catch(e){}
    if(OM&&O1){t=t.replace(R(LB+'(?:(?:'+(A(L.dayOf)||'(?!x)x')+'|il|the|le|el|am|den|o|a)\\s+)?(?:'+O1+')\\s+(?:'+OM+')'+LA,'iu'),(m,off,str)=>{
      /* «il primo lunedì del mese», «ביום שני הראשון של החודש»: con un giorno della settimana vicino è un'altra regola (ennesimo giorno) */
      if(WD&&(R('(?:'+WD+')\\s+(?:\\S+\\s+)?$','iu').test(str.slice(0,off))||R('^\\s*(?:\\S+\\s+)?(?:'+WD+')','iu').test(str.slice(off+m.length))))return m;
      const now=new Date();now.setHours(0,0,0,0);let dt=new Date(now.getFullYear(),now.getMonth(),1);if(dt<now)dt=new Date(now.getFullYear(),now.getMonth()+1,1);
      let M=[];try{M=MESI;}catch(e){}return ' ogni mese 1 '+String(M[dt.getMonth()]||'').toLowerCase()+' '+(dt.getFullYear()!==now.getFullYear()?dt.getFullYear():'')+' ';});}}catch(e){}
  /* 5. «… nota portare i documenti» senza i due punti (solo testo libero, senza orari o date dentro) */
  const NT=A(L.note);
  if(NT){t=t.replace(R('\\s(?:'+NT+')\\s+(?![:：])(\\S+(?:\\s+\\S+)+)\\s*$','iu'),(m,rest)=>{
    if(/\d/.test(rest))return m;
    const cue=[A(L.at),A(L.from),A(L.to),A(L.today),A(L.tomorrow),A(L.every),A(L.with)].filter(Boolean).join('|');
    if(cue&&R('(?:'+cue+')','iu').test(rest))return m;
    return m.replace(R('^(\\s(?:'+NT+'))\\s+','iu'),'$1: ');});}
  /* 6. priorità bassa / «quando puoi» → normale, via dal titolo */
  const LP=A(L.lowPriority);
  if(LP)t=t.replace(R(LB+'(?:'+LP+')'+LA,'iu'),()=>{info.pri='normal';return ' ';});
  /* parole «tag …» e «partecipanti …» della lingua, in una frase libera */
  if(l!=='it'&&L.fields&&typeof L.fields==='object'&&!structured(t,L)){
    const TW=A(L.fields.tags);if(TW)t=t.replace(R(LB+'(?:'+TW+')\\s*[:：]?\\s+(?=[\\p{L}#])','giu'),' tag ');
    const PW=A(L.fields.people);if(PW)t=t.replace(R(LB+'(?:'+PW+')\\s*[:：]?\\s+(?=\\p{Lu}|[\\p{Script=Devanagari}\\p{Script=Bengali}\\p{Script=Arabic}\\p{Script=Hebrew}\\p{Script=Thai}])','gu'),' con ');
  }
  info.text=t.replace(/\s+/g,' ').trim();
  return info;
}
/* la frase è una dettatura «a campi»? (stessa regola del modulo 10: comincia con un campo, o ne ha almeno tre) */
function structured(t,L){
  const F=L.fields;if(!F||typeof F!=='object')return false;let n=0,first=Infinity;
  Object.keys(F).forEach(k=>{const a=A(F[k]);if(!a)return;const m=R('(?:'+a+')\\s*[:：]?','iu').exec(t);if(m){n++;first=Math.min(first,m.index);}});
  return n>=3||(n>=2&&t.slice(0,first).trim().length===0);
}
/* parole serali e mattutine della lingua, per la sicurezza serale */
function dayPart(L){
  const M=L.moments||{};
  const eve=[].concat(arr(L.tonight),arr(L.pm),arr(M.evening),arr(M.night),arr(M.dinner));
  const morn=[].concat(arr(L.thisMorning),arr(L.am),arr(M.morning),arr(M.breakfast));
  return{eve:A(eve),morn:A(morn)};
}
function post(out,info,l,raw){
  if(!out)return;
  if(info.loc&&!out.location)out.location=info.loc;
  /* «Weekend al mare», «Andare dal dentista»: senza il luogo il titolo resterebbe vuoto o un verbo solo → la frase del luogo resta anche nel titolo */
  {const tt=(out.title||'').trim();const nw=tt.split(/\s+/).filter(Boolean).length;
   const OBLIG=/devo|dovrei|bisogna|need to|have to|must|should|gotta|got to|ich muss|ich soll|ich will|ich möchte|je dois|il faut|tengo que|debo|hay que|necesito|tenho que|tenho de|preciso|muszę|musze|должен|должна|нужно|треба|lazım|lazim|harus|phải|phai|צריך|צריכה|يجب|لازم|चाहिए|হবে/i;
   const VERB=/(?:are|ere|ire|ar|er|ir|oir|re)$/i;
   if(info.locSpan&&(nw===0||(nw===1&&info.lead&&(OBLIG.test(info.lead)||VERB.test(tt)))))out.title=cap((tt+' '+info.locSpan.replace(/\s+/g,' ')).trim());}
  /* «Spesa al supermercato domani pomeriggio alle 4»: «pomeriggio» ha già fatto il suo lavoro (ore 16) */
  try{if(out.start!=null&&out.title){const L=lex(l);const M=L.moments||{};const mw=A([].concat(arr(M.morning),arr(M.afternoon),arr(M.evening),arr(M.night),arr(L.tonight),arr(L.thisMorning)));
    if(mw){const t2=out.title.replace(R('(?:\\s+(?:'+mw+'))+\\s*$','iu'),'').replace(/\s+/g,' ').trim();if(t2)out.title=t2;}}}catch(e){}
  if(info.pri==='normal')out.priority=null;
  if(info.remind&&out.reminder==null&&!(Array.isArray(out.reminders)&&out.reminders.length)){out.reminder=0;out._def=out._def||{};out._def.reminder=1;}
  /* 7. sicurezza serale */
  try{
    /* «am» vale come mattina solo dopo un numero («8 am»): in tedesco «am Samstag» è «di sabato» */
    if(out.start!=null&&!out.allDay&&out.start>=60&&out.start<12*60&&!/\b0\d[:.]\d{2}/.test(String(raw||''))&&!/\b\d{1,2}(?::\d{2})?\s*(?:am|a\.m\.?)\b/i.test(String(raw||''))){
      const P=dayPart(lex(l));const s=String(raw||'');
      if(P.eve&&R(P.eve,'iu').test(s)&&!(P.morn&&R(P.morn,'iu').test(s))){
        const dur=out.end!=null?out.end-out.start:null;out.start+=720;if(dur!=null)out.end=out.start+(dur>0?dur:60);}
    }
  }catch(e){}
  /* «Riunione, portare il contratto»: dopo una virgola, una frase che comincia con un verbo all'infinito o
     un imperativo («porta», «bring», «apporter») è una nota, non parte del titolo */
  try{if(out.title&&/,\s*\S/.test(out.title)){const V={it:/^(?:\p{L}+(?:are|ere|ire)|porta|prendi|compra|chiama|ricorda|ricordati|non dimenticare|non dimenticarti|controlla|stampa|invia|prenota|paga)\b/iu,
      en:/^(?:bring|take|buy|call|remember|don't forget|dont forget|prepare|print|send|book|check|pay|pick up|get)\b/iu,
      de:/^(?:\p{L}+(?:en|ern)\s+(?:nicht\s+)?vergessen|[\p{L}\s]+(?:mitbringen|mitnehmen|kaufen|anrufen|vorbereiten|drucken|schicken|bezahlen|abholen)$)/iu,
      fr:/^(?:apporter|prendre|acheter|appeler|préparer|preparer|ne pas oublier|imprimer|envoyer|réserver|reserver|payer|penser à)\b/iu,
      es:/^(?:llevar|traer|comprar|llamar|preparar|no olvidar|imprimir|enviar|reservar|pagar|recoger)\b/iu,
      pt:/^(?:levar|trazer|comprar|ligar|preparar|não esquecer|nao esquecer|imprimir|enviar|reservar|pagar|buscar)\b/iu}[l];
    if(V){const parts=out.title.split(/\s*,\s*/);const keep=[],note=[];parts.forEach((p,i)=>{if(i>0&&V.test(p.trim()))note.push(p.trim());else keep.push(p);});
      if(note.length&&keep.length){out.title=keep.join(', ');out.desc=[out.desc,...note.map(n=>n.charAt(0).toUpperCase()+n.slice(1))].filter(Boolean).join(' · ');}}}}catch(e){}
  /* il titolo non resta mai con un comando davanti o un segno in coda */
  if(out.title){out.title=out.title.replace(/^[\s,;:.\-–]+|[\s,;:.\-–]+$/g,'').replace(/\s+/g,' ');if(out.title)out.title=out.title.charAt(0).toUpperCase()+out.title.slice(1);}
}

/* ── aggancio al parser: dopo il modulo 10 (lingue) ── */
function hook(){
  if(!KX.NL2||KX.NL2._v56||!KX.NL2._v54||!KX.Lang||!KX.Lang.force)return;
  const base=KX.NL2.parse.bind(KX.NL2);
  KX.NL2.parse=function(raw0,opts){
    const u=ui();let l=u;
    try{const d=(opts&&opts.lang)||detect(raw0);if(d&&(PACKS[d]||d==='it')&&(d!==u||true))l=d;}catch(e){}
    const forced=l!==u;let out=null;
    if(forced)KX.Lang.force(l);
    try{
      let info={text:String(raw0||'')};
      try{info=preProcess(raw0,l);}catch(e){console.warn('[v56 pre]',e);}
      out=base(info.text);
      try{post(out,info,l,raw0);}catch(e){console.warn('[v56 post]',e);}
    }finally{if(forced)KX.Lang.force(null);}
    if(out)out._lang=l;
    return out;
  };
  KX.NL2._v56=true;
}

/* ══════════════════════════════════════════════════════════════════
   8. SCHEDA DI DETTATURA E IMPOSTAZIONE «LINGUA DELLA DETTATURA»
══════════════════════════════════════════════════════════════════ */
const RECENT='kx_voice_recent_v1';
const endonym=l=>{try{return L10N.ENDONYMS[l]||l;}catch(e){return l;}};
const supported=()=>{try{return L10N.supported.slice();}catch(e){return Object.keys(PACKS);}};
/* la lingua della dettatura per il riconoscitore (null = quella dell'app, con il suo locale regionale) */
function speechLang(){
  try{const v=AppSettings.voiceLang;if(!v||v===ui())return null;return (KX.Lang.SPEECH_LOCALE||{})[v]||v;}catch(e){return null;}
}
function voiceLang(){try{return AppSettings.voiceLang||ui();}catch(e){return ui();}}
function setVoiceLang(l){
  try{AppSettings.voiceLang=(!l||l===ui())?'':l;AppSettings.save();}catch(e){}
  try{if(l&&l!==ui()){const r=JSON.parse(localStorage.getItem(RECENT)||'[]').filter(x=>x!==l);r.unshift(l);localStorage.setItem(RECENT,JSON.stringify(r.slice(0,3)));}}catch(e){}
  try{const sel=document.getElementById('set-voicelang');if(sel)sel.value=AppSettings.voiceLang||'';}catch(e){}
}
function recent(){try{return JSON.parse(localStorage.getItem(RECENT)||'[]').filter(l=>supported().includes(l));}catch(e){return [];}}
let lastPrefill='';
/* la scheda vocale APERTA: quando si riparte, la vecchia resta nel DOM un istante → si prende l'ultima */
const curOv=()=>{const all=document.querySelectorAll('#kx-voice');return all.length?all[all.length-1]:null;};
/* chip delle lingue nella scheda vocale */
function langChips(card){
  if(!card||card.querySelector('.kx-v-langs'))return;
  const row=document.createElement('div');row.className='kx-v-langs';
  const cur=voiceLang();const list=[ui()].concat(recent().filter(l=>l!==ui()));if(!list.includes(cur))list.push(cur);
  const chip=(l)=>{const b=document.createElement('button');b.type='button';b.className='kx-v-lang'+(l===cur?' on':'');b.textContent=endonym(l);b.title=tr('Lingua della dettatura');
    b.onclick=()=>{if(l===cur)return;setVoiceLang(l);restart();};return b;};
  list.forEach(l=>row.appendChild(chip(l)));
  const more=document.createElement('button');more.type='button';more.className='kx-v-lang more';more.textContent='🌐 '+tr('Altre lingue…');
  more.onclick=()=>{const sel=document.createElement('select');sel.className='kx-v-sel';sel.setAttribute('aria-label',tr('Lingua della dettatura'));
    sel.innerHTML=supported().map(l=>`<option value="${l}"${l===cur?' selected':''}>${endonym(l)}</option>`).join('');
    sel.onchange=()=>{setVoiceLang(sel.value);restart();};row.replaceChild(sel,more);try{sel.focus();}catch(e){}};
  row.appendChild(more);
  const help=card.querySelector('.kx-v-help');if(help)card.insertBefore(row,help);else card.appendChild(row);
  /* «Cosa posso dire?»: gli esempi del pacchetto della lingua (frasi naturali, non tradotte) */
  try{const p=KX.Lang.pack(voiceLang());const c=p&&p.culture;if(help&&c&&(c.sampleVoice||c.sampleFull)){
    const ps=help.querySelectorAll('p');const ex=[c.sampleVoice,c.sampleFull,c.sampleSentence].filter(Boolean);
    ex.slice(0,ps.length).forEach((x,i)=>{ps[i].textContent='«'+x+'»';});}}catch(e){}
}
function restart(){try{KX.voice.open(lastPrefill);}catch(e){}}
/* anteprima dal vivo: cosa è stato capito finora */
let prevTimer=0;
function preview(text){
  const ov=curOv();if(!ov)return;
  let box=ov.querySelector('.kx-v-prev');
  if(!box){box=document.createElement('div');box.className='kx-v-prev';const txt=ov.querySelector('.kx-v-txt');if(txt)txt.after(box);else return;}
  const full=(lastPrefill+' '+text).trim();if(full.length<3){box.innerHTML='';return;}
  let P=null;try{P=KX.NL2.parse(full);}catch(e){}
  if(!P){box.innerHTML='';return;}
  const items=[];
  try{
    if(P._lang&&P._lang!==ui())items.push('🌐 '+endonym(P._lang));
    if(P.dates&&P.dates.length)items.push('📅 '+fmtDateLabel(P.dates[0])+(P.dates.length>1?' +'+(P.dates.length-1):''));
    if(P.allDay)items.push('☀️ '+tr('Tutto il giorno'));else if(P.start!=null)items.push('🕐 '+fmtTime(P.start)+(P.end!=null?'–'+fmtTime(P.end):''));
    if(P.rrule)items.push('🔁 '+KX.NL2.rrLabel(P.rrule));
    if(P.location)items.push('📍 '+P.location);
    if(P.people&&P.people.length)items.push('👥 '+P.people.join(', '));
    if(P.tags&&P.tags.length&&!(P._def&&P._def.tags))items.push('#'+P.tags.join(' #'));   /* solo i tag detti, non quelli proposti */
    if(P.reminder!=null||(P.reminders&&P.reminders.length))items.push('🔔');
    if(P.priority)items.push('⚡ '+(P.priority==='urgent'?tr('Urgente'):tr('Importante')));
    if(P.desc)items.push('🗒️ '+P.desc.slice(0,30));
  }catch(e){}
  box.innerHTML=items.length?'<b>'+tr('Capito finora')+':</b> '+items.map(x=>'<span>'+String(x).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))+'</span>').join(''):'';
}
function hookVoice(){
  if(!KX.voice||KX.voice._v56)return;
  const open=KX.voice.open,partial=KX.voice.partial;
  KX.voice.open=function(prefill){lastPrefill=(prefill||'').trim();const r=open.apply(this,arguments);try{const ov=curOv();langChips(ov&&ov.querySelector('.kx-v-card'));}catch(e){}return r;};
  KX.voice.partial=function(t){const r=partial.apply(this,arguments);clearTimeout(prevTimer);prevTimer=setTimeout(()=>preview(t),300);return r;};
  KX.voice._v56=true;
}
/* impostazione nelle Impostazioni › Lingua e paese */
function settingsRow(){
  if(document.getElementById('set-voicelang'))return;
  const langSel=document.getElementById('set-language');if(!langSel)return;
  const group=langSel.closest('.form-group');if(!group)return;
  const g=document.createElement('div');g.className='form-group';
  g.innerHTML=`<div class="form-label">🎤 ${tr('Lingua della dettatura')}</div><select class="form-input" id="set-voicelang"></select>
    <div class="set-caption">${tr("Per dettare in una lingua diversa da quella dell'app. La frase viene capita in tutte le lingue supportate, anche senza cambiare qui.")}</div>`;
  group.after(g);
  const sel=g.querySelector('select');
  sel.innerHTML=[`<option value="">${tr("Come l'app")}</option>`].concat(supported().map(l=>`<option value="${l}">${endonym(l)}</option>`)).join('');
  try{sel.value=AppSettings.voiceLang||'';}catch(e){}
  sel.onchange=()=>setVoiceLang(sel.value);
}

function init(){
  hook();hookVoice();settingsRow();
}
KX.Smart={detect,preProcess,speechLang,voiceLang,setVoiceLang,preview,score,markers};
/* il modulo 10 aggancia il parser al caricamento della pagina (e riprova dopo 1,5 s): qui si passa dopo */
if(document.readyState==='complete')setTimeout(init,30);else addEventListener('load',()=>setTimeout(init,30));
setTimeout(init,1600);setTimeout(init,3000);
})();
