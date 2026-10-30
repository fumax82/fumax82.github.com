/*
 * categories.js - FAMIGLIE E CATEGORIE: vedere, rinominare, spostare, unire.
 *
 * Ogni famiglia è un riquadro con icona, numero di movimenti e totale.
 * Toccando una categoria puoi:
 *   - rinominarla
 *   - spostarla in un'altra famiglia
 *   - unirla a un'altra categoria (es. "Supermercati" dentro "Supermercato")
 *   - eliminarla (se ha movimenti, prima scegli dove spostarli)
 * Prima di cambiare i movimenti l'app mostra quanti e quali sono, e aggiorna
 * anche soggetti, regole e budget che usano quella categoria.
 */
'use strict';

/** Statistiche per categoria: numero movimenti e totale speso/entrato. */
function categoryStats() {
  const st = {};
  for (const t of S.data.transactions) {
    if (t.state !== 'active' || !t.category) continue;
    const k = U.norm(t.category);
    const x = (st[k] = st[k] || { n: 0, total: 0 });
    x.n++; x.total += t.cents;
  }
  return st;
}

function categoriesHtml() {
  const st = categoryStats();
  const open = S.sub.catOpen;
  return '<p class="sub">Tocca una famiglia per vedere le sue categorie; tocca una categoria per rinominarla, spostarla o unirla a un\'altra.</p>'
    + '<div class="fam-grid">' + S.tax.map(f => {
      const n = U.sum(f.categories, c => (st[U.norm(c)] || {}).n || 0);
      const tot = U.sum(f.categories, c => (st[U.norm(c)] || {}).total || 0);
      return '<button class="fam-card' + (open === f.family ? ' open' : '') + '" onclick="S.sub.catOpen=' + (open === f.family ? 'null' : jsArg(f.family)) + ';render()">'
        + '<span class="fam-ico">' + familyIcon(f.family) + '</span><span class="fam-name">' + esc(f.family) + '</span>'
        + '<span class="mini">' + f.categories.length + ' cat. · ' + n + ' mov.' + (tot ? ' · ' + eur(tot) : '') + '</span></button>';
    }).join('') + '</div>'
    + (open && S.tax.find(f => f.family === open) ? familyPanel(S.tax.find(f => f.family === open), st) : '')
    + '<div class="actions"><button class="btn" onclick="addFamilyCat()">＋ Nuova famiglia</button><button class="btn secondary" onclick="resetTaxonomy()">Ripristina predefinite</button></div>';
}

function familyPanel(f, st) {
  const cats = f.categories.slice().sort((a, b) => ((st[U.norm(b)] || {}).n || 0) - ((st[U.norm(a)] || {}).n || 0));
  return '<div class="card"><div class="row"><h2 style="margin:0">' + familyIcon(f.family) + ' ' + esc(f.family) + '</h2>'
    + '<button class="btn secondary small" onclick="renameFamily(' + jsArg(f.family) + ')">Rinomina</button></div>'
    + cats.map(c => {
      const x = st[U.norm(c)] || { n: 0, total: 0 };
      return '<div class="tx" onclick="openCategory(' + jsArg(f.family) + ',' + jsArg(c) + ')"><div class="txmain"><strong>' + esc(c) + '</strong><small>' + x.n + ' movimenti</small></div>'
        + '<div class="amount">' + (x.n ? eur(x.total) : '') + '</div></div>';
    }).join('')
    + '<div class="actions"><button class="btn secondary small" onclick="addCategoryTo(' + jsArg(f.family) + ')">＋ Categoria</button>'
    + (cats.length ? '' : '<button class="btn danger small" onclick="deleteFamily(' + jsArg(f.family) + ')">Elimina famiglia vuota</button>') + '</div></div>';
}

// ---------------------------------------------------------------------
// Azioni su una categoria
// ---------------------------------------------------------------------

