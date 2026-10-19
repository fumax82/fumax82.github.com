package com.ric.navigatore.nucleo.navigazione

import com.ric.navigatore.nucleo.geo.Pericoli
import com.ric.navigatore.nucleo.geo.TipoPericolo
import com.ric.navigatore.nucleo.geo.TrattoPericoloso
import com.ric.navigatore.nucleo.modello.formattaDistanza
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.roundToInt

/** Avviso da mostrare sullo schermo durante la guida. */
data class AvvisoStrada(
    val tratto: TrattoPericoloso,
    /** Vero se ci siamo già dentro (l'avviso resta per tutto il tratto). */
    val inCorso: Boolean,
    /** Testo pronto da mostrare, es. "Tra 300 m: discesa ripida 10% per 1,2 km". */
    val testo: String,
)

/**
 * Durante la guida, controlla i tratti impegnativi (tornanti, salite e
 * discese ripide) rispetto alla posizione:
 *  - l'avviso compare con un anticipo proporzionale alla velocità
 *    (circa 15 secondi, fra 200 m e 1 km);
 *  - resta sullo schermo PER TUTTO IL TRATTO, con i metri che mancano alla fine;
 *  - a voce viene detto una sola volta, all'inizio.
 */
class SorveglianzaPericoli(private val tratti: List<TrattoPericoloso>) {
    private val annunciati = mutableSetOf<TrattoPericoloso>()

    companion object {
        fun anticipo(velocita: Double?): Double = (max(velocita ?: 0.0, 8.3) * 15).coerceIn(200.0, 1000.0)
    }

    /** Avvisi da mostrare adesso e, se c'è, la frase da dire. */
    fun aggiorna(progressiva: Double, velocita: Double?): Pair<List<AvvisoStrada>, String?> {
        val anticipo = anticipo(velocita)
        val attivi = tratti.filter { progressiva >= it.inizio - anticipo && progressiva < it.fine }
        val avvisi = attivi.map { t ->
            val dentro = progressiva >= t.inizio
            AvvisoStrada(t, dentro, testo(t, progressiva))
        }
        val nuovo = attivi.firstOrNull { it !in annunciati }
        nuovo?.let { annunciati += it }
        return avvisi to nuovo?.let { frase(it, progressiva) }
    }

    /** Testo sullo schermo. */
    private fun testo(t: TrattoPericoloso, s: Double): String {
        val cosa = Pericoli.descrizione(t)
        return if (s < t.inizio) "Tra ${formattaDistanza(t.inizio - s)}: ${cosa.replaceFirstChar { it.lowercase() }} per ${formattaDistanza(t.lunghezza)}"
        else "$cosa · ancora ${formattaDistanza(t.fine - s)}"
    }

    /** Frase per la voce. */
    private fun frase(t: TrattoPericoloso, s: Double): String {
        val cosa = when (t.tipo) {
            TipoPericolo.TORNANTI -> Pericoli.descrizione(t).replaceFirstChar { it.lowercase() }
            TipoPericolo.SALITA_RIPIDA -> "salita ripida al ${abs(t.pendenzaMedia).roundToInt()} per cento"
            TipoPericolo.DISCESA_RIPIDA -> "discesa ripida al ${abs(t.pendenzaMedia).roundToInt()} per cento"
        }
        val lunghezza = Annunciatore.distanzaParlata(t.lunghezza)
        return if (s < t.inizio - 30) "Attenzione: tra ${Annunciatore.distanzaParlata(t.inizio - s)}, $cosa per $lunghezza"
        else "Attenzione: $cosa per $lunghezza"
    }
}
