/*
 * EstrattoreFotogrammi.kt
 * Estrae un fotogramma dal file video ORIGINALE (non dallo schermo), alla
 * massima risoluzione e nel punto esatto richiesto.
 * Legge anche la durata del video.
 */
package it.formazione.videotutorial.media

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Matrix
import android.media.MediaMetadataRetriever
import android.net.Uri

class EstrattoreFotogrammi(private val context: Context) {

    companion object {
        /** Durata del video in millisecondi (0 se non si riesce a leggerla). */
        fun leggiDurataMs(context: Context, uri: Uri): Long {
            val lettore = MediaMetadataRetriever()
            return try {
                lettore.setDataSource(context, uri)
                lettore.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
            } catch (e: Exception) {
                0L
            } finally {
                lettore.release()
            }
        }
    }

    // Il video resta aperto tra una cattura e l'altra: così le catture sono più rapide.
    private var lettore: MediaMetadataRetriever? = null
    private var uriAperto: Uri? = null

    /**
     * Restituisce il fotogramma al tempo indicato (in millisecondi), già
     * raddrizzato se il video è girato in verticale. Null se non riesce.
     * Da chiamare fuori dal thread principale (può richiedere un secondo).
     */
    @Synchronized
    fun estrai(uri: Uri, tempoMs: Long): Bitmap? {
        val r = apri(uri)
        val tempoUs = tempoMs * 1000
        val fotogramma = r.getFrameAtTime(tempoUs, MediaMetadataRetriever.OPTION_CLOSEST)
            ?: r.getFrameAtTime(tempoUs, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
            ?: return null
        return raddrizza(r, fotogramma)
    }

    /** Chiude il video aperto (da chiamare quando si esce dal progetto). */
    @Synchronized
    fun chiudi() {
        lettore?.release()
        lettore = null
        uriAperto = null
    }

    private fun apri(uri: Uri): MediaMetadataRetriever {
        val attuale = lettore
        if (attuale != null && uriAperto == uri) return attuale
        chiudi()
        val nuovo = MediaMetadataRetriever()
        nuovo.setDataSource(context, uri)
        lettore = nuovo
        uriAperto = uri
        return nuovo
    }

    /**
     * Android di solito restituisce il fotogramma già ruotato. Per sicurezza,
     * se il video è ruotato di 90/270 gradi e l'immagine non lo è, la ruota.
     */
    private fun raddrizza(r: MediaMetadataRetriever, immagine: Bitmap): Bitmap {
        val rotazione = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
        val larghezza = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 0
        val altezza = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: 0
        val daRuotare = (rotazione == 90 || rotazione == 270) && larghezza != altezza &&
            immagine.width == larghezza && immagine.height == altezza
        if (!daRuotare) return immagine
        val matrice = Matrix().apply { postRotate(rotazione.toFloat()) }
        val ruotata = Bitmap.createBitmap(immagine, 0, 0, immagine.width, immagine.height, matrice, true)
        if (ruotata !== immagine) immagine.recycle()
        return ruotata
    }
}
