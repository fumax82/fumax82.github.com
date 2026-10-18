package com.ric.navigatore.nucleo.geo

import kotlinx.serialization.Serializable
import org.locationtech.jts.geom.Coordinate
import org.locationtech.jts.geom.Geometry
import org.locationtech.jts.geom.GeometryFactory
import org.locationtech.jts.geom.LineString
import org.locationtech.jts.geom.Polygon
import org.locationtech.jts.geom.prep.PreparedGeometryFactory
import org.locationtech.jts.operation.buffer.BufferOp
import org.locationtech.jts.operation.buffer.BufferParameters
import org.locationtech.jts.operation.union.UnaryUnionOp
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.sin

/**
 * Un'area chiusa: bordo esterno ed eventuali "buchi" interni.
 * È il formato che inviamo al motore di percorso come zona da evitare.
 */
@Serializable
data class Poligono(val esterno: Anello, val buchi: List<Anello> = emptyList())

/**
 * Operazioni sulle aree. Il lavoro "difficile" (buffer, unioni,
 * intersezioni) è affidato alla libreria JTS, molto collaudata: noi
 * convertiamo i punti in metri su un piano locale, lasciamo lavorare JTS
 * e riconvertiamo il risultato in gradi.
 */
object Aree {
    private val fabbrica = GeometryFactory()

    // ------------------------------------------------------------------
    // Forme disegnate dall'utente
    // ------------------------------------------------------------------

    /** Cerchio approssimato da un poligono con [lati] lati. */
    fun cerchio(centro: Punto, raggioMetri: Double, lati: Int = 48): Poligono {
        val piano = PianoLocale(centro)
        val anello = (0 until lati).map {
            val a = 2 * Math.PI * it / lati
            piano.punto(raggioMetri * sin(a), raggioMetri * cos(a))
        }
        return Poligono(anello)
    }

    /** Rettangolo (allineato a nord) dati due angoli opposti. */
    fun rettangolo(a: Punto, b: Punto): Poligono = Poligono(
        listOf(
            Punto(a.lat, a.lon), Punto(a.lat, b.lon),
            Punto(b.lat, b.lon), Punto(b.lat, a.lon),
        ),
    )

    /**
     * "Fascia" larga [metri] per lato attorno a una linea (es. una strada).
     * È un'APPROSSIMAZIONE dell'esclusione di una strada: dentro la fascia
     * possono cadere anche strade parallele vicine, incroci, cavalcavia o
     * sottopassi. Le estremità sono piatte per non invadere gli incroci.
     */
    fun fascia(linea: Linea, metri: Double): List<Poligono> {
        val piano = PianoLocale(Geo.centroRiquadro(linea))
        val ls = lineaJts(linea, piano)
        val parametri = BufferParameters().apply {
            endCapStyle = BufferParameters.CAP_FLAT
            joinStyle = BufferParameters.JOIN_ROUND
            quadrantSegments = 4
        }
        val g = BufferOp.bufferOp(ls, metri, parametri)
        return daJts(g, piano)
    }

    /** Unisce aree che si sovrappongono (il motore vuole aree non sovrapposte). */
    fun unisci(aree: List<Poligono>): List<Poligono> {
        if (aree.size <= 1) return aree
        val piano = PianoLocale(Geo.centroRiquadro(aree.flatMap { it.esterno }))
        val geometrie = aree.map { poligonoJts(it, piano).buffer(0.0) }
        val unione = UnaryUnionOp.union(geometrie)
        return daJts(unione, piano)
    }

    // ------------------------------------------------------------------
    // Misure
    // ------------------------------------------------------------------

    /** Superficie in metri quadrati. */
    fun superficie(p: Poligono): Double = poligonoJts(p, PianoLocale(p.esterno.first())).area

    /** Lato maggiore (larghezza o altezza) del rettangolo che contiene l'area, in metri. */
    fun estensione(p: Poligono): Double {
        val piano = PianoLocale(p.esterno.first())
        val env = poligonoJts(p, piano).envelopeInternal
        return max(env.width, env.height)
    }

    /** Vero se il punto è dentro l'area (fuori dai buchi). */
    fun contiene(p: Poligono, punto: Punto): Boolean =
        Geo.dentro(punto, p.esterno) && p.buchi.none { Geo.dentro(punto, it) }

    /** Distanza in metri fra un punto e il bordo dell'area (0 se dentro). */
    fun distanzaDa(p: Poligono, punto: Punto): Double {
        val piano = PianoLocale(punto)
        return poligonoJts(p, piano).distance(fabbrica.createPoint(Coordinate(0.0, 0.0)))
    }

    /** Distanza minima in metri fra una linea e l'area. */
    fun distanzaLinea(p: Poligono, linea: Linea): Double {
        if (linea.size < 2) return distanzaDa(p, linea.first())
        val piano = PianoLocale(p.esterno.first())
        return poligonoJts(p, piano).distance(lineaJts(linea, piano))
    }

    /**
     * Metri di linea che stanno dentro l'area, dopo aver "ristretto" l'area
     * di [tolleranza] metri (così un percorso che sfiora il bordo per errori
     * di arrotondamento non viene considerato dentro).
     */
    fun metriDentro(p: Poligono, linea: Linea, tolleranza: Double = 0.0): Double {
        if (linea.size < 2) return 0.0
        val piano = PianoLocale(p.esterno.first())
        var area: Geometry = poligonoJts(p, piano)
        if (tolleranza > 0) area = area.buffer(-tolleranza)
        if (area.isEmpty) return 0.0
        val ls = lineaJts(ritaglia(linea, p, 2000.0), piano)
        if (ls.isEmpty) return 0.0
        return area.intersection(ls).length
    }

