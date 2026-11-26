/* ==========================================================================
 *  volo.js — IL VOLO SULLA BALENA DEL CIELO
 *  --------------------------------------------------------------------------
 *  Come nel cortometraggio: dal dorso della balena si vede la città
 *  dall'alto, con il fiume diventato strada e le macchinine che lo
 *  percorrono. È l'inquadratura classica della "multiplane camera":
 *    - in fondo, la MAPPA dipinta della città, stesa per terra
 *    - in mezzo, NUVOLE a diverse altezze che scorrono a velocità diverse
 *    - davanti, le PINNE della balena, attaccate alla telecamera
 *  La telecamera segue una curva morbida sopra il fiume e alla fine
 *  scende verso la piazzetta gialla dove corre un puntino giallo: Gogo!
 * ========================================================================== */
import * as THREE from 'three';
import { Galleria } from '../arte/galleria.js';
import { UNIFORMI, materialeCielo, materialeStrato } from './materiali.js';
import { geometriaStrato, textureDaTela } from './strati.js';
import { Sagoma } from './sagoma.js';
import { casuale } from '../arte/pennello.js';
import { dipingiMappa, fiumeX, PIAZZETTA, telaMacchinina, telaGogo } from '../arte/mappa_volo.js';

export class Volo {
  constructor() {
    this.scena = new THREE.Scene();
    this.scena.background = new THREE.Color('#fbf6ea');
    this.camera = new THREE.PerspectiveCamera(56, 16 / 9, 0.1, 900);
    this.scena.add(this.camera);
    this.animati = [];
    this.tempo = 0;
    this.pronto = false;
  }

