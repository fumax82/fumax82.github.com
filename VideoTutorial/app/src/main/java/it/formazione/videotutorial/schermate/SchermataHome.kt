/*
 * SchermataHome.kt
 * Prima schermata:
 *   - intestazione dell'app
 *   - cartella condivisa "Formazione" (scelta una volta sola)
 *   - pulsante "Nuovo video"
 *   - elenco dei progetti già creati: toccandone uno si riapre e si possono
 *     modificare i suoi segnalibri.
 */
package it.formazione.videotutorial.schermate

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import it.formazione.videotutorial.modello.ProgettoVideo

@Composable
fun SchermataHome(vm: ProgettoViewModel) {
    // Finestre di sistema per scegliere cartella e video
    val sceltaCartella = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri ->
        vm.cartellaScelta(uri)
    }
    val sceltaVideo = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        vm.videoSelezionato(uri)
    }
    val cartella = vm.cartella

    // Elenco dei progetti: si ricarica ogni volta che si torna alla Home o si cambia cartella
    LaunchedEffect(cartella) { vm.caricaProgetti() }

    // Video di un progetto non più raggiungibile: si fa scegliere di nuovo
    LaunchedEffect(vm.richiestaSceltaVideo) {
        if (vm.richiestaSceltaVideo) {
            vm.sceltaVideoAvviata()
            sceltaVideo.launch(arrayOf("video/*"))
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .safeDrawingPadding(),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        // --- Intestazione ---
        item { Intestazione() }

        // --- Cartella condivisa ---
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("📁", style = MaterialTheme.typography.headlineSmall)
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text("Cartella condivisa", style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(
                            cartella?.nome ?: "Non ancora scelta",
                            style = MaterialTheme.typography.titleMedium,
                            color = if (cartella == null) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    TextButton(onClick = { sceltaCartella.launch(null) }, enabled = !vm.occupato) {
                        Text(if (cartella == null) "Scegli" else "Cambia")
                    }
                }
            }
        }

        // --- Nuovo video ---
        item {
            Button(
                onClick = { sceltaVideo.launch(arrayOf("video/*")) },
                enabled = cartella != null && !vm.occupato,
                shape = MaterialTheme.shapes.medium,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(60.dp),
            ) {
                Text("＋  Nuovo video", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            }
        }

        if (vm.occupato) {
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.width(12.dp))
                    Text("Apertura del video in corso…")
                }
            }
        }

        // Foto dell'ultimo video ancora in salvataggio: meglio non chiudere l'app
        if (vm.fotoInSalvataggio > 0) {
            item {
                Text(
                    "Salvataggio di ${vm.fotoInSalvataggio} foto in corso: non chiudere l'app.",
                    color = MaterialTheme.colorScheme.error,
                )
            }
        }

        if (cartella == null) {
            item {
                Text(
                    "Prima scegli la cartella \"Formazione\" (ad esempio una cartella sincronizzata " +
                        "con Google Drive o OneDrive): l'app la ricorderà.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            // --- Elenco dei progetti ---
            item {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 8.dp)) {
                    Text(
                        "Progetti (${vm.progettiSalvati.size})",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f),
                    )
                    if (vm.caricamentoProgetti) {
                        CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                    } else {
                        TextButton(onClick = { vm.caricaProgetti() }) { Text("↻ Aggiorna") }
                    }
                }
            }
            if (vm.progettiSalvati.isEmpty() && !vm.caricamentoProgetti) {
                item {
                    Text(
                        "Nessun progetto ancora. Premi \"Nuovo video\" per iniziare.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            items(vm.progettiSalvati, key = { it.nomeCartella }) { progetto ->
                SchedaProgetto(
                    progetto = progetto,
                    vm = vm,
                    attiva = !vm.occupato,
                    onApri = { vm.riapriProgetto(progetto) },
                )
            }
        }
    }
}

/** Intestazione con il simbolo e il nome dell'app. */
@Composable
private fun Intestazione() {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 8.dp)) {
        Box(
            modifier = Modifier
                .size(52.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.primary),
            contentAlignment = Alignment.Center,
        ) {
            Text("🎬", style = MaterialTheme.typography.headlineSmall)
        }
        Spacer(Modifier.width(14.dp))
        Column {
            Text("Video Tutorial", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Text(
                "Cattura i passi dei video per creare i tutorial",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/** Scheda di un progetto nell'elenco: miniatura, titolo, dati e stato. */
@Composable
private fun SchedaProgetto(progetto: ProgettoVideo, vm: ProgettoViewModel, attiva: Boolean, onApri: () -> Unit) {
    // Miniatura della prima foto, caricata in sottofondo
    val anteprima by produceState<ImageBitmap?>(null, progetto.nomeCartella, progetto.passi.firstOrNull()?.nomeFile) {
        value = vm.anteprimaProgetto(progetto)
    }
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = attiva, onClick = onApri),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Row(Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(width = 96.dp, height = 64.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant),
                contentAlignment = Alignment.Center,
            ) {
                val immagine = anteprima
                if (immagine != null) {
                    Image(immagine, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                } else {
                    Text("🎞", style = MaterialTheme.typography.titleLarge)
                }
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    progetto.scheda.titolo,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    listOf(progetto.scheda.data, progetto.scheda.macchina, progetto.scheda.reparto)
                        .filter { it.isNotBlank() }.joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(top = 4.dp)) {
                    Etichetta("📷 ${progetto.passi.size}", MaterialTheme.colorScheme.surfaceVariant, MaterialTheme.colorScheme.onSurfaceVariant)
                    if (progetto.completo) {
                        Etichetta("COMPLETO", Color(0xFF2E7D32), Color.White)
                    } else {
                        Etichetta("IN CORSO", Color(0xFFEF6C00), Color.White)
                    }
                }
            }
            Text("›", style = MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.outline)
        }
    }
}

/** Piccola etichetta colorata (es. "COMPLETO"). */
@Composable
fun Etichetta(testo: String, sfondo: Color, colore: Color) {
    Surface(color = sfondo, shape = RoundedCornerShape(50)) {
        Text(
            testo,
            color = colore,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
        )
    }
}
