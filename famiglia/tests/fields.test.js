// Test della copia dei campi e della memoria esercizi. Avvio: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const C = require('../www/js/logic/classify.js');
const FL = require('../www/js/logic/fields.js');

let id = 1;
const tx = o => Object.assign({ id: id++, date: '2026-03-01', operation: 'Pagamento POS', details: '', account: 'Carta 1', accountUser: '',
  cents: -1000, status: 'SI', state: 'active', kind: 'expense', category: '', family: '', classifiedBy: '', source: 'bank', person: 'Famiglia', note: '', extra: {} }, o);

test('movimenti collegati: stesso esercizio, stessa insegna, stesso tipo; mai segno opposto', () => {
  const src = tx({ details: 'ANTHROPIC* CLAUDE SUBSCRIPTION' });
  const same = tx({ details: 'ANTHROPIC* CLAUDE SUBSCRIPTION', date: '2026-04-01' });
  const refund = tx({ details: 'ANTHROPIC* CLAUDE SUBSCRIPTION', cents: 500 });
  const openai = tx({ details: 'OPENAI *CHATGPT' });
  const other = tx({ details: 'CONAD' });
  const r = FL.related(src, [src, same, refund, openai, other]);
  assert.deepStrictEqual(r.merchant.map(t => t.id), [same.id]);
  assert.deepStrictEqual(r.type.map(t => t.id), [openai.id], 'stesso tipo: AI');
  const e1 = tx({ details: 'ESSELUNGA MILANO' }), e2 = tx({ details: 'ESSELUNGA ROMA' });
  assert.deepStrictEqual(FL.related(e1, [e1, e2]).brand.map(t => t.id), [e2.id]);
});

test('proposte di copia: campo per campo, spuntati solo dove non hai scelto tu', () => {
  const src = tx({ details: 'PALESTRA ZETA' });
  const a = tx({ details: 'PALESTRA ZETA', category: 'Altre uscite' });
  const b = tx({ details: 'PALESTRA ZETA', category: 'Sport e palestra', family: 'Salute e benessere', classifiedBy: 'user', extra: { need: 'superflua' } });
  const values = { class: { family: 'Salute e benessere', category: 'Sport e palestra' }, need: 'utile', tags: ['Salute 2026'], merchant: 'Palestra Zeta' };
  const p = FL.proposals(src, values, [src, a, b], C.DEFAULT_TAXONOMY);
  const pa = p.find(x => x.tx.id === a.id), pb = p.find(x => x.tx.id === b.id);
  const ck = row => Object.fromEntries(row.changes.map(c => [c.key, c.checked]));
  assert.deepStrictEqual(ck(pa), { class: true, need: true, tags: false, merchant: true }, 'etichette proposte ma non spuntate');
  assert.ok(!('class' in ck(pb)), 'categoria già uguale: non proposta');
  assert.strictEqual(ck(pb).need, false, 'valore scelto a mano diverso: proposto ma non spuntato');
});

test('il nome esercizio non si copia su esercizi diversi', () => {
  const src = tx({ details: 'ANTHROPIC PBC' }), o = tx({ details: 'OPENAI LLC' });
  const p = FL.proposals(src, { merchant: 'Claude', class: { family: 'Tecnologia e abbonamenti', category: 'AI' } }, [src, o], C.DEFAULT_TAXONOMY);
  assert.deepStrictEqual(p[0].changes.map(c => c.key), ['class']);
});

