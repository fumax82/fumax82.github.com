package com.ric.navigatore.ui.schermate

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.ric.navigatore.guida.GuidaCondivisa
import com.ric.navigatore.guida.StatoNavigazione
import com.ric.navigatore.mappa.MappaIncrocio
import com.ric.navigatore.nucleo.modello.formattaDistanza
import com.ric.navigatore.nucleo.navigazione.AvvisoStrada
import com.ric.navigatore.nucleo.navigazione.Anteprima
import com.ric.navigatore.ui.tema.Extra
import org.maplibre.android.maps.MapLibreMapOptions
import org.maplibre.android.maps.MapView

/**
 * Anteprima dell'incrocio (metà superiore dello schermo): una piccola mappa
 * schematica VERA, ruotata come si arriva, con il percorso in blu e la
 * freccia che indica la strada da prendere.
 */
@Composable
fun PannelloIncrocio(stato: StatoNavigazione, notte: Boolean, modifier: Modifier = Modifier) {
    val m = stato.anteprima ?: return
    val percorso = stato.percorso ?: return
    val g = stato.guida
    val velocita = stato.posizione?.takeIf { it.hasSpeed() }?.speed?.toDouble()
    // la geometria si calcola una volta per manovra
    val geometria = remember(m, percorso) { Anteprima.geometria(percorso, m, velocita) }
    val context = LocalContext.current
    val controllo = remember { MappaIncrocio() }
    // "texture mode": la mappa piccola si sovrappone correttamente a quella grande
    val vista = remember { MapView(context, MapLibreMapOptions.createFromAttributes(context).textureMode(true)).apply { onCreate(null) } }
    DisposableEffect(vista) {
        vista.onStart()
        vista.onResume()
        onDispose {
            vista.onPause()
            vista.onStop()
            vista.onDestroy()
        }
    }
    LaunchedEffect(geometria, g?.puntoSulPercorso) { controllo.mostra(geometria, g?.puntoSulPercorso) }

    Surface(modifier, shape = RoundedCornerShape(24.dp), shadowElevation = 8.dp, color = MaterialTheme.colorScheme.surface) {
        Box(Modifier.fillMaxSize()) {
            AndroidView(
                factory = { vista.also { v -> v.getMapAsync { mappa -> controllo.collega(mappa, notte) } } },
                modifier = Modifier.fillMaxSize(),
            )
            // titolo e distanza in alto a sinistra
            Surface(
                Modifier.align(Alignment.TopStart).padding(10.dp),
                shape = RoundedCornerShape(14.dp),
                color = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
                shadowElevation = 4.dp,
            ) {
                Column(Modifier.padding(horizontal = 12.dp, vertical = 6.dp)) {
                    Text(Anteprima.titolo(m), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    if (g != null) Text(formattaDistanza(g.distanzaManovra), style = MaterialTheme.typography.bodyMedium)
                }
            }
            // chiudi (solo per questa manovra)
            FilledTonalIconButton(
                onClick = { GuidaCondivisa.nascondiAnteprima() },
                modifier = Modifier.align(Alignment.TopEnd).padding(6.dp),
            ) { Icon(Icons.Default.Close, contentDescription = "Chiudi l'anteprima") }
        }
    }
}

/** Avviso per tornanti, salite o discese ripide (resta per tutto il tratto). */
@Composable
fun RiquadroAvvisoStrada(a: AvvisoStrada) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = Extra.colori.avvisoSfondo,
        contentColor = Extra.colori.avviso,
        shadowElevation = 2.dp,
    ) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(IconeExtra.Attenzione, contentDescription = null)
            Spacer(Modifier.width(10.dp))
            Text(a.testo, style = MaterialTheme.typography.titleSmall, fontWeight = if (a.inCorso) FontWeight.SemiBold else FontWeight.Normal)
        }
    }
}

