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
  type: 'Stesso tipo di servizio',
  subject: 'Movimenti del soggetto'
};

/** Campi che una scheda soggetto può assegnare (non quelli del singolo acquisto). */
const SUBJECT_KEYS = ['class', 'kind', 'accountUser', 'person', 'need', 'nature', 'tax', 'tags'];

let cp = null; // stato della finestra di copia

/** Apre la finestra di copia per i valori appena salvati su "source". */
function offerCopy(source, values, before) {
  const rows = FL.proposals(source, values, S.data.transactions, S.tax, before);
  const sj = subjectOf(source);
  if (!rows.length && !(sj && subjectDiffers(sj, values))) {
    // Nessun altro movimento da aggiornare: basta la memoria esercizi
    const mem = pref('merchantMemory', true) !== false && Object.keys(values).some(k => FL.byKey[k] && FL.byKey[k].memory);
    notice(sj ? 'Salvato' : mem ? 'Salvato. I prossimi movimenti di questo esercizio riceveranno questi dati in automatico.' : 'Salvato');
    return;
  }
  cp = { source, values, rows, limit: { merchant: 30, brand: 15, type: 15, subject: 40 } };
  renderCopy();
}

/** I valori appena salvati sono diversi da quelli della scheda del soggetto? */
function subjectDiffers(sj, values) {
  const cur = SJ.values(sj);
  return SUBJECT_KEYS.some(k => values[k] !== undefined && !FL.same(cur[k] === undefined ? (k === 'class' ? { family: '', category: '' } : '') : cur[k], values[k], k));
}

function renderCopy() {
  const s = cp.source;
  const keys = Object.keys(cp.values);
  // Etichette in alto: stato "acceso" se il campo è spuntato in almeno una riga
  const fieldOn = k => cp.rows.some(r => r.changes.some(c => c.key === k && c.checked));
  let html = (cp.subject
    ? '<p class="sub">' + typeIcon(cp.subject.type) + ' Il soggetto <b>' + esc(cp.subject.name) + '</b> assegna ai suoi movimenti:</p><div>'
    : '<p class="sub">Hai impostato in <b>' + esc(title(s)) + '</b>:</p><div>')
    + keys.map(k => '<button class="chip ' + (fieldOn(k) ? 'ok' : '') + '" onclick="copyToggleField(' + jsArg(k) + ')">'
      + (fieldOn(k) ? '✓ ' : '○ ') + esc(FL.byKey[k].label) + ': <b>' + esc(FL.format(cp.values[k], k)) + '</b></button>').join('')
    + '</div><p class="mini">Tocca un campo per copiarlo o non copiarlo su tutti. Sotto puoi scegliere movimento per movimento.</p>';

  for (const g of ['subject', 'merchant', 'brand', 'type']) {
    const rows = cp.rows.map((r, i) => Object.assign({ i }, r)).filter(r => r.group === g);
    if (!rows.length) continue;
    html += '<div class="row" style="margin-top:16px"><h3 style="margin:0">' + (g === 'subject' ? 'Movimenti di "' + esc(cp.subject.name) + '"' : GROUP_LABEL[g]) + ' (' + rows.length + ')</h3>'
      + '<span><button class="link" onclick="copyGroup(\'' + g + '\',true)">Tutti</button> · <button class="link" onclick="copyGroup(\'' + g + '\',false)">Nessuno</button></span></div>';
    html += rows.slice(0, cp.limit[g]).map(r => {
      const t = r.tx, any = r.changes.some(c => c.checked);
      return '<div class="card" style="padding:12px;margin:8px 0">'
        + '<label class="check" style="margin:0"><input type="checkbox" ' + (any ? 'checked' : '') + ' onchange="copyRow(' + r.i + ',this.checked)">'
        + '<span style="flex:1"><b>' + esc(title(t)) + '</b><br><span class="mini">' + fmt(t.date) + ' · ' + eur(t.cents) + (U.account(t) ? ' · ' + esc(U.account(t)) : '')
        + (title(t) !== (t.details || t.operation) ? '<br><i>' + esc(t.details || t.operation) + '</i>' : '') + '</span></span></label>'
        + r.changes.map((c, j) => '<label class="check" style="margin:6px 0 0 30px;font-size:12px"><input type="checkbox" data-row="' + r.i + '" data-key="' + esc(c.key) + '" '
          + (c.checked ? 'checked' : '') + ' onchange="copyChange(' + r.i + ',' + j + ',this.checked)"><span>' + esc(c.label) + ': <span class="mini">' + esc(FL.format(c.from, c.key))
          + '</span> → <b>' + esc(FL.format(c.to, c.key)) + '</b>' + (!FL.isEmpty(c.from, c.key) && !c.checked ? ' <span class="chip">valore diverso già presente</span>' : '') + '</span></label>').join('')
        + '</div>';
    }).join('');
    if (rows.length > cp.limit[g]) html += '<button class="btn secondary small wide" onclick="cp.limit.' + g + '+=50;renderCopy()">Mostra altri ' + (rows.length - cp.limit[g]) + '</button>';
  }

  // Regola facoltativa per i servizi dello stesso tipo (es. tutti gli abbonamenti AI)
  const dict = s ? C.dictionaryMatch(s) : null;
  if (s && cp.values.class && cp.rows.some(r => r.group !== 'merchant')) {
    const words = [C.mainToken(s)].concat(cp.rows.filter(r => r.group !== 'merchant').map(r => C.mainToken(r.tx)));
    const text = [...new Set(words.filter(w => w && w.length >= 3))].slice(0, 6).join('|');
    html += '<label class="check" style="margin-top:16px"><input type="checkbox" id="cpRule"' + (dict ? ' checked' : '') + '><span>Crea anche una regola per i <b>prossimi</b> movimenti: le descrizioni che contengono '
      + '<input id="cpRuleText" value="' + esc(text) + '" style="width:100%;margin-top:6px;border:1px solid #dce4dc;border-radius:8px;padding:8px"> andranno in <b>'
      + esc(FL.format(cp.values.class, 'class')) + '</b></span></label>';
  }
  // Scheda del soggetto: aggiornarla o crearla, così valgono anche i movimenti futuri
  const sj = s ? subjectOf(s) : null;
  if (s && sj && subjectDiffers(sj, cp.values)) {
    html += '<label class="check" style="margin-top:16px"><input type="checkbox" id="cpSubjUpd" checked onchange="copyCount()"><span>' + typeIcon(sj.type) + ' Aggiorna anche la scheda del soggetto <b>' + esc(sj.name)
      + '</b>: i suoi prossimi movimenti useranno questi dati</span></label>';
  } else if (s && !sj) {
    const keysForSubject = keys.filter(k => SUBJECT_KEYS.includes(k));
    if (keysForSubject.length) {
      html += '<label class="check" style="margin-top:16px"><input type="checkbox" id="cpSubjNew"' + (cp.rows.some(r => r.group === 'merchant') ? ' checked' : '') + ' onchange="copyCount()"><span>👤 Crea il soggetto '
        + '<input id="cpSubjName" value="' + esc(SJ.suggestedName(s)) + '" style="width:100%;margin-top:6px;border:1px solid #dce4dc;border-radius:8px;padding:8px">'
        + ' con questi dati: riconoscerà da solo i suoi movimenti futuri e potrai dargli una descrizione</span></label>';
    }
  }
  const memory = s && !sj && pref('merchantMemory', true) !== false && keys.some(k => FL.byKey[k].memory);
  html += (memory ? '<p class="mini">🧠 Memoria esercizi attiva: i prossimi movimenti di "' + esc(title(s)) + '" riceveranno questi dati in automatico.</p>' : '')
    + (cp.subject && cp.subject.auto !== false ? '<p class="mini">🔄 I prossimi movimenti di "' + esc(cp.subject.name) + '" riceveranno questi dati da soli.</p>' : '')
    + '<button class="btn wide" id="cpApply" onclick="copyApply()"></button>'
    + '<button class="btn secondary wide" style="margin-top:8px" onclick="closeModal()">' + (cp.subject ? 'Non ora' : 'Solo questo movimento') + '</button>';
  const scroll = $('modal').hidden ? 0 : $('modal').scrollTop;
  modal(cp.subject ? 'Assegnare i dati di "' + cp.subject.name + '"?' : cp.rows.length ? 'Copiare anche su altri movimenti?' : 'Aggiornare la scheda del soggetto?', html);
  $('modal').scrollTop = scroll;
  copyCount();
}

