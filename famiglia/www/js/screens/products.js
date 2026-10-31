/*
 * products.js - REPARTI DEI PRODOTTI: correggere e insegnare all'app.
 *
 * Tocchi un prodotto di uno scontrino e scegli il reparto giusto. L'app:
 *   - ricorda la correzione per quel prodotto (es. "TILSITER AFFETTATO" =
 *     Latte e formaggi) e la usa per tutti gli scontrini futuri
 *   - se vuoi, ricorda anche la PAROLA (es. "TILSITER") per riconoscere altri
 *     prodotti che la contengono
 *   - aggiorna gli scontrini già salvati con lo stesso prodotto (dopo conferma)
 *
 * Le correzioni stanno in prefs.productLearned = { products: {...}, words: {...} }
 * e vengono usate da logic/products.js prima del dizionario.
 */
'use strict';

const PR = Products;
const depIcon = d => PR.icon(d);

function learned() {
  const l = pref('productLearned', {});
  return { products: Object.assign({}, l.products), words: Object.assign({}, l.words) };
}

/** Tutte le righe di tutti gli scontrini: [{ r, i, it }] */
function allItems() {
  const out = [];
  for (const r of S.data.receipts) (r.items || []).forEach((it, i) => out.push({ r, i, it }));
  return out;
}

// ---------------------------------------------------------------------
// Cambio reparto di un prodotto (da uno scontrino salvato o dall'analisi)
// ---------------------------------------------------------------------

/** Apre la scelta del reparto per il prodotto "name" (attuale: current). */
function changeDepartment(name, current) {
  const key = PR.key(name);
  const words = PR.tokens(name).filter(w => w.length >= 4);
  const same = allItems().filter(x => PR.key(x.it.name) === key);
  window.depChange = { name, key, current };
  const guess = PR.classify(name, {});
  modal('Reparto di "' + name + '"', '<p class="sub">Ora: ' + depIcon(current) + ' <b>' + esc(current || 'Altro') + '</b>'
    + (guess.source === 'dictionary' ? ' · il dizionario lo riconosce da "' + esc(guess.keyword) + '"' : guess.source === 'none' ? ' · nessuna parola conosciuta' : '') + '</p>'
    + '<div class="fam-grid">' + PR.NAMES.map(d => '<button class="fam-card' + (d === current ? ' open' : '') + '" onclick="pickDepartment(' + jsArg(d) + ')">'
      + '<span class="fam-ico">' + depIcon(d) + '</span><span class="fam-name">' + esc(d) + '</span></button>').join('') + '</div>'
    + '<label class="check" style="margin-top:14px"><input type="checkbox" id="depRemember" checked><span>Ricorda per <b>' + esc(key || name) + '</b> anche nei prossimi scontrini</span></label>'
    + (words.length ? '<label class="check"><input type="checkbox" id="depWord"><span>Usa anche la parola <select id="depWordSel">' + words.map(w => '<option>' + esc(w) + '</option>').join('')
      + '</select> per riconoscere <b>altri prodotti</b> che la contengono</span></label>' : '')
    + (same.length > 1 ? '<label class="check"><input type="checkbox" id="depAll" checked><span>Correggi anche gli altri <b>' + (same.length - 1) + '</b> acquisti di questo prodotto negli scontrini già salvati</span></label>' : ''));
}

/** Applica la scelta: ricorda e aggiorna gli scontrini interessati. */
function pickDepartment(dep) {
  const c = window.depChange;
  const l = learned();
  const remember = $('depRemember') && $('depRemember').checked;
  const word = $('depWord') && $('depWord').checked ? $('depWordSel').value : null;
  if (remember && c.key) l.products[c.key] = dep;
  if (word) l.words[word] = dep;
  if (remember || word) { put('productLearned', l); R.setLearned(l); }
  // Scontrini da aggiornare: il prodotto stesso (sempre se "tutti", altrimenti solo questo nome)
  // e, se hai scelto la parola, tutti i prodotti che la contengono
  const all = !$('depAll') || $('depAll').checked;
  const touched = new Map();
  for (const x of allItems()) {
    const k = PR.key(x.it.name);
    const hit = (k === c.key && (all || x.it.name === c.name)) || (word && PR.tokens(x.it.name).includes(word));
    if (!hit || x.it.category === dep) continue;
    if (!touched.has(x.r.id)) touched.set(x.r.id, JSON.parse(JSON.stringify(x.r.items)));
    touched.get(x.r.id)[x.i] = Object.assign({}, x.it, { category: dep, userCat: true });
  }
  for (const [id, items] of touched) {
    const r = S.data.receipts.find(x => x.id === id);
    act('saveReceipt', Object.assign({}, r, { items, photos: [] }));
  }
  closeModal();
  notice(depIcon(dep) + ' ' + dep + ': ' + touched.size + (touched.size === 1 ? ' scontrino aggiornato' : ' scontrini aggiornati') + (remember ? ' · ricordato per i prossimi' : ''));
}

/**
 * Dall'editor dello scontrino: i reparti che hai cambiato a mano vengono
 * ricordati per quel prodotto (solo se diversi da quello che l'app darebbe).
 */
