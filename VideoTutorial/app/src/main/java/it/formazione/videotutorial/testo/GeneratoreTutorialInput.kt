/*
 * GeneratoreTutorialInput.kt
 * Crea il testo di tutorial_input.md: l'unico file che Claude legge.
 * Contiene la scheda, la cronologia (parlato, foto e commenti in ordine di
 * tempo) e le note finali. Viene riscritto a ogni modifica del progetto.
 *
 * Esempio di risultato:
 *   # Sostituzione guarnizione pompa P200
 *   Stato: IN CORSO
 *   Macchina: Pompa P200 | Reparto: Manutenzione | Autore: Ric | Data: 2026-10-26
 *   Scopo: sostituire la guarnizione del coperchio
 *   Video: pompa.mp4 | durata 10:12 | 2 foto
 *   Parlato: trascritto automaticamente (2 frasi); può contenere errori sui termini tecnici
 *
 *   ## Cronologia
 *   [01:20] PARLATO: Adesso togliamo le quattro viti del coperchio.
 *   [01:23.4] FOTO P01 foto/P01_00h01m23s4.jpg | OPERAZIONE
 *     Commento: chiave da 13, senso antiorario
 *   ...
 */
package it.formazione.videotutorial.testo

import it.formazione.videotutorial.archivio.CartellaFormazione
import it.formazione.videotutorial.archivio.NomiFile
import it.formazione.videotutorial.modello.FraseParlato
import it.formazione.videotutorial.modello.Passo
import it.formazione.videotutorial.modello.ProgettoVideo
import it.formazione.videotutorial.modello.StatoTrascrizione

object GeneratoreTutorialInput {

    /** Una riga della cronologia: una frase del parlato oppure una foto. */
    private sealed class Voce(val tempoMs: Long, val ordine: Int) {
        class Parlato(val frase: FraseParlato) : Voce(frase.inizioMs, 0)
        class Foto(val numero: Int, val passo: Passo) : Voce(passo.tempoMs, 1)
    }

    /** Restituisce il contenuto completo di tutorial_input.md. */
    fun genera(progetto: ProgettoVideo): String {
        val scheda = progetto.scheda
        val testo = StringBuilder()

        // --- Intestazione (scheda del video) ---
        testo.appendLine("# ${suUnaRiga(scheda.titolo)}")
        testo.appendLine("Stato: ${if (progetto.completo) "COMPLETO" else "IN CORSO"}")
        testo.appendLine(
            "Macchina: ${valore(scheda.macchina)} | Reparto: ${valore(scheda.reparto)} | " +
                "Autore: ${valore(scheda.autore)} | Data: ${scheda.data}"
        )
        testo.appendLine("Scopo: ${valore(scheda.scopo)}")
        testo.appendLine(
            "Video: ${progetto.nomeFileVideo} | durata ${NomiFile.tempoParlato(progetto.durataMs)} | " +
                "${progetto.passi.size} foto"
        )
        testo.appendLine(
            if (progetto.statoTrascrizione == StatoTrascrizione.COMPLETATA) {
                "Parlato: trascritto automaticamente (${progetto.parlato.size} frasi); può contenere errori sui termini tecnici"
            } else {
                "Parlato: non trascritto (${progetto.statoTrascrizione.descrizione}; ${progetto.statoAudio.descrizione})"
            }
        )
        testo.appendLine()

        // --- Cronologia: parlato, foto e commenti in ordine di tempo ---
        testo.appendLine("## Cronologia")
        val passiOrdinati = progetto.passi.sortedBy { it.tempoMs }
        if (passiOrdinati.isEmpty() && progetto.parlato.isEmpty()) {
            testo.appendLine("Nessuna foto.")
        }
        // Tutte le voci in ordine di tempo (a parità di tempo il parlato viene prima della foto)
        val voci = progetto.parlato.map { Voce.Parlato(it) } +
            passiOrdinati.mapIndexed { indice, passo -> Voce.Foto(indice + 1, passo) }
        voci.sortedWith(compareBy({ it.tempoMs }, { it.ordine })).forEach { voce ->
            when (voce) {
                is Voce.Parlato ->
                    testo.appendLine("[${NomiFile.tempoParlato(voce.tempoMs)}] PARLATO: ${suUnaRiga(voce.frase.testo)}")
                is Voce.Foto -> {
                    val passo = voce.passo
                    testo.appendLine(
                        "[${NomiFile.tempoFoto(passo.tempoMs)}] FOTO ${NomiFile.codicePasso(voce.numero)} " +
                            "${CartellaFormazione.CARTELLA_FOTO}/${passo.nomeFile} | ${passo.tipo.testoPerClaude}"
                    )
                    if (passo.commento.isNotBlank()) {
                        testo.appendLine("  Commento: ${suUnaRiga(passo.commento)}")
                    }
                }
            }
        }
        testo.appendLine()

        // --- Note finali ---
        testo.appendLine("## Note finali dell'autore")
        testo.appendLine(progetto.noteFinali.trim().ifEmpty { "Nessuna." })

        return testo.toString()
    }

    /** Mette un testo su una riga: gli "a capo" diventano "; ". */
    private fun suUnaRiga(testo: String): String =
        testo.trim().lines().map { it.trim() }.filter { it.isNotEmpty() }.joinToString("; ")

    /** Valore di un campo della scheda, oppure "-" se vuoto. */
    private fun valore(testo: String): String = suUnaRiga(testo).ifEmpty { "-" }
}
