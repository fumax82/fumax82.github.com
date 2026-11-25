/* ==========================================================================
 *  percorso.js — LA STRADA CHE LIA PERCORRE
 *  --------------------------------------------------------------------------
 *  Come in un gioco "a piattaforme", Lia si muove avanti e indietro lungo
 *  una LINEA: il percorso. Però la linea vive nello spazio 3D: può curvare
 *  (girare in un vicolo), salire (il ponte, le scale), allontanarsi dalla
 *  telecamera. È questo che dà profondità alle inquadrature.
 *
 *  Il percorso è una spezzata di punti [x, y, z]. La posizione di Lia è un
 *  solo numero, "s" = quanti metri ha percorso dall'inizio.
 *    percorso.punto(s)     → { x, y, z }  dove si trova
 *    percorso.tangente(s)  → { x, z }     in che direzione va la strada
 *    percorso.lunghezza                   quanto è lunga in tutto
 * ========================================================================== */

export class Percorso {
  /** punti: [[x, y, z], ...] (almeno due) */
  constructor(punti) {
    this.punti = punti.map((p) => ({ x: p[0], y: p[1], z: p[2] }));
    // lunghezza progressiva di ogni punto (contando solo il piano x-z,
    // così salendo una scala non si "allunga" la strada)
    this.progressivo = [0];
    for (let k = 1; k < this.punti.length; k++) {
      const a = this.punti[k - 1], b = this.punti[k];
      this.progressivo.push(this.progressivo[k - 1] + Math.hypot(b.x - a.x, b.z - a.z));
    }
    this.lunghezza = this.progressivo[this.progressivo.length - 1];
  }

  /** Trova il tratto che contiene s: restituisce { k, t } (indice e frazione). */
  _tratto(s) {
    const P = this.progressivo;
    if (s <= 0) return { k: 0, t: 0 };
    if (s >= this.lunghezza) return { k: P.length - 2, t: 1 };
    let k = 0;
    while (k < P.length - 2 && P[k + 1] < s) k++;
    const l = P[k + 1] - P[k];
    return { k, t: l > 0 ? (s - P[k]) / l : 0 };
  }

  /** Il punto del percorso dopo s metri. */
  punto(s) {
    const { k, t } = this._tratto(s);
    const a = this.punti[k], b = this.punti[k + 1];
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
  }

  /** Direzione (normalizzata, sul piano x-z) del percorso in s, smussata agli angoli. */
  tangente(s) {
    const d = 0.35;
    const a = this.punto(Math.max(0, s - d)), b = this.punto(Math.min(this.lunghezza, s + d));
    const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    return { x: (b.x - a.x) / l, z: (b.z - a.z) / l };
  }

  /** Pendenza in s (quanto sale per ogni metro): serve per inclinare il passo. */
  pendenza(s) {
    const a = this.punto(Math.max(0, s - 0.3)), b = this.punto(Math.min(this.lunghezza, s + 0.3));
    return (b.y - a.y) / 0.6;
  }

  /** Il valore di s più vicino al punto (x, z) del pavimento. */
  piuVicino(x, z) {
    let migliore = 0, dMin = Infinity;
    for (let k = 0; k < this.punti.length - 1; k++) {
      const a = this.punti[k], b = this.punti[k + 1];
      const vx = b.x - a.x, vz = b.z - a.z;
      const l2 = vx * vx + vz * vz || 1;
      const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / l2));
      const px = a.x + vx * t, pz = a.z + vz * t;
      const d = Math.hypot(x - px, z - pz);
      if (d < dMin) { dMin = d; migliore = this.progressivo[k] + Math.sqrt(l2) * t; }
    }
    return { s: migliore, distanza: dMin };
  }

  /** Altezza del pavimento vicino al punto (x, z): quella del percorso più vicino. */
  quota(x, z) {
    return this.punto(this.piuVicino(x, z).s).y;
  }
}

/**
 * Aiuto per scrivere i percorsi curvi: campiona una funzione y = f(x)
 * tra x0 e x1 (per esempio la gobba di un ponte) in "n" punti a quota z.
 */
export function campiona(x0, x1, n, f, z) {
  const punti = [];
  for (let k = 0; k <= n; k++) {
    const x = x0 + ((x1 - x0) * k) / n;
    punti.push([x, f(x), z || 0]);
  }
  return punti;
}
