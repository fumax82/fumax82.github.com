/* ==========================================================================
 *  attori.js — CHI ABITA IL MONDO
 *  --------------------------------------------------------------------------
 *  Un ATTORE è un personaggio o un oggetto che si muove: Biscotto, il
 *  gattino, il ladro, la fornaia, gli abitanti-animali, le auto...
 *  Ogni attore ha una Sagoma (il disegno) e sa:
 *    - camminare verso un punto o lungo un percorso (vaiA, percorri)
 *    - scegliere il disegno giusto: di fronte, di spalle o di lato,
 *      a seconda di dove si trova la telecamera
 *    - fare una "posa" speciale (abbaiare, ringhiare, parlare...)
 *  Le funzioni che richiedono tempo (camminare) restituiscono una
 *  Promise: la storia può scrivere "await biscotto.vaiA(10, 5)".
 * ========================================================================== */
import * as THREE from 'three';
import { Sagoma } from '../motore/sagoma.js';
import { Audio } from './audio.js';

const DUE_PI = Math.PI * 2;
const diff = (a, b) => { let d = (b - a) % DUE_PI; if (d > Math.PI) d -= DUE_PI; if (d < -Math.PI) d += DUE_PI; return d; };

/** Da dove vediamo l'attore? → 'fronte' | 'retro' | 'lato' (+ specchio) */
export function vistaDa(angoloAttore, ax, ay, camX, camY) {
  const angVista = Math.atan2(ay - camY, ax - camX);
  const d = diff(angVista, angoloAttore);
  const ad = Math.abs(d);
  if (ad < Math.PI / 4) return { vista: 'retro', specchio: false };
  if (ad > (3 * Math.PI) / 4) return { vista: 'fronte', specchio: false };
  return { vista: 'lato', specchio: d < 0 };
}

/* ======================================================================== */
/*  ATTORE GENERICO                                                         */
/* ======================================================================== */
export class Attore {
  /**
   * def: { id, arte, x, y, angolo, scala, ombra, velocita, solido, raggio,
   *        nome (per i dialoghi), sempreDiFronte, luce }
   */
  constructor(gioco, def) {
    this.gioco = gioco;
    this.def = def;
    this.id = def.id;
    this.nome = def.nome || def.id;
    this.x = def.x; this.y = def.y; this.h = 0;
    this.angolo = def.angolo || 0;
    this.velocita = def.velocita || 1.4;
    this.solido = def.solido !== false;
    this.raggio = def.raggio || 0.28;
    this.sempreDiFronte = !!def.sempreDiFronte;
    this.sagoma = new Sagoma(def.arte, { scala: def.scala || 1, ombra: def.ombra === undefined ? 0.3 : def.ombra, luce: def.luce || 0 });
    this.tAnim = Math.random() * 5;
    this.inMovimento = false;
    this.posaSpeciale = null;     // es. 'abbaia', 'ringhia', 'parla'
    this.tempoPosa = 0;
    this.percorso = null;
    this.vel = 0;
    this.alArrivo = null;
    this.parlando = false;
    this.visibile = def.visibile !== false;
    this.galleggia = 0;           // ampiezza dell'ondeggiare (auto sull'acqua)
    this.fpsCammina = def.fpsCammina || 8;
  }

  aggiungiA(gruppo) { this.sagoma.aggiungiA(gruppo); }
  rimuovi() { this.sagoma.rimuovi(); }

  set visibile(v) { this._visibile = v; if (this.sagoma) this.sagoma.visibile = v; }
  get visibile() { return this._visibile; }

  /** Cambia disegno (es. Lia con o senza borsa). */
  cambiaArte(nome) { this.sagoma.cambiaAtlante(nome); }

  /** Cammina fino a (x, y). Restituisce una Promise che si risolve all'arrivo. */
  vaiA(x, y, velocita) {
    return this.percorri([[x, y]], velocita);
  }

  /** Percorre una lista di punti [[x, y], ...]. */
  percorri(punti, velocita) {
    this.percorso = punti.map((p) => [p[0], p[1]]);
    this.vel = velocita || this.velocita;
    return new Promise((ok) => { this.alArrivo = ok; });
  }

