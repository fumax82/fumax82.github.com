/*
 * todo.js - "DA FARE": la lista degli avvisi sui movimenti che non si
 * possono classificare perché mancano informazioni.
 *
 * Per ogni movimento puoi indicare voce per voce:
 *   - famiglia di spesa  - categoria  - conto o carta di origine/destinazione
 * L'app propone la scelta più probabile (regole, tue scelte passate,
 * dizionario: es. Anthropic/OpenAI/Gemini -> AI) e dopo la conferma chiede
 * se ricordarla per le prossime volte (regola automatica).
 *
 * Sotto-schede:
 *   list       movimenti con informazioni mancanti
 *   proposals  spese ripetitive senza regola (pagamenti ricorrenti)
 *   bank       categorie della banca da associare a una famiglia
 */
'use strict';

Screens.todo = function () {
  const tab = S.sub.todo || 'list';
  const proposals = C.ruleProposals(S.data.transactions, S.prefs);
  const bankCats = C.bankCategoryGaps(S.data.transactions, S.prefs);
  const tabs = [['list', 'Movimenti (' + S.todo.length + ')'], ['proposals', 'Spese ripetitive (' + proposals.length + ')'], ['bank', 'Categorie banca (' + bankCats.length + ')']];
  return '<span class="eyebrow">INFORMAZIONI MANCANTI</span><h1>Da completare</h1>'
    + '<p class="sub">Movimenti in entrata e in uscita a cui manca famiglia di spesa, categoria o carta. Completali voce per voce: l\'app impara dalle tue scelte.</p>'
    + '<div class="tabs">' + tabs.map(([v, l]) => '<button class="' + (tab === v ? 'on' : '') + '" onclick="S.sub.todo=\'' + v + '\';render()">' + l + '</button>').join('') + '</div>'
    + (tab === 'proposals' ? proposalsHtml(proposals) : tab === 'bank' ? bankHtml(bankCats) : todoListHtml());
};

// ---------------------------------------------------------------------
// Lista movimenti da completare
// ---------------------------------------------------------------------

function todoListHtml() {
  const filter = S.sub.todoFilter || 'all';
  const counts = { family: 0, category: 0, account: 0 };
  for (const it of S.todo) for (const m of it.missing) counts[m]++;
  const list = S.todo.filter(it => filter === 'all' || it.missing.includes(filter));
  const ready = list.filter(it => it.suggestion);
  if (!S.todo.length) {
    return '<div class="empty"><div class="glyph">✓</div><h2>Tutto in ordine</h2><p class="sub">Nessun movimento con informazioni mancanti.</p></div>'
      + (pref('todoIgnored', []).length ? '<button class="btn secondary wide" onclick="put(\'todoIgnored\',[]);derive();render()">Mostra di nuovo i ' + pref('todoIgnored', []).length + ' ignorati</button>' : '');
  }
  const chips = [['all', 'Tutti', S.todo.length], ['category', 'Senza categoria', counts.category], ['family', 'Senza famiglia', counts.family], ['account', 'Senza carta/conto', counts.account]];
  return '<div class="tabs">' + chips.map(([v, l, n]) => '<button class="' + (filter === v ? 'on' : '') + '" onclick="S.sub.todoFilter=\'' + v + '\';render()">' + l + ' · ' + n + '</button>').join('') + '</div>'
    + (ready.length ? '<div class="card"><div class="row"><div><h3>' + ready.length + ' proposte pronte</h3><p class="sub" style="margin:0">Regole, tue scelte passate e servizi conosciuti (es. Anthropic, OpenAI e Gemini → AI).</p></div></div>'
      + '<button class="btn gold wide" style="margin-top:12px" onclick="acceptAll()">Accetta tutte le proposte</button></div>' : '')
    + list.slice(0, S.todoLimit || 25).map(todoCard).join('')
    + (list.length > (S.todoLimit || 25) ? '<button class="btn secondary wide" onclick="S.todoLimit=(S.todoLimit||25)+25;render()">Mostra altri (' + (list.length - (S.todoLimit || 25)) + ')</button>' : '');
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
  classify([id], { family: it.suggestion.family, category: it.suggestion.category }, it.suggestion.source !== 'rule');
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
    + '<label class="field">Famiglia › categoria' + (it.missing.includes('category') || it.missing.includes('family') ? ' <span class="chip miss">mancante</span>' : '') + catSelect('aCat', preset.family, preset.category) + '</label>'
    + (s ? '<p class="mini">Proposta: ' + esc(s.reason) + '</p>' : '')
    + (!t.account ? '<label class="field">Conto o carta di ' + (t.cents < 0 ? 'origine' : 'destinazione') + (it.missing.includes('account') ? ' <span class="chip miss">mancante</span>' : '') + accountSelect('aAcc', t.accountUser) + '</label>' : '')
    + '<label class="field">Trattamento nei report<select id="aKind">' + Object.entries(KINDS).map(([v, l]) => '<option ' + (t.kind === v ? 'selected' : '') + ' value="' + v + '">' + l + '</option>').join('') + '</select></label>';
  if (it.similar.length) {
    html += '<label class="check"><input type="checkbox" id="aSimilar" checked> Applica anche ai ' + it.similar.length + ' movimenti simili ancora da completare</label>';
  }
  html += '<button class="btn wide" onclick="saveAssign(' + t.id + ')">Salva</button>';
  modal('Completa le informazioni', html);
}

