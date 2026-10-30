/*
 * app.js - Il "cuore" dell'interfaccia.
 *
 * Contiene:
 *  - lo STATO dell'app (variabile S): dati ricevuti e pagina attuale
 *  - il collegamento con il telefono: act() manda un comando al codice
 *    Android (oggetto Native); se l'app è aperta in un browser del PC usa
 *    l'anteprima dimostrativa (demo.js)
 *  - receive(): riceve i dati aggiornati dal database e ridisegna la pagina
 *  - componenti riutilizzati da tutte le schermate (righe movimento,
 *    grafici, finestre, scelta categoria...)
 *
 * Ogni schermata è in un file separato dentro js/screens/ e si registra in
 * Screens.nome = function () { return '...html...'; }
 */
'use strict';

// ---------------------------------------------------------------------
// Stato
// ---------------------------------------------------------------------
const S = {
  data: { transactions: [], imports: [], audit: [], pairs: [], prefs: {}, links: [], receipts: [] },
  prefs: {},          // preferenze già convertite da testo JSON a oggetti
  tax: [],            // tassonomia famiglie/categorie
  todo: [],           // movimenti con informazioni mancanti
  gaps: null,         // analisi dei buchi di importazione
  page: 'home',
  month: '',          // mese selezionato "AAAA-MM" ('' = tutti)
  query: '', filterState: 'active', filterAccount: '', filterCat: '', filterFamily: '', filterPerson: '',
  limit: 80,
  sub: {},            // sotto-schede di ogni schermata (es. S.sub.reports = 'alerts')
  loaded: false
};
const Screens = {};
const $ = id => document.getElementById(id);
const C = Classify, G = Gaps, F = Finance, L = Links, R = Receipts, U = Util;

// ---------------------------------------------------------------------
// Formattazione
// ---------------------------------------------------------------------
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = c => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format((c || 0) / 100);
const fmt = d => (d ? d.split('-').reverse().join('/') : '—');
const monthName = m => (m ? new Date(m + '-01T12:00:00').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }) : 'Tutti i periodi');
/** Testo da usare dentro onclick="..." in modo sicuro. */
const jsArg = v => esc(JSON.stringify(v));

const KINDS = {
  expense: 'Spesa', income: 'Entrata', refund: 'Rimborso / storno', saving: 'Accantonamento',
  investment: 'Investimento', transfer: 'Giroconto', withdrawal: 'Prelievo contanti'
};
const MISSING_LABEL = { family: 'Famiglia', category: 'Categoria', account: 'Conto / carta' };

// ---------------------------------------------------------------------
// Comunicazione con il telefono
// ---------------------------------------------------------------------

/** Invia un comando al database (Android) o all'anteprima (browser). */
function act(command, payload) {
  if (window.Native) window.Native.action(command, JSON.stringify(payload || {}));
  else if (window.Demo) window.Demo.action(command, payload || {});
  else notice('Funzione disponibile nell\'app Android.');
}

/** Legge una preferenza (con valore predefinito). */
function pref(key, def) {
  return S.prefs[key] !== undefined && S.prefs[key] !== null ? S.prefs[key] : def;
}

/** Salva una preferenza. Aggiorna subito lo stato locale, poi il database. */
function put(key, value) {
  S.prefs[key] = value;
  act('pref', { key, value: JSON.stringify(value) });
}

/** Ricalcola i dati derivati (da completare, buchi...). */
function derive() {
  S.tax = C.taxonomy(S.prefs);
  S.todo = C.todoList(S.data.transactions, S.prefs);
  S.gaps = G.analyze(S.data.imports, S.data.transactions, pref('gapIgnored', []), U.today());
}

let lastRuleSignature = '';
/**
 * Applica in automatico le regole ai movimenti nuovi o non classificati da te.
 * La "firma" evita di ripetere all'infinito la stessa richiesta.
 */
