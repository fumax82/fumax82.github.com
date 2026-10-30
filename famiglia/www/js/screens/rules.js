/*
 * rules.js - Gestione delle REGOLE di classificazione automatica.
 * Una regola dice: "se la descrizione contiene X, metti famiglia/categoria Y".
 * Le regole si applicano da sole a ogni importazione (mai ai movimenti che
 * hai classificato a mano).
 */
'use strict';

Screens.rules = function () {
  const rules = pref('rules', []);
  return '<span class="eyebrow">CLASSIFICAZIONE AUTOMATICA</span><h1>Regole</h1>'
    + '<p class="sub">Le regole vengono controllate dall\'alto in basso: vale la prima che corrisponde. Non modificano mai i movimenti che hai classificato a mano.</p>'
    + '<button class="btn wide" onclick="editRule(null)">＋ Nuova regola</button>'
    + (rules.length ? rules.map((r, i) => {
      const n = C.ruleMatchesCount(r, S.data.transactions);
      return '<div class="card"' + (r.enabled === false ? ' style="opacity:.6"' : '') + '><div class="row"><h3>' + esc(r.name || r.text) + '</h3><span class="badge">' + n + ' movimenti</span></div>'
        + '<p class="sub" style="margin:4px 0">Se la descrizione contiene <b>' + esc(C.ruleWords(r).join(' oppure ')) + '</b>'
        + (r.sign === 'out' ? ' (solo uscite)' : r.sign === 'in' ? ' (solo entrate)' : '') + (r.account ? ' su ' + esc(r.account) : '')
        + (r.min || r.max ? ' tra ' + eur(r.min || 0) + ' e ' + (r.max ? eur(r.max) : '∞') : '')
        + '<br>→ <b>' + esc([r.set.family, r.set.category].filter(Boolean).join(' › ') || '—') + '</b>'
        + (r.set.kind ? ' · ' + esc(KINDS[r.set.kind]) : '') + (r.set.accountUser ? ' · conto ' + esc(r.set.accountUser) : '') + (r.afterId ? ' · solo movimenti futuri' : '') + '</p>'
        + '<div class="actions"><button class="btn secondary small" onclick="editRule(' + i + ')">Modifica</button>'
        + '<button class="btn secondary small" onclick="showIds(' + jsArg(S.data.transactions.filter(t => C.ruleMatches(r, t)).map(t => t.id)) + ',' + jsArg(r.name || r.text) + ')">Vedi</button>'
        + (i > 0 ? '<button class="btn secondary small" onclick="moveRule(' + i + ',-1)">↑</button>' : '')
        + '<button class="btn secondary small" onclick="toggleRule(' + i + ')">' + (r.enabled === false ? 'Attiva' : 'Sospendi') + '</button></div></div>';
    }).join('') : '<div class="empty"><div class="glyph">⚙</div><p class="sub">Nessuna regola. Le crei quando classifichi un movimento (l\'app ti chiede se ricordare la scelta) o dalla scheda "Spese ripetitive" in Da fare.</p></div>');
};

