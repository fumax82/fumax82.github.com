/* ==========================================================================
 *  geometria.js — IL "COSTRUTTORE" DI FORME
 *  --------------------------------------------------------------------------
 *  Il mondo è fatto di tante forme semplici (scatole, cilindri, sfere...).
 *  Disegnarle una per una sarebbe lento: il telefono preferisce ricevere
 *  POCHI pacchi grandi piuttosto che MILLE pacchetti piccoli.
 *  Il Costruttore quindi raccoglie tutte le forme e alla fine le "incolla"
 *  in un'unica geometria (un solo "draw call").
 *
 *  Ogni vertice (punto delle forme) porta con sé:
 *    - position  dove si trova
 *    - normal    da che parte "guarda" la superficie (serve per la luce)
 *    - color     il colore del pigmento (il colore dell'acquerello)
 *    - aInfo     due numeri: x = TIPO di superficie (vedi TIPI qui sotto),
 *                y = un numero a caso per pezzo (piccole variazioni di colore)
 * ========================================================================== */
import * as THREE from 'three';
import { rumore3 } from './utili.js';

/** Tipi di superficie: il "pittore" (lo shader) li tratta in modo diverso. */
export const TIPI = {
  normale: 0,     // intonaco, legno, metallo...
  vetro: 1,       // finestre: riflessi di cielo
  foglie: 2,      // si muovono col vento
  terra: 3,       // marciapiede, strada, prato
  nuvola: 4,      // in cielo: si colora insieme al cielo
  lontano: 5,     // colline e città lontane: si colorano col cielo, velate dalla foschia
  luce: 6,        // vetri dei lampioni: chiari e caldi
  mattoni: 7,     // muro di mattoni (le fughe sono dipinte dallo shader)
  pietre: 8,      // zoccolo di pietre squadrate
  lastre: 9,      // lastre del marciapiede
};

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _n3 = new THREE.Matrix3(), _v = new THREE.Vector3(), _w = new THREE.Vector3();

/** Prepara una matrice da posizione, rotazione (x,y,z in radianti) e scala. */
export function matrice(x, y, z, rot, scala) {
  _p.set(x, y, z);
  _e.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0, 'YXZ');
  _q.setFromEuler(_e);
  if (typeof scala === 'number') _s.set(scala, scala, scala);
  else if (scala) _s.set(scala[0], scala[1], scala[2]);
  else _s.set(1, 1, 1);
  return _m.compose(_p, _q, _s);
}

/* ------------------------------------------------------------------------ */
/*  Forme di base                                                            */
/* ------------------------------------------------------------------------ */
/**
 * Scatola con gli spigoli smussati (arrotondati) di raggio r.
 * Trucco: si parte da un cubo diviso in fette, si "schiaccia" ogni punto
 * dentro una scatola più piccola e poi lo si spinge fuori di r: gli spigoli
 * diventano tondi come quelli di un giocattolo.
 */
export function scatolaTonda(w, h, d, r, seg = 2) {
  if (!r || r <= 0) return new THREE.BoxGeometry(w, h, d);
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
  const s = seg * 2 + 1;
  const g = new THREE.BoxGeometry(2, 2, 2, s, s, s);
  const pos = g.attributes.position, nor = g.attributes.normal;
  const mezzo = [w / 2, h / 2, d / 2], interno = mezzo.map((m) => m - r);
  const c = [0, 0, 0], p = [0, 0, 0], q = [0, 0, 0];
  for (let i = 0; i < pos.count; i++) {
    c[0] = pos.getX(i); c[1] = pos.getY(i); c[2] = pos.getZ(i);
    for (let a = 0; a < 3; a++) {
      const v = Math.abs(c[a]), sg = Math.sign(c[a]);
      // la fetta centrale copre la parte piatta, le altre la curva
      if (v <= 1 / s + 1e-6) p[a] = sg * interno[a] * v * s;
      else p[a] = sg * (interno[a] + r * (v - 1 / s) / (1 - 1 / s));
    }
    let lung = 0;
    for (let a = 0; a < 3; a++) { const cl = Math.max(-interno[a], Math.min(interno[a], p[a])); q[a] = p[a] - cl; lung += q[a] * q[a]; p[a] = cl; }
    lung = Math.sqrt(lung) || 1;
    let nx = q[0] / lung, ny = q[1] / lung, nz = q[2] / lung;
    if (lung < 1e-6) { nx = nor.getX(i); ny = nor.getY(i); nz = nor.getZ(i); }
    pos.setXYZ(i, p[0] + nx * r, p[1] + ny * r, p[2] + nz * r);
    nor.setXYZ(i, nx, ny, nz);
  }
  return g;
}

