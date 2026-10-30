/*
 * subjects.js - ANAGRAFICA DEI SOGGETTI (interfaccia).
 *
 * Un soggetto è "chi" c'è dall'altra parte di un movimento: il negozio, il
 * servizio in abbonamento, il datore di lavoro, una persona, un ente.
 * Nella sua scheda scrivi:
 *   - nome e DESCRIZIONE: compaiono in testa al movimento, sopra la descrizione
 *     della banca (spesso incomprensibile)
 *   - le parole con cui riconoscerlo nella descrizione della banca
 *   - i DATI da assegnare ai suoi movimenti (categoria, necessità, natura...)
 * Quando salvi, l'app mostra la lista dei movimenti che cambierebbero e tu
 * confermi campo per campo. I movimenti nuovi li riceve da solo (se vuoi).
 *
 * La logica (riconoscimento, proposte) è in js/logic/subjects.js.
 */
'use strict';

const TYPE_ICON = { negozio: '🏪', abbonamento: '🔄', azienda: '🏢', persona: '👤', lavoro: '💼', ente: '🏛', banca: '🏦', altro: '📌' };
const typeIcon = t => TYPE_ICON[t] || '📌';

// ---------------------------------------------------------------------
// Scheda "Soggetti" della Classifica
// ---------------------------------------------------------------------

function subjectsHtml() {
  const q = U.norm(S.sub.sjQuery || '');
  const stats = {};
  for (const t of S.data.transactions) {
    if (t.state === 'excluded') continue;
    const s = subjectOf(t);
    if (!s) continue;
    const x = (stats[s.id] = stats[s.id] || { n: 0, total: 0 });
    x.n++; x.total += t.cents;
  }
  const list = S.subjects.filter(s => !q || U.norm(s.name + ' ' + (s.description || '') + ' ' + s.match).includes(q))
    .sort((a, b) => Math.abs((stats[b.id] || {}).total || 0) - Math.abs((stats[a.id] || {}).total || 0));
  const cands = SJ.candidates(S.data.transactions, S.prefs).slice(0, 15);
  window.sjCands = cands;
  return '<p class="sub">Chi ricevi soldi e a chi li dai. Il nome e la descrizione compaiono sopra la descrizione della banca; i dati della scheda vengono assegnati ai suoi movimenti (dopo la tua conferma).</p>'
    + '<div class="row" style="gap:8px"><input class="search" style="flex:1;margin:0" placeholder="🔍 Cerca un soggetto" value="' + esc(S.sub.sjQuery || '') + '" onchange="S.sub.sjQuery=this.value;render()">'
    + '<button class="btn small" onclick="editSubject(null)">＋ Nuovo</button></div>'
    + (list.length ? '<div class="card">' + list.map(s => {
      const st = stats[s.id] || { n: 0, total: 0 };
      const v = s.set || {};
      return '<div class="tx" onclick="openSubject(' + jsArg(s.id) + ')"><div class="txicon">' + typeIcon(s.type) + '</div><div class="txmain"><strong>' + esc(s.name) + '</strong>'
        + (s.description ? '<small>' + esc(s.description) + '</small>' : '')
        + '<small>' + (v.class && v.class.category ? familyIcon(v.class.family) + ' ' + esc(v.class.category) : '<span class="orange">nessuna categoria</span>')
        + ' · ' + st.n + ' movimenti' + (s.auto === false ? ' · manuale' : '') + '</small></div><div class="amount">' + eur(st.total) + '</div></div>';
    }).join('') + '</div>' : (q ? '<p class="sub">Nessun soggetto trovato.</p>' : '<div class="empty"><div class="glyph">👥</div><p class="sub">Ancora nessun soggetto. Creane uno dai suggerimenti qui sotto o dalla scheda di un movimento.</p></div>'))
    + (cands.length ? '<h2 style="margin-top:20px">Soggetti suggeriti</h2><p class="sub">Controparti che compaiono nei movimenti ma non sono ancora in anagrafica.</p><div class="card">'
      + cands.map((g, i) => '<div class="row" style="padding:10px 0;border-bottom:1px solid #edf0e9"><div style="min-width:0"><strong style="font-size:13px">' + esc(g.name) + '</strong>'
        + '<br><span class="mini">' + g.ids.length + ' movimenti · ' + eur(g.total) + (g.suggestion ? ' · ' + esc(g.suggestion.category) : '') + '</span></div>'
        + '<button class="btn secondary small" onclick="createFromCandidate(' + i + ')">Crea</button></div>').join('') + '</div>' : '');
}

function createFromCandidate(i) {
  const g = window.sjCands[i];
  const d = SJ.fromTx(g.last, g.suggestion ? { class: { family: g.suggestion.family, category: g.suggestion.category } } : {});
  d.name = g.name;
  editSubject(null, d);
}

