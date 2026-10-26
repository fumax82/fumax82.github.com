/*
 * StrisciaAnteprime.kt
 * Striscia di miniature dell'intero video, sotto il filmato, con effetto "lente":
 *
 *   |compresso|      zona estesa (attorno al punto attuale)      |compresso|
 *   | inizio..|  [ ][ ][ ][ ][ ▼ ][ ][ ][ ][ ]                   |...fine  |
 *
 * - Il punto attuale del video è sempre al centro (linea bianca).
 * - Vicino al punto attuale le miniature sono larghe: si vedono bene i
 *   fotogrammi precedenti e successivi.
 * - Oltre una soglia (ai lati) la striscia si comprime e mostra tutto il
 *   resto del video in poco spazio, per avere una visione d'insieme.
 * - I segnalibri (foto catturate) sono tacche colorate come i pulsanti.
 * - Toccando la striscia il video salta a quel punto.
 *
 * Per cambiare l'aspetto modificare le costanti in ImpostazioniStriscia.
 */
package it.formazione.videotutorial.schermate

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import it.formazione.videotutorial.modello.Passo
import kotlin.math.roundToInt
import kotlin.math.roundToLong

/** Valori che regolano l'aspetto della striscia. */
object ImpostazioniStriscia {
    /** Altezza della striscia. */
    val ALTEZZA = 60.dp

    /** Larghezza desiderata di una miniatura nella zona estesa. */
    val LARGHEZZA_CELLA = 56.dp

    /** Parte della larghezza occupata da OGNUNA delle due zone compresse (20%). */
    const val QUOTA_COMPRESSA = 0.2f

    /** Larghezza minima di una miniatura nella zona compressa. */
    val CELLA_MINIMA = 3.dp
}

/**
 * Conversione tra tempo del video e posizione orizzontale sulla striscia.
 * La striscia ha tre zone, ognuna con la sua scala:
 *   [0, L]      dall'inizio del video fino al bordo della zona estesa
 *   [L, W - L]  zona estesa, centrata sul punto attuale
 *   [W - L, W]  dal bordo della zona estesa fino alla fine del video
 */
class GeometriaStriscia(
    private val larghezza: Float,
    private val durataMs: Long,
    private val posizioneMs: Long,
    /** Metà dell'intervallo di tempo mostrato nella zona estesa. */
    private val metaFuocoMs: Double,
) {
    private val lato = larghezza * ImpostazioniStriscia.QUOTA_COMPRESSA
    private val inizioFuoco = posizioneMs - metaFuocoMs
    private val fineFuoco = posizioneMs + metaFuocoMs

    /** Posizione orizzontale (in pixel) del tempo indicato. */
    fun x(tempoMs: Double): Float = when {
        tempoMs < inizioFuoco ->
            if (inizioFuoco <= 0) lato else (lato * tempoMs / inizioFuoco).toFloat()
        tempoMs <= fineFuoco ->
            (lato + (tempoMs - inizioFuoco) / (2 * metaFuocoMs) * (larghezza - 2 * lato)).toFloat()
        else -> {
            val resto = durataMs - fineFuoco
            if (resto <= 0) larghezza - lato
            else (larghezza - lato + (tempoMs - fineFuoco) / resto * lato).toFloat()
        }
    }

    /** Tempo del video (in ms) corrispondente al punto orizzontale indicato. */
    fun tempo(x: Float): Long {
        val t = when {
            x < lato -> if (inizioFuoco <= 0) 0.0 else x / lato * inizioFuoco
            x <= larghezza - lato -> inizioFuoco + (x - lato) / (larghezza - 2 * lato) * (2 * metaFuocoMs)
            else -> fineFuoco + (x - (larghezza - lato)) / lato * maxOf(0.0, durataMs - fineFuoco)
        }
        return t.roundToLong().coerceIn(0L, maxOf(0L, durataMs))
    }
}

/**
 * Disegna la striscia.
 * - miniature: una per ogni "intervalloMs" (null finché non è pronta)
 * - onTocco: chiamata con il tempo (ms) del punto toccato
 */
@Composable
fun StrisciaAnteprime(
    miniature: List<ImageBitmap?>,
    intervalloMs: Long,
    durataMs: Long,
    posizioneMs: Long,
    passi: List<Passo>,
    onTocco: (Long) -> Unit,
    modifier: Modifier = Modifier,
) {
    // Valori sempre aggiornati anche dentro il gestore del tocco
    val densita = LocalDensity.current
    val geometriaAttuale by rememberUpdatedState { larghezza: Float ->
        geometria(larghezza, durataMs, posizioneMs, intervalloMs, densita)
    }
    val tocco by rememberUpdatedState(onTocco)

    Canvas(
        modifier = modifier
            .fillMaxWidth()
            .height(ImpostazioniStriscia.ALTEZZA)
            .pointerInput(Unit) {
                detectTapGestures { punto ->
                    tocco(geometriaAttuale(size.width.toFloat()).tempo(punto.x))
                }
            },
    ) {
        drawRect(Color(0xFF1E1E1E))
        if (durataMs <= 0 || intervalloMs <= 0) return@Canvas

        val g = geometria(size.width, durataMs, posizioneMs, intervalloMs, this)
        disegnaMiniature(g, miniature, intervalloMs, durataMs)

        // Zone compresse leggermente scurite
        val lato = size.width * ImpostazioniStriscia.QUOTA_COMPRESSA
        drawRect(Color.Black.copy(alpha = 0.35f), size = Size(lato, size.height))
        drawRect(Color.Black.copy(alpha = 0.35f), topLeft = Offset(size.width - lato, 0f), size = Size(lato, size.height))

        // Segnalibri: tacca colorata con un triangolino in alto
        val spessore = 3.dp.toPx()
        passi.forEach { passo ->
            val x = g.x(passo.tempoMs.toDouble())
            val colore = Color(passo.tipo.colore)
            drawRect(colore, topLeft = Offset(x - spessore / 2, 0f), size = Size(spessore, size.height))
            triangolo(x, 0f, 6.dp.toPx(), colore, versoIlBasso = true)
        }

        // Punto attuale: linea bianca al centro
        val xAttuale = g.x(posizioneMs.toDouble())
        drawRect(Color.White, topLeft = Offset(xAttuale - 1.dp.toPx(), 0f), size = Size(2.dp.toPx(), size.height))
        triangolo(xAttuale, size.height, 7.dp.toPx(), Color.White, versoIlBasso = false)
    }
}

