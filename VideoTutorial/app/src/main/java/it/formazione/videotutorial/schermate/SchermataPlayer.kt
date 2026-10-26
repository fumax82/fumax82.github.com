/*
 * SchermataPlayer.kt
 * Schermata principale di lavoro (sempre in tema scuro):
 *   - in alto: ←, titolo, contatore foto, stato audio, pulsante Termina
 *   - il video, con in alto il sottotitolo della frase pronunciata (se il
 *     parlato è stato trascritto); sopra la striscia compare il fumetto del
 *     segnalibro su cui si trova il video (toccalo per modificarlo)
 *   - la striscia di anteprime dell'intero video
 *   - tempo, velocità, tasti segnalibro ◀ ▶, ±1 fotogramma, Play/Pausa
 *   - la barra di scorrimento a ritorno automatico
 *   - i quattro pulsanti colorati di cattura (oppure, durante lo spostamento
 *     di un segnalibro, i tasti "Annulla" e "Fissa qui")
 */
package it.formazione.videotutorial.schermate

import android.graphics.Color as ColoreAndroid
import androidx.activity.compose.BackHandler
import androidx.annotation.OptIn
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.util.UnstableApi
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import it.formazione.videotutorial.archivio.NomiFile
import it.formazione.videotutorial.modello.Passo
import it.formazione.videotutorial.modello.ProgettoVideo
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

    // Segnalibro da eliminare in attesa di conferma
    var daEliminare by remember { mutableStateOf<String?>(null) }

    // Tasto indietro del telefono: annulla lo spostamento, altrimenti torna alla Home
    BackHandler {
        if (vm.passoInSpostamento != null) vm.annullaSpostamento() else vm.tornaHome()
    }

    val inSpostamento = progetto.passi.firstOrNull { it.id == vm.passoInSpostamento }
    // Segnalibro su cui si trova il video (per il fumetto)
    val segnalibroQui = vm.segnalibroQui(posizioneMs)
    val mostraFumetto = segnalibroQui != null && inSpostamento == null && vm.passoInCommento == null &&
        !vm.inRiproduzione && vm.velocitaScorrimento == 0f

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .safeDrawingPadding(),
    ) {
        BarraSuperiore(vm, progetto)

        // --- Video con il fumetto del segnalibro ---
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .background(Color.Black),
            contentAlignment = Alignment.Center,
        ) {
            VistaVideo(vm)

            // Sottotitolo: la frase pronunciata in questo momento (se trascritta)
            progetto.fraseAl(posizioneMs)?.let { frase ->
                Text(
                    frase.testo,
                    color = Color.White,
                    style = MaterialTheme.typography.bodyMedium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier
                        .align(Alignment.TopCenter)
                        .padding(8.dp)
                        .background(Color.Black.copy(alpha = 0.6f), MaterialTheme.shapes.small)
                        .padding(horizontal = 10.dp, vertical = 4.dp),
                )
            }

            if (mostraFumetto && segnalibroQui != null) {
                FumettoSegnalibro(
                    passo = segnalibroQui,
                    numero = progetto.numeroDi(segnalibroQui.id),
                    onModifica = { vm.apriModificaPasso(segnalibroQui.id) },
                    onSposta = { vm.iniziaSpostamento(segnalibroQui.id) },
                    onElimina = { daEliminare = segnalibroQui.id },
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(horizontal = 12.dp),
                )
            }
        }

        // --- Striscia di anteprime dell'intero video (tocca per saltare) ---
        StrisciaAnteprime(
            miniature = vm.miniature,
            intervalloMs = vm.intervalloMiniatureMs,
            durataMs = vm.durataMs(),
            posizioneMs = posizioneMs,
            passi = progetto.passi,
            onTocco = { tempo -> vm.vaiA(tempo) },
            idInSpostamento = vm.passoInSpostamento,
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
                    NomiFile.tempoFoto(posizioneMs),
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.titleMedium,
                )
                Text(
                    " / ${NomiFile.tempoFoto(vm.durataMs())}",
                    fontFamily = FontFamily.Monospace,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    CurvaVelocita.descrivi(vm.velocitaScorrimento),
                    fontFamily = FontFamily.Monospace,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.primary,
                )
            }

            // Segnalibro precedente, −1, Play/Pausa, +1, segnalibro successivo
            val precedente = vm.segnalibroPrecedente(posizioneMs)
            val successivo = vm.segnalibroSuccessivo(posizioneMs)
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                PulsanteSegnalibro(
                    testo = "◀ " + (precedente?.let { NomiFile.codicePasso(progetto.numeroDi(it.id)) } ?: "—"),
                    attivo = precedente != null,
                    modifier = Modifier.weight(1f),
                ) { precedente?.let { vm.vaiA(it.tempoMs) } }
                PulsanteCompatto("−1", Modifier.weight(0.75f)) { vm.fotogramma(-1) }
                Button(
                    onClick = { vm.playPausa() },
                    contentPadding = PaddingValues(horizontal = 4.dp),
                    modifier = Modifier.weight(1.3f),
                ) {
                    Text(if (vm.inRiproduzione) "⏸ Pausa" else "▶ Play", maxLines = 1, fontWeight = FontWeight.Bold)
                }
                PulsanteCompatto("+1", Modifier.weight(0.75f)) { vm.fotogramma(+1) }
                PulsanteSegnalibro(
                    testo = (successivo?.let { NomiFile.codicePasso(progetto.numeroDi(it.id)) } ?: "—") + " ▶",
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

            if (inSpostamento != null) {
                // Durante lo spostamento: istruzioni e conferma al posto della cattura
                PannelloSpostamento(
                    passo = inSpostamento,
                    numero = progetto.numeroDi(inSpostamento.id),
                    posizioneMs = posizioneMs,
                    onAnnulla = { vm.annullaSpostamento() },
                    onConferma = { vm.confermaSpostamento() },
                )
            } else {
                // Quattro pulsanti di cattura (due righe da due)
                TipoPasso.entries.chunked(2).forEach { riga ->
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        riga.forEach { tipo ->
                            PulsanteCattura(tipo = tipo, modifier = Modifier.weight(1f)) { vm.cattura(tipo) }
                        }
                    }
                }
            }
        }
    }

    // --- Finestra del segnalibro (nuova foto o modifica) ---
    val inModifica = progetto.passi.firstOrNull { it.id == vm.passoInCommento }
    if (inModifica != null) {
        FinestraPasso(
            passo = inModifica,
            numero = progetto.numeroDi(inModifica.id),
            nuovo = vm.commentoDiNuovaFoto,
            onSalva = { testo, tipo -> vm.salvaPasso(inModifica.id, testo, tipo) },
            onChiudi = { vm.chiudiFinestraPasso() },
            onElimina = {
                if (vm.commentoDiNuovaFoto) {
                    vm.eliminaPasso(inModifica.id) // foto appena fatta: niente conferma
                } else {
                    vm.chiudiFinestraPasso()
                    daEliminare = inModifica.id
                }
            },
        )
    }

    // --- Conferma di eliminazione ---
    val passoDaEliminare = progetto.passi.firstOrNull { it.id == daEliminare }
    if (passoDaEliminare != null) {
        FinestraConfermaEliminazione(
            numero = progetto.numeroDi(passoDaEliminare.id),
            onConferma = {
                vm.eliminaPasso(passoDaEliminare.id)
                daEliminare = null
            },
            onAnnulla = { daEliminare = null },
        )
    }

    // --- Finestra "Termina" ---
    if (vm.finestraTermina) {
        FinestraTermina(
            noteIniziali = progetto.noteFinali,
            lavoriInCorso = progetto.statoAudio.inLavorazione || progetto.statoTrascrizione.inLavorazione,
            onTermina = { note -> vm.termina(note) },
            onAnnulla = { vm.chiudiTermina() },
        )
    }
}

