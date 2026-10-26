/*
 * BarraScorrimento.kt
 * Barra a ritorno automatico per scorrere il video.
 *
 * Come funziona:
 * - si appoggia il dito in un punto qualsiasi della barra;
 * - spostandolo a destra il video va avanti, a sinistra indietro;
 * - più ci si allontana dal punto iniziale più è veloce (fino a 50x);
 *   metà della larghezza della barra = corsa completa;
 * - al centro c'è una piccola zona morta (5%) dove il video sta fermo;
 * - lasciando il dito la manopola torna al centro con un'animazione.
 *
 * La curva della velocità è in CurvaVelocita: cambiare lì i valori per
 * rendere la barra più o meno veloce.
 */
package it.formazione.videotutorial.schermate

import androidx.compose.animation.core.animate
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToInt

/** Regole che trasformano lo spostamento del dito in velocità del video. */
object CurvaVelocita {
    /** Zona morta centrale (5% della corsa): il video resta fermo. */
    const val ZONA_MORTA = 0.05f

    /** Velocità appena fuori dalla zona morta. */
    const val VELOCITA_MINIMA = 0.1f

    /** Velocità a fine corsa. */
    const val VELOCITA_MASSIMA = 50f

    /**
     * Velocità per uno spostamento da -1 (tutto a sinistra) a +1 (tutto a destra).
     * Formula: 0,1 + 49,9 × x³, dove x va da 0 a 1 fuori dalla zona morta.
     * Esempi: 20% -> 0,3x; 50% -> 5,4x; 80% -> 24,6x; 100% -> 50x.
     * Il segno indica la direzione (negativo = indietro).
     */
    fun velocita(spostamento: Float): Float {
        val ampiezza = abs(spostamento).coerceAtMost(1f)
        if (ampiezza < ZONA_MORTA) return 0f
        val x = (ampiezza - ZONA_MORTA) / (1f - ZONA_MORTA)
        val v = VELOCITA_MINIMA + (VELOCITA_MASSIMA - VELOCITA_MINIMA) * x * x * x
        return if (spostamento < 0) -v else v
    }

    /** Testo della velocità da mostrare sopra la barra (es. "▶ 5.4x"). */
    fun descrivi(velocita: Float): String {
        if (velocita == 0f) return "Trascina per scorrere"
        val freccia = if (velocita > 0) "▶" else "◀"
        val v = abs(velocita)
        val numero = if (v < 10f) String.format(Locale.ROOT, "%.1f", v) else String.format(Locale.ROOT, "%.0f", v)
        return "$freccia ${numero}x"
    }
}

/**
 * Disegna la barra. Avvisa chi la usa con tre funzioni:
 * onInizio (dito appoggiato), onVelocita (nuova velocità), onFine (dito alzato).
 */
@Composable
fun BarraScorrimento(
    onInizio: () -> Unit,
    onVelocita: (Float) -> Unit,
    onFine: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val scope = rememberCoroutineScope()
    // Posizione della manopola: da -1 (sinistra) a +1 (destra), 0 = centro
    var spostamento by remember { mutableFloatStateOf(0f) }
    var larghezzaPx by remember { mutableIntStateOf(1) }
    // Animazione di ritorno al centro in corso (si ferma se il dito torna giù)
    val animazioneRitorno = remember { RiferimentoJob() }

    val diametroManopola = 52.dp
    val raggioPx = with(LocalDensity.current) { (diametroManopola / 2).toPx() }
    val colori = MaterialTheme.colorScheme

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(64.dp)
            .onSizeChanged { larghezzaPx = it.width }
            .background(colori.surfaceVariant, RoundedCornerShape(32.dp))
            .pointerInput(Unit) {
                awaitEachGesture {
                    val giu = awaitFirstDown()
                    giu.consume()
                    animazioneRitorno.value?.cancel()
                    val inizioX = giu.position.x
                    val metaLarghezza = (size.width / 2f).coerceAtLeast(1f)
                    var ultimaVelocita = 0f
                    onInizio()
                    try {
                        while (true) {
                            val evento = awaitPointerEvent()
                            val dito = evento.changes.firstOrNull { it.id == giu.id } ?: break
                            if (!dito.pressed) break
                            spostamento = ((dito.position.x - inizioX) / metaLarghezza).coerceIn(-1f, 1f)
                            val v = CurvaVelocita.velocita(spostamento)
                            if (v != ultimaVelocita) {
                                ultimaVelocita = v
                                onVelocita(v)
                            }
                            dito.consume()
                        }
                    } finally {
                        // Dito alzato (o gesto interrotto): ferma e torna al centro
                        onFine()
                        val partenza = spostamento
                        animazioneRitorno.value = scope.launch {
                            animate(partenza, 0f, animationSpec = spring(dampingRatio = 0.6f)) { valore, _ ->
                                spostamento = valore
                            }
                        }
                    }
                }
            },
    ) {
        // Scritte ai lati
        Text(
            "◀ indietro",
            modifier = Modifier.align(Alignment.CenterStart).padding(start = 16.dp),
            color = colori.onSurfaceVariant,
            style = MaterialTheme.typography.labelMedium,
        )
        Text(
            "avanti ▶",
            modifier = Modifier.align(Alignment.CenterEnd).padding(end = 16.dp),
            color = colori.onSurfaceVariant,
            style = MaterialTheme.typography.labelMedium,
        )
        // Linea del centro
        Box(
            Modifier
                .align(Alignment.Center)
                .width(2.dp)
                .fillMaxHeight()
                .padding(vertical = 12.dp)
                .background(colori.outline)
        )
        // Manopola
        Box(
            Modifier
                .align(Alignment.Center)
                .offset {
                    val corsa = (larghezzaPx / 2f - raggioPx).coerceAtLeast(0f)
                    IntOffset((spostamento * corsa).roundToInt(), 0)
                }
                .size(diametroManopola)
                .background(colori.primary, CircleShape)
        )
    }
}

/** Contenitore semplice per ricordare l'animazione di ritorno in corso. */
private class RiferimentoJob {
    var value: Job? = null
}
