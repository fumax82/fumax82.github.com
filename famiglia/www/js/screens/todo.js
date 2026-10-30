/*
 * todo.js - "CLASSIFICA": il posto unico per famiglie, categorie e
 * assegnazioni automatiche. Quattro schede:
 *
 *   todo        DA CLASSIFICARE: i movimenti senza categoria, raggruppati per
 *               soggetto (es. tutti gli Esselunga insieme): un tocco sulla
 *               proposta crea il soggetto e assegna la categoria a tutto il gruppo
 *               (prima vedi la lista e confermi). Sotto, i movimenti singoli.
 *   subjects    SOGGETTI: l'anagrafica di chi ricevi o a cui dai soldi
 *               (screens/subjects.js)
 *   categories  FAMIGLIE E CATEGORIE: rinomina, sposta, unisci (screens/categories.js)
 *   rules       REGOLE per parole chiave (screens/rules.js), per casi avanzati
 */
'use strict';

Screens.todo = function () {
  const tab = S.sub.todo || 'todo';
  const tabs = [['todo', 'Da classificare' + (S.todo.length ? ' (' + S.todo.length + ')' : '')], ['subjects', 'Soggetti (' + S.subjects.length + ')'],
    ['categories', 'Categorie'], ['rules', 'Regole']];
  return '<span class="eyebrow">FAMIGLIE, CATEGORIE, SOGGETTI</span><h1>Classifica</h1>'
    + '<div class="tabs">' + tabs.map(([v, l]) => '<button class="' + (tab === v ? 'on' : '') + '" onclick="S.sub.todo=\'' + v + '\';render()">' + l + '</button>').join('') + '</div>'
    + (tab === 'subjects' ? subjectsHtml() : tab === 'categories' ? categoriesHtml() : tab === 'rules' ? rulesHtml() : todoHtml());
};
// Vecchi indirizzi: portano alle schede della Classifica
Screens.rules = () => { S.sub.todo = 'rules'; return Screens.todo(); };
Screens.categories = () => { S.sub.todo = 'categories'; return Screens.todo(); };
Screens.subjects = () => { S.sub.todo = 'subjects'; return Screens.todo(); };

// ---------------------------------------------------------------------
// Da classificare
// ---------------------------------------------------------------------

function todoHtml() {
  const active = S.data.transactions.filter(t => t.state === 'active' && !C.INTERNAL_KINDS.includes(t.kind) && t.kind !== 'withdrawal');
  const done = active.filter(t => !C.missingInfo(t, S.tax).some(m => m !== 'account')).length;
  const pct = active.length ? Math.round(done / active.length * 100) : 100;
  const groups = SJ.candidates(S.data.transactions, S.prefs).filter(g => g.missing > 0 && g.ids.length >= 2);
  window.todoGroups = groups;
  const inGroup = new Set(groups.flatMap(g => g.ids));
  const singles = S.todo.filter(it => !inGroup.has(it.tx.id));
  const review = S.subjects.map(s => ({ s, n: SJ.proposals(s, S.data.transactions, S.subjects, S.tax).length })).filter(x => x.n);
  const bankCats = C.bankCategoryGaps(S.data.transactions, S.prefs);

  let html = '<div class="card"><div class="row"><h3 style="margin:0">' + pct + '% dei movimenti classificati</h3><span class="mini">' + done + ' su ' + active.length + '</span></div>'
    + '<div class="track"><div class="fill" style="width:' + pct + '%"></div></div>'
    + '<p class="mini" style="margin:8px 0 0">Il modo più veloce: assegna la categoria a un <b>soggetto</b> (es. "Esselunga") e vale per tutti i suoi movimenti, anche quelli futuri.</p></div>';

  if (review.length) {
    html += '<div class="card warn"><h3>Soggetti con movimenti da aggiornare</h3>' + review.map(x => '<div class="row" style="margin:8px 0"><span>' + typeIcon(x.s.type) + ' <b>' + esc(x.s.name) + '</b> · ' + x.n + ' movimenti</span>'
      + '<button class="btn small" onclick="subjectReview(' + jsArg(x.s.id) + ')">Rivedi</button></div>').join('') + '</div>';
  }
  if (groups.length) {
    html += '<h2 style="margin-top:20px">Per soggetto</h2><p class="sub">Movimenti ripetuti verso la stessa controparte. Tocca la categoria proposta (o scegline un\'altra): vedrai la lista dei movimenti prima di confermare.</p>'
      + groups.slice(0, S.todoLimit || 12).map((g, i) => groupCard(g, i)).join('')
      + (groups.length > (S.todoLimit || 12) ? '<button class="btn secondary wide" onclick="S.todoLimit=(S.todoLimit||12)+12;render()">Mostra altri ' + (groups.length - (S.todoLimit || 12)) + '</button>' : '');
  }
  if (bankCats.length) {
    html += '<details class="card"' + (groups.length ? '' : ' open') + '><summary>Categorie della banca senza famiglia (' + bankCats.length + ')</summary>' + bankHtml(bankCats) + '</details>';
  }
  if (singles.length) {
    html += '<h2 style="margin-top:20px">Movimenti singoli (' + singles.length + ')</h2>' + singlesHtml(singles);
  }
  if (!groups.length && !singles.length && !review.length) {
    html += '<div class="empty"><div class="glyph">✓</div><h2>Tutto classificato</h2><p class="sub">Nessun movimento con famiglia o categoria mancanti.</p></div>'
      + (pref('todoIgnored', []).length ? '<button class="btn secondary wide" onclick="put(\'todoIgnored\',[]);derive();render()">Mostra di nuovo i ' + pref('todoIgnored', []).length + ' ignorati</button>' : '');
  }
  return html;
}