/** Barra in alto: indietro, titolo, contatori e pulsante Termina. */
@Composable
private fun BarraSuperiore(vm: ProgettoViewModel, progetto: ProgettoVideo) {
    val numeroFoto = progetto.passi.size
    val troppeFoto = numeroFoto > ProgettoViewModel.SOGLIA_FOTO
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface)
            .padding(horizontal = 4.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TextButton(onClick = { vm.tornaHome() }) {
            Text("←", style = MaterialTheme.typography.titleLarge)
        }
        Column(Modifier.weight(1f)) {
            Text(
                progetto.scheda.titolo,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(top = 2.dp)) {
                Etichetta(
                    "📷 $numeroFoto" + if (troppeFoto) " (oltre ${ProgettoViewModel.SOGLIA_FOTO})" else "",
                    if (troppeFoto) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.surfaceVariant,
                    if (troppeFoto) Color.White else MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (vm.fotoInSalvataggio > 0) {
                    Etichetta("salvo ${vm.fotoInSalvataggio}…", MaterialTheme.colorScheme.primaryContainer, MaterialTheme.colorScheme.onPrimaryContainer)
                }
                Text(
                    statoLavori(vm, progetto),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.align(Alignment.CenterVertically),
                )
            }
        }
        Spacer(Modifier.width(6.dp))
        FilledTonalButton(onClick = { vm.apriTermina() }) { Text("✓ Termina") }
        Spacer(Modifier.width(4.dp))
    }
}

