/* ==========================================================================
 *  personaggi3d.js — LIA E GOGO (pupazzi 3D fatti di forme semplici)
 *  --------------------------------------------------------------------------
 *  Niente sagome di cartone: i personaggi sono "giocattoli" fatti di
 *  sfere, capsule e forme al tornio, quindi sono rotondi e si vedono bene
 *  da ogni lato. Lo stesso pittore ad acquerello del mondo li colora
 *  (sempre colorati: loro esistono anche quando il mondo è ancora bianco).
 *
 *  Ogni personaggio è un piccolo "scheletro" di gruppi (Group), uno per
 *  ogni articolazione: anche, spalle, collo, orecchie, coda...
 *  Le animazioni sono PROCEDURALI (calcolate a ogni fotogramma):
 *    - il passo: gambe e braccia che oscillano, il corpo che sobbalza,
 *    - SCHIACCIA E ALLUNGA (squash & stretch) quando si salta o si atterra,
 *    - il MOVIMENTO SECONDARIO: capelli, orecchie e coda sono legati a
 *      molle elastiche, quindi arrivano "in ritardo" e dondolano,
 *    - le palpebre che sbattono, la testa che si gira verso i suoni,
 *    - il salto di gioia (con giravolta) quando il bambino li tocca.
 *
 *  Lia cammina da sola lungo il marciapiede (pilota automatico) e col
 *  bastone tocca il selciato: ogni "toc" colora un pezzetto di mondo.
 *  Gogo trotterella al guinzaglio, ogni tanto scappa ad annusare qualcosa,
 *  abbaia (e l'abbaio colora!) e poi torna.
 * ========================================================================== */
import * as THREE from 'three';
import { colora, TIPI } from './geometria.js';
import { materialePigmento, materialeOmbra } from './acquerello3d.js';
import { Elastico, Molla, clamp, lerp, diffAngolo, caso, morbido } from './utili.js';
import { ZF, MARCIAPIEDE } from './mondo.js';

const MAT = materialePigmento({ personaggio: true });
const MAT2 = materialePigmento({ personaggio: true, doppio: true });

const COL = {
  pelle: [1.0, 0.925, 0.85], guance: [0.99, 0.66, 0.66], vestito: [0.44, 0.74, 0.80], colletto: [1.0, 0.99, 0.96],
  capelli: [0.97, 0.69, 0.38], cappello: [1.0, 0.99, 0.97], nastro: [0.97, 0.64, 0.66], scarpe: [1.0, 0.99, 0.97],
  borsa: [0.98, 0.64, 0.66], bocca: [0.78, 0.36, 0.38], bianco: [1, 1, 1], nero: [0.18, 0.13, 0.12],
  bastone: [0.99, 0.98, 0.95], punta: [0.92, 0.38, 0.40],
  cane: [1.0, 0.94, 0.76], caneChiaro: [1.0, 0.97, 0.88], caramello: [0.89, 0.62, 0.36], naso: [0.32, 0.22, 0.20],
  collare: [0.42, 0.64, 0.88], oro: [0.99, 0.82, 0.38], lingua: [0.96, 0.52, 0.56], guinzaglio: [0.93, 0.42, 0.48],
};

/** Un pezzo di pupazzo: geometria + colore (o funzione colore) → Mesh */
function pezzo(geo, colore, doppio = false) {
  colora(geo, colore, 0);
  const m = new THREE.Mesh(geo, doppio ? MAT2 : MAT);
  return m;
}
const tornio = (profilo, seg = 20, inizio = 0, ampiezza = Math.PI * 2) => new THREE.LatheGeometry(profilo.map(([r, y]) => new THREE.Vector2(r, y)), seg, inizio, ampiezza);
const gruppo = (x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); return g; };
/** Una capsula orientata da a verso b (per le cinghie, il guinzaglio...). */
function capsulaTra(a, b, r, colore) {
  const d = new THREE.Vector3().subVectors(b, a), l = d.length();
  const m = pezzo(new THREE.CapsuleGeometry(r, Math.max(0.001, l - 2 * r), 3, 6), colore);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}
/** Ombra a macchia sotto un personaggio. */
function ombraSotto(scena, rx, rz) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), materialeOmbra(0.85, true));
  m.scale.set(rx, 1, rz);
  m.renderOrder = 1;
  scena.add(m);
  return m;
}
/** Gli occhi dei cartoni: un grande ovale bianco e un puntino nero. */
function occhio(r) {
  const g = new THREE.Group();
  const bianco = pezzo(new THREE.SphereGeometry(r, 16, 12), COL.bianco);
  bianco.scale.set(0.85, 1.12, 0.42);
  const pupilla = pezzo(new THREE.SphereGeometry(r * 0.34, 10, 8), COL.nero);
  pupilla.position.z = r * 0.36;
  pupilla.scale.set(1, 1.1, 0.5);
  g.add(bianco, pupilla);
  g.userData = { bianco, pupilla, r };
  return g;
}
/** Posiziona un oggetto sulla superficie di una sfera (centro c, raggio R) in direzione d, girato verso fuori
 *  (avanti = quanto deve invece guardare dritto davanti, come gli occhi). */
function sullaSfera(obj, c, R, d, fuori = 0, avanti = 0) {
  const n = new THREE.Vector3(...d).normalize();
  obj.position.copy(c).addScaledVector(n, R + fuori);
  const g = n.clone().lerp(new THREE.Vector3(0, 0, 1), avanti).normalize();
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), g);
}

