// Banco di prova del riconoscimento dei reparti: node tests/products-bench.js
// Stampa la precisione per reparto e gli errori.
const R = require('../www/js/logic/receipts.js');
const data = require('./fixtures/prodotti.json');
let ok = 0, tot = 0;
const errors = [];
for (const dep in data) {
  if (dep.startsWith('_')) continue;
  for (const raw of data[dep]) {
    const name = raw.replace(/\*$/, '');
    const got = R.productCategory(name);
    tot++;
    if (got === dep) ok++; else errors.push(name.padEnd(28) + ' atteso ' + dep.padEnd(22) + ' ottenuto ' + got);
  }
}
console.log('Corretti ' + ok + '/' + tot + ' (' + (ok / tot * 100).toFixed(1) + '%)');
if (process.argv[2] !== '-q') console.log(errors.join('\n'));