function openCategory(family, category) {
  const others = [];
  for (const f of S.tax) for (const c of f.categories) if (!(f.family === family && c === category)) others.push([f.family, c]);
  const n = movementsWithCategory(family, category).length;
  modal(category, '<p class="sub">' + familyIcon(family) + ' ' + esc(family) + ' · ' + n + ' movimenti'
    + (n ? ' <button class="link" onclick="showIds(' + jsArg(movementsWithCategory(family, category).map(t => t.id)) + ',' + jsArg(category) + ')">Vedi</button>' : '') + '</p>'
    + '<label class="field">Nuovo nome<input id="catNewName" value="' + esc(category) + '"></label>'
    + '<button class="btn wide" onclick="taxChange({type:\'rename\',family:' + esc(JSON.stringify(family)) + ',from:' + esc(JSON.stringify(category)) + ',to:$(\'catNewName\').value.trim()})">Rinomina</button>'
    + '<label class="field" style="margin-top:20px">Sposta nella famiglia<select id="catMoveTo">' + S.tax.filter(f => f.family !== family).map(f => '<option>' + esc(f.family) + '</option>').join('') + '</select></label>'
    + '<button class="btn secondary wide" onclick="taxChange({type:\'move\',family:' + esc(JSON.stringify(family)) + ',from:' + esc(JSON.stringify(category)) + ',toFamily:$(\'catMoveTo\').value})">Sposta</button>'
    + '<label class="field" style="margin-top:20px">Unisci a un\'altra categoria (i movimenti passano lì, questa sparisce)<select id="catMergeTo">'
    + others.map(([f, c]) => '<option value="' + esc(f + '||' + c) + '">' + esc(f + ' › ' + c) + '</option>').join('') + '</select></label>'
    + '<button class="btn secondary wide" onclick="const v=$(\'catMergeTo\').value.split(\'||\');taxChange({type:\'merge\',family:' + esc(JSON.stringify(family)) + ',from:' + esc(JSON.stringify(category)) + ',toFamily:v[0],to:v[1]})">Unisci</button>'
    + (n ? '' : '<button class="btn danger wide" style="margin-top:20px" onclick="taxChange({type:\'delete\',family:' + esc(JSON.stringify(family)) + ',from:' + esc(JSON.stringify(category)) + '})">Elimina categoria</button>'));
}

/** Movimenti con una certa famiglia/categoria (famiglia scritta o dedotta). */
function movementsWithCategory(family, category) {
  return S.data.transactions.filter(t => t.state !== 'excluded' && U.norm(t.category) === U.norm(category) && (C.familyOf(t, S.tax) || family) === family);
}

/**
 * Cambio della tassonomia con conferma. op = { type, family, from, to, toFamily }
 * Mostra cosa cambia (movimenti, soggetti, regole, budget) e poi applica.
 */
function taxChange(op) {
  const fam = op.toFamily || op.family;
  const cat = op.type === 'rename' || op.type === 'merge' ? op.to : op.from;
  if ((op.type === 'rename' || op.type === 'merge') && !cat) { notice('Scrivi il nuovo nome'); return; }
  if (op.type === 'rename' && cat === op.from) { closeModal(); return; }
  const moves = op.type === 'delete' ? [] : movementsWithCategory(op.family, op.from);
  const subjects = S.subjects.filter(s => s.set && s.set.class && U.norm(s.set.class.category) === U.norm(op.from) && (s.set.class.family || op.family) === op.family);
  const rules = pref('rules', []).filter(r => r.set && U.norm(r.set.category) === U.norm(op.from));
  const verb = { rename: 'Rinominare', move: 'Spostare', merge: 'Unire', delete: 'Eliminare' }[op.type];
  window.pendingTax = op;
  modal(verb + ' "' + op.from + '"?', '<p class="sub">' + (op.type === 'delete' ? 'La categoria verrà tolta dall\'elenco.'
    : 'Diventerà <b>' + esc(fam + ' › ' + cat) + '</b>.') + '</p>'
    + '<div class="card"><p class="sub" style="margin:0">' + moves.length + ' movimenti · ' + subjects.length + ' soggetti · ' + rules.length + ' regole saranno aggiornati.</p>'
    + moves.slice(0, 8).map(t => txrow(t)).join('') + (moves.length > 8 ? '<p class="mini">…e altri ' + (moves.length - 8) + '</p>' : '') + '</div>'
    + '<button class="btn wide" onclick="applyTaxChange()">Conferma</button>');
}

