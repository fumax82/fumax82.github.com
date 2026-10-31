/*
 * forecast.js - SPESE FISSE E PREVISIONI (menu Altro › Futuro).
 *
 * L'elenco delle spese che tornano (mutuo, bollette, RCA, ferie, cambio
 * auto...) e dei BONUS che le compensano, ognuno con la sua periodicità.
 * L'app calcola quanto pesa ogni voce al mese e quanto mettere da parte per
 * le spese non mensili. Famiglie e categorie sono le stesse dei movimenti:
 * così in Analisi › Previsioni si può confrontare il previsto con il reale.
 *
 * Le voci stanno in prefs.forecast (vedi logic/forecast.js per i campi).
 * Modi per riempire l'elenco:
 *   - "Incolla un elenco": una voce per riga, con intestazioni come
 *     "Mensile", "Annuale", "BONUS:" (l'app capisce importi e periodicità)
 *   - "Dalle spese ricorrenti": i pagamenti regolari trovati nei movimenti
 *   - "＋ Nuova voce": a mano
 */
'use strict';

const FC_MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

function fcItems() {
  return pref('forecast', []);
}

function fcStore(items) {
  put('forecast', items);
  render();
}

/** Euro da centesimi anche con i decimali (le quote mensili non sono intere). */
const fcEur = c => eur(Math.round(c));

Screens.forecast = function () {
  const items = fcItems();
  if (!items.length) return fcEmpty();
  const t = FC.totals(items);
  const tab = S.sub.fcTab || 'expense';
  const byFamily = S.sub.fcGroup === 'family';
  const list = items.filter(it => (tab === 'bonus') === (it.section === 'bonus'));
  const count = s => items.filter(it => (s === 'bonus') === (it.section === 'bonus')).length;

  return '<span class="eyebrow">UNA BASE REALE PER IL FUTURO</span><h1>Spese fisse e previsioni</h1>'
    + '<section class="hero"><div class="row"><span class="eyebrow">USCITE PREVISTE AL MESE</span><span class="badge light">' + fcEur(t.out * 12) + ' all\'anno</span></div>'
    + '<div class="big">' + fcEur(t.out) + '</div>'
    + '<div class="sub">Spese ' + fcEur(t.expense) + (t.saving ? ' + accantonamenti e investimenti ' + fcEur(t.saving) : '') + '</div>'
    + '<div class="line"><div><span class="eyebrow">BONUS</span><strong class="green">− ' + fcEur(t.bonus) + '</strong></div>'
    + '<div><span class="eyebrow">NETTO AL MESE</span><strong>' + fcEur(t.net) + '</strong></div></div></section>'
    + (t.setAside ? '<div class="hint">Delle uscite mensili, <b>' + fcEur(t.setAside) + '</b> sono la quota delle spese <b>non mensili</b> (assicurazioni, ferie, auto...): '
      + 'è quanto mettere da parte ogni mese per non avere sorprese.</div>' : '')
    + '<button class="btn gold wide" onclick="nav(\'reports\',\'forecast\')">⚖ Confronta con i movimenti reali</button>'
    + '<div class="tabs seg" style="margin-top:16px">' + [['expense', 'Spese (' + count('expense') + ')'], ['bonus', 'Bonus (' + count('bonus') + ')']]
      .map(([v, l]) => '<button class="' + (tab === v ? 'on' : '') + '" onclick="S.sub.fcTab=\'' + v + '\';render()">' + l + '</button>').join('') + '</div>'
    + (tab === 'expense' ? '<div class="row" style="justify-content:flex-start;gap:8px"><span class="mini">Raggruppa:</span>'
      + [['period', 'per periodicità'], ['family', 'per famiglia']].map(([v, l]) => '<button class="chip pick' + ((v === 'family') === byFamily ? ' ok' : '') + '" onclick="S.sub.fcGroup=\'' + v + '\';render()">' + l + '</button>').join('') + '</div>' : '')
    + fcGroups(list, tab === 'expense' && byFamily)
    + '<div class="actions"><button class="btn" onclick="fcEdit(\'\',\'' + tab + '\')">＋ ' + (tab === 'bonus' ? 'Nuovo bonus' : 'Nuova spesa') + '</button>'
    + '<button class="btn secondary" onclick="fcPaste()">📋 Incolla un elenco</button></div>'
    + '<button class="btn secondary wide" onclick="fcFromRecurring()">↻ Aggiungi dalle spese ricorrenti dei movimenti</button>'
    + '<p class="mini">Tocca una voce per cambiare importo, periodicità, famiglia o note. La spunta a sinistra la include o la esclude dai calcoli: utile per fare delle prove ("e se non ci fosse l\'affitto?").</p>';
};