/**
 * Pannello in basso per esplorare il percorso durante la guida:
 * cursore lungo il percorso, ricerca a voce o scritta, accesso agli
 * strumenti «evita» e «passa da».
 */
@Composable
fun PannelloEsplora(
    stato: StatoNavigazione,
    onVoce: () -> Unit,
    onTutto: () -> Unit,
    onModifica: () -> Unit,
    onChiudi: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val e = stato.esplorazione ?: return
    val percorso = stato.percorso ?: return
    val da = stato.guida?.progressiva ?: 0.0
    val totale = percorso.distanza.coerceAtLeast(da + 1)
    val ambito = rememberCoroutineScope()
    var testo by remember(e.frase) { mutableStateOf(e.frase) }
    val cerca = { if (testo.isNotBlank()) GuidaCondivisa.cerca(testo, ambito) }

    Surface(modifier, shape = RoundedCornerShape(24.dp), shadowElevation = 8.dp, color = MaterialTheme.colorScheme.surface) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Esplora il percorso", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                IconButton(onClick = onChiudi) { Icon(Icons.Default.Close, contentDescription = "Chiudi") }
            }
            Text(
                e.descrizione ?: "Punto del percorso a ${formattaDistanza((e.progressiva - da).coerceAtLeast(0.0))} da qui",
                style = MaterialTheme.typography.bodyLarge,
            )
            e.nota?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = Extra.colori.avviso) }
            // cursore lungo la parte di percorso ancora da fare
            Slider(
                value = e.progressiva.toFloat().coerceIn(da.toFloat(), totale.toFloat()),
                onValueChange = { GuidaCondivisa.spostaEsplorazione(it.toDouble()) },
                valueRange = da.toFloat()..totale.toFloat(),
            )
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = testo,
                    onValueChange = { testo = it },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    placeholder = { Text("Es. prima di Bologna") },
                    trailingIcon = { IconButton(onClick = cerca) { Icon(Icons.Default.Search, contentDescription = "Cerca lungo il percorso") } },
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    keyboardActions = KeyboardActions(onSearch = { cerca() }),
                )
                FilledTonalIconButton(onClick = onVoce, modifier = Modifier.size(52.dp)) {
                    Icon(IconeExtra.Microfono, contentDescription = "Cerca a voce")
                }
            }
            if (e.cercando) LinearProgressIndicator(Modifier.fillMaxWidth())
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                // testo su due righe se serve: mai tagliato
                OutlinedButton(onClick = onTutto, modifier = Modifier.weight(1f).heightIn(min = 52.dp), contentPadding = PaddingValues(horizontal = 8.dp, vertical = 6.dp)) {
                    Text("Tutto il percorso", textAlign = TextAlign.Center)
                }
                OutlinedButton(onClick = onModifica, modifier = Modifier.weight(1f).heightIn(min = 52.dp), contentPadding = PaddingValues(horizontal = 8.dp, vertical = 6.dp)) {
                    Text("Evita o passa da", textAlign = TextAlign.Center)
                }
            }
            Button(onClick = onChiudi, modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)) { Text("Torna alla guida") }
        }
    }
}

/** Fascia in alto mentre si modificano i vincoli durante la guida. */
@Composable
fun FasciaModificaGuida(onApplica: () -> Unit, onAnnulla: () -> Unit) {
    Surface(shape = RoundedCornerShape(20.dp), shadowElevation = 6.dp, color = MaterialTheme.colorScheme.surface) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Modifiche durante la guida", style = MaterialTheme.typography.titleMedium)
            Text(
                "Usa «Evita», «Passa da» o «Disegna area», oppure tocca un vincolo per modificarlo. La guida continua; " +
                    "con «Applica» il percorso viene ricalcolato da dove sei.",
                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onAnnulla, modifier = Modifier.weight(1f)) { Text("Annulla") }
                Button(onClick = onApplica, modifier = Modifier.weight(1f)) { Text("Applica") }
            }
        }
    }
}
