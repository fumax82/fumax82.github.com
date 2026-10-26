/*
 * SchermataPlayer.kt
 * Schermata principale di lavoro:
 *   - in alto: titolo, contatore foto, stato audio, pulsanti Home e Termina
 *   - il video su fondo nero
 *   - tempo attuale (al decimo di secondo), Play/Pausa, ±1 fotogramma
 *   - la barra di scorrimento a ritorno automatico
 *   - i quattro pulsanti colorati di cattura
 * Dopo ogni cattura si apre la finestra del commento.
 */
package it.formazione.videotutorial.schermate

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.input.TextFieldValue
import androidx.core.content.ContextCompat
import android.graphics.Color as ColoreAndroid
import androidx.activity.compose.BackHandler
import androidx.annotation.OptIn
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.DialogProperties
import androidx.media3.common.util.UnstableApi
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import it.formazione.videotutorial.archivio.NomiFile
import it.formazione.videotutorial.modello.Passo
import it.formazione.videotutorial.modello.TipoPasso
import kotlinx.coroutines.delay

@Composable
fun SchermataPlayer(vm: ProgettoViewModel) {
    val progetto = vm.progetto ?: return
    val player = vm.player

    // Tempo attuale del video, aggiornato 20 volte al secondo
    // (così anche la striscia di anteprime scorre in modo fluido)
    var posizioneMs by remember { mutableLongStateOf(0L) }
    LaunchedEffect(player) {
        while (true) {
            posizioneMs = player?.currentPosition ?: 0L
            delay(50)
        }
    }

    // Tasto indietro del telefono: torna alla Home
    BackHandler { vm.tornaHome() }

    val numeroFoto = progetto.passi.size
    val troppeFoto = numeroFoto > ProgettoViewModel.SOGLIA_FOTO

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .safeDrawingPadding(),
    ) {
        // --- Barra in alto ---
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surface)
                .padding(horizontal = 4.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TextButton(onClick = { vm.tornaHome() }) { Text("← Home") }
            Column(Modifier.weight(1f)) {
                Text(
                    progetto.scheda.titolo,
                    style = MaterialTheme.typography.titleSmall,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    "Foto: $numeroFoto${if (troppeFoto) " (oltre ${ProgettoViewModel.SOGLIA_FOTO}!)" else ""}" +
                        (if (vm.fotoInSalvataggio > 0) " · salvo ${vm.fotoInSalvataggio}…" else "") +
                        " · ${progetto.statoAudio.descrizione}",
                    style = MaterialTheme.typography.bodySmall,
                    color = if (troppeFoto) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Button(onClick = { vm.apriTermina() }) { Text("Termina") }
        }

        // --- Video ---
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .background(Color.Black),
            contentAlignment = Alignment.Center,
        ) {
            VistaVideo(vm)
        }

        // --- Striscia di anteprime dell'intero video (tocca per saltare) ---
        StrisciaAnteprime(
            miniature = vm.miniature,
            intervalloMs = vm.intervalloMiniatureMs,
            durataMs = vm.durataMs(),
            posizioneMs = posizioneMs,
            passi = progetto.passi,
            onTocco = { tempo -> vm.vaiA(tempo) },
        )

        // --- Comandi ---
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surface)
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            // Tempo e velocità
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "${NomiFile.tempoFoto(posizioneMs)} / ${NomiFile.tempoFoto(vm.durataMs())}",
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    CurvaVelocita.descrivi(vm.velocitaScorrimento),
                    fontFamily = FontFamily.Monospace,
                    color = MaterialTheme.colorScheme.primary,
                )
            }

            // Segnalibro precedente, ±1 fotogramma, Play/Pausa, segnalibro successivo
            val precedente = vm.segnalibroPrecedente(posizioneMs)
            val successivo = vm.segnalibroSuccessivo(posizioneMs)
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                PulsanteSegnalibro(
                    testo = "◀ " + (precedente?.let { codiceDi(progetto.passi, it) } ?: "—"),
                    attivo = precedente != null,
                    modifier = Modifier.weight(1f),
                ) { precedente?.let { vm.vaiA(it.tempoMs) } }
                PulsanteCompatto("−1", Modifier.weight(0.8f)) { vm.fotogramma(-1) }
                Button(
                    onClick = { vm.playPausa() },
                    contentPadding = PaddingValues(horizontal = 4.dp),
                    modifier = Modifier.weight(1.2f),
                ) {
                    Text(if (vm.inRiproduzione) "Pausa" else "Play", maxLines = 1)
                }
                PulsanteCompatto("+1", Modifier.weight(0.8f)) { vm.fotogramma(+1) }
                PulsanteSegnalibro(
                    testo = (successivo?.let { codiceDi(progetto.passi, it) } ?: "—") + " ▶",
                    attivo = successivo != null,
                    modifier = Modifier.weight(1f),
                ) { successivo?.let { vm.vaiA(it.tempoMs) } }
            }

            // Barra di scorrimento a ritorno automatico
            BarraScorrimento(
                onInizio = { vm.iniziaScorrimento() },
                onVelocita = { vm.aggiornaScorrimento(it) },
                onFine = { vm.fineScorrimento() },
            )

            // Quattro pulsanti di cattura (due righe da due)
            TipoPasso.entries.chunked(2).forEach { riga ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    riga.forEach { tipo ->
                        PulsanteCattura(
                            tipo = tipo,
                            attivo = true, // sempre attivi: il salvataggio avviene in sottofondo
                            modifier = Modifier.weight(1f),
                        ) { vm.cattura(tipo) }
                    }
                }
            }
        }
    }

    // --- Finestra del commento dopo la cattura ---
    val passo = progetto.passi.firstOrNull { it.id == vm.passoInCommento }
    if (passo != null) {
        FinestraCommento(
            passo = passo,
            numero = progetto.numeroDi(passo.id),
            onSalva = { testo -> vm.salvaCommento(passo.id, testo) },
            onSalta = { vm.saltaCommento() },
            onElimina = { vm.eliminaPasso(passo.id) },
        )
    }

    // --- Finestra "Termina" ---
    if (vm.finestraTermina) {
        FinestraTermina(
            noteIniziali = progetto.noteFinali,
            audioInLavorazione = progetto.statoAudio.inLavorazione,
            onTermina = { note -> vm.termina(note) },
            onAnnulla = { vm.chiudiTermina() },
        )
    }
}

