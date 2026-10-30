/*
 * receipts.js - SCONTRINI: fotografa (anche più foto in sequenza per gli
 * scontrini lunghi), conferma, l'OCR legge le righe, correggi se serve e
 * salva la lista della spesa collegata al pagamento (es. al supermercato).
 *
 * Flusso:
 *   newReceipt()  -> fotocamera + galleria, miniature delle foto
 *   readPhotos()  -> OCR di tutte le foto (sul telefono, senza Internet)
 *   editReceipt() -> modulo con negozio, data, totale e righe modificabili
 *   saveReceipt() -> salva e collega al pagamento scelto (o ai contanti)
 */
'use strict';

Screens.receipts = function () {
  const list = S.data.receipts;
  const linked = list.filter(r => r.txId).length;
  return '<span class="eyebrow">LA LISTA DELLA SPESA</span><h1>Scontrini</h1>'
    + '<button class="btn gold wide" onclick="newReceipt()">📷 Fotografa uno scontrino</button>'
    + '<p class="mini">Per gli scontrini lunghi fai più foto in sequenza, dall\'alto verso il basso. Il testo viene letto sul telefono: le foto non escono mai dall\'app.</p>'
    + (list.length ? '<div class="grid"><div class="card"><span class="eyebrow">SCONTRINI</span><div class="value">' + list.length + '</div><span class="mini">' + linked + ' collegati a un pagamento</span></div>'
      + '<div class="card"><span class="eyebrow">PRODOTTI LETTI</span><div class="value">' + U.sum(list, r => r.items.length) + '</div><span class="mini">in ' + R.analyze(list).shops.length + ' negozi</span></div></div>'
      + '<button class="btn secondary wide" onclick="nav(\'reports\',\'shopping\')">Analisi della spesa →</button>'
      + pendingLinksHtml()
      + '<div class="card">' + list.map(r => '<div class="tx" onclick="openReceipt(' + r.id + ')"><div class="txicon">🧾</div><div class="txmain"><strong>' + esc(r.shop || 'Scontrino') + '</strong>'
        + '<small>' + fmt(r.date) + ' · ' + r.items.length + ' prodotti' + (r.txId ? ' · collegato' : ' · <span class="orange">non collegato</span>') + '</small></div><div class="amount">' + eur(-r.total) + '</div></div>').join('') + '</div>'
      : '<div class="empty"><div class="glyph">🧾</div><p class="sub">Nessuno scontrino salvato.</p></div>');
};

// ---------------------------------------------------------------------
// 1. Acquisizione foto
// ---------------------------------------------------------------------
const cap = { photos: [], stream: null };

function newReceipt() {
  cap.photos = [];
  window.onModalClose = stopCamera;
  modal('Nuovo scontrino', '<div class="camera" id="camBox"><video id="camVideo" autoplay playsinline muted></video>'
    + '<button class="shutter" aria-label="Scatta" onclick="snap()"></button></div>'
    + '<p class="mini" id="camMsg">Inquadra lo scontrino ben disteso e illuminato. Puoi scattare più foto in sequenza.</p>'
    + '<div class="thumbs" id="thumbs"></div>'
    + '<input type="file" id="gallery" accept="image/*" multiple hidden onchange="addFiles(this.files)">'
    + '<div class="actions"><button class="btn secondary" onclick="$(\'gallery\').click()">🖼 Dalla galleria</button>'
    + '<button class="btn" id="readBtn" disabled onclick="readPhotos()">Conferma e leggi</button></div>'
    + '<button class="link" onclick="editReceipt({shop:\'\',date:U.today(),total:0,items:[],ocrText:\'\'})">Oppure inserisci a mano senza foto</button>');
  startCamera();
}

async function startCamera() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('non supportata');
    cap.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1920 } } });
    const v = $('camVideo');
    if (!v) { stopCamera(); return; }
    v.srcObject = cap.stream;
  } catch (e) {
    if ($('camBox')) $('camBox').outerHTML = '<div class="hint warn">Fotocamera non disponibile (' + esc(e.message || e.name) + '). Usa "Dalla galleria" per scegliere le foto.</div>';
  }
}

