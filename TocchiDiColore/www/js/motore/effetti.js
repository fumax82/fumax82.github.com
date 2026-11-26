/* ==========================================================================
 *  effetti.js — SUONI, PROFUMI E MAGIE DIPINTI NELL'ARIA
 *  --------------------------------------------------------------------------
 *  Lia non vede: sente. Qui diamo una forma fiabesca a ciò che sente,
 *  come nei cartoni animati:
 *    - ONOMATOPEE dipinte che saltano fuori: "BAU!", "TOK!", "TIN!", "SPLASH!"
 *    - ARCHI SONORI "((( )))" che si allargano intorno a chi fa un suono
 *    - NASTRI DI PROFUMO che volteggiano dalla sorgente fino al naso di Lia
 *    - COLONNE DI LUCE e SPIRALI dorate per i momenti magici
 *    - SCIE DI MOVIMENTO dietro a chi corre
 *  Tutto è fatto di "fogli" che guardano la telecamera e svaniscono da soli.
 * ========================================================================== */
import * as THREE from 'three';
import { UNIFORMI } from './materiali.js';

/* ------------------------------------------------------------------------ */
/*  Disegni su tela (fatti una volta sola e ricordati)                     */
/* ------------------------------------------------------------------------ */
const cache = new Map();

/** Una scritta da fumetto: lettere grasse, contorno seppia, colore sfumato, un po' storte. */
function telaScritta(testo, colore) {
  const chiave = 'T:' + testo + colore;
  if (cache.has(chiave)) return cache.get(chiave);
  const t = document.createElement('canvas');
  t.width = 512; t.height = 256;
  const c = t.getContext('2d');
  const font = "bold 112px 'Trebuchet MS', 'Comic Sans MS', 'Chalkboard SE', 'Segoe UI', sans-serif";
  c.font = font;
  c.textBaseline = 'middle';
  // misuriamo per centrare e rimpicciolire le scritte lunghe
  let larg = 0;
  for (const ch of testo) larg += c.measureText(ch).width * 0.92;
  const scala = Math.min(1, 440 / larg);
  let x = 256 - (larg * scala) / 2;
  let seme = testo.length * 97;
  const caso = () => ((seme = (seme * 16807) % 2147483647) / 2147483647);
  const chiaro = new THREE.Color(colore).lerp(new THREE.Color('#ffffff'), 0.55).getStyle();
  for (const ch of testo) {
    const w = c.measureText(ch).width * 0.92 * scala;
    c.save();
    c.translate(x + w / 2, 128 + (caso() - 0.5) * 22);
    c.rotate((caso() - 0.5) * 0.35);
    c.scale(scala, scala);
    c.lineJoin = 'round';
    // ombra morbida, contorno, colore, luce
    c.fillStyle = 'rgba(92, 63, 46, 0.25)';
    c.fillText(ch, -w / (2 * scala) + 6, 8);
    c.lineWidth = 18; c.strokeStyle = '#5c3f2e';
    c.strokeText(ch, -w / (2 * scala), 0);
    const g = c.createLinearGradient(0, -50, 0, 50);
    g.addColorStop(0, chiaro); g.addColorStop(1, colore);
    c.fillStyle = g;
    c.fillText(ch, -w / (2 * scala), 0);
    c.lineWidth = 4; c.strokeStyle = 'rgba(255,255,255,0.65)';
    c.beginPath(); c.moveTo(-w / (2 * scala) + 10, -26); c.lineTo(-w / (2 * scala) + w / scala * 0.45, -34); c.stroke();
    c.restore();
    x += w;
  }
  const tex = new THREE.CanvasTexture(t);
  cache.set(chiave, tex);
  return tex;
}

/**
 * Simboli manga che compaiono sopra la testa dei personaggi:
 *   '!' sorpresa, 'goccia' imbarazzo/urto, 'puntini' ascolto/pensiero,
 *   'stelline' gioia, 'note' allegria, 'cuore' affetto
 */