/** Finestra di modifica regola. i = posizione (null per nuova), draft = bozza precompilata. */
function editRule(i, draft) {
  const rules = pref('rules', []);
  const r = draft || (i != null ? rules[i] : { id: U.uid(), name: '', text: '', field: 'any', sign: 'out', account: '', min: '', max: '', set: {}, enabled: true });
  window.ruleDraft = { index: i, rule: r };
  const sel = (id, opts, cur) => '<select id="' + id + '">' + opts.map(([v, l]) => '<option value="' + v + '"' + (cur === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>';
  modal(i != null ? 'Modifica regola' : 'Nuova regola',
    '<label class="field">Nome<input id="eName" value="' + esc(r.name) + '" placeholder="Es. Abbonamenti AI"></label>'
    + '<label class="field">La descrizione contiene (più parole separate da | )<input id="eText" value="' + esc(r.text) + '" placeholder="anthropic|openai|gemini" oninput="previewEditRule()"></label>'
    + '<label class="field">Dove cercare' + sel('eField', [['any', 'Operazione e dettagli'], ['details', 'Solo dettagli'], ['operation', 'Solo operazione']], r.field) + '</label>'
    + '<label class="field">Direzione' + sel('eSign', [['out', 'Solo uscite'], ['in', 'Solo entrate'], ['any', 'Entrambe']], r.sign || 'any') + '</label>'
    + '<div class="grid"><label class="field">Importo minimo €<input id="eMin" type="number" step="0.01" min="0" value="' + (r.min ? r.min / 100 : '') + '"></label>'
    + '<label class="field">Importo massimo €<input id="eMax" type="number" step="0.01" min="0" value="' + (r.max ? r.max / 100 : '') + '"></label></div>'
    + '<label class="field">Solo su questo conto/carta (facoltativo)' + accountSelect('eAcc', r.account) + '</label>'
    + '<h3 style="margin-top:20px">Allora imposta</h3>'
    + '<label class="field">Famiglia › categoria' + catSelect('eCat', r.set.family, r.set.category) + '</label>'
    + '<label class="field">Trattamento (facoltativo)' + sel('eKind', [['', '— non cambiare —']].concat(Object.entries(KINDS)), r.set.kind || '') + '</label>'
    + '<label class="field">Conto/carta da assegnare se manca (facoltativo)' + accountSelect('eSetAcc', r.set.accountUser) + '</label>'
    + '<p class="sub" id="ePreview"></p>'
    + '<button class="btn wide" onclick="saveRule()">Salva regola</button>'
    + (i != null ? '<button class="btn danger wide" style="margin-top:10px" onclick="deleteRule(' + i + ')">Elimina regola</button>' : ''));
  previewEditRule();
}

function readRuleForm() {
  const r = Object.assign({}, window.ruleDraft.rule);
  r.name = $('eName').value.trim();
  r.text = $('eText').value.trim();
  r.field = $('eField').value;
  r.sign = $('eSign').value;
  r.min = $('eMin').value ? Math.round(Number($('eMin').value) * 100) : '';
  r.max = $('eMax').value ? Math.round(Number($('eMax').value) * 100) : '';
  r.account = readAccount('eAcc');
  return r;
}

function previewEditRule() {
  if (!$('ePreview')) return;
  const r = readRuleForm();
  r.set = {};
  $('ePreview').textContent = r.text ? C.ruleMatchesCount(r, S.data.transactions) + ' movimenti corrispondono già.' : '';
}

function saveRule() {
  const r = readRuleForm();
  if (!r.text) { notice('Scrivi almeno una parola da cercare'); return; }
  const cat = readCat('eCat');
  if (cat === undefined) return;
  r.set = { family: cat ? cat.family : '', category: cat ? cat.category : '' };
  if ($('eKind').value) r.set.kind = $('eKind').value;
  const acc = readAccount('eSetAcc');
  if (acc) r.set.accountUser = acc;
  if (!r.set.category && !r.set.kind && !r.set.accountUser) { notice('Scegli cosa impostare'); return; }
  if (!r.name) r.name = r.text.split(/[|,]/)[0];
  const rules = pref('rules', []).slice();
  if (window.ruleDraft.index != null) rules[window.ruleDraft.index] = r; else rules.push(r);
  put('rules', rules);
  closeModal();
  nav('rules');
}

function deleteRule(i) {
  if (!confirm('Eliminare la regola? I movimenti già classificati restano come sono.')) return;
  const rules = pref('rules', []).slice();
  rules.splice(i, 1);
  put('rules', rules);
  closeModal();
  render();
}

function moveRule(i, d) {
  const rules = pref('rules', []).slice();
  [rules[i], rules[i + d]] = [rules[i + d], rules[i]];
  put('rules', rules);
  render();
}

function toggleRule(i) {
  const rules = pref('rules', []).slice();
  rules[i] = Object.assign({}, rules[i], { enabled: rules[i].enabled === false });
  put('rules', rules);
  render();
}
