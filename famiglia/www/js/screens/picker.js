/*
 * picker.js - SCELTA DELLA CATEGORIA, visuale e veloce.
 *
 * Al posto del lungo menu a tendina:
 *   - in alto i SUGGERIMENTI (proposta dell'app, categorie usate di recente)
 *   - una casella di RICERCA che filtra tutte le categorie mentre scrivi
 *   - le FAMIGLIE come riquadri con icona: tocchi la famiglia e vedi le sue
 *     categorie; da lì puoi anche crearne una nuova
 *
 * Si apre sopra qualsiasi finestra (anche dentro il dettaglio di un movimento).
 * Per il resto del codice non cambia nulla: catSelect(id) crea il pulsante,
 * readCat(id) legge la scelta { family, category }.
 */
'use strict';

const FAMILY_ICON = {
  'Casa': '🏠', 'Alimentari': '🛒', 'Ristoranti e bar': '🍽', 'Trasporti': '🚗', 'Tecnologia e abbonamenti': '💻',
  'Salute e benessere': '🩺', 'Persona e famiglia': '👨‍👩‍👧', 'Svago e viaggi': '✈', 'Shopping': '🛍', 'Finanza e tasse': '🏦',
  'Entrate': '💰', 'Movimenti interni': '🔁', 'Lavoro': '💼'
};
const familyIcon = f => FAMILY_ICON[f] || '📁';

/** Testo del pulsante: "🛒 Alimentari › Supermercato" oppure "Scegli…". */
function catLabel(family, category) {
  if (!category) return '<span class="sub">Scegli famiglia e categoria…</span>';
  return familyIcon(family) + ' ' + (family ? esc(family) + ' › ' : '<span class="orange">senza famiglia</span> › ') + '<b>' + esc(category) + '</b>';
}

/**
 * Campo "Famiglia › categoria". suggestions (facoltativo): [{family, category, reason}]
 * mostrate in cima al selettore.
 */
function catSelect(id, family, category, suggestions) {
  window.pickerSuggest = window.pickerSuggest || {};
  window.pickerSuggest[id] = suggestions || [];
  return '<input type="hidden" id="' + id + '" value="' + esc(category ? (family || '') + '||' + category : '') + '">'
    + '<button type="button" class="catbtn" id="' + id + '_btn" onclick="openPicker(\'' + id + '\')">' + catLabel(family, category) + ' <span class="mini">▾</span></button>';
}

/** Legge la scelta: { family, category } oppure null se vuota. */
function readCat(id) {
  const el = $(id);
  if (!el || !el.value) return null;
  const [family, category] = el.value.split('||');
  return { family, category };
}

/** Imposta la scelta da codice (es. "copia i dati dal movimento precedente"). */
function setCat(id, family, category) {
  if (!$(id)) return;
  $(id).value = category ? (family || '') + '||' + category : '';
  $(id + '_btn').innerHTML = catLabel(family, category) + ' <span class="mini">▾</span>';
}

let pickerTarget = null, pickerOpen = null;

function openPicker(id) {
  pickerTarget = id;
  const cur = readCat(id);
  pickerOpen = cur && cur.family ? cur.family : null;
  $('picker').hidden = false;
  renderPicker('');
  setTimeout(() => $('pkSearch') && $('pkSearch').focus(), 50);
}

function closePicker() {
  $('picker').hidden = true;
  $('picker').innerHTML = '';
}

/** Quante volte è usata ogni categoria (per ordinare e mostrare i numeri). */
function categoryUsage() {
  const n = {};
  for (const t of S.data.transactions) if (t.category) n[t.category] = (n[t.category] || 0) + 1;
  return n;
}

