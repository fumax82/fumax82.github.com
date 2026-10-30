/*
 * settings.js - Menu "Altro", impostazioni (profilo, backup), riconciliazione
 * dei movimenti in attesa e modifica delle famiglie/categorie.
 */
'use strict';

/** Menu "Altro": accesso a tutte le funzioni. */
Screens.more = function () {
  const item = (page, icon, title, sub, badge) => '<div class="tx" role="button" onclick="nav(\'' + page + '\')"><div class="txicon">' + icon + '</div><div class="txmain"><strong>' + title + '</strong><small>' + sub + '</small></div>'
    + (badge ? '<span class="badge warn">' + badge + '</span>' : '<span>→</span>') + '</div>';
  const unlinked = L.cashPayments(S.data.transactions).filter(t => !L.cashLinkOf(t.id, S.data.links)).length;
  return '<span class="eyebrow">TUTTE LE FUNZIONI</span><h1>Altro</h1><div class="card">'
    + item('receipts', '🧾', 'Scontrini', 'Fotografa la spesa e analizza cosa compri', S.data.receipts.length ? '' : '')
    + item('cash', '💶', 'Contanti e collegamenti', 'Pagamenti in contanti, prelievi, giroconti, rimborsi', unlinked || '')
    + item('rules', '⚙', 'Regole automatiche', pref('rules', []).length + ' regole attive', '')
    + item('categories', '▦', 'Famiglie e categorie', 'Organizza la classificazione', '')
    + item('plan', '◎', 'Progetti', 'Budget, obiettivi, simulatore', '')
    + item('review', '⇋', 'Riconciliazione', 'Movimenti in attesa da abbinare', S.data.pairs.length || '')
    + item('settings', '☷', 'Impostazioni e backup', 'Profilo familiare, backup cifrato, esportazioni', '')
    + '</div>';
};

Screens.settings = function () {
  const p = pref('household', {});
  return '<span class="eyebrow">I DATI SONO TUOI</span><h1>Il tuo spazio</h1>'
    + '<div class="card"><h2>Profilo familiare</h2><p class="sub">Valori di riferimento manuali per resilienza e scenario di liquidità.</p>'
    + [['liquid', 'Liquidità disponibile oggi €'], ['income', 'Reddito netto mensile abituale €'], ['essential', 'Spese essenziali mensili incluse rate €'], ['debt', 'Rate mensili di debiti €'], ['reserve', 'Mesi di riserva desiderati']]
      .map(([k, l]) => '<label class="field">' + l + '<input id="h_' + k + '" type="number" min="0" step="0.01" value="' + (p[k] != null ? p[k] : (k === 'reserve' ? 6 : '')) + '"></label>').join('')
    + '<button class="btn wide" onclick="saveHouse()">Salva profilo</button></div>'
    + '<div class="card"><h2>Classificazione automatica</h2>'
    + '<label class="check"><input type="checkbox" ' + (pref('merchantMemory', true) !== false ? 'checked' : '') + ' onchange="put(\'merchantMemory\',this.checked);notice(this.checked?\'Memoria esercizi attiva\':\'Memoria esercizi disattivata\')">'
    + '<span><b>Memoria esercizi</b>: i nuovi movimenti di un esercizio che hai già compilato ricevono in automatico gli stessi dati (categoria, conto, necessità, natura, detrazione…). Non tocca mai i movimenti che hai modificato a mano.</span></label>'
    + '<button class="btn secondary wide" onclick="nav(\'rules\')">Regole automatiche</button></div>'
    + '<div class="card"><h2>Backup e sicurezza</h2><p class="sub">Database SQLite locale. Nessun permesso Internet. Accesso protetto dal blocco schermo del telefono. La fotocamera serve solo per gli scontrini.</p>'
    + '<div class="actions"><button class="btn" onclick="act(\'backup\')">Backup cifrato</button><button class="btn secondary" onclick="act(\'restore\')">Ripristina</button></div>'
    + '<p class="mini">Il backup include movimenti, regole, scontrini (con foto), collegamenti e impostazioni. I backup della versione 1.0 si ripristinano senza problemi. Usa una password lunga: non è recuperabile.</p>'
    + '<button class="btn secondary wide" onclick="act(\'csv\')">Esporta CSV completo</button></div>'
    + '<details class="card"><summary>Registro delle ultime 100 azioni</summary>' + S.data.audit.map(a => '<p class="mini"><b>' + esc(a.action) + '</b> · ' + esc(a.date) + '<br>' + esc(a.detail) + '</p>').join('') + '</details>'
    + '<div class="card"><h2>Come leggere i risultati</h2><p class="sub">Accantonamenti, investimenti e giroconti non sono consumi. I rimborsi sono separati dalle entrate. I prelievi bancomat non sono spese: lo diventano i pagamenti in contanti che registri; la parte non registrata appare come "Contanti non tracciati".</p>'
    + '<p class="sub">Non essendoci un ID univoco nell\'Excel, due operazioni perfettamente identiche non sono sempre distinguibili. Si conserva la massima molteplicità osservata nei file sovrapposti.</p>'
    + '<p class="mini">Famiglia 2.2 · build personale offline</p></div>';
};

