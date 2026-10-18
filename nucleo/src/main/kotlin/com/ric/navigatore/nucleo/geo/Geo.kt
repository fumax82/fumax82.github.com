package com.ric.navigatore.nucleo.geo

import kotlin.math.abs
import kotlin.math.asin
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Calcoli geografici di base: distanze, direzioni, punti su una linea.
 *
 * Per le distanze "piccole" (fino a qualche centinaio di km) usiamo un
 * piano locale in metri (vedi [PianoLocale]): è semplice e l'errore è
 * trascurabile per una navigazione stradale.
 */
object Geo {
    /** Raggio medio della Terra in metri. */
    const val RAGGIO_TERRA = 6_371_008.8

    private fun rad(g: Double) = Math.toRadians(g)

    /** Distanza in metri fra due punti (formula dell'emisenoverso / haversine). */
    fun distanza(a: Punto, b: Punto): Double {
        val dLat = rad(b.lat - a.lat)
        val dLon = rad(b.lon - a.lon)
        val h = sin(dLat / 2).let { it * it } +
            cos(rad(a.lat)) * cos(rad(b.lat)) * sin(dLon / 2).let { it * it }
        return 2 * RAGGIO_TERRA * asin(min(1.0, sqrt(h)))
    }

    /** Direzione (0° = nord, 90° = est) per andare da [a] verso [b]. */
    fun direzione(a: Punto, b: Punto): Double {
        val y = sin(rad(b.lon - a.lon)) * cos(rad(b.lat))
        val x = cos(rad(a.lat)) * sin(rad(b.lat)) -
            sin(rad(a.lat)) * cos(rad(b.lat)) * cos(rad(b.lon - a.lon))
        return (Math.toDegrees(atan2(y, x)) + 360) % 360
    }

    /** Differenza fra due direzioni, sempre fra 0° e 180°. */
    fun differenzaAngoli(a: Double, b: Double): Double {
        val d = abs(((a - b) % 360 + 360) % 360)
        return if (d > 180) 360 - d else d
    }

    /** Lunghezza totale di una linea, in metri. */
    fun lunghezza(linea: Linea): Double {
        var tot = 0.0
        for (i in 1 until linea.size) tot += distanza(linea[i - 1], linea[i])
        return tot
    }

    /** Distanze progressive: progressive[i] = metri dall'inizio fino al vertice i. */
    fun progressive(linea: Linea): DoubleArray {
        val p = DoubleArray(linea.size)
        for (i in 1 until linea.size) p[i] = p[i - 1] + distanza(linea[i - 1], linea[i])
        return p
    }

    /** Punto che si trova a [metri] dall'inizio della linea. */
    fun puntoAProgressiva(linea: Linea, metri: Double, prog: DoubleArray = progressive(linea)): Punto {
        if (linea.isEmpty()) error("linea vuota")
        if (metri <= 0) return linea.first()
        if (metri >= prog.last()) return linea.last()
        var i = 1
        while (i < prog.size && prog[i] < metri) i++
        val tratto = prog[i] - prog[i - 1]
        val f = if (tratto <= 0) 0.0 else (metri - prog[i - 1]) / tratto
        return interpola(linea[i - 1], linea[i], f)
    }

    /** Punto a metà strada (frazione f fra 0 e 1) fra a e b. */
    fun interpola(a: Punto, b: Punto, f: Double) =
        Punto(a.lat + (b.lat - a.lat) * f, a.lon + (b.lon - a.lon) * f)

    /**
     * Proietta un punto sulla linea (il punto della linea più vicino).
     * Si può limitare la ricerca ai segmenti fra [daSegmento] e [aSegmento]:
     * serve durante la navigazione per non "saltare" su un tratto lontano
     * del percorso che passa vicino (es. andata e ritorno sulla stessa strada).
     */
    fun proietta(
        linea: Linea,
        p: Punto,
        prog: DoubleArray = progressive(linea),
        daSegmento: Int = 0,
        aSegmento: Int = linea.size - 2,
    ): Proiezione {
        require(linea.size >= 2) { "servono almeno due punti" }
        val piano = PianoLocale(p)
        var migliore: Proiezione? = null
        val da = max(0, daSegmento)
        val a = min(linea.size - 2, aSegmento)
        for (i in da..a) {
            val (ax, ay) = piano.xy(linea[i])
            val (bx, by) = piano.xy(linea[i + 1])
            val dx = bx - ax
            val dy = by - ay
            val len2 = dx * dx + dy * dy
            // frazione del segmento dove cade la perpendicolare (0 = inizio, 1 = fine)
            val f = if (len2 == 0.0) 0.0 else ((-ax) * dx + (-ay) * dy) / len2
            val fc = f.coerceIn(0.0, 1.0)
            val px = ax + dx * fc
            val py = ay + dy * fc
            val dist = sqrt(px * px + py * py)
            if (migliore == null || dist < migliore.distanza) {
                val punto = interpola(linea[i], linea[i + 1], fc)
                val progressiva = prog[i] + (prog[i + 1] - prog[i]) * fc
                migliore = Proiezione(punto, dist, i, fc, progressiva)
            }
        }
        return migliore!!
    }

