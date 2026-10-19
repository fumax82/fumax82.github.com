package com.ric.navigatore.nucleo.modello

import com.ric.navigatore.nucleo.geo.Aree
import com.ric.navigatore.nucleo.geo.Geo
import com.ric.navigatore.nucleo.geo.Linea
import com.ric.navigatore.nucleo.geo.Poligono
import com.ric.navigatore.nucleo.geo.Punto

/** Che cosa rappresenta una "maniglia" che l'utente può toccare per modificare un vincolo. */
enum class TipoManiglia {
    /** Un vertice di poligono o un angolo di rettangolo: si sposta. */
    VERTICE,
    /** Il punto a metà di un lato del poligono: toccandolo si aggiunge un vertice. */
    META_LATO,
    /** Il centro di un cerchio: sposta il cerchio. */
    CENTRO,
    /** Il punto di passaggio. */
    PUNTO,
}

data class Maniglia(val punto: Punto, val tipo: TipoManiglia, val indice: Int)

/**
 * Modifiche geometriche ai vincoli già creati: spostare, cambiare forma,
 * cambiare raggio, aggiungere o togliere vertici. Ogni funzione restituisce
 * un NUOVO vincolo (quello vecchio resta nello storico per «Annulla»).
 */
object Modifiche {
    /** Le maniglie da disegnare sulla mappa per il vincolo selezionato. */
    fun maniglie(v: Vincolo): List<Maniglia> = when (v) {
        is PassaPunto -> listOf(Maniglia(v.puntoUsato, TipoManiglia.PUNTO, 0))
        is EvitaArea -> maniglieArea(v.forma, v.poligono, v.centro)
        is PassaArea -> maniglieArea(v.forma, v.poligono, v.centro)
        // i tratti seguono la strada: non si deformano a mano (si rifà la scelta)
        is EvitaTratto, is PassaTratto -> emptyList()
    }

    private fun maniglieArea(forma: FormaArea, p: Poligono, centro: Punto?): List<Maniglia> = when (forma) {
        FormaArea.CERCHIO -> listOf(Maniglia(centro ?: Geo.centroRiquadro(p.esterno), TipoManiglia.CENTRO, 0))
        FormaArea.RETTANGOLO -> p.esterno.mapIndexed { i, q -> Maniglia(q, TipoManiglia.VERTICE, i) }
        FormaArea.POLIGONO -> p.esterno.mapIndexed { i, q -> Maniglia(q, TipoManiglia.VERTICE, i) } +
            p.esterno.indices.map { i ->
                val a = p.esterno[i]
                val b = p.esterno[(i + 1) % p.esterno.size]
                Maniglia(Punto((a.lat + b.lat) / 2, (a.lon + b.lon) / 2), TipoManiglia.META_LATO, i)
            }
    }

    /** Il punto "di riferimento" del vincolo (per lo spostamento intero). */
    fun riferimento(v: Vincolo): Punto = when (v) {
        is PassaPunto -> v.puntoUsato
        is EvitaArea -> v.centro ?: Geo.centroRiquadro(v.poligono.esterno)
        is PassaArea -> v.centro ?: Geo.centroRiquadro(v.poligono.esterno)
        is EvitaTratto -> Geo.puntoAProgressiva(v.linea, Geo.lunghezza(v.linea) / 2)
        is PassaTratto -> Geo.puntoAProgressiva(v.linea, Geo.lunghezza(v.linea) / 2)
    }

    /** Sposta tutto il vincolo in modo che il suo riferimento finisca in [a]. */
    fun trasla(v: Vincolo, a: Punto): Vincolo {
        val da = riferimento(v)
        val dLat = a.lat - da.lat
        val dLon = a.lon - da.lon
        fun t(p: Punto) = Punto(p.lat + dLat, p.lon + dLon)
        fun tp(p: Poligono) = Poligono(p.esterno.map(::t), p.buchi.map { it.map(::t) })
        fun tl(l: Linea) = l.map(::t)
        return when (v) {
            // un punto spostato va riagganciato alla strada: lo fa chi chiama
            is PassaPunto -> v.copy(punto = a, agganciato = null, nomeStrada = null)
            is EvitaArea -> v.copy(poligono = tp(v.poligono), centro = v.centro?.let(::t))
            is PassaArea -> v.copy(poligono = tp(v.poligono), centro = v.centro?.let(::t))
            is EvitaTratto -> v.copy(linea = tl(v.linea))
            is PassaTratto -> v.copy(linea = tl(v.linea))
        }
    }

