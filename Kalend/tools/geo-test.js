#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   COLLAUDO DELLA GEOCODIFICA A STRATI (src/modules/80-geo.js)
   Apre la pagina costruita in Chromium headless (con accesso ai file
   locali, per leggere www/data/cities.json) e un ponte nativo finto che
   risponde con RISPOSTE SIMULATE di Photon e della geocodifica OpenWeatherMap.
   Verifica: atlante offline (nomi, accenti, paese dopo la virgola, omonimi
   per abitanti, prefissi), memoria persistente, ricaduta su Photon per gli
   indirizzi, chiave personale prima di Photon, coordinate scritte,
   agganci del sorgente storico (WX.geocode, autocompletamento), crediti.
   Uso: node Kalend/tools/geo-test.js
══════════════════════════════════════════════════════════════════ */
const path=require('path');
const {chromium}=require('playwright');
const PAGE='file://'+path.join(__dirname,'..','www','index.html');
const STUB=String.raw`
window.__http=[];
function __answer(url){
  window.__http.push(url);
  const u=new URL(url);
  if(u.host==='photon.komoot.io'){const q=u.searchParams.get('q')||'';
    if(/nessunposto/i.test(q))return {body:JSON.stringify({features:[]})};
    return {body:JSON.stringify({features:[{geometry:{coordinates:[7.6869,45.0703]},properties:{name:'Via Roma 5',street:'Via Roma',housenumber:'5',city:'Torino',state:'Piemonte',country:'Italia'}}]})};}
  if(u.host==='api.openweathermap.org'&&u.pathname==='/geo/1.0/direct'){const q=u.searchParams.get('q')||'';
    if(u.searchParams.get('appid')!=='ok-123')return {error:'HTTP 401'};
    return {body:JSON.stringify([{name:q,local_names:{it:q+' (it)'},lat:50.1,lon:8.6,country:'DE',state:'Hessen'}])};}
  return {error:'HTTP 404 '+url};
}
window.KalendNative={
  httpGet:(id,url)=>{setTimeout(()=>{const r=__answer(url);if(r.error)window.__knCb(id,false,r.error);else window.__knCb(id,true,r.body);},5);},
  updateWidget:()=>{},setReminders:()=>{},vibrate:()=>{},setBarColor:()=>{},setSecure:()=>{},openSettings:()=>{},testReminder:()=>{},reliability:()=>'{}',vaultDel:()=>{},takeListQueue:()=>'[]',speechStop:()=>{},speechCancel:()=>{},snoozeAlert:()=>{},
};
try{localStorage.setItem('cal_onboard_v1','1');localStorage.setItem('kx_qs_v1','1');}catch(e){}
`;
let fails=0;
const check=(name,ok,info)=>{console.log((ok?'  ✔ ':'  ✘ ')+name+(ok?'':'   → '+info));if(!ok)fails++;};
const near=(a,b,eps)=>Math.abs(a-b)<=(eps||0.01);

