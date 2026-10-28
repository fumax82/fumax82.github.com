/* ══════════════════════════════════════════════════════════════════
   MODULO v55 — "Meteo" · un meteo per tutto il mondo, a fornitori
   ------------------------------------------------------------------
   PERCHÉ ESISTE
   Fino alla v54 il meteo arrivava da Open-Meteo, gratuito SOLO per uso
   non commerciale. Per vendere l'app servono servizi senza vincoli.
   Questo modulo mette in mezzo uno strato di "fornitori intercambiabili":
   tutte le viste chiedono il meteo a KX.Weather, che lo chiede al
   fornitore scelto nelle impostazioni e lo restituisce SEMPRE nella
   stessa forma, qualunque sia la fonte.

   FORNITORI
   · met       MET Norway (Istituto meteorologico norvegese) — BASE.
               Nessuna chiave, uso commerciale ammesso (NLOD 2.0 /
               CC BY 4.0), tutto il mondo, ~10 giorni.
               Obbligo: attribuzione "Data from MET Norway" (visibile
               nei crediti e nella scheda meteo) e rispetto della cache.
   · openmeteo Open-Meteo con la CHIAVE PERSONALE dell'utente
               (abbonamento del fornitore): 16 giorni, orario completo.
   · owm       OpenWeatherMap con la CHIAVE PERSONALE dell'utente
               (piano gratuito del fornitore): 5 giorni ogni 3 ore.
   · none      Nessun meteo: cielo, sole e luna calcolati nel telefono.

   REGOLE (vedi docs/PROPOSTA-SERVIZI.md)
   · nessuna chiave incorporata nell'app: le chiavi sono dell'utente,
     stanno cifrate nel telefono (SecretStore) e non entrano mai in
     backup, esportazioni o sincronizzazione;
   · una richiesta per luogo copre ~10 giorni: le previsioni si salvano
     in IndexedDB con una scadenza; i giorni passati mostrano l'ultima
     previsione vista ("storico visto"), senza chiedere archivi a nessuno;
   · se il fornitore con chiave rifiuta la chiave o non risponde, per
     questa sessione si torna alla base e lo si dice UNA volta;
   · i dati sono indicativi: nessuna garanzia, fonte sempre visibile.

   COME SI AGGANCIA AL SORGENTE STORICO (src/index.html)
   · WX.fetchHourly(lat,lon,dateKey)  → KX.Weather.hourly(...)
   · NowWx.load()                     → KX.Weather.now(...) + daily
   · forecast() della compilazione rapida → KX.Weather.day(...)
   · fmtT(c) (temperature)            → KX.Weather.fmtTemp(c)
   Il sorgente storico contiene tre righe «if(KX.Weather) …» che delegano
   qui; se il modulo mancasse, tutto funzionerebbe come prima.

   FORMA DEI DATI RESTITUITI (uguale per ogni fornitore)
   Forecast = {
     provider:'met', lat, lon, fetched:ms, expires:ms, tzOff:minuti,
     now:{code,temp,cloud,isDay},                 // adesso (può mancare)
     days:{ 'AAAA-MM-GG': {code,max,min,pop,sunrise,sunset,
                           hours:[{hour,code,temp,precipitationProbability,
                                   precipitation,cloudCover,windSpeed}]} }
   }
   "code" è un codice meteo nello standard WMO (quello che l'app usa da
   sempre: 0 sereno … 95 temporale), così le mappe stato/icona esistenti
   (WX.wmoToState, WMO_ST, WICON) restano valide con qualsiasi fornitore.
══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const KX=window.KX=window.KX||{};
const tr=(s,p)=>{try{return typeof T==='function'?T(s,p):s;}catch(e){return s;}};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad2=n=>String(n).padStart(2,'0');
const DAY_MS=86400000;

/* ──────────────────────────────────────────────────────────────────
   1. IMPOSTAZIONI
   AppSettings.wxSource  : 'met' | 'openmeteo' | 'owm' | 'none'
   AppSettings.tempUnit  : 'auto' | 'C' | 'F'
   (salvate con le altre impostazioni; le CHIAVI invece no: § 3)
────────────────────────────────────────────────────────────────── */
const SOURCES=['met','openmeteo','owm','none'];
function settings(){try{return typeof AppSettings==='object'?AppSettings:{};}catch(e){return {};}}
function source(){const s=settings().wxSource;return SOURCES.includes(s)?s:'met';}
function saveSettings(){try{AppSettings.save();}catch(e){}}

/* Paesi che usano i gradi Fahrenheit nella vita quotidiana */
const F_COUNTRIES=['US','BS','BZ','KY','LR','PW','FM','MH'];
function tempUnit(){
  const u=settings().tempUnit;
  if(u==='C'||u==='F')return u;
  return F_COUNTRIES.includes(String(settings().country||'').toUpperCase())?'F':'C';
}
/* Temperatura in °C → testo nell'unità dell'utente ("21°" oppure "70°F") */
function fmtTemp(c){
  if(c==null||isNaN(c))return '';
  return tempUnit()==='F'?Math.round(c*9/5+32)+'°F':Math.round(c)+'°';
}

