package com.ric.navigatore.ui.schermate

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import com.ric.navigatore.Servizi
import com.ric.navigatore.dati.DatiSalvati
import com.ric.navigatore.nucleo.modello.Durata
import com.ric.navigatore.nucleo.modello.EvitaTratto
import com.ric.navigatore.nucleo.modello.Luogo
import com.ric.navigatore.nucleo.modello.ModoArea
import com.ric.navigatore.nucleo.modello.PassaArea
import com.ric.navigatore.nucleo.modello.PassaTratto
import com.ric.navigatore.nucleo.modello.Priorita
import com.ric.navigatore.nucleo.modello.Senso
import com.ric.navigatore.nucleo.modello.TipoManovra
import com.ric.navigatore.nucleo.modello.Vincolo
import com.ric.navigatore.nucleo.modello.formattaDistanza
import com.ric.navigatore.nucleo.modello.formattaDurata
import com.ric.navigatore.nucleo.validazione.EsitoControllo

import com.ric.navigatore.ui.ModelloApp
import com.ric.navigatore.ui.Modo
import com.ric.navigatore.ui.ObiettivoArea
import com.ric.navigatore.ui.Scopo
import com.ric.navigatore.ui.StatoUi
import com.ric.navigatore.ui.tema.Extra
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/*
 * I "fogli" che salgono dal basso. Ognuno è una funzione separata, così è
 * facile trovarli e modificarli.
 */

/** Contenitore comune: titolo + contenuto scorrevole. */
@Composable
private fun CorpoFoglio(titolo: String, contenuto: @Composable ColumnScope.() -> Unit) {
    Column(
        Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp).padding(bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(titolo, style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(bottom = 4.dp))
        contenuto()
    }
}

