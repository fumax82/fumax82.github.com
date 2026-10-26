/*
 * SchermataHome.kt
 * Prima schermata: scelta della cartella condivisa "Formazione" (una volta
 * sola) e pulsante per aprire un video.
 */
package it.formazione.videotutorial.schermate

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

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

    Column(
        modifier = Modifier
            .fillMaxSize()
            .safeDrawingPadding()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(24.dp))
        Text("Video per tutorial", style = MaterialTheme.typography.headlineMedium)
        Text(
            "Cattura i passi di un video e prepara la cartella da cui Claude scriverà il tutorial.",
            style = MaterialTheme.typography.bodyMedium,
        )

        // --- Cartella condivisa ---
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Cartella condivisa", style = MaterialTheme.typography.titleMedium)
                Text(
                    cartella?.nome ?: "Non ancora scelta",
                    style = MaterialTheme.typography.bodyLarge,
                    color = if (cartella == null) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface,
                )
                OutlinedButton(onClick = { sceltaCartella.launch(null) }, enabled = !vm.occupato) {
                    Text(if (cartella == null) "Scegli la cartella" else "Cambia cartella")
                }
            }
        }

        // --- Apertura del video ---
        Button(
            onClick = { sceltaVideo.launch(arrayOf("video/*")) },
            enabled = cartella != null && !vm.occupato,
            modifier = Modifier
                .fillMaxWidth()
                .height(64.dp),
        ) {
            Text("Apri un video", style = MaterialTheme.typography.titleMedium)
        }

        if (vm.occupato) {
            CircularProgressIndicator()
            Text("Analisi del video in corso…")
        }

        if (cartella == null) {
            Text(
                "Prima scegli la cartella \"Formazione\" (ad esempio una cartella sincronizzata " +
                    "con Google Drive o OneDrive): l'app la ricorderà.",
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}
