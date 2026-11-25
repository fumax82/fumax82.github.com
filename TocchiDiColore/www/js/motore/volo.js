/* ==========================================================================
 *  volo.js — IL VOLO SULLA BALENA DEL CIELO
 *  --------------------------------------------------------------------------
 *  Una scena speciale: Lia vola sul dorso della balena sopra una città di
 *  casette colorate attraversata da un fiume-strada tortuoso pieno di
 *  macchinine (come nella veduta dall'alto del cortometraggio).
 *  La telecamera segue una curva nel cielo; le pinne della balena si
 *  vedono ai lati, in primo piano.
 *
 *  Per disegnare centinaia di casette velocemente usiamo le "istanze":
 *  la scheda grafica disegna tante copie dello stesso cubo, ognuna con
 *  posizione, grandezza e colore diversi.
 * ========================================================================== */
import * as THREE from 'three';
import { Galleria } from '../arte/galleria.js';
import { materialeCielo } from './materiali.js';
import { Sagoma } from './sagoma.js';
import { nuovaTela, casuale } from '../arte/pennello.js';

const COLORI_CASE = ['#f2b9b3', '#f5dc8f', '#b9d9e6', '#c4e5cc', '#f6c89f', '#d9c7ef', '#fbe7c6', '#f7c6d8', '#cfe3b5', '#f4a98e'];
const COLORI_TETTI = ['#d9785e', '#c2654f', '#7f8fbf', '#9a7fb8', '#6f9f86', '#e0a05a', '#b86f6f', '#8a6b9c'];

