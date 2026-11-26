/* ==========================================================================
 *  magia.js — LA MAGIA DEI TOCCHI
 *  --------------------------------------------------------------------------
 *  Ogni volta che il bambino tocca lo schermo succede qualcosa di bello:
 *    1. subito, sotto il dito, uno sbuffo di stelline (risposta immediata!);
 *    2. Lia punta il bastone e ne parte una COMETA di luce;
 *    3. dove arriva la cometa parte l'ONDA DI COLORE: l'acquerello si
 *       allarga sulle superfici vere del mondo (strada, muri, alberi...);
 *    4. e poi una MERAVIGLIA diversa secondo che cosa è stato toccato:
 *       fiori che sbocciano dal suolo o dai muri, farfalle, uccellini che
 *       volano via, bolle di sapone, stelle, nastri colorati, l'arcobaleno.
 *  Toccare Lia o Gogo li fa saltare di gioia (con i cuoricini).
 *  Trascinare il dito "dipinge" una scia.
 *
 *  Tutti gli effetti usano "piscine" (pool) di oggetti già pronti: niente
 *  oggetti nuovi durante il gioco = niente scatti.
 * ========================================================================== */
import * as THREE from 'three';
import { Audio } from '../../js/gioco/audio.js';
import { materialePigmento, materialePunti, materialeBolle, materialeNastro, U } from './acquerello3d.js';
import { Costruttore, TIPI, matrice } from './geometria.js';
import { caso, scegli, clamp, lerp, morbido, PI2 } from './utili.js';
import { ZF } from './mondo.js';

const PASTELLI = [[1.0, 0.80, 0.36], [0.99, 0.60, 0.74], [0.56, 0.80, 1.0], [0.58, 0.90, 0.70], [0.78, 0.66, 0.98], [1.0, 0.70, 0.48]];
const ORO = [1.0, 0.84, 0.42];
const COLORI_FIORI = [[0.98, 0.50, 0.56], [0.99, 0.72, 0.84], [1.0, 0.99, 0.96], [0.99, 0.86, 0.40], [0.80, 0.66, 0.97], [0.99, 0.62, 0.42], [0.62, 0.78, 1.0]];
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _m = new THREE.Matrix4(), _c = new THREE.Color();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const SU = new THREE.Vector3(0, 1, 0);
/** Un'elastica che "rimbalza" un po' oltre 1 prima di fermarsi (per far sbocciare le cose). */
const elastica = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -9 * t) * Math.cos(t * 9.5));

/* ------------------------------------------------------------------------ */
/*  SCINTILLE: stelline, cuori, puntini, anelli, petali                      */
/* ------------------------------------------------------------------------ */
class Scintille {
  constructor(scena, N = 1000) {
    this.N = N;
    this.pos = new Float32Array(N * 3); this.col = new Float32Array(N * 4); this.ext = new Float32Array(N * 3);
    this.vel = new Float32Array(N * 3); this.vita = new Float32Array(N); this.durata = new Float32Array(N);
    this.dim = new Float32Array(N); this.grav = new Float32Array(N); this.attr = new Float32Array(N); this.rotV = new Float32Array(N);
    this.alfa = new Float32Array(N); this.scintilla = new Float32Array(N);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColore', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aExtra', new THREE.BufferAttribute(this.ext, 3).setUsage(THREE.DynamicDrawUsage));
    this.mat = materialePunti();
    this.punti = new THREE.Points(g, this.mat);
    this.punti.frustumCulled = false;
    this.punti.renderOrder = 5;
    this.punti.layers.enable(1);           // anche nel passo "luce" (bagliori)
    scena.add(this.punti);
    this.prossimo = 0;
  }
  /** Lancia una scintilla. o: { p, v, colore, forma, vita, dim, grav, attr, rot, alfa, brilla } */
  emetti(o) {
    // cerca un posto libero (girando in tondo)
    let i = this.prossimo;
    for (let k = 0; k < this.N; k++) { const j = (this.prossimo + k) % this.N; if (this.vita[j] <= 0) { i = j; break; } }
    this.prossimo = (i + 1) % this.N;
    this.pos.set([o.p.x, o.p.y, o.p.z], i * 3);
    this.vel.set(o.v ? [o.v.x, o.v.y, o.v.z] : [0, 0, 0], i * 3);
    const c = o.colore || ORO;
    this.col.set([c[0], c[1], c[2], 0], i * 4);
    this.ext.set([0, o.forma || 0, o.rot !== undefined ? o.rot : caso(0, PI2)], i * 3);
    this.vita[i] = this.durata[i] = o.vita || 1.2;
    this.dim[i] = o.dim || 0.08; this.grav[i] = o.grav !== undefined ? o.grav : -0.4; this.attr[i] = o.attr !== undefined ? o.attr : 1.5;
    this.rotV[i] = o.rotV !== undefined ? o.rotV : caso(-3, 3); this.alfa[i] = o.alfa || 1; this.scintilla[i] = o.brilla ? caso(0, PI2) : -1;
    return i;
  }
  /** Uno sbuffo di stelline in tutte le direzioni. */
  sbuffo(p, quante = 12, forza = 1.6, opz = {}) {
    for (let k = 0; k < quante; k++) {
      _v.set(caso(-1, 1), caso(-0.2, 1), caso(-1, 1)).normalize().multiplyScalar(forza * caso(0.5, 1));
      if (opz.normale) _v.addScaledVector(opz.normale, forza * 0.6);
      this.emetti({ p, v: _v, colore: opz.colore || scegli(PASTELLI), forma: opz.forma !== undefined ? opz.forma : (Math.random() < 0.6 ? 1 : 0), vita: caso(0.7, 1.4) * (opz.vita || 1), dim: caso(0.06, 0.12) * (opz.dim || 1), grav: opz.grav !== undefined ? opz.grav : -1.2, attr: 2.2, brilla: true });
    }
  }
  aggiorna(dt, t) {
    const { pos, vel, col, ext } = this;
    for (let i = 0; i < this.N; i++) {
      if (this.vita[i] <= 0) { if (col[i * 4 + 3] !== 0 || ext[i * 3] !== 0) { col[i * 4 + 3] = 0; ext[i * 3] = 0; } continue; }
      if (this.durata[i] < 1e5) this.vita[i] -= dt;
      const k = Math.exp(-this.attr[i] * dt);
      vel[i * 3] *= k; vel[i * 3 + 1] = vel[i * 3 + 1] * k + this.grav[i] * dt; vel[i * 3 + 2] *= k;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      const eterna = this.durata[i] > 1e5;
      const vita = eterna ? 1 : this.vita[i] / this.durata[i];
      const entra = eterna ? 1 : Math.min(1, (this.durata[i] - this.vita[i]) * 8);
      let a = this.alfa[i] * Math.min(entra, morbido(0, 0.35, vita));
      let d = this.dim[i] * (0.6 + 0.4 * Math.min(1, entra));
      if (this.scintilla[i] >= 0) { const b = 0.75 + 0.25 * Math.sin(t * 14 + this.scintilla[i]); d *= b; }
      col[i * 4 + 3] = a;
      ext[i * 3] = d;
      ext[i * 3 + 2] += this.rotV[i] * dt;
    }
    const g = this.punti.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.aColore.needsUpdate = true; g.attributes.aExtra.needsUpdate = true;
  }
}

