package com.ric.navigatore.ui.schermate

import android.Manifest
import android.app.Activity
import android.content.ActivityNotFoundException
import android.speech.RecognizerIntent
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.ric.navigatore.Servizi
import com.ric.navigatore.guida.GuidaCondivisa
import com.ric.navigatore.guida.Posizione
import com.ric.navigatore.mappa.ControlloreMappa
import com.ric.navigatore.mappa.DatiMappa
import com.ric.navigatore.nucleo.geo.Geo
import com.ric.navigatore.nucleo.geo.Punto
import com.ric.navigatore.nucleo.modello.EvitaTratto
import com.ric.navigatore.nucleo.modello.Percorso
import com.ric.navigatore.nucleo.modello.formattaDistanza
import com.ric.navigatore.nucleo.modello.formattaDurata
import com.ric.navigatore.ui.Evento
import com.ric.navigatore.ui.Foglio
import com.ric.navigatore.ui.ModelloApp
import com.ric.navigatore.ui.Modo
import com.ric.navigatore.ui.ObiettivoArea
import com.ric.navigatore.ui.Scopo
import com.ric.navigatore.ui.StatoUi
import com.ric.navigatore.ui.tema.Extra
import org.maplibre.android.maps.MapView
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.roundToInt

/**
 * La schermata principale: mappa a tutto schermo con
 *  - in alto la scheda del viaggio (partenza, tappe, destinazione);
 *  - in basso il riepilogo del percorso e la barra con i pulsanti grandi
 *    (raggiungibili con il pollice);
 *  - i "fogli" che salgono dal basso per vincoli, tappe, dettagli, ecc.;
 *  - durante la guida, la schermata di navigazione.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SchermataPrincipale(modello: ModelloApp, notte: Boolean) {
    val context = LocalContext.current
    val stato by modello.stato.collectAsState()
    val guida by GuidaCondivisa.stato.collectAsState()
    val dati by Servizi.archivio.flusso.collectAsState()
    val avvisi = remember { SnackbarHostState() }

    // ---------------- Mappa ----------------
    val controllore = remember { ControlloreMappa(context) }
    val vistaMappa = remember { MapView(context).apply { onCreate(null) } }
    var mappaPronta by remember { mutableStateOf(false) }
    CicloDiVitaMappa(vistaMappa)
    // giorno/notte e tipo di mappa (stradale, satellite, topografica)
    LaunchedEffect(notte, dati.impostazioni.mappaBase, dati.impostazioni.chiaveArcgis, mappaPronta) {
        if (mappaPronta) controllore.cambiaTema(notte, dati.impostazioni.mappaBase, dati.impostazioni.chiaveArcgis)
    }

    // ---------------- Posizione (fuori dalla guida) ----------------
    var permesso by remember { mutableStateOf(haPermessoPosizione(context)) }
    val posizione = remember {
        Posizione(context) { l ->
            modello.nuovaPosizione(Punto(l.latitude, l.longitude))
            controllore.aggiornaPosizione(l)
        }
    }
    val richiestaPermessi = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { esiti ->
        permesso = esiti.values.any { it } || haPermessoPosizione(context)
    }
    LaunchedEffect(Unit) {
        if (!permesso) richiestaPermessi.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
    }
    // il GPS "leggero" della pianificazione si ferma quando l'app va in secondo piano o durante la guida
    val ciclo = LocalLifecycleOwner.current.lifecycle
    DisposableEffect(ciclo, permesso, guida.attiva) {
        val osservatore = LifecycleEventObserver { _, e ->
            when (e) {
                Lifecycle.Event.ON_RESUME -> if (permesso && !guida.attiva) posizione.avvia()
                Lifecycle.Event.ON_PAUSE -> posizione.ferma()
                else -> {}
            }
        }
        ciclo.addObserver(osservatore)
        if (permesso && !guida.attiva && ciclo.currentState.isAtLeast(Lifecycle.State.RESUMED)) posizione.avvia()
        if (guida.attiva) posizione.ferma()
        onDispose { ciclo.removeObserver(osservatore); posizione.ferma() }
    }
    LaunchedEffect(permesso, mappaPronta) { if (permesso && mappaPronta) controllore.attivaPosizione() }

    // durante la guida la posizione arriva dal servizio
    LaunchedEffect(guida.posizione) { guida.posizione?.let { controllore.aggiornaPosizione(it); modello.nuovaPosizione(Punto(it.latitude, it.longitude)) } }
    // la mappa segue l'auto solo durante la guida "normale" (non mentre si esplora o si modifica)
    val segui = guida.attiva && guida.esplorazione == null && !guida.modifica
    LaunchedEffect(segui, mappaPronta) {
        if (mappaPronta) controllore.modalitaGuida(segui, dati.impostazioni.mappaOrientata)
    }
    // esplorazione del percorso: la mappa va sul punto scelto (cursore o ricerca)
    LaunchedEffect(guida.esplorazione?.progressiva, mappaPronta) {
        val e = guida.esplorazione ?: return@LaunchedEffect
        val p = guida.percorso ?: return@LaunchedEffect
        if (mappaPronta) controllore.centra(Geo.puntoAProgressiva(p.geometria, e.progressiva), 16.0)
    }

    // ---------------- Ricerca a voce lungo il percorso ----------------
    val ambito = rememberCoroutineScope()
    val riconoscimento = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        val frase = r.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()
        if (r.resultCode == Activity.RESULT_OK && !frase.isNullOrBlank()) GuidaCondivisa.cerca(frase, ambito)
    }
    val cercaAVoce: () -> Unit = {
        GuidaCondivisa.esplora(guida.esplorazione?.progressiva)
        // riconoscimento vocale del telefono, in italiano (sul telefono se possibile)
        val richiesta = android.content.Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "it-IT")
            .putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
            .putExtra(RecognizerIntent.EXTRA_PROMPT, "Dove vuoi guardare? Es. «prima dell'uscita per Bologna»")
        try {
            riconoscimento.launch(richiesta)
        } catch (e: ActivityNotFoundException) {
            GuidaCondivisa.notaEsplorazione("Il riconoscimento vocale non è disponibile su questo telefono: scrivi la frase nel riquadro.")
        }
    }

    // schermo acceso durante la guida (se scelto nelle impostazioni)
    val vista = LocalView.current
    DisposableEffect(guida.attiva, dati.impostazioni.schermoAcceso) {
        vista.keepScreenOn = guida.attiva && dati.impostazioni.schermoAcceso
        onDispose { vista.keepScreenOn = false }
    }

    // ---------------- Disegno sulla mappa ----------------
    LaunchedEffect(stato, guida.percorso, guida.attiva, guida.modifica, guida.esplorazione?.progressiva, mappaPronta) {
        if (!mappaPronta) return@LaunchedEffect
        val d = when {
            // durante le modifiche: vincoli e selezione della pianificazione, ma il percorso è quello della guida
            guida.attiva && guida.modifica -> datiMappa(modello, stato, null).copy(percorso = guida.percorso?.geometria, alternative = emptyList())
            guida.attiva -> datiMappa(modello, stato, guida)
            else -> datiMappa(modello, stato, null)
        }
        controllore.disegna(d)
    }

    // ---------------- Eventi del modello ----------------
    LaunchedEffect(Unit) {
        modello.eventi.collect { e ->
            when (e) {
                is Evento.Inquadra -> controllore.inquadra(e.punti)
                is Evento.Centra -> controllore.centra(e.punto, e.zoom)
                is Evento.Messaggio -> avvisi.showSnackbar(e.testo, withDismissAction = true)
            }
        }
    }

    // permesso notifiche (Android 13+): serve per la notifica fissa della guida
    val richiestaNotifiche = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { modello.avviaGuida(context) }
    val avvia: () -> Unit = {
        when {
            !permesso -> richiestaPermessi.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
            !posizione.localizzazioneAccesa() -> {
                modello.messaggio("La localizzazione del telefono è spenta: accendila per la guida.")
                context.startActivity(android.content.Intent(android.provider.Settings.ACTION_LOCATION_SOURCE_SETTINGS))
            }
            Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED ->
                richiestaNotifiche.launch(Manifest.permission.POST_NOTIFICATIONS)
            else -> { modello.avviaGuida(context) }
        }
    }

    Box(Modifier.fillMaxSize()) {
        AndroidView(
            factory = {
                vistaMappa.also { v ->
                    v.getMapAsync { m ->
                        modello.lettore = controllore
                        controllore.collega(m, notte) { mappaPronta = true }
                        m.addOnMapClickListener { ll -> modello.tocco(Punto(ll.latitude, ll.longitude)); true }
                        m.addOnMapLongClickListener { ll -> modello.toccoLungo(Punto(ll.latitude, ll.longitude)); true }
                    }
                }
            },
            modifier = Modifier.fillMaxSize(),
        )

        if (guida.attiva && !guida.modifica) {
            SchermataGuida(
                stato = guida,
                rete = stato.rete,
                notte = notte,
                onVoce = { GuidaCondivisa.voce(!guida.voce) },
                onRicentra = { GuidaCondivisa.chiudiEsplorazione(); controllore.ricentra(true, dati.impostazioni.mappaOrientata, null) },
                onCercaVoce = cercaAVoce,
                onEsplora = { GuidaCondivisa.esplora() },
                onTutto = {
                    guida.percorso?.let { p ->
                        val da = guida.guida?.progressiva ?: 0.0
                        controllore.inquadra(Geo.sottoLinea(p.geometria, da, p.distanza))
                    }
                },
                onModifica = { GuidaCondivisa.iniziaModifica() },
                onChiudiEsplora = { GuidaCondivisa.chiudiEsplorazione() },
                onTermina = { GuidaCondivisa.termina(context); controllore.modalitaGuida(false, false) },
            )
        } else {
            // ---------- In alto: viaggio ----------
            Column(Modifier.align(Alignment.TopCenter).fillMaxWidth().statusBarsPadding().padding(horizontal = 12.dp, vertical = 8.dp)) {
                if (guida.modifica) {
                    // modifiche durante la guida: al posto della scheda del viaggio
                    FasciaModificaGuida(
                        onApplica = { modello.messaggio(GuidaCondivisa.applicaVincoli(stato.viaggio.vincoli)) },
                        onAnnulla = {
                            guida.viaggio?.let { modello.ripristinaVincoli(it.vincoli) }
                            GuidaCondivisa.annullaModifica()
                        },
                    )
                } else if (stato.modo == Modo.Normale) SchedaViaggio(modello, stato)
                if (!stato.rete) {
                    Spacer(Modifier.height(6.dp))
                    Riquadro(Extra.colori.avvisoSfondo, Extra.colori.avviso) {
                        Text("Nessuna connessione. Il percorso già calcolato resta visibile, ma ricerca e calcolo non sono disponibili (l'app non calcola percorsi offline).", style = MaterialTheme.typography.bodySmall)
                    }
                }
                if (!permesso) {
                    Spacer(Modifier.height(6.dp))
                    Riquadro(Extra.colori.avvisoSfondo, Extra.colori.avviso, Modifier.clickable {
                        richiestaPermessi.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
                    }) {
                        Text("Permesso di posizione non concesso: tocca qui per concederlo (serve per la guida).", style = MaterialTheme.typography.bodySmall)
                    }
                }
            }

            // ---------- A destra: posizione, annulla, ripristina ----------
            Column(
                Modifier.align(Alignment.CenterEnd).padding(end = 12.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                PulsanteTondo(IconeExtra.MiaPosizione, "Centra sulla mia posizione") {
                    stato.posizione?.let { controllore.centra(it, maxOf(controllore.zoom(), 15.0)) }
                        ?: modello.messaggio("Posizione non ancora disponibile.")
                }
                SceltaMappa(modello, dati.impostazioni.mappaBase, dati.impostazioni.chiaveArcgis.isNotBlank())
                PulsanteTondo(IconeExtra.Annulla, "Annulla", attivo = stato.puoAnnullare) { modello.annulla() }
                PulsanteTondo(IconeExtra.Ripristina, "Ripristina", attivo = stato.puoRipristinare) { modello.ripristina() }
            }

            // ---------- In basso ----------
            Column(
                Modifier.align(Alignment.BottomCenter).fillMaxWidth().navigationBarsPadding().padding(horizontal = 12.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                SnackbarHost(avvisi)
                stato.menuPunto?.let { p -> MenuPunto(p, modello) }
                stato.quotaPunto?.let { (_, testo) ->
                    Surface(shape = RoundedCornerShape(16.dp), shadowElevation = 4.dp, color = MaterialTheme.colorScheme.surface) {
                        Row(Modifier.padding(start = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text(testo, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                            TextButton(onClick = { modello.chiudiQuota() }) { Text("Chiudi") }
                        }
                    }
                }
                if (stato.modo is Modo.Modifica) {
                    PannelloModifica(modello, stato)
                } else if (stato.modo != Modo.Normale) {
                    PannelloModo(modello, stato)
                } else {
                    if (stato.esito != null || stato.calcoloInCorso) RiepilogoPercorso(modello, stato)
                    BarraAzioni(modello, stato, avvia, inGuida = guida.modifica)
                }
            }
        }

        // ---------- Fogli ----------
        val foglio = stato.foglio
        if (foglio != null && (!guida.attiva || guida.modifica)) {
            ModalBottomSheet(
                onDismissRequest = { modello.apri(null) },
                sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
            ) {
                Box(Modifier.fillMaxWidth().imePadding()) {
                    when (foglio) {
                        Foglio.MENU_EVITA -> MenuEvita(modello, stato)
                        Foglio.MENU_PASSA -> MenuPassa(modello)
                        Foglio.VINCOLI -> FoglioVincoli(modello, stato)
                        Foglio.TAPPE -> FoglioTappe(modello, stato)
                        Foglio.DETTAGLI -> FoglioDettagli(modello, stato)
                        Foglio.SALVATI -> FoglioSalvati(modello, dati)
                        Foglio.RICERCA -> FoglioRicerca(modello, stato, dati)
                        Foglio.IMPOSTAZIONI -> FoglioImpostazioni(modello, dati)
                        Foglio.INFORMAZIONI -> FoglioInformazioni()
                    }
                }
            }
        }
    }
}

private fun haPermessoPosizione(c: android.content.Context) =
    c.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
        c.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

/** Collega il ciclo di vita della MapView a quello della schermata (obbligatorio per MapLibre). */
@Composable
private fun CicloDiVitaMappa(v: MapView) {
    val ciclo = LocalLifecycleOwner.current.lifecycle
    DisposableEffect(ciclo) {
        val o = LifecycleEventObserver { _, e ->
            when (e) {
                Lifecycle.Event.ON_START -> v.onStart()
                Lifecycle.Event.ON_RESUME -> v.onResume()
                Lifecycle.Event.ON_PAUSE -> v.onPause()
                Lifecycle.Event.ON_STOP -> v.onStop()
                else -> {}
            }
        }
        ciclo.addObserver(o)
        onDispose { ciclo.removeObserver(o) }
    }
}