/** Una piccola texture di finestre disegnata al volo. */
function texturaFinestre() {
  const t = nuovaTela(128, 128);
  const c = t.getContext('2d');
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, 128, 128);
  c.fillStyle = 'rgba(95, 120, 160, 0.75)';
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
    c.beginPath();
    c.roundRect ? c.roundRect(14 + x * 38, 16 + y * 38, 22, 26, 8) : c.rect(14 + x * 38, 16 + y * 38, 22, 26);
    c.fill();
  }
  c.strokeStyle = 'rgba(107, 75, 55, 0.5)';
  c.lineWidth = 2;
  c.strokeRect(1, 1, 126, 126);
  const tex = new THREE.CanvasTexture(t);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export class Volo {
  constructor() {
    this.scena = new THREE.Scene();
    this.scena.background = new THREE.Color('#fbf6ea');
    this.camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 900);
    this.scena.add(this.camera);
    this.animati = [];
    this.tempo = 0;
    this._costruisci();
  }

  _costruisci() {
    const rng = casuale(2010);
    const S = this.scena;

    // cielo
    const cielo = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), materialeCielo(Galleria.atlante('cielo').texture));
    cielo.renderOrder = -100;
    this.cielo = cielo;
    S.add(cielo);

    // luci (qui usiamo i materiali "Lambert" di Three.js, illuminati da un sole)
    S.add(new THREE.AmbientLight(0xffffff, 1.9));
    const sole = new THREE.DirectionalLight(0xfff1dc, 1.6);
    sole.position.set(40, 80, 30);
    S.add(sole);

    // il fiume-strada: una curva morbida che attraversa la città
    const puntiFiume = [];
    for (let k = 0; k <= 12; k++) {
      const z = -180 + k * 30;
      puntiFiume.push(new THREE.Vector3(Math.sin(k * 0.7) * 28 + Math.sin(k * 1.9) * 8, 0, z));
    }
    this.fiume = new THREE.CatmullRomCurve3(puntiFiume);
    const nastro = (larghezza, colore, y) => {
      const pos = [], idx = [];
      const N = 240;
      for (let k = 0; k <= N; k++) {
        const t = k / N;
        const p = this.fiume.getPoint(t), d = this.fiume.getTangent(t);
        const nx = -d.z, nz = d.x;
        pos.push(p.x + nx * larghezza, y, p.z + nz * larghezza, p.x - nx * larghezza, y, p.z - nz * larghezza);
        if (k < N) { const b = k * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: colore, side: THREE.DoubleSide }));
      S.add(m);
    };
    nastro(9, '#f0b9a0', 0.02);   // marciapiedi rosa
    nastro(6.5, '#a9d4ec', 0.05); // il fiume azzurro

    // terreno chiaro
    const terra = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshLambertMaterial({ color: '#efe6cf' }));
    terra.rotation.x = -Math.PI / 2;
    S.add(terra);

    // casette: cubi + tetti a piramide, a migliaia
    const N = 1400;
    const corpo = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ map: texturaFinestre() }), N);
    const tetto = new THREE.InstancedMesh(new THREE.ConeGeometry(0.78, 1, 4).rotateY(Math.PI / 4),
      new THREE.MeshLambertMaterial(), N);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    const colore = new THREE.Color();
    let n = 0;
    for (let tentativi = 0; tentativi < N * 4 && n < N; tentativi++) {
      const x = (rng() - 0.5) * 300, z = (rng() - 0.5) * 380;
      // niente case dentro il fiume
      const t = Math.min(1, Math.max(0, (z + 180) / 360));
      const f = this.fiume.getPoint(t);
      if (Math.abs(x - f.x) < 11 + rng() * 2) continue;
      const l = 3 + rng() * 4, pr = 3 + rng() * 4, h = 3 + rng() * 6 + (Math.abs(x - f.x) < 20 ? 2 : 0);
      const ang = Math.round(rng() * 3) * (Math.PI / 2) + (rng() - 0.5) * 0.2;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang);
      p.set(x, h / 2, z); sc.set(l, h, pr);
      m.compose(p, q, sc);
      corpo.setMatrixAt(n, m);
      corpo.setColorAt(n, colore.set(COLORI_CASE[Math.floor(rng() * COLORI_CASE.length)]));
      p.set(x, h + 1.1, z); sc.set(l * 1.05, 2.2 + rng() * 1.5, pr * 1.05);
      m.compose(p, q, sc);
      tetto.setMatrixAt(n, m);
      tetto.setColorAt(n, colore.set(COLORI_TETTI[Math.floor(rng() * COLORI_TETTI.length)]));
      n++;
    }
    corpo.count = n; tetto.count = n;
    S.add(corpo, tetto);

    // alberelli tondi
    const NA = 300;
    const alberi = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial(), NA);
    for (let k = 0; k < NA; k++) {
      const x = (rng() - 0.5) * 320, z = (rng() - 0.5) * 380;
      const r = 1.5 + rng() * 2;
      p.set(x, r, z); sc.set(r, r * 1.1, r); q.identity();
      m.compose(p, q, sc);
      alberi.setMatrixAt(k, m);
      alberi.setColorAt(k, colore.set(['#8fc27f', '#7ab06f', '#a9d38f', '#9ccc8f'][k % 4]));
    }
    S.add(alberi);

    // macchinine colorate che scorrono lungo il fiume-strada
    const NM = 26;
    const auto = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 1.1, 2.8), new THREE.MeshLambertMaterial(), NM);
    const datiAuto = [];
    for (let k = 0; k < NM; k++) {
      datiAuto.push({ t: rng(), v: (0.008 + rng() * 0.01) * (k % 2 ? 1 : -1), lato: k % 2 ? 2.6 : -2.6 });
      auto.setColorAt(k, colore.set(['#f5d04e', '#e36b5e', '#4f6fa8', '#f2a541'][k % 4]));
    }
    S.add(auto);
    this.animati.push((dt) => {
      for (let k = 0; k < NM; k++) {
        const a = datiAuto[k];
        a.t = (a.t + a.v * dt + 1) % 1;
        const pt = this.fiume.getPoint(a.t), d = this.fiume.getTangent(a.t);
        p.set(pt.x - d.z * a.lato, 0.7, pt.z + d.x * a.lato);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(d.x, d.z));
        sc.set(1, 1, 1);
        m.compose(p, q, sc);
        auto.setMatrixAt(k, m);
      }
      auto.instanceMatrix.needsUpdate = true;
    });

    // nuvole: lontane dalla rotta della balena (ai lati e più in alto), così non coprono la città
    for (let k = 0; k < 18; k++) {
      const s = new Sagoma('nuvola', { cielo: true, trasparente: true, ancora: 0.5, scala: 1.6 + rng() * 1.8 });
      s.mostra('f' + (k % 4), k % 2 === 0);
      s.aggiungiA(S);
      const z = -170 + rng() * 340;
      const f = this.fiume.getPoint(Math.min(1, Math.max(0, (z + 180) / 360)));
      const lato = k % 2 ? 1 : -1;
      s.posiziona(f.x + lato * (45 + rng() * 70), z, 34 + rng() * 30);
    }

    // stormo di uccellini che ci accompagna
    this.uccelli = [];
    for (let k = 0; k < 6; k++) {
      const s = new Sagoma('uccellino', { cielo: true, trasparente: true, ancora: 0.5, scala: 2.2 });
      s.aggiungiA(S);
      this.uccelli.push({ s, off: new THREE.Vector3(-4 + k * 1.6, -1 + (k % 3) * 0.8, -10 - (k % 2) * 3), fase: k });
    }

    // le pinne della balena, "attaccate" alla telecamera
    this.pinne = [];
    for (const lato of [-1, 1]) {
      const s = new Sagoma('pinna', { cielo: true, trasparente: true, ancora: 0.5, scala: 0.24, piatto: 0 });
      s.mostra('f0', lato < 0);
      this.camera.add(s.mesh);
      s.mesh.position.set(lato * 1.45, -0.78, -1.7);
      s.mesh.rotation.z = lato * 0.25;
      this.pinne.push({ s, lato });
    }

    // la curva del volo: dall'inizio alla fine della città, alta nel cielo
    const puntiVolo = [];
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      const f = this.fiume.getPoint(0.08 + t * 0.84);
      puntiVolo.push(new THREE.Vector3(f.x + Math.sin(k * 1.3) * 14, 26 + Math.sin(k * 0.9) * 6, f.z));
    }
    this.percorso = new THREE.CatmullRomCurve3(puntiVolo);
  }

  ridimensiona(larghezza, altezza) {
    this.camera.aspect = larghezza / altezza;
    this.camera.updateProjectionMatrix();
  }

  /** Avanza il volo. t = 0..1 lungo il percorso. */
  aggiorna(dt, t) {
    this.tempo += dt;
    const pos = this.percorso.getPoint(Math.min(0.999, t));
    const avanti = this.percorso.getPoint(Math.min(1, t + 0.04));
    pos.y += Math.sin(this.tempo * 0.9) * 0.6;                      // la balena sale e scende
    this.camera.position.copy(pos);
    this.camera.lookAt(avanti.x, avanti.y - 9, avanti.z);
    this.camera.rotation.z += Math.sin(this.tempo * 0.5) * 0.04;     // leggero rollio
    this.cielo.position.copy(pos);
    for (const f of this.animati) f(dt);
    for (const u of this.uccelli) {
      const w = u.off.clone().applyQuaternion(this.camera.quaternion).add(pos);
      w.y += Math.sin(this.tempo * 2 + u.fase) * 0.5;
      u.s.posiziona(w.x, w.z, w.y);
      u.s.mostra('f' + (Math.floor(this.tempo * 10 + u.fase) % 4), false);
    }
    for (const p of this.pinne) {
      p.s.mesh.rotation.z = p.lato * (0.25 + Math.sin(this.tempo * 1.4) * 0.12);
      p.s.mostra(Math.sin(this.tempo * 1.4) > 0 ? 'f1' : 'f0', p.lato < 0);
    }
  }
}
