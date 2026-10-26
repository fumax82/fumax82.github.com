/*
 * EstrattoreAudio.kt
 * Copia la traccia audio del video in un file .m4a SENZA ricodificarla,
 * quindi senza perdita di qualità e in pochi secondi.
 *
 * Funziona quando l'audio è AAC (il caso di quasi tutti i video del telefono).
 * Gli altri formati vengono segnalati come NON_SUPPORTATO: la conversione
 * arriverà nella Fase 2.
 */
package it.formazione.videotutorial.media

import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.net.Uri
import it.formazione.videotutorial.modello.StatoAudio
import java.io.File
import java.nio.ByteBuffer

object EstrattoreAudio {

    /** Tipo MIME dell'audio AAC. */
    private const val MIME_AAC = "audio/mp4a-latm"

    /**
     * Estrae l'audio di "uriVideo" nel file "destinazione".
     * "deveFermarsi" permette di interrompere il lavoro a metà.
     * Restituisce COMPLETATO, ASSENTE, NON_SUPPORTATO o ERRORE.
     */
    fun estrai(
        context: Context,
        uriVideo: Uri,
        destinazione: File,
        deveFermarsi: () -> Boolean = { false },
    ): StatoAudio {
        val estrattore = MediaExtractor()
        var muxer: MediaMuxer? = null
        try {
            estrattore.setDataSource(context, uriVideo, null)

            // 1. Cerca la traccia audio
            val traccia = (0 until estrattore.trackCount).firstOrNull { i ->
                estrattore.getTrackFormat(i).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
            } ?: return StatoAudio.ASSENTE
            val formato = estrattore.getTrackFormat(traccia)
            if (formato.getString(MediaFormat.KEY_MIME) != MIME_AAC) return StatoAudio.NON_SUPPORTATO

            // 2. Prepara il file di uscita .m4a con la stessa traccia
            destinazione.delete()
            val m = MediaMuxer(destinazione.path, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
            muxer = m
            val tracciaUscita = m.addTrack(formato)
            m.start()
            estrattore.selectTrack(traccia)

            // 3. Copia i campioni audio uno per uno
            val dimensioneBuffer = if (formato.containsKey(MediaFormat.KEY_MAX_INPUT_SIZE)) {
                maxOf(formato.getInteger(MediaFormat.KEY_MAX_INPUT_SIZE), 64 * 1024)
            } else {
                1024 * 1024
            }
            val buffer = ByteBuffer.allocate(dimensioneBuffer)
            val info = MediaCodec.BufferInfo()
            var spostamentoUs = Long.MIN_VALUE // per evitare tempi negativi all'inizio
            while (true) {
                if (deveFermarsi()) return StatoAudio.ERRORE
                val letti = estrattore.readSampleData(buffer, 0)
                if (letti < 0) break
                val tempo = estrattore.sampleTime
                if (spostamentoUs == Long.MIN_VALUE) spostamentoUs = if (tempo < 0) -tempo else 0
                val chiave = (estrattore.sampleFlags and MediaExtractor.SAMPLE_FLAG_SYNC) != 0
                info.set(0, letti, tempo + spostamentoUs, if (chiave) MediaCodec.BUFFER_FLAG_KEY_FRAME else 0)
                m.writeSampleData(tracciaUscita, buffer, info)
                estrattore.advance()
            }
            m.stop()
            return StatoAudio.COMPLETATO
        } catch (e: Exception) {
            return StatoAudio.ERRORE
        } finally {
            try {
                muxer?.release()
            } catch (_: Exception) {
            }
            estrattore.release()
        }
    }
}
