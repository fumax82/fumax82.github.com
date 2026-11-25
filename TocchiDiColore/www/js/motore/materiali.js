/* ==========================================================================
 *  materiali.js — I "COLORI" DEL MOTORE (shader)
 *  --------------------------------------------------------------------------
 *  Un materiale dice alla scheda grafica come colorare ogni pixel.
 *  Tutti i materiali del mondo condividono alcune regole:
 *
 *   1. PERCEZIONE: dove Lia non percepisce, si vede la CARTA bianca con
 *      appena i tratti a matita; dove percepisce, i colori ad acquerello.
 *      La percezione è salvata in una piccola immagine (una casella = un
 *      pixel) che il gioco aggiorna di continuo: uRiv.
 *   2. ONDE: anelli colorati che si allargano (il "toc toc" del bastone,
 *      l'abbaiare di Biscotto, un profumo...).
 *   3. FOSCHIA: le cose lontane sfumano in un colore chiaro e caldo.
 *   4. LUCE: un sole caldo e ombre lilla (come nell'acquerello).
 *
 *  I valori comuni stanno nell'oggetto UNIFORMI: cambiandoli qui cambiano
 *  per tutti i materiali insieme.
 * ========================================================================== */
import * as THREE from 'three';

export const MAX_ONDE = 8;

/* ------------------------------------------------------------------------ */
/*  Valori condivisi da tutti i materiali                                   */
/* ------------------------------------------------------------------------ */
export const UNIFORMI = {
  uTempo: { value: 0 },
  uRiv: { value: null },                         // mappa della percezione (DataTexture)
  uDimMondo: { value: new THREE.Vector2(1, 1) }, // dimensioni del luogo in caselle
  uRumore: { value: null },                      // rumore per i bordi irregolari
  uCarta: { value: new THREE.Color('#fbf6ea') },
  uInk: { value: new THREE.Color('#6b4b37') },
  uNebbiaColore: { value: new THREE.Color('#f6efe2') },
  uNebbia: { value: new THREE.Vector2(9, 34) },
  uSchizzo: { value: 0.6 },
  uRivelaTutto: { value: 0 },                    // 1 = tutto visibile (prologo, finale)
  uSole: { value: new THREE.Vector3(0.45, 0.75, 0.48).normalize() },
  uLuceCalda: { value: new THREE.Color(1.06, 1.02, 0.95) },
  uLuceFredda: { value: new THREE.Color(0.80, 0.80, 0.93) },
  uOnde: { value: Array.from({ length: MAX_ONDE }, () => new THREE.Vector4(0, 0, 0, 0)) },
  uOndeColori: { value: Array.from({ length: MAX_ONDE }, () => new THREE.Color('#ffffff')) },
  uNumOnde: { value: 0 },                        // quante onde sono attive (le altre si saltano)
  uColoreCielo: { value: 1 },                    // 0 = cielo bianco, 1 = cielo colorato
};