    /**
     * Ingressi e uscite della linea rispetto all'area.
     * Restituisce gli intervalli (in metri dall'inizio della linea) in cui
     * la linea è dentro l'area. Risoluzione: [passo] metri.
     */
    fun intervalliDentro(p: Poligono, linea: Linea, passo: Double = 10.0): List<ClosedFloatingPointRange<Double>> {
        if (linea.size < 2) return emptyList()
        val piano = PianoLocale(p.esterno.first())
        val prep = PreparedGeometryFactory.prepare(poligonoJts(p, piano))
        val prog = Geo.progressive(linea)
        val tot = prog.last()
        val out = mutableListOf<ClosedFloatingPointRange<Double>>()
        var inizio: Double? = null
        var s = 0.0
        while (true) {
            val punto = Geo.puntoAProgressiva(linea, s, prog)
            val (x, y) = piano.xy(punto)
            val dentro = prep.contains(fabbrica.createPoint(Coordinate(x, y)))
            if (dentro && inizio == null) inizio = s
            if (!dentro && inizio != null) { out += inizio..s; inizio = null }
            if (s >= tot) break
            s = minOf(tot, s + passo)
        }
        if (inizio != null) out += inizio..tot
        return out
    }

    /** Vero se le due aree si sovrappongono (anche solo in parte). */
    fun siSovrappongono(a: Poligono, b: Poligono): Boolean {
        val piano = PianoLocale(a.esterno.first())
        return poligonoJts(a, piano).intersects(poligonoJts(b, piano))
    }

    /** Vero se l'area [interna] è completamente coperta da [esterna]. */
    fun copre(esterna: Poligono, interna: Poligono): Boolean {
        val piano = PianoLocale(interna.esterno.first())
        return poligonoJts(esterna, piano).buffer(0.5).covers(poligonoJts(interna, piano))
    }

    /** Vero se il poligono è "ben fatto" (bordo che non si incrocia da solo). */
    fun valido(p: Poligono): Boolean =
        p.esterno.size >= 3 && poligonoJts(p, PianoLocale(p.esterno.first())).isValid

    /** Corregge un poligono disegnato male (es. bordo a farfalla). */
    fun correggi(p: Poligono): List<Poligono> {
        val piano = PianoLocale(p.esterno.first())
        return daJts(poligonoJts(p, piano).buffer(0.0), piano)
    }

    // ------------------------------------------------------------------
    // Conversioni da/verso JTS (uso interno)
    // ------------------------------------------------------------------

    /** Tiene solo la parte di linea vicina all'area (velocizza i calcoli su percorsi lunghi). */
    private fun ritaglia(linea: Linea, p: Poligono, margineMetri: Double): Linea {
        val gradi = margineMetri / 111_000.0
        val minLat = p.esterno.minOf { it.lat } - gradi
        val maxLat = p.esterno.maxOf { it.lat } + gradi
        val gradiLon = gradi / max(0.1, cos(Math.toRadians(p.esterno.first().lat)))
        val minLon = p.esterno.minOf { it.lon } - gradiLon
        val maxLon = p.esterno.maxOf { it.lon } + gradiLon
        fun vicino(q: Punto) = q.lat in minLat..maxLat && q.lon in minLon..maxLon
        // teniamo anche il vertice prima e dopo ogni pezzo vicino, per non tagliare segmenti
        val tieni = BooleanArray(linea.size)
        for (i in linea.indices) if (vicino(linea[i])) {
            tieni[i] = true
            if (i > 0) tieni[i - 1] = true
            if (i < linea.size - 1) tieni[i + 1] = true
        }
        // segmenti lunghi che attraversano il riquadro senza vertici vicini:
        // in quel caso teniamo tutto (caso raro, linea già semplice)
        if (tieni.none { it }) return linea
        return linea.filterIndexed { i, _ -> tieni[i] }
    }

    private fun coordinate(punti: List<Punto>, piano: PianoLocale, chiudi: Boolean): Array<Coordinate> {
        val c = punti.map { val (x, y) = piano.xy(it); Coordinate(x, y) }.toMutableList()
        if (chiudi && c.isNotEmpty() && c.first() != c.last()) c += Coordinate(c.first())
        return c.toTypedArray()
    }

    private fun lineaJts(linea: Linea, piano: PianoLocale): LineString =
        if (linea.size < 2) fabbrica.createLineString() else fabbrica.createLineString(coordinate(linea, piano, false))

    private fun poligonoJts(p: Poligono, piano: PianoLocale): Polygon {
        val esterno = fabbrica.createLinearRing(coordinate(p.esterno, piano, true))
        val buchi = p.buchi.map { fabbrica.createLinearRing(coordinate(it, piano, true)) }.toTypedArray()
        return fabbrica.createPolygon(esterno, buchi)
    }

    private fun daJts(g: Geometry, piano: PianoLocale): List<Poligono> {
        val out = mutableListOf<Poligono>()
        for (i in 0 until g.numGeometries) {
            val parte = g.getGeometryN(i) as? Polygon ?: continue
            if (parte.isEmpty) continue
            fun anello(ls: LineString): Anello =
                ls.coordinates.dropLast(1).map { piano.punto(it.x, it.y) }
            out += Poligono(
                anello(parte.exteriorRing),
                (0 until parte.numInteriorRing).map { anello(parte.getInteriorRingN(it)) },
            )
        }
        return out
    }
}
