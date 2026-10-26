/*
 * LavoroTrascrizione.kt
 * Lavoro in sottofondo (WorkManager) che trascrive il parlato del video con
 * il servizio Groq e lo salva nel progetto:
 *   1. copia _archivio/audio_completo.m4a nella memoria temporanea;
 *   2. lo divide in pezzi (massimo 10 minuti e 20 MB ciascuno);
 *   3. spedisce i pezzi a Groq uno alla volta;
 *   4. ripulisce le frasi e le salva nel progetto (righe PARLATO di
 *      tutorial_input.md) e in _archivio/trascrizione.srt.
 *
 * Parte solo con internet attivo. Se si supera il limite del piano gratuito
 * aspetta e riprova; i pezzi già trascritti non vengono rispediti.
 */
package it.formazione.videotutorial.trascrizione

import android.content.Context
import android.net.Uri
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import it.formazione.videotutorial.archivio.CartellaFormazione
import it.formazione.videotutorial.archivio.NomiFile
import it.formazione.videotutorial.archivio.Preferenze
import it.formazione.videotutorial.media.DivisoreAudio
import it.formazione.videotutorial.modello.FraseParlato
import it.formazione.videotutorial.modello.SchedaVideo
import it.formazione.videotutorial.modello.StatoTrascrizione
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import java.io.File
import java.io.IOException
import java.util.Locale
import java.util.concurrent.TimeUnit

