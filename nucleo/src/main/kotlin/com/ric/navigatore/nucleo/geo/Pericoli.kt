package com.ric.navigatore.nucleo.geo

import com.ric.navigatore.nucleo.modello.Percorso
import com.ric.navigatore.nucleo.modello.TipoManovra
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/** Tipi di tratto che meritano un avviso. */
enum class TipoPericolo { TORNANTI, SALITA_RIPIDA, DISCESA_RIPIDA }

/** Un tratto del percorso che merita un avviso (posizioni in metri dalla partenza). */
data class TrattoPericoloso(
    val tipo: TipoPericolo,
    val inizio: Double,
    val fine: Double,
    /** Tornanti: quante curve strette in tutto e quante sono veri tornanti (≥ 150°). */
    val curve: Int = 0,
    val tornanti: Int = 0,
    /** Pendenze: media del tratto e punto più ripido, in % (positiva in salita). */
    val pendenzaMedia: Double = 0.0,
    val pendenzaMassima: Double = 0.0,
) {
    val lunghezza: Double get() = fine - inizio
}

/** Una curva stretta trovata sul percorso: dove sta (metri) e di quanti gradi gira. */
data class Curva(val progressiva: Double, val angolo: Double)

/**
 * Cerca sul percorso i tratti "impegnativi":
 *  - serie di curve strette e tornanti, dalla FORMA della strada;
 *  - salite e discese ripide, dalle QUOTE fornite dal servizio di percorso.
 *
 * Sono stime: la forma viene dalla geometria del percorso (dati OpenStreetMap),
 * le quote da un modello del terreno con precisione di qualche metro, per cui
 * ponti e gallerie possono falsare una pendenza.
 */
object Pericoli {
    /** Passo di campionamento della forma della strada. */
    private const val PASSO_CURVE = 10.0

    /** Una curva è "stretta" se gira almeno di tanto entro [FINESTRA_CURVA] metri. */
    const val ANGOLO_CURVA = 100.0
    const val ANGOLO_TORNANTE = 150.0
    const val FINESTRA_CURVA = 80.0

    /** Due curve fanno parte della stessa serie se distano meno di così. */
    const val DISTANZA_SERIE = 400.0

    /** Le svolte agli incroci non sono curve: si ignorano entro questa distanza da una manovra. */
    private const val MARGINE_MANOVRA = 35.0

    private const val PASSO_QUOTE = 20.0
    const val FINESTRA_PENDENZA = 200.0
    const val LUNGHEZZA_MINIMA_PENDENZA = 300.0

    /** Tutti i tratti impegnativi del percorso, in ordine di posizione. */
    fun analizza(p: Percorso, sogliaPendenza: Double = 8.0): List<TrattoPericoloso> =
        (serieDiCurve(p) + pendenze(p, sogliaPendenza)).sortedBy { it.inizio }

    // ------------------------------------------------------------------
    // Curve e tornanti
    // ------------------------------------------------------------------