/* ========================================================================== */
/*  LIA                                                                       */
/* ========================================================================== */
export class Lia {
  constructor(scena) {
    this.radice = new THREE.Group();
    this.corpo = gruppo(0, 0, 0);
    this.radice.add(this.corpo);
    scena.add(this.radice);
    this.ombra = ombraSotto(scena, 0.3, 0.26);

    // --- gambe e scarpe ---
    this.gambe = [-1, 1].map((s) => {
      const g = gruppo(s * 0.058, 0.34, 0);
      const gamba = pezzo(new THREE.CapsuleGeometry(0.03, 0.24, 4, 10), COL.pelle);
      gamba.position.y = -0.15;
      const calzino = pezzo(new THREE.CylinderGeometry(0.034, 0.033, 0.06, 12), COL.bianco);
      calzino.position.y = -0.255;
      const scarpa = pezzo(new THREE.SphereGeometry(0.052, 14, 10), COL.scarpe);
      scarpa.scale.set(0.82, 0.62, 1.3); scarpa.position.set(0, -0.3, 0.022);
      g.add(gamba, calzino, scarpa);
      this.corpo.add(g);
      return g;
    });
    // --- il vestito a campana (forma al tornio) ---
    this.vestito = pezzo(tornio([[0, 0.29], [0.19, 0.285], [0.208, 0.30], [0.19, 0.36], [0.158, 0.44], [0.132, 0.52], [0.116, 0.57], [0.092, 0.615], [0.05, 0.64], [0, 0.645]], 28), COL.vestito);
    this.corpo.add(this.vestito);
    const colletto = pezzo(new THREE.TorusGeometry(0.068, 0.026, 8, 24), COL.colletto);
    colletto.rotation.x = Math.PI / 2; colletto.scale.set(1, 1, 0.55); colletto.position.y = 0.625;
    this.corpo.add(colletto);
    // --- la borsetta rosa a tracolla ---
    const borsa = pezzo(new THREE.SphereGeometry(0.06, 14, 10), COL.borsa);
    borsa.scale.set(1.15, 0.9, 0.5); borsa.position.set(-0.165, 0.4, 0.05); borsa.rotation.y = -0.5;
    this.corpo.add(borsa);
    this.corpo.add(capsulaTra(new THREE.Vector3(0.1, 0.6, 0.075), new THREE.Vector3(-0.16, 0.43, 0.09), 0.009, COL.borsa));
    // --- braccia: spalla (gruppo) → braccio → mano ---
    this.braccia = [-1, 1].map((s) => {
      const spalla = gruppo(s * 0.112, 0.575, 0);
      spalla.rotation.order = 'YXZ';
      const manica = pezzo(new THREE.SphereGeometry(0.058, 14, 10), COL.vestito);
      manica.scale.set(1, 0.9, 1);
      const braccio = pezzo(new THREE.CapsuleGeometry(0.024, 0.13, 4, 8), COL.pelle);
      braccio.position.y = -0.1;
      const mano = pezzo(new THREE.SphereGeometry(0.033, 12, 8), COL.pelle);
      mano.position.y = -0.195;
      spalla.add(manica, braccio, mano);
      this.corpo.add(spalla);
      return spalla;
    });
    // --- il bastone (nella mano destra): bianco con la punta rossa ---
    this.bastone = gruppo(0, -0.2, 0);
    const asta = pezzo(new THREE.CylinderGeometry(0.0085, 0.0085, 0.56, 6), COL.bastone);
    asta.position.y = -0.28;
    const punta = pezzo(new THREE.CylinderGeometry(0.009, 0.007, 0.12, 6), COL.punta);
    punta.position.y = -0.62;
    const impugnatura = pezzo(new THREE.CapsuleGeometry(0.014, 0.06, 3, 6), [0.3, 0.27, 0.27]);
    impugnatura.position.y = -0.02;
    this.puntaBastone = gruppo(0, -0.69, 0);
    this.bastone.add(asta, punta, impugnatura, this.puntaBastone);
    this.bastone.rotation.x = 0.1;
    this.braccia[1].add(this.bastone);

    // --- la TESTA ---
    this.collo = gruppo(0, 0.63, 0);
    this.corpo.add(this.collo);
    this.testa = gruppo(0, 0, 0);
    this.testa.rotation.order = 'YXZ';
    this.collo.add(this.testa);
    const R = 0.205, c = new THREE.Vector3(0, 0.19, 0);
    const guance = [new THREE.Vector3(0.6, -0.36, 0.72).normalize(), new THREE.Vector3(-0.6, -0.36, 0.72).normalize()];
    const cranio = pezzo(new THREE.SphereGeometry(R, 32, 24), (x, y, z, nx, ny, nz) => {
      let k = 0;
      for (const g of guance) k = Math.max(k, morbido(0.955, 0.99, nx * g.x + ny * g.y + nz * g.z) * 0.8);
      return [lerp(COL.pelle[0], COL.guance[0], k), lerp(COL.pelle[1], COL.guance[1], k), lerp(COL.pelle[2], COL.guance[2], k)];
    });
    cranio.position.copy(c); cranio.scale.set(1.05, 0.97, 1.0);
    this.testa.add(cranio);
    // occhi
    this.occhi = [-1, 1].map((s) => {
      const o = occhio(0.052);
      sullaSfera(o, c, R * 1.0, [s * 0.34, -0.1, 0.93], -0.012, 0.55);
      this.testa.add(o);
      return o;
    });
    // nasino e bocca
    const naso = pezzo(new THREE.SphereGeometry(0.017, 10, 8), [1.0, 0.82, 0.74]);
    sullaSfera(naso, c, R, [0, -0.3, 0.95], -0.004);
    this.testa.add(naso);
    // la bocca: un sorrisetto (arco) e, quando è felice, una boccuccia aperta
    this.bocca = pezzo(new THREE.SphereGeometry(0.026, 12, 8), COL.bocca);
    sullaSfera(this.bocca, c, R, [0, -0.5, 0.86], -0.012);
    this.bocca.scale.set(1, 0.01, 0.4);
    this.testa.add(this.bocca);
    this.sorriso = pezzo(new THREE.TorusGeometry(0.02, 0.0045, 5, 14, Math.PI * 0.9), COL.bocca);
    sullaSfera(this.sorriso, c, R, [0, -0.47, 0.88], -0.002);
    this.sorriso.rotateZ(Math.PI * 1.05);
    this.testa.add(this.sorriso);
    // i capelli a caschetto (un guscio aperto davanti per il viso) — dondolano
    this.capelli = gruppo(0, c.y + 0.12, 0);
    this.capelli.rotation.order = 'YXZ';
    // il caschetto: aperto davanti (il viso), con le punte un po' all'infuori
    // e qualche "ciocca" (piccole onde nel raggio) che il pittore ripassa a inchiostro
    const geoCap = tornio([[0.19, 0.0], [0.221, -0.05], [0.235, -0.12], [0.233, -0.19], [0.222, -0.24], [0.226, -0.268], [0.21, -0.28], [0.195, -0.25]], 72, 1.3, Math.PI * 2 - 2.6);
    {
      const p = geoCap.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z), phi = Math.atan2(x, z);
        const basso = clamp(-y / 0.27, 0, 1);
        // davanti le ciocche si stringono verso le guance
        const davanti = Math.max(0, Math.cos(phi)) ;
        const r2 = r * (1 - davanti * 0.07 * basso) + Math.sin(phi * 15) * 0.004 * basso;
        p.setXYZ(i, Math.sin(phi) * r2, y, Math.cos(phi) * r2);
      }
      geoCap.computeVertexNormals();
    }
    // ciocche dipinte: righine un po' più scure che scendono
    const caschetto = pezzo(geoCap, (x, y, z) => {
      const phi = Math.atan2(x, z), k = 0.93 + 0.07 * Math.sin(phi * 21 + y * 8) - (y < -0.24 ? 0.05 : 0);
      return [COL.capelli[0] * k, COL.capelli[1] * k, COL.capelli[2] * k];
    }, true);
    caschetto.scale.set(1.05, 1, 1.02);
    this.capelli.add(caschetto);
    this.testa.add(this.capelli);
    // il cappellino bianco a campana con il nastro rosa
    this.cappello = gruppo(0, c.y + 0.065, 0);
    this.cappello.rotation.x = -0.1;
    const cupola = pezzo(tornio([[0, 0.212], [0.085, 0.206], [0.155, 0.182], [0.202, 0.138], [0.228, 0.08], [0.236, 0.03], [0.24, -0.002], [0.272, -0.018], [0.31, -0.038], [0.318, -0.05], [0.296, -0.048], [0.236, -0.022]], 32), COL.cappello, true);
    const nastro = pezzo(new THREE.CylinderGeometry(0.236, 0.243, 0.055, 32, 1, true), COL.nastro, true);
    nastro.position.y = 0.03;
    this.cappello.add(cupola, nastro);
    this.testa.add(this.cappello);

    // --- stato ---
    this.pos = new THREE.Vector3(-9, MARCIAPIEDE, -1.75);
    this.angolo = Math.PI / 2;        // guarda verso +x
    this.verso = 1;                   // +1 cammina verso +x, -1 verso -x
    this.vel = 0;
    this.fase = 0;
    this.stato = 'cammina';
    this.timer = 0;
    this.prossimaSosta = 9;
    this.salto = null;                // il salto di gioia in corso
    this.mira = new Molla(0);         // 0 = bastone in giù, 1 = bastone puntato
    this.miraPunto = new THREE.Vector3();
    this.miraTempo = 0;
    this.guardaPunto = null; this.guardaTempo = 0;
    this.testaYaw = new Elastico(60, 11); this.testaPitch = new Elastico(60, 11);
    this.capX = new Elastico(90, 5); this.capZ = new Elastico(90, 5);
    this.altezza = new Molla(MARCIAPIEDE);
    this.battito = 2; this.chiusi = 0;
    this.felice = 0;
    this.ultimoPasso = 0; this.ultimoToc = 0;
    this.suToc = null;               // chi vuole sapere dei "toc" del bastone
    this.suPasso = null;
    this._v = new THREE.Vector3(); this._q = new THREE.Quaternion();
    this.velPrima = 0;
  }

  /** Il bambino ha toccato Lia: salto di gioia con giravolta! */
  gioia() {
    if (this.salto && this.salto.t < 0.6) return;
    this.salto = { t: 0, durata: 1.25, giro: Math.random() < 0.7 };
    this.felice = 2.5;
  }
  /** Punta il bastone verso un punto (la magia parte dalla punta). */
  punta(p, durata = 1.1) { this.miraPunto.copy(p); this.miraTempo = durata; this.guarda(p, durata + 0.5); }
  /** Gira la testa verso un punto (un suono, una magia). */
  guarda(p, durata = 1.5) { this.guardaPunto = (this.guardaPunto || new THREE.Vector3()).copy(p); this.guardaTempo = durata; }
  /** Dov'è la punta del bastone (nel mondo). */
  puntaBacchetta(v = new THREE.Vector3()) { this.puntaBastone.updateWorldMatrix(true, false); return v.setFromMatrixPosition(this.puntaBastone.matrixWorld); }
  centroTesta(v = new THREE.Vector3()) { return v.set(this.pos.x, this.pos.y + 0.83 + (this.salto ? this.corpo.position.y : 0), this.pos.z); }
  manoSinistra(v = new THREE.Vector3()) { this.braccia[0].children[2].updateWorldMatrix(true, false); return v.setFromMatrixPosition(this.braccia[0].children[2].matrixWorld); }

  aggiorna(dt, t, mondo) {
    // ---------- 1. IL PILOTA AUTOMATICO: dove vado? ----------
    let velVoluta = 0;
    this.timer -= dt;
    if (this.salto) velVoluta = 0;
    else if (this.stato === 'cammina') {
      velVoluta = 0.55;
      const limite = 17;
      if ((this.verso > 0 && this.pos.x > limite) || (this.verso < 0 && this.pos.x < -limite)) { this.stato = 'gira'; this.verso *= -1; this.timer = 1.4; }
      this.prossimaSosta -= dt;
      if (this.prossimaSosta < 0) {
        this.stato = 'sosta'; this.timer = caso(2.4, 3.6); this.prossimaSosta = caso(11, 17);
        this.sosta = Math.random() < 0.55 ? 'bussa' : 'ascolta';
        this.bussato = false;
      }
    } else if (this.stato === 'gira') {
      velVoluta = 0.12;
      if (this.timer < 0) this.stato = 'cammina';
    } else if (this.stato === 'sosta') {
      velVoluta = 0;
      if (this.sosta === 'bussa' && !this.bussato && this.timer < 1.6) {
        // si gira verso il muro e lo tocca col bastone: il muro si colora
        this.bussato = true;
        const p = new THREE.Vector3(this.pos.x + this.verso * 0.4, 0.5, ZF + 0.02);
        this.punta(p, 1.0);
        if (this.suBussa) this.suBussa(p);
      }
      if (this.timer < 0) this.stato = 'cammina';
    }
    this.vel = lerp(this.vel, velVoluta, 1 - Math.exp(-dt * 4));
    // la direzione: verso dove cammina (o un po' verso il muro quando bussa)
    let angoloVoluto = this.verso > 0 ? Math.PI / 2 : -Math.PI / 2;
    if (this.stato === 'sosta' && this.sosta === 'bussa') angoloVoluto += this.verso * -0.9;
    this.angolo += diffAngolo(this.angolo, angoloVoluto) * (1 - Math.exp(-dt * 3));
    this.pos.x += Math.sin(this.angolo) * this.vel * dt;
    this.pos.z += (-1.75 + Math.sin(t * 0.21) * 0.15 - this.pos.z) * dt * 0.5;
    this.pos.y = this.altezza.segui(mondo.altezza(this.pos.x, this.pos.z), dt, 12);

    // ---------- 2. IL PASSO ----------
    const v = clamp(this.vel / 0.55, 0, 1);
    const passoPrima = this.fase;
    this.fase += dt * (this.vel / 0.22) * Math.PI + dt * (this.stato === 'gira' ? 6 : 0);
    // un passo ogni mezzo giro di fase: suono del passo e "toc" del bastone
    if (Math.floor(this.fase / Math.PI) !== Math.floor(passoPrima / Math.PI) && v > 0.2) {
      if (this.suPasso) this.suPasso(Math.floor(this.fase / Math.PI) % 2);
      if (this.suToc && !this.salto && this.miraTempo <= 0) { this.puntaBacchetta(this._v); this.suToc(this._v.clone()); }
    }
    const s = Math.sin(this.fase), cs = Math.cos(this.fase);
    this.gambe[0].rotation.x = s * 0.55 * v;
    this.gambe[1].rotation.x = -s * 0.55 * v;
    this.gambe[0].position.y = 0.34 + Math.max(0, -cs) * 0.025 * v;
    this.gambe[1].position.y = 0.34 + Math.max(0, cs) * 0.025 * v;

    // ---------- 3. IL SALTO DI GIOIA (schiaccia e allunga) ----------
    let saltoY = 0, schiaccia = 0, giro = 0, bracciaSu = 0;
    if (this.salto) {
      const S = this.salto; S.t += dt;
      const u = S.t;
      if (u < 0.16) schiaccia = -0.16 * morbido(0, 0.16, u);                      // si accuccia (prende la rincorsa)
      else if (u < 0.62) {                                                           // in volo
        const k = (u - 0.16) / 0.46;
        saltoY = 4 * k * (1 - k) * 0.34;
        schiaccia = 0.14 * (1 - k * 1.6);
        bracciaSu = 1;
        if (S.giro) giro = morbido(0, 1, k) * Math.PI * 2;
      } else if (u < 0.8) { schiaccia = -0.15 * Math.sin((u - 0.62) / 0.18 * Math.PI); bracciaSu = 1 - (u - 0.62) / 0.18; }   // atterra
      else bracciaSu = 0;
      if (S.t > S.durata) this.salto = null;
    }
    this.felice = Math.max(0, this.felice - dt);

    // ---------- 4. IL CORPO ----------
    const bob = Math.abs(cs) * 0.018 * v;
    this.corpo.position.y = bob + saltoY;
    const sy = 1 + schiaccia - Math.abs(s) * 0.025 * v;
    this.corpo.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));      // il volume resta uguale
    this.corpo.rotation.z = s * 0.055 * v;                               // dondola come un pinguino
    this.corpo.rotation.x = 0.05 * v;
    this.vestito.rotation.y = Math.sin(this.fase * 0.5) * 0.08 * v;
    this.vestito.scale.set(1 + Math.sin(this.fase * 2) * 0.025 * v, 1, 1 + Math.sin(this.fase * 2) * 0.025 * v);
    this.radice.position.copy(this.pos);
    this.radice.rotation.y = this.angolo + giro;
    this.ombra.position.set(this.pos.x, this.pos.y + 0.012, this.pos.z);
    const so = 1 - saltoY * 1.2;
    this.ombra.scale.set(0.3 * so, 1, 0.26 * so);

    // ---------- 5. LE BRACCIA (e il bastone) ----------
    this.miraTempo -= dt;
    const mira = this.mira.segui(this.miraTempo > 0 ? 1 : 0, dt, 9);
    const sx = this.braccia[0], dx = this.braccia[1];
    // braccio sinistro: dondola (tiene il guinzaglio un po' in avanti)
    sx.rotation.set(lerp(-0.35 - s * 0.35 * v, -2.7, bracciaSu), 0, lerp(-0.2, -0.5, bracciaSu));
    // braccio destro: il bastone spazza davanti a lei, a destra e a sinistra
    const spazza = s * 0.38 * v, alza = Math.abs(cs) * 0.12 * v;
    let rx = -0.72 + alza, ry = spazza + 0.12, rz = 0.08;
    if (mira > 0.001) {
      // punta il bastone verso il bersaglio (calcolato nello spazio del corpo)
      this.radice.updateWorldMatrix(true, true);
      const loc = this._v.copy(this.miraPunto);
      dx.parent.worldToLocal(loc);
      loc.sub(dx.position).normalize();
      const beta = Math.acos(clamp(-loc.y, -1, 1));
      rx = lerp(rx, -beta, mira); ry = lerp(ry, Math.atan2(loc.x, loc.z), mira); rz = lerp(rz, 0, mira);
    }
    dx.rotation.set(lerp(rx, -2.7, bracciaSu * (1 - mira)), ry, lerp(rz, 0.5, bracciaSu * (1 - mira)));

    // ---------- 6. LA TESTA: guarda dove succede qualcosa ----------
    this.guardaTempo -= dt;
    let yaw = Math.sin(t * 0.37) * 0.25 + Math.sin(t * 0.13) * 0.2, pitch = 0.05;   // ascolta in giro
    if (this.stato === 'sosta' && this.sosta === 'ascolta') { yaw = Math.sin(t * 0.8) * 0.6; pitch = -0.25; }
    if (this.guardaTempo > 0 && this.guardaPunto) {
      const loc = this._v.copy(this.guardaPunto);
      this.collo.updateWorldMatrix(true, false);
      this.collo.worldToLocal(loc);
      yaw = clamp(Math.atan2(loc.x, loc.z), -1.1, 1.1);
      pitch = clamp(-Math.atan2(loc.y - 0.2, Math.hypot(loc.x, loc.z)), -0.6, 0.4);
    }
    if (bracciaSu > 0) pitch = -0.35;
    const ty = this.testaYaw.aggiorna(yaw, dt), tp = this.testaPitch.aggiorna(pitch, dt);
    this.testa.rotation.set(tp + cs * 0.03 * v, ty, -this.corpo.rotation.z * 0.7);
    // capelli: in ritardo rispetto alla testa (molle elastiche)
    const accY = (this.corpo.position.y - (this._yPrima || 0)) / Math.max(dt, 1e-3);
    this._yPrima = this.corpo.position.y;
    this.capX.spinta(-accY * 0.08 * dt * 60 * 0.02);
    this.capelli.rotation.x = this.capX.aggiorna(-tp * 0.25 + this.vel * 0.05, dt);
    this.capelli.rotation.z = this.capZ.aggiorna(-this.corpo.rotation.z * 0.8 - (ty - this.testaYaw.x) * 0.3, dt);
    this.capelli.rotation.y = -(this.testaYaw.v) * 0.04;
    this.cappello.rotation.z = -this.capelli.rotation.z * 0.15;

    // ---------- 7. LA FACCIA: palpebre e bocca ----------
    this.battito -= dt;
    if (this.battito < 0) { this.chiusi = 0.13; this.battito = caso(1.8, 4.5); }
    this.chiusi -= dt;
    const felice = this.felice > 0 ? 1 : 0;
    const apertura = this.chiusi > 0 ? 0.12 : (felice ? 0.45 : 1);
    for (const o of this.occhi) o.scale.y = lerp(o.scale.y, apertura, 1 - Math.exp(-dt * 30));
    const bocca = felice ? 1 : 0.01;
    this.bocca.scale.y = lerp(this.bocca.scale.y, bocca, 1 - Math.exp(-dt * 12));
    this.sorriso.visible = this.bocca.scale.y < 0.3;
    this.bocca.scale.x = lerp(this.bocca.scale.x, felice ? 1.25 : 1, 1 - Math.exp(-dt * 12));
  }
}

