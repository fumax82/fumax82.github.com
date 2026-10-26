/*
 * PuliziaParlato.kt
 * Ripulisce il testo trascritto e crea il file dei sottotitoli (.srt).
 *
 * Cosa toglie:
 * - esitazioni ("ehm", "uhm", "mmm"...);
 * - parole ripetute di seguito ("il il pezzo" -> "il pezzo");
 * - frasi "inventate" che Whisper a volte scrive sul silenzio
 *   (es. "Sottotitoli creati dalla comunità Amara.org");
 * - segmenti dove probabilmente nessuno parla;
 * - frasi identiche ripetute una dopo l'altra.
 * Per aggiungere parole da togliere modificare gli elenchi qui sotto.
 */
package it.formazione.videotutorial.trascrizione

import it.formazione.videotutorial.modello.FraseParlato
import java.util.Locale

object PuliziaParlato {

    /** Esitazioni da togliere (parole intere, maiuscole o minuscole). */
    private val esitazioni = Regex(
        "\\b(e+h+m+|u+h*m+|m{2,}|h?m{2,}|e{2,}h+|u{2,}h+|ehm+|uhm+|mh+)\\b[,.]?",
        RegexOption.IGNORE_CASE,
    )

    /** Parola ripetuta subito dopo (anche più volte). */
    private val ripetizioni = Regex("\\b(\\p{L}+)(\\s+\\1\\b)+", RegexOption.IGNORE_CASE)

    /** Frasi tipiche che Whisper "inventa" quando c'è silenzio o musica. */
    private val frasiInventate = listOf(
        "amara.org",
        "sottotitoli creati dalla comunità",
        "sottotitoli a cura di",
        "sottotitoli e revisione a cura di",
        "grazie per la visione",
        "grazie a tutti per la visione",
        "iscriviti al canale",
        "qtss",
    )

    /** Oltre questa probabilità di silenzio (con fiducia bassa) il segmento si scarta. */
    private const val SOGLIA_SILENZIO = 0.6
    private const val SOGLIA_FIDUCIA = -1.0

    /** Ripulisce una frase. Restituisce una stringa vuota se non resta nulla. */
    fun pulisci(testo: String): String {
        var t = testo.replace(esitazioni, " ")
        t = t.replace(ripetizioni, "$1")
        t = t.replace(Regex("\\s+"), " ")
            .replace(Regex("\\s+([,.;:!?])"), "$1")
            .replace(Regex("^[,.;:\\s]+"), "")
            .trim()
        return t.replaceFirstChar { it.titlecase(Locale.getDefault()) }
    }

    /**
     * Trasforma i segmenti di un pezzo in frasi pulite con il tempo assoluto
     * nel video ("inizioPezzoMs" = tempo da cui inizia il pezzo).
     */
    fun frasi(segmenti: List<Segmento>, inizioPezzoMs: Long): List<FraseParlato> {
        val risultato = mutableListOf<FraseParlato>()
        for (segmento in segmenti) {
            if (segmento.probabilitaSilenzio > SOGLIA_SILENZIO && segmento.fiduciaMedia < SOGLIA_FIDUCIA) continue
            val testo = pulisci(segmento.text)
            if (testo.length < 2) continue
            val minuscolo = testo.lowercase(Locale.getDefault())
            if (frasiInventate.any { minuscolo.contains(it) }) continue
            if (risultato.lastOrNull()?.testo.equals(testo, ignoreCase = true)) continue
            risultato += FraseParlato(
                inizioMs = inizioPezzoMs + (segmento.start * 1000).toLong(),
                fineMs = inizioPezzoMs + (segmento.end * 1000).toLong(),
                testo = testo,
            )
        }
        return risultato
    }

    /** Crea il contenuto del file trascrizione.srt (formato standard dei sottotitoli). */
    fun srt(frasi: List<FraseParlato>): String {
        val testo = StringBuilder()
        frasi.forEachIndexed { indice, frase ->
            testo.append(indice + 1).append('\n')
            testo.append(tempoSrt(frase.inizioMs)).append(" --> ").append(tempoSrt(frase.fineMs)).append('\n')
            testo.append(frase.testo).append("\n\n")
        }
        return testo.toString()
    }

    /** Tempo nel formato dei sottotitoli: 00:01:23,400 */
    private fun tempoSrt(ms: Long): String {
        val totale = ms.coerceAtLeast(0)
        return String.format(
            Locale.ROOT, "%02d:%02d:%02d,%03d",
            totale / 3_600_000, (totale / 60_000) % 60, (totale / 1000) % 60, totale % 1000,
        )
    }
}