  /** Dipinge la città e prepara la scena (richiede circa un secondo). */
  async prepara() {
    if (this.pronto) return;
    const rng = casuale(2010);
    const S = this.scena;

    // il cielo
    const cielo = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), materialeCielo(Galleria.atlante('cielo').texture));
    cielo.renderOrder = -100;
    cielo.frustumCulled = false;
    this.cielo = cielo;
    S.add(cielo);

    // la mappa dipinta della città, stesa per terra (due fogli)
    const mappa = await dipingiMappa();
    for (const f of mappa.fogli) {
      const d = { normale: 'su', x: mappa.x, y: 0, z: f.z, larghezza: mappa.larghezza, profondita: f.profondita };
      const m = new THREE.Mesh(geometriaStrato(d), materialeStrato(textureDaTela(f.tela, 8), { pavimento: true }));
      m.renderOrder = -20;
      m.frustumCulled = false;
      S.add(m);
    }

    // macchinine che percorrono il fiume-strada (piatte, viste dall'alto)
    const geoAuto = new THREE.PlaneGeometry(1.6, 2.4).rotateX(-Math.PI / 2);
    const colori = ['#f5d04e', '#e36b5e', '#4f6fa8', '#f2a541', '#7fc2a8'];
    for (let k = 0; k < 16; k++) {
      const tex = new THREE.CanvasTexture(telaMacchinina(colori[k % colori.length]));
      const m = new THREE.Mesh(geoAuto, new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      m.renderOrder = -10;
      S.add(m);
      const verso = k % 2 ? 1 : -1;
      let z = -150 + rng() * 300;
      const vel = (3 + rng() * 3) * verso;
      this.animati.push((dt) => {
        z += vel * dt;
        if (z > 150) z = -150; if (z < -150) z = 150;
        const x = fiumeX(z) + verso * 2.6;
        const dx = fiumeX(z + 0.5) - fiumeX(z - 0.5);
        m.position.set(x, 0.08, z);
        m.rotation.y = Math.atan2(dx, 1) + (verso < 0 ? Math.PI : 0);
      });
    }

    // il puntino giallo che corre in cerchio nella piazzetta: Gogo con la borsa!
    const bis = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(telaGogo()), transparent: true }));
    bis.renderOrder = -9;
    S.add(bis);
    this.animati.push((dt, t) => {
      const a = t * 1.3;
      bis.position.set(PIAZZETTA.x + Math.cos(a) * 4, 0.12, PIAZZETTA.z + Math.sin(a) * 4);
      bis.rotation.y = -a;
    });

    // nuvole a strati: alcune sotto la balena (sopra la città), altre accanto e sopra
    for (let k = 0; k < 26; k++) {
      const s = new Sagoma('nuvola', { cielo: true, ancora: 0.5, scala: 0.35 + rng() * 0.5, sferico: true });
      s.mostra('f' + (k % 4), k % 2 === 0);
      s.aggiungiA(S);
      const z = 140 - k * 11 + rng() * 6;
      const lato = k % 2 ? 1 : -1;
      const sotto = k % 3 === 0;
      const x = fiumeX(z) + lato * (sotto ? 6 + rng() * 18 : 20 + rng() * 30);
      const y = sotto ? 12 + rng() * 6 : 24 + rng() * 14;
      const deriva = 0.3 + rng() * 0.5;
      s.mesh.renderOrder = -5;
      this.animati.push((dt, t) => s.posiziona(x + Math.sin(t * 0.05 + k) * 3 + t * deriva * 0.2, y, z));
    }

    // stormo di uccellini che ci accompagna
    this.uccelli = [];
    for (let k = 0; k < 6; k++) {
      const s = new Sagoma('uccellino', { cielo: true, ancora: 0.5, scala: 2.0, sferico: true });
      s.aggiungiA(S);
      this.uccelli.push({ s, off: new THREE.Vector3(-4 + k * 1.6, -1 + (k % 3) * 0.8, -10 - (k % 2) * 3), fase: k });
    }

    // le pinne della balena, "attaccate" alla telecamera (come nel film)
    this.pinne = [];
    for (const lato of [-1, 1]) {
      const s = new Sagoma('pinna', { cielo: true, ancora: 0.5, scala: 0.24, sferico: true });
      s.mostra('f0', lato < 0);
      this.camera.add(s.mesh);
      s.mesh.renderOrder = 10;   // disegnate per ultime: stanno davanti a tutto
      s.mesh.position.set(lato * 1.75, -0.92, -1.7);
      this.pinne.push({ s, lato });
    }

    // la curva del volo: sopra il fiume, poi giù verso la piazzetta
    const punti = [];
    for (let k = 0; k <= 8; k++) {
      const z = 140 - k * 30;
      punti.push(new THREE.Vector3(fiumeX(z) + Math.sin(k * 1.3) * 8, 32 + Math.sin(k * 0.9) * 4 - k * 0.8, z));
    }
    punti.push(new THREE.Vector3(PIAZZETTA.x - 2, 20, PIAZZETTA.z + 22));
    this.percorso = new THREE.CatmullRomCurve3(punti);
    this.pronto = true;
  }

  ridimensiona(larghezza, altezza) {
    this.camera.aspect = larghezza / altezza;
    this.camera.updateProjectionMatrix();
  }

  /** Avanza il volo. t = 0..1 lungo il percorso. */
  aggiorna(dt, t) {
    if (!this.pronto) return;
    this.tempo += dt;
    const pos = this.percorso.getPoint(Math.min(0.999, t));
    const avanti = this.percorso.getPoint(Math.min(1, t + 0.04));
    pos.y += Math.sin(this.tempo * 0.9) * 0.6;                      // la balena sale e scende
    this.camera.position.copy(pos);
    // alla fine lo sguardo scende verso la piazzetta
    const fine = Math.max(0, (t - 0.8) / 0.2);
    const gx = avanti.x + (PIAZZETTA.x - avanti.x) * fine, gz = avanti.z + (PIAZZETTA.z - avanti.z) * fine;
    this.camera.lookAt(gx, avanti.y - 11 - fine * 8, gz);
    this.camera.rotation.z += Math.sin(this.tempo * 0.5) * 0.04;     // leggero rollio
    this.camera.updateMatrixWorld();
    this.cielo.position.copy(pos);
    // tutto a colori; la messa a fuoco è sulla città (le nuvole vicine restano morbide)
    UNIFORMI.uRivelaTutto.value = 1;
    UNIFORMI.uFuoco.value = pos.y * 1.5;
    UNIFORMI.uFoschia.value.set(70, 260);
    for (const f of this.animati) f(dt, this.tempo);
    for (const u of this.uccelli) {
      const w = u.off.clone().applyQuaternion(this.camera.quaternion).add(pos);
      w.y += Math.sin(this.tempo * 2 + u.fase) * 0.5;
      u.s.posiziona(w.x, w.y, w.z);
      u.s.mostra('f' + (Math.floor(this.tempo * 10 + u.fase) % 4), false);
    }
    // le pinne "battono" piano: salgono e scendono ai bordi dello schermo
    for (const p of this.pinne) {
      p.s.mesh.position.y = -0.92 + Math.sin(this.tempo * 1.4) * 0.07;
      p.s.mostra(Math.sin(this.tempo * 1.4) > 0 ? 'f1' : 'f0', p.lato < 0);
    }
  }
}
