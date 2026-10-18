package com.ric.navigatore.ui.schermate

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.ric.navigatore.BuildConfig
import com.ric.navigatore.Servizi
import com.ric.navigatore.dati.DatiSalvati
import com.ric.navigatore.dati.Tema
import com.ric.navigatore.ui.ModelloApp
import com.ric.navigatore.ui.tema.Extra
import kotlin.math.roundToInt

/** Impostazioni: chiave, server, uso dei limiti, voce, tema, batteria. */
@Composable
fun FoglioImpostazioni(modello: ModelloApp, dati: DatiSalvati) {
    val context = LocalContext.current
    val imp = dati.impostazioni
    var chiave by remember { mutableStateOf(imp.chiaveOrs) }
    var server by remember { mutableStateOf(imp.serverOrs) }
    var mostra by remember { mutableStateOf(false) }

    Column(
        Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp).padding(bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text("Impostazioni", style = MaterialTheme.typography.titleLarge)

        // ---------------- Chiave openrouteservice ----------------
        Titoletto("Chiave openrouteservice (gratuita)")
        Text(
            "Serve per calcolare i percorsi e cercare indirizzi. Si ottiene registrandosi gratis su openrouteservice.org " +
                "(nessuna carta di credito, nessun abbonamento). La chiave resta solo su questo telefono.",
            style = MaterialTheme.typography.bodySmall,
        )
        OutlinedTextField(
            value = chiave, onValueChange = { chiave = it.trim() }, singleLine = true,
            label = { Text("Chiave API") },
            visualTransformation = if (mostra) VisualTransformation.None else PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            modifier = Modifier.fillMaxWidth(),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TextButton(onClick = { mostra = !mostra }) { Text(if (mostra) "Nascondi" else "Mostra") }
            Button(onClick = { modello.cambiaImpostazioni { it.copy(chiaveOrs = chiave, serverOrs = server.trimEnd('/')) } }) { Text("Salva") }
            OutlinedButton(onClick = { modello.provaChiave() }, enabled = imp.chiaveOrs.isNotBlank()) { Text("Prova") }
        }
        TextButton(onClick = { apri(context, "https://openrouteservice.org/dev/#/signup") }) { Text("Apri la pagina di registrazione") }

        Titoletto("Server")
        OutlinedTextField(
            value = server, onValueChange = { server = it.trim() }, singleLine = true,
            label = { Text("Indirizzo del server openrouteservice") },
            supportingText = { Text("Lascia quello pubblico, oppure metti l'indirizzo di un tuo server (vedi LEGGIMI).") },
            modifier = Modifier.fillMaxWidth(),
        )

        // ---------------- Uso dei limiti ----------------
        Titoletto("Uso dei limiti gratuiti")
        val uso = remember(dati.quote) { Servizi.quote.riepilogo() }
        uso.forEach { u ->
            val giorno = "${u.oggi} / ${u.limite.alGiorno} oggi"
            val minuto = "${u.ultimoMinuto} / ${u.limite.alMinuto} al minuto"
            val residuo = u.residuoServer?.let { " · il server dice: ancora $it" } ?: ""
            RigaValore(u.limite.nome, "$giorno · $minuto$residuo")
            LinearProgressIndicator(
                progress = { (u.oggi.toFloat() / u.limite.alGiorno).coerceIn(0f, 1f) },
                modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp),
            )
        }
        Text(
            "Valori del piano gratuito «Standard» al momento dello sviluppo: se il tuo pannello openrouteservice indica numeri diversi, valgono quelli. " +
                "Il conteggio si azzera a mezzanotte (ora del telefono; il server potrebbe usare l'ora UTC). Raggiunto un limite l'app si ferma e lo dice: non passa mai a servizi a pagamento.",
            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Titoletto("Richieste massime per ogni calcolo: ${imp.budgetRichieste}")
        Slider(
            value = imp.budgetRichieste.toFloat(), valueRange = 3f..15f, steps = 11,
            onValueChange = { v -> modello.cambiaImpostazioni { it.copy(budgetRichieste = v.roundToInt()) } },
        )
        Text(
            "Con aree da attraversare o vincoli in conflitto l'app prova più varianti. Questo è il tetto per ogni pressione di «Ricalcola».",
            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        // ---------------- Ricerca ----------------
        Titoletto("Ricerca indirizzi")
        RigaInterruttore(
            "Usa Nominatim se manca la chiave", imp.usaNominatimSenzaChiave,
            "Servizio di OpenStreetMap: solo ricerca con il tasto «Cerca», al massimo una richiesta al secondo.",
        ) { v -> modello.cambiaImpostazioni { it.copy(usaNominatimSenzaChiave = v) }; Servizi.ricreaFornitori() }

        // ---------------- Guida ----------------
        Titoletto("Guida")
        RigaInterruttore("Istruzioni vocali", imp.voce) { v -> modello.cambiaImpostazioni { it.copy(voce = v) } }
        RigaInterruttore("Mappa orientata nel senso di marcia", imp.mappaOrientata, "Se spento, il nord resta in alto.") { v -> modello.cambiaImpostazioni { it.copy(mappaOrientata = v) } }
        RigaInterruttore("Schermo sempre acceso durante la guida", imp.schermoAcceso, "Con lo schermo spento la guida vocale continua comunque.") { v -> modello.cambiaImpostazioni { it.copy(schermoAcceso = v) } }
        Text(
            "Alcuni telefoni chiudono le app in secondo piano per risparmiare batteria. Se la guida si interrompe a schermo spento, escludi questa app dal risparmio energetico.",
            style = MaterialTheme.typography.bodySmall,
        )
        OutlinedButton(onClick = {
            runCatching { context.startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)) }
                .onFailure { context.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + context.packageName))) }
        }) { Text("Apri le impostazioni della batteria") }
        OutlinedButton(onClick = {
            runCatching { context.startActivity(Intent("com.android.settings.TTS_SETTINGS")) }
        }) { Text("Impostazioni della voce del telefono") }

        // ---------------- Aspetto ----------------
        Titoletto("Aspetto")
        SceltaPillole(Tema.entries, imp.tema, { it.etichetta }, { t -> modello.cambiaImpostazioni { it.copy(tema = t) } })
    }
}

