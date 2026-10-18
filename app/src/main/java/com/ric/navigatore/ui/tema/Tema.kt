package com.ric.navigatore.ui.tema

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/*
 * Tema grafico: sobrio, toni pastello armoniosi, angoli morbidi.
 * Tutti i colori dell'app stanno qui: per cambiarli basta modificare questo file.
 */

/** Colori "di significato" usati in tutta l'app (oltre a quelli di Material). */
@Immutable
data class ColoriExtra(
    /** Rosso pastello: esclusioni. */
    val esclusione: Color,
    val esclusioneSfondo: Color,
    /** Verde salvia: passaggi obbligati. */
    val passaggio: Color,
    val passaggioSfondo: Color,
    /** Blu: percorso attivo. */
    val percorso: Color,
    val percorsoSfondo: Color,
    /** Ambra: selezione in corso e avvisi. */
    val avviso: Color,
    val avvisoSfondo: Color,
)

private val ExtraGiorno = ColoriExtra(
    esclusione = Color(0xFFC94A4F), esclusioneSfondo = Color(0xFFFBE7E7),
    passaggio = Color(0xFF2F8A57), passaggioSfondo = Color(0xFFE2F2E8),
    percorso = Color(0xFF2F6FDE), percorsoSfondo = Color(0xFFE3ECFC),
    avviso = Color(0xFF9A6A00), avvisoSfondo = Color(0xFFFFF3D6),
)

private val ExtraNotte = ColoriExtra(
    esclusione = Color(0xFFF2A3A6), esclusioneSfondo = Color(0xFF3D2426),
    passaggio = Color(0xFF9AD6B0), passaggioSfondo = Color(0xFF1F3328),
    percorso = Color(0xFFA9C4F5), percorsoSfondo = Color(0xFF1E2A42),
    avviso = Color(0xFFF2D18A), avvisoSfondo = Color(0xFF3A3020),
)

private val SchemaGiorno: ColorScheme = lightColorScheme(
    primary = Color(0xFF3466C9),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFDDE7FB),
    onPrimaryContainer = Color(0xFF14284F),
    secondary = Color(0xFF5B6B86),
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFE6EBF3),
    onSecondaryContainer = Color(0xFF1C2638),
    tertiary = Color(0xFF3F8A68),
    tertiaryContainer = Color(0xFFDDF0E5),
    onTertiaryContainer = Color(0xFF113324),
    background = Color(0xFFF6F7F9),
    onBackground = Color(0xFF1B1F27),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF1B1F27),
    surfaceVariant = Color(0xFFEEF1F5),
    onSurfaceVariant = Color(0xFF555F70),
    surfaceContainer = Color(0xFFF3F5F8),
    surfaceContainerHigh = Color(0xFFEDF0F4),
    surfaceContainerLow = Color(0xFFF8F9FB),
    outline = Color(0xFFC3CAD5),
    outlineVariant = Color(0xFFE1E5EB),
    error = Color(0xFFC94A4F),
    errorContainer = Color(0xFFFBE7E7),
    onErrorContainer = Color(0xFF4A1416),
)

private val SchemaNotte: ColorScheme = darkColorScheme(
    primary = Color(0xFFA9C4F5),
    onPrimary = Color(0xFF0F2350),
    primaryContainer = Color(0xFF2A3E66),
    onPrimaryContainer = Color(0xFFDDE7FB),
    secondary = Color(0xFFB7C3D8),
    onSecondary = Color(0xFF233046),
    secondaryContainer = Color(0xFF2C3546),
    onSecondaryContainer = Color(0xFFDCE3EF),
    tertiary = Color(0xFF9AD6B0),
    tertiaryContainer = Color(0xFF214533),
    onTertiaryContainer = Color(0xFFDDF0E5),
    background = Color(0xFF12151B),
    onBackground = Color(0xFFE3E6EC),
    surface = Color(0xFF1A1E25),
    onSurface = Color(0xFFE3E6EC),
    surfaceVariant = Color(0xFF262B34),
    onSurfaceVariant = Color(0xFFB5BDCA),
    surfaceContainer = Color(0xFF1F232B),
    surfaceContainerHigh = Color(0xFF252A33),
    surfaceContainerLow = Color(0xFF181B21),
    outline = Color(0xFF5A6373),
    outlineVariant = Color(0xFF353B46),
    error = Color(0xFFF2A3A6),
    errorContainer = Color(0xFF5A2A2D),
    onErrorContainer = Color(0xFFFBE7E7),
)

/** Testi leggermente più grandi del normale: l'app si usa anche in auto. */
private val Testi = Typography(
    headlineSmall = TextStyle(fontSize = 22.sp, lineHeight = 28.sp, fontWeight = FontWeight.SemiBold),
    titleLarge = TextStyle(fontSize = 20.sp, lineHeight = 26.sp, fontWeight = FontWeight.SemiBold),
    titleMedium = TextStyle(fontSize = 17.sp, lineHeight = 23.sp, fontWeight = FontWeight.SemiBold),
    titleSmall = TextStyle(fontSize = 15.sp, lineHeight = 20.sp, fontWeight = FontWeight.Medium),
    bodyLarge = TextStyle(fontSize = 16.sp, lineHeight = 22.sp),
    bodyMedium = TextStyle(fontSize = 15.sp, lineHeight = 21.sp),
    bodySmall = TextStyle(fontSize = 13.sp, lineHeight = 18.sp),
    labelLarge = TextStyle(fontSize = 15.sp, lineHeight = 20.sp, fontWeight = FontWeight.Medium),
    labelMedium = TextStyle(fontSize = 13.sp, lineHeight = 17.sp, fontWeight = FontWeight.Medium),
    labelSmall = TextStyle(fontSize = 12.sp, lineHeight = 16.sp, fontWeight = FontWeight.Medium),
)

private val Forme = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(22.dp),
    extraLarge = RoundedCornerShape(28.dp),
)

val LocalColoriExtra = staticCompositionLocalOf { ExtraGiorno }

/** Accesso comodo: `Extra.colori.esclusione`. */
object Extra {
    val colori: ColoriExtra @Composable get() = LocalColoriExtra.current
}

@Composable
fun TemaNavigatore(notte: Boolean, contenuto: @Composable () -> Unit) {
    androidx.compose.runtime.CompositionLocalProvider(LocalColoriExtra provides if (notte) ExtraNotte else ExtraGiorno) {
        MaterialTheme(
            colorScheme = if (notte) SchemaNotte else SchemaGiorno,
            typography = Testi,
            shapes = Forme,
            content = contenuto,
        )
    }
}
