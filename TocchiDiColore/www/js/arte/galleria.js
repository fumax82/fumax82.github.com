/* ==========================================================================
 *  galleria.js — RACCOLTA DI TUTTI I DISEGNI
 *  --------------------------------------------------------------------------
 *  All'avvio il gioco "dipinge" tutte le immagini chiamando i moduli
 *  di arte (personaggi, comparse, texture, oggetti, cielo) e le trasforma
 *  in TEXTURE, il formato che la scheda grafica sa usare.
 *
 *  Gli altri file chiedono le immagini alla galleria per nome:
 *    Galleria.atlante('lia')        → personaggio/oggetto con i fotogrammi
 *    Galleria.muro('casa_rosa')     → texture di un muro (con la sua altezza)
 *    Galleria.pavimento('erba')     → texture di un pavimento
 *  Se un'immagine manca, la galleria ne crea una provvisoria (un riquadro
 *  colorato): il gioco non si blocca e si vede subito che cosa manca.
 * ========================================================================== */
import * as THREE from 'three';
import { nuovaTela, respira } from './pennello.js';

export const Galleria = {
  atlanti: {},
  muri: {},
  pavimenti: {},
  illustrazioni: {},
  anisotropia: 4,
  mancanti: new Set(),
};

/* ------------------------------------------------------------------------ */
/*  Caricamento                                                             */
/* ------------------------------------------------------------------------ */

/**
 * Dipinge tutto. "progresso(frazione, testo)" viene chiamata durante il lavoro
 * per aggiornare la barra di caricamento.
 */
Galleria.carica = async function (progresso, anisotropia) {
  this.anisotropia = anisotropia || 4;
  const passi = [
    ['Preparo le texture dei muri...', async () => {
      const m = await importa('./texture.js');
      if (m && m.creaTexture) {
        const r = await m.creaTexture();
        for (const [nome, t] of Object.entries(r.muri || {})) this.muri[nome] = this._superficie(t, false);
        for (const [nome, t] of Object.entries(r.pavimenti || {})) this.pavimenti[nome] = this._superficie(t, true);
      }
    }],
    ['Disegno Lia e Biscotto...', async () => {
      const m = await importa('./personaggi.js');
      if (m && m.creaPersonaggi) this._aggiungiAtlanti(await m.creaPersonaggi());
      if (m && m.creaIllustrazioneTitolo) this.illustrazioni.titolo = await m.creaIllustrazioneTitolo();
      if (m && m.creaIllustrazioneFinale) this.illustrazioni.finale = await m.creaIllustrazioneFinale();
    }],
    ['Disegno gli abitanti...', async () => {
      const m = await importa('./comparse.js');
      if (m && m.creaComparse) this._aggiungiAtlanti(await m.creaComparse());
    }],
    ['Disegno gli oggetti...', async () => {
      const m = await importa('./oggetti.js');
      if (m && m.creaOggetti) this._aggiungiAtlanti(await m.creaOggetti());
    }],
    ['Dipingo il cielo...', async () => {
      const m = await importa('./cielo.js');
      if (m && m.creaCielo) this._aggiungiAtlanti(await m.creaCielo());
    }],
  ];
  for (let k = 0; k < passi.length; k++) {
    progresso(k / passi.length, passi[k][0]);
    await respira();
    try {
      await passi[k][1]();
    } catch (errore) {
      console.error('Errore mentre dipingo:', passi[k][0], errore);
    }
  }
  progresso(1, 'Pronto!');
};

async function importa(percorso) {
  try {
    return await import(percorso);
  } catch (errore) {
    console.warn('Modulo di arte non disponibile:', percorso, errore);
    return null;
  }
}

/* ------------------------------------------------------------------------ */
/*  Conversione in texture                                                  */
/* ------------------------------------------------------------------------ */

/**
 * Muri e pavimenti: uniamo il colore (RGB) e l'inchiostro (canale A) in una
 * sola texture "grezza", così la scheda grafica li riceve senza perdite.
 */
Galleria._superficie = function (t, ripeti) {
  const l = t.colore.width, a = t.colore.height;
  const col = t.colore.getContext('2d').getImageData(0, 0, l, a).data;
  let ink = null;
  if (t.inchiostro) {
    const tela = nuovaTela(l, a);
    tela.getContext('2d').drawImage(t.inchiostro, 0, 0, l, a);
    ink = tela.getContext('2d').getImageData(0, 0, l, a).data;
  }
  const dati = new Uint8Array(l * a * 4);
  let sr = 0, sg = 0, sb = 0, tr = 0, tg = 0, tb = 0;
  const righeCima = Math.max(1, Math.floor(a * 0.06));
  for (let y = 0; y < a; y++) {
    const yy = a - 1 - y; // capovolgiamo: nella scheda grafica la riga 0 è in basso
    for (let x = 0; x < l; x++) {
      const i = (y * l + x) * 4, j = (yy * l + x) * 4;
      dati[j] = col[i]; dati[j + 1] = col[i + 1]; dati[j + 2] = col[i + 2];
      dati[j + 3] = ink ? ink[i + 3] : 0;
      sr += col[i]; sg += col[i + 1]; sb += col[i + 2];
      if (y < righeCima) { tr += col[i]; tg += col[i + 1]; tb += col[i + 2]; }
    }
  }
  const tex = new THREE.DataTexture(dati, l, a, THREE.RGBAFormat);
  tex.wrapS = ripeti ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = ripeti ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = this.anisotropia;
  tex.needsUpdate = true;
  const n = l * a, nc = l * righeCima;
  return {
    texture: tex,
    altezza: t.altezza || 1,
    medio: new THREE.Color(sr / n / 255, sg / n / 255, sb / n / 255),
    cima: new THREE.Color(tr / nc / 255, tg / nc / 255, tb / nc / 255),
    tela: t.colore,
  };
};

