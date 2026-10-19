package com.ric.navigatore.ui.schermate

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/*
 * Pezzi riutilizzati in più schermate: icone extra, titoletti, scelte a "pillola".
 */

/** Icone che non sono nel pacchetto base di Material (disegnate dai tracciati SVG ufficiali). */
object IconeExtra {
    private fun icona(nome: String, tracciato: String): ImageVector =
        ImageVector.Builder(nome, 24.dp, 24.dp, 24f, 24f)
            .addPath(pathData = addPathNodes(tracciato), fill = SolidColor(Color.Black))
            .build()

    val Annulla = icona("annulla", "M12.5,8c-2.65,0 -5.05,0.99 -6.9,2.6L2,7v9h9l-3.62,-3.62c1.39,-1.16 3.16,-1.88 5.12,-1.88 3.54,0 6.55,2.31 7.6,5.5l2.37,-0.78C21.08,11.03 17.15,8 12.5,8z")
    val Ripristina = icona("ripristina", "M18.4,10.6C16.55,8.99 14.15,8 11.5,8c-4.65,0 -8.58,3.03 -9.96,7.22L3.9,16c1.05,-3.19 4.05,-5.5 7.6,-5.5 1.95,0 3.73,0.72 5.12,1.88L13,16h9V7l-3.6,3.6z")
    val MiaPosizione = icona("posizione", "M12,8c-2.21,0 -4,1.79 -4,4s1.79,4 4,4 4,-1.79 4,-4 -1.79,-4 -4,-4zM20.94,11c-0.46,-4.17 -3.77,-7.48 -7.94,-7.94V1h-2v2.06C6.83,3.52 3.52,6.83 3.06,11H1v2h2.06c0.46,4.17 3.77,7.48 7.94,7.94V23h2v-2.06c4.17,-0.46 7.48,-3.77 7.94,-7.94H23v-2h-2.06zM12,19c-3.87,0 -7,-3.13 -7,-7s3.13,-7 7,-7 7,3.13 7,7 -3.13,7 -7,7z")
    val Navigazione = icona("navigazione", "M12,2L4.5,20.29l0.71,0.71L12,18l6.79,3 0.71,-0.71z")
    val Inverti = icona("inverti", "M16,17.01V10h-2v7.01h-3L15,21l4,-3.99h-3zM9,3L5,6.99h3V14h2V6.99h3L9,3z")
    val Divieto = icona("divieto", "M12,2C6.48,2 2,6.48 2,12s4.48,10 10,10 10,-4.48 10,-10S17.52,2 12,2zM4,12c0,-4.42 3.58,-8 8,-8 1.85,0 3.55,0.63 4.9,1.69L5.69,16.9C4.63,15.55 4,13.85 4,12zM12,20c-1.85,0 -3.55,-0.63 -4.9,-1.69L18.31,7.1C19.37,8.45 20,10.15 20,12c0,4.42 -3.58,8 -8,8z")
    val Livelli = icona("livelli", "M11.99,18.54l-7.37,-5.73L3,14.07l9,7 9,-7 -1.63,-1.27 -7.38,5.74zM12,16l7.36,-5.73L21,9l-9,-7 -9,7 1.63,1.27L12,16z")
    val VoceSi = icona("voce", "M3,9v6h4l5,5V4L7,9H3zM16.5,12c0,-1.77 -1.02,-3.29 -2.5,-4.03v8.05c1.48,-0.73 2.5,-2.25 2.5,-4.02zM14,3.23v2.06c2.89,0.86 5,3.54 5,6.71s-2.11,5.85 -5,6.71v2.06c4.01,-0.91 7,-4.49 7,-8.77s-2.99,-7.86 -7,-8.77z")
    val VoceNo = icona("muto", "M16.5,12c0,-1.77 -1.02,-3.29 -2.5,-4.03v2.21l2.45,2.45c0.03,-0.2 0.05,-0.41 0.05,-0.63zM19,12c0,0.94 -0.2,1.82 -0.54,2.64l1.51,1.51C20.63,14.91 21,13.5 21,12c0,-4.28 -2.99,-7.86 -7,-8.77v2.06c2.89,0.86 5,3.54 5,6.71zM4.27,3L3,4.27 7.73,9H3v6h4l5,5v-6.73l4.25,4.25c-0.67,0.52 -1.42,0.93 -2.25,1.18v2.06c1.38,-0.31 2.63,-0.95 3.69,-1.81L19.73,21 21,19.73l-9,-9L4.27,3zM12,4L9.91,6.09 12,8.18V4z")
}

