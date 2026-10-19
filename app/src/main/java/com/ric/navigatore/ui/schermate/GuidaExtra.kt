package com.ric.navigatore.ui.schermate

import androidx.compose.foundation.layout.*
import androidx.compose.ui.draw.clip
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.ric.navigatore.guida.GuidaCondivisa
import com.ric.navigatore.guida.StatoNavigazione
import com.ric.navigatore.mappa.MappaEsplora
import com.ric.navigatore.mappa.MappaIncrocio
import com.ric.navigatore.nucleo.geo.Geo
import com.ric.navigatore.nucleo.geo.Punto
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
 * Finestra in basso per esplorare il percorso durante la guida.
 * La mappa grande resta centrata sulla posizione GPS: il punto scelto
 * (col cursore o con la ricerca a voce/scritta) si vede nella PICCOLA
 * mappa di questa finestra, da cui si può evitare quel tratto o quella
 * zona, oppure imporre di passare da lì.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun PannelloEsplora(
    stato: StatoNavigazione,
    notte: Boolean,
    altezzaSchermo: androidx.compose.ui.unit.Dp,
    onVoce: () -> Unit,
    onEvitaTratto: (progressiva: Double) -> Unit,
    onEvitaZona: (Punto) -> Unit,
    onPassaDa: (Punto) -> Unit,
    onAltriStrumenti: () -> Unit,
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

    // ---- piccola mappa ----
    val context = LocalContext.current
    val mappa = remember { MappaEsplora() }
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
    LaunchedEffect(percorso) { mappa.percorso(percorso.geometria) }
    LaunchedEffect(e.progressiva) { mappa.vaiA(Geo.puntoAProgressiva(percorso.geometria, e.progressiva)) }

    Surface(modifier, shape = RoundedCornerShape(24.dp), shadowElevation = 8.dp, color = MaterialTheme.colorScheme.surface) {
        Column(
            // niente scorrimento: il trascinamento deve muovere la piccola mappa, non la finestra
            Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Esplora il percorso", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                IconButton(onClick = onChiudi) { Icon(Icons.Default.Close, contentDescription = "Chiudi") }
            }
            Text(
                e.descrizione ?: "Punto del percorso a ${formattaDistanza((e.progressiva - da).coerceAtLeast(0.0))} da qui",
                style = MaterialTheme.typography.bodyLarge,
            )
            e.nota?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = Extra.colori.avviso) }
            // piccola mappa con il mirino al centro
            Box(Modifier.fillMaxWidth().height(altezzaSchermo * 0.22f).clip(RoundedCornerShape(16.dp))) {
                AndroidView(
                    factory = { vista.also { v -> v.getMapAsync { m -> mappa.collega(m, notte) } } },
                    modifier = Modifier.fillMaxSize(),
                )
                Mirino(Modifier.align(Alignment.Center))
                FilledTonalButton(
                    onClick = { mappa.inquadra(Geo.sottoLinea(percorso.geometria, da, percorso.distanza)) },
                    modifier = Modifier.align(Alignment.BottomEnd).padding(8.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                ) { Text("Tutto il percorso") }
            }
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
            // azioni rapide: ricalcolo immediato da dove sei
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(
                    onClick = { onEvitaTratto(e.progressiva) },
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Extra.colori.esclusione),
                ) { Text("Evita il tratto") }
                OutlinedButton(
                    onClick = { mappa.puntoAlCentro()?.let(onEvitaZona) },
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Extra.colori.esclusione),
                ) { Text("Evita la zona") }
                OutlinedButton(
                    onClick = { mappa.puntoAlCentro()?.let(onPassaDa) },
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Extra.colori.passaggio),
                ) { Text("Passa da qui") }
                OutlinedButton(onClick = onAltriStrumenti) { Text("Altri strumenti") }
            }
            Text(
                "«Evita il tratto»: 300 m di percorso attorno al punto scelto. «Evita la zona» e «Passa da qui»: il punto nel mirino.",
                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Button(onClick = onChiudi, modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)) { Text("Torna alla guida") }
        }
    }
}

/** Mirino al centro della piccola mappa. */
@Composable
private fun Mirino(modifier: Modifier = Modifier) {
    val colore = Extra.colori.percorso
    androidx.compose.foundation.Canvas(modifier.size(36.dp)) {
        val c = center
        val r = size.minDimension / 2
        drawCircle(androidx.compose.ui.graphics.Color.White, radius = r * 0.45f, center = c, style = androidx.compose.ui.graphics.drawscope.Stroke(width = 7f))
        drawCircle(colore, radius = r * 0.45f, center = c, style = androidx.compose.ui.graphics.drawscope.Stroke(width = 4f))
        drawLine(colore, c.copy(x = c.x - r), c.copy(x = c.x - r * 0.55f), strokeWidth = 4f)
        drawLine(colore, c.copy(x = c.x + r * 0.55f), c.copy(x = c.x + r), strokeWidth = 4f)
        drawLine(colore, c.copy(y = c.y - r), c.copy(y = c.y - r * 0.55f), strokeWidth = 4f)
        drawLine(colore, c.copy(y = c.y + r * 0.55f), c.copy(y = c.y + r), strokeWidth = 4f)
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