function stopCamera() {
  if (cap.stream) cap.stream.getTracks().forEach(t => t.stop());
  cap.stream = null;
}

/** Scatta una foto dal video della fotocamera. */
function snap() {
  const v = $('camVideo');
  if (!v || !v.videoWidth) return;
  const c = document.createElement('canvas');
  c.width = v.videoWidth;
  c.height = v.videoHeight;
  c.getContext('2d').drawImage(v, 0, 0);
  cap.photos.push(c.toDataURL('image/jpeg', 0.9));
  $('camMsg').textContent = 'Foto ' + cap.photos.length + ' acquisita. Scatta la parte successiva o conferma.';
  showThumbs();
}

async function addFiles(files) {
  for (const f of files) cap.photos.push(await OCR.fileToDataUrl(f));
  showThumbs();
}

function showThumbs() {
  $('thumbs').innerHTML = cap.photos.map((p, i) => '<div class="th"><img src="' + p + '" alt="Foto ' + (i + 1) + '"><button class="x" onclick="cap.photos.splice(' + i + ',1);showThumbs()">×</button></div>').join('');
  $('readBtn').disabled = !cap.photos.length;
  $('readBtn').textContent = 'Conferma e leggi (' + cap.photos.length + ')';
}

// ---------------------------------------------------------------------
// 2. Lettura OCR
// ---------------------------------------------------------------------
async function readPhotos() {
  const photos = cap.photos.slice();
  stopCamera();
  window.onModalClose = null;
  modal('Lettura dello scontrino', '<p class="sub" id="ocrMsg">Avvio…</p><div class="progress"><div id="ocrBar"></div></div><p class="mini">La lettura avviene sul telefono e può richiedere qualche secondo per foto.</p>');
  try {
    const result = await OCR.readReceipt(photos, (p, msg) => {
      if ($('ocrBar')) $('ocrBar').style.width = p + '%';
      if ($('ocrMsg')) $('ocrMsg').textContent = msg;
    });
    const text = result.text;
    const parsed = result.parsed;
    // Foto ridotte da conservare (occupano meno spazio)
    const small = [];
    for (const p of photos) small.push(await OCR.prepareImage(p, 1200, false));
    editReceipt(Object.assign(parsed, { ocrText: text, photos: small }));
  } catch (e) {
    modal('Lettura non riuscita', '<p class="sub">' + esc(e.message || e) + '</p><button class="btn wide" onclick="editReceipt({shop:\'\',date:U.today(),total:0,items:[],ocrText:\'\'})">Inserisci a mano</button>');
  }
}

// ---------------------------------------------------------------------
// 3. Correzione e salvataggio
// ---------------------------------------------------------------------
let rc = null; // bozza dello scontrino in modifica

function editReceipt(draft) {
  rc = Object.assign({ items: [], photos: [] }, draft);
  window.rcDeps = R.DEPARTMENTS.map(d => d[0]).concat('Altro');
  rc.choice = null; // scelta del pagamento: null = la propone l'app
  modal(rc.id ? 'Modifica scontrino' : 'Controlla e conferma',
    (rc.check === 'diff' ? '<div class="hint warn">La somma delle righe (' + eur(rc.itemsTotal) + ') non coincide con il totale letto. Controlla prezzi e righe mancanti.</div>' : '')
    + '<label class="field">Negozio<input id="rcShop" value="' + esc(rc.shop) + '"></label>'
    + '<div class="grid"><label class="field">Data<input id="rcDate" type="date" value="' + esc(rc.date || U.today()) + '" onchange="paymentSection()"></label>'
    + '<label class="field">Totale €<input id="rcTotal" type="number" step="0.01" value="' + (rc.total / 100).toFixed(2) + '" oninput="updateSum();paymentSection()"></label></div>'
    + '<h3>Prodotti</h3><p class="mini">Nome · quantità · prezzo riga € · reparto</p><div class="items" id="rcItems">' + itemRows(rc.items) + '</div>'
    + '<div class="row"><button class="btn secondary small" onclick="addItem()">＋ Riga</button><span class="sub" id="rcSum"></span></div>'
    + '<h3 style="margin-top:20px">A quale pagamento appartiene?</h3><div id="rcPayBox"></div>'
    + (rc.photos && rc.photos.length ? '<label class="check"><input type="checkbox" id="rcKeep" checked> Conserva le ' + rc.photos.length + ' foto nell\'app</label>' : '')
    + (rc.ocrText ? '<details><summary>Testo letto dalla foto</summary><pre class="detail">' + esc(rc.ocrText) + '</pre></details>' : '')
    + '<button class="btn wide" onclick="saveReceipt()">Salva scontrino</button>');
  updateSum();
  paymentSection();
}

