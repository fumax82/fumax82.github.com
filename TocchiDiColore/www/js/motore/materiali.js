/* ==========================================================================
 *  materiali.js — COME SI COLORA OGNI PIXEL (shader)
 *  --------------------------------------------------------------------------
 *  Regole comuni a tutti i disegni della scena:
 *
 *   1. PERCEZIONE: dove Lia non percepisce si vede la CARTA con uno schizzo
 *      a matita (ricavato automaticamente dai contorni del dipinto); dove
 *      percepisce, l'acquerello a colori. La percezione è una piccola mappa
 *      della scena vista dall'alto (uRiv), che il gioco aggiorna di continuo.
 *   2. ONDE: anelli colorati che si allargano a ogni "toc toc", abbaio, profumo.
 *   3. ACQUA che si increspa, FOGLIE che ondeggiano, LUCI che brillano.
 *
 *  I valori comuni stanno in UNIFORMI: cambiandoli lì cambiano per tutti.
 * ========================================================================== */
import * as THREE from 'three';

export const MAX_ONDE = 8;

export const UNIFORMI = {
  uTempo: { value: 0 },
  uRiv: { value: null },                         // mappa della percezione (vista dall'alto)
  uRivMin: { value: new THREE.Vector2(0, 0) },   // angolo (x, z) della mappa nel mondo
  uRivDim: { value: new THREE.Vector2(1, 1) },   // dimensioni (x, z) coperte dalla mappa
  uRumore: { value: null },
  uCarta: { value: new THREE.Color('#fbf6ea') },
  uInk: { value: new THREE.Color('#6b4b37') },
  uSchizzo: { value: 0.75 },
  uRivelaTutto: { value: 1 },                    // 1 = tutto a colori (prologo, interni, finale)
  uOnde: { value: Array.from({ length: MAX_ONDE }, () => new THREE.Vector4(0, 0, 0, 0)) },
  uOndeColori: { value: Array.from({ length: MAX_ONDE }, () => new THREE.Color('#ffffff')) },
  uNumOnde: { value: 0 },
  uColoreCielo: { value: 1 },
  uSole: { value: new THREE.Vector3(0.4, 0.75, 0.5).normalize() },
  uFoschia: { value: new THREE.Vector2(14, 70) },  // distanza a cui inizia/finisce la foschia
  uLuceScena: { value: new THREE.Color(1, 1, 1) },  // tinta generale (es. luce calda del tramonto)
  uFuoco: { value: 5 },          // distanza messa a fuoco (quella di Lia dalla camera)
  uSfocatura: { value: 1.6 },    // quanto si sfocano i piani fuori fuoco (profondità di campo)
};