function telaSimbolo(tipo) {
  const chiave = 'S:' + tipo;
  if (cache.has(chiave)) return cache.get(chiave);
  const t = document.createElement('canvas');
  t.width = t.height = 256;
  const c = t.getContext('2d');
  const ink = '#3e2a20';
  c.lineJoin = 'round'; c.lineCap = 'round';
  const stella = (x, y, r, col) => {
    c.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? r * 0.28 : r;
      c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    c.closePath(); c.fillStyle = col; c.fill(); c.lineWidth = 5; c.strokeStyle = ink; c.stroke();
  };
  if (tipo === '!') {
    // raggi di sorpresa intorno
    c.strokeStyle = ink; c.lineWidth = 7;
    for (const [a, l] of [[-2.4, 40], [-2.0, 30], [-1.1, 30], [-0.7, 40]]) {
      c.beginPath(); c.moveTo(128 + Math.cos(a) * 70, 120 + Math.sin(a) * 70); c.lineTo(128 + Math.cos(a) * (70 + l), 120 + Math.sin(a) * (70 + l)); c.stroke();
    }
    c.beginPath(); c.moveTo(112, 40); c.lineTo(144, 40); c.lineTo(136, 150); c.lineTo(120, 150); c.closePath();
    c.fillStyle = '#ffdf6b'; c.fill(); c.lineWidth = 9; c.strokeStyle = ink; c.stroke();
    c.beginPath(); c.arc(128, 190, 16, 0, Math.PI * 2); c.fill(); c.stroke();
  } else if (tipo === 'goccia') {
    c.beginPath(); c.moveTo(128, 50); c.bezierCurveTo(150, 100, 175, 140, 160, 175); c.bezierCurveTo(145, 210, 110, 210, 96, 175); c.bezierCurveTo(82, 140, 106, 100, 128, 50);
    c.fillStyle = '#a8d8ff'; c.fill(); c.lineWidth = 8; c.strokeStyle = ink; c.stroke();
    c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(112, 160, 8, 14, -0.3, 0, Math.PI * 2); c.fill();
  } else if (tipo === 'puntini') {
    for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(70 + k * 58, 140, 17, 0, Math.PI * 2); c.fillStyle = '#ffffff'; c.fill(); c.lineWidth = 7; c.strokeStyle = ink; c.stroke(); }
  } else if (tipo === 'stelline') {
    stella(90, 120, 52, '#fff0a0'); stella(170, 80, 34, '#f7b6d8'); stella(175, 170, 26, '#a8d8ff');
  } else if (tipo === 'note') {
    c.fillStyle = '#f7a8c8'; c.strokeStyle = ink; c.lineWidth = 7;
    for (const [x, y, s2] of [[85, 170, 1], [165, 120, 0.8]]) {
      c.beginPath(); c.ellipse(x, y, 26 * s2, 19 * s2, -0.4, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(x + 24 * s2, y - 4); c.lineTo(x + 24 * s2, y - 105 * s2); c.lineTo(x + 60 * s2, y - 80 * s2); c.stroke();
    }
  } else { // cuore
    c.beginPath(); c.moveTo(128, 200); c.bezierCurveTo(40, 140, 50, 60, 100, 60); c.bezierCurveTo(118, 60, 128, 75, 128, 88);
    c.bezierCurveTo(128, 75, 138, 60, 156, 60); c.bezierCurveTo(206, 60, 216, 140, 128, 200);
    c.fillStyle = '#f7a8c8'; c.fill(); c.lineWidth = 8; c.strokeStyle = ink; c.stroke();
  }
  const tex = new THREE.CanvasTexture(t);
  cache.set(chiave, tex);
  return tex;
}