/** Un "batuffolo": una sfera bitorzoluta (foglie, nuvole, cespugli). */
export function batuffolo(r, dettaglio = 1, bozzi = 0.18, seme = 0) {
  // una sfera "a spicchi" con i vertici condivisi: liscia anche con pochi punti
  const seg = [[9, 6], [14, 10], [18, 13]][Math.min(2, dettaglio)];
  const g = new THREE.SphereGeometry(r, seg[0], seg[1]);
  const pos = g.attributes.position, nor = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    _v.fromBufferAttribute(pos, i);
    const k = 1 + (rumore3(_v.x / r * 1.3 + seme, _v.y / r * 1.3, _v.z / r * 1.3) - 0.5) * 2 * bozzi;
    _w.copy(_v).normalize();
    nor.setXYZ(i, _w.x, _w.y, _w.z);          // normale "da sfera": la luce scivola morbida (niente sfaccettature)
    _v.multiplyScalar(k);
    pos.setXYZ(i, _v.x, _v.y, _v.z);
  }
  return g;
}

/** Forma "al tornio": un profilo [[raggio, altezza], ...] che gira attorno all'asse verticale. */
export function tornio(profilo, segmenti = 16, inizio = 0, ampiezza = Math.PI * 2) {
  return new THREE.LatheGeometry(profilo.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)), segmenti, inizio, ampiezza);
}

/** Un prisma triangolare (per i frontoni dei tetti): base larga w, alto h, profondo d lungo x. */
export function prisma(larghezza, altezza, profondita) {
  const f = new THREE.Shape();
  f.moveTo(-profondita / 2, 0); f.lineTo(profondita / 2, 0); f.lineTo(0, altezza); f.lineTo(-profondita / 2, 0);
  const g = new THREE.ExtrudeGeometry(f, { depth: larghezza, bevelEnabled: false });
  g.translate(0, 0, -larghezza / 2);
  g.rotateY(Math.PI / 2);          // il prisma corre lungo x
  return g;
}

/* ------------------------------------------------------------------------ */
/*  IL COSTRUTTORE                                                           */
/* ------------------------------------------------------------------------ */
export class Costruttore {
  constructor() {
    this.pos = []; this.nor = []; this.col = []; this.info = []; this.ind = [];
    this.n = 0;              // quanti vertici finora
    this.pezzo = 0;          // numero progressivo dei pezzi
  }

