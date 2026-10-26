/*
 * FumettoSegnalibro.kt
 * Piccolo fumetto che compare sopra la striscia di anteprime quando il video
 * si trova su un segnalibro (per esempio dopo aver premuto ◀ o ▶).
 * Mostra numero, tipo, tempo e commento; la punta indica la linea bianca
 * della striscia.
 *
 * - Toccando il fumetto si apre la modifica (commento, tipo, elimina).
 * - "Sposta" permette di spostare il segnalibro con precisione.
 * - "Elimina" lo cancella (dopo conferma).
 */
package it.formazione.videotutorial.schermate

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import it.formazione.videotutorial.archivio.NomiFile
import it.formazione.videotutorial.modello.Passo

@Composable
fun FumettoSegnalibro(
    passo: Passo,
    numero: Int,
    onModifica: () -> Unit,
    onSposta: () -> Unit,
    onElimina: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val coloreTipo = Color(passo.tipo.colore)
    Column(modifier = modifier.widthIn(max = 420.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Surface(
            shape = RoundedCornerShape(14.dp),
            color = MaterialTheme.colorScheme.surface,
            shadowElevation = 6.dp,
            modifier = Modifier.clickable(onClick = onModifica),
        ) {
            Row(Modifier.height(IntrinsicSize.Min)) {
                // Striscia colorata del tipo
                Box(
                    Modifier
                        .width(6.dp)
                        .fillMaxHeight()
                        .background(coloreTipo)
                )
                Column(Modifier.padding(start = 12.dp, end = 4.dp, top = 8.dp, bottom = 2.dp)) {
                    // Intestazione: P03 · ⚠️ SICUREZZA · 01:23.4
                    Text(
                        "${NomiFile.codicePasso(numero)} · ${passo.tipo.simbolo} ${passo.tipo.testoPerClaude} · " +
                            NomiFile.tempoFoto(passo.tempoMs),
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    // Commento (oppure invito a scriverlo)
                    if (passo.commento.isNotBlank()) {
                        Text(
                            passo.commento,
                            style = MaterialTheme.typography.bodyMedium,
                            maxLines = 3,
                            overflow = TextOverflow.Ellipsis,
                        )
                    } else {
                        Text(
                            "Nessun commento: tocca per scriverlo",
                            style = MaterialTheme.typography.bodyMedium,
                            fontStyle = FontStyle.Italic,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    // Azioni
                    Row(horizontalArrangement = Arrangement.spacedBy(0.dp), verticalAlignment = Alignment.CenterVertically) {
                        TextButton(onClick = onModifica) { Text("✎ Modifica") }
                        TextButton(onClick = onSposta) { Text("↔ Sposta") }
                        TextButton(onClick = onElimina) {
                            Text("🗑 Elimina", color = MaterialTheme.colorScheme.error)
                        }
                    }
                }
            }
        }
        // Punta del fumetto (verso la linea bianca della striscia)
        val coloreFumetto = MaterialTheme.colorScheme.surface
        Canvas(Modifier.size(width = 20.dp, height = 9.dp)) {
            val punta = Path().apply {
                moveTo(0f, 0f)
                lineTo(size.width, 0f)
                lineTo(size.width / 2, size.height)
                close()
            }
            drawPath(punta, coloreFumetto)
        }
        Spacer(Modifier.height(2.dp))
    }
}
