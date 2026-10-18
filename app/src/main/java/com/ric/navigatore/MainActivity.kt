package com.ric.navigatore

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.lifecycle.ViewModel
import com.ric.navigatore.dati.Tema
import com.ric.navigatore.ui.ModelloApp
import com.ric.navigatore.ui.schermate.SchermataPrincipale
import com.ric.navigatore.ui.tema.TemaNavigatore

/** Tiene in vita il modello anche se Android ricrea la schermata. */
class ContenitoreModello : ViewModel() {
    val modello = ModelloApp()
}

/** L'unica schermata (Activity) dell'app. */
class MainActivity : ComponentActivity() {
    private val contenitore: ContenitoreModello by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            val dati by Servizi.archivio.flusso.collectAsState()
            val notte = when (dati.impostazioni.tema) {
                Tema.AUTOMATICO -> isSystemInDarkTheme()
                Tema.GIORNO -> false
                Tema.NOTTE -> true
            }
            TemaNavigatore(notte) {
                SchermataPrincipale(contenitore.modello, notte)
            }
        }
    }
}
