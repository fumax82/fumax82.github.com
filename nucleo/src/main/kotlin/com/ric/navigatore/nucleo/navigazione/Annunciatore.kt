package com.ric.navigatore.nucleo.navigazione

import com.ric.navigatore.nucleo.modello.Manovra
import com.ric.navigatore.nucleo.modello.TipoManovra
import kotlin.math.max

/**
 * Decide COSA dire e QUANDO, durante la guida.
 * Ogni avviso viene detto una sola volta per manovra.
 * La voce vera e propria è la sintesi vocale di Android (nell'app).
 */
class Annunciatore {
    /** Manovra a cui si riferiscono gli avvisi già dati. */
    private var manovraCorrente: Manovra? = null
    private val sogliePronunciate = mutableSetOf<Int>()

    /** Restituisce la frase da pronunciare adesso, oppure null. */
    fun frase(stato: StatoGuida, velocita: Double?): String? {
        val m = stato.manovra ?: return null
        if (m != manovraCorrente) {
            manovraCorrente = m
            sogliePronunciate.clear()
        }
        val v = velocita ?: 12.0
        val d = stato.distanzaManovra
        // Distanze degli avvisi in base alla velocità
        val soglie = when {
            v > 22 -> listOf(2000, 1000, 400)   // oltre ~80 km/h
            v > 14 -> listOf(1000, 400, 150)    // ~50-80 km/h
            else -> listOf(400, 150)            // città
        }
        val adesso = max(30.0, v * 4) // "ora": circa 4 secondi prima
        if (d <= adesso && 0 !in sogliePronunciate) {
            sogliePronunciate += 0
            sogliePronunciate += soglie
            return testoManovra(m, stato.manovraDopo, stato.distanzaManovra)
        }
        // la soglia più vicina già superata, se non ancora detta
        val soglia = soglie.filter { d <= it && d > adesso + 50 }.minOrNull() ?: return null
        if (soglia in sogliePronunciate) return null
        sogliePronunciate += soglie.filter { it >= soglia }
        return "Tra ${distanzaParlata(d)}, ${testoManovra(m, null, d).replaceFirstChar { it.lowercase() }}"
    }

    /** Frase per la manovra (con "poi…" se la successiva è vicinissima). */
    private fun testoManovra(m: Manovra, dopo: Manovra?, distanza: Double): String {
        val base = when {
            m.tipo == TipoManovra.ARRIVO -> "Sei arrivato a destinazione"
            m.istruzione.isNotBlank() -> m.istruzione.trimEnd('.')
            else -> "Prosegui"
        }
        val poi = if (dopo != null && dopo.tipo != TipoManovra.ARRIVO && m.distanza < 100 && distanza < 200) {
            ", poi " + dopo.istruzione.trimEnd('.').replaceFirstChar { it.lowercase() }
        } else ""
        return base + poi
    }

    companion object {
        /** "300 metri", "1,5 chilometri". */
        fun distanzaParlata(metri: Double): String = when {
            metri >= 1000 -> {
                val km = Math.round(metri / 100.0) / 10.0
                if (km == Math.floor(km)) "${km.toInt()} chilometr${if (km.toInt() == 1) "o" else "i"}"
                else String.format(java.util.Locale.ITALY, "%.1f chilometri", km)
            }
            metri >= 100 -> "${(Math.round(metri / 50.0) * 50)} metri"
            else -> "${(Math.round(metri / 10.0) * 10)} metri"
        }
    }
}
