package com.ric.navigatore.nucleo.modello

import com.ric.navigatore.nucleo.geo.Aree
import com.ric.navigatore.nucleo.geo.Geo
import com.ric.navigatore.nucleo.geo.Punto

/**
 * Vincoli "rapidi" da creare durante la guida, dalla finestra di
 * esplorazione, con un solo tocco (senza gli strumenti di disegno).
 */
object VincoliRapidi {
    /** Metri di percorso esclusi prima e dopo il punto scelto. */
    const val META_TRATTO = 150.0

    /** Raggio della zona da evitare. */
    const val RAGGIO_ZONA = 300.0

    /** Evita il pezzo di percorso attorno al punto a [progressiva] metri dalla partenza. */
    fun evitaTrattoDelPercorso(p: Percorso, progressiva: Double, nomeStrada: String? = null): EvitaTratto {
        val prog = Geo.progressive(p.geometria)
        val linea = Geo.sottoLinea(p.geometria, progressiva - META_TRATTO, progressiva + META_TRATTO, prog)
        return EvitaTratto(nome = "Tratto evitato in guida" + (nomeStrada?.takeIf { it.isNotBlank() }?.let { " ($it)" } ?: ""), linea = linea)
    }

    /** Evita un cerchio di 300 m attorno a [centro]. */
    fun evitaZona(centro: Punto): EvitaArea = EvitaArea(
        nome = "Zona evitata in guida", forma = FormaArea.CERCHIO,
        poligono = Aree.cerchio(centro, RAGGIO_ZONA), centro = centro, raggio = RAGGIO_ZONA,
    )

    /** Passa da [punto] (il motore lo porterà sulla strada più vicina). */
    fun passaDa(punto: Punto): PassaPunto = PassaPunto(nome = "Passaggio scelto in guida", punto = punto)
}