/** Movimenti già collegati ad ALTRI scontrini (non proponibili). */
function linkedTxIds(exceptReceiptId) {
  return S.data.receipts.filter(r => r.txId && r.id !== exceptReceiptId).map(r => r.txId);
}

/**
 * Sezione "A quale pagamento appartiene?": si ricalcola quando cambi data o
 * totale. Propone i movimenti con lo stesso importo nei giorni dello
 * scontrino; in alternativa contanti oppure nessun collegamento per ora.
 */
function paymentSection() {
  const box = $('rcPayBox');
  if (!box) return;
  const prev = document.querySelector('input[name=rcPay]:checked');
  if (prev && rc.choice !== null) rc.choice = prev.value;
  const date = $('rcDate').value, total = Math.round(Number($('rcTotal').value) * 100) || 0;
  const draft = { date, total };
  const matches = R.matchPayments(draft, S.data.transactions, linkedTxIds(rc.id));
  const current = rc.txId ? txById(rc.txId) : null;
  // Scelta proposta dall'app
  let def = '0', why = '';
  if (current) def = String(current.id);
  else if (rc.payment === 'cash') { def = 'cash'; why = 'Lo scontrino indica un pagamento in contanti.'; }
  else if (matches.length) { def = String(matches[0].tx.id); why = matches[0].exact ? 'Trovato un movimento con lo stesso importo.' : 'Trovato un movimento con importo quasi uguale: controlla.'; }
  else why = 'Nessun movimento di ' + eur(total) + ' tra il ' + fmt(U.addDays(date || U.today(), -1)) + ' e il ' + fmt(U.addDays(date || U.today(), 5)) + '. '
    + (rc.payment === 'card' ? 'Lo scontrino indica un pagamento con carta: forse non hai ancora importato quel periodo. ' : '')
    + 'Scegli "per ora nessun collegamento": dopo la prossima importazione l\'app ti proporrà il movimento giusto.';
  const choice = rc.choice !== null && document.querySelector('input[name=rcPay][value="' + rc.choice + '"]') ? rc.choice : def;
  const opt = (value, html) => '<label class="radio"><input type="radio" name="rcPay" value="' + value + '"' + (String(choice) === String(value) ? ' checked' : '')
    + ' onchange="rc.choice=this.value"><span>' + html + '</span></label>';
  const cash = L.cashCandidates(date || U.today(), total, S.data.transactions, S.data.links).find(w => w.enough);
  box.innerHTML = (why ? '<p class="mini">' + esc(why) + '</p>' : '')
    + (current ? opt(current.id, '<b>' + esc(title(current)) + '</b> · ' + fmt(current.date) + ' · ' + eur(current.cents) + '<br><span class="mini">collegato ora</span>') : '')
    + matches.filter(m => !current || m.tx.id !== current.id).map(m => opt(m.tx.id, '<b>' + esc(title(m.tx)) + '</b> · ' + fmt(m.tx.date) + ' · <b>' + eur(m.tx.cents) + '</b>'
      + (m.tx.status === 'NO' ? ' · in attesa' : '') + '<br><span class="mini">' + esc(m.label) + (U.account(m.tx) ? ' · ' + esc(U.account(m.tx)) : '') + '</span>')).join('')
    + opt('cash', '<b>Pagato in contanti</b><br><span class="mini">Crea il pagamento di ' + eur(total) + (cash ? ' e lo collega al prelievo del ' + fmt(cash.tx.date) : ' (nessun prelievo con contanti sufficienti: potrai collegarlo dopo)') + '</span>')
    + opt('0', '<b>Per ora nessun collegamento</b><br><span class="mini">Lo scontrino resta tra quelli "da collegare"</span>');
  rc.choice = choice;
}