/** Atlanti di sprite: diventano CanvasTexture con i loro fotogrammi. */
Galleria._aggiungiAtlanti = function (insieme) {
  for (const [nome, at] of Object.entries(insieme || {})) {
    if (!at || !at.tela) continue;
    const tex = new THREE.CanvasTexture(at.tela);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = this.anisotropia;
    tex.needsUpdate = true;
    this.atlanti[nome] = {
      nome,
      texture: tex,
      tela: at.tela,
      fotogrammi: at.fotogrammi,
      nomi: Object.keys(at.fotogrammi),
      cella: at.cella || Object.values(at.fotogrammi)[0],
      altezzaMondo: at.altezzaMondo || 1,
    };
  }
};

/* ------------------------------------------------------------------------ */
/*  Richieste                                                               */
/* ------------------------------------------------------------------------ */

Galleria.atlante = function (nome) {
  if (!this.atlanti[nome]) {
    if (!this.mancanti.has(nome)) { this.mancanti.add(nome); console.warn('Immagine mancante:', nome); }
    this.atlanti[nome] = this._provvisorio(nome);
  }
  return this.atlanti[nome];
};

Galleria.muro = function (nome) {
  if (!this.muri[nome]) {
    console.warn('Texture di muro mancante:', nome);
    this.muri[nome] = this._superficie({ colore: tavolozza(nome, 256, 820), altezza: 3.2 }, false);
  }
  return this.muri[nome];
};

Galleria.pavimento = function (nome) {
  if (!this.pavimenti[nome]) {
    console.warn('Texture di pavimento mancante:', nome);
    this.pavimenti[nome] = this._superficie({ colore: tavolozza(nome, 256, 256) }, true);
  }
  return this.pavimenti[nome];
};

/**
 * Trova il fotogramma più adatto in un atlante. Se il fotogramma esatto non
 * c'è, prova alternative sempre più semplici (così un personaggio con meno
 * pose funziona lo stesso).
 */
Galleria.fotogramma = function (atlante, vista, posa, n) {
  const f = atlante.fotogrammi;
  const prove = [
    vista + '_' + posa + '_' + n,
    vista + '_' + posa + '_0',
    vista + '_' + posa,
    vista + '_fermo_0',
    'fronte_' + posa + '_' + n,
    'fronte_' + posa + '_0',
    'fronte_fermo_0',
    'lato_' + posa + '_0',
    'base',
    'f0',
  ];
  for (const nome of prove) if (f[nome]) return nome;
  return atlante.nomi[0];
};

/** Rettangolo di un fotogramma in coordinate di texture (0..1, origine in basso). */
Galleria.riquadro = function (atlante, nomeFotogramma) {
  const r = atlante.fotogrammi[nomeFotogramma] || atlante.fotogrammi[atlante.nomi[0]];
  const L = atlante.tela.width, A = atlante.tela.height;
  const u0 = r.x / L, du = r.l / L;
  const v0 = 1 - (r.y + r.a) / A, dv = r.a / A;
  return { u0, v0, du, dv };
};

/* ------------------------------------------------------------------------ */
/*  Immagini provvisorie (se un modulo di arte manca)                        */
/* ------------------------------------------------------------------------ */
function coloreDaNome(nome) {
  let h = 0;
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 'hsl(' + (h % 360) + ', 55%, 72%)';
}

function tavolozza(nome, l, a) {
  const t = nuovaTela(l, a);
  const c = t.getContext('2d');
  c.fillStyle = coloreDaNome(nome);
  c.fillRect(0, 0, l, a);
  c.fillStyle = 'rgba(0,0,0,0.25)';
  c.font = 'bold 22px sans-serif';
  c.fillText(nome, 8, 30);
  return t;
}

Galleria._provvisorio = function (nome) {
  const t = nuovaTela(128, 192);
  const c = t.getContext('2d');
  c.fillStyle = coloreDaNome(nome);
  c.beginPath();
  c.ellipse(64, 110, 48, 80, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#4a3a3a';
  c.font = '14px sans-serif';
  c.fillText(nome.slice(0, 14), 10, 100);
  const tex = new THREE.CanvasTexture(t);
  return {
    nome, texture: tex, tela: t,
    fotogrammi: { base: { x: 0, y: 0, l: 128, a: 192 } }, nomi: ['base'],
    cella: { l: 128, a: 192 }, altezzaMondo: 1,
  };
};
