/*
 * util.js - Piccoli strumenti usati da tutto il resto del codice.
 *
 * Convenzioni dell'app:
 *  - gli importi sono in CENTESIMI (numeri interi): -12,50 € => -1250
 *  - le date sono stringhe "AAAA-MM-GG" (es. "2026-03-15")
 *
 * Il blocco (function(root){ ... })(...) serve a far funzionare lo stesso
 * file sia nel telefono (browser) sia nei test automatici (Node.js).
 */
(function (root) {
  'use strict';

  const DAY = 86400000; // millisecondi in un giorno

  /** "2026-03-15" -> numero di giorni dal 1970 (comodo per fare differenze). */
  function dayNumber(iso) {
    return Math.round(Date.parse(iso + 'T00:00:00Z') / DAY);
  }

  /** Numero di giorni -> "AAAA-MM-GG". */
  function isoFromDay(n) {
    return new Date(n * DAY).toISOString().slice(0, 10);
  }

  /** Aggiunge (o toglie) giorni a una data. */
  function addDays(iso, days) {
    return isoFromDay(dayNumber(iso) + days);
  }

  /** Giorni tra due date (b - a). */
  function daysBetween(a, b) {
    return dayNumber(b) - dayNumber(a);
  }

  /** Data di oggi in "AAAA-MM-GG" (fuso orario locale). */
  function today() {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  /** Giorno della settimana: 0 = domenica ... 6 = sabato. */
  function weekday(iso) {
    return new Date(iso + 'T12:00:00Z').getUTCDay();
  }

  /** Testo in minuscolo, senza accenti e spazi doppi: serve per confrontare. */
  function norm(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Mediana di una lista di numeri. */
  function median(values) {
    if (!values.length) return 0;
    const s = values.slice().sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
  }

  /** Somma di una lista usando una funzione per estrarre il valore. */
  function sum(list, f) {
    return list.reduce((acc, x) => acc + f(x), 0);
  }

  /** Raggruppa una lista: groupBy(lista, t => t.category) -> { categoria: [..] } */
  function groupBy(list, keyFn) {
    const out = {};
    for (const x of list) {
      const k = keyFn(x);
      (out[k] = out[k] || []).push(x);
    }
    return out;
  }

  /** Conto o carta effettiva: quella della banca o, se manca, quella indicata da te. */
  function account(t) {
    return t.account || t.accountUser || '';
  }

  /** Identificativo semplice e unico (per regole, obiettivi...). */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  const Util = { DAY, dayNumber, isoFromDay, addDays, daysBetween, today, weekday, norm, median, sum, groupBy, account, uid };
  root.Util = Util;
  if (typeof module !== 'undefined') module.exports = Util;
})(typeof window === 'undefined' ? globalThis : window);
