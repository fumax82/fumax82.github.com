/*
 * FinestrePasso.kt
 * Finestre (dialoghi) del lettore:
 *   - FinestraPasso: commento e tipo di un segnalibro (nuovo o esistente),
 *     con dettatura; per una foto appena catturata la dettatura parte da sola
 *   - FinestraConfermaEliminazione: conferma prima di cancellare un segnalibro
 *   - FinestraTermina: note finali e fine del lavoro
 */
package it.formazione.videotutorial.schermate

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.ContextCompat
import it.formazione.videotutorial.archivio.NomiFile
import it.formazione.videotutorial.modello.Passo
import it.formazione.videotutorial.modello.TipoPasso
import kotlinx.coroutines.delay

/**
 * Finestra di un segnalibro: commento (scritto o dettato) e tipo.
 * - nuovo = true: foto appena catturata; la dettatura parte da sola e i
 *   pulsanti sono "Elimina foto", "Salta", "Salva".
 * - nuovo = false: modifica di un segnalibro esistente (dal fumetto);
 *   i pulsanti sono "Elimina", "Annulla", "Salva".
 */
@Composable
fun FinestraPasso(
    passo: Passo,
    numero: Int,
    nuovo: Boolean,
    onSalva: (testo: String, tipo: TipoPasso) -> Unit,
    onChiudi: () -> Unit,
    onElimina: () -> Unit,
) {
    // Testo del campo con la posizione del cursore (sempre in fondo dopo una dettatura)
    var campo by remember(passo.id) {
        mutableStateOf(TextFieldValue(passo.commento, TextRange(passo.commento.length)))
    }
    var tipo by remember(passo.id) { mutableStateOf(passo.tipo) }
    val dettatura = rememberDettatura { frase -> campo = aggiungiFrase(campo, frase) }
    val contesto = LocalContext.current
    val focus = remember { FocusRequester() }

    // Permesso del microfono: chiesto solo la prima volta
    val richiestaPermesso = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { concesso ->
        if (concesso) dettatura.avvia()
    }
    val avviaDettatura = {
        val permesso = ContextCompat.checkSelfPermission(contesto, Manifest.permission.RECORD_AUDIO)
        if (permesso == PackageManager.PERMISSION_GRANTED) {
            dettatura.avvia()
        } else {
            richiestaPermesso.launch(Manifest.permission.RECORD_AUDIO)
        }
    }

    // All'apertura: cursore nel campo; per una foto nuova parte anche la dettatura
    LaunchedEffect(passo.id) {
        delay(150) // attende che la finestra sia sullo schermo
        try {
            focus.requestFocus()
        } catch (_: IllegalStateException) {
        }
        if (nuovo) avviaDettatura()
    }

    // Testo da salvare, comprese le parole dette ma non ancora confermate
    val testoFinale = { aggiungiFrase(campo, dettatura.prendiParziale()).text }

    AlertDialog(
        onDismissRequest = onChiudi,
        properties = DialogProperties(dismissOnClickOutside = false),
        title = {
            Column {
                Text(
                    if (nuovo) "Nuova foto ${NomiFile.codicePasso(numero)}" else "Segnalibro ${NomiFile.codicePasso(numero)}",
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    "al tempo ${NomiFile.tempoFoto(passo.tempoMs)}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                // Scelta del tipo (due righe da due)
                TipoPasso.entries.chunked(2).forEach { riga ->
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        riga.forEach { t ->
                            SceltaTipo(t, selezionato = t == tipo, modifier = Modifier.weight(1f)) { tipo = t }
                        }
                    }
                }
                OutlinedTextField(
                    value = campo,
                    onValueChange = { campo = it },
                    label = { Text("Commento") },
                    placeholder = { Text("Cosa si vede, cosa fare, a cosa stare attenti…") },
                    minLines = 3,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 4.dp)
                        .focusRequester(focus),
                )
                // Stato della dettatura e tasto Ferma / Detta
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = if (dettatura.inAscolto) {
                            "🎤 In ascolto… ${dettatura.testoParziale}"
                        } else {
                            dettatura.avviso ?: "Tocca \"Detta\" per aggiungere a voce."
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = if (dettatura.inAscolto) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.weight(1f),
                    )
                    if (dettatura.inAscolto) {
                        TextButton(onClick = { dettatura.ferma() }) { Text("■ Ferma") }
                    } else {
                        TextButton(onClick = avviaDettatura) { Text("🎤 Detta") }
                    }
                }
            }
        },
        // "Elimina" a sinistra, "Salta/Annulla" e "Salva" a destra
        // (su schermi stretti Android li dispone su due righe)
        dismissButton = {
            TextButton(onClick = onElimina) {
                Text(if (nuovo) "Elimina foto" else "Elimina", color = MaterialTheme.colorScheme.error)
            }
        },
        confirmButton = {
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                TextButton(onClick = onChiudi) { Text(if (nuovo) "Salta" else "Annulla") }
                Button(onClick = { onSalva(testoFinale(), tipo) }) { Text("Salva") }
            }
        },
    )
}