/** Costruisce ciò che va disegnato sopra la mappa a partire dallo stato. */
private fun datiMappa(modello: ModelloApp, s: StatoUi, guida: com.ric.navigatore.guida.StatoNavigazione?): DatiMappa {
    if (guida != null) {
        val v = guida.viaggio
        val p = guida.percorso
        return DatiMappa(
            percorso = p?.geometria,
            fermate = v?.let { modello.fermateDaDisegnare(it) } ?: emptyList(),
            vincoli = v?.vincoliAttivi ?: emptyList(),
            // punto esplorato lungo il percorso (cursore o ricerca a voce)
            puntoProfilo = guida.esplorazione?.let { e -> p?.let { Geo.puntoAProgressiva(it.geometria, e.progressiva) } },
        )
    }
    val sel = s.selezione
    val linee = mutableListOf<List<Punto>>()
    val aree = mutableListOf<com.ric.navigatore.nucleo.geo.Poligono>()
    val punti = mutableListOf<Punto>()
    val collegamenti = mutableListOf<List<Punto>>()
    // strade fra cui scegliere
    sel.candidati.forEach { linee += it.strada.linea }
    // tratto scelto (+ la fascia che verrà davvero esclusa)
    sel.linea?.let { l ->
        linee += l
        val evita = s.modo == Modo.Strada(true) || s.modo == Modo.PezzoPercorso
        if (evita && l.size >= 2) aree += EvitaTratto(nome = "", linea = l, larghezzaFascia = sel.larghezza).aree()
    }
    if (sel.attesaFine) sel.scelto?.let { linee += it.strada.linea }
    // punto toccato e punto agganciato alla strada
    sel.tocco?.let { punti += it }
    sel.agganciato?.let { a -> punti += a.agganciato; sel.tocco?.let { t -> collegamenti += listOf(t, a.agganciato) } }
    // disegno di un'area
    if (s.modo is Modo.Disegno) {
        punti += sel.vertici
        val area = modello.areaDisegnata(sel)
        if (area != null) aree += area else if (sel.vertici.size >= 2) linee += sel.vertici
    }
    // modifica di un vincolo: contorno ambra e maniglie
    val maniglie = mutableListOf<Punto>()
    val secondarie = mutableListOf<Punto>()
    modello.vincoloSelezionato(s)?.let { v ->
        when (v) {
            is com.ric.navigatore.nucleo.modello.EvitaArea -> aree += v.poligono
            is com.ric.navigatore.nucleo.modello.PassaArea -> aree += v.poligono
            is EvitaTratto -> linee += v.linea
            is com.ric.navigatore.nucleo.modello.PassaTratto -> linee += v.linea
            else -> {}
        }
        com.ric.navigatore.nucleo.modello.Modifiche.maniglie(v).forEach { m ->
            if (m.tipo == com.ric.navigatore.nucleo.modello.TipoManiglia.META_LATO) secondarie += m.punto else maniglie += m.punto
        }
    }
    s.quotaPunto?.let { punti += it.first }
    val e = s.esito
    return DatiMappa(
        percorso = s.percorsoScelto?.geometria,
        alternative = modello.altriPercorsi(s).map(Percorso::geometria),
        iniziale = s.iniziale?.geometria?.takeIf { e?.percorso != null },
        scartato = e?.percorsoScartato?.geometria?.takeIf { e.percorso == null },
        fermate = modello.fermateDaDisegnare(s.viaggio),
        vincoli = s.viaggio.vincoli,
        anteprimaLinee = linee, anteprimaAree = aree, anteprimaPunti = punti, anteprimaCollegamenti = collegamenti,
        maniglie = maniglie, maniglieSecondarie = secondarie, manigliaScelta = sel.maniglia?.punto,
        puntoProfilo = s.puntoProfilo,
    )
}