/* ========================================================================== */
/*  GOGO                                                                      */
/* ========================================================================== */
export class Gogo {
  constructor(scena) {
    this.radice = new THREE.Group();
    scena.add(this.radice);
    this.ombra = ombraSotto(scena, 0.26, 0.4);
    this.corpo = gruppo(0, 0.32, 0);
    this.radice.add(this.corpo);
    // il corpo: crema con una macchia caramello sulla schiena
    const torso = pezzo(new THREE.CapsuleGeometry(0.115, 0.25, 8, 20), (x, y, z) => {
      const macchia = (y + 0.05) > 0.0 && Math.hypot(x * 1.2, (y - 0.06) * 0.8, z + 0.02) < 0.13 && z < 0.1;
      return macchia && y > -0.02 ? COL.caramello : COL.cane;
    });
    torso.rotation.x = Math.PI / 2;
    this.corpo.add(torso);
    const petto = pezzo(new THREE.SphereGeometry(0.105, 16, 12), COL.caneChiaro);
    petto.position.set(0, -0.01, 0.15); petto.scale.set(1, 1.06, 0.9);
    this.corpo.add(petto);
    // le zampe
    this.zampe = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => {
      const g = gruppo(sx * 0.072, -0.04, sz * 0.16);
      const gamba = pezzo(new THREE.CapsuleGeometry(0.034, 0.15, 4, 8), COL.cane);
      gamba.position.y = -0.11;
      const piede = pezzo(new THREE.SphereGeometry(0.043, 12, 8), COL.caneChiaro);
      piede.scale.set(1, 0.62, 1.3); piede.position.set(0, -0.235, 0.015);
      g.add(gamba, piede);
      this.corpo.add(g);
      return g;
    });
    // la coda: tre pezzi a catena, ognuno con la sua molla
    this.coda = [];
    let padre = gruppo(0, 0.05, -0.25);
    padre.rotation.x = -0.9;
    this.corpo.add(padre);
    for (let k = 0; k < 4; k++) {
      const seg = gruppo(0, k ? 0.065 : 0, 0);
      const ciuffo = pezzo(new THREE.SphereGeometry(0.046 - k * 0.004 + (k === 3 ? 0.012 : 0), 12, 8), k === 3 ? COL.caneChiaro : COL.cane);
      ciuffo.scale.set(0.9, 1.35, 0.9); ciuffo.position.y = 0.035;
      seg.add(ciuffo);
      padre.add(seg);
      this.coda.push({ g: seg, molla: new Elastico(120 - k * 20, 7) });
      padre = seg;
    }
    // collo e testa
    this.collo = gruppo(0, 0.07, 0.2);
    this.collo.rotation.order = 'YXZ';
    this.corpo.add(this.collo);
    this.testa = gruppo(0, 0.12, 0.03);
    this.testa.rotation.order = 'YXZ';
    this.collo.add(this.testa);
    const cranio = pezzo(new THREE.SphereGeometry(0.125, 24, 18), COL.cane);
    cranio.scale.set(1, 0.94, 1.03);
    const muso = pezzo(new THREE.SphereGeometry(0.075, 16, 12), COL.caneChiaro);
    muso.position.set(0, -0.04, 0.105); muso.scale.set(0.92, 0.72, 1.3);
    const naso = pezzo(new THREE.SphereGeometry(0.028, 12, 8), COL.naso);
    naso.position.set(0, -0.012, 0.2); naso.scale.set(1.2, 0.85, 0.9);
    this.lingua = pezzo(new THREE.CapsuleGeometry(0.022, 0.03, 3, 8), COL.lingua);
    this.lingua.position.set(0, -0.085, 0.15); this.lingua.rotation.x = 0.4; this.lingua.scale.set(1.2, 1, 0.5);
    this.testa.add(cranio, muso, naso, this.lingua);
    this.occhi = [-1, 1].map((s) => {
      const o = occhio(0.042);
      sullaSfera(o, new THREE.Vector3(0, 0, 0), 0.118, [s * 0.4, 0.33, 0.84], -0.008);
      this.testa.add(o);
      return o;
    });
    // le orecchie lunghe e morbide (caramello), con molle
    this.orecchie = [-1, 1].map((s) => {
      const g = gruppo(s * 0.098, 0.065, -0.015);
      g.rotation.order = 'YXZ';
      const o = pezzo(new THREE.CapsuleGeometry(0.048, 0.13, 6, 12), COL.caramello);
      o.scale.set(1, 1, 0.38); o.position.set(s * 0.02, -0.09, 0); o.rotation.z = s * 0.15;
      g.add(o);
      this.testa.add(g);
      return { g, s, x: new Elastico(70, 4.5), z: new Elastico(70, 4.5) };
    });
    // il collare azzurro con la medaglietta
    const collare = pezzo(new THREE.TorusGeometry(0.088, 0.017, 8, 24), COL.collare);
    collare.rotation.x = Math.PI / 2 + 0.5; collare.position.set(0, 0.03, 0.0);
    const medaglia = pezzo(new THREE.SphereGeometry(0.022, 10, 8), COL.oro);
    medaglia.position.set(0, -0.035, 0.085); medaglia.scale.set(1, 1, 0.5);
    this.anello = gruppo(0, 0.04, 0.06);
    this.collo.add(collare, medaglia, this.anello);