// ---------------------------------------------------------------------
// Scheda del soggetto (sola lettura) con i suoi movimenti
// ---------------------------------------------------------------------

function openSubject(id) {
  const s = S.subjects.find(x => x.id === id);
  if (!s) return;
  const moves = SJ.movementsOf(s, S.data.transactions, S.subjects);
  const pending = SJ.proposals(s, S.data.transactions, S.subjects, S.tax).length;
  const vals = SJ.values(s);
  const total = U.sum(moves, t => t.cents);
  modal(s.name, '<p class="sub">' + typeIcon(s.type) + ' ' + esc((SJ.TYPES.find(x => x[0] === s.type) || [, ''])[1]) + (s.description ? '<br><b>' + esc(s.description) + '</b>' : '') + '</p>'
    + '<div class="grid"><div class="card" style="margin:0"><span class="eyebrow">MOVIMENTI</span><div class="value">' + moves.length + '</div></div>'
    + '<div class="card" style="margin:0"><span class="eyebrow">TOTALE</span><div class="value" style="font-size:19px">' + eur(total) + '</div></div></div>'
    + '<div class="card"><h3>Dati assegnati ai movimenti</h3>' + (Object.keys(vals).length
      ? Object.keys(vals).map(k => '<p class="sub" style="margin:4px 0">' + esc(FL.byKey[k].label) + ': <b>' + esc(FL.format(vals[k], k)) + '</b></p>').join('')
      : '<p class="sub">Nessuno: il soggetto dà solo nome e descrizione.</p>')
    + '<p class="mini">Riconosciuto da: ' + esc(SJ.words(s).join(', ') || '—') + ' · ' + (s.direction === 'out' ? 'solo uscite' : s.direction === 'in' ? 'solo entrate' : 'entrate e uscite')
    + ' · ' + (s.auto === false ? 'assegnazione manuale' : 'assegnazione automatica ai nuovi movimenti') + '</p></div>'
    + (pending ? '<button class="btn gold wide" onclick="subjectReview(' + jsArg(s.id) + ')">Rivedi ' + pending + ' movimenti da aggiornare</button>' : '')
    + '<div class="card"><h3>Movimenti</h3>' + (moves.length ? moves.slice(0, 25).map(t => txrow(t)).join('') : '<p class="sub">Nessun movimento riconosciuto: controlla le parole di riconoscimento.</p>')
    + (moves.length > 25 ? '<button class="link" onclick="showIds(' + jsArg(moves.map(t => t.id)) + ',' + jsArg(s.name) + ')">Tutti i ' + moves.length + '</button>' : '') + '</div>'
    + '<div class="actions"><button class="btn" onclick="editSubject(' + jsArg(s.id) + ')">Modifica</button>'
    + '<button class="btn danger" onclick="deleteSubject(' + jsArg(s.id) + ')">Elimina</button></div>');
}

// ---------------------------------------------------------------------
// Modifica / creazione
// ---------------------------------------------------------------------