    /** Curve strette del percorso (esclusi incroci e rotatorie). */
    fun curve(p: Percorso): List<Curva> {
        val linea = p.geometria
        if (linea.size < 3) return emptyList()
        val prog = Geo.progressive(linea)
        val totale = prog.last()
        if (totale < 3 * PASSO_CURVE) return emptyList()
        // punti ogni 10 m e direzione di ogni pezzetto
        val n = (totale / PASSO_CURVE).toInt()
        val punti = (0..n).map { Geo.puntoAProgressiva(linea, it * PASSO_CURVE, prog) }
        val dir = (0 until n).map { Geo.direzione(punti[it], punti[it + 1]) }
        // di quanto gira la strada fra un pezzetto e il successivo (con segno: + destra, − sinistra)
        val giro = DoubleArray(dir.size) { i -> if (i == 0) 0.0 else angoloConSegno(dir[i - 1], dir[i]) }
        val w = (FINESTRA_CURVA / PASSO_CURVE).toInt()
        // zone da ignorare: attorno alle manovre e lungo le rotatorie
        val ignora = zoneManovre(p, prog)

        val trovate = mutableListOf<Curva>()
        var i = 1
        while (i + w <= giro.size) {
            val somma = (i until i + w).sumOf { giro[it] }
            if (abs(somma) >= ANGOLO_CURVA) {
                // cerchiamo la finestra che gira di più qui vicino (il "cuore" della curva)
                var migliore = somma
                var inizio = i
                for (k in i + 1..min(i + w, giro.size - w)) {
                    val s = (k until k + w).sumOf { giro[it] }
                    if (abs(s) > abs(migliore) && s * somma > 0) { migliore = s; inizio = k }
                }
                val centro = (inizio + w / 2.0) * PASSO_CURVE
                if (ignora.none { centro in it }) trovate += Curva(centro, migliore)
                i = inizio + w
            } else i++
        }
        return trovate
    }

    /** Raggruppa le curve strette in "serie": ha senso avvisare per un tornante o per 3+ curve strette vicine. */
    fun serieDiCurve(p: Percorso): List<TrattoPericoloso> {
        val curve = curve(p)
        if (curve.isEmpty()) return emptyList()
        val gruppi = mutableListOf(mutableListOf(curve.first()))
        for (c in curve.drop(1)) {
            if (c.progressiva - gruppi.last().last().progressiva <= DISTANZA_SERIE) gruppi.last() += c
            else gruppi += mutableListOf(c)
        }
        return gruppi.mapNotNull { g ->
            val tornanti = g.count { abs(it.angolo) >= ANGOLO_TORNANTE }
            if (tornanti == 0 && g.size < 3) return@mapNotNull null
            TrattoPericoloso(
                tipo = TipoPericolo.TORNANTI,
                inizio = max(0.0, g.first().progressiva - FINESTRA_CURVA / 2),
                fine = g.last().progressiva + FINESTRA_CURVA / 2,
                curve = g.size,
                tornanti = tornanti,
            )
        }
    }

    /** Intervalli (in metri) attorno alle manovre e lungo le rotatorie, dove le "curve" sono svolte. */
    private fun zoneManovre(p: Percorso, prog: DoubleArray): List<ClosedFloatingPointRange<Double>> =
        p.manovre.filter { it.tipo != TipoManovra.DRITTO && it.tipo != TipoManovra.PARTENZA && it.tipo != TipoManovra.ARRIVO }
            .map { m ->
                val a = prog[m.daIndice.coerceIn(0, prog.lastIndex)]
                val rotatoria = m.tipo == TipoManovra.ROTATORIA || m.tipo == TipoManovra.ESCI_ROTATORIA
                val b = if (rotatoria) prog[m.aIndice.coerceIn(0, prog.lastIndex)] else a
                (a - MARGINE_MANOVRA)..(b + MARGINE_MANOVRA)
            }

    /** Angolo fra due direzioni, fra −180° e +180° (positivo = gira a destra). */
    private fun angoloConSegno(da: Double, a: Double): Double {
        var d = (a - da) % 360
        if (d > 180) d -= 360
        if (d < -180) d += 360
        return d
    }

    // ------------------------------------------------------------------
    // Salite e discese ripide
    // ------------------------------------------------------------------

