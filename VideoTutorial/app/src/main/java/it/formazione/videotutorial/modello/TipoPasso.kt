/*
 * TipoPasso.kt
 * I quattro tipi di foto (passi) che si possono catturare dal video.
 * Ogni tipo ha il suo pulsante colorato e la sua misura di foto per Claude.
 *
 * Per aggiungere o cambiare un tipo basta modificare questo elenco:
 * pulsanti, nomi dei file e tutorial_input.md si adattano da soli.
 */
package it.formazione.videotutorial.modello

import kotlinx.serialization.Serializable

@Serializable
enum class TipoPasso(
    /** Testo scritto sul pulsante. */
    val etichetta: String,
    /** Testo scritto in tutorial_input.md (in maiuscolo, letto da Claude). */
    val testoPerClaude: String,
    /** Colore del pulsante nel formato 0xAARRGGBB. */
    val colore: Long,
    /** Lato lungo in pixel della foto ridotta salvata in foto/. */
    val latoLungoPx: Int,
    /** Aggiunta al nome del file (es. "_dettaglio"); vuota se non serve. */
    val suffissoFile: String,
) {
    OPERAZIONE("Operazione", "OPERAZIONE", 0xFF2E7D32, 1024, ""),
    SICUREZZA("Sicurezza", "SICUREZZA", 0xFFC62828, 1024, ""),
    ERRORE_DA_EVITARE("Errore da evitare", "ERRORE DA EVITARE", 0xFFEF6C00, 1024, ""),
    DETTAGLIO("Dettaglio", "DETTAGLIO", 0xFF1565C0, 1280, "_dettaglio"),
}