function applyTaxChange() {
  const op = window.pendingTax;
  const fam = op.toFamily || op.family;
  const cat = op.type === 'rename' || op.type === 'merge' ? op.to : op.from;
  // 1) Tassonomia
  const tax = JSON.parse(JSON.stringify(S.tax));
  const src = tax.find(f => f.family === op.family);
  if (src) src.categories = src.categories.filter(c => c !== op.from);
  if (op.type !== 'delete') {
    let dst = tax.find(f => f.family === fam);
    if (!dst) { dst = { family: fam, categories: [] }; tax.push(dst); }
    if (!dst.categories.some(c => U.norm(c) === U.norm(cat))) dst.categories.push(cat);
  }
  put('taxonomy', tax);
  // 2) Movimenti (si mantiene chi li aveva classificati)
  if (op.type !== 'delete') {
    const items = movementsWithCategory(op.family, op.from).map(t => ({ id: t.id, family: fam, category: cat, classifiedBy: t.classifiedBy || '' }));
    if (items.length) act('bulkEdit', { items, reason: 'Categoria "' + op.from + '" → "' + fam + ' › ' + cat + '"' });
    // 3) Soggetti, regole, budget
    const subjects = S.subjects.map(s => (s.set && s.set.class && U.norm(s.set.class.category) === U.norm(op.from)
      ? Object.assign({}, s, { set: Object.assign({}, s.set, { class: { family: fam, category: cat } }) }) : s));
    put('subjects', subjects);
    put('rules', pref('rules', []).map(r => (r.set && U.norm(r.set.category) === U.norm(op.from)
      ? Object.assign({}, r, { set: Object.assign({}, r.set, { family: fam, category: cat }) }) : r)));
    const budgets = Object.assign({}, pref('budgets', {}));
    if (budgets[op.from] !== undefined) { budgets[cat] = (budgets[cat] || 0) + budgets[op.from]; delete budgets[op.from]; put('budgets', budgets); }
  }
  S.tax = tax;
  closeModal();
  derive();
  render();
  notice('Fatto');
}

function addCategoryTo(family) {
  const name = prompt('Nome della nuova categoria in "' + family + '"');
  if (name && name.trim()) ensureTaxonomy(family, name.trim());
  render();
}

function addFamilyCat() {
  const family = prompt('Nome della nuova famiglia di spesa (es. Lavoro)');
  if (!family || !family.trim()) return;
  const category = prompt('Prima categoria di "' + family.trim() + '"');
  ensureTaxonomy(family.trim(), category && category.trim() ? category.trim() : '');
  S.sub.catOpen = family.trim();
  render();
}

function renameFamily(family) {
  const name = prompt('Nuovo nome della famiglia "' + family + '"', family);
  if (!name || !name.trim() || name.trim() === family) return;
  const to = name.trim();
  const tax = S.tax.map(f => (f.family === family ? Object.assign({}, f, { family: to }) : f));
  const items = S.data.transactions.filter(t => t.family === family).map(t => ({ id: t.id, family: to, classifiedBy: t.classifiedBy || '' }));
  if (!confirm('Rinominare "' + family + '" in "' + to + '"? ' + items.length + ' movimenti con la famiglia scritta verranno aggiornati.')) return;
  put('taxonomy', tax);
  S.tax = tax;
  if (items.length) act('bulkEdit', { items, reason: 'Famiglia "' + family + '" → "' + to + '"' });
  put('subjects', S.subjects.map(s => (s.set && s.set.class && s.set.class.family === family ? Object.assign({}, s, { set: Object.assign({}, s.set, { class: Object.assign({}, s.set.class, { family: to }) }) }) : s)));
  S.sub.catOpen = to;
  render();
}

function deleteFamily(family) {
  if (!confirm('Eliminare la famiglia vuota "' + family + '"?')) return;
  const tax = S.tax.filter(f => f.family !== family);
  put('taxonomy', tax);
  S.tax = tax;
  S.sub.catOpen = null;
  render();
}

function resetTaxonomy() {
  if (!confirm('Ripristinare famiglie e categorie predefinite? Le categorie aggiunte da te verranno tolte dall\'elenco (i movimenti restano come sono).')) return;
  put('taxonomy', C.DEFAULT_TAXONOMY);
  S.tax = C.DEFAULT_TAXONOMY;
  render();
}