/* ------------------------------------------------------------------------ */
/*  FIORI che sbocciano (gambo + petali + bottone), tutti "a istanze"        */
/* ------------------------------------------------------------------------ */
class Fiori {
  constructor(scena, N = 150) {
    this.N = N;
    const mat = materialePigmento({ sempre: true });
    // il gambo con due foglioline (alto 1, poi si scala)
    const B = new Costruttore();
    B.cilindro(0, 0, 0, 0.012, 0.018, 1, [0.45, 0.70, 0.42], { seg: 5 });
    B.sfera(0.045, 0.35, 0, 0.05, [0.52, 0.76, 0.44], { scala: [1, 0.3, 0.55], rot: [0, 0, 0.5], seg: 6, segV: 4 });
    B.sfera(-0.045, 0.55, 0, 0.045, [0.48, 0.73, 0.46], { scala: [1, 0.3, 0.55], rot: [0, 0, -0.5], seg: 6, segV: 4 });
    this.steli = new THREE.InstancedMesh(B.costruisci(), mat, N);
    // la corolla: 6 petali bianchi (il colore lo dà l'istanza)
    const P = new Costruttore();
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * PI2;
      P.sfera(Math.cos(a) * 0.075, 0.0, Math.sin(a) * 0.075, 0.06, [1, 1, 1], { scala: [1.25, 0.32, 0.8], rot: [0, -a, 0.18], seg: 8, segV: 4 });
    }
    this.petali = new THREE.InstancedMesh(P.costruisci(), mat, N);
    const Q = new Costruttore();
    Q.sfera(0, 0.02, 0, 0.042, [1.0, 0.85, 0.36], { scala: [1, 0.7, 1], seg: 8, segV: 5 });
    this.bottoni = new THREE.InstancedMesh(Q.costruisci(), mat, N);
    for (const m of [this.steli, this.petali, this.bottoni]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; scena.add(m); }
    for (let i = 0; i < N; i++) this.petali.setColorAt(i, _c.setRGB(1, 1, 1));
    this.lista = [];
  }
  /** Un fiore che nasce in p e cresce lungo la direzione n. */
  nasci(p, n, opz = {}) {
    if (this.lista.length >= this.N) this.lista.shift();
    const dir = new THREE.Vector3().copy(n).add(new THREE.Vector3(caso(-0.3, 0.3), caso(-0.1, 0.3), caso(-0.3, 0.3))).normalize();
    this.lista.push({ p: p.clone(), dir, h: (opz.alto || 1) * caso(0.16, 0.34), t: -(opz.ritardo || 0), cresci: caso(0.7, 1.0), colore: opz.colore || scegli(COLORI_FIORI), grande: (opz.grande || 1) * caso(0.5, 0.85), fase: caso(0, PI2), muore: -1 });
  }
  aggiorna(dt, t) {
    let k = 0;
    // i più vecchi, se sono troppi, appassiscono piano
    const troppi = Math.max(0, this.lista.length - this.N + 12);
    for (let i = 0; i < troppi; i++) if (this.lista[i].muore < 0) this.lista[i].muore = 1;
    this.lista = this.lista.filter((f) => f.muore < 0 || f.muore > 0.001);
    for (const f of this.lista) {
      f.t += dt;
      if (f.t < 0) continue;
      if (f.muore > 0) f.muore = Math.max(0.001, f.muore - dt * 0.8);
      const g = elastica(clamp(f.t / f.cresci, 0, 1)) * (f.muore > 0 ? f.muore : 1);
      const fioritura = elastica(clamp((f.t - f.cresci * 0.6) / 0.6, 0, 1)) * (f.muore > 0 ? f.muore : 1);
      // il gambo
      const ondeggia = Math.sin(t * 1.8 + f.fase) * 0.08;
      _w.copy(f.dir); _w.x += ondeggia; _w.z += ondeggia * 0.5; _w.normalize();
      _q.setFromUnitVectors(SU, _w);
      const h = f.h * Math.max(0.001, g);
      _m.compose(f.p, _q, _s.set(1, h, 1));
      this.steli.setMatrixAt(k, _m);
      // la corolla in cima, che si apre
      _v.copy(f.p).addScaledVector(_w, h);
      const sc = Math.max(0.001, fioritura * f.grande);
      _m.compose(_v, _q, _s.set(sc, sc, sc));
      this.petali.setMatrixAt(k, _m); this.bottoni.setMatrixAt(k, _m);
      this.petali.setColorAt(k, _c.setRGB(f.colore[0], f.colore[1], f.colore[2]));
      k++;
    }
    for (const m of [this.steli, this.petali, this.bottoni]) { m.count = k; m.instanceMatrix.needsUpdate = true; }
    if (this.petali.instanceColor) this.petali.instanceColor.needsUpdate = true;
  }
}

