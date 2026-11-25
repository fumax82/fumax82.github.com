/* ==========================================================================
 *  costruttore.js — DALLA MAPPA AL MONDO 3D
 *  --------------------------------------------------------------------------
 *  Trasforma un luogo (mappa di caratteri + elenco di oggetti) in oggetti 3D:
 *    - PAVIMENTI: un quadrato per casella, alla quota giusta; dove due
 *      caselle hanno quote diverse nasce un gradino (marciapiede, argine)
 *    - MURI: solo le facce che si vedono (verso caselle libere)
 *    - CIME dei muri bassi (staccionate, muretti, siepi) e SOFFITTI degli interni
 *    - CIELO, SFONDI PANORAMICI, NUVOLE, UCCELLI, BALENA...
 *    - OGGETTI decorativi come sagome di carta
 *  Per essere veloce mette insieme tutte le facce con la stessa texture
 *  in un unico oggetto 3D.
 * ========================================================================== */
import * as THREE from 'three';
import { Galleria } from '../arte/galleria.js';
import { materialeSuperficie, materialeCielo, materialeAnello } from './materiali.js';
import { Sagoma } from './sagoma.js';
import { OGGETTI } from '../dati/tipi.js';

/** Raccoglie vertici e coordinate di texture per costruire una geometria. */
class Raccoglitore {
  constructor() { this.pos = []; this.uv = []; this.norm = []; this.ind = []; }
  /** Aggiunge un quadrilatero (4 punti in ordine, con le loro uv e la normale). */
  quad(p, uv, n) {
    const base = this.pos.length / 3;
    for (let k = 0; k < 4; k++) {
      this.pos.push(p[k][0], p[k][1], p[k][2]);
      this.uv.push(uv[k][0], uv[k][1]);
      this.norm.push(n[0], n[1], n[2]);
    }
    this.ind.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  geometria() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.norm, 3));
    g.setIndex(this.ind);
    g.computeBoundingSphere();
    return g;
  }
}

/** Texture di un solo colore (per le cime dei muri). */
const cacheTinte = {};
function textureTinta(colore) {
  const chiave = colore.getHexString();
  if (cacheTinte[chiave]) return cacheTinte[chiave];
  const d = new Uint8Array([colore.r * 255, colore.g * 255, colore.b * 255, 0]);
  const t = new THREE.DataTexture(d, 1, 1, THREE.RGBAFormat);
  t.needsUpdate = true;
  cacheTinte[chiave] = t;
  return t;
}

// Direzioni dei 4 vicini: dx, dy e i due spigoli della faccia condivisa
const LATI = [
  { dx: 1, dy: 0 },  // est
  { dx: -1, dy: 0 }, // ovest
  { dx: 0, dy: 1 },  // sud
  { dx: 0, dy: -1 }, // nord
];

/**
 * Punti di una faccia verticale sul lato "lato" della casella (cx, cy).
 * Restituisce l'inizio e la fine del segmento (in ordine "da sinistra a
 * destra" guardando la faccia da fuori) e la normale verso l'esterno.
 */
function segmentoLato(cx, cy, lato) {
  if (lato.dx === 1) return { a: [cx + 1, cy + 1], b: [cx + 1, cy], n: [1, 0, 0] };
  if (lato.dx === -1) return { a: [cx, cy], b: [cx, cy + 1], n: [-1, 0, 0] };
  if (lato.dy === 1) return { a: [cx, cy + 1], b: [cx + 1, cy + 1], n: [0, 0, 1] };
  return { a: [cx + 1, cy], b: [cx, cy], n: [0, 0, -1] };
}

