package com.ric.navigatore.ui.schermate

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.ric.navigatore.nucleo.geo.Aree
import com.ric.navigatore.nucleo.geo.Geo
import com.ric.navigatore.nucleo.modello.Durata
import com.ric.navigatore.nucleo.modello.FormaArea
import com.ric.navigatore.nucleo.modello.ModoArea
import com.ric.navigatore.nucleo.modello.Priorita
import com.ric.navigatore.nucleo.modello.Senso
import com.ric.navigatore.nucleo.modello.formattaDistanza
import com.ric.navigatore.nucleo.modello.formattaSuperficie
import com.ric.navigatore.nucleo.ors.Openrouteservice
import com.ric.navigatore.ui.ModelloApp
import com.ric.navigatore.ui.Modo
import com.ric.navigatore.ui.ObiettivoArea
import com.ric.navigatore.ui.StatoUi
import com.ric.navigatore.ui.tema.Extra
import kotlin.math.roundToInt

/**
 * Pannello in basso mentre si sceglie qualcosa sulla mappa
 * (strada, pezzo di percorso, punto, area). Mostra l'anteprima
 * a parole e i pulsanti «Annulla» / «Conferma».
 */
@Composable
fun PannelloModo(modello: ModelloApp, s: StatoUi) {
    val sel = s.selezione
    val modo = s.modo
    val titolo = when (modo) {
        is Modo.SceltaPunto -> "Scegli sulla mappa: ${modo.scopo.etichetta.lowercase()}"
        is Modo.Strada -> if (modo.evita) "Evita una strada" else "Passa da una strada"
        Modo.PezzoPercorso -> "Evita un pezzo del percorso"
        Modo.Punto -> "Passa da un punto"
        is Modo.Disegno -> "Disegna un'area"
        Modo.Normale -> ""
    }
    val colore = when {
        (modo is Modo.Strada && modo.evita) || modo == Modo.PezzoPercorso -> Extra.colori.esclusione
        modo is Modo.Disegno && modo.obiettivo == ObiettivoArea.EVITA -> Extra.colori.esclusione
        modo is Modo.SceltaPunto -> MaterialTheme.colorScheme.primary
        else -> Extra.colori.passaggio
    }
    Surface(shape = RoundedCornerShape(22.dp), shadowElevation = 8.dp, color = MaterialTheme.colorScheme.surface) {
        Column(
            Modifier.fillMaxWidth().heightIn(max = 340.dp).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(titolo, style = MaterialTheme.typography.titleMedium, color = colore)
            sel.suggerimento?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
            if (sel.inAttesa) LinearProgressIndicator(Modifier.fillMaxWidth())

            when (modo) {
                is Modo.Strada -> ContenutoStrada(modello, s, modo.evita)
                Modo.PezzoPercorso -> ContenutoFascia(modello, s)
                Modo.Punto -> {}
                is Modo.Disegno -> ContenutoDisegno(modello, s, modo.obiettivo)
                else -> {}
            }

            // Obbligatorio / preferito e durata (non per la scelta di partenza/arrivo):
            // nascosti dietro "Cambia" per lasciare più mappa libera mentre si tocca
            var opzioni by remember { mutableStateOf(false) }
            if (modo !is Modo.SceltaPunto && !opzioni) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "${sel.priorita.etichetta} · ${sel.durata.etichetta.lowercase()}",
                        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.weight(1f),
                    )
                    TextButton(onClick = { opzioni = true }) { Text("Cambia") }
                }
            }
            if (modo !is Modo.SceltaPunto && opzioni) {
                Titoletto("Importanza")
                SceltaPillole(Priorita.entries, sel.priorita, { it.etichetta }, { p -> modello.cambiaSelezione { it.copy(priorita = p) } })
                Text(
                    if (sel.priorita == Priorita.OBBLIGATORIO) "Se non si può rispettare, il calcolo si ferma e spiega perché."
                    else "Si prova a rispettarlo; se non si riesce lo segnalo, ma il percorso viene dato lo stesso.",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Titoletto("Valido per")
                SceltaPillole(Durata.entries, sel.durata, { it.etichetta }, { d -> modello.cambiaSelezione { it.copy(durata = d) } })
            }

            Spacer(Modifier.height(4.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedButton(onClick = { modello.annullaModo() }, modifier = Modifier.weight(1f).heightIn(min = 52.dp)) { Text("Annulla") }
                if (modo !is Modo.SceltaPunto) {
                    Button(
                        onClick = { modello.conferma() }, enabled = puoConfermare(modello, s),
                        modifier = Modifier.weight(1f).heightIn(min = 52.dp),
                    ) { Text("Conferma") }
                }
            }
        }
    }
}

private fun puoConfermare(modello: ModelloApp, s: StatoUi): Boolean {
    val sel = s.selezione
    if (sel.inAttesa) return false
    return when (s.modo) {
        is Modo.Strada, Modo.PezzoPercorso -> sel.linea != null && !sel.attesaFine
        Modo.Punto -> sel.tocco != null
        is Modo.Disegno -> modello.areaDisegnata(sel) != null
        else -> false
    }
}

