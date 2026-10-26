/*
 * SchedaVideo.kt
 * I dati che l'utente compila quando apre un video nuovo.
 * Danno a Claude il contesto che dalle immagini non si capisce.
 */
package it.formazione.videotutorial.modello

import kotlinx.serialization.Serializable

@Serializable
data class SchedaVideo(
    /** Titolo della procedura (obbligatorio). */
    val titolo: String,
    val macchina: String = "",
    val reparto: String = "",
    /** A cosa serve la procedura. */
    val scopo: String = "",
    val autore: String = "",
    /** Data di creazione nel formato AAAA-MM-GG. */
    val data: String,
)
