/*
 * moves.js - Elenco dei movimenti con ricerca e filtri, e finestra di
 * DETTAGLIO di un movimento (classificazione, collegamenti, regole).
 */
'use strict';

Screens.moves = function () {
  const q = U.norm(S.query);
  const a = selected()
    .filter(t => S.filterState === 'all' ? true : S.filterState === 'pending' ? (t.state === 'active' && t.status === 'NO')
      : S.filterState === 'missing' ? C.missingInfo(t, S.tax).length > 0 : t.state === S.filterState)
    .filter(t => !q || U.norm(t.operation + ' ' + t.details + ' ' + t.note + ' ' + t.category).includes(q))
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
  const accounts = knownAccounts();
  const families = [...new Set(S.data.transactions.map(t => C.familyOf(t, S.tax)).filter(Boolean))].sort();
  const cats = [...new Set(S.data.transactions.map(t => t.category).filter(Boolean))].sort();
  const persons = [...new Set(S.data.transactions.map(t => t.person).filter(Boolean))];
  const opts = (vals, cur, label) => '<option value="">' + esc(label) + '</option>' + vals.map(v => '<option ' + (v === cur ? 'selected' : '') + ' value="' + esc(v) + '">' + esc(v) + '</option>').join('');
  const active = [S.filterAccount, S.filterFamily, S.filterCat, S.filterPerson].concat(Object.values(S.filterExtra)).filter(Boolean).length + (S.filterState !== 'active' ? 1 : 0);

  return '<span class="eyebrow">TUTTO SOTTO CONTROLLO</span><h1>Movimenti</h1>' + monthControl()
    + '<label class="field">Cerca descrizione, note o categoria<input id="search" placeholder="Supermercato, mutuo, Anthropic…" value="' + esc(S.query) + '" onchange="S.query=this.value;render()"></label>'
    + '<details' + (active ? ' open' : '') + '><summary>Filtri' + (active ? ' (' + active + ' attivi)' : '') + '</summary>'
    + '<label class="field">Stato<select onchange="S.filterState=this.value;render()">'
    + [['active', 'Attivi'], ['missing', 'Con informazioni mancanti'], ['pending', 'In attesa'], ['replaced', 'Riconciliati'], ['excluded', 'Esclusi'], ['all', 'Tutti, incluso storico']]
      .map(([v, l]) => '<option value="' + v + '" ' + (S.filterState === v ? 'selected' : '') + '>' + l + '</option>').join('') + '</select></label>'
    + '<label class="field">Conto o carta<select onchange="S.filterAccount=this.value;render()">' + opts(accounts, S.filterAccount, 'Tutti i conti')
    + '<option value="missing" ' + (S.filterAccount === 'missing' ? 'selected' : '') + '>Non indicato</option></select></label>'
    + '<label class="field">Famiglia di spesa<select onchange="S.filterFamily=this.value;render()">' + opts(families, S.filterFamily, 'Tutte le famiglie') + '</select></label>'
    + '<label class="field">Categoria<select onchange="S.filterCat=this.value;render()">' + opts(cats, S.filterCat, 'Tutte le categorie') + '</select></label>'
    + '<label class="field">Persona<select onchange="S.filterPerson=this.value;render()">' + opts(persons, S.filterPerson, 'Tutta la famiglia') + '</select></label>'
    + ['need', 'nature', 'tax', 'rating', 'refund'].map(k => {
      const f = FL.byKey[k], cur = S.filterExtra[k] || '';
      return '<label class="field">' + esc(f.label) + '<select onchange="S.filterExtra.' + k + '=this.value;render()"><option value="">Tutti</option>'
        + f.options.map(([v, l]) => '<option value="' + v + '"' + (cur === v ? ' selected' : '') + '>' + esc(l) + '</option>').join('')
        + '<option value="__none"' + (cur === '__none' ? ' selected' : '') + '>Non indicato</option></select></label>';
    }).join('')
    + '<label class="field">Etichetta / progetto<select onchange="S.filterExtra.tags=this.value;render()">' + opts(knownValues('tags'), S.filterExtra.tags || '', 'Tutte') + '</select></label>'
    + '<label class="field">Esercizio<select onchange="S.filterExtra.merchant=this.value;render()">' + opts(knownValues('merchant'), S.filterExtra.merchant || '', 'Tutti') + '</select></label>'
    + (active ? '<button class="btn secondary wide" onclick="resetFilters()">Azzera filtri</button>' : '') + '</details>'
    + '<div class="row"><span class="sub">' + a.length + ' movimenti · somma ' + eur(U.sum(a, t => t.cents)) + '</span></div>'
    + '<div class="card">' + (a.length ? a.slice(0, S.limit).map(t => txrow(t)).join('') : '<p class="sub">Nessun movimento per questi filtri.</p>') + '</div>'
    + (a.length > S.limit ? '<button class="btn secondary wide" onclick="S.limit+=80;render()">Mostra altri 80</button>' : '')
    + '<div class="actions"><button class="btn" onclick="act(\'import\')">Importa Excel</button><button class="btn secondary" onclick="newCash()">＋ Contanti</button></div>';
};

function resetFilters() {
  S.filterState = 'active'; S.filterAccount = ''; S.filterFamily = ''; S.filterCat = ''; S.filterPerson = ''; S.query = ''; S.filterExtra = {};
  render();
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

  let html = '<div class="value" style="font-size:30px;margin:12px 0">' + eur(t.cents) + '</div>'
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
  html += '<label class="field">Famiglia › categoria' + catSelect('dCat', preset.family, preset.category) + '</label>'
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
  modal(t.details || t.operation, html);
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
