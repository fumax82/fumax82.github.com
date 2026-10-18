package com.ric.navigatore.nucleo.servizi

import com.ric.navigatore.nucleo.geo.Punto
import com.ric.navigatore.nucleo.modello.Esito
import com.ric.navigatore.nucleo.modello.Percorso
import com.ric.navigatore.nucleo.modello.RichiestaPercorso

// =====================================================================
// "Prese" a cui collegare i fornitori di servizi.
// Ogni fornitore (openrouteservice, Nominatim, un server proprio…)
// implementa una di queste interfacce: per cambiare fornitore basta
// scriverne una nuova implementazione, senza toccare il resto dell'app.
// =====================================================================

/** Cosa sa fare un motore di percorso. Serve per non promettere ciò che non c'è. */
data class Capacita(
    /** Vero se il motore sa escludere esattamente un arco stradale (es. Valhalla "exclude_locations"). */
    val esclusioneArchiEsatta: Boolean,
    /** Vero se accetta aree (poligoni) da evitare. */
    val areeDaEvitare: Boolean,
    /** Superficie massima di ogni area da evitare, in km² (null = nessun limite noto). */
    val maxAreaKmq: Double?,
    /** Lato massimo di ogni area da evitare, in km. */
    val maxEstensioneKm: Double?,
    /** Lunghezza massima di un percorso con aree da evitare, in km. */
    val maxDistanzaConAreeKm: Double?,
    /** Numero massimo di punti (partenza + intermedi + arrivo). */
    val maxPunti: Int,
    /** Percorsi alternativi: disponibili solo con partenza e arrivo, senza intermedi. */
    val alternativeSoloSenzaIntermedi: Boolean,
    val maxDistanzaAlternativeKm: Double?,
    val maxAlternative: Int,
    /** Vero se accetta la direzione di marcia nei punti (per i tratti con senso). */
    val direzioneNeiPunti: Boolean,
    val evitaPedaggi: Boolean,
    val evitaAutostrade: Boolean,
    val evitaTraghetti: Boolean,
    /** Traffico in tempo reale: falso per tutti i servizi gratuiti usati qui. */
    val trafficoTempoReale: Boolean = false,
)

/** Motore di percorso (routing). */
interface MotorePercorsi {
    val nome: String
    val capacita: Capacita

    /** Calcola uno o più percorsi. Funzione BLOCCANTE: chiamarla fuori dal thread grafico. */
    fun calcola(richiesta: RichiestaPercorso): Esito<List<Percorso>>
}

/** Un punto spostato sulla strada percorribile più vicina. */
data class PuntoAgganciato(
    val originale: Punto,
    val agganciato: Punto,
    val nomeStrada: String,
    /** Di quanti metri è stato spostato. */
    val spostamento: Double,
)

/** Servizio di "aggancio" alla rete stradale (snapping). */
fun interface Agganciatore {
    /**
     * Per ogni punto restituisce il punto stradale più vicino entro [raggio] metri,
     * oppure null se non c'è nessuna strada percorribile in auto.
     */
    fun aggancia(punti: List<Punto>, raggio: Double): Esito<List<PuntoAgganciato?>>
}

/** Un risultato della ricerca di indirizzi. */
data class RisultatoRicerca(
    val nome: String,
    val dettaglio: String,
    val punto: Punto,
)

/** Ricerca di indirizzi e luoghi (geocodifica). */
interface Geocodifica {
    val nome: String

    /**
     * Vero se il fornitore permette i suggerimenti mentre si scrive.
     * Nominatim (OpenStreetMap) per esempio lo VIETA espressamente.
     */
    val suggerimentiConsentiti: Boolean

    /** Ricerca completa (dopo aver premuto "Cerca"). */
    fun cerca(testo: String, vicinoA: Punto?): Esito<List<RisultatoRicerca>>

    /** Suggerimenti mentre si scrive (solo se [suggerimentiConsentiti]). */
    fun suggerisci(testo: String, vicinoA: Punto?): Esito<List<RisultatoRicerca>>

    /** Da coordinate a indirizzo. */
    fun indirizzo(punto: Punto): Esito<RisultatoRicerca?>
}
