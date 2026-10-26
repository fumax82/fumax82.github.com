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
 *   Parlato: non trascritto in questa versione (audio estratto)
 *
 *   ## Cronologia
 *   [01:23.4] FOTO P01 foto/P01_00h01m23s4.jpg | OPERAZIONE
 *     Commento: chiave da 13, senso antiorario
 *   ...
 */
package it.formazione.videotutorial.testo

import it.formazione.videotutorial.archivio.CartellaFormazione
import it.formazione.videotutorial.archivio.NomiFile
import it.formazione.videotutorial.modello.ProgettoVideo

object GeneratoreTutorialInput {

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
        testo.appendLine("Parlato: non trascritto in questa versione (${progetto.statoAudio.descrizione})")
        testo.appendLine()

        // --- Cronologia: foto e commenti in ordine di tempo ---
        // (dalla Fase 2 qui si aggiungeranno anche le righe PARLATO)
        testo.appendLine("## Cronologia")
        if (progetto.passi.isEmpty()) {
            testo.appendLine("Nessuna foto.")
        }
        progetto.passi.sortedBy { it.tempoMs }.forEachIndexed { indice, passo ->
            val codice = NomiFile.codicePasso(indice + 1)
            testo.appendLine(
                "[${NomiFile.tempoFoto(passo.tempoMs)}] FOTO $codice " +
                    "${CartellaFormazione.CARTELLA_FOTO}/${passo.nomeFile} | ${passo.tipo.testoPerClaude}"
            )
            if (passo.commento.isNotBlank()) {
                testo.appendLine("  Commento: ${suUnaRiga(passo.commento)}")
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
