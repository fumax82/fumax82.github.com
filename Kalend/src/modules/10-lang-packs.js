/* ══════════════════════════════════════════════════════════════════
   MODULO v54 — "Mondo" · pacchetti linguistici
   ------------------------------------------------------------------
   1. KX.Lang: accesso al pacchetto della lingua in uso (src/i18n/xx.json
      → window.KX_PACKS): lessico del parser, parole chiave auto-tag,
      pacchetto culturale.
   2. COMPILAZIONE AUTOMATICA IN OGNI LINGUA: il parser storico (NL2)
      capisce l'italiano (e un po' di inglese, spagnolo, francese,
      tedesco, portoghese). Invece di riscriverlo, questo modulo
      "canonicalizza" la frase: le parole del lessico della lingua
      («tomorrow», «明日», «завтра»…) diventano le parole italiane
      equivalenti («domani») PRIMA che il parser le legga. Il titolo
      resta nella lingua dell'utente perché il parser toglie solo le
      parole di data/ora/luogo/persone.
      Casi particolari gestiti qui:
        · orari con suffisso o prefisso («15時», «오후 3시», «शाम 7 बजे»);
        · preposizioni DOPO il numero («15時から16時まで», «提前30分钟»);
        · persone con particelle («田中さんと», «민수랑», «和小明»,
          «प्रिया के साथ»);
        · alfabeti con segni combinati (devanagari, bengalese, thai…)
          nei confini di parola e nei #tag.
   3. AUTO-TAG IN OGNI LINGUA E ALFABETO: la funzione KX.autoTag viene
      sostituita da una versione che conosce gli alfabeti non latini e
      usa le parole chiave del pacchetto linguistico oltre a quelle
      personalizzate dall'utente.
   Niente del codice precedente viene rimosso: in italiano tutto
   funziona esattamente come prima.
══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const KX=window.KX=window.KX||{};
const PACKS=window.KX_PACKS||{};

/* ── lingua e pacchetto in uso ──
   L10N e T sono costanti dello script principale: non stanno su window,
   per questo si usa typeof. */
/* v56: lo strato intelligente (11-nl-smart.js) può "forzare" la lingua quando la frase
   è scritta o dettata in una lingua diversa da quella dell'interfaccia */
let FORCE=null;
const uiLang=()=>{try{return (typeof L10N!=='undefined'&&L10N.resolvedLang)||'it';}catch(e){return 'it';}};
const lang=()=>FORCE||uiLang();
const tr=(s,p)=>{try{return typeof T==='function'?T(s,p):s;}catch(e){return s;}};
const pack=l=>PACKS[l||lang()]||null;
const lexOf=l=>((pack(l)||{}).lexicon)||{};
const arr=x=>Array.isArray(x)?x.filter(w=>typeof w==='string'&&w.trim()&&/\p{L}/u.test(w)):[];
const esc=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const R=(src,flags)=>new RegExp(src,flags||'giu');
/* Le parole italiane inserite dalle regole vengono "marcate" con ʘ (una
   lettera rara) finché tutte le regole non sono passate: così una parola
   del lessico uguale a una parola italiana (tedesco «alle» = ogni) non
   riscrive quello che abbiamo appena inserito. */
const M='ʘ';
const tok=w=>String(w).split(' ').map(x=>M+x+M).join(' ');
const unmark=t=>t.split(M).join('');

/* Alfabeti che NON separano le parole con spazi: per queste parole non
   si pretende un "confine di parola". Il coreano attacca le particelle
   DOPO la parola: niente confine finale. I segni combinati (\p{M}:
   matra devanagari, vocali thai…) fanno parte della parola. */
const NOSPACE_RE=/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;
const SUFFIX_RE=/[\p{Script=Hangul}]/u;
const LB='(?<![\\p{L}\\p{M}\\p{N}])',LA='(?![\\p{L}\\p{M}\\p{N}])';
function bounded(word){
  const first=word[0],last=word[word.length-1];
  const b1=NOSPACE_RE.test(first)?'':LB;
  const b2=(NOSPACE_RE.test(last)||SUFFIX_RE.test(last))?'':LA;
  return b1+esc(word)+b2;
}
const sortLong=list=>arr(list).slice().sort((a,b)=>b.length-a.length);
/* alternativa regex con confini (parole) e senza (suffissi/prefissi) */
const alt=list=>sortLong(list).map(bounded).join('|');
const altPlain=list=>sortLong(list).map(esc).join('|');
/* alternativa "case-insensitive sulla prima lettera", per regex senza
   il flag i (dove \p{Lu} deve restare davvero maiuscolo) */
const altCI=list=>sortLong(list).map(w=>{const a=w[0],u=a.toUpperCase(),l=a.toLowerCase();const head=u!==l?'['+esc(u)+esc(l)+']':esc(a);return (NOSPACE_RE.test(a)?'':LB)+head+esc(w.slice(1))+(NOSPACE_RE.test(w[w.length-1])||SUFFIX_RE.test(w[w.length-1])?'':LA);}).join('|');

/* ══════════════════════════════════════════════════════════════════
   1. CANONICALIZZAZIONE: frase nella lingua dell'utente → parole
      italiane che il parser conosce (solo se la lingua non è l'italiano)
══════════════════════════════════════════════════════════════════ */
/* categoria del lessico → parola italiana, sostituzione diretta */
const SIMPLE={
  today:'oggi',tomorrow:'domani',after:'dopodomani',tonight:'stasera',thisMorning:'stamattina',
  nextWeek:'settimana prossima',weekend:'weekend',weekdaysWord:'giorni feriali',allday:'tutto il giorno',
  urgent:'urgente',important:'importante',remind:'ricordamelo',every:'ogni',until:'fino al',
  daily:'ogni giorno',weekly:'ogni settimana',monthly:'ogni mese',yearly:'ogni anno',
  halfHour:"mezz'ora",oneHour:"un'ora",oneDay:'un giorno',biweekly:'ogni 2 settimane',half:'mezza',quarter:'un quarto',threeQuarters:'tre quarti',
  withStrong:'assieme a',ofMonth:'del mese',note:'note',
};
/* momenti della giornata (colazione/pranzo/cena restano nel titolo) */
const MOMENTS={morning:'mattina',noon:'mezzogiorno',afternoon:'pomeriggio',evening:'sera',night:'notte',midnight:'mezzanotte'};
const UNITS=[['hours','ore'],['minutes','minuti'],['days','giorni'],['weeks','settimane'],['months','mesi'],['years','anni'],['times','volte']];
const U_IT='(?:'+['ore','minuti','giorni','settimane','mesi','anni','volte'].map(u=>M+u+M).join('|')+')';
const ORD={1:'primo',2:'secondo',3:'terzo',4:'quarto','-1':'ultimo'};
/* possessivi davanti ai parenti («with my mom», «con mi madre») */
const POSS={en:'my our his her their',es:'mi mis nuestro nuestra nuestros nuestras su sus',fr:'mon ma mes notre nos son sa ses',
  de:'mein meine meinem meinen meiner unser unsere unserem unseren unserer',pt:'meu minha meus minhas nosso nossa nossos nossas',
  ru:'моим моей моими моего мой моя мои нашим нашей нашими',uk:'моїм моєю моїми мій моя мої нашим нашою',pl:'moim moją moimi mój moja moi naszym naszą',
  tr:'benim bizim',id:'saya kami kita',vi:'của tôi của mình',he:'שלי שלנו',ar:'',th:'ของฉัน ของผม'};
/* lingue in cui «con» viene DOPO il nome («प्रिया के साथ», «Ayşe ile») */
const WITH_AFTER=new Set(['hi','bn','tr','ur']);
/* articoli tra «con» e il nome («com a Ana», «con la Maria») */
const ARTICLES={pt:'a o as os',es:'la el los las',fr:'le la les',de:'dem der den',nl:'de het',ca:'la el en na',vi:'anh chị em bác cô chú ông bà thầy',id:'pak bu mas mbak kak bang',th:'',tr:''};
/* lingue in cui anche il luogo viene PRIMA della preposizione («हौज़ ख़ास में») */
const PLACE_AFTER=new Set(['hi','bn','ur']);
/* alfabeti senza maiuscole: le persone e i luoghi si riconoscono senza l'iniziale maiuscola */
const CASELESS_LANG=new Set(['ar','he','hi','bn','th','fa','ur']);
/* lingue in cui le abbreviazioni Intl dei giorni (रवि, सोम…) sono nomi di persona comunissimi */
const NO_SHORT_LABELS=new Set(['hi','bn']);
const noShortDayLabels=()=>NO_SHORT_LABELS.has(lang());
const CL_WORD='[\\p{Script=Devanagari}\\p{Script=Bengali}\\p{Script=Arabic}\\p{Script=Hebrew}\\p{Script=Thai}\\p{M}]{2,}';

/* v56: nomi di giorni e mesi di QUALUNQUE lingua supportata, da Intl (per la lingua
   dell'interfaccia si usano i nomi già calcolati dall'app). Indice 0 = domenica. */
