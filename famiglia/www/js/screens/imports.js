/*
 * imports.js - IMPORTAZIONE DATI e ANALISI DEI BUCHI (visuale).
 *
 * In alto una linea del tempo: in verde i periodi coperti dai file
 * importati, colorati i buchi (più è rosso, più è probabile che manchi un
 * file). Per ogni buco puoi importare un nuovo file oppure dire all'app
 * che "non è un buco": la scelta viene ricordata.
 */
'use strict';

const LEVEL_COLOR = { critica: '#b8473b', alta: '#d9822b', media: '#e3b448', bassa: '#9fb3a8', minima: '#c9d3cb' };
const LEVEL_TEXT = {
  critica: 'Quasi certamente manca un file: importa un estratto che copra questo periodo.',
  alta: 'Molto probabilmente hai saltato un periodo tra due importazioni.',
  media: 'Qualche giorno scoperto: controlla se c\'erano movimenti.',
  bassa: 'Uno-tre giorni: può essere normale, ma verifica.',
  minima: 'Solo sabato/domenica: spesso normale (nessun movimento nel weekend).'
};

Screens.imports = function () {
  const a = S.gaps;
  const ignored = pref('gapIgnored', []);
  let html = '<span class="eyebrow">IMPORTAZIONE DATI</span><h1>Importa e verifica</h1>'
    + '<button class="btn gold wide" onclick="act(\'import\')">＋ Importa estratto Excel (Intesa)</button>'
    + '<p class="mini">Puoi importare file con periodi sovrapposti: i movimenti già presenti non vengono duplicati.</p>';

  if (!a || !a.covered.length) {
    return html + '<div class="hint">Dopo la prima importazione qui vedrai la linea del tempo dei periodi coperti e gli eventuali buchi.</div>';
  }

  // Riepilogo
  const visible = a.gaps;
  html += '<div class="grid3" style="margin-top:14px">'
    + '<div class="card" style="margin:0;padding:14px"><span class="eyebrow">BUCHI</span><div class="value">' + visible.length + '</div></div>'
    + '<div class="card" style="margin:0;padding:14px"><span class="eyebrow">GIORNI SCOPERTI</span><div class="value">' + a.totalGapDays + '</div></div>'
    + '<div class="card" style="margin:0;padding:14px"><span class="eyebrow">COPERTO FINO AL</span><div class="value" style="font-size:17px">' + fmt(a.last) + '</div></div></div>';

  // Controlli sui doppioni
  const checks = (S.checks || []).filter(c => c.level !== 'info');
  html += '<div class="card ' + (checks.length ? 'warn' : '') + '" role="button" onclick="nav(\'checks\')"><div class="row"><h3>⧉ Controlli sui doppioni</h3><span>→</span></div>'
    + '<p class="sub" style="margin:0">' + (checks.length ? checks.length + ' casi da verificare: doppie importazioni, doppi addebiti, spese registrate due volte.' : 'Nessun doppione sospetto tra i movimenti importati.') + '</p></div>';

  // Linea del tempo
  html += '<div class="card"><h2>Linea del tempo</h2>' + timeline(a, ignored)
    + '<div class="legend" style="margin-top:8px"><span><i class="dot" style="background:#78a99a"></i>Coperto</span>'
    + ['critica', 'alta', 'media', 'bassa'].map(l => '<span><i class="dot" style="background:' + LEVEL_COLOR[l] + '"></i>Buco ' + l + '</span>').join('')
    + '<span><i class="dot" style="background:#d8d8d0"></i>Non è un buco</span><span><i class="dot" style="background:#eef1e9;border:1px solid #ccc"></i>Da importare</span></div></div>';

  // Buchi
  if (visible.length) {
    html += '<h2 style="margin-top:22px">Buchi trovati</h2>' + visible.map(gapCard).join('');
  } else {
    html += '<div class="hint">✓ Nessun buco tra i file importati: dal ' + fmt(a.first) + ' al ' + fmt(a.last) + ' ogni giorno è coperto da almeno un file.</div>';
  }

  // Periodo recente
  if (a.recent) {
    html += '<div class="card ' + (a.recent.level === 'alta' ? 'warn' : '') + '"><div class="row"><h3>Periodo non ancora importato</h3>' + level(a.recent.level) + '</div>'
      + '<p class="sub">Dal ' + fmt(a.recent.start) + ' a oggi (' + a.recent.days + ' giorni). Quando vuoi aggiornare i dati, esporta dalla banca un file che parta dal ' + fmt(a.recent.start) + ' o prima.</p>'
      + '<button class="btn secondary wide" onclick="act(\'import\')">Importa aggiornamento</button></div>';
  }

  // Intervalli ignorati
  if (ignored.length) {
    html += '<details class="card"><summary>Intervalli che hai indicato come "non buco" (' + ignored.length + ')</summary>'
      + ignored.map((g, i) => '<div class="kpi"><div class="row"><strong style="font-size:13px">' + fmt(g.start) + ' → ' + fmt(g.end) + '</strong>'
        + '<button class="btn secondary small" onclick="unignoreGap(' + i + ')">Ripristina</button></div>' + (g.note ? '<p class="mini">' + esc(g.note) + '</p>' : '') + '</div>').join('') + '</details>';
  }

  // Archivio importazioni
  html += '<div class="card"><h2>File importati</h2>' + S.data.imports.slice().sort((x, y) => (y.start || '').localeCompare(x.start || '')).map(i => {
    const r = G.importRange(i);
    return '<div class="kpi"><strong style="font-size:13px">' + esc(i.name) + '</strong><p class="mini">' + i.count + ' righe · periodo ' + (r ? fmt(r[0]) + ' → ' + fmt(r[1]) : 'non indicato')
      + ' · importato il ' + fmt((i.created || '').slice(0, 10)) + '</p><button class="btn secondary small" onclick="act(\'original\',{id:' + i.id + '})">Esporta Excel originale</button></div>';
  }).join('') + '</div>'
    + '<div class="hint">Come esportare da Intesa: Conti → Movimenti → scegli il periodo → Esporta in Excel. Per evitare buchi, fai partire ogni nuovo file dall\'ultimo giorno del file precedente.</div>';
  return html;
};