/* ------------------------------------------------------------------------ */
/*  FARFALLE                                                                 */
/* ------------------------------------------------------------------------ */
class Farfalle {
  constructor(scena, N = 30) {
    this.N = N;
    const mat = materialePigmento({ sempre: true, doppio: true });
    const f = new THREE.Shape();      // l'ala destra: due lobi
    f.moveTo(0, 0); f.bezierCurveTo(0.05, 0.12, 0.2, 0.17, 0.2, 0.06); f.bezierCurveTo(0.2, 0.01, 0.1, -0.01, 0.02, -0.01);
    f.bezierCurveTo(0.12, -0.05, 0.14, -0.13, 0.06, -0.12); f.bezierCurveTo(0.03, -0.11, 0.01, -0.05, 0, 0);
    const geoAla = new THREE.ShapeGeometry(f, 8);
    geoAla.rotateX(-Math.PI / 2);         // sdraiata, la punta verso +x
    const B = new Costruttore();
    B.aggiungi(geoAla, new THREE.Matrix4(), [1, 1, 1]);
    this.ali = new THREE.InstancedMesh(B.costruisci(), mat, N * 2);
    const C = new Costruttore();
    C.aggiungi(new THREE.CapsuleGeometry(0.012, 0.1, 3, 6), matrice(0, 0, 0, [Math.PI / 2, 0, 0]), [0.35, 0.28, 0.3]);
    this.corpi = new THREE.InstancedMesh(C.costruisci(), materialePigmento({ sempre: true }), N);
    for (const m of [this.ali, this.corpi]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; scena.add(m); }
    for (let i = 0; i < N * 2; i++) this.ali.setColorAt(i, _c.setRGB(1, 1, 1));
    this.lista = [];
  }
  nasci(p, opz = {}) {
    if (this.lista.length >= this.N) this.lista.shift();
    const colore = opz.colore || scegli(COLORI_FIORI.concat([[0.99, 0.84, 0.36], [0.60, 0.80, 1.0]]));
    this.lista.push({ p: p.clone(), v: new THREE.Vector3(caso(-0.5, 0.5), caso(0.6, 1.2), caso(-0.2, 0.6)), t: 0, vita: caso(9, 15), fase: caso(0, PI2), colore, seme: caso(0, 100), dim: caso(1.3, 1.8), angolo: caso(0, PI2) });
  }
  aggiorna(dt, t, centro) {
    let k = 0;
    this.lista = this.lista.filter((b) => b.t < b.vita);
    for (const b of this.lista) {
      b.t += dt;
      // vola a zig-zag, attirata piano piano verso Lia (gira attorno a lei)
      const s = b.seme;
      _v.set(Math.sin(t * 1.3 + s) * 1.2, Math.sin(t * 2.1 + s * 2) * 0.8 + 0.1, Math.cos(t * 1.1 + s * 3) * 1.2);
      if (centro) { _w.set(centro.x + Math.sin(t * 0.4 + s) * 1.8, centro.y + 1.4 + Math.sin(t * 0.6 + s) * 0.6, centro.z + Math.cos(t * 0.4 + s) * 1.3); _v.addScaledVector(_w.sub(b.p), 0.25); }
      if (b.t > b.vita - 2.5) _v.y += 2.5;                          // alla fine vola via in alto
      b.v.lerp(_v, 1 - Math.exp(-dt * 1.5));
      b.p.addScaledVector(b.v, dt);
      b.p.z = Math.max(b.p.z, ZF + 0.3);
      const yaw = Math.atan2(b.v.x, b.v.z);
      const battito = Math.sin(t * 15 + b.fase) * 0.9 + 0.25;
      const sc = b.dim * morbido(0, 0.4, b.t) * morbido(0, 1.2, b.vita - b.t);
      for (const lato of [1, -1]) {
        _q.setFromEuler(_e.set(0, yaw + Math.PI, lato * battito, 'YXZ'));
        _m.compose(b.p, _q, _s.set(sc * lato, sc, sc));
        this.ali.setMatrixAt(k * 2 + (lato > 0 ? 0 : 1), _m);
        this.ali.setColorAt(k * 2 + (lato > 0 ? 0 : 1), _c.setRGB(b.colore[0], b.colore[1], b.colore[2]));
      }
      _q.setFromEuler(_e.set(0, yaw, 0, 'YXZ'));
      _m.compose(b.p, _q, _s.set(sc, sc, sc));
      this.corpi.setMatrixAt(k, _m);
      k++;
    }
    this.ali.count = k * 2; this.corpi.count = k;
    this.ali.instanceMatrix.needsUpdate = true; this.corpi.instanceMatrix.needsUpdate = true;
    if (this.ali.instanceColor) this.ali.instanceColor.needsUpdate = true;
  }
}