/** Calcola la geometria: quante miniature stanno nella zona estesa. */
private fun geometria(
    larghezza: Float,
    durataMs: Long,
    posizioneMs: Long,
    intervalloMs: Long,
    densita: Density,
): GeometriaStriscia {
    val larghezzaFuoco = larghezza * (1 - 2 * ImpostazioniStriscia.QUOTA_COMPRESSA)
    val cella = with(densita) { ImpostazioniStriscia.LARGHEZZA_CELLA.toPx() }
    val celle = maxOf(3, (larghezzaFuoco / cella).roundToInt())
    return GeometriaStriscia(larghezza, durataMs, posizioneMs, celle * intervalloMs / 2.0)
}

/**
 * Disegna le miniature. Nella zona compressa più miniature finirebbero nello
 * stesso pixel: vengono raggruppate e se ne disegna una sola per gruppo.
 */
private fun DrawScope.disegnaMiniature(
    g: GeometriaStriscia,
    miniature: List<ImageBitmap?>,
    intervalloMs: Long,
    durataMs: Long,
) {
    val numero = miniature.size
    if (numero == 0) return
    val minimo = ImpostazioniStriscia.CELLA_MINIMA.toPx()
    val separatore = 1.dp.toPx()
    var inizioGruppo = 0
    var xInizioGruppo = Float.NaN
    for (i in 0 until numero) {
        val t0 = maxOf(0.0, i * intervalloMs - intervalloMs / 2.0)
        val t1 = minOf(durataMs.toDouble(), i * intervalloMs + intervalloMs / 2.0)
        if (xInizioGruppo.isNaN()) {
            inizioGruppo = i
            xInizioGruppo = g.x(t0)
        }
        val x1 = g.x(t1)
        if (x1 - xInizioGruppo >= minimo || i == numero - 1) {
            val immagine = piuVicina(miniature, (inizioGruppo + i) / 2)
            val larghezzaCella = x1 - xInizioGruppo
            if (immagine != null && larghezzaCella > 0.5f) {
                // Separatore sottile solo tra le celle larghe
                val spazio = if (larghezzaCella > 4 * separatore) separatore else 0f
                ritagliaEDisegna(immagine, xInizioGruppo, larghezzaCella - spazio)
            }
            xInizioGruppo = Float.NaN
        }
    }
}

/** Fin dove cercare una miniatura sostitutiva (in numero di miniature). */
private const val RICERCA_MASSIMA = 60

/** La miniatura pronta più vicina a "indice" (se quella esatta non c'è ancora). */
private fun piuVicina(miniature: List<ImageBitmap?>, indice: Int): ImageBitmap? {
    miniature.getOrNull(indice)?.let { return it }
    for (distanza in 1..RICERCA_MASSIMA) {
        miniature.getOrNull(indice - distanza)?.let { return it }
        miniature.getOrNull(indice + distanza)?.let { return it }
    }
    return null
}

/** Disegna l'immagine riempiendo la cella e tagliando i bordi in eccesso (come "center crop"). */
private fun DrawScope.ritagliaEDisegna(immagine: ImageBitmap, x: Float, larghezza: Float) {
    val altezza = size.height
    val rapportoCella = larghezza / altezza
    val rapportoImmagine = immagine.width.toFloat() / immagine.height
    val (srcLarghezza, srcAltezza) = if (rapportoImmagine > rapportoCella) {
        (immagine.height * rapportoCella).roundToInt().coerceAtLeast(1) to immagine.height
    } else {
        immagine.width to (immagine.width / rapportoCella).roundToInt().coerceIn(1, immagine.height)
    }
    drawImage(
        image = immagine,
        srcOffset = IntOffset((immagine.width - srcLarghezza) / 2, (immagine.height - srcAltezza) / 2),
        srcSize = IntSize(srcLarghezza, srcAltezza),
        dstOffset = IntOffset(x.roundToInt(), 0),
        dstSize = IntSize(larghezza.roundToInt().coerceAtLeast(1), altezza.roundToInt()),
    )
}

/** Triangolino indicatore (in alto verso il basso, o in basso verso l'alto). */
private fun DrawScope.triangolo(x: Float, y: Float, lato: Float, colore: Color, versoIlBasso: Boolean) {
    val punta = if (versoIlBasso) y + lato else y - lato
    val percorso = Path().apply {
        moveTo(x - lato, y)
        lineTo(x + lato, y)
        lineTo(x, punta)
        close()
    }
    drawPath(percorso, colore)
}
