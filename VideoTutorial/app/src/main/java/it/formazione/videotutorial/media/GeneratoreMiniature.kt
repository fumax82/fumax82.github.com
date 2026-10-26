/*
 * GeneratoreMiniature.kt
 * Crea le piccole immagini (miniature) dell'intero video per la striscia di
 * anteprime sotto il filmato: una ogni "intervallo" millisecondi.
 *
 * - Usa i fotogrammi chiave (CLOSEST_SYNC): sono i più veloci da leggere.
 * - Le miniature vengono salvate nella memoria temporanea dell'app: se il
 *   video viene riaperto, la striscia compare subito.
 * - L'ordine di creazione è "a raffinamento": prima poche miniature sparse
 *   su tutto il video, poi quelle in mezzo. Così la striscia si riempie
 *   subito da un capo all'altro e diventa via via più precisa.
 */
package it.formazione.videotutorial.media

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import java.io.File

class GeneratoreMiniature(
    private val context: Context,
    private val uri: Uri,
    impronta: String,
    private val intervalloMs: Long,
) {

    companion object {
        /** Altezza delle miniature in pixel (piccola: poca memoria). */
        const val ALTEZZA_PX = 90

        /** Numero massimo di miniature per video. */
        const val MASSIMO_MINIATURE = 400

        /** Intervallo minimo tra due miniature (1 secondo). */
        const val INTERVALLO_MINIMO_MS = 1000L

        /** Intervallo tra due miniature: almeno 1 s, e al massimo 400 miniature. */
        fun intervalloPer(durataMs: Long): Long {
            val grezzo = durataMs / MASSIMO_MINIATURE
            val arrotondato = ((grezzo + 999) / 1000) * 1000 // secondi interi
            return maxOf(INTERVALLO_MINIMO_MS, arrotondato)
        }

        /** Quante miniature servono per coprire tutto il video. */
        fun numeroPer(durataMs: Long, intervalloMs: Long): Int =
            if (durataMs <= 0) 0 else (durataMs / intervalloMs).toInt() + 1

        /**
         * Ordine "a raffinamento": per 9 miniature dà 0, 8, 4, 2, 6, 1, 3, 5, 7.
         */
        fun ordine(numero: Int): List<Int> {
            if (numero <= 0) return emptyList()
            val fatti = BooleanArray(numero)
            val risultato = ArrayList<Int>(numero)
            var passo = Integer.highestOneBit(maxOf(1, numero - 1))
            while (passo >= 1) {
                var i = 0
                while (i < numero) {
                    if (!fatti[i]) {
                        fatti[i] = true
                        risultato.add(i)
                    }
                    i += passo
                }
                passo /= 2
            }
            return risultato
        }
    }

    private val cartellaCache = File(context.cacheDir, "miniature/${impronta}_$intervalloMs").apply { mkdirs() }
    private var lettore: MediaMetadataRetriever? = null
    private var rotazione = 0
    private var larghezzaMiniatura = ALTEZZA_PX * 16 / 9

    /**
     * Restituisce la miniatura numero "indice" (dal disco se c'è già,
     * altrimenti la estrae dal video). Null se non si riesce.
     * Da chiamare fuori dal thread principale.
     */
    fun miniatura(indice: Int): Bitmap? {
        val file = File(cartellaCache, "$indice.jpg")
        if (file.exists()) {
            val opzioni = BitmapFactory.Options().apply { inPreferredConfig = Bitmap.Config.RGB_565 }
            BitmapFactory.decodeFile(file.path, opzioni)?.let { return it }
        }
        val r = apri()
        val tempoUs = indice * intervalloMs * 1000
        val grezza = if (Build.VERSION.SDK_INT >= 27) {
            r.getScaledFrameAtTime(
                tempoUs, MediaMetadataRetriever.OPTION_CLOSEST_SYNC, larghezzaMiniatura, ALTEZZA_PX,
            )
        } else {
            r.getFrameAtTime(tempoUs, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
        } ?: return null

        val piccola = rimpicciolisci(raddrizza(grezza))
        // Copia leggera in memoria (RGB_565 occupa metà spazio) e salvataggio su disco
        val leggera = piccola.copy(Bitmap.Config.RGB_565, false) ?: piccola
        try {
            file.outputStream().use { piccola.compress(Bitmap.CompressFormat.JPEG, 80, it) }
        } catch (_: Exception) {
            // la cache non è indispensabile
        }
        if (leggera !== piccola) piccola.recycle()
        return leggera
    }

    /** Chiude il video (da chiamare alla fine). */
    fun chiudi() {
        lettore?.release()
        lettore = null
    }

    private fun apri(): MediaMetadataRetriever {
        lettore?.let { return it }
        val nuovo = MediaMetadataRetriever()
        nuovo.setDataSource(context, uri)
        rotazione = nuovo.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
        var larghezza = nuovo.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 16
        var altezza = nuovo.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: 9
        if (rotazione == 90 || rotazione == 270) {
            val scambio = larghezza
            larghezza = altezza
            altezza = scambio
        }
        if (larghezza > 0 && altezza > 0) larghezzaMiniatura = maxOf(1, ALTEZZA_PX * larghezza / altezza)
        lettore = nuovo
        return nuovo
    }

    /** Se il video è verticale ma il fotogramma è arrivato orizzontale, lo ruota. */
    private fun raddrizza(immagine: Bitmap): Bitmap {
        if (rotazione != 90 && rotazione != 270) return immagine
        val attesaVerticale = larghezzaMiniatura < ALTEZZA_PX
        val eVerticale = immagine.width < immagine.height
        if (attesaVerticale == eVerticale || immagine.width == immagine.height) return immagine
        val matrice = Matrix().apply { postRotate(rotazione.toFloat()) }
        val ruotata = Bitmap.createBitmap(immagine, 0, 0, immagine.width, immagine.height, matrice, true)
        if (ruotata !== immagine) immagine.recycle()
        return ruotata
    }

    /** Riduce l'immagine all'altezza delle miniature (se è più grande). */
    private fun rimpicciolisci(immagine: Bitmap): Bitmap {
        if (immagine.height <= ALTEZZA_PX) return immagine
        val larghezza = maxOf(1, immagine.width * ALTEZZA_PX / immagine.height)
        val piccola = Bitmap.createScaledBitmap(immagine, larghezza, ALTEZZA_PX, true)
        if (piccola !== immagine) immagine.recycle()
        return piccola
    }
}