/** Archi sonori: tre archi a pennello per lato, come nei fumetti. */
function telaArchi() {
  if (cache.has('archi')) return cache.get('archi');
  const t = document.createElement('canvas');
  t.width = t.height = 256;
  const c = t.getContext('2d');
  c.lineCap = 'round';
  for (const lato of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const r = 50 + k * 30;
      c.lineWidth = 12 - k * 2.5;
      c.strokeStyle = 'rgba(255,255,255,' + (0.95 - k * 0.22) + ')';
      c.beginPath();
      c.arc(128, 128, r, lato > 0 ? -0.65 : Math.PI - 0.65, lato > 0 ? 0.65 : Math.PI + 0.65);
      c.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(t);
  cache.set('archi', tex);
  return tex;
}

/** Un fascio di luce verticale, sfumato (per le colonne di luce). */
function telaLuce() {
  if (cache.has('luce')) return cache.get('luce');
  const t = document.createElement('canvas');
  t.width = 64; t.height = 256;
  const c = t.getContext('2d');
  const gx = c.createLinearGradient(0, 0, 64, 0);
  gx.addColorStop(0, 'rgba(255,255,255,0)'); gx.addColorStop(0.5, 'rgba(255,255,255,1)'); gx.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = gx; c.fillRect(0, 0, 64, 256);
  c.globalCompositeOperation = 'destination-in';
  const gy = c.createLinearGradient(0, 0, 0, 256);
  gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(0.35, 'rgba(0,0,0,0.9)'); gy.addColorStop(1, 'rgba(0,0,0,0.3)');
  c.fillStyle = gy; c.fillRect(0, 0, 64, 256);
  const tex = new THREE.CanvasTexture(t);
  cache.set('luce', tex);
  return tex;
}

/* ------------------------------------------------------------------------ */
/*  Nastri (profumi, spirali, scie): una striscia che guarda la camera      */
/* ------------------------------------------------------------------------ */
const VERT_NASTRO = /* glsl */ `
  attribute float aU;
  attribute float aV;
  varying float vU;
  varying float vV;
  void main() {
    vU = aU; vV = aV;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const FRAG_NASTRO = /* glsl */ `
  uniform sampler2D uRumore;
  uniform vec3 uColore;
  uniform float uAlfa;
  uniform float uTempo;
  uniform float uScorri;
  uniform float uTesta;    // fin dove è già "arrivato" il nastro (0..1)
  varying float vU;
  varying float vV;
  void main() {
    if (vU > uTesta) discard;
    // sfumato ai bordi e alle due estremità, con fili che scorrono (come fumo colorato)
    float bordo = 1.0 - abs(vV * 2.0 - 1.0);
    float coda = smoothstep(0.0, 0.15, vU) * (1.0 - smoothstep(uTesta - 0.15, uTesta, vU));
    float fili = texture2D(uRumore, vec2(vU * 3.0 - uTempo * uScorri, vV * 0.7 + vU)).r;
    float a = smoothstep(0.0, 0.55, bordo) * coda * (0.6 + fili * 0.9) * uAlfa;
    vec3 c = mix(uColore, vec3(1.0), smoothstep(0.75, 1.0, bordo) * 0.35);
    gl_FragColor = vec4(c, clamp(a, 0.0, 1.0));
  }
`;

class Nastro {
  /**
   * curva(u, t) → THREE.Vector3: il punto del nastro (u da 0 a 1) al tempo t
   * opz: { colore, larghezza, segmenti, durata, crescita, scorri, additivo }
   */
  constructor(scena, curva, opz) {
    this.curva = curva;
    this.opz = opz;
    this.n = opz.segmenti || 40;
    this.t = 0;
    this.durata = opz.durata || 3;
    const pos = new Float32Array(this.n * 2 * 3), u = new Float32Array(this.n * 2), v = new Float32Array(this.n * 2);
    const idx = [];
    for (let k = 0; k < this.n; k++) {
      u[k * 2] = u[k * 2 + 1] = k / (this.n - 1);
      v[k * 2] = 0; v[k * 2 + 1] = 1;
      if (k < this.n - 1) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aU', new THREE.BufferAttribute(u, 1));
    g.setAttribute('aV', new THREE.BufferAttribute(v, 1));
    g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uRumore: UNIFORMI.uRumore, uTempo: UNIFORMI.uTempo,
        uColore: { value: new THREE.Color(opz.colore || '#f7a8c8') }, uAlfa: { value: 1 },
        uScorri: { value: opz.scorri === undefined ? 0.6 : opz.scorri }, uTesta: { value: 0 },
      },
      vertexShader: VERT_NASTRO, fragmentShader: FRAG_NASTRO,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: opz.additivo ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 12;
    scena.add(this.mesh);
    this._a = new THREE.Vector3(); this._b = new THREE.Vector3(); this._d = new THREE.Vector3(); this._l = new THREE.Vector3();
  }

  /** Ricalcola la forma: ogni punto si allarga di lato, di fronte alla camera. */
  aggiorna(dt, camera) {
    this.t += dt;
    const k = this.t / this.durata;
    const cresci = this.opz.crescita || 0.35;
    this.mat.uniforms.uTesta.value = Math.min(1.15, k / cresci);
    this.mat.uniforms.uAlfa.value = 1 - Math.max(0, (k - 0.7) / 0.3);
    const pos = this.mesh.geometry.attributes.position.array;
    const L = this.opz.larghezza || 0.25;
    for (let i = 0; i < this.n; i++) {
      const u = i / (this.n - 1);
      const p = this.curva(u, this.t, this._a);
      const q = this.curva(Math.min(1, u + 0.02), this.t, this._b);
      this._d.subVectors(q, p).normalize();
      this._l.subVectors(camera.position, p).cross(this._d).normalize();
      const w = L * Math.sin(Math.PI * Math.min(1, u * 1.1 + 0.05)) * 0.5 + L * 0.15;
      pos[i * 6] = p.x + this._l.x * w; pos[i * 6 + 1] = p.y + this._l.y * w; pos[i * 6 + 2] = p.z + this._l.z * w;
      pos[i * 6 + 3] = p.x - this._l.x * w; pos[i * 6 + 4] = p.y - this._l.y * w; pos[i * 6 + 5] = p.z - this._l.z * w;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    return this.t < this.durata;
  }

  rimuovi() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}

/* ======================================================================== */
export class Effetti {
  constructor(scena) {
    this.scena = scena;
    this.vivi = [];       // { aggiorna(dt, camera) → true finché vive, rimuovi() }
  }

  /** Una scritta da fumetto che salta fuori, galleggia e svanisce. */
  onomatopea(testo, x, y, z, colore, grandezza) {
    const mat = new THREE.SpriteMaterial({ map: telaScritta(testo, colore || '#ffd36b'), transparent: true, depthWrite: false, depthTest: false });
    const s = new THREE.Sprite(mat);
    s.renderOrder = 20;
    s.position.set(x, y, z);
    this.scena.add(s);
    const G = grandezza || 0.9;
    let t = 0;
    const ruota = (Math.random() - 0.5) * 0.4;
    this.vivi.push({
      aggiorna: (dt) => {
        t += dt;
        // "pop": cresce oltre, rimbalza, poi sale piano e svanisce
        const pop = t < 0.18 ? (t / 0.18) * 1.2 : t < 0.32 ? 1.2 - ((t - 0.18) / 0.14) * 0.2 : 1;
        s.scale.set(G * pop, G * 0.5 * pop, 1);
        s.position.y = y + t * 0.35;
        mat.rotation = ruota + Math.sin(t * 6) * 0.05;
        mat.opacity = 1 - Math.max(0, (t - 1.0) / 0.5);
        return t < 1.5;
      },
      rimuovi: () => { s.removeFromParent(); mat.dispose(); },
    });
  }

  /** Un simbolo manga sopra la testa di un personaggio (lo segue per un po'). */
  simbolo(tipo, attore, durata) {
    const mat = new THREE.SpriteMaterial({ map: telaSimbolo(tipo), transparent: true, depthWrite: false, depthTest: false });
    const s = new THREE.Sprite(mat);
    s.renderOrder = 21;
    this.scena.add(s);
    const D = durata || 1.5;
    const altezza = (attore.sagoma ? attore.sagoma.altezza : 1) * 0.95;
    let t = 0;
    this.vivi.push({
      aggiorna: (dt) => {
        t += dt;
        const pop = t < 0.15 ? (t / 0.15) * 1.25 : t < 0.28 ? 1.25 - ((t - 0.15) / 0.13) * 0.25 : 1;
        const g = 0.42 * pop;
        s.scale.set(g, g, 1);
        s.position.set(attore.x + 0.32, attore.y + altezza + Math.sin(t * 7) * 0.02, attore.z + 0.05);
        mat.opacity = 1 - Math.max(0, (t - D + 0.35) / 0.35);
        return t < D;
      },
      rimuovi: () => { s.removeFromParent(); mat.dispose(); },
    });
  }

  /** Archi sonori "((( )))" che si allargano intorno a chi fa il suono. */
  archi(x, y, z, colore, volte) {
    for (let k = 0; k < (volte || 2); k++) {
      const mat = new THREE.SpriteMaterial({ map: telaArchi(), color: new THREE.Color(colore || '#ffffff'), transparent: true, depthWrite: false, opacity: 0 });
      const s = new THREE.Sprite(mat);
      s.renderOrder = 19;
      s.position.set(x, y, z);
      this.scena.add(s);
      let t = -k * 0.22;
      this.vivi.push({
        aggiorna: (dt) => {
          t += dt;
          if (t < 0) return true;
          const g = 0.5 + t * 2.2;
          s.scale.set(g, g, 1);
          mat.opacity = Math.max(0, 0.9 * (1 - t / 0.9));
          return t < 0.9;
        },
        rimuovi: () => { s.removeFromParent(); mat.dispose(); },
      });
    }
  }

  /**
   * Un nastro di profumo che volteggia dalla sorgente (da) fino al naso di Lia (a),
   * ondeggiando come fumo colorato.
   */
  profumo(da, a, colore, fase) {
    const A = new THREE.Vector3(...da), B = new THREE.Vector3(...a);
    const f = fase || Math.random() * 6;
    const n = new Nastro(this.scena, (u, t, out) => {
      out.lerpVectors(A, B, u);
      const onda = Math.sin(u * 9 + t * 2.2 + f) * 0.28 * Math.sin(Math.PI * u);
      out.y += Math.sin(Math.PI * u) * 0.6 + Math.cos(u * 7 + t * 1.7 + f) * 0.12;
      out.x += onda;
      out.z += Math.cos(u * 8 + t * 2 + f) * 0.22 * Math.sin(Math.PI * u);
      return out;
    }, { colore, larghezza: 0.5, durata: 3.6, crescita: 0.35, scorri: 0.8 });
    // lungo il nastro brillano briciole di luce e volano petali
    const p = new THREE.Vector3();
    this.vivi.push({
      aggiorna: (dt, cam) => {
        if (this.particelle && Math.random() < dt * 14) {
          const u = Math.random() * Math.min(1, n.mat.uniforms.uTesta.value);
          n.curva(u, n.t, p);
          const sistema = Math.random() < 0.6 ? this.luci : this.particelle;
          sistema.emetti(p.x, p.y, p.z, 1, {
            forma: sistema === this.luci ? [2, 0] : [3, 13], colori: [colore, '#ffffff', '#fff3c0'],
            velocita: 0.15, su: 0.15, gravita: 0, vita: 1.2, dim: sistema === this.luci ? 0.08 : 0.12, vortice: 0.5,
          });
        }
        return n.aggiorna(dt, cam);
      },
      rimuovi: () => n.rimuovi(),
    });
  }

  /** Una spirale di luce che sale girando intorno a un punto (scoperte, trasformazioni). */
  spirale(x, y, z, colore, opz) {
    const o = opz || {};
    const raggio = o.raggio || 0.7, altezza = o.altezza || 2.4, giri = o.giri || 2.5, f = o.fase || 0;
    const n = new Nastro(this.scena, (u, t, out) => {
      const ang = u * giri * Math.PI * 2 + t * 2.5 + f;
      const r = raggio * (1 - u * 0.5);
      return out.set(x + Math.cos(ang) * r, y + u * altezza, z + Math.sin(ang) * r * 0.8);
    }, { colore, larghezza: (o.larghezza || 0.12) * 0.75, durata: o.durata || 2.4, crescita: 0.45, scorri: 1.5, segmenti: 60 });
    // (colori "dipinti", non luce sommata: sulla carta chiara la luce sommata diventa tutta bianca)
    this.vivi.push({ aggiorna: (dt, cam) => n.aggiorna(dt, cam), rimuovi: () => n.rimuovi() });
  }

  /** Una scia che segue (per un po') chi si muove: un fruscio di vento colorato. */
  scia(attore, colore, durata) {
    const storia = [];
    const n = new Nastro(this.scena, (u, t, out) => {
      if (!storia.length) return out.set(attore.x, attore.y + 0.3, attore.z);
      const i = Math.min(storia.length - 1, Math.floor((1 - u) * (storia.length - 1)));
      const p = storia[i];
      return out.set(p[0], p[1], p[2]);
    }, { colore, larghezza: 0.18, durata: durata || 1.2, crescita: 0.05, scorri: 2.0 });
    this.vivi.push({
      aggiorna: (dt, cam) => {
        storia.push([attore.x, attore.y + 0.3, attore.z]);
        if (storia.length > 14) storia.shift();
        return n.aggiorna(dt, cam);
      },
      rimuovi: () => n.rimuovi(),
    });
  }

  /** Una colonna di luce che scende dal cielo (momenti magici). */
  colonnaLuce(x, y, z, colore, altezza) {
    const mat = new THREE.SpriteMaterial({ map: telaLuce(), color: new THREE.Color(colore || '#fff0a0'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    const s = new THREE.Sprite(mat);
    s.renderOrder = 18;
    const H = altezza || 6;
    s.center.set(0.5, 0);
    s.position.set(x, y, z);
    this.scena.add(s);
    let t = 0;
    this.vivi.push({
      aggiorna: (dt) => {
        t += dt;
        s.scale.set(0.9 + Math.sin(t * 9) * 0.05 + t * 0.4, H, 1);
        mat.opacity = Math.min(1, t / 0.15) * Math.max(0, 1 - t / 1.4) * 0.75;
        return t < 1.4;
      },
      rimuovi: () => { s.removeFromParent(); mat.dispose(); },
    });
  }

  /** A ogni fotogramma. */
  aggiorna(dt, camera) {
    this.vivi = this.vivi.filter((v) => {
      const vivo = v.aggiorna(dt, camera);
      if (!vivo) v.rimuovi();
      return vivo;
    });
  }

  /** Toglie tutto (cambio di scena). */
  svuota() {
    for (const v of this.vivi) v.rimuovi();
    this.vivi = [];
  }
}