/** Riquadro di un gruppo: nome proposto, numeri, categoria proposta con un tocco. */
function groupCard(g, i) {
  const s = g.suggestion;
  return '<div class="card"><div class="row"><div style="min-width:0"><strong>' + esc(g.name) + '</strong>'
    + '<p class="mini" style="margin:2px 0">' + g.ids.length + (g.sign === 'out' ? ' uscite' : ' entrate') + ' · ' + eur(g.total) + ' · ultimo ' + fmt(g.last.date) + '</p></div>'
    + '<button class="link" onclick="showIds(' + jsArg(g.ids) + ',' + jsArg(g.name) + ')">Vedi</button></div>'
    + '<div class="pick-list" style="margin-top:8px">'
    + (s ? '<button class="chip pick ok" onclick="quickSubject(' + i + ',' + jsArg(s.family) + ',' + jsArg(s.category) + ')">' + familyIcon(s.family) + ' ' + esc(s.category) + ' <span class="mini">✓ proposta</span></button>' : '')
    + '<button class="chip pick" onclick="groupPick(' + i + ')">Scegli categoria…</button>'
    + '<button class="chip" onclick="dismissGroup(' + i + ')">Ignora</button></div>'
    + (s ? '<p class="mini" style="margin:6px 0 0">Proposta: ' + esc(s.reason) + '</p>' : '') + '</div>';
}

/** Un tocco sulla proposta: crea il soggetto con quella categoria e mostra la lista da confermare. */
function quickSubject(i, family, category) {
  const g = window.todoGroups[i];
  const s = SJ.fromTx(g.last, { class: { family, category } });
  s.name = g.name;
  saveSubjectObject(s, true);
}

/** "Scegli categoria…": apre la scheda del nuovo soggetto già compilata. */
function groupPick(i) {
  const g = window.todoGroups[i];
  const draft = SJ.fromTx(g.last, g.suggestion ? { class: { family: g.suggestion.family, category: g.suggestion.category } } : {});
  draft.name = g.name;
  editSubject(null, draft);
  setTimeout(() => openPicker('sjCat'), 150);
}

function dismissGroup(i) {
  const g = window.todoGroups[i];
  put('subjectsDismissed', pref('subjectsDismissed', []).concat([g.key]));
  render();
}

/** Movimenti senza gruppo: elenco con proposta e completamento rapido. */
function singlesHtml(list) {
  const ready = list.filter(it => it.suggestion && (it.missing.includes('category') || it.missing.includes('family')));
  return (ready.length > 1 ? '<div class="card"><div class="row"><span><b>' + ready.length + ' proposte pronte</b><br><span class="mini">Servizi conosciuti (es. Anthropic, OpenAI, Gemini → AI), tue scelte passate e regole.</span></span>'
      + '<button class="btn gold small" onclick="acceptAll()">Accetta tutte</button></div></div>' : '')
    + list.slice(0, S.limit).map(todoCard).join('')
    + (list.length > S.limit ? '<button class="btn secondary wide" onclick="S.limit+=40;render()">Mostra altri</button>' : '');
}

function todoCard(it) {
  const t = it.tx, s = it.suggestion;
  return '<div class="card">' + txrow(t)
    + '<div>' + it.missing.map(m => '<span class="chip miss">Manca ' + MISSING_LABEL[m].toLowerCase() + '</span>').join('')
    + (it.similar.length ? '<span class="chip">' + it.similar.length + ' simili</span>' : '') + '</div>'
    + (s && (it.missing.includes('category') || it.missing.includes('family'))
      ? '<p class="sub" style="margin:10px 0 0">Proposta: <b>' + esc(s.family + ' › ' + s.category) + '</b><br><span class="mini">' + esc(s.reason) + ' · affidabilità ' + s.confidence + '</span></p>' : '')
    + '<div class="actions">'
    + (s && (it.missing.includes('category') || it.missing.includes('family')) ? '<button class="btn small" onclick="acceptSuggestion(' + t.id + ')">✓ Accetta</button>' : '')
    + '<button class="btn secondary small" onclick="assign(' + t.id + ')">Completa…</button>'
    + '<button class="btn secondary small" onclick="ignoreTodo(' + t.id + ')">Ignora</button></div></div>';
}

