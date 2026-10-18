package com.ric.navigatore

import android.Manifest
import android.graphics.Bitmap
import android.os.Build
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.rule.GrantPermissionRule
import androidx.test.uiautomator.UiDevice
import com.ric.navigatore.guida.GuidaCondivisa
import com.ric.navigatore.nucleo.geo.Punto
import com.ric.navigatore.nucleo.modello.Luogo
import com.ric.navigatore.nucleo.modello.Manovra
import com.ric.navigatore.nucleo.modello.Percorso
import com.ric.navigatore.nucleo.modello.TipoManovra
import com.ric.navigatore.nucleo.modello.Viaggio
import org.junit.Rule
import org.junit.Test
import org.junit.rules.RuleChain
import org.junit.runner.RunWith
import java.io.File

/**
 * Prova "di fumo" sull'emulatore: apre l'app, usa i menu principali,
 * disegna un'area, avvia una guida su un percorso finto e salva una
 * fotografia dello schermo a ogni passo (per controllare la grafica).
 *
 * NON prova i servizi esterni (in CI non c'è la chiave openrouteservice).
 */
@RunWith(AndroidJUnit4::class)
class ProvaSchermate {
    private val permessi: GrantPermissionRule = if (Build.VERSION.SDK_INT >= 33)
        GrantPermissionRule.grant(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.POST_NOTIFICATIONS)
    else GrantPermissionRule.grant(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)

    private val compose = createAndroidComposeRule<MainActivity>()

    @get:Rule
    val regole: RuleChain = RuleChain.outerRule(permessi).around(compose)

    private val strumenti = InstrumentationRegistry.getInstrumentation()
    private val dispositivo = UiDevice.getInstance(strumenti)

    private fun foto(nome: String) {
        compose.waitForIdle()
        Thread.sleep(1500)
        val cartella = File(strumenti.targetContext.getExternalFilesDir(null), "foto").apply { mkdirs() }
        val bmp: Bitmap = strumenti.uiAutomation.takeScreenshot()
        File(cartella, "$nome.png").outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private fun aspettaTesto(t: String) {
        compose.waitUntil(15_000) { compose.onAllNodesWithText(t, substring = true).fetchSemanticsNodes().isNotEmpty() }
    }

    @Test
    fun giroDelleSchermate() {
        aspettaTesto("Dove vuoi andare?")
        Thread.sleep(6000) // tempo per scaricare la mappa
        foto("01_principale")

        // Menu «Evita»
        compose.onNodeWithText("Evita").performClick()
        aspettaTesto("Cosa vuoi evitare?")
        foto("02_menu_evita")

        // Disegno di un'area: tre tocchi sulla mappa
        compose.onNodeWithText("Un'area").performClick()
        aspettaTesto("Disegna un'area")
        val w = dispositivo.displayWidth
        val h = dispositivo.displayHeight
        // tocchi nella metà alta (la metà bassa è occupata dal pannello)
        dispositivo.click(w / 4, h / 6)
        Thread.sleep(600)
        dispositivo.click(3 * w / 4, h / 6)
        Thread.sleep(600)
        dispositivo.click(w / 2, (h * 0.38).toInt())
        Thread.sleep(600)
        foto("03_disegno_area")
        compose.onNodeWithText("Conferma").performClick()
        compose.waitForIdle()
        if (compose.onAllNodesWithText("Passa da").fetchSemanticsNodes().isEmpty()) {
            // i tocchi non hanno completato l'area: annotiamo e usciamo dal disegno
            android.util.Log.w("ProvaSchermate", "Area non completata dai tocchi simulati")
            compose.onNodeWithText("Annulla").performClick()
        }
        aspettaTesto("Passa da")
        foto("04_area_confermata")

        // Menu «Passa da»
        compose.onNodeWithText("Passa da").performClick()
        aspettaTesto("Da dove vuoi passare?")
        foto("05_menu_passa")
        dispositivo.pressBack()

        // Elenco dei vincoli (dal menu)
        compose.onNodeWithContentDescriptionSafe("Menu")
        aspettaTesto("Vincoli (")
        compose.onNodeWithText("Vincoli (", substring = true).performClick()
        aspettaTesto("Vincoli")
        foto("06_vincoli")
        dispositivo.pressBack()

        // Impostazioni
        compose.onNodeWithContentDescriptionSafe("Menu")
        compose.onNodeWithText("Impostazioni e chiave").performClick()
        aspettaTesto("Chiave openrouteservice")
        foto("07_impostazioni")
        dispositivo.pressBack()

        // Guida su un percorso finto (attorno alla posizione predefinita dell'emulatore)
        val a = Punto(37.4220, -122.0841)
        val b = Punto(37.4310, -122.0841)
        val c = Punto(37.4310, -122.0750)
        val percorso = Percorso(
            geometria = listOf(a, b, c), distanza = 1800.0, durata = 240.0,
            manovre = listOf(
                Manovra(TipoManovra.PARTENZA, "Parti verso nord", "", 1000.0, 120.0, 0, 1),
                Manovra(TipoManovra.DESTRA, "Svolta a destra", "", 800.0, 120.0, 1, 2),
                Manovra(TipoManovra.ARRIVO, "Sei arrivato", "", 0.0, 0.0, 2, 2),
            ),
            indiciPunti = listOf(0, 2),
        )
        val viaggio = Viaggio(partenza = Luogo(a, "Prova A"), arrivo = Luogo(c, "Prova B"))
        compose.runOnUiThread { GuidaCondivisa.avvia(compose.activity, viaggio, percorso, null) }
        aspettaTesto("Termina")
        Thread.sleep(3000)
        foto("08_guida")
        compose.onNodeWithText("Termina").performClick()
        aspettaTesto("Dove vuoi andare?")
        foto("09_dopo_guida")
    }

    /** Apre il menu in alto (icona con descrizione "Menu"). */
    private fun androidx.compose.ui.test.junit4.AndroidComposeTestRule<*, *>.onNodeWithContentDescriptionSafe(d: String) {
        onNode(androidx.compose.ui.test.hasContentDescription(d)).performClick()
    }
}