/* ──────────────────────────────────────────────────────────────────
   2. RETE — una richiesta alla volta, con pausa minima tra l'una e
   l'altra, timeout e un solo nuovo tentativo. Nell'app Android passa
   dal ponte nativo (Net.get → httpGet, con User-Agent dell'app).
────────────────────────────────────────────────────────────────── */
const net={busy:false,queue:[],last:0,GAP:300};
function getText(url,ms){
  return new Promise((res,rej)=>{net.queue.push({url,ms:ms||12000,res,rej});pump();});
}
async function pump(){
  if(net.busy||!net.queue.length)return;
  net.busy=true;
  const job=net.queue.shift();
  const wait=Math.max(0,net.last+net.GAP-Date.now());
  if(wait)await new Promise(r=>setTimeout(r,wait));
  try{
    let txt;
    for(let attempt=0;attempt<2;attempt++){
      try{
        const N=(KX.Net&&typeof KX.Net.get==='function')?KX.Net:null;   /* rete dell'app: ponte nativo su Android, fetch nel browser */
        if(N)txt=await N.get(job.url,job.ms);
        else{const r=await fetch(job.url,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);txt=await r.text();}
        break;
      }catch(e){
        /* una chiave rifiutata (401/403) non si ritenta: è definitiva */
        if(attempt===1||/HTTP 40[13]/.test(String(e&&e.message||e)))throw e;
        await new Promise(r=>setTimeout(r,500));
      }
    }
    job.res(txt);
  }catch(e){job.rej(e);}
  finally{net.last=Date.now();net.busy=false;pump();}
}
const isAuthError=e=>/HTTP 40[13]|unauthorized|invalid api key|apikey/i.test(String(e&&e.message||e));

/* ──────────────────────────────────────────────────────────────────
   3. CASSAFORTE DELLE CHIAVI (SecretStore)
   Le chiavi personali stanno in IndexedDB cifrate con AES-256-GCM e
   una chiave di cifratura NON estraibile, generata dal telefono. Non
   stanno in localStorage: così non finiscono nel backup esportato, né
   nella sincronizzazione QR (che copiano solo localStorage).
   Nota: la cassaforte nativa (Vault) sa solo SCARICARE un indirizzo
   segreto, non restituirlo: per le chiavi serve questa, lato pagina.
────────────────────────────────────────────────────────────────── */
const SecretStore={
  db:null,mem:new Map(),
  open(){
    if(this.db)return Promise.resolve(this.db);
    return new Promise((res,rej)=>{
      try{
        const r=indexedDB.open('kalend-secrets',1);
        r.onupgradeneeded=()=>{r.result.createObjectStore('keys');r.result.createObjectStore('items');};
        r.onsuccess=()=>{this.db=r.result;res(this.db);};
        r.onerror=()=>rej(r.error);
      }catch(e){rej(e);}
    });
  },
  async tx(store,mode,fn){
    const db=await this.open();
    return new Promise((res,rej)=>{const t=db.transaction(store,mode);const r=fn(t.objectStore(store));t.oncomplete=()=>res(r&&r.result);t.onerror=()=>rej(t.error);});
  },
  async cryptoKey(){
    let k=await this.tx('keys','readonly',s=>s.get('main'));
    if(k)return k;
    k=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
    await this.tx('keys','readwrite',s=>s.put(k,'main'));
    return k;
  },
  async put(id,text){
    text=String(text||'').trim();
    if(!text){await this.del(id);return;}
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},await this.cryptoKey(),new TextEncoder().encode(text));
    await this.tx('items','readwrite',s=>s.put({iv,ct},id));
    this.mem.set(id,text);
  },
  async get(id){
    if(this.mem.has(id))return this.mem.get(id);
    try{
      const it=await this.tx('items','readonly',s=>s.get(id));
      if(!it)return '';
      const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:it.iv},await this.cryptoKey(),it.ct);
      const text=new TextDecoder().decode(pt);this.mem.set(id,text);return text;
    }catch(e){return '';}
  },
  async del(id){this.mem.delete(id);try{await this.tx('items','readwrite',s=>s.delete(id));}catch(e){}},
};
KX.Secrets=SecretStore;

/* Migrazione dalla v54: la chiave Open-Meteo stava nelle impostazioni
   (e quindi nel backup esportato). Si sposta nella cassaforte e si
   cancella da lì; chi l'aveva messa passa alla fonte "openmeteo". */
async function migrateV54Key(){
  const s=settings();const k=String(s.openMeteoKey||'').trim();
  if(!k)return;
  try{await SecretStore.put('wx.openmeteo',k);if(!s.wxSource)s.wxSource='openmeteo';}catch(e){}
  try{delete AppSettings.openMeteoKey;saveSettings();}catch(e){}
}

