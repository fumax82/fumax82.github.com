/*
 * ImprontaVideo.kt
 * Calcola l'"impronta" di un video: un codice di 16 caratteri che identifica
 * il file. Se lo stesso video viene riaperto, l'impronta è uguale e l'app
 * ritrova la sua cartella invece di crearne una nuova.
 *
 * Per essere veloce anche con video enormi non legge tutto il file, ma solo:
 * la dimensione + i primi 4 MB + gli ultimi 4 MB (codice SHA-256).
 */
package it.formazione.videotutorial.archivio

import android.content.Context
import android.net.Uri
import android.os.ParcelFileDescriptor
import java.nio.ByteBuffer
import java.nio.channels.FileChannel
import java.security.MessageDigest

object ImprontaVideo {

    private const val BLOCCO = 4L * 1024 * 1024 // 4 MB

    /** Restituisce l'impronta del video (16 caratteri esadecimali). Da chiamare fuori dal thread principale. */
    fun calcola(context: Context, uri: Uri): String {
        val pfd = context.contentResolver.openFileDescriptor(uri, "r")
            ?: error("Impossibile aprire il video")
        val sha = MessageDigest.getInstance("SHA-256")
        val dimensioneDichiarata = pfd.statSize
        ParcelFileDescriptor.AutoCloseInputStream(pfd).use { flusso ->
            val canale = flusso.channel
            val dimensione = if (dimensioneDichiarata >= 0) dimensioneDichiarata else canale.size()
            sha.update(dimensione.toString().toByteArray())
            // primi 4 MB
            leggiBlocco(canale, 0, minOf(BLOCCO, dimensione), sha)
            // ultimi 4 MB
            val inizioCoda = maxOf(0, dimensione - BLOCCO)
            leggiBlocco(canale, inizioCoda, dimensione - inizioCoda, sha)
        }
        return sha.digest().joinToString("") { "%02x".format(it) }.take(16)
    }

    /** Legge "quanti" byte a partire da "inizio" e li aggiunge al calcolo. */
    private fun leggiBlocco(canale: FileChannel, inizio: Long, quanti: Long, sha: MessageDigest) {
        val buffer = ByteBuffer.allocate(64 * 1024)
        var posizione = inizio
        var mancanti = quanti
        while (mancanti > 0) {
            buffer.clear()
            if (mancanti < buffer.capacity()) buffer.limit(mancanti.toInt())
            val letti = canale.read(buffer, posizione)
            if (letti <= 0) break
            sha.update(buffer.array(), 0, letti)
            posizione += letti
            mancanti -= letti
        }
    }
}
