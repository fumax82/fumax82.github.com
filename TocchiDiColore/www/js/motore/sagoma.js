/* ==========================================================================
 *  sagoma.js — PERSONAGGI E OGGETTI COME "SAGOME DI CARTA"
 *  --------------------------------------------------------------------------
 *  Nel mondo 3D personaggi e oggetti sono disegni piatti che si girano
 *  sempre verso la telecamera (come le figure di un teatrino di carta):
 *  è l'effetto "pseudo 3D" che mantiene lo stile del cartone animato.
 *
 *  Una Sagoma sa:
 *    - quale atlante usare (es. 'lia_strega') e quale fotogramma mostrare
 *    - dove si trova e quanto è grande
 *    - se ha un'ombra morbida a terra
 * ========================================================================== */
import * as THREE from 'three';
import { Galleria } from '../arte/galleria.js';
import { materialeSprite, materialeOmbra, geometriaPerSprite } from './materiali.js';

const geometriaOmbra = new THREE.PlaneGeometry(1, 1);
geometriaOmbra.rotateX(-Math.PI / 2);

export class Sagoma {
  /**
   * nomeAtlante: nome dell'immagine nella Galleria
   * opz: { scala, ombra (raggio), oscilla, ancora (0 terra, 0.5 centro, 1 appeso),
   *        luce, cielo, trasparente, piatto (angolo: non ruota verso la camera) }
   */
  constructor(nomeAtlante, opz) {
    const o = opz || {};
    this.opz = o;
    this.scala = o.scala || 1;
    this.atlante = Galleria.atlante(nomeAtlante);
    this.materiale = materialeSprite(this.atlante.texture, {
      oscilla: o.oscilla, ancora: o.ancora, luce: o.luce, cielo: o.cielo,
      trasparente: o.trasparente, piatto: o.piatto !== undefined, sferico: o.sferico, contorno: o.contorno,
    });
    this.mesh = new THREE.Mesh(geometriaPerSprite(), this.materiale);
    this.mesh.frustumCulled = false;
    if (o.piatto !== undefined) this.mesh.rotation.y = o.piatto;
    if (o.cielo) this.mesh.renderOrder = -50;
    this.ombra = null;
    if (o.ombra) {
      this.ombra = new THREE.Mesh(geometriaOmbra, materialeOmbra(o.forzaOmbra));
      // ombra allungata verso destra-dietro, come al sole del pomeriggio (non realistica: lilla)
      this.ombra.scale.set(o.ombra * 2.7, 1, o.ombra * 1.25);
      this.ombra.renderOrder = 1;
    }
    this.fotogramma = null;
    this.specchio = false;
    this._aggiornaDimensioni();
    this.mostra(this.atlante.nomi[0], false);
  }

  /** Cambia immagine (per esempio Lia che passa al vestito da streghetta). */
  cambiaAtlante(nomeAtlante) {
    this.atlante = Galleria.atlante(nomeAtlante);
    this.materiale.uniforms.uMappa.value = this.atlante.texture;
    const img = this.atlante.texture.image;
    this.materiale.uniforms.uTexel.value.set(2 / img.width, 2 / img.height);
    this._aggiornaDimensioni();
    const f = this.fotogramma;
    this.fotogramma = null;
    this.mostra(this.atlante.fotogrammi[f] ? f : this.atlante.nomi[0], this.specchio);
  }

  _aggiornaDimensioni() {
    const a = this.atlante.altezzaMondo * this.scala;
    const l = a * (this.atlante.cella.l / this.atlante.cella.a);
    this.materiale.uniforms.uDim.value.set(l, a);
    this.larghezza = l;
    this.altezza = a;
  }

  /** Mostra un fotogramma dell'atlante (specchio = guarda a sinistra). */
  mostra(nomeFotogramma, specchio) {
    if (nomeFotogramma === this.fotogramma && !!specchio === this.specchio) return;
    this.fotogramma = nomeFotogramma;
    this.specchio = !!specchio;
    const r = Galleria.riquadro(this.atlante, nomeFotogramma);
    this.materiale.uniforms.uRiquadro.value.set(r.u0, r.v0, r.du, r.dv);
    const img = this.atlante.texture.image;
    const mx = 1 / img.width, my = 1 / img.height;
    this.materiale.uniforms.uRiquadroLimiti.value.set(r.u0 + mx, r.v0 + my, r.u0 + r.du - mx, r.v0 + r.dv - my);
    this.materiale.uniforms.uSpecchio.value = this.specchio ? 1 : 0;
  }

  /** Sceglie il fotogramma più adatto per vista/posa/numero (vedi Galleria.fotogramma). */
  posa(vista, posa, n, specchio) {
    this.mostra(Galleria.fotogramma(this.atlante, vista, posa, n), specchio);
  }

  /** Posiziona la sagoma nel mondo: x destra, y alto (i piedi), z verso lo spettatore. */
  posiziona(x, y, z) {
    this.mesh.position.set(x, y, z);
    if (this.ombra) this.ombra.position.set(x + this.larghezza * 0.22, this._quotaOmbra === undefined ? y + 0.012 : this._quotaOmbra, z - 0.08);
  }

  /** Quota del terreno sotto l'oggetto (per l'ombra degli oggetti sospesi). */
  quotaTerreno(q) {
    this._quotaOmbra = q + 0.012;
  }

  set visibile(v) {
    this.mesh.visible = v;
    if (this.ombra) this.ombra.visible = v;
  }

  get visibile() {
    return this.mesh.visible;
  }

  set opacita(v) {
    this.materiale.uniforms.uOpacita.value = v;
  }

  set luce(v) {
    this.materiale.uniforms.uLuce.value = v;
  }

  aggiungiA(gruppo) {
    gruppo.add(this.mesh);
    if (this.ombra) gruppo.add(this.ombra);
    return this;
  }

  rimuovi() {
    this.mesh.removeFromParent();
    if (this.ombra) this.ombra.removeFromParent();
  }
}
