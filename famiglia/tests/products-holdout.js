// Misura sul gruppo di verifica (mai usato per la messa a punto): node tests/products-holdout.js
const R = require('../www/js/logic/receipts.js');
const data = require('./fixtures/prodotti-verifica.json');
let ok = 0, tot = 0;
for (const dep in data) {
  if (dep.startsWith('_')) continue;
  for (const name of data[dep]) {
    const got = R.productCategory(name); tot++;
    if (got === dep) ok++; else console.log(name.padEnd(36), 'atteso', dep.padEnd(22), 'ottenuto', got);
  }
}
console.log('Corretti ' + ok + '/' + tot + ' (' + (ok / tot * 100).toFixed(1) + '%)');
