package com.ric.navigatore.nucleo.simulazione

import com.ric.navigatore.nucleo.geo.Aree
import com.ric.navigatore.nucleo.geo.Geo
import com.ric.navigatore.nucleo.geo.Poligono
import com.ric.navigatore.nucleo.geo.Punto
import com.ric.navigatore.nucleo.servizi.ClientHttp
import com.ric.navigatore.nucleo.servizi.RichiestaHttp
import com.ric.navigatore.nucleo.servizi.RispostaHttp
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.add
import kotlinx.serialization.json.addJsonArray
import kotlinx.serialization.json.addJsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import java.io.IOException

/**
 * Finto server openrouteservice: riceve le STESSE richieste JSON che l'app
 * invierebbe al servizio vero e risponde nello stesso formato GeoJSON,
 * calcolando i percorsi sulla [CittaSimulata].
 *
 * Così le prove controllano anche la costruzione delle richieste e la
 * lettura delle risposte, non solo la logica.
 */
class ServerOrsFinto(val citta: CittaSimulata = CittaSimulata()) : ClientHttp {
    /** Richieste ricevute (per controllarle nelle prove). */
    val ricevute = mutableListOf<RichiestaHttp>()

    /** Se impostato, il server risponde sempre così (quota esaurita, ecc.). */
    var rispostaForzata: RispostaHttp? = null

    /** Se vero, simula l'assenza di rete. */
    var senzaRete = false

    val richiestePercorso get() = ricevute.count { "/directions/" in it.url }

    override fun esegui(richiesta: RichiestaHttp): RispostaHttp {
        if (senzaRete) throw IOException("Unable to resolve host \"api.openrouteservice.org\"")
        ricevute += richiesta
        rispostaForzata?.let { return it }
        if (richiesta.intestazioni["Authorization"].isNullOrBlank()) {
            return RispostaHttp(401, """{"error":"Authorization field missing"}""")
        }
        val corpo = Json.parseToJsonElement(richiesta.corpo ?: "{}").jsonObject
        return when {
            "/v2/directions/driving-car/geojson" in richiesta.url -> percorso(corpo)
            "/v2/snap/driving-car/json" in richiesta.url -> aggancio(corpo)
            else -> RispostaHttp(404, """{"error":"Not found"}""")
        }
    }

    private fun punto(el: kotlinx.serialization.json.JsonElement) =
        el.jsonArray.let { Punto(it[1].jsonPrimitive.double, it[0].jsonPrimitive.double) }

    private fun errore(codice: Int, messaggio: String) =
        RispostaHttp(404, buildJsonObject {
            putJsonObject("error") { put("code", codice); put("message", messaggio) }
        }.toString())

    // ------------------------------------------------------------------

    private fun aggancio(corpo: JsonObject): RispostaHttp {
        val raggio = corpo["radius"]!!.jsonPrimitive.double
        val liberi = citta.archi
        val risposta = buildJsonObject {
            putJsonArray("locations") {
                corpo["locations"]!!.jsonArray.forEach { el ->
                    val p = punto(el)
                    val a = citta.aggancia(p, liberi, raggio, null, 180.0)
                    if (a == null) add(JsonNull) else addJsonObject {
                        putJsonArray("location") { add(a.punto.lon); add(a.punto.lat) }
                        put("name", a.arco.nome)
                        put("snapped_distance", a.distanza)
                    }
                }
            }
        }
        return RispostaHttp(200, risposta.toString())
    }

    // ------------------------------------------------------------------

