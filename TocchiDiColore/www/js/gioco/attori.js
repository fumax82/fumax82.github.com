/* ==========================================================================
 *  attori.js — CHI ABITA LE SCENE
 *  --------------------------------------------------------------------------
 *  Un ATTORE è un personaggio o un oggetto che si muove: Biscotto, il
 *  gattino, il ladro, la fornaia, gli abitanti-animali, le auto...
 *  Ogni attore ha una Sagoma (il disegno di carta) e sa:
 *    - camminare verso un punto o lungo una lista di punti (vaiA, percorri)
 *    - scegliere il disegno giusto (di lato, di fronte, di spalle) secondo
 *      la direzione in cui va RISPETTO ALLA TELECAMERA
 *    - fare una "posa" speciale (abbaiare, ringhiare, parlare...)
 *  Le funzioni che richiedono tempo restituiscono una Promise: la storia
 *  può scrivere "await biscotto.vaiA(10, 0)".
 *
 *  Coordinate: x destra, y alto, z verso lo spettatore. I piedi stanno in y.
 * ========================================================================== */
import * as THREE from 'three';
import { Sagoma } from '../motore/sagoma.js';
import { Audio } from './audio.js';

/* ------------------------------------------------------------------------ */
/*  Da che parte vediamo chi cammina?                                       */
/* ------------------------------------------------------------------------ */
const _destra = new THREE.Vector3();
const _avanti = new THREE.Vector3();

/**
 * dir = { x, z } direzione in cui guarda/cammina l'attore.
 * Restituisce { vista: 'lato' | 'fronte' | 'retro', specchio }.
 * I disegni "di lato" guardano a DESTRA: se va verso sinistra sullo
 * schermo li specchiamo.
 */
export function vistaDa(dir, camera) {
  _destra.set(1, 0, 0).applyQuaternion(camera.quaternion);
  _avanti.set(0, 0, -1).applyQuaternion(camera.quaternion);
  const lr = Math.hypot(_destra.x, _destra.z) || 1, la = Math.hypot(_avanti.x, _avanti.z) || 1;
  const dx = (dir.x * _destra.x + dir.z * _destra.z) / lr;
  const df = (dir.x * _avanti.x + dir.z * _avanti.z) / la;
  if (df > 0.78) return { vista: 'retro', specchio: false };
  if (df < -0.78) return { vista: 'fronte', specchio: false };
  return { vista: 'lato', specchio: dx < 0 };
}

/** Quanti fotogrammi numerati esistono con quel prefisso (es. lato_cammina_0..7 → 8). */
const cacheConteggi = new Map();
export function conta(atlante, prefisso) {
  const chiave = atlante.nome + '|' + prefisso;
  if (cacheConteggi.has(chiave)) return cacheConteggi.get(chiave);
  let n = 0;
  while (atlante.fotogrammi[prefisso + '_' + n]) n++;
  cacheConteggi.set(chiave, n);
  return n;
}

/**
 * Sceglie un fotogramma esistente: prova "vista_posa_n", poi le stesse pose
 * in altre viste, poi le pose di riposo. Così un personaggio con pochi
 * disegni funziona lo stesso.
 */
export function scegliFotogramma(atlante, vista, posa, tempo, fps) {
  const f = atlante.fotogrammi;
  const viste = [vista, 'lato', 'fronte', 'retro'];
  for (const v of viste) {
    const n = conta(atlante, v + '_' + posa);
    if (n > 0) return { nome: v + '_' + posa + '_' + (Math.floor(tempo * fps) % n), vista: v };
    if (f[v + '_' + posa]) return { nome: v + '_' + posa, vista: v };
  }
  if (posa !== 'fermo') return scegliFotogramma(atlante, vista, 'fermo', tempo, 1.5);
  if (f[vista]) return { nome: vista, vista };
  if (f.lato) return { nome: 'lato', vista: 'lato' };
  return { nome: atlante.nomi[0], vista: 'fronte' };
}

