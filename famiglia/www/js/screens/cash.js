/*
 * cash.js - CONTANTI e COLLEGAMENTI tra movimenti.
 *
 * Pagamento in contanti: lo inserisci a mano e l'app ti propone il
 * prelievo bancomat da cui provengono i soldi. Puoi anche "forzare la
 * chiusura" se i contanti non vengono da un tuo prelievo (es. regalo
 * di compleanno): la spesa resta valida e il motivo viene annotato.
 *
 * Altri collegamenti proposti qui:
 *  - giroconti: uscita da un tuo conto ed entrata su un altro tuo conto
 *  - rimborsi:  soldi restituiti (reso, amici che ti ridanno la quota...)
 *    collegati alla spesa originale
 */
'use strict';

const CASH_REASONS = ['Regalo (es. compleanno)', 'Soldi ricevuti da familiari', 'Contanti già in casa', 'Resto / vendita di qualcosa', 'Altro'];

Screens.cash = function () {
  const ws = L.withdrawals(S.data.transactions, S.data.links);
  const payments = L.cashPayments(S.data.transactions).sort((a, b) => b.date.localeCompare(a.date));
  const unlinked = payments.filter(t => !L.cashLinkOf(t.id, S.data.links));
  const transfers = L.transferPairs(S.data.transactions, S.data.links, pref('transferRejected', []));
  const refunds = S.data.transactions.filter(t => t.state === 'active' && t.kind === 'refund' && !S.data.links.some(l => l.type === 'refund' && l.from === t.id));
  const free = U.sum(ws, w => w.free);

  return '<span class="eyebrow">OGNI EURO HA UNA STORIA</span><h1>Contanti e collegamenti</h1>'
    + '<button class="btn gold wide" onclick="newCash()">＋ Pagamento in contanti</button>'
    + '<div class="grid" style="margin-top:12px"><div class="card"><span class="eyebrow">CONTANTI DA TRACCIARE</span><div class="value">' + eur(free) + '</div><span class="mini">prelevati ma non ancora spiegati</span></div>'
    + '<div class="card"><span class="eyebrow">PAGAMENTI SENZA ORIGINE</span><div class="value ' + (unlinked.length ? 'orange' : '') + '">' + unlinked.length + '</div><span class="mini">da collegare a un prelievo</span></div></div>'

    + (unlinked.length ? '<div class="card warn"><h2>Da collegare</h2>' + unlinked.map(t => txrow(t, '<small><button class="link" onclick="event.stopPropagation();newCash(' + t.id + ')">Collega a un prelievo</button></small>')).join('') + '</div>' : '')

    + '<div class="card"><h2>Prelievi</h2>' + (ws.length ? ws.slice(0, 30).map(w => '<div class="kpi"><div class="row"><strong style="font-size:13px">' + fmt(w.tx.date) + ' · ' + esc(U.account(w.tx) || 'Bancomat') + '</strong><b>' + eur(w.amount) + '</b></div>'
      + '<div class="track"><div class="fill" style="width:' + Math.min(100, w.allocated / w.amount * 100) + '%"></div></div>'
      + '<p class="mini">Spiegati ' + eur(w.allocated) + ' · da tracciare ' + eur(w.free) + (w.items.length ? ' · ' + w.items.length + ' pagamenti' : '') + ' <button class="link" onclick="detail(' + w.tx.id + ')">Dettaglio</button></p></div>').join('')
      : '<p class="sub">Nessun prelievo trovato. I movimenti con "prelievo" nella descrizione vengono riconosciuti in automatico; puoi anche impostare "Prelievo contanti" dal dettaglio di un movimento.</p>') + '</div>'

    + '<div class="card"><h2>Pagamenti in contanti</h2>' + (payments.length ? payments.slice(0, 50).map(t => {
      const l = L.cashLinkOf(t.id, S.data.links);
      const info = !l ? '<small class="orange">Origine non indicata</small>' : l.to ? '<small>Dal prelievo del ' + fmt((txById(l.to) || {}).date) + '</small>' : '<small>Chiusura forzata: ' + esc(l.note) + '</small>';
      return txrow(t, info);
    }).join('') : '<p class="sub">Nessun pagamento in contanti registrato.</p>') + '</div>'

    + (transfers.length ? '<div class="card"><h2>Possibili giroconti</h2><p class="sub">Stesso importo uscito da un conto ed entrato in un altro entro 3 giorni. Se sono spostamenti tra conti tuoi, collegali: non verranno contati né come spesa né come entrata.</p>'
      + transfers.slice(0, 10).map(p => '<div class="card" style="background:#fafaf6">' + txrow(p.out) + txrow(p.in)
        + '<div class="actions"><button class="btn small" onclick="linkTransfer(' + p.out.id + ',' + p.in.id + ')">Sono un giroconto</button>'
        + '<button class="btn secondary small" onclick="rejectTransfer(' + p.out.id + ',' + p.in.id + ')">Non collegati</button></div></div>').join('') + '</div>' : '')

    + (refunds.length ? '<div class="card"><h2>Rimborsi da collegare</h2><p class="sub">Collegare un rimborso alla spesa originale mostra quanto ti è costata davvero.</p>'
      + refunds.slice(0, 15).map(t => txrow(t, '<small><button class="link" onclick="event.stopPropagation();linkRefund(' + t.id + ')">Collega alla spesa</button></small>')).join('') + '</div>' : '');
};

