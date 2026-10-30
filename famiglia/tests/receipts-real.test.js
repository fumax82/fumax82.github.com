// Test su scontrini VERI (testo letto dall'OCR, cifre della carta mascherate).
// Le foto originali non sono nel repository: qui c'è solo il testo in tests/fixtures/.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const R = require('../www/js/logic/receipts.js');
const read = f => fs.readFileSync(__dirname + '/fixtures/' + f + '.txt', 'utf8');

test('NaturaSì (una foto): negozio, data, 11 prodotti, offerte scalate, totale coerente', () => {
  const r = R.parseText(read('naturasi'));
  assert.strictEqual(r.shop, 'NaturaSì');
  assert.strictEqual(r.date, '2026-10-30');
  assert.strictEqual(r.total, 2114);
  assert.strictEqual(r.check, 'ok');
  assert.strictEqual(r.items.length, 11);
  const uova = r.items.find(i => /UOVA/.test(i.name));
  assert.deepStrictEqual([uova.qty, uova.unit, uova.price, uova.discount], [2, 290, 436, 144], 'riga "2x2,90" sotto il nome');
  const succo = r.items.find(i => /SUCCO/.test(i.name));
  assert.strictEqual(succo.category, 'Bevande', '"succo arancia" è una bevanda, non frutta');
  assert.ok(!r.items.some(i => /^OFF\./.test(i.name)), 'prefisso OFF. tolto dal nome');
  assert.strictEqual(r.items.find(i => /YOG\.INT/.test(i.name)).category, 'Latte e formaggi');
});

test('Cadoro (due foto): sovrapposizione rimossa, colonna IVA ignorata, negozio dal sito', () => {
  const merged = R.mergeTexts([read('cadoro-foto1'), read('cadoro-foto2')]);
  const r = R.parseText(merged);
  assert.strictEqual(r.shop, 'Cadoro');
  assert.strictEqual(r.date, '2026-10-30');
  assert.strictEqual(r.total, 1365);
  assert.strictEqual(r.check, 'ok');
  assert.deepStrictEqual(r.items.map(i => [i.name, i.price]), [
    ['GRIS.RUST.6 CER/4 SE', 299], ['PANE . SPACCAT.O.OLIVA', 145], ['CIPOLLE BIANCHE', 145], ['FETA GRECA DOP BIO', 329],
    ['MORETTI R.ORIGINALE', 99], ['TARALLI MULTICEREALI', 249], ['MORETTI R.ORIGINALE', 99]]);
  assert.strictEqual(r.items[4].category, 'Alcolici');
  assert.ok(merged.split('\n').length < read('cadoro-foto1').split('\n').length + read('cadoro-foto2').split('\n').length - 5, 'righe ripetute tolte');
});

test('lettura difficile: niente prezzi negativi, segnala che i conti non tornano (così l\'app riprova)', () => {
  for (const f of ['naturasi-difficile', 'cadoro-foto1-difficile']) {
    const r = R.parseText(read(f));
    assert.ok(r.items.every(i => i.price >= 0), f);
    assert.strictEqual(r.check, 'diff', f);
  }
});

test('insegne lette con errori e date con orario', () => {
  assert.strictEqual(R.knownShop('natfurasi'), 'NaturaSì');
  assert.strictEqual(R.knownShop('Esselunqa'), 'Esselunga');
  assert.strictEqual(R.knownShop('mercato'), '');
  assert.strictEqual(R.findDate('L. 21.06.2017\n30.10.26 18:56 DOC'), '2026-10-30', 'preferisce la data con orario');
});

test('pagamento dello scontrino: contanti per NaturaSì, carta per Cadoro', () => {
  assert.strictEqual(R.parseText(read('naturasi')).payment, 'cash');
  assert.strictEqual(R.parseText(R.mergeTexts([read('cadoro-foto1'), read('cadoro-foto2')])).payment, 'card');
});

test('collegamento scontrino -> movimento: stesso importo nei giorni dello scontrino', () => {
  let id = 1;
  const tx = (date, cents, extra) => Object.assign({ id: id++, date, cents, state: 'active', status: 'SI', kind: 'expense', details: 'POS' }, extra);
  const same = tx('2026-10-30', -1365), later = tx('2026-11-02', -1365), before = tx('2026-10-29', -1365);
  const tooLate = tx('2026-11-06', -1365), otherAmount = tx('2026-10-30', -1370), wide = tx('2026-10-30', -1400);
  const atm = tx('2026-10-30', -1365, { kind: 'withdrawal' }), linked = tx('2026-10-30', -1365);
  const m = R.matchPayments({ date: '2026-10-30', total: 1365 }, [later, tooLate, otherAmount, wide, before, atm, linked, same], [linked.id]);
  assert.deepStrictEqual(m.map(x => x.tx.id), [same.id, before.id, later.id, otherAmount.id], 'stesso giorno prima, poi i giorni vicini, poi 5 cent di differenza');
  assert.ok(m[0].exact && m[0].sameDay);
  assert.match(m[2].label, /registrato 3 giorni dopo/);
  assert.ok(!m.some(x => x.tx.id === wide.id), 'mai importi diversi di 35 cent');
  const noDate = R.matchPayments({ date: '', total: 1365 }, [tx('2026-10-20', -1365)], [], '2026-10-30');
  assert.strictEqual(noDate.length, 1, 'senza data: stesso importo negli ultimi 30 giorni');
});