/** Voci raggruppate per periodicità (come le scrivi) oppure per famiglia. */
function fcGroups(list, byFamily) {
  if (!list.length) return '<p class="sub">Nessuna voce. Aggiungine una con i pulsanti qui sotto.</p>';
  const groups = new Map();
  const keyOf = it => (byFamily ? it.family || 'Senza famiglia' : FC.groupOf(it.every));
  const order = byFamily ? null : FC.GROUPS.map(g => g[0]);
  for (const it of list) {
    const k = keyOf(it);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(it);
  }
  const keys = [...groups.keys()].sort((a, b) => (order ? order.indexOf(a) - order.indexOf(b)
    : U.sum(groups.get(b), it => (FC.isOn(it) ? FC.monthly(it) : 0)) - U.sum(groups.get(a), it => (FC.isOn(it) ? FC.monthly(it) : 0))));
  return keys.map(k => {
    const rows = groups.get(k).slice().sort((a, b) => FC.monthly(b) - FC.monthly(a));
    const month = U.sum(rows.filter(FC.isOn), FC.monthly);
    return '<div class="row fc-group"><h3>' + (byFamily ? familyIcon(k) + ' ' : '') + esc(k) + '</h3><span class="mini">' + fcEur(month) + ' al mese · ' + fcEur(month * 12) + ' all\'anno</span></div>'
      + '<div class="card" style="margin-top:6px">' + rows.map(fcRow).join('') + '</div>';
  }).join('');
}

/** Una voce: spunta (inclusa/esclusa), nome, famiglia, importo e quota mensile. */
function fcRow(it) {
  const bonus = it.section === 'bonus';
  const where = it.category ? (it.family ? it.family + ' › ' : '') + it.category : 'famiglia da scegliere';
  return '<div class="tx fc-row' + (FC.isOn(it) ? '' : ' off') + '" role="button" onclick="fcEdit(' + jsArg(it.id) + ')">'
    + '<label class="fc-on" onclick="event.stopPropagation()"><input type="checkbox" aria-label="Includi nei calcoli"' + (it.active !== false ? ' checked' : '')
    + ' onchange="fcToggle(' + jsArg(it.id) + ',this.checked)"></label>'
    + '<div class="txmain"><strong>' + esc(it.name) + '</strong>'
    + '<small' + (it.category ? '' : ' class="orange"') + '>' + familyIcon(it.family) + ' ' + esc(where) + (it.kind === 'saving' ? ' · accantonamento' : '')
    + (it.month && it.every > 1 && it.every <= 12 ? ' · ' + FC_MONTHS[it.month - 1] : '') + '</small>'
    + (it.note ? '<small>' + esc(it.note) + '</small>' : '') + '</div>'
    + '<div class="amount fc-amount' + (bonus ? ' green' : '') + '">' + (bonus ? '+' : '') + eur(it.amount)
    + '<small>' + (it.every === 1 ? 'al mese' : esc(FC.periodName(it.every).toLowerCase()) + '<br>= ' + fcEur(FC.monthly(it)) + '/mese') + '</small></div></div>';
}

function fcToggle(id, on) {
  fcStore(fcItems().map(it => (it.id === id ? Object.assign({}, it, { active: on }) : it)));
}

function fcEmpty() {
  return '<span class="eyebrow">UNA BASE REALE PER IL FUTURO</span><h1>Spese fisse e previsioni</h1>'
    + '<div class="empty"><div class="glyph">📅</div><h2>Le spese che tornano</h2><p class="sub">Mutuo, bollette, assicurazioni, ferie, cambio dell\'auto... '
    + 'Elencale con la loro periodicità, insieme ai bonus che le compensano: l\'app calcola quanto pesano al mese e le confronta con i tuoi movimenti reali.</p></div>'
    + '<button class="btn wide" onclick="fcPaste()">📋 Incolla un elenco</button>'
    + '<button class="btn secondary wide" onclick="fcFromRecurring()">↻ Parti dalle spese ricorrenti dei movimenti</button>'
    + '<button class="btn secondary wide" onclick="fcEdit(\'\',\'expense\')">＋ Aggiungi una voce a mano</button>';
}

// ---------------------------------------------------------------------
// Modifica di una voce
// ---------------------------------------------------------------------

