/* ==========================================================================
 *  scena.js — IL TEATRINO DI UNA SCENA
 *  --------------------------------------------------------------------------
 *  Monta una scena a partire dalla sua descrizione (js/dati/scene/*.js):
 *    1. fa DIPINGERE i piani (strati) dal modulo di arte della scena
 *    2. li appende nello spazio con il materiale speciale (percezione,
 *       schizzo a matita, onde, acqua che scorre, foglie che tremano)
 *    3. aggiunge il cielo, i panorami lontani, le nuvole, gli uccelli
 *    4. crea gli attori, le porte, i punti da toccare, i suoni
 *  Quando si lascia la scena, "smonta" libera la memoria della scheda
 *  grafica (importante sui telefoni).
 * ========================================================================== */
import * as THREE from 'three';
import { Galleria } from '../arte/galleria.js';
import { geometriaStrato, textureDaTela } from './strati.js';
import { materialeStrato, materialeCielo, materialeAnello } from './materiali.js';
import { Sagoma } from './sagoma.js';
import { Percorso } from '../gioco/percorso.js';
import { Percezione } from '../gioco/percezione.js';
import { creaAttore, Persona } from '../gioco/attori.js';

/* I moduli di arte che dipingono le scene (si caricano solo quando servono). */
const MODULI = {
  scene_via: () => import('../arte/scene_via.js'),
  scene_piazza: () => import('../arte/scene_piazza.js'),
  scene_canale: () => import('../arte/scene_canale.js'),
  scene_varie: () => import('../arte/scene_varie.js'),
};

/** Dipinge (o prende dalla memoria) gli strati di una scena. */
const dipinti = new Map();
async function dipingi(arte) {
  const chiave = arte.modulo + ':' + arte.nome;
  if (dipinti.has(chiave)) return dipinti.get(chiave);
  let strati = [];
  try {
    const m = await MODULI[arte.modulo]();
    const r = await m.dipingiScena(arte.nome);
    strati = (r && r.strati) || [];
  } catch (errore) {
    console.error('Non riesco a dipingere la scena', chiave, errore);
  }
  dipinti.set(chiave, strati);
  return strati;
}

/** Dimentica i dipinti delle scene che non servono più (memoria del telefono). */
export function dimenticaDipinti(tranne) {
  for (const k of [...dipinti.keys()]) if (!tranne.includes(k)) dipinti.delete(k);
}

/** Centro e ingombro di uno strato (per l'ordine di disegno e i fondali lontani). */
function ingombro(d) {
  const L = d.larghezza, A = d.altezza !== undefined ? d.altezza : d.profondita;
  switch (d.normale) {
    case 'x+': case 'x-': return { x0: d.x, x1: d.x, z0: d.z, z1: d.z + L, y0: d.y, y1: d.y + A };
    case 'su': case 'giu': return { x0: d.x, x1: d.x + L, z0: d.z, z1: d.z + A, y0: d.y, y1: d.y };
    default: return { x0: d.x, x1: d.x + L, z0: d.z, z1: d.z, y0: d.y, y1: d.y + A };
  }
}

export class Scena {
  constructor(def, gioco) {
    this.def = def;
    this.id = def.id;
    this.gioco = gioco;
    this.gruppo = new THREE.Group();
    this.percorso = new Percorso(def.percorso);
    this.animati = [];
    this.attori = [];
    this.interazioni = [];
    this.ostacoli = (def.ostacoli || []).map((o) => ({ ...o, scoperto: false }));
    this.daSmontare = [];
    // area della percezione: il percorso con un ampio margine intorno
    const P = this.percorso.punti;
    const xs = P.map((p) => p.x), zs = P.map((p) => p.z);
    const m = def.margine || 14;
    const area = def.percezione || {
      x: Math.min(...xs) - m, z: Math.min(...zs) - m,
      larghezza: Math.max(...xs) - Math.min(...xs) + 2 * m,
      profondita: Math.max(...zs) - Math.min(...zs) + 2 * m,
    };
    this.percezione = new Percezione(area);
  }