(async()=>{
  const browser=await chromium.launch({args:['--allow-file-access-from-files']});
  const page=await (await browser.newContext({viewport:{width:412,height:915},locale:'it'})).newPage();
  const errors=[];page.on('pageerror',e=>errors.push(String(e.message||e)));
  await page.addInitScript(STUB);
  await page.goto(PAGE);await page.waitForTimeout(2500);

  console.log('1. Atlante offline');
  let r=await page.evaluate(async()=>{
    const G=KX.Geo;const ok=await G.atlas.ready();const n0=window.__http.length;
    const out={ok,rows:G.atlas.rows.length};
    out.milan=await G.resolve('Milan');out.milano=await G.resolve('MILÁN');out.parisFr=await G.resolve('Paris, Francia');out.parisUs=await G.resolve('Paris, US');
    out.paris=await G.resolve('paris');out.spring=await G.resolve('Springfield, Stati Uniti');out.tokyo=await G.resolve('Tokyo, JP');
    out.sug=await G.suggest('tok',5);out.sugSan=await G.suggest('san',5);out.sugHint=await G.suggest('san, it',5);
    out.http=window.__http.length-n0;return out;});
  check('atlante caricato (≥ 20.000 città)',r.ok&&r.rows>=20000,JSON.stringify([r.ok,r.rows]));
  check('«Milan» → Milano (45.46, 9.19), fonte atlante',r.milan&&near(r.milan.lat,45.464)&&near(r.milan.lon,9.19)&&r.milan.source==='atlas',JSON.stringify(r.milan));
  check('«MILÁN» (accento, maiuscole) → stesso risultato',r.milano&&near(r.milano.lat,45.464),JSON.stringify(r.milano));
  check('«Paris, Francia» → Francia; «Paris, US» → Texas',r.parisFr&&r.parisFr.cc==='FR'&&r.parisUs&&r.parisUs.cc==='US',JSON.stringify([r.parisFr,r.parisUs]));
  check('«paris» senza paese → la più grande (Francia)',r.paris&&r.paris.cc==='FR',JSON.stringify(r.paris));
  check('«Springfield, Stati Uniti» → quella con più abitanti (Missouri)',r.spring&&near(r.spring.lat,37.215),JSON.stringify(r.spring));
  check('«Tokyo, JP» con etichetta nel paese tradotto',r.tokyo&&/Giappone/.test(r.tokyo.display),JSON.stringify(r.tokyo));
  check('suggerimenti «tok»: Tokyo per primo',r.sug.length>=1&&r.sug[0].n==='Tokyo',JSON.stringify(r.sug.slice(0,2)));
  check('suggerimenti «san»: ordinati per abitanti, «san, it» solo Italia',r.sugSan.length===5&&r.sugHint.every(x=>/Italia/.test(x.full)),JSON.stringify([r.sugSan.map(x=>x.n),r.sugHint.map(x=>x.full)]));
  check('nessuna richiesta di rete per l\'atlante',r.http===0,'http='+r.http);

  console.log('2. Rete: Photon per gli indirizzi, memoria dopo');
  r=await page.evaluate(async()=>{
    const G=KX.Geo;const n0=window.__http.length;
    const a=await G.resolve('Via Roma 5, Torino');const n1=window.__http.length;
    const b=await G.resolve('via roma 5, torino');const n2=window.__http.length;
    const none=await G.resolve('NessunPosto Xyz');
    const ls=localStorage.getItem('kx_geo_v1')||'';
    return {a,b,none,reqs:window.__http.slice(n0).map(u=>u.split('?')[0]),n1:n1-n0,n2:n2-n1,inLS:ls.includes('via roma 5 torino')};});
  check('indirizzo → Photon (45.07, 7.69)',r.a&&near(r.a.lat,45.0703)&&r.a.source==='photon',JSON.stringify(r.a));
  check('stesso indirizzo → dalla memoria, senza rete',r.b&&r.b.source==='memory'&&r.n2===0,JSON.stringify([r.b&&r.b.source,r.n2]));
  check('memoria persistente in localStorage',r.inLS,'');
  check('luogo inesistente → null (una sola richiesta)',r.none===null&&r.n1===1,JSON.stringify([r.none,r.n1]));

  console.log('3. Chiave personale (OpenWeatherMap) prima di Photon');
  r=await page.evaluate(async()=>{
    await KX.Weather.setKey('owm','ok-123');await KX.Weather.setSource('owm');
    const n0=window.__http.length;const g=await KX.Geo.resolve('Posto Strano 77');
    const reqs=window.__http.slice(n0).map(u=>u.split('?')[0]);
    await KX.Weather.setSource('met');
    return {g,reqs};});
  check('risolto dalla geocodifica OWM con nome locale',r.g&&r.g.source==='owm'&&near(r.g.lat,50.1)&&/\(it\)/.test(r.g.display),JSON.stringify(r.g));
  check('richiesta solo a OWM, Photon non interpellato',r.reqs.length===1&&/openweathermap/.test(r.reqs[0]),JSON.stringify(r.reqs));

  console.log('4. Coordinate e agganci del sorgente storico');
  r=await page.evaluate(async()=>{
    const out={};out.coords=await KX.Geo.resolve('45.5, 9.2');
    out.wx=await WX.geocode('Milan');out.wxNone=await WX.geocode('NessunPosto Qwe');
    out.ac=await searchNominatim('mil');
    out.credit=[...document.querySelectorAll('#kx-credits div')].map(d=>d.textContent).find(t=>/Luoghi|Geocodifica/.test(t));
    return out;});
  check('coordinate scritte → senza rete',r.coords&&near(r.coords.lat,45.5)&&r.coords.source==='coords',JSON.stringify(r.coords));
  check('WX.geocode passa dal modulo',r.wx&&near(r.wx.lat,45.464)&&r.wxNone===null,JSON.stringify([r.wx,r.wxNone]));
  check('autocompletamento: risultati {n,r,full} con Milano',Array.isArray(r.ac)&&r.ac.length>0&&r.ac.some(x=>x.n==='Milan')&&'r' in r.ac[0],JSON.stringify(r.ac&&r.ac.slice(0,2)));
  check('crediti: GeoNames e OpenStreetMap',/GeoNames/.test(r.credit||'')&&/OpenStreetMap/.test(r.credit||''),r.credit);
  check('nessuna richiesta a Nominatim o Open-Meteo gratuito',!(await page.evaluate(()=>window.__http.some(u=>/nominatim|geocoding-api\.open-meteo|api\.open-meteo/.test(u)))),'');
  check('nessun errore JS',errors.length===0,errors.join(' | '));
  await browser.close();
  console.log(fails?`\n${fails} controlli FALLITI`:'\nTUTTO OK');process.exit(fails?1:0);
})();