    /**
     * TUTTE le posizioni (metri dall'inizio) in cui la linea passa entro
     * [tolleranza] metri dal punto. Serve quando un percorso ripassa sulla
     * stessa strada (andata e ritorno): ogni passaggio è una posizione distinta.
     */
    fun posizioniVicine(linea: Linea, p: Punto, tolleranza: Double, prog: DoubleArray = progressive(linea)): List<Double> {
        val piano = PianoLocale(p)
        val trovate = mutableListOf<Pair<Double, Double>>() // (progressiva, distanza)
        for (i in 0 until linea.size - 1) {
            val (ax, ay) = piano.xy(linea[i])
            val (bx, by) = piano.xy(linea[i + 1])
            val dx = bx - ax
            val dy = by - ay
            val len2 = dx * dx + dy * dy
            val f = (if (len2 == 0.0) 0.0 else ((-ax) * dx + (-ay) * dy) / len2).coerceIn(0.0, 1.0)
            val d = sqrt((ax + dx * f).let { it * it } + (ay + dy * f).let { it * it })
            if (d <= tolleranza) trovate += (prog[i] + (prog[i + 1] - prog[i]) * f) to d
        }
        // segmenti consecutivi vicini al punto = un solo passaggio: teniamo il più vicino
        val passaggi = mutableListOf<Pair<Double, Double>>()
        for (t in trovate.sortedBy { it.first }) {
            val ultimo = passaggi.lastOrNull()
            if (ultimo != null && t.first - ultimo.first < 2 * tolleranza) {
                if (t.second < ultimo.second) passaggi[passaggi.lastIndex] = t
            } else passaggi += t
        }
        return passaggi.map { it.first }
    }

    /** Pezzo di linea compreso fra due distanze progressive (in metri). */
    fun sottoLinea(linea: Linea, daMetri: Double, aMetri: Double, prog: DoubleArray = progressive(linea)): Linea {
        val inizio = min(daMetri, aMetri).coerceIn(0.0, prog.last())
        val fine = max(daMetri, aMetri).coerceIn(0.0, prog.last())
        val out = mutableListOf(puntoAProgressiva(linea, inizio, prog))
        for (i in linea.indices) if (prog[i] > inizio && prog[i] < fine) out += linea[i]
        out += puntoAProgressiva(linea, fine, prog)
        return out
    }

    /** Direzione della linea in corrispondenza di un punto a [metri] dall'inizio. */
    fun direzioneAProgressiva(linea: Linea, metri: Double, prog: DoubleArray = progressive(linea)): Double {
        val a = puntoAProgressiva(linea, metri - 5, prog)
        val b = puntoAProgressiva(linea, metri + 5, prog)
        return direzione(a, b)
    }

    /** Punti lungo la linea ogni [passo] metri (estremi compresi). */
    fun campiona(linea: Linea, passo: Double): List<Punto> {
        val prog = progressive(linea)
        val tot = prog.last()
        if (tot == 0.0) return listOf(linea.first())
        val n = max(1, (tot / passo).toInt())
        return (0..n).map { puntoAProgressiva(linea, tot * it / n, prog) }
    }

    /** Centro del rettangolo che contiene tutti i punti (non il baricentro "vero"). */
    fun centroRiquadro(punti: List<Punto>): Punto =
        Punto((punti.minOf { it.lat } + punti.maxOf { it.lat }) / 2, (punti.minOf { it.lon } + punti.maxOf { it.lon }) / 2)

    /** Vero se il punto è dentro l'anello (algoritmo del "raggio" pari/dispari). */
    fun dentro(p: Punto, anello: Anello): Boolean {
        var dentro = false
        var j = anello.size - 1
        for (i in anello.indices) {
            val a = anello[i]
            val b = anello[j]
            if ((a.lat > p.lat) != (b.lat > p.lat) &&
                p.lon < (b.lon - a.lon) * (p.lat - a.lat) / (b.lat - a.lat) + a.lon
            ) dentro = !dentro
            j = i
        }
        return dentro
    }
}

/** Risultato di [Geo.proietta]. */
data class Proiezione(
    /** Il punto sulla linea più vicino a quello cercato. */
    val punto: Punto,
    /** Distanza in metri fra il punto cercato e la linea. */
    val distanza: Double,
    /** Indice del segmento (fra il vertice i e il vertice i+1). */
    val segmento: Int,
    /** Posizione dentro il segmento (0 = inizio, 1 = fine). */
    val frazione: Double,
    /** Metri dall'inizio della linea. */
    val progressiva: Double,
)

/**
 * Piano "locale" in metri attorno a un'origine: x verso est, y verso nord.
 * Approssimazione equirettangolare, precisa entro pochi metri su
 * distanze di qualche decina di km (più che sufficiente per le aree di
 * esclusione, limitate a 20 km dal servizio).
 */
class PianoLocale(val origine: Punto) {
    private val metriPerGradoLat = Math.PI * Geo.RAGGIO_TERRA / 180.0
    private val metriPerGradoLon = metriPerGradoLat * cos(Math.toRadians(origine.lat))

    fun xy(p: Punto): Pair<Double, Double> =
        Pair((p.lon - origine.lon) * metriPerGradoLon, (p.lat - origine.lat) * metriPerGradoLat)

    fun punto(x: Double, y: Double): Punto =
        Punto(origine.lat + y / metriPerGradoLat, origine.lon + x / metriPerGradoLon)
}
