/* ==========================================================================
 *  camera.js — IL REGISTA
 *  --------------------------------------------------------------------------
 *  La telecamera si comporta come l'operatore di un film d'animazione:
 *  sceglie da sola le INQUADRATURE e le cambia ogni tanto, senza mai
 *  "saltare": ogni movimento passa per due MOLLE in fila (vedi utili.js),
 *  così anche le partenze e le frenate sono morbide.
 *
 *  Le inquadrature:
 *    carrello  di lato, accompagna Lia come un carrello sui binari
 *    basso     dal basso, di tre quarti, davanti a lei: le case sembrano alte
 *    orbita    gira lentamente attorno a Lia
 *    gru       sale in alto e mostra tutta la via
 *    davanti   vicino, davanti: Lia e Gogo vengono verso di noi
 *    dietro    da dietro le spalle, guardando lungo la strada
 *    controcampo dalle case verso il giardino (alberi, colline, nuvole)
 *    gogo      ad altezza di cane, quando Gogo scappa ad annusare
 *    primo     PRIMO PIANO quando succede qualcosa di magico
 *  In più c'è un leggerissimo "respiro" (come una camera a mano).
 * ========================================================================== */
import * as THREE from 'three';
import { Molla, Molla3, clamp, lerp, scegli, morbido } from './utili.js';
import { ZF } from './mondo.js';

const SEQUENZA = ['carrello', 'basso', 'orbita', 'gru', 'davanti', 'dietro', 'controcampo'];

export class Regista {
  constructor(camera) {
    this.camera = camera;
    this.pos1 = new Molla3(); this.pos2 = new Molla3();
    this.mira1 = new Molla3(); this.mira2 = new Molla3();
    this.fov = new Molla(40);
    this.apertura = new Molla(0.4);
    this.inquadratura = 'carrello';
    this.tempo = 0; this.durata = 9;
    this.evento = null;                 // un primo piano temporaneo
    this.spinta = null;                 // un'occhiata verso una magia lontana
    this.forzata = null;                // per le prove: un'inquadratura fissa
    this.orbitaAngolo = -0.6;
    this.primo = true;
    this.fuoco = 5;
    this._p = new THREE.Vector3(); this._m = new THREE.Vector3(); this._s = new THREE.Vector3(); this._t = new THREE.Vector3(); this._b = new THREE.Vector3();
    this.ostacoloGogo = { x: 0, z: 0, r: 0.5 };
    this.quantiPrimi = 0;
  }

  /** Cambia inquadratura (scelta "da regista": mai due volte la stessa). */
  cambia(gogo) {
    let lista = SEQUENZA.filter((n) => n !== this.inquadratura);
    if (gogo && (gogo.stato === 'esplora' || gogo.stato === 'annusa') && Math.random() < 0.6) lista = ['gogo'];
    this.inquadratura = scegli(lista);
    this.tempo = 0;
    this.durata = this.inquadratura === 'gru' ? 8 : this.inquadratura === 'gogo' ? 5 : lerp(7, 11, Math.random());
    if (this.inquadratura === 'orbita') this.orbitaAngolo = Math.random() < 0.5 ? -1.0 : 1.0;
  }

  /** Un primo piano su qualcosa (soggetto: 'lia', 'gogo' o un punto). */
  primoPiano(soggetto, punto, durata = 3) {
    this.evento = { soggetto, punto: punto ? punto.clone() : null, t: 0, durata };
    this.quantiPrimi++;
  }
  /** Una magia lontana: la telecamera "si sporge" un po' per vederla. */
  guardaMagia(punto) { this.spinta = { punto: punto.clone(), t: 0, durata: 2.5 }; }

