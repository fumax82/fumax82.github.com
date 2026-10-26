/*
 * Preferenze.kt
 * Valori che l'app ricorda tra un utilizzo e l'altro:
 * la cartella condivisa scelta, gli ultimi macchina, reparto e autore,
 * la chiave Groq e il modello di trascrizione.
 */
package it.formazione.videotutorial.archivio

import android.content.Context
import android.net.Uri

class Preferenze(context: Context) {

    private val prefs = context.getSharedPreferences("preferenze", Context.MODE_PRIVATE)

    /** Cartella condivisa "Formazione" (null se non ancora scelta). */
    var uriCartella: Uri?
        get() = prefs.getString("uri_cartella", null)?.let(Uri::parse)
        set(valore) = prefs.edit().putString("uri_cartella", valore?.toString()).apply()

    var ultimaMacchina: String
        get() = prefs.getString("ultima_macchina", "") ?: ""
        set(valore) = prefs.edit().putString("ultima_macchina", valore).apply()

    var ultimoReparto: String
        get() = prefs.getString("ultimo_reparto", "") ?: ""
        set(valore) = prefs.edit().putString("ultimo_reparto", valore).apply()

    var ultimoAutore: String
        get() = prefs.getString("ultimo_autore", "") ?: ""
        set(valore) = prefs.edit().putString("ultimo_autore", valore).apply()

    /**
     * Chiave API di Groq per la trascrizione (vuota = trascrizione spenta).
     * Resta salvata solo in questo telefono, nella memoria privata dell'app.
     */
    var chiaveGroq: String
        get() = prefs.getString("chiave_groq", "") ?: ""
        set(valore) = prefs.edit().putString("chiave_groq", valore.trim()).apply()

    /** Modello di trascrizione Groq (vedi ModelloTrascrizione). */
    var modelloTrascrizione: String
        get() = prefs.getString("modello_trascrizione", "whisper-large-v3") ?: "whisper-large-v3"
        set(valore) = prefs.edit().putString("modello_trascrizione", valore).apply()
}
