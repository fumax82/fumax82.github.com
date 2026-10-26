/*
 * SchermataScheda.kt
 * Scheda da compilare quando si apre un video nuovo: titolo della procedura
 * (obbligatorio), macchina, reparto, scopo e autore.
 * Macchina, reparto e autore sono già compilati con i valori dell'ultima volta.
 */
package it.formazione.videotutorial.schermate

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import it.formazione.videotutorial.archivio.NomiFile

@Composable
fun SchermataScheda(vm: ProgettoViewModel) {
    val video = vm.videoScelto ?: return
    val iniziale = remember { vm.schedaIniziale() }

    var titolo by rememberSaveable { mutableStateOf(iniziale.titolo) }
    var macchina by rememberSaveable { mutableStateOf(iniziale.macchina) }
    var reparto by rememberSaveable { mutableStateOf(iniziale.reparto) }
    var scopo by rememberSaveable { mutableStateOf(iniziale.scopo) }
    var autore by rememberSaveable { mutableStateOf(iniziale.autore) }

    // Tasto indietro del telefono: torna alla Home
    BackHandler { vm.tornaHome() }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .safeDrawingPadding()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Scheda del video", style = MaterialTheme.typography.headlineSmall)
        Text(
            "${video.nomeFile} · durata ${NomiFile.tempoParlato(video.durataMs)}",
            style = MaterialTheme.typography.bodyMedium,
        )

        CampoScheda("Titolo della procedura *", titolo) { titolo = it }
        CampoScheda("Macchina", macchina) { macchina = it }
        CampoScheda("Reparto", reparto) { reparto = it }
        CampoScheda("Scopo", scopo, righe = 3) { scopo = it }
        CampoScheda("Autore", autore) { autore = it }

        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            OutlinedButton(onClick = { vm.tornaHome() }, enabled = !vm.occupato) { Text("Annulla") }
            Button(
                onClick = {
                    vm.confermaScheda(
                        iniziale.copy(
                            titolo = titolo,
                            macchina = macchina,
                            reparto = reparto,
                            scopo = scopo,
                            autore = autore,
                        )
                    )
                },
                enabled = titolo.isNotBlank() && !vm.occupato,
            ) { Text("Inizia") }
        }
        if (vm.occupato) CircularProgressIndicator()
    }
}

/** Un campo di testo della scheda. */
@Composable
private fun CampoScheda(etichetta: String, valore: String, righe: Int = 1, cambia: (String) -> Unit) {
    OutlinedTextField(
        value = valore,
        onValueChange = cambia,
        label = { Text(etichetta) },
        singleLine = righe == 1,
        minLines = righe,
        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
        modifier = Modifier.fillMaxWidth(),
    )
}