function learnFromItems(items) {
  const l = learned();
  let n = 0;
  for (const it of items) {
    const k = PR.key(it.name);
    if (!it.userCat || !k || PR.classify(it.name, l).department === it.category) continue;
    l.products[k] = it.category;
    n++;
  }
  if (!n) return;
  put('productLearned', l);
  R.setLearned(l);
}

// ---------------------------------------------------------------------
// Sezioni nell'analisi della spesa
// ---------------------------------------------------------------------

/** Prodotti non riconosciuti (reparto "Altro"), raggruppati per nome. */
function unknownProductsHtml() {
  const groups = {};
  for (const x of allItems()) {
    if (x.it.category && x.it.category !== 'Altro') continue;
    const k = PR.key(x.it.name) || x.it.name;
    (groups[k] = groups[k] || { name: x.it.name, n: 0, spent: 0 }).n++;
    groups[k].spent += x.it.price;
  }
  const list = Object.values(groups).sort((a, b) => b.spent - a.spent);
  if (!list.length) return '';
  return '<div class="card warn"><h2>Prodotti da controllare (' + list.length + ')</h2><p class="sub">Non riconosciuti: tocca per scegliere il reparto, l\'app se lo ricorderà.</p>'
    + list.slice(0, 20).map(g => '<div class="tx" onclick="changeDepartment(' + jsArg(g.name) + ',\'Altro\')"><div class="txicon">❓</div><div class="txmain"><strong>' + esc(g.name) + '</strong>'
      + '<small>' + g.n + (g.n === 1 ? ' acquisto' : ' acquisti') + '</small></div><div class="amount">' + eur(g.spent) + '</div></div>').join('') + '</div>';
}

/** Elenco delle correzioni ricordate, con la possibilità di toglierle. */
function learnedHtml() {
  const l = learned();
  const rows = Object.entries(l.products).map(([k, d]) => ['p', k, d]).concat(Object.entries(l.words).map(([k, d]) => ['w', k, d]));
  const missing = reclassifyProposals().length;
  return '<details class="card"><summary>Reparti: correzioni ricordate (' + rows.length + ')</summary>'
    + (rows.length ? rows.map(([t, k, d]) => '<div class="row" style="padding:6px 0"><span>' + (t === 'w' ? 'parola ' : '') + '<b>' + esc(k) + '</b> → ' + depIcon(d) + ' ' + esc(d) + '</span>'
      + '<button class="link" onclick="forgetLearned(' + jsArg(t) + ',' + jsArg(k) + ')">Dimentica</button></div>').join('') : '<p class="sub">Nessuna. Tocca un prodotto di uno scontrino per correggerne il reparto.</p>')
    + '<button class="btn secondary wide" style="margin-top:10px" onclick="reclassifyReview()">Ricalcola i reparti degli scontrini salvati' + (missing ? ' (' + missing + ' da aggiornare)' : '') + '</button></details>';
}

function forgetLearned(type, key) {
  const l = learned();
  delete (type === 'w' ? l.words : l.products)[key];
  put('productLearned', l);
  R.setLearned(l);
  render();
}

/**
 * Dopo un aggiornamento del dizionario: per ogni prodotto già salvato, il
 * reparto che l'app darebbe oggi. Esclusi quelli corretti a mano.
 */
function reclassifyProposals() {
  const l = learned();
  const out = [];
  for (const x of allItems()) {
    if (x.it.userCat) continue;
    const now = PR.classify(x.it.name, l).department;
    if (now !== (x.it.category || 'Altro') && now !== 'Altro') out.push(Object.assign({ now }, x));
  }
  return out;
}

function reclassifyReview() {
  const list = reclassifyProposals();
  if (!list.length) { notice('Tutti i reparti sono già aggiornati'); return; }
  window.reclass = list;
  modal('Aggiornare i reparti?', '<p class="sub">Con il dizionario attuale questi prodotti cambierebbero reparto. Togli la spunta a quelli che vuoi lasciare come sono.</p>'
    + list.slice(0, 200).map((x, i) => '<label class="check" style="font-size:13px"><input type="checkbox" class="rcl" data-i="' + i + '" checked><span><b>' + esc(x.it.name) + '</b> <span class="mini">(' + esc(x.r.shop || '') + ' ' + fmt(x.r.date) + ')</span><br>'
      + depIcon(x.it.category) + ' ' + esc(x.it.category || 'Altro') + ' → ' + depIcon(x.now) + ' <b>' + esc(x.now) + '</b></span></label>').join('')
    + '<button class="btn wide" onclick="applyReclassify()">Aggiorna i prodotti selezionati</button>');
}

function applyReclassify() {
  const chosen = [...document.querySelectorAll('.rcl')].filter(c => c.checked).map(c => window.reclass[+c.dataset.i]);
  const touched = new Map();
  for (const x of chosen) {
    if (!touched.has(x.r.id)) touched.set(x.r.id, JSON.parse(JSON.stringify(x.r.items)));
    touched.get(x.r.id)[x.i].category = x.now;
  }
  for (const [id, items] of touched) act('saveReceipt', Object.assign({}, S.data.receipts.find(r => r.id === id), { items, photos: [] }));
  closeModal();
  notice(chosen.length + ' prodotti aggiornati in ' + touched.size + ' scontrini');
}