  ferma() {
    this.percorso = null;
    if (this.alArrivo) { const f = this.alArrivo; this.alArrivo = null; f(); }
  }

  /** Si gira verso un punto. */
  guarda(x, y) {
    this.angolo = Math.atan2(y - this.y, x - this.x);
  }

  /** Posa speciale per un certo tempo (in secondi; Infinity = finché non cambia). */
  posa(nome, durata) {
    this.posaSpeciale = nome;
    this.tempoPosa = durata === undefined ? 0.8 : durata;
  }

  teletrasporta(x, y, angolo) {
    this.x = x; this.y = y;
    if (angolo !== undefined) this.angolo = angolo;
    this.percorso = null;
  }

  aggiorna(dt, mondo) {
    this.tAnim += dt;
    if (this.tempoPosa !== Infinity) {
      this.tempoPosa -= dt;
      if (this.tempoPosa <= 0) this.posaSpeciale = null;
    }
    this.inMovimento = false;
    // "ronda": chi passeggia avanti e indietro lungo un percorso fisso
    if (this.def.ronda && !this.percorso && !this.parlando && this.visibile) this.percorri(this.def.ronda, this.def.velocita);
    if (this.percorso && this.percorso.length) {
      const [tx, ty] = this.percorso[0];
      const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy);
      const passo = this.vel * dt;
      if (d > 0.001) this.angolo = Math.atan2(dy, dx);
      if (d <= passo) {
        this.x = tx; this.y = ty;
        this.percorso.shift();
        if (!this.percorso.length) {
          this.percorso = null;
          if (this.alArrivo) { const f = this.alArrivo; this.alArrivo = null; f(); }
        }
      } else {
        this.x += (dx / d) * passo;
        this.y += (dy / d) * passo;
        this.inMovimento = true;
      }
    }
    const quota = mondo ? Math.max(mondo.quota(this.x, this.y), 0) : 0;
    this.h = quota + (this.galleggia ? Math.sin(this.tAnim * 1.7) * this.galleggia : 0) + (this.altezzaExtra || 0);
  }

  /** Nome della "posa" da mostrare quando si muove. */
  posaMovimento() {
    return this.vel > 2.2 ? 'corre' : 'cammina';
  }

  /** Sceglie il fotogramma in base alla telecamera. */
  disegna(camX, camY) {
    if (!this.visibile) return;
    const at = this.sagoma.atlante;
    let v = this.sempreDiFronte && !this.inMovimento ? { vista: 'fronte', specchio: false } : vistaDa(this.angolo, this.x, this.y, camX, camY);
    let posa = this.posaSpeciale || (this.inMovimento ? this.posaMovimento() : 'fermo');
    // se manca il disegno di fronte/di spalle per questa posa, usiamo quello di lato
    if (v.vista !== 'lato' && !at.fotogrammi[v.vista + '_' + posa + '_0'] && !at.fotogrammi[v.vista + '_' + posa] && at.fotogrammi['lato_' + posa + '_0']) {
      const camDestraX = -(camY - this.y), camDestraY = camX - this.x; // perpendicolare alla vista
      const dirX = Math.cos(this.angolo), dirY = Math.sin(this.angolo);
      v = { vista: 'lato', specchio: dirX * camDestraX + dirY * camDestraY > 0 };
    }
    let n = 0;
    const fps = posa === 'corre' ? 12 : posa === 'cammina' ? this.fpsCammina : posa === 'parla' ? 7 : 1.4;
    const quanti = contaFotogrammi(at, v.vista, posa);
    if (quanti > 1) n = Math.floor(this.tAnim * fps) % quanti;
    this.sagoma.posa(v.vista, posa, n, v.specchio);
    this.sagoma.quotaTerreno(this.h - (this.galleggia ? 0 : 0));
    this.sagoma.posiziona(this.x, this.y, this.h);
  }
}