const NAMES={};
const SPEECH_LOCALE={it:'it-IT',en:'en-US',zh:'zh-CN',hi:'hi-IN',es:'es-ES',fr:'fr-FR',de:'de-DE',pt:'pt-BR',ru:'ru-RU',ja:'ja-JP',ar:'ar-SA',ko:'ko-KR',tr:'tr-TR',bn:'bn-BD',pl:'pl-PL',id:'id-ID',vi:'vi-VN',th:'th-TH',he:'he-IL',uk:'uk-UA'};
function namesFor(l){
  if(l===uiLang()){try{if(GIORNI_FULL&&GIORNI_FULL.length===7&&MESI.length===12)return{wdn:GIORNI_FULL.slice(),lab:DAY_LABELS.slice(),mon:MESI.slice()};}catch(e){}}
  if(NAMES[l])return NAMES[l];
  const cap=x=>x?x.charAt(0).toUpperCase()+x.slice(1):x;
  const wdn=[],lab=[],mon=[];
  try{const loc=SPEECH_LOCALE[l]||l;const f=(o,d)=>new Intl.DateTimeFormat(loc,o).format(d);
    for(let d=0;d<7;d++){const ref=new Date(2024,7,4+d);/* 4 agosto 2024 è domenica */wdn.push(cap(f({weekday:'long'},ref)));lab.push(f({weekday:'short'},ref).replace(/\.$/,'').toUpperCase());}
    for(let m=0;m<12;m++)mon.push(cap(f({month:'long'},new Date(2024,m,15))));
  }catch(e){}
  return NAMES[l]={wdn,lab,mon};
}
const CACHE={};
function rules(l){
  if(CACHE[l])return CACHE[l];
  const L=lexOf(l);const first=[],rest=[];
  const PRI={weekdaysWord:0,biweekly:0,daily:1,weekly:1,monthly:1,yearly:1,urgent:1,important:1.5,every:3};
  const push=(words,to,list,pri,tail)=>{const a=alt(words);if(a)(list||rest).push({re:R('(?:'+a+')'+(tail||'')),to,pri:pri==null?2:pri});};
  const PARTICLES=['ja','ko','zh','th'].includes(l);
  /* «fino a/al» solo quando introduce davvero una data o un orario («Pociąg do Gdańska» resta un titolo) */
  const DAYW=alt([].concat(L.today||[],L.tomorrow||[],L.after||[]));
  const POSTPOS=['ja','ko','zh','th','hi','bn','tr','ur'].includes(l);
  const UNTIL_AHEAD=POSTPOS?'':'(?=\\s*(?:\\d|\u2063[MW]|'+(DAYW||'(?!x)x')+'|'+tok('oggi')+'|'+tok('domani')+'|'+tok('dopodomani')+'))';
  const UNTIL_AHEAD_NOW=POSTPOS?'':'(?=\\s*(?:\\d|\u2063M|'+(DAYW||'(?!x)x')+'|'+tok('oggi')+'|'+tok('domani')+'|'+tok('dopodomani')+'))';
  const everySet=new Set(arr(L.every).map(x=>x.toLowerCase()));
  /* «ogni» di 1-3 lettere (ru «по», pl «co») solo davanti a un numero, un giorno o un'unità */
  const UNITW=altPlain([].concat(...UNITS.map(u=>L[u[0]]||[])));
  const EVERY_AHEAD='(?=\\s*(?:\\d|\u2063W|'+(UNITW||'(?!x)x')+'))';
  Object.keys(SIMPLE).forEach(k=>{if(k==='withStrong')return;
    if(k==='until'){const w=arr(L[k]);/* una parola che è anche «ogni» (ru «по») non vale davanti a un giorno della settimana */
      push(w.filter(x=>!everySet.has(x.toLowerCase())),' '+tok(SIMPLE[k])+' ',null,PRI[k],UNTIL_AHEAD);push(w.filter(x=>everySet.has(x.toLowerCase())),' '+tok(SIMPLE[k])+' ',null,PRI[k],UNTIL_AHEAD_NOW);return;}
    if(k==='every'){const w=arr(L[k]);push(w.filter(x=>x.length<=3),' '+tok(SIMPLE[k])+' ',null,PRI[k],EVERY_AHEAD);push(w.filter(x=>x.length>3),' '+tok(SIMPLE[k])+' ',null,PRI[k]);return;}
    push(L[k],' '+tok(SIMPLE[k])+' ',null,PRI[k]);});
  /* «insieme a» accetta anche nomi minuscoli, ma davanti a una Maiuscola il
     semplice «con» evita che «assieme a Sara a Roma» faccia di Sara un luogo */
  if(!PARTICLES){
    const withSet=new Set(arr(L.with).map(x=>x.toLowerCase()));
    const plain=[],noun=[];
    const ADV=new Set(['together','along','junto','juntamente','razem','вместе','разом','zusammen','gemeinsam','insieme','assieme','ensemble','samen','bersama','cùng','birlikte','beraber','accompanied','joined']);
    arr(L.withStrong).forEach(ph=>{const m=ph.match(/^(\p{L}{4,})\s+(.+)$/u);if(m&&withSet.has(m[2].toLowerCase())&&!ADV.has(m[1].toLowerCase()))noun.push(ph);else plain.push(ph);});
    /* «dinner with Sarah» → «dinner con Sarah»: il sostantivo resta nel titolo */
    noun.forEach(ph=>{const m=ph.match(/^(\p{L}{4,})\s+(.+)$/u);rest.push({re:R('('+altCI([m[1]])+')\\s+(?:'+alt([m[2]])+')'),to:'$1 '+tok('con')+' '});});
    const ws=altCI(plain);if(ws){rest.push({re:R('(?:'+ws+')(?=\\s+\\p{Lu})','gu'),to:' '+tok('con')+' '});rest.push({re:R('(?:'+alt(plain)+')'),to:' '+tok(CASELESS_LANG.has(l)?'con':'assieme a')+' '});}
  }
  /* momenti della giornata: solo se la frase non ha già un orario (altrimenti
     «Ăn tối», «夕食», «저녁 식사» perderebbero la parola) */
  const MG={ja:'(?!食|飯|ご飯|餐|会)',zh:'(?!饭|餐|食|会)',ko:'(?!\\s*(?:식사|밥|약속))'}[l]||'';
  const moments=[];Object.keys(MOMENTS).forEach(k=>{const a=alt((L.moments||{})[k]);if(a)moments.push({re:R('(?:'+a+')'+MG),to:' '+tok(MOMENTS[k])+' '});});
  moments.sort((a,b)=>b.re.source.length-a.re.source.length);
  /* giorni e mesi: forme extra del lessico → nome Intl; e i nomi Intl stessi
     vengono "protetti" (così «下周五» dà venerdì e non «settimana prossima»+5) */
  const NM=namesFor(l);let wdn=NM.wdn.slice(),mon=NM.mon.slice(),lab=NM.lab.slice();
  /* i nomi diventano SEGNAPOSTO (\u2063W3\u2063) finché tutte le regole non
     sono passate, così «金曜» non viene riletto dentro «金曜日» */
  const tokW=i=>' \u2063W'+i+'\u2063 ',tokM=i=>' \u2063M'+i+'\u2063 ';
  const weekWords=new Set(arr(L.weeks).map(x=>x.toLowerCase()));
  if(NO_SHORT_LABELS.has(l))lab=[];
  const AMBIG_AHEAD='(?!\\s*(?:depan|lagi|ini|kemarin|yang lalu|lalu|berikutnya|'+(altPlain(L.next)||'(?!x)x')+'))';
  wdn.forEach((n,i)=>{if(!n)return;
    if(weekWords.has(n.toLowerCase()))first.push({re:R('(?<![\\p{N}]\\s{0,2})'+bounded(n)+AMBIG_AHEAD),to:tokW(i),len:n.length});
    else first.push({re:R(bounded(n)),to:tokW(i),len:n.length});if(lab[i]&&lab[i].length>=2&&lab[i].toLowerCase()!==n.toLowerCase()&&!weekWords.has(lab[i].toLowerCase()))first.push({re:R(bounded(lab[i])),to:tokW(i),len:lab[i].length});
    /* ebraico/arabo: «יום רביעי» si scrive anche «רביעי», «ורביעי» (e-mercoledì), «ברביעי» */
    if(['he','ar'].includes(l)){const last=n.split(/\s+/).pop();const head=n.split(/\s+/)[0];if(last&&last.length>=3&&last!==n){
      const pre=l==='he'?'(?<![\\p{L}\\p{M}\\p{N}])([ובל])?(?:'+esc(head)+'\\s+)?':'(?<![\\p{L}\\p{M}\\p{N}])(و)?(?:'+esc(head)+'\\s+)?';
      first.push({re:R(pre+esc(last)+'(?![\\p{L}\\p{M}\\p{N}])'),to:(m,pfx)=>(/^[ו]|^و/.test(pfx||'')?' '+tok('e')+' ':' ')+tokW(i),len:n.length+2});}}});
  (L.weekdays||[]).forEach(p=>{if(Array.isArray(p)&&typeof p[0]==='string'&&wdn[+p[1]]&&p[0].length>=2)first.push({re:R(bounded(p[0])),to:tokW(+p[1]),len:p[0].length});});
  mon.forEach((n,i)=>{if(n)first.push({re:R(bounded(n)),to:tokM(i),len:n.length});});
  /* v56 · ebraico/arabo: «ביולי» (a luglio), «بيوليو»: prefisso attaccato al nome del mese */
  if(['he','ar'].includes(l))mon.forEach((n,i)=>{if(n&&n.length>=3)first.push({re:R('(?<![\\p{L}\\p{M}\\p{N}])'+(l==='he'?'[ובלמ]':'[وبل]')+esc(n)+'(?![\\p{L}\\p{M}\\p{N}])'),to:tokM(i),len:n.length+1});});
  (L.months||[]).forEach(p=>{if(Array.isArray(p)&&typeof p[0]==='string'&&mon[+p[1]]&&p[0].length>=2)first.push({re:R(bounded(p[0])),to:tokM(+p[1]),len:p[0].length});});
  /* ordinali solo davanti a un giorno della settimana («first monday») */
  const dre='\u2063W\\d\u2063';
  Object.entries(L.ordinals||{}).forEach(([w,n])=>{if(ORD[n]){rest.push({re:R(bounded(w)+'(?=\\s*'+dre+')'),to:' '+tok(ORD[n])+' '});
    /* lingue con l'ordinale dopo il giorno («วันจันทร์แรก») */
    rest.push({re:R('('+dre+')\\s*'+bounded(w)),to:' '+tok(ORD[n])+' $1 '});}});
  first.sort((a,b)=>(b.len||b.re.source.length)-(a.len||a.re.source.length));rest.sort((a,b)=>(a.pri==null?2:a.pri)-(b.pri==null?2:b.pri)||b.re.source.length-a.re.source.length);
  /* frasi di ricorrenza che contengono numeri a parole: da proteggere prima di numberWords */
  const numWords=new Set(Object.keys(L.numbers||{}).map(x=>x.toLowerCase()));
  const protect=[];['weekdaysWord','biweekly','daily','weekly','monthly','yearly','every','oneDay','halfHour','oneHour'].forEach(k=>arr(L[k]).forEach(ph=>{if(ph.split(/\s+/).some(w=>numWords.has(w.toLowerCase())))protect.push(ph);}));
  CACHE[l]={first,rest,protect:sortLong(protect),moments,L};
  return CACHE[l];
}
/* numeri a parole → cifre, solo vicino a un orario/unità/mese */
function numberWords(t,L,l){
  const Q=L.quantities||{};
  Object.keys(Q).forEach(w=>{if(!w||typeof Q[w]!=='string')return;const m=Q[w].match(/^(\d+)\s+(\S+)$/);if(!m)return;
    const it=UNITS.find(u=>u[1]===m[2]);t=t.replace(R(bounded(w)),' '+m[1]+' '+(it?tok(m[2]):m[2])+' ');});
  const N=L.numbers||{};const nw=Object.keys(N).filter(k=>/\S/.test(k));if(!nw.length)return t;
  const nre='('+sortLong(nw).map(esc).join('|')+')';
  const units=altPlain([].concat(...UNITS.map(u=>L[u[0]]||[]),L.hourSuffix||[]));
  const cues=alt([].concat(L.at||[],L.from||[],L.to||[],L.in||[],L.for||[],L.pmPrefix||[],L.amPrefix||[]));
  const after=alt([].concat(L.pm||[],L.am||[],L.half||[],L.quarter||[],L.plus||[],L.minus||[]));
  let months=[];try{months=namesFor(l).mon.map(m=>m.toLowerCase());}catch(e){}
  const mre=months.map(esc).join('|');
  const dig=w=>String(N[String(w).toLowerCase()]);
  /* v56 · russo/ucraino: «полдевятого» = пол + девятого (8:30): si stacca il prefisso
     solo quando il resto è un numero a parole */
  if(l==='ru'||l==='uk')t=t.replace(R(LB+'(пол|пів)(?='+nre+LA+')'),'$1 ');
  const tight=!!L.noSpaces;
  /* v56: «ten to nine» (8:50), «twenty past eight» (8:20): a parole, solo minuti 5/10/20/25 — prima delle preposizioni («at ten…») */
  {const plusW=alt(L.plus),minusW=alt(L.minus);
   if(minusW)t=t.replace(R(LB+nre+'\\s+(?:'+minusW+')\\s+'+nre+LA),(m,a,b)=>{const mi=+dig(a),h=+dig(b);if(![5,10,20,25].includes(mi)||!(h>=1&&h<=24))return m;return ' '+tok('alle')+' '+((h+23)%24)+':'+two(60-mi)+' ';});
   if(plusW)t=t.replace(R(LB+nre+'\\s+(?:'+plusW+')\\s+'+nre+LA),(m,a,b)=>{const mi=+dig(a),h=+dig(b);if(![5,10,20,25].includes(mi)||!(h>=1&&h<=24))return m;return ' '+tok('alle')+' '+h+':'+two(mi)+' ';});}
  if(cues)t=t.replace(R(LB+'(?:'+cues+')\\s*'+nre+LA),(m,w)=>m.replace(w,dig(w)));
  const halfP=altPlain([].concat(L.half||[],L.quarter||[],L.threeQuarters||[]));
  if(halfP)t=t.replace(R(LB+'(?:'+halfP+')\\s+'+nre+LA),(m,w)=>m.replace(w,dig(w)));
  /* dopo l'unità serve un confine («nove» dentro «novembro» non è un numero), tranne dove le particelle si attaccano (coreano, lingue senza spazi) */
  if(units)t=t.replace(R((tight?'(?<![\\p{N}])':LB)+nre+'\\s*(?=(?:'+units+')'+((tight||l==='ko')?'':LA)+')'),(m,w)=>dig(w)+' ');
  /* «quarter past six», «half past six»: il numero dopo «past»/«to» diventa cifra */
  const pmw=alt([].concat(L.plus||[],L.minus||[]));
  if(pmw)t=t.replace(R(LB+'((?:'+pmw+')\\s+)'+nre+LA),(m,a,w)=>a+dig(w));
  if(after)t=t.replace(R(LB+nre+'\\s+(?='+after+')'),(m,w)=>dig(w)+' ');
  if(mre){t=t.replace(R(LB+nre+'\\s+(?=(?:'+mre+'))'),(m,w)=>dig(w)+' ');
    t=t.replace(R(LB+'((?:'+mre+')\\s+)'+nre+LA),(m,a,w)=>a+dig(w));}
  return t;
}
const two=n=>String(n).padStart(2,'0');
/* v56: un'ora SENZA «mattina/pomeriggio» esplicito resta senza lo zero iniziale («alle 3:00»),
   così lo strato v44 del parser può applicare la regola «1–6 senza altro = pomeriggio»
   («3時», «세 시», «三点半» → 15:00) e il contesto serale («stasera alle 8:30» → 20:30);
   con il prefisso («午前3時») l'ora è esplicita e resta «03:00» */