/** Una voce grande di menu, con titolo e spiegazione. */
@Composable
private fun VoceMenu(titolo: String, spiegazione: String, colore: Color, attiva: Boolean = true, onClick: () -> Unit) {
    Surface(
        onClick = onClick, enabled = attiva, shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer, modifier = Modifier.fillMaxWidth(),
    ) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(12.dp).background(if (attiva) colore else colore.copy(alpha = 0.3f), RoundedCornerShape(50)))
            Spacer(Modifier.width(14.dp))
            Column {
                Text(titolo, style = MaterialTheme.typography.titleSmall, color = if (attiva) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant)
                Text(spiegazione, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

// =====================================================================
// Menu «Evita» e «Passa da»
// =====================================================================

@Composable
fun MenuEvita(modello: ModelloApp, s: StatoUi) = CorpoFoglio("Cosa vuoi evitare?") {
    val rosso = Extra.colori.esclusione
    VoceMenu("Una strada", "Tocca la strada sulla mappa. Puoi scegliere tu dove inizia e finisce il tratto.", rosso) { modello.avviaModo(Modo.Strada(true)) }
    VoceMenu(
        "Un pezzo del percorso", if (s.percorsoScelto != null) "Tocca sul percorso blu l'inizio e la fine del pezzo." else "Disponibile dopo aver calcolato un percorso.",
        rosso, attiva = s.percorsoScelto != null,
    ) { modello.avviaModo(Modo.PezzoPercorso) }
    VoceMenu("Un'area", "Disegna un poligono, un rettangolo o un cerchio.", rosso) { modello.avviaModo(Modo.Disegno(ObiettivoArea.EVITA)) }
    Spacer(Modifier.height(4.dp))
    Text(
        "Puoi aggiungere tutte le esclusioni che vuoi: valgono tutte insieme. Il servizio gratuito esclude aree, non singole strade: " +
            "per le strade uso una fascia stretta che ti mostro prima di confermare.",
        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

@Composable
fun MenuPassa(modello: ModelloApp) = CorpoFoglio("Da dove vuoi passare?") {
    val verde = Extra.colori.passaggio
    VoceMenu("Un punto", "Tocca il punto: lo aggancio alla strada più vicina e ti mostro quale userò.", verde) { modello.avviaModo(Modo.Punto) }
    VoceMenu("Una strada", "Tocca la strada e scegli il senso di marcia.", verde) { modello.avviaModo(Modo.Strada(false)) }
    VoceMenu("Dentro un'area", ModoArea.PASSA_ALL_INTERNO.spiegazione, verde) { modello.avviaModo(Modo.Disegno(ObiettivoArea.PASSA_ALL_INTERNO)) }
    VoceMenu("Attraverso un'area", ModoArea.ATTRAVERSA.spiegazione, verde) { modello.avviaModo(Modo.Disegno(ObiettivoArea.ATTRAVERSA)) }
}

// =====================================================================
// Elenco dei vincoli
// =====================================================================

@Composable
fun FoglioVincoli(modello: ModelloApp, s: StatoUi) = CorpoFoglio("Vincoli") {
    val vincoli = s.viaggio.vincoli
    if (vincoli.isEmpty()) {
        Text("Nessun vincolo. Usa «Evita», «Passa da» o «Disegna area».", style = MaterialTheme.typography.bodyMedium)
        return@CorpoFoglio
    }
    Text(
        "I passaggi vengono fatti nell'ordine dell'elenco (usa le frecce per cambiarlo). Le esclusioni valgono sempre tutte.",
        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
    vincoli.forEachIndexed { i, v -> SchedaVincolo(modello, s, v, i, vincoli.size) }
}

@Composable
private fun SchedaVincolo(modello: ModelloApp, s: StatoUi, v: Vincolo, indice: Int, totale: Int) {
    var rinomina by remember { mutableStateOf(false) }
    val colore = if (v.esclusione) Extra.colori.esclusione else Extra.colori.passaggio
    val sfondo = if (v.esclusione) Extra.colori.esclusioneSfondo else Extra.colori.passaggioSfondo
    // esito dell'ultimo controllo su questo vincolo
    val controllo = s.esito?.rapporto?.controlli?.firstOrNull { it.vincolo?.id == v.id }
    Surface(shape = RoundedCornerShape(16.dp), color = if (v.attivo) sfondo else MaterialTheme.colorScheme.surfaceContainer, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(v.nome, style = MaterialTheme.typography.titleSmall, color = colore)
                    Text(v.descrizione(), style = MaterialTheme.typography.bodySmall)
                }
                Switch(checked = v.attivo, onCheckedChange = { modello.attivaVincolo(v.id, it) })
            }
            controllo?.let {
                val c = when (it.esito) { EsitoControllo.RISPETTATO -> Extra.colori.passaggio; EsitoControllo.VIOLATO -> Extra.colori.esclusione; EsitoControllo.AVVISO -> Extra.colori.avviso }
                Text("${it.esito.simbolo} ${it.dettaglio}", style = MaterialTheme.typography.bodySmall, color = c)
            }
            SceltaPillole(Priorita.entries, v.priorita, { it.etichetta }, { modello.prioritaVincolo(v.id, it) })
            SceltaPillole(Durata.entries, v.durata, { it.etichetta }, { modello.durataVincolo(v.id, it) })
            when (v) {
                is PassaTratto -> if (!v.sensoUnico) SceltaPillole(Senso.entries, v.senso, { it.etichetta }, { modello.sensoVincolo(v.id, it) })
                    else Text("Senso unico: senso imposto dalla mappa.", style = MaterialTheme.typography.bodySmall)
                is PassaArea -> SceltaPillole(ModoArea.entries, v.modo, { it.etichetta }, { modello.modoArea(v.id, it) })
                is EvitaTratto -> Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Fascia ±${v.larghezzaFascia.toInt()} m", style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f))
                    TextButton(onClick = { modello.larghezzaFascia(v.id, (v.larghezzaFascia - 5).coerceAtLeast(5.0)) }) { Text("Più stretta") }
                    TextButton(onClick = { modello.larghezzaFascia(v.id, (v.larghezzaFascia + 5).coerceAtMost(40.0)) }) { Text("Più larga") }
                }
                else -> {}
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = { modello.mostraVincolo(v) }) { Text("Mostra") }
                TextButton(onClick = { rinomina = true }) { Text("Rinomina") }
                Spacer(Modifier.weight(1f))
                IconButton(onClick = { modello.spostaVincolo(v.id, true) }, enabled = indice > 0) { Icon(Icons.Default.KeyboardArrowUp, "Sposta su") }
                IconButton(onClick = { modello.spostaVincolo(v.id, false) }, enabled = indice < totale - 1) { Icon(Icons.Default.KeyboardArrowDown, "Sposta giù") }
                IconButton(onClick = { modello.rimuoviVincolo(v.id) }) { Icon(Icons.Default.Delete, "Elimina") }
            }
        }
    }
    if (rinomina) {
        var testo by remember { mutableStateOf(v.nome) }
        AlertDialog(
            onDismissRequest = { rinomina = false },
            title = { Text("Nome del vincolo") },
            text = { OutlinedTextField(testo, { testo = it }, singleLine = true) },
            confirmButton = { TextButton(onClick = { modello.rinominaVincolo(v.id, testo); rinomina = false }) { Text("Salva") } },
            dismissButton = { TextButton(onClick = { rinomina = false }) { Text("Annulla") } },
        )
    }
}

