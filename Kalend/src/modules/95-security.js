/* ══════════════════════════════════════════════════════════════════
   MODULO v55 — "Sicurezza" · backup cifrati e impostazioni verificate
   ------------------------------------------------------------------
   1. BACKUP CIFRATO CON PASSWORD
      All'esportazione l'app propone una password. Con la password il
      file è cifrato con AES-256-GCM e una chiave ricavata dalla
      password con PBKDF2-SHA256 (600.000 iterazioni): senza password
      il contenuto è illeggibile. Senza password il file è in chiaro,
      ma SENZA la posizione di casa, la località predefinita e le chiavi
      personali (che comunque non stanno nel backup).
      Formato cifrato: {"app":"lavagna-cal-enc","v":1,"kdf":"PBKDF2-SHA256",
        "iter":600000,"salt":base64,"iv":base64,"data":base64}
      L'import riconosce il formato, chiede la password e decifra; i
      backup vecchi in chiaro restano leggibili.
   2. LISTA BIANCA DELLE IMPOSTAZIONI AL RIPRISTINO
      Un backup confezionato ad arte non può più cambiare impostazioni
      sconosciute o con valori assurdi: ogni chiave nota ha un tipo e un
      intervallo ammessi; il resto viene scartato.
   Agganci nel sorgente storico: set-export → KX.Secure.exportBackup,
   hookImport → KX.Secure.decryptBackup, writeBackup → KX.Secure.cleanSettings.
══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const KX=window.KX=window.KX||{};
const tr=(s,p)=>{try{return typeof T==='function'?T(s,p):s;}catch(e){return s;}};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ITER=600000;
const b64=u8=>btoa(String.fromCharCode(...u8));
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));

/* ──────────────────────────────────────────────────────────────────
   1. CIFRATURA
────────────────────────────────────────────────────────────────── */
async function deriveKey(password,salt,iter){
  const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:iter},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function encryptBackup(obj,password){
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await deriveKey(password,salt,ITER);
  const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(obj)));
  return {app:'lavagna-cal-enc',v:1,kdf:'PBKDF2-SHA256',iter:ITER,salt:b64(salt),iv:b64(iv),data:b64(new Uint8Array(ct)),exported:new Date().toISOString()};
}
async function decryptWith(env,password){
  if(!env||env.app!=='lavagna-cal-enc'||env.kdf!=='PBKDF2-SHA256')throw new Error('format');
  const iter=Math.min(5e6,Math.max(1e4,parseInt(env.iter,10)||ITER));
  const key=await deriveKey(password,unb64(env.salt),iter);
  const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(env.iv)},key,unb64(env.data));
  return JSON.parse(new TextDecoder().decode(pt));
}
/* chiede la password e decifra; null se l'utente annulla */
async function decryptBackup(env){
  for(let tries=0;tries<3;tries++){
    const pw=await askPassword({title:tr('Backup cifrato: inserisci la password'),confirm:false});
    if(pw==null)return null;
    try{return await decryptWith(env,pw);}
    catch(e){try{toast('⚠️ '+tr('Password errata o file danneggiato'));}catch(x){}}
  }
  return null;
}
/* copia del backup senza i dati privati (per l'export in chiaro) */
function stripPrivate(backup){
  const b=JSON.parse(JSON.stringify(backup));
  if(b.settings&&typeof b.settings==='object'){delete b.settings.homeGeo;delete b.settings.defaultLocation;delete b.settings.openMeteoKey;}
  return b;
}
async function exportBackup(backup,deliver){
  const choice=await askPassword({title:tr('Proteggere il backup con una password?'),confirm:true,allowPlain:true});
  if(choice==null)return;
  const day=new Date().toISOString().slice(0,10);
  if(choice===''){
    deliver(JSON.stringify(stripPrivate(backup),null,2),`calendario_backup_${day}.json`,'application/json',tr('📦 Backup esportato (senza posizione e chiavi)'));
    return;
  }
  try{
    const env=await encryptBackup(backup,choice);
    deliver(JSON.stringify(env),`calendario_backup_${day}.kalend.json`,'application/json',tr('📦 Backup cifrato esportato'));
  }catch(e){try{toast('⚠️ '+String(e&&e.message||e));}catch(x){}}
}

