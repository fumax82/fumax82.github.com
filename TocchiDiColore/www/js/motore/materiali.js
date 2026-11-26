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
  uPennellate: { value: null },  // colpi di pennello (vedi creaPennellate)
  uCarta: { value: new THREE.Color('#fbf6ea') },
  uInk: { value: new THREE.Color('#6b4b37') },
  uSchizzo: { value: 0.75 },
  uRivelaTutto: { value: 1 },                    // 1 = tutto a colori (prologo, interni, finale)
  uOnde: { value: Array.from({ length: MAX_ONDE }, () => new THREE.Vector4(0, 0, 0, 0)) },
  uOndeColori: { value: Array.from({ length: MAX_ONDE }, () => new THREE.Color('#ffffff')) },
  uNumOnde: { value: 0 },
  uColoreCielo: { value: 1 },
  // il sole: basso, davanti e a sinistra (si vede nelle inquadrature verso il fondo)
  uSole: { value: new THREE.Vector3(-0.4, 0.32, -0.86).normalize() },
  uFoschia: { value: new THREE.Vector2(14, 70) },  // distanza a cui inizia/finisce la foschia
  uLuceScena: { value: new THREE.Color(1, 1, 1) },  // tinta generale (es. luce calda del tramonto)
  uColoreMagia: { value: new THREE.Color('#ffd77a') },  // colore della luce sul fronte (quello dell'ultima onda)
  uMagia: { value: 0.6 },        // quanto è "magica" la rivelazione (1 = Lia streghetta)
  uOmbreNuvole: { value: 0 },    // ombre delle nuvole che scorrono (0 = nessuna)
  uOmbraBalena: { value: new THREE.Vector4(0, 0, 1, 0) },  // ombra della balena: (x, z, raggio, forza)
  uPioggia: { value: 0 },        // quanto piove (0..1): bagnato, pozzanghere, cerchi delle gocce
  uRetino: { value: 1 },         // retino manga nel mondo non ancora scoperto (0 = spento)
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

/**
 * PENNELLATE: una texture in bianco e nero piena di colpi di pennello
 * (lunghi, morbidi, quasi orizzontali). Lo shader la usa come "maschera":
 * il colore arriva prima dove la pennellata è chiara, poi dove è scura,
 * così il mondo sembra dipinto a pennellate mentre Lia lo immagina.
 */