  /** Prepara tutto (dipinge i piani: può richiedere un paio di secondi). */
  async monta() {
    const def = this.def;
    const anis = this.gioco.renderer.capabilities.getMaxAnisotropy();
    // --- 1. i piani dipinti --------------------------------------------
    const strati = await dipingi(def.arte);
    for (const d of strati) {
      if (!d || !d.tela) continue;
      const tex = textureDaTela(d.tela, Math.min(8, anis));
      const b = ingombro(d);
      const lontano = d.lontano !== undefined ? d.lontano
        : (this.percezione.fuori(b.x0, b.z0, 1) && this.percezione.fuori(b.x1, b.z1, 1) && this.percezione.fuori((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, 1));
      const mat = materialeStrato(tex, { acqua: d.acqua, tremola: d.tremola, luce: d.luce, lontano, pavimento: d.normale === 'su' || d.normale === 'giu' });
      const geo = geometriaStrato(d);
      // spostiamo la geometria intorno al suo centro: così l'ordine di disegno
      // dei piani trasparenti (dal più lontano al più vicino) è corretto
      const c = new THREE.Vector3((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2);
      geo.translate(-c.x, -c.y, -c.z);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(c);
      mesh.renderOrder = (d.normale === 'su' || d.normale === 'giu') ? -20 + (d.ordine || 0) : (d.ordine || 0);
      mesh.name = d.nome || '';
      this.gruppo.add(mesh);
      this.daSmontare.push(tex, geo, mat);
    }
    // --- 2. il cielo e i panorami ----------------------------------------
    if (def.cielo) this._cielo(def.cielo);
    // --- 3. oggetti decorativi (sagome) -----------------------------------
    this.oggetti = (def.oggetti || []).map((o) => this._oggetto(o));
    // --- 4. attori e interazioni -------------------------------------------
    for (const a of def.attori || []) {
      const att = creaAttore(this.gioco, a);
      att.aggiungiA(this.gruppo);
      if (a.visibile === false) att.visibile = false;
      this.attori.push(att);
      if (att instanceof Persona && a.parla !== false) {
        this.interazioni.push({ id: att.id, tipo: 'persona', attore: att, raggio: 1.3, etichetta: 'Parla', attiva: true });
      }
    }
    for (const p of def.porte || []) this.interazioni.push({ raggio: 0.9, etichetta: 'Entra', ...p, tipo: 'porta', attiva: p.attiva !== false });
    for (const i of def.interazioni || []) this.interazioni.push({ raggio: 0.9, ...i, tipo: 'evento', attiva: !!i.attiva });
    return this;
  }

  /* ---------------------------------------------------------------------- */
  _cielo(C) {
    const tex = Galleria.atlante('cielo').texture;
    tex.wrapS = THREE.RepeatWrapping;
    this.cupola = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), materialeCielo(tex));
    this.cupola.renderOrder = -100;
    this.cupola.frustumCulled = false;
    this.gruppo.add(this.cupola);
    this.daSmontare.push(this.cupola.geometry, this.cupola.material);

    const P = this.percorso.punti;
    const centro = new THREE.Vector3((P[0].x + P[P.length - 1].x) / 2, 0, (P[0].z + P[P.length - 1].z) / 2);
    this.centro = centro;
    // anelli di panorama (città lontana, colline), dal più lontano al più vicino
    (C.sfondi || []).forEach((s, k) => {
      const at = Galleria.atlante(s.arte);
      at.texture.wrapS = THREE.RepeatWrapping;
      const ripeti = s.ripeti || 3;
      const alt = s.altezza || ((2 * Math.PI * s.raggio) / ripeti) * (at.cella.a / at.cella.l);
      const geo = new THREE.CylinderGeometry(s.raggio, s.raggio, alt, 96, 1, true);
      const mesh = new THREE.Mesh(geo, materialeAnello(at.texture, ripeti, s.foschia || 0));
      mesh.position.set(centro.x, (s.y || 0) + alt / 2, centro.z);
      mesh.rotation.y = s.rotazione || 0;
      mesh.renderOrder = -90 + k;
      mesh.frustumCulled = false;
      this.gruppo.add(mesh);
      this.daSmontare.push(geo, mesh.material);
    });
    // nuvole che scorrono piano, lontane dietro le case
    for (let k = 0; k < (C.nuvole || 0); k++) {
      const s = new Sagoma('nuvola', { cielo: true, ancora: 0.5, scala: 0.9 + (k % 3) * 0.4 });
      s.mostra('f' + (k % 4), k % 2 === 1);
      s.mesh.renderOrder = -80;
      s.aggiungiA(this.gruppo);
      const ang0 = (k / C.nuvole) * Math.PI * 2, r = 120 + ((k * 47) % 70), h = 30 + ((k * 13) % 26);
      let ang = ang0;
      const vel = 0.0025 + (k % 3) * 0.0012;
      this.animati.push((dt) => {
        ang += vel * dt;
        s.posiziona(centro.x + Math.cos(ang) * r, h, centro.z + Math.sin(ang) * r);
      });
    }
    // stormi di uccellini che passano nel cielo
    for (let k = 0; k < (C.uccelli || 0); k++) {
      const stormo = [];
      for (let u = 0; u < 5; u++) {
        const s = new Sagoma('uccellino', { cielo: true, ancora: 0.5, scala: 2.2 });
        s.mesh.renderOrder = -79;
        s.aggiungiA(this.gruppo);
        stormo.push({ s, off: [Math.cos(u * 2.4) * 2, Math.sin(u * 1.7) * 1, Math.sin(u * 2.4) * 2], fase: u * 0.7 });
      }
      let ang = k * 2.1;
      const r = 30 + k * 10, h = 14 + k * 4;
      this.animati.push((dt, t, cam) => {
        ang += dt * 0.07;
        const x = centro.x + Math.cos(ang) * r, z = centro.z - 18 + Math.sin(ang) * r * 0.5;
        const vx = -Math.sin(ang), vz = Math.cos(ang) * 0.5;
        const e = cam.matrixWorld.elements;
        const specchio = vx * e[0] + vz * e[2] < 0;
        for (const b of stormo) {
          b.s.posiziona(x + b.off[0], h + b.off[1] + Math.sin(t * 2 + b.fase) * 0.4, z + b.off[2]);
          b.s.mostra('f' + (Math.floor(t * 10 + b.fase * 3) % 4), specchio);
        }
      });
    }
    // la balena che nuota nel cielo (nel mondo immaginato)
    if (C.balena) {
      const s = new Sagoma('balena', { cielo: true, ancora: 0.5, scala: 1.3 });
      s.mesh.renderOrder = -78;
      s.aggiungiA(this.gruppo);
      let ang = C.balena.fase || 0.4;
      const r = C.balena.raggio || 90;
      this.balena = s;
      this.animati.push((dt, t, cam) => {
        ang += dt * 0.03;
        const x = centro.x + Math.cos(ang) * r, z = centro.z - 30 + Math.sin(ang) * r * 0.45;
        const vx = -Math.sin(ang), vz = Math.cos(ang) * 0.45;
        const e = cam.matrixWorld.elements;
        if (!this.balenaLibera) s.posiziona(x, (C.balena.altezza || 34) + Math.sin(t * 0.4) * 2, z);
        s.mostra('f' + (Math.floor(t * 0.8) % 2), vx * e[0] + vz * e[2] < 0);
      });
    }
    // palloncini che salgono
    for (let k = 0; k < (C.palloncini || 0); k++) {
      const s = new Sagoma('palloncino', { cielo: true, ancora: 0.5, scala: 1.4 });
      s.aggiungiA(this.gruppo);
      const bx = centro.x + Math.cos(k * 2.3) * 22, bz = centro.z - 14 - k * 5;
      let h = 4 + k * 7;
      this.animati.push((dt, t) => {
        h += dt * 0.6;
        if (h > 45) h = 2;
        s.posiziona(bx + Math.sin(t * 0.5 + k) * 1.5, h, bz);
      });
    }
  }