/** Stato di audio e trascrizione in poche parole, per la barra in alto. */
private fun statoLavori(vm: ProgettoViewModel, progetto: ProgettoVideo): String = when {
    progetto.statoAudio.inLavorazione -> "🎵 ${progetto.statoAudio.descrizione}"
    vm.avanzamentoTrascrizione != null -> "🎙 ${vm.avanzamentoTrascrizione}"
    else -> "🎙 ${progetto.statoTrascrizione.descrizione}"
}

/** Pannello mostrato durante lo spostamento di un segnalibro. */
@Composable
private fun PannelloSpostamento(
    passo: Passo,
    numero: Int,
    posizioneMs: Long,
    onAnnulla: () -> Unit,
    onConferma: () -> Unit,
) {
    Surface(
        color = MaterialTheme.colorScheme.primaryContainer,
        contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
        shape = MaterialTheme.shapes.medium,
    ) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                "↔ Sposta ${NomiFile.codicePasso(numero)} ${passo.tipo.simbolo}",
                fontWeight = FontWeight.Bold,
            )
            Text(
                "Porta il video nel punto esatto (barra, striscia o −1 / +1 fotogramma), poi premi \"Fissa qui\".",
                style = MaterialTheme.typography.bodySmall,
            )
            Text(
                "${NomiFile.tempoFoto(passo.tempoMs)}  →  ${NomiFile.tempoFoto(posizioneMs)}",
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onAnnulla, modifier = Modifier.weight(1f)) { Text("✕ Annulla") }
                Button(onClick = onConferma, modifier = Modifier.weight(1f)) { Text("✓ Fissa qui") }
            }
        }
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

/** Pulsante colorato di cattura per un tipo di passo (sempre attivo: si salva in sottofondo). */
@Composable
private fun PulsanteCattura(tipo: TipoPasso, modifier: Modifier, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        shape = MaterialTheme.shapes.medium,
        colors = ButtonDefaults.buttonColors(containerColor = Color(tipo.colore), contentColor = Color.White),
        contentPadding = PaddingValues(horizontal = 8.dp),
        modifier = modifier.height(54.dp),
    ) {
        Text(
            "${tipo.simbolo}  ${tipo.etichetta}",
            fontWeight = FontWeight.Bold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
