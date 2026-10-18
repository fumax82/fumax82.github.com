package com.ric.navigatore.nucleo.modello

import com.ric.navigatore.nucleo.geo.Linea
import com.ric.navigatore.nucleo.geo.Poligono
import com.ric.navigatore.nucleo.geo.Punto
import kotlinx.serialization.Serializable

/** Un luogo scelto dall'utente (partenza, tappa o arrivo). */
@Serializable
data class Luogo(
    val punto: Punto,
    val nome: String,
    /** Vero se è "la mia posizione" al momento del calcolo. */
    val posizioneAttuale: Boolean = false,
)

/** Preferenze del motore di percorso. */
@Serializable
data class OpzioniPercorso(
    val evitaPedaggi: Boolean = false,
    val evitaAutostrade: Boolean = false,
    val evitaTraghetti: Boolean = false,
    /** Chiedi percorsi alternativi (solo se il motore lo permette). */
    val alternative: Boolean = true,
)

/**
 * Tutto quello che serve per calcolare un viaggio:
 * partenza, tappe intermedie, arrivo, vincoli e preferenze.
 */
@Serializable
data class Viaggio(
    val partenza: Luogo? = null,
    val tappe: List<Luogo> = emptyList(),
    val arrivo: Luogo? = null,
    val vincoli: List<Vincolo> = emptyList(),
    val opzioni: OpzioniPercorso = OpzioniPercorso(),
) {
    /** Partenza + tappe + arrivo, in ordine. */
    val fermate: List<Luogo> get() = listOfNotNull(partenza) + tappe + listOfNotNull(arrivo)

    val pronto: Boolean get() = partenza != null && arrivo != null

    val vincoliAttivi: List<Vincolo> get() = vincoli.filter { it.attivo }
}

/** Ruolo di un punto inviato al motore di percorso. */
@Serializable
enum class TipoPunto {
    PARTENZA, TAPPA, ARRIVO,

    /** Punto "tecnico" aggiunto da noi per far passare il percorso da un vincolo. */
    AUSILIARIO,
}

/** Un punto della richiesta al motore. */
@Serializable
data class PuntoRichiesta(
    val punto: Punto,
    val tipo: TipoPunto,
    /** Direzione di marcia richiesta in quel punto (gradi da nord), se serve. */
    val direzione: Double? = null,
    /** Tolleranza sulla direzione, in gradi. */
    val tolleranzaDirezione: Double = 45.0,
    /** Distanza massima (metri) entro cui il motore può spostare il punto su una strada. */
    val raggio: Double? = null,
    /** Il vincolo che ha generato questo punto (se AUSILIARIO). */
    val idVincolo: String? = null,
)

/** Richiesta completa al motore. */
@Serializable
data class RichiestaPercorso(
    val punti: List<PuntoRichiesta>,
    val areeDaEvitare: List<Poligono> = emptyList(),
    val opzioni: OpzioniPercorso = OpzioniPercorso(),
    /** Quanti percorsi alternativi chiedere (0 = solo il migliore). */
    val alternative: Int = 0,
    /** Vieta inversioni a U nei punti intermedi. */
    val proseguiDritto: Boolean = false,
)

/** Una manovra (istruzione di svolta) restituita dal motore. */
@Serializable
data class Manovra(
    /** Codice del tipo di manovra (vedi [TipoManovra]). */
    val tipo: Int,
    /** Testo già in italiano, es. "Svolta a destra su Via Roma". */
    val istruzione: String,
    val nomeStrada: String = "",
    /** Lunghezza del tratto che segue la manovra, in metri. */
    val distanza: Double,
    /** Durata stimata del tratto, in secondi. */
    val durata: Double,
    /** Indici dei punti della geometria dove inizia e finisce il tratto. */
    val daIndice: Int,
    val aIndice: Int,
    /** Numero dell'uscita (rotatorie), se presente. */
    val uscita: Int? = null,
)

/** Codici delle manovre usati da openrouteservice. */
object TipoManovra {
    const val SINISTRA = 0
    const val DESTRA = 1
    const val SINISTRA_STRETTA = 2
    const val DESTRA_STRETTA = 3
    const val SINISTRA_LEGGERA = 4
    const val DESTRA_LEGGERA = 5
    const val DRITTO = 6
    const val ROTATORIA = 7
    const val ESCI_ROTATORIA = 8
    const val INVERSIONE = 9
    const val ARRIVO = 10
    const val PARTENZA = 11
    const val MANTIENI_SINISTRA = 12
    const val MANTIENI_DESTRA = 13
}

/** Un percorso calcolato. */
@Serializable
data class Percorso(
    val geometria: Linea,
    /** Metri totali. */
    val distanza: Double,
    /** Secondi totali (stima SENZA traffico in tempo reale). */
    val durata: Double,
    val manovre: List<Manovra>,
    /** Per ogni punto della richiesta, l'indice del punto corrispondente nella geometria. */
    val indiciPunti: List<Int>,
    /** I punti della richiesta che hanno generato questo percorso. */
    val puntiRichiesta: List<PuntoRichiesta> = emptyList(),
    /** Avvisi del motore (es. "strada a pedaggio"). */
    val avvisi: List<String> = emptyList(),
    /** Sempre falso con i servizi gratuiti usati: niente traffico in tempo reale. */
    val includeTraffico: Boolean = false,
)

/** Tipo di errore, per mostrare un messaggio chiaro all'utente. */
enum class TipoErrore {
    NESSUN_PERCORSO,
    PUNTO_NON_RAGGIUNGIBILE,
    LIMITI_SUPERATI,
    QUOTA_ESAURITA,
    CHIAVE_MANCANTE,
    CHIAVE_NON_VALIDA,
    RETE_ASSENTE,
    SERVIZIO_NON_DISPONIBILE,
    RICHIESTA_NON_VALIDA,
    NON_SUPPORTATO,
    SCONOSCIUTO,
}

/** Risultato di un'operazione che può fallire. */
sealed class Esito<out T> {
    data class Ok<T>(val valore: T) : Esito<T>()
    data class Errore(
        val tipo: TipoErrore,
        /** Messaggio in italiano per l'utente. */
        val messaggio: String,
        /** Dettagli tecnici (codice del servizio, testo originale). */
        val dettaglio: String? = null,
        /** Se il punto/i punti in errore sono noti: indice nella richiesta. */
        val indicePunto: Int? = null,
    ) : Esito<Nothing>()

    fun valoreOppureNull(): T? = (this as? Ok)?.valore
}
