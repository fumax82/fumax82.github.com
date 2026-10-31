/*
 * home.js - Schermata iniziale: margine del periodo, scorciatoie e la lista
 * unica "DA FARE" (classificare, doppioni, buchi, scontrini, contanti...).
 */
'use strict';

Screens.home = function () {
  if (!S.data.transactions.length) return welcome();
  const a = selected();
  const s = F.totals(a, ctx());
  const recent = a.filter(t => t.state === 'active').sort((x, y) => y.date.localeCompare(x.date) || y.id - x.id).slice(0, 5);
  const alerts = Insights.compute(S.data, S.month, U.today());
  const gapsImportant = S.gaps ? S.gaps.gaps.filter(g => ['alta', 'critica', 'media'].includes(g.level)) : [];
  const proposals = C.ruleProposals(S.data.transactions, S.prefs);
  const unlinkedCash = L.cashPayments(S.data.transactions).filter(t => !L.cashLinkOf(t.id, S.data.links)).length;

  return '<span class="eyebrow">LA TUA BUSSOLA QUOTIDIANA</span><h1>Ogni scelta conta.</h1>' + periodControl()
    + '<section class="hero"><div class="row"><span class="eyebrow">MARGINE DEL PERIODO</span><span class="badge light">Contabilizzato</span></div>'
    + '<div class="big">' + eur(s.margin) + '</div><div class="sub">Entrate − spese + rimborsi. Non è il saldo del conto.</div>'
    + '<div class="line"><div><span class="eyebrow">ENTRATE</span><strong class="green">' + eur(s.income) + '</strong></div>'
    + '<div><span class="eyebrow">SPESE NETTE</span><strong>' + eur(s.expense - s.refund) + '</strong></div></div></section>'

    // Scorciatoie
    + '<div class="quick">'
    + '<button onclick="act(\'import\')"><b>⤓</b>Importa</button>'
    + '<button onclick="newCash()"><b>💶</b>Contanti</button>'
    + '<button onclick="newReceipt()"><b>📷</b>Scontrino</button>'
    + '<button onclick="openSearch()"><b>🔍</b>Cerca e somma</button>'
    + '</div>'

    // Tutte le cose da sistemare in un'unica lista
    + homeTodoCard(gapsImportant, proposals, unlinkedCash)

    + '<div class="grid"><div class="card"><span class="eyebrow">MARGINE / ENTRATE</span><div class="value">' + (s.rate === null ? '—' : Math.round(s.rate * 100) + '%') + '</div><span class="mini">Capacità di risparmio</span></div>'
    + '<div class="card"><span class="eyebrow">IN ATTESA</span><div class="value orange">' + eur(s.pendingOut) + '</div><span class="mini">' + s.pendingCount + ' movimenti da contabilizzare</span></div></div>'

    // Avvisi principali
    + (alerts.length ? '<div class="card"><div class="row"><h2>Avvisi</h2><button class="btn secondary small" onclick="nav(\'reports\',\'alerts\')">Tutti (' + alerts.length + ')</button></div>'
      + alerts.slice(0, 3).map(insightRow).join('') + '</div>' : '')

    + '<div class="card"><div class="row"><h2>Il tuo andamento</h2><span class="badge">' + F.months(S.data.transactions, ctx()).length + ' mesi</span></div>' + chart(F.months(S.data.transactions, ctx())) + '</div>'
    + '<div class="card"><div class="row"><h2>Ultimi movimenti</h2><button class="btn secondary small" onclick="nav(\'moves\')">Tutti</button></div>' + recent.map(t => txrow(t)).join('') + '</div>';
};

/**
 * "DA FARE": un'unica lista con tutto quello che aspetta un tuo tocco,
 * dal più importante. Ogni riga porta dritta al posto giusto.
 */