// =====================================================================
// Pezzi della schermata
// =====================================================================

@Composable
private fun PulsanteTondo(icona: androidx.compose.ui.graphics.vector.ImageVector, descrizione: String, attivo: Boolean = true, onClick: () -> Unit) {
    Surface(
        onClick = onClick, enabled = attivo, shape = RoundedCornerShape(50), shadowElevation = 4.dp,
        color = MaterialTheme.colorScheme.surface,
        contentColor = if (attivo) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f),
        modifier = Modifier.size(52.dp),
    ) {
        Box(contentAlignment = Alignment.Center) { Icon(icona, contentDescription = descrizione) }
    }
}

/** Scheda in alto con partenza, tappe e destinazione. */
@Composable
private fun SchedaViaggio(modello: ModelloApp, s: StatoUi) {
    var menu by remember { mutableStateOf(false) }
    val v = s.viaggio
    Surface(shape = RoundedCornerShape(20.dp), shadowElevation = 6.dp, color = MaterialTheme.colorScheme.surface) {
        Row(Modifier.padding(start = 14.dp, end = 4.dp, top = 6.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                RigaLuogo("Da", v.partenza?.nome, "Scegli la partenza") { modello.apriRicerca(Scopo.PARTENZA) }
                if (v.tappe.isNotEmpty()) {
                    Text(
                        if (v.tappe.size == 1) "1 tappa intermedia" else "${v.tappe.size} tappe intermedie",
                        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.clickable { modello.apri(Foglio.TAPPE) }.padding(start = 34.dp, top = 2.dp, bottom = 2.dp),
                    )
                }
                HorizontalDivider(Modifier.padding(start = 34.dp), color = MaterialTheme.colorScheme.outlineVariant)
                RigaLuogo("A", v.arrivo?.nome, "Dove vuoi andare?") { modello.apriRicerca(Scopo.ARRIVO) }
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                IconButton(onClick = { modello.inverti() }) { Icon(IconeExtra.Inverti, "Inverti partenza e destinazione") }
                IconButton(onClick = { modello.apriRicerca(Scopo.TAPPA) }) { Icon(Icons.Default.Add, "Aggiungi una tappa") }
            }
            Box {
                IconButton(onClick = { menu = true }) { Icon(Icons.Default.Menu, "Menu") }
                DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                    val voce: @Composable (String, () -> Unit) -> Unit = { t, f -> DropdownMenuItem(text = { Text(t) }, onClick = { menu = false; f() }) }
                    voce("Tappe e opzioni") { modello.apri(Foglio.TAPPE) }
                    voce("Vincoli (${v.vincoli.size})") { modello.apri(Foglio.VINCOLI) }
                    voce("Preferiti, percorsi salvati, cronologia") { modello.apri(Foglio.SALVATI) }
                    voce("Nuovo viaggio") { modello.nuovoViaggio() }
                    HorizontalDivider()
                    voce("Impostazioni e chiave") { modello.apri(Foglio.IMPOSTAZIONI) }
                    voce("Privacy, fonti e licenze") { modello.apri(Foglio.INFORMAZIONI) }
                }
            }
        }
    }
}