/* ------------------------------------------------------------------------ */
/*  UCCELLINI (alcuni stanno appollaiati sui tetti e volano via)             */
/* ------------------------------------------------------------------------ */
class Uccelli {
  constructor(scena, posatoi, N = 26) {
    this.N = N;
    this.posatoi = posatoi;
    const mat = materialePigmento({ sempre: true });
    const B = new Costruttore();
    B.sfera(0, 0, 0, 0.07, (x, y) => (y < -0.015 ? [1.0, 0.97, 0.92] : [0.56, 0.72, 0.92]), { scala: [0.85, 0.8, 1.25], seg: 12, segV: 8 });
    B.sfera(0, 0.055, 0.07, 0.048, [0.56, 0.72, 0.92], { seg: 12, segV: 8 });
    B.aggiungi(new THREE.ConeGeometry(0.014, 0.04, 6), matrice(0, 0.05, 0.125, [Math.PI / 2, 0, 0]), [0.98, 0.66, 0.30]);
    B.sfera(0.028, 0.068, 0.1, 0.009, [0.12, 0.1, 0.1], { seg: 6, segV: 4 });
    B.sfera(-0.028, 0.068, 0.1, 0.009, [0.12, 0.1, 0.1], { seg: 6, segV: 4 });
    B.scatola(0, 0.01, -0.1, 0.07, 0.015, 0.09, [0.5, 0.65, 0.86], { rot: [0.3, 0, 0] });
    this.corpi = new THREE.InstancedMesh(B.costruisci(), mat, N);
    const A = new Costruttore();
    A.scatola(0.065, 0, 0, 0.13, 0.012, 0.075, [0.52, 0.68, 0.9], { r: 0.005 });
    this.ali = new THREE.InstancedMesh(A.costruisci(), mat, N * 2);
    for (const m of [this.corpi, this.ali]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; scena.add(m); }
    this.lista = [];
    // all'inizio qualche uccellino è già appollaiato
    const scelti = [...posatoi].sort(() => Math.random() - 0.5).slice(0, 8);
    for (const p of scelti) this.lista.push({ p: p.clone(), v: new THREE.Vector3(), stato: 'posato', t: caso(0, 5), fase: caso(0, PI2), yaw: caso(-1, 1), salto: 0 });
    this.prossimoCanto = 3;
  }
  /** Uccellini che volano via da un punto. */
  vola(p, quanti = 3) {
    for (let k = 0; k < quanti; k++) {
      if (this.lista.length >= this.N) break;
      const a = caso(0, PI2);
      this.lista.push({ p: p.clone().add(new THREE.Vector3(caso(-0.2, 0.2), caso(0, 0.2), caso(0, 0.2))), v: new THREE.Vector3(Math.cos(a) * 2, caso(2.5, 4), Math.abs(Math.sin(a)) * 2 + 0.5), stato: 'vola', t: 0, fase: caso(0, PI2), yaw: 0 });
    }
    Audio.ali(p.x, p.z);
    Audio.uccellino(p.x, p.z);
  }
  /** Gli uccellini appollaiati vicino a p si spaventano (per gioco) e volano via. */
  spaventa(p, raggio = 5) {
    let n = 0;
    for (const u of this.lista) if (u.stato === 'posato' && u.p.distanceTo(p) < raggio) { u.stato = 'vola'; u.t = 0; u.v.set(caso(-2, 2), caso(2.5, 3.5), caso(0.5, 2)); n++; }
    if (n) Audio.ali(p.x, p.z);
    return n;
  }
  aggiorna(dt, t) {
    let k = 0;
    this.prossimoCanto -= dt;
    const posati = this.lista.filter((u) => u.stato === 'posato');
    if (this.prossimoCanto < 0 && posati.length) { const u = scegli(posati); Audio.uccellino(u.p.x, u.p.z); u.salto = 0.3; this.prossimoCanto = caso(3, 8); }
    // ogni tanto un uccellino torna a posarsi
    if (posati.length < 5 && Math.random() < dt * 0.15 && this.lista.length < this.N) {
      const meta = scegli(this.posatoi);
      this.lista.push({ p: meta.clone().add(new THREE.Vector3(caso(-15, 15), 12, caso(5, 15))), v: new THREE.Vector3(), stato: 'arriva', meta: meta.clone(), t: 0, fase: caso(0, PI2), yaw: 0 });
    }
    this.lista = this.lista.filter((u) => !(u.stato === 'vola' && u.t > 9));
    for (const u of this.lista) {
      u.t += dt;
      let battito = 0, inclina = 0;
      if (u.stato === 'posato') {
        u.salto = Math.max(0, (u.salto || 0) - dt);
        if (Math.random() < dt * 0.3) { u.yaw += caso(-1.2, 1.2); u.salto = 0.25; }
        battito = u.salto > 0 ? Math.sin(t * 40) * 0.6 : -0.15;
        inclina = Math.sin(t * 3 + u.fase) > 0.85 ? 0.5 : 0;       // becchetta
        _v.copy(u.p); _v.y += Math.sin(clamp(u.salto / 0.25, 0, 1) * Math.PI) * 0.05;
      } else if (u.stato === 'vola') {
        u.v.y += dt * 0.6; u.v.x += Math.sin(t * 2 + u.fase) * dt;
        u.p.addScaledVector(u.v, dt);
        u.yaw = Math.atan2(u.v.x, u.v.z);
        battito = Math.sin(t * 22 + u.fase) * 1.1;
        inclina = -0.3;
        _v.copy(u.p);
      } else {                                                    // arriva: plana verso il posatoio
        _w.subVectors(u.meta, u.p);
        const d = _w.length();
        u.v.lerp(_w.normalize().multiplyScalar(Math.min(5, d * 1.2 + 0.4)), 1 - Math.exp(-dt * 3));
        u.p.addScaledVector(u.v, dt);
        u.yaw = Math.atan2(u.v.x, u.v.z);
        battito = d > 1 ? Math.sin(t * 20 + u.fase) * 1.0 : Math.sin(t * 30) * 0.5;
        if (d < 0.08) { u.stato = 'posato'; u.p.copy(u.meta); u.yaw = caso(-1, 1); }
        _v.copy(u.p);
      }
      _q.setFromEuler(_e.set(inclina, u.yaw, 0, 'YXZ'));
      _m.compose(_v, _q, _s.set(1, 1, 1));
      this.corpi.setMatrixAt(k, _m);
      for (const lato of [1, -1]) {
        _w.set(lato * 0.04, 0.02, 0).applyEuler(_e.set(inclina, u.yaw, 0, 'YXZ')).add(_v);
        _q.setFromEuler(_e.set(inclina, u.yaw, lato * battito, 'YXZ'));
        _m.compose(_w, _q, _s.set(lato, 1, 1));
        this.ali.setMatrixAt(k * 2 + (lato > 0 ? 0 : 1), _m);
      }
      k++;
    }
    this.corpi.count = k; this.ali.count = k * 2;
    this.corpi.instanceMatrix.needsUpdate = true; this.ali.instanceMatrix.needsUpdate = true;
  }
}