function homeTodoCard(gapsImportant, proposals, unlinkedCash) {
  const checks = (S.checks || []).filter(c => c.level !== 'info').length;
  const bank = C.bankCategoryGaps(S.data.transactions, S.prefs).length;
  const n = (k, one, many) => k + ' ' + (k === 1 ? one : many);
  const rows = [
    [S.todo.length, '✓', n(S.todo.length, 'movimento da classificare', 'movimenti da classificare'), 'Raggruppati per soggetto: un tocco vale per tutto il gruppo', "nav('todo','todo')", 'warn'],
    [checks, '⧉', n(checks, 'possibile doppione', 'possibili doppioni'), 'Controlla prima che falsino i totali', "nav('checks')", 'alert'],
    [gapsImportant.length, '⤓', n(gapsImportant.length, 'buco', 'buchi') + ' tra le importazioni',
      gapsImportant.length ? 'Il più grande: ' + Math.max(...gapsImportant.map(g => g.days)) + ' giorni senza file' : '', "nav('imports')", 'alert'],
    [bank, '▦', n(bank, 'categoria della banca senza famiglia', 'categorie della banca senza famiglia'), 'Associale una volta sola', "nav('todo','bank')", 'warn'],
    [S.data.pairs.length, '⇋', n(S.data.pairs.length, 'possibile abbinamento', 'possibili abbinamenti'), 'Movimenti in attesa diventati definitivi', "nav('review')", ''],
    [receiptsReady(), '🧾', n(receiptsReady(), 'scontrino da collegare', 'scontrini da collegare'), 'C\'è un movimento con lo stesso importo', "nav('receipts')", ''],
    [unlinkedCash, '💶', n(unlinkedCash, 'pagamento in contanti da collegare', 'pagamenti in contanti da collegare'), 'Indica da quale prelievo vengono', "nav('cash')", ''],
    [proposals.length, '↻', n(proposals.length, 'spesa ripetitiva senza regola', 'spese ripetitive senza regola'), proposals.length ? 'Es. ' + proposals.slice(0, 3).map(p => p.token).join(', ') : '', "nav('todo','proposals')", '']
  ].filter(r => r[0]);
  if (!rows.length) return '<div class="card"><div class="row"><h3 style="margin:0">✓ Tutto in ordine</h3><span class="badge">Niente da fare</span></div></div>';
  return '<div class="card"><div class="row"><h2>Da fare</h2><span class="badge warn">' + rows.length + '</span></div>'
    + rows.map(([, icon, text, sub, go, level]) => '<div class="tx todo-row" role="button" onclick="' + go + '"><div class="txicon">' + icon + '</div>'
      + '<div class="txmain"><strong' + (level === 'alert' ? ' class="red"' : '') + '>' + esc(text) + '</strong>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div><span>→</span></div>').join('') + '</div>';
}

/** Apre Movimenti con il cursore nella ricerca. */
function openSearch() {
  nav('moves');
  const box = $('search');
  if (box) box.focus();
}

function welcome() {
  return '<div class="empty"><div class="glyph">⌂</div><span class="eyebrow">LO SPAZIO DELLA TUA FAMIGLIA</span><h1>Più chiarezza.<br>Più possibilità.</h1>'
    + '<p class="sub">Le tue spese, i tuoi progetti, il tuo futuro.<br>Tutto custodito sul tuo telefono.</p></div>'
    + '<div class="hero"><span class="badge light">100% OFFLINE</span><h2 style="font-size:24px;margin-top:20px">Inizia dal tuo estratto.</h2>'
    + '<p class="sub">Importa il file Excel Intesa. Date, importi e dettagli restano nel database locale.</p>'
    + '<button class="btn gold wide" onclick="act(\'import\')">＋ Importa il primo Excel</button></div>'
    + '<div class="hint">Nessuna registrazione, nessun collegamento bancario. Puoi importare più volte gli stessi periodi: l\'app verifica le sovrapposizioni e ti avvisa se tra un file e l\'altro resta un buco.</div>'
    + '<button class="btn secondary wide" onclick="nav(\'settings\')">Ripristina un backup</button>';
}

/** Riga di un avviso (usata in Home e Analisi). */
function insightRow(a) {
  return '<div class="insight ' + esc(a.level) + '"><div class="ico">' + esc(a.icon) + '</div><div style="flex:1;min-width:0">'
    + '<strong style="font-size:14px">' + esc(a.title) + '</strong><p class="sub" style="margin:4px 0">' + esc(a.text) + '</p>'
    + (a.tip ? '<p class="mini" style="margin:4px 0">💡 ' + esc(a.tip) + '</p>' : '')
    + '<div class="row" style="justify-content:flex-start;gap:14px">'
    + (a.ids && a.ids.length ? '<button class="link" onclick="showIds(' + jsArg(a.ids) + ',' + jsArg(a.title) + ')">Vedi movimenti (' + a.ids.length + ')</button>' : '')
    + '<button class="link" onclick="hideInsight(' + jsArg(a.id) + ')">Nascondi</button></div></div></div>';
}

/** Mostra in una finestra un elenco di movimenti. */
function showIds(ids, title) {
  const list = ids.map(txById).filter(Boolean).sort((a, b) => b.date.localeCompare(a.date));
  modal(title || 'Movimenti', '<p class="sub">' + list.length + ' movimenti · totale ' + eur(U.sum(list, t => t.cents)) + '</p><div class="card">' + list.map(t => txrow(t)).join('') + '</div>');
}

function hideInsight(id) {
  put('hiddenInsights', pref('hiddenInsights', []).concat([id]));
  render();
}

/** Scontrini non collegati per cui adesso esiste un movimento corrispondente. */
function receiptsReady() {
  return pendingReceiptLinks().filter(x => x.matches.length).length;
}
