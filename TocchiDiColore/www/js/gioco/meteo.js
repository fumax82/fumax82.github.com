/* ==========================================================================
 *  meteo.js — LA PIOGGIA E CIÒ CHE LIA IMMAGINA ASCOLTANDOLA
 *  --------------------------------------------------------------------------
 *  Quando piove, Lia sente il picchiettio delle gocce e le auto che passano
 *  nelle pozzanghere. Nella sua fantasia (come nel cortometraggio):
 *    - la strada diventa un FIUME e le auto diventano AUTO-PESCE
 *    - alla fermata gli ANIMALI aspettano l'autobus sotto gli ombrelli
 *    - in cielo nuota una BALENA con tante pinne, che stende la sua ombra
 *  Questo modulo disegna le gocce, accende il fiume sugli strati della
 *  strada (scena.def.fiume), fa schizzare l'acqua sotto le auto-pesce e
 *  porta l'ombra della balena sul mondo (vedi conOmbre in materiali.js).
 * ========================================================================== */
import * as THREE from 'three';
import { UNIFORMI } from '../motore/materiali.js';
import { Sagoma } from '../motore/sagoma.js';
import { FORME } from '../motore/particelle.js';
import { Audio } from './audio.js';

const GOCCE = 700;

/** Una goccia allungata e sfumata (tela piccola). */
function telaGoccia() {
  const t = document.createElement('canvas');
  t.width = 8; t.height = 64;
  const c = t.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, 'rgba(235,245,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,1)');
  c.fillStyle = g;
  c.fillRect(2, 0, 4, 64);
  return new THREE.CanvasTexture(t);
}