/* ──────────────────────────────────────────────────────────────────
   4. CODICI METEO — ogni fornitore ha i suoi simboli; qui si traducono
   nello standard WMO usato da sempre dall'app (così icone, cielo vivo
   e particelle restano quelli di prima).
   WMO: 0-1 sereno · 2 parz. nuvoloso · 3 coperto · 45 nebbia ·
   51-57 pioviggine · 61-67 pioggia · 71-77 neve · 80-82 rovesci ·
   85-86 rovesci di neve · 95 temporale · 96/99 temporale con grandine
────────────────────────────────────────────────────────────────── */
/* MET Norway: symbol_code tipo "partlycloudy_day", "heavyrainshowers_night" */
function metCode(sym){
  const s=String(sym||'').replace(/_(day|night|polartwilight)$/,'');
  if(!s)return null;
  if(/thunder/.test(s))return /hail|sleet|snow/.test(s)?96:95;
  if(/^(clearsky)$/.test(s))return 0;
  if(/^(fair)$/.test(s))return 1;
  if(/^(partlycloudy)$/.test(s))return 2;
  if(/^(cloudy)$/.test(s))return 3;
  if(/^(fog)$/.test(s))return 45;
  if(/snow/.test(s))return /showers/.test(s)?(/heavy/.test(s)?86:85):(/heavy/.test(s)?75:/light/.test(s)?71:73);
  if(/sleet/.test(s))return /heavy/.test(s)?67:66;
  if(/rain/.test(s)){
    if(/showers/.test(s))return /heavy/.test(s)?82:/light/.test(s)?80:81;
    return /heavy/.test(s)?65:/light/.test(s)?51:63;
  }
  return 3;
}
/* OpenWeatherMap: id numerico (2xx temporale, 3xx pioviggine, 5xx pioggia,
   6xx neve, 7xx nebbia/foschia, 800 sereno, 801-804 nuvole) */
function owmCode(id,cloudPct){
  id=Number(id);
  if(id>=200&&id<300)return 95;
  if(id>=300&&id<400)return 51;
  if(id>=500&&id<600)return id===500?61:id===502||id===503||id===504?65:id>=520?81:63;
  if(id>=600&&id<700)return id===600?71:id===602?75:id>=620?85:id>=611&&id<=616?66:73;
  if(id>=700&&id<800)return 45;
  if(id===800)return 0;
  if(id===801)return 1;if(id===802)return 2;
  if(id>=803)return 3;
  return cloudPct>=80?3:cloudPct>=40?2:0;
}

/* ──────────────────────────────────────────────────────────────────
   5. FUSO ORARIO DEL LUOGO
   MET Norway dà gli orari in UTC; l'app ragiona nell'ora locale del
   luogo dell'evento. Senza un atlante dei fusi (pesante) si usa:
   · il fuso del telefono, se il luogo è vicino alla sua longitudine
     (±12°): esatto, ora legale compresa;
   · altrimenti un fuso "solare" (longitudine/15): può sbagliare di
     un'ora dove l'ora legale o i confini politici lo spostano.
   Open-Meteo e OpenWeatherMap comunicano il fuso: lì è sempre esatto.
────────────────────────────────────────────────────────────────── */
function tzOffsetFor(lon,dateMs){
  const dev=-new Date(dateMs||Date.now()).getTimezoneOffset();  /* minuti, es. +120 */
  const devLon=dev/60*15;
  let d=Math.abs(lon-devLon);if(d>180)d=360-d;
  if(d<=12)return dev;
  return Math.round(lon/15)*60;
}
/* istante UTC (ms) → chiave 'AAAA-MM-GG' e ora locale nel fuso dato */
function localParts(ms,tzOff){
  const d=new Date(ms+tzOff*60000);
  return {key:d.getUTCFullYear()+'-'+pad2(d.getUTCMonth()+1)+'-'+pad2(d.getUTCDate()),hour:d.getUTCHours(),min:d.getUTCHours()*60+d.getUTCMinutes()};
}
function todayKey(){const d=new Date();return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());}

/* un giorno vuoto, da riempire ora per ora */
function newDay(){return {code:null,max:null,min:null,pop:null,sunrise:null,sunset:null,hours:[]};}
/* massima/minima e stato prevalente del giorno a partire dalle ore */
function finishDay(day){
  const temps=day.hours.map(h=>h.temp).filter(t=>t!=null);
  if(temps.length){day.max=day.max==null?Math.max(...temps):Math.max(day.max,...temps);day.min=day.min==null?Math.min(...temps):Math.min(day.min,...temps);}
  const pops=day.hours.map(h=>h.precipitationProbability).filter(p=>p!=null);
  if(pops.length&&day.pop==null)day.pop=Math.max(...pops);
  if(day.code==null&&day.hours.length){
    /* stato del giorno: il peggiore tra le 8 e le 20 (pioggia batte nuvole, ecc.) */
    const rank=c=>c>=95?6:(c>=71&&c<=77)||c>=85?5:c>=61||(c>=80&&c<=82)?4:c>=51?3:c===45?2:c===3?1:0;
    const mid=day.hours.filter(h=>h.hour>=8&&h.hour<=20&&h.code!=null);
    const pool=mid.length?mid:day.hours.filter(h=>h.code!=null);
    if(pool.length)day.code=pool.reduce((a,h)=>rank(h.code)>rank(a)?h.code:a,pool[0].code);
  }
  return day;
}

/* ──────────────────────────────────────────────────────────────────
   6. FORNITORI
   Ognuno espone: id, needsKey, name, site (pagina del fornitore per
   registrarsi), attribution (testo richiesto dalla licenza), horizon
   (giorni di previsione), ttl (validità della cache, ms) e
   fetch(lat,lon,key) → Forecast.
────────────────────────────────────────────────────────────────── */
const PROVIDERS={};