function applyRulesAutomatically() {
  const edits = C.pendingRuleEdits(S.data.transactions, pref('rules', []));
  if (!edits.length) return;
  const sig = JSON.stringify(edits);
  if (sig === lastRuleSignature) return;
  lastRuleSignature = sig;
  act('bulkEdit', { items: edits, reason: 'Regole automatiche', silent: true });
  notice(edits.length + (edits.length === 1 ? ' movimento classificato' : ' movimenti classificati') + ' dalle tue regole');
}

/** Chiamata dal database ogni volta che i dati cambiano. */
window.receive = function (d) {
  S.data = Object.assign({ transactions: [], imports: [], audit: [], pairs: [], prefs: {}, links: [], receipts: [] }, d);
  S.prefs = {};
  for (const k in S.data.prefs) {
    try { S.prefs[k] = JSON.parse(S.data.prefs[k]); } catch (e) { S.prefs[k] = S.data.prefs[k]; }
  }
  S.data.prefsParsed = S.prefs;
  if (!S.loaded && S.data.transactions.length) {
    S.month = S.data.transactions.map(t => t.date.slice(0, 7)).sort().pop();
  }
  S.loaded = true;
  derive();
  applyRulesAutomatically();
  render();
};

/** Dopo un'importazione: avvisa e mostra cosa c'è da completare. */
window.onImported = function (summary) {
  notice('Importazione completata: ' + summary);
  setTimeout(() => {
    if (S.todo.length || (S.gaps && S.gaps.gaps.length)) {
      modal('Importazione completata', '<p class="sub">' + esc(summary) + '</p>'
        + (S.todo.length ? '<div class="hint warn">' + S.todo.length + ' movimenti hanno informazioni mancanti (famiglia, categoria o carta).</div><button class="btn wide" onclick="closeModal();nav(\'todo\')">Completa ora</button>' : '')
        + (S.gaps && S.gaps.important ? '<div class="hint warn" style="margin-top:12px">Attenzione: ' + S.gaps.important + ' buchi importanti tra i file importati.</div><button class="btn secondary wide" onclick="closeModal();nav(\'imports\')">Vedi analisi dei buchi</button>' : ''));
    }
  }, 400);
};

/** Il database conferma un salvataggio (es. id del nuovo pagamento in contanti). */
window.onSaved = function (kind, id) {
  if (window.afterSave) { const f = window.afterSave; window.afterSave = null; f(kind, id); }
};

window.receivePhotos = function (id, photos) {
  const box = $('photos-' + id);
  if (box) box.innerHTML = photos.length ? photos.map(p => '<img src="' + p + '" style="width:100%;border-radius:12px;margin:6px 0">').join('') : '<p class="sub">Nessuna foto salvata.</p>';
};

// ---------------------------------------------------------------------
// Navigazione, messaggi, finestre
// ---------------------------------------------------------------------

function nav(page, sub) {
  S.page = page;
  if (sub) S.sub[page] = sub;
  S.limit = 80;
  render();
  window.scrollTo(0, 0);
}

/** Tasto "indietro" di Android. */
window.back = function () {
  if (!$('modal').hidden) closeModal();
  else if (S.page !== 'home') nav('home');
};

window.notice = function (text) {
  $('toast').textContent = text;
  $('toast').style.display = 'block';
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => ($('toast').style.display = 'none'), 5000);
};
const notice = window.notice;

function modal(title, html) {
  $('modal').hidden = false;
  $('modal').innerHTML = '<div class="sheet"><button class="close" aria-label="Chiudi" onclick="closeModal()">×</button><h2>' + esc(title) + '</h2>' + html + '</div>';
  $('modal').scrollTop = 0;
}

function closeModal() {
  if (window.onModalClose) { const f = window.onModalClose; window.onModalClose = null; f(); }
  $('modal').hidden = true;
  $('modal').innerHTML = '';
}

