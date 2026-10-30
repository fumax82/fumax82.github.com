/*
 * home.js - Schermata iniziale: margine del mese, scorciatoie e
 * promemoria (da completare, buchi di importazione, avvisi).
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

  return '<span class="eyebrow">LA TUA BUSSOLA QUOTIDIANA</span><h1>Ogni scelta conta.</h1>' + monthControl()
    + '<section class="hero"><div class="row"><span class="eyebrow">MARGINE DEL PERIODO</span><span class="badge light">Contabilizzato</span></div>'
    + '<div class="big">' + eur(s.margin) + '</div><div class="sub">Entrate − spese + rimborsi. Non è il saldo del conto.</div>'
    + '<div class="line"><div><span class="eyebrow">ENTRATE</span><strong class="green">' + eur(s.income) + '</strong></div>'
    + '<div><span class="eyebrow">SPESE NETTE</span><strong>' + eur(s.expense - s.refund) + '</strong></div></div></section>'

    // Scorciatoie
    + '<div class="quick">'
    + '<button onclick="act(\'import\')"><b>⤓</b>Importa</button>'
    + '<button onclick="newCash()"><b>💶</b>Contanti</button>'
    + '<button onclick="newReceipt()"><b>📷</b>Scontrino</button>'
    + '<button onclick="nav(\'todo\')"><b>✓</b>Da fare' + (S.todo.length ? '<span class="count">' + S.todo.length + '</span>' : '') + '</button>'
    + '</div>'

    // Promemoria
    + (S.todo.length ? '<div class="card warn" role="button" onclick="nav(\'todo\',\'todo\')"><div class="row"><h3>✓ ' + S.todo.length + ' movimenti da classificare</h3><span>→</span></div>'
      + '<p class="sub" style="margin:0">Raggruppati per soggetto: un tocco sulla categoria proposta e vale per tutto il gruppo.</p></div>' : '')
    + ((S.checks || []).filter(c => c.level !== 'info').length ? '<div class="card alert" role="button" onclick="nav(\'checks\')"><div class="row"><h3>⧉ ' + S.checks.filter(c => c.level !== 'info').length + ' possibili doppioni</h3><span>→</span></div>'
      + '<p class="sub" style="margin:0">Doppie importazioni, doppi addebiti o spese registrate due volte: controlla prima che falsino i totali.</p></div>' : '')
    + (C.bankCategoryGaps(S.data.transactions, S.prefs).length ? '<div class="card warn" role="button" onclick="nav(\'todo\',\'bank\')"><div class="row"><h3>▦ ' + C.bankCategoryGaps(S.data.transactions, S.prefs).length + ' categorie della banca senza famiglia</h3><span>→</span></div>'
      + '<p class="sub" style="margin:0">Associale una volta sola e tutti i movimenti avranno la famiglia di spesa.</p></div>' : '')
    + (gapsImportant.length ? '<div class="card alert" role="button" onclick="nav(\'imports\')"><div class="row"><h3>⤓ ' + gapsImportant.length + (gapsImportant.length === 1 ? ' buco' : ' buchi') + ' tra le importazioni</h3><span>→</span></div>'
      + '<p class="sub" style="margin:0">Il più grande: ' + Math.max(...gapsImportant.map(g => g.days)) + ' giorni senza file importati. Importa un estratto che li copra.</p></div>' : '')
    + (proposals.length ? '<div class="card" role="button" onclick="nav(\'todo\',\'proposals\')"><div class="row"><h3>↻ ' + proposals.length + ' spese ripetitive senza regola</h3><span>→</span></div>'
      + '<p class="sub" style="margin:0">Es. ' + esc(proposals.slice(0, 3).map(p => p.token).join(', ')) + '. Crea una regola e verranno classificate da sole.</p></div>' : '')
    + (receiptsReady() ? '<div class="card" role="button" onclick="nav(\'receipts\')"><div class="row"><h3>🧾 ' + receiptsReady() + ' scontrini da collegare</h3><span>→</span></div><p class="sub" style="margin:0">Ora c\'è un movimento con lo stesso importo: collegali con un tocco.</p></div>' : '')
    + (unlinkedCash ? '<div class="card" role="button" onclick="nav(\'cash\')"><div class="row"><h3>💶 ' + unlinkedCash + ' pagamenti in contanti da collegare</h3><span>→</span></div><p class="sub" style="margin:0">Indica da quale prelievo vengono i contanti.</p></div>' : '')

    + '<div class="grid"><div class="card"><span class="eyebrow">MARGINE / ENTRATE</span><div class="value">' + (s.rate === null ? '—' : Math.round(s.rate * 100) + '%') + '</div><span class="mini">Capacità di risparmio</span></div>'
    + '<div class="card"><span class="eyebrow">IN ATTESA</span><div class="value orange">' + eur(s.pendingOut) + '</div><span class="mini">' + s.pendingCount + ' movimenti da contabilizzare</span></div></div>'
    + (S.data.pairs.length ? '<button class="btn gold wide" style="margin-top:12px" onclick="nav(\'review\')">Verifica ' + S.data.pairs.length + ' possibili abbinamenti →</button>' : '')

    // Avvisi principali
    + (alerts.length ? '<div class="card"><div class="row"><h2>Avvisi</h2><button class="btn secondary small" onclick="nav(\'reports\',\'alerts\')">Tutti (' + alerts.length + ')</button></div>'
      + alerts.slice(0, 3).map(insightRow).join('') + '</div>' : '')

    + '<div class="card"><div class="row"><h2>Il tuo andamento</h2><span class="badge">' + F.months(S.data.transactions, ctx()).length + ' mesi</span></div>' + chart(F.months(S.data.transactions, ctx())) + '</div>'
    + '<div class="card"><div class="row"><h2>Ultimi movimenti</h2><button class="btn secondary small" onclick="nav(\'moves\')">Tutti</button></div>' + recent.map(t => txrow(t)).join('') + '</div>';
};

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
