/*
 * Dettatura.kt
 * Riconoscimento vocale integrato nell'app (SpeechRecognizer di Android):
 * trasforma in testo quello che si dice, senza dover toccare il microfono
 * della tastiera. Usato nella finestra del commento, che avvia la dettatura
 * appena si apre.
 *
 * Funzionamento:
 * - avvia(): l'app si mette in ascolto (si sente il segnale di Android);
 * - mentre si parla, "testoParziale" mostra le parole riconosciute;
 * - dopo una pausa il riconoscimento finisce e la frase viene passata a
 *   "suFrase" (che la aggiunge al commento);
 * - per continuare a dettare basta chiamare di nuovo avvia().
 *
 * Serve il permesso del microfono (RECORD_AUDIO), chiesto una sola volta.
 */
package it.formazione.videotutorial.schermate

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import java.util.Locale

class Dettatura(private val context: Context, private val suFrase: (String) -> Unit) {

    companion object {
        /** Silenzio (ms) dopo cui la frase si considera finita (non tutti i telefoni lo rispettano). */
        const val SILENZIO_FINE_FRASE_MS = 4000L
    }

    /** true mentre l'app sta ascoltando. */
    var inAscolto by mutableStateOf(false)
        private set

    /** Parole riconosciute finora nella frase in corso (anteprima). */
    var testoParziale by mutableStateOf("")
        private set

    /** Breve avviso da mostrare sotto il campo (es. "Non ho sentito nulla"). */
    var avviso by mutableStateOf<String?>(null)
        private set

    /** true se il telefono ha un servizio di riconoscimento vocale. */
    val disponibile: Boolean = SpeechRecognizer.isRecognitionAvailable(context)

    private var riconoscitore: SpeechRecognizer? = null

    /** Si mette in ascolto. */
    fun avvia() {
        if (!disponibile) {
            avviso = "Dettatura non disponibile su questo telefono: usa il microfono della tastiera."
            return
        }
        val r = riconoscitore ?: SpeechRecognizer.createSpeechRecognizer(context).also {
            it.setRecognitionListener(ascoltatore)
            riconoscitore = it
        }
        r.cancel()
        avviso = null
        testoParziale = ""
        val richiesta = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().toLanguageTag())
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, SILENZIO_FINE_FRASE_MS)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, SILENZIO_FINE_FRASE_MS)
        }
        inAscolto = true
        r.startListening(richiesta)
    }

    /** Smette di ascoltare; quello che è già stato detto viene comunque elaborato. */
    fun ferma() {
        riconoscitore?.stopListening()
    }

    /**
     * Testo ancora "in sospeso" (detto ma non ancora confermato): serve se si
     * preme Salva mentre si sta ancora parlando.
     */
    fun prendiParziale(): String {
        val parziale = testoParziale
        testoParziale = ""
        return parziale
    }

    /** Libera il microfono (da chiamare quando la finestra si chiude). */
    fun rilascia() {
        riconoscitore?.destroy()
        riconoscitore = null
        inAscolto = false
    }

    /** Riceve gli eventi del riconoscimento vocale. */
    private val ascoltatore = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {}
        override fun onBeginningOfSpeech() {}
        override fun onRmsChanged(rmsdB: Float) {}
        override fun onBufferReceived(buffer: ByteArray?) {}
        override fun onEndOfSpeech() {}
        override fun onEvent(eventType: Int, params: Bundle?) {}

        override fun onPartialResults(partialResults: Bundle?) {
            primoRisultato(partialResults)?.let { testoParziale = it }
        }

        override fun onResults(results: Bundle?) {
            inAscolto = false
            val frase = primoRisultato(results) ?: testoParziale
            testoParziale = ""
            if (frase.isNotBlank()) suFrase(frase)
        }

        override fun onError(error: Int) {
            inAscolto = false
            // Se qualcosa era già stato riconosciuto, non va perso
            val parziale = prendiParziale()
            if (parziale.isNotBlank()) suFrase(parziale)
            avviso = when (error) {
                SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT ->
                    "Non ho sentito nulla: tocca \"Detta\" per riprovare."
                SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS ->
                    "Manca il permesso del microfono."
                SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT ->
                    "Dettatura non riuscita: controlla la connessione."
                SpeechRecognizer.ERROR_CLIENT -> null // ascolto interrotto dall'app: nessun avviso
                else -> "Dettatura interrotta (errore $error): tocca \"Detta\" per riprovare."
            }
        }
    }

    private fun primoRisultato(risultati: Bundle?): String? =
        risultati?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.takeIf { it.isNotBlank() }
}

/**
 * Crea una Dettatura legata alla finestra: viene liberata automaticamente
 * quando la finestra si chiude.
 */
@Composable
fun rememberDettatura(suFrase: (String) -> Unit): Dettatura {
    val contesto = LocalContext.current
    val callbackAttuale by rememberUpdatedState(suFrase)
    val dettatura = remember { Dettatura(contesto) { frase -> callbackAttuale(frase) } }
    DisposableEffect(dettatura) {
        onDispose { dettatura.rilascia() }
    }
    return dettatura
}