  aggiorna(dt, t, lia, gogo) {
    this.tempo += dt;
    if (!this.forzata && this.tempo > this.durata && !this.evento) this.cambia(gogo);
    const nome = this.forzata || this.inquadratura;
    const L = lia.pos, d = lia.verso, G = gogo.pos;
    const P = this._p, M = this._m;
    let fov = 40, ap = 0.45, omega = 1.5;
    let soggetto = this._s.set(L.x, L.y + 0.7, L.z);

    switch (nome) {
      case 'carrello':
        P.set(L.x + d * 0.9, 1.1, L.z + 5.4); M.set(L.x + d * 1.1, 0.78, L.z - 0.4); fov = 38; ap = 0.35; break;
      case 'basso':
        P.set(L.x + d * 3.1, 0.3, L.z + 2.25); M.set(L.x + d * 0.3, 0.95, L.z - 0.3); fov = 48; ap = 0.55; break;
      case 'orbita': {
        const a = this.orbitaAngolo + Math.sin(this.tempo * 0.14) * 0.9;
        P.set(L.x + Math.sin(a) * 2.9, 0.95 + Math.sin(this.tempo * 0.2) * 0.2, L.z + Math.cos(a) * 2.9);
        M.set(L.x, 0.62 + L.y, L.z); fov = 40; ap = 0.75; break;
      }
      case 'gru': {             // la gru sale piano piano: Lia diventa piccola e si vede la via con i tetti
        const k = morbido(0, 1, this.tempo / 7);
        P.set(L.x - d * lerp(1.5, 3.5, k), lerp(2.2, 7.2, k), L.z + lerp(5, 8.5, k));
        M.set(L.x + d * lerp(1.5, 5, k), lerp(1.0, 3.2, k), lerp(L.z - 0.5, ZF - 0.8, k)); fov = 42; ap = 0.12; omega = 1.0; break;
      }
      case 'davanti':
        P.set(L.x + d * 2.0, 0.82, L.z + 0.95); M.set(L.x + d * 0.35, 0.72 + L.y * 0.5, L.z - 0.1); fov = 36; ap = 0.85; break;
      case 'dietro':
        P.set(L.x - d * 2.3, 1.35, L.z + 1.55); M.set(L.x + d * 3.8, 0.85, L.z - 0.7); fov = 42; ap = 0.4; break;
      case 'controcampo':       // dalle case verso il giardino: si vedono gli alberi, le colline, il cielo
        P.set(L.x + d * 2.4, 1.25, ZF + 0.75); M.set(L.x - d * 0.4, 1.15, L.z + 1.3); soggetto.set(L.x, L.y + 0.7, L.z); fov = 46; ap = 0.45; break;
      case 'gogo':
        P.set(G.x - Math.sin(gogo.angolo) * 0.2 + 1.3 * Math.sign(G.x - L.x || 1), 0.35, G.z + 1.4);
        M.set(G.x, G.y + 0.32, G.z); soggetto.copy(M); fov = 44; ap = 0.9; break;
      case 'ritratto': {        // Lia di tre quarti, da vicino (davanti a dove guarda)
        const a = lia.angolo + 0.75 * d;
        P.set(L.x + Math.sin(a) * 1.35, 0.8, L.z + Math.max(0.9, Math.cos(a) * 1.35)); M.set(L.x, L.y + 0.66, L.z); fov = 36; ap = 0.9; break;
      }
      case 'ritrattoGogo':
        P.set(G.x + Math.sin(gogo.angolo + 0.7) * 1.2, 0.5, G.z + Math.max(0.6, Math.cos(gogo.angolo + 0.7) * 1.2)); M.set(G.x, G.y + 0.33, G.z); soggetto.copy(M); fov = 38; ap = 0.9; break;
      default:
        P.set(L.x, 1.2, L.z + 5); M.copy(soggetto);
    }

    // --- primo piano temporaneo ---
    if (this.evento) {
      const E = this.evento; E.t += dt;
      const S = E.soggetto === 'lia' ? this._t.set(L.x, L.y + 0.75, L.z) : E.soggetto === 'gogo' ? this._t.set(G.x, G.y + 0.38, G.z) : this._t.copy(E.punto);
      soggetto.copy(S);
      // la telecamera resta dalla parte in cui è già, ma si avvicina
      const dir = this._m.set(this.camera.position.x - S.x, 0, this.camera.position.z - S.z);
      if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
      dir.normalize();
      if (dir.z < 0.35) { dir.z = 0.35; dir.normalize(); }
      const dist = E.soggetto === 'gogo' ? 1.4 : E.soggetto === 'lia' ? 1.7 : 2.6;
      P.set(S.x + dir.x * dist, S.y + (E.soggetto === 'gogo' ? 0.05 : 0.12), S.z + dir.z * dist);
      M.copy(S);
      fov = 34; ap = 1.0; omega = 2.2;
      if (E.t > E.durata) { this.evento = null; this.tempo = Math.min(this.tempo, this.durata - 2); }
    } else if (this.spinta) {
      const K = this.spinta; K.t += dt;
      const k = Math.sin(clamp(K.t / K.durata, 0, 1) * Math.PI) * 0.35;
      M.lerp(K.punto, k);
      if (K.t > K.durata) this.spinta = null;
    }

    // la telecamera non entra mai nelle case e non va sotto terra
    P.z = Math.max(P.z, ZF + 0.7);
    P.y = Math.max(P.y, 0.26);
    // ...e si sposta di lato se un lampione (o un vaso) coprirebbe il soggetto
    this.ostacoloGogo.x = G.x; this.ostacoloGogo.z = G.z;
    const sogGogo = nome === 'gogo' || nome === 'ritrattoGogo' || (this.evento && this.evento.soggetto === 'gogo');
    const lista = sogGogo ? this.ostacoli || [] : (this.ostacoli || []).concat([this.ostacoloGogo]);
    for (const o of lista) {
      const ax = P.x, az = P.z, bx = soggetto.x, bz = soggetto.z;
      const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1;
      const k = clamp(((o.x - ax) * dx + (o.z - az) * dz) / (l * l), 0, 1);
      const cx = ax + dx * k, cz = az + dz * k, dist = Math.hypot(o.x - cx, o.z - cz);
      const R = o.r || 0.6;
      if (dist < R && k < 0.92) {
        // la direzione perpendicolare alla linea di vista; il lato si sceglie una volta sola
        // (così la telecamera non "salta" da una parte all'altra)
        const nx = -dz / l, nz = dx / l;
        if (!o._lato) o._lato = Math.sign((cx - o.x) * nx + (cz - o.z) * nz) || 1;
        const spinta = Math.min(1.8, (R - dist) / Math.max(0.2, 1 - k));
        P.x += nx * o._lato * spinta; P.z += nz * o._lato * spinta;
        P.z = Math.max(P.z, ZF + 0.7);
      } else if (dist > R + 0.4) o._lato = 0;
      // e non si avvicina troppo a un lampione nemmeno se non copre niente
      const vx = P.x - o.x, vz = P.z - o.z, dv = Math.hypot(vx, vz);
      const vicino = R * 2.1;
      if (dv < vicino && dv > 1e-3) { P.x += vx / dv * (vicino - dv); P.z += vz / dv * (vicino - dv); }
    }
    // Le molle lavorano "rispetto a Lia": lei si muove liscia, quindi la telecamera
    // la segue senza ritardo, e le molle ammorbidiscono solo i CAMBI di inquadratura.
    const base = this._b.set(L.x, 0, L.z);
    P.sub(base); M.sub(base);
    if (this.primo) { this.pos1.salta(P); this.pos2.salta(P); this.mira1.salta(M); this.mira2.salta(M); this.primo = false; }
    // due molle in fila: niente scatti, nemmeno quando l'inquadratura cambia
    const p = this.pos2.segui(this.pos1.segui(P, dt, omega * 1.6), dt, omega).clone().add(base);
    const m = this.mira2.segui(this.mira1.segui(M, dt, omega * 2.2), dt, omega * 1.4).clone().add(base);
    p.z = Math.max(p.z, ZF + 0.6);
    const f = this.fov.segui(fov, dt, 1.5);
    const a = this.apertura.segui(ap, dt, 1.5);

    // il "respiro" della camera a mano
    const cam = this.camera;
    cam.position.set(
      p.x + Math.sin(t * 0.71) * 0.022 + Math.sin(t * 1.37) * 0.008,
      p.y + Math.sin(t * 0.53) * 0.018 + Math.sin(t * 1.9) * 0.005,
      p.z + Math.sin(t * 0.91) * 0.014);
    cam.lookAt(m.x + Math.sin(t * 0.43) * 0.012, m.y + Math.sin(t * 0.61) * 0.01, m.z);
    cam.rotateZ(Math.sin(t * 0.37) * 0.006);
    if (Math.abs(cam.fov - f) > 1e-3) { cam.fov = f; cam.updateProjectionMatrix(); }
    this.fuoco = cam.position.distanceTo(soggetto);
    this.aperturaAttuale = a;
  }
}
