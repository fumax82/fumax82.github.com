package com.ric.navigatore.nucleo.ors

import com.ric.navigatore.nucleo.geo.Punto
import com.ric.navigatore.nucleo.modello.Esito
import com.ric.navigatore.nucleo.modello.TipoErrore
import com.ric.navigatore.nucleo.servizi.ClientHttp
import com.ric.navigatore.nucleo.servizi.Geocodifica
import com.ric.navigatore.nucleo.servizi.J
import com.ric.navigatore.nucleo.servizi.J.testo
import com.ric.navigatore.nucleo.servizi.RichiestaHttp
import com.ric.navigatore.nucleo.servizi.RisultatoRicerca
import kotlinx.serialization.json.JsonArray
import java.io.IOException
import java.net.URLEncoder

/**
 * Ricerca indirizzi con Nominatim (OpenStreetMap), usata SOLO come riserva
 * quando manca la chiave di openrouteservice.
 *
 * Regole d'uso del server pubblico (operations.osmfoundation.org/policies/nominatim):
 *  - massimo 1 richiesta al secondo;
 *  - identificare l'app con un User-Agent valido;
 *  - VIETATO l'autocompletamento (suggerimenti mentre si scrive):
 *    quindi qui si cerca solo dopo aver premuto "Cerca".
 */
class Nominatim(
    private val http: ClientHttp,
    private val indirizzoBase: String = "https://nominatim.openstreetmap.org",
) : Geocodifica {
    override val nome = "Nominatim (OpenStreetMap)"
    override val suggerimentiConsentiti = false

    private var ultimaRichiesta = 0L

    /** Rispetta il limite di 1 richiesta al secondo. */
    @Synchronized
    private fun attendiTurno() {
        val attesa = 1100 - (System.currentTimeMillis() - ultimaRichiesta)
        if (attesa > 0) Thread.sleep(attesa)
        ultimaRichiesta = System.currentTimeMillis()
    }

    override fun cerca(testo: String, vicinoA: Punto?): Esito<List<RisultatoRicerca>> {
        val q = URLEncoder.encode(testo, "UTF-8")
        return chiedi("$indirizzoBase/search?q=$q&format=jsonv2&limit=8&accept-language=it")
    }

    override fun suggerisci(testo: String, vicinoA: Punto?): Esito<List<RisultatoRicerca>> =
        Esito.Errore(TipoErrore.NON_SUPPORTATO, "Nominatim non consente i suggerimenti mentre si scrive: premi «Cerca».")

    override fun indirizzo(punto: Punto): Esito<RisultatoRicerca?> =
        when (val e = chiedi("$indirizzoBase/reverse?lat=${punto.lat}&lon=${punto.lon}&format=jsonv2&accept-language=it", singolo = true)) {
            is Esito.Ok -> Esito.Ok(e.valore.firstOrNull())
            is Esito.Errore -> e
        }

    private fun chiedi(url: String, singolo: Boolean = false): Esito<List<RisultatoRicerca>> {
        attendiTurno()
        val r = try {
            http.esegui(RichiestaHttp("GET", url))
        } catch (e: IOException) {
            return Esito.Errore(TipoErrore.RETE_ASSENTE, "Nessuna connessione a internet.", e.message)
        }
        if (r.codice == 429 || r.codice == 403) {
            return Esito.Errore(TipoErrore.QUOTA_ESAURITA, "Nominatim ha limitato le richieste: riprova più tardi.", "HTTP ${r.codice}")
        }
        if (r.codice !in 200..299) return Esito.Errore(TipoErrore.SERVIZIO_NON_DISPONIBILE, "Nominatim non risponde.", "HTTP ${r.codice}")
        val radice = J.leggi(r.corpo) ?: return Esito.Ok(emptyList())
        val elementi = if (singolo) listOf(radice) else (radice as? JsonArray).orEmpty()
        return Esito.Ok(
            elementi.mapNotNull { el ->
                val lat = el.testo("lat")?.toDoubleOrNull() ?: return@mapNotNull null
                val lon = el.testo("lon")?.toDoubleOrNull() ?: return@mapNotNull null
                val completo = el.testo("display_name") ?: ""
                val nome = el.testo("name")?.takeIf { it.isNotBlank() } ?: completo.substringBefore(",")
                RisultatoRicerca(nome, completo.substringAfter(", ", ""), Punto(lat, lon))
            },
        )
    }
}
