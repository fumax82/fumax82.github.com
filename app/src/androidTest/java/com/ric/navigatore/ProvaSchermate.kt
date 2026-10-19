package com.ric.navigatore

import android.Manifest
import android.graphics.Bitmap
import android.os.Build
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.rule.GrantPermissionRule
import androidx.test.uiautomator.UiDevice
import com.ric.navigatore.guida.GuidaCondivisa
import com.ric.navigatore.nucleo.geo.Geo
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
        dispositivo.click(w / 2, (h * 0.30).toInt())
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

        // Selezione dell'area appena disegnata: tocco al suo interno
        dispositivo.click(w / 2, (h * 0.26).toInt()) // parte del triangolo non coperta dalla scheda in alto
        aspettaTesto("Elimina")
        foto("04b_area_selezionata")
        // sposto un vertice: tocco sulla maniglia, poi sul nuovo punto
        dispositivo.click(w / 4, h / 6)
        Thread.sleep(600)
        dispositivo.click(w / 8, (h * 0.26).toInt())
        Thread.sleep(800)
        foto("04c_vertice_spostato")
        compose.onNodeWithText("Fatto").performClick()
        aspettaTesto("Passa da")

        // Tipi di mappa
        for ((nome, file) in listOf("Satellite con strade" to "04d_satellite", "Topografica" to "04e_topografica", "Stradale" to "04f_stradale")) {
            compose.onNodeWithContentDescriptionSafe("Tipo di mappa")
            aspettaTesto(nome)
            compose.onNodeWithText(nome, substring = true).performClick()
            // il server delle immagini satellitari può essere lento al primo caricamento
            // Attesa "a piccoli passi": tra un passo e l'altro lasciamo lavorare
            // l'interfaccia (waitForIdle), altrimenti la mappa resta ferma.
            repeat(if (nome.startsWith("Satellite")) 10 else 4) {
                compose.waitForIdle()
                Thread.sleep(2000)
            }
            foto(file)
        }

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

        // Guida su un percorso finto (attorno alla posizione predefinita dell'emulatore):
        // 1 km verso nord, svolta a destra su "Via Prova", poi 800 m verso est in discesa al 10%.
        val a = Punto(37.4220, -122.0841)
        val b = Punto(37.4310, -122.0841)
        val c = Punto(37.4310, -122.0750)
        val percorso = Percorso(
            geometria = listOf(a, b, c), distanza = 1800.0, durata = 240.0,
            manovre = listOf(
                Manovra(TipoManovra.PARTENZA, "Parti verso nord", "", 1000.0, 120.0, 0, 1),
                Manovra(TipoManovra.DESTRA, "Svolta a destra su Via Prova", "Via Prova", 800.0, 120.0, 1, 2),
                Manovra(TipoManovra.ARRIVO, "Sei arrivato", "", 0.0, 0.0, 2, 2),
            ),
            indiciPunti = listOf(0, 2),
            quote = listOf(30.0, 30.0, -50.0),
        )
        val viaggio = Viaggio(partenza = Luogo(a, "Prova A"), arrivo = Luogo(c, "Prova B"))
        // GPS simulato: l'auto avanza verso la svolta a ~50 km/h
        val gps = GpsSimulato(strumenti.targetContext)
        val gpsAttivo = gps.prepara()
        compose.runOnUiThread { GuidaCondivisa.avvia(compose.activity, viaggio, percorso, null) }
        aspettaTesto("Termina")
        Thread.sleep(3000)
        foto("08_guida")
        if (gpsAttivo) {
            for (metri in listOf(600.0, 680.0, 760.0, 820.0, 850.0, 860.0)) {
                gps.invia(Geo.puntoAProgressiva(percorso.geometria, metri), velocita = 14f, direzione = 0f)
                compose.waitForIdle()
                Thread.sleep(1000)
            }
            aspettaTesto("Svolta a destra")
            // tempo per scaricare la mappa dell'incrocio
            repeat(6) {
                gps.invia(Geo.puntoAProgressiva(percorso.geometria, 860.0), velocita = 14f, direzione = 0f)
                compose.waitForIdle()
                Thread.sleep(2000)
            }
            foto("10_anteprima_incrocio")
        } else {
            android.util.Log.w("ProvaSchermate", "GPS simulato non disponibile: salto la prova dell'anteprima")
        }

        // Esplorazione del percorso e ricerca scritta (la voce non si può provare sull'emulatore)
        compose.onNodeWithText("Esplora").performClick()
        aspettaTesto("Esplora il percorso")
        repeat(3) { compose.waitForIdle(); Thread.sleep(1500) }
        foto("11_esplora")
        compose.onNode(androidx.compose.ui.test.hasSetTextAction()).performTextInput("prima della svolta per via Prova")
        compose.onNodeWithContentDescriptionSafe("Cerca lungo il percorso")
        aspettaTesto("· tra")
        repeat(3) { compose.waitForIdle(); Thread.sleep(1500) }
        foto("12_ricerca_sul_percorso")

        // Modifiche durante la guida
        compose.onNodeWithText("Evita o passa da").performClick()
        aspettaTesto("Modifiche durante la guida")
        foto("13_modifica_in_guida")
        compose.onNodeWithText("Annulla").performClick()
        aspettaTesto("Termina")

        compose.onNodeWithText("Termina").performClick()
        aspettaTesto("Dove vuoi andare?")
        foto("09_dopo_guida")
        gps.chiudi()
    }

    /** Apre il menu in alto (icona con descrizione "Menu"). */
    private fun androidx.compose.ui.test.junit4.AndroidComposeTestRule<*, *>.onNodeWithContentDescriptionSafe(d: String) {
        onNode(androidx.compose.ui.test.hasContentDescription(d)).performClick()
    }
}

/**
 * GPS finto per le prove: sostituisce il GPS del telefono con posizioni
 * inviate dalla prova. Serve il permesso "posizione fittizia", che il
 * flusso di prova concede con `adb shell appops set ... mock_location allow`.
 */
private class GpsSimulato(context: android.content.Context) {
    private val lm = context.getSystemService(android.location.LocationManager::class.java)
    private val nome = android.location.LocationManager.GPS_PROVIDER

    /** Vero se il GPS finto è stato attivato. */
    fun prepara(): Boolean = try {
        @Suppress("DEPRECATION")
        lm.addTestProvider(nome, false, true, false, false, true, true, true, android.location.Criteria.POWER_LOW, android.location.Criteria.ACCURACY_FINE)
        lm.setTestProviderEnabled(nome, true)
        true
    } catch (e: SecurityException) {
        false
    } catch (e: IllegalArgumentException) {
        false
    }

    fun invia(p: Punto, velocita: Float, direzione: Float) {
        val l = android.location.Location(nome).apply {
            latitude = p.lat
            longitude = p.lon
            accuracy = 5f
            speed = velocita
            bearing = direzione
            time = System.currentTimeMillis()
            elapsedRealtimeNanos = android.os.SystemClock.elapsedRealtimeNanos()
        }
        lm.setTestProviderLocation(nome, l)
    }

    fun chiudi() {
        runCatching { lm.removeTestProvider(nome) }
    }
}