/** Disegna la schermata attuale e la barra di navigazione. */
function render() {
  const screen = Screens[S.page] || Screens.home;
  $('app').innerHTML = '<div class="screenin">' + screen() + '</div>';
  const todoCount = S.todo.length;
  const gapCount = S.gaps ? S.gaps.gaps.filter(g => g.level !== 'minima' && g.level !== 'bassa').length : 0;
  const items = [
    ['home', '⌂', 'Home', 0], ['moves', '⇄', 'Movimenti', 0], ['todo', '✓', 'Da fare', todoCount],
    ['imports', '⤓', 'Importa', gapCount], ['reports', '▥', 'Analisi', 0], ['more', '☰', 'Altro', 0]
  ];
  $('nav').innerHTML = items.map(([p, i, l, n]) => '<button class="' + (S.page === p ? 'active' : '') + '" onclick="nav(\'' + p + '\')"><b>' + i + '</b>' + l
    + (n ? '<span class="count">' + (n > 99 ? '99+' : n) + '</span>' : '') + '</button>').join('');
  if (window.afterRender) window.afterRender();
}

// ---------------------------------------------------------------------
// Componenti comuni
// ---------------------------------------------------------------------

/** Movimenti del mese selezionato. */
function selected() {
  return S.data.transactions.filter(t => !S.month || t.date.startsWith(S.month));
}

function txById(id) {
  return S.data.transactions.find(t => t.id === id);
}

/** Contesto per i calcoli (collegamenti, tassonomia). */
function ctx() {
  return { links: S.data.links, all: S.data.transactions, taxonomy: S.tax };
}

function monthControl() {
  const ms = [...new Set(S.data.transactions.map(t => t.date.slice(0, 7)))].sort().reverse();
  const covered = S.month ? G.monthCovered(S.month, S.data.imports) : null;
  return '<div class="selectbar"><select aria-label="Periodo" onchange="S.month=this.value;render()"><option value="">Tutti i periodi</option>'
    + ms.map(m => '<option ' + (m === S.month ? 'selected' : '') + ' value="' + m + '">' + esc(monthName(m)) + '</option>').join('')
    + '</select><span>' + (S.month ? (covered ? 'Periodo coperto dai file' : 'Mese parziale') : 'Tutto lo storico') + '</span></div>';
}

/** Una riga movimento (tocca per aprire il dettaglio). */
function txrow(t, extra) {
  if (!t) return '';
  const glyph = t.source === 'manual' ? '💶' : t.kind === 'withdrawal' ? '🏧' : t.kind === 'transfer' ? '⇆' : t.cents > 0 ? '↙' : '↗';
  const fam = C.familyOf(t, S.tax);
  const label = (fam ? fam + ' › ' : '') + (t.category || 'Da classificare');
  const miss = C.missingInfo(t, S.tax);
  return '<div class="tx" role="button" tabindex="0" onclick="detail(' + t.id + ')" onkeydown="if(event.key===\'Enter\')detail(' + t.id + ')">'
    + '<div class="txicon">' + glyph + '</div><div class="txmain"><strong>' + esc(t.details || t.operation) + '</strong>'
    + '<small>' + fmt(t.date) + ' · ' + esc(label) + (U.account(t) ? ' · ' + esc(U.account(t)) : '') + '</small>'
    + (t.status === 'NO' ? '<small class="orange">' + (t.state === 'replaced' ? 'Riconciliato' : 'In attesa') + '</small>' : '')
    + (t.state === 'excluded' ? '<small class="red">Escluso dai totali</small>' : '')
    + (miss.length && t.state === 'active' ? '<small class="orange">Manca: ' + miss.map(m => MISSING_LABEL[m]).join(', ') + '</small>' : '')
    + (extra || '') + '</div><div class="amount ' + (t.cents > 0 ? 'green' : '') + '">' + eur(t.cents) + '</div></div>';
}

