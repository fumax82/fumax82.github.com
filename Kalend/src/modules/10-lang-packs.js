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
const lang=()=>{try{return (typeof L10N!=='undefined'&&L10N.resolvedLang)||'it';}catch(e){return 'it';}};
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
  halfHour:"mezz'ora",oneHour:"un'ora",half:'mezza',quarter:'un quarto',threeQuarters:'tre quarti',
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
const CL_WORD='[\\p{Script=Devanagari}\\p{Script=Bengali}\\p{Script=Arabic}\\p{Script=Hebrew}\\p{Script=Thai}\\p{M}]{2,}';

const CACHE={};
function rules(l){
  if(CACHE[l])return CACHE[l];
  const L=lexOf(l);const first=[],rest=[];
  const push=(words,to,list)=>{const a=alt(words);if(a)(list||rest).push({re:R('(?:'+a+')'),to});};
  const PARTICLES=['ja','ko','zh','th'].includes(l);
  Object.keys(SIMPLE).forEach(k=>{if(k==='withStrong')return;push(L[k],' '+tok(SIMPLE[k])+' ');});
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
  let wdn=[],mon=[],lab=[];try{wdn=GIORNI_FULL.slice();lab=DAY_LABELS.slice();mon=MESI.slice();}catch(e){}
  /* i nomi diventano SEGNAPOSTO (\u2063W3\u2063) finché tutte le regole non
     sono passate, così «金曜» non viene riletto dentro «金曜日» */
  const tokW=i=>' \u2063W'+i+'\u2063 ',tokM=i=>' \u2063M'+i+'\u2063 ';
  wdn.forEach((n,i)=>{if(!n)return;first.push({re:R(bounded(n)),to:tokW(i)});if(lab[i]&&lab[i].length>=2&&lab[i].toLowerCase()!==n.toLowerCase())first.push({re:R(bounded(lab[i])),to:tokW(i)});
    /* ebraico/arabo: «יום רביעי» si scrive anche «רביעי», «ורביעי» (e-mercoledì), «ברביעי» */
    if(['he','ar'].includes(l)){const last=n.split(/\s+/).pop();if(last&&last.length>=3&&last!==n){const pre=l==='he'?'(?:(?<![\\p{L}])[ובל])?':'(?:(?<![\\p{L}])و)?';first.push({re:R(pre+bounded(last)),to:m=>(/^[ו]|^و/.test(m)?' '+tok('e')+' ':' ')+tokW(i)});}}});
  (L.weekdays||[]).forEach(p=>{if(Array.isArray(p)&&typeof p[0]==='string'&&wdn[+p[1]]&&p[0].length>=2)first.push({re:R(bounded(p[0])),to:tokW(+p[1])});});
  mon.forEach((n,i)=>{if(n)first.push({re:R(bounded(n)),to:tokM(i)});});
  (L.months||[]).forEach(p=>{if(Array.isArray(p)&&typeof p[0]==='string'&&mon[+p[1]]&&p[0].length>=2)first.push({re:R(bounded(p[0])),to:tokM(+p[1])});});
  /* ordinali solo davanti a un giorno della settimana («first monday») */
  const dre='\u2063W\\d\u2063';
  Object.entries(L.ordinals||{}).forEach(([w,n])=>{if(ORD[n])rest.push({re:R(bounded(w)+'(?=\\s+'+dre+')'),to:' '+tok(ORD[n])+' '});});
  first.sort((a,b)=>b.re.source.length-a.re.source.length);rest.sort((a,b)=>b.re.source.length-a.re.source.length);
  CACHE[l]={first,rest,moments,L};
  return CACHE[l];
}
/* numeri a parole → cifre, solo vicino a un orario/unità/mese */
function numberWords(t,L){
  const N=L.numbers||{};const nw=Object.keys(N).filter(k=>/\S/.test(k));if(!nw.length)return t;
  const nre='('+sortLong(nw).map(esc).join('|')+')';
  const units=altPlain([].concat(...UNITS.map(u=>L[u[0]]||[]),L.hourSuffix||[]));
  const cues=alt([].concat(L.at||[],L.from||[],L.to||[],L.in||[],L.for||[],L.pmPrefix||[],L.amPrefix||[]));
  const after=alt([].concat(L.pm||[],L.am||[],L.half||[],L.quarter||[],L.plus||[],L.minus||[]));
  let months=[];try{months=MESI.map(m=>m.toLowerCase());}catch(e){}
  const mre=months.map(esc).join('|');
  const dig=w=>String(N[String(w).toLowerCase()]);
  if(cues)t=t.replace(R(LB+'(?:'+cues+')\\s*'+nre+LA),(m,w)=>m.replace(w,dig(w)));
  if(units)t=t.replace(R(LB+nre+'\\s*(?='+units+')'),(m,w)=>dig(w)+' ');
  if(after)t=t.replace(R(LB+nre+'\\s+(?='+after+')'),(m,w)=>dig(w)+' ');
  if(mre){t=t.replace(R(LB+nre+'\\s+(?=(?:'+mre+'))'),(m,w)=>dig(w)+' ');
    t=t.replace(R(LB+'((?:'+mre+')\\s+)'+nre+LA),(m,a,w)=>a+dig(w));}
  return t;
}
const two=n=>String(n).padStart(2,'0');
/* orari e date scritte con suffissi/prefissi (cinese, giapponese, coreano,
   hindi, vietnamita…): «15時», «3点半», «오후 3시», «शाम 7 बजे», «15h» */
