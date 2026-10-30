/*
 * plan.js - PROGETTI: budget per categoria, obiettivi di risparmio e
 * simulatore di piano di accumulo (dalla versione 1.0, riorganizzati).
 */
'use strict';

Screens.plan = function () {
  const tab = S.sub.plan || 'budget';
  return '<span class="eyebrow">DISEGNA IL PROSSIMO PASSO</span><h1>Progetti</h1><div class="tabs">'
    + [['budget', 'Budget'], ['goals', 'Obiettivi'], ['simulate', 'Simulatore']].map(([v, l]) => '<button class="' + (tab === v ? 'on' : '') + '" onclick="S.sub.plan=\'' + v + '\';render()">' + l + '</button>').join('')
    + '</div>' + (tab === 'budget' ? budgetHtml() : tab === 'goals' ? goalsHtml() : simulatorHtml());
};

function budgetHtml() {
  const budgets = pref('budgets', {});
  const spend = Object.fromEntries(F.categories(selected(), ctx()));
  const cats = [...new Set([...Object.keys(budgets), ...Object.keys(spend)])].sort();
  return monthControl() + '<div class="hint">Limiti mensili per categoria. Quando superi l\'80% ricevi un avviso in Analisi.</div>'
    + (!S.month ? '<p class="hint warn">Seleziona un mese per confrontare il budget.</p>' : '')
    + cats.map(c => {
      const b = budgets[c] || 0, s = spend[c] || 0;
      return '<div class="card"><div class="row"><h3>' + esc(c) + '</h3><span class="badge ' + (b && S.month && s > b ? 'warn' : '') + '">' + (b && S.month ? Math.round(s / b * 100) + '%' : 'Nessun limite') + '</span></div>'
        + '<div class="row"><span class="sub">Speso ' + eur(s) + '</span><strong>' + eur(b) + '</strong></div>'
        + '<div class="track"><div class="fill" style="width:' + (b && S.month ? Math.min(100, s / b * 100) : 0) + '%;background:' + (s > b ? '#c79461' : '#78a99a') + '"></div></div></div>';
    }).join('') + '<button class="btn wide" onclick="editBudget()">Imposta un budget di categoria</button>';
}

function editBudget() {
  const cats = [...new Set(S.tax.flatMap(f => f.categories).concat(S.data.transactions.map(t => t.category).filter(Boolean)))].sort();
  modal('Budget mensile', '<label class="field">Categoria<input id="bCat" list="catlist"><datalist id="catlist">' + cats.map(c => '<option value="' + esc(c) + '">').join('') + '</datalist></label>'
    + '<label class="field">Limite mensile in € (0 per rimuovere)<input id="bAmount" type="number" min="0" step="0.01"></label><button class="btn wide" onclick="saveBudget()">Salva limite</button>');
}

function saveBudget() {
  const c = $('bCat').value.trim(), v = Number($('bAmount').value);
  if (!c || !Number.isFinite(v) || v < 0) { notice('Categoria e importo valido richiesti'); return; }
  const b = Object.assign({}, pref('budgets', {}));
  if (v === 0) delete b[c]; else b[c] = Math.round(v * 100);
  put('budgets', b);
  closeModal();
  render();
}

function goalsHtml() {
  const a = pref('goals', []);
  return '<p class="sub">Quote dedicate ai tuoi progetti. Gli importi accantonati sono inseriti manualmente.</p>'
    + a.map((g, i) => {
      const remaining = Math.max(0, g.target - g.saved), months = Math.max(1, Math.ceil((Date.parse(g.date) - Date.now()) / 2629800000));
      return '<div class="card"><div class="row"><h2>' + esc(g.name) + '</h2><span class="badge">' + Math.round(g.saved / g.target * 100) + '%</span></div>'
        + '<div class="value">' + eur(g.saved) + '</div><p class="sub">di ' + eur(g.target) + ' · entro ' + fmt(g.date) + '</p>'
        + '<div class="track"><div class="fill" style="width:' + Math.min(100, g.saved / g.target * 100) + '%"></div></div>'
        + '<p class="sub">' + (g.date < U.today() ? 'Scadenza superata. Mancano ' + eur(remaining) : 'Quota indicativa: ' + eur(remaining / months) + ' al mese') + '</p>'
        + '<button class="btn secondary" onclick="editGoal(' + i + ')">Aggiorna</button></div>';
    }).join('') + '<button class="btn wide" onclick="editGoal(-1)">＋ Nuovo obiettivo</button>';
}