/** Grafico a barre mensile entrate/spese (ultimi 6 mesi). */
function chart(months) {
  if (!months.length) return '';
  const a = months.slice(-6);
  const max = Math.max(1, ...a.flatMap(m => [Math.max(0, m.income), Math.max(0, m.expense)]));
  const w = 300 / a.length;
  return '<div class="legend"><span><i class="dot" style="background:#406f65"></i>Entrate</span><span><i class="dot" style="background:#e6bc79"></i>Spese</span></div>'
    + '<svg class="chart" viewBox="0 0 300 145" role="img" aria-label="Confronto mensile entrate e spese">'
    + a.map((m, i) => {
      const x = i * w + w * 0.15, ih = Math.max(0, m.income) / max * 104, eh = Math.max(0, m.expense) / max * 104;
      return '<rect x="' + x + '" y="' + (114 - ih) + '" width="' + w * 0.28 + '" height="' + ih + '" rx="4" fill="#406f65"/>'
        + '<rect x="' + (x + w * 0.32) + '" y="' + (114 - eh) + '" width="' + w * 0.28 + '" height="' + eh + '" rx="4" fill="#e6bc79"/>'
        + '<text x="' + (i * w + w / 2) + '" y="137" text-anchor="middle" fill="#71827c" font-size="10">' + m.month.slice(5) + '/' + m.month.slice(2, 4) + '</text>';
    }).join('') + '</svg>';
}

const PALETTE = ['#476f65', '#7f9c76', '#c3bb82', '#a3b9ae', '#d39a6a', '#8fb3c6', '#b9a3c9', '#e2c46f', '#9aa88a', '#c48b8b'];

/** Barre orizzontali [etichetta, valore]. onClick opzionale: nome funzione JS. */
function bars(entries, onClick, fmtValue) {
  const max = Math.max(1, ...entries.map(x => x[1]));
  const f = fmtValue || eur;
  return entries.map(([k, v], i) => '<div class="barrow"' + (onClick ? ' role="button" onclick="' + onClick + '(' + jsArg(k) + ')"' : '') + '>'
    + '<div class="row"><span>' + esc(k) + '</span><strong>' + f(v) + '</strong></div>'
    + '<div class="track"><div class="fill" style="width:' + Math.max(0, v / max * 100) + '%;background:' + PALETTE[i % PALETTE.length] + '"></div></div></div>').join('');
}

/** Grafico a ciambella con legenda. */
function donut(entries) {
  const total = entries.reduce((s, e) => s + Math.max(0, e[1]), 0);
  if (!total) return '';
  let angle = -Math.PI / 2;
  const arcs = entries.slice(0, 8).map(([k, v], i) => {
    const a = Math.max(0, v) / total * Math.PI * 2;
    const x1 = 70 + 60 * Math.cos(angle), y1 = 70 + 60 * Math.sin(angle);
    angle += a;
    const x2 = 70 + 60 * Math.cos(angle), y2 = 70 + 60 * Math.sin(angle);
    return '<path d="M70 70 L' + x1 + ' ' + y1 + ' A60 60 0 ' + (a > Math.PI ? 1 : 0) + ' 1 ' + x2 + ' ' + y2 + ' Z" fill="' + PALETTE[i % PALETTE.length] + '"/>';
  }).join('');
  return '<div class="donut-wrap"><svg class="donut" viewBox="0 0 140 140">' + arcs + '<circle cx="70" cy="70" r="36" fill="#fff"/></svg><div class="legend" style="flex-direction:column;gap:6px">'
    + entries.slice(0, 8).map(([k, v], i) => '<span><i class="dot" style="background:' + PALETTE[i % PALETTE.length] + '"></i>' + esc(k) + ' · ' + Math.round(v / total * 100) + '%</span>').join('') + '</div></div>';
}

function level(l) {
  return '<span class="lvl ' + esc(l) + '">' + esc(l) + '</span>';
}

// ---------------------------------------------------------------------
// Scelta famiglia/categoria e conto (usate in molte finestre)
// ---------------------------------------------------------------------