/** Apre il modulo del soggetto. id = soggetto esistente oppure null; draft = bozza precompilata. */
function editSubject(id, draft) {
  const s = draft || (id ? S.subjects.find(x => x.id === id) : null) || { id: U.uid(), name: '', description: '', type: 'negozio', direction: 'out', match: '', set: {}, auto: true };
  window.sjDraft = JSON.parse(JSON.stringify(s));
  window.sjEditingId = id;
  const v = s.set || {};
  const t = { extra: { need: v.need, nature: v.nature, tax: v.tax, tags: v.tags, refund: v.refund } };
  const seg = (name, options, cur) => '<input type="hidden" id="' + name + '" value="' + esc(cur || '') + '"><div class="tabs" style="margin:6px 0 0">'
    + options.map(([val, l]) => '<button type="button" class="' + (val === cur ? 'on' : '') + '" onclick="pickChoice(\'' + name + '\',\'' + val + '\',this)">' + l + '</button>').join('') + '</div>';
  modal(id ? 'Modifica soggetto' : 'Nuovo soggetto',
    '<label class="field">Nome<input id="sjName" value="' + esc(s.name) + '" placeholder="Es. Esselunga Viale Piave"></label>'
    + '<label class="field">Descrizione (comparirà sopra la descrizione della banca)<input id="sjDesc" value="' + esc(s.description || '') + '" placeholder="Es. Spesa settimanale di casa"></label>'
    + '<label class="field">Tipo<select id="sjType">' + SJ.TYPES.map(([k, l]) => '<option value="' + k + '"' + (k === s.type ? ' selected' : '') + '>' + typeIcon(k) + ' ' + l + '</option>').join('') + '</select></label>'
    + '<label class="field">Movimenti' + seg('sjDir', [['out', 'Uscite'], ['in', 'Entrate'], ['any', 'Entrambe']], s.direction || 'any') + '</label>'
    + '<label class="field">Riconoscilo quando la descrizione della banca contiene (più parole separate da | )<input id="sjMatch" value="' + esc(s.match || '') + '" oninput="sjPreview()" placeholder="es. esselunga|essel."></label>'
    + '<p class="mini" id="sjPrev"></p>'
    + '<h3 style="margin-top:20px">Dati da assegnare ai suoi movimenti</h3><p class="mini">Lascia vuoto ciò che non vuoi assegnare.</p>'
    + '<label class="field">Famiglia › categoria' + catSelect('sjCat', v.class && v.class.family, v.class && v.class.category, [suggestionForDraft()].filter(Boolean)) + '</label>'
    + '<label class="field">Trattamento nei report<select id="sjKind"><option value="">— non cambiare —</option>' + Object.entries(KINDS).map(([k, l]) => '<option value="' + k + '"' + (v.kind === k ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>'
    + '<label class="field">Conto o carta (se manca nel file)' + accountSelect('sjAcc', v.accountUser) + '</label>'
    + '<label class="field">Persona<input id="sjPerson" value="' + esc(v.person || '') + '" placeholder="es. Marco (vuoto = non cambiare)"></label>'
    + extraInputs('sjX', t, ['rating', 'refund'])
    + '<label class="check"><input type="checkbox" id="sjAuto"' + (s.auto === false ? '' : ' checked') + '><span>Assegna questi dati da solo ai <b>nuovi</b> movimenti di questo soggetto (quelli già presenti li confermi tu dalla lista)</span></label>'
    + '<button class="btn wide" onclick="saveSubject()">Salva e mostra i movimenti</button>');
  sjPreview();
}

/** Proposta di categoria per il soggetto in modifica (dal primo movimento riconosciuto). */
function suggestionForDraft() {
  const d = window.sjDraft;
  const first = S.data.transactions.find(t => SJ.matchStrength(d, t) > 0);
  if (!first) return null;
  const s = C.suggest(first, { taxonomy: S.tax, rules: pref('rules', []), history: C.learnHistory(S.data.transactions) });
  return s ? { family: s.family, category: s.category, reason: 'proposta' } : null;
}

/** Anteprima: quanti movimenti riconosce con le parole scritte. */
function sjPreview() {
  if (!$('sjMatch')) return;
  const draft = Object.assign({}, window.sjDraft, { match: $('sjMatch').value, direction: $('sjDir') ? $('sjDir').value : 'any' });
  const hits = S.data.transactions.filter(t => t.state !== 'excluded' && SJ.matchStrength(draft, t) > 0);
  $('sjPrev').innerHTML = draft.match.trim()
    ? '🔎 Riconosce <b>' + hits.length + '</b> movimenti' + (hits.length ? ': ' + hits.slice(0, 3).map(t => esc(t.details || t.operation) + ' (' + fmt(t.date) + ')').join(', ') + (hits.length > 3 ? '…' : '') : '')
    : 'Scrivi almeno una parola della descrizione della banca.';
}

function readSubjectForm() {
  const s = Object.assign({}, window.sjDraft);
  s.name = $('sjName').value.trim();
  s.description = $('sjDesc').value.trim();
  s.type = $('sjType').value;
  s.direction = $('sjDir').value || 'any';
  s.match = $('sjMatch').value.trim();
  s.auto = $('sjAuto').checked;
  const set = {};
  const cat = readCat('sjCat');
  if (cat) set.class = cat;
  if ($('sjKind').value) set.kind = $('sjKind').value;
  const acc = readAccount('sjAcc');
  if (acc) set.accountUser = acc;
  if ($('sjPerson').value.trim()) set.person = $('sjPerson').value.trim();
  const ex = readExtraInputs('sjX');
  for (const k in ex) if (!FL.isEmpty(ex[k], k)) set[k] = ex[k];
  s.set = set;
  return s;
}

function saveSubject() {
  const s = readSubjectForm();
  if (!s.name) { notice('Scrivi il nome del soggetto'); return; }
  if (!s.match) { notice('Scrivi almeno una parola per riconoscerlo'); return; }
  saveSubjectObject(s, true);
}

/**
 * Salva il soggetto nell'anagrafica e, se ci sono movimenti da aggiornare,
 * mostra la lista da confermare.
 */
function saveSubjectObject(s, review) {
  s.since = Math.max(0, ...S.data.transactions.map(t => t.id)); // i movimenti presenti li confermi dalla lista
  const list = S.subjects.filter(x => x.id !== s.id).concat([s]);
  put('subjects', list);
  S.subjects = list;
  closeModal();
  if (review) setTimeout(() => subjectReview(s.id), 100);
}

function deleteSubject(id) {
  const s = S.subjects.find(x => x.id === id);
  if (!s || !confirm('Eliminare il soggetto "' + s.name + '"? I movimenti restano classificati come sono.')) return;
  const list = S.subjects.filter(x => x.id !== id);
  put('subjects', list);
  S.subjects = list;
  closeModal();
  render();
}

/** Lista dei movimenti del soggetto da aggiornare, con conferma campo per campo. */
function subjectReview(id) {
  const s = S.subjects.find(x => x.id === id);
  if (!s) return;
  const rows = SJ.proposals(s, S.data.transactions, S.subjects, S.tax);
  if (!rows.length) {
    const n = SJ.movementsOf(s, S.data.transactions, S.subjects).length;
    notice('Soggetto "' + s.name + '" salvato · ' + n + ' movimenti riconosciuti, già aggiornati');
    render();
    return;
  }
  cp = { subject: s, source: null, values: SJ.values(s), rows, limit: { subject: 40 } };
  renderCopy();
}

// ---------------------------------------------------------------------
// Dal dettaglio di un movimento: collega / crea il soggetto
// ---------------------------------------------------------------------

/** Riquadro "Soggetto" nel dettaglio del movimento. */
function subjectBox(t) {
  const s = subjectOf(t);
  if (s) {
    return '<div class="subj-head"><div><span class="mini">' + typeIcon(s.type) + ' SOGGETTO</span><br><b>' + esc(s.name) + '</b>'
      + (s.description ? '<br><span class="sub">' + esc(s.description) + '</span>' : '') + '</div>'
      + '<div class="pick-list"><button class="chip" onclick="openSubject(' + jsArg(s.id) + ')">Scheda</button><button class="chip" onclick="chooseSubject(' + t.id + ')">Cambia</button></div></div>';
  }
  return '<div class="subj-head"><div><span class="mini">👤 SOGGETTO</span><br><span class="sub">Non ancora in anagrafica</span></div>'
    + '<div class="pick-list"><button class="chip pick ok" onclick="newSubjectFromTx(' + t.id + ')">＋ Crea soggetto</button><button class="chip" onclick="chooseSubject(' + t.id + ')">Collega a uno esistente</button></div></div>';
}

function newSubjectFromTx(id) {
  const t = txById(id);
  const cur = FL.snapshot(t, S.tax);
  const set = {};
  for (const k of ['class', 'kind', 'need', 'nature', 'tax']) if (!FL.isEmpty(cur[k], k) && !(k === 'kind' && cur[k] === 'expense')) set[k] = cur[k];
  editSubject(null, SJ.fromTx(t, set));
}

/** Collega a mano il movimento a un soggetto esistente (o lo scollega). */
function chooseSubject(id) {
  const t = txById(id);
  window.onModalClose = null;
  modal('A quale soggetto appartiene?', txrow(t)
    + '<input class="search" placeholder="🔍 Cerca" oninput="filterSubjectChoice(this.value)">'
    + '<div id="sjChoice">' + subjectChoiceList(id, '') + '</div>'
    + '<div class="actions"><button class="btn secondary" onclick="newSubjectFromTx(' + id + ')">＋ Nuovo soggetto</button>'
    + '<button class="btn secondary" onclick="pinSubject(' + id + ',\'-\')">Nessun soggetto</button></div>');
  window.sjChoiceTx = id;
}

function subjectChoiceList(id, q) {
  const n = U.norm(q);
  return S.subjects.filter(s => !n || U.norm(s.name).includes(n)).slice(0, 30)
    .map(s => '<label class="radio" onclick="pinSubject(' + id + ',' + jsArg(s.id) + ')">' + typeIcon(s.type) + ' <b>' + esc(s.name) + '</b>' + (s.description ? ' · <span class="mini">' + esc(s.description) + '</span>' : '') + '</label>').join('')
    || '<p class="sub">Nessun soggetto.</p>';
}

function filterSubjectChoice(q) {
  $('sjChoice').innerHTML = subjectChoiceList(window.sjChoiceTx, q);
}

function pinSubject(id, subjectId) {
  const t = txById(id);
  act('edit', { id, extra: { subject: subjectId }, classifiedBy: t.classifiedBy || '' });
  closeModal();
  const s = S.subjects.find(x => x.id === subjectId);
  notice(s ? 'Movimento collegato a "' + s.name + '"' : 'Movimento scollegato dai soggetti');
  // Proponi subito i dati del soggetto per questo movimento
  if (s && SJ.hasValues(s)) setTimeout(() => {
    const t2 = Object.assign({}, t, { extra: Object.assign({}, t.extra, { subject: subjectId }) });
    const changes = FL.changesFor(t2, SJ.values(s), S.tax, null, 'subject');
    if (changes.length) { cp = { subject: s, source: null, values: SJ.values(s), rows: [{ tx: t2, group: 'subject', changes }], limit: { subject: 40 } }; renderCopy(); }
  }, 300);
}
