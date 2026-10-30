/*
 * copy.js - COPIA DEI CAMPI sui movimenti simili, e campi "per i report".
 *
 * Quando confermi i dati di un movimento, l'app mostra subito:
 *   - gli altri movimenti dello STESSO ESERCIZIO
 *   - quelli della stessa INSEGNA in altri punti vendita
 *   - quelli dello stesso TIPO di servizio (es. altri abbonamenti AI)
 * Per ognuno vedi "valore attuale → nuovo valore" campo per campo, con una
 * spunta: togli i campi che non sono in comune. Puoi anche spegnere un campo
 * per tutti con un tocco sull'etichetta in alto.
 *
 * In fondo a questo file ci sono i controlli dei campi extra (necessità,
 * natura, etichette...) usati nel dettaglio del movimento.
 */
'use strict';

const GROUP_LABEL = {
  merchant: 'Stesso esercizio',
  brand: 'Stessa insegna, altro punto vendita',
  type: 'Stesso tipo di servizio'
};

let cp = null; // stato della finestra di copia

/** Apre la finestra di copia per i valori appena salvati su "source". */
function offerCopy(source, values, before) {
  const rows = FL.proposals(source, values, S.data.transactions, S.tax, before);
  if (!rows.length) {
    // Nessun altro movimento da aggiornare: basta la memoria esercizi
    const mem = pref('merchantMemory', true) !== false && Object.keys(values).some(k => FL.byKey[k] && FL.byKey[k].memory);
    notice(mem ? 'Salvato. I prossimi movimenti di questo esercizio riceveranno questi dati in automatico.' : 'Salvato');
    return;
  }
  cp = { source, values, rows, limit: { merchant: 30, brand: 15, type: 15 } };
  renderCopy();
}

function renderCopy() {
  const s = cp.source;
  const keys = Object.keys(cp.values);
  // Etichette in alto: stato "acceso" se il campo è spuntato in almeno una riga
  const fieldOn = k => cp.rows.some(r => r.changes.some(c => c.key === k && c.checked));
  let html = '<p class="sub">Hai impostato in <b>' + esc(title(s)) + '</b>:</p><div>'
    + keys.map(k => '<button class="chip ' + (fieldOn(k) ? 'ok' : '') + '" onclick="copyToggleField(' + jsArg(k) + ')">'
      + (fieldOn(k) ? '✓ ' : '○ ') + esc(FL.byKey[k].label) + ': <b>' + esc(FL.format(cp.values[k], k)) + '</b></button>').join('')
    + '</div><p class="mini">Tocca un campo per copiarlo o non copiarlo su tutti. Sotto puoi scegliere movimento per movimento.</p>';

  for (const g of ['merchant', 'brand', 'type']) {
    const rows = cp.rows.map((r, i) => Object.assign({ i }, r)).filter(r => r.group === g);
    if (!rows.length) continue;
    html += '<div class="row" style="margin-top:16px"><h3 style="margin:0">' + GROUP_LABEL[g] + ' (' + rows.length + ')</h3>'
      + '<span><button class="link" onclick="copyGroup(\'' + g + '\',true)">Tutti</button> · <button class="link" onclick="copyGroup(\'' + g + '\',false)">Nessuno</button></span></div>';
    html += rows.slice(0, cp.limit[g]).map(r => {
      const t = r.tx, any = r.changes.some(c => c.checked);
      return '<div class="card" style="padding:12px;margin:8px 0">'
        + '<label class="check" style="margin:0"><input type="checkbox" ' + (any ? 'checked' : '') + ' onchange="copyRow(' + r.i + ',this.checked)">'
        + '<span style="flex:1"><b>' + esc(title(t)) + '</b><br><span class="mini">' + fmt(t.date) + ' · ' + eur(t.cents) + (U.account(t) ? ' · ' + esc(U.account(t)) : '') + '</span></span></label>'
        + r.changes.map((c, j) => '<label class="check" style="margin:6px 0 0 30px;font-size:12px"><input type="checkbox" data-row="' + r.i + '" data-key="' + esc(c.key) + '" '
          + (c.checked ? 'checked' : '') + ' onchange="copyChange(' + r.i + ',' + j + ',this.checked)"><span>' + esc(c.label) + ': <span class="mini">' + esc(FL.format(c.from, c.key))
          + '</span> → <b>' + esc(FL.format(c.to, c.key)) + '</b>' + (!FL.isEmpty(c.from, c.key) && !c.checked ? ' <span class="chip">valore diverso già presente</span>' : '') + '</span></label>').join('')
        + '</div>';
    }).join('');
    if (rows.length > cp.limit[g]) html += '<button class="btn secondary small wide" onclick="cp.limit.' + g + '+=50;renderCopy()">Mostra altri ' + (rows.length - cp.limit[g]) + '</button>';
  }

  // Regola facoltativa per i servizi dello stesso tipo (es. tutti gli abbonamenti AI)
  const dict = C.dictionaryMatch(s);
  if (cp.values.class && cp.rows.some(r => r.group !== 'merchant')) {
    const words = [C.mainToken(s)].concat(cp.rows.filter(r => r.group !== 'merchant').map(r => C.mainToken(r.tx)));
    const text = [...new Set(words.filter(w => w && w.length >= 3))].slice(0, 6).join('|');
    html += '<label class="check" style="margin-top:16px"><input type="checkbox" id="cpRule"' + (dict ? ' checked' : '') + '><span>Crea anche una regola per i <b>prossimi</b> movimenti: le descrizioni che contengono '
      + '<input id="cpRuleText" value="' + esc(text) + '" style="width:100%;margin-top:6px;border:1px solid #dce4dc;border-radius:8px;padding:8px"> andranno in <b>'
      + esc(FL.format(cp.values.class, 'class')) + '</b></span></label>';
  }
  const memory = pref('merchantMemory', true) !== false && keys.some(k => FL.byKey[k].memory);
  html += (memory ? '<p class="mini">🧠 Memoria esercizi attiva: i prossimi movimenti di "' + esc(title(s)) + '" riceveranno questi dati in automatico.</p>' : '')
    + '<button class="btn wide" id="cpApply" onclick="copyApply()"></button>'
    + '<button class="btn secondary wide" style="margin-top:8px" onclick="closeModal()">Solo questo movimento</button>';
  const scroll = $('modal').hidden ? 0 : $('modal').scrollTop;
  modal('Copiare anche su altri movimenti?', html);
  $('modal').scrollTop = scroll;
  copyCount();
}