    /** Sposta una maniglia in [a]. */
    fun spostaManiglia(v: Vincolo, m: Maniglia, a: Punto): Vincolo = when (m.tipo) {
        TipoManiglia.PUNTO, TipoManiglia.CENTRO -> trasla(v, a)
        TipoManiglia.META_LATO -> v // si usa inserisciVertice
        TipoManiglia.VERTICE -> cambiaPoligono(v) { forma, p ->
            if (forma == FormaArea.RETTANGOLO) {
                // l'angolo opposto resta fermo: il rettangolo resta "dritto"
                Aree.rettangolo(p.esterno[(m.indice + 2) % p.esterno.size], a)
            } else {
                Poligono(p.esterno.mapIndexed { i, q -> if (i == m.indice) a else q })
            }
        }
    }

    /** Aggiunge un vertice dopo il vertice [lato] (solo poligoni). */
    fun inserisciVertice(v: Vincolo, lato: Int, a: Punto): Vincolo = cambiaPoligono(v) { forma, p ->
        if (forma != FormaArea.POLIGONO) p else Poligono(p.esterno.toMutableList().apply { add(lato + 1, a) })
    }

    /** Toglie un vertice (il poligono deve restare con almeno 3 vertici). */
    fun togliVertice(v: Vincolo, indice: Int): Vincolo = cambiaPoligono(v) { forma, p ->
        if (forma != FormaArea.POLIGONO || p.esterno.size <= 3) p else Poligono(p.esterno.filterIndexed { i, _ -> i != indice })
    }

    /** Nuovo raggio di un cerchio. */
    fun cambiaRaggio(v: Vincolo, raggio: Double): Vincolo = when {
        v is EvitaArea && v.forma == FormaArea.CERCHIO && v.centro != null -> v.copy(raggio = raggio, poligono = Aree.cerchio(v.centro, raggio))
        v is PassaArea && v.forma == FormaArea.CERCHIO && v.centro != null -> v.copy(raggio = raggio, poligono = Aree.cerchio(v.centro, raggio))
        else -> v
    }

    /** Applica una modifica al poligono e corregge eventuali "nodi" (lati che si incrociano). */
    private fun cambiaPoligono(v: Vincolo, f: (FormaArea, Poligono) -> Poligono): Vincolo {
        fun sistema(forma: FormaArea, p: Poligono): Poligono {
            val n = f(forma, p)
            if (Aree.valido(n)) return n
            return Aree.correggi(n).maxByOrNull { Aree.superficie(it) } ?: p
        }
        return when (v) {
            is EvitaArea -> v.copy(poligono = sistema(v.forma, v.poligono))
            is PassaArea -> v.copy(poligono = sistema(v.forma, v.poligono))
            else -> v
        }
    }

    /**
     * Il vincolo "colpito" da un tocco: prima punti e linee (più precisi),
     * poi le aree (la più piccola che contiene il tocco). [soglia] in metri.
     */
    fun colpito(vincoli: List<Vincolo>, p: Punto, soglia: Double): Vincolo? {
        vincoli.filterIsInstance<PassaPunto>().minByOrNull { Geo.distanza(it.puntoUsato, p) }
            ?.takeIf { Geo.distanza(it.puntoUsato, p) <= soglia }?.let { return it }
        vincoli.filter { it is EvitaTratto || it is PassaTratto }
            .map { it to Geo.proietta(if (it is EvitaTratto) it.linea else (it as PassaTratto).linea, p).distanza }
            .minByOrNull { it.second }?.takeIf { it.second <= soglia }?.let { return it.first }
        return vincoli.mapNotNull { v ->
            val pol = when (v) { is EvitaArea -> v.poligono; is PassaArea -> v.poligono; else -> null } ?: return@mapNotNull null
            if (Aree.contiene(pol, p) || Aree.distanzaDa(pol, p) <= soglia / 2) v to Aree.superficie(pol) else null
        }.minByOrNull { it.second }?.first
    }
}
