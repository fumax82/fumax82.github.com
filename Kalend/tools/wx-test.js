#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   COLLAUDO DEL MODULO METEO (src/modules/70-weather.js)
   Apre la pagina costruita in Chromium headless con un ponte nativo
   finto che risponde alle richieste HTTP con RISPOSTE SIMULATE dei
   tre fornitori (MET Norway, Open-Meteo, OpenWeatherMap), costruite
   secondo i loro formati pubblici. Verifica:
   · forma dei dati (ore, giorni, adesso) uguale per ogni fornitore;
   · cache: la seconda richiesta non va in rete;
   · chiave rifiutata (401) → ritorno automatico alla base;
   · chiavi in cassaforte: mai in localStorage;
   · unità °C/°F per paese; orizzonte dei giorni; crediti; scheda impostazioni.
   Uso: node Kalend/tools/wx-test.js
   NOTA: non sostituisce una prova con i server veri (la rete di
   collaudo non li raggiunge): al primo avvio sul telefono controllare
   che MET Norway risponda (la scheda meteo mostra la fonte).
══════════════════════════════════════════════════════════════════ */
const path=require('path');
const {chromium}=require('playwright');
const PAGE='file://'+path.join(__dirname,'..','www','index.html');

/* ── risposte simulate, costruite nella pagina (dipendono da "adesso") ── */
const FIXTURES=String.raw`
window.__http=[];
function __hourUTC(off){const d=new Date();d.setUTCMinutes(0,0,0);d.setUTCHours(d.getUTCHours()+off);return d;}
function __metFixture(){
  const ts=[];const syms=['clearsky_day','partlycloudy_day','cloudy','rain','lightrain','heavyrainshowers_day','snow','fog','rainandthunder'];
  for(let h=0;h<48;h++){const t=__hourUTC(h);const sym=syms[h%syms.length];
    ts.push({time:t.toISOString().replace('.000Z','Z'),data:{instant:{details:{air_temperature:10+Math.sin(h/4)*5,cloud_area_fraction:50,wind_speed:3.2,relative_humidity:70}},
      next_1_hours:{summary:{symbol_code:sym},details:{precipitation_amount:/rain/.test(sym)?1.2:0,probability_of_precipitation:/rain/.test(sym)?80:5}},
      next_6_hours:{summary:{symbol_code:sym},details:{precipitation_amount:/rain/.test(sym)?4:0,air_temperature_max:16,air_temperature_min:8}}}});}
  for(let h=48;h<=240;h+=6){const t=__hourUTC(h);const sym=syms[(h/6)%syms.length];
    ts.push({time:t.toISOString().replace('.000Z','Z'),data:{instant:{details:{air_temperature:12,cloud_area_fraction:30,wind_speed:2}},
      next_6_hours:{summary:{symbol_code:sym},details:{precipitation_amount:/rain/.test(sym)?3:0,air_temperature_max:17,air_temperature_min:7}}}});}
  return JSON.stringify({type:'Feature',properties:{meta:{units:{air_temperature:'celsius'}},timeseries:ts}});
}
function __omFixture(){
  const H={time:[],weather_code:[],temperature_2m:[],precipitation_probability:[],precipitation:[],cloud_cover:[],wind_speed_10m:[]};
  const D={time:[],weather_code:[],temperature_2m_max:[],temperature_2m_min:[],precipitation_probability_max:[],sunrise:[],sunset:[]};
  const d0=new Date();d0.setHours(0,0,0,0);
  for(let day=0;day<16;day++){const d=new Date(d0.getTime()+day*86400000);const k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    D.time.push(k);D.weather_code.push(day%3===0?61:2);D.temperature_2m_max.push(18);D.temperature_2m_min.push(9);D.precipitation_probability_max.push(40);D.sunrise.push(k+'T06:45');D.sunset.push(k+'T18:20');
    for(let h=0;h<24;h++){H.time.push(k+'T'+String(h).padStart(2,'0')+':00');H.weather_code.push(h>12?3:0);H.temperature_2m.push(9+h*0.4);H.precipitation_probability.push(10);H.precipitation.push(0);H.cloud_cover.push(20);H.wind_speed_10m.push(9);}}
  return JSON.stringify({utc_offset_seconds:3600,current:{weather_code:1,temperature_2m:14.2,cloud_cover:25,is_day:1},hourly:H,daily:D});
}
function __owmFixture(kind){
  if(kind==='weather')return JSON.stringify({cod:200,dt:Math.floor(Date.now()/1000),timezone:3600,weather:[{id:800}],main:{temp:15.5},clouds:{all:10},sys:{sunrise:Math.floor(Date.now()/1000)-3600*5,sunset:Math.floor(Date.now()/1000)+3600*5}});
  const list=[];for(let i=0;i<40;i++){const t=__hourUTC(i*3);list.push({dt:Math.floor(t.getTime()/1000),main:{temp:11+i*0.1},weather:[{id:i%4===0?500:800}],clouds:{all:30},wind:{speed:4},pop:i%4===0?0.7:0.1,rain:i%4===0?{'3h':2.1}:undefined});}
  return JSON.stringify({cod:'200',city:{timezone:3600},list});
}
window.__wxFixture=function(url){
  window.__http.push(url);
  const u=new URL(url);
  if(u.host==='api.met.no'&&u.pathname==='/weatherapi/locationforecast/2.0/complete'&&/^\d+\.\d{4}$/.test(u.searchParams.get('lat')||'')&&/^-?\d+\.\d{4}$/.test(u.searchParams.get('lon')||''))return {body:__metFixture()};
  if(u.host==='customer-api.open-meteo.com')return u.searchParams.get('apikey')==='buona'?{body:__omFixture()}:{error:'HTTP 401'};
  if(u.host==='api.openweathermap.org'&&u.pathname==='/data/2.5/forecast')return u.searchParams.get('appid')==='ok-123'?{body:__owmFixture('forecast')}:{error:'HTTP 401'};
  if(u.host==='api.openweathermap.org'&&u.pathname==='/data/2.5/weather')return {body:__owmFixture('weather')};
  return {error:'HTTP 404 '+url};
};
window.KalendNative={
  httpGet:(id,url)=>{setTimeout(()=>{const r=window.__wxFixture(url);if(r.error)window.__knCb(id,false,r.error);else window.__knCb(id,true,r.body);},5);},
  updateWidget:()=>{},setReminders:()=>{},vibrate:()=>{},setBarColor:()=>{},setSecure:()=>{},openSettings:()=>{},testReminder:()=>{},reliability:()=>'{}',vaultDel:()=>{},takeListQueue:()=>'[]',speechStop:()=>{},speechCancel:()=>{},snoozeAlert:()=>{},
};
try{localStorage.setItem('cal_onboard_v1','1');localStorage.setItem('kx_qs_v1','1');}catch(e){}
`;