    private fun percorso(corpo: JsonObject): RispostaHttp {
        val punti = corpo["coordinates"]!!.jsonArray.map(::punto)
        val direzioni = corpo["bearings"]?.jsonArray?.map { b ->
            val a = b.jsonArray
            a[0].jsonPrimitive.double to a[1].jsonPrimitive.double
        }
        val raggi = corpo["radiuses"]?.jsonArray?.map { it.jsonPrimitive.double } ?: punti.map { 350.0 }
        val dritto = corpo["continue_straight"]?.jsonPrimitive?.content == "true"
        val opzioni = corpo["options"]?.jsonObject
        val aree = opzioni?.get("avoid_polygons")?.jsonObject?.let { mp ->
            check(mp["type"]!!.jsonPrimitive.content == "MultiPolygon")
            mp["coordinates"]!!.jsonArray.map { poli ->
                val anelli = poli.jsonArray.map { an -> an.jsonArray.map(::punto).dropLast(1) }
                Poligono(anelli.first(), anelli.drop(1))
            }
        }.orEmpty()
        for (a in aree) if (Aree.superficie(a) > 200e6) return errore(2004, "Request parameters exceed the server configuration limits. The area of the avoid_polygons exceeds 200 km2.")
        val liberi = citta.archiLiberi(aree)

        // Aggancio di ogni punto (con direzione, se richiesta)
        val agganciPossibili = punti.mapIndexed { k, p ->
            val r = raggi[k].let { if (it < 0) 1e9 else it }
            val (dir, toll) = direzioni?.get(k)?.let { (d, t) -> (if (t >= 180) null else d) to t } ?: (null to 180.0)
            val tutti = liberi.mapNotNull { a ->
                if (dir != null && Geo.differenzaAngoli(dir, Geo.direzione(citta.punto(a.a), citta.punto(a.b))) > toll) return@mapNotNull null
                val pr = Geo.proietta(listOf(citta.punto(a.a), citta.punto(a.b)), p)
                if (pr.distanza > r) null else CittaSimulata.Aggancio(a, pr.frazione, pr.punto, pr.distanza)
            }
            if (tutti.isEmpty()) {
                return errore(2010, "Could not find routable point within a radius of ${raggi[k]} meters of specified coordinate $k: ${p.lon} ${p.lat}.")
            }
            // tutti gli archi alla distanza minima (i due sensi della stessa strada)
            val minimo = tutti.minOf { it.distanza }
            tutti.filter { it.distanza <= minimo + 0.5 }
        }

        val alternative = corpo["alternative_routes"]?.jsonObject?.get("target_count")?.jsonPrimitive?.int ?: 1
        val risultati = mutableListOf<List<Tratto>>()
        val penalita = mutableMapOf<CittaSimulata.Arco, Double>()
        repeat(if (punti.size == 2) alternative else 1) { n ->
            val tratti = calcolaTratti(agganciPossibili, liberi, dritto, penalita)
                ?: return if (n == 0) errore(2009, "Route could not be found - Unable to find a route between points 1 (${punti.first().lon} ${punti.first().lat}) and ${punti.size} (${punti.last().lon} ${punti.last().lat}).") else return@repeat
            val nodi = tratti.flatMap { it.nodi }.toSet()
            if (risultati.none { r -> r.flatMap { it.nodi }.toSet() == nodi }) risultati += tratti
            // penalizziamo gli archi usati per trovare un'alternativa diversa
            for (t in tratti) t.nodi.zipWithNext().forEach { (a, b) ->
                citta.archi.filter { it.a == a && it.b == b }.forEach { penalita[it] = (penalita[it] ?: 1.0) * 1.8 }
            }
        }
        return RispostaHttp(200, geojson(risultati, punti.size).toString())
    }

    /** Un tratto fra due punti consecutivi della richiesta. */
    private data class Tratto(val da: CittaSimulata.Aggancio, val a: CittaSimulata.Aggancio, val nodi: List<Pair<Int, Int>>)

    private fun calcolaTratti(
        agganci: List<List<CittaSimulata.Aggancio>>,
        liberi: List<CittaSimulata.Arco>,
        dritto: Boolean,
        penalita: Map<CittaSimulata.Arco, Double>,
    ): List<Tratto>? {
        val out = mutableListOf<Tratto>()
        var partenze = agganci[0]
        for (k in 1 until agganci.size) {
            var migliore: Triple<CittaSimulata.Aggancio, CittaSimulata.Aggancio, Pair<List<Pair<Int, Int>>, Double>>? = null
            for (da in partenze) for (a in agganci[k]) {
                val r = citta.cerca(da, a, liberi, penalita) ?: continue
                if (migliore == null || r.second < migliore.third.second) migliore = Triple(da, a, r)
            }
            migliore ?: return null
            out += Tratto(migliore.first, migliore.second, migliore.third.first)
            // si riparte dallo stesso arco (prosegui dritto) o anche nel senso opposto (inversione permessa)
            val arrivo = migliore.second
            partenze = if (dritto) listOf(arrivo) else listOfNotNull(
                arrivo,
                liberi.firstOrNull { it == arrivo.arco.inverso }?.let { CittaSimulata.Aggancio(it, 1 - arrivo.f, arrivo.punto, arrivo.distanza) },
            )
        }
        return out
    }

    // ------------------------------------------------------------------
    // Risposta in formato GeoJSON come openrouteservice
    // ------------------------------------------------------------------