/** Rumore morbido ripetibile (per i bordi irregolari ad acquerello). */
export function creaRumore() {
  const dim = 128;
  const dati = new Uint8Array(dim * dim * 4);
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
/*  Codice GLSL comune                                                      */
/* ------------------------------------------------------------------------ */
const GLSL_COMUNE = /* glsl */ `
  uniform float uTempo;
  uniform sampler2D uRiv;
  uniform vec2 uRivMin;
  uniform vec2 uRivDim;
  uniform sampler2D uRumore;
  uniform vec3 uCarta;
  uniform vec3 uInk;
  uniform float uSchizzo;
  uniform float uRivelaTutto;
  uniform vec4 uOnde[${MAX_ONDE}];
  uniform vec3 uOndeColori[${MAX_ONDE}];
  uniform int uNumOnde;
  uniform vec2 uFoschia;
  uniform vec3 uLuceScena;
  uniform float uFuoco;
  uniform float uSfocatura;

  // quanto Lia percepisce il punto p: 0 = carta bianca, 1 = colori pieni
  float percezione(vec3 p) {
    float r = texture2D(uRiv, (p.xz - uRivMin) / uRivDim).r;
    r = max(r, uRivelaTutto);
    float n = texture2D(uRumore, p.xz * 0.17 + vec2(p.y * 0.21, p.y * 0.07)).r;
    return clamp(r * 1.45 - 0.22 + (n - 0.5) * 0.85, 0.0, 1.0);
  }

  // anelli delle onde (il "toc toc" che si allarga)
  vec3 conOnde(vec3 col, vec3 p) {
    for (int i = 0; i < ${MAX_ONDE}; i++) {
      if (i >= uNumOnde) break;
      vec4 o = uOnde[i];
      float d = abs(length(p.xz - o.xy) - o.z);
      float anello = 1.0 - smoothstep(0.0, 0.5, d);
      float alone = 1.0 - smoothstep(0.0, 2.0, d);
      col = mix(col, uOndeColori[i], clamp(anello * anello * 0.9 + alone * 0.14, 0.0, 1.0) * o.w);
    }
    return col;
  }

  float lum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
`;

/* ------------------------------------------------------------------------ */
/*  STRATI DIPINTI                                                          */
/* ------------------------------------------------------------------------ */
const VERT_STRATO = /* glsl */ `
  uniform float uTempo;
  uniform float uTremola;
  varying vec2 vUv;
  varying vec3 vMondo;
  void main() {
    vUv = uv;
    vec4 m = modelMatrix * vec4(position, 1.0);
    // il fogliame ondeggia piano, più in alto che in basso
    if (uTremola > 0.0) m.x += sin(uTempo * 1.3 + m.x * 0.7 + m.z) * uTremola * 0.06 * uv.y * uv.y;
    vMondo = m.xyz;
    gl_Position = projectionMatrix * viewMatrix * m;
  }
`;

const FRAG_STRATO = /* glsl */ `
  ${GLSL_COMUNE}
  uniform sampler2D uMappa;
  uniform vec2 uTexel;
  uniform float uAcqua;
  uniform float uLuce;
  uniform float uOpacita;
  uniform float uLontano;
  uniform float uColoreCielo;
  uniform float uSchizzoStrato;
  varying vec2 vUv;
  varying vec3 vMondo;
  void main() {
    vec2 uv = vUv;
    if (uAcqua > 0.5) {
      uv += vec2(sin(vMondo.z * 1.4 + uTempo * 1.2), cos(vMondo.x * 1.9 + uTempo * 0.9)) * 0.0035;
      uv.y += uTempo * 0.004;
    }
    // profondità di campo, come nella "multiplane camera" dei cartoni:
    // i piani molto più vicini o più lontani di Lia sono un po' sfocati
    float dist = distance(cameraPosition, vMondo);
    float fuori = abs(dist - uFuoco) / max(uFuoco, 0.5);
    float sfoca = smoothstep(0.35, 1.8, fuori) * uSfocatura;
    vec4 t = texture2D(uMappa, uv, sfoca);
    if (t.a < 0.03) discard;
    // i fondali lontani non vengono raggiunti dalle onde: seguono il cielo
    float v = mix(percezione(vMondo), uColoreCielo, uLontano);
    v = max(v, uLuce);
    vec3 c = t.rgb * uLuceScena;
    if (v < 0.999) {
      // schizzo a matita ricavato dai contorni del dipinto
      float lx = lum(texture2D(uMappa, uv + vec2(uTexel.x, 0.0)).rgb) - lum(texture2D(uMappa, uv - vec2(uTexel.x, 0.0)).rgb);
      float ly = lum(texture2D(uMappa, uv + vec2(0.0, uTexel.y)).rgb) - lum(texture2D(uMappa, uv - vec2(0.0, uTexel.y)).rgb);
      float ax = texture2D(uMappa, uv + vec2(uTexel.x, 0.0)).a - texture2D(uMappa, uv - vec2(uTexel.x, 0.0)).a;
      float ay = texture2D(uMappa, uv + vec2(0.0, uTexel.y)).a - texture2D(uMappa, uv - vec2(0.0, uTexel.y)).a;
      float bordo = smoothstep(0.08, 0.32, length(vec2(lx, ly)) + length(vec2(ax, ay)) * 0.6);
      vec3 schizzo = mix(uCarta, uInk, bordo * uSchizzo * uSchizzoStrato);
      c = mix(schizzo, t.rgb * uLuceScena, v);
    }
    if (uAcqua > 0.5) {
      float s = texture2D(uRumore, vMondo.xz * 0.5 + vec2(uTempo * 0.04, -uTempo * 0.03)).b;
      c += vec3(1.0, 0.98, 0.92) * smoothstep(0.74, 0.9, s) * 0.35 * v;
    }
    c = conOnde(c, vMondo);
    // foschia: le cose lontane sfumano nel colore della carta
    float f = smoothstep(uFoschia.x, uFoschia.y, dist);
    c = mix(c, uCarta, f * 0.75);
    gl_FragColor = vec4(c, t.a * uOpacita);
  }
`;

/**
 * Materiale di uno strato dipinto.
 * opz: { acqua, tremola, luce, lontano, pavimento }
 */
export function materialeStrato(texture, opz) {
  const o = opz || {};
  const img = texture.image;
  return new THREE.ShaderMaterial({
    uniforms: {
      ...UNIFORMI,
      uMappa: { value: texture },
      uTexel: { value: new THREE.Vector2(1.5 / img.width, 1.5 / img.height) },
      uAcqua: { value: o.acqua ? 1 : 0 },
      uTremola: { value: o.tremola || 0 },
      uLuce: { value: o.luce || 0 },
      uOpacita: { value: 1 },
      uLontano: { value: o.lontano ? 1 : 0 },
      uColoreCielo: UNIFORMI.uColoreCielo,
      // sui pavimenti (tanti sassi e mattonelle) la matita è più leggera
      uSchizzoStrato: { value: o.pavimento ? 0.4 : 1 },
    },
    vertexShader: VERT_STRATO,
    fragmentShader: FRAG_STRATO,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: true,
  });
}

/* ------------------------------------------------------------------------ */
/*  SPRITE: personaggi e oggetti (sagome sempre rivolte alla telecamera)    */
/* ------------------------------------------------------------------------ */
const VERT_SPRITE = /* glsl */ `
  uniform float uTempo;
  uniform vec2 uDim;
  uniform vec4 uRiquadro;
  uniform float uSpecchio;
  uniform float uOscilla;
  uniform float uFase;
  uniform float uAncora;
  uniform float uPiatto;
  uniform float uSferico;
  varying vec2 vUv;
  varying vec3 vMondo;
  varying vec3 vBase;
  void main() {
    vec3 centro = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec3 destra = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]) + vec3(0.00001, 0.0, 0.0));
    vec3 su = vec3(0.0, 1.0, 0.0);
    if (uPiatto > 0.5) destra = normalize((modelMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
    // "sferico": la sagoma guarda la camera anche dall'alto (nuvole viste dalla balena)
    if (uSferico > 0.5) {
      destra = normalize(vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]));
      su = normalize(vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]));
    }
    float x = position.x * uDim.x;
    float y = (position.y - uAncora) * uDim.y;
    float cima = uAncora > 0.9 ? (1.0 - position.y) : position.y;
    x += sin(uTempo * 1.6 + uFase) * uOscilla * cima * cima * uDim.y;
    vec3 p = centro + destra * x + su * y;
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
  uniform vec2 uTexel;
  uniform float uLuce;
  uniform vec3 uTinta;
  uniform float uCielo;
  uniform float uOpacita;
  uniform vec4 uRiquadroLimiti;
  uniform float uColoreCielo;
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
    if (a < 0.03) discard;
    vec3 col = t.rgb * uTinta;
    if (uCielo > 0.5) { gl_FragColor = vec4(mix(uCarta, col, 0.35 + 0.65 * uColoreCielo), a); return; }
    col *= uLuceScena;
    float v = max(percezione(vec3(vBase.x, vMondo.y, vBase.z)), uLuce);
    vec3 c = col;
    if (v < 0.999) {
      float e = 4.0 - alfa(vUv + vec2(uTexel.x, 0.0)) - alfa(vUv - vec2(uTexel.x, 0.0))
                    - alfa(vUv + vec2(0.0, uTexel.y)) - alfa(vUv - vec2(0.0, uTexel.y));
      e = clamp(e, 0.0, 1.0);
      c = mix(mix(uCarta, uInk, e * uSchizzo * 1.3), col, v);
    }
    c = conOnde(c, vec3(vBase.x, vMondo.y, vBase.z));
    gl_FragColor = vec4(c, a);
  }
`;

const geometriaSprite = new THREE.PlaneGeometry(1, 1);
geometriaSprite.translate(0, 0.5, 0);
export function geometriaPerSprite() { return geometriaSprite; }

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
      uSferico: { value: o.sferico ? 1 : 0 },
      uLuce: { value: o.luce || 0 },
      uTinta: { value: new THREE.Color(1, 1, 1) },
      uCielo: { value: o.cielo ? 1 : 0 },
      uOpacita: { value: 1 },
      uColoreCielo: UNIFORMI.uColoreCielo,
    },
    vertexShader: VERT_SPRITE,
    fragmentShader: FRAG_SPRITE,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: !o.cielo,
  });
}

