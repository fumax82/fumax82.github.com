/*
 * moves.js - MOVIMENTI: CERCA E SOMMA e finestra di DETTAGLIO.
 *
 * In alto cerchi (testo, periodo, uscite/entrate, famiglia, categoria...) e
 * subito sotto vedi il TOTALE di quello che hai trovato, con la ripartizione
 * per famiglia, categoria, soggetto e mese. Le ricerche usate spesso si
 * salvano e tornano con un tocco. La logica di ricerca e somma è in
 * logic/search.js.
 */
'use strict';

Screens.moves = function () {
  const a = filteredMoves();
  const accounts = knownAccounts();
  const families = [...new Set(S.data.transactions.map(t => C.familyOf(t, S.tax)).filter(Boolean))].sort();
  const cats = [...new Set(S.data.transactions.filter(t => !S.filterFamily || C.familyOf(t, S.tax) === S.filterFamily).map(t => t.category).filter(Boolean))].sort();
  const persons = [...new Set(S.data.transactions.map(t => t.person).filter(Boolean))];
  const opts = (vals, cur, label) => '<option value="">' + esc(label) + '</option>' + vals.map(v => '<option ' + (v === cur ? 'selected' : '') + ' value="' + esc(v) + '">' + esc(v) + '</option>').join('');
  const more = [S.filterAccount, S.filterPerson, S.filterKind].concat(Object.values(S.filterExtra)).filter(Boolean).length + (S.filterState !== 'active' ? 1 : 0);
  const saved = pref('savedSearches', []);

  return '<span class="eyebrow">CERCA E SOMMA</span><h1>Movimenti</h1>'
    // Ricerche salvate: un tocco e tutti i filtri tornano come li avevi lasciati
    + (saved.length ? '<div class="chips-row">' + saved.map((x, i) => '<span class="chip pick' + (sameSearch(x) ? ' ok' : '') + '"><span role="button" onclick="applySearch(' + i + ')">☆ ' + esc(x.name) + '</span>'
      + ' <button class="chip-x" aria-label="Elimina" onclick="deleteSearch(' + i + ')">×</button></span>').join('') + '</div>' : '')
    + '<div class="searchbar"><input id="search" type="search" placeholder="Cerca: amazon, netflix, -prime…" value="' + esc(S.query) + '" onkeydown="if(event.key===\'Enter\')this.blur()" onchange="S.query=this.value;render()">'
    + (S.query ? '<button class="btn secondary small" onclick="S.query=\'\';render()">×</button>' : '') + '</div>'
    + '<details class="mini help"><summary>Come cercare</summary><b>amazon prime</b>: tutte le parole · <b>netflix, spotify</b>: l\'una o l\'altra · <b>amazon -prime</b>: escludi una parola. Cerca in descrizione, esercizio, soggetto, note e categoria.</details>'
    + periodControl()
    + '<div class="tabs seg">' + [['out', 'Uscite'], ['in', 'Entrate'], ['all', 'Tutti']].map(([v, l]) => '<button class="' + (S.flow === v ? 'on' : '') + '" onclick="S.flow=\'' + v + '\';render()">' + l + '</button>').join('') + '</div>'
    + '<div class="grid"><label class="field">Famiglia<select onchange="S.filterFamily=this.value;S.filterCat=\'\';render()">' + opts(families, S.filterFamily, 'Tutte') + '</select></label>'
    + '<label class="field">Categoria<select onchange="S.filterCat=this.value;render()">' + opts(cats, S.filterCat, 'Tutte') + '</select></label></div>'
    + '<details' + (more ? ' open' : '') + '><summary>Altri filtri' + (more ? ' (' + more + ' attivi)' : '') + '</summary>'
    + '<label class="field">Tipo di movimento<select onchange="S.filterKind=this.value;render()"><option value="">Tutti</option>'
    + Object.entries(KINDS).map(([v, l]) => '<option value="' + v + '"' + (S.filterKind === v ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select></label>'
    + '<label class="field">Stato<select onchange="S.filterState=this.value;render()">'
    + [['active', 'Attivi'], ['missing', 'Con informazioni mancanti'], ['pending', 'In attesa'], ['replaced', 'Riconciliati'], ['excluded', 'Esclusi'], ['all', 'Tutti, incluso storico']]
      .map(([v, l]) => '<option value="' + v + '" ' + (S.filterState === v ? 'selected' : '') + '>' + l + '</option>').join('') + '</select></label>'
    + '<label class="field">Conto o carta<select onchange="S.filterAccount=this.value;render()">' + opts(accounts, S.filterAccount, 'Tutti i conti')
    + '<option value="missing" ' + (S.filterAccount === 'missing' ? 'selected' : '') + '>Non indicato</option></select></label>'
    + '<label class="field">Persona<select onchange="S.filterPerson=this.value;render()">' + opts(persons, S.filterPerson, 'Tutta la famiglia') + '</select></label>'
    + ['need', 'nature', 'tax', 'rating', 'refund'].map(k => {
      const f = FL.byKey[k], cur = S.filterExtra[k] || '';
      return '<label class="field">' + esc(f.label) + '<select onchange="S.filterExtra.' + k + '=this.value;render()"><option value="">Tutti</option>'
        + f.options.map(([v, l]) => '<option value="' + v + '"' + (cur === v ? ' selected' : '') + '>' + esc(l) + '</option>').join('')
        + '<option value="__none"' + (cur === '__none' ? ' selected' : '') + '>Non indicato</option></select></label>';
    }).join('')
    + '<label class="field">Etichetta / progetto<select onchange="S.filterExtra.tags=this.value;render()">' + opts(knownValues('tags'), S.filterExtra.tags || '', 'Tutte') + '</select></label>'
    + '<label class="field">Esercizio<select onchange="S.filterExtra.merchant=this.value;render()">' + opts(knownValues('merchant'), S.filterExtra.merchant || '', 'Tutti') + '</select></label>'
    + '</details>'
    + totalsCard(a)
    + '<div class="card">' + (a.length ? a.slice(0, S.limit).map(t => txrow(t)).join('') : '<p class="sub">Nessun movimento per questa ricerca.</p>') + '</div>'
    + (a.length > S.limit ? '<button class="btn secondary wide" onclick="S.limit+=80;render()">Mostra altri 80</button>' : '')
    + '<div class="actions"><button class="btn" onclick="act(\'import\')">Importa Excel</button><button class="btn secondary" onclick="newCash()">＋ Contanti</button></div>';
};

/** I movimenti che corrispondono a ricerca, periodo e filtri (dal più recente). */
function filteredMoves() {
  const q = SR.parseQuery(S.query);
  return selected()
    .filter(t => S.flow === 'out' ? t.cents < 0 : S.flow === 'in' ? t.cents > 0 : true)
    .filter(t => S.filterState === 'all' ? true : S.filterState === 'pending' ? (t.state === 'active' && t.status === 'NO')
      : S.filterState === 'missing' ? C.missingInfo(t, S.tax).length > 0 : t.state === S.filterState)
    .filter(t => SR.matchText([t.operation, t.details, t.note, t.category, C.familyOf(t, S.tax), title(t), (subjectOf(t) || {}).description, (t.extra || {}).merchant].join(' '), q))
    .filter(t => !S.filterKind || t.kind === S.filterKind)
    .filter(t => !S.filterAccount || (S.filterAccount === 'missing' ? !U.account(t) : U.account(t) === S.filterAccount))
    .filter(t => !S.filterFamily || C.familyOf(t, S.tax) === S.filterFamily)
    .filter(t => !S.filterCat || t.category === S.filterCat)
    .filter(t => !S.filterPerson || t.person === S.filterPerson)
    .filter(t => Object.entries(S.filterExtra).every(([k, v]) => {
      if (!v) return true;
      const x = (t.extra || {})[k];
      if (v === '__none') return !x || (Array.isArray(x) && !x.length);
      return Array.isArray(x) ? x.includes(v) : x === v;
    }))
    .sort((x, y) => y.date.localeCompare(x.date) || y.id - x.id);
}

/**
 * RIEPILOGO della ricerca: totale, numero di movimenti, media al mese,
 * andamento mese per mese e ripartizione per famiglia/categoria/soggetto.
 * Tocca una voce della ripartizione per restringere la ricerca.
 */
function totalsCard(list) {
  if (!list.length) return '';
  const s0 = SR.summarize(list, 0);
  const sign = S.flow === 'in' ? 1 : S.flow === 'out' ? -1 : (s0.out >= s0.in ? -1 : 1);
  const s = SR.summarize(list, sign, {
    family: t => C.familyOf(t, S.tax) || 'Senza famiglia',
    category: t => t.category || 'Da classificare',
    subject: t => title(t)
  });
  const by = S.sub.totalsBy || 'family';
  const parts = by === 'category' ? s.byCategory : by === 'subject' ? s.bySubject : s.byFamily;
  const filtered = S.query || S.filterFamily || S.filterCat || S.period.preset !== 'all' || S.flow !== 'all';
  return '<section class="hero totals"><div class="row"><span class="eyebrow">' + (sign < 0 ? 'TOTALE USCITE' : 'TOTALE ENTRATE') + ' · ' + esc(periodRange().label) + '</span></div>'
    + '<div class="big">' + eur(s.total) + '</div>'
    + '<div class="sub">' + s.count + (s.count === 1 ? ' movimento' : ' movimenti') + (s.months.length > 1 ? ' · ' + eur(s.perMonth) + ' al mese in media' : '') + ' · ' + eur(s.average) + ' a movimento'
    + (s.first ? '<br>dal ' + fmt(s.first) + ' al ' + fmt(s.last) : '') + '</div>'
    + (S.flow === 'all' ? '<div class="line"><div><span class="eyebrow">USCITE</span><strong>' + eur(-s.out) + '</strong></div><div><span class="eyebrow">ENTRATE</span><strong class="green">' + eur(s.in) + '</strong></div>'
      + '<div><span class="eyebrow">SALDO</span><strong>' + eur(s.net) + '</strong></div></div>' : '')
    + '<div class="row" style="margin-top:12px;justify-content:flex-start;gap:8px">'
    + (S.query || S.filterFamily || S.filterCat ? '<button class="btn gold small" onclick="saveSearch()">☆ Salva ricerca</button>' : '')
    + (filtered ? '<button class="btn secondary small" onclick="resetFilters()">Azzera tutto</button>' : '') + '</div></section>'
    + '<details class="card"' + (S.sub.totalsOpen ? ' open' : '') + ' ontoggle="S.sub.totalsOpen=this.open"><summary>Ripartizione e andamento</summary>'
    + '<div class="tabs" style="margin:10px 0">' + [['family', 'Famiglie'], ['category', 'Categorie'], ['subject', 'Soggetti']].map(([v, l]) => '<button class="' + (by === v ? 'on' : '') + '" onclick="S.sub.totalsBy=\'' + v + '\';S.sub.totalsOpen=true;render()">' + l + '</button>').join('') + '</div>'
    + bars(parts.slice(0, 10), by === 'category' ? 'narrowCategory' : by === 'subject' ? 'narrowSubject' : 'narrowFamily')
    + (parts.length > 10 ? '<p class="mini">… e altre ' + (parts.length - 10) + ' voci</p>' : '')
    + (s.months.length > 1 ? '<h3 style="margin-top:16px">Mese per mese</h3>' + bars(s.months.slice(-24).reverse().map(([m, v]) => [monthName(m), v])) : '')
    + '</details>';
}

// Tocchi su una voce della ripartizione: restringono la ricerca
function narrowFamily(f) { S.filterFamily = f === 'Senza famiglia' ? '' : f; S.filterCat = ''; render(); }
function narrowCategory(c) { if (c !== 'Da classificare') S.filterCat = c; else S.filterState = 'missing'; render(); }
function narrowSubject(name) { S.query = name; render(); }

// ---------------------------------------------------------------------
// Ricerche salvate (prefs.savedSearches)
// ---------------------------------------------------------------------
const SEARCH_KEYS = ['query', 'flow', 'filterFamily', 'filterCat', 'filterKind', 'filterAccount', 'filterPerson', 'filterState'];

function currentSearch() {
  const x = { period: Object.assign({}, S.period), filterExtra: Object.assign({}, S.filterExtra) };
  for (const k of SEARCH_KEYS) x[k] = S[k];
  return x;
}

function sameSearch(x) {
  const c = currentSearch();
  return SEARCH_KEYS.every(k => (x[k] || '') === (c[k] || '')) && x.period.preset === c.period.preset;
}

function saveSearch() {
  const name = prompt('Nome della ricerca (es. "Servizi AI")', S.query || S.filterCat || S.filterFamily);
  if (!name) return;
  put('savedSearches', pref('savedSearches', []).concat([Object.assign({ name: name.trim() }, currentSearch())]));
  render();
  notice('Ricerca salvata: la trovi in cima a Movimenti');
}

function applySearch(i) {
  const x = pref('savedSearches', [])[i];
  if (!x) return;
  for (const k of SEARCH_KEYS) S[k] = x[k] || (k === 'flow' ? 'all' : k === 'filterState' ? 'active' : '');
  S.filterExtra = Object.assign({}, x.filterExtra);
  S.period = Object.assign({}, x.period);
  setPeriod(S.period.preset);
}

function deleteSearch(i) {
  const list = pref('savedSearches', []);
  if (!confirm('Eliminare la ricerca salvata "' + list[i].name + '"?')) return;
  put('savedSearches', list.filter((_, k) => k !== i));
  render();
}

function resetFilters() {
  S.filterState = 'active'; S.filterAccount = ''; S.filterFamily = ''; S.filterCat = ''; S.filterPerson = ''; S.filterKind = ''; S.query = ''; S.filterExtra = {}; S.flow = 'all';
  setPeriod('all');
}

/** Finestra di dettaglio di un movimento. */
function detail(id) {
  const t = txById(id);
  if (!t) return;
  const miss = C.missingInfo(t, S.tax);
  const fam = C.familyOf(t, S.tax);
  const ctxSug = { taxonomy: S.tax, rules: pref('rules', []), history: C.learnHistory(S.data.transactions) };
  const sug = miss.length ? C.suggest(t, ctxSug) : null;
  const rule = C.ruleFor(t, pref('rules', []));
  const links = L.linksOf(t.id, S.data.links);
  const receipts = S.data.receipts.filter(r => r.txId === t.id);
  const by = t.classifiedBy === 'user' ? 'da te' : String(t.classifiedBy).startsWith('rule:') ? 'da una regola' : t.classifiedBy === 'bank' ? 'dalla banca' : 'non classificato';

  let html = subjectBox(t) + '<div class="value" style="font-size:30px;margin:12px 0">' + eur(t.cents) + '</div>'
    + '<p class="sub">' + fmt(t.date) + ' · ' + (t.status === 'SI' ? 'Contabilizzato' : 'Non contabilizzato') + ' · ' + esc(KINDS[t.kind] || t.kind)
    + (t.source === 'manual' ? ' · inserito a mano' : '') + '</p>'
    + (t.details && t.operation ? '<p class="detail"><b>' + esc(t.operation) + '</b><br>' + esc(t.details) + '</p>' : '')
    + '<p class="sub">Conto/carta: ' + esc(U.account(t) || 'non indicato') + (t.accountUser && !t.account ? ' (indicato da te)' : '')
    + '<br>Classificazione: ' + esc(fam ? fam + ' › ' : '') + esc(t.category || '—') + ' (' + by + ')'
    + (rule ? '<br>Regola: "' + esc(rule.name || rule.text) + '"' : '') + '</p>'
    + (miss.length ? '<div class="hint warn">Mancano: ' + miss.map(m => '<span class="chip miss">' + MISSING_LABEL[m] + '</span>').join('')
      + (sug ? '<br>Proposta: <b>' + esc(sug.family + ' › ' + sug.category) + '</b> (' + esc(sug.reason) + ')' : '') + '</div>' : '');

  // Modulo di classificazione
  const preset = sug && !t.category ? sug : { family: t.family || fam, category: t.category };
  const prof = FL.profiles(S.data.transactions, S.tax)[(t.cents < 0 ? -1 : 1) + '|' + C.merchantKey(t)];
  if (prof && prof.sourceId !== t.id) {
    html += '<button class="btn gold wide" onclick="fillFromProfile(' + t.id + ',\'d\')">↺ Copia i dati dal ' + fmt(prof.date) + ' (stesso esercizio)</button>';
  }
  html += '<label class="field">Famiglia › categoria' + catSelect('dCat', preset.family, preset.category, sug ? [{ family: sug.family, category: sug.category, reason: 'proposta' }] : []) + '</label>'
    + '<label class="field">Trattamento nei report<select id="dKind">' + Object.entries(KINDS).map(([v, l]) => '<option ' + (t.kind === v ? 'selected' : '') + ' value="' + v + '">' + l + '</option>').join('') + '</select></label>'
    + (!t.account ? '<label class="field">Conto o carta (manca nel file)' + accountSelect('dAcc', t.accountUser) + '</label>' : '')
    + '<label class="field">Persona<input id="dPerson" value="' + esc(t.person) + '"></label>'
    + '<details' + (t.extra && Object.keys(t.extra).length ? ' open' : '') + '><summary>Dettagli per i report (necessità, natura, etichette…)</summary>' + extraInputs('dX', t) + '</details>'
    + '<label class="field">Note<textarea id="dNote">' + esc(t.note) + '</textarea></label>'
    + '<button class="btn wide" onclick="saveDetail(' + t.id + ')">Salva</button>'
    + '<p class="mini">Dopo il salvataggio ti verranno proposti i movimenti dello stesso esercizio o simili su cui copiare i dati.</p>';

  // Collegamenti
  html += '<div class="card"><h3>Collegamenti</h3>' + linksHtml(t, links) + '</div>';
  if (receipts.length) {
    html += '<div class="card"><h3>🧾 Scontrino</h3>' + receipts.map(r => '<p class="sub">' + esc(r.shop) + ' · ' + r.items.length + ' prodotti · ' + eur(r.total)
      + ' <button class="link" onclick="openReceipt(' + r.id + ')">Apri</button></p>').join('') + '</div>';
  }

  html += '<div class="actions">'
    + '<button class="btn secondary" onclick="ruleFromDetail(' + t.id + ')">Crea regola</button>'
    + (t.source === 'manual' ? '<button class="btn secondary" onclick="newCash(' + t.id + ')">Modifica</button><button class="btn danger" onclick="deleteManual(' + t.id + ')">Elimina</button>'
      : t.state === 'active' ? '<button class="btn danger" onclick="excludeTx(' + t.id + ')">Escludi dai totali</button>'
        : '<button class="btn secondary" onclick="act(\'undo\',{id:' + t.id + '});closeModal()">Ripristina</button>')
    + '</div><details><summary>Tutti i campi originali</summary><pre class="detail">' + esc(JSON.stringify(t.raw, null, 2)) + '</pre>'
    + '<p class="sub">Occorrenza ' + t.occurrence + (t.replaced ? ' · Sostituito dal movimento #' + t.replaced : '') + ' · id ' + t.id + '</p></details>';
  modal(title(t), html);
}

/** Descrive i collegamenti del movimento e propone quelli possibili. */
function linksHtml(t, links) {
  let html = '';
  if (t.kind === 'withdrawal') {
    const w = L.withdrawals(S.data.transactions, S.data.links).find(x => x.tx.id === t.id);
    html += '<p class="sub">Prelievo di ' + eur(-t.cents) + ': spiegati ' + eur(w ? w.allocated : 0) + ', ancora da tracciare <b>' + eur(w ? w.free : -t.cents) + '</b>.</p>'
      + '<div class="track"><div class="fill" style="width:' + (w ? Math.min(100, w.allocated / w.amount * 100) : 0) + '%"></div></div>'
      + (w && w.items.length ? w.items.map(id => txrow(txById(id))).join('') : '')
      + '<button class="btn secondary wide" style="margin-top:12px" onclick="newCash()">＋ Registra una spesa pagata con questi contanti</button>';
  }
  for (const l of links) {
    const other = txById(l.from === t.id ? l.to : l.from);
    const label = { cash: l.to ? 'Contanti presi dal prelievo' : 'Contanti non da prelievo', refund: 'Rimborso collegato', transfer: 'Giroconto collegato', reimburse: 'Rimborso collegato' }[l.type];
    if (t.kind === 'withdrawal' && l.type === 'cash') continue;
    html += '<p class="sub"><b>' + label + '</b>' + (l.note ? ' · ' + esc(l.note) : '') + ' · ' + eur(Math.abs(l.cents))
      + ' <button class="link" onclick="act(\'removeLink\',{id:' + l.id + '});closeModal()">Scollega</button></p>' + (other ? txrow(other) : '');
  }
  if (t.source === 'manual' && !L.cashLinkOf(t.id, S.data.links)) {
    html += '<div class="hint warn">Non hai ancora indicato da dove vengono questi contanti.</div><button class="btn secondary wide" onclick="newCash(' + t.id + ')">Collega a un prelievo</button>';
  }
  if (t.kind === 'refund' && !links.some(l => l.type === 'refund')) {
    html += '<button class="btn secondary wide" onclick="linkRefund(' + t.id + ')">Collega alla spesa rimborsata</button>';
  }
  if (t.cents > 0 && t.kind === 'income') {
    html += '<button class="link" onclick="linkRefund(' + t.id + ')">Sono soldi restituiti per una spesa? Collegali</button>';
  }
  return html || '<p class="sub">Nessun collegamento.</p>';
}

/** Salva il dettaglio e propone la copia dei campi sui movimenti simili. */
function saveDetail(id) {
  const cat = readCat('dCat');
  if (cat === undefined) return;
  const after = Object.assign({ kind: $('dKind').value, person: $('dPerson').value.trim() || 'Famiglia', note: $('dNote').value }, readExtraInputs('dX'));
  if (cat) after.class = cat;
  if ($('dAcc')) after.accountUser = readAccount('dAcc');
  closeModal();
  saveFields(id, after);
}

function ruleFromDetail(id) {
  const t = txById(id);
  const cat = readCat('dCat');
  closeModal();
  editRule(null, C.ruleFromTx(t, cat ? { family: cat.family, category: cat.category } : { family: t.family, category: t.category }));
}

function excludeTx(id) {
  if (confirm('Escludere questo movimento dai totali? Rimarrà nello storico e potrai ripristinarlo.')) {
    act('exclude', { id });
    closeModal();
  }
}

function deleteManual(id) {
  if (confirm('Eliminare questo movimento inserito a mano?')) {
    act('deleteManual', { id });
    closeModal();
  }
}