/** Aggiorna il testo del pulsante con il numero di movimenti e campi selezionati. */
function copyCount() {
  const rows = cp.rows.filter(r => r.changes.some(c => c.checked));
  const fields = U.sum(rows, r => r.changes.filter(c => c.checked).length);
  const b = $('cpApply');
  if (!b) return;
  b.disabled = !rows.length;
  b.textContent = rows.length ? 'Copia su ' + rows.length + (rows.length === 1 ? ' movimento' : ' movimenti') + ' (' + fields + ' campi)' : 'Nessun campo selezionato';
}

function copyChange(i, j, on) {
  cp.rows[i].changes[j].checked = on;
  renderCopy();
}

function copyRow(i, on) {
  for (const c of cp.rows[i].changes) c.checked = on;
  renderCopy();
}

function copyGroup(g, on) {
  for (const r of cp.rows) if (r.group === g) for (const c of r.changes) c.checked = on;
  renderCopy();
}

/** Accende/spegne un campo su tutti i movimenti. */
function copyToggleField(key) {
  const on = !cp.rows.some(r => r.changes.some(c => c.key === key && c.checked));
  for (const r of cp.rows) for (const c of r.changes) if (c.key === key) c.checked = on;
  renderCopy();
}

function copyApply() {
  const items = [];
  for (const r of cp.rows) {
    const values = {};
    for (const c of r.changes) if (c.checked) values[c.key] = c.to;
    if (Object.keys(values).length) items.push(Object.assign({ id: r.tx.id, classifiedBy: 'user' }, FL.toEdit(values)));
  }
  if ($('cpRule') && $('cpRule').checked && $('cpRuleText').value.trim()) {
    const rule = C.ruleFromTx(cp.source, { family: cp.values.class.family, category: cp.values.class.category });
    rule.text = $('cpRuleText').value.trim();
    rule.name = rule.text.split(/[|,]/)[0];
    // I movimenti già presenti li hai appena decisi qui: la regola vale per quelli futuri
    rule.afterId = Math.max(0, ...S.data.transactions.map(t => t.id));
    put('rules', pref('rules', []).concat([rule]));
  }
  // Tutti i movimenti mostrati (anche quelli senza spunta) li hai già decisi tu:
  // la memoria esercizi non deve modificarli dopo, solo i movimenti futuri.
  markMemory(cp.rows.map(r => r.tx));
  closeModal();
  if (items.length) act('bulkEdit', { items, reason: 'Copia da "' + title(cp.source) + '"' });
}