/** Il lettore video di Media3, senza i suoi comandi (usiamo i nostri). */
@OptIn(UnstableApi::class)
@Composable
private fun VistaVideo(vm: ProgettoViewModel) {
    val player = vm.player
    AndroidView(
        factory = { contesto ->
            PlayerView(contesto).apply {
                useController = false
                keepScreenOn = true
                resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
                setShutterBackgroundColor(ColoreAndroid.BLACK)
            }
        },
        update = { vista -> vista.player = player },
        onRelease = { vista -> vista.player = null },
        modifier = Modifier.fillMaxSize(),
    )
}

/** Codice del segnalibro (P01, P02...) in base alla sua posizione nell'elenco. */
private fun codiceDi(passi: List<Passo>, passo: Passo): String =
    NomiFile.codicePasso(passi.indexOfFirst { it.id == passo.id } + 1)

/** Pulsante per andare al segnalibro precedente o successivo. */
@Composable
private fun PulsanteSegnalibro(testo: String, attivo: Boolean, modifier: Modifier, onClick: () -> Unit) {
    OutlinedButton(
        onClick = onClick,
        enabled = attivo,
        contentPadding = PaddingValues(horizontal = 4.dp),
        modifier = modifier,
    ) {
        Text(testo, maxLines = 1, fontWeight = FontWeight.Bold)
    }
}

/** Pulsante piccolo (±1 fotogramma). */
@Composable
private fun PulsanteCompatto(testo: String, modifier: Modifier, onClick: () -> Unit) {
    OutlinedButton(onClick = onClick, contentPadding = PaddingValues(horizontal = 2.dp), modifier = modifier) {
        Text(testo, maxLines = 1)
    }
}