/* ======================================================================== */
/*  ATTORE GENERICO                                                         */
/* ======================================================================== */
export class Attore {
  /**
   * def: { id, arte, x, z, y (quota fissa, facoltativa), dir: 1|-1 (guarda a destra/sinistra),
   *        scala, ombra, velocita, nome (per i dialoghi), sempreDiFronte, luce, visibile }
   */
  constructor(gioco, def) {
    this.gioco = gioco;
    this.def = def;
    this.id = def.id;
    this.nome = def.nome || def.id;
    this.x = def.x || 0;
    this.z = def.z || 0;
    this.y = def.y || 0;
    this.quotaFissa = def.y;           // se indicata, non segue il pavimento
    this.dir = { x: def.dir === -1 ? -1 : 1, z: 0 };
    this.velocita = def.velocita || 1.3;
    this.sempreDiFronte = !!def.sempreDiFronte;
    this.sagoma = new Sagoma(def.arte, { scala: def.scala || 1, ombra: def.ombra === undefined ? 0.3 : def.ombra, luce: def.luce || 0 });
    this.tAnim = Math.random() * 5;
    this.passo = 0;                    // fase del passo (cresce con la strada fatta)
    this.inMovimento = false;
    this.posaSpeciale = null;
    this.tempoPosa = 0;
    this.percorso = null;
    this.vel = 0;
    this.alArrivo = null;
    this.parlando = false;
    this.galleggia = 0;
    this.lunghezzaPasso = def.lunghezzaPasso || 1.1;  // metri per un ciclo completo di camminata
    this.visibile = def.visibile !== false;
  }

  aggiungiA(gruppo) { this.sagoma.aggiungiA(gruppo); }
  rimuovi() { this.sagoma.rimuovi(); }

  set visibile(v) { this._visibile = v; if (this.sagoma) this.sagoma.visibile = v; }
  get visibile() { return this._visibile; }

  cambiaArte(nome) { this.sagoma.cambiaAtlante(nome); }

  /** Cammina fino a (x, z). Restituisce una Promise che si risolve all'arrivo. */
  vaiA(x, z, velocita) { return this.percorri([[x, z]], velocita); }

  /** Percorre una lista di punti [[x, z], ...] (o [[x, z, y], ...] con quota). */
  percorri(punti, velocita) {
    if (this.alArrivo) { const f = this.alArrivo; this.alArrivo = null; f(); }
    this.percorso = punti.map((p) => p.slice());
    this.vel = velocita || this.velocita;
    return new Promise((ok) => { this.alArrivo = ok; });
  }

  ferma() {
    this.percorso = null;
    if (this.alArrivo) { const f = this.alArrivo; this.alArrivo = null; f(); }
  }

  /** Si gira verso il punto (x, z). */
  guarda(x, z) {
    const dx = x - this.x, dz = z - this.z, l = Math.hypot(dx, dz);
    if (l > 0.001) this.dir = { x: dx / l, z: dz / l };
  }

  /** Posa speciale per un certo tempo (secondi; Infinity = finché non cambia). */
  posa(nome, durata) {
    this.posaSpeciale = nome;
    this.tempoPosa = durata === undefined ? 0.8 : durata;
    this.tPosa = 0;
  }

  teletrasporta(x, z, dir) {
    this.x = x; this.z = z;
    if (dir !== undefined) this.dir = { x: dir, z: 0 };
    this.percorso = null;
  }

  /** Quota del pavimento: fissa, oppure quella della scena (segue ponti e scale). */
  _quota(scena) {
    if (this.quotaFissa !== undefined) return this.quotaFissa;
    return scena ? scena.quota(this.x, this.z) : 0;
  }

  aggiorna(dt, scena) {
    this.tAnim += dt;
    if (this.tPosa !== undefined) this.tPosa += dt;
    if (this.tempoPosa !== Infinity) {
      this.tempoPosa -= dt;
      if (this.tempoPosa <= 0) this.posaSpeciale = null;
    }
    this.inMovimento = false;
    // chi fa la "ronda" passeggia avanti e indietro tra due punti
    if (this.def.ronda && !this.percorso && !this.parlando && this.visibile) this.percorri(this.def.ronda, this.def.velocita);
    if (this.percorso && this.percorso.length) {
      const meta = this.percorso[0];
      const dx = meta[0] - this.x, dz = meta[1] - this.z, d = Math.hypot(dx, dz);
      const passo = this.vel * dt;
      if (d > 0.001) this.dir = { x: dx / d, z: dz / d };
      if (d <= passo) {
        this.x = meta[0]; this.z = meta[1];
        this.percorso.shift();
        if (!this.percorso.length) {
          this.percorso = null;
          if (this.alArrivo) { const f = this.alArrivo; this.alArrivo = null; f(); }
        }
      } else {
        this.x += (dx / d) * passo;
        this.z += (dz / d) * passo;
        this.passo += passo / this.lunghezzaPasso;
        this.inMovimento = true;
      }
    }
    this.y = this._quota(scena) + (this.galleggia ? Math.sin(this.tAnim * 1.7) * this.galleggia : 0);
  }