    // il guinzaglio (un tubicino che si piega)
    this.guinzaglio = new Guinzaglio(scena);

    // --- stato ---
    this.pos = new THREE.Vector3(-7.8, 0.14, -1.2);
    this.angolo = Math.PI / 2;
    this.vel = 0;
    this.fase = 0;
    this.stato = 'guinzaglio';
    this.timer = caso(8, 12);
    this.meta = new THREE.Vector3();
    this.salto = null;
    this.felice = 0;
    this.annusa = new Molla(0);
    this.altezza = new Molla(0.14);
    this.testaYaw = new Elastico(50, 9); this.testaPitch = new Elastico(50, 9);
    this.velPrima = 0;
    this.battito = 3; this.chiusi = 0;
    this.suAbbaio = null;
    this._v = new THREE.Vector3();
  }

  gioia() {
    if (this.salto && this.salto.t < 0.5) return;
    this.salto = { t: 0, durata: 1.1, giro: Math.random() < 0.6 };
    this.felice = 3;
    if (this.suAbbaio) this.suAbbaio(this.pos.clone(), false);
  }
  centro(v = new THREE.Vector3()) { return v.set(this.pos.x, this.pos.y + 0.42, this.pos.z); }

  aggiorna(dt, t, mondo, lia) {
    this.timer -= dt;
    const direzioneLia = lia.verso;
    let velMax = 2.2, meta = this.meta;
    // ---------- IL CERVELLO DI GOGO ----------
    if (this.stato === 'guinzaglio') {
      // trotterella un passo avanti a Lia, dalla parte della strada
      meta.set(lia.pos.x + direzioneLia * (1.0 + Math.sin(t * 0.5) * 0.25), 0, lia.pos.z + 0.65 + Math.sin(t * 0.31) * 0.2);
      if (this.timer < 0 && !lia.salto) {
        // scappa ad annusare qualcosa di interessante lì vicino
        const vicine = mondo.curiosita.filter((c) => Math.abs(c.x - lia.pos.x - direzioneLia * 3) < 6 && c.z < 8.3);
        if (vicine.length) {
          const c = vicine[Math.floor(Math.random() * vicine.length)];
          this.stato = 'esplora';
          this.meta.set(c.x + caso(-0.3, 0.3), 0, clamp(c.z + (c.z < 0 ? 0.55 : -0.6), ZF + 0.45, 7.9));
          this.timer = 9;
        } else this.timer = 3;
      }
    } else if (this.stato === 'esplora') {
      velMax = 2.9;
      const d = Math.hypot(meta.x - this.pos.x, meta.z - this.pos.z);
      if (d < 0.25 || this.timer < 0) { this.stato = 'annusa'; this.timer = caso(1.8, 2.8); this.abbaiato = false; }
    } else if (this.stato === 'annusa') {
      velMax = 0;
      if (!this.abbaiato && this.timer < 0.7) {
        this.abbaiato = true;
        if (this.suAbbaio) this.suAbbaio(this.pos.clone(), true);
        this.salto = { t: 0, durata: 0.5, giro: false, piccolo: true };
      }
      if (this.timer < 0) { this.stato = 'ritorna'; this.timer = 10; }
    } else if (this.stato === 'ritorna') {
      velMax = 3.0;
      meta.set(lia.pos.x + direzioneLia * 0.9, 0, lia.pos.z + 0.6);
      if (Math.hypot(meta.x - this.pos.x, meta.z - this.pos.z) < 0.5 || this.timer < 0) {
        this.stato = 'guinzaglio'; this.timer = caso(12, 20);
        this.salto = { t: 0, durata: 0.7, giro: false, piccolo: true }; this.felice = 1.5;
      }
    }
    // ---------- IL MOVIMENTO ----------
    const dx = meta.x - this.pos.x, dz = meta.z - this.pos.z, dist = Math.hypot(dx, dz);
    let velVoluta = this.salto && !this.salto.piccolo ? 0 : clamp((dist - 0.12) * 2.4, 0, velMax);
    if (this.stato === 'guinzaglio' && dist < 0.35) velVoluta = 0;
    this.vel = lerp(this.vel, velVoluta, 1 - Math.exp(-dt * (velVoluta > this.vel ? 3.5 : 5)));
    if (dist > 0.1 && this.vel > 0.05) {
      const ang = Math.atan2(dx, dz);
      this.angolo += diffAngolo(this.angolo, ang) * (1 - Math.exp(-dt * 6));
    } else if (this.stato === 'guinzaglio') {
      // fermo: si gira verso Lia
      this.angolo += diffAngolo(this.angolo, Math.atan2(lia.pos.x - this.pos.x, lia.pos.z - this.pos.z)) * (1 - Math.exp(-dt * 2));
    }
    this.pos.x += Math.sin(this.angolo) * this.vel * dt;
    this.pos.z += Math.cos(this.angolo) * this.vel * dt;
    this.pos.z = clamp(this.pos.z, ZF + 0.4, 8.3);
    this.pos.y = this.altezza.segui(mondo.altezza(this.pos.x, this.pos.z), dt, 14);
    const acc = (this.vel - this.velPrima) / Math.max(dt, 1e-3);
    this.velPrima = this.vel;

    // ---------- LE ZAMPE: trotto o galoppo ----------
    const corsa = clamp((this.vel - 1.3) / 1.0, 0, 1);       // 0 = trotto, 1 = galoppo
    this.fase += dt * (this.vel / (0.3 + corsa * 0.25)) * Math.PI * 2 * 0.5;
    const ampiezza = clamp(this.vel / 1.0, 0, 1) * (0.55 + corsa * 0.25);
    const fasi = [[0, Math.PI, Math.PI, 0], [0, 0.5, Math.PI, Math.PI + 0.5]];
    for (let k = 0; k < 4; k++) {
      const f = lerp(fasi[0][k], fasi[1][k], corsa);
      this.zampe[k].rotation.x = Math.sin(this.fase + f) * ampiezza;
      this.zampe[k].position.y = -0.04 + Math.max(0, Math.cos(this.fase + f)) * 0.03 * ampiezza;
    }

    // ---------- IL SALTO (e la giravolta) ----------
    let saltoY = 0, schiaccia = 0, giro = 0;
    if (this.salto) {
      const S = this.salto; S.t += dt;
      const alto = S.piccolo ? 0.12 : 0.36, tSu = S.piccolo ? 0.08 : 0.14, tVolo = S.piccolo ? 0.3 : 0.5;
      if (S.t < tSu) schiaccia = -0.18 * morbido(0, tSu, S.t);
      else if (S.t < tSu + tVolo) { const k = (S.t - tSu) / tVolo; saltoY = 4 * k * (1 - k) * alto; schiaccia = 0.15 * (1 - 1.7 * k); if (S.giro) giro = morbido(0, 1, k) * Math.PI * 2; }
      else if (S.t < tSu + tVolo + 0.16) schiaccia = -0.16 * Math.sin((S.t - tSu - tVolo) / 0.16 * Math.PI);
      if (S.t > S.durata) this.salto = null;
    }
    this.felice = Math.max(0, this.felice - dt);
    const felice = this.felice > 0 || this.stato === 'ritorna';

    // ---------- IL CORPO ----------
    const s = Math.sin(this.fase), cs = Math.cos(this.fase);
    const bob = Math.abs(cs) * 0.022 * ampiezza + corsa * Math.sin(this.fase) * 0.03;
    this.corpo.position.y = 0.32 + bob + saltoY;
    const sy = 1 + schiaccia;
    this.corpo.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
    this.corpo.rotation.x = -corsa * Math.cos(this.fase) * 0.14 - clamp(acc * 0.03, -0.12, 0.12) - (saltoY > 0 ? (this.salto && this.salto.t < 0.4 ? -0.25 : 0.2) * saltoY : 0);
    this.corpo.rotation.z = s * 0.04 * ampiezza * (1 - corsa);
    this.radice.position.copy(this.pos);
    this.radice.rotation.y = this.angolo + giro;
    this.ombra.position.set(this.pos.x, this.pos.y + 0.012, this.pos.z);
    this.ombra.rotation.y = this.angolo;
    const so = 1 - saltoY;
    this.ombra.scale.set(0.24 * so, 1, 0.42 * so);

    // ---------- LA TESTA ----------
    const naso = this.annusa.segui(this.stato === 'annusa' ? 1 : 0, dt, 5);
    let yaw = 0, pitch = 0.1 - corsa * 0.2;
    if (this.stato === 'guinzaglio' && this.vel < 0.3) {
      const loc = this._v.set(lia.pos.x, lia.pos.y + 0.8, lia.pos.z);
      this.collo.updateWorldMatrix(true, false);
      this.collo.worldToLocal(loc);
      yaw = clamp(Math.atan2(loc.x, loc.z), -1.0, 1.0); pitch = -0.35;
    } else yaw = Math.sin(t * 0.9) * 0.25;
    pitch = lerp(pitch, 0.75 + Math.sin(t * 18) * 0.05, naso);           // naso a terra che annusa
    this.collo.rotation.set(this.testaPitch.aggiorna(pitch, dt) * 0.5, this.testaYaw.aggiorna(yaw, dt) * 0.5, 0);
    this.testa.rotation.set(this.testaPitch.x * 0.5 + cs * 0.06 * ampiezza, this.testaYaw.x * 0.5, Math.sin(t * 1.3) * 0.05);
    // orecchie: volano all'indietro quando corre, rimbalzano a ogni passo
    const vy = (this.corpo.position.y - (this._yPrima || 0.32)) / Math.max(dt, 1e-3);
    this._yPrima = this.corpo.position.y;
    for (const o of this.orecchie) {
      o.x.spinta(vy * 0.3 * dt * 60 * 0.05);
      o.g.rotation.x = o.x.aggiorna(-this.vel * 0.35 - naso * 0.3, dt);
      o.g.rotation.z = o.z.aggiorna(o.s * (0.12 + corsa * 0.35 + saltoY * 1.5), dt);
    }
    // coda: scodinzola (più veloce quando è felice)
    const scod = felice ? 1 : 0.45;
    const freq = felice ? 15 : 7;
    this.coda.forEach((c, k) => {
      const bersaglio = Math.sin(t * freq - k * 0.7) * 0.45 * scod;
      c.g.rotation.z = c.molla.aggiorna(bersaglio, dt);
      c.g.rotation.x = -0.12 - corsa * 0.15 + (k === 0 ? -0.1 * this.vel : 0);
    });
    // occhi e lingua
    this.battito -= dt;
    if (this.battito < 0) { this.chiusi = 0.12; this.battito = caso(2, 5); }
    this.chiusi -= dt;
    for (const o of this.occhi) o.scale.y = lerp(o.scale.y, this.chiusi > 0 ? 0.12 : (this.felice > 0 ? 0.6 : 1), 1 - Math.exp(-dt * 30));
    const lingua = felice || this.vel > 1.5 ? 1 : 0;
    this.lingua.scale.y = lerp(this.lingua.scale.y, lingua ? 1.3 : 0.01, 1 - Math.exp(-dt * 10));
    this.lingua.visible = this.lingua.scale.y > 0.05;

    // ---------- IL GUINZAGLIO ----------
    const legato = this.stato === 'guinzaglio' && Math.hypot(lia.pos.x - this.pos.x, lia.pos.z - this.pos.z) < 2.6;
    this.anello.updateWorldMatrix(true, false);
    this.guinzaglio.aggiorna(lia.manoSinistra(), this._v.setFromMatrixPosition(this.anello.matrixWorld), legato, dt);
  }
}

