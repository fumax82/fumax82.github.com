/* ══════════════════════════════════════════════════════════════════
   MODULO v55 — "Luoghi" · geocodifica a strati, per tutto il mondo
   ------------------------------------------------------------------
   Trasforma un luogo scritto («Milano», «Tokyo», «via Roma 5, Torino»,
   «45.46, 9.19») in coordinate, per il meteo e il cielo dell'evento.

   PERCHÉ A STRATI
   Fino alla v54 ogni ricerca andava in rete (Open-Meteo gratuito, poi
   Nominatim: 1 richiesta al secondo per TUTTA l'app). Ora si prova, in
   ordine, dallo strato più economico a quello più costoso e ci si ferma
   al primo che risponde:
     0. coordinate scritte dall'utente           (nessuna rete)
     1. memoria: luoghi già risolti sul telefono  (nessuna rete)
     2. atlante offline: ~24.000 città del mondo  (nessuna rete)
        con almeno 15.000 abitanti (GeoNames, CC BY 4.0, nomi in inglese)
     3. Geocoder di Android, tramite il ponte nativo (quando il nativo
        lo offrirà: metodo geocode(id,testo,lingua) → JSON)
     4. la chiave personale dell'utente, se ha scelto Open-Meteo o
        OpenWeatherMap per il meteo (la geocodifica è inclusa)
     5. Photon (komoot), ricerca su dati OpenStreetMap, senza chiave,
        «uso corretto» senza garanzie — serve per gli indirizzi
   Nominatim non viene più usato. L'atlante ha i nomi inglesi: un nome
   locale («Milano», «東京») passa una volta dalla rete e poi resta in
   memoria.

   API — KX.Geo
   · resolve(testo)         → {lat,lon,display,source} | null
   · suggest(testo, n)      → [{n,r,full,lat,lon,source}] per l'autocompletamento
   · attribution()          → testo per i crediti
   · atlas.ready()          → carica l'atlante (www/data/cities.json) una volta
══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const KX=window.KX=window.KX||{};
const tr=(s,p)=>{try{return typeof T==='function'?T(s,p):s;}catch(e){return s;}};
const lang=()=>{try{return (L10N.resolvedLang||'en');}catch(e){return 'en';}};

/* ── normalizzazione: minuscole, senza accenti né punteggiatura ─────── */
function norm(s){
  return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/[’'`´]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
}
/* nome del paese nella lingua dell'interfaccia (e in inglese), da codice ISO */
const countryNames=new Map();
function countryName(cc,lg){
  const k=cc+'|'+lg;if(countryNames.has(k))return countryNames.get(k);
  let n=cc;try{n=new Intl.DisplayNames([lg],{type:'region'}).of(cc)||cc;}catch(e){}
  countryNames.set(k,n);return n;
}
/* «Milano, Italia» → {name:'milano', hint:'italia'} */
function splitQuery(text){
  const parts=String(text||'').split(',').map(x=>norm(x)).filter(Boolean);
  return {name:parts[0]||'',hint:parts.slice(1).join(' ')};
}

/* ──────────────────────────────────────────────────────────────────
   1. MEMORIA PERSISTENTE (localStorage 'kx_geo_v1', max 400 voci)
────────────────────────────────────────────────────────────────── */
const Memory={
  KEY:'kx_geo_v1',map:null,
  load(){if(this.map)return this.map;try{this.map=JSON.parse(localStorage.getItem(this.KEY)||'{}')||{};}catch(e){this.map={};}return this.map;},
  get(k){const m=this.load();const v=m[k];if(v&&Number.isFinite(v.lat)&&Number.isFinite(v.lon)){v.t=Date.now();return v;}return null;},
  set(k,geo){
    const m=this.load();m[k]={lat:+geo.lat.toFixed(4),lon:+geo.lon.toFixed(4),display:String(geo.display||'').slice(0,120),t:Date.now()};
    const keys=Object.keys(m);if(keys.length>400){keys.sort((a,b)=>(m[a].t||0)-(m[b].t||0)).slice(0,keys.length-400).forEach(x=>delete m[x]);}
    try{localStorage.setItem(this.KEY,JSON.stringify(m));}catch(e){}
  },
};

/* ──────────────────────────────────────────────────────────────────
   2. ATLANTE OFFLINE (www/data/cities.json, generato da tools/build-atlas.py)
   righe: [nome, paese ISO2, lat, lon, abitanti], già ordinate per abitanti
────────────────────────────────────────────────────────────────── */
/* legge un file dati dell'app: fetch (WebView, browser) con ripiego su
   XMLHttpRequest (pagina aperta da file:// nei collaudi) */
function loadJSON(rel){
  return fetch(rel,{cache:'force-cache'}).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
    .catch(()=>new Promise((res,rej)=>{try{const x=new XMLHttpRequest();x.open('GET',rel);x.onload=()=>{try{res(JSON.parse(x.responseText));}catch(e){rej(e);}};x.onerror=()=>rej(new Error('xhr'));x.send();}catch(e){rej(e);}}));
}
const Atlas={
  rows:null,index:null,keys:null,loading:null,
  ready(){
    if(this.rows)return Promise.resolve(true);
    if(this.loading)return this.loading;
    this.loading=(async()=>{
      try{
        const j=await loadJSON('data/cities.json');
        this.rows=Array.isArray(j.rows)?j.rows:[];
        this.index=new Map();
        this.rows.forEach((row,i)=>{const k=norm(row[0]);if(!k)return;const a=this.index.get(k);if(a)a.push(i);else this.index.set(k,[i]);});
        this.keys=[...this.index.keys()].sort();
        return true;
      }catch(e){console.warn('[luoghi] atlante non disponibile',e&&e.message);this.rows=[];this.index=new Map();this.keys=[];return false;}
    })();
    return this.loading;
  },
  toGeo(i){const r=this.rows[i];return {lat:r[2],lon:r[3],display:r[0]+', '+countryName(r[1],lang()),name:r[0],cc:r[1],pop:r[4],source:'atlas'};},
  /* corrispondenza esatta del nome; il suffisso dopo la virgola sceglie il paese */
  exact(text){
    if(!this.rows)return null;
    const {name,hint}=splitQuery(text);const ids=this.index.get(name);if(!ids)return null;
    let list=ids;
    if(hint){const h=list.filter(i=>{const cc=this.rows[i][1];return norm(cc)===hint||norm(countryName(cc,lang()))===hint||norm(countryName(cc,'en'))===hint;});if(h.length)list=h;}
    return this.toGeo(list[0]);   /* le righe sono ordinate per abitanti: il più grande vince */
  },
  /* città il cui nome inizia con il testo (per l'autocompletamento) */
  prefix(text,n){
    if(!this.rows||!this.keys)return [];
    const {name,hint}=splitQuery(text);if(!name)return [];
    let lo=0,hi=this.keys.length;
    while(lo<hi){const m=(lo+hi)>>1;if(this.keys[m]<name)lo=m+1;else hi=m;}
    const out=[];
    for(let i=lo;i<this.keys.length&&this.keys[i].startsWith(name);i++){
      this.index.get(this.keys[i]).forEach(id=>out.push(id));
      if(out.length>400)break;
    }
    let ids=out;
    if(hint)ids=ids.filter(i=>{const cc=this.rows[i][1];return norm(cc)===hint||norm(countryName(cc,lang())).startsWith(hint)||norm(countryName(cc,'en')).startsWith(hint);});
    ids.sort((a,b)=>this.rows[b][4]-this.rows[a][4]);
    return ids.slice(0,n||6).map(i=>this.toGeo(i));
  },
};

/* ──────────────────────────────────────────────────────────────────
   3. STRATI IN RETE
────────────────────────────────────────────────────────────────── */
const KNc=()=>{try{return typeof KN==='object'?KN:null;}catch(e){return null;}};
function netGet(url,ms){
  const N=KX.Net&&KX.Net.get?KX.Net:null;
  if(N)return N.get(url,ms||8000);
  return fetch(url).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.text();});
}
/* 3a. Geocoder di Android (quando il ponte nativo lo offre) */
async function nativeGeocode(text,n){
  const K=KNc();if(!K||!K.has||!K.has('geocode'))return [];
  try{const j=JSON.parse(await K.call('geocode',text,lang())||'[]');
    return (Array.isArray(j)?j:[]).filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon)).slice(0,n).map(x=>({lat:x.lat,lon:x.lon,display:x.display||x.name||text,name:x.name||text,source:'native'}));
  }catch(e){return [];}
}
/* 3b. chiave personale (inclusa nel fornitore meteo scelto dall'utente) */
async function byokGeocode(text,n){
  const W=KX.Weather;if(!W)return [];
  const src=W.source();
  try{
    if(src==='openmeteo'){
      const key=await W.getKey('openmeteo');if(!key)return [];
      const j=JSON.parse(await netGet(`https://customer-geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(text)}&count=${n}&language=${lang()}&format=json&apikey=${encodeURIComponent(key)}`));
      return (j.results||[]).map(r=>({lat:r.latitude,lon:r.longitude,name:r.name,display:[r.name,r.admin1,r.country].filter(Boolean).join(', '),source:'openmeteo'}));
    }
    if(src==='owm'){
      const key=await W.getKey('owm');if(!key)return [];
      const j=JSON.parse(await netGet(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(text)}&limit=${n}&appid=${encodeURIComponent(key)}`));
      return (Array.isArray(j)?j:[]).map(r=>{const ln=(r.local_names&&r.local_names[lang()])||r.name;return {lat:r.lat,lon:r.lon,name:ln,display:[ln,r.state,countryName(r.country||'',lang())].filter(Boolean).join(', '),source:'owm'};});
    }
  }catch(e){console.warn('[luoghi] chiave personale',e&&e.message);}
  return [];
}
/* 3c. Photon (komoot) su dati OpenStreetMap — anche indirizzi */
const PHOTON_LANGS=['en','de','fr','it'];
async function photonGeocode(text,n){
  try{
    const lg=PHOTON_LANGS.includes(lang())?lang():'en';
    const j=JSON.parse(await netGet(`https://photon.komoot.io/api/?q=${encodeURIComponent(text)}&limit=${n}&lang=${lg}`,8000));
    return (j.features||[]).filter(f=>f.geometry&&Array.isArray(f.geometry.coordinates)).map(f=>{
      const p=f.properties||{};const nm=p.name||[p.street,p.housenumber].filter(Boolean).join(' ')||text;
      const parts=[nm,p.city&&p.city!==nm?p.city:'',p.state||'',p.country||''].filter(Boolean);
      return {lat:f.geometry.coordinates[1],lon:f.geometry.coordinates[0],name:nm,display:parts.join(', '),source:'photon'};
    });
  }catch(e){console.warn('[luoghi] photon',e&&e.message);return [];}
}

/* ──────────────────────────────────────────────────────────────────
   4. API
────────────────────────────────────────────────────────────────── */
const pending=new Map();
function parseCoords(text){try{if(typeof WX==='object'&&WX.parseCoords){const c=WX.parseCoords(text);return c?Object.assign({source:'coords'},c):null;}}catch(e){}
  const m=String(text||'').trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if(!m)return null;const lat=+m[1],lon=+m[2];if(Math.abs(lat)>90||Math.abs(lon)>180)return null;return {lat,lon,display:lat.toFixed(4)+', '+lon.toFixed(4),source:'coords'};}

async function resolve(text){
  const raw=String(text||'').trim();if(!raw)return null;
  const c=parseCoords(raw);if(c)return c;
  const k=norm(raw);if(!k)return null;
  const mem=Memory.get(k);if(mem)return Object.assign({source:'memory'},mem);
  if(pending.has(k))return pending.get(k);
  const p=(async()=>{
    await Atlas.ready();
    let g=Atlas.exact(raw);
    if(!g)g=(await nativeGeocode(raw,1))[0]||null;
    if(!g)g=(await byokGeocode(raw,1))[0]||null;
    if(!g)g=(await photonGeocode(raw,1))[0]||null;
    if(g){Memory.set(k,g);}
    return g;
  })().finally(()=>pending.delete(k));
  pending.set(k,p);return p;
}
/* suggerimenti per l'autocompletamento: atlante subito; rete solo se
   l'atlante dà poco e il testo è abbastanza lungo (≥ 4 lettere) */
async function suggest(text,n){
  n=n||6;const raw=String(text||'').trim();if(raw.length<2)return [];
  await Atlas.ready();
  let out=Atlas.prefix(raw,n);
  if(out.length<2&&raw.length>=4){
    const more=(await nativeGeocode(raw,n)).concat(out.length+0<2?await byokGeocode(raw,n):[]);
    let extra=more.length?more:await photonGeocode(raw,n);
    extra.forEach(g=>{if(!out.some(o=>norm(o.display)===norm(g.display)))out.push(g);});
  }
  return out.slice(0,n).map(g=>({n:g.name||g.display.split(',')[0],r:g.display.split(',').slice(1).join(',').trim(),full:g.display,lat:g.lat,lon:g.lon,source:g.source}));
}
function attribution(){return 'Città: GeoNames (CC BY 4.0) · indirizzi: Photon (komoot), © OpenStreetMap contributors (ODbL)';}

KX.Geo={resolve,suggest,attribution,atlas:Atlas,memory:Memory,norm,_net:{nativeGeocode,byokGeocode,photonGeocode}};

/* crediti: la riga della geocodifica */
function refreshCredits(){
  try{const cr=document.getElementById('kx-credits');if(!cr)return;
    const line=[...cr.querySelectorAll('div')].find(d=>/^Geocodifica:/.test(d.textContent.trim()));
    if(line)line.textContent=tr('Luoghi: {s}',{s:attribution()});}catch(e){}
}
if(document.readyState==='complete')setTimeout(refreshCredits,300);else addEventListener('load',()=>setTimeout(refreshCredits,300));
/* l'atlante si carica alla prima ricerca; in attesa, un precarico leggero dopo l'avvio */
setTimeout(()=>{try{if(navigator.connection&&navigator.connection.saveData)return;}catch(e){}Atlas.ready();},6000);
})();