// ---------------------------------------------------------------------
// Campi extra nel dettaglio del movimento
// ---------------------------------------------------------------------

/** Valori già usati per un campo (suggerimenti per scrivere più in fretta). */
function knownValues(key) {
  const set = new Set();
  for (const t of S.data.transactions) {
    const v = (t.extra || {})[key];
    if (Array.isArray(v)) v.forEach(x => set.add(x)); else if (v) set.add(v);
  }
  return [...set].sort();
}

/** Pulsanti a scelta singola (tocca di nuovo per togliere). */
function choiceButtons(id, f, value) {
  return '<input type="hidden" id="' + id + '" value="' + esc(value || '') + '"><div class="tabs" style="margin:6px 0 0">'
    + f.options.map(([v, l]) => '<button type="button" class="' + (v === value ? 'on' : '') + '" onclick="pickChoice(\'' + id + '\',\'' + v + '\',this)">' + esc(l) + '</button>').join('') + '</div>';
}

function pickChoice(id, v, btn) {
  const input = $(id), same = input.value === v;
  input.value = same ? '' : v;
  for (const b of btn.parentNode.children) b.classList.remove('on');
  if (!same) btn.classList.add('on');
}

/** HTML dei campi extra di un movimento (prefix = prefisso degli id). */
function extraInputs(prefix, t) {
  const ex = t.extra || {};
  return FL.FIELDS.filter(f => f.extra).map(f => {
    const id = prefix + '_' + f.key, v = ex[f.key];
    let input;
    if (f.choice) input = choiceButtons(id, f, v);
    else if (f.options) input = '<select id="' + id + '"><option value="">—</option>' + f.options.map(([k, l]) => '<option value="' + k + '"' + (k === v ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select>';
    else if (f.list) input = '<input id="' + id + '" list="' + id + '_l" value="' + esc((v || []).join(', ')) + '" placeholder="separa con la virgola"><datalist id="' + id + '_l">' + knownValues(f.key).map(x => '<option value="' + esc(x) + '">').join('') + '</datalist>';
    else input = '<input id="' + id + '" list="' + id + '_l" value="' + esc(v || '') + '" placeholder="' + esc(f.key === 'merchant' ? title(t) : '') + '"><datalist id="' + id + '_l">' + knownValues(f.key).map(x => '<option value="' + esc(x) + '">').join('') + '</datalist>';
    return '<label class="field">' + esc(f.label) + input + (f.hint ? '<span class="mini">' + esc(f.hint) + '</span>' : '') + '</label>';
  }).join('');
}

/** Legge i campi extra dal modulo: { need: 'utile', tags: ['...'], ... } */
function readExtraInputs(prefix) {
  const out = {};
  for (const f of FL.FIELDS.filter(x => x.extra)) {
    const el = $(prefix + '_' + f.key);
    if (!el) continue;
    out[f.key] = f.list ? el.value.split(',').map(s => s.trim()).filter(Boolean) : el.value.trim();
  }
  return out;
}

/** Riempie il modulo con i dati dell'ultimo movimento compilato dello stesso esercizio. */
function fillFromProfile(id, prefix) {
  const t = txById(id);
  const p = FL.profiles(S.data.transactions, S.tax)[(t.cents < 0 ? -1 : 1) + '|' + C.merchantKey(t)];
  if (!p) return;
  const v = p.values;
  if (v.class) {
    const sel = $(prefix + 'Cat'), val = v.class.family + '||' + v.class.category;
    if (![...sel.options].some(o => o.value === val)) sel.insertAdjacentHTML('beforeend', '<option value="' + esc(val) + '">' + esc(v.class.category) + '</option>');
    sel.value = val;
  }
  if (v.kind && $(prefix + 'Kind')) $(prefix + 'Kind').value = v.kind;
  if (v.person && $(prefix + 'Person')) $(prefix + 'Person').value = v.person;
  for (const f of FL.FIELDS.filter(x => x.extra && x.memory)) {
    const el = $(prefix + 'X_' + f.key);
    if (!el || v[f.key] === undefined) continue;
    el.value = v[f.key];
    if (f.choice) for (const b of el.nextElementSibling.children) b.classList.toggle('on', b.getAttribute('onclick').includes("'" + v[f.key] + "'"));
  }
  notice('Dati copiati dal movimento del ' + fmt(p.date) + ': controlla e salva');
}