/** Quanti fotogrammi numerati esistono per vista + posa (es. lato_cammina_0..3 → 4). */
const cacheConteggi = new Map();
function contaFotogrammi(atlante, vista, posa) {
  const chiave = atlante.nome + '|' + vista + '|' + posa;
  if (cacheConteggi.has(chiave)) return cacheConteggi.get(chiave);
  let n = 0;
  while (atlante.fotogrammi[vista + '_' + posa + '_' + n]) n++;
  if (n === 0 && vista !== 'fronte') { while (atlante.fotogrammi['fronte_' + posa + '_' + n]) n++; }
  cacheConteggi.set(chiave, n);
  return n;
}

/* ======================================================================== */
/*  PERSONA (abitanti): stanno ferme, ti guardano, parlano                  */
/* ======================================================================== */
export class Persona extends Attore {
  constructor(gioco, def) {
    super(gioco, { sempreDiFronte: true, ...def });
    this.chiacchiere = def.chiacchiere || null;   // frasi dette se le si parla
    this.emettitore = null;
    if (def.scia) {   // profumo, fumo della pipa, odore di pane...
      this.emettitore = gioco.particelle.aggiungiEmettitore(this.x, 1.2, this.y, def.scia.ritmo || 6, def.scia);
      this.sciaAltezza = def.scia.altezza || 1.2;
    }
  }

  aggiorna(dt, mondo) {
    if (this.parlando && this.percorso) this.ferma();   // chi parla si ferma
    super.aggiorna(dt, mondo);
    if (this.parlando) this.posaSpeciale = 'parla';
    else if (this.posaSpeciale === 'parla') this.posaSpeciale = null;
    if (this.emettitore) {
      this.emettitore.posizione[0] = this.x;
      this.emettitore.posizione[1] = this.h + this.sciaAltezza;
      this.emettitore.posizione[2] = this.y;
      this.emettitore.attivo = this.visibile;
    }
  }
}

/* ======================================================================== */
/*  BISCOTTO (e il gattino): al guinzaglio, in corsa, con la borsa          */
/* ======================================================================== */
export class Animale extends Attore {
  constructor(gioco, def) {
    super(gioco, { ombra: 0.26, velocita: 3.2, solido: false, ...def });
    this.guinzaglio = null;        // se legato a Lia
    this.conBorsa = false;
    this.verso = def.verso || 'abbaio'; // 'abbaio' o 'miagolio'
    this.timerVerso = 2 + Math.random() * 3;
    this.versiAutomatici = !!def.versiAutomatici;
    this.fpsCammina = 9;
  }

  posaMovimento() {
    if (this.conBorsa) return 'borsa';
    return this.vel > 2.0 ? 'corre' : 'cammina';
  }

  /** Abbaia (o miagola): suono, onda di percezione, posa con la bocca aperta. */
  faVerso(mondo) {
    if (this.verso === 'abbaio') {
      Audio.abbaio(this.x, this.y);
      this.posa(this.inMovimento ? null : 'abbaia', 0.5);
      if (mondo) mondo.creaOnda(this.x, this.y, this.gioco.onde.abbaio);
    } else {
      Audio.miagolio(this.x, this.y);
      this.posa(this.inMovimento ? null : 'miagola', 0.6);
      if (mondo) mondo.creaOnda(this.x, this.y, this.gioco.onde.suono);
    }
  }

  aggiorna(dt, mondo) {
    // al guinzaglio: cammina un po' davanti e di lato a Lia
    if (this.guinzaglio) {
      const g = this.guinzaglio;
      const tx = g.x + Math.cos(g.angolo) * 0.95 + Math.cos(g.angolo + Math.PI / 2) * 0.35;
      const ty = g.y + Math.sin(g.angolo) * 0.95 + Math.sin(g.angolo + Math.PI / 2) * 0.35;
      const d = Math.hypot(tx - this.x, ty - this.y);
      if (d > 0.08) {
        const v = Math.min(d * 3, 3);
        this.x += ((tx - this.x) / d) * v * dt;
        this.y += ((ty - this.y) / d) * v * dt;
        this.angolo = Math.atan2(ty - this.y, tx - this.x);
        this.inMovimentoGuinzaglio = d > 0.12;
      } else this.inMovimentoGuinzaglio = false;
    }
    super.aggiorna(dt, mondo);
    if (this.guinzaglio && this.inMovimentoGuinzaglio) { this.inMovimento = true; this.vel = 1.5; }
    if (this.versiAutomatici && this.visibile) {
      this.timerVerso -= dt;
      if (this.timerVerso <= 0) { this.timerVerso = 3 + Math.random() * 3; this.faVerso(mondo); }
    }
  }
}