function saveAssign(id) {
  const it = S.todo.find(x => x.tx.id === id);
  const cat = readCat('aCat');
  if (cat === undefined) return;
  const set = { kind: $('aKind').value };
  if (cat) { set.family = cat.family; set.category = cat.category; }
  if ($('aAcc')) { const acc = readAccount('aAcc'); if (acc) set.accountUser = acc; }
  const ids = [id].concat($('aSimilar') && $('aSimilar').checked && it ? it.similar : []);
  closeModal();
  classify(ids, set, true);
}

// ---------------------------------------------------------------------
// Spese ripetitive -> proposta di regola
// ---------------------------------------------------------------------

function proposalsHtml(list) {
  if (!list.length) return '<div class="empty"><div class="glyph">↻</div><p class="sub">Nessuna spesa ripetitiva senza regola. Quando l\'app nota pagamenti ripetuti verso lo stesso soggetto o conto, te lo propone qui.</p></div>';
  const ctxSug = { taxonomy: S.tax, rules: [], history: C.learnHistory(S.data.transactions) };
  return '<div class="hint">L\'app ha notato pagamenti ripetuti verso lo stesso soggetto. Con una regola, i prossimi verranno classificati da soli appena importi il file.</div>'
    + list.map((g, i) => {
      const last = txById(g.ids[g.ids.length - 1]);
      const s = C.suggest(last, ctxSug) || { family: last.family, category: last.category };
      return '<div class="card"><div class="row"><h3>' + esc(g.label) + '</h3><span class="badge">' + esc(g.cadence) + '</span></div>'
        + '<p class="sub">' + g.count + ' ' + (g.sign === 'out' ? 'pagamenti' : 'accrediti') + ' · circa ' + eur(g.typical)
        + (g.next ? ' · prossimo previsto ' + fmt(g.next) : '') + (g.monthly ? ' · ' + eur(g.monthly * 12) + ' l\'anno' : '') + '</p>'
        + '<label class="field">La descrizione contiene<input id="pText' + i + '" value="' + esc(g.token) + '"></label>'
        + '<label class="field">Classifica sempre come' + catSelect('pCat' + i, s.family, s.category) + '</label>'
        + '<div class="actions"><button class="btn" onclick="createProposal(' + i + ')">Crea regola</button>'
        + '<button class="btn secondary" onclick="showIds(' + jsArg(g.ids) + ',' + jsArg(g.label) + ')">Vedi</button>'
        + '<button class="btn secondary" onclick="dismissProposal(' + jsArg(g.key) + ')">Non è ripetitiva</button></div></div>';
    }).join('');
}

function createProposal(i) {
  const g = C.ruleProposals(S.data.transactions, S.prefs)[i];
  const cat = readCat('pCat' + i);
  if (!cat) { notice('Scegli una categoria'); return; }
  const last = txById(g.ids[g.ids.length - 1]);
  const rule = C.ruleFromTx(last, { family: cat.family, category: cat.category });
  rule.text = $('pText' + i).value.trim() || g.token;
  rule.name = rule.text.split(/[|,]/)[0];
  put('rules', pref('rules', []).concat([rule]));
  notice('Regola creata: i movimenti "' + rule.name + '" andranno in ' + cat.category);
}

function dismissProposal(key) {
  put('ruleProposalsDismissed', pref('ruleProposalsDismissed', []).concat([key]));
  render();
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