@Composable
private fun RigaLuogo(sigla: String, nome: String?, segnaposto: String, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 9.dp), verticalAlignment = Alignment.CenterVertically) {
        Surface(shape = RoundedCornerShape(50), color = MaterialTheme.colorScheme.secondaryContainer, modifier = Modifier.size(24.dp)) {
            Box(contentAlignment = Alignment.Center) { Text(sigla, style = MaterialTheme.typography.labelSmall) }
        }
        Spacer(Modifier.width(10.dp))
        Text(
            nome ?: segnaposto, style = MaterialTheme.typography.bodyLarge,
            color = if (nome == null) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
        )
    }
}

/** Menu del tocco lungo sulla mappa. */
@Composable
private fun MenuPunto(p: Punto, modello: ModelloApp) {
    Surface(shape = RoundedCornerShape(20.dp), shadowElevation = 6.dp, color = MaterialTheme.colorScheme.surface) {
        Column(Modifier.padding(12.dp)) {
            Text("Questo punto", style = MaterialTheme.typography.titleSmall)
            Text("%.5f, %.5f".format(Locale.ITALY, p.lat, p.lon), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(6.dp))
            @OptIn(ExperimentalLayoutApi::class)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(
                    "Parti da qui" to "partenza", "Vai qui" to "arrivo", "Aggiungi tappa" to "tappa",
                    "Passa da qui" to "passa", "Evita questa strada" to "evita", "Salva nei preferiti" to "preferito", "Altitudine qui" to "quota",
                ).forEach { (t, a) -> AssistChip(onClick = { modello.azioneMenu(p, a) }, label = { Text(t) }) }
            }
            TextButton(onClick = { modello.chiudiMenuPunto() }, modifier = Modifier.align(Alignment.End)) { Text("Chiudi") }
        }
    }
}