/** Menu a tendina "Famiglia › Categoria" con possibilità di crearne una nuova. */
function catSelect(id, family, category) {
  let found = false;
  let html = '<select id="' + id + '" onchange="$(\'' + id + '_new\').hidden=this.value!==\'__new\'"><option value="">— Scegli famiglia › categoria —</option>';
  for (const f of S.tax) {
    html += '<optgroup label="' + esc(f.family) + '">' + f.categories.map(c => {
      const sel = category && U.norm(c) === U.norm(category) && (!family || family === f.family) && !found;
      if (sel) found = true;
      return '<option value="' + esc(f.family + '||' + c) + '"' + (sel ? ' selected' : '') + '>' + esc(c) + '</option>';
    }).join('') + '</optgroup>';
  }
  if (category && !found) {
    html += '<optgroup label="Attuale (non in elenco)"><option selected value="' + esc((family || '') + '||' + category) + '">' + esc(category) + (family ? ' (' + esc(family) + ')' : ' (senza famiglia)') + '</option></optgroup>';
  }
  html += '<option value="__new">➕ Nuova categoria…</option></select>';
  html += '<div id="' + id + '_new" hidden><label class="field">Famiglia della nuova categoria<select id="' + id + '_nf">'
    + S.tax.map(f => '<option>' + esc(f.family) + '</option>').join('') + '<option value="__nf">➕ Nuova famiglia…</option></select></label>'
    + '<label class="field">Nome nuova famiglia (solo se scelta sopra)<input id="' + id + '_nfn" placeholder="Es. Lavoro"></label>'
    + '<label class="field">Nome nuova categoria<input id="' + id + '_nc" placeholder="Es. Corsi di formazione"></label></div>';
  return html;
}

/** Legge la scelta del menu: { family, category } oppure null se vuoto. */
function readCat(id) {
  const v = $(id).value;
  if (!v) return null;
  if (v === '__new') {
    let family = $(id + '_nf').value;
    if (family === '__nf') family = $(id + '_nfn').value.trim();
    const category = $(id + '_nc').value.trim();
    if (!family || !category) { notice('Indica famiglia e nome della nuova categoria'); return undefined; }
    ensureTaxonomy(family, category);
    return { family, category };
  }
  const [family, category] = v.split('||');
  return { family, category };
}

/** Aggiunge (se manca) una categoria a una famiglia nella tassonomia salvata. */
function ensureTaxonomy(family, category) {
  const tax = JSON.parse(JSON.stringify(S.tax));
  let f = tax.find(x => x.family === family);
  if (!f) { f = { family, categories: [] }; tax.push(f); }
  if (category && !f.categories.some(c => U.norm(c) === U.norm(category))) f.categories.push(category);
  put('taxonomy', tax);
  S.tax = tax;
}

/** Conti/carte conosciuti (dalla banca e indicati da te). */
function knownAccounts() {
  const set = new Set(['Contanti']);
  for (const t of S.data.transactions) { if (t.account) set.add(t.account); if (t.accountUser) set.add(t.accountUser); }
  return [...set].sort();
}

function accountSelect(id, current) {
  const list = knownAccounts();
  return '<select id="' + id + '" onchange="$(\'' + id + '_new\').hidden=this.value!==\'__new\'"><option value="">— Non indicato —</option>'
    + list.map(a => '<option ' + (a === current ? 'selected' : '') + '>' + esc(a) + '</option>').join('')
    + '<option value="__new">➕ Altro conto o carta…</option></select><input id="' + id + '_new" hidden placeholder="Es. Carta Visa *1234" style="margin-top:8px">';
}

function readAccount(id) {
  const v = $(id).value;
  return v === '__new' ? $(id + '_new').value.trim() : v;
}

// ---------------------------------------------------------------------
// Classificazione e "ricordare la scelta"
// ---------------------------------------------------------------------

/**
 * Applica una classificazione scelta da te a uno o più movimenti.
 * set = { family, category, kind, accountUser, person, note }
 * Se ask è vero, dopo chiede se creare una regola per le prossime volte.
 */
