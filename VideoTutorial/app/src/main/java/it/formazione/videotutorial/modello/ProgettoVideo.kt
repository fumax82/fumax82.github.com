/*
 * ProgettoVideo.kt
 * Tutti i dati di un video in lavorazione. Viene salvato in
 * _archivio/indice.json e da qui si genera tutorial_input.md.
 */
package it.formazione.videotutorial.modello

import kotlinx.serialization.Serializable

/** A che punto è l'estrazione dell'audio completo del video. */
@Serializable
enum class StatoAudio(
    /** Descrizione breve mostrata nell'app e scritta in tutorial_input.md. */
    val descrizione: String,
    /** true se il lavoro sull'audio è ancora da fare o in corso. */
    val inLavorazione: Boolean,
) {
    DA_FARE("audio da estrarre", true),
    IN_CORSO("estrazione audio in corso", true),
    COMPLETATO("audio estratto", false),
    ASSENTE("il video non ha audio", false),
    NON_SUPPORTATO("formato audio non ancora supportato", false),
    ERRORE("errore nell'estrazione dell'audio (si riprova riaprendo il video)", false),
}

/** A che punto è la trascrizione del parlato (Fase 2, servizio Groq). */
@Serializable
enum class StatoTrascrizione(
    /** Descrizione breve mostrata nell'app e scritta in tutorial_input.md. */
    val descrizione: String,
    /** true se la trascrizione è ancora da fare o in corso (il lavoro non è COMPLETO). */
    val inLavorazione: Boolean,
) {
    DA_FARE("trascrizione da fare", true),
    IN_CORSO("trascrizione in corso", true),
    COMPLETATA("parlato trascritto", false),
    NON_CONFIGURATA("trascrizione non configurata (manca la chiave Groq)", false),
    NON_POSSIBILE("trascrizione non possibile (audio assente o non supportato)", false),
    ERRORE("errore nella trascrizione (si riprova riaprendo il video)", false),
}

/** Una frase del parlato con il suo tempo nel video. */
@Serializable
data class FraseParlato(
    /** Inizio della frase in millisecondi. */
    val inizioMs: Long,
    /** Fine della frase in millisecondi. */
    val fineMs: Long,
    /** Testo già ripulito da esitazioni e ripetizioni. */
    val testo: String,
)

@Serializable
data class ProgettoVideo(
    /** Impronta del file video: serve a riconoscerlo se viene riaperto. */
    val impronta: String,
    /** Nome della sottocartella nella cartella condivisa (es. 2026-10-26_Montaggio_pompa). */
    val nomeCartella: String,
    /** Indirizzo (Uri) del video sul telefono. */
    val uriVideo: String,
    /** Nome del file video (es. Montaggio_pompa.mp4). */
    val nomeFileVideo: String,
    /** Durata del video in millisecondi. */
    val durataMs: Long,
    val scheda: SchedaVideo,
    /** Elenco dei passi, sempre in ordine di tempo. */
    val passi: List<Passo> = emptyList(),
    val statoAudio: StatoAudio = StatoAudio.DA_FARE,
    /**
     * Quando è cambiato lo stato dell'audio (millisecondi dal 1970).
     * Serve a non sovrascrivere uno stato recente con uno vecchio quando
     * app e lavoro in sottofondo salvano quasi insieme.
     */
    val statoAudioAggiornatoMs: Long = 0,
    /** Frasi del parlato trascritte, in ordine di tempo (Fase 2). */
    val parlato: List<FraseParlato> = emptyList(),
    val statoTrascrizione: StatoTrascrizione = StatoTrascrizione.DA_FARE,
    /** Quando sono cambiati trascrizione e parlato (stesso scopo di statoAudioAggiornatoMs). */
    val statoTrascrizioneAggiornatoMs: Long = 0,
    /** true quando l'utente ha premuto "Termina". */
    val terminato: Boolean = false,
    val noteFinali: String = "",
) {
    /**
     * Il lavoro è COMPLETO solo se l'utente ha terminato e né l'audio né la
     * trascrizione sono ancora in lavorazione.
     */
    val completo: Boolean
        get() = terminato && !statoAudio.inLavorazione && !statoTrascrizione.inLavorazione

    /** Frase che si sta pronunciando al tempo indicato (per i sottotitoli), o null. */
    fun fraseAl(tempoMs: Long): FraseParlato? = parlato.firstOrNull { tempoMs in it.inizioMs..it.fineMs }

    /** Numero del passo (1, 2, 3...) in ordine di tempo; 0 se non trovato. */
    fun numeroDi(idPasso: String): Int = passi.indexOfFirst { it.id == idPasso } + 1
}