// =====================================================================
// Tappe e opzioni
// =====================================================================

@Composable
fun FoglioTappe(modello: ModelloApp, s: StatoUi) = CorpoFoglio("Tappe e opzioni") {
    val v = s.viaggio
    Titoletto("Partenza")
    RigaFermata(v.partenza?.nome ?: "Non scelta", onCerca = { modello.apriRicerca(Scopo.PARTENZA) }, onMappa = { modello.avviaModo(Modo.SceltaPunto(Scopo.PARTENZA)) })
    Titoletto("Tappe intermedie (nell'ordine)")
    if (v.tappe.isEmpty()) Text("Nessuna tappa.", style = MaterialTheme.typography.bodySmall)
    v.tappe.forEachIndexed { i, t ->
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("${i + 1}. ${t.nome}", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
            IconButton(onClick = { modello.spostaTappa(i, true) }, enabled = i > 0) { Icon(Icons.Default.KeyboardArrowUp, "Sposta su") }
            IconButton(onClick = { modello.spostaTappa(i, false) }, enabled = i < v.tappe.size - 1) { Icon(Icons.Default.KeyboardArrowDown, "Sposta giù") }
            IconButton(onClick = { modello.rimuoviTappa(i) }) { Icon(Icons.Default.Close, "Rimuovi") }
        }
    }
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(onClick = { modello.apriRicerca(Scopo.TAPPA) }) { Text("Cerca una tappa") }
        OutlinedButton(onClick = { modello.avviaModo(Modo.SceltaPunto(Scopo.TAPPA)) }) { Text("Sulla mappa") }
    }
    Titoletto("Destinazione")
    RigaFermata(v.arrivo?.nome ?: "Non scelta", onCerca = { modello.apriRicerca(Scopo.ARRIVO) }, onMappa = { modello.avviaModo(Modo.SceltaPunto(Scopo.ARRIVO)) })

    Titoletto("Opzioni (auto)")
    val o = v.opzioni
    RigaInterruttore("Evita pedaggi", o.evitaPedaggi) { modello.opzioni(o.copy(evitaPedaggi = it)) }
    RigaInterruttore("Evita autostrade", o.evitaAutostrade) { modello.opzioni(o.copy(evitaAutostrade = it)) }
    RigaInterruttore("Evita traghetti", o.evitaTraghetti) { modello.opzioni(o.copy(evitaTraghetti = it)) }
    RigaInterruttore("Proponi percorsi alternativi", o.alternative) { modello.opzioni(o.copy(alternative = it)) }
    Text(
        "Le alternative sono disponibili solo senza tappe o passaggi intermedi e per viaggi sotto i 100 km (limite di openrouteservice).",
        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

@Composable
private fun RigaFermata(nome: String, onCerca: () -> Unit, onMappa: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(nome, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
        TextButton(onClick = onCerca) { Text("Cerca") }
        TextButton(onClick = onMappa) { Text("Mappa") }
    }
}

@Composable
fun RigaInterruttore(testo: String, valore: Boolean, spiegazione: String? = null, onCambia: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().clickable { onCambia(!valore) }.padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(testo, style = MaterialTheme.typography.bodyLarge)
            spiegazione?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
        Switch(checked = valore, onCheckedChange = onCambia)
    }
}

// =====================================================================
// Dettagli del calcolo: confronto, controlli, conflitti, istruzioni
// =====================================================================