private fun apri(context: android.content.Context, indirizzo: String) {
    runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(indirizzo))) }
}

/** Privacy, fonti dei dati, licenze e limiti dichiarati. */
@Composable
fun FoglioInformazioni() {
    val context = LocalContext.current
    Column(
        Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp).padding(bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text("Privacy, fonti e licenze", style = MaterialTheme.typography.titleLarge)
        Text("Navigatore ${BuildConfig.VERSION_NAME} · app personale, senza pubblicità, senza tracciamento, senza account.", style = MaterialTheme.typography.bodySmall)

        Titoletto("Quali dati escono dal telefono")
        PuntoElenco("Mappa (OpenFreeMap): vengono scaricati i «tasselli» della zona che guardi. Il server vede quindi la zona visualizzata e il tuo indirizzo IP, non la tua posizione GPS.")
        PuntoElenco("Percorsi (openrouteservice, HeiGIT, Germania): a ogni calcolo invio le coordinate di partenza, tappe, destinazione, dei punti ausiliari dei vincoli e le aree da evitare, insieme alla tua chiave.")
        PuntoElenco("Durante la guida, solo se esci dal percorso: invio la posizione attuale e i punti residui per ricalcolare.")
        PuntoElenco("Ricerca indirizzi: il testo che scrivi e, per ordinare i risultati, una posizione approssimata (la tua o il centro della mappa) a openrouteservice (Pelias) o a Nominatim (OpenStreetMap).")
        PuntoElenco("Nient'altro: preferiti, cronologia, percorsi salvati, chiave e impostazioni restano nella memoria dell'app sul telefono e si cancellano disinstallandola.")

        Titoletto("Cosa l'app NON fa")
        PuntoElenco("Non conosce il traffico in tempo reale: tutti i tempi sono stime senza traffico.")
        PuntoElenco("Non conosce limiti di velocità, chiusure o lavori: non li mostra e non li inventa.")
        PuntoElenco("Non calcola percorsi senza internet. Senza rete resta visibile solo il percorso già calcolato (e la mappa delle zone già viste, se ancora in memoria).")
        PuntoElenco("Le strade da evitare sono escluse in modo APPROSSIMATO, con una fascia attorno al tratto: possono essere bloccate anche strade vicinissime, sempre segnalate prima di confermare.")
        PuntoElenco("Le aree da attraversare usano un metodo euristico (strade candidate dentro l'area, poche richieste) e il risultato viene sempre verificato.")

        Titoletto("Fonti dei dati e attribuzioni")
        PuntoElenco("Dati cartografici © contributori di OpenStreetMap, licenza ODbL.")
        PuntoElenco("Mappe: OpenFreeMap, schema OpenMapTiles © OpenMapTiles.")
        PuntoElenco("Percorsi e ricerca: openrouteservice © HeiGIT gGmbH, ricerca basata su Pelias.")
        PuntoElenco("Ricerca alternativa: Nominatim © contributori di OpenStreetMap.")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TextButton(onClick = { apri(context, "https://www.openstreetmap.org/copyright") }) { Text("Copyright OSM") }
            TextButton(onClick = { apri(context, "https://openfreemap.org") }) { Text("OpenFreeMap") }
        }

        Titoletto("Componenti software")
        PuntoElenco("MapLibre Native per Android – licenza BSD 2 clausole.")
        PuntoElenco("JTS Topology Suite – licenza EPL 2.0 / EDL 1.0.")
        PuntoElenco("Kotlin, kotlinx.serialization, kotlinx.coroutines, AndroidX e Jetpack Compose – licenza Apache 2.0.")

        Spacer(Modifier.height(4.dp))
        Riquadro(Extra.colori.avvisoSfondo, Extra.colori.avviso) {
            Text("Usa sempre il buon senso e rispetta la segnaletica: le indicazioni dell'app possono essere sbagliate o non aggiornate.", style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun PuntoElenco(testo: String) {
    Row(Modifier.padding(vertical = 2.dp)) {
        Text("•", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.width(16.dp))
        Text(testo, style = MaterialTheme.typography.bodyMedium)
    }
}
