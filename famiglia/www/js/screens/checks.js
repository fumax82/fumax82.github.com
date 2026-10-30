/*
 * checks.js - CONTROLLI SUI DOPPIONI (interfaccia).
 *
 * Per ogni caso trovato da logic/duplicates.js mostra:
 *   - che tipo di problema sembra (doppia importazione, doppio addebito...)
 *   - PERCHÉ l'app lo pensa (gli indizi, in parole semplici)
 *   - i movimenti coinvolti
 *   - le azioni adatte a quel caso
 * Ogni decisione viene ricordata (prefs.dupDecisions): il caso non ricompare.
 */
'use strict';

const CHECK_ICON = { import: '⧉', charge: '💳', manual: '💶', card: '🔁', reversal: '↩' };

Screens.checks = function () {
  const list = S.checks || [];
  const decided = Object.keys(pref('dupDecisions', {})).length;
  return '<span class="eyebrow">QUALITÀ DEI DATI</span><h1>Controlli sui doppioni</h1>'
    + '<p class="sub">L\'app confronta i movimenti con lo stesso importo in date vicine e ti dice se sembrano un errore di importazione, un doppio addebito del negozio o una spesa registrata due volte.</p>'
    + (list.length ? list.map(checkCard).join('')
      : '<div class="empty"><div class="glyph">✓</div><h2>Nessun doppione sospetto</h2><p class="sub">Controllati tutti i movimenti attivi.</p></div>')
    + (decided ? '<button class="btn secondary wide" onclick="if(confirm(\'Riproporre anche i ' + decided + ' casi già valutati?\')){put(\'dupDecisions\',{});derive();render()}">Rivedi anche i casi già valutati (' + decided + ')</button>' : '');
};

function checkCard(c) {
  const txs = c.ids.map(txById).filter(Boolean);
  const actions = {
    import: [['Escludi il doppione', 'dupExclude'], ['Sono due movimenti diversi', 'dupDistinct']],
    charge: [['Da contestare', 'dupContest'], ['Due acquisti veri', 'dupDistinct']],
    manual: [['Elimina quello inserito a mano', 'dupDeleteManual'], ['Sono diversi', 'dupDistinct']],
    card: [['Addebito carta = giroconto', 'dupCardTransfer'], ['Non è così', 'dupDistinct']],
    reversal: [['Collega lo storno', 'dupLinkReversal'], ['Ignora', 'dupDistinct']]
  }[c.type];
  return '<div class="card ' + (c.level === 'alta' ? 'alert' : c.level === 'media' ? 'warn' : '') + '">'
    + '<div class="row"><h3 style="margin:0">' + CHECK_ICON[c.type] + ' ' + esc(c.title) + '</h3>' + level(c.level) + '</div>'
    + '<ul class="reasons">' + c.reasons.map(r => '<li>' + esc(r) + '</li>').join('') + '</ul>'
    + txs.slice(0, 6).map(t => txrow(t, '<small class="mini">' + (t.imports && t.imports.length ? 'da: ' + esc(t.imports.map(i => (S.data.imports.find(x => x.id === i) || {}).name || 'file ' + i).join(', ')) : t.source === 'manual' ? 'inserito a mano' : '') + '</small>')).join('')
    + (txs.length > 6 ? '<p class="mini">…e altri ' + (txs.length - 6) + ' movimenti</p>' : '')
    + '<p class="mini">💡 ' + esc(c.suggestion) + '</p>'
    + '<div class="actions">' + actions.map(([l, f], k) => '<button class="btn small' + (k ? ' secondary' : '') + '" onclick="' + f + '(' + jsArg(c.key) + ')">' + l + '</button>').join('') + '</div></div>';
}

/** Ricorda la decisione presa su un caso. */
function decide(key, value) {
  put('dupDecisions', Object.assign({}, pref('dupDecisions', {}), { [key]: value }));
  derive();
  render();
}

const findCheck = key => (S.checks || []).find(c => c.key === key);

function dupDistinct(key) {
  decide(key, 'distinct');
  notice('Ricordato: non sono doppioni');
}

/** Doppia importazione: esclude il movimento arrivato per ultimo (resta nello storico). */
function dupExclude(key) {
  const c = findCheck(key);
  const dup = c.ids.map(txById).sort((a, b) => b.id - a.id)[0];
  act('exclude', { id: dup.id });
  decide(key, 'dup');
  notice('Escluso dai totali il doppione del ' + fmt(dup.date) + ' (puoi ripristinarlo dal dettaglio)');
}

/** Doppio addebito reale: il secondo è segnato "da farsi rimborsare dal venditore". */
function dupContest(key) {
  const c = findCheck(key);
  const t = c.ids.map(txById).sort((a, b) => b.id - a.id)[0];
  act('edit', { id: t.id, extra: { refund: 'venditore' }, note: (t.note ? t.note + ' · ' : '') + 'Addebito doppio da contestare', classifiedBy: t.classifiedBy || '' });
  decide(key, 'contest');
  notice('Segnato da contestare: lo ritrovi in Analisi › Abitudini › Rimborsi attesi');
}

function dupDeleteManual(key) {
  const c = findCheck(key);
  const man = c.ids.map(txById).find(t => t.source === 'manual');
  if (!man || !confirm('Eliminare il pagamento in contanti inserito a mano del ' + fmt(man.date) + '?')) return;
  act('deleteManual', { id: man.id });
  decide(key, 'dup');
}

/** Addebito della carta di credito: diventa giroconto (gli acquisti della carta restano). */
function dupCardTransfer(key) {
  const c = findCheck(key);
  const t = txById(c.ids[0]);
  act('edit', { id: t.id, kind: 'transfer', family: 'Movimenti interni', category: 'Saldo carta di credito', classifiedBy: 'user' });
  decide(key, 'dup');
  notice('Addebito della carta trattato come giroconto');
}

/** Addebito + storno: il rimborso viene collegato alla spesa. */
function dupLinkReversal(key) {
  const c = findCheck(key);
  const [charge, back] = c.ids.map(txById);
  act('edit', { id: back.id, kind: 'refund', family: charge.family || C.familyOf(charge, S.tax), category: charge.category, classifiedBy: 'user' });
  act('addLink', { type: 'refund', from: back.id, to: charge.id, cents: back.cents });
  decide(key, 'dup');
  notice('Storno collegato all\'addebito');
}