/** Finestra nuovo/modifica pagamento in contanti (id = movimento manuale esistente). */
function newCash(id) {
  const t = id ? txById(id) : null;
  const l = t ? L.cashLinkOf(t.id, S.data.links) : null;
  window.cashEditing = t ? t.id : 0;
  modal(t ? 'Pagamento in contanti' : 'Nuovo pagamento in contanti',
    '<div class="grid"><label class="field">Data<input id="cDate" type="date" value="' + (t ? t.date : U.today()) + '" onchange="cashSources()"></label>'
    + '<label class="field">Importo €<input id="cAmount" type="number" step="0.01" min="0" value="' + (t ? (-t.cents / 100).toFixed(2) : '') + '" oninput="cashSources()"></label></div>'
    + '<label class="field">Descrizione<input id="cDesc" value="' + esc(t ? t.details : '') + '" placeholder="Es. Mercato, caffè, parrucchiere"></label>'
    + '<label class="field">Famiglia › categoria' + catSelect('cCat', t ? t.family : '', t ? t.category : '') + '</label>'
    + '<div class="grid"><label class="field">Persona<input id="cPerson" value="' + esc(t ? t.person : 'Famiglia') + '"></label>'
    + '<label class="field">Note<input id="cNote" value="' + esc(t ? t.note : '') + '"></label></div>'
    + '<h3 style="margin-top:18px">Da dove vengono i contanti?</h3><div id="cSources"></div>'
    + '<button class="btn wide" onclick="saveCash()">Salva</button>');
  window.cashPreset = l;
  cashSources();
}

/** Ricalcola i prelievi proposti in base a data e importo. */
function cashSources() {
  const date = $('cDate').value || U.today();
  const cents = Math.round(Number($('cAmount').value || 0) * 100);
  const preset = window.cashPreset;
  const list = L.cashCandidates(date, cents, S.data.transactions, S.data.links, window.cashEditing).slice(0, 6);
  const firstOk = list.find(w => w.enough);
  const checkedId = preset ? (preset.to || 'forced') : (firstOk ? firstOk.tx.id : 'forced');
  $('cSources').innerHTML = (list.length ? '<p class="mini">Proposta: il prelievo più vicino precedente alla spesa con contanti sufficienti.</p>' : '<p class="sub">Nessun prelievo nei 90 giorni precedenti.</p>')
    + list.map(w => '<label class="radio"><input type="radio" name="cSrc" value="' + w.tx.id + '"' + (String(checkedId) === String(w.tx.id) ? ' checked' : '') + '><span>Prelievo del <b>' + fmt(w.tx.date) + '</b> · ' + eur(w.amount)
      + '<br><span class="mini">' + (w.enough ? 'disponibili ' + eur(w.free) : '<span class="red">disponibili solo ' + eur(w.free) + '</span>') + ' · ' + w.days + ' giorni prima</span></span></label>').join('')
    + '<label class="radio"><input type="radio" name="cSrc" value="forced"' + (checkedId === 'forced' ? ' checked' : '') + ' onchange="$(\'cForced\').hidden=false"><span><b>Chiusura forzata</b>: non vengono da un mio prelievo</span></label>'
    + '<div id="cForced"' + (checkedId === 'forced' ? '' : ' hidden') + '><label class="field">Motivo<select id="cReason">' + CASH_REASONS.map(r => '<option' + (preset && preset.note === r ? ' selected' : '') + '>' + r + '</option>').join('') + '</select></label></div>'
    + '<label class="radio"><input type="radio" name="cSrc" value="later"><span>Decido dopo</span></label>';
  for (const r of document.querySelectorAll('input[name=cSrc]')) r.addEventListener('change', () => { $('cForced').hidden = r.value !== 'forced' || !r.checked; });
}

