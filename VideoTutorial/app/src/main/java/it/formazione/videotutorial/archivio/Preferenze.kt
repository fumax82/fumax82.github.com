/*
 * Preferenze.kt
 * Valori che l'app ricorda tra un utilizzo e l'altro:
 * la cartella condivisa scelta e gli ultimi macchina, reparto e autore.
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
}
