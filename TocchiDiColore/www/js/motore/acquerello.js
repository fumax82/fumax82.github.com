/* ==========================================================================
 *  acquerello.js — IL FILTRO "ACQUERELLO" A TUTTO SCHERMO
 *  --------------------------------------------------------------------------
 *  Il mondo 3D viene prima disegnato in un'immagine nascosta; poi questo
 *  filtro la "ridipinge" sullo schermo aggiungendo:
 *    - la GRANA della carta
 *    - i BORDI DI PIGMENTO: dove i colori cambiano, l'acquerello si accumula
 *      e diventa più scuro
 *    - le SBAVATURE: i colori si spandono un poco come su carta bagnata
 *    - un leggero BAGLIORE sulle zone luminose
 *    - il TREMOLIO dei disegni animati a mano (cambia 6 volte al secondo)
 *    - i BORDI BIANCHI: il mondo immaginato di Lia svanisce nella carta
 *    - le DISSOLVENZE al bianco (cambi di luogo, scene della storia)
 * ========================================================================== */
import * as THREE from 'three';
import { UNIFORMI } from './materiali.js';

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D tScena;
  uniform sampler2D tRumore;
  uniform vec2 uRis;
  uniform float uTempo;
  uniform vec3 uCarta;
  uniform float uBianco;          // 0..1 dissolvenza verso la carta
  uniform float uBordoBianco;     // 0..1 quanto i bordi dello schermo svaniscono nel bianco
  uniform float uSaturazione;
  uniform float uIntensita;       // 0 = filtro spento, 1 = acquerello pieno
  uniform vec4 uOndaSchermo;      // increspatura del colpo di bacchetta: (x, y, avanzamento 0..1, forza)
  uniform vec3 uColoreOnda;
  uniform vec4 uFocus;            // linee di concentrazione manga: (x, y, forza, seme)
  uniform vec3 uColoreFocus;
  uniform float uVelocita;        // linee di velocità (quando Lia corre): 0..1
  uniform float uVersoVelocita;   // +1 corre verso destra, -1 verso sinistra
  varying vec2 vUv;

  float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

  void main() {
    vec2 uv = vUv;
    // tremolio "a passo uno": il disegno si muove appena, come fatto a mano
    float scatto = floor(uTempo * 6.0);
    vec2 n = texture2D(tRumore, uv * 2.3 + vec2(scatto * 0.137, scatto * 0.071)).rg - 0.5;
    vec2 uvT = uv + n * 0.0011 * uIntensita;

    // il colpo di bacchetta increspa l'immagine come un sasso nell'acqua
    float luceOnda = 0.0;
    if (uOndaSchermo.w > 0.0) {
      vec2 asp = vec2(uRis.x / uRis.y, 1.0);
      vec2 dc = (uv - uOndaSchermo.xy) * asp;
      float dist = length(dc);
      float raggio = uOndaSchermo.z * 0.75;
      float anello = exp(-pow((dist - raggio) / 0.035, 2.0)) * (1.0 - uOndaSchermo.z);
      uvT -= normalize(dc + 0.0001) / asp * anello * 0.012 * uOndaSchermo.w;
      luceOnda = anello * uOndaSchermo.w;
    }

    vec3 col = texture2D(tScena, uvT).rgb;

    // bordi di pigmento (differenze di luminosità tra pixel vicini)
    vec2 px = 1.4 / uRis;
    float l1 = lum(texture2D(tScena, uvT + vec2(px.x, 0.0)).rgb);
    float l2 = lum(texture2D(tScena, uvT - vec2(px.x, 0.0)).rgb);
    float l3 = lum(texture2D(tScena, uvT + vec2(0.0, px.y)).rgb);
    float l4 = lum(texture2D(tScena, uvT - vec2(0.0, px.y)).rgb);
    float bordo = smoothstep(0.035, 0.22, length(vec2(l1 - l2, l3 - l4)));
    col = mix(col, col * vec3(0.80, 0.74, 0.80), bordo * 0.5 * uIntensita);

    // sbavature e bagliore (usiamo versioni sfocate dell'immagine: i "mipmap")
    // (quattro campioni sfalsati: un solo mipmap molto piccolo farebbe "quadretti")
    vec3 sfocata = textureLod(tScena, uvT, 2.5).rgb;
    vec2 o = 10.0 / uRis;
    vec3 moltoSfocata = (textureLod(tScena, uv + vec2(o.x, o.y), 4.0).rgb + textureLod(tScena, uv + vec2(-o.x, o.y), 4.0).rgb
                       + textureLod(tScena, uv + vec2(o.x, -o.y), 4.0).rgb + textureLod(tScena, uv - o, 4.0).rgb) * 0.25;
    col = mix(col, sfocata, 0.10 * uIntensita);
    col += max(moltoSfocata - vec3(0.78), 0.0) * 0.55 * uIntensita;

    // saturazione
    float g = lum(col);
    col = mix(vec3(g), col, uSaturazione);

    // grana della carta e macchie di pigmento
    // (due campioni ruotati e di scala diversa: così non si vede la griglia
    //  del rumore, che altrimenti farebbe dei "quadretti" come i pixel)
    vec2 q = uv * uRis;
    mat2 ruota = mat2(0.8, -0.6, 0.6, 0.8);
    float g1 = texture2D(tRumore, q / 173.0).b;
    float g2 = texture2D(tRumore, ruota * q / 101.0 + 0.31).g;
    float grana = (g1 + g2) * 0.5;
    float macchie = texture2D(tRumore, ruota * uv * 1.1 + 0.37).r;
    col *= mix(1.0, (0.962 + grana * 0.06) * (0.955 + macchie * 0.075), uIntensita);

    // la luce dell'increspatura
    col += uColoreOnda * luceOnda * 0.18;

    // bordi: nel mondo immaginato svaniscono nella carta bianca, e "respirano"
    // piano come acquerello ancora bagnato
    vec2 c = (uv - 0.5) * vec2(uRis.x / uRis.y, 1.0);
    float rr = length(c);
    float respiro = texture2D(tRumore, ruota * uv * 0.7 + vec2(uTempo * 0.012, uTempo * 0.008)).r;
    float vign = smoothstep(0.42, 0.98, rr + (macchie - 0.5) * 0.12 + (respiro - 0.5) * 0.14);
    col = mix(col, uCarta, vign * uBordoBianco);
    col *= 1.0 - smoothstep(0.55, 1.2, rr) * 0.10 * (1.0 - uBordoBianco);

    // LINEE DI CONCENTRAZIONE (come nei manga): raggi sottili che convergono sul
    // punto importante, nei momenti di sorpresa e di meraviglia
    if (uFocus.z > 0.001) {
      vec2 asp = vec2(uRis.x / uRis.y, 1.0);
      vec2 d = (uv - uFocus.xy) * asp;
      float ang = atan(d.y, d.x);
      float raggi = texture2D(tRumore, vec2(ang * 1.7 + uFocus.w, 0.31)).b * 0.6 + texture2D(tRumore, vec2(ang * 0.9 - uFocus.w, 0.77)).g * 0.4;
      float linea = smoothstep(0.6, 0.7, raggi);
      float lontano = smoothstep(0.3, 0.95, length(d));
      col = mix(col, uColoreFocus, linea * lontano * uFocus.z);
    }
    // LINEE DI VELOCITÀ: strisce orizzontali che scorrono in alto e in basso
    if (uVelocita > 0.001) {
      float riga = texture2D(tRumore, vec2(0.37, uv.y * 2.3)).b;
      float scorre = texture2D(tRumore, vec2(uv.x * 0.5 + uTempo * 1.6 * uVersoVelocita, uv.y * 2.3 + 0.5)).r;
      float l = smoothstep(0.72, 0.8, riga) * smoothstep(0.42, 0.7, scorre);
      float margini = smoothstep(0.18, 0.45, abs(uv.y - 0.52));
      col = mix(col, vec3(1.0, 0.99, 0.95), l * margini * uVelocita * 0.55);
    }

    col = mix(col, uCarta, uBianco);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class Acquerello {
  constructor(renderer) {
    this.renderer = renderer;
    this.campioni = 0;
    this.scala = 1;
    this.bersaglio = null;
    this.materiale = new THREE.ShaderMaterial({
      uniforms: {
        tScena: { value: null },
        tRumore: UNIFORMI.uRumore,
        uRis: { value: new THREE.Vector2(1, 1) },
        uTempo: UNIFORMI.uTempo,
        uCarta: UNIFORMI.uCarta,
        uBianco: { value: 0 },
        uBordoBianco: { value: 0 },
        uSaturazione: { value: 1.08 },
        uIntensita: { value: 1 },
        uOndaSchermo: { value: new THREE.Vector4(0.5, 0.5, 1, 0) },
        uFocus: { value: new THREE.Vector4(0.5, 0.5, 0, 0) },
        uColoreFocus: { value: new THREE.Color('#fffaf0') },
        uVelocita: { value: 0 },
        uVersoVelocita: { value: 1 },
        uColoreOnda: { value: new THREE.Color('#ffe7a0') },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
    });
    // un triangolo che copre tutto lo schermo
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.quadro = new THREE.Mesh(geo, this.materiale);
    this.quadro.frustumCulled = false;
    this.scena = new THREE.Scene();
    this.scena.add(this.quadro);
    this.cameraPiatta = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  /** Imposta qualità: campioni = antialiasing (0, 2, 4), scala = risoluzione relativa. */
  imposta(larghezza, altezza, pixelRatio, scala, campioni) {
    const l = Math.max(1, Math.round(larghezza * pixelRatio * scala));
    const a = Math.max(1, Math.round(altezza * pixelRatio * scala));
    if (this.bersaglio && this.bersaglio.width === l && this.bersaglio.height === a && this.campioni === campioni) return;
    if (this.bersaglio) this.bersaglio.dispose();
    this.campioni = campioni;
    this.bersaglio = new THREE.WebGLRenderTarget(l, a, {
      samples: campioni,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: true,
      depthBuffer: true,
    });
    this.materiale.uniforms.tScena.value = this.bersaglio.texture;
    this.materiale.uniforms.uRis.value.set(l, a);
  }

  get uniformi() {
    return this.materiale.uniforms;
  }

  /** Disegna la scena con il filtro acquerello. */
  disegna(scena, camera) {
    const r = this.renderer;
    r.setRenderTarget(this.bersaglio);
    r.clear();
    r.render(scena, camera);
    r.setRenderTarget(null);
    r.render(this.scena, this.cameraPiatta);
  }
}