function renderPicker(query) {
  const q = U.norm(query);
  const usage = categoryUsage();
  const cur = readCat(pickerTarget);
  const chip = (f, c, extra) => '<button class="chip pick' + (cur && cur.category === c && (cur.family || '') === (f || '') ? ' ok' : '') + '" onclick="pickCat(' + jsArg(f) + ',' + jsArg(c) + ')">'
    + familyIcon(f) + ' ' + esc(c) + (extra ? ' <span class="mini">' + esc(extra) + '</span>' : '') + '</button>';
  let html = '<div class="sheet picker-sheet"><div class="row"><h2 style="margin:0">Scegli la categoria</h2><button class="close" onclick="closePicker()" aria-label="Chiudi">×</button></div>'
    + '<input id="pkSearch" class="search" placeholder="🔍 Cerca: supermercato, AI, farmacia…" value="' + esc(query) + '" oninput="renderPickerKeep(this.value)">';

  if (q) {
    // Ricerca su tutte le categorie (e sulle famiglie)
    const hits = [];
    for (const f of S.tax) for (const c of f.categories) if (U.norm(c).includes(q) || U.norm(f.family).includes(q)) hits.push([f.family, c]);
    html += '<div class="pick-list">' + (hits.length ? hits.map(([f, c]) => chip(f, c, f)).join('') : '<p class="sub">Nessuna categoria con "' + esc(query) + '".</p>') + '</div>'
      + '<button class="btn secondary wide" onclick="newCategoryFromSearch()">＋ Crea la categoria "' + esc(query) + '"</button>';
  } else {
    const sug = (window.pickerSuggest[pickerTarget] || []).filter(s => s && s.category);
    const recent = pref('recentCats', []).filter(r => !sug.some(s => s.category === r.category));
    if (sug.length || recent.length) {
      html += '<p class="eyebrow" style="margin:14px 0 6px">Suggerite</p><div class="pick-list">'
        + sug.map(s => chip(s.family, s.category, s.reason ? '· ' + s.reason : '')).join('')
        + recent.slice(0, 6).map(r => chip(r.family, r.category)).join('') + '</div>';
    }
    html += '<p class="eyebrow" style="margin:16px 0 6px">Famiglie</p><div class="fam-grid">'
      + S.tax.map(f => {
        const n = f.categories.reduce((s, c) => s + (usage[c] || 0), 0);
        return '<button class="fam-card' + (pickerOpen === f.family ? ' open' : '') + '" onclick="pickerToggle(' + jsArg(f.family) + ')"><span class="fam-ico">' + familyIcon(f.family) + '</span>'
          + '<span class="fam-name">' + esc(f.family) + '</span><span class="mini">' + f.categories.length + ' categorie' + (n ? ' · ' + n + ' mov.' : '') + '</span></button>';
      }).join('') + '</div>';
    if (pickerOpen) {
      const f = S.tax.find(x => x.family === pickerOpen);
      if (f) {
        const cats = f.categories.slice().sort((a, b) => (usage[b] || 0) - (usage[a] || 0));
        html += '<div class="card" style="margin-top:12px"><h3>' + familyIcon(f.family) + ' ' + esc(f.family) + '</h3><div class="pick-list">'
          + cats.map(c => chip(f.family, c, usage[c] ? String(usage[c]) : '')).join('')
          + '<button class="chip" onclick="newCategoryIn(' + jsArg(f.family) + ')">＋ Nuova categoria</button></div></div>';
      }
    }
    html += '<div class="actions"><button class="btn secondary" onclick="newFamily()">＋ Nuova famiglia</button>'
      + (cur ? '<button class="btn secondary" onclick="pickCat(\'\',\'\')">Togli la categoria</button>' : '') + '</div>';
  }
  $('picker').innerHTML = html + '</div>';
}

/** Ridisegna mantenendo il cursore nella ricerca. */
function renderPickerKeep(v) {
  renderPicker(v);
  const el = $('pkSearch');
  el.focus();
  el.setSelectionRange(v.length, v.length);
}

function pickerToggle(family) {
  pickerOpen = pickerOpen === family ? null : family;
  renderPicker('');
}

/** Scelta fatta: aggiorna il campo, ricorda le recenti, chiude. */
function pickCat(family, category) {
  setCat(pickerTarget, family, category);
  if (category) {
    const recent = [{ family, category }].concat(pref('recentCats', []).filter(r => r.category !== category)).slice(0, 8);
    S.prefs.recentCats = recent;
    act('pref', { key: 'recentCats', value: JSON.stringify(recent) });
  }
  closePicker();
  const el = $(pickerTarget);
  if (el) el.dispatchEvent(new Event('change'));
}

function newCategoryIn(family) {
  const name = prompt('Nome della nuova categoria in "' + family + '"');
  if (!name || !name.trim()) return;
  ensureTaxonomy(family, name.trim());
  pickCat(family, name.trim());
}

function newCategoryFromSearch() {
  const name = $('pkSearch').value.trim();
  const family = prompt('In quale famiglia va "' + name + '"?\n\nFamiglie esistenti: ' + S.tax.map(f => f.family).join(', '), pickerOpen || '');
  if (!family || !family.trim()) return;
  const f = S.tax.find(x => U.norm(x.family) === U.norm(family.trim()));
  ensureTaxonomy(f ? f.family : family.trim(), name);
  pickCat(f ? f.family : family.trim(), name);
}

function newFamily() {
  const family = prompt('Nome della nuova famiglia di spesa (es. Lavoro)');
  if (!family || !family.trim()) return;
  const category = prompt('Prima categoria della famiglia "' + family.trim() + '"');
  if (!category || !category.trim()) return;
  ensureTaxonomy(family.trim(), category.trim());
  pickCat(family.trim(), category.trim());
}