class LavoroTrascrizione(
    context: Context,
    parametri: WorkerParameters,
) : CoroutineWorker(context, parametri) {

    companion object {
        private const val CHIAVE_URI_RADICE = "uri_radice"
        private const val CHIAVE_CARTELLA = "cartella"

        /** Risultato: nome di uno StatoTrascrizione. */
        const val CHIAVE_STATO = "stato"

        /** Avanzamento: pezzi già trascritti e pezzi totali. */
        const val PEZZI_FATTI = "pezzi_fatti"
        const val PEZZI_TOTALI = "pezzi_totali"

        /** Tentativi massimi in caso di rete assente o limite raggiunto. */
        private const val TENTATIVI_MASSIMI = 10

        /** Attesa massima "sul posto" quando Groq chiede di aspettare (oltre: si riprova più tardi). */
        private const val ATTESA_MASSIMA_SECONDI = 120L

        private val json = Json { ignoreUnknownKeys = true }

        /** Nome unico del lavoro per un video. */
        fun nomeLavoro(impronta: String) = "trascrizione_$impronta"

        /** Avvia la trascrizione (se è già in corso per questo video non fa nulla). */
        fun avvia(context: Context, uriRadice: Uri, nomeCartella: String, impronta: String) {
            val richiesta = OneTimeWorkRequestBuilder<LavoroTrascrizione>()
                .setInputData(workDataOf(CHIAVE_URI_RADICE to uriRadice.toString(), CHIAVE_CARTELLA to nomeCartella))
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
                .build()
            WorkManager.getInstance(context)
                .enqueueUniqueWork(nomeLavoro(impronta), ExistingWorkPolicy.KEEP, richiesta)
        }

        /** Suggerimento per Whisper: parole della scheda che probabilmente si sentono nel video. */
        fun suggerimento(scheda: SchedaVideo): String =
            listOf(scheda.titolo, scheda.macchina, scheda.reparto, scheda.scopo)
                .filter { it.isNotBlank() }
                .joinToString(". ")
                .take(600)
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val uriRadice = inputData.getString(CHIAVE_URI_RADICE)?.let(Uri::parse)
        val nomeCartella = inputData.getString(CHIAVE_CARTELLA)
        if (uriRadice == null || nomeCartella == null) return@withContext fine(StatoTrascrizione.ERRORE)

        val preferenze = Preferenze(applicationContext)
        val cartella = CartellaFormazione(applicationContext, uriRadice)
        val chiave = preferenze.chiaveGroq
        if (chiave.isBlank()) {
            cartella.aggiornaTrascrizione(nomeCartella, StatoTrascrizione.NON_CONFIGURATA)
            return@withContext fine(StatoTrascrizione.NON_CONFIGURATA)
        }

        val progetto = cartella.leggiProgettoDaDisco(nomeCartella)
            ?: return@withContext fine(StatoTrascrizione.ERRORE)
        cartella.aggiornaTrascrizione(nomeCartella, StatoTrascrizione.IN_CORSO)

        // Cartella di lavoro temporanea (resta tra un tentativo e l'altro)
        val lavoro = File(applicationContext.cacheDir, "trascrizione/${NomiFile.pulisci(nomeCartella, 80)}")
        lavoro.mkdirs()

        try {
            // 1. Audio dall'archivio
            val audio = File(lavoro, "audio.m4a")
            if (!audio.exists() || audio.length() == 0L) {
                if (!cartella.copiaDaArchivio(nomeCartella, CartellaFormazione.FILE_AUDIO, audio)) {
                    cartella.aggiornaTrascrizione(nomeCartella, StatoTrascrizione.NON_POSSIBILE)
                    return@withContext fine(StatoTrascrizione.NON_POSSIBILE)
                }
            }

            // 2. Pezzi
            val pezzi = DivisoreAudio.dividi(audio, File(lavoro, "pezzi"))
            if (pezzi.isEmpty()) {
                cartella.aggiornaTrascrizione(nomeCartella, StatoTrascrizione.NON_POSSIBILE)
                return@withContext fine(StatoTrascrizione.NON_POSSIBILE)
            }

            // 3. Trascrizione dei pezzi (quelli già fatti restano salvati in pezzo_N.json)
            val client = ClientGroq(chiave)
            val modello = preferenze.modelloTrascrizione
            val lingua = Locale.getDefault().language.ifBlank { "it" }
            val testoSuggerito = suggerimento(progetto.scheda)
            val frasi = mutableListOf<FraseParlato>()
            pezzi.forEachIndexed { indice, pezzo ->
                setProgress(workDataOf(PEZZI_FATTI to indice, PEZZI_TOTALI to pezzi.size))
                val memoria = File(lavoro, "pezzo_$indice.json")
                val segmenti = if (memoria.exists()) {
                    json.decodeFromString(ListSerializer(Segmento.serializer()), memoria.readText())
                } else {
                    trascriviConAttesa(client, pezzo.file, modello, lingua, testoSuggerito).also {
                        memoria.writeText(json.encodeToString(ListSerializer(Segmento.serializer()), it))
                    }
                }
                frasi += PuliziaParlato.frasi(segmenti, pezzo.inizioMs)
            }
            setProgress(workDataOf(PEZZI_FATTI to pezzi.size, PEZZI_TOTALI to pezzi.size))

            // 4. Salvataggio
            cartella.scriviInArchivio(nomeCartella, CartellaFormazione.FILE_TRASCRIZIONE, PuliziaParlato.srt(frasi))
            cartella.aggiornaTrascrizione(nomeCartella, StatoTrascrizione.COMPLETATA, frasi)
            lavoro.deleteRecursively()
            fine(StatoTrascrizione.COMPLETATA)
        } catch (e: ErroreGroq) {
            val riprovabile = e.codice == 429 || e.codice >= 500
            if (riprovabile && runAttemptCount < TENTATIVI_MASSIMI) {
                Result.retry() // WorkManager riprova più tardi (attese sempre più lunghe)
            } else {
                cartella.aggiornaTrascrizione(nomeCartella, StatoTrascrizione.ERRORE)
                if (!riprovabile) lavoro.deleteRecursively()
                fine(StatoTrascrizione.ERRORE, e.message)
            }
        } catch (e: IOException) {
            // Rete caduta o simili: si riprova più tardi
            if (runAttemptCount < TENTATIVI_MASSIMI) {
                Result.retry()
            } else {
                cartella.aggiornaTrascrizione(nomeCartella, StatoTrascrizione.ERRORE)
                fine(StatoTrascrizione.ERRORE, e.message)
            }
        } catch (e: Exception) {
            cartella.aggiornaTrascrizione(nomeCartella, StatoTrascrizione.ERRORE)
            fine(StatoTrascrizione.ERRORE, e.message)
        }
    }

    /**
     * Trascrive un pezzo. Se Groq chiede di aspettare poco (limite al minuto),
     * aspetta e riprova; se chiede di aspettare tanto rilancia l'errore.
     */
    private suspend fun trascriviConAttesa(
        client: ClientGroq,
        file: File,
        modello: String,
        lingua: String,
        suggerimento: String,
    ): List<Segmento> {
        repeat(3) {
            try {
                return client.trascrivi(file, modello, lingua, suggerimento)
            } catch (e: ErroreGroq) {
                val attesa = e.attesaSecondi
                if (e.codice != 429 || attesa == null || attesa > ATTESA_MASSIMA_SECONDI) throw e
                delay((attesa + 1) * 1000)
            }
        }
        return client.trascrivi(file, modello, lingua, suggerimento)
    }

    /** Risultato del lavoro con lo stato finale (e l'eventuale messaggio d'errore). */
    private fun fine(stato: StatoTrascrizione, messaggio: String? = null): Result =
        Result.success(workDataOf(CHIAVE_STATO to stato.name, "messaggio" to (messaggio ?: "")))
}
