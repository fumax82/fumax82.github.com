/*
 * NomiFile.kt
 * Regole per i nomi di cartelle e foto e per scrivere i tempi in modo leggibile.
 *
 * Esempi:
 *   nomeCartella("2026-10-26", "Montaggio pompa P200") -> "2026-10-26_Montaggio_pompa_P200"
 *   nomeFoto(1, 83_400, OPERAZIONE)                     -> "P01_00h01m23s4.jpg"
 *   tempoFoto(83_400)                                   -> "01:23.4"
 */
package it.formazione.videotutorial.archivio

import it.formazione.videotutorial.modello.TipoPasso
import java.text.Normalizer
import java.util.Locale

object NomiFile {

    /** Lunghezza massima della parte "pulita" di un nome. */
    const val LUNGHEZZA_MASSIMA = 60

    /**
     * Rende un testo adatto a nome di file: toglie gli accenti (è -> e),
     * trasforma spazi e simboli in "_" e taglia a 60 caratteri.
     */
    fun pulisci(testo: String, massimo: Int = LUNGHEZZA_MASSIMA): String {
        val senzaAccenti = Normalizer.normalize(testo, Normalizer.Form.NFD)
            .replace(Regex("\\p{Mn}+"), "")
        val pulito = senzaAccenti
            .replace(Regex("[^A-Za-z0-9-]"), "_")
            .replace(Regex("_+"), "_")
            .trim('_')
            .take(massimo)
            .trimEnd('_')
        return pulito.ifEmpty { "video" }
    }

    /** Nome della sottocartella di un video: AAAA-MM-GG_titolo. */
    fun nomeCartella(data: String, titolo: String): String = "${data}_${pulisci(titolo)}"

    /** Nome della foto: P01_00h01m23s4.jpg (con "_dettaglio" per il tipo Dettaglio). */
    fun nomeFoto(numero: Int, tempoMs: Long, tipo: TipoPasso): String {
        val decimi = tempoMs / 100
        val ore = decimi / 36_000
        val minuti = (decimi / 600) % 60
        val secondi = (decimi / 10) % 60
        val decimo = decimi % 10
        return String.format(
            Locale.ROOT, "P%02d_%02dh%02dm%02ds%d%s.jpg",
            numero, ore, minuti, secondi, decimo, tipo.suffissoFile,
        )
    }

    /** Codice del passo: P01, P02... */
    fun codicePasso(numero: Int): String = String.format(Locale.ROOT, "P%02d", numero)

    /** Tempo al decimo di secondo: "01:23.4" oppure "1:01:23.4" oltre l'ora. */
    fun tempoFoto(ms: Long): String {
        val decimi = ms.coerceAtLeast(0) / 100
        return "${tempoSecondi(decimi / 10)}.${decimi % 10}"
    }

    /** Tempo al secondo: "01:23" oppure "1:01:23" oltre l'ora. */
    fun tempoParlato(ms: Long): String = tempoSecondi(ms.coerceAtLeast(0) / 1000)

    private fun tempoSecondi(totaleSecondi: Long): String {
        val ore = totaleSecondi / 3600
        val minuti = (totaleSecondi / 60) % 60
        val secondi = totaleSecondi % 60
        return if (ore > 0) {
            String.format(Locale.ROOT, "%d:%02d:%02d", ore, minuti, secondi)
        } else {
            String.format(Locale.ROOT, "%02d:%02d", minuti, secondi)
        }
    }
}
