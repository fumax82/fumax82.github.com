package com.ric.navigatore.nucleo.servizi

import java.io.IOException
import java.net.HttpURLConnection
import java.net.URI

/** Una richiesta web. */
data class RichiestaHttp(
    val metodo: String,
    val url: String,
    val intestazioni: Map<String, String> = emptyMap(),
    val corpo: String? = null,
)

/** La risposta del server. */
data class RispostaHttp(
    val codice: Int,
    val corpo: String,
    val intestazioni: Map<String, String> = emptyMap(),
)

/**
 * Chi esegue le richieste web. Nell'app è [ClientHttpJava]; nelle prove
 * automatiche usiamo un finto client che risponde con dati preparati.
 */
fun interface ClientHttp {
    /** @throws IOException se la rete non è disponibile. */
    fun esegui(richiesta: RichiestaHttp): RispostaHttp
}

/** Client basato su HttpURLConnection: funziona sia su Android sia su PC. */
class ClientHttpJava(
    private val agenteUtente: String,
    private val timeoutMs: Int = 20_000,
) : ClientHttp {
    override fun esegui(richiesta: RichiestaHttp): RispostaHttp {
        val conn = URI(richiesta.url).toURL().openConnection() as HttpURLConnection
        try {
            conn.requestMethod = richiesta.metodo
            conn.connectTimeout = timeoutMs
            conn.readTimeout = timeoutMs
            // Molti servizi (es. Nominatim) chiedono di identificare l'app
            conn.setRequestProperty("User-Agent", agenteUtente)
            richiesta.intestazioni.forEach { (k, v) -> conn.setRequestProperty(k, v) }
            if (richiesta.corpo != null) {
                conn.doOutput = true
                conn.outputStream.use { it.write(richiesta.corpo.toByteArray(Charsets.UTF_8)) }
            }
            val codice = conn.responseCode
            val flusso = if (codice >= 400) conn.errorStream else conn.inputStream
            val testo = flusso?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
            val intestazioni = conn.headerFields
                .filterKeys { it != null }
                .mapKeys { it.key.lowercase() }
                .mapValues { it.value.joinToString(",") }
            return RispostaHttp(codice, testo, intestazioni)
        } finally {
            conn.disconnect()
        }
    }
}