test('memoria esercizi: i nuovi movimenti prendono tutti i dati, regole dopo, niente cicli', () => {
  const done = tx({ details: 'BAR SPORT', date: '2026-02-01', category: 'Bar e caffè', family: 'Ristoranti e bar', classifiedBy: 'user',
    accountUser: 'Carta Mastercard', extra: { need: 'superflua', nature: 'variabile', merchant: 'Bar Sport', rating: 'no', tags: ['x'] } });
  const fresh = tx({ details: 'BAR SPORT', date: '2026-03-01', account: '', category: 'Ristoranti e bar', classifiedBy: 'bank' });
  const mine = tx({ details: 'BAR SPORT', date: '2026-01-01', classifiedBy: 'user', category: 'Lavoro' }); // più vecchio: non è il profilo
  const ruleOnly = tx({ details: 'ANTHROPIC PBC' });
  const prefs = { rules: [{ id: 'r', text: 'anthropic|bar sport', set: { family: 'Tecnologia e abbonamenti', category: 'AI' } }] };
  const edits = FL.autoEdits([done, fresh, mine, ruleOnly], prefs);
  const e = edits.find(x => x.id === fresh.id);
  assert.strictEqual(e.classifiedBy, 'merchant:' + done.id);
  assert.strictEqual(e.category, 'Bar e caffè', 'la memoria vince sulla regola');
  assert.strictEqual(e.accountUser, 'Carta Mastercard');
  assert.deepStrictEqual(e.extra, { merchant: 'Bar Sport', need: 'superflua', nature: 'variabile' }, 'rating ed etichette non si ricordano');
  assert.ok(!edits.some(x => x.id === mine.id), 'mai toccare le scelte manuali');
  assert.strictEqual(edits.find(x => x.id === ruleOnly.id).category, 'AI');
  // dopo l'applicazione non resta nulla da fare
  Object.assign(fresh, { category: e.category, family: e.family, kind: e.kind || fresh.kind, accountUser: e.accountUser, classifiedBy: e.classifiedBy, extra: e.extra });
  Object.assign(ruleOnly, edits.find(x => x.id === ruleOnly.id));
  assert.strictEqual(FL.autoEdits([done, fresh, mine, ruleOnly], prefs).length, 0);
  assert.strictEqual(FL.autoEdits([done, tx({ details: 'BAR SPORT' })], { merchantMemory: false }).length, 0, 'memoria disattivabile');
});

test('toEdit e changed', () => {
  assert.deepStrictEqual(FL.toEdit({ class: { family: 'A', category: 'B' }, need: 'utile', person: 'Anna' }), { family: 'A', category: 'B', extra: { need: 'utile' }, person: 'Anna' });
  assert.deepStrictEqual(Object.keys(FL.changed({ need: '', tags: [] }, { need: 'utile', tags: [] })), ['need']);
  assert.strictEqual(FL.format('straordinaria', 'nature'), 'Una tantum');
});

test('memoria esercizi solo per i movimenti arrivati dopo la compilazione', () => {
  const done = tx({ details: 'FORNO ROSSI', category: 'Negozi alimentari', family: 'Alimentari', classifiedBy: 'user', extra: { need: 'essenziale' } });
  const old = tx({ details: 'FORNO ROSSI' });       // già presente: lo decide la finestra di copia
  const prefs = { memorySince: { [FL.profileKey(done)]: old.id } };
  const fresh = tx({ details: 'FORNO ROSSI' });     // importato dopo: preso in automatico
  const ids = FL.autoEdits([done, old, fresh], prefs).map(e => e.id);
  assert.deepStrictEqual(ids, [fresh.id]);
});

test('modifica di un esercizio già compilato: i movimenti allineati sono proposti spuntati', () => {
  const src = tx({ details: 'BAR SPORT', classifiedBy: 'user', extra: { need: 'superflua' } });
  const sameOld = tx({ details: 'BAR SPORT', classifiedBy: 'merchant:1', extra: { need: 'superflua' } });
  const mineDifferent = tx({ details: 'BAR SPORT', classifiedBy: 'user', extra: { need: 'essenziale' } });
  const before = { need: 'superflua' };
  const p = FL.proposals(src, { need: 'utile' }, [src, sameOld, mineDifferent], C.DEFAULT_TAXONOMY, before);
  assert.strictEqual(p.find(r => r.tx.id === sameOld.id).changes[0].checked, true, 'aveva il vecchio valore: si aggiorna');
  assert.strictEqual(p.find(r => r.tx.id === mineDifferent.id).changes[0].checked, false, 'valore diverso scelto a mano: chiede');
});
