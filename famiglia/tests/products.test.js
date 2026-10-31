// Test del riconoscimento dei reparti (logic/products.js): node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const P = require('../www/js/logic/products.js');
const R = require('../www/js/logic/receipts.js');

/** Percentuale di prodotti riconosciuti nel reparto atteso. */
function accuracy(file) {
  const data = require(file);
  let ok = 0, tot = 0;
  for (const dep in data) {
    if (dep.startsWith('_')) continue;
    for (const raw of data[dep]) { tot++; if (P.classify(raw.replace(/\*$/, ''), {}).department === dep) ok++; }
  }
  return ok / tot;
}

test('dizionario: riconosce quasi tutti i prodotti di prova', () => {
  assert.ok(accuracy('./fixtures/prodotti.json') >= 0.99);
  // prodotti tenuti da parte per verifica: la soglia è più bassa di proposito
  assert.ok(accuracy('./fixtures/prodotti-verifica.json') >= 0.95);
});

test('esempi tipici: alcolici, frutta, uova', () => {
  const dep = n => P.classify(n, {}).department;
  assert.strictEqual(dep('VINO ROSSO CHIANTI 0,75L'), 'Alcolici');
  assert.strictEqual(dep('BIRRA MORETTI 66CL'), 'Alcolici');
  assert.strictEqual(dep('BANANE CHIQUITA'), 'Frutta');
  assert.strictEqual(dep('UOVA FRESCHE CAT.A X6'), 'Uova');
  assert.strictEqual(dep('MELANZANE'), 'Verdura');
  assert.strictEqual(dep('XQWZ 123'), 'Altro');
});

test('correzioni ricordate: prima il prodotto, poi la parola, poi il dizionario', () => {
  const l = { products: { [P.key('TILSITER AFFETTATO 150G')]: 'Latte e formaggi' }, words: { brezel: 'Pane e forno' } };
  const a = P.classify('TILSITER AFFETTATO 150G', l);
  assert.deepStrictEqual([a.department, a.source], ['Latte e formaggi', 'learned']);
  const b = P.classify('BREZEL SALATI', l);
  assert.deepStrictEqual([b.department, b.source], ['Pane e forno', 'learned-word']);
  // la chiave ignora pesi e confezioni: stesso prodotto, formato diverso
  assert.strictEqual(P.key('TILSITER AFFETTATO 150G'), P.key('TILSITER AFFETTATO 200 G'));
  assert.strictEqual(P.classify('BANANE', l).source, 'dictionary');
});

test('gli scontrini usano le correzioni ricordate', () => {
  R.setLearned({ products: { [P.key('PIPPO SPECIAL')]: 'Dolci e snack' } });
  assert.strictEqual(R.productCategory('PIPPO SPECIAL'), 'Dolci e snack');
  R.setLearned({});
  assert.strictEqual(R.productCategory('PIPPO SPECIAL'), 'Altro');
});