/** Disegno SVG della copertura nel tempo. */
function timeline(a, ignored) {
  const start = a.first, end = U.today() > a.last ? U.today() : a.last;
  const total = Math.max(1, U.daysBetween(start, end) + 1);
  const W = 320, x = d => (U.daysBetween(start, d) / total) * W;
  const w = (s, e) => Math.max(1.5, ((U.daysBetween(s, e) + 1) / total) * W);
  let svg = '<svg class="timeline" viewBox="0 0 ' + W + ' 92" role="img" aria-label="Periodi coperti dalle importazioni">'
    + '<rect x="0" y="22" width="' + W + '" height="30" rx="6" fill="#eef1e9"/>';
  for (const c of a.covered) svg += '<rect x="' + x(c.start) + '" y="22" width="' + w(c.start, c.end) + '" height="30" fill="#78a99a"/>';
  for (const g of ignored) if (g.end >= start && g.start <= end) svg += '<rect x="' + x(g.start < start ? start : g.start) + '" y="22" width="' + w(g.start < start ? start : g.start, g.end > end ? end : g.end) + '" height="30" fill="#d8d8d0"/>';
  for (const g of a.gaps) svg += '<rect x="' + x(g.start) + '" y="16" width="' + w(g.start, g.end) + '" height="42" rx="2" fill="' + LEVEL_COLOR[g.level] + '"><title>' + fmt(g.start) + ' → ' + fmt(g.end) + '</title></rect>';
  // Etichette dei mesi
  const months = [];
  for (let d = start.slice(0, 7) + '-01'; d <= end; d = U.addDays(d, 32).slice(0, 7) + '-01') if (d >= start) months.push(d);
  const step = Math.ceil(months.length / 6);
  months.forEach((m, i) => {
    svg += '<line x1="' + x(m) + '" x2="' + x(m) + '" y1="54" y2="60" stroke="#9aa"/>';
    if (i % step === 0) svg += '<text x="' + x(m) + '" y="74" font-size="9" fill="#71827c">' + m.slice(5, 7) + '/' + m.slice(2, 4) + '</text>';
  });
  svg += '<text x="0" y="12" font-size="9" fill="#71827c">' + fmt(start) + '</text><text x="' + W + '" y="12" font-size="9" fill="#71827c" text-anchor="end">oggi</text></svg>';
  return svg;
}

function gapCard(g, i) {
  return '<div class="card ' + (g.level === 'critica' || g.level === 'alta' ? 'alert' : '') + '">'
    + '<div class="row"><h3>Dal ' + fmt(g.start) + ' al ' + fmt(g.end) + '</h3>' + level(g.level) + '</div>'
    + '<p class="sub" style="margin:4px 0"><b>' + g.days + (g.days === 1 ? ' giorno' : ' giorni') + '</b> senza file importati, tra il file che finisce il ' + fmt(g.before) + ' e quello che inizia il ' + fmt(g.after) + '.'
    + (g.movements ? ' Ci sono ' + g.movements + ' movimenti inseriti a mano in questo periodo.' : '') + '</p>'
    + '<p class="mini">' + LEVEL_TEXT[g.level] + '</p>'
    + '<div class="actions"><button class="btn small" onclick="act(\'import\')">Importa file</button>'
    + '<button class="btn secondary small" onclick="ignoreGap(' + jsArg(g.start) + ',' + jsArg(g.end) + ')">Non è un buco</button></div></div>';
}

function ignoreGap(start, end) {
  modal('Non è un buco', '<p class="sub">Dal ' + fmt(start) + ' al ' + fmt(end) + ' l\'app non segnalerà più nulla, anche nelle prossime analisi.</p>'
    + '<label class="field">Motivo (facoltativo)<input id="gNote" placeholder="Es. conto non ancora aperto, nessun movimento in vacanza"></label>'
    + '<button class="btn wide" onclick="confirmIgnoreGap(' + jsArg(start) + ',' + jsArg(end) + ')">Conferma</button>');
}

function confirmIgnoreGap(start, end) {
  put('gapIgnored', pref('gapIgnored', []).concat([{ start, end, note: $('gNote').value.trim(), date: U.today() }]));
  closeModal();
  derive();
  render();
}

function unignoreGap(i) {
  const list = pref('gapIgnored', []).slice();
  list.splice(i, 1);
  put('gapIgnored', list);
  derive();
  render();
}
