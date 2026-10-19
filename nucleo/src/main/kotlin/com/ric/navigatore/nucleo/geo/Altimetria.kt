package com.ric.navigatore.nucleo.geo

import com.ric.navigatore.nucleo.modello.Percorso
import kotlin.math.abs
import kotlin.math.max

/** Un punto del profilo: metri dalla partenza e quota in metri sul livello del mare. */
data class PuntoProfilo(val progressiva: Double, val quota: Double)

/** Riassunto altimetrico di un percorso. */
data class Profilo(
    val punti: List<PuntoProfilo>,
    val minima: Double,
    val massima: Double,
    val salita: Double,
    val discesa: Double,
    /** Pendenza media più ripida su almeno 200 m, in percentuale (positiva = salita). */
    val pendenzaMassima: Double,
)

/**
 * Calcoli sul profilo altimetrico. Le quote arrivano dal servizio di
 * percorso (modello digitale del terreno, precisione di qualche metro:
 * ponti e gallerie possono comparire come "salti").
 */
object Altimetria {
    /** Profilo del percorso, ridotto a [maxPunti] punti per il grafico. Null se mancano le quote. */
    fun profilo(p: Percorso, maxPunti: Int = 240): Profilo? {
        val quote = p.quote ?: return null
        if (quote.size != p.geometria.size || quote.size < 2) return null
        val prog = Geo.progressive(p.geometria)
        val tutti = quote.indices.map { PuntoProfilo(prog[it], quote[it]) }
        // salita e discesa: quelle del servizio se ci sono, altrimenti calcolate ignorando oscillazioni < 3 m
        val (su, giu) = if (p.salita != null && p.discesa != null) p.salita to p.discesa else dislivelli(quote, 3.0)
        return Profilo(
            punti = riduci(tutti, maxPunti),
            minima = quote.min(),
            massima = quote.max(),
            salita = su,
            discesa = giu,
            pendenzaMassima = pendenzaMassima(tutti, 200.0),
        )
    }

    /** Somma di salite e discese, con una soglia per non contare il "rumore" del modello del terreno. */
    fun dislivelli(quote: List<Double>, soglia: Double): Pair<Double, Double> {
        var su = 0.0
        var giu = 0.0
        var riferimento = quote.first()
        for (q in quote.drop(1)) {
            val d = q - riferimento
            if (abs(d) >= soglia) {
                if (d > 0) su += d else giu -= d
                riferimento = q
            }
        }
        return su to giu
    }

    /** Pendenza più ripida (in %) misurata su tratti di almeno [finestra] metri. */
    fun pendenzaMassima(punti: List<PuntoProfilo>, finestra: Double): Double {
        var migliore = 0.0
        var j = 0
        for (i in punti.indices) {
            while (j < punti.size && punti[j].progressiva - punti[i].progressiva < finestra) j++
            if (j >= punti.size) break
            val dx = punti[j].progressiva - punti[i].progressiva
            val pend = (punti[j].quota - punti[i].quota) / dx * 100
            if (abs(pend) > abs(migliore)) migliore = pend
        }
        return migliore
    }

    /** Riduce i punti mantenendo, per ogni intervallo, il minimo e il massimo (il grafico resta fedele). */
    private fun riduci(punti: List<PuntoProfilo>, maxPunti: Int): List<PuntoProfilo> {
        if (punti.size <= maxPunti) return punti
        val gruppi = max(1, maxPunti / 2)
        val passo = punti.size.toDouble() / gruppi
        val out = mutableListOf(punti.first())
        for (g in 0 until gruppi) {
            val pezzo = punti.subList((g * passo).toInt(), minOf(punti.size, ((g + 1) * passo).toInt()))
            if (pezzo.isEmpty()) continue
            val a = pezzo.minBy { it.quota }
            val b = pezzo.maxBy { it.quota }
            listOf(a, b).sortedBy { it.progressiva }.forEach { if (it != out.last()) out += it }
        }
        if (out.last() != punti.last()) out += punti.last()
        return out
    }
}