/* ------------------------------------------------------------------------ */
/*  Costruzione di un luogo                                                 */
/* ------------------------------------------------------------------------ */
export function costruisciLuogo(mondo, luogo) {
  const gruppo = new THREE.Group();
  gruppo.name = 'luogo:' + luogo.id;
  const W = mondo.larghezza, H = mondo.altezza;

  /* ---- Pavimenti e gradini ---------------------------------------------- */
  const pavimenti = {};   // nome texture → Raccoglitore
  const prendi = (nome) => (pavimenti[nome] = pavimenti[nome] || new Raccoglitore());
  for (let cy = 0; cy < H; cy++) {
    for (let cx = 0; cx < W; cx++) {
      const i = mondo.indice(cx, cy);
      const p = mondo.pavimento[i];
      if (!p || !p.texture || mondo.altezzaMuro[i] > 0) continue;
      const q = mondo.quotaCella[i];
      const r = prendi(p.texture);
      // quadrato orizzontale (uv = coordinate del mondo: la texture si ripete ogni casella)
      r.quad(
        [[cx, q, cy], [cx, q, cy + 1], [cx + 1, q, cy + 1], [cx + 1, q, cy]],
        [[cx, -cy], [cx, -cy - 1], [cx + 1, -cy - 1], [cx + 1, -cy]],
        [0, 1, 0]
      );
      // gradini verso i vicini più bassi (bordo del marciapiede, argine del canale)
      for (const lato of LATI) {
        const nx = cx + lato.dx, ny = cy + lato.dy;
        if (!mondo.dentro(nx, ny)) continue;
        const j = mondo.indice(nx, ny);
        if (mondo.altezzaMuro[j] > 0 || !mondo.pavimento[j] || !mondo.pavimento[j].texture) continue;
        const qn = mondo.quotaCella[j];
        if (qn >= q - 0.001) continue;
        const s = segmentoLato(cx, cy, lato);
        r.quad(
          [[s.a[0], qn, s.a[1]], [s.b[0], qn, s.b[1]], [s.b[0], q, s.b[1]], [s.a[0], q, s.a[1]]],
          [[0, qn], [1, qn], [1, q], [0, q]],
          s.n
        );
      }
    }
  }
  for (const [nome, r] of Object.entries(pavimenti)) {
    if (!r.pos.length) continue;
    const info = Galleria.pavimento(nome);
    const acqua = nome === 'acqua';
    const mat = materialeSuperficie(info.texture, acqua ? { scorri: [0.04, 0.015], brillio: 0.35, occlusione: 0.4 } : {});
    const mesh = new THREE.Mesh(r.geometria(), mat);
    mesh.name = 'pavimento:' + nome;
    gruppo.add(mesh);
  }

  /* ---- Muri ------------------------------------------------------------- */
  const muri = {};
  const cime = {};
  for (let cy = 0; cy < H; cy++) {
    for (let cx = 0; cx < W; cx++) {
      const i = mondo.indice(cx, cy);
      const h = mondo.altezzaMuro[i];
      if (h <= 0) continue;
      const nome = mondo.muro[i];
      const r = (muri[nome] = muri[nome] || new Raccoglitore());
      for (const lato of LATI) {
        const nx = cx + lato.dx, ny = cy + lato.dy;
        if (!mondo.dentro(nx, ny)) continue;
        const j = mondo.indice(nx, ny);
        const hn = mondo.altezzaMuro[j];
        if (hn >= h) continue; // nascosta dal vicino
        const s = segmentoLato(cx, cy, lato);
        const y0 = hn > 0 ? hn : -0.35;
        r.quad(
          [[s.a[0], y0, s.a[1]], [s.b[0], y0, s.b[1]], [s.b[0], h, s.b[1]], [s.a[0], h, s.a[1]]],
          [[0, y0 / h], [1, y0 / h], [1, 1], [0, 1]],
          s.n
        );
      }
      // cima piatta per i muri bassi (si vedono dall'alto in terza persona)
      if (h < 2.2) {
        const rc = (cime[nome] = cime[nome] || new Raccoglitore());
        rc.quad([[cx, h, cy], [cx, h, cy + 1], [cx + 1, h, cy + 1], [cx + 1, h, cy]],
          [[0, 0], [0, 1], [1, 1], [1, 0]], [0, 1, 0]);
      }
    }
  }
  for (const [nome, r] of Object.entries(muri)) {
    if (!r.pos.length) continue;
    const mesh = new THREE.Mesh(r.geometria(), materialeSuperficie(Galleria.muro(nome).texture));
    mesh.name = 'muro:' + nome;
    gruppo.add(mesh);
  }
  for (const [nome, r] of Object.entries(cime)) {
    const colore = Galleria.muro(nome).cima.clone().multiplyScalar(0.92);
    const mesh = new THREE.Mesh(r.geometria(), materialeSuperficie(textureTinta(colore), { occlusione: 0 }));
    gruppo.add(mesh);
  }

  /* ---- Soffitto degli interni ------------------------------------------ */
  if (luogo.soffitto) {
    const r = new Raccoglitore();
    const q = luogo.soffitto.altezza;
    for (let cy = 0; cy < H; cy++) {
      for (let cx = 0; cx < W; cx++) {
        if (!mondo.pavimento[mondo.indice(cx, cy)] || !mondo.pavimento[mondo.indice(cx, cy)].texture) continue;
        r.quad([[cx, q, cy], [cx + 1, q, cy], [cx + 1, q, cy + 1], [cx, q, cy + 1]],
          [[cx, -cy], [cx + 1, -cy], [cx + 1, -cy - 1], [cx, -cy - 1]], [0, -1, 0]);
      }
    }
    const info = Galleria.pavimento(luogo.soffitto.texture || 'soffitto_travi');
    gruppo.add(new THREE.Mesh(r.geometria(), materialeSuperficie(info.texture, { occlusione: 0 })));
  }

  /* ---- Cielo e decorazioni del cielo ------------------------------------ */
  const animati = [];    // funzioni da chiamare a ogni fotogramma
  const cielo = luogo.cielo;
  let cupola = null;
  if (cielo) {
    const atl = Galleria.atlante('cielo');
    const tex = atl.texture;
    tex.wrapS = THREE.RepeatWrapping;
    cupola = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), materialeCielo(tex));
    cupola.renderOrder = -100;
    cupola.frustumCulled = false;
    gruppo.add(cupola);

    const centro = new THREE.Vector3(W / 2, 0, H / 2);
    // anelli panoramici (dal più lontano al più vicino)
    (cielo.sfondi || []).forEach((s, k) => {
      const at = Galleria.atlante(s.arte);
      at.texture.wrapS = THREE.RepeatWrapping;
      const ripeti = s.ripeti || 3;
      const altezza = s.altezza || ((2 * Math.PI * s.raggio) / ripeti) * (at.cella.a / at.cella.l);
      const geo = new THREE.CylinderGeometry(s.raggio, s.raggio, altezza, 96, 1, true);
      const mesh = new THREE.Mesh(geo, materialeAnello(at.texture, ripeti, s.foschia || 0));
      mesh.position.set(centro.x, (s.y || 0) + altezza / 2, centro.z);
      mesh.rotation.y = s.rotazione || 0;
      mesh.renderOrder = -90 + k;
      mesh.frustumCulled = false;
      gruppo.add(mesh);
    });

    // nuvole che scorrono lentamente attorno al luogo
    const nNuvole = cielo.nuvole || 0;
    for (let k = 0; k < nNuvole; k++) {
      const s = new Sagoma('nuvola', { cielo: true, trasparente: true, ancora: 0.5, scala: 1.1 + (k % 3) * 0.35 });
      s.mostra('f' + (k % 4), k % 2 === 1);
      s.aggiungiA(gruppo);
      const raggio = 75 + (k * 37) % 50, altezza = 22 + (k * 13) % 20;
      let ang = (k / nNuvole) * Math.PI * 2;
      const vel = 0.004 + (k % 3) * 0.002;
      s.mesh.renderOrder = -80;
      animati.push((dt) => {
        ang += vel * dt;
        s.posiziona(centro.x + Math.cos(ang) * raggio, centro.z + Math.sin(ang) * raggio, altezza);
      });
    }

    // stormi di uccellini
    for (let k = 0; k < (cielo.uccelli || 0); k++) {
      const stormo = [];
      for (let u = 0; u < 5; u++) {
        const s = new Sagoma('uccellino', { cielo: true, trasparente: true, ancora: 0.5, scala: 1.6 });
        s.aggiungiA(gruppo);
        stormo.push({ s, off: [Math.cos(u * 2.4) * 1.6, Math.sin(u * 1.7) * 0.8, Math.sin(u * 2.4) * 1.6], fase: u * 0.7 });
      }
      let ang = k * 2.1;
      const raggio = 14 + k * 6, altezza = 9 + k * 3;
      const cx = centro.x + (k ? 8 : -6), cz = centro.z;
      animati.push((dt, t, camera) => {
        ang += dt * 0.12;
        const x = cx + Math.cos(ang) * raggio, z = cz + Math.sin(ang) * raggio;
        // direzione di volo rispetto alla telecamera: serve per specchiare il disegno
        const vx = -Math.sin(ang), vz = Math.cos(ang);
        const destra = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        const specchio = vx * destra.x + vz * destra.z < 0;
        for (const b of stormo) {
          b.s.posiziona(x + b.off[0], z + b.off[2], altezza + b.off[1] + Math.sin(t * 2 + b.fase) * 0.3);
          b.s.mostra('f' + (Math.floor(t * 10 + b.fase * 3) % 4), specchio);
        }
      });
    }

    // la balena che nuota nel cielo
    if (cielo.balena) {
      const s = new Sagoma('balena', { cielo: true, trasparente: true, ancora: 0.5, scala: 1.4 });
      s.aggiungiA(gruppo);
      let ang = 0.5;
      animati.push((dt, t, camera) => {
        ang += dt * 0.035;
        const r = 58;
        const x = centro.x + Math.cos(ang) * r, z = centro.z + Math.sin(ang) * r;
        const vx = -Math.sin(ang), vz = Math.cos(ang);
        const destra = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        s.posiziona(x, z, 34 + Math.sin(t * 0.4) * 2);
        s.mostra('f' + (Math.floor(t * 0.8) % 2), vx * destra.x + vz * destra.z < 0);
      });
      gruppo.userData.balena = s;
    }

    // palloncini che salgono
    for (let k = 0; k < (cielo.palloncini || 0); k++) {
      const s = new Sagoma('palloncino', { cielo: true, trasparente: true, ancora: 0.5, scala: 1.2 });
      s.aggiungiA(gruppo);
      const bx = centro.x + Math.cos(k * 2.3) * (W * 0.4), bz = centro.z + Math.sin(k * 2.3) * (H * 0.4);
      let h = 4 + k * 6;
      animati.push((dt, t) => {
        h += dt * 0.6;
        if (h > 40) h = 2;
        s.posiziona(bx + Math.sin(t * 0.5 + k) * 1.5, bz, h);
      });
    }
  }

  /* ---- Oggetti decorativi ----------------------------------------------- */
  const oggetti = [];
  for (const def of luogo.oggetti || []) {
    const tipo = OGGETTI[def.tipo] || { arte: def.tipo };
    const arte = def.arte || tipo.arte;
    const s = new Sagoma(arte, {
      scala: def.scala || tipo.scala || 1,
      ombra: def.ombra !== undefined ? def.ombra : tipo.ombra,
      oscilla: def.oscilla !== undefined ? def.oscilla : tipo.oscilla,
      ancora: tipo.ancoraAlto || def.appeso ? 1 : (def.ancora || 0),
      luce: def.luce !== undefined ? def.luce : tipo.luce,
      piatto: def.piatto,
    });
    const quota = mondo.quota(def.x, def.y);
    const z = def.z || 0;
    s.quotaTerreno(quota);
    s.posiziona(def.x, def.y, quota + z);
    if (def.fotogramma) s.mostra(def.fotogramma, def.specchio);
    else if (def.specchio) s.mostra(s.atlante.nomi[0], true);
    s.aggiungiA(gruppo);
    const fps = def.animazione !== undefined ? def.animazione : tipo.animazione;
    const fotogrammi = s.atlante.nomi.filter((n) => /^f\d+$/.test(n));
    if (fps && fotogrammi.length > 1 && !def.orbita) {
      const sfas = Math.random() * 10;
      animati.push((dt, t) => s.mostra(fotogrammi[Math.floor(t * fps + sfas) % fotogrammi.length], def.specchio));
    }
    // oggetti magici che fluttuano su e giù (pani nell'aria...)
    if (def.fluttua) {
      const fase = Math.random() * 6;
      animati.push((dt, t) => s.posiziona(def.x, def.y, quota + z + Math.sin(t * 1.3 + fase) * def.fluttua));
    }
    // oggetti che volano in cerchio (libri volanti, farfalle...)
    if (def.orbita) {
      const o = def.orbita;
      let ang = o.fase || 0;
      animati.push((dt, t, camera) => {
        ang += (o.velocita || 0.6) * dt;
        const x = o.cx + Math.cos(ang) * o.raggio, y = o.cy + Math.sin(ang) * o.raggio;
        const vx = -Math.sin(ang) * Math.sign(o.velocita || 1), vz = Math.cos(ang) * Math.sign(o.velocita || 1);
        const destra = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        const nomi = s.atlante.nomi;
        s.mostra(nomi[Math.floor(t * (fps || 6)) % nomi.length], vx * destra.x + vz * destra.z < 0);
        s.posiziona(x, y, quota + (o.z || 1.5) + Math.sin(t * 2 + ang) * 0.15);
      });
    }
    const solido = def.solido !== undefined ? def.solido : tipo.solido;
    if (solido) mondo.solidi.push({ x: def.x, y: def.y, raggio: def.raggio || tipo.raggio || 0.3 });
    oggetti.push({ def, sagoma: s, id: def.id });
  }

  return {
    gruppo,
    oggetti,
    cupola,
    /** Da chiamare a ogni fotogramma: anima nuvole, uccelli, oggetti. */
    aggiorna(dt, t, camera) {
      if (cupola) cupola.position.copy(camera.position);
      for (const f of animati) f(dt, t, camera);
    },
    oggetto(id) {
      const o = oggetti.find((x) => x.id === id);
      return o ? o.sagoma : null;
    },
  };
}