/** Scelta della strada, tratto, senso di marcia. */
@Composable
private fun ContenutoStrada(modello: ModelloApp, s: StatoUi, evita: Boolean) {
    val sel = s.selezione
    // più strade vicine al tocco: l'utente sceglie quella giusta
    if (sel.candidati.isNotEmpty()) {
        sel.candidati.forEach { c ->
            OutlinedCard(onClick = { modello.scegliCandidato(c) }, modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp)) {
                    Text(c.strada.nomeMostrato, style = MaterialTheme.typography.bodyLarge)
                    Text(
                        "a ${formattaDistanza(c.distanza)} dal tocco" + if (c.strada.sensoUnico != 0) " · senso unico" else "",
                        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
        return
    }
    if (sel.linea == null) return
    if (!sel.attesaFine) {
        OutlinedButton(onClick = { modello.sceltaFine() }, modifier = Modifier.fillMaxWidth()) { Text("Scegli tu dove finisce il tratto") }
    }
    if (evita) {
        ContenutoFascia(modello, s)
    } else {
        Titoletto("Senso di marcia")
        if (sel.sensoUnico != 0) {
            Text("Strada a senso unico: verrà percorsa nel senso consentito dalla mappa.", style = MaterialTheme.typography.bodySmall)
        } else {
            SceltaPillole(Senso.entries, sel.senso, { it.etichetta }, { v -> modello.cambiaSelezione { it.copy(senso = v) } })
            Text(
                "«Primo punto» è l'estremo più vicino al tuo tocco. Verificherò che il percorso copra almeno il 90% del tratto nel senso scelto.",
                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/** Larghezza della fascia di esclusione e strade che verrebbero coinvolte. */
@Composable
private fun ContenutoFascia(modello: ModelloApp, s: StatoUi) {
    val sel = s.selezione
    if (sel.linea == null) return
    Titoletto("Fascia esclusa: ±${sel.larghezza.roundToInt()} m attorno alla strada")
    Slider(
        value = sel.larghezza.toFloat(), valueRange = 5f..30f, steps = 4,
        onValueChange = { v -> modello.cambiaSelezione { it.copy(larghezza = v.toDouble()) } },
    )
    Riquadro(Extra.colori.avvisoSfondo, Extra.colori.avviso) {
        Text(
            "Esclusione APPROSSIMATA: il servizio gratuito non sa escludere una singola strada, quindi " +
                "evito l'area in ambra attorno al tratto. Gli incroci alle estremità restano liberi.",
            style = MaterialTheme.typography.bodySmall,
        )
        if (sel.coinvolte.isNotEmpty()) {
            Text("Potrebbero essere bloccate anche: ${sel.coinvolte.distinct().take(6).joinToString(", ")}.", style = MaterialTheme.typography.bodySmall)
        }
    }
}

/** Disegno di un'area: scopo, forma, raggio, limiti. */
@Composable
private fun ContenutoDisegno(modello: ModelloApp, s: StatoUi, obiettivo: ObiettivoArea) {
    val sel = s.selezione
    Titoletto("Cosa fare con l'area")
    SceltaPillole(ObiettivoArea.entries, obiettivo, { it.etichetta }, { modello.cambiaObiettivo(it) })
    when (obiettivo) {
        ObiettivoArea.PASSA_ALL_INTERNO -> Text(ModoArea.PASSA_ALL_INTERNO.spiegazione, style = MaterialTheme.typography.bodySmall)
        ObiettivoArea.ATTRAVERSA -> Text(ModoArea.ATTRAVERSA.spiegazione, style = MaterialTheme.typography.bodySmall)
        ObiettivoArea.EVITA -> {}
    }
    if (obiettivo != ObiettivoArea.EVITA) {
        Text(
            "Metodo euristico (strade dentro l'area, non il centro), risultato sempre verificato.",
            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
    Titoletto("Forma")
    SceltaPillole(FormaArea.entries, sel.forma, { it.etichetta }, { modello.cambiaForma(it) })
    if (sel.forma == FormaArea.POLIGONO && sel.vertici.isNotEmpty()) {
        OutlinedButton(onClick = { modello.togliUltimoVertice() }) { Text("Togli l'ultimo punto (${sel.vertici.size})") }
    }
    if (sel.forma == FormaArea.CERCHIO) {
        Titoletto("Raggio: ${formattaDistanza(sel.raggio)}")
        Slider(
            value = sel.raggio.toFloat(), valueRange = 50f..5000f,
            onValueChange = { v -> modello.cambiaSelezione { it.copy(raggio = (v / 10).roundToInt() * 10.0) } },
        )
    }
    modello.areaDisegnata(sel)?.let { area ->
        val sup = Aree.superficie(area)
        val est = Aree.estensione(area)
        val c = Openrouteservice.CAPACITA
        Text("Superficie: ${formattaSuperficie(sup)} · lato massimo ${formattaDistanza(est)}", style = MaterialTheme.typography.bodySmall)
        if (obiettivo == ObiettivoArea.EVITA && ((c.maxAreaKmq != null && sup / 1e6 > c.maxAreaKmq!!) || (c.maxEstensioneKm != null && est / 1000 > c.maxEstensioneKm!!))) {
            Riquadro(Extra.colori.esclusioneSfondo, Extra.colori.esclusione) {
                Text("Troppo grande per openrouteservice (massimo ${c.maxAreaKmq?.roundToInt()} km² e ${c.maxEstensioneKm?.roundToInt()} km di lato): riducila.", style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}