/** Riepilogo del percorso calcolato: distanza, tempo, confronto e validità. */
@Composable
private fun RiepilogoPercorso(modello: ModelloApp, s: StatoUi) {
    val e = s.esito
    val p = s.percorsoScelto
    Surface(
        onClick = { modello.apri(Foglio.DETTAGLI) }, shape = RoundedCornerShape(20.dp), shadowElevation = 6.dp,
        color = MaterialTheme.colorScheme.surface,
    ) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            when {
                s.calcoloInCorso -> Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.5.dp)
                    Spacer(Modifier.width(12.dp))
                    Text("Calcolo e verifica del percorso…", style = MaterialTheme.typography.bodyLarge)
                }
                p != null && e != null -> {
                    Row(verticalAlignment = Alignment.Bottom) {
                        Text(formattaDurata(p.durata), style = MaterialTheme.typography.headlineSmall, color = Extra.colori.percorso)
                        Spacer(Modifier.width(10.dp))
                        Text(formattaDistanza(p.distanza), style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Text("Arrivo verso le ${ora(System.currentTimeMillis() + (p.durata * 1000).toLong())} · stima senza traffico", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    s.iniziale?.let { i -> Text(confronto(p, i), style = MaterialTheme.typography.bodySmall) }
                    val su = p.salita
                    val giu = p.discesa
                    if (su != null && giu != null) {
                        Text("Dislivello: ↗ ${su.roundToInt()} m · ↘ ${giu.roundToInt()} m", style = MaterialTheme.typography.bodySmall)
                    }
                    val nonRispettati = e.preferitiNonRispettati.size
                    when {
                        !e.rapporto.valido -> Text("✗ Alcuni vincoli obbligatori non risultano rispettati: vedi dettagli", color = Extra.colori.esclusione, style = MaterialTheme.typography.bodySmall)
                        nonRispettati > 0 -> Text("! $nonRispettati vincoli preferiti non rispettati · tocca per i dettagli", color = Extra.colori.avviso, style = MaterialTheme.typography.bodySmall)
                        s.viaggio.vincoliAttivi.isNotEmpty() -> Text("✓ Vincoli verificati sul percorso", color = Extra.colori.passaggio, style = MaterialTheme.typography.bodySmall)
                    }
                    if (s.daRicalcolare) Text("Hai cambiato tappe o vincoli: premi «Ricalcola».", color = Extra.colori.avviso, style = MaterialTheme.typography.bodySmall)
                    val tutte = listOfNotNull(e.percorso) + e.alternative
                    if (tutte.size > 1) {
                        SceltaPillole(
                            tutte.indices.toList(), s.sceltaAlternativa,
                            { i -> if (i == 0) "Consigliato · ${formattaDurata(tutte[i].durata)}" else "Alternativa $i · ${formattaDurata(tutte[i].durata)}" },
                            { modello.scegliAlternativa(it) },
                        )
                    }
                }
                e != null -> {
                    Text("Nessun percorso valido", style = MaterialTheme.typography.titleMedium, color = Extra.colori.esclusione)
                    Text(e.errore?.messaggio ?: e.conflitti.firstOrNull()?.messaggio ?: "Il calcolo non è riuscito.", style = MaterialTheme.typography.bodySmall)
                    Text("Tocca per vedere la spiegazione e cosa modificare.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
                }
            }
        }
    }
}