let fails=0;
function check(name,ok,info){console.log((ok?'  ✔ ':'  ✘ ')+name+(ok?'':'   → '+info));if(!ok)fails++;}

(async()=>{
  const browser=await chromium.launch();
  const page=await (await browser.newContext({viewport:{width:412,height:915},locale:'it'})).newPage();
  const errors=[];page.on('pageerror',e=>errors.push(String(e.message||e)));
  await page.addInitScript(FIXTURES);
  await page.goto(PAGE);await page.waitForTimeout(2500);
  const key=(()=>{const d=new Date();return o=>{const x=new Date(d.getTime()+o*86400000);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');};})();

  console.log('1. MET Norway (base, senza chiave)');
  let r=await page.evaluate(async k=>{
    const W=KX.Weather;const out={src:W.source(),label:W.label(),attr:W.attribution(),hz:W.horizonDays()};
    const h=await W.hourly(45.4642,9.19,k.today);out.hours=h?h.length:0;out.first=h&&h[0];out.sun=h&&h.sun;
    out.day=await W.day(45.4642,9.19,k.tomorrow);out.now=await W.now(45.4642,9.19);
    out.http=window.__http.filter(u=>/met\.no/.test(u)).length;
    const h2=await W.hourly(45.4642,9.19,k.plus3);out.hours3=h2?h2.length:0;out.http2=window.__http.filter(u=>/met\.no/.test(u)).length;
    out.far=await W.hourly(45.4642,9.19,k.plus12);
    out.fc=[WX.isForecastable(k.today),WX.isForecastable(k.plus9),WX.isForecastable(k.plus12)];
    return out;},{today:key(0),tomorrow:key(1),plus3:key(3),plus9:key(9),plus12:key(12)});
  check('fonte predefinita = met / MET Norway',r.src==='met'&&r.label==='MET Norway',JSON.stringify(r));
  check('attribuzione CC BY presente',/MET Norway/.test(r.attr),r.attr);
  check('ore di oggi (≥ 1) con stato, temperatura, probabilità pioggia',r.hours>=1&&r.first&&typeof r.first.state==='string'&&r.first.temp!=null&&r.first.precipitationProbability!=null,JSON.stringify(r.first));
  check('giorno +1: codice WMO, max/min, pioggia',r.day&&r.day.code!=null&&r.day.max!=null&&r.day.min!=null,JSON.stringify(r.day));
  check('adesso: code/temp/cloud + daily (≥ 8 giorni)',r.now&&r.now.temp!=null&&Array.isArray(r.now.daily)&&r.now.daily.length>=8,JSON.stringify(r.now&&r.now.daily&&r.now.daily.length));
  check('una sola richiesta HTTP per luogo (cache)',r.http===1&&r.http2===1,'http='+r.http+'/'+r.http2);
  check('giorno +3 (dati ogni 6 ore) ha 24 ore',r.hours3===24,'ore='+r.hours3);
  check('giorno +12 fuori orizzonte → null',r.far===null,String(r.far));
  check('isForecastable: oggi e +9 sì, +12 no (orizzonte MET 10)',r.fc[0]&&r.fc[1]&&!r.fc[2],JSON.stringify(r.fc));

  console.log('2. Codici e fusi');
  r=await page.evaluate(()=>{const c=KX.Weather._codes,t=KX.Weather._tz;return {
    met:[c.metCode('clearsky_night'),c.metCode('partlycloudy_day'),c.metCode('heavyrainshowers_day'),c.metCode('lightsnow'),c.metCode('rainandthunder'),c.metCode('fog'),c.metCode('sleet')],
    owm:[c.owmCode(800),c.owmCode(802),c.owmCode(500),c.owmCode(600),c.owmCode(211),c.owmCode(741)],
    tz:[t.tzOffsetFor(139.7),t.tzOffsetFor(-74),t.tzOffsetFor(9.19)]};});
  check('MET: clearsky→0, partly→2, rovescio forte→82, neve leggera→71, temporale→95, nebbia→45, nevischio→66',JSON.stringify(r.met)==='[0,2,82,71,95,45,66]',JSON.stringify(r.met));
  check('OWM: 800→0, 802→2, 500→61, 600→71, 211→95, 741→45',JSON.stringify(r.owm)==='[0,2,61,71,95,45]',JSON.stringify(r.owm));
  check('fuso: Tokyo +540, New York −300 (solare), Milano = fuso del dispositivo',r.tz[0]===540&&r.tz[1]===-300&&r.tz[2]===-new Date().getTimezoneOffset(),JSON.stringify(r.tz));

  console.log('3. OpenWeatherMap con chiave personale');
  r=await page.evaluate(async k=>{
    const W=KX.Weather;await W.setKey('owm','ok-123');await W.setSource('owm');
    const n0=window.__http.length;const h=await W.hourly(45.4642,9.19,k.today);const d=await W.day(45.4642,9.19,k.tomorrow);const now=await W.now(45.4642,9.19);
    const ls=JSON.stringify(Object.entries(localStorage));
    return {label:W.label(),hours:h?h.length:0,day:d,now:now&&now.temp,reqs:window.__http.slice(n0).map(u=>u.replace(/appid=[^&]+/,'appid=…')),keyInLS:ls.includes('ok-123'),keyBack:await W.getKey('owm')};},{today:key(0),tomorrow:key(1)});
  check('fonte = OpenWeatherMap',r.label==='OpenWeatherMap',r.label);
  check('ore (passi di 3 h riempiti) e giorno +1',r.hours>=3&&r.day&&r.day.code!=null,JSON.stringify([r.hours,r.day]));
  check('adesso dal secondo endpoint',r.now===15.5,String(r.now));
  check('chiave custodita (ritorna) ma MAI in localStorage',r.keyBack==='ok-123'&&!r.keyInLS,JSON.stringify([r.keyBack,r.keyInLS]));
  check('richieste: forecast + weather con la chiave',r.reqs.length===2&&r.reqs.every(u=>/openweathermap/.test(u)),JSON.stringify(r.reqs));

  console.log('4. Open-Meteo con chiave buona, poi chiave rifiutata → base');
  r=await page.evaluate(async k=>{
    const W=KX.Weather;await W.setKey('openmeteo','buona');await W.setSource('openmeteo');
    const h=await W.hourly(45.4642,9.19,k.plus14);const ok={label:W.label(),hz:W.horizonDays(),hours14:h?h.length:0,sun:h&&h.sun};
    await W.setKey('openmeteo','cattiva');const n0=window.__http.length;
    const h2=await W.hourly(48.8566,2.3522,k.today);
    return {ok,after:{label:W.label(),hours:h2?h2.length:0,reqs:window.__http.slice(n0).map(u=>u.split('?')[0])}};},{today:key(0),plus14:key(14)});
  check('Open-Meteo: orizzonte 16, giorno +14 con 24 ore e alba/tramonto',r.ok.label==='Open-Meteo'&&r.ok.hz===16&&r.ok.hours14===24&&r.ok.sun&&r.ok.sun.sunrise===405,JSON.stringify(r.ok));
  check('chiave rifiutata → la sessione passa a MET Norway e il meteo c\'è',r.after.label==='MET Norway'&&r.after.hours>=1,JSON.stringify(r.after));
  check('sequenza richieste: open-meteo (401) poi met.no',r.after.reqs.length===2&&/open-meteo/.test(r.after.reqs[0])&&/met\.no/.test(r.after.reqs[1]),JSON.stringify(r.after.reqs));

  console.log('5. Unità, crediti, impostazioni, nessun meteo');
  r=await page.evaluate(async()=>{
    const W=KX.Weather;const out={};
    AppSettings.country='IT';AppSettings.tempUnit='auto';out.it=W.fmtTemp(21.4);
    AppSettings.country='US';out.us=W.fmtTemp(21.4);AppSettings.tempUnit='C';out.usC=W.fmtTemp(21.4);AppSettings.tempUnit='auto';AppSettings.country='IT';
    out.fmtT=W.fmtTemp(10);
    out.credit=(document.querySelector('#kx-credits [data-kx-wx-credit]')||{}).textContent;
    const card=document.getElementById('kx-wx-card');out.card=!!card;out.radios=card?card.querySelectorAll('input[name="kx-wx-src"]').length:0;out.keys=card?card.querySelectorAll('input[data-key]').length:0;
    await W.setSource('none');out.none=await W.hourly(45.4642,9.19,new Date().toISOString().slice(0,10));out.noneLabel=W.label();out.noneCredit=(document.querySelector('#kx-credits [data-kx-wx-credit]')||{}).textContent;
    await W.setSource('met');
    out.settingsHasKey=JSON.stringify(localStorage.getItem('cal_settings')||'').includes('openMeteoKey');
    return out;});
  check('°C in Italia, °F negli USA, °C forzato',r.it==='21°'&&r.us==='71°F'&&r.usC==='21°',JSON.stringify([r.it,r.us,r.usC]));
  check('fmtTemp arrotonda',r.fmtT==='10°',String(r.fmtT));
  check('crediti: riga meteo con MET Norway',/MET Norway/.test(r.credit||''),r.credit);
  check('scheda impostazioni: 4 fonti, 2 campi chiave',r.card&&r.radios===4&&r.keys===2,JSON.stringify([r.card,r.radios,r.keys]));
  check('«Nessun meteo»: niente dati, crediti aggiornati',r.none===null&&r.noneLabel==='Nessun meteo'&&/nessuno/.test(r.noneCredit||''),JSON.stringify([r.none,r.noneLabel,r.noneCredit]));
  check('nessuna chiave nelle impostazioni (localStorage)',!r.settingsHasKey,'');

  console.log('6. Migrazione dalla v54 (chiave nelle impostazioni → cassaforte)');
  await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('cal_settings')||'{}');s.openMeteoKey='vecchia-chiave';delete s.wxSource;localStorage.setItem('cal_settings',JSON.stringify(s));});
  await page.reload();await page.waitForTimeout(2600);
  r=await page.evaluate(async()=>({src:KX.Weather.source(),key:await KX.Weather.getKey('openmeteo'),inLS:(localStorage.getItem('cal_settings')||'').includes('vecchia-chiave')}));
  check('chiave spostata in cassaforte, fonte = openmeteo, impostazioni pulite',r.src==='openmeteo'&&r.key==='vecchia-chiave'&&!r.inLS,JSON.stringify(r));

  check('nessun errore JS',errors.length===0,errors.join(' | '));
  await browser.close();
  console.log(fails?`\n${fails} controlli FALLITI`:'\nTUTTO OK');
  process.exit(fails?1:0);
})();