/* ── MET Norway ─────────────────────────────────────────────────── */
PROVIDERS.met={
  id:'met',needsKey:false,name:'MET Norway',site:'https://api.met.no/',
  attribution:'Data from MET Norway (CC BY 4.0)',horizon:10,ttl:2*3600e3,
  async fetch(lat,lon){
    /* coordinate a 4 decimali: richiesta esplicita dei termini d'uso */
    const url=`https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
    const j=JSON.parse(await getText(url));
    const ts=(j&&j.properties&&j.properties.timeseries)||[];
    if(!ts.length)throw new Error('empty');
    const tzOff=tzOffsetFor(lon);
    const days={};
    const put=(ms,inst,next,hoursSpan)=>{
      const det=inst||{};const nd=(next&&next.details)||{};
      const code=next?metCode(next.summary&&next.summary.symbol_code):null;
      for(let i=0;i<hoursSpan;i++){
        /* ogni ora coperta dalla voce va nel suo giorno locale (una voce
           "6 ore" può scavalcare la mezzanotte) */
        const lp=localParts(ms+i*3600e3,tzOff);const key=lp.key,h=lp.hour;
        const day=days[key]||(days[key]=newDay());
        if(day.hours.some(x=>x.hour===h))continue;
        day.hours.push({hour:h,code,
          temp:det.air_temperature!=null?Math.round(det.air_temperature):null,
          precipitationProbability:nd.probability_of_precipitation!=null?Math.round(nd.probability_of_precipitation):(nd.precipitation_amount!=null?(nd.precipitation_amount>0.5?70:nd.precipitation_amount>0?35:5):null),
          precipitation:nd.precipitation_amount!=null?nd.precipitation_amount/hoursSpan:null,
          cloudCover:det.cloud_area_fraction!=null?Math.round(det.cloud_area_fraction):null,
          windSpeed:det.wind_speed!=null?Math.round(det.wind_speed*3.6):null});  /* m/s → km/h */
      }
    };
    ts.forEach(e=>{
      const ms=Date.parse(e.time);if(!Number.isFinite(ms))return;
      const lp=localParts(ms,tzOff);const d=e.data||{};
      const inst=d.instant&&d.instant.details;
      if(d.next_1_hours)put(ms,inst,d.next_1_hours,1);
      else if(d.next_6_hours){
        put(ms,inst,d.next_6_hours,6);
        const nd=d.next_6_hours.details||{};const day=days[lp.key];
        if(day&&nd.air_temperature_max!=null)day.max=day.max==null?nd.air_temperature_max:Math.max(day.max,nd.air_temperature_max);
        if(day&&nd.air_temperature_min!=null)day.min=day.min==null?nd.air_temperature_min:Math.min(day.min,nd.air_temperature_min);
      }
    });
    Object.values(days).forEach(day=>{day.hours.sort((a,b)=>a.hour-b.hour);finishDay(day);});
    const first=ts[0].data||{};const fi=(first.instant&&first.instant.details)||{};
    const sym=(first.next_1_hours||first.next_6_hours||{}).summary;
    const now={code:metCode(sym&&sym.symbol_code),temp:fi.air_temperature!=null?fi.air_temperature:null,cloud:fi.cloud_area_fraction!=null?fi.cloud_area_fraction:null,isDay:!/_night/.test(String(sym&&sym.symbol_code||''))};
    return {provider:'met',lat,lon,tzOff,now,days};
  },
};

/* ── Open-Meteo (chiave personale, piano del fornitore) ──────────── */
PROVIDERS.openmeteo={
  id:'openmeteo',needsKey:true,name:'Open-Meteo',site:'https://open-meteo.com/en/pricing',
  attribution:'Weather data by Open-Meteo.com (CC BY 4.0)',horizon:16,ttl:3600e3,
  async fetch(lat,lon,key){
    const url=`https://customer-api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}`
      +`&current=weather_code,temperature_2m,cloud_cover,is_day`
      +`&hourly=weather_code,temperature_2m,precipitation_probability,precipitation,cloud_cover,wind_speed_10m`
      +`&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset`
      +`&timezone=auto&forecast_days=16&apikey=${encodeURIComponent(key)}`;
    const j=JSON.parse(await getText(url));
    if(j&&j.error)throw new Error(j.reason||'API error');
    const H=j.hourly||{},D=j.daily||{},C=j.current||{};
    const days={};
    (H.time||[]).forEach((t,i)=>{
      const key=String(t).slice(0,10),hour=parseInt(String(t).slice(11,13),10);
      const day=days[key]||(days[key]=newDay());
      day.hours.push({hour,code:H.weather_code?H.weather_code[i]:null,temp:H.temperature_2m&&H.temperature_2m[i]!=null?Math.round(H.temperature_2m[i]):null,
        precipitationProbability:H.precipitation_probability?H.precipitation_probability[i]:null,precipitation:H.precipitation?H.precipitation[i]:null,
        cloudCover:H.cloud_cover?H.cloud_cover[i]:null,windSpeed:H.wind_speed_10m?H.wind_speed_10m[i]:null});
    });
    const toMin=iso=>{const m=String(iso||'').match(/T(\d{2}):(\d{2})/);return m?parseInt(m[1],10)*60+parseInt(m[2],10):null;};
    (D.time||[]).forEach((t,i)=>{
      const day=days[t]||(days[t]=newDay());
      day.code=D.weather_code?D.weather_code[i]:null;day.max=D.temperature_2m_max?D.temperature_2m_max[i]:null;day.min=D.temperature_2m_min?D.temperature_2m_min[i]:null;
      day.pop=D.precipitation_probability_max?D.precipitation_probability_max[i]:null;day.sunrise=toMin(D.sunrise&&D.sunrise[i]);day.sunset=toMin(D.sunset&&D.sunset[i]);
    });
    Object.values(days).forEach(finishDay);
    const now={code:C.weather_code!=null?C.weather_code:null,temp:C.temperature_2m!=null?C.temperature_2m:null,cloud:C.cloud_cover!=null?C.cloud_cover:null,isDay:C.is_day!==0};
    return {provider:'openmeteo',lat,lon,tzOff:(j.utc_offset_seconds||0)/60,now,days};
  },
};