function saveCash() {
  const cents = Math.round(Number($('cAmount').value) * 100);
  const date = $('cDate').value;
  if (!date || !(cents > 0)) { notice('Indica data e importo'); return; }
  const cat = readCat('cCat');
  if (cat === undefined) return;
  const src = (document.querySelector('input[name=cSrc]:checked') || {}).value || 'later';
  const payload = {
    id: window.cashEditing || 0, date, cents: -cents, operation: 'Pagamento in contanti', details: $('cDesc').value.trim() || 'Contanti',
    account: 'Contanti', kind: 'expense', person: $('cPerson').value.trim() || 'Famiglia', note: $('cNote').value,
    family: cat ? cat.family : '', category: cat ? cat.category : ''
  };
  if (src === 'forced') payload.link = { type: 'cash', to: 0, cents, note: $('cReason').value };
  else if (src !== 'later') payload.link = { type: 'cash', to: Number(src), cents, note: '' };
  else if (window.cashEditing) {
    // "Decido dopo" su un pagamento già collegato: rimuove il collegamento
    const l = L.cashLinkOf(window.cashEditing, S.data.links);
    if (l) act('removeLink', { id: l.id });
  }
  const w = src !== 'forced' && src !== 'later' ? L.withdrawals(S.data.transactions, S.data.links).find(x => x.tx.id === Number(src)) : null;
  if (w && w.free < cents && !confirm('Il prelievo scelto ha solo ' + eur(w.free) + ' ancora da spiegare. Collegare comunque?')) return;
  closeModal();
  act('saveManual', payload);
  notice('Pagamento in contanti salvato');
  if (cat && cat.category && !window.cashEditing) {
    window.afterSave = (kind, newId) => setTimeout(() => askRemember(txById(newId), { family: cat.family, category: cat.category }), 200);
  }
}

function linkTransfer(outId, inId) {
  act('bulkEdit', { items: [{ id: outId, kind: 'transfer', family: 'Movimenti interni', category: 'Giroconti', classifiedBy: 'user' },
    { id: inId, kind: 'transfer', family: 'Movimenti interni', category: 'Giroconti', classifiedBy: 'user' }], reason: 'Giroconto', silent: true });
  act('addLink', { type: 'transfer', from: outId, to: inId, cents: -txById(outId).cents });
  notice('Giroconto collegato: escluso da spese ed entrate');
}

function rejectTransfer(outId, inId) {
  put('transferRejected', pref('transferRejected', []).concat([outId + ':' + inId]));
  render();
}

/** Collega un rimborso (o soldi restituiti) alla spesa originale. */
function linkRefund(id) {
  const t = txById(id);
  const cands = L.refundCandidates(t, S.data.transactions);
  modal('Collega alla spesa originale', txrow(t)
    + '<p class="sub">Scegli la spesa che questi soldi compensano (reso, rimborso, quota restituita da amici…).</p>'
    + (cands.length ? cands.map(c => '<label class="radio"><input type="radio" name="rfSrc" value="' + c.tx.id + '"><span>' + esc(c.tx.details || c.tx.operation) + ' · ' + fmt(c.tx.date) + ' · <b>' + eur(c.tx.cents) + '</b>'
      + (c.same ? ' <span class="chip ok">stessa controparte</span>' : '') + (c.exact ? ' <span class="chip ok">stesso importo</span>' : '') + '</span></label>').join('')
      : '<p class="sub">Nessuna spesa simile trovata negli ultimi 6 mesi.</p>')
    + '<label class="field">Oppure cerca per descrizione<input id="rfSearch" oninput="refundSearch(' + id + ')"></label><div id="rfResults"></div>'
    + '<button class="btn wide" onclick="saveRefundLink(' + id + ')">Collega</button>');
}

function refundSearch(id) {
  const q = U.norm($('rfSearch').value);
  if (q.length < 3) { $('rfResults').innerHTML = ''; return; }
  const list = S.data.transactions.filter(t => t.cents < 0 && t.state === 'active' && U.norm(t.operation + ' ' + t.details).includes(q)).slice(0, 8);
  $('rfResults').innerHTML = list.map(t => '<label class="radio"><input type="radio" name="rfSrc" value="' + t.id + '"><span>' + esc(t.details || t.operation) + ' · ' + fmt(t.date) + ' · <b>' + eur(t.cents) + '</b></span></label>').join('');
}

function saveRefundLink(id) {
  const sel = document.querySelector('input[name=rfSrc]:checked');
  if (!sel) { notice('Scegli la spesa'); return; }
  const t = txById(id), orig = txById(Number(sel.value));
  closeModal();
  // Il rimborso eredita la classificazione della spesa e viene trattato come "rimborso"
  act('edit', { id, kind: 'refund', family: orig.family || C.familyOf(orig, S.tax), category: orig.category, classifiedBy: 'user' });
  act('addLink', { type: 'refund', from: id, to: orig.id, cents: t.cents });
  notice('Rimborso collegato alla spesa del ' + fmt(orig.date));
}