    /**
     * Tratti lunghi almeno 300 m con pendenza (misurata su 200 m) oltre la
     * [soglia] in %. Due tratti dello stesso verso separati da meno di 100 m
     * diventano uno solo.
     */
    fun pendenze(p: Percorso, soglia: Double): List<TrattoPericoloso> {
        val quote = p.quote ?: return emptyList()
        if (quote.size != p.geometria.size || quote.size < 2) return emptyList()
        val prog = Geo.progressive(p.geometria)
        val totale = prog.last()
        if (totale < FINESTRA_PENDENZA) return emptyList()
        // quota ogni 20 m, poi media su 100 m per togliere il "rumore" del modello del terreno
        val n = (totale / PASSO_QUOTE).toInt()
        val grezze = DoubleArray(n + 1) { quotaA(prog, quote, it * PASSO_QUOTE) }
        val z = DoubleArray(grezze.size) { i ->
            val a = max(0, i - 2)
            val b = min(grezze.lastIndex, i + 2)
            (a..b).sumOf { grezze[it] } / (b - a + 1)
        }
        val w = (FINESTRA_PENDENZA / PASSO_QUOTE).toInt()
        if (z.size <= w) return emptyList()
        // pendenza di ogni finestra di 200 m
        val pend = DoubleArray(z.size - w) { (z[it + w] - z[it]) / FINESTRA_PENDENZA * 100 }

        // tratti contigui sopra soglia, con lo stesso verso
        data class Grezzo(var da: Int, var a: Int, val segno: Int)
        val grezzi = mutableListOf<Grezzo>()
        for (i in pend.indices) {
            val segno = when {
                pend[i] >= soglia -> 1
                pend[i] <= -soglia -> -1
                else -> 0
            }
            if (segno == 0) continue
            val ultimo = grezzi.lastOrNull()
            // unione se stesso verso e distanza fra i tratti ≤ 100 m (5 passi)
            if (ultimo != null && ultimo.segno == segno && i <= ultimo.a + 5) ultimo.a = i
            else grezzi += Grezzo(i, i, segno)
        }
        return grezzi.mapNotNull { g ->
            val inizio = g.da * PASSO_QUOTE
            val fine = min(totale, (g.a + w) * PASSO_QUOTE)
            if (fine - inizio < LUNGHEZZA_MINIMA_PENDENZA) return@mapNotNull null
            val media = (z[min(z.lastIndex, g.a + w)] - z[g.da]) / (fine - inizio) * 100
            val massima = (g.da..g.a).maxBy { abs(pend[it]) }.let { pend[it] }
            TrattoPericoloso(
                tipo = if (g.segno > 0) TipoPericolo.SALITA_RIPIDA else TipoPericolo.DISCESA_RIPIDA,
                inizio = inizio, fine = fine,
                pendenzaMedia = media, pendenzaMassima = massima,
            )
        }
    }

    /** Quota interpolata a [metri] dalla partenza. */
    private fun quotaA(prog: DoubleArray, quote: List<Double>, metri: Double): Double {
        if (metri <= 0) return quote.first()
        if (metri >= prog.last()) return quote.last()
        var i = 1
        while (i < prog.lastIndex && prog[i] < metri) i++
        val tratto = prog[i] - prog[i - 1]
        if (tratto <= 0) return quote[i]
        val f = (metri - prog[i - 1]) / tratto
        return quote[i - 1] + (quote[i] - quote[i - 1]) * f
    }

    // ------------------------------------------------------------------
    // Testi
    // ------------------------------------------------------------------

    /** Descrizione breve del tratto, es. "Serie di 5 tornanti" o "Discesa ripida 10%". */
    fun descrizione(t: TrattoPericoloso): String = when (t.tipo) {
        TipoPericolo.TORNANTI -> when {
            t.tornanti == 1 && t.curve == 1 -> "Tornante"
            t.tornanti == t.curve -> "Serie di ${t.curve} tornanti"
            t.tornanti >= 2 -> "Serie di ${t.curve} curve strette, ${t.tornanti} tornanti"
            t.tornanti == 1 -> "Serie di ${t.curve} curve strette con un tornante"
            else -> "Serie di ${t.curve} curve strette"
        }
        TipoPericolo.SALITA_RIPIDA -> "Salita ripida ${abs(t.pendenzaMedia).roundToInt()}%"
        TipoPericolo.DISCESA_RIPIDA -> "Discesa ripida ${abs(t.pendenzaMedia).roundToInt()}%"
    }
}
