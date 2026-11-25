/* ==========================================================================
 *  regista.js — IL REGISTA DELLA STORIA
 *  --------------------------------------------------------------------------
 *  La storia (dati/storia.js) è scritta come una sequenza di azioni:
 *
 *      await g.attendi(2);                       // aspetta 2 secondi
 *      await g.quando(() => g.lia.x > 14);       // aspetta che Lia arrivi lì
 *      await g.evento('interagisci:buco');       // aspetta un evento
 *
 *  "await" vuol dire "aspetta che finisca, poi vai avanti". Il regista
 *  tiene l'elenco di tutto ciò che si sta aspettando e, a ogni fotogramma,
 *  controlla se è arrivato il momento di andare avanti.
 * ========================================================================== */

export class Regista {
  constructor() {
    this.tempo = 0;
    this.attese = [];          // { fino } oppure { condizione }
    this.inAttesaEventi = {};  // nome → [funzioni da chiamare]
    this.ascoltatori = {};     // nome → [funzioni sempre attive]
  }

  /** Aspetta un certo numero di secondi (di gioco: si ferma in pausa). */
  attendi(secondi) {
    return new Promise((ok) => this.attese.push({ fino: this.tempo + secondi, ok }));
  }

  /** Aspetta finché la condizione diventa vera. */
  quando(condizione) {
    if (condizione()) return Promise.resolve();
    return new Promise((ok) => this.attese.push({ condizione, ok }));
  }

  /** Aspetta un evento (es. 'interagisci:buco', 'tocco', 'entrato:forno'). */
  evento(nome) {
    return new Promise((ok) => {
      (this.inAttesaEventi[nome] = this.inAttesaEventi[nome] || []).push(ok);
    });
  }

  /** Ascoltatore permanente di un evento. */
  su(nome, funzione) {
    (this.ascoltatori[nome] = this.ascoltatori[nome] || []).push(funzione);
  }

  /** Lancia un evento: sveglia chi lo aspettava. */
  emetti(nome, dato) {
    const attesi = this.inAttesaEventi[nome];
    if (attesi) {
      delete this.inAttesaEventi[nome];
      for (const ok of attesi) ok(dato);
    }
    for (const f of this.ascoltatori[nome] || []) f(dato);
  }

  aggiorna(dt) {
    this.tempo += dt;
    const pronte = [];
    this.attese = this.attese.filter((a) => {
      const finita = a.fino !== undefined ? this.tempo >= a.fino : a.condizione();
      if (finita) pronte.push(a.ok);
      return !finita;
    });
    for (const ok of pronte) ok();
  }
}