/** Titoletto di sezione. */
@Composable
fun Titoletto(testo: String, modifier: Modifier = Modifier) {
    Text(
        testo, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = modifier.padding(top = 14.dp, bottom = 6.dp),
    )
}

/** Scelta fra opzioni a "pillola" (vanno a capo da sole se non ci stanno). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun <T> SceltaPillole(opzioni: List<T>, scelta: T, etichetta: (T) -> String, onScegli: (T) -> Unit, modifier: Modifier = Modifier) {
    FlowRow(modifier = modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        opzioni.forEach { o ->
            FilterChip(selected = o == scelta, onClick = { onScegli(o) }, label = { Text(etichetta(o)) })
        }
    }
}

/** Riquadro colorato con un messaggio (avviso, errore, informazione). */
@Composable
fun Riquadro(sfondo: Color, testo: Color, modifier: Modifier = Modifier, contenuto: @Composable ColumnScope.() -> Unit) {
    Surface(color = sfondo, contentColor = testo, shape = RoundedCornerShape(14.dp), modifier = modifier.fillMaxWidth()) {
        Column(Modifier.padding(horizontal = 14.dp, vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(4.dp), content = contenuto)
    }
}

/** Riga "etichetta — valore" che va a capo senza tagliare il testo. */
@Composable
fun RigaValore(etichetta: String, valore: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 3.dp), verticalAlignment = Alignment.Top) {
        Text(etichetta, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(0.45f))
        Text(valore, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium, modifier = Modifier.weight(0.55f))
    }
}

/** Grande pulsante della barra in basso: icona sopra, testo sotto (su due righe se serve). */
@Composable
fun RowScope.PulsanteBarra(
    testo: String, icona: ImageVector, onClick: () -> Unit,
    attivo: Boolean = true, evidenziato: Boolean = false, colore: Color? = null,
) {
    val sfondo = when {
        evidenziato -> MaterialTheme.colorScheme.primary
        else -> Color.Transparent
    }
    val primo = when {
        !attivo -> MaterialTheme.colorScheme.onSurface.copy(alpha = 0.35f)
        evidenziato -> MaterialTheme.colorScheme.onPrimary
        else -> colore ?: MaterialTheme.colorScheme.onSurface
    }
    Surface(
        onClick = onClick, enabled = attivo, color = sfondo, contentColor = primo, shape = RoundedCornerShape(16.dp),
        modifier = Modifier.weight(1f).heightIn(min = 64.dp),
    ) {
        Column(Modifier.padding(vertical = 8.dp, horizontal = 2.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Icon(icona, contentDescription = null, modifier = Modifier.size(24.dp))
            // una parola per riga, mai spezzata: se non ci sta, il testo si rimpicciolisce
            androidx.compose.foundation.text.BasicText(
                testo,
                style = MaterialTheme.typography.labelMedium.copy(color = primo, textAlign = androidx.compose.ui.text.style.TextAlign.Center),
                maxLines = testo.split(" ").size.coerceAtMost(2),
                autoSize = androidx.compose.foundation.text.TextAutoSize.StepBased(minFontSize = 9.sp, maxFontSize = 13.sp, stepSize = 0.5.sp),
            )
        }
    }
}