function suffixTimes(t,L){
  const LATIN_NEXT='(?![a-zA-Z\u00C0-\u024F])';
  /* thai: «2 ทุ่ม» = 20:00 (sera, +18), «บ่าย 2 โมง» = 14:00, «ตี 3» = 03:00 */
  t=t.replace(/(\d{1,2})\s*ทุ่ม(?:\s*ครึ่ง)?/gu,(m,h)=>{const H=+h+18;if(H>24)return m;return ' '+tok('alle')+' '+two(H)+':'+(/ครึ่ง/.test(m)?'30':'00')+' ';});
  t=t.replace(/บ่าย\s*(\d{1,2})\s*โมง(?:\s*ครึ่ง)?/gu,(m,h)=>{let H=+h;if(H<12)H+=12;return ' '+tok('alle')+' '+two(H)+':'+(/ครึ่ง/.test(m)?'30':'00')+' ';});
  t=t.replace(/บ่ายโมง(?:\s*ครึ่ง)?/gu,m=>' '+tok('alle')+' 13:'+(/ครึ่ง/.test(m)?'30':'00')+' ');
  t=t.replace(/เที่ยง(?:วัน)?(?![\p{L}])/gu,' '+tok('alle')+' 12:00 ');
  const hs=altPlain(arr(L.hourSuffix).filter(w=>!/\s/.test(w))),ms=altPlain(L.minuteSuffix),hf=altPlain(L.halfSuffix),pmP=altPlain(L.pmPrefix),amP=altPlain(L.amPrefix);
  if(hs){
    const pre='(?:('+(pmP||'(?!x)x')+')|('+(amP||'(?!x)x')+'))?\\s*';
    /* minuti: «18h30» (attaccati), «3点20分» (con suffisso), «15時半» (mezza) */
    const MIN='(?:(\\d{2})(?![\\p{N}])|\\s*(\\d{1,2})\\s*(?:'+(ms||'(?!x)x')+')|\\s*('+(hf||'(?!x)x')+'))?';
    t=t.replace(R(pre+'(\\d{1,2})(?:[:.](\\d{2}))?\\s*(?:'+hs+')'+LATIN_NEXT+MIN),
      (m,pm,am,h,m2,ma,mb,half)=>{let H=+h;if(H>24)return m;if(pm&&H<12)H+=12;if(am&&H===12)H=0;const MI=m2?+m2:ma?+ma:mb?+mb:(half?30:0);if(MI>59)return m;return ' '+tok('alle')+' '+two(H)+':'+two(MI)+' ';});
  }
  /* «下午 3:30», «शाम 7:15» (prefisso + orario con i due punti) */
  if(pmP)t=t.replace(R('(?:'+pmP+')\\s*(\\d{1,2})[:.](\\d{2})'+LA),(m,h,mi)=>{let H=+h;if(H<12)H+=12;return ' '+tok('alle')+' '+two(H)+':'+mi+' ';});
  const mo=altPlain(L.monthSuffix),da=altPlain(L.daySuffix);
  if(mo&&da)t=t.replace(R('(\\d{1,2})\\s*(?:'+mo+')\\s*(\\d{1,2})\\s*(?:'+da+')'),(m,M,D)=>' '+D+'/'+M+' ');
  return t;
}
/* «dalle … alle …» con preposizioni prima o dopo l'orario (から/まで, 부터/까지, से/तक) */
function ranges(t,L){
  const hsSet=new Set(arr(L.hourSuffix).map(x=>x.toLowerCase()));
  const from=alt(L.from),to=alt(L.to);
  const TM='(\\d{1,2}(?::\\d{2})?)';
  /* ebraico: «מ-9 עד 10» (prefisso attaccato col trattino) */
  t=t.replace(/(?<![\p{L}])מ-?(?=\d{1,2}(?::\d{2})?(?![\p{N}]))/gu,' '+tok('dalle')+' ');
  const ALLE=tok('alle'),DALLE=tok('dalle');
  const NOT_DATE='(?!\\s*(?:\u2063M|via|rue|\\p{Lu}))';   /* «au 20 décembre», «bis 5 Hauptstraße» non sono orari */
  if(from&&to){
    t=t.replace(R(ALLE+'\\s+'+TM+'\\s*(?:'+from+')\\s*'+ALLE+'\\s+'+TM+'\\s*(?:'+to+')'),' '+DALLE+' $1 '+ALLE+' $2 ');
    t=t.replace(R('(?:'+from+')\\s*'+ALLE+'\\s+'+TM+'\\s*(?:'+to+')\\s*'+ALLE+'\\s+'+TM),' '+DALLE+' $1 '+ALLE+' $2 ');
    t=t.replace(R(LB+'(?:'+from+')\\s*'+TM+'\\s*(?:'+to+')\\s*'+TM+'(?![\\p{N}:])'),' '+DALLE+' $1 '+ALLE+' $2 ');
  }
  if(from){
    t=t.replace(R('(?:'+ALLE+'\\s+)?'+TM+'\\s*(?:'+from+')'+LA+'(?=\\s*'+ALLE+'\\s+\\d)'),' '+DALLE+' $1 ');
    t=t.replace(R(ALLE+'\\s+'+TM+'\\s*(?:'+from+')'+LA),' '+DALLE+' $1 ');
    t=t.replace(R(LB+'(?:'+from+')\\s*(?=\\d{1,2}(?:[:.]\\d{2})?(?![\\p{N}])'+NOT_DATE+')'),' '+DALLE+' ');
  }
  if(to){
    t=t.replace(R(ALLE+'\\s+'+TM+'\\s*(?:'+to+')'+LA),' '+ALLE+' $1 ');
    t=t.replace(R(LB+'(?:'+to+')\\s*(?=\\d{1,2}(?:[:.]\\d{2})?(?![\\p{N}])'+NOT_DATE+')'),' '+ALLE+' ');
  }
  /* «9h», «20h30» → «9:00», «20:30» (francese, portoghese, vietnamita…) */
  t=t.replace(/(?<![\p{N}:])(\d{1,2})h(\d{2})?(?![\p{N}\p{L}])/giu,(m,h,mi)=>+h<=24?h+':'+(mi||'00'):m);
  /* ore «e mezza», «meno un quarto» */
  const plus=alt(L.plus),minus=alt(L.minus);
  if(plus)t=t.replace(R('(\\d{1,2})\\s+(?:'+plus+')\\s+(?='+tok('mezza')+'|'+tok('un quarto')+'|'+tok('tre quarti')+'|\\d{1,2}(?![\\p{N}:]))'),'$1 '+tok('e')+' ');
  if(minus)t=t.replace(R('(\\d{1,2})\\s+(?:'+minus+')\\s+(?='+tok('un quarto')+'|\\d{1,2}(?![\\p{N}:]))'),'$1 '+tok('meno')+' ');
  /* «8 pm», «20:00 de la tarde»: solo accanto a un orario */
  const pm=alt(L.pm),am=alt(L.am);
  if(pm)t=t.replace(R('(\\d{1,2}(?::\\d{2})?)\\s*(?:'+pm+')'+LA),'$1 '+tok('di sera')+' ');
  if(am)t=t.replace(R('(\\d{1,2}(?::\\d{2})?)\\s*(?:'+am+')'+LA),'$1 '+tok('di mattina')+' ');
  return t;
}
/* durate, relativi, preavvisi, luoghi, persone: con una "spia" che eviti falsi positivi */
function guarded(t,L,l){
  const num='(?:\\d+(?:[.,]\\d+)?)';
  /* unità dopo un numero → italiano («2 hours» → «2 ore», «30分» → «30 minuti») */
  const HALF=tok("mezz'ora")+'|'+tok("un'ora");
  UNITS.forEach(([k,it])=>{const a=altPlain(L[k]);if(a)t=t.replace(R('('+num+')\\s*(?:'+a+')'+LA),'$1 '+tok(it)+' ');});
  const fr=alt(L.for);if(fr)t=t.replace(R(LB+'(?:'+fr+')\\s+(?='+num+'\\s*'+U_IT+')'),' '+tok('per')+' ');
  const inn=alt(L.in);
  if(inn)t=t.replace(R(LB+'(?:'+inn+')\\s+(?='+num+'\\s*'+U_IT+'|'+HALF+')'),' '+tok('tra')+' ');
  /* «10 minutes before» / «提前30分钟» → «30 minuti prima» */
  const bf=alt(L.before);
  if(bf){t=t.replace(R('('+num+'\\s*'+U_IT+'|'+HALF+')\\s*(?:'+bf+')'+LA),'$1 '+tok('prima')+' ');t=t.replace(R(LB+'(?:'+bf+')\\s*('+num+'\\s*'+U_IT+')'),'$1 '+tok('prima')+' ');}
  /* persone */
  const withAll=[].concat(L.withStrong||[],L.with||[]);
  if(WITH_AFTER.has(l)){const w=alt(withAll);if(w)t=t.replace(R('(\\p{L}[\\p{L}\\p{M}\'’-]*)\\s+(?:'+w+')'+LA),' '+tok('con')+' $1 ');}
  const w=alt(L.with);
  if(w){
    const poss=(POSS[l]||'').split(' ').filter(Boolean).map(esc).join('|');
    const relw=alt(L.relatives);
    if(relw)t=t.replace(R('((?:'+w+')\\s+)(?:(?:'+(poss||'(?!x)x')+')\\s+)?('+relw+')'),(m,a,r)=>a+r.charAt(0).toUpperCase()+r.slice(1));
    const and=alt(L.and);
    if(and)t=t.replace(R('(\\p{Lu}[\\p{L}\\p{M}\'’-]*)\\s+(?:'+and+')\\s+(?=\\p{Lu})','gu'),'$1 '+tok('e')+' ');
    const artRe=(ARTICLES[l]||'').trim()?'(?:(?:'+ARTICLES[l].trim().split(' ').map(esc).join('|')+')\\s+)?':'';
    if(!WITH_AFTER.has(l)&&!['ja','ko','zh','th'].includes(l)){t=t.replace(R(LB+'(?:'+w+')(?=\\s+'+artRe+'\\p{Lu})','gu'),' '+tok('con')+' ');
      if(CASELESS_LANG.has(l))t=t.replace(R(LB+'(?:'+w+')(?=\\s+'+CL_WORD+')','gu'),' '+tok('con')+' ');}
  }
  t=t.replace(R(tok('assieme a')+'\\s+'+tok('con')),tok('assieme a'));
  t=t.replace(R(tok('con')+'\\s+'+tok('con')),tok('con'));
  const art=ARTICLES[l];
  if(art)t=t.replace(R('('+tok('con')+'|'+tok('assieme a')+')\\s+(?:'+art.split(' ').map(esc).join('|')+')\\s+(?=\\p{Lu})','gu'),'$1 ');
  /* luogo: preposizione + Maiuscola (lingue con maiuscole), o + parola in alfabeto senza maiuscole */
  const pl=altCI(L.place);
  if(pl&&!L.noSpaces){t=t.replace(R(LB+'(?:'+pl+')\\s+(?=\\p{Lu})','gu'),' '+tok('a')+' ');
    if(CASELESS_LANG.has(l))t=t.replace(R(LB+'(?:'+pl+')\\s+(?='+CL_WORD+')','gu'),' '+tok('a')+' ');}
  if(PLACE_AFTER.has(l)){const pa=alt(L.place);if(pa)t=t.replace(R('('+CL_WORD+'(?:\\s+'+CL_WORD+')?)\\s+(?:'+pa+')'+LA,'gu'),' '+tok('a')+' $1 ');}
  const st=COMPOUND_STREET[l]?'':altCI(L.streets);if(st)t=t.replace(R(LB+'(?:'+st+')\\s+(?=[\\p{Lu}\\d])','gu'),' '+tok('via')+' ');
  if(l==='tr')t=t.replace(/(\p{Lu}[\p{L}]+)'(?:de|da|te|ta|nde|nda)(?![\p{L}])/gu,(m,a)=>' '+tok('a')+' '+a+' ');
  if(l==='tr'){t=t.replace(/(\p{Lu}[\p{L}]+)\s+(?:Caddesi|Sokak|Sokağı|Bulvarı|Mahallesi|Cd\.|Sk\.)\s*(\d+[a-z]?)?/gu,(m,a,n)=>' '+tok('via')+' '+a+(n?' '+n:'')+' ');}
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
function postpositions(t,L){
  const PRIMA=tok('prima'),RIC=tok('ricordamelo'),FINO=tok('fino al');
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
  if(inn)t=t.replace(R('(\\d+\\s*'+U_IT+')\\s*(?:'+inn+')'+LA),' '+tok('tra')+' $1 ');
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
  if(l==='zh'){const re=R('(?:'+W+')([\\p{Script=Han}A-Za-z]{2,4}?)(?=一起|吃|去|开|见|聊|打|约|玩|喝|谈|讨论|[\\s,，。]|$)');while((m=re.exec(raw)))found.push(m[1]);}
  else if(l==='ja'){const re=R('(?:(?<![\\p{Script=Han}\\p{Script=Katakana}])([\\p{Script=Han}\\p{Script=Katakana}]{1,4})|(?<=^|[にでをはが、\\s\\d])([\\p{Script=Hiragana}]{2,4}?))(?:さん|様|さま|くん|ちゃん|先生|部長|課長)?(?:'+W+')');while((m=re.exec(raw))){const n=m[1]||m[2];if(n&&!isDay(n)&&!/[とにでをは]$/.test(n))found.push(n);}}
  else if(l==='th'){const re=R('(?:'+W+')([\\p{Script=Thai}]{2,10}?)(?=\\s|$|ที่|วัน|เวลา|ตอน|และ)');while((m=re.exec(raw))){if(!isDay(m[1]))found.push(m[1]);}}
  else{const re=R('(?<![\\p{Script=Hangul}])([\\p{Script=Hangul}]{2,4}?)(?:씨|님|선생님)?(?:'+W+')(?=[\\s,.]|$)');while((m=re.exec(raw))){if(!isDay(m[1]))found.push(m[1]);}}
  if(!found.length)return;
  out.people=out.people||[];
  found.forEach(n=>{if(!out.people.includes(n))out.people.push(n);});
  if(out.title){let t=out.title;found.forEach(n=>{t=t.replace(new RegExp(esc(n)+'(?:さん|様|さま|くん|ちゃん|先生|部長|課長|씨|님|선생님)?(?:'+W+')(?:一起)?','gu'),' ');t=t.replace(new RegExp('(?:'+W+')'+esc(n),'gu'),' ');});
    out.title=t.replace(/\s+/g,' ').trim();}
}
/* luoghi nelle lingue con particelle: «渋谷で», «강남에서», «在北京» */
function cjkPlace(raw,out,l){
  if(out.location||!['ja','ko','zh','th','tr'].includes(l))return;
  let m=null;
  if(l==='th')m=raw.match(/ที่([\p{Script=Thai}\d]{2,14}?)(?=\s|$|กับ|วัน|เวลา|ตอน)/u);
  else if(l==='tr')m=raw.match(/(\p{Lu}[\p{L}]+(?:\s+\p{Lu}[\p{L}]+)?)'(?:de|da|te|ta)(?![\p{L}])/u);
  else if(l==='ja')m=raw.match(/(?<![\p{Script=Han}\p{Script=Katakana}])([\p{Script=Han}\p{Script=Katakana}]{2,8})(?:で|にて)(?=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\s]|$)/u);
  else if(l==='ko')m=raw.match(/(?<![\p{L}\d])((?:[\p{Script=Hangul}]{2,}\s*){1,3}\d*)에서(?=[\s,.]|$)/u);
  else m=raw.match(/在([\p{Script=Han}A-Za-z]{2,8}?)(?=和|跟|与|吃|开|见|的|一起|参加|[\s,，。]|$)/u);
  if(!m)return;
  const loc=m[1].trim();if(/^(今日|明日|来週|今週|오늘|내일|明天|今天|下周|这周)$/.test(loc))return;
  out.location=loc;
  if(out.title){out.title=out.title.replace(m[0],' ').replace(new RegExp(esc(loc)+"(?:'(?:de|da|te|ta))?",'u'),' ').replace(/\s+/g,' ').trim();}
}
/* indirizzi composti («Hauptstraße 5», «Bahnhofplatz 2, Zürich»): tedesco, olandese, scandinavo */
const COMPOUND_STREET={de:'straße|strasse|str\\.|weg|platz|allee|gasse|ring|damm|ufer|chaussee',nl:'straat|laan|weg|plein|gracht|kade|singel',sv:'gatan|vägen|gränd|torget',da:'gade|vej|allé',no:'gata|veien|vegen'};
function compoundStreet(raw,out,l){
  const suf=COMPOUND_STREET[l];if(!suf)return;
  const m=raw.match(new RegExp('(\\p{Lu}[\\p{L}-]*(?:'+suf+')\\s*\\d*[a-z]?(?:\\s*,\\s*\\p{Lu}[\\p{L}-]+)?)','u'));
  if(!m)return;if(out.location&&!m[1].startsWith(out.location))return;out.location=m[1].trim();
  if(out.title)out.title=out.title.replace(new RegExp('\\s*(?:in der|in de|im|am|an der|auf der|bei der|in|op de|på|i)?\\s*'+esc(m[1])+'\\s*','u'),' ')
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
  if(out.title){let t=out.title;found.forEach(n=>{t=t.replace(new RegExp('(?:^|\\s)(?:con|assieme a)\\s+'+esc(n)+'(?:\\s+e)?','giu'),' ');});out.title=t.replace(/\s+/g,' ').trim();}
}
function caselessPlace(canon,out,l){
  if(out.location||!CASELESS_LANG.has(l))return;
  const m=canon.match(new RegExp('(?:^|\\s)a\\s+('+CL_WORD+'(?:\\s+'+CL_WORD+')?(?:\\s*\\d+[^\\s,،]*)?(?:\\s*[,،]\\s*'+CL_WORD+'(?:\\s+'+CL_WORD+')?)?)(?=\\s|$)','u'));
  if(!m)return;out.location=m[1];
  if(out.title)out.title=out.title.replace(new RegExp('(?:^|\\s)a?\\s*'+esc(m[1]),'u'),' ').replace(/\s+/g,' ').trim();
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
  const l=lang();if(l==='it'||!pack(l))return raw;
  const {first,rest,moments,L}=rules(l);
  let t=' '+String(raw||'')+' ';
  t=suffixTimes(t,L);
  t=numberWords(t,L);
  first.forEach(r=>{t=t.replace(r.re,r.to);});   /* nomi di giorni/mesi → segnaposto */
  /* «lunedì E giovedì» in ogni lingua (и, و, และ, 和, ve, dan…) e anche solo con lo spazio (coreano) */
  const andW=alt(L.and);
  t=t.replace(R('(\u2063W\\d\u2063)\\s*(?:,|'+(andW||'(?!x)x')+')\\s*(?=\u2063W)'),'$1 e ');
  t=t.replace(R('(\u2063W\\d\u2063)\\s+(?=\u2063W)'),'$1 e ');
  /* «20. Dezember» → «20 dezember»; «20 tháng 12» → «20 dicembre» */
  t=t.replace(R('(\\d{1,2})\\.(?=\\s*\u2063M)'),'$1');
  t=t.replace(/tháng\s*(\d{1,2})(?![\p{N}])/giu,(m,n)=>+n>=1&&+n<=12?' \u2063M'+(+n-1)+'\u2063 ':m);
  t=ranges(t,L);
  rest.forEach(r=>{t=t.replace(r.re,r.to);});
  const hasTime=new RegExp(tok('alle')+'|'+tok('dalle')+'|\\d{1,2}:\\d{2}|\\d\\s*(?:am|pm)\\b','iu').test(t);
  if(!hasTime)moments.forEach(r=>{t=t.replace(r.re,r.to);});
  t=guarded(t,L,l);
  t=atRule(t,L);
  t=postpositions(t,L);
  /* i segnaposto tornano nomi (minuscoli: il parser non distingue, e un
     «Vendredi» maiuscolo verrebbe scambiato per una persona) */
  let wdn=[],mon=[];try{wdn=GIORNI_FULL;mon=MESI;}catch(e){}
  t=t.replace(/\u2063W(\d)\u2063/g,(m,i)=>' '+String(wdn[+i]||'').toLowerCase()+' ').replace(/\u2063M(\d+)\u2063/g,(m,i)=>' '+String(mon[+i]||'').toLowerCase()+' ');
  return unmark(t).replace(/\s+/g,' ').trim();
}
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
  /* ISO 2026-03-05 · orientale 2026/3/5 · 2026年3月5日 */
  t=t.replace(/(?<![\d/.-])(\d{4})[-/.年]\s*(\d{1,2})[-/.月]\s*(\d{1,2})日?(?![\d/.-])/g,(m,y,mo,d)=>toSlash(y,mo,d)||m);
  /* 5.3.2026 · 5.3. · 05.03 (tedesco, russo, polacco, turco…): solo se la lingua scrive così */
  if(order==='dmy')t=t.replace(/(?<![\d.:/])(\d{1,2})\.(\d{1,2})\.(?:(\d{4}|\d{2})(?![\d.:]))?(?![\d:])/g,(m,d,mo,y)=>{
    if(+mo<1||+mo>12||+d<1||+d>31)return m;return toSlash(y?(y.length===2?'20'+y:y):'',mo,d)||m;});
  /* la lingua scrive mese/giorno ma il parser (senza locale en-US) legge giorno/mese: si scambiano */
  if(order==='mdy'&&!us)t=t.replace(/(?<![\d/.-])(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?![\d/])/g,(m,a,b,y)=>(+a>=1&&+a<=12&&+b>=1&&+b<=31)?' '+b+'/'+a+(y?'/'+y:'')+' ':m);
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
    if(l==='it'||!pack(l))return base(raw);
    const tk=takeTags(raw);
    let canon=tk.text;try{canon=canonicalize(tk.text);}catch(e){console.warn('[v54 lingua]',e);}
    const out=base(canon);
    try{if(out){out.tags=[...new Set([...(out.tags||[]),...tk.tags])];}}catch(e){}
    try{cjkPeople(String(raw||''),out,lexOf(l),l);cjkPlace(String(raw||''),out,l);}catch(e){}
    try{caselessPeople(canon,out);caselessPlace(canon,out,l);compoundStreet(String(raw||''),out,l);}catch(e){}
    try{if(out&&out.title){out.title=out.title.replace(IT_ART_RE,' ').replace(/\s+/g,' ').trim();for(let i=0;i<2;i++)out.title=out.title.replace(IT_EDGE_RE,'').trim();}}catch(e){}
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
KX.Lang={lang,pack,lexicon:lexOf,canonicalize,preNormalize,asciiDigits,packKeywords,normText,tr};

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
