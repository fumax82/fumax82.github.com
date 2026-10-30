/*
 * reports.js - ANALISI: dove vanno i soldi, avvisi su sprechi e abitudini,
 * spese ricorrenti/abbonamenti e analisi della spesa dagli scontrini.
 */
'use strict';

Screens.reports = function () {
  const tab = S.sub.reports || 'overview';
  const alerts = Insights.compute(S.data, S.month, U.today());
  const tabs = [['overview', 'Panoramica'], ['alerts', 'Avvisi (' + alerts.length + ')'], ['recurring', 'Ricorrenti'], ['shopping', 'Spesa e prodotti']];
  return '<span class="eyebrow">DAI NUMERI ALLE SCELTE</span><h1>Analisi</h1>' + monthControl()
    + '<div class="tabs">' + tabs.map(([v, l]) => '<button class="' + (tab === v ? 'on' : '') + '" onclick="S.sub.reports=\'' + v + '\';render()">' + l + '</button>').join('') + '</div>'
    + (tab === 'alerts' ? alertsHtml(alerts) : tab === 'recurring' ? recurringHtml() : tab === 'shopping' ? shoppingHtml() : overviewHtml());
};

function overviewHtml() {
  const a = selected(), s = F.totals(a, ctx()), ms = F.months(S.data.transactions, ctx());
  const byFamily = S.sub.breakdown !== 'category';
  const parts = byFamily ? F.families(a, ctx()) : F.categories(a, ctx());
  return '<div class="card"><div class="row"><h2>Dove vanno i soldi</h2><div class="tabs" style="margin:0">'
    + '<button class="' + (byFamily ? 'on' : '') + '" onclick="S.sub.breakdown=\'family\';render()">Famiglie</button>'
    + '<button class="' + (!byFamily ? 'on' : '') + '" onclick="S.sub.breakdown=\'category\';render()">Categorie</button></div></div>'
    + '<p class="sub">Spese contabilizzate, contanti inclusi. Rimborsi separati: ' + eur(s.refund) + '.</p>'
    + (parts.length ? donut(parts) + bars(parts, byFamily ? 'filterByFamily' : 'filterByCategory') : '<p class="sub">Importa movimenti per iniziare.</p>')
    + '</div>'
    + '<div class="card"><h2>Indicatori</h2>'
    + kpi('Margine del periodo', 'Entrate − spese + rimborsi', '<strong class="' + (s.margin < 0 ? 'red' : 'green') + '">' + eur(s.margin) + '</strong>')
    + kpi('Margine / entrate', 'Capacità di risparmio', '<strong>' + (s.rate === null ? '—' : (s.rate * 100).toFixed(1) + '%') + '</strong>')
    + kpi('Accantonamenti e investimenti', 'Esclusi dai consumi', '<strong>' + eur(s.saving) + '</strong>')
    + kpi('Contanti prelevati', 'Di cui non tracciati: ' + eur(s.cashUntracked), '<strong>' + eur(s.withdrawn) + '</strong>')
    + '</div>'
    + healthCard() + forecastCard()
    + '<div class="card"><h2>Mesi a confronto</h2>' + chart(ms)
    + '<div style="overflow:auto"><table><tr><th>Mese</th><th>Entrate</th><th>Spese</th><th>Margine</th></tr>'
    + ms.map(m => '<tr><td>' + m.month + (G.monthCovered(m.month, S.data.imports) ? '' : ' *') + '</td><td>' + eur(m.income) + '</td><td>' + eur(m.expense - m.refund) + '</td><td>' + eur(m.margin) + '</td></tr>').join('')
    + '</table></div><p class="mini">* Mese non interamente coperto dai file importati (vedi Importa).</p></div>'
    + '<button class="btn secondary wide" onclick="act(\'csv\')">Esporta tutti i movimenti CSV</button>';
}

function kpi(title, sub, value) {
  return '<div class="kpi row"><div>' + title + '<small class="sub" style="display:block">' + esc(sub) + '</small></div>' + value + '</div>';
}

function filterByFamily(f) { S.filterFamily = f === 'Senza famiglia' ? '' : f; S.filterCat = ''; nav('moves'); }
function filterByCategory(c) { S.filterCat = c; S.filterFamily = ''; nav('moves'); }

function alertsHtml(list) {
  const saving = U.sum(list, a => a.saving || 0);
  return '<div class="hint">Avvisi calcolati sui tuoi movimenti del periodo scelto: crescite anomale, abbonamenti doppi o rincarati, costi bancari, piccole spese frequenti, addebiti doppi, contanti senza traccia.</div>'
    + (saving > 0 ? '<div class="hero"><span class="eyebrow">RISPARMIO POTENZIALE STIMATO</span><div class="big">' + eur(saving) + '</div><div class="sub">all\'anno, se agisci sugli avvisi con un\'indicazione di risparmio</div></div>' : '')
    + (list.length ? '<div class="card">' + list.map(insightRow).join('') + '</div>' : '<div class="empty"><div class="glyph">✓</div><p class="sub">Nessun avviso per questo periodo.</p></div>')
    + (pref('hiddenInsights', []).length ? '<button class="btn secondary wide" onclick="put(\'hiddenInsights\',[]);render()">Mostra anche gli avvisi nascosti</button>' : '');
}

