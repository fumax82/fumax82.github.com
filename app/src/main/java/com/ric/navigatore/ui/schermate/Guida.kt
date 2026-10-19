package com.ric.navigatore.ui.schermate

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ric.navigatore.guida.StatoNavigazione
import com.ric.navigatore.nucleo.modello.formattaDistanza
import com.ric.navigatore.nucleo.modello.formattaDurata
import com.ric.navigatore.nucleo.navigazione.Segnale
import com.ric.navigatore.ui.tema.Extra

/**
 * Schermata di guida: comandi GRANDI, leggibili a colpo d'occhio.
 *  - in alto: prossima manovra con freccia e distanza;
 *  - sotto, prima di ogni svolta, l'anteprima dell'incrocio (mappa schematica);
 *  - avvisi (tornanti e pendenze, GPS, ricalcolo, rete);
 *  - in basso: tempo e km rimanenti, arrivo previsto, pulsanti;
 *    oppure il pannello per esplorare il percorso e cercarvi un punto a voce.
 */
@Composable
fun SchermataGuida(
    stato: StatoNavigazione,
    rete: Boolean,
    notte: Boolean,
    onVoce: () -> Unit,
    onRicentra: () -> Unit,
    onCercaVoce: () -> Unit,
    onEsplora: () -> Unit,
    onTutto: () -> Unit,
    onModifica: () -> Unit,
    onChiudiEsplora: () -> Unit,
    onTermina: () -> Unit,
) {
    val g = stato.guida
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val altezzaSchermo = maxHeight
        // ---------------- Prossima manovra ----------------
        Column(Modifier.align(Alignment.TopCenter).fillMaxWidth().statusBarsPadding().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Surface(shape = RoundedCornerShape(24.dp), color = MaterialTheme.colorScheme.primary, contentColor = MaterialTheme.colorScheme.onPrimary, shadowElevation = 8.dp) {
                Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    val m = g?.manovra
                    Text(m?.let { frecciaManovra(it.tipo) } ?: "↑", fontSize = 52.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(72.dp))
                    Column(Modifier.weight(1f)) {
                        when {
                            g == null -> Text("In attesa del GPS…", style = MaterialTheme.typography.titleLarge)
                            g.arrivato -> Text("Sei arrivato", style = MaterialTheme.typography.headlineSmall)
                            else -> {
                                Text(formattaDistanza(g.distanzaManovra), fontSize = 34.sp, fontWeight = FontWeight.Bold)
                                Text(m?.istruzione ?: "Prosegui sul percorso", style = MaterialTheme.typography.titleMedium)
                            }
                        }
                    }
                }
            }
            g?.manovraDopo?.takeIf { g.distanzaManovra < 500 && !g.arrivato }?.let { dopo ->
                Surface(shape = RoundedCornerShape(16.dp), color = MaterialTheme.colorScheme.primaryContainer, contentColor = MaterialTheme.colorScheme.onPrimaryContainer) {
                    Text("Poi ${frecciaManovra(dopo.tipo)} ${dopo.istruzione}", style = MaterialTheme.typography.bodyLarge, modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp))
                }
            }
            // ---------------- Tornanti, salite e discese ripide ----------------
            stato.avvisiStrada.forEach { RiquadroAvvisoStrada(it) }
            // ---------------- Anteprima dell'incrocio (metà superiore) ----------------
            if (stato.anteprima != null && stato.esplorazione == null) {
                PannelloIncrocio(stato, notte, Modifier.fillMaxWidth().height(altezzaSchermo * 0.32f))
            }
            // ---------------- Avvisi ----------------
            val avvisi = buildList {
                if (stato.ricalcolo) add("Ricalcolo del percorso in corso (mantengo tutte le esclusioni)…")
                else stato.avviso?.let { add(it) }
                if (g?.fuoriPercorso == true && !stato.ricalcolo && stato.avviso == null) add("Fuori percorso")
                if (stato.segnale == Segnale.ASSENTE && stato.avviso == null) add("Segnale GPS assente")
                if (!rete) add("Nessuna connessione: in caso di deviazione non potrò ricalcolare.")
            }
            avvisi.forEach { a ->
                Riquadro(Extra.colori.avvisoSfondo, Extra.colori.avviso) { Text(a, style = MaterialTheme.typography.bodyMedium) }
            }
        }

        // ---------------- In basso: esplorazione del percorso ----------------
        if (stato.esplorazione != null) {
            PannelloEsplora(
                stato, onVoce = onCercaVoce, onTutto = onTutto, onModifica = onModifica, onChiudi = onChiudiEsplora,
                modifier = Modifier.align(Alignment.BottomCenter).fillMaxWidth().navigationBarsPadding().imePadding().padding(12.dp),
            )
        } else Surface( // ---------------- In basso: tempi e pulsanti ----------------
            Modifier.align(Alignment.BottomCenter).fillMaxWidth().navigationBarsPadding().padding(12.dp),
            shape = RoundedCornerShape(24.dp), shadowElevation = 8.dp, color = MaterialTheme.colorScheme.surface,
        ) {
            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (g != null) {
                    Row(verticalAlignment = Alignment.Bottom) {
                        Text(formattaDurata(g.tempoResiduo), style = MaterialTheme.typography.headlineSmall, color = Extra.colori.percorso)
                        Spacer(Modifier.width(10.dp))
                        Text(formattaDistanza(g.distanzaResidua), style = MaterialTheme.typography.titleMedium)
                        Spacer(Modifier.weight(1f))
                        Text("arrivo ${ora(g.arrivoPrevisto)}", style = MaterialTheme.typography.titleMedium)
                    }
                    Text(
                        "Stima senza traffico" + if (stato.ricalcoli > 0) " · ricalcolato ${stato.ricalcoli} volte" else "",
                        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    // icona sopra e testo sotto: il testo ha tutta la larghezza e non va mai a capo a metà
                    FilledTonalButton(onClick = onVoce, modifier = Modifier.weight(1f).heightIn(min = 64.dp), contentPadding = PaddingValues(6.dp)) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(if (stato.voce) IconeExtra.VoceSi else IconeExtra.VoceNo, null)
                            Text(if (stato.voce) "Voce sì" else "Voce no", maxLines = 1, softWrap = false)
                        }
                    }
                    FilledTonalButton(onClick = onCercaVoce, modifier = Modifier.weight(1f).heightIn(min = 64.dp), contentPadding = PaddingValues(6.dp)) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(IconeExtra.Microfono, null)
                            Text("Cerca", maxLines = 1, softWrap = false)
                        }
                    }
                    FilledTonalButton(onClick = onRicentra, modifier = Modifier.weight(1f).heightIn(min = 64.dp), contentPadding = PaddingValues(6.dp)) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(IconeExtra.MiaPosizione, null)
                            Text("Ricentra", maxLines = 1, softWrap = false)
                        }
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = onEsplora, modifier = Modifier.weight(1f).heightIn(min = 60.dp)) {
                        Icon(IconeExtra.Esplora, null)
                        Spacer(Modifier.width(6.dp))
                        Text("Esplora", maxLines = 1, softWrap = false)
                    }
                    Button(
                        onClick = onTermina, modifier = Modifier.weight(1f).heightIn(min = 60.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Extra.colori.esclusione, contentColor = MaterialTheme.colorScheme.surface),
                    ) { Text("Termina") }
                }
            }
        }
    }
}