/* ──────────────────────────────────────────────────────────────────
   2. FINESTRA PASSWORD
   risolve: stringa (password), '' (senza password, se ammesso), null (annulla)
────────────────────────────────────────────────────────────────── */
function askPassword(o){
  return new Promise(res=>{
    const ov=document.createElement('div');ov.className='kx-pw';ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');
    ov.innerHTML=`<div class="kx-pw-card"><b>${esc(o.title)}</b>
      <input type="password" class="form-input" id="kx-pw-1" autocomplete="new-password" placeholder="${esc(tr('Password'))}">
      ${o.confirm?`<input type="password" class="form-input" id="kx-pw-2" autocomplete="new-password" placeholder="${esc(tr('Ripeti la password'))}">`:''}
      <label class="kx-pw-show"><input type="checkbox" id="kx-pw-eye"> ${esc(tr('Mostra'))}</label>
      ${o.allowPlain?`<p class="kx-pw-note">${esc(tr('Senza password il file non conterrà la posizione di casa, la località predefinita né le chiavi personali.'))}</p>`:''}
      <div class="kx-pw-b">${o.allowPlain?`<button type="button" class="kx-pw-plain">${esc(tr('Esporta senza password'))}</button>`:''}<button type="button" class="kx-pw-cancel">${esc(tr('Annulla'))}</button><button type="button" class="kx-pw-ok">${esc(o.confirm?tr('Esporta cifrato'):tr('Apri'))}</button></div>
      <div class="kx-pw-err" hidden></div></div>`;
    document.body.appendChild(ov);
    const $=sel=>ov.querySelector(sel);const err=m=>{const e=$('.kx-pw-err');e.hidden=!m;e.textContent=m||'';};
    const done=v=>{ov.remove();res(v);};
    $('#kx-pw-eye').onchange=e=>ov.querySelectorAll('input[type=password],input[type=text].form-input').forEach(i=>{if(i.id!=='kx-pw-eye')i.type=e.target.checked?'text':'password';});
    $('.kx-pw-cancel').onclick=()=>done(null);
    if(o.allowPlain)$('.kx-pw-plain').onclick=()=>done('');
    $('.kx-pw-ok').onclick=()=>{
      const p1=$('#kx-pw-1').value;
      if(o.confirm){if(p1.length<8)return err(tr('Almeno 8 caratteri'));if(p1!==$('#kx-pw-2').value)return err(tr('Le password non coincidono'));}
      else if(!p1)return err(tr('Password'));
      done(p1);
    };
    ov.addEventListener('keydown',e=>{if(e.key==='Enter')$('.kx-pw-ok').click();if(e.key==='Escape')done(null);});
    setTimeout(()=>$('#kx-pw-1').focus(),50);
  });
}

/* ──────────────────────────────────────────────────────────────────
   3. LISTA BIANCA DELLE IMPOSTAZIONI
   Ogni chiave nota ha una regola: la funzione riceve il valore e
   restituisce quello accettato (eventualmente ripulito) o undefined.
────────────────────────────────────────────────────────────────── */
const CLEAN=s=>String(s).replace(/[\u0000-\u001F\u007F]/g,'').trim();
const str=max=>v=>typeof v==='string'?CLEAN(v).slice(0,max):undefined;
const bool=v=>typeof v==='boolean'?v:undefined;
const num=(lo,hi)=>v=>Number.isFinite(v)&&v>=lo&&v<=hi?v:undefined;
const oneOf=list=>v=>list.includes(v)?v:undefined;
const strList=(max,len)=>v=>Array.isArray(v)?v.filter(x=>typeof x==='string').map(x=>CLEAN(x).slice(0,len)).slice(0,max):undefined;
const COLOR=/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RULES={
  language:v=>typeof v==='string'&&/^(auto|[a-z]{2}(-[A-Za-z]{2,4})?)$/.test(v)?v:undefined,
  voiceLang:v=>typeof v==='string'&&/^(|[a-z]{2})$/.test(v)?v:undefined,   /* v56: lingua della dettatura */
  country:v=>typeof v==='string'&&/^[A-Z]{2}$/.test(v)?v:undefined,
  theme:str(24),accent:v=>typeof v==='string'&&COLOR.test(v)?v:undefined,
  timeFormat:str(8),firstDay:str(8),defDuration:num(5,1440),sound:str(12),vibration:str(12),
  defaultLocation:str(120),
  confirmedOverlaps:strList(2000,120),
  featMeteo:bool,featMusic:bool,featMoon:bool,featTags:bool,featZigzag:bool,featFullscreen:bool,
  skyLive:bool,skyFx:oneOf(['full','lite','off']),
  obsGroups:strList(12,20),
  altCal:str(40),wxSource:oneOf(['met','openmeteo','owm','none']),tempUnit:oneOf(['auto','C','F']),
  widgetFree:bool,widgetSummary:bool,
  homeGeo:v=>v&&typeof v==='object'&&Number.isFinite(v.lat)&&Number.isFinite(v.lon)&&Math.abs(v.lat)<=90&&Math.abs(v.lon)<=180?{lat:+v.lat.toFixed(4),lon:+v.lon.toFixed(4)}:undefined,
  /* holidays: si rigenerano dalle regole; openMeteoKey: le chiavi non viaggiano nei backup */
};
function cleanSettings(s){
  const out={};if(!s||typeof s!=='object')return out;
  Object.keys(s).forEach(k=>{const rule=RULES[k];if(!rule)return;let v;try{v=rule(s[k]);}catch(e){v=undefined;}if(v!==undefined)out[k]=v;});
  return out;
}

KX.Secure={encryptBackup,decryptBackup,decryptWith,exportBackup,askPassword,cleanSettings,stripPrivate,RULES};
})();
