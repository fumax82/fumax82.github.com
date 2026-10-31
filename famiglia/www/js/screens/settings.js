/*
 * settings.js - Menu "Altro" (raggruppato), impostazioni (profilo, backup), riconciliazione
 * dei movimenti in attesa e modifica delle famiglie/categorie.
 */
'use strict';

/** Numeri rossi delle voci di "Altro" (cose da sistemare). */
function moreBadges() {
  const b = {
    imports: S.gaps ? S.gaps.gaps.filter(g => ['alta', 'critica', 'media'].includes(g.level)).length : 0,
    checks: (S.checks || []).filter(c => c.level !== 'info').length,
    review: S.data.pairs.length,
    receipts: receiptsReady(),
    cash: L.cashPayments(S.data.transactions).filter(t => !L.cashLinkOf(t.id, S.data.links)).length
  };
  b.total = b.imports + b.checks + b.review + b.receipts + b.cash;
  return b;
}

/**
 * Menu "Altro": le funzioni meno quotidiane, divise in gruppi.
 * (Soggetti, famiglie, categorie e regole stanno tutti in "Classifica".)
 */
Screens.more = function () {
  const b = moreBadges();
  const item = (page, icon, title, sub, badge) => '<div class="tx" role="button" onclick="nav(\'' + page + '\')"><div class="txicon">' + icon + '</div><div class="txmain"><strong>' + title + '</strong><small>' + sub + '</small></div>'
    + (badge ? '<span class="badge warn">' + badge + '</span>' : '<span>→</span>') + '</div>';
  return '<span class="eyebrow">TUTTE LE ALTRE FUNZIONI</span><h1>Altro</h1>'
    + '<div class="menu-group">Dati della banca</div><div class="card">'
    + item('imports', '⤓', 'Importa e verifica', 'Estratti Excel, periodi coperti e buchi', b.imports)
    + item('checks', '⧉', 'Doppioni', 'Doppie importazioni, doppi addebiti', b.checks)
    + item('review', '⇋', 'Riconciliazione', 'Movimenti in attesa da abbinare', b.review)
    + '</div><div class="menu-group">Spesa e contanti</div><div class="card">'
    + item('receipts', '🧾', 'Scontrini', 'Fotografa la spesa, prodotti e reparti', b.receipts)
    + item('cash', '💶', 'Contanti e collegamenti', 'Prelievi, pagamenti in contanti, giroconti, rimborsi', b.cash)
    + '</div><div class="menu-group">Futuro</div><div class="card">'
    + item('plan', '◎', 'Progetti e budget', 'Limiti per categoria, obiettivi, simulatore', '')
    + '</div><div class="menu-group">App</div><div class="card">'
    + item('settings', '☷', 'Impostazioni e backup', 'Profilo familiare, backup cifrato, esportazioni', '')
    + '</div><p class="mini">Soggetti, famiglie, categorie e regole: nella scheda <button class="link" onclick="nav(\'todo\')">Classifica</button>.</p>';
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
    + '<div class="actions"><button class="btn secondary" onclick="nav(\'todo\',\'subjects\')">Soggetti</button><button class="btn secondary" onclick="nav(\'todo\',\'rules\')">Regole</button></div></div>'
    + '<div class="card"><h2>Backup e sicurezza</h2><p class="sub">Database SQLite locale. Nessun permesso Internet. Accesso protetto dal blocco schermo del telefono. La fotocamera serve solo per gli scontrini.</p>'
    + '<div class="actions"><button class="btn" onclick="act(\'backup\')">Backup cifrato</button><button class="btn secondary" onclick="act(\'restore\')">Ripristina</button></div>'
    + '<p class="mini">Il backup include movimenti, regole, scontrini (con foto), collegamenti e impostazioni. I backup della versione 1.0 si ripristinano senza problemi. Usa una password lunga: non è recuperabile.</p>'
    + '<button class="btn secondary wide" onclick="act(\'csv\')">Esporta CSV completo</button></div>'
    + '<details class="card"><summary>Registro delle ultime 100 azioni</summary>' + S.data.audit.map(a => '<p class="mini"><b>' + esc(a.action) + '</b> · ' + esc(a.date) + '<br>' + esc(a.detail) + '</p>').join('') + '</details>'
    + '<div class="card"><h2>Come leggere i risultati</h2><p class="sub">Accantonamenti, investimenti e giroconti non sono consumi. I rimborsi sono separati dalle entrate. I prelievi bancomat non sono spese: lo diventano i pagamenti in contanti che registri; la parte non registrata appare come "Contanti non tracciati".</p>'
    + '<p class="sub">Non essendoci un ID univoco nell\'Excel, due operazioni perfettamente identiche non sono sempre distinguibili. Si conserva la massima molteplicità osservata nei file sovrapposti.</p>'
    + '<p class="mini">Famiglia 2.6 · build personale offline</p></div>';
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
    + '<button class="btn secondary wide" onclick="setPeriod(\'all\',true);S.filterState=\'replaced\';nav(\'moves\')">Vedi riconciliazioni e annulla abbinamenti</button>';
};

function linkPending(p, b) {
  if (confirm('Il sospeso sarà rimosso dai totali e conservato nello storico, collegato al definitivo. Confermi?')) act('link', { pending: p, booked: b });
}

// Famiglie e categorie: ora in screens/categories.js (scheda della Classifica)
