/*
 * MainActivity.kt
 * Punto di partenza dell'app: imposta il tema grafico e mostra la schermata
 * giusta (Home, Scheda o Lettore) in base a quanto indicato dal ViewModel.
 */
package it.formazione.videotutorial

import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import it.formazione.videotutorial.schermate.ProgettoViewModel
import it.formazione.videotutorial.schermate.Schermata
import it.formazione.videotutorial.schermate.SchermataHome
import it.formazione.videotutorial.schermate.SchermataPlayer
import it.formazione.videotutorial.schermate.SchermataScheda

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Disegna sotto le barre di sistema (Android 15); le schermate usano safeDrawingPadding
        enableEdgeToEdge()
        setContent {
            TemaApp {
                val vm: ProgettoViewModel = viewModel()
                Contenuto(vm)
            }
        }
    }
}

/** Colori dell'app: chiari o scuri come il telefono. */
@Composable
private fun TemaApp(contenuto: @Composable () -> Unit) {
    val colori = if (isSystemInDarkTheme()) darkColorScheme() else lightColorScheme()
    MaterialTheme(colorScheme = colori, content = contenuto)
}

/** Sceglie la schermata da mostrare e visualizza i messaggi brevi. */
@Composable
private fun Contenuto(vm: ProgettoViewModel) {
    val contesto = LocalContext.current
    LaunchedEffect(vm.messaggio) {
        vm.messaggio?.let { testo ->
            Toast.makeText(contesto, testo, Toast.LENGTH_LONG).show()
            vm.messaggioMostrato()
        }
    }
    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        when (vm.schermata) {
            Schermata.HOME -> SchermataHome(vm)
            Schermata.SCHEDA -> SchermataScheda(vm)
            Schermata.PLAYER -> SchermataPlayer(vm)
        }
    }
}