/* ── OpenWeatherMap (chiave personale, piano gratuito del fornitore) ─ */
PROVIDERS.owm={
  id:'owm',needsKey:true,name:'OpenWeatherMap',site:'https://openweathermap.org/price',
  attribution:'Weather data provided by OpenWeather (CC BY-SA 4.0)',horizon:5,ttl:3600e3,
  async fetch(lat,lon,key){
    const q=`lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&units=metric&appid=${encodeURIComponent(key)}`;
    const f=JSON.parse(await getText(`https://api.openweathermap.org/data/2.5/forecast?${q}`));
    if(f&&String(f.cod)!=='200')throw new Error('HTTP '+(f.cod||'error')+' '+(f.message||''));
    const tzOff=((f.city&&f.city.timezone)||0)/60;
    const days={};
    (f.list||[]).forEach(e=>{
      const lp=localParts(e.dt*1000,tzOff);
      const w=(e.weather&&e.weather[0])||{};const cloud=e.clouds?e.clouds.all:null;
      const code=owmCode(w.id,cloud);
      for(let i=0;i<3;i++){  /* ogni voce copre 3 ore */
        const h=lp.hour+i;if(h>23)break;
        const day=days[lp.key]||(days[lp.key]=newDay());
        if(day.hours.some(x=>x.hour===h))continue;
        day.hours.push({hour:h,code,temp:e.main&&e.main.temp!=null?Math.round(e.main.temp):null,
          precipitationProbability:e.pop!=null?Math.round(e.pop*100):null,
          precipitation:e.rain&&e.rain['3h']!=null?e.rain['3h']/3:(e.snow&&e.snow['3h']!=null?e.snow['3h']/3:0),
          cloudCover:cloud,windSpeed:e.wind&&e.wind.speed!=null?Math.round(e.wind.speed*3.6):null});
      }
    });
    Object.values(days).forEach(day=>{day.hours.sort((a,b)=>a.hour-b.hour);finishDay(day);});
    let now=null;
    try{
      const c=JSON.parse(await getText(`https://api.openweathermap.org/data/2.5/weather?${q}`));
      const w=(c.weather&&c.weather[0])||{};
      const sr=c.sys&&c.sys.sunrise,ss=c.sys&&c.sys.sunset,nowS=c.dt;
      now={code:owmCode(w.id,c.clouds&&c.clouds.all),temp:c.main?c.main.temp:null,cloud:c.clouds?c.clouds.all:null,isDay:sr&&ss?nowS>=sr&&nowS<ss:true};
      const t=localParts(nowS*1000,tzOff);const day=days[t.key];
      if(day&&sr&&ss){day.sunrise=localParts(sr*1000,tzOff).min;day.sunset=localParts(ss*1000,tzOff).min;}
    }catch(e){}
    return {provider:'owm',lat,lon,tzOff,now,days};
  },
};

/* ── Nessun meteo ────────────────────────────────────────────────── */
PROVIDERS.none={id:'none',needsKey:false,name:'',site:'',attribution:'',horizon:0,ttl:0,async fetch(){return null;}};

