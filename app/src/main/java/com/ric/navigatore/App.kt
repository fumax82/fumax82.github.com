package com.ric.navigatore

import android.app.Application
import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import com.ric.navigatore.dati.Archivio
import com.ric.navigatore.nucleo.ors.Nominatim
import com.ric.navigatore.nucleo.ors.Openrouteservice
import com.ric.navigatore.nucleo.pianificazione.Pianificatore
import com.ric.navigatore.nucleo.servizi.ClientHttpJava
import com.ric.navigatore.nucleo.servizi.ContatoreQuote
import com.ric.navigatore.nucleo.servizi.Geocodifica
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.maplibre.android.MapLibre

/**
 * Punto di partenza dell'app: prepara MapLibre e i "servizi" condivisi
 * (archivio, collegamento ai fornitori, stato della rete).
 */
class App : Application() {
    override fun onCreate() {
        super.onCreate()
        // MapLibre non richiede chiavi: usiamo mappe OpenFreeMap senza registrazione
        MapLibre.getInstance(this)
        Servizi.avvia(this)
    }
}

/**
 * Tutti i collegamenti ai servizi esterni, in un solo posto.
 * Per cambiare fornitore si modifica solo questo oggetto.
 */
object Servizi {
    lateinit var archivio: Archivio
        private set
    lateinit var quote: ContatoreQuote
        private set

    private val http = ClientHttpJava(agenteUtente = "Navigatore-personale/${BuildConfig.VERSION_NAME} (app Android ad uso privato)")

    /** openrouteservice: percorsi, aggancio alla strada, ricerca indirizzi. */
    lateinit var ors: Openrouteservice
        private set
    private lateinit var nominatim: Nominatim

    private val _rete = MutableStateFlow(true)

    /** Vero se c'è una connessione a internet. */
    val rete: StateFlow<Boolean> = _rete

    fun avvia(context: Context) {
        archivio = Archivio(context)
        quote = ContatoreQuote(Openrouteservice.LIMITI_PREDEFINITI, archivio.dati.quote)
        quote.alCambio = { stato -> archivio.modifica { it.copy(quote = stato) } }
        ricreaFornitori()
        osservaRete(context)
    }

    /** Da chiamare quando cambiano chiave o server nelle impostazioni. */
    fun ricreaFornitori() {
        ors = Openrouteservice(
            chiave = { archivio.dati.impostazioni.chiaveOrs.trim().ifBlank { null } },
            http = http,
            quote = quote,
            indirizzoBase = archivio.dati.impostazioni.serverOrs.trimEnd('/'),
        )
        nominatim = Nominatim(http)
    }

    val haChiave: Boolean get() = archivio.dati.impostazioni.chiaveOrs.isNotBlank()

    /** Il servizio di ricerca indirizzi da usare adesso. */
    val geocodifica: Geocodifica?
        get() = when {
            haChiave -> ors.geocodifica
            archivio.dati.impostazioni.usaNominatimSenzaChiave -> nominatim
            else -> null
        }

    fun nuovoPianificatore() = Pianificatore(
        ors.motore, ors.agganciatore,
        budgetRichieste = archivio.dati.impostazioni.budgetRichieste,
    )

    private fun osservaRete(context: Context) {
        val cm = context.getSystemService(ConnectivityManager::class.java)
        fun aggiorna() {
            val caps = cm.getNetworkCapabilities(cm.activeNetwork)
            _rete.value = caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
        }
        aggiorna()
        cm.registerDefaultNetworkCallback(object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) = aggiorna()
            override fun onLost(network: Network) { _rete.value = false }
            override fun onCapabilitiesChanged(network: Network, networkCapabilities: NetworkCapabilities) = aggiorna()
        })
    }
}