/** Accetta la proposta di un movimento e chiede se ricordarla. */
function acceptSuggestion(id) {
  const it = S.todo.find(x => x.tx.id === id);
  if (!it || !it.suggestion) return;
  saveFields(id, { class: { family: it.suggestion.family, category: it.suggestion.category } });
}

/** Accetta tutte le proposte (senza chiedere regole una per una). */
function acceptAll() {
  const items = S.todo.filter(it => it.suggestion && (it.missing.includes('category') || it.missing.includes('family')))
    .map(it => ({ id: it.tx.id, family: it.suggestion.family, category: it.suggestion.category, classifiedBy: 'user' }));
  if (!items.length) return;
  if (!confirm('Applicare ' + items.length + ' proposte? Potrai sempre correggere dal dettaglio del movimento.')) return;
  act('bulkEdit', { items, reason: 'Proposte accettate' });
  setTimeout(() => {
    const p = C.ruleProposals(S.data.transactions, S.prefs);
    if (p.length) notice('Suggerimento: guarda la scheda "Spese ripetitive" per creare regole automatiche.');
  }, 600);
}

function ignoreTodo(id) {
  put('todoIgnored', pref('todoIgnored', []).concat([id]));
  derive();
  render();
}

/** Finestra per completare le informazioni mancanti di un movimento. */
function assign(id) {
  const it = S.todo.find(x => x.tx.id === id) || { tx: txById(id), missing: C.missingInfo(txById(id), S.tax), similar: [], suggestion: null };
  const t = it.tx, s = it.suggestion;
  const preset = s || { family: t.family || C.familyOf(t, S.tax), category: t.category };
  let html = txrow(t)
    + '<label class="field">Famiglia › categoria' + (it.missing.includes('category') || it.missing.includes('family') ? ' <span class="chip miss">mancante</span>' : '') + catSelect('aCat', preset.family, preset.category, s ? [{ family: s.family, category: s.category, reason: 'proposta' }] : []) + '</label>'
    + (s ? '<p class="mini">Proposta: ' + esc(s.reason) + '</p>' : '')
    + (!t.account ? '<label class="field">Conto o carta di ' + (t.cents < 0 ? 'origine' : 'destinazione') + (it.missing.includes('account') ? ' <span class="chip miss">mancante</span>' : '') + accountSelect('aAcc', t.accountUser) + '</label>' : '')
    + '<label class="field">Trattamento nei report<select id="aKind">' + Object.entries(KINDS).map(([v, l]) => '<option ' + (t.kind === v ? 'selected' : '') + ' value="' + v + '">' + l + '</option>').join('') + '</select></label>';
  const prof = FL.profiles(S.data.transactions, S.tax)[(t.cents < 0 ? -1 : 1) + '|' + C.merchantKey(t)];
  if (prof && prof.sourceId !== t.id) html = '<button class="btn gold wide" onclick="fillFromProfile(' + t.id + ',\'a\')">↺ Copia i dati dal ' + fmt(prof.date) + ' (stesso esercizio)</button>' + html;
  html += '<details><summary>Altri dettagli per i report (facoltativi)</summary>' + extraInputs('aX', t) + '</details>'
    + '<button class="btn wide" onclick="saveAssign(' + t.id + ')">Salva</button>'
    + (it.similar.length ? '<p class="mini">Dopo il salvataggio vedrai i ' + it.similar.length + ' movimenti simili e potrai scegliere quali campi copiare.</p>' : '');
  modal('Completa le informazioni', html);
}

function saveAssign(id) {
  const cat = readCat('aCat');
  if (cat === undefined) return;
  const after = Object.assign({ kind: $('aKind').value }, readExtraInputs('aX'));
  if (cat) after.class = cat;
  if ($('aAcc')) { const acc = readAccount('aAcc'); if (acc) after.accountUser = acc; }
  closeModal();
  saveFields(id, after);
}

// ---------------------------------------------------------------------
// Categorie della banca senza famiglia
// ---------------------------------------------------------------------

function bankHtml(list) {
  if (!list.length) return '<div class="empty"><div class="glyph">✓</div><p class="sub">Tutte le categorie della banca appartengono a una famiglia.</p></div>';
  return '<div class="hint">La banca usa nomi di categoria suoi. Associa ognuno a una famiglia una volta sola: tutti i movimenti, anche futuri, avranno la famiglia giusta.</div>'
    + list.map(([cat, n], i) => '<div class="card"><div class="row"><h3>' + esc(cat) + '</h3><span class="badge">' + n + ' movimenti</span></div>'
      + '<label class="field">Appartiene alla famiglia<select id="bFam' + i + '"><option value="">— scegli —</option>' + S.tax.map(f => '<option>' + esc(f.family) + '</option>').join('') + '</select></label>'
      + '<button class="btn wide" onclick="mapBankCategory(' + jsArg(cat) + ',' + i + ')">Associa</button></div>').join('');
}

function mapBankCategory(cat, i) {
  const family = $('bFam' + i).value;
  if (!family) { notice('Scegli una famiglia'); return; }
  ensureTaxonomy(family, cat);
  derive();
  render();
  notice('"' + cat + '" ora fa parte di ' + family);
}
