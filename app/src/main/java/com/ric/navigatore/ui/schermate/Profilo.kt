package com.ric.navigatore.ui.schermate

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import com.ric.navigatore.nucleo.geo.Profilo
import com.ric.navigatore.nucleo.modello.formattaDistanza
import com.ric.navigatore.ui.tema.Extra
import java.util.Locale
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * Grafico del profilo altimetrico: quota (verticale) lungo il percorso
 * (orizzontale). Toccando o trascinando il dito sul grafico, il punto
 * corrispondente viene mostrato anche sulla mappa.
 */
@Composable
fun GraficoProfilo(profilo: Profilo, onIndica: (Double?) -> Unit) {
    val punti = profilo.punti
    val lunghezza = max(1.0, punti.last().progressiva)
    // margine sopra e sotto, così le linee non toccano i bordi
    val margine = max(5.0, (profilo.massima - profilo.minima) * 0.1)
    val basso = profilo.minima - margine
    val alto = profilo.massima + margine
    var indicata by remember(profilo) { mutableStateOf<Double?>(null) }

    val colore = Extra.colori.percorso
    val sfondo = Extra.colori.percorsoSfondo
    val griglia = MaterialTheme.colorScheme.outlineVariant
    val evidenza = Extra.colori.avviso

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        RigaValore("Salita / discesa", "↗ ${profilo.salita.roundToInt()} m · ↘ ${profilo.discesa.roundToInt()} m")
        RigaValore("Quota minima / massima", "${profilo.minima.roundToInt()} m · ${profilo.massima.roundToInt()} m")
        RigaValore("Pendenza più ripida", "%.1f %% (media su 200 m)".format(Locale.ITALY, profilo.pendenzaMassima))

        fun scegli(x: Float, larghezza: Float) {
            val d = (x / larghezza).coerceIn(0f, 1f) * lunghezza
            indicata = d
            onIndica(d)
        }
        Canvas(
            Modifier.fillMaxWidth().height(150.dp)
                .pointerInput(profilo) { detectTapGestures { o -> scegli(o.x, size.width.toFloat()) } }
                .pointerInput(profilo) { detectDragGestures { c, _ -> scegli(c.position.x, size.width.toFloat()) } },
        ) {
            fun x(d: Double) = (d / lunghezza * size.width).toFloat()
            fun y(q: Double) = (size.height - (q - basso) / (alto - basso) * size.height).toFloat()
            // griglia orizzontale (3 linee)
            for (k in 1..3) {
                val yy = size.height * k / 4f
                drawLine(griglia, Offset(0f, yy), Offset(size.width, yy), strokeWidth = 1f)
            }
            val linea = Path().apply {
                moveTo(x(punti.first().progressiva), y(punti.first().quota))
                punti.drop(1).forEach { lineTo(x(it.progressiva), y(it.quota)) }
            }
            val area = Path().apply {
                addPath(linea)
                lineTo(x(punti.last().progressiva), size.height)
                lineTo(x(punti.first().progressiva), size.height)
                close()
            }
            drawPath(area, sfondo)
            drawPath(linea, colore, style = Stroke(width = 2.5.dp.toPx()))
            indicata?.let { d ->
                drawLine(evidenza, Offset(x(d), 0f), Offset(x(d), size.height), strokeWidth = 2.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(10f, 8f)))
            }
        }
        Row {
            Text("0 km", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
            Text(formattaDistanza(lunghezza), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        val testo = indicata?.let { d ->
            val i = punti.indexOfFirst { it.progressiva >= d }.let { if (it < 0) punti.size - 1 else it }
            val q = punti[i].quota
            "A ${formattaDistanza(d)} dalla partenza: ${q.roundToInt()} m s.l.m. (punto blu sulla mappa, visibile chiudendo questo pannello)"
        } ?: "Tocca o trascina il dito sul grafico per vedere il punto sulla mappa."
        Text(testo, style = MaterialTheme.typography.bodySmall)
        Text(
            "Quote dal modello del terreno di openrouteservice: precisione di qualche metro; ponti e gallerie possono sembrare salite o discese.",
            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
