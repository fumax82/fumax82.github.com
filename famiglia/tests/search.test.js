// Test di "Cerca e somma" (logic/search.js): node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const SR = require('../www/js/logic/search.js');

test('ricerca: parole, alternative con la virgola, esclusioni', () => {
  const text = 'PAGAMENTO POS AMAZON PRIME MARKETPLACE';
  assert.ok(SR.matchText(text, ''));
  assert.ok(SR.matchText(text, 'amazon'));
  assert.ok(SR.matchText(text, 'Amazon prime'));
  assert.ok(!SR.matchText(text, 'amazon netflix'));
  assert.ok(SR.matchText(text, 'netflix, amazon'));
  assert.ok(!SR.matchText(text, 'amazon -prime'));
  assert.ok(SR.matchText('Caffè Città', 'caffe citta'));
});

test('periodi pronti', () => {
  const today = '2026-03-15';
  assert.deepStrictEqual([SR.range('month', today).from, SR.range('month', today).to], ['2026-03-01', '2026-03-31']);
  assert.deepStrictEqual([SR.range('prevMonth', today).from, SR.range('prevMonth', today).to], ['2026-02-01', '2026-02-28']);
  assert.strictEqual(SR.range('last12', today).from, '2025-04-01');
  assert.strictEqual(SR.range('prevYear', today).to, '2025-12-31');
  assert.strictEqual(SR.range('m:2024-02', today).to, '2024-02-29');
  assert.deepStrictEqual(SR.range('all', today), { from: '', to: '', label: 'Da sempre' });
  assert.strictEqual(SR.range('custom', today, { from: '2026-01-10' }).to, '');
  assert.strictEqual(SR.singleMonth(SR.range('prevMonth', today)), '2026-02');
  assert.strictEqual(SR.singleMonth(SR.range('last3', today)), '');
  assert.ok(SR.inRange('2026-01-01', { from: '', to: '' }));
  assert.ok(!SR.inRange('2026-04-01', SR.range('month', today)));
});

test('somme: uscite, entrate, mesi e ripartizioni', () => {
  const list = [
    { date: '2026-01-05', cents: -1000, fam: 'AI' },
    { date: '2026-03-05', cents: -3000, fam: 'AI' },
    { date: '2026-03-09', cents: -500, fam: 'Casa' },
    { date: '2026-03-10', cents: 2000, fam: 'Casa' }
  ];
  const s = SR.summarize(list, -1, { family: t => t.fam });
  assert.strictEqual(s.out, 4500);
  assert.strictEqual(s.in, 2000);
  assert.strictEqual(s.net, -2500);
  assert.strictEqual(s.total, 4500);
  assert.deepStrictEqual(s.months, [['2026-01', 1000], ['2026-02', 0], ['2026-03', 3500]]);
  assert.strictEqual(s.perMonth, 1500);
  assert.deepStrictEqual(s.byFamily, [['AI', 4000], ['Casa', 500]]);
  assert.strictEqual(SR.summarize(list, 1).total, 2000);
  assert.strictEqual(SR.summarize([], -1).count, 0);
});