/* ------------------------------------------------------------------------ */
/*  OMBRE A TERRA                                                           */
/* ------------------------------------------------------------------------ */
const VERT_SEMPLICE = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vMondo;
  void main() {
    vUv = uv;
    vec4 m = modelMatrix * vec4(position, 1.0);
    vMondo = m.xyz;
    gl_Position = projectionMatrix * viewMatrix * m;
  }
`;
const FRAG_OMBRA = /* glsl */ `
  ${GLSL_COMUNE}
  uniform float uForza;
  varying vec2 vUv;
  varying vec3 vMondo;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float a = (1.0 - smoothstep(0.2, 1.0, r)) * uForza;
    gl_FragColor = vec4(0.40, 0.30, 0.48, a * (0.3 + 0.7 * percezione(vMondo)));
  }
`;
export function materialeOmbra(forza) {
  return new THREE.ShaderMaterial({
    uniforms: { ...UNIFORMI, uForza: { value: forza === undefined ? 0.35 : forza } },
    vertexShader: VERT_SEMPLICE,
    fragmentShader: FRAG_OMBRA,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

/* ------------------------------------------------------------------------ */
/*  CIELO E PANORAMI                                                        */
/* ------------------------------------------------------------------------ */
const VERT_CIELO = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
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
    float s = max(dot(d, normalize(uSole)), 0.0);
    col += vec3(1.0, 0.92, 0.7) * pow(s, 24.0) * 0.3;
    col = mix(uCarta, col, smoothstep(-0.05, 0.35, d.y) * 0.65 + 0.35);
    gl_FragColor = vec4(mix(uCarta, col, uColoreCielo), 1.0);
  }
`;
export function materialeCielo(texture) {
  return new THREE.ShaderMaterial({
    uniforms: { uMappa: { value: texture }, uCarta: UNIFORMI.uCarta, uColoreCielo: UNIFORMI.uColoreCielo, uSole: UNIFORMI.uSole },
    vertexShader: VERT_CIELO,
    fragmentShader: FRAG_CIELO,
    side: THREE.BackSide,
    depthWrite: false,
  });
}

const VERT_ANELLO = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const FRAG_ANELLO = /* glsl */ `
  uniform sampler2D uMappa;
  uniform vec3 uCarta;
  uniform float uFoschia;
  uniform float uColoreCielo;
  uniform vec2 uRipeti;
  varying vec2 vUv;
  void main() {
    vec4 t = texture2D(uMappa, vec2(vUv.x * uRipeti.x, vUv.y), 0.8);
    if (t.a < 0.02) discard;
    vec3 c = mix(t.rgb, uCarta, uFoschia);
    c = mix(uCarta, c, uColoreCielo);
    gl_FragColor = vec4(c, t.a);
  }
`;
export function materialeAnello(texture, ripetizioni, foschia) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMappa: { value: texture }, uCarta: UNIFORMI.uCarta, uColoreCielo: UNIFORMI.uColoreCielo,
      uFoschia: { value: foschia }, uRipeti: { value: new THREE.Vector2(ripetizioni, 1) },
    },
    vertexShader: VERT_ANELLO,
    fragmentShader: FRAG_ANELLO,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  });
}