function editGoal(i) {
  const g = pref('goals', [])[i] || { name: '', target: 0, saved: 0, date: '' };
  modal('Obiettivo familiare', '<label class="field">Nome<input id="gName" value="' + esc(g.name) + '"></label>'
    + '<div class="grid"><label class="field">Obiettivo €<input id="gTarget" type="number" min="1" value="' + g.target / 100 + '"></label>'
    + '<label class="field">Già accantonato €<input id="gSaved" type="number" min="0" value="' + g.saved / 100 + '"></label></div>'
    + '<label class="field">Entro il<input id="gDate" type="date" value="' + g.date + '"></label><button class="btn wide" onclick="saveGoal(' + i + ')">Salva obiettivo</button>'
    + (i >= 0 ? '<button class="btn danger wide" style="margin-top:12px" onclick="deleteGoal(' + i + ')">Elimina obiettivo</button>' : ''));
}

function saveGoal(i) {
  const g = { name: $('gName').value.trim(), target: Math.round(Number($('gTarget').value) * 100), saved: Math.round(Number($('gSaved').value) * 100), date: $('gDate').value };
  if (!g.name || g.target <= 0 || g.saved < 0 || !g.date || !Number.isFinite(g.target + g.saved)) { notice('Completa i campi con valori validi'); return; }
  const a = pref('goals', []).slice();
  if (i < 0) a.push(g); else a[i] = g;
  put('goals', a);
  closeModal();
  render();
}

function deleteGoal(i) {
  if (!confirm('Eliminare questo obiettivo?')) return;
  const a = pref('goals', []).slice();
  a.splice(i, 1);
  put('goals', a);
  closeModal();
  render();
}

function simulatorHtml() {
  const p = pref('sim', { capital: 1000, monthly: 100, years: 10, rate: 3, cost: 0.3, inflation: 2 });
  return '<div class="card"><h2>Il tempo fa la differenza</h2><p class="sub">Simula versamenti mensili con rendimento costante. Le ipotesi sono esempi modificabili, non previsioni o consigli.</p><div class="grid">'
    + [['capital', 'Capitale iniziale €'], ['monthly', 'Versamento mensile €'], ['years', 'Durata in anni'], ['rate', 'Rendimento annuo lordo %'], ['cost', 'Costo annuo %'], ['inflation', 'Inflazione annua %']]
      .map(([k, l]) => '<label class="field">' + l + '<input id="s_' + k + '" type="number" step="0.1" value="' + p[k] + '"></label>').join('')
    + '</div><button class="btn wide" onclick="calculate()">Confronta gli scenari</button></div><div id="simResult">' + (window.simHtml || '') + '</div>'
    + '<div class="hint">Prima di investire: orizzonte, liquidità necessaria, capacità di sostenere perdite, diversificazione e costi. La fiscalità non è inclusa.</div>';
}

function calculate() {
  const p = {};
  for (const k of ['capital', 'monthly', 'years', 'rate', 'cost', 'inflation']) p[k] = Number($('s_' + k).value);
  if (Object.values(p).some(v => !Number.isFinite(v)) || p.capital < 0 || p.monthly < 0 || p.years < 1 || p.years > 60 || p.cost < 0 || p.inflation <= -100 || p.rate - p.cost - 3 <= -100) {
    notice('Verifica valori e durata (1–60 anni)');
    return;
  }
  const scenarios = [['Più basso', p.rate - 3], ['Ipotesi centrale', p.rate], ['Più alto', p.rate + 3]];
  window.simHtml = '<div class="card"><h2>Scenari illustrativi</h2>' + scenarios.map(([l, r]) => {
    const s = F.pac(p.capital, p.monthly, p.years, r, p.cost, p.inflation);
    return '<div class="kpi"><span class="eyebrow">' + l + ' · ' + r.toFixed(1) + '% lordo</span><div class="value">' + eur(s.end * 100) + '</div><p class="mini">Versato ' + eur(s.paid * 100) + ' · potere d\'acquisto odierno ' + eur(s.real * 100) + '</p></div>';
  }).join('') + '<p class="mini">Scenari ±3 punti: scelta illustrativa. Rendimenti e capitale possono diminuire.</p></div>';
  $('simResult').innerHTML = window.simHtml;
  if (window.Native) window.Native.action('pref', JSON.stringify({ key: 'sim', value: JSON.stringify(p) }));
}