/** Crea una texture di rumore morbido (ripetibile) per i bordi ad acquerello. */
export function creaRumore() {
  const dim = 128;
  const dati = new Uint8Array(dim * dim * 4);
  // rumore "a valori" su due scale, calcolato una volta sola
  const griglia = (celle, seme) => {
    let s = seme;
    const casuale = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const g = new Float32Array(celle * celle);
    for (let k = 0; k < g.length; k++) g[k] = casuale();
    return (x, y) => {
      const gx = (x / dim) * celle, gy = (y / dim) * celle;
      const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const v = (a, b) => g[((b % celle) * celle) + (a % celle)];
      const alto = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * sx;
      const basso = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * sx;
      return alto + (basso - alto) * sy;
    };
  };
  const a = griglia(8, 12345), b = griglia(16, 777), c = griglia(32, 4242);
  for (let y = 0; y < dim; y++) {
    for (let x = 0; x < dim; x++) {
      const i = (y * dim + x) * 4;
      dati[i] = (a(x, y) * 0.6 + b(x, y) * 0.3 + c(x, y) * 0.1) * 255;
      dati[i + 1] = b(x, y) * 255;
      dati[i + 2] = c(x, y) * 255;
      dati[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(dati, dim, dim, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/* ------------------------------------------------------------------------ */
/*  Pezzi di codice GLSL riutilizzati                                       */
/* ------------------------------------------------------------------------ */
const GLSL_COMUNE = /* glsl */ `
  uniform float uTempo;
  uniform sampler2D uRiv;
  uniform vec2 uDimMondo;
  uniform sampler2D uRumore;
  uniform vec3 uCarta;
  uniform vec3 uInk;
  uniform vec3 uNebbiaColore;
  uniform vec2 uNebbia;
  uniform float uSchizzo;
  uniform float uRivelaTutto;
  uniform vec4 uOnde[${MAX_ONDE}];
  uniform vec3 uOndeColori[${MAX_ONDE}];
  uniform int uNumOnde;

  // Quanto Lia percepisce il punto p (0 = carta bianca, 1 = colori pieni)
  float percezione(vec3 p) {
    float r = texture2D(uRiv, p.xz / uDimMondo).r;
    r = max(r, uRivelaTutto);
    float n = texture2D(uRumore, p.xz * 0.21 + vec2(p.y * 0.17, p.y * 0.05)).r;
    return clamp(r * 1.4 - 0.2 + (n - 0.5) * 0.8, 0.0, 1.0);
  }

  // Ombra morbida vicino ai muri (salvata nel canale verde di uRiv)
  float vicinoMuri(vec3 p) {
    return texture2D(uRiv, p.xz / uDimMondo).g;
  }

  // Anelli delle onde di percezione
  vec3 conOnde(vec3 col, vec3 p) {
    for (int i = 0; i < ${MAX_ONDE}; i++) {
      if (i >= uNumOnde) break;
      vec4 o = uOnde[i];
      if (o.w > 0.0) {
        float d = abs(length(p.xz - o.xy) - o.z);
        float anello = 1.0 - smoothstep(0.0, 0.55, d);
        float alone = 1.0 - smoothstep(0.0, 2.2, d);
        col = mix(col, uOndeColori[i], clamp(anello * anello * 0.95 + alone * 0.18, 0.0, 1.0) * o.w);
      }
    }
    return col;
  }

  // Foschia: le cose lontane sfumano nel colore dell'aria
  vec3 conNebbia(vec3 col, vec3 p) {
    float f = smoothstep(uNebbia.x, uNebbia.y, distance(p, cameraPosition));
    return mix(col, uNebbiaColore, f);
  }
`;

/* ------------------------------------------------------------------------ */
/*  MURI E PAVIMENTI                                                        */
/* ------------------------------------------------------------------------ */
const VERT_SUPERFICIE = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vMondo;
  varying vec3 vNormale;
  void main() {
    vUv = uv;
    vec4 m = modelMatrix * vec4(position, 1.0);
    vMondo = m.xyz;
    vNormale = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * m;
  }
`;

const FRAG_SUPERFICIE = /* glsl */ `
  ${GLSL_COMUNE}
  uniform sampler2D uMappa;   // RGB = colore, A = inchiostro (tratti a matita)
  uniform vec3 uSole;
  uniform vec3 uLuceCalda;
  uniform vec3 uLuceFredda;
  uniform vec2 uScorri;       // per l'acqua che scorre
  uniform float uOcclusione;  // 1 = scurisci vicino a terra e ai muri
  uniform float uBrillio;     // riflessi dell'acqua
  varying vec2 vUv;
  varying vec3 vMondo;
  varying vec3 vNormale;
  void main() {
    vec2 uv = vUv + uScorri * uTempo;
    if (uBrillio > 0.0) uv += vec2(sin(vMondo.z * 2.0 + uTempo * 1.3), cos(vMondo.x * 2.0 + uTempo)) * 0.015;
    vec4 t = texture2D(uMappa, uv);
    float v = percezione(vMondo);
    float l = clamp(dot(normalize(vNormale), uSole) * 0.5 + 0.5, 0.0, 1.0);
    vec3 col = t.rgb * mix(uLuceFredda, uLuceCalda, l);
    // ombra morbida alla base dei muri e sul pavimento vicino ai muri
    float ao = mix(0.84, 1.0, smoothstep(0.0, 0.7, vMondo.y + 0.1)) * (1.0 - vicinoMuri(vMondo) * 0.16);
    col *= mix(1.0, ao, uOcclusione);
    if (uBrillio > 0.0) {
      float s = texture2D(uRumore, vMondo.xz * 0.6 + vec2(uTempo * 0.05, -uTempo * 0.03)).b;
      col += vec3(1.0, 0.98, 0.9) * smoothstep(0.72, 0.9, s) * uBrillio;
    }
    vec3 c = mix(uCarta, col, v);
    c = mix(c, uInk, t.a * uSchizzo * (1.0 - v));
    c = conOnde(c, vMondo);
    c = conNebbia(c, vMondo);
    gl_FragColor = vec4(c, 1.0);
  }
`;

/**
 * Materiale per muri e pavimenti.
 *   mappa:  texture (RGB colore + A inchiostro)
 *   opz:    { scorri: [u, v] velocità, occlusione: 0..1, brillio: 0..1 }
 */
export function materialeSuperficie(mappa, opz) {
  const o = opz || {};
  return new THREE.ShaderMaterial({
    uniforms: {
      ...UNIFORMI,
      uMappa: { value: mappa },
      uScorri: { value: new THREE.Vector2(...(o.scorri || [0, 0])) },
      uOcclusione: { value: o.occlusione === undefined ? 1 : o.occlusione },
      uBrillio: { value: o.brillio || 0 },
    },
    vertexShader: VERT_SUPERFICIE,
    fragmentShader: FRAG_SUPERFICIE,
    side: THREE.DoubleSide,
  });
}

/* ------------------------------------------------------------------------ */
/*  SPRITE (personaggi e oggetti come sagome di carta)                      */
/* ------------------------------------------------------------------------ */
const VERT_SPRITE = /* glsl */ `
  uniform float uTempo;
  uniform vec2 uDim;        // larghezza e altezza nel mondo
  uniform vec4 uRiquadro;   // fotogramma dentro l'atlante: u0, v0, du, dv
  uniform float uSpecchio;  // 1 = specchiato (guarda a sinistra)
  uniform float uOscilla;   // ondeggiamento della cima
  uniform float uFase;
  uniform float uAncora;    // 0 = appoggiato a terra, 0.5 = centrato, 1 = appeso
  uniform float uPiatto;    // 1 = non ruota verso la telecamera (usa la rotazione dell'oggetto)
  varying vec2 vUv;
  varying vec3 vMondo;
  varying vec3 vBase;
  void main() {
    vec3 centro = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    // "Billboard cilindrico": la sagoma ruota solo attorno all'asse verticale
    vec3 destra = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]) + vec3(0.00001, 0.0, 0.0));
    if (uPiatto > 0.5) destra = normalize((modelMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
    float x = position.x * uDim.x;
    float y = (position.y - uAncora) * uDim.y;
    float cima = uAncora > 0.9 ? (1.0 - position.y) : position.y;
    x += sin(uTempo * 1.6 + uFase) * uOscilla * cima * cima * uDim.y;
    vec3 p = centro + destra * x + vec3(0.0, y, 0.0);
    vMondo = p;
    vBase = centro;
    vec2 q = vec2(position.x + 0.5, position.y);
    if (uSpecchio > 0.5) q.x = 1.0 - q.x;
    vUv = uRiquadro.xy + q * uRiquadro.zw;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;

const FRAG_SPRITE = /* glsl */ `
  ${GLSL_COMUNE}
  uniform sampler2D uMappa;
  uniform vec2 uTexel;      // dimensione di un pixel dell'atlante (per il contorno)
  uniform float uLuce;      // visibilità minima anche senza percezione
  uniform vec3 uTinta;
  uniform float uCielo;     // 1 = oggetto del cielo (niente percezione e foschia)
  uniform float uOpacita;
  uniform vec4 uRiquadroLimiti;
  varying vec2 vUv;
  varying vec3 vMondo;
  varying vec3 vBase;
  float alfa(vec2 uv) {
    uv = clamp(uv, uRiquadroLimiti.xy, uRiquadroLimiti.zw);
    return texture2D(uMappa, uv).a;
  }
  void main() {
    vec4 t = texture2D(uMappa, vUv);
    float a = t.a * uOpacita;
    // le sagome troppo vicine alla telecamera diventano trasparenti (non coprono la vista)
    if (uCielo < 0.5) a *= smoothstep(0.55, 1.5, distance(vBase.xz, cameraPosition.xz) + max(0.0, cameraPosition.y - vMondo.y - 1.0));
    if (a < 0.03) discard;
    vec3 col = t.rgb * uTinta;
    if (uCielo > 0.5) {
      gl_FragColor = vec4(col, a);
      return;
    }
    // contorno ricavato dalla trasparenza: si vede come "schizzo" quando Lia non percepisce
    float e = 4.0 - alfa(vUv + vec2(uTexel.x, 0.0)) - alfa(vUv - vec2(uTexel.x, 0.0))
                  - alfa(vUv + vec2(0.0, uTexel.y)) - alfa(vUv - vec2(0.0, uTexel.y));
    e = clamp(e, 0.0, 1.0);
    float v = max(percezione(vec3(vBase.x, vMondo.y, vBase.z)), uLuce);
    vec3 c = mix(uCarta, col, v);
    c = mix(c, uInk, e * uSchizzo * (1.0 - v) * 1.4);
    c = conOnde(c, vec3(vBase.x, vMondo.y, vBase.z));
    c = conNebbia(c, vMondo);
    gl_FragColor = vec4(c, a);
  }
`;

const geometriaSprite = new THREE.PlaneGeometry(1, 1);
geometriaSprite.translate(0, 0.5, 0); // da x -0.5..0.5, y 0..1

export function geometriaPerSprite() {
  return geometriaSprite;
}

/**
 * Materiale di uno sprite. Ogni sprite ha il suo materiale (così può
 * mostrare un fotogramma diverso), ma la texture dell'atlante è condivisa.
 */
export function materialeSprite(texture, opz) {
  const o = opz || {};
  const img = texture.image;
  return new THREE.ShaderMaterial({
    uniforms: {
      ...UNIFORMI,
      uMappa: { value: texture },
      uTexel: { value: new THREE.Vector2(2 / img.width, 2 / img.height) },
      uDim: { value: new THREE.Vector2(1, 1) },
      uRiquadro: { value: new THREE.Vector4(0, 0, 1, 1) },
      uRiquadroLimiti: { value: new THREE.Vector4(0, 0, 1, 1) },
      uSpecchio: { value: 0 },
      uOscilla: { value: o.oscilla || 0 },
      uFase: { value: Math.random() * 6.28 },
      uAncora: { value: o.ancora || 0 },
      uPiatto: { value: o.piatto ? 1 : 0 },
      uLuce: { value: o.luce || 0 },
      uTinta: { value: new THREE.Color(1, 1, 1) },
      uCielo: { value: o.cielo ? 1 : 0 },
      uOpacita: { value: 1 },
    },
    vertexShader: VERT_SPRITE,
    fragmentShader: FRAG_SPRITE,
    side: THREE.DoubleSide,
    transparent: !!o.trasparente,
    depthWrite: !o.trasparente,
    alphaToCoverage: !o.trasparente,
  });
}

/* ------------------------------------------------------------------------ */
/*  OMBRE A TERRA (macchie morbide sotto oggetti e personaggi)              */
/* ------------------------------------------------------------------------ */
const FRAG_OMBRA = /* glsl */ `
  ${GLSL_COMUNE}
  uniform float uForza;
  varying vec2 vUv;
  varying vec3 vMondo;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float a = (1.0 - smoothstep(0.25, 1.0, r)) * uForza;
    float v = percezione(vMondo);
    gl_FragColor = vec4(0.42, 0.33, 0.52, a * (0.25 + 0.75 * v));
  }
`;

export function materialeOmbra(forza) {
  return new THREE.ShaderMaterial({
    uniforms: { ...UNIFORMI, uForza: { value: forza === undefined ? 0.38 : forza } },
    vertexShader: VERT_SUPERFICIE,
    fragmentShader: FRAG_OMBRA,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

/* ------------------------------------------------------------------------ */
/*  CIELO (cupola dipinta)                                                  */
/* ------------------------------------------------------------------------ */
const VERT_CIELO = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;   // sempre "infinitamente lontano"
  }
`;
const FRAG_CIELO = /* glsl */ `
  uniform sampler2D uMappa;
  uniform vec3 uCarta;
  uniform float uColoreCielo;
  uniform vec3 uSole;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float u = atan(d.z, d.x) / 6.2831853 + 0.5;
    float v = clamp(d.y * 1.25 + 0.04, 0.0, 1.0);
    vec3 col = texture2D(uMappa, vec2(u, pow(v, 0.8))).rgb;
    // bagliore caldo attorno al sole
    float s = max(dot(d, normalize(uSole)), 0.0);
    col += vec3(1.0, 0.92, 0.7) * pow(s, 24.0) * 0.35;
    // vicino all'orizzonte il cielo si scioglie nella carta (come nel film)
    col = mix(uCarta, col, smoothstep(-0.05, 0.35, d.y) * 0.6 + 0.4);
    gl_FragColor = vec4(mix(uCarta, col, uColoreCielo), 1.0);
  }
`;

export function materialeCielo(texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMappa: { value: texture },
      uCarta: UNIFORMI.uCarta,
      uColoreCielo: UNIFORMI.uColoreCielo,
      uSole: UNIFORMI.uSole,
    },
    vertexShader: VERT_CIELO,
    fragmentShader: FRAG_CIELO,
    side: THREE.BackSide,
    depthWrite: false,
  });
}

/* ------------------------------------------------------------------------ */
/*  SFONDI PANORAMICI (anelli dipinti attorno al luogo)                     */
/* ------------------------------------------------------------------------ */
const VERT_ANELLO = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const FRAG_ANELLO = /* glsl */ `
  uniform sampler2D uMappa;
  uniform vec3 uNebbiaColore;
  uniform vec3 uCarta;
  uniform float uFoschia;
  uniform float uColoreCielo;
  uniform vec2 uRipeti;
  varying vec2 vUv;
  void main() {
    vec4 t = texture2D(uMappa, vec2(vUv.x * uRipeti.x, vUv.y));
    if (t.a < 0.02) discard;
    vec3 c = mix(t.rgb, uNebbiaColore, uFoschia);
    c = mix(uCarta, c, uColoreCielo);
    gl_FragColor = vec4(c, t.a);
  }
`;

export function materialeAnello(texture, ripetizioni, foschia) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMappa: { value: texture },
      uNebbiaColore: UNIFORMI.uNebbiaColore,
      uCarta: UNIFORMI.uCarta,
      uColoreCielo: UNIFORMI.uColoreCielo,
      uFoschia: { value: foschia },
      uRipeti: { value: new THREE.Vector2(ripetizioni, 1) },
    },
    vertexShader: VERT_ANELLO,
    fragmentShader: FRAG_ANELLO,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  });
}