function fcEdit(id, section) {
  const bonus0 = section === 'bonus';
  const it = fcItems().find(x => x.id === id)
    || { id: '', name: '', section: bonus0 ? 'bonus' : 'expense', kind: bonus0 ? 'income' : 'expense', amount: 0, every: 1, month: 0, family: '', category: '', match: '', note: '', active: true };
  const bonus = it.section === 'bonus';
  window.fcEditing = it;
  const periods = FC.PERIODS.some(p => p[0] === it.every) ? FC.PERIODS : FC.PERIODS.concat([[it.every, FC.periodName(it.every)]]);
  modal(it.id ? it.name : bonus ? 'Nuovo bonus' : 'Nuova spesa',
    '<label class="field">Nome<input id="fcName" value="' + esc(it.name) + '" placeholder="' + (bonus ? 'es. Assegno unico' : 'es. Bollo auto') + '"' + (it.id ? '' : ' onchange="fcGuessCat()"') + '></label>'
    + '<div class="grid"><label class="field">Importo di ogni ' + (bonus ? 'incasso' : 'pagamento') + ' €<input id="fcAmount" type="number" min="0" step="0.01" inputmode="decimal" value="' + (it.amount ? it.amount / 100 : '') + '" oninput="fcLive()"></label>'
    + '<label class="field">Ogni quanto<select id="fcEvery" onchange="fcLive()">' + periods.map(([v, l]) => '<option value="' + v + '"' + (v === it.every ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select></label></div>'
    + '<p class="mini" id="fcMonthly"></p>'
    + '<label class="field" id="fcMonthBox">Mese del pagamento (facoltativo: mostra i mesi più pesanti)<select id="fcMonth"><option value="0">Non indicato: quota distribuita sui mesi</option>'
    + FC_MONTHS.map((m, i) => '<option value="' + (i + 1) + '"' + (it.month === i + 1 ? ' selected' : '') + '>' + m + '</option>').join('') + '</select></label>'
    + '<label class="field">Famiglia › categoria (le stesse dei movimenti)' + catSelect('fcCat', it.family, it.category) + '</label>'
    + (bonus ? '' : '<label class="field">Tipo<select id="fcKind"><option value="expense">Spesa</option><option value="saving"' + (it.kind === 'saving' ? ' selected' : '') + '>Accantonamento o investimento</option></select></label>')
    + '<label class="field">Parole per ritrovarla nei movimenti (facoltativo)<input id="fcMatch" value="' + esc(it.match || '') + '" placeholder="es. telepass · anthropic, openai"></label>'
    + '<label class="field">Note<input id="fcNote" value="' + esc(it.note || '') + '"></label>'
    + '<label class="check"><input type="checkbox" id="fcActive"' + (it.active !== false ? ' checked' : '') + '><span>Inclusa nei calcoli</span></label>'
    + '<button class="btn wide" onclick="fcSaveEdit()">Salva</button>'
    + (it.id ? '<div class="actions"><button class="btn secondary" onclick="fcDuplicate()">Duplica</button><button class="btn danger" onclick="fcDelete()">Elimina</button></div>' : ''));
  fcLive();
}

/** Mentre scrivi: quanto pesa la voce al mese e all'anno. */
function fcLive() {
  const amount = Math.round(Number($('fcAmount').value) * 100) || 0, every = Number($('fcEvery').value) || 1;
  $('fcMonthly').innerHTML = amount ? '= <b>' + fcEur(amount / every) + ' al mese</b> · ' + fcEur(amount * 12 / every) + ' all\'anno' : '';
  $('fcMonthBox').hidden = every === 1 || every > 12;
}

/** Nuova voce: propone famiglia e categoria dal nome. */
function fcGuessCat() {
  const cur = readCat('fcCat');
  if (cur && cur.category) return;
  const g = FC.guess($('fcName').value, window.fcEditing.section, S.tax);
  if (!g.category) return;
  setCat('fcCat', g.family, g.category);              // se è nuova, la categoria viene creata al salvataggio
  if ($('fcKind')) $('fcKind').value = g.kind === 'saving' ? 'saving' : 'expense';
}

function fcSaveEdit() {
  const base = window.fcEditing;
  const name = $('fcName').value.trim();
  const amount = Math.round(Number($('fcAmount').value) * 100);
  if (!name) { notice('Scrivi il nome della voce'); return; }
  if (!Number.isFinite(amount) || amount < 0) { notice('Importo non valido'); return; }
  const cat = readCat('fcCat') || { family: '', category: '' };
  if (cat.category) fcEnsureCategories([cat]);
  const every = Number($('fcEvery').value) || 1;
  const it = Object.assign({}, base, {
    id: base.id || U.uid(), name, amount, every,
    month: every > 1 && every <= 12 ? Number($('fcMonth').value) || 0 : 0,
    family: cat.family || '', category: cat.category || '',
    kind: base.section === 'bonus' ? 'income' : $('fcKind').value,
    match: $('fcMatch').value.trim(), note: $('fcNote').value.trim(), active: $('fcActive').checked
  });
  const items = fcItems();
  const i = items.findIndex(x => x.id === it.id);
  closeModal();
  fcStore(i >= 0 ? items.map(x => (x.id === it.id ? it : x)) : items.concat([it]));
  notice(i >= 0 ? 'Voce aggiornata' : 'Voce aggiunta');
}

function fcDuplicate() {
  const copy = Object.assign({}, window.fcEditing, { id: U.uid(), name: window.fcEditing.name + ' (copia)' });
  closeModal();
  fcStore(fcItems().concat([copy]));
  fcEdit(copy.id);
}

function fcDelete() {
  const it = window.fcEditing;
  if (!confirm('Eliminare "' + it.name + '"?')) return;
  closeModal();
  fcStore(fcItems().filter(x => x.id !== it.id));
}

// ---------------------------------------------------------------------
// Incolla un elenco
// ---------------------------------------------------------------------

function fcPaste() {
  modal('Incolla un elenco', '<p class="sub">Una voce per riga, con nome e importo. Le intestazioni indicano la periodicità delle voci che seguono; '
    + 'le frasi senza importo vengono ignorate, quindi puoi incollare anche un messaggio intero.</p>'
    + '<pre class="detail mini">Mensile\nMutuo — 600 €\nBolletta luce — 70 €\nAnnuale\nRCA — 450 €\nGomme — 600 € ogni 4 anni\nFerie — 2.000 € (una volta l\'anno)\nBONUS:\nAssegno unico +140€ mese</pre>'
    + '<label class="field">Elenco<textarea id="fcText" rows="10" placeholder="Incolla qui"></textarea></label>'
    + '<button class="btn wide" onclick="fcPreview()">Leggi l\'elenco</button>');
}

/** Mostra le voci lette, con famiglia proposta: confermi quelle da aggiungere. */
function fcPreview() {
  const parsed = FC.parseList($('fcText').value).map(p => Object.assign(p, FC.guess(p.name, p.section, S.tax)));
  if (!parsed.length) { notice('Nessuna voce trovata: scrivi una voce per riga, es. "Mutuo — 600 €"'); return; }
  window.fcParsed = parsed;
  const existing = fcItems().length;
  const created = [...new Set(parsed.filter(p => p.isNew).map(p => p.family + ' › ' + p.category))];
  modal('Voci trovate: ' + parsed.length, '<p class="sub">Controlla e togli la spunta a quelle da non aggiungere. Importi, periodicità e famiglie si possono cambiare anche dopo.</p>'
    + (created.length ? '<div class="hint">Nuove categorie, che potrai usare anche per i movimenti: <b>' + created.map(esc).join(', ') + '</b></div>' : '')
    + (existing ? '<label class="check"><input type="checkbox" id="fcReplace"><span>Sostituisci le ' + existing + ' voci che hai già (altrimenti le nuove si aggiungono)</span></label>' : '')
    + parsed.map((p, i) => '<label class="check fc-prev"><input type="checkbox" class="fcp" data-i="' + i + '" checked><span><b>' + esc(p.name) + '</b> · '
      + (p.section === 'bonus' ? '<span class="green">+' + eur(p.amount) + '</span>' : eur(p.amount)) + ' ' + esc(FC.periodName(p.every).toLowerCase())
      + (p.every > 1 ? ' <span class="mini">(= ' + fcEur(FC.monthly(p)) + '/mese)</span>' : '')
      + '<br><span class="mini">' + (p.category ? familyIcon(p.family) + ' ' + esc(p.family + ' › ' + p.category) + (p.isNew ? ' (nuova)' : '') : '<span class="orange">famiglia da scegliere</span>')
      + (p.kind === 'saving' ? ' · accantonamento' : '') + (p.note ? ' · ' + esc(p.note) : '') + (p.amount ? '' : ' · <span class="orange">senza importo: esclusa dai calcoli</span>') + '</span></span></label>').join('')
    + '<button class="btn wide" onclick="fcImport()">Aggiungi le voci selezionate</button>');
}

function fcImport() {
  const chosen = [...document.querySelectorAll('.fcp')].filter(c => c.checked).map(c => window.fcParsed[+c.dataset.i]);
  if (!chosen.length) { notice('Nessuna voce selezionata'); return; }
  fcEnsureCategories(chosen);
  const keep = $('fcReplace') && $('fcReplace').checked ? [] : fcItems();
  const added = chosen.map(p => ({
    id: U.uid(), name: p.name, section: p.section, kind: p.kind, amount: p.amount, every: p.every, month: 0,
    family: p.family, category: p.category, match: '', note: p.note, active: p.active
  }));
  closeModal();
  S.sub.fcTab = 'expense';
  fcStore(keep.concat(added));
  notice(added.length + ' voci aggiunte');
}

/** Crea in un colpo solo le categorie (e famiglie) che mancano nella tassonomia. */
function fcEnsureCategories(list) {
  const tax = JSON.parse(JSON.stringify(S.tax));
  let changed = false;
  for (const p of list) {
    if (!p.category) continue;
    let f = tax.find(x => x.family === p.family);
    if (!f) { f = { family: p.family, categories: [] }; tax.push(f); changed = true; }
    if (!f.categories.some(c => U.norm(c) === U.norm(p.category))) { f.categories.push(p.category); changed = true; }
  }
  if (changed) { put('taxonomy', tax); S.tax = tax; }
}

// ---------------------------------------------------------------------
// Dalle spese ricorrenti trovate nei movimenti
// ---------------------------------------------------------------------

function fcFromRecurring() {
  const names = new Set(fcItems().map(it => U.norm(it.name)));
  const matches = new Set(fcItems().map(it => U.norm(it.match)).filter(Boolean));
  const props = C.recurringGroups(S.data.transactions, S.prefs)
    .filter(g => FC.CADENCE_EVERY[g.cadence] && !matches.has(U.norm(g.token)))
    .map(g => {
      const t = txById(g.ids[g.ids.length - 1]);
      let every = FC.CADENCE_EVERY[g.cadence], amount = g.typical;
      if (every === -1) { every = 1; amount = Math.round(g.typical * 52 / 12); }
      const section = g.sign === 'in' ? 'bonus' : 'expense';
      return {
        name: title(t), section, kind: section === 'bonus' ? 'income' : 'expense', amount, every,
        family: C.familyOf(t, S.tax), category: t.category || '', match: g.token, count: g.count, stable: g.stable,
        note: g.count + ' pagamenti, l\'ultimo il ' + fmt(g.last)
      };
    })
    .filter(p => !names.has(U.norm(p.name)));
  if (!props.length) { notice('Nessuna nuova spesa ricorrente trovata nei movimenti'); return; }
  window.fcRec = props;
  const block = (title, list) => list.length ? '<h3>' + title + '</h3>' + list.map(p => {
    const i = props.indexOf(p);
    return '<label class="check fc-prev"><input type="checkbox" class="fcr" data-i="' + i + '"' + (p.section === 'expense' && p.stable ? ' checked' : '') + '><span><b>' + esc(p.name) + '</b> · '
      + eur(p.amount) + ' ' + esc(FC.periodName(p.every).toLowerCase()) + '<br><span class="mini">' + (p.category ? familyIcon(p.family) + ' ' + esc((p.family ? p.family + ' › ' : '') + p.category) : 'senza categoria')
      + ' · ' + esc(p.note) + (p.stable ? '' : ' · importo variabile') + '</span></span></label>';
  }).join('') : '';
  modal('Dalle spese ricorrenti', '<p class="sub">Pagamenti che si ripetono nei tuoi movimenti, con l\'importo tipico e la cadenza reale: la base più concreta per le previsioni. '
    + 'Ogni voce ricorda la parola con cui ritrovarla nei movimenti.</p>'
    + block('Uscite', props.filter(p => p.section === 'expense')) + block('Entrate (come bonus)', props.filter(p => p.section === 'bonus'))
    + '<button class="btn wide" onclick="fcAddRecurring()">Aggiungi le voci selezionate</button>');
}

function fcAddRecurring() {
  const chosen = [...document.querySelectorAll('.fcr')].filter(c => c.checked).map(c => window.fcRec[+c.dataset.i]);
  if (!chosen.length) { notice('Nessuna voce selezionata'); return; }
  const added = chosen.map(p => ({
    id: U.uid(), name: p.name, section: p.section, kind: p.kind, amount: p.amount, every: p.every, month: 0,
    family: p.family || '', category: p.category, match: p.match, note: p.note, active: true
  }));
  closeModal();
  fcStore(fcItems().concat(added));
  notice(added.length + ' voci aggiunte dalle spese ricorrenti');
}

// ---------------------------------------------------------------------
// Analisi › Previsioni: il previsto confrontato con il reale
// ---------------------------------------------------------------------

/** Giudizio → [etichetta, colore del badge]. */
const FC_VERDICT = {
  coherent: ['Coerente', 'ok'], optimistic: ['Ottimistica', 'red'], pessimistic: ['Pessimistica', 'info'],
  missing: ['Non prevista', 'warn'], unseen: ['Non trovata', ''], none: ['—', '']
};

function fcBadge(v) {
  const [label, cls] = FC_VERDICT[v.code];
  const pct = (v.code === 'optimistic' || v.code === 'pessimistic') && v.pct !== null ? ' ' + (v.pct > 0 ? '+' : '') + Math.round(v.pct * 100) + '%' : '';
  return '<span class="badge ' + cls + '">' + label + pct + '</span>';
}

/**
 * La scheda "Previsioni" dell'Analisi:
 *   1. giudizio generale: previsioni ottimistiche, pessimistiche o coerenti
 *   2. famiglia per famiglia (tocca per il dettaglio delle categorie)
 *   3. spese reali non previste e previste ma mai viste
 *   4. accantonamenti, bonus e voci con parole di ricerca
 *   5. il futuro: margine previsto, prossimi 12 mesi, quota da accantonare
 */
function forecastReportHtml() {
  const items = fcItems();
  if (!items.length) {
    return '<div class="empty"><div class="glyph">⚖</div><h2>Nessuna previsione</h2><p class="sub">Elenca le spese fisse e i bonus con la loro periodicità: qui li confronterai con i movimenti reali per capire se le previsioni sono ottimistiche, pessimistiche o coerenti.</p></div>'
      + '<button class="btn wide" onclick="nav(\'forecast\')">Crea le spese fisse e previsioni</button>';
  }
  const n = S.sub.fcMonths || 12;
  const win = FC.lastMonths(S.data.transactions, S.gaps, n, U.today());
  const chooser = '<div class="row" style="justify-content:flex-start;gap:6px;flex-wrap:wrap;margin-top:14px"><span class="mini">Confronta con gli ultimi</span>'
    + [3, 6, 12, 24].map(m => '<button class="chip pick' + (m === n ? ' ok' : '') + '" onclick="S.sub.fcMonths=' + m + ';render()">' + m + '</button>').join('') + '<span class="mini">mesi completi</span></div>';
  if (!win.months) return chooser + '<div class="hint warn">Serve almeno un mese completo di movimenti importati per il confronto.</div>';

  const r = FC.compare(items, S.data.transactions, ctx(), win, { excludeRare: !S.sub.fcRare });
  window.fcReport = r;
  const t = FC.totals(items);
  const v = r.expense.verdict;
  const word = { coherent: 'COERENTI', optimistic: 'OTTIMISTICHE', pessimistic: 'PESSIMISTICHE' }[v.code] || 'DA VERIFICARE';
  const pct = v.pct !== null ? Math.abs(Math.round(v.pct * 100)) + '%' : '';
  const sentence = v.code === 'optimistic' ? 'Spendi in media <b>' + fcEur(v.diff) + ' al mese in più</b> del previsto (' + pct + '): le previsioni sottostimano le spese.'
    : v.code === 'pessimistic' ? 'Spendi in media <b>' + fcEur(-v.diff) + ' al mese in meno</b> del previsto (' + pct + '): previsioni prudenti, con un margine di sicurezza.'
      : v.code === 'coherent' ? 'La spesa reale è entro il 10% del previsto: le previsioni descrivono bene le tue abitudini.'
        : 'Non ci sono ancora abbastanza dati per un giudizio.';
  const maxRow = Math.max(1, ...r.expense.rows.map(x => Math.max(x.forecast, x.actual)));

  return chooser
    + '<p class="mini">' + win.months + (win.months === 1 ? ' mese completo' : ' mesi completi') + ' dal ' + fmt(win.from) + ' al ' + fmt(win.to)
    + (win.skipped.length ? ' (escluso ' + esc(win.skipped.map(monthName).join(', ')) + ': buco tra le importazioni)' : '') + (win.months < n ? ', non ce ne sono di più' : '')
    + '. Tutti gli importi sono <b>al mese</b>; il reale è contato come nella Panoramica (spese + contanti non tracciati − rimborsi).</p>'
    + '<section class="hero fc-verdict"><span class="eyebrow">LE TUE PREVISIONI DI SPESA SONO</span><div class="big">' + word + '</div><div class="sub">' + sentence + '</div>'
    + '<div class="line"><div><span class="eyebrow">PREVISTO</span><strong>' + fcEur(r.expense.forecast) + '</strong></div><div><span class="eyebrow">REALE</span><strong>' + fcEur(r.expense.actual) + '</strong></div>'
    + '<div><span class="eyebrow">SCARTO</span><strong>' + (v.diff > 0 ? '+' : '') + fcEur(v.diff) + '</strong></div></div></section>'
    + (r.unclassifiedShare > 0.15 ? '<div class="hint warn">Il ' + Math.round(r.unclassifiedShare * 100) + '% della spesa reale è senza famiglia o in contanti non tracciati: il totale è affidabile, il dettaglio per famiglia meno. '
      + '<button class="link" onclick="nav(\'todo\')">Classifica i movimenti</button></div>' : '')
    + (r.rare.length ? '<div class="hint">' + (r.rareExcluded ? 'Escluse dal confronto' : 'Incluse nel confronto') + ' ' + r.rare.length + ' voci che si pagano più di rado di ' + win.months + ' mesi ('
      + esc(r.rare.slice(0, 3).map(it => it.name).join(', ')) + (r.rare.length > 3 ? '…' : '') + ', ' + fcEur(U.sum(r.rare, FC.monthly)) + ' al mese): '
      + (r.rareExcluded ? 'nel periodo potrebbero non essere mai capitate. ' : 'se non sono capitate nel periodo, la previsione sembra più alta del reale. ')
      + '<button class="link" onclick="S.sub.fcRare=' + (r.rareExcluded ? 'true' : 'false') + ';render()">' + (r.rareExcluded ? 'Includile' : 'Escludile') + '</button></div>' : '')

    // Famiglia per famiglia
    + '<div class="card"><h2>Spese per famiglia</h2><p class="sub">Barra chiara: previsto · barra colorata: reale. Tocca una famiglia per le categorie e i movimenti.</p>'
    + r.expense.rows.map((row, i) => fcCompareRow(row, i, 'expense', maxRow)).join('') + '</div>'

    // Non previste / non trovate
    + (r.unplanned.length ? '<div class="card warn"><h2>Spese reali non previste</h2><p class="sub">Famiglie in cui spendi ma senza voci di previsione: rendono le previsioni ottimistiche.</p>'
      + r.unplanned.map(row => '<div class="kpi row"><div>' + familyIcon(row.family) + ' <strong style="font-size:13px">' + esc(row.family) + '</strong><small class="mini" style="display:block">'
        + esc(row.cats.filter(c => c.actual > 0).slice(0, 3).map(c => c.category + ' ' + fcEur(c.actual)).join(' · ')) + '</small></div><div style="text-align:right"><b>' + fcEur(row.actual) + '</b><br>'
        + (row.family === 'Senza famiglia' || row.family === 'Contanti non tracciati'
          ? '<button class="link" onclick="nav(\'' + (row.family === 'Senza famiglia' ? 'todo' : 'cash') + '\')">' + (row.family === 'Senza famiglia' ? 'Classifica' : 'Traccia i contanti') + '</button>'
          : '<button class="link" onclick="fcAddFromActual(' + jsArg(row.family) + ')">＋ Aggiungi alle previsioni</button>') + '</div></div>').join('') + '</div>' : '')
    + (r.unseen.length ? '<div class="card"><h2>Previste ma non trovate</h2><p class="sub">Nessun movimento in queste famiglie negli ultimi ' + win.months + ' mesi: forse le paghi in contanti, i movimenti sono classificati altrove o la spesa non è ancora capitata.</p>'
      + r.unseen.map(row => '<div class="kpi row"><div>' + familyIcon(row.family) + ' <strong style="font-size:13px">' + esc(row.family) + '</strong><small class="mini" style="display:block">'
        + esc(row.items.map(it => it.name).join(', ')) + '</small></div><b>' + fcEur(row.forecast) + '</b></div>').join('') + '</div>' : '')

    // Accantonamenti e bonus
    + fcSideCard('Accantonamenti e investimenti', 'saving', r.saving, 'Ottimistica = metti da parte meno del previsto. Il reale sono i movimenti di tipo accantonamento o investimento.')
    + fcSideCard('Bonus ed entrate extra', 'bonus', r.bonus, 'Ottimistica = incassi meno del previsto. Il reale sono le entrate classificate nelle stesse categorie dei bonus (es. Entrate › Assegni e bonus).')

    // Voce per voce (solo voci con parole di ricerca)
    + (r.itemActual.length ? '<div class="card"><h2>Voce per voce</h2><p class="sub">Le voci con le parole per ritrovarle nei movimenti.</p>'
      + r.itemActual.map((x, i) => '<div class="kpi" role="button" onclick="showIds(' + jsArg(x.ids) + ',' + jsArg(x.item.name) + ')"><div class="row"><strong style="font-size:13px">' + esc(x.item.name) + '</strong>' + fcBadge(x.verdict) + '</div>'
        + '<p class="mini" style="margin:4px 0 0">Previsto ' + fcEur(x.forecast) + ' · reale ' + fcEur(x.actual) + ' · ' + x.ids.length + ' movimenti con "' + esc(x.item.match) + '"</p></div>').join('') + '</div>' : '')

    + fcFutureHtml(items, t, r)
    + '<button class="btn secondary wide" onclick="nav(\'forecast\')">Modifica le spese fisse e i bonus</button>';
}

/** Riquadro nella Panoramica dell'Analisi: il giudizio in breve. */
function fcOverviewCard() {
  const items = fcItems();
  if (!items.length) return '';
  const win = FC.lastMonths(S.data.transactions, S.gaps, 12, U.today());
  if (!win.months) return '';
  const r = FC.compare(items, S.data.transactions, ctx(), win, { excludeRare: true });
  return '<div class="card" role="button" onclick="S.sub.reports=\'forecast\';render()"><div class="row"><h3 style="margin:0">⚖ Previsioni di spesa</h3>' + fcBadge(r.expense.verdict) + '</div>'
    + '<p class="sub" style="margin:6px 0 0">Previsto ' + fcEur(r.expense.forecast) + ' · reale ' + fcEur(r.expense.actual) + ' al mese, ultimi ' + r.months + ' mesi completi →</p></div>';
}

/** Riga famiglia: previsto (barra chiara) e reale (barra colorata). */
function fcCompareRow(row, i, bucket, max) {
  return '<div class="fc-cmp" role="button" onclick="fcFamilyDetail(\'' + bucket + '\',' + i + ')">'
    + '<div class="row"><span>' + familyIcon(row.family) + ' <b>' + esc(row.family) + '</b></span>' + fcBadge(row.verdict) + '</div>'
    + '<div class="fc-bar"><span class="f" style="width:' + (row.forecast / max * 100) + '%"></span></div>'
    + '<div class="fc-bar"><span class="a ' + row.verdict.code + '" style="width:' + (row.actual / max * 100) + '%"></span></div>'
    + '<div class="row mini"><span>Previsto ' + fcEur(row.forecast) + '</span><span>Reale ' + fcEur(row.actual) + '</span></div></div>';
}

/** Accantonamenti o bonus: totale e righe per famiglia. */
function fcSideCard(title, bucket, part, explain) {
  if (!part.forecast && !part.actual) return '';
  const max = Math.max(1, ...part.rows.map(x => Math.max(x.forecast, x.actual)));
  return '<div class="card"><div class="row"><h2>' + title + '</h2>' + fcBadge(part.verdict) + '</div>'
    + '<p class="sub">Previsto ' + fcEur(part.forecast) + ' · reale ' + fcEur(part.actual) + ' al mese. ' + explain + '</p>'
    + part.rows.map((row, i) => fcCompareRow(row, i, bucket, max)).join('') + '</div>';
}

/** Dettaglio di una famiglia: categorie, voci previste, movimenti reali. */
function fcFamilyDetail(bucket, i) {
  const r = window.fcReport, row = r[bucket].rows[i];
  const why = {
    missing: 'spesa reale senza previsione', unseen: 'prevista ma nessun movimento: contanti, altra famiglia o non ancora capitata',
    optimistic: bucket === 'expense' ? 'spendi più del previsto' : 'meno del previsto', pessimistic: bucket === 'expense' ? 'spendi meno del previsto' : 'più del previsto', coherent: 'in linea', none: ''
  };
  modal(row.family, '<p class="sub">Importi al mese, media degli ultimi ' + r.months + ' mesi.</p>'
    + '<table><tr><th>Categoria</th><th>Previsto</th><th>Reale</th></tr>'
    + row.cats.map(c => '<tr><td>' + esc(c.category) + '<br>' + fcBadge(c.verdict) + ' <span class="mini">' + esc(why[c.verdict.code]) + '</span></td><td>' + fcEur(c.forecast) + '</td><td>' + fcEur(c.actual) + '</td></tr>').join('') + '</table>'
    + (row.items.length ? '<h3>Voci previste</h3>' + row.items.map(it => '<div class="kpi row"><div><strong style="font-size:13px">' + esc(it.name) + '</strong><small class="mini" style="display:block">'
      + eur(it.amount) + ' · ' + esc(FC.periodName(it.every).toLowerCase()) + ' · ' + esc(it.category) + '</small></div><b>' + fcEur(FC.monthly(it)) + '</b></div>').join('') : '')
    + (row.ids.length ? '<button class="btn secondary wide" onclick="showIds(' + jsArg(row.ids) + ',' + jsArg(row.family + ': movimenti reali') + ')">Vedi i ' + row.ids.length + ' movimenti reali</button>' : '')
    + '<button class="btn secondary wide" onclick="closeModal();S.sub.fcGroup=\'family\';S.sub.fcTab=\'' + (bucket === 'bonus' ? 'bonus' : 'expense') + '\';nav(\'forecast\')">Modifica le previsioni</button>');
}

/** Spesa reale non prevista → nuove voci mensili con la media reale. */
function fcAddFromActual(family) {
  const r = window.fcReport;
  const row = r.expense.rows.find(x => x.family === family);
  const cats = row.cats.filter(c => c.actual > 0);
  if (!confirm('Aggiungere alle previsioni ' + cats.length + (cats.length === 1 ? ' voce' : ' voci') + ' mensili di "' + family + '" con la media reale degli ultimi ' + r.months + ' mesi?\n\n'
    + cats.map(c => c.category + ': ' + fcEur(c.actual)).join('\n'))) return;
  const added = cats.map(c => ({
    id: U.uid(), name: c.category, section: 'expense', kind: 'expense', amount: Math.round(c.actual / 100) * 100, every: 1, month: 0,
    family, category: c.category, match: '', note: 'media reale degli ultimi ' + r.months + ' mesi', active: true
  }));
  fcStore(fcItems().concat(added));
  notice(added.length + ' voci aggiunte: puoi modificarle in Altro › Spese fisse e previsioni');
}

/** Il futuro: margine previsto, prossimi 12 mesi, quota da accantonare. */
function fcFutureHtml(items, t, r) {
  const otherIncome = Math.max(0, r.incomeAll - r.bonus.actual);
  const margin = otherIncome + t.bonus - t.out;
  const hh = pref('household', {});
  const declared = Number(hh.income) > 0 ? Math.round(Number(hh.income) * 100) : 0;
  const p = FC.projection(items, U.today().slice(0, 7), 12);
  const peaks = p.filter(x => x.due > 0).sort((a, b) => b.out - a.out).slice(0, 3);
  const sa = FC.setAsideList(items);
  const year = { out: U.sum(p, x => x.out), bonus: U.sum(p, x => x.bonus) };

  return '<div class="card"><h2>Il futuro con queste previsioni</h2><p class="sub">Entrate reali di oggi, uscite e bonus previsti: tutte le voci, anche le più rare.</p>'
    + kpi('Entrate reali, senza i bonus', 'media degli ultimi ' + r.months + ' mesi (stipendi e altre entrate)', '<strong>' + fcEur(otherIncome) + '</strong>')
    + kpi('+ Bonus previsti', 'assegni, aiuti, rimborsi', '<strong class="green">' + fcEur(t.bonus) + '</strong>')
    + kpi('− Uscite previste', 'spese ' + fcEur(t.expense) + (t.saving ? ' + accantonamenti ' + fcEur(t.saving) : ''), '<strong>' + fcEur(t.out) + '</strong>')
    + kpi('= Margine previsto al mese', margin >= 0 ? 'quanto resta, oltre agli accantonamenti' : 'quanto manca ogni mese', '<strong class="' + (margin < 0 ? 'red' : 'green') + '">' + fcEur(margin) + '</strong>')
    + (declared ? '<p class="mini">Con il reddito indicato nelle impostazioni (' + fcEur(declared) + ' al mese) il margine sarebbe ' + fcEur(declared + t.bonus - t.out) + ' al mese.</p>' : '')
    + (margin < 0 ? '<div class="hint warn">Con queste previsioni le uscite superano le entrate di ' + fcEur(-margin) + ' al mese (' + fcEur(-margin * 12) + ' all\'anno). Guarda le voci più pesanti o quelle escludibili.</div>' : '')
    + '</div>'

    + '<div class="card"><h2>Prossimi 12 mesi</h2><p class="sub">Uscite previste mese per mese: ' + fcEur(year.out) + ' in un anno, ' + fcEur(year.bonus) + ' di bonus. '
    + 'Le spese con il mese di pagamento indicato cadono nel loro mese, le altre sono divise sui mesi come quota da accantonare.</p>'
    + bars(p.map(x => [monthName(x.month), x.out]))
    + (peaks.length ? '<div class="hint warn">Mesi più pesanti: ' + peaks.map(x => '<b>' + esc(monthName(x.month)) + '</b> ' + fcEur(x.out) + ' (' + esc(x.dueItems.join(', ')) + ')').join(' · ') + '</div>'
      : '<p class="mini">Indica il mese di pagamento delle spese semestrali e annuali (RCA, bollo, IMU...) per vedere quali mesi saranno più pesanti.</p>')
    + '</div>'

    + (sa.length ? '<div class="card"><h2>Da mettere da parte ogni mese</h2><div class="value">' + fcEur(t.setAside) + '</div>'
      + '<p class="sub">Per pagare senza sorprese le spese che non sono mensili.</p>'
      + sa.slice(0, 8).map(x => '<div class="kpi row"><div><strong style="font-size:13px">' + esc(x.item.name) + '</strong><small class="mini" style="display:block">' + eur(x.item.amount) + ' · '
        + esc(FC.periodName(x.item.every).toLowerCase()) + '</small></div><b>' + fcEur(x.monthly) + '</b></div>').join('')
      + (sa.length > 8 ? '<p class="mini">… e altre ' + (sa.length - 8) + ' voci</p>' : '') + '</div>' : '');
}