function itemRows(items) {
  return items.map((it, i) => '<div class="item-row" data-i="' + i + '">'
    + '<input class="n" value="' + esc(it.name) + '" aria-label="Prodotto">'
    + '<input class="q" type="number" step="0.001" value="' + (it.qty || 1) + '" aria-label="Quantità">'
    + '<input class="p" type="number" step="0.01" value="' + (it.price / 100).toFixed(2) + '" aria-label="Prezzo" oninput="updateSum()">'
    + '<button onclick="removeItem(' + i + ')" aria-label="Elimina riga">×</button>'
    + '<select class="cat c">' + window.rcDeps.map(d => '<option' + (d === it.category ? ' selected' : '') + '>' + d + '</option>').join('') + '</select></div>').join('');
}

/** Legge le righe dal modulo. */
function readItems() {
  return [...document.querySelectorAll('#rcItems .item-row')].map(row => {
    const name = row.querySelector('.n').value.trim();
    const qty = Number(row.querySelector('.q').value) || 1;
    const price = Math.round(Number(row.querySelector('.p').value) * 100) || 0;
    return { name, qty, price, unit: Math.round(price / qty), category: row.querySelector('.c').value };
  }).filter(it => it.name);
}

function addItem() {
  rc.items = readItems().concat([{ name: 'Nuovo prodotto', qty: 1, price: 0, category: 'Altro' }]);
  $('rcItems').innerHTML = itemRows(rc.items);
  updateSum();
}

function removeItem(i) {
  rc.items = readItems();
  rc.items.splice(i, 1);
  $('rcItems').innerHTML = itemRows(rc.items);
  updateSum();
}

function updateSum() {
  if (!$('rcSum')) return;
  const sum = U.sum(readItems(), it => it.price);
  const total = Math.round(Number($('rcTotal').value) * 100);
  $('rcSum').innerHTML = 'Somma righe ' + eur(sum) + (Math.abs(sum - total) > 5 ? ' <span class="red">≠ totale</span>' : ' ✓');
}

function saveReceipt() {
  const items = readItems();
  const receipt = {
    id: rc.id || 0,
    shop: $('rcShop').value.trim(),
    date: $('rcDate').value,
    total: Math.round(Number($('rcTotal').value) * 100) || U.sum(items, it => it.price),
    items,
    ocrText: rc.ocrText || '',
    photos: $('rcKeep') && $('rcKeep').checked && !rc.id ? rc.photos : []
  };
  if (!receipt.date) { notice('Indica la data'); return; }
  const pay = (document.querySelector('input[name=rcPay]:checked') || {}).value || '0';
  closeModal();
  if (pay === 'cash') {
    // Crea il pagamento in contanti, collegato al prelievo più adatto, poi salva lo scontrino
    const best = L.cashCandidates(receipt.date, receipt.total, S.data.transactions, S.data.links).find(w => w.enough);
    window.afterSave = (kind, id) => {
      act('saveReceipt', Object.assign(receipt, { txId: id }));
      notice(best ? 'Scontrino salvato e contanti collegati al prelievo del ' + fmt(best.tx.date) : 'Scontrino salvato. Collega i contanti a un prelievo dalla scheda Contanti.');
    };
    act('saveManual', {
      date: receipt.date, cents: -receipt.total, operation: 'Pagamento in contanti', details: receipt.shop || 'Spesa',
      account: 'Contanti', family: 'Alimentari', category: 'Supermercato', kind: 'expense',
      link: best ? { type: 'cash', to: best.tx.id, cents: receipt.total, note: 'Da scontrino' } : undefined
    });
  } else {
    act('saveReceipt', Object.assign(receipt, { txId: Number(pay) || 0 }));
    // Il nome del negozio letto sullo scontrino diventa il nome dell'esercizio del pagamento
    const paid = txById(Number(pay));
    if (paid && receipt.shop && !(paid.extra || {}).merchant) act('edit', { id: paid.id, extra: { merchant: receipt.shop }, classifiedBy: paid.classifiedBy || '' });
    notice('Scontrino salvato con ' + items.length + ' prodotti');
  }
}