/** Pulsante colorato di cattura per un tipo di passo. */
@Composable
private fun PulsanteCattura(tipo: TipoPasso, attivo: Boolean, modifier: Modifier, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        enabled = attivo,
        colors = ButtonDefaults.buttonColors(containerColor = Color(tipo.colore), contentColor = Color.White),
        modifier = modifier.height(52.dp),
    ) {
        Text(tipo.etichetta, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/**
 * Finestra con il commento della foto appena catturata: Salva, Salta, Elimina foto.
 * Appena si apre, il cursore è già nel campo e parte la dettatura: basta parlare.
 */
@Composable
private fun FinestraCommento(
    passo: Passo,
    numero: Int,
    onSalva: (String) -> Unit,
    onSalta: () -> Unit,
    onElimina: () -> Unit,
) {
    // Testo del campo con la posizione del cursore (sempre in fondo dopo una dettatura)
    var campo by remember(passo.id) {
        mutableStateOf(TextFieldValue(passo.commento, TextRange(passo.commento.length)))
    }
    val dettatura = rememberDettatura { frase -> campo = aggiungiFrase(campo, frase) }
    val contesto = LocalContext.current
    val focus = remember { FocusRequester() }

    // Permesso del microfono: chiesto solo la prima volta
    val richiestaPermesso = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { concesso ->
        if (concesso) dettatura.avvia()
    }
    val avviaDettatura = {
        val permesso = ContextCompat.checkSelfPermission(contesto, Manifest.permission.RECORD_AUDIO)
        if (permesso == PackageManager.PERMISSION_GRANTED) {
            dettatura.avvia()
        } else {
            richiestaPermesso.launch(Manifest.permission.RECORD_AUDIO)
        }
    }

    // All'apertura: cursore nel campo e dettatura avviata
    LaunchedEffect(passo.id) {
        delay(150) // attende che la finestra sia sullo schermo
        try {
            focus.requestFocus()
        } catch (_: IllegalStateException) {
        }
        avviaDettatura()
    }

    // Testo da salvare, comprese le parole dette ma non ancora confermate
    val testoFinale = { aggiungiFrase(campo, dettatura.prendiParziale()).text }

    AlertDialog(
        onDismissRequest = onSalta,
        properties = DialogProperties(dismissOnClickOutside = false),
        title = {
            Text("Foto ${NomiFile.codicePasso(numero)} · ${passo.tipo.testoPerClaude} · ${NomiFile.tempoFoto(passo.tempoMs)}")
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                OutlinedTextField(
                    value = campo,
                    onValueChange = { campo = it },
                    label = { Text("Commento") },
                    placeholder = { Text("Cosa si vede, cosa fare, a cosa stare attenti…") },
                    minLines = 3,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                    modifier = Modifier
                        .fillMaxWidth()
                        .focusRequester(focus),
                )
                // Stato della dettatura e tasto Ferma / Detta
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = if (dettatura.inAscolto) {
                            "🎤 In ascolto… ${dettatura.testoParziale}"
                        } else {
                            dettatura.avviso ?: "Tocca \"Detta\" per aggiungere altro a voce."
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = if (dettatura.inAscolto) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.weight(1f),
                    )
                    if (dettatura.inAscolto) {
                        TextButton(onClick = { dettatura.ferma() }) { Text("■ Ferma") }
                    } else {
                        TextButton(onClick = avviaDettatura) { Text("🎤 Detta") }
                    }
                }
            }
        },
        // "Elimina foto" a sinistra, "Salta" e "Salva" a destra
        // (su schermi stretti Android li dispone su due righe)
        dismissButton = {
            TextButton(onClick = onElimina) {
                Text("Elimina foto", color = MaterialTheme.colorScheme.error)
            }
        },
        confirmButton = {
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                TextButton(onClick = onSalta) { Text("Salta") }
                Button(onClick = { onSalva(testoFinale()) }) { Text("Salva") }
            }
        },
    )
}

/** Aggiunge una frase dettata in fondo al testo e mette il cursore alla fine. */
private fun aggiungiFrase(campo: TextFieldValue, frase: String): TextFieldValue {
    if (frase.isBlank()) return campo
    val base = campo.text.trimEnd()
    val nuovo = if (base.isEmpty()) frase.trim().replaceFirstChar { it.titlecase() } else "$base ${frase.trim()}"
    return TextFieldValue(nuovo, TextRange(nuovo.length))
}

/** Finestra di fine lavoro con le note finali dell'autore. */
@Composable
private fun FinestraTermina(
    noteIniziali: String,
    audioInLavorazione: Boolean,
    onTermina: (String) -> Unit,
    onAnnulla: () -> Unit,
) {
    var note by remember { mutableStateOf(noteIniziali) }
    AlertDialog(
        onDismissRequest = onAnnulla,
        properties = DialogProperties(dismissOnClickOutside = false),
        title = { Text("Termina il lavoro") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "Aggiungi le informazioni che nel video non compaiono: tempi, attrezzi, avvertenze generali.",
                    style = MaterialTheme.typography.bodyMedium,
                )
                OutlinedTextField(
                    value = note,
                    onValueChange = { note = it },
                    label = { Text("Note finali") },
                    minLines = 4,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                    modifier = Modifier.fillMaxWidth(),
                )
                if (audioInLavorazione) {
                    Text(
                        "L'audio è ancora in estrazione: la cartella diventerà COMPLETA appena finisce.",
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
        },
        confirmButton = { Button(onClick = { onTermina(note) }) { Text("Termina") } },
        dismissButton = { TextButton(onClick = onAnnulla) { Text("Annulla") } },
    )
}
