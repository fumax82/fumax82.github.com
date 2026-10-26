/*
 * FinestraImpostazioni.kt
 * Impostazioni della trascrizione automatica del parlato (servizio Groq):
 *   - chiave API personale (creata su console.groq.com), con verifica;
 *   - modello: large-v3 (più preciso) o large-v3 turbo (più veloce/economico).
 * Lasciando la chiave vuota la trascrizione resta spenta.
 */
package it.formazione.videotutorial.schermate

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import it.formazione.videotutorial.trascrizione.ModelloTrascrizione
import kotlinx.coroutines.launch

@Composable
fun FinestraImpostazioni(vm: ProgettoViewModel) {
    var chiave by remember { mutableStateOf(vm.chiaveGroq) }
    var modello by remember { mutableStateOf(vm.modelloTrascrizione) }
    var mostraChiave by remember { mutableStateOf(false) }
    // Esito della verifica: null = non ancora verificata
    var esitoVerifica by remember { mutableStateOf<String?>(null) }
    var verificaOk by remember { mutableStateOf(false) }
    var inVerifica by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    AlertDialog(
        onDismissRequest = { vm.chiudiImpostazioni() },
        title = { Text("Trascrizione del parlato", fontWeight = FontWeight.Bold) },
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.verticalScroll(rememberScrollState()),
            ) {
                Text(
                    "Dopo l'estrazione dell'audio, l'app spedisce il parlato al servizio Groq " +
                        "e scrive le frasi con i tempi nella cronologia di tutorial_input.md.",
                    style = MaterialTheme.typography.bodyMedium,
                )
                Text(
                    "Crea la chiave gratuita su console.groq.com (sezione API Keys) e incollala qui. " +
                        "Resta salvata solo su questo telefono.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )

                // Chiave API
                OutlinedTextField(
                    value = chiave,
                    onValueChange = {
                        chiave = it.trim()
                        esitoVerifica = null
                    },
                    label = { Text("Chiave API Groq") },
                    placeholder = { Text("gsk_…") },
                    singleLine = true,
                    visualTransformation = if (mostraChiave) VisualTransformation.None else PasswordVisualTransformation(),
                    trailingIcon = {
                        TextButton(onClick = { mostraChiave = !mostraChiave }) {
                            Text(if (mostraChiave) "Nascondi" else "Mostra")
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                )

                // Verifica della chiave
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedButton(
                        enabled = chiave.isNotBlank() && !inVerifica,
                        onClick = {
                            inVerifica = true
                            scope.launch {
                                val problema = vm.verificaChiave(chiave)
                                verificaOk = problema == null
                                esitoVerifica = problema ?: "Chiave valida ✓"
                                inVerifica = false
                            }
                        },
                    ) { Text("Verifica chiave") }
                    if (inVerifica) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                    esitoVerifica?.let {
                        Text(
                            it,
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.Bold,
                            color = if (verificaOk) Color(0xFF2E7D32) else MaterialTheme.colorScheme.error,
                        )
                    }
                }

                // Modello
                Text("Modello", style = MaterialTheme.typography.titleSmall, modifier = Modifier.padding(top = 4.dp))
                ModelloTrascrizione.entries.forEach { m ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        RadioButton(selected = m == modello, onClick = { modello = m })
                        Text(m.descrizione, style = MaterialTheme.typography.bodyMedium)
                    }
                }
                Text(
                    "Piano gratuito: circa 8 ore di audio al giorno. Oltre, l'app aspetta e riprende da sola.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        },
        confirmButton = {
            Button(onClick = { vm.salvaImpostazioni(chiave, modello) }) { Text("Salva") }
        },
        dismissButton = {
            TextButton(onClick = { vm.chiudiImpostazioni() }) { Text("Annulla") }
        },
    )
}