/** Pulsantino per scegliere il tipo del segnalibro. */
@Composable
private fun SceltaTipo(tipo: TipoPasso, selezionato: Boolean, modifier: Modifier, onClick: () -> Unit) {
    val colore = Color(tipo.colore)
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(50),
        color = if (selezionato) colore else MaterialTheme.colorScheme.surfaceVariant,
        contentColor = if (selezionato) Color.White else MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = modifier,
    ) {
        Text(
            "${tipo.simbolo} ${tipo.etichetta}",
            style = MaterialTheme.typography.labelMedium,
            fontWeight = if (selezionato) FontWeight.Bold else FontWeight.Normal,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 8.dp),
        )
    }
}

/** Aggiunge una frase dettata in fondo al testo e mette il cursore alla fine. */
private fun aggiungiFrase(campo: TextFieldValue, frase: String): TextFieldValue {
    if (frase.isBlank()) return campo
    val base = campo.text.trimEnd()
    val nuovo = if (base.isEmpty()) frase.trim().replaceFirstChar { it.titlecase() } else "$base ${frase.trim()}"
    return TextFieldValue(nuovo, TextRange(nuovo.length))
}

/** Chiede conferma prima di eliminare un segnalibro. */
@Composable
fun FinestraConfermaEliminazione(numero: Int, onConferma: () -> Unit, onAnnulla: () -> Unit) {
    AlertDialog(
        onDismissRequest = onAnnulla,
        title = { Text("Eliminare il segnalibro ${NomiFile.codicePasso(numero)}?") },
        text = { Text("La foto e il commento verranno cancellati e gli altri segnalibri rinumerati.") },
        confirmButton = {
            Button(
                onClick = onConferma,
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
            ) { Text("Elimina") }
        },
        dismissButton = { TextButton(onClick = onAnnulla) { Text("Annulla") } },
    )
}

/** Finestra di fine lavoro con le note finali dell'autore. */
@Composable
fun FinestraTermina(
    noteIniziali: String,
    audioInLavorazione: Boolean,
    onTermina: (String) -> Unit,
    onAnnulla: () -> Unit,
) {
    var note by remember { mutableStateOf(noteIniziali) }
    AlertDialog(
        onDismissRequest = onAnnulla,
        properties = DialogProperties(dismissOnClickOutside = false),
        title = { Text("Termina il lavoro") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "Aggiungi le informazioni che nel video non compaiono: tempi, attrezzi, avvertenze generali.",
                    style = MaterialTheme.typography.bodyMedium,
                )
                OutlinedTextField(
                    value = note,
                    onValueChange = { note = it },
                    label = { Text("Note finali") },
                    minLines = 4,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                    modifier = Modifier.fillMaxWidth(),
                )
                if (audioInLavorazione) {
                    Text(
                        "L'audio è ancora in estrazione: la cartella diventerà COMPLETA appena finisce.",
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
        },
        confirmButton = { Button(onClick = { onTermina(note) }) { Text("Termina") } },
        dismissButton = { TextButton(onClick = onAnnulla) { Text("Annulla") } },
    )
}
