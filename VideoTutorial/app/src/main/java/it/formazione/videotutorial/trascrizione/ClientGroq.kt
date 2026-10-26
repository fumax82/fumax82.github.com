/*
 * ClientGroq.kt
 * Comunicazione con il servizio di trascrizione Groq (modelli Whisper).
 * L'app spedisce un pezzo di audio e riceve le frasi riconosciute, ognuna
 * con il tempo di inizio e di fine.
 *
 * Indirizzo del servizio: https://api.groq.com/openai/v1/audio/transcriptions
 * Serve una chiave API personale, creata su console.groq.com.
 */
package it.formazione.videotutorial.trascrizione

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/** Modelli di trascrizione disponibili su Groq. */
enum class ModelloTrascrizione(val codice: String, val descrizione: String) {
    LARGE_V3("whisper-large-v3", "Whisper large-v3 · il più preciso"),
    LARGE_V3_TURBO("whisper-large-v3-turbo", "Whisper large-v3 turbo · più veloce ed economico");

    companion object {
        fun daCodice(codice: String) = entries.firstOrNull { it.codice == codice } ?: LARGE_V3
    }
}

/** Una frase riconosciuta da Whisper (tempi in secondi dall'inizio del pezzo). */
@Serializable
data class Segmento(
    val start: Double = 0.0,
    val end: Double = 0.0,
    val text: String = "",
    /** Probabilità che nel segmento non si parli (alta = probabile silenzio). */
    @SerialName("no_speech_prob") val probabilitaSilenzio: Double = 0.0,
    /** Fiducia media del riconoscimento (molto negativa = poco affidabile). */
    @SerialName("avg_logprob") val fiduciaMedia: Double = 0.0,
)

/** Errore restituito dal servizio (es. 401 chiave errata, 429 limite raggiunto). */
class ErroreGroq(val codice: Int, messaggio: String, val attesaSecondi: Long?) : Exception(messaggio)

class ClientGroq(private val chiave: String) {

    companion object {
        private const val INDIRIZZO = "https://api.groq.com/openai/v1"
        private val json = Json { ignoreUnknownKeys = true }
    }

    @Serializable
    private data class Risposta(val text: String = "", val segments: List<Segmento> = emptyList())

    /**
     * Trascrive un file audio. "suggerimento" è un breve testo con parole
     * che probabilmente compaiono (titolo, macchina...): aiuta Whisper a
     * scrivere bene i termini tecnici.
     */
    fun trascrivi(file: File, modello: String, lingua: String, suggerimento: String): List<Segmento> {
        val confine = "----VideoTutorial${System.currentTimeMillis()}"
        val connessione = (URL("$INDIRIZZO/audio/transcriptions").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            doOutput = true
            connectTimeout = 30_000
            readTimeout = 300_000
            setChunkedStreamingMode(64 * 1024)
            setRequestProperty("Authorization", "Bearer $chiave")
            setRequestProperty("Content-Type", "multipart/form-data; boundary=$confine")
        }
        try {
            connessione.outputStream.buffered().use { uscita ->
                fun campo(nome: String, valore: String) {
                    uscita.write("--$confine\r\nContent-Disposition: form-data; name=\"$nome\"\r\n\r\n$valore\r\n".toByteArray())
                }
                campo("model", modello)
                campo("language", lingua)
                campo("response_format", "verbose_json")
                campo("temperature", "0")
                if (suggerimento.isNotBlank()) campo("prompt", suggerimento)
                uscita.write(
                    ("--$confine\r\nContent-Disposition: form-data; name=\"file\"; filename=\"${file.name}\"\r\n" +
                        "Content-Type: audio/mp4\r\n\r\n").toByteArray()
                )
                file.inputStream().use { it.copyTo(uscita) }
                uscita.write("\r\n--$confine--\r\n".toByteArray())
            }
            val codice = connessione.responseCode
            if (codice != HttpURLConnection.HTTP_OK) throw errore(connessione, codice)
            val testo = connessione.inputStream.bufferedReader().use { it.readText() }
            return json.decodeFromString(Risposta.serializer(), testo).segments
        } finally {
            connessione.disconnect()
        }
    }

    /** Controlla che la chiave sia valida. Restituisce null se va bene, altrimenti il motivo. */
    fun verificaChiave(): String? {
        val connessione = (URL("$INDIRIZZO/models").openConnection() as HttpURLConnection).apply {
            connectTimeout = 15_000
            readTimeout = 15_000
            setRequestProperty("Authorization", "Bearer $chiave")
        }
        return try {
            when (val codice = connessione.responseCode) {
                HttpURLConnection.HTTP_OK -> null
                401, 403 -> "Chiave non valida"
                else -> "Risposta inattesa del servizio ($codice)"
            }
        } catch (e: Exception) {
            "Servizio non raggiungibile: controlla la connessione"
        } finally {
            connessione.disconnect()
        }
    }

    /** Costruisce l'errore leggendo il messaggio e l'eventuale attesa consigliata. */
    private fun errore(connessione: HttpURLConnection, codice: Int): ErroreGroq {
        val dettaglio = try {
            connessione.errorStream?.bufferedReader()?.use { it.readText() }?.take(300) ?: ""
        } catch (_: Exception) {
            ""
        }
        val attesa = connessione.getHeaderField("retry-after")?.toDoubleOrNull()?.toLong()
        val messaggio = when (codice) {
            401, 403 -> "chiave Groq non valida"
            413 -> "pezzo di audio troppo grande"
            429 -> "limite del piano Groq raggiunto"
            else -> "errore del servizio ($codice)"
        }
        return ErroreGroq(codice, "$messaggio $dettaglio".trim(), attesa)
    }
}