export class Meteo {
  constructor(gioco) {
    this.g = gioco;
    this.intensita = 0;
    this.voluta = 0;
    this.fiume = 0;
    this.fiumeVoluto = 0;
    this.suono = null;
    this.ombrelli = [];
    this.attesaSplash = 0;
    this.attesaPlic = 2;
    // le gocce: tanti rettangolini sottili che guardano la camera
    const pos = new Float32Array(GOCCE * 4 * 3), uv = new Float32Array(GOCCE * 4 * 2), idx = [];
    for (let k = 0; k < GOCCE; k++) {
      uv.set([0, 0, 1, 0, 1, 1, 0, 1], k * 8);
      const b = k * 4;
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    this.materialeGocce = new THREE.MeshBasicMaterial({ map: telaGoccia(), color: 0xeef6ff, transparent: true, depthWrite: false, opacity: 0 });
    this.gocce = new THREE.Mesh(geo, this.materialeGocce);
    this.gocce.frustumCulled = false;
    this.gocce.renderOrder = 15;
    gioco.scena.add(this.gocce);
    this.stato = Array.from({ length: GOCCE }, () => ({ x: 0, y: Math.random() * 9, z: 0, v: 8 + Math.random() * 3, l: 0.25 + Math.random() * 0.2 }));
    this._destra = new THREE.Vector3();
  }

  /** Comincia (o smette: 0) a piovere, con la forza indicata (0..1). */
  pioggia(intensita) {
    this.voluta = intensita;
    if (intensita > 0 && !this.suono) this.suono = Audio.continuo('pioggia', undefined, undefined, 0.18);
    if (intensita <= 0 && this.suono) { this.suono.ferma(); this.suono = null; }
  }

  /** La strada diventa un fiume (1) o torna strada (0). */
  diventaFiume(valore) { this.fiumeVoluto = valore; }

  /** Gli animali alla fermata aprono gli ombrelli (sagome sopra la testa). */
  ombrelliPer(attori) {
    const colori = ['rosso', 'giallo', 'azzurro', 'verde', 'rosa', 'lilla'];
    attori.forEach((a, k) => {
      const s = new Sagoma('ombrello', { ancora: 0, scala: 1.1 });
      s.mostra(colori[k % colori.length], k % 2 === 1);
      s.aggiungiA(this.g.corrente.gruppo);
      this.ombrelli.push({ s, a });
    });
  }

  /** Lasciando la scena: smette di piovere, il fiume torna strada. */
  reset() {
    this.pioggia(0);
    this.intensita = 0; this.fiume = 0; this.fiumeVoluto = 0;
    this.ombrelli = [];
    UNIFORMI.uPioggia.value = 0;
    UNIFORMI.uOmbraBalena.value.w = 0;
    this.materialeGocce.opacity = 0;
  }

  aggiorna(dt, camera) {
    const g = this.g;
    const S = g.corrente;
    this.intensita += (this.voluta - this.intensita) * Math.min(1, dt * 0.8);
    this.fiume += (this.fiumeVoluto - this.fiume) * Math.min(1, dt * 0.6);
    UNIFORMI.uPioggia.value = this.intensita;
    if (this.suono) this.suono.volume = 0.05 + this.intensita * 0.25;

    // il fiume sugli strati della strada
    if (S) {
      for (const m of S.stratiFiume || []) m.material.uniforms.uFiume.value = this.fiume;
    }

    // le gocce cadono intorno al punto che la camera guarda
    this.materialeGocce.opacity = Math.min(0.9, this.intensita * 1.4);
    if (this.intensita > 0.01) {
      const centro = g.regia.guarda;
      this._destra.set(1, 0, 0).applyQuaternion(camera.quaternion);
      const pos = this.gocce.geometry.attributes.position.array;
      const quante = Math.floor(GOCCE * Math.min(1, this.intensita * 1.3));
      for (let k = 0; k < GOCCE; k++) {
        const d = this.stato[k];
        d.y -= d.v * dt;
        if (d.y < -0.2 || Math.abs(d.x - centro.x) > 9 || Math.abs(d.z - centro.z) > 7) {
          d.x = centro.x + (Math.random() - 0.5) * 18;
          d.z = centro.z + (Math.random() - 0.5) * 12;
          d.y = 6 + Math.random() * 5;
        }
        const vis = k < quante ? 1 : 0;
        const w = 0.02 * vis, l = d.l * vis;
        const dx = this._destra.x * w, dz = this._destra.z * w;
        // un po' di vento: la goccia è leggermente inclinata
        const inc = 0.06;
        pos.set([d.x - dx, d.y, d.z - dz, d.x + dx, d.y, d.z + dz, d.x + dx + inc, d.y + l, d.z + dz, d.x - dx + inc, d.y + l, d.z - dz], k * 12);
      }
      this.gocce.geometry.attributes.position.needsUpdate = true;
      // "plic... ploc": ogni tanto una scritta piccola dove cade una goccia, vicino a Lia
      this.attesaPlic -= dt;
      if (this.attesaPlic <= 0 && S) {
        this.attesaPlic = 2.5 + Math.random() * 3;
        const L = g.lia;
        const x = L.x + (Math.random() - 0.5) * 3, z = L.z + 0.4 + Math.random();
        g.effetti.onomatopea(Math.random() < 0.5 ? 'plic' : 'ploc', x, S.quota(x, z) + 0.5, z, '#9fd4ff', 0.45);
        g.particelle.emetti(x, S.quota(x, z) + 0.05, z, 6, { forma: FORME.goccia, colori: ['#dff3ff', '#ffffff'], velocita: 0.8, su: 1.2, gravita: 3, vita: 0.5, dim: 0.08 });
      }
    }

    // le auto-pesce schizzano acqua (e qualcuna fa "SPLASH!")
    if (S && this.fiume > 0.3) {
      this.attesaSplash -= dt;
      for (const a of S.attori) {
        if (!a.visibile || !a.def.pesce) continue;
        if (Math.random() < dt * 3) {
          g.particelle.emetti(a.x - a.dir.x * 0.6, 0.15, a.z, 3, { forma: [FORME.goccia, FORME.bolla], colori: ['#dff3ff', '#ffffff', '#bfe6ff'], velocita: 1.2, su: 1.6, gravita: 3.2, vita: 0.7, dim: 0.1 });
        }
        const vicino = Math.abs(a.x - g.lia.x) < 4;
        if (vicino && this.attesaSplash <= 0) {
          this.attesaSplash = 2.2 + Math.random() * 2;
          Audio.splash(a.x, a.z);
          g.effetti.onomatopea(Math.random() < 0.6 ? 'SPLASH!' : 'BLUB', a.x, a.y + 1.3, a.z, '#7fc6f0', 0.8);
          g.effetti.archi(a.x, a.y + 0.6, a.z, '#bfe6ff', 1);
        }
      }
    }

    // gli ombrelli stanno sopra la testa di chi aspetta
    for (const o of this.ombrelli) {
      o.s.visibile = o.a.visibile;
      o.s.posiziona(o.a.x + 0.05, o.a.y + o.a.sagoma.altezza * 0.82, o.a.z + 0.02);
    }

    // l'ombra della balena con le pinne (se c'è) scivola sul mondo
    const b = S && S.attore('balena_pinne');
    const ob = UNIFORMI.uOmbraBalena.value;
    // (non realistica: l'ombra passa proprio sopra Lia e sulle facciate, per farsi notare)
    if (b && b.visibile) ob.set(b.x - 1, g.lia.z - 0.6, 6, 0.75);
    else ob.w = 0;
  }
}