function classify(ids, set, ask) {
  const clean = {};
  for (const k in set) if (set[k] !== undefined) clean[k] = set[k];
  if (ids.length === 1) act('edit', Object.assign({ id: ids[0], classifiedBy: 'user' }, clean));
  else act('bulkEdit', { items: ids.map(id => Object.assign({ id, classifiedBy: 'user' }, clean)), reason: 'Classificazione manuale' });
  if (ask && (clean.category || clean.family || clean.accountUser)) setTimeout(() => askRemember(txById(ids[0]), clean), 250);
}

/**
 * Chiede: "Vuoi che le prossime volte i movimenti simili vengano classificati
 * automaticamente così?" e, se sì, crea una regola.
 */
function askRemember(t, set) {
  if (!t) return;
  const key = C.merchantKey(t);
  if (pref('noRuleAsk', []).includes(key)) return;
  const existing = C.ruleFor(t, pref('rules', []));
  if (existing && existing.set.category === set.category && (existing.set.family || '') === (set.family || '')) return;
  const rule = C.ruleFromTx(t, { family: set.family, category: set.category, kind: set.kind, accountUser: t.account ? '' : set.accountUser });
  const dict = C.dictionaryMatch(t);
  if (dict && dict.category === set.category) rule.text = dict.keyword;
  window.pendingRule = rule;
  const similar = S.data.transactions.filter(x => x.id !== t.id && C.ruleMatches(rule, x)).length;
  modal('Ricordare questa scelta?', '<p class="sub">Vuoi che le prossime volte i movimenti simili vengano messi in automatico in <b>'
    + esc((set.family ? set.family + ' › ' : '') + (set.category || '')) + '</b>' + (set.accountUser ? ' con conto <b>' + esc(set.accountUser) + '</b>' : '') + '?</p>'
    + '<label class="field">La descrizione contiene (puoi scrivere più parole separate da | )<input id="rText" value="' + esc(rule.text) + '" oninput="previewRule()"></label>'
    + (set.category === 'AI' ? '<p class="mini">Esempio: <b>anthropic|claude|openai|chatgpt|gemini</b> copre tutti gli abbonamenti AI.</p>' : '')
    + '<p class="sub" id="rPreview">' + similar + ' altri movimenti già presenti corrispondono.</p>'
    + '<label class="check"><input type="checkbox" id="rApply" checked> Applica subito anche ai movimenti già presenti (non tocca quelli classificati a mano)</label>'
    + '<button class="btn wide" onclick="confirmRule()">Sì, crea la regola</button>'
    + '<div class="actions"><button class="btn secondary" onclick="closeModal()">No, solo questa volta</button>'
    + '<button class="btn secondary" onclick="neverAsk(' + jsArg(key) + ')">Non chiedere più</button></div>');
}

function previewRule() {
  const r = Object.assign({}, window.pendingRule, { text: $('rText').value });
  $('rPreview').textContent = C.ruleMatchesCount(r, S.data.transactions) + ' movimenti già presenti corrispondono.';
}

function confirmRule() {
  const r = window.pendingRule;
  r.text = $('rText').value.trim();
  if (!r.text) { notice('Scrivi almeno una parola'); return; }
  r.name = r.text.split(/[|,]/)[0];
  // Se non vuoi toccare i movimenti già presenti, la regola vale solo per quelli futuri
  if (!$('rApply').checked) r.afterId = Math.max(0, ...S.data.transactions.map(t => t.id));
  put('rules', pref('rules', []).concat([r])); // le regole si applicano da sole al prossimo aggiornamento
  closeModal();
  notice('Regola creata: "' + r.name + '" → ' + (r.set.category || ''));
}

function neverAsk(key) {
  put('noRuleAsk', pref('noRuleAsk', []).concat([key]));
  closeModal();
}

// ---------------------------------------------------------------------
// Avvio
// ---------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  if (!window.Native && window.Demo) {
    document.body.insertAdjacentHTML('afterbegin', '<div class="demo-banner">ANTEPRIMA DIMOSTRATIVA con dati inventati · i dati veri restano solo nell\'app Android</div>');
    window.Demo.start();
  } else {
    render();
  }
});
