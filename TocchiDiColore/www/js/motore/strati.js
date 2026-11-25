/* ==========================================================================
 *  strati.js — I PIANI DIPINTI DEL TEATRINO (tecnica "multiplane")
 *  --------------------------------------------------------------------------
 *  Ogni scena è fatta di STRATI: fogli dipinti (tele) appesi nello spazio a
 *  profondità diverse, come le quinte di un teatro o i vetri della
 *  "multiplane camera" dei cartoni animati classici. Muovendo la telecamera
 *  i piani vicini scorrono più in fretta di quelli lontani: nasce lo spazio.
 *
 *  CONVENZIONI (valgono per tutte le scene):
 *    unità   1 unità ≈ 1 metro (Lia è alta circa 1)
 *    assi    x verso destra, y verso l'alto, z verso lo spettatore
 *    percorso di Lia di solito a z = 0; i fondali hanno z negativo
 *
 *  Un strato è descritto così:
 *    { tela, normale, x, y, z, larghezza, altezza | profondita, ... }
 *    normale: da che parte "guarda" il disegno (da lì si vede dritto)
 *      'z+'  verticale, guarda verso lo spettatore   (copre x..x+larghezza, y..y+altezza, al piano z)
 *      'z-'  verticale, guarda verso il fondo         (stessa area)
 *      'x+'  verticale, guarda verso destra           (copre z..z+larghezza, y..y+altezza, al piano x)
 *      'x-'  verticale, guarda verso sinistra         (stessa area)
 *      'su'  orizzontale, guarda in alto (pavimenti)  (copre x..x+larghezza, z..z+profondita, alla quota y;
 *                                                      il lato alto dell'immagine è il più lontano, z minimo)
 *      'giu' orizzontale, guarda in basso (soffitti)  (stessa area)
 *    (x, y, z) è sempre l'angolo con le coordinate più piccole.
 * ========================================================================== */
import * as THREE from 'three';

/**
 * Crea la geometria (un rettangolo) di uno strato già orientato e posizionato.
 * Le coordinate di texture sono scelte in modo che il disegno appaia diritto
 * (non specchiato) guardandolo dal lato verso cui "guarda".
 */
export function geometriaStrato(d) {
  const { x, y, z } = d;
  const L = d.larghezza;
  const A = d.altezza !== undefined ? d.altezza : d.profondita;
  let p; // 4 angoli: basso-sinistra, basso-destra, alto-destra, alto-sinistra (dell'immagine)
  switch (d.normale) {
    case 'z-': p = [[x + L, y, z], [x, y, z], [x, y + A, z], [x + L, y + A, z]]; break;
    case 'x+': p = [[x, y, z + L], [x, y, z], [x, y + A, z], [x, y + A, z + L]]; break;
    case 'x-': p = [[x, y, z], [x, y, z + L], [x, y + A, z + L], [x, y + A, z]]; break;
    case 'su': p = [[x, y, z + A], [x + L, y, z + A], [x + L, y, z], [x, y, z]]; break;
    case 'giu': p = [[x, y, z], [x + L, y, z], [x + L, y, z + A], [x, y, z + A]]; break;
    default: p = [[x, y, z], [x + L, y, z], [x + L, y + A, z], [x, y + A, z]]; // 'z+'
  }
  const n = { 'z+': [0, 0, 1], 'z-': [0, 0, -1], 'x+': [1, 0, 0], 'x-': [-1, 0, 0], su: [0, 1, 0], giu: [0, -1, 0] }[d.normale || 'z+'];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p.flat(), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([...n, ...n, ...n, ...n], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeBoundingSphere();
  return g;
}

/** Texture da una tela dipinta, con filtri adatti ai disegni ingranditi. */
export function textureDaTela(tela, anisotropia) {
  const t = new THREE.CanvasTexture(tela);
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = anisotropia || 4;
  return t;
}

/**
 * Versione semplice (materiale base, senza effetti): serve per le anteprime
 * dei pittori. Il gioco usa la stessa geometria con il suo materiale speciale.
 */
export function stratoSemplice(d) {
  const mat = new THREE.MeshBasicMaterial({
    map: textureDaTela(d.tela), transparent: true, alphaTest: 0.02, side: THREE.DoubleSide, depthWrite: true,
  });
  const m = new THREE.Mesh(geometriaStrato(d), mat);
  m.renderOrder = d.ordine || 0;
  return m;
}