function recurringHtml() {
  const groups = C.recurringGroups(S.data.transactions, S.prefs).filter(g => g.sign === 'out');
  const subs = groups.filter(g => g.subscription);
  const monthly = U.sum(subs, g => g.monthly);
  return '<div class="card"><h2>Abbonamenti e spese fisse</h2><p class="sub">Pagamenti regolari verso la stessa controparte, con importo stabile.</p>'
    + '<div class="grid"><div><span class="eyebrow">AL MESE</span><div class="value">' + eur(monthly) + '</div></div><div><span class="eyebrow">ALL\'ANNO</span><div class="value">' + eur(monthly * 12) + '</div></div></div>'
    + subs.map(g => '<div class="kpi"><div class="row"><strong style="font-size:14px">' + esc(g.label) + '</strong><b>' + eur(g.typical) + '</b></div>'
      + '<p class="mini">' + g.cadence + ' · ' + g.count + ' volte · ultimo ' + fmt(g.last) + (g.next ? ' · prossimo ' + fmt(g.next) : '') + ' · ' + esc(g.category || 'senza categoria')
      + (g.rule ? ' · regola attiva' : '') + (g.priceChange > 0 ? ' · <span class="red">rincaro ' + eur(g.priceChange) + '</span>' : '') + '</p>'
      + '<button class="link" onclick="showIds(' + jsArg(g.ids) + ',' + jsArg(g.label) + ')">Vedi pagamenti</button></div>').join('')
    + '</div><div class="card"><h2>Altre spese ripetute</h2><p class="sub">Controparti pagate spesso ma con importi o cadenza variabili (es. supermercato, carburante).</p>'
    + groups.filter(g => !g.subscription).slice(0, 20).map(g => '<div class="kpi"><div class="row"><strong style="font-size:13px">' + esc(g.label) + '</strong><b>' + eur(g.typical) + '</b></div>'
      + '<p class="mini">' + g.count + ' volte · ' + g.cadence + ' · ' + esc(g.category || 'senza categoria') + '</p></div>').join('') + '</div>';
}

// ---------------------------------------------------------------------
// Spesa e prodotti (dagli scontrini)
// ---------------------------------------------------------------------
function shoppingHtml() {
  const f = S.sub.shopFilter || {};
  if (!S.data.receipts.length) {
    return '<div class="empty"><div class="glyph">🧾</div><h2>Nessuno scontrino</h2><p class="sub">Fotografa gli scontrini della spesa: l\'app legge i prodotti e qui vedrai cosa compri, quanto spendi per reparto e come cambiano i prezzi.</p></div>'
      + '<button class="btn wide" onclick="newReceipt()">📷 Fotografa uno scontrino</button>';
  }
  const a = R.analyze(S.data.receipts, f);
  const opt = (vals, cur, label) => '<option value="">' + label + '</option>' + vals.map(v => '<option' + (v === cur ? ' selected' : '') + '>' + esc(v) + '</option>').join('');
  return '<details class="card"' + (Object.values(f).some(Boolean) ? ' open' : '') + '><summary>Filtri</summary>'
    + '<div class="grid"><label class="field">Dal<input type="date" value="' + esc(f.from || '') + '" onchange="setShopFilter(\'from\',this.value)"></label>'
    + '<label class="field">Al<input type="date" value="' + esc(f.to || '') + '" onchange="setShopFilter(\'to\',this.value)"></label></div>'
    + '<label class="field">Negozio<select onchange="setShopFilter(\'shop\',this.value)">' + opt(a.shops, f.shop, 'Tutti i negozi') + '</select></label>'
    + '<label class="field">Reparto<select onchange="setShopFilter(\'category\',this.value)">' + opt(a.categories, f.category, 'Tutti i reparti') + '</select></label>'
    + '<button class="btn secondary wide" onclick="S.sub.shopFilter={};render()">Azzera</button></details>'
    + '<div class="grid3"><div class="card" style="margin:0;padding:14px"><span class="eyebrow">SCONTRINI</span><div class="value">' + a.receipts + '</div></div>'
    + '<div class="card" style="margin:0;padding:14px"><span class="eyebrow">SPESO</span><div class="value" style="font-size:18px">' + eur(a.total) + '</div></div>'
    + '<div class="card" style="margin:0;padding:14px"><span class="eyebrow">MEDIA</span><div class="value" style="font-size:18px">' + eur(a.average) + '</div></div></div>'
    + '<div class="card"><h2>Per reparto</h2>' + donut(a.byCategory) + bars(a.byCategory, 'shopCategory') + '</div>'
    + (a.byMonth.length > 1 ? '<div class="card"><h2>Mese per mese</h2>' + bars(a.byMonth.map(([m, v]) => [monthName(m), v])) + '</div>' : '')
    + '<div class="card"><h2>Dove spendi di più</h2>' + productTable(a.top, 'spent') + '</div>'
    + '<div class="card"><h2>Comprati più spesso</h2>' + productTable(a.frequent, 'count') + '</div>'
    + (a.rising.length ? '<div class="card"><h2>Prezzi in aumento</h2><p class="sub">Stesso prodotto, prezzo unitario più alto rispetto al primo acquisto.</p>'
      + a.rising.map(p => '<div class="kpi row"><div><strong style="font-size:13px">' + esc(p.name) + '</strong><small class="mini" style="display:block">da ' + eur(p.prices[0].unit) + ' a ' + eur(p.prices[p.prices.length - 1].unit) + '</small></div><strong class="red">+' + Math.round(p.change * 100) + '%</strong></div>').join('') + '</div>' : '')
    + '<div class="card"><h2>Negozi</h2>' + a.byShop.map(s => '<div class="kpi row"><div><strong style="font-size:13px">' + esc(s.shop) + '</strong><small class="mini" style="display:block">' + s.count + ' scontrini · media ' + eur(s.average) + '</small></div><b>' + eur(s.total) + '</b></div>').join('') + '</div>'
    + '<button class="btn wide" onclick="nav(\'receipts\')">Vai agli scontrini</button>';
}