/* ──────────────────────────────────────────────────────────────────
   7. CACHE PERSISTENTE (IndexedDB 'kalend-wx') + "storico visto"
   Chiave: fornitore | lat | lon (2 decimali ≈ 1 km, come la privacy
   già prevede). Quando arriva una previsione nuova, i giorni passati
   della vecchia restano (fino a 60 giorni): è il meteo "visto".
────────────────────────────────────────────────────────────────── */
const Cache={
  db:null,mem:new Map(),
  open(){
    if(this.db)return Promise.resolve(this.db);
    return new Promise((res,rej)=>{
      try{const r=indexedDB.open('kalend-wx',1);r.onupgradeneeded=()=>r.result.createObjectStore('fc');r.onsuccess=()=>{this.db=r.result;res(this.db);};r.onerror=()=>rej(r.error);}catch(e){rej(e);}
    });
  },
  async get(k){
    if(this.mem.has(k))return this.mem.get(k);
    try{const db=await this.open();const v=await new Promise((res,rej)=>{const r=db.transaction('fc').objectStore('fc').get(k);r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error);});if(v)this.mem.set(k,v);return v;}catch(e){return null;}
  },
  async put(k,v){
    this.mem.set(k,v);
    try{const db=await this.open();await new Promise((res,rej)=>{const t=db.transaction('fc','readwrite');t.objectStore('fc').put(v,k);t.oncomplete=res;t.onerror=()=>rej(t.error);});}catch(e){}
  },
  async clear(){
    this.mem.clear();
    try{const db=await this.open();await new Promise((res,rej)=>{const t=db.transaction('fc','readwrite');t.objectStore('fc').clear();t.oncomplete=res;t.onerror=()=>rej(t.error);});}catch(e){}
  },
};
function cacheKey(provider,lat,lon){return provider+'|'+lat.toFixed(2)+'|'+lon.toFixed(2);}
/* unisce la previsione nuova con i giorni passati di quella vecchia */
function mergeHistory(oldF,newF){
  if(!oldF||!oldF.days)return newF;
  const today=todayKey();const limit=new Date(Date.now()-60*DAY_MS);
  const limitKey=limit.getFullYear()+'-'+pad2(limit.getMonth()+1)+'-'+pad2(limit.getDate());
  Object.keys(oldF.days).forEach(k=>{if(k<today&&k>=limitKey&&!newF.days[k])newF.days[k]=oldF.days[k];});
  return newF;
}

/* ──────────────────────────────────────────────────────────────────
   8. IL CUORE: forecastFor(lat,lon) → Forecast (da cache o da rete)
   · una sola richiesta in volo per luogo;
   · fornitore con chiave non funzionante → base per questa sessione;
   · senza rete → ultima previsione in cache, anche scaduta.
────────────────────────────────────────────────────────────────── */
const pending=new Map();
let degraded=null;      /* fornitore con chiave che ha fallito in questa sessione */
let toldDegraded=false;
function activeProvider(){
  const s=source();
  if(degraded&&degraded===s)return PROVIDERS.met;
  return PROVIDERS[s]||PROVIDERS.met;
}
function enabled(){return settings().featMeteo!==false&&activeProvider().id!=='none';}
async function forecastFor(lat,lon){
  if(!enabled()||!Number.isFinite(lat)||!Number.isFinite(lon))return null;
  const prov=activeProvider();
  const k=cacheKey(prov.id,lat,lon);
  const cached=await Cache.get(k);
  if(cached&&cached.expires>Date.now())return cached;
  if(pending.has(k))return pending.get(k);
  const p=(async()=>{
    try{
      const key=prov.needsKey?await SecretStore.get('wx.'+prov.id):'';
      if(prov.needsKey&&!key)throw new Error('HTTP 401 missing key');
      const f=await prov.fetch(lat,lon,key);
      if(!f)return null;
      f.fetched=Date.now();f.expires=Date.now()+prov.ttl;
      const merged=mergeHistory(cached,f);
      await Cache.put(k,merged);
      return merged;
    }catch(e){
      console.warn('[meteo]',prov.id,String(e&&e.message||e));
      if(prov.needsKey&&isAuthError(e)&&degraded!==prov.id){
        degraded=prov.id;
        if(!toldDegraded){toldDegraded=true;try{toast('☁️ '+tr('Chiave rifiutata dal fornitore: per questa sessione uso il meteo di base'));}catch(x){}}
        refreshUI();
        pending.delete(k);
        return forecastFor(lat,lon);   /* riprova subito con la base */
      }
      return cached||null;             /* offline: meglio vecchio che niente */
    }
  })().finally(()=>pending.delete(k));
  pending.set(k,p);
  return p;
}