export function creaPennellate() {
  const L = 512;
  const tela = document.createElement('canvas');
  tela.width = tela.height = L;
  const c = tela.getContext('2d');
  c.fillStyle = 'rgb(128,128,128)';
  c.fillRect(0, 0, L, L);
  let seme = 2010;
  const caso = () => ((seme = (seme * 16807) % 2147483647) / 2147483647);
  c.lineCap = 'round';
  for (let k = 0; k < 520; k++) {
    const x = caso() * L, y = caso() * L;
    const ang = (caso() - 0.5) * 0.9 + (caso() < 0.2 ? 0.8 : 0);   // per lo più orizzontali
    const lung = 50 + caso() * 130, larg = 10 + caso() * 26;
    const v = Math.round(caso() * 255);
    c.strokeStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + (0.45 + caso() * 0.45) + ')';
    c.lineWidth = larg;
    const curva = (caso() - 0.5) * lung * 0.4;
    // disegnata anche "dall'altra parte" dei bordi: la texture si ripete senza cuciture
    for (const dx of [-L, 0, L]) {
      for (const dy of [-L, 0, L]) {
        const ax = x + dx, ay = y + dy;
        c.beginPath();
        c.moveTo(ax - Math.cos(ang) * lung / 2, ay - Math.sin(ang) * lung / 2);
        c.quadraticCurveTo(ax + Math.sin(ang) * curva, ay - Math.cos(ang) * curva, ax + Math.cos(ang) * lung / 2, ay + Math.sin(ang) * lung / 2);
        c.stroke();
      }
    }
  }
  const t = new THREE.CanvasTexture(tela);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
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
  uniform sampler2D uPennellate;
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

  uniform vec3 uColoreMagia;
  uniform float uMagia;
  uniform float uOmbreNuvole;
  uniform vec4 uOmbraBalena;
  uniform float uPioggia;
  uniform float uRetino;

  /*
   * LA RIVELAZIONE, in tre tempi (come nel film, il mondo "si disegna"):
   *   1. la MATITA: i contorni compaiono per primi, un po' prima del colore
   *   2. il COLORE: arriva come acquerello bagnato che si allarga
   *   3. il BORDO BAGNATO: dove il colore sta arrivando, il pigmento si
   *      accumula (più scuro) e brilla di luce magica
   * Restituisce vec3(colore, matita, bordo bagnato), ognuno da 0 a 1.
   */
  // coordinate per leggere il rumore che vanno bene sia sui pavimenti sia sui muri
  // (senza, sui muri il rumore si "stira" e fa delle strisce)
  vec2 qr(vec3 p) { return vec2(p.x + p.z * 0.65, p.y * 1.1 + p.z * 0.75); }

  // rumore morbido senza "griglia": tre letture ruotate di 60 gradi, mescolate
  float rumoreMorbido(vec2 q) {
    float a = texture2D(uRumore, q).r;
    float b = texture2D(uRumore, mat2(0.5, -0.866, 0.866, 0.5) * q * 1.31 + 0.37).r;
    float c = texture2D(uRumore, mat2(-0.5, -0.866, 0.866, -0.5) * q * 0.77 + 0.71).r;
    return ((a + b + c) / 3.0 - 0.5) * 1.7 + 0.5;
  }

  vec3 rivelazione(vec3 p) {
    vec2 q = (p.xz - uRivMin) / uRivDim;
    float r = max(texture2D(uRiv, q).r, uRivelaTutto);
    // già tutto a colori (prologo, interni): niente calcoli in più (più veloce sui telefoni)
    if (r > 0.995) return vec3(1.0, 1.0, 0.0);
    // due rumori: uno fermo (forma delle macchie), uno che scorre (il colore "vivo")
    vec2 c = qr(p);
    float n1 = rumoreMorbido(c * 0.15);
    float n2 = rumoreMorbido(c * 0.33 + vec2(uTempo * 0.02, -uTempo * 0.015));
    // il colore arriva a pennellate (strisce morbide quasi orizzontali)
    float pen = texture2D(uPennellate, c * vec2(0.42, 0.55)).r;
    float n = (n1 * 0.7 + n2 * 0.3) * 0.45 + pen * 0.55;
    float colore = smoothstep(0.32, 0.7, r * 1.3 - 0.12 + (n - 0.5) * 0.75);
    float matita = smoothstep(0.02, 0.3, r * 1.4 + (n - 0.5) * 0.4);
    float b = colore * (1.0 - colore) * 4.0;
    float bagnato = b * b * b;   // un bordo sottile, come il segno lasciato dall'acqua
    return vec3(colore, matita, bagnato);
  }

  // velatura d'oro (o del colore dell'onda): tinge la carta invece di sbiancarla
  vec3 velatura(vec3 col, float quanto) {
    vec3 tinta = col * mix(vec3(1.0), uColoreMagia, 0.85) * 1.06;
    return mix(col, tinta, clamp(quanto, 0.0, 1.0));
  }

  // quanto Lia percepisce il punto p: 0 = carta bianca, 1 = colori pieni
  float percezione(vec3 p) { return rivelazione(p).x; }

  // quanto il punto è "appena scoperto" (brilla per un paio di secondi)
  float freschezza(vec3 p) {
    return texture2D(uRiv, (p.xz - uRivMin) / uRivDim).g * (1.0 - uRivelaTutto);
  }

  // stelline rotonde che si accendono e si spengono: in ogni "cella" di 1/scala
  // metri c'è (forse) un puntino in un posto a caso, che brilla a ritmo suo
  float stelline(vec2 q, float t) {
    vec2 cella = floor(q);
    vec2 f = fract(q) - 0.5;
    float h = fract(sin(dot(cella, vec2(127.1, 311.7))) * 43758.5453);
    vec2 spost = vec2(fract(h * 13.7), fract(h * 71.3)) - 0.5;
    float d = length(f - spost * 0.6);
    float ritmo = 0.5 + 0.5 * sin(t * (2.0 + h * 3.0) + h * 6.28);
    return smoothstep(0.13, 0.0, d) * step(0.5, h) * ritmo * ritmo;
  }

  // scintillii dorati che brillano e si spengono sulle cose appena scoperte
  vec3 conBrillio(vec3 col, vec3 p, float fr) {
    if (fr < 0.01) return col;
    float g = dot(col, vec3(0.3, 0.59, 0.11));
    col = mix(vec3(g), col, 1.0 + fr * 0.35);                 // colori più vivi
    col = velatura(col, fr * 0.22 * uMagia);                   // un velo caldo
    vec2 c = qr(p);
    float scintilla = stelline(c * 4.0, uTempo * 1.3) + stelline(c * 7.0 + 3.1, uTempo * 1.7) * 0.7;
    col += (uColoreMagia * 0.8 + 0.2) * scintilla * fr * 0.8 * uMagia;
    return col;
  }

  /*
   * OMBRE D'ATMOSFERA (non realistiche: colorate e morbide, come in un acquerello)
   *   - le nuvole che passano lasciano macchie d'ombra lilla che scorrono
   *   - la balena del cielo, passando, stende sopra la strada un'ombra enorme
   */
  vec3 conOmbre(vec3 col, vec3 p) {
    float o = 0.0;
    if (uOmbreNuvole > 0.001) {
      float n = rumoreMorbido(p.xz * 0.03 + vec2(uTempo * 0.012, uTempo * 0.005));
      o += smoothstep(0.55, 0.78, n) * uOmbreNuvole;
    }
    if (uOmbraBalena.w > 0.001) {
      vec2 d = (p.xz - uOmbraBalena.xy) / vec2(uOmbraBalena.z * 2.4, uOmbraBalena.z);
      o += (1.0 - smoothstep(0.5, 1.0, length(d))) * uOmbraBalena.w;
    }
    return mix(col, col * vec3(0.72, 0.73, 0.92), clamp(o, 0.0, 0.65));
  }

  /*
   * LA PIOGGIA: tutto un po' più scuro e lucido; sui pavimenti pozzanghere
   * azzurre e i cerchi delle gocce che cadono.
   */
  vec3 conPioggia(vec3 col, vec3 p, float pavimento) {
    if (uPioggia < 0.01) return col;
    col *= 1.0 - 0.1 * uPioggia;
    if (pavimento > 0.5) {
      vec2 q = p.xz * 2.2;
      vec2 cella = floor(q);
      vec2 f = fract(q) - 0.5;
      float h = fract(sin(dot(cella, vec2(12.9898, 78.233))) * 43758.5453);
      float fase = fract(uTempo * (0.6 + h * 0.8) + h * 7.0);
      vec2 centro = (vec2(h, fract(h * 7.3)) - 0.5) * 0.5;
      float anello = (1.0 - smoothstep(0.0, 0.05, abs(length(f - centro) - fase * 0.45))) * (1.0 - fase);
      float pozza = smoothstep(0.55, 0.7, rumoreMorbido(p.xz * 0.35));
      col = mix(col, col * vec3(0.86, 0.92, 1.06) + 0.05, pozza * uPioggia * 0.65);
      col += vec3(0.85, 0.92, 1.0) * anello * uPioggia * (0.22 + pozza * 0.5);
    }
    return col;
  }

  // anelli delle onde: un anello di luce, un'eco più debole dentro e scintille lungo il bordo
  vec3 conOnde(vec3 col, vec3 p) {
    for (int i = 0; i < ${MAX_ONDE}; i++) {
      if (i >= uNumOnde) break;
      vec4 o = uOnde[i];
      float dd = length(p.xz - o.xy);
      float d = dd - o.z;
      float anello = exp(-d * d * 9.0);
      float eco = exp(-(dd - o.z * 0.7) * (dd - o.z * 0.7) * 14.0) * 0.4;
      float dentro = (1.0 - smoothstep(0.0, max(o.z, 0.01), dd)) * 0.08;
      float brilli = stelline(qr(p) * 5.0, uTempo * 2.0) * anello;
      vec3 c = uOndeColori[i];
      // l'anello tinge (velatura) e brilla appena: niente lampi bianchi
      col = mix(col, col * mix(vec3(1.0), c, 0.9) * 1.05, clamp((anello * 0.75 + eco * 0.4 + dentro) * o.w, 0.0, 1.0));
      col += c * (anello * 0.18 + brilli * 0.55) * o.w;
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
  uniform float uPavimento;
  uniform float uFiume;
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
    vec3 R = rivelazione(vMondo);
    float v = max(mix(R.x, uColoreCielo, uLontano), uLuce);
    float matita = max(R.y, max(uLontano, uLuce));
    float bagnato = R.z * (1.0 - uLontano) * (1.0 - uLuce);
    vec3 c = t.rgb * uLuceScena;
    if (v < 0.999) {
      // schizzo a matita ricavato dai contorni del dipinto: appena accennato
      // dove Lia non percepisce nulla, deciso quando l'onda lo "disegna"
      float lx = lum(texture2D(uMappa, uv + vec2(uTexel.x, 0.0)).rgb) - lum(texture2D(uMappa, uv - vec2(uTexel.x, 0.0)).rgb);
      float ly = lum(texture2D(uMappa, uv + vec2(0.0, uTexel.y)).rgb) - lum(texture2D(uMappa, uv - vec2(0.0, uTexel.y)).rgb);
      float ax = texture2D(uMappa, uv + vec2(uTexel.x, 0.0)).a - texture2D(uMappa, uv - vec2(uTexel.x, 0.0)).a;
      float ay = texture2D(uMappa, uv + vec2(0.0, uTexel.y)).a - texture2D(uMappa, uv - vec2(0.0, uTexel.y)).a;
      float bordo = smoothstep(0.08, 0.32, length(vec2(lx, ly)) + length(vec2(ax, ay)) * 0.6);
      vec3 schizzo = mix(uCarta, uInk, bordo * uSchizzo * uSchizzoStrato * (0.3 + 0.7 * matita));
      // RETINO MANGA: dove il dipinto è scuro, puntini d'inchiostro come nelle pagine dei fumetti
      // (il mondo non ancora scoperto è una pagina manga in bianco e nero)
      float scuro = 1.0 - lum(t.rgb);
      vec2 qq = mat2(0.7071, -0.7071, 0.7071, 0.7071) * qr(vMondo) * 11.0;
      float rr = sqrt(clamp(scuro * 1.3 - 0.18, 0.0, 1.0)) * 0.5;
      float punto = 1.0 - smoothstep(rr - 0.08, rr + 0.08, length(fract(qq) - 0.5));
      float vicino = 1.0 - smoothstep(9.0, 22.0, dist);
      schizzo = mix(schizzo, uInk, punto * 0.38 * uRetino * uSchizzoStrato * (0.35 + 0.65 * matita) * vicino);
      // il colore arriva come acquerello bagnato: sul bordo il pigmento si accumula
      vec3 colore = t.rgb * uLuceScena;
      colore = mix(colore, colore * vec3(0.78, 0.72, 0.84), bagnato * 0.5);
      c = mix(schizzo, colore, v);
      c = velatura(c, bagnato * 0.55 * uMagia);
    }
    c = conBrillio(c, vMondo, freschezza(vMondo) * (1.0 - uLontano));
    // la strada che diventa un fiume (immaginato da Lia sentendo le auto nelle pozzanghere)
    if (uFiume > 0.01) {
      float onde = rumoreMorbido(vec2(vMondo.x * 0.22 - uTempo * 0.3, vMondo.z * 0.8));
      float creste = texture2D(uRumore, vec2(vMondo.x * 0.5 - uTempo * 0.45, vMondo.z * 1.3)).g;
      vec3 acqua = mix(vec3(0.55, 0.77, 0.92), vec3(0.78, 0.91, 0.98), onde);
      acqua += vec3(1.0) * smoothstep(0.74, 0.92, creste) * 0.4;
      acqua = mix(acqua, acqua * c * 1.6, 0.12);
      c = mix(c, acqua, uFiume * 0.88);
    }
    c = conPioggia(c, vMondo, uPavimento);
    c = conOmbre(c, vMondo);
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
      uPavimento: { value: o.pavimento ? 1 : 0 },
      uFiume: { value: 0 },    // 1 = questo strato diventa un fiume (vedi gioco/meteo.js)
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
  uniform float uContorno;
  uniform float uSpecchio;
  varying vec2 vUv;
  varying vec3 vMondo;
  varying vec3 vBase;
  float alfa(vec2 uv) {
    uv = clamp(uv, uRiquadroLimiti.xy, uRiquadroLimiti.zw);
    return texture2D(uMappa, uv).a;
  }
  void main() {
    vec4 t = texture2D(uMappa, vUv);
    float aBase = t.a;
    // CONTORNO MANGA: appena fuori dalla sagoma, un filo d'inchiostro uguale per tutti
    float contorno = 0.0;
    if (aBase < 0.6 && uContorno > 0.0 && uCielo < 0.5) {
      float m = 0.0;
      for (int k = 0; k < 8; k++) {
        float ang = float(k) * 0.7853982;
        m = max(m, alfa(vUv + vec2(cos(ang), sin(ang)) * uTexel * uContorno));
      }
      contorno = smoothstep(0.3, 0.75, m) * (1.0 - aBase);
    }
    float a = max(aBase, contorno) * uOpacita;
    if (a < 0.03) discard;
    vec3 col = t.rgb * uTinta;
    if (uCielo > 0.5) { gl_FragColor = vec4(mix(uCarta, col, 0.35 + 0.65 * uColoreCielo), a); return; }
    col *= uLuceScena;
    // LUCE DI BORDO (come negli anime): un filo chiaro sul lato della sagoma verso la luce (in alto a sinistra)
    if (aBase > 0.5 && uContorno > 0.0) {
      vec2 versoLuce = vec2(uSpecchio > 0.5 ? 1.0 : -1.0, 1.0) * uTexel * 1.6;
      float fuori = 1.0 - alfa(vUv + versoLuce);
      col += vec3(1.0, 0.95, 0.82) * fuori * 0.3;
    }
    vec3 pb = vec3(vBase.x, vMondo.y, vBase.z);
    vec3 R = rivelazione(pb);
    float v = max(R.x, uLuce);
    vec3 c = col;
    if (v < 0.999) {
      float e = 4.0 - alfa(vUv + vec2(uTexel.x, 0.0)) - alfa(vUv - vec2(uTexel.x, 0.0))
                    - alfa(vUv + vec2(0.0, uTexel.y)) - alfa(vUv - vec2(0.0, uTexel.y));
      e = clamp(e, 0.0, 1.0);
      vec3 colore = mix(col, col * vec3(0.8, 0.75, 0.85), R.z * 0.45);
      c = mix(mix(uCarta, uInk, e * uSchizzo * 1.3 * (0.35 + 0.65 * max(R.y, uLuce))), colore, v);
      c = velatura(c, R.z * 0.45 * uMagia * (1.0 - uLuce));
    }
    c = conBrillio(c, pb, freschezza(pb) * 0.7);
    c = conOmbre(c, pb);
    c = conOnde(c, pb);
    // il contorno: inchiostro seppia scuro (più chiaro dove Lia non percepisce, come una matita)
    c = mix(c, mix(uInk * 0.85, uInk * 0.62, v), contorno);
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
      // spessore del contorno manga (in "texel" dell'atlante; 0 = niente contorno)
      uContorno: { value: o.contorno !== undefined ? o.contorno : (o.cielo ? 0 : 1.7) },
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
    // un'ombra lilla, allungata e morbida come una pennellata d'acquerello
    vec2 q = (vUv - 0.5) * 2.0;
    float bordo = texture2D(uRumore, vMondo.xz * 1.7).r - 0.5;
    float r = length(q) + bordo * 0.25;
    float a = (1.0 - smoothstep(0.25, 1.0, r)) * uForza;
    vec3 colore = mix(vec3(0.42, 0.34, 0.62), vec3(0.32, 0.38, 0.64), vUv.x);
    gl_FragColor = vec4(colore, a * (0.35 + 0.65 * percezione(vMondo)));
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