/* ======================================================================== */
/*  VEICOLI: auto e autobus che vanno avanti e indietro (o galleggiano)      */
/* ======================================================================== */
export class Veicolo extends Attore {
  /** def: { corsia: y, da: x0, a: x1, velocita, galleggia } */
  constructor(gioco, def) {
    super(gioco, { ombra: def.galleggia ? 0 : 0.9, solido: false, ...def });
    this.direzione = def.a > def.da ? 1 : -1;
    this.angolo = this.direzione > 0 ? 0 : Math.PI;
    this.velBase = def.velocita || 2.5;
    this.vel = this.velBase;
    this.galleggia = def.galleggia ? 0.06 : 0;
    this.motore = null;          // il suono del motore nasce quando l'audio è pronto
    this.timerClacson = 0;
    this.pingpong = !!def.pingpong; // va avanti e indietro invece di ricominciare
    this.da = def.da; this.a = def.a;
  }

  /** Chiamata quando si lascia il luogo: il suono verrà ricreato al ritorno. */
  silenzia() {
    if (this.motore) this.motore.ferma();
    this.motore = null;
  }

  aggiorna(dt, mondo) {
    const d = this.def;
    const lia = this.gioco.lia;
    if (!this.motore && Audio.ctx) this.motore = Audio.continuo('motore', this.x, this.y, d.galleggia ? 0.1 : 0.2);
    // si ferma se Lia è sulla sua strada, poco più avanti
    const davanti = (lia.x - this.x) * this.direzione;
    const sullaCorsia = Math.abs(lia.y - this.y) < 0.9;
    const ostacolo = sullaCorsia && davanti > 0 && davanti < 3.2 && !d.galleggia;
    const meta = ostacolo ? 0 : this.velBase;
    this.vel += (meta - this.vel) * Math.min(1, dt * 3);
    if (ostacolo) {
      this.timerClacson -= dt;
      if (this.timerClacson <= 0) { Audio.clacson(this.x, this.y); this.timerClacson = 2.5; }
    }
    this.x += this.direzione * this.vel * dt;
    const oltre = (this.direzione > 0 && this.x > this.a) || (this.direzione < 0 && this.x < this.a);
    if (oltre) {
      if (this.pingpong) {
        // inverte la marcia: scambia partenza e arrivo
        [this.da, this.a] = [this.a, this.da];
        this.direzione = -this.direzione;
        this.angolo = this.direzione > 0 ? 0 : Math.PI;
      } else this.x = this.da;
    }
    this.inMovimento = this.vel > 0.1;
    this.tAnim += dt;
    this.h = Math.max(mondo.quota(this.x, this.y), d.galleggia ? -0.2 : 0) + (this.galleggia ? Math.sin(this.tAnim * 1.6) * this.galleggia : 0);
    if (this.motore) { this.motore.x = this.x; this.motore.y = this.y; }
  }

  disegna(camX, camY) {
    const v = vistaDa(this.angolo, this.x, this.y, camX, camY);
    this.sagoma.mostra(this.sagoma.atlante.fotogrammi[v.vista] ? v.vista : 'lato', v.specchio);
    this.sagoma.posiziona(this.x, this.y, this.h);
  }

  rimuovi() {
    super.rimuovi();
    this.silenzia();
  }
}

