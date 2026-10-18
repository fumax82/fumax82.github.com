package com.ric.navigatore.nucleo.ors

import com.ric.navigatore.nucleo.geo.Poligono
import com.ric.navigatore.nucleo.geo.Punto
import com.ric.navigatore.nucleo.modello.Esito
import com.ric.navigatore.nucleo.modello.Manovra
import com.ric.navigatore.nucleo.modello.Percorso
import com.ric.navigatore.nucleo.modello.RichiestaPercorso
import com.ric.navigatore.nucleo.modello.TipoErrore
import com.ric.navigatore.nucleo.servizi.Agganciatore
import com.ric.navigatore.nucleo.servizi.Capacita
import com.ric.navigatore.nucleo.servizi.ClientHttp
import com.ric.navigatore.nucleo.servizi.ContatoreQuote
import com.ric.navigatore.nucleo.servizi.Geocodifica
import com.ric.navigatore.nucleo.servizi.J
import com.ric.navigatore.nucleo.servizi.J.comeJson
import com.ric.navigatore.nucleo.servizi.J.comePunto
import com.ric.navigatore.nucleo.servizi.J.intero
import com.ric.navigatore.nucleo.servizi.J.lista
import com.ric.navigatore.nucleo.servizi.J.numero
import com.ric.navigatore.nucleo.servizi.J.ogg
import com.ric.navigatore.nucleo.servizi.J.testo
import com.ric.navigatore.nucleo.servizi.LimiteServizio
import com.ric.navigatore.nucleo.servizi.PuntoAgganciato
import com.ric.navigatore.nucleo.servizi.RichiestaHttp
import com.ric.navigatore.nucleo.servizi.RispostaHttp
import com.ric.navigatore.nucleo.servizi.RisultatoRicerca
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import java.io.IOException
import java.net.URLEncoder

/**
 * Collegamento a openrouteservice (HeiGIT, Università di Heidelberg).
 *
 *  - Percorsi:   POST /v2/directions/driving-car/geojson
 *  - Aggancio:   POST /v2/snap/driving-car/json
 *  - Indirizzi:  GET  /geocode/search, /geocode/autocomplete, /geocode/reverse
 *
 * Serve una CHIAVE PERSONALE gratuita (registrazione su openrouteservice.org,
 * senza carta di credito). La chiave NON è nel codice: la inserisce l'utente
 * nelle Impostazioni dell'app.
 *
 * Limiti per richiesta dichiarati da openrouteservice (pagina "Restrictions"):
 *  - massimo 50 punti per percorso;
 *  - con aree da evitare: percorso massimo 150 km, ogni area max 200 km²
 *    e max 20 km di larghezza/altezza;
 *  - percorsi alternativi: max 3, solo fino a 100 km.
 */