/* ------------------------------------------------------------------------ */
/*  IL GUINZAGLIO: un tubicino che pende (si ricalcola a ogni fotogramma)    */
/* ------------------------------------------------------------------------ */
class Guinzaglio {
  constructor(scena) {
    this.N = 16; this.R = 4;
    const nv = this.N * this.R;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(nv * 3); this.nor = new Float32Array(nv * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3));
    const col = new Float32Array(nv * 3);
    for (let i = 0; i < nv; i++) col.set(COL.guinzaglio, i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const ind = [];
    for (let i = 0; i < this.N - 1; i++) for (let j = 0; j < this.R; j++) {
      const a = i * this.R + j, b = i * this.R + (j + 1) % this.R, c = a + this.R, d = b + this.R;
      ind.push(a, c, b, b, c, d);
    }
    geo.setIndex(ind);
    this.mesh = new THREE.Mesh(geo, MAT);
    this.mesh.frustumCulled = false;
    scena.add(this.mesh);
    this.tensione = 0;
    this.visibile = 0;
  }
  aggiorna(a, b, legato, dt) {
    this.visibile = lerp(this.visibile, legato ? 1 : 0, 1 - Math.exp(-dt * 8));
    this.mesh.visible = this.visibile > 0.05;
    if (!this.mesh.visible) return;
    const d = a.distanceTo(b);
    const pend = Math.max(0, 1.7 - d) * 0.35 + 0.03;              // più vicini = più pende
    const p = new THREE.Vector3(), t = new THREE.Vector3(), u = new THREE.Vector3(), w = new THREE.Vector3(), su = new THREE.Vector3(0, 1, 0);
    const punti = [];
    for (let i = 0; i < this.N; i++) {
      const k = i / (this.N - 1);
      p.lerpVectors(a, b, k);
      p.y -= 4 * k * (1 - k) * pend;
      punti.push(p.clone());
    }
    const r = 0.008 * this.visibile;
    for (let i = 0; i < this.N; i++) {
      t.subVectors(punti[Math.min(this.N - 1, i + 1)], punti[Math.max(0, i - 1)]).normalize();
      u.crossVectors(t, su).normalize(); w.crossVectors(u, t).normalize();
      for (let j = 0; j < this.R; j++) {
        const ang = j / this.R * Math.PI * 2, c = Math.cos(ang), s = Math.sin(ang);
        const nx = u.x * c + w.x * s, ny = u.y * c + w.y * s, nz = u.z * c + w.z * s;
        const q = (i * this.R + j) * 3;
        this.pos[q] = punti[i].x + nx * r; this.pos[q + 1] = punti[i].y + ny * r; this.pos[q + 2] = punti[i].z + nz * r;
        this.nor[q] = nx; this.nor[q + 1] = ny; this.nor[q + 2] = nz;
      }
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.normal.needsUpdate = true;
  }
}