/* ------------------------------------------------------------------------ */
/*  BOLLE DI SAPONE                                                          */
/* ------------------------------------------------------------------------ */
class Bolle {
  constructor(scena, scintille, N = 40) {
    this.N = N; this.scintille = scintille;
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 14), materialeBolle(), N);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.renderOrder = 4;
    scena.add(this.mesh);
    this.lista = [];
  }
  soffia(p, quante = 8) {
    for (let k = 0; k < quante; k++) {
      if (this.lista.length >= this.N) this.lista.shift();
      this.lista.push({ p: p.clone().add(new THREE.Vector3(caso(-0.3, 0.3), caso(0, 0.3), caso(-0.3, 0.3))), v: new THREE.Vector3(caso(-0.6, 0.6), caso(0.4, 1.2), caso(-0.2, 0.8)), r: caso(0.07, 0.2), t: -k * 0.08, vita: caso(3, 6), seme: caso(0, 100) });
    }
  }
  aggiorna(dt, t) {
    let k = 0;
    const rimaste = [];
    for (const b of this.lista) {
      b.t += dt;
      if (b.t > b.vita) {                                  // POP! un anello di goccioline
        this.scintille.sbuffo(b.p, 6, 0.8, { forma: 0, colore: [0.75, 0.88, 1.0], dim: 0.5, vita: 0.5, grav: -0.5 });
        if (Math.random() < 0.5) Audio.nota(Math.floor(caso(0, 32)), 0.12);
        continue;
      }
      rimaste.push(b);
      if (b.t < 0) continue;
      b.v.x += Math.sin(t * 1.7 + b.seme) * dt * 0.4; b.v.y += (0.25 - b.v.y) * dt * 0.5;
      b.p.addScaledVector(b.v, dt);
      const r = b.r * elastica(clamp(b.t / 0.4, 0, 1)) * (1 + Math.sin(t * 7 + b.seme) * 0.04);
      _m.compose(b.p, _q.identity(), _s.set(r, r * (1 - Math.sin(t * 7 + b.seme) * 0.04), r));
      this.mesh.setMatrixAt(k++, _m);
    }
    this.lista = rimaste;
    this.mesh.count = k; this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/* ------------------------------------------------------------------------ */
/*  NASTRI COLORATI (scie che salgono a spirale)                             */
/* ------------------------------------------------------------------------ */
class Nastri {
  constructor(scena, N = 6, S = 44) {
    this.S = S;
    this.lista = [];
    const mat = materialeNastro();
    for (let i = 0; i < N; i++) {
      const g = new THREE.BufferGeometry();
      const pos = new Float32Array(S * 2 * 3), uv = new Float32Array(S * 2 * 2), col = new Float32Array(S * 2 * 4);
      for (let k = 0; k < S; k++) { uv.set([k / (S - 1), 0, k / (S - 1), 1], k * 4); }
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setAttribute('aColore', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
      const ind = [];
      for (let k = 0; k < S - 1; k++) { const a = k * 2; ind.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      g.setIndex(ind);
      const m = new THREE.Mesh(g, mat);
      m.frustumCulled = false; m.visible = false; m.renderOrder = 6;
      scena.add(m);
      this.lista.push({ m, attivo: false, scia: [] });
    }
  }
  lancia(p, colore) {
    const n = this.lista.find((x) => !x.attivo) || this.lista.reduce((a, b) => (a.t > b.t ? a : b));
    n.attivo = true; n.t = 0; n.vita = caso(3.2, 4.2); n.c = p.clone(); n.colore = colore || scegli(PASTELLI);
    n.colore2 = scegli(PASTELLI); n.giri = caso(2.2, 3.4) * (Math.random() < 0.5 ? 1 : -1); n.raggio = caso(0.5, 0.9); n.fase = caso(0, PI2);
    n.scia = [];
  }
  aggiorna(dt, t, camera) {
    for (const n of this.lista) {
      if (!n.attivo) continue;
      n.t += dt;
      if (n.t > n.vita) { n.attivo = false; n.m.visible = false; continue; }
      const u = n.t / n.vita;
      const a = n.fase + n.giri * n.t;
      const r = n.raggio * (0.4 + u);
      const testa = new THREE.Vector3(n.c.x + Math.cos(a) * r, n.c.y + 0.2 + n.t * 1.1, n.c.z + Math.sin(a) * r * 0.8);
      n.scia.unshift(testa);
      if (n.scia.length > this.S) n.scia.pop();
      const g = n.m.geometry, pos = g.attributes.position.array, col = g.attributes.aColore.array;
      const alfa = morbido(0, 0.1, u) * (1 - morbido(0.7, 1, u));
      for (let k = 0; k < this.S; k++) {
        const P = n.scia[Math.min(k, n.scia.length - 1)], Q = n.scia[Math.min(k + 1, n.scia.length - 1)];
        _v.subVectors(P, Q); if (_v.lengthSq() < 1e-8) _v.set(0, 1, 0);
        _w.subVectors(camera.position, P).cross(_v).normalize();
        const largo = 0.09 * (1 - k / this.S) + 0.01;
        pos.set([P.x + _w.x * largo, P.y + _w.y * largo, P.z + _w.z * largo, P.x - _w.x * largo, P.y - _w.y * largo, P.z - _w.z * largo], k * 6);
        const c = k / this.S, cc = [lerp(n.colore[0], n.colore2[0], c), lerp(n.colore[1], n.colore2[1], c), lerp(n.colore[2], n.colore2[2], c)];
        const a2 = alfa * (1 - c) * (k < n.scia.length ? 1 : 0);
        col.set([cc[0], cc[1], cc[2], a2, cc[0], cc[1], cc[2], a2], k * 8);
      }
      g.attributes.position.needsUpdate = true; g.attributes.aColore.needsUpdate = true;
      n.m.visible = true;
    }
  }
}

/* ------------------------------------------------------------------------ */
/*  L'ARCOBALENO (quando si dipinge tanto cielo)                             */
/* ------------------------------------------------------------------------ */
class Arcobaleno {
  constructor(scena) {
    const g = new THREE.TorusGeometry(70, 5, 10, 64, Math.PI);
    const col = new Float32Array(g.attributes.position.count * 4), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const r = Math.hypot(p.getX(i), p.getY(i));
      const h = clamp((r - 65) / 10, 0, 1);
      const c = new THREE.Color().setHSL(0.83 * (1 - h) - 0.0, 0.75, 0.78);
      col.set([c.r, c.g, c.b, 0], i * 4);
    }
    g.setAttribute('aColore', new THREE.BufferAttribute(col, 4));
    this.col = col;
    const mat = materialeNastro();
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false; this.mesh.visible = false; this.mesh.renderOrder = -5;
    scena.add(this.mesh);
    this.forza = 0; this.vita = 0;
  }
  mostra(x) { this.mesh.position.set(x, -12, -150); this.vita = 14; this.mesh.visible = true; }
  aggiorna(dt) {
    if (!this.mesh.visible) return;
    this.vita -= dt;
    const f = morbido(0, 2, 14 - this.vita) * morbido(0, 3, this.vita) * 0.55;
    if (Math.abs(f - this.forza) > 0.005) {
      this.forza = f;
      for (let i = 3; i < this.col.length; i += 4) this.col[i] = f;
      this.mesh.geometry.attributes.aColore.needsUpdate = true;
    }
    if (this.vita <= 0) this.mesh.visible = false;
  }
}

/* ========================================================================== */
/*  IL MAGO: decide che cosa succede a ogni tocco                             */
/* ========================================================================== */
export class Magia {
  constructor(scena, ctx) {
    Object.assign(this, ctx);   // camera, mondo, rivelazione, cielo, lia, gogo, regista
    this.scintille = new Scintille(scena);
    this.fiori = new Fiori(scena);
    this.farfalle = new Farfalle(scena);
    this.uccelli = new Uccelli(scena, this.mondo.posatoi);
    this.bolle = new Bolle(scena, this.scintille);
    this.nastri = new Nastri(scena);
    this.arcobaleno = new Arcobaleno(scena);
    this.comete = [];
    this.raggio = new THREE.Raycaster();
    this.nota = 0;
    this.giro = 0;              // per variare le meraviglie
    this.toccatiCielo = 0;
    this.quanti = 0;
    this.ultimoTrascina = 0; this.ultimaNotaTrascina = 0;
    // la lucina sulla punta del bastone e gli aloni dei lampioni (scintille "eterne")
    this.lucina = this.scintille.emetti({ p: new THREE.Vector3(), colore: ORO, forma: 0, vita: 1e9, dim: 0.06, grav: 0, attr: 0, rotV: 0, alfa: 0.9, brilla: true });
    this.lampioni = this.mondo.lampioni.map((p) => ({ p, i: this.scintille.emetti({ p, colore: [1.0, 0.86, 0.55], forma: 0, vita: 1e9, dim: 0.32, grav: 0, attr: 0, rotV: 0, alfa: 0.35 }), acceso: 0 }));
  }

  /** Da coordinate dello schermo (pixel CSS) a raggio nel mondo. */
  _raggio(x, y) {
    const r = this.camera.userData.rettangolo;
    this.raggio.setFromCamera(new THREE.Vector2((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1), this.camera);
    return this.raggio.ray;
  }
  /** Quanto è vicino (in pixel) un punto del mondo al dito? */
  _distanzaSchermo(p, x, y) {
    const r = this.camera.userData.rettangolo;
    _v.copy(p).project(this.camera);
    if (_v.z > 1) return 1e9;
    return Math.hypot((_v.x + 1) / 2 * r.width + r.left - x, (1 - _v.y) / 2 * r.height + r.top - y);
  }

  /* ---------------------------------------------------------------------- */
  /*  IL TOCCO                                                               */
  /* ---------------------------------------------------------------------- */
  tocco(x, y) {
    this.quanti++;
    const raggio = this._raggio(x, y);
    // 1. Lia o Gogo? (con un bel margine: le dita dei bambini sono grandi)
    const r = this.camera.userData.rettangolo;
    const tolleranza = Math.max(45, r.height * 0.11);
    const cL = this.lia.centroTesta(new THREE.Vector3()); cL.y -= 0.25;
    const cG = this.gogo.centro(new THREE.Vector3());
    const dL = this._distanzaSchermo(cL, x, y), dG = this._distanzaSchermo(cG, x, y);
    const scalaL = this._raggioSchermo(cL, 0.45), scalaG = this._raggioSchermo(cG, 0.35);
    if (dL < Math.max(tolleranza, scalaL) && dL <= dG) return this._gioia('lia', cL);
    if (dG < Math.max(tolleranza, scalaG)) return this._gioia('gogo', cG);

    // 2. che cosa ha toccato nel mondo?
    const colpo = this.mondo.sensori.colpisci(raggio);
    const punto = colpo ? colpo.punto : _v.copy(raggio.direction).multiplyScalar(60).add(raggio.origin).clone();
    // risposta IMMEDIATA sotto il dito
    this.scintille.sbuffo(colpo ? punto : _w.copy(raggio.direction).multiplyScalar(8).add(raggio.origin), 10, 1.5, { normale: colpo ? colpo.normale : null });
    this.scintille.emetti({ p: colpo ? punto : _w, colore: [1, 0.95, 0.8], forma: 3, vita: 0.45, dim: 0.5, grav: 0, attr: 0, rotV: 0 });
    Audio.nota(this.nota++, 0.32);
    // 3. Lia punta il bastone e parte la cometa
    this.lia.punta(punto, 1.0);
    const arrivo = () => this._meraviglia(colpo, punto, raggio.direction.clone());
    setTimeout(() => this._cometa(this.lia.puntaBacchetta(new THREE.Vector3()), punto.clone(), arrivo), 160);
    // Gogo si gira a guardare
    if (Math.random() < 0.3 && this.gogo.stato === 'guinzaglio') this.gogo.felice = 1;
  }

  _raggioSchermo(p, r) {
    const rr = this.camera.userData.rettangolo;
    const d = this.camera.position.distanceTo(p);
    return r / (d * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2)) * rr.height / 2;
  }

  /** Il dito trascinato "dipinge" una scia. */
  trascina(x, y, t) {
    if (t - this.ultimoTrascina < 0.06) return;
    this.ultimoTrascina = t;
    const raggio = this._raggio(x, y);
    const colpo = this.mondo.sensori.colpisci(raggio);
    if (!colpo) {
      this.cielo.macchia(raggio.direction, 0.18, caso(0, 1));
      this.scintille.sbuffo(_v.copy(raggio.direction).multiplyScalar(10).add(raggio.origin), 2, 0.6, {});
      return;
    }
    this.rivelazione.onda(colpo.punto.x, colpo.punto.z, 1.6, 6, (t * 0.1) % 1);
    this.scintille.sbuffo(colpo.punto, 3, 0.8, { normale: colpo.normale, dim: 0.8 });
    if (t - this.ultimaNotaTrascina > 0.22) { this.ultimaNotaTrascina = t; Audio.nota(this.nota++, 0.2); }
    if (Math.random() < 0.18 && (colpo.cosa === 'marciapiede' || colpo.cosa === 'prato')) this.fiori.nasci(colpo.punto, colpo.normale, { alto: 0.8 });
  }

  _gioia(chi, p) {
    const c = chi === 'lia' ? this.lia : this.gogo;
    c.gioia();
    for (let k = 0; k < 12; k++) {
      _v.set(caso(-1, 1), caso(0.8, 1.6), caso(-0.4, 1)).multiplyScalar(1.4);
      this.scintille.emetti({ p: _w.copy(p).add(new THREE.Vector3(caso(-0.15, 0.15), 0.2, caso(-0.1, 0.1))), v: _v, colore: scegli([[0.99, 0.55, 0.66], [1.0, 0.72, 0.80], [0.98, 0.45, 0.55]]), forma: 2, vita: caso(1.2, 1.8), dim: caso(0.09, 0.14), grav: 0.25, attr: 2.5, rotV: caso(-1, 1), brilla: true });
    }
    this.scintille.sbuffo(p, 10, 2.0, {});
    if (chi === 'lia') { Audio.meraviglia(); this.gogo.felice = 2; }
    else { Audio.abbaio(this.gogo.pos.x, this.gogo.pos.z, 2); this.lia.guarda(p, 1.5); this.lia.felice = 1.5; }
    // ogni tanto la telecamera si avvicina (non sempre: troppi stacchi confondono)
    if (this.regista.quantiPrimi < 1 || Math.random() < 0.5) this.regista.primoPiano(chi, null, 2.8);
    this.rivelazione.onda(c.pos.x, c.pos.z, 3.2, 5, caso(0, 1));
  }

  _cometa(da, a, arrivo) {
    const dist = da.distanceTo(a);
    const ctrl = new THREE.Vector3().lerpVectors(da, a, 0.5);
    ctrl.y += Math.min(3, dist * 0.35) + 0.3;
    this.comete.push({ da, a, ctrl, t: 0, durata: clamp(dist / 14, 0.28, 0.75), arrivo, colore: scegli(PASTELLI) });
    Audio.magia(0.22);
  }

  /** La meraviglia vera e propria, dove arriva la cometa. */
  _meraviglia(colpo, punto, dir) {
    const R = this.rivelazione;
    const t = U.uTempo.value;
    this.giro++;
    if (!colpo) {
      // IL CIELO: una macchia d'azzurro, stelle, nastri, e ogni tanto l'arcobaleno
      this.toccatiCielo++;
      this.cielo.macchia(dir, caso(0.45, 0.65), caso(0, 1));
      const centro = _v.copy(dir).multiplyScalar(14).add(this.camera.position).clone();
      this.scintille.sbuffo(centro, 22, 3, { forma: 1, dim: 2.2, vita: 1.6, grav: -0.3 });
      this.nastri.lancia(this.lia.pos.clone().add(new THREE.Vector3(0, 0.8, 0.5)));
      Audio.magia(0.45);
      if (this.toccatiCielo % 3 === 0) { this.arcobaleno.mostra(this.lia.pos.x); Audio.meraviglia(); }
      this.lia.guarda(centro, 2);
      return;
    }
    const { mat, cosa } = colpo;
    const p = punto, n = colpo.normale;
    Audio.tocco(mat, p.x, p.z);
    const prima = R.frazione();
    R.onda(p.x, p.z, caso(5.5, 7.5), 4.8, caso(0, 1));
    setTimeout(() => { const nuovo = R.frazione() - prima; Audio.scoperta(clamp(0.3 + nuovo * 25, 0.3, 1)); }, 700);
    this.scintille.sbuffo(p, 16, 2.4, { normale: n });
    // ogni tanto, per le magie, un primo piano (non sempre: troppi stacchi confondono)
    if (this.giro % 5 === 1) this.regista.primoPiano('magia', p.clone().add(new THREE.Vector3(0, 0.4, 0)), 2.6);
    else this.regista.guardaMagia(p);
    this.lia.guarda(p, 2);
    this.uccelli.spaventa(p, 4);
    // la meraviglia giusta per ogni cosa
    if (cosa === 'muro' || cosa === 'mattoni' || cosa === 'porta' || cosa === 'grondaia' || cosa === 'cassetta' || cosa === 'edera') {
      for (let k = 0; k < 9; k++) {
        const a = caso(0, PI2), r = Math.sqrt(Math.random()) * 0.8;
        _w.set(p.x + Math.cos(a) * r, Math.max(0.3, p.y + Math.sin(a) * r * 0.8), ZF + 0.01);
        if (n.z > 0.5) this.fiori.nasci(_w, n, { ritardo: k * 0.06, alto: 0.6 });
        else this.fiori.nasci(p, n, { ritardo: k * 0.06, alto: 0.6 });
      }
      for (let k = 0; k < 3; k++) this.farfalle.nasci(p.clone().add(new THREE.Vector3(0, 0, 0.3)));
    } else if (cosa === 'finestra' || cosa === 'vetrina' || cosa === 'balcone' || cosa === 'tenda') {
      this.uccelli.vola(p.clone().add(new THREE.Vector3(0, 0, 0.3)), 3);
      for (let k = 0; k < 6; k++) this.scintille.emetti({ p: p.clone().add(new THREE.Vector3(caso(-0.4, 0.4), 0, 0.2)), v: new THREE.Vector3(caso(-0.6, 0.6), caso(0, 1), caso(0.3, 1)), colore: scegli(COLORI_FIORI), forma: 4, vita: caso(2, 3), dim: 0.07, grav: -0.35, attr: 1.2, rotV: caso(-4, 4) });
      this.farfalle.nasci(p.clone().add(new THREE.Vector3(0, 0, 0.4)));
    } else if (cosa === 'albero' || cosa === 'prato' || cosa === 'pianta' || cosa === 'fioriera' || cosa === 'vaso') {
      this.uccelli.vola(colpo.extra && colpo.extra.centro ? colpo.extra.centro.clone().add(new THREE.Vector3(0, 0.5, 0)) : p, cosa === 'albero' ? 4 : 2);
      for (let k = 0; k < 14; k++) this.scintille.emetti({ p: p.clone().add(new THREE.Vector3(caso(-0.8, 0.8), caso(0, 0.8), caso(-0.5, 0.5))), v: new THREE.Vector3(caso(-0.4, 0.4), caso(-0.2, 0.3), caso(-0.2, 0.4)), colore: scegli([[0.66, 0.84, 0.48], [0.99, 0.75, 0.85], [0.99, 0.88, 0.5]]), forma: 4, vita: caso(2.5, 4), dim: 0.08, grav: -0.25, attr: 1.5, rotV: caso(-3, 3) });
      if (cosa !== 'albero') for (let k = 0; k < 7; k++) this.fiori.nasci(p, n.y > 0.5 ? n : SU, { ritardo: k * 0.05, grande: 1.2 });
      this.farfalle.nasci(p.clone());
    } else if (cosa === 'lampione') {
      const L = this.lampioni.find((l) => l.p.distanceTo(colpo.extra.luce) < 0.1);
      if (L) L.acceso = 1;
      this.scintille.sbuffo(colpo.extra.luce, 24, 2.6, { forma: 1, colore: ORO, dim: 1.2 });
      this.nastri.lancia(p.clone());
    } else if (cosa === 'strada') {
      this.bolle.soffia(p.clone().add(new THREE.Vector3(0, 0.3, 0)), 9);
      this._anello(p, 7, 1.2);
    } else if (cosa === 'panchina' || cosa === 'ringhiera' || cosa === 'tronco' || cosa === 'tetto') {
      this.bolle.soffia(p.clone().add(new THREE.Vector3(0, 0.2, 0.2)), 6);
      for (let k = 0; k < 2; k++) this.farfalle.nasci(p.clone());
    } else {
      // marciapiede: un cerchio di fiori che spuntano tutto attorno
      this._anello(p, 12, 1.3);
      for (let k = 0; k < 2; k++) this.farfalle.nasci(p.clone().add(new THREE.Vector3(0, 0.3, 0)));
    }
    // ...e una sorpresa in più, sempre diversa
    const extra = this.giro % 4;
    if (extra === 0) this.nastri.lancia(p.clone());
    else if (extra === 1) this.bolle.soffia(p.clone().add(new THREE.Vector3(0, 0.4, 0.3)), 4);
    else if (extra === 2) this.farfalle.nasci(p.clone().add(new THREE.Vector3(0, 0.5, 0.3)));
    else this.scintille.sbuffo(p.clone().add(new THREE.Vector3(0, 0.6, 0)), 14, 2.2, { forma: 1, colore: ORO, dim: 1.3, grav: -0.6 });
  }

  _anello(p, quanti, raggio) {
    for (let k = 0; k < quanti; k++) {
      const a = k / quanti * PI2 + caso(-0.2, 0.2), r = raggio * caso(0.45, 1.1);
      _w.set(p.x + Math.cos(a) * r, p.y, p.z + Math.sin(a) * r);
      _w.z = clamp(_w.z, ZF + 0.15, 8.4);
      _w.y = this.mondo.altezza(_w.x, _w.z);
      this.fiori.nasci(_w, SU, { ritardo: k * 0.05 + r * 0.15 });
    }
  }

  /* ---------------------------------------------------------------------- */
  aggiorna(dt, t) {
    // le comete in volo (con la scia di stelline)
    for (const c of this.comete) {
      c.t += dt;
      const u = clamp(c.t / c.durata, 0, 1), e = u * u * (3 - 2 * u);
      const p = _v.set(0, 0, 0).addScaledVector(c.da, (1 - e) * (1 - e)).addScaledVector(c.ctrl, 2 * e * (1 - e)).addScaledVector(c.a, e * e);
      this.scintille.emetti({ p, colore: [1, 0.97, 0.85], forma: 0, vita: 0.12, dim: 0.16, grav: 0, attr: 0, rotV: 0 });
      for (let k = 0; k < 3; k++) this.scintille.emetti({ p, v: new THREE.Vector3(caso(-0.4, 0.4), caso(-0.2, 0.4), caso(-0.4, 0.4)), colore: k ? c.colore : ORO, forma: k === 0 ? 1 : 0, vita: caso(0.4, 0.8), dim: caso(0.04, 0.08), grav: -0.6, attr: 2, brilla: true });
      if (u >= 1 && !c.fatto) { c.fatto = true; c.arrivo(); }
    }
    this.comete = this.comete.filter((c) => !c.fatto);
    // le creste bagnate delle onde luccicano
    for (const o of this.rivelazione.onde) {
      if (o.r > o.R || Math.random() > 0.8) continue;
      const a = caso(0, PI2), x = o.x + Math.cos(a) * o.r, z = o.z + Math.sin(a) * o.r;
      if (z < ZF || z > 8.6) continue;
      this.scintille.emetti({ p: _w.set(x, this.mondo.altezza(x, z) + 0.05, z), v: new THREE.Vector3(0, caso(0.2, 0.6), 0), colore: scegli(PASTELLI), forma: Math.random() < 0.5 ? 1 : 0, vita: caso(0.5, 0.9), dim: caso(0.05, 0.09), grav: 0.1, attr: 1, brilla: true });
    }
    // la lucina del bastone
    this.lia.puntaBacchetta(_v);
    const S = this.scintille, i = this.lucina * 3;
    S.pos[i] = _v.x; S.pos[i + 1] = _v.y; S.pos[i + 2] = _v.z;
    S.alfa[this.lucina] = 0.55 + this.lia.mira.x * 0.45;
    S.dim[this.lucina] = 0.05 + this.lia.mira.x * 0.07;
    // gli aloni dei lampioni (più forti se toccati)
    for (const L of this.lampioni) {
      L.acceso = Math.max(0, L.acceso - dt * 0.12);
      S.alfa[L.i] = 0.3 + L.acceso * 0.7 + Math.sin(t * 3 + L.p.x) * 0.03;
      S.dim[L.i] = 0.3 + L.acceso * 0.5;
    }
    this.scintille.aggiorna(dt, t);
    this.fiori.aggiorna(dt, t);
    this.farfalle.aggiorna(dt, t, this.lia.pos);
    this.uccelli.aggiorna(dt, t);
    this.bolle.aggiorna(dt, t);
    this.nastri.aggiorna(dt, t, this.camera);
    this.arcobaleno.aggiorna(dt);
  }
}