@Composable
fun FoglioDettagli(modello: ModelloApp, s: StatoUi) = CorpoFoglio("Dettagli del percorso") {
    val e = s.esito ?: run { Text("Nessun calcolo eseguito."); return@CorpoFoglio }
    val p = s.percorsoScelto

    if (p != null) {
        RigaValore("Distanza", formattaDistanza(p.distanza))
        RigaValore("Durata stimata", formattaDurata(p.durata) + " (senza traffico)")
        RigaValore("Arrivo previsto", "verso le " + ora(System.currentTimeMillis() + (p.durata * 1000).toLong()))
        s.iniziale?.let { i ->
            Titoletto("Confronto con il percorso senza vincoli")
            RigaValore("Senza vincoli", "${formattaDistanza(i.distanza)} · ${formattaDurata(i.durata)}")
            RigaValore("Con i tuoi vincoli", "${formattaDistanza(p.distanza)} · ${formattaDurata(p.durata)}")
            Text(confronto(p, i), style = MaterialTheme.typography.bodyMedium)
            Text("Sulla mappa il percorso senza vincoli è la linea grigia tratteggiata.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }

    // Errore e diagnosi
    e.errore?.let { err ->
        Spacer(Modifier.height(6.dp))
        Riquadro(Extra.colori.esclusioneSfondo, Extra.colori.esclusione) {
            Text("Percorso non disponibile", style = MaterialTheme.typography.titleSmall)
            Text(err.messaggio, style = MaterialTheme.typography.bodyMedium)
            err.dettaglio?.takeIf { it.isNotBlank() }?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
        }
    }
    if (e.vincoliCheBloccano.isNotEmpty()) {
        Titoletto("Cosa impedisce il percorso")
        e.vincoliCheBloccano.forEach { v ->
            Text("• ${v.nome}: senza questo vincolo il percorso sarebbe possibile. Prova a disattivarlo, spostarlo o renderlo «Preferito».", style = MaterialTheme.typography.bodyMedium)
        }
    }
    if (e.conflitti.isNotEmpty()) {
        Titoletto("Conflitti fra i vincoli")
        e.conflitti.forEach { c ->
            Riquadro(if (c.bloccante) Extra.colori.esclusioneSfondo else Extra.colori.avvisoSfondo, if (c.bloccante) Extra.colori.esclusione else Extra.colori.avviso) {
                Text(c.messaggio, style = MaterialTheme.typography.bodyMedium)
                Text("Suggerimento: ${c.suggerimento}", style = MaterialTheme.typography.bodySmall)
            }
        }
    }
    if (e.percorsoScartato != null && e.percorso == null) {
        Text("Il percorso scartato (in rosso spento sulla mappa) violava vincoli obbligatori: non lo propongo per la guida.", style = MaterialTheme.typography.bodySmall)
    }

    // Controlli dopo il calcolo
    if (e.rapporto.controlli.isNotEmpty()) {
        Titoletto("Verifiche sul percorso")
        e.rapporto.controlli.forEach { c ->
            val colore = when (c.esito) { EsitoControllo.RISPETTATO -> Extra.colori.passaggio; EsitoControllo.VIOLATO -> Extra.colori.esclusione; EsitoControllo.AVVISO -> Extra.colori.avviso }
            Row {
                Text(c.esito.simbolo, color = colore, style = MaterialTheme.typography.titleSmall, modifier = Modifier.width(22.dp))
                Column {
                    Text(c.titolo, style = MaterialTheme.typography.bodyMedium)
                    Text(c.dettaglio, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
    if (e.preferitiNonRispettati.isNotEmpty()) {
        Titoletto("Vincoli preferiti non rispettati")
        e.preferitiNonRispettati.forEach { Text("• ${it.nome}", style = MaterialTheme.typography.bodyMedium) }
    }
    if (e.note.isNotEmpty()) {
        Titoletto("Note sul metodo")
        e.note.forEach { Text("• $it", style = MaterialTheme.typography.bodySmall) }
    }
    p?.avvisi?.takeIf { it.isNotEmpty() }?.let { a ->
        Titoletto("Avvisi del servizio")
        a.forEach { Text("• $it", style = MaterialTheme.typography.bodySmall) }
    }
    Text("Richieste usate per questo calcolo: ${e.richiesteUsate}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)

    // Salvataggio
    if (p != null) {
        var nome by remember { mutableStateOf("") }
        Titoletto("Salva questo viaggio (tappe e vincoli)")
        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(nome, { nome = it }, placeholder = { Text("Nome (facoltativo)") }, singleLine = true, modifier = Modifier.weight(1f))
            Spacer(Modifier.width(8.dp))
            Button(onClick = { modello.salvaPercorso(nome); nome = "" }) { Text("Salva") }
        }
    }

    // Istruzioni (statiche, fornite dal servizio)
    if (p != null && p.manovre.isNotEmpty()) {
        Titoletto("Istruzioni (${p.manovre.size})")
        Text(
            "Elenco statico fornito dal servizio. Durante la guida le distanze vengono calcolate dal GPS in tempo reale.",
            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        p.manovre.forEach { m ->
            Row(Modifier.padding(vertical = 3.dp)) {
                Text(frecciaManovra(m.tipo), style = MaterialTheme.typography.titleMedium, modifier = Modifier.width(30.dp))
                Column {
                    Text(m.istruzione, style = MaterialTheme.typography.bodyMedium)
                    if (m.distanza > 0) Text("poi ${formattaDistanza(m.distanza)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
    Spacer(Modifier.height(6.dp))
    Text(
        "Tempi stimati senza traffico in tempo reale. L'app non conosce limiti di velocità, chiusure o lavori in corso.",
        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

/** Freccia semplice per ogni tipo di manovra. */
fun frecciaManovra(tipo: Int): String = when (tipo) {
    TipoManovra.SINISTRA, TipoManovra.SINISTRA_STRETTA -> "←"
    TipoManovra.DESTRA, TipoManovra.DESTRA_STRETTA -> "→"
    TipoManovra.SINISTRA_LEGGERA -> "↖"
    TipoManovra.DESTRA_LEGGERA -> "↗"
    TipoManovra.DRITTO -> "↑"
    TipoManovra.ROTATORIA, TipoManovra.ESCI_ROTATORIA -> "⟳"
    TipoManovra.INVERSIONE -> "↶"
    TipoManovra.ARRIVO -> "⚑"
    TipoManovra.PARTENZA -> "●"
    12 -> "↖" // tieni la sinistra
    13 -> "↗" // tieni la destra
    else -> "↑"
}

// =====================================================================
// Preferiti, percorsi salvati, cronologia
// =====================================================================

@Composable
fun FoglioSalvati(modello: ModelloApp, dati: DatiSalvati) = CorpoFoglio("Salvati") {
    var scheda by remember { mutableIntStateOf(0) }
    SceltaPillole(listOf(0, 1, 2), scheda, { listOf("Preferiti", "Percorsi", "Cronologia")[it] }, { scheda = it })
    when (scheda) {
        0 -> {
            if (dati.preferiti.isEmpty()) Text("Nessun preferito. Tieni premuto sulla mappa e scegli «Salva nei preferiti», oppure usa la stella nella ricerca.", style = MaterialTheme.typography.bodySmall)
            dati.preferiti.forEach { l ->
                RigaLuogoSalvato(l, onVai = { modello.impostaLuogo(Scopo.ARRIVO, l); modello.apri(null) }, onParti = { modello.impostaLuogo(Scopo.PARTENZA, l); modello.apri(null) }, onElimina = { modello.rimuoviPreferito(l) })
            }
        }
        1 -> {
            if (dati.percorsi.isEmpty()) Text("Nessun percorso salvato. Dopo un calcolo, apri i dettagli e premi «Salva».", style = MaterialTheme.typography.bodySmall)
            val formato = SimpleDateFormat("d MMM yyyy, HH:mm", Locale.ITALY)
            dati.percorsi.forEach { p ->
                Surface(shape = RoundedCornerShape(14.dp), color = MaterialTheme.colorScheme.surfaceContainer, modifier = Modifier.fillMaxWidth()) {
                    Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(p.nome, style = MaterialTheme.typography.titleSmall)
                            Text(
                                "${p.viaggio.partenza?.nome ?: "?"} → ${p.viaggio.arrivo?.nome ?: "?"} · ${p.viaggio.vincoli.size} vincoli · ${formato.format(Date(p.salvatoIl))}",
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                        TextButton(onClick = { modello.caricaPercorso(p) }) { Text("Apri") }
                        IconButton(onClick = { modello.eliminaPercorso(p) }) { Icon(Icons.Default.Delete, "Elimina") }
                    }
                }
            }
        }
        else -> {
            if (dati.cronologia.isEmpty()) Text("Cronologia vuota.", style = MaterialTheme.typography.bodySmall)
            dati.cronologia.forEach { l ->
                RigaLuogoSalvato(l, onVai = { modello.impostaLuogo(Scopo.ARRIVO, l); modello.apri(null) }, onParti = { modello.impostaLuogo(Scopo.PARTENZA, l); modello.apri(null) }, onElimina = null)
            }
            if (dati.cronologia.isNotEmpty()) TextButton(onClick = { modello.svuotaCronologia() }) { Text("Svuota la cronologia") }
        }
    }
    Text("Tutto resta solo su questo telefono.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
}

@Composable
private fun RigaLuogoSalvato(l: Luogo, onVai: () -> Unit, onParti: () -> Unit, onElimina: (() -> Unit)?) {
    Row(Modifier.fillMaxWidth().padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(l.nome, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
        TextButton(onClick = onParti) { Text("Parti") }
        TextButton(onClick = onVai) { Text("Vai") }
        onElimina?.let { IconButton(onClick = it) { Icon(Icons.Default.Delete, "Elimina") } }
    }
}

// =====================================================================
// Ricerca di indirizzi
// =====================================================================

@Composable
fun FoglioRicerca(modello: ModelloApp, s: StatoUi, dati: DatiSalvati) = CorpoFoglio("Cerca: ${s.scopoRicerca.etichetta.lowercase()}") {
    val fuoco = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { fuoco.requestFocus() } }
    val geo = Servizi.geocodifica
    OutlinedTextField(
        value = s.testoRicerca, onValueChange = { modello.testoRicerca(it) },
        placeholder = { Text("Indirizzo, città o luogo") }, singleLine = true,
        leadingIcon = { Icon(Icons.Default.Search, null) },
        trailingIcon = { if (s.testoRicerca.isNotEmpty()) IconButton(onClick = { modello.testoRicerca("") }) { Icon(Icons.Default.Close, "Cancella") } },
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
        keyboardActions = KeyboardActions(onSearch = { modello.cercaOra() }),
        modifier = Modifier.fillMaxWidth().focusRequester(fuoco),
    )
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Button(onClick = { modello.cercaOra() }, enabled = s.testoRicerca.isNotBlank()) { Text("Cerca") }
        OutlinedButton(onClick = { modello.usaPosizioneAttuale(s.scopoRicerca); modello.apri(null) }) { Text("La mia posizione") }
        OutlinedButton(onClick = { modello.avviaModo(Modo.SceltaPunto(s.scopoRicerca)) }) { Text("Mappa") }
    }
    Text(
        when {
            geo == null -> "Nessun servizio di ricerca attivo: inserisci la chiave openrouteservice nelle Impostazioni."
            geo.suggerimentiConsentiti -> "Ricerca con ${geo.nome}: suggerimenti mentre scrivi."
            else -> "Ricerca con ${geo.nome}: premi «Cerca» (questo servizio non permette i suggerimenti mentre scrivi)."
        },
        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
    if (s.ricercaInCorso) LinearProgressIndicator(Modifier.fillMaxWidth())
    s.messaggioRicerca?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = Extra.colori.avviso) }
    s.risultatiRicerca.forEach { r ->
        Row(Modifier.fillMaxWidth().clickable { modello.scegliRisultato(r) }.padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(r.nome, style = MaterialTheme.typography.bodyLarge)
                if (r.dettaglio.isNotBlank()) Text(r.dettaglio, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            IconButton(onClick = { modello.aggiungiPreferito(Luogo(r.punto, r.nome)) }) { Icon(Icons.Default.Star, "Aggiungi ai preferiti") }
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
    }
    if (s.testoRicerca.isBlank()) {
        if (dati.preferiti.isNotEmpty()) {
            Titoletto("Preferiti")
            dati.preferiti.take(8).forEach { l -> Text(l.nome, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.fillMaxWidth().clickable { modello.scegliLuogo(l) }.padding(vertical = 8.dp)) }
        }
        if (dati.cronologia.isNotEmpty()) {
            Titoletto("Recenti")
            dati.cronologia.take(8).forEach { l -> Text(l.nome, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.fillMaxWidth().clickable { modello.scegliLuogo(l) }.padding(vertical = 8.dp)) }
        }
    }
}