  /** La posa da mostrare quando si muove. */
  posaMovimento() { return this.vel > 2.2 ? 'corre' : 'cammina'; }

  /** Sceglie il fotogramma in base alla telecamera e posiziona la sagoma. */
  disegna(camera) {
    if (!this.visibile) return;
    const at = this.sagoma.atlante;
    let v = (this.sempreDiFronte && !this.inMovimento) || this.parlando ? { vista: 'fronte', specchio: false } : vistaDa(this.dir, camera);
    let posa = this.posaSpeciale || (this.parlando ? 'parla' : this.inMovimento ? this.posaMovimento() : 'fermo');
    let scelta;
    if (this.inMovimento && !this.posaSpeciale) {
      // la camminata segue la strada fatta: i piedi non "pattinano"
      const n = Math.max(1, conta(at, v.vista + '_' + posa) || conta(at, 'lato_' + posa));
      scelta = scegliFotogramma(at, v.vista, posa, (this.passo % 1) * n, 1);
    } else {
      const fps = posa === 'parla' ? 6 : posa === 'fermo' ? 2.2 : 5;
      scelta = scegliFotogramma(at, v.vista, posa, this.tAnim, fps);
    }
    // se manca la vista richiesta usiamo quella di lato, specchiata secondo la direzione
    const specchio = scelta.vista === 'lato' ? (v.vista === 'lato' ? v.specchio : vistaLaterale(this.dir, camera)) : false;
    this.sagoma.mostra(scelta.nome, specchio);
    this.sagoma.quotaTerreno(this.galleggia ? this.y - 0.05 : this.y);
    this.sagoma.posiziona(this.x, this.y + (this.altezzaExtra || 0), this.z);
  }
}

function vistaLaterale(dir, camera) {
  _destra.set(1, 0, 0).applyQuaternion(camera.quaternion);
  return dir.x * _destra.x + dir.z * _destra.z < 0;
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
      this.emettitore = gioco.particelle.aggiungiEmettitore(this.x, 1.2, this.z, def.scia.ritmo || 6, def.scia);
      this.emettitore.delLuogo = true;
      this.sciaAltezza = def.scia.altezza || 1.2;
    }
  }

  aggiorna(dt, scena) {
    if (this.parlando && this.percorso) this.ferma();
    super.aggiorna(dt, scena);
    if (this.emettitore) {
      this.emettitore.posizione[0] = this.x;
      this.emettitore.posizione[1] = this.y + this.sciaAltezza;
      this.emettitore.posizione[2] = this.z;
      this.emettitore.attivo = this.visibile;
    }
  }
}

/* ======================================================================== */
/*  ANIMALI: Biscotto (al guinzaglio, in corsa, con la borsa) e il gattino  */
/* ======================================================================== */
export class Animale extends Attore {
  constructor(gioco, def) {
    super(gioco, { ombra: 0.26, velocita: 3.2, lunghezzaPasso: 0.75, ...def });
    this.guinzaglio = null;        // se legato a Lia: la segue sul percorso
    this.conBorsa = false;
    this.verso = def.verso || 'abbaio';  // 'abbaio' o 'miagolio'
    this.timerVerso = 2 + Math.random() * 3;
    this.versiAutomatici = !!def.versiAutomatici;
  }

  posaMovimento() {
    if (this.conBorsa) return 'borsa';
    return this.vel > 2.0 ? 'corre' : 'cammina';
  }

  /** Abbaia (o miagola): suono, onda di percezione, posa con la bocca aperta. */
  faVerso() {
    const g = this.gioco;
    if (this.verso === 'abbaio') {
      Audio.abbaio(this.x, this.z);
      if (!this.inMovimento) this.posa('abbaia', 0.5);
      g.onda(this.x, this.z, 'abbaio');
    } else {
      Audio.miagolio(this.x, this.z);
      if (!this.inMovimento) this.posa('miagola', 0.6);
      g.onda(this.x, this.z, 'suono');
    }
  }