// ---------------------------------------------------------------------
// Scontrini non ancora collegati a un pagamento
// ---------------------------------------------------------------------

/** Scontrini senza pagamento, ciascuno con i movimenti che ora corrispondono. */
function pendingReceiptLinks() {
  return S.data.receipts.filter(r => !r.txId)
    .map(r => ({ r, matches: R.matchPayments(r, S.data.transactions, linkedTxIds(r.id)) }));
}

function pendingLinksHtml() {
  const list = pendingReceiptLinks();
  if (!list.length) return '';
  return '<div class="card warn"><h2>Scontrini da collegare (' + list.length + ')</h2>'
    + list.map(({ r, matches }) => '<div class="kpi"><div class="row"><strong style="font-size:13px">' + esc(r.shop || 'Scontrino') + ' · ' + fmt(r.date) + '</strong><b>' + eur(r.total) + '</b></div>'
      + (matches.length
        ? '<p class="mini">Movimento trovato: ' + esc(title(matches[0].tx)) + ' del ' + fmt(matches[0].tx.date) + ' (' + esc(matches[0].label) + ')</p>'
          + '<div class="actions"><button class="btn small" onclick="linkReceipt(' + r.id + ',' + matches[0].tx.id + ')">Collega</button><button class="btn secondary small" onclick="editReceipt(Object.assign({},S.data.receipts.find(x=>x.id===' + r.id + ')))">Altre scelte</button></div>'
        : '<p class="mini">Nessun movimento con questo importo: importa il periodo del ' + fmt(r.date) + ' oppure <button class="link" onclick="editReceipt(Object.assign({},S.data.receipts.find(x=>x.id===' + r.id + ')))">indica i contanti</button>.</p>')
      + '</div>').join('') + '</div>';
}

/** Collega uno scontrino già salvato a un movimento. */
function linkReceipt(receiptId, txId) {
  const r = S.data.receipts.find(x => x.id === receiptId), t = txById(txId);
  if (!r || !t) return;
  act('saveReceipt', Object.assign({}, r, { txId, photos: [] }));
  if (r.shop && !(t.extra || {}).merchant) act('edit', { id: t.id, extra: { merchant: r.shop }, classifiedBy: t.classifiedBy || '' });
  notice('Scontrino collegato al movimento del ' + fmt(t.date));
}

/** Dettaglio di uno scontrino salvato. */
function openReceipt(id) {
  const r = S.data.receipts.find(x => x.id === id);
  if (!r) return;
  const t = r.txId ? txById(r.txId) : null;
  const byCat = {};
  for (const it of r.items) byCat[it.category] = (byCat[it.category] || 0) + it.price;
  modal(r.shop || 'Scontrino', '<p class="sub">' + fmt(r.date) + ' · ' + r.items.length + ' prodotti · totale <b>' + eur(r.total) + '</b></p>'
    + (t ? '<h3>Pagamento</h3>' + txrow(t) : '<div class="hint warn">Non collegato a un pagamento.</div>')
    + '<h3 style="margin-top:16px">Per reparto</h3>' + bars(Object.entries(byCat).sort((a, b) => b[1] - a[1]))
    + '<h3>Prodotti</h3><table>' + r.items.map(it => '<tr><td>' + esc(it.name) + '<br><span class="mini">' + esc(it.category) + '</span></td><td>' + (it.qty !== 1 ? it.qty + ' × ' : '') + '</td><td>' + eur(it.price) + '</td></tr>').join('') + '</table>'
    + (r.photos ? '<details ontoggle="if(this.open)act(\'receiptPhotos\',{id:' + r.id + '})"><summary>Foto (' + r.photos + ')</summary><div id="photos-' + r.id + '"><p class="sub">Caricamento…</p></div></details>' : '')
    + '<div class="actions"><button class="btn secondary" onclick="editReceipt(Object.assign({},S.data.receipts.find(x=>x.id===' + r.id + ')))">Modifica</button>'
    + '<button class="btn danger" onclick="if(confirm(\'Eliminare lo scontrino?\')){act(\'deleteReceipt\',{id:' + r.id + '});closeModal()}">Elimina</button></div>');
}