    private fun geojson(percorsi: List<List<Tratto>>, nPunti: Int) = buildJsonObject {
        put("type", "FeatureCollection")
        putJsonArray("features") {
            for (tratti in percorsi) addJsonObject {
                put("type", "Feature")
                val coordinate = mutableListOf<Punto>()
                val wayPoints = mutableListOf<Int>()
                val segmenti = buildJsonArray {
                    tratti.forEachIndexed { k, t ->
                        val punti = listOf(t.da.punto) + t.nodi.map { citta.punto(it) } + listOf(t.a.punto)
                        val base = if (coordinate.isEmpty()) 0 else coordinate.size - 1
                        if (coordinate.isEmpty()) { coordinate += punti; wayPoints += 0 } else coordinate += punti.drop(1)
                        wayPoints += coordinate.size - 1
                        add(segmento(t, punti, base, ultimo = k == tratti.size - 1))
                    }
                }
                putJsonObject("properties") {
                    put("segments", segmenti)
                    val dist = segmenti.sumOf { it.jsonObject["distance"]!!.jsonPrimitive.double }
                    val dur = segmenti.sumOf { it.jsonObject["duration"]!!.jsonPrimitive.double }
                    putJsonObject("summary") { put("distance", dist); put("duration", dur) }
                    putJsonArray("way_points") { wayPoints.forEach { add(it) } }
                }
                putJsonObject("geometry") {
                    put("type", "LineString")
                    putJsonArray("coordinates") { coordinate.forEach { p -> addJsonArray { add(p.lon); add(p.lat) } } }
                }
            }
        }
        check(nPunti >= 2)
    }

    private fun segmento(t: Tratto, punti: List<Punto>, base: Int, ultimo: Boolean): JsonObject {
        // nomi e velocità di ogni pezzo
        val nodiCompleti = listOf(t.da.arco.a) + t.nodi + listOf(t.a.arco.b)
        val pezzi = (0 until punti.size - 1).map { i ->
            val nome = when {
                t.nodi.isEmpty() -> t.da.arco.nome
                i == 0 -> t.da.arco.nome
                i == punti.size - 2 -> t.a.arco.nome
                else -> citta.nomeArco(t.nodi[i - 1], t.nodi[i])
            }
            val vel = if (i == 0) t.da.arco.velocita else if (i == punti.size - 2) t.a.arco.velocita else citta.velocitaArco(t.nodi[i - 1], t.nodi[i])
            Triple(nome, Geo.distanza(punti[i], punti[i + 1]), vel)
        }
        check(nodiCompleti.isNotEmpty())
        // raggruppiamo i pezzi consecutivi sulla stessa strada
        val passi = buildJsonArray {
            var inizio = 0
            while (inizio < pezzi.size) {
                var fine = inizio
                while (fine + 1 < pezzi.size && pezzi[fine + 1].first == pezzi[inizio].first) fine++
                val dist = (inizio..fine).sumOf { pezzi[it].second }
                val dur = (inizio..fine).sumOf { pezzi[it].second / pezzi[it].third }
                val nome = pezzi[inizio].first
                val (tipo, testo) = if (inizio == 0) {
                    11 to "Parti in direzione ${cardinale(Geo.direzione(punti[0], punti[1]))} su $nome"
                } else {
                    val dentro = Geo.direzione(punti[inizio - 1], punti[inizio])
                    val fuori = Geo.direzione(punti[inizio], punti[inizio + 1])
                    svolta(dentro, fuori, nome)
                }
                addJsonObject {
                    put("distance", dist); put("duration", dur); put("type", tipo)
                    put("instruction", testo); put("name", nome)
                    putJsonArray("way_points") { add(base + inizio); add(base + fine + 1) }
                }
                inizio = fine + 1
            }
            val k = base + punti.size - 1
            addJsonObject {
                put("distance", 0.0); put("duration", 0.0); put("type", 10)
                put("instruction", if (ultimo) "Arrivo a destinazione" else "Arrivo al punto intermedio"); put("name", "-")
                putJsonArray("way_points") { add(k); add(k) }
            }
        }
        return buildJsonObject {
            put("distance", pezzi.sumOf { it.second })
            put("duration", pezzi.sumOf { it.second / it.third })
            put("steps", passi)
        }
    }

    private fun cardinale(g: Double) = listOf("nord", "nord-est", "est", "sud-est", "sud", "sud-ovest", "ovest", "nord-ovest")[((g + 22.5) / 45).toInt() % 8]

    private fun svolta(dentro: Double, fuori: Double, nome: String): Pair<Int, String> {
        var d = fuori - dentro
        while (d > 180) d -= 360
        while (d <= -180) d += 360
        return when {
            d > 135 -> 3 to "Svolta decisamente a destra su $nome"
            d > 60 -> 1 to "Svolta a destra su $nome"
            d > 20 -> 5 to "Svolta leggermente a destra su $nome"
            d < -135 -> 2 to "Svolta decisamente a sinistra su $nome"
            d < -60 -> 0 to "Svolta a sinistra su $nome"
            d < -20 -> 4 to "Svolta leggermente a sinistra su $nome"
            else -> 6 to "Prosegui dritto su $nome"
        }
    }
}