/* ──────────────────────────────────────────────────────────────────
   9. API PUBBLICA — KX.Weather
────────────────────────────────────────────────────────────────── */
const Weather={
  SOURCES,PROVIDERS,
  source,fmtTemp,tempUnit,
  /* nome e attribuzione della fonte in uso (per crediti e schede) */
  label(){return activeProvider().name||tr('Nessun meteo');},
  attribution(){return activeProvider().attribution;},
  horizonDays(){return activeProvider().horizon;},
  enabled,
  /* ore di un giorno in un luogo: stessa forma che WX.fetchHourly
     restituiva da Open-Meteo (array con .sun={sunrise,sunset}) */
  async hourly(lat,lon,dateKey){
    const f=await forecastFor(lat,lon);
    const day=f&&f.days&&f.days[dateKey];
    if(!day||!day.hours.length)return null;
    const toState=c=>{try{return WX.wmoToState(c==null?3:c);}catch(e){return 'cloudy';}};
    const arr=day.hours.map(h=>Object.assign({},h,{code:h.code==null?3:h.code,state:toState(h.code)}));
    if(day.sunrise!=null&&day.sunset!=null)arr.sun={sunrise:day.sunrise,sunset:day.sunset};
    else{
      /* alba/tramonto calcolati dal modulo astronomico dell'app, se c'è */
      try{if(typeof KX.sunTimes==='function'){const s=KX.sunTimes(lat,lon,dateKey);if(s)arr.sun=s;}}catch(e){}
    }
    return arr;
  },
  /* riepilogo di un giorno: {code,max,min,pop} oppure null */
  async day(lat,lon,dateKey){
    const f=await forecastFor(lat,lon);const d=f&&f.days&&f.days[dateKey];
    return d?{code:d.code,max:d.max,min:d.min,pop:d.pop}:null;
  },
  /* adesso + giorni: stessa forma di NowWx.data */
  async now(lat,lon){
    const f=await forecastFor(lat,lon);if(!f)return null;
    const daily=Object.keys(f.days).sort().filter(k=>k>=todayKey()).map(k=>({k,code:f.days[k].code,max:f.days[k].max,min:f.days[k].min}));
    const n=f.now||{};
    return {code:n.code,temp:n.temp,cloud:n.cloud,is_day:n.isDay===false?0:1,daily};
  },
  /* chiavi personali */
  getKey:id=>SecretStore.get('wx.'+id),
  async setKey(id,text){await SecretStore.put('wx.'+id,text);if(degraded===id)degraded=null;toldDegraded=false;await Cache.clear();},
  /* prova una chiave: risolve con true, oppure rigetta con l'errore del fornitore */
  async test(id,key){
    const prov=PROVIDERS[id];if(!prov)throw new Error('provider');
    const h=(typeof Home==='object'&&Home.get)?Home.get():{lat:45.46,lon:9.19};
    const f=await prov.fetch(h.lat,h.lon,key);
    return !!(f&&f.days&&Object.keys(f.days).length);
  },
  async setSource(s){if(!SOURCES.includes(s))return;AppSettings.wxSource=s;saveSettings();degraded=null;toldDegraded=false;await Cache.clear();refreshUI();},
  clearCache:()=>Cache.clear(),
  /* solo per i collaudi: parser dei fornitori */
  _codes:{metCode,owmCode},_tz:{tzOffsetFor,localParts},
};
KX.Weather=Weather;

/* ──────────────────────────────────────────────────────────────────
   10. IMPOSTAZIONI → FUNZIONALITÀ → scheda "Meteo"
────────────────────────────────────────────────────────────────── */
const DESC={
  met:()=>tr('Nessuna registrazione. Circa 10 giorni. Tutto il mondo.'),
  openmeteo:()=>tr('Abbonamento del fornitore. 16 giorni, più modelli, dati orari completi.'),
  owm:()=>tr('Piano gratuito del fornitore, con registrazione. 5 giorni ogni 3 ore.'),
  none:()=>tr('Solo cielo, sole e luna calcolati nel telefono. Nessun dato esce dal telefono.'),
};
const TITLE={met:()=>tr('Base (incluso)')+' — MET Norway',openmeteo:()=>tr('La tua chiave')+' — Open-Meteo',owm:()=>tr('La tua chiave')+' — OpenWeatherMap',none:()=>tr('Nessun meteo')};
const NOTICE=()=>tr('I dati meteo sono indicativi. I servizi «la tua chiave» sono forniti da terzi secondo i loro termini e costi: Kalend non ne è parte, non li consiglia e non vede mai la tua chiave fuori da questo telefono.');

