/*
 * Passo.kt
 * Una foto catturata dal video, con il suo tempo, il tipo e il commento.
 * Il numero del passo (P01, P02...) non è salvato qui: dipende dalla posizione
 * in ordine di tempo e viene ricalcolato ogni volta (vedi ProgettoVideo).
 */
package it.formazione.videotutorial.modello

import kotlinx.serialization.Serializable

@Serializable
data class Passo(
    /** Codice fisso e univoco del passo: non cambia anche se cambia il numero. */
    val id: String,
    /** Momento del video in millisecondi. */
    val tempoMs: Long,
    /** Tipo di foto (Operazione, Sicurezza...). */
    val tipo: TipoPasso,
    /** Nome attuale del file JPG (uguale in foto/ e in _archivio/foto_originali/). */
    val nomeFile: String,
    /** Commento scritto dall'utente; può essere vuoto. */
    val commento: String = "",
)