const hourTxt=(H,explicit)=>explicit?two(H):String(H);
/* orari e date scritte con suffissi/prefissi (cinese, giapponese, coreano,
   hindi, vietnamita…): «15時», «3点半», «오후 3시», «शाम 7 बजे», «15h» */
function suffixTimes(t,L,l){
  const LATIN_NEXT='(?![a-zA-Z\u00C0-\u024F])';
  /* thai: «2 ทุ่ม» = 20:00 (sera, +18), «บ่าย 2 โมง» = 14:00, «ตี 3» = 03:00 */
  t=t.replace(/(\d{1,2})\s*ทุ่ม(?:\s*ครึ่ง)?/gu,(m,h)=>{const H=+h+18;if(H>24)return m;return ' '+tok('alle')+' '+two(H)+':'+(/ครึ่ง/.test(m)?'30':'00')+' ';});
  t=t.replace(/บ่าย\s*(\d{1,2})\s*โมง(?:\s*ครึ่ง)?/gu,(m,h)=>{let H=+h;if(H<12)H+=12;return ' '+tok('alle')+' '+two(H)+':'+(/ครึ่ง/.test(m)?'30':'00')+' ';});
  t=t.replace(/บ่ายโมง(?:\s*ครึ่ง)?/gu,m=>' '+tok('alle')+' 13:'+(/ครึ่ง/.test(m)?'30':'00')+' ');
  t=t.replace(/(\d{1,2})\s*โมงเย็น(?:\s*ครึ่ง)?/gu,(m,h)=>{let H=+h;if(H<12)H+=12;return ' '+tok('alle')+' '+two(H)+':'+(/ครึ่ง/.test(m)?'30':'00')+' ';});
  t=t.replace(/เที่ยง(?:วัน)?(?![\p{L}])/gu,' '+tok('alle')+' 12:00 ');
  const hs=altPlain(arr(L.hourSuffix).filter(w=>!/\s/.test(w))),ms=altPlain(L.minuteSuffix),hf=altPlain(L.halfSuffix),pmP=altPlain(L.pmPrefix),amP=altPlain(L.amPrefix);
  /* «今晚10点», «明早8点»: la parola del momento (stasera, stamattina) fa da prefisso
     pomeriggio/mattina all'orario che segue, e il giorno resta nella frase */
  const TIMEAHEAD='(?=\\s*\\d{1,2}(?:[:.]\\d{2})?\\s*(?:'+(hs||'(?!x)x')+'|:))';
  const pm1=arr(L.pmPrefix)[0],am1=arr(L.amPrefix)[0];
  if(pm1){const tn=altPlain(L.tonight);if(tn)t=t.replace(R('(?:'+tn+')'+TIMEAHEAD),' '+tok('oggi')+' '+pm1+' ');}
  if(am1){const tm=altPlain(L.thisMorning);if(tm)t=t.replace(R('(?:'+tm+')'+TIMEAHEAD),' '+tok('oggi')+' '+am1+' ');}
  /* «साढ़े 7 बजे» = 7:30, «सवा 7» = 7:15, «पौने 8» = 7:45: la frazione viene PRIMA dell'ora */
  const PREF=[[L.halfPrefix,0,30],[L.quarterPrefix,0,15],[L.threeQuartersPrefix,-1,45]];
  PREF.forEach(([words,dh,mi])=>{const a=altPlain(words);if(!a)return;
    t=t.replace(R('(?:('+(pmP||'(?!x)x')+')|('+(amP||'(?!x)x')+'))?\\s*(?:'+a+')\\s*(\\d{1,2})(?![:.\\d])\\s*(?:'+(hs||'(?!x)x')+')?'),(m,pm,am,h)=>{let H=+h+dh;if(H<0||H>24)return m;if(pm&&H<12)H+=12;if(am&&H===12)H=0;return ' '+tok('alle')+' '+hourTxt(H,pm||am)+':'+two(mi)+' ';});});
  /* unità che iniziano col suffisso dell'ora («時間», «시간»): dopo il suffisso non deve seguire la coda */
  const tails=[];arr(L.hours).concat(arr(L.minutes),arr(L.days)).forEach(u=>arr(L.hourSuffix).forEach(h=>{if(u.length>h.length&&u.startsWith(h))tails.push(esc(u.slice(h.length)));}));
  const HNOT=tails.length?'(?!'+tails.join('|')+')':'';
  if(hs){
    const pre='(?:('+(pmP||'(?!x)x')+')|('+(amP||'(?!x)x')+'))?\\s*';
    /* minuti: «18h30» (attaccati), «3点20分» (con suffisso), «15時半» (mezza) */
    const MSP=L.noSpaces?'\\s*':'';
    const SPACED=['de','nl','vi'].includes(l)?'\\s*':'';   /* «10 Uhr 30» sì, «8 बजे 20 दिसंबर» no (il 20 è un giorno) */
    const MIN='(?:'+SPACED+'(\\d{2})(?![\\p{N}:])|'+MSP+'(\\d{1,2})\\s*(?:'+(ms||'(?!x)x')+')|\\s*('+(hf||'(?!x)x')+'))?';
    t=t.replace(R(pre+'(\\d{1,2})(?:[:.](\\d{2}))?\\s*(?:'+hs+')'+HNOT+LATIN_NEXT+MIN),
      (m,pm,am,h,m2,ma,mb,half)=>{let H=+h;if(H>24)return m;if(pm&&H<12)H+=12;if(am&&H===12)H=0;const MI=m2?+m2:ma?+ma:mb?+mb:(half?30:0);if(MI>59)return m;return ' '+tok('alle')+' '+hourTxt(H,pm||am)+':'+two(MI)+' ';});
  }
  /* «malam jam 8», «sore 4»: momento prima di un'ora SENZA suffisso né minuti → ore 12h+ */
  const AT=altPlain(arr(L.at).filter(w=>!/\s/.test(w)));
  if(pmP)t=t.replace(R('(?:'+pmP+')\\s*(?:(?:'+(AT||'(?!x)x')+')\\s*)?(\\d{1,2})(?![:.\\d\\p{L}])(?!\\s*(?:'+(hs||'(?!x)x')+'))'),(m,h)=>{let H=+h;if(H>24)return m;if(H<12)H+=12;return ' '+tok('alle')+' '+two(H)+':00 ';});
  if(amP)t=t.replace(R('(?:'+amP+')\\s*(?:(?:'+(AT||'(?!x)x')+')\\s*)?(\\d{1,2})(?![:.\\d\\p{L}])(?!\\s*(?:'+(hs||'(?!x)x')+'))'),(m,h)=>{let H=+h;if(H>24)return m;if(H===12)H=0;return ' '+tok('alle')+' '+two(H)+':00 ';});
  /* «下午 3:30», «शाम 7:15» (prefisso + orario con i due punti) */
  if(pmP)t=t.replace(R('(?:'+pmP+')\\s*(\\d{1,2})[:.](\\d{2})'+LA),(m,h,mi)=>{let H=+h;if(H<12)H+=12;return ' '+tok('alle')+' '+two(H)+':'+mi+' ';});
  if(amP)t=t.replace(R('(?:'+amP+')\\s*(\\d{1,2})[:.](\\d{2})'+LA),(m,h,mi)=>{let H=+h;if(H===12)H=0;return ' '+tok('alle')+' '+two(H)+':'+mi+' ';});
  const mo=altPlain(L.monthSuffix),da=altPlain(L.daySuffix);
  if(da)t=t.replace(R('(\\d{1,2})(?:'+da+')(?=\\s*\u2063M)'),'$1 ');
  if(mo&&da)t=t.replace(R('(\\d{1,2})\\s*(?:'+mo+')\\s*(\\d{1,2})\\s*(?:'+da+')'),(m,M,D)=>' '+D+'/'+M+' ');
  return t;
}
/* v56: DETTATURA «A CAMPI» in ogni lingua. L'aiuto della scheda vocale promette
   «Titolo …, giorno …, inizio …, fine …, preavviso …, tag …, partecipanti …,
   descrizione …, luogo …, priorità …»: il parser storico conosce solo le parole
   italiane, qui le parole del lessico (chiave «fields») diventano quelle italiane.
   Scatta solo con almeno DUE campi diversi nella frase: una parola isolata come
   «start» o «end» non cambia il senso di una frase libera. */