  aggiorna(dt, scena) {
    // al guinzaglio: trotterella un metro davanti a Lia, un po' più verso di noi
    if (this.guinzaglio && scena) {
      const L = this.guinzaglio;
      const p = scena.percorso.punto(Math.max(0, Math.min(scena.percorso.lunghezza, L.s + L.verso * 1.05)));
      const tx = p.x, tz = p.z + 0.32;
      const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz);
      if (d > 0.06) {
        const v = Math.min(d * 3.2, 3.4);
        this.x += (dx / d) * v * dt;
        this.z += (dz / d) * v * dt;
        if (d > 0.12) this.dir = { x: dx / d, z: dz / d };
        this.passo += (v * dt) / this.lunghezzaPasso;
        this.vel = v;
        this._trotta = d > 0.1;
      } else {
        this._trotta = false;
        this.dir = { x: L.verso * L.tangente.x, z: L.verso * L.tangente.z };
      }
    }
    super.aggiorna(dt, scena);
    if (this.guinzaglio && this._trotta) this.inMovimento = true;
    if (this.versiAutomatici && this.visibile) {
      this.timerVerso -= dt;
      if (this.timerVerso <= 0) { this.timerVerso = 3 + Math.random() * 3; this.faVerso(); }
    }
  }

  disegna(camera) {
    // con la borsa in bocca, da fermo usa "borsa_fermo"
    if (this.conBorsa && !this.inMovimento && !this.posaSpeciale) {
      this.posaSpeciale = 'borsa_fermo';
      this.tempoPosa = 0.01;
    }
    super.disegna(camera);
  }
}

/* ======================================================================== */
/*  VEICOLI: auto e autobus (sulla strada o a galla sul canale)             */
/* ======================================================================== */
export class Veicolo extends Attore {
  /**
   * def: { da: [x, z], a: [x, z], velocita, galleggia, pingpong, y }
   * Va da "da" ad "a" e ricomincia (oppure torna indietro se pingpong).
   */
  constructor(gioco, def) {
    super(gioco, { ombra: def.galleggia ? 0 : 0.9, ...def, x: def.da[0], z: def.da[1] });
    this.velBase = def.velocita || 2.5;
    this.vel = this.velBase;
    this.galleggia = def.galleggia ? 0.06 : 0;
    this.motore = null;
    this.timerClacson = 0;
    this.da = def.da.slice();
    this.a = def.a.slice();
    this.t = def.parti || 0;    // 0..1 lungo il tragitto
    this._dirDa();
  }

  _dirDa() {
    const dx = this.a[0] - this.da[0], dz = this.a[1] - this.da[1];
    this.lungo = Math.hypot(dx, dz) || 1;
    this.dir = { x: dx / this.lungo, z: dz / this.lungo };
  }

  silenzia() {
    if (this.motore) this.motore.ferma();
    this.motore = null;
  }

  aggiorna(dt, scena) {
    const d = this.def;
    const lia = this.gioco.lia;
    if (!this.motore && Audio.ctx && this.visibile) this.motore = Audio.continuo('motore', this.x, this.z, d.galleggia ? 0.08 : 0.16);
    // si ferma (e suona il clacson) se Lia è sulla sua strada
    const davanti = (lia.x - this.x) * this.dir.x + (lia.z - this.z) * this.dir.z;
    const lato = Math.abs((lia.x - this.x) * this.dir.z - (lia.z - this.z) * this.dir.x);
    const ostacolo = !d.galleggia && lato < 1.0 && davanti > 0 && davanti < 3.4;
    const meta = ostacolo ? 0 : this.velBase;
    this.vel += (meta - this.vel) * Math.min(1, dt * 3);
    if (ostacolo) {
      this.timerClacson -= dt;
      if (this.timerClacson <= 0) { Audio.clacson(this.x, this.z); this.timerClacson = 2.5; }
    }
    this.t += (this.vel * dt) / this.lungo;
    if (this.t >= 1) {
      this.t = 0;
      if (d.pingpong) { [this.da, this.a] = [this.a, this.da]; this._dirDa(); }
    }
    this.x = this.da[0] + (this.a[0] - this.da[0]) * this.t;
    this.z = this.da[1] + (this.a[1] - this.da[1]) * this.t;
    this.inMovimento = this.vel > 0.1;
    this.tAnim += dt;
    this.y = (d.y || 0) + (this.galleggia ? Math.sin(this.tAnim * 1.6) * this.galleggia : 0);
    if (this.motore) { this.motore.x = this.x; this.motore.y = this.z; }
  }

