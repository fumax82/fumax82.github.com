/*
 * LavoroEstrazioneAudio.kt
 * Lavoro in sottofondo (WorkManager) che estrae l'audio completo del video e
 * lo salva in _archivio/audio_completo.m4a. Continua anche se si cambia
 * schermata; ogni video ha un solo lavoro alla volta (nome unico = impronta).
 */
package it.formazione.videotutorial.media

import android.content.Context
import android.net.Uri
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import it.formazione.videotutorial.archivio.CartellaFormazione
import it.formazione.videotutorial.modello.ProgettoVideo
import it.formazione.videotutorial.modello.StatoAudio
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

class LavoroEstrazioneAudio(
    context: Context,
    parametri: WorkerParameters,
) : CoroutineWorker(context, parametri) {

    companion object {
        private const val CHIAVE_URI_VIDEO = "uri_video"
        private const val CHIAVE_URI_RADICE = "uri_radice"
        private const val CHIAVE_CARTELLA = "cartella"

        /** Chiave del risultato: contiene il nome di uno StatoAudio. */
        const val CHIAVE_STATO = "stato"

        /** Nome unico del lavoro per un video. */
        fun nomeLavoro(impronta: String) = "audio_$impronta"

        /** Avvia l'estrazione (se è già in corso per questo video non fa nulla). */
        fun avvia(context: Context, progetto: ProgettoVideo, uriRadice: Uri) {
            val richiesta = OneTimeWorkRequestBuilder<LavoroEstrazioneAudio>()
                .setInputData(
                    workDataOf(
                        CHIAVE_URI_VIDEO to progetto.uriVideo,
                        CHIAVE_URI_RADICE to uriRadice.toString(),
                        CHIAVE_CARTELLA to progetto.nomeCartella,
                    )
                )
                .build()
            WorkManager.getInstance(context)
                .enqueueUniqueWork(nomeLavoro(progetto.impronta), ExistingWorkPolicy.KEEP, richiesta)
        }
    }

    override suspend fun doWork(): Result {
        val uriVideo = inputData.getString(CHIAVE_URI_VIDEO)?.let(Uri::parse)
        val uriRadice = inputData.getString(CHIAVE_URI_RADICE)?.let(Uri::parse)
        val nomeCartella = inputData.getString(CHIAVE_CARTELLA)
        if (uriVideo == null || uriRadice == null || nomeCartella == null) {
            return Result.success(workDataOf(CHIAVE_STATO to StatoAudio.ERRORE.name))
        }
        val cartella = CartellaFormazione(applicationContext, uriRadice)

        val stato = withContext(Dispatchers.IO) {
            try {
                estraiECopia(cartella, uriVideo, nomeCartella)
            } catch (e: Exception) {
                StatoAudio.ERRORE
            }
        }

        // Scrive lo stato anche su disco: utile se l'app nel frattempo è stata chiusa.
        try {
            cartella.aggiornaStatoAudio(nomeCartella, stato)
        } catch (_: Exception) {
        }
        return Result.success(workDataOf(CHIAVE_STATO to stato.name))
    }

    private fun estraiECopia(cartella: CartellaFormazione, uriVideo: Uri, nomeCartella: String): StatoAudio {
        // Audio già presente (es. lavoro ripetuto): niente da fare.
        if (cartella.esisteInArchivio(nomeCartella, CartellaFormazione.FILE_AUDIO)) {
            return StatoAudio.COMPLETATO
        }
        // Prima si scrive in un file temporaneo del telefono, poi si copia in _archivio.
        val temporaneo = File(applicationContext.cacheDir, "audio_$id.m4a")
        try {
            val stato = EstrattoreAudio.estrai(applicationContext, uriVideo, temporaneo) { isStopped }
            if (stato == StatoAudio.COMPLETATO) {
                cartella.copiaInArchivio(nomeCartella, CartellaFormazione.FILE_AUDIO, temporaneo)
            }
            return stato
        } finally {
            temporaneo.delete()
        }
    }
}
