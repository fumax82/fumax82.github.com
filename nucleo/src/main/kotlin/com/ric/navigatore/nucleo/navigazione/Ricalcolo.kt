package com.ric.navigatore.nucleo.navigazione

import com.ric.navigatore.nucleo.geo.Geo
import com.ric.navigatore.nucleo.modello.Luogo
import com.ric.navigatore.nucleo.modello.PassaArea
import com.ric.navigatore.nucleo.modello.PassaPunto
import com.ric.navigatore.nucleo.modello.PassaTratto
import com.ric.navigatore.nucleo.modello.Percorso
import com.ric.navigatore.nucleo.modello.Senso
import com.ric.navigatore.nucleo.modello.TipoPunto
import com.ric.navigatore.nucleo.modello.Viaggio
import com.ric.navigatore.nucleo.modello.Vincolo

/** Risposta della politica di ricalcolo. */
sealed class Decisione {
    data object Procedi : Decisione()
    data class Attendi(val millisecondi: Long, val motivo: String) : Decisione()
}

/**
 * Regole per non sprecare richieste quando si esce dal percorso:
 *  - si aspetta [attesaIniziale] dopo la conferma di "fuori percorso"
 *    (magari si rientra subito: "debounce");
 *  - almeno [intervalloMinimo] fra due ricalcoli;
 *  - non più di [massimoPerFinestra] ricalcoli ogni [finestra].
 */
class PoliticaRicalcolo(
    private val attesaIniziale: Long = 3_000,
    private val intervalloMinimo: Long = 15_000,
    private val massimoPerFinestra: Int = 6,
    private val finestra: Long = 5 * 60_000,
) {
    private val storico = ArrayDeque<Long>()

    fun decidi(adesso: Long, fuoriDa: Long): Decisione {
        while (storico.isNotEmpty() && adesso - storico.first() > finestra) storico.removeFirst()
        val attesaDebounce = attesaIniziale - (adesso - fuoriDa)
        if (attesaDebounce > 0) return Decisione.Attendi(attesaDebounce, "Verifico l'uscita dal percorso…")
        storico.lastOrNull()?.let { ultimo ->
            val attesa = intervalloMinimo - (adesso - ultimo)
            if (attesa > 0) return Decisione.Attendi(attesa, "Ricalcolo tra ${attesa / 1000 + 1} s")
        }
        if (storico.size >= massimoPerFinestra) {
            val attesa = finestra - (adesso - storico.first())
            return Decisione.Attendi(attesa, "Troppi ricalcoli ravvicinati: attendo ${attesa / 1000 + 1} s")
        }
        return Decisione.Procedi
    }

    fun registra(adesso: Long) { storico.addLast(adesso) }
}

/**
 * Prepara il "viaggio residuo" da ricalcolare durante la guida:
 *  - si parte dalla posizione attuale;
 *  - le tappe già raggiunte NON vengono riproposte (niente ritorni indietro);
 *  - TUTTE le esclusioni restano attive;
 *  - i passaggi già fatti vengono tolti, quelli a metà (tratti) vengono accorciati.
 */
object ViaggioResiduo {
    fun calcola(originale: Viaggio, percorso: Percorso, raggiunti: Set<Int>, posizione: Rilevamento): Viaggio {
        val punti = percorso.puntiRichiesta
        // Tappe intermedie ancora da raggiungere
        val indiciTappe = punti.indices.filter { punti[it].tipo == TipoPunto.TAPPA }
        val tappeRimaste = originale.tappe.filterIndexed { i, _ -> indiciTappe.getOrNull(i)?.let { it !in raggiunti } ?: true }
        val tappeTolte = originale.tappe.size - tappeRimaste.size

        val vincoli = originale.vincoli.mapNotNull { v ->
            if (v.esclusione || !v.attivo) return@mapNotNull v
            val mieiPunti = punti.indices.filter { punti[it].idVincolo == v.id }
            val fatti = mieiPunti.filter { it in raggiunti }
            val residuo: Vincolo? = when {
                mieiPunti.isEmpty() -> v
                fatti.size == mieiPunti.size -> null // completato
                v is PassaArea && fatti.isNotEmpty() -> null // già entrati nell'area
                v is PassaTratto && fatti.isNotEmpty() -> accorcia(v, posizione)
                else -> v
            }
            // gli indici "dopoTappa" scalano delle tappe già superate
            residuo?.let { r -> spostaTappa(r, tappeTolte) }
        }
        return originale.copy(
            partenza = Luogo(posizione.punto, "Posizione attuale", posizioneAttuale = true),
            tappe = tappeRimaste,
            vincoli = vincoli,
        )
    }

    /** Tiene solo la parte del tratto non ancora percorsa. */
    private fun accorcia(v: PassaTratto, posizione: Rilevamento): Vincolo? {
        val linea = v.lineaOrientata()
        val prog = Geo.progressive(linea)
        val qui = Geo.proietta(linea, posizione.punto, prog).progressiva
        if (prog.last() - qui < 30) return null
        val resto = Geo.sottoLinea(linea, qui, prog.last(), prog)
        // la linea è già orientata: il senso diventa "dal primo al secondo"
        return v.copy(linea = resto, senso = if (v.senso == Senso.QUALSIASI) Senso.QUALSIASI else Senso.DA_INIZIO_A_FINE)
    }

    private fun spostaTappa(v: Vincolo, tolte: Int): Vincolo = when (v) {
        is PassaPunto -> v.copy(dopoTappa = v.dopoTappa?.let { maxOf(0, it - tolte) })
        is PassaTratto -> v.copy(dopoTappa = v.dopoTappa?.let { maxOf(0, it - tolte) })
        is PassaArea -> v.copy(dopoTappa = v.dopoTappa?.let { maxOf(0, it - tolte) })
        else -> v
    }
}