  disegna(camera) {
    if (!this.visibile) return;
    const v = vistaDa(this.dir, camera);
    const f = this.sagoma.atlante.fotogrammi;
    this.sagoma.mostra(f[v.vista] ? v.vista : 'lato', v.vista === 'lato' ? v.specchio : false);
    this.sagoma.quotaTerreno(this.y);
    this.sagoma.posiziona(this.x, this.y, this.z);
  }

  rimuovi() { super.rimuovi(); this.silenzia(); }
}

/* ======================================================================== */
/*  PICCIONI: beccano per terra e volano via se Lia si avvicina             */
/* ======================================================================== */
export class Piccioni {
  constructor(gioco, def) {
    this.gioco = gioco;
    this.def = def;
    this.id = def.id || 'piccioni';
    this.uccelli = [];
    for (let k = 0; k < (def.quanti || 4); k++) {
      const s = new Sagoma('piccione', { ombra: 0.12, scala: 1.3 });
      const casa = [def.x + (Math.random() - 0.5) * 1.8, def.z + (Math.random() - 0.5) * 0.8];
      this.uccelli.push({ s, casa, x: casa[0], z: casa[1], h: 0, specchio: Math.random() < 0.5, t: Math.random() * 3 });
    }
    this.inVolo = false;
    this.tornaTra = 0;
    this.timerVerso = 3;
    this.visibile = true;
  }

  aggiungiA(gruppo) { for (const u of this.uccelli) u.s.aggiungiA(gruppo); }
  rimuovi() { for (const u of this.uccelli) u.s.rimuovi(); }

  aggiorna(dt, scena) {
    const lia = this.gioco.lia;
    const vicino = Math.hypot(lia.x - this.def.x, lia.z - this.def.z) < 2.4;
    if (vicino && !this.inVolo) {
      this.inVolo = true;
      this.tornaTra = 14;
      Audio.ali(this.def.x, this.def.z);
      for (const u of this.uccelli) u.dir = [(Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random()), -Math.random() * 0.6];
    }
    this.timerVerso -= dt;
    if (!this.inVolo && this.timerVerso <= 0) { this.timerVerso = 4 + Math.random() * 5; Audio.piccione(this.def.x, this.def.z); }
    if (this.inVolo) {
      this.tornaTra -= dt;
      if (this.tornaTra <= 0 && !vicino) {
        this.inVolo = false;
        for (const u of this.uccelli) { u.x = u.casa[0]; u.z = u.casa[1]; u.h = 0; }
      }
    }
    for (const u of this.uccelli) {
      u.t += dt;
      const q = scena ? scena.quota(u.x, u.z) : 0;
      if (this.inVolo) {
        u.h += dt * 2.4;
        u.x += u.dir[0] * dt * 3;
        u.z += u.dir[1] * dt * 3;
        u.s.mostra(Math.floor(u.t * 12) % 2 ? 'f2' : 'f3', u.dir[0] < 0);
        u.s.visibile = u.h < 14;
      } else {
        u.s.visibile = true;
        u.s.mostra(Math.sin(u.t * 3 + u.casa[0]) > 0.6 ? 'f1' : 'f0', u.specchio);
      }
      u.s.quotaTerreno(q);
      u.s.posiziona(u.x, q + u.h, u.z);
    }
  }

  disegna() {}
}

/* ======================================================================== */
/*  Fabbrica: crea l'attore giusto dalla definizione della scena            */
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

/** Il guinzaglio: una linea che pende un poco tra la mano di Lia e il collare. */
export class Guinzaglio {
  constructor() {
    const geo = new THREE.BufferGeometry();
    this.punti = new Float32Array(14 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.punti, 3));
    this.linea = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x5b6f9a }));
    this.linea.frustumCulled = false;
    this.linea.visible = false;
    this.linea.renderOrder = 5;
  }

  aggiorna(da, a) {
    const n = 14;
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1);
      this.punti[k * 3] = da[0] + (a[0] - da[0]) * t;
      this.punti[k * 3 + 1] = da[1] + (a[1] - da[1]) * t - Math.sin(t * Math.PI) * 0.12;
      this.punti[k * 3 + 2] = da[2] + (a[2] - da[2]) * t;
    }
    this.linea.geometry.attributes.position.needsUpdate = true;
  }
}