class Openrouteservice(
    private val chiave: () -> String?,
    private val http: ClientHttp,
    private val quote: ContatoreQuote? = null,
    private val indirizzoBase: String = INDIRIZZO_PUBBLICO,
) {
    companion object {
        const val INDIRIZZO_PUBBLICO = "https://api.openrouteservice.org"

        // Chiavi dei servizi per il conteggio delle quote
        const val Q_PERCORSI = "ors_percorsi"
        const val Q_AGGANCIO = "ors_aggancio"
        const val Q_RICERCA = "ors_ricerca"
        const val Q_SUGGERIMENTI = "ors_suggerimenti"
        const val Q_INVERSO = "ors_inverso"

        /**
         * Limiti del piano gratuito "Standard" (da verificare nella propria
         * pagina personale su openrouteservice.org: possono cambiare).
         */
        val LIMITI_PREDEFINITI = listOf(
            LimiteServizio(Q_PERCORSI, "Percorsi", alGiorno = 2000, alMinuto = 40),
            LimiteServizio(Q_AGGANCIO, "Aggancio alla strada", alGiorno = 2000, alMinuto = 100),
            LimiteServizio(Q_RICERCA, "Ricerca indirizzi", alGiorno = 1000, alMinuto = 100),
            LimiteServizio(Q_SUGGERIMENTI, "Suggerimenti", alGiorno = 1000, alMinuto = 100),
            LimiteServizio(Q_INVERSO, "Indirizzo da coordinate", alGiorno = 1000, alMinuto = 100),
        )

        val CAPACITA = Capacita(
            esclusioneArchiEsatta = false,
            areeDaEvitare = true,
            maxAreaKmq = 200.0,
            maxEstensioneKm = 20.0,
            maxDistanzaConAreeKm = 150.0,
            maxPunti = 50,
            alternativeSoloSenzaIntermedi = true,
            maxDistanzaAlternativeKm = 100.0,
            maxAlternative = 3,
            direzioneNeiPunti = true,
            evitaPedaggi = true,
            evitaAutostrade = true,
            evitaTraghetti = true,
        )
    }

    /** Il motore di percorso. */
    val motore = object : com.ric.navigatore.nucleo.servizi.MotorePercorsi {
        override val nome = "openrouteservice"
        override val capacita = CAPACITA
        override fun calcola(richiesta: RichiestaPercorso) = calcolaPercorsi(richiesta)
    }

    /** L'aggancio alla strada. */
    val agganciatore = Agganciatore { punti, raggio -> aggancia(punti, raggio) }

    /** La ricerca indirizzi (Pelias, ospitato da openrouteservice: i suggerimenti sono permessi). */
    val geocodifica = object : Geocodifica {
        override val nome = "openrouteservice (Pelias)"
        override val suggerimentiConsentiti = true
        override fun cerca(testo: String, vicinoA: Punto?) = ricerca("search", Q_RICERCA, testo, vicinoA)
        override fun suggerisci(testo: String, vicinoA: Punto?) = ricerca("autocomplete", Q_SUGGERIMENTI, testo, vicinoA)
        override fun indirizzo(punto: Punto) = inverso(punto)
    }

    // ==================================================================
    // Percorsi
    // ==================================================================

    /** Costruisce il JSON della richiesta (pubblico per le prove automatiche). */
    fun corpoRichiesta(r: RichiestaPercorso, conDirezioni: Boolean = true): JsonObject = buildJsonObject {
        putJsonArray("coordinates") { r.punti.forEach { add(it.punto.comeJson()) } }
        // Direzione di marcia: [gradi, tolleranza]. Per i punti senza direzione
        // usiamo tolleranza 180° (= qualsiasi direzione).
        if (conDirezioni && r.punti.any { it.direzione != null }) {
            putJsonArray("bearings") {
                r.punti.forEach { p ->
                    add(buildJsonArray {
                        add(JsonPrimitive(Math.round(p.direzione ?: 0.0).toInt()))
                        add(JsonPrimitive(if (p.direzione == null) 180 else Math.round(p.tolleranzaDirezione).toInt()))
                    })
                }
            }
        }
        // Raggio di aggancio di ogni punto (-1 = illimitato)
        putJsonArray("radiuses") { r.punti.forEach { add(JsonPrimitive(it.raggio ?: 1000.0)) } }
        put("instructions", true)
        put("language", "it")
        put("units", "m")
        put("geometry", true)
        if (r.proseguiDritto) put("continue_straight", true)
        val evita = buildList {
            if (r.opzioni.evitaAutostrade) add("highways")
            if (r.opzioni.evitaPedaggi) add("tollways")
            if (r.opzioni.evitaTraghetti) add("ferries")
        }
        if (evita.isNotEmpty() || r.areeDaEvitare.isNotEmpty()) {
            putJsonObject("options") {
                if (evita.isNotEmpty()) putJsonArray("avoid_features") { evita.forEach { add(it) } }
                if (r.areeDaEvitare.isNotEmpty()) put("avoid_polygons", multiPoligono(r.areeDaEvitare))
            }
        }
        if (r.alternative > 0 && r.punti.size == 2) {
            putJsonObject("alternative_routes") {
                put("target_count", minOf(r.alternative + 1, CAPACITA.maxAlternative))
                put("weight_factor", 1.6)
                put("share_factor", 0.6)
            }
        }
    }

    /** Aree da evitare in formato GeoJSON MultiPolygon: ogni area tra parentesi PROPRIE. */
    private fun multiPoligono(aree: List<Poligono>): JsonObject = buildJsonObject {
        put("type", "MultiPolygon")
        putJsonArray("coordinates") {
            aree.forEach { area ->
                add(buildJsonArray {
                    (listOf(area.esterno) + area.buchi).forEach { anello ->
                        add(buildJsonArray {
                            anello.forEach { add(it.comeJson()) }
                            add(anello.first().comeJson()) // GeoJSON vuole l'anello chiuso
                        })
                    }
                })
            }
        }
    }

    private fun calcolaPercorsi(r: RichiestaPercorso): Esito<List<Percorso>> {
        if (r.punti.size < 2) return Esito.Errore(TipoErrore.RICHIESTA_NON_VALIDA, "Servono almeno partenza e arrivo.")
        if (r.punti.size > CAPACITA.maxPunti) {
            return Esito.Errore(
                TipoErrore.LIMITI_SUPERATI,
                "Troppi punti (${r.punti.size}): openrouteservice ne accetta al massimo ${CAPACITA.maxPunti}.",
            )
        }
        var esito = inviaPercorso(r, conDirezioni = true)
        // Se il servizio rifiuta le direzioni di marcia, riproviamo senza:
        // il rispetto del senso verrà comunque controllato dopo dal Validatore.
        if (esito is Esito.Errore && esito.tipo == TipoErrore.RICHIESTA_NON_VALIDA &&
            r.punti.any { it.direzione != null } && esito.dettaglio?.contains("bearing", true) == true
        ) {
            esito = inviaPercorso(r, conDirezioni = false)
        }
        return esito
    }

    private fun inviaPercorso(r: RichiestaPercorso, conDirezioni: Boolean): Esito<List<Percorso>> {
        val corpo = corpoRichiesta(r, conDirezioni).toString()
        val risposta = invia(
            Q_PERCORSI,
            RichiestaHttp(
                "POST", "$indirizzoBase/v2/directions/driving-car/geojson",
                mapOf("Content-Type" to "application/json; charset=utf-8", "Accept" to "application/geo+json"),
                corpo,
            ),
        )
        if (risposta is Esito.Errore) return risposta
        val testo = (risposta as Esito.Ok).valore.corpo
        return leggiPercorsi(testo, r)
    }

    /** Interpreta la risposta GeoJSON (pubblica per le prove automatiche). */
    fun leggiPercorsi(testo: String, r: RichiestaPercorso): Esito<List<Percorso>> {
        val radice = J.leggi(testo) ?: return Esito.Errore(TipoErrore.SCONOSCIUTO, "Risposta del servizio non leggibile.")
        val elementi = radice.lista("features") ?: return Esito.Errore(TipoErrore.SCONOSCIUTO, "Risposta senza percorsi.")
        val percorsi = elementi.mapNotNull { f ->
            val prop = f.ogg("properties") ?: return@mapNotNull null
            val geom = f.ogg("geometry")?.lista("coordinates")?.map { it.comePunto() } ?: return@mapNotNull null
            val sommario = prop.ogg("summary")
            val manovre = prop.lista("segments").orEmpty().flatMap { seg ->
                seg.lista("steps").orEmpty().map { s ->
                    val wp = s.lista("way_points")
                    Manovra(
                        tipo = s.intero("type") ?: 6,
                        istruzione = s.testo("instruction") ?: "",
                        nomeStrada = s.testo("name")?.takeIf { it != "-" } ?: "",
                        distanza = s.numero("distance") ?: 0.0,
                        durata = s.numero("duration") ?: 0.0,
                        daIndice = wp?.getOrNull(0)?.jsonPrimitive?.content?.toIntOrNull() ?: 0,
                        aIndice = wp?.getOrNull(1)?.jsonPrimitive?.content?.toIntOrNull() ?: 0,
                        uscita = s.intero("exit_number"),
                    )
                }
            }
            val avvisi = prop.lista("warnings").orEmpty().mapNotNull { it.testo("message") }
            Percorso(
                geometria = geom,
                distanza = sommario.numero("distance") ?: 0.0,
                durata = sommario.numero("duration") ?: 0.0,
                manovre = manovre,
                indiciPunti = prop.lista("way_points").orEmpty().map { it.jsonPrimitive.content.toInt() },
                puntiRichiesta = r.punti,
                avvisi = avvisi,
            )
        }
        if (percorsi.isEmpty()) return Esito.Errore(TipoErrore.NESSUN_PERCORSO, "Il servizio non ha restituito percorsi.")
        return Esito.Ok(percorsi)
    }

    // ==================================================================
    // Aggancio alla strada
    // ==================================================================

    private fun aggancia(punti: List<Punto>, raggio: Double): Esito<List<PuntoAgganciato?>> {
        val corpo = buildJsonObject {
            putJsonArray("locations") { punti.forEach { add(it.comeJson()) } }
            put("radius", raggio)
        }.toString()
        val risposta = invia(
            Q_AGGANCIO,
            RichiestaHttp("POST", "$indirizzoBase/v2/snap/driving-car/json", mapOf("Content-Type" to "application/json"), corpo),
        )
        if (risposta is Esito.Errore) return risposta
        val radice = J.leggi((risposta as Esito.Ok).valore.corpo)
            ?: return Esito.Errore(TipoErrore.SCONOSCIUTO, "Risposta dell'aggancio non leggibile.")
        val posizioni = radice.lista("locations") ?: return Esito.Errore(TipoErrore.SCONOSCIUTO, "Risposta dell'aggancio senza punti.")
        return Esito.Ok(
            posizioni.mapIndexed { i, el ->
                val o = el as? JsonObject ?: return@mapIndexed null
                val loc = o["location"] ?: return@mapIndexed null
                PuntoAgganciato(punti[i], loc.comePunto(), o.testo("name") ?: "", o.numero("snapped_distance") ?: 0.0)
            },
        )
    }

    // ==================================================================
    // Ricerca indirizzi
    // ==================================================================

    private fun cod(s: String) = URLEncoder.encode(s, "UTF-8")

    private fun ricerca(tipo: String, quota: String, testo: String, vicinoA: Punto?): Esito<List<RisultatoRicerca>> {
        val k = chiave() ?: return mancaChiave()
        var url = "$indirizzoBase/geocode/$tipo?api_key=${cod(k)}&text=${cod(testo)}&size=8&lang=it"
        if (vicinoA != null) url += "&focus.point.lat=${vicinoA.lat}&focus.point.lon=${vicinoA.lon}"
        val risposta = invia(quota, RichiestaHttp("GET", url), chiaveInUrl = true)
        if (risposta is Esito.Errore) return risposta
        return Esito.Ok(leggiLuoghi((risposta as Esito.Ok).valore.corpo))
    }

    private fun inverso(p: Punto): Esito<RisultatoRicerca?> {
        val k = chiave() ?: return mancaChiave()
        val url = "$indirizzoBase/geocode/reverse?api_key=${cod(k)}&point.lat=${p.lat}&point.lon=${p.lon}&size=1&lang=it"
        val risposta = invia(Q_INVERSO, RichiestaHttp("GET", url), chiaveInUrl = true)
        if (risposta is Esito.Errore) return risposta
        return Esito.Ok(leggiLuoghi((risposta as Esito.Ok).valore.corpo).firstOrNull())
    }

    /** Legge i risultati Pelias (pubblica per le prove automatiche). */
    fun leggiLuoghi(testo: String): List<RisultatoRicerca> {
        val radice = J.leggi(testo) ?: return emptyList()
        return radice.lista("features").orEmpty().mapNotNull { f ->
            val p = f.ogg("properties") ?: return@mapNotNull null
            val coord = f.ogg("geometry")?.get("coordinates") ?: return@mapNotNull null
            val nome = p.testo("name") ?: p.testo("label") ?: return@mapNotNull null
            val dettaglio = listOfNotNull(p.testo("locality") ?: p.testo("county"), p.testo("region"), p.testo("country"))
                .distinct().joinToString(", ")
            RisultatoRicerca(nome, dettaglio, coord.comePunto())
        }
    }

    // ==================================================================
    // Invio e gestione errori comuni
    // ==================================================================

    private fun mancaChiave() = Esito.Errore(
        TipoErrore.CHIAVE_MANCANTE,
        "Manca la chiave personale di openrouteservice. Inseriscila in Impostazioni › Servizi.",
    )

    private fun invia(quota: String, richiesta: RichiestaHttp, chiaveInUrl: Boolean = false): Esito<RispostaHttp> {
        val k = chiave()
        if (k.isNullOrBlank()) return mancaChiave()
        quote?.controlla(quota)?.let { return Esito.Errore(TipoErrore.QUOTA_ESAURITA, it) }
        val conChiave = if (chiaveInUrl) richiesta else richiesta.copy(intestazioni = richiesta.intestazioni + ("Authorization" to k))
        val risposta = try {
            http.esegui(conChiave)
        } catch (e: IOException) {
            return Esito.Errore(
                TipoErrore.RETE_ASSENTE,
                "Nessuna connessione a internet (o servizio irraggiungibile). Il percorso già scaricato resta disponibile.",
                e.message,
            )
        }
        quote?.registra(quota, risposta.intestazioni)
        if (risposta.codice in 200..299) return Esito.Ok(risposta)
        return erroreDa(risposta, quota)
    }

    /** Traduce un errore del servizio in un messaggio comprensibile. */
    fun erroreDa(r: RispostaHttp, quota: String): Esito.Errore {
        val radice = J.leggi(r.corpo)
        val errore: JsonElement? = (radice as? JsonObject)?.get("error")
        val codice = (errore as? JsonObject)?.intero("code")
        val testo = when (errore) {
            is JsonObject -> errore.testo("message")
            is JsonPrimitive -> errore.content
            else -> null
        } ?: r.corpo.take(300)
        val dettaglio = "HTTP ${r.codice}" + (codice?.let { ", codice $it" } ?: "") + ": $testo"
        return when {
            r.codice == 401 -> Esito.Errore(TipoErrore.CHIAVE_NON_VALIDA, "La chiave di openrouteservice non è valida.", dettaglio)
            r.codice == 403 && testo.contains("quota", true) -> {
                quote?.segnaEsaurita(quota)
                Esito.Errore(TipoErrore.QUOTA_ESAURITA, "Quota giornaliera di openrouteservice esaurita. Si azzera ogni giorno.", dettaglio)
            }
            r.codice == 403 -> Esito.Errore(
                TipoErrore.CHIAVE_NON_VALIDA,
                "Accesso negato da openrouteservice: chiave non valida o quota giornaliera esaurita.",
                dettaglio,
            )
            r.codice == 429 -> Esito.Errore(
                TipoErrore.QUOTA_ESAURITA,
                "Troppe richieste in poco tempo (limite al minuto o al giorno di openrouteservice). Riprova più tardi.",
                dettaglio,
            )
            r.codice == 404 && codice == null -> Esito.Errore(
                TipoErrore.SERVIZIO_NON_DISPONIBILE, "Servizio non trovato su questo server.", dettaglio,
            )
            r.codice >= 500 && codice == null -> Esito.Errore(
                TipoErrore.SERVIZIO_NON_DISPONIBILE, "Il servizio openrouteservice al momento non risponde.", dettaglio,
            )
            codice == 2009 -> Esito.Errore(
                TipoErrore.NESSUN_PERCORSO,
                "Non esiste un percorso stradale che rispetti tutti i vincoli richiesti.",
                dettaglio,
            )
            codice == 2010 -> Esito.Errore(
                TipoErrore.PUNTO_NON_RAGGIUNGIBILE,
                "Un punto è troppo lontano da una strada percorribile in auto.",
                dettaglio,
                Regex("coordinate (\\d+)").find(testo)?.groupValues?.get(1)?.toIntOrNull(),
            )
            codice == 2004 -> Esito.Errore(
                TipoErrore.LIMITI_SUPERATI,
                "La richiesta supera i limiti del servizio (es. aree troppo grandi o percorso con aree da evitare oltre 150 km).",
                dettaglio,
            )
            else -> Esito.Errore(TipoErrore.RICHIESTA_NON_VALIDA, "Il servizio ha rifiutato la richiesta.", dettaglio)
        }
    }
}