fun ora(ms: Long): String = SimpleDateFormat("HH:mm", Locale.ITALY).format(Date(ms))

/** "Rispetto al percorso senza vincoli: +2,1 km e +4 min". */
fun confronto(p: Percorso, iniziale: Percorso): String {
    val dk = (p.distanza - iniziale.distanza) / 1000
    val dm = ((p.durata - iniziale.durata) / 60).roundToInt()
    val km = "%+.1f km".format(Locale.ITALY, dk)
    val min = (if (dm >= 0) "+" else "") + "$dm min"
    return "Rispetto al percorso senza vincoli: $km e $min"
}

/** Barra in basso con i cinque pulsanti principali. */
@Composable
private fun BarraAzioni(modello: ModelloApp, s: StatoUi, avvia: () -> Unit, inGuida: Boolean = false) {
    Surface(shape = RoundedCornerShape(22.dp), shadowElevation = 8.dp, color = MaterialTheme.colorScheme.surface) {
        Row(Modifier.padding(6.dp), horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.CenterVertically) {
            PulsanteBarra("Evita", IconeExtra.Divieto, { modello.apri(Foglio.MENU_EVITA) }, colore = Extra.colori.esclusione)
            PulsanteBarra("Passa da", Icons.Default.Place, { modello.apri(Foglio.MENU_PASSA) }, colore = Extra.colori.passaggio)
            PulsanteBarra("Disegna area", Icons.Default.Edit, { modello.avviaModo(Modo.Disegno(ObiettivoArea.EVITA)) })
            // durante la guida il ricalcolo si fa con «Applica» (parte da dove sei)
            if (!inGuida) {
                PulsanteBarra("Ricalcola", Icons.Default.Refresh, { modello.calcola() }, attivo = s.viaggio.pronto && !s.calcoloInCorso)
                PulsanteBarra("Avvia", IconeExtra.Navigazione, avvia, attivo = s.percorsoScelto != null, evidenziato = s.percorsoScelto != null)
            }
        }
    }
}


/** Pulsante tondo «Mappa»: scelta fra stradale, satellite, ibrida, topografica. */
@Composable
private fun SceltaMappa(modello: ModelloApp, attuale: com.ric.navigatore.dati.MappaBase, haChiaveArcgis: Boolean) {
    var aperto by remember { mutableStateOf(false) }
    Box {
        PulsanteTondo(IconeExtra.Livelli, "Tipo di mappa") { aperto = true }
        DropdownMenu(expanded = aperto, onDismissRequest = { aperto = false }) {
            com.ric.navigatore.dati.MappaBase.entries.forEach { b ->
                DropdownMenuItem(
                    text = {
                        Column(Modifier.widthIn(max = 280.dp)) {
                            Text(b.etichetta + if (b == attuale) "  ✓" else "", style = MaterialTheme.typography.bodyLarge)
                            val nota = if (b == com.ric.navigatore.dati.MappaBase.SATELLITE_HD && !haChiaveArcgis)
                                "Serve la chiave ArcGIS gratuita (Impostazioni). Senza, mostro il satellite Sentinel-2." else b.spiegazione
                            Text(nota, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    },
                    onClick = { aperto = false; modello.cambiaImpostazioni { it.copy(mappaBase = b) } },
                )
            }
        }
    }
}