function productTable(list, by) {
  return '<table><tr><th>Prodotto</th><th>Volte</th><th>Speso</th></tr>' + list.map(p => '<tr><td>' + esc(p.name) + '<br><span class="mini">' + esc(p.category) + '</span></td><td>' + p.count + '</td><td>' + eur(p.spent) + '</td></tr>').join('') + '</table>';
}

function setShopFilter(k, v) {
  S.sub.shopFilter = Object.assign({}, S.sub.shopFilter, { [k]: v });
  render();
}

function shopCategory(c) { setShopFilter('category', c); }

// ---------------------------------------------------------------------
// Resilienza e scenario di liquidità (dal profilo familiare)
// ---------------------------------------------------------------------
function healthCard() {
  const p = pref('household', {}), liq = Number(p.liquid) || 0, essential = Number(p.essential) || 0, income = Number(p.income) || 0, debt = Number(p.debt) || 0, months = Number(p.reserve) || 6;
  const run = essential > 0 ? liq / essential : null;
  return '<div class="card"><h2>Resilienza della famiglia</h2><p class="sub">Dati mensili dichiarati nelle impostazioni' + (p.asof ? ' · aggiornati al ' + fmt(p.asof) : '') + '.</p>'
    + '<div class="grid"><div><span class="eyebrow">AUTONOMIA LIQUIDITÀ</span><div class="value">' + (run === null ? '—' : run.toFixed(1) + ' mesi') + '</div></div>'
    + '<div><span class="eyebrow">RATE / REDDITO</span><div class="value">' + (income > 0 ? Math.round(debt / income * 100) + '%' : '—') + '</div></div></div>'
    + (essential > 0 ? '<div class="hint ' + (run < months ? 'warn' : '') + '">Riserva obiettivo: ' + eur(essential * months * 100) + ' (' + months + ' mesi di spese essenziali). Da accantonare: ' + eur(Math.max(0, essential * months - liq) * 100) + '.</div>'
      : '<div class="hint">Inserisci liquidità e spese essenziali nelle impostazioni per misurare la riserva.</div>')
    + '<button class="btn secondary wide" onclick="nav(\'settings\')">Aggiorna profilo familiare</button></div>';
}

function forecastCard() {
  const p = pref('household', {});
  if (!(Number(p.essential) > 0 && Number(p.income) > 0)) return '';
  const liquid = Number(p.liquid) || 0, income = Number(p.income), essential = Number(p.essential);
  return '<div class="card"><h2>Scenario di liquidità a 90 giorni</h2><p class="sub">Dal saldo manuale del ' + fmt(p.asof) + '. Reddito e spese essenziali costanti.</p>'
    + '<div class="grid"><div><span class="eyebrow">SCENARIO BASE</span><div class="value">' + eur((liquid + 3 * (income - essential)) * 100) + '</div></div>'
    + '<div><span class="eyebrow">REDDITO −20%</span><div class="value">' + eur((liquid + 3 * (income * 0.8 - essential)) * 100) + '</div></div></div>'
    + '<p class="mini">Stress test illustrativo, non previsione.</p></div>';
}