function installSettings(){
  const ref=document.getElementById('set-feat-meteo');
  if(!ref||document.getElementById('kx-wx-card'))return;
  const host=ref.closest('.toggle-wrap')?ref.closest('.toggle-wrap').parentElement:ref.parentElement;
  const card=document.createElement('div');card.id='kx-wx-card';card.className='form-group';card.style.marginTop='8px';
  const rows=SOURCES.map(id=>{
    const p=PROVIDERS[id];
    return `<label class="kx-wx-row" data-src="${id}"><input type="radio" name="kx-wx-src" value="${id}"><div><b>${esc(TITLE[id]())}</b><small>${esc(DESC[id]())}</small>`
      +(p.needsKey?`<div class="kx-wx-key"><input type="password" class="form-input" data-key="${id}" autocomplete="off" spellcheck="false" placeholder="${esc(tr('Chiave API'))}"><button type="button" class="kx-wx-eye" data-eye="${id}" aria-label="${esc(tr('Mostra'))}">👁</button><button type="button" class="kx-wx-test" data-test="${id}">${esc(tr('Prova'))}</button><a href="#" class="kx-wx-site" data-site="${id}">${esc(tr('Pagina del fornitore'))} ↗</a></div>`:'')
      +(p.attribution?`<small class="kx-wx-attr">${esc(p.attribution)}</small>`:'')+`</div></label>`;
  }).join('');
  card.innerHTML=`<div class="form-label">☁️ ${esc(tr('Fonte del meteo'))}</div>${rows}
    <div class="kx-wx-units"><span>${esc(tr('Unità di temperatura'))}</span><select class="form-input kx-sel" id="kx-wx-unit"><option value="auto">${esc(tr('Automatica (per paese)'))}</option><option value="C">°C</option><option value="F">°F</option></select></div>
    <div class="set-caption">${esc(NOTICE())}</div>`;
  host.appendChild(card);
  /* stato iniziale */
  const radio=card.querySelector(`input[name="kx-wx-src"][value="${source()}"]`);if(radio)radio.checked=true;
  card.querySelector('#kx-wx-unit').value=['C','F'].includes(settings().tempUnit)?settings().tempUnit:'auto';
  SOURCES.forEach(id=>{const inp=card.querySelector(`input[data-key="${id}"]`);if(inp)SecretStore.get('wx.'+id).then(k=>{inp.value=k||'';});});
  /* eventi */
  card.querySelectorAll('input[name="kx-wx-src"]').forEach(r=>r.addEventListener('change',async()=>{
    const id=r.value;const p=PROVIDERS[id];
    if(p.needsKey){
      const key=(card.querySelector(`input[data-key="${id}"]`)||{}).value||'';
      if(!key.trim()){try{toast('🔑 '+tr('Inserisci prima la chiave e premi «Prova»'));}catch(e){}const back=card.querySelector(`input[name="kx-wx-src"][value="${source()}"]`);if(back)back.checked=true;return;}
      if(!(await acceptNotice())){const back=card.querySelector(`input[name="kx-wx-src"][value="${source()}"]`);if(back)back.checked=true;return;}
    }
    await Weather.setSource(id);
    try{toast('☁️ '+tr('Fonte del meteo: {s}',{s:p.name||tr('Nessun meteo')}));}catch(e){}
  }));
  card.querySelectorAll('input[data-key]').forEach(inp=>inp.addEventListener('change',async()=>{
    const id=inp.dataset.key;await Weather.setKey(id,inp.value);
    try{toast('🔑 '+(inp.value.trim()?tr('Chiave salvata'):tr('Chiave rimossa')));}catch(e){}
    if(!inp.value.trim()&&source()===id)await Weather.setSource('met');
  }));
  card.querySelectorAll('button[data-eye]').forEach(b=>b.addEventListener('click',()=>{const inp=card.querySelector(`input[data-key="${b.dataset.eye}"]`);inp.type=inp.type==='password'?'text':'password';}));
  card.querySelectorAll('button[data-test]').forEach(b=>b.addEventListener('click',async()=>{
    const id=b.dataset.test;const inp=card.querySelector(`input[data-key="${id}"]`);const key=(inp.value||'').trim();
    if(!key){try{toast('🔑 '+tr('Chiave API'));}catch(e){}return;}
    b.disabled=true;b.textContent='…';
    try{await Weather.test(id,key);await Weather.setKey(id,key);try{toast('✅ '+tr('Funziona'));}catch(e){}}
    catch(e){try{toast('⚠️ '+tr('Chiave rifiutata dal fornitore')+': '+String(e&&e.message||e).slice(0,60));}catch(x){}}
    b.disabled=false;b.textContent=tr('Prova');
  }));
  card.querySelectorAll('a[data-site]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const u=PROVIDERS[a.dataset.site].site;try{if(typeof openExternal==='function')openExternal(u);else window.open(u,'_blank','noopener');}catch(x){}}));
  card.querySelector('#kx-wx-unit').addEventListener('change',e=>{AppSettings.tempUnit=e.target.value;saveSettings();try{if(typeof renderAll==='function')renderAll();}catch(x){}});
}
/* dicitura di estraneità, da accettare esplicitamente (una volta per fonte) */
async function acceptNotice(){
  try{
    if(typeof KX.dialog==='function'){
      const v=await KX.dialog(tr('Servizio di terzi'),NOTICE(),[{t:tr('Accetto'),v:'y',cls:'pri'},{t:tr('Annulla'),v:null}]);
      return v==='y';
    }
    return confirm(NOTICE());
  }catch(e){return true;}
}
/* crediti: la riga del meteo segue la fonte in uso */
function refreshUI(){
  try{
    const cr=document.getElementById('kx-credits');if(!cr)return;
    let line=cr.querySelector('[data-kx-wx-credit]');
    if(!line){
      /* sostituisce le vecchie righe fisse su Open-Meteo */
      [...cr.querySelectorAll('div')].filter(d=>/^Dati meteo:/.test(d.textContent.trim())).forEach((d,i)=>{if(i===0){line=d;d.setAttribute('data-kx-wx-credit','1');}else d.remove();});
      if(!line){line=document.createElement('div');line.setAttribute('data-kx-wx-credit','1');cr.lastElementChild.prepend(line);}
    }
    const a=Weather.attribution();
    line.textContent=a?tr('Dati meteo: {s}',{s:a}):tr('Dati meteo: nessuno (cielo calcolato nel telefono)');
  }catch(e){}
}

/* ──────────────────────────────────────────────────────────────────
   11. AVVIO
────────────────────────────────────────────────────────────────── */
function boot(){
  migrateV54Key().finally(()=>{
    try{installSettings();}catch(e){console.warn('[meteo] impostazioni',e);}
    refreshUI();
    /* il cielo vivo ricarica il meteo di casa con la nuova fonte */
    try{if(typeof NowWx==='object'&&NowWx.load)NowWx.load(true).then(()=>{try{SkyLive.update(true);}catch(e){}});}catch(e){}
  });
}
if(document.readyState==='complete')setTimeout(boot,250);else addEventListener('load',()=>setTimeout(boot,250));
})();