  _oggetto(o) {
    const s = new Sagoma(o.arte, {
      scala: o.scala || 1, ombra: o.ombra, oscilla: o.oscilla, ancora: o.appeso ? 1 : (o.ancora || 0),
      luce: o.luce, piatto: o.piatto, cielo: o.cielo,
    });
    if (o.fotogramma) s.mostra(o.fotogramma, !!o.specchio);
    else if (o.specchio) s.mostra(s.atlante.nomi[0], true);
    const y = o.y !== undefined ? o.y : this.quota(o.x, o.z);
    s.posiziona(o.x, y, o.z);
    s.aggiungiA(this.gruppo);
    if (o.animazione) {
      // alterna i fotogrammi (fuoco del forno, foglie, libro che vola...)
      const nomi = s.atlante.nomi;
      const fps = o.animazione;
      this.animati.push((dt, t) => s.mostra(nomi[Math.floor(t * fps) % nomi.length], !!o.specchio));
    }
    return { id: o.id, sagoma: s };
  }

  /* ---------------------------------------------------------------------- */
  /*  Domande sulla scena                                                   */
  /* ---------------------------------------------------------------------- */
  /** Altezza del pavimento in (x, z): segue il percorso (ponti, scale). */
  quota(x, z) {
    const v = this.percorso.piuVicino(x, z);
    if (v.distanza > (this.def.larghezzaPercorso || 3)) return this.def.suolo || 0;
    return this.percorso.punto(v.s).y;
  }

  /** Che cosa c'è sotto i piedi in s? ('pietra', 'legno', 'erba') */
  superficie(s) {
    for (const t of this.def.superfici || []) if (s >= t.da && s <= t.a) return t.tipo;
    return this.def.superficie || 'pietra';
  }

  /**
   * C'è un ostacolo "invisibile" tra s0 e s1? Nel mondo bianco Lia sbatte
   * contro le cose che non ha ancora percepito (come l'albero del film).
   */
  ostacoloTra(s0, s1) {
    if (this.percezione.rivelaTutto > 0.5) return null;
    for (const o of this.ostacoli) {
      if (o.scoperto || o.attivo === false) continue;
      const attraversa = (s0 < o.s && s1 >= o.s) || (s0 > o.s && s1 <= o.s);
      if (!attraversa) continue;
      const p = this.percorso.punto(o.s);
      if (this.percezione.valore(p.x, p.z + (o.dz || 0)) > 0.45) { o.scoperto = true; continue; }
      o.scoperto = true;   // dopo l'urto lo conosce: la prossima volta passa
      return o;
    }
    return null;
  }

  attore(id) { return this.attori.find((a) => a.id === id) || null; }
  oggetto(id) { const o = (this.oggetti || []).find((x) => x.id === id); return o ? o.sagoma : null; }

  /** A ogni fotogramma: cielo che segue la camera, nuvole, uccelli... */
  aggiorna(dt, t, camera) {
    if (this.cupola) this.cupola.position.copy(camera.position);
    for (const f of this.animati) f(dt, t, camera);
  }

  /** Libera la memoria della scheda grafica. */
  smonta() {
    this.gruppo.removeFromParent();
    for (const a of this.attori) { if (a.silenzia) a.silenzia(); }
    for (const r of this.daSmontare) if (r && r.dispose) r.dispose();
    this.daSmontare = [];
  }
}