function saveHouse() {
  const p = { asof: U.today() };
  for (const k of ['liquid', 'income', 'essential', 'debt', 'reserve']) {
    p[k] = Number($('h_' + k).value);
    if (!Number.isFinite(p[k]) || p[k] < 0) { notice('Inserisci valori non negativi'); return; }
  }
  if (p.reserve < 1 || p.reserve > 36) { notice('Scegli una riserva tra 1 e 36 mesi'); return; }
  put('household', p);
  notice('Profilo aggiornato');
}

/** Riconciliazione: movimenti "in attesa" che diventano definitivi. */
Screens.review = function () {
  const pending = S.data.transactions.filter(t => t.status === 'NO' && t.state === 'active');
  return '<span class="eyebrow">QUALITÀ DEI DATI</span><h1>Riconciliazione</h1><p class="sub">Un pagamento in attesa diventa definitivo. Conferma solo quando i due record rappresentano la stessa operazione.</p>'
    + '<div class="hint warn">Stesso importo e date vicine non bastano: qui vedi candidati entro 10 giorni.</div>'
    + S.data.pairs.map(p => {
      const a = txById(p.pending), b = txById(p.booked);
      return '<div class="card"><span class="badge warn">Possibile corrispondenza</span>' + txrow(a) + txrow(b)
        + '<div class="actions"><button class="btn" onclick="linkPending(' + a.id + ',' + b.id + ')">È lo stesso pagamento</button>'
        + '<button class="btn secondary" onclick="act(\'distinct\',{pending:' + a.id + ',booked:' + b.id + '})">Sono distinti</button></div></div>';
    }).join('')
    + '<div class="card"><h2>In attesa: ' + pending.length + '</h2>' + pending.map(t => txrow(t)).join('') + '</div>'
    + '<button class="btn secondary wide" onclick="S.month=\'\';S.filterState=\'replaced\';nav(\'moves\')">Vedi riconciliazioni e annulla abbinamenti</button>';
};

function linkPending(p, b) {
  if (confirm('Il sospeso sarà rimosso dai totali e conservato nello storico, collegato al definitivo. Confermi?')) act('link', { pending: p, booked: b });
}

/** Famiglie e categorie: aggiungi, rinomina, elimina. */
Screens.categories = function () {
  const used = {};
  for (const t of S.data.transactions) if (t.category) used[t.category] = (used[t.category] || 0) + 1;
  return '<span class="eyebrow">LA TUA CLASSIFICAZIONE</span><h1>Famiglie e categorie</h1>'
    + '<p class="sub">Ogni famiglia di spesa raggruppa più categorie. Puoi aggiungerne di nuove; quelle usate dai movimenti non vengono eliminate dai movimenti stessi.</p>'
    + S.tax.map((f, i) => '<div class="card"><div class="row"><h3>' + esc(f.family) + '</h3><button class="btn secondary small" onclick="addCategory(' + i + ')">＋ Categoria</button></div>'
      + f.categories.map((c, j) => '<span class="chip">' + esc(c) + (used[c] ? ' · ' + used[c] : '') + ' <button class="link" style="padding:0" onclick="removeCategory(' + i + ',' + j + ')" aria-label="Rimuovi">×</button></span>').join('') + '</div>').join('')
    + '<div class="actions"><button class="btn" onclick="addFamily()">＋ Nuova famiglia</button><button class="btn secondary" onclick="resetTaxonomy()">Ripristina predefinite</button></div>';
};

function addCategory(i) {
  const name = prompt('Nome della nuova categoria in "' + S.tax[i].family + '"');
  if (name && name.trim()) ensureTaxonomy(S.tax[i].family, name.trim());
  render();
}

function addFamily() {
  const name = prompt('Nome della nuova famiglia di spesa');
  if (name && name.trim()) ensureTaxonomy(name.trim(), '');
  render();
}

function removeCategory(i, j) {
  const tax = JSON.parse(JSON.stringify(S.tax));
  if (!confirm('Togliere "' + tax[i].categories[j] + '" dall\'elenco?')) return;
  tax[i].categories.splice(j, 1);
  put('taxonomy', tax);
  S.tax = tax;
  render();
}

function resetTaxonomy() {
  if (!confirm('Ripristinare famiglie e categorie predefinite? Le categorie aggiunte da te verranno tolte dall\'elenco.')) return;
  put('taxonomy', C.DEFAULT_TAXONOMY);
  S.tax = C.DEFAULT_TAXONOMY;
  render();
}
