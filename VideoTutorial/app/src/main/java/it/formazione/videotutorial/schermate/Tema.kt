/*
 * Tema.kt
 * Colori e aspetto dell'app.
 * - La Home e la scheda seguono il tema del telefono (chiaro o scuro).
 * - Il lettore video usa sempre il tema scuro: il video risalta di più.
 * Per cambiare i colori dell'app basta modificare i valori qui sotto.
 */
package it.formazione.videotutorial.schermate

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.unit.dp

/** Colori in tema chiaro. */
private val ColoriChiari = lightColorScheme(
    primary = Color(0xFF1F5FBF),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFD8E4FF),
    onPrimaryContainer = Color(0xFF001A43),
    secondary = Color(0xFF00897B),
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFCDEDE8),
    onSecondaryContainer = Color(0xFF00201C),
    background = Color(0xFFF4F6FA),
    onBackground = Color(0xFF181C22),
    surface = Color.White,
    onSurface = Color(0xFF181C22),
    surfaceVariant = Color(0xFFE2E7EF),
    onSurfaceVariant = Color(0xFF444A53),
    outline = Color(0xFF8A919B),
    error = Color(0xFFC62828),
)

/** Colori in tema scuro (usati sempre nel lettore). */
private val ColoriScuri = darkColorScheme(
    primary = Color(0xFF8AB4F8),
    onPrimary = Color(0xFF002E6B),
    primaryContainer = Color(0xFF1F4785),
    onPrimaryContainer = Color(0xFFD8E4FF),
    secondary = Color(0xFF6FD8C8),
    onSecondary = Color(0xFF003731),
    secondaryContainer = Color(0xFF1D4E48),
    onSecondaryContainer = Color(0xFFCDEDE8),
    background = Color(0xFF0F1216),
    onBackground = Color(0xFFE2E5EA),
    surface = Color(0xFF171B21),
    onSurface = Color(0xFFE2E5EA),
    surfaceVariant = Color(0xFF262C34),
    onSurfaceVariant = Color(0xFFB9C1CC),
    outline = Color(0xFF6E7681),
    error = Color(0xFFFF8A80),
)

/** Angoli arrotondati di pulsanti, schede e finestre. */
private val Forme = Shapes(
    small = RoundedCornerShape(10.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(24.dp),
)

/** Tema dell'app: chiaro o scuro come il telefono. */
@Composable
fun TemaApp(contenuto: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) ColoriScuri else ColoriChiari,
        shapes = Forme,
        content = contenuto,
    )
}

/** Tema sempre scuro, per il lettore video. */
@Composable
fun TemaLettore(contenuto: @Composable () -> Unit) {
    MaterialTheme(colorScheme = ColoriScuri, shapes = Forme, content = contenuto)
}