  /**
   * Aggiunge una geometria trasformata da una matrice.
   * colore: [r,g,b] oppure una funzione (x,y,z, nx,ny,nz) → [r,g,b] (per sfumature)
   */
  aggiungi(geo, m, colore, tipo = 0) {
    const pos = geo.attributes.position, nor = geo.attributes.normal;
    _n3.getNormalMatrix(m);
    const seme = ((this.pezzo++ * 0.6180339) % 1);
    const fn = typeof colore === 'function' ? colore : null;
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(m);
      _w.fromBufferAttribute(nor, i).applyMatrix3(_n3).normalize();
      this.pos.push(_v.x, _v.y, _v.z);
      this.nor.push(_w.x, _w.y, _w.z);
      const c = fn ? fn(_v.x, _v.y, _v.z, _w.x, _w.y, _w.z) : colore;
      this.col.push(c[0], c[1], c[2]);
      this.info.push(tipo, seme);
    }
    if (geo.index) { const a = geo.index.array; for (let i = 0; i < a.length; i++) this.ind.push(a[i] + this.n); }
    else for (let i = 0; i < pos.count; i++) this.ind.push(i + this.n);
    this.n += pos.count;
    geo.dispose();
    return this;
  }

  /** Scatola centrata in (x,y,z). opz: { r: smusso, rot: [rx,ry,rz], tipo, seg } */
  scatola(x, y, z, w, h, d, colore, opz = {}) {
    const g = opz.r ? scatolaTonda(w, h, d, opz.r, opz.seg || 1) : new THREE.BoxGeometry(w, h, d, opz.sx || 1, opz.sy || 1, opz.sz || 1);
    return this.aggiungi(g, matrice(x, y, z, opz.rot), colore, opz.tipo || 0);
  }
  /** Cilindro verticale con la base a (x,y,z) e alto h (opz.rot per inclinarlo). */
  cilindro(x, y, z, rSopra, rSotto, h, colore, opz = {}) {
    const g = new THREE.CylinderGeometry(rSopra, rSotto, h, opz.seg || 10, opz.segH || 1, !!opz.aperto);
    g.translate(0, h / 2, 0);
    return this.aggiungi(g, matrice(x, y, z, opz.rot, opz.scala), colore, opz.tipo || 0);
  }
  /** Sfera (o ellissoide con opz.scala = [sx,sy,sz]). */
  sfera(x, y, z, r, colore, opz = {}) {
    const g = new THREE.SphereGeometry(r, opz.seg || 12, opz.segV || 8);
    return this.aggiungi(g, matrice(x, y, z, opz.rot, opz.scala), colore, opz.tipo || 0);
  }
  /** Un "batuffolo" bitorzoluto. */
  batuffolo(x, y, z, r, colore, opz = {}) {
    return this.aggiungi(batuffolo(r, opz.dettaglio === undefined ? 1 : opz.dettaglio, opz.bozzi === undefined ? 0.18 : opz.bozzi, opz.seme || x * 3.1 + z * 1.7),
      matrice(x, y, z, opz.rot, opz.scala), colore, opz.tipo || 0);
  }
  /** Forma al tornio con la base in (x,y,z). */
  tornio(x, y, z, profilo, colore, opz = {}) {
    return this.aggiungi(tornio(profilo, opz.seg || 16), matrice(x, y, z, opz.rot, opz.scala), colore, opz.tipo || 0);
  }

  /** Segna il punto: le prossime forme aggiunte potranno essere ritoccate insieme. */
  segna() { return this.n; }
  /**
   * "Ammorbidisce" le normali delle forme aggiunte dopo segna(): le fa
   * guardare verso l'esterno di un'unica grande forma (centro c, grandezza s).
   * Così tanti batuffoli di foglie si illuminano come UNA chioma morbida.
   */
  ammorbidisci(da, c, s, quanto = 0.75) {
    for (let i = da; i < this.n; i++) {
      const k = i * 3;
      _v.set((this.pos[k] - c.x) / s.x, (this.pos[k + 1] - c.y) / s.y, (this.pos[k + 2] - c.z) / s.z).normalize();
      _w.set(this.nor[k], this.nor[k + 1], this.nor[k + 2]).lerp(_v, quanto).normalize();
      this.nor[k] = _w.x; this.nor[k + 1] = _w.y; this.nor[k + 2] = _w.z;
    }
  }

  /**
   * Incolla tutto in una sola BufferGeometry.
   * deforma(p) può spostare ogni punto (per rendere le forme meno "perfette").
   */
  costruisci(deforma) {
    const pos = new Float32Array(this.pos);
    if (deforma) { const p = new THREE.Vector3(); for (let i = 0; i < pos.length; i += 3) { p.set(pos[i], pos[i + 1], pos[i + 2]); deforma(p); pos[i] = p.x; pos[i + 1] = p.y; pos[i + 2] = p.z; } }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.col), 3));
    g.setAttribute('aInfo', new THREE.BufferAttribute(new Float32Array(this.info), 2));
    g.setIndex(this.n > 65535 ? new THREE.BufferAttribute(new Uint32Array(this.ind), 1) : new THREE.BufferAttribute(new Uint16Array(this.ind), 1));
    g.computeBoundingSphere();
    this.pos = this.nor = this.col = this.info = this.ind = null;
    return g;
  }
}

/** Dà un colore unico (o una funzione colore) a una geometria (per i personaggi). */
export function colora(geo, colore, tipo = 0) {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const c = new Float32Array(pos.count * 3), info = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const k = typeof colore === 'function' ? colore(pos.getX(i), pos.getY(i), pos.getZ(i), nor.getX(i), nor.getY(i), nor.getZ(i)) : colore;
    c[i * 3] = k[0]; c[i * 3 + 1] = k[1]; c[i * 3 + 2] = k[2];
    info[i * 2] = tipo; info[i * 2 + 1] = 0.5;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  geo.setAttribute('aInfo', new THREE.BufferAttribute(info, 2));
  return geo;
}