/* ======================================================================== */
/*  PICCIONI: beccano per terra e volano via se Lia si avvicina             */
/* ======================================================================== */
export class Piccioni {
  constructor(gioco, def) {
    this.gioco = gioco;
    this.def = def;
    this.uccelli = [];
    for (let k = 0; k < (def.quanti || 4); k++) {
      const s = new Sagoma('piccione', { ombra: 0.12, scala: 1 });
      const casa = [def.x + (Math.random() - 0.5) * 1.6, def.y + (Math.random() - 0.5) * 1.2];
      this.uccelli.push({ s, casa, x: casa[0], y: casa[1], h: 0, volo: 0, specchio: Math.random() < 0.5, t: Math.random() * 3 });
    }
    this.inVolo = false;
    this.tornaTra = 0;
    this.timerVerso = 3;
  }

  aggiungiA(gruppo) { for (const u of this.uccelli) u.s.aggiungiA(gruppo); }
  rimuovi() { for (const u of this.uccelli) u.s.rimuovi(); }

  aggiorna(dt, mondo) {
    const lia = this.gioco.lia;
    const vicino = Math.hypot(lia.x - this.def.x, lia.y - this.def.y) < 2.3;
    if (vicino && !this.inVolo) {
      this.inVolo = true;
      this.tornaTra = 12;
      Audio.ali(this.def.x, this.def.y);
      for (const u of this.uccelli) u.dir = [Math.random() - 0.5, Math.random() - 0.5];
    }
    this.timerVerso -= dt;
    if (!this.inVolo && this.timerVerso <= 0) { this.timerVerso = 4 + Math.random() * 5; Audio.piccione(this.def.x, this.def.y); }
    if (this.inVolo) {
      this.tornaTra -= dt;
      if (this.tornaTra <= 0 && !vicino) {
        this.inVolo = false;
        for (const u of this.uccelli) { u.x = u.casa[0]; u.y = u.casa[1]; u.h = 0; }
      }
    }
    for (const u of this.uccelli) {
      u.t += dt;
      const q = Math.max(0, mondo.quota(u.x, u.y));
      if (this.inVolo) {
        u.h += dt * 2.2;
        u.x += u.dir[0] * dt * 3;
        u.y += u.dir[1] * dt * 3;
        u.s.mostra(Math.floor(u.t * 12) % 2 ? 'f2' : 'f3', u.dir[0] < 0);
        u.s.visibile = u.h < 14;
      } else {
        u.s.visibile = true;
        u.s.mostra(Math.sin(u.t * 3 + u.casa[0]) > 0.6 ? 'f1' : 'f0', u.specchio);
      }
      u.s.quotaTerreno(q);
      u.s.posiziona(u.x, u.y, q + u.h);
    }
  }

  disegna() {}
}

/* ======================================================================== */
/*  Fabbrica: crea l'attore giusto dalla definizione del luogo              */
/* ======================================================================== */
export function creaAttore(gioco, def) {
  switch (def.tipo) {
    case 'animale': return new Animale(gioco, def);
    case 'veicolo': return new Veicolo(gioco, def);
    case 'piccioni': return new Piccioni(gioco, def);
    case 'persona': return new Persona(gioco, def);
    default: return new Attore(gioco, def);
  }
}

/** Linea del guinzaglio tra la mano di Lia e il collare di Biscotto. */
export class Guinzaglio {
  constructor() {
    const geo = new THREE.BufferGeometry();
    this.punti = new Float32Array(12 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.punti, 3));
    this.linea = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x5b6f9a }));
    this.linea.frustumCulled = false;
    this.linea.visible = false;
  }

  aggiorna(da, a) {
    // una curva che pende un poco verso il basso
    for (let k = 0; k < 12; k++) {
      const t = k / 11;
      const x = da[0] + (a[0] - da[0]) * t, z = da[2] + (a[2] - da[2]) * t;
      const y = da[1] + (a[1] - da[1]) * t - Math.sin(t * Math.PI) * 0.12;
      this.punti[k * 3] = x; this.punti[k * 3 + 1] = y; this.punti[k * 3 + 2] = z;
    }
    this.linea.geometry.attributes.position.needsUpdate = true;
  }
}