/** Aggiorna il testo del pulsante con il numero di movimenti e campi selezionati. */
function copyCount() {
  const rows = cp.rows.filter(r => r.changes.some(c => c.checked));
  const fields = U.sum(rows, r => r.changes.filter(c => c.checked).length);
  const b = $('cpApply');
  if (!b) return;
  const subj = ($('cpSubjUpd') && $('cpSubjUpd').checked) || ($('cpSubjNew') && $('cpSubjNew').checked);
  b.disabled = !rows.length && !subj;
  b.textContent = rows.length ? (cp.subject ? 'Assegna a ' : 'Copia su ') + rows.length + (rows.length === 1 ? ' movimento' : ' movimenti') + ' (' + fields + ' campi)' + (subj ? ' e salva la scheda' : '')
    : subj ? 'Salva la scheda del soggetto' : 'Nessun campo selezionato';
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
    if (Object.keys(values).length) items.push(Object.assign({ id: r.tx.id, classifiedBy: cp.subject ? 'subject:' + cp.subject.id : 'user' }, FL.toEdit(values)));
  }
  // Scheda soggetto: aggiorna o crea con i valori appena scelti
  const forSubject = {};
  for (const k of SUBJECT_KEYS) if (cp.values[k] !== undefined && !FL.isEmpty(cp.values[k], k)) forSubject[k] = cp.values[k];
  const maxId = Math.max(0, ...S.data.transactions.map(t => t.id));
  if ($('cpSubjUpd') && $('cpSubjUpd').checked) {
    const sj = subjectOf(cp.source);
    const upd = Object.assign({}, sj, { set: Object.assign({}, sj.set, forSubject), since: maxId });
    S.subjects = S.subjects.map(x => (x.id === sj.id ? upd : x));
    put('subjects', S.subjects);
  } else if ($('cpSubjNew') && $('cpSubjNew').checked) {
    const ns = SJ.fromTx(cp.source, forSubject);
    ns.name = $('cpSubjName').value.trim() || ns.name;
    ns.since = maxId;
    S.subjects = S.subjects.concat([ns]);
    put('subjects', S.subjects);
    // Il movimento di partenza e quelli dello stesso esercizio ora appartengono al soggetto
    notice('Soggetto "' + ns.name + '" creato: aprilo da Classifica › Soggetti per aggiungere una descrizione');
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
  if (cp.source) markMemory(cp.rows.map(r => r.tx));
  closeModal();
  if (items.length) act('bulkEdit', { items, reason: cp.subject ? 'Soggetto "' + cp.subject.name + '"' : 'Copia da "' + title(cp.source) + '"' });
  else render();
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
function extraInputs(prefix, t, skip) {
  const ex = t.extra || {};
  return FL.FIELDS.filter(f => f.extra && !f.hidden && !(skip || []).includes(f.key)).map(f => {
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
  if (v.class) setCat(prefix + 'Cat', v.class.family, v.class.category);
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
