package com.ric.navigatore.dati

import android.content.Context
import com.ric.navigatore.nucleo.modello.Luogo
import com.ric.navigatore.nucleo.modello.Viaggio
import com.ric.navigatore.nucleo.modello.Vincolo
import com.ric.navigatore.nucleo.servizi.StatoQuote
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File

/** Tema della mappa. */
@Serializable
/** Mappe di base disponibili, tutte gratuite. */
enum class MappaBase(val etichetta: String, val spiegazione: String) {
    STRADALE("Stradale", "OpenFreeMap (OpenStreetMap), con modalità notte."),
    SATELLITE("Satellite", "Sentinel-2 cloudless di EOX: gratuito per uso personale, nessuna chiave. Risoluzione 10 m: vedi campi, boschi e città, non i dettagli delle singole strade."),
    IBRIDA("Satellite con strade", "Come «Satellite», con sopra strade e nomi di OpenStreetMap."),
    SATELLITE_HD("Satellite alta risoluzione", "Esri World Imagery: immagini dettagliate. I termini Esri richiedono una chiave ArcGIS (gratuita, nelle Impostazioni)."),
    TOPOGRAFICA("Topografica", "OpenTopoMap: curve di livello e rilievo, utile con il profilo altimetrico."),
}

enum class Tema(val etichetta: String) { AUTOMATICO("Automatico (come il telefono)"), GIORNO("Giorno"), NOTTE("Notte") }

/** Le impostazioni dell'utente (salvate solo sul telefono). */
@Serializable
data class Impostazioni(
    /** Chiave personale openrouteservice. NON è nel codice sorgente: la inserisce l'utente. */
    val chiaveOrs: String = "",
    /** Indirizzo del server openrouteservice (cambialo solo se ne usi uno tuo). */
    val serverOrs: String = "https://api.openrouteservice.org",
    /** Se manca la chiave, cerca gli indirizzi con Nominatim (solo con il tasto Cerca). */
    val usaNominatimSenzaChiave: Boolean = true,
    val tema: Tema = Tema.AUTOMATICO,
    val voce: Boolean = true,
    /** Tieni lo schermo acceso durante la guida (consuma più batteria). */
    val schermoAcceso: Boolean = true,
    /** Massimo di richieste di percorso per ogni calcolo (con aree da attraversare e diagnosi). */
    val budgetRichieste: Int = 8,
    /** Ruota la mappa nella direzione di marcia durante la guida. */
    val mappaOrientata: Boolean = true,
    /** Tipo di mappa di base mostrata. */
    val mappaBase: MappaBase = MappaBase.STRADALE,
    /** Chiave ArcGIS (facoltativa, gratuita): serve solo per il satellite ad alta risoluzione Esri. */
    val chiaveArcgis: String = "",
    /** Durante la guida, mostra in alto l'anteprima dell'incrocio prima di ogni svolta. */
    val anteprimaIncroci: Boolean = true,
    /** Avvisa (a voce e sullo schermo) di tornanti, salite e discese ripide. */
    val avvisiStrada: Boolean = true,
    /** Pendenza (in %) oltre la quale salite e discese sono "ripide". */
    val sogliaPendenza: Int = 8,
)

/** Un percorso salvato dall'utente (tappe + vincoli). */
@Serializable
data class PercorsoSalvato(val nome: String, val viaggio: Viaggio, val salvatoIl: Long)

/** Tutto ciò che salviamo in un unico file. */
@Serializable
data class DatiSalvati(
    val impostazioni: Impostazioni = Impostazioni(),
    /** Vincoli con durata "Salvato per i prossimi viaggi". */
    val vincoliSalvati: List<Vincolo> = emptyList(),
    val preferiti: List<Luogo> = emptyList(),
    val percorsi: List<PercorsoSalvato> = emptyList(),
    /** Ultime destinazioni e ricerche (la più recente per prima). */
    val cronologia: List<Luogo> = emptyList(),
    val quote: StatoQuote = StatoQuote(),
)

/**
 * Salva e legge i dati dell'app in un file privato (nessun account, nessun
 * invio a server). Il file sta in /data/data/com.ric.navigatore/files/
 * e viene cancellato se si disinstalla l'app.
 */
class Archivio(context: Context) {
    private val file = File(context.filesDir, "dati.json")
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true; prettyPrint = false }

    private val _flusso = kotlinx.coroutines.flow.MutableStateFlow(leggi())

    /** I dati attuali; [flusso] avvisa l'interfaccia a ogni modifica. */
    val dati: DatiSalvati get() = _flusso.value
    val flusso: kotlinx.coroutines.flow.StateFlow<DatiSalvati> = _flusso

    private fun leggi(): DatiSalvati = try {
        if (file.exists()) json.decodeFromString(DatiSalvati.serializer(), file.readText()) else DatiSalvati()
    } catch (e: Exception) {
        // file danneggiato: lo mettiamo da parte e ripartiamo puliti
        file.renameTo(File(file.parentFile, "dati-danneggiato-${System.currentTimeMillis()}.json"))
        DatiSalvati()
    }

    /** Modifica i dati e li salva subito (scrittura "atomica": prima su un file temporaneo). */
    @Synchronized
    fun modifica(cambia: (DatiSalvati) -> DatiSalvati) {
        _flusso.value = cambia(dati)
        val tmp = File(file.parentFile, "dati.json.tmp")
        tmp.writeText(json.encodeToString(DatiSalvati.serializer(), dati))
        tmp.renameTo(file)
    }
}