const FIELD_IT={title:'titolo',desc:'descrizione',day:'giorno',start:'inizio',end:'fine',rem:'preavviso',tags:'tag',people:'partecipanti',place:'luogo',pri:'priorità'};
function fieldsRule(t,L){
  const F=L.fields;if(!F||typeof F!=='object')return t;
  const hits=[];let first=Infinity;
  Object.keys(FIELD_IT).forEach(k=>{const a=alt(F[k]);if(!a)return;const re=R('(?:'+a+')\\s*[:：]?');const m=re.exec(t);re.lastIndex=0;if(m){hits.push({k,re});first=Math.min(first,m.index);}});
  /* «Zahnarzt … erinnere mich einen Tag vorher» ha due parole-campo (erinnere mich, Tag) ma non è una dettatura
     a campi: quella comincia con un campo («Titel …, Datum …») oppure ne ha almeno tre */
  if(hits.length<2||(hits.length<3&&t.slice(0,first).trim().length>0))return t;
  hits.forEach(h=>{t=t.replace(h.re,' '+tok(FIELD_IT[h.k])+' ');});
  return t;
}
/* «dalle … alle …» con preposizioni prima o dopo l'orario (から/まで, 부터/까지, से/तक) */
function ranges(t,L,l){
  const hsSet=new Set(arr(L.hourSuffix).map(x=>x.toLowerCase()));
  const from=alt(L.from),to=alt(L.to);
  const TM='(\\d{1,2}(?::\\d{2})?)';
  /* ebraico: «מ-9 עד 10» (prefisso attaccato col trattino) */
  t=t.replace(/(?<![\p{L}])מ-?(?=\d{1,2}(?::\d{2})?(?![\p{N}]))/gu,' '+tok('dalle')+' ');
  t=t.replace(/(?<![\p{L}])ב-(?=\d{1,2}(?::\d{2})?(?![\p{N}\/])(?!\s*\u2063M))/gu,' '+tok('alle')+' ');   /* v56: non davanti a un mese («ב-3 ביולי») */
  const ALLE=tok('alle'),DALLE=tok('dalle');
  /* v56: frazione PRIMA dell'ora, in testa a tutto (prima che «to» diventi «alle»): «Viertel nach sechs»
     (6:15), «quarter to nine» (8:45), «kwart over zes» → ore:minuti senza zero iniziale */
  {const QW=altPlain(L.quarter),HW2=altPlain(L.half),TQ=altPlain(L.threeQuarters);
   const plusW=alt(L.plus),minusW=alt(L.minus);
   [[QW,15],[HW2,30],[TQ,45]].filter(x=>x[0]).forEach(([w,mi])=>{
     if(plusW)t=t.replace(R(LB+'(?:'+w+')\\s+(?:'+plusW+')\\s+(\\d{1,2})(?![:.\\d])'),(m,h)=>+h>24?m:' '+ALLE+' '+h+':'+two(mi)+' ');
     if(minusW)t=t.replace(R(LB+'(?:'+w+')\\s+(?:'+minusW+')\\s+(\\d{1,2})(?![:.\\d])'),(m,h)=>+h>24?m:' '+ALLE+' '+((+h+23)%24)+':'+two(60-mi)+' ');});}
  const NOT_DATE='(?!\\s*(?:\u2063M|via|rue|\\p{Lu}))';   /* «au 20 décembre», «bis 5 Hauptstraße» non sono orari */
  const unitWords=[].concat(...UNITS.map(u=>L[u[0]]||[]));
  const UNITRE=unitWords.length?new RegExp('^(?:'+altPlain(unitWords)+'|'+U_IT+')(?![\\p{L}])','iu'):null;
  /* «alle 15:00 - alle 16:00» (da «15時〜16時») → «dalle 15:00 alle 16:00» */
  t=t.replace(R(ALLE+'\\s+'+TM+'\\s*[-–]\\s*'+ALLE+'\\s+'+TM),' '+DALLE+' $1 '+ALLE+' $2 ');
  if(from&&to){
    t=t.replace(R(ALLE+'\\s+'+TM+'\\s*(?:'+from+')\\s*'+ALLE+'\\s+'+TM+'\\s*(?:'+to+')'),' '+DALLE+' $1 '+ALLE+' $2 ');
    t=t.replace(R('(?:'+from+')\\s*'+ALLE+'\\s+'+TM+'\\s*(?:'+to+')\\s*'+ALLE+'\\s+'+TM),' '+DALLE+' $1 '+ALLE+' $2 ');
    t=t.replace(R(LB+'(?:'+from+')\\s*'+TM+'\\s*(?:'+to+')\\s*'+TM+'(?![\\p{N}:])'),' '+DALLE+' $1 '+ALLE+' $2 ');
  }
  if(from){
    t=t.replace(R('(?:'+ALLE+'\\s+)?'+TM+'\\s*(?:'+from+')'+LA+'(?=\\s*'+ALLE+'\\s+\\d)'),' '+DALLE+' $1 ');
    if(['ja','ko','zh','th','hi','bn','tr'].includes(l))t=t.replace(R(ALLE+'\\s+'+TM+'\\s*(?:'+from+')'+LA),' '+DALLE+' $1 ');
    t=t.replace(R(LB+'(?:'+from+')\\s*(?=(\\d{1,2}(?:[:.]\\d{2})?)(?![\\p{N}/]))(?=[^]*)'),(m,n,off,str)=>{const next=str.slice(off+m.length).replace(/^\d{1,2}(?:[:.]\d{2})?/,'').trimStart();return (/^(?:\u2063M|via\b|rue\b|\p{Lu})/u.test(next)||(UNITRE&&UNITRE.test(next)))?m:' '+DALLE+' ';});
  }
  if(to){
    /* v56: «von 14 bis alle 16:00» (l'ora dopo «bis» era già stata letta da un suffisso): «bis» sparisce */
    t=t.replace(R(LB+'(?:'+to+')\\s+(?='+ALLE+'\\s+\\d)'),' ');
    if(from)t=t.replace(R(LB+'(?:'+from+')\\s+'+ALLE+'\\s+'+TM),' '+DALLE+' $1 ');
    /* «9点到10点»: solo la parola «fino a» fra due orari → «dalle 9 alle 10» */
    t=t.replace(R(ALLE+'\\s+'+TM+'\\s*(?:'+to+')\\s*'+ALLE+'\\s+'+TM),' '+DALLE+' $1 '+ALLE+' $2 ');
    if(['ja','ko','zh','th','hi','bn','tr'].includes(l))t=t.replace(R(ALLE+'\\s+'+TM+'\\s*(?:'+to+')'+LA),' '+ALLE+' $1 ');
    t=t.replace(R(LB+'(?:'+to+')\\s*(?=(\\d{1,2}(?:[:.]\\d{2})?)(?![\\p{N}/]))(?=[^]*)'),(m,n,off,str)=>{const next=str.slice(off+m.length).replace(/^\d{1,2}(?:[:.]\d{2})?/,'').trimStart();return (/^(?:\u2063M|via\b|rue\b|\p{Lu})/u.test(next)||(UNITRE&&UNITRE.test(next)))?m:' '+ALLE+' ';});
  }
  /* due orari di seguito («alle 9:00 alle 10:00») sono un intervallo */
  t=t.replace(R(ALLE+'\\s+'+TM+'\\s+'+ALLE+'\\s+'+TM+'(?![\\p{N}:])'),' '+DALLE+' $1 '+ALLE+' $2 ');
  /* «9h», «20h30» → «9:00», «20:30» (francese, portoghese, vietnamita…) */
  t=t.replace(/(?<![\p{N}:])(\d{1,2})h(\d{2})?(?![\p{N}\p{L}])/giu,(m,h,mi)=>+h<=24?h+':'+(mi||'00'):m);
  /* v56: unità «ore» DOPO l'ora, quando c'è una preposizione davanti: «à 8 heures 30»,
     «um 8 Uhr 30», «в 8 часов 30 минут» → «8:30»; «à 8 heures et demie» → «8 et demie»;
     «um 8 Uhr» → «8». Senza preposizione («pendant 2 heures») resta una durata. */
  const CUE='(?:'+[alt(L.at),alt(L.from),alt(L.to),ALLE,DALLE].filter(Boolean).join('|')+')';
  const HRW=altPlain(arr(L.hourWord).length?L.hourWord:arr(L.hours).filter(w=>w.length>1));
  const MINW=altPlain(L.minutes);
  if(HRW){
    t=t.replace(R('(?<='+CUE+'\\s*)(\\d{1,2})\\s*(?:'+HRW+')\\s+(\\d{1,2})(?:\\s*(?:'+(MINW||'(?!x)x')+'))?(?![\\d:])'),(m,h,mi)=>(+h<=24&&+mi<=59)?h+':'+two(mi)+' ':m);
    t=t.replace(R('(?<='+CUE+'\\s*)(\\d{1,2})\\s*(?:'+HRW+')(?![\\p{L}\\p{M}\\p{N}])'),'$1 ');
  }
  /* v56: momento PRIMA dell'ora: «malam jam 8», «abends um 8», «вечером в 8», «por la tarde a las 4»
     (il contrario, «8 di sera», è gestito più sotto) */
  const UNITW2=altPlain([].concat(...UNITS.map(u=>L[u[0]]||[])));
  const AT1='(?:'+[alt(arr(L.at).filter(w=>!hsSet.has(w.toLowerCase()))),ALLE].filter(Boolean).join('|')+')';
  const NOUNIT='(?!\\s*(?:'+U_IT+(UNITW2?'|'+UNITW2:'')+'))';
  /* senza minuti l'ora resta «nuda» («alle 20»): così «e mezza» / «et demie» dopo di lei si legge ancora */
  const tonightSet=new Set(arr(L.tonight).concat(arr(L.thisMorning)).map(x=>x.toLowerCase()));
  const pmB=alt(arr(L.pm).filter(w=>!tonightSet.has(w.toLowerCase()))),amB=alt(arr(L.am).filter(w=>!tonightSet.has(w.toLowerCase())));
  const HM=(H,mi)=>mi?two(H)+':'+mi:String(H);
  /* «ce soir à 8», «hoje à noite às 8», «heute Abend um 8»: la parola «stasera» resta (è anche la data) e l'ora va alla sera */
  const TNW=alt(L.tonight),TMW=alt(L.thisMorning);
  if(TNW)t=t.replace(R(LB+'(?:'+TNW+')\\s+(?:'+AT1+'\\s+)?(\\d{1,2})(?:[:.](\\d{2}))?(?![\\p{N}])'+NOUNIT),(m,h,mi)=>{let H=+h;if(H>24)return m;if(H<12)H+=12;return ' '+tok('stasera')+' '+ALLE+' '+HM(H,mi)+' ';});
  if(TMW)t=t.replace(R(LB+'(?:'+TMW+')\\s+(?:'+AT1+'\\s+)?(\\d{1,2})(?:[:.](\\d{2}))?(?![\\p{N}])'+NOUNIT),(m,h,mi)=>{let H=+h;if(H>24)return m;if(H===12)H=0;return ' '+tok('stamattina')+' '+ALLE+' '+HM(H,mi)+' ';});
  if(pmB)t=t.replace(R(LB+'(?:'+pmB+')\\s+(?:'+AT1+'\\s+)?(\\d{1,2})(?:[:.](\\d{2}))?(?![\\p{N}])'+NOUNIT),(m,h,mi)=>{let H=+h;if(H>24)return m;if(H<12)H+=12;return ' '+ALLE+' '+HM(H,mi)+' ';});
  if(amB)t=t.replace(R(LB+'(?:'+amB+')\\s+(?:'+AT1+'\\s+)?(\\d{1,2})(?:[:.](\\d{2}))?(?![\\p{N}])'+NOUNIT),(m,h,mi)=>{let H=+h;if(H>24)return m;if(H===12)H=0;return ' '+ALLE+' '+HM(H,mi)+' ';});
  /* «wpół do dziewiątej», «в половине девятого», «halb neun», «setengah 8»: la mezz'ora PRIMA
     dell'ora piena (senza zero iniziale: il contesto serale può ancora spostarla) */
  const MEZZA=tok('mezza');const HALFW='(?:'+[MEZZA,altPlain(L.half)].filter(Boolean).join('|')+')';
  const TOW='(?:'+[ALLE,alt(L.to),alt(L.at)].filter(Boolean).join('|')+')';
  t=t.replace(R(LB+HALFW+'\\s+'+TOW+'\\s+(\\d{1,2})(?![:.\\d])'),(m,h)=>{const H=(+h+23)%24;return ' '+ALLE+' '+H+':30 ';});
  if(['de','nl','ru','uk','id'].includes(l))t=t.replace(R(LB+HALFW+'\\s+(\\d{1,2})(?![:.\\d])'),(m,h)=>' '+ALLE+' '+((+h+23)%24)+':30 ');
  /* «3 mezza» senza congiunzione (turco «üç buçukta») → «3 e mezza» */
  const FRACW=[MEZZA,tok('un quarto'),tok('tre quarti'),altPlain(L.half),altPlain(L.quarter),altPlain(L.threeQuarters)].filter(Boolean).join('|');
  t=t.replace(R('(\\d{1,2})\\s+(?='+FRACW+')'),'$1 '+tok('e')+' ');
  /* ore «e mezza», «meno un quarto» */
  const plus=alt(L.plus),minus=alt(L.minus);
  const FRAC=[tok('mezza'),tok('un quarto'),tok('tre quarti'),altPlain(L.half),altPlain(L.quarter),altPlain(L.threeQuarters)].filter(Boolean).join('|');
  if(plus)t=t.replace(R('(\\d{1,2})\\s+(?:'+plus+')\\s+(?='+FRAC+'|\\d{1,2}(?![\\p{N}:]))'),'$1 '+tok('e')+' ');
  if(minus)t=t.replace(R('(\\d{1,2})\\s+(?:'+minus+')\\s+(?='+tok('un quarto')+'|'+(altPlain(L.quarter)||'(?!x)x')+'|\\d{1,2}(?![\\p{N}:]))'),'$1 '+tok('meno')+' ');
  /* «ثمانية ونص», «שמונה וחצי»: congiunzione attaccata alla frazione */
  if(['ar','he'].includes(l)){const hw=altPlain(L.half);if(hw)t=t.replace(R('(\\d{1,2})\\s*[وו](?:'+hw+')'+LA),'$1 '+tok('e')+' '+tok('mezza')+' ');}
  /* «8 pm», «20:00 de la tarde»: solo accanto a un orario */
  const pm=alt(L.pm),am=alt(L.am);
  if(pm)t=t.replace(R('(?<![\\d/.:-])(\\d{1,2}(?::\\d{2})?)\\s*(?:'+pm+')'+LA),'$1 '+tok('di sera')+' ');
  if(am)t=t.replace(R('(?<![\\d/.:-])(\\d{1,2}(?::\\d{2})?)\\s*(?:'+am+')'+LA),'$1 '+tok('di mattina')+' ');
  return t;
}
/* durate, relativi, preavvisi, luoghi, persone: con una "spia" che eviti falsi positivi */
function guarded(t,L,l){
  const num='(?:\\d+(?:[.,]\\d+)?)';
  /* nelle lingue senza spazi o a suffissi («3日後», «2주마다», «10 นาทีก่อน») dopo l'unità
     può seguire subito un'altra parola: basta che non segua un'altra cifra */
  const TIGHT=!!L.noSpaces||['ja','ko','zh','th'].includes(l);
  const UA=TIGHT?'(?![\\p{N}])':LA;
  /* unità dopo un numero → italiano («2 hours» → «2 ore», «30分» → «30 minuti») */
  const HALF=tok("mezz'ora")+'|'+tok("un'ora")+'|'+tok('un giorno');
  UNITS.forEach(([k,it])=>{const a=altPlain(L[k]);if(a)t=t.replace(R('(?<![\\d:.])('+num+')\\s*(?:'+a+')'+UA),'$1 '+tok(it)+' ');});
  /* v56: «un'ora and a half», «2 Stunden und eine halbe» → «un'ora e mezza» */
  {const pl2=alt([].concat(L.plus||[],L.and||[])),hf2=altPlain(L.half);if(pl2&&hf2)t=t.replace(R('('+tok("un'ora")+'|\\d+\\s*'+tok('ore')+')\\s+(?:'+pl2+')\\s+(?:a\\s+|eine\\s+|une\\s+|una\\s+)?(?:'+hf2+'|'+tok('mezza')+')'+LA),'$1 '+tok('e')+' '+tok('mezza')+' ');}
  const fr=alt(L.for);if(fr)t=t.replace(R(LB+'(?:'+fr+')\\s*(?='+num+'\\s*'+U_IT+'|'+HALF+')'),' '+tok('per')+' ');
  const inn=alt(L.in);
  if(inn)t=t.replace(R(LB+'(?:'+inn+')\\s+(?='+num+'\\s*'+U_IT+'|'+HALF+')'),' '+tok('tra')+' ');
  /* «10 minutes before» / «提前30分钟» → «30 minuti prima» */
  const bf=alt(L.before);
  if(bf){t=t.replace(R('('+num+'\\s*'+U_IT+'|'+HALF+')\\s*(?:'+bf+')'+UA),'$1 '+tok('prima')+' ');t=t.replace(R(LB+'(?:'+bf+')\\s*('+num+'\\s*'+U_IT+'|'+HALF+')'),'$1 '+tok('prima')+' ');}
  /* persone */
  const withAll=[].concat(L.withStrong||[],L.with||[]);
  if(WITH_AFTER.has(l)){const w=alt(withAll);const relSet=new Set(arr(L.relatives).map(x=>x.toLowerCase()));const andA=alt(L.and);
    const NAME='\\p{L}[\\p{L}\\p{M}\'’-]*';const capRel=n=>relSet.has(n.toLowerCase())?n.charAt(0).toUpperCase()+n.slice(1):n;
    if(w)t=t.replace(R('('+NAME+(andA?'(?:\\s+(?:'+andA+')\\s+'+NAME+')*':'')+')\\s+(?:'+w+')'+LA),(m,names)=>{
      const parts=andA?names.split(R('\\s+(?:'+andA+')\\s+')):[names];return ' '+tok('con')+' '+parts.map(capRel).join(' '+tok('e')+' ')+' ';});}
  const w=alt(L.with);
  if(w){
    const poss=(POSS[l]||'').split(' ').filter(Boolean).map(esc).join('|');
    const relw=alt(L.relatives);
    if(relw)t=t.replace(R('((?:'+w+')\\s+)(?:(?:'+(poss||'(?!x)x')+')\\s+)?('+relw+')'),(m,a,r)=>a+r.charAt(0).toUpperCase()+r.slice(1));
    const and=alt(L.and);
    /* «con Mamą i tatą»: anche il secondo parente diventa una persona */
    if(relw&&and)t=t.replace(R('((?:'+w+')\\s+\\p{Lu}[\\p{L}\\p{M}\'’-]*)\\s+(?:'+and+')\\s+(?:(?:'+(poss||'(?!x)x')+')\\s+)?('+relw+')'),(m,a,r)=>a+' '+tok('e')+' '+r.charAt(0).toUpperCase()+r.slice(1));
    /* «Anna e Marco» → «Anna ʘeʘ Marco» solo nella parte della frase che segue «con»: un titolo
       come «Romeo i Julia» resta intero */
    if(and){const andRe=R('(\\p{Lu}[\\p{L}\\p{M}\'’-]*)\\s+(?:'+and+')\\s+(?=\\p{Lu})','gu');
      const withAny=[alt(withAll),tok('con'),tok('assieme a')].filter(Boolean).join('|');
      t=t.replace(R('((?:'+withAny+')\\s+)([^]*)$'),(m,c,rest)=>c+rest.replace(andRe,'$1 '+tok('e')+' '));}
    const artRe=(ARTICLES[l]||'').trim()?'(?:(?:'+ARTICLES[l].trim().split(' ').map(esc).join('|')+')\\s+)?':'';
    if(!WITH_AFTER.has(l)&&!['ja','ko','zh','th'].includes(l)){t=t.replace(R(LB+'(?:'+w+')(?=\\s+'+artRe+'\\p{Lu})','gu'),' '+tok('con')+' ');
      if(CASELESS_LANG.has(l))t=t.replace(R(LB+'(?:'+w+')(?=\\s+'+CL_WORD+')','gu'),' '+tok('con')+' ');}
  }
  t=t.replace(R(tok('assieme a')+'\\s+'+tok('con')),tok('assieme a'));
  t=t.replace(R(tok('con')+'\\s+'+tok('con')),tok('con'));
  /* v56 · arabo/ebraico: «נועה ויוסי», «سارة وأحمد» (la «e» attaccata al secondo nome) */
  if(['ar','he'].includes(l)){const C=l==='he'?'ו':'و';for(let k=0;k<3;k++)t=t.replace(R('((?:'+tok('con')+'|'+tok('e')+')\\s+[\\p{L}\\p{M}]{2,})\\s+'+C+'(?=[\\p{L}\\p{M}]{2,})'),'$1 '+tok('e')+' ');}
  const art=ARTICLES[l];
  if(art)t=t.replace(R('('+tok('con')+'|'+tok('assieme a')+')\\s+(?:'+art.split(' ').map(esc).join('|')+')\\s+(?=\\p{Lu})','gu'),'$1 ');
  /* luogo: preposizione + Maiuscola (lingue con maiuscole), o + parola in alfabeto senza maiuscole */
  const pl=altCI(L.place);
  if(pl&&!L.noSpaces){t=t.replace(R(LB+'(?:'+pl+')\\s+(?=\\p{Lu})','gu'),' '+tok('a')+' ');
    if(CASELESS_LANG.has(l)&&!PLACE_AFTER.has(l))t=t.replace(R(LB+'(?:'+pl+')\\s+(?='+CL_WORD+')','gu'),' '+tok('a')+' ');
    if(CASELESS_LANG.has(l)&&PLACE_AFTER.has(l)){const mk=altCI(arr(L.place).filter(w=>/[:：]$/.test(w)));if(mk)t=t.replace(R(LB+'(?:'+mk+')\\s*(?='+CL_WORD+')','gu'),' '+tok('a')+' ');}}
  /* il luogo (una o due parole) viene unito con un separatore invisibile, così caselessPlace() lo legge intero e non prende la parola dopo */
  if(PLACE_AFTER.has(l)){const pa=alt(L.place);if(pa)t=t.replace(R('('+CL_WORD+'(?:\\s+'+CL_WORD+')?)\\s+(?:'+pa+')'+LA,'gu'),(m,a)=>' '+tok('a')+' '+a.replace(/\s+/g,'\u2062')+' ');}
  const st=COMPOUND_STREET[l]?'':altCI(L.streets);if(st)t=t.replace(R(LB+'(?:'+st+')\\s+(?=[\\p{Lu}\\d])','gu'),' '+tok('via')+' ');
  if(l==='tr')t=t.replace(/(\p{Lu}[\p{L}]+)'(?:de|da|te|ta|nde|nda)(?![\p{L}])/gu,(m,a)=>' '+tok('a')+' '+a+' ');
  if(l==='tr'){t=t.replace(/(\p{Lu}[\p{L}]+)\s+(Caddesi|Sokak|Sokağı|Bulvarı|Mahallesi|Cd\.|Sk\.)\s*(\d+[a-z]?)?/gu,(m,a,ty,n)=>' '+tok('via')+' '+a+' '+ty+(n?' '+n:'')+' ');}
  return t;
}
/* «at 8» / «à 20h30» → «alle»: dopo le altre regole (così «jusqu'au 20» resta
   «fino al 20») e non quando il numero è un civico («au 5 rue…») */
function atRule(t,L){
  const hsSet=new Set(arr(L.hourSuffix).map(x=>x.toLowerCase()));
  const at=alt(arr(L.at).filter(w=>!hsSet.has(w.toLowerCase())));
  if(at){t=t.replace(R(LB+'(?:'+at+')\\s+(?=\\d{1,2}(?:[:.h]\\d{2})?(?![\\p{N}])(?!\\s*(?:'+tok('via')+'|rue|\u2063M|\\p{Lu})))','gu'),' '+tok('alle')+' ');
    t=t.replace(R(LB+'(?:'+at+')\\s+(?=(?:'+tok('alle')+'|'+tok('dalle')+')\\s)'),' ');
    /* «at 5 Baker Street»: non è un orario, è un luogo */
    t=t.replace(R(LB+'(?:'+at+')\\s+(?=\\d{1,5}\\s+(?:\\p{Lu}|'+tok('via')+'))','gu'),' '+tok('presso')+' ');}
  return t;
}
/* riordino finale nella forma italiana: «30 minuti prima ricordamelo» → «ricordamelo 30 minuti prima»,
   «2 ore 后» → «tra 2 ore» */
function postpositions(t,L,l){
  const PRIMA=tok('prima'),RIC=tok('ricordamelo'),FINO=tok('fino al');
  /* «毎月第1月曜日», «매달 첫째 월요일», «每月第一个周一»: «ogni mese primo W» → «primo W del mese» */
  const ORDS='(?:'+Object.values(ORD).map(tok).join('|')+')';
  t=t.replace(R('(?:'+tok('ogni mese')+'|'+tok('del mese')+'|'+tok('ogni')+'\\s+'+tok('mese')+')\\s*(?:के|का|की|的|の|의|এর)?\\s*('+ORDS+')\\s*(?:के|का|की|的|の|의)?\\s*(\u2063W\\d\u2063)'),' $1 $2 '+tok('del mese')+' ');
  t=t.replace(R('('+ORDS+')\\s*(\u2063W\\d\u2063)\\s*(?:'+tok('ogni mese')+'|'+tok('ogni')+'\\s+'+tok('mese')+')'),' $1 $2 '+tok('del mese')+' ');
  /* «settimana prossima の venerdì» → «settimana prossima venerdì» (il parser legge la coppia) */
  t=t.replace(R(tok('settimana prossima')+'\\s*(?:の|의)?\\s*(?=\u2063W)'),tok('settimana prossima')+' ');
  /* «毎週月曜» → «ogni settimana lunedì» → «ogni lunedì» */
  t=t.replace(R(tok('ogni settimana')+'\\s+(?=\u2063W)'),tok('ogni')+' ');
  const HALF=tok("mezz'ora")+'|'+tok("un'ora");
  t=t.replace(R('((?:\\d+\\s*'+U_IT+'|'+HALF+')\\s+'+PRIMA+')\\s+('+RIC+')'),'$2 $1');
  /* «20 dicembre まで» → «fino al 20 dicembre» (quando «fino al» non è seguito da una data) */
  const DATE='(?:\\d{1,2}\\.?\\s*(?:(?:de|of|di|du|del)\\s+)?\u2063M\\d+\u2063|\\d{1,2}/\\d{1,2})(?:\\s+\\d{4})?';
  t=t.replace(R('('+DATE+')\\s*'+FINO+'(?!\\s*(?:\\d|\u2063))'),' '+FINO+' $1 ');
  /* «fino al 20 dicembre» va in coda alla frase: il parser lo legge meglio lì */
  let tail='';
  t=t.replace(R('\\s*'+FINO+'\\s+('+DATE+')\\s*,?'),(m,d)=>{tail+=' '+FINO+' '+d;return ' ';});
  t+=tail;
  const inn=alt(L.in);
  const UA=(L.noSpaces||['ja','ko','zh','th'].includes(l))?'(?![\\p{N}])':LA;   /* v56: «3 giorni后取快递» */
  if(inn)t=t.replace(R('(\\d+\\s*'+U_IT+')\\s*(?:'+inn+')'+UA),' '+tok('tra')+' $1 ');
  /* «2 settimane ogni» (ja «2週間ごとに») → «ogni 2 settimane» */
  t=t.replace(R('(\\d+\\s*'+U_IT+')\\s+'+tok('ogni')+'(?!\\s*(?:\\d|\u2063W))'),' '+tok('ogni')+' $1 ');
  return t;
}
/* persone nelle lingue con particelle attaccate: «田中さんと», «민수랑», «和小明» */
function cjkPeople(raw,out,L,l){
  if(!['ja','ko','zh','th'].includes(l))return;
  const andW=new Set(arr(L.and));
  const w=arr(L.with).concat(arr(L.withStrong)).filter(x=>x.length<=(l==='th'?10:5));if(!w.length)return;
  const W=sortLong(w).map(esc).join('|');
  const found=[];let m;
  const isDay=n=>/[曜週月日]|요일|วัน|จันทร์|อังคาร|พุธ|พฤหัส|ศุกร์|เสาร์|อาทิตย์|^(今日|明日|午前|午後|来週|今週|毎週|昨日|오늘|내일|오전|오후|다음주|이번주|พรุ่งนี้|วันนี้)$/.test(n);
  if(l==='zh'){const re=R('(?:'+W+')([\\p{Script=Han}A-Za-z]{2,4}?(?:[、，,][\\p{Script=Han}A-Za-z]{2,4}?)*)(?=一起|吃|去|开|见|聊|打|约|玩|喝|谈|讨论|在|到|还有|[\\s,，。]|$)');while((m=re.exec(raw)))m[1].split(/[、，,]/).forEach(n=>{if(n)found.push(n);});}
  else if(l==='ja'){const re=R('(?:(?<![\\p{Script=Han}\\p{Script=Katakana}])([\\p{Script=Han}\\p{Script=Katakana}]{1,4})|(?<=^|[にでをはが、\\s\\d])([\\p{Script=Hiragana}]{2,4}?))(?:さん|様|さま|くん|ちゃん|先生|部長|課長)?(?:'+W+')');while((m=re.exec(raw))){const n=m[1]||m[2];if(n&&!isDay(n)&&!/[とにでをは]$/.test(n))found.push(n);}}
  else if(l==='th'){const re=R('(?:'+W+')([\\p{Script=Thai}]{2,10}?)(?=\\s|$|ที่|วัน|เวลา|ตอน|และ)');while((m=re.exec(raw))){if(!isDay(m[1]))found.push(m[1]);}}
  else{const re=R('(?<![\\p{Script=Hangul}])([\\p{Script=Hangul}]{2,4}?)(?:씨|님|선생님)?(?:'+W+')(?=[\\s,.]|$)');while((m=re.exec(raw))){if(!isDay(m[1]))found.push(m[1]);}}
  if(!found.length)return;
  out.people=out.people||[];
  found.forEach(n=>{if(!out.people.includes(n))out.people.push(n);});
  if(out.title){let t=out.title;found.forEach(n=>{t=t.replace(new RegExp(esc(n)+'(?:さん|様|さま|くん|ちゃん|先生|部長|課長|씨|님|선생님)?(?:'+W+')(?:一起)?','gu'),' ');t=t.replace(new RegExp('(?:'+W+'|[、，,])'+esc(n),'gu'),' ');});
    out.title=t.replace(/\s+/g,' ').trim();}
}
/* luoghi nelle lingue con particelle: «渋谷で», «강남에서», «在北京» */
function cjkPlace(raw,out,l){
  if(out.location||!['ja','ko','zh','th','tr'].includes(l))return;
  let m=null;
  if(l==='th')m=raw.match(/(?:(?<![\p{Script=Thai}])ที่|ที่(?=ถนน|ซอย|ร้าน|โรง|บ้าน|สวน|ห้าง|ตลาด|คาเฟ่|ออฟฟิศ|บริษัท|มหาวิทยาลัย|สนาม|สถานี|คลินิก|ธนาคาร|วัด|โบสถ์|อาคาร|ตึก|หมู่บ้าน|จังหวัด|อำเภอ|เขต|กรุงเทพ|เชียงใหม่|ภูเก็ต))([\p{Script=Thai}\d]{2,14}?(?:\s+\d+(?:\/\d+)?)?(?:\s+(?!กับ|วัน|เวลา|ตอน|และ|ทุก)[\p{Script=Thai}]{2,14})?)(?=\s|$|กับ|วัน|เวลา|ตอน|และ)/u);
  else if(l==='tr'){m=raw.match(/(\p{Lu}[\p{L}]+(?:\s+\p{Lu}[\p{L}]+)?)['’](?:de|da|te|ta)(?![\p{L}])/u);
    if(m){let names=[];try{names=MESI.concat(GIORNI_FULL).map(x=>x.toLowerCase());}catch(e){}
      const Lx=lexOf(l);(Lx.months||[]).concat(Lx.weekdays||[]).forEach(p=>{if(Array.isArray(p)&&typeof p[0]==='string')names.push(p[0].toLowerCase());});
      const w=m[1].toLowerCase();if(names.some(n=>n===w||n.replace(/['’].*$/,'')===w))m=null;}}
  else if(l==='ja')m=raw.match(/(?<![\p{Script=Han}\p{Script=Katakana}\d])([\p{Script=Han}\p{Script=Katakana}]{2,8}(?:[\d-]{1,9})?)(?:で|にて)(?=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\s]|$)/u);
  else if(l==='ko')m=raw.match(/(?<![\p{L}\d])((?:[\p{Script=Hangul}]{2,}\s*){1,3}\d*)에서(?=[\s,.]|$)/u);
  else m=raw.match(/在([\p{Script=Han}A-Za-z]{2,8}?(?:\d{1,5}号?)?)(?=和|跟|与|吃|开|见|的|一起|参加|[\s,，。]|$)/u);
  if(!m)return;
  const loc=m[1].trim();if(/^(今日|明日|来週|今週|오늘|내일|明天|今天|下周|这周)$/.test(loc))return;
  try{const rel=new Set(arr(lexOf(l).relatives).map(x=>x.toLowerCase()));if(rel.has(loc.toLowerCase()))return;}catch(e){}
  out.location=loc;
  if(out.title){out.title=out.title.replace(m[0],' ').replace(new RegExp(esc(loc)+"(?:'(?:de|da|te|ta))?",'u'),' ').replace(/\s+/g,' ').trim();}
}
/* indirizzi composti («Hauptstraße 5», «Bahnhofplatz 2, Zürich»): tedesco, olandese, scandinavo */
const COMPOUND_STREET={de:'straße|strasse|str\\.|weg|platz|allee|gasse|ring|damm|ufer|chaussee',nl:'straat|laan|weg|plein|gracht|kade|singel',sv:'gatan|vägen|gränd|torget',da:'gade|vej|allé',no:'gata|veien|vegen'};
function compoundStreet(raw,out,l){
  const suf=COMPOUND_STREET[l];if(!suf)return;
  const m=raw.match(new RegExp('(\\p{Lu}[\\p{L}-]*(?:'+suf+')\\s*\\d*[a-z]?(?:\\s*,\\s*\\p{Lu}[\\p{L}-]+)?)','u'));
  if(!m)return;if(out.location&&!m[1].startsWith(out.location))return;out.location=m[1].trim();
  if(out.title){const tail=m[1].replace(/^\S+\s*/,'');out.title=out.title.replace(new RegExp('\\s*(?:in der|in de|im|am|an der|auf der|bei der|in|op de|på|i)?\\s*'+esc(m[1])+'\\s*','u'),' ');
    if(tail.length>=2)out.title=out.title.replace(new RegExp('(?:^|\\s)(?:in der|in de|im|am|an der|auf der|bei der|in|op de|på|i)?\\s*'+esc(tail)+'(?=\\s|$)','u'),' ');}
  if(out.title)out.title=out.title
    .replace(/(?:^|\s)(?:a\s+)?via\s+\d+[a-z]?(?:\s*,\s*\S+)?/u,' ').replace(/\s+/g,' ').trim();
}
/* persone scritte in alfabeti senza maiuscole (hindi, arabo, ebraico, thai…):
   il parser storico cerca un'iniziale maiuscola, qui si legge «con X» direttamente */
const CASELESS=/^[\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Thai}\p{M}\s]+$/u;
function caselessPeople(canon,out){
  const re=/(?:^|\s)(?:con|assieme a)\s+([\p{L}\p{M}]+(?:\s+e\s+[\p{L}\p{M}]+)*)/gu;let m;const found=[];
  while((m=re.exec(canon))){const names=m[1].split(/\s+e\s+/u).filter(n=>CASELESS.test(n)&&n.length>=2);if(names.length)found.push(...names);}
  if(!found.length)return;
  out.people=out.people||[];found.forEach(n=>{if(!out.people.includes(n))out.people.push(n);});
  if(out.title){let t=out.title;
    /* v56: via tutta la frase «con X e Y e Z», non un nome alla volta */
    t=t.replace(/(?:^|\s)(?:con|assieme a)\s+[\p{L}\p{M}]+(?:\s+e\s+[\p{L}\p{M}]+)*/giu,m=>found.some(n=>m.includes(n))?' ':m);
    found.forEach(n=>{t=t.replace(new RegExp('(?:^|\\s)(?:con|assieme a)\\s+'+esc(n)+'(?:\\s+e)?','giu'),' ');});out.title=t.replace(/\s+/g,' ').trim();}
}
/* v56: luoghi con l'affisso attaccato: ebraico «בירושלים» (ב + città), bengalese «ঢাকায়»,
   «অফিসে» (luogo + suffisso locativo). Si accetta solo una parola che NON è nel lessico
   (né momento, né parente, né giorno/mese) e che non è una persona già trovata. */
function attachedPlace(canon,out,l){
  if(out.location||!['he','bn'].includes(l))return;
  const L=lexOf(l);const known=new Set();
  /* si accettano SOLO luoghi noti: parole del lessico «venues» (luoghi comuni) e «cities» (città) */
  const places=new Set(arr(L.venues).concat(arr(L.cities)).map(x=>x.toLowerCase()));if(!places.size)return;
  const addAll=v=>{if(Array.isArray(v))v.forEach(x=>{if(typeof x==='string')x.toLowerCase().split(/\s+/).forEach(w=>known.add(w));else if(Array.isArray(x)&&typeof x[0]==='string')known.add(x[0].toLowerCase());});
    else if(v&&typeof v==='object')Object.keys(v).forEach(k=>{known.add(k.toLowerCase());addAll(v[k]);});};
  Object.values(L).forEach(addAll);
  try{const NM=namesFor(l);NM.wdn.concat(NM.mon,NM.lab).forEach(x=>x&&x.toLowerCase().split(/\s+/).forEach(w=>known.add(w)));}catch(e){}
  (out.people||[]).forEach(p=>known.add(String(p).toLowerCase()));
  const re=l==='he'?/(?<![\p{L}\p{M}])ב([\p{Script=Hebrew}]{3,})(?![\p{L}\p{M}])/gu
    :/(?<![\p{L}\p{M}])([\p{Script=Bengali}]{2,}?)(?:\u09AF\u09BC|\u09DF|\u09A4\u09C7|\u09C7)(?![\p{L}\p{M}])/gu;
  let m;while((m=re.exec(canon))){let full=m[0],stem=m[1];
    /* città di due parole: «בתל אביב» → «תל אביב» */
    if(!places.has(stem.toLowerCase())){const nx=canon.slice(m.index+full.length).match(/^\s+([\p{L}\p{M}]{2,})/u);
      if(nx&&places.has((stem+' '+nx[1]).toLowerCase())){stem=stem+' '+nx[1];full=full+nx[0];}else continue;}
    if(known.has(full.toLowerCase())||(out.people||[]).some(p=>String(p).toLowerCase()===stem.toLowerCase()))continue;
    out.location=stem;
    if(out.title)out.title=out.title.replace(new RegExp('(?:^|\\s)'+esc(full)+'(?=\\s|$)','u'),' ').replace(/\s+/g,' ').trim();
    return;}
}
function caselessPlace(canon,out,l){
  if(out.location||!CASELESS_LANG.has(l))return;
  const W2=CL_WORD.replace('{2,}','\u2062]{2,}').replace(/\]\u2062\]/,'\u2062]');   /* parola che può contenere il separatore invisibile */
  const second=PLACE_AFTER.has(l)?'':'(?:\\s+'+CL_WORD+')?';
  const m=canon.match(new RegExp('(?:^|\\s)a\\s+('+W2+second+'(?:\\s*\\d+[^\\s,،]*)?(?:\\s*[,،]\\s*'+CL_WORD+'(?:\\s+'+CL_WORD+')?)?)(?=\\s|$)','u'));
  if(!m)return;out.location=m[1].replace(/\u2062/g,' ');
  if(out.title)out.title=out.title.replace(new RegExp('(?:^|\\s)a?\\s*'+esc(m[1]),'u'),' ').replace(/\u2062/g,' ').replace(/\s+/g,' ').trim();
}
/* parole italiane rimaste nel titolo di una frase non italiana: sono residui
   della canonicalizzazione, mai parole dell'utente */
const IT_ARTIFACTS=['fino al','assieme a','settimana prossima','tutto il giorno','giorni feriali','di sera','di mattina','del mese','un quarto','tre quarti',"mezz'ora","un'ora",
  'ricordamelo','dalle','alle','ogni','prima','tra','via','mattina','mattino','pomeriggio','sera','notte','mezzogiorno','mezzanotte','domani','oggi','dopodomani','stasera','stamattina','weekend','ore','minuti','giorni','settimane','mesi','anni','volte','mezza','meno','urgente','importante','primo','secondo','terzo','quarto','ultimo','note'];
const IT_ART_RE=new RegExp('(?:^|\\s)(?:'+IT_ARTIFACTS.map(esc).join('|')+')(?=\\s|$)','giu');
const IT_EDGE_RE=/^(?:a|e|con|per|in|al|di|da)\s+|\s+(?:a|e|con|per|in|al|di|da)$/giu;
/* particelle e parole funzionali che restano nel titolo (per le lingue senza spazi) */
const EXTRA_STOP={ja:['の','に','で','へ','は','が','を','と','も','から','まで','にて'],zh:['下','这','本','上','的','在','和','跟','与','去','到'],ko:['에','에서','에게','의','은','는','이','가','을','를','와','과','랑','부터','까지']};
/* #tag con segni combinati (devanagari, thai…): il parser storico li taglia */
function takeTags(raw){
  const tags=[];const t=String(raw||'').replace(/(^|[\s,;])#([\p{L}\p{M}\p{N}_-]+)/gu,(m,a,x)=>{tags.push(x.toLowerCase());return a+' ';});
  return{text:t,tags};
}
function canonicalize(raw){
  const l=lang();if((l==='it'&&uiLang()==='it')||!pack(l))return raw;   /* v56: italiano con l'app in un'altra lingua passa comunque da qui (giorni e mesi) */
  const {first,rest,protect,moments,L}=rules(l);
  let t=' '+String(raw||'')+' ';
  /* «her iki haftada bir», «raz w dwa tygodnie»: le frasi di ricorrenza con numeri a parole non vanno tradotte in cifre */
  const kept=[];protect.forEach(ph=>{t=t.replace(R(bounded(ph)),m=>{kept.push(m);return ' \u2064P'+(kept.length-1)+'\u2064 ';});});
  t=numberWords(t,L,l);   /* «八時半» → «8時半» prima di leggere i suffissi */
  t=t.replace(/\u2064P(\d+)\u2064/g,(m,i)=>' '+(kept[+i]||'')+' ');
  t=suffixTimes(t,L,l);
  t=fieldsRule(t,L);      /* v56: «title …, day …, start …» → «titolo …, giorno …, inizio …» */
  first.forEach(r=>{t=t.replace(r.re,r.to);});   /* nomi di giorni/mesi → segnaposto */
  /* v56 · «৫ই মার্চ», «20ú marzo»: suffisso ordinale del giorno attaccato alla cifra, davanti al mese */
  const DA2=altPlain(L.daySuffix);if(DA2)t=t.replace(R('(\\d{1,2})(?:'+DA2+')(?=\\s*\u2063M)'),'$1 ');
  /* «lunedì E giovedì» in ogni lingua (и, و, และ, 和, ve, dan…) e anche solo con lo spazio (coreano) */
  const andW=alt(L.and);
  t=t.replace(R('(\u2063W\\d\u2063)\\s*(?:,|'+(andW||'(?!x)x')+')\\s*(?=\u2063W)'),'$1 e ');
  t=t.replace(R('(\u2063W\\d\u2063)\\s+(?=\u2063W)'),'$1 e ');
  /* «20. Dezember» → «20 dezember»; «20 tháng 12» → «20 dicembre» */
  t=t.replace(R('(\\d{1,2})\\.(?=\\s*\u2063M)'),'$1');
  t=t.replace(/tháng\s*(\d{1,2})(?![\p{N}])/giu,(m,n)=>+n>=1&&+n<=12?' \u2063M'+(+n-1)+'\u2063 ':m);
  t=ranges(t,L,l);
  rest.forEach(r=>{t=t.replace(r.re,r.to);});
  const hasTime=new RegExp(tok('alle')+'|'+tok('dalle')+'|\\d{1,2}:\\d{2}|\\d\\s*(?:am|pm)\\b','iu').test(t);
  if(!hasTime)moments.forEach(r=>{t=t.replace(r.re,r.to);});
  t=guarded(t,L,l);
  t=atRule(t,L);
  t=postpositions(t,L,l);
  /* i segnaposto tornano nomi (minuscoli: il parser non distingue, e un
     «Vendredi» maiuscolo verrebbe scambiato per una persona) */
  let wdn=[],mon=[];try{wdn=GIORNI_FULL;mon=MESI;}catch(e){}
  t=t.replace(/\u2063W(\d)\u2063/g,(m,i)=>' '+String(wdn[+i]||'').toLowerCase()+' ').replace(/\u2063M(\d+)\u2063/g,(m,i)=>' '+String(mon[+i]||'').toLowerCase()+' ');
  return unmark(t).replace(/\s+/g,' ').trim();
}
/* separatore invisibile dei luoghi (vedi guarded/caselessPlace): via dal titolo, se mai restasse */
const unjoin=o=>{try{if(o&&o.title)o.title=o.title.replace(/\u2062/g,' ');if(o&&o.location)o.location=o.location.replace(/\u2062/g,' ');}catch(e){}};
/* il titolo perde le parole funzionali della lingua in testa e in coda */
function trimTitle(title,L){
  const sw=arr(L.stopwords);if(!sw.length||!title)return title;
  const a=sw.map(esc).join('|');let t=title;
  for(let i=0;i<3;i++){t=t.replace(R('^(?:'+a+')(?=\\s|$)\\s*','iu'),'').replace(R('\\s+(?:'+a+')$','iu'),'').trim();}
  return t.replace(/^[\s,;:.·-]+|[\s,;:.·-]+$/g,'');
}

/* ══════════════════════════════════════════════════════════════════
   0. (v55) NORMALIZZAZIONE PRIMA DI TUTTO, in ogni lingua (italiano compreso):
      · cifre di altri alfabeti → cifre arabe occidentali («٣٠ دقيقة», «१५»,
        «১০», «๑๕», «１２時»): il parser ragiona solo su 0-9;
      · date ISO «2026-03-05», con il punto «5.3.2026», orientali «2026/3/5»,
        «2026年3月5日» → la forma «5/3/2026» che il parser conosce, nell'ordine
        giorno/mese che la lingua usa davvero (lexicon.dateOrder);
      · spazi "esotici" (non divisibili, ideografici) → spazi normali;
      · «h» tra ora e minuti con la «H» maiuscola, «８：３０» a larghezza piena.
══════════════════════════════════════════════════════════════════ */
/* primo codice di ogni blocco di dieci cifre (0…9) negli alfabeti più diffusi */
const DIGIT_ZEROS=[0x0660,0x06F0,0x07C0,0x0966,0x09E6,0x0A66,0x0AE6,0x0B66,0x0BE6,0x0C66,0x0CE6,0x0D66,0x0DE6,0x0E50,0x0ED0,0x0F20,0x1040,0x1090,0x17E0,0x1810,0x1946,0x19D0,0xA8D0,0xA9D0,0xAA50,0xABF0,0xFF10];
function asciiDigits(t){
  return String(t).replace(/\p{Nd}/gu,ch=>{const c=ch.codePointAt(0);if(c<128)return ch;for(const z of DIGIT_ZEROS){if(c>=z&&c<=z+9)return String(c-z);}return ch;});
}
function preNormalize(raw,l){
  let t=asciiDigits(String(raw||''));
  t=t.replace(/[\u00A0\u2007\u202F\u3000]/g,' ').replace(/[：]/g,':').replace(/[／]/g,'/');
  const L=lexOf(l);
  let us=false;try{us=/^en-US/.test(L10N.locale);}catch(e){}
  const order=L.dateOrder||(us?'mdy':'dmy');          /* come la lingua scrive «5/3» */
  const toSlash=(y,m,d)=>{if(+m<1||+m>12||+d<1||+d>31)return null;const D=String(+d),M=String(+m);
    /* il parser legge «a/b» come giorno/mese, o mese/giorno solo con il locale en-US */
    return ' '+(us?M+'/'+D:D+'/'+M)+(y?'/'+y:'')+' ';};
  /* la lingua scrive mese/giorno ma il parser (senza locale en-US) legge giorno/mese: si scambiano.
     Va fatto PRIMA delle conversioni qui sotto, che producono già l'ordine giusto. */
  if(order==='mdy'&&!us)t=t.replace(/(?<![\d/.-])(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?![\d/])/g,(m,a,b,y)=>(+a>=1&&+a<=12&&+b>=1&&+b<=31)?' '+b+'/'+a+(y?'/'+y:'')+' ':m);
  /* ISO 2026-03-05 · orientale 2026/3/5 · 2026.3.5 · 2026年3月5日 · 2026년 3월 5일 */
  t=t.replace(/(?<![\d/.-])(\d{4})\s*[-/.年년]\s*(\d{1,2})\s*[-/.月월]\s*(\d{1,2})\s*[日일]?(?![\d/.-])/g,(m,y,mo,d)=>toSlash(y,mo,d)||m);
  /* 5.3.2026 · 5.3. · 05.03 (tedesco, russo, polacco, turco…): solo se la lingua scrive così */
  if(order==='dmy')t=t.replace(/(?<![\d.:/])(\d{1,2})\.(\d{1,2})\.(?:(\d{4}|\d{2})(?![\d.:]))?(?![\d:])/g,(m,d,mo,y)=>{
    if(+mo<1||+mo>12||+d<1||+d>31)return m;return toSlash(y?(y.length===2?'20'+y:y):'',mo,d)||m;});
  /* turco: «9'dan 10'a kadar», «15'ten» → «dalle 9 alle 10» (i suffissi attaccati alle cifre) */
  if(l==='tr'){t=t.replace(/(\d{1,2}(?::\d{2})?)['’](?:dan|den|tan|ten)(?![\p{L}])/gu,' dalle $1 ');t=t.replace(/(\d{1,2}(?::\d{2})?)['’](?:a|e|ya|ye)\s+kadar(?![\p{L}])/gu,' alle $1 ');}
  /* indonesiano e altri: «05-03-2026» con i trattini (solo ordine giorno/mese) */
  if(order==='dmy')t=t.replace(/(?<![\d/.-])(\d{1,2})-(\d{1,2})-(\d{4})(?![\d/.-])/g,(m,d,mo,y)=>toSlash(y,mo,d)||m);
  /* «15時〜16時», «9～10» → trattino fra i due orari (v56: anche con il suffisso dell'ora in mezzo) */
  const HS=altPlain(arr(L.hourSuffix).filter(w=>!/\s/.test(w)));
  t=t.replace(R('(\\d)('+(HS||'(?!x)x')+')?\\s*[〜～~]\\s*(?=\\d)'),'$1$2-');
  /* «8H30» → «8h30»; «8 h 30» → «8h30» */
  t=t.replace(/(\d{1,2})\s*[hH]\s*(\d{2})(?![\d\p{L}])/gu,'$1h$2');
  return t;
}

/* ── aggancio al parser ── */
function hookParser(){
  if(!KX.NL2||KX.NL2._v54)return;
  const base=KX.NL2.parse.bind(KX.NL2);
  KX.NL2.parse=function(raw0){
    const l=lang();
    let raw=raw0;try{raw=preNormalize(raw0,l);}catch(e){}
    if((l==='it'&&uiLang()==='it')||!pack(l))return base(raw);
    const tk=takeTags(raw);
    let canon=tk.text;try{canon=canonicalize(tk.text);}catch(e){console.warn('[v54 lingua]',e);}
    const out=base(canon);
    try{if(out){if(tk.tags.length&&out._def&&out._def.tags){out.tags=[];out._def.tags=0;}out.tags=[...new Set([...(out.tags||[]),...tk.tags])];}}catch(e){}
    /* compleanni e anniversari nella lingua dell'utente: giornata intera, ogni anno */
    try{const bw=alt(lexOf(l).birthday);if(out&&bw&&R(bw).test(String(raw||''))){
      if(out.start==null&&!out.allDay){out.allDay=true;out._def=out._def||{};out._def.allDay=1;}
      if(!out.rrule&&out.dates&&out.dates.length===1){const[y,mo,d]=out.dates[0].split('-').map(Number);const keys=[];
        for(let k=0;k<3;k++){const dt=new Date(y+k,mo-1,d);keys.push(dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0'));}
        out.dates=keys;out.rrule={freq:'YEARLY',interval:1};out._def=out._def||{};out._def.rrule=1;}}}catch(e){}
    try{cjkPeople(String(raw||''),out,lexOf(l),l);cjkPlace(String(raw||''),out,l);}catch(e){}
    try{caselessPeople(canon,out);caselessPlace(canon,out,l);attachedPlace(canon,out,l);compoundStreet(String(raw||''),out,l);}catch(e){}
    unjoin(out);
    /* v56: numero civico PRIMA della via («au 5 rue de Rivoli, Paris», «at 12 Baker Street»): nel luogo e via dal titolo */
    try{if(out&&out.location&&out.title){const head=out.location.split(',')[0].trim();
      const m=head&&String(raw||'').match(new RegExp('(?<![\\d\\p{L}:./\\-])(\\d{1,5}[a-zA-Z]?)\\s+'+esc(head),'u'));
      if(m&&!/^\d/.test(out.location)){out.location=m[1]+' '+out.location;
        out.title=out.title.replace(new RegExp('(?:^|\\s)(?:au|aux|à|a|al|at|en|in|bei|em|no|na|w|на|в)?\\s*'+esc(m[1])+'(?=\\s|$)','iu'),' ').replace(/\s+/g,' ').trim();}}}catch(e){}
    /* il tipo di via scritto dall'utente torna al suo posto: «calle Mayor 5», non «via Mayor 5» */
    try{if(out&&out.location&&/^via\s/i.test(out.location)&&!/(^|\s)via\s/i.test(String(raw||''))){const rest=out.location.replace(/^via\s+/i,'');const st=arr(lexOf(l).streets);
      const first=rest.split(/[\s,]/)[0];
      if(!st.length)out.location=rest;
      else if(first){const m=String(raw||'').match(new RegExp('(?<![\\p{L}])('+st.map(esc).join('|')+')\\s+'+esc(first),'iu'));if(m)out.location=m[1]+' '+rest;}
      out.location=out.location.replace(/\s+,/g,',').replace(/\s+/g,' ').trim();}}catch(e){}
    try{if(out&&out.title){out.title=out.title.replace(IT_ART_RE,' ').replace(/\s+/g,' ').trim();
      const rawWords=new Set(String(raw||'').toLowerCase().split(/[^\p{L}\p{M}'’-]+/u));
      for(let i=0;i<2;i++)out.title=out.title.replace(IT_EDGE_RE,m=>rawWords.has(m.trim().toLowerCase())?m:'').trim();}}catch(e){}
    try{if(out&&out.title&&EXTRA_STOP[l]){const a=EXTRA_STOP[l].map(esc).join('|');out.title=out.title.replace(R('(?:^|\\s)(?:'+a+')(?=\\s|$)'),' ');
      if(l!=='ko')out.title=out.title.replace(R('^(?:'+a+')|(?:'+a+')$'),'');out.title=out.title.replace(/\s+/g,' ').trim();}}catch(e){}
    try{if(out&&out.title){out.title=trimTitle(out.title,lexOf(l));if(out.title)out.title=out.title.charAt(0).toUpperCase()+out.title.slice(1);}}catch(e){}
    return out;
  };
  KX.NL2._v54=true;
}

/* ══════════════════════════════════════════════════════════════════
   2. AUTO-TAG per ogni alfabeto
══════════════════════════════════════════════════════════════════ */
const LATIN_RE=/^[\p{Script=Latin}\p{N}\s'’-]+$/u;
/* normalizzazione: minuscolo, accenti via SOLO per l'alfabeto latino,
   punteggiatura → spazio. Gli altri alfabeti restano intatti. */
function normText(s){
  s=String(s||'').toLowerCase().normalize('NFKC');
  s=s.replace(/[\p{Script=Latin}]+/gu,m=>m.normalize('NFD').replace(/[\u0300-\u036f]/g,''));
  return s.replace(/[^\p{L}\p{M}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
}
const stem=w=>LATIN_RE.test(w)&&w.length>=5?w.replace(/[aeiou]$/,''):w;
function packKeywords(famId){
  const out=new Set();
  const add=p=>{if(!p)return;arr((p.autotag||{})[famId]).forEach(k=>out.add(k));
    arr((p.culture||{}).extraTags).forEach(x=>{if(x&&x.family===famId){arr(x.keywords).forEach(k=>out.add(k));if(x.tag)out.add(String(x.tag));}});};
  add(pack(lang()));if(lang()!=='en')add(pack('en'));
  return [...out];
}
function installAutoTag(){
  if(!KX.autoTag||KX.autoTag._v54)return;
  const prev=KX.autoTag;
  const GENERIC=new Set(['appuntamento','appuntamenti','incontro','colloquio','lezione','corso','visita','controllo','pratica','test','prima','live','ritiro','consegna','pausa','ponte','lettura','sessione','serata','uscita','giornata','evento','attivita','impegno','ritrovo','meeting','appointment','class','course','visit','check','event','day','session']);
  KX.autoTag=function(title,desc){
    const FAM=KX.famData&&KX.famData();if(!FAM||FAM.auto===false)return null;
    const t1=' '+normText(title)+' ',t2=' '+normText(desc)+' ';
    if(t1.trim().length<1&&t2.trim().length<1)return null;
    const W1=new Set(t1.trim().split(' ').map(stem)),W2=new Set(t2.trim().split(' ').map(stem));
    const c=(()=>{const m={};try{Object.values(S.events||{}).forEach(l=>(l||[]).forEach(ev=>(ev.tags||[]).forEach(t=>{t=String(t).toLowerCase();m[t]=(m[t]||0)+1;})));}catch(e){}return m;})();
    const allTags=(()=>{try{return [...new Set([...(S.tagDB||[]),...Object.keys(TAG_CONFIG||{})])].filter(t=>t&&!t.startsWith('__'));}catch(e){return [];}})();
    const tagsOf=id=>allTags.filter(t=>(FAM.map[t]||'altro')===id);
    let best=null;
    FAM.order.forEach(id=>{const f=FAM.families[id];if(!f||id==='altro')return;
      const kws=[...new Set([...(f.kw||[]),...packKeywords(id),...tagsOf(id),f.name].map(normText).filter(k=>k.length>=2))];
      let sc=0,hit=null;const seen=new Set();
      kws.sort((a,b)=>b.length-a.length).forEach(k=>{
        let m=0;
        const latin=LATIN_RE.test(k);
        if(!latin||k.includes(' ')){const kk=latin?' '+k+' ':k;if(t1.includes(kk))m=2;else if(t2.includes(kk))m=1;}
        else{const st=stem(k);if(W1.has(st))m=2;else if(W2.has(st))m=1;}
        if(!m)return;
        const parts=k.split(' ').map(stem);if(parts.every(w=>seen.has(w)))return;parts.forEach(w=>seen.add(w));
        const w=GENERIC.has(k)||GENERIC.has(k.split(' ')[0])?.5:1;
        sc+=m*w*(1+Math.min(k.length,12)/12);hit=hit||k;});
      if(id==='appuntamenti')sc*=.7;
      if(sc>0&&(!best||sc>best.sc))best={id,sc,hit};});
    if(!best){try{return prev(title,desc);}catch(e){return null;}}
    const f=FAM.families[best.id];const own=tagsOf(best.id);const text=t1+t2;
    let tag=own.find(t=>text.includes(' '+normText(t)+' '));
    if(!tag&&own.length)tag=own.slice().sort((a,b)=>(c[b]||0)-(c[a]||0))[0];
    if(!tag){const p=pack();tag=(p&&p.culture&&p.culture.familyTag&&p.culture.familyTag[best.id])||(/^f[0-9a-z]{6,}$/.test(best.id)?normText(f.name).replace(/\s+/g,'-').slice(0,30):best.id);}
    return{fam:best.id,tag,name:f.name,icon:f.icon,color:f.color,word:best.hit};
  };
  KX.autoTag._v54=true;
}

/* ── esempi nella lingua dell'utente nel campo «Descrivi l'evento» ── */
function localizedPlaceholders(){
  const p=pack();const c=p&&p.culture;if(!c)return;
  const q=document.getElementById('kx-q-in');
  if(q&&c.sampleFull)q.placeholder=tr('Descrivi l\'evento')+': «'+c.sampleFull+'»';
}

/* ── API pubblica ── */
/* v56: priorità da una parola/frase nella lingua in uso («high», «hoch», «بسيط»…):
   'urgent' | 'important' | 'normal' | null */
function priorityOf(text,l){
  const L=lexOf(l||lang());const s=' '+String(text||'').toLowerCase()+' ';
  const has=list=>{const a=alt(list);return a?R(a).test(s):false;};
  if(/(^|\s)(alta|altissima|massima|urgente|high|highest|top|urgent|hoch|hohe|höchste|haute|élevée|elevada|máxima|maxima|máximo|alto|wysoki|wysoka|высокий|высокая|высший|високий|висока|yüksek|tinggi|cao|גבוהה|גבוה|عالية|عالي|उच्च|উচ্চ|高|높음|높은|สูง)(\s|$)/u.test(s)||has(L.urgent))return 'urgent';
  if(/(^|\s)(media|medio|importante|important|medium|mittel|moyenne|moyen|média|średni|średnia|средний|средняя|середній|orta|sedang|trung bình|בינונית|متوسطة|मध्यम|মাঝারি|中|보통|中等|ปานกลาง)(\s|$)/u.test(s)||has(L.important))return 'important';
  if(/(^|\s)(bassa|basso|normale|normal|low|none|nessuna|niedrig|gering|basse|bas|faible|baja|bajo|baixa|baixo|niski|niska|низкий|низкая|низький|низька|düşük|rendah|thấp|נמוכה|נמוך|منخفضة|منخفض|कम|निम्न|কম|低|낮음|낮은|ต่ำ)(\s|$)/u.test(s)||has(L.lowPriority))return 'normal';
  return null;
}
KX.Lang={lang,uiLang,pack,lexicon:lexOf,canonicalize,preNormalize,asciiDigits,noShortDayLabels,packKeywords,normText,tr,namesFor,priorityOf,
  /* v56: lingua forzata (null = quella dell'interfaccia) */
  force(l){FORCE=l&&PACKS[l]?l:null;},forced(){return FORCE;},SPEECH_LOCALE,
  /* le parole italiane inserite da fuori vanno "marcate" così le regole non le riscrivono */
  mark:tok,alt,bounded,esc};

/* avvio: dopo che tutti i moduli storici hanno agganciato il parser */
function start(){
  try{hookParser();}catch(e){console.error('[v54 parser]',e);}
  try{installAutoTag();}catch(e){console.error('[v54 autotag]',e);}
  try{localizedPlaceholders();}catch(e){}
}
if(document.readyState==='complete')setTimeout(start,0);else addEventListener('load',()=>setTimeout(start,0));
/* il modulo di inserimento costruisce il campo più tardi: si riprova */
setTimeout(()=>{try{hookParser();localizedPlaceholders();}catch(e){}},1500);
setTimeout(()=>{try{localizedPlaceholders();}catch(e){}},4000);
})();
