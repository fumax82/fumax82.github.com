/*
 * DivisoreAudio.kt
 * Divide il file audio .m4a (AAC) in pezzi più piccoli, SENZA ricodificarlo:
 * il servizio di trascrizione accetta file fino a 25 MB, quindi un video
 * lungo va spedito a pezzi. Ogni pezzo ricorda da che tempo inizia, così
 * le frasi trascritte tornano al punto giusto del video.
 */
package it.formazione.videotutorial.media

import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import java.io.File
import java.nio.ByteBuffer

object DivisoreAudio {

    /** Dimensione massima di un pezzo (sotto il limite di 25 MB del servizio). */
    const val BYTE_MASSIMI = 20L * 1024 * 1024

    /** Durata massima di un pezzo: 10 minuti. */
    const val DURATA_MASSIMA_MS = 10L * 60 * 1000

    /** Un pezzo di audio e il tempo del video da cui inizia. */
    data class Pezzo(val file: File, val inizioMs: Long)

    /** Divide "sorgente" in pezzi salvati nella cartella "destinazione". */
    fun dividi(sorgente: File, destinazione: File): List<Pezzo> {
        destinazione.mkdirs()
        val estrattore = MediaExtractor()
        val pezzi = mutableListOf<Pezzo>()
        var muxer: MediaMuxer? = null
        try {
            estrattore.setDataSource(sorgente.path)
            val traccia = (0 until estrattore.trackCount).firstOrNull { i ->
                estrattore.getTrackFormat(i).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
            } ?: return emptyList()
            val formato = estrattore.getTrackFormat(traccia)
            estrattore.selectTrack(traccia)

            val buffer = ByteBuffer.allocate(1024 * 1024)
            val info = MediaCodec.BufferInfo()
            var tracciaUscita = 0
            var byteNelPezzo = 0L
            var inizioPezzoUs = 0L
            val durataMassimaUs = DURATA_MASSIMA_MS * 1000

            while (true) {
                val letti = estrattore.readSampleData(buffer, 0)
                if (letti < 0) break
                val tempoUs = maxOf(0L, estrattore.sampleTime)

                // Serve un nuovo pezzo? (il primo, oppure quello attuale è pieno)
                if (muxer == null || byteNelPezzo + letti > BYTE_MASSIMI || tempoUs - inizioPezzoUs >= durataMassimaUs) {
                    muxer?.let {
                        it.stop()
                        it.release()
                    }
                    val file = File(destinazione, "pezzo_${pezzi.size}.m4a")
                    file.delete()
                    val nuovo = MediaMuxer(file.path, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
                    tracciaUscita = nuovo.addTrack(formato)
                    nuovo.start()
                    muxer = nuovo
                    inizioPezzoUs = tempoUs
                    byteNelPezzo = 0
                    pezzi += Pezzo(file, tempoUs / 1000)
                }

                val chiave = (estrattore.sampleFlags and MediaExtractor.SAMPLE_FLAG_SYNC) != 0
                info.set(0, letti, tempoUs - inizioPezzoUs, if (chiave) MediaCodec.BUFFER_FLAG_KEY_FRAME else 0)
                checkNotNull(muxer).writeSampleData(tracciaUscita, buffer, info)
                byteNelPezzo += letti
                estrattore.advance()
            }
            muxer?.stop()
            return pezzi
        } finally {
            try {
                muxer?.release()
            } catch (_: Exception) {
            }
            estrattore.release()
        }
    }
}
