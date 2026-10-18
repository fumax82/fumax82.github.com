package com.ric.navigatore.nucleo

import com.ric.navigatore.nucleo.geo.Aree
import com.ric.navigatore.nucleo.geo.Geo
import com.ric.navigatore.nucleo.geo.Punto
import com.ric.navigatore.nucleo.modello.EvitaArea
import com.ric.navigatore.nucleo.modello.FormaArea
import com.ric.navigatore.nucleo.modello.Luogo
import com.ric.navigatore.nucleo.modello.Manovra
import com.ric.navigatore.nucleo.modello.PuntoRichiesta
import com.ric.navigatore.nucleo.modello.RichiestaPercorso
import com.ric.navigatore.nucleo.modello.Storico
import com.ric.navigatore.nucleo.modello.TipoPunto
import com.ric.navigatore.nucleo.modello.Vincolo
import com.ric.navigatore.nucleo.navigazione.Annunciatore
import com.ric.navigatore.nucleo.navigazione.StatoGuida
import com.ric.navigatore.nucleo.navigazione.Segnale
import com.ric.navigatore.nucleo.ors.Openrouteservice
import com.ric.navigatore.nucleo.pianificazione.Conflitti
import com.ric.navigatore.nucleo.servizi.RispostaHttp
import com.ric.navigatore.nucleo.simulazione.CittaSimulata
import com.ric.navigatore.nucleo.strade.ReteLocale
import com.ric.navigatore.nucleo.modello.Esito
import com.ric.navigatore.nucleo.modello.TipoErrore
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class UnitaTest {
    @Test
    fun `distanze e direzioni`() {
        val a = Punto(45.0, 11.0)
        val b = Punto(45.0, 11.01)
        assertEquals(786.0, Geo.distanza(a, b), 3.0) // ~786 m a 45° di latitudine
        assertEquals(90.0, Geo.direzione(a, b), 0.1)
        assertEquals(10.0, Geo.differenzaAngoli(355.0, 5.0), 1e-9)
    }

    @Test
    fun `fascia attorno a una strada e limiti delle aree`() {
        val c = CittaSimulata()
        val linea = listOf(c.nodo(0, 0), c.nodo(0, 5))
        val fascia = Aree.fascia(linea, 10.0).single()
        // 1000 m × 20 m = 20.000 m² circa
        assertEquals(20_000.0, Aree.superficie(fascia), 300.0)
        assertTrue(Aree.contiene(fascia, Geo.puntoAProgressiva(linea, 500.0)))
        // area enorme: conflitto bloccante per i limiti di openrouteservice
        val grande = EvitaArea(nome = "Enorme", forma = FormaArea.CERCHIO, poligono = Aree.cerchio(c.origine, 12_000.0))
        val conflitti = Conflitti.verifica(listOf(Luogo(Punto(46.0, 11.0), "a"), Luogo(Punto(46.1, 11.0), "b")), listOf(grande), Openrouteservice.CAPACITA)
        assertTrue(conflitti.any { it.bloccante && "troppo grande" in it.messaggio })
    }

    @Test
    fun `scelta di una strada dalla mappa e tratto fra incroci`() {
        val c = CittaSimulata()
        val rete = ReteLocale(c.stradeLocali())
        // tocco a metà fra gli incroci (4,3) e (4,4), 8 m a nord della via
        val tocco = Geo.interpola(c.nodo(4, 3), c.nodo(4, 4), 0.5).let { Punto(it.lat + 8 / 111_000.0, it.lon) }
        val candidati = rete.candidati(tocco)
        assertEquals("Via Orizzontale 4", candidati.first().strada.nome)
        val tratto = rete.trattoFraIncroci(candidati.first())
        assertEquals(200.0, Geo.lunghezza(tratto), 2.0) // proprio il pezzo fra i due incroci
        // tocco vicino a un incrocio: più strade candidate, da far scegliere all'utente
        val vicinoIncrocio = rete.candidati(Punto(c.nodo(4, 4).lat + 5 / 111_000.0, c.nodo(4, 4).lon + 5 / 78_000.0))
        assertTrue(vicinoIncrocio.size >= 2)
        // tratto fra due tocchi lungo la stessa via, anche oltre il "taglio di tassello" in colonna 7
        val da = rete.candidati(c.nodo(4, 5)).first { it.strada.nome == "Via Orizzontale 4" }
        val lungo = assertNotNull(rete.trattoFra(da, c.nodo(4, 10)))
        assertEquals(1000.0, Geo.lunghezza(lungo), 5.0)
        assertTrue(Geo.distanza(lungo.first(), c.nodo(4, 5)) < 2) // orientato dal primo tocco al secondo
        // il secondo tocco su un'altra strada viene rifiutato
        assertNull(rete.trattoFra(da, c.nodo(9, 10)))
    }

    @Test
    fun `annunci vocali alle distanze giuste`() {
        val m = Manovra(1, "Svolta a destra su Via Roma", "Via Roma", 300.0, 30.0, 10, 20)
        val a = Annunciatore()
        fun stato(d: Double) = StatoGuida(Punto(0.0, 0.0), 0.0, 0.0, m, d, null, 1000.0, 100.0, 0, false, Segnale.BUONO, false, emptySet())
        val frasi = listOf(900.0, 600.0, 390.0, 380.0, 200.0, 140.0, 100.0, 40.0, 20.0).mapNotNull { a.frase(stato(it), 10.0) }
        println(frasi)
        assertEquals(listOf("Tra 400 metri, svolta a destra su Via Roma", "Tra 150 metri, svolta a destra su Via Roma", "Svolta a destra su Via Roma"), frasi)
        assertEquals("1,5 chilometri", Annunciatore.distanzaParlata(1520.0))
    }

    @Test
    fun `annulla e ripristina`() {
        val s = Storico(listOf<Vincolo>())
        val v = EvitaArea(nome = "a", forma = FormaArea.CERCHIO, poligono = Aree.cerchio(Punto(45.0, 11.0), 100.0))
        s.registra(listOf(v))
        s.registra(listOf(v, v.copy(id = "b")))
        assertEquals(1, s.annulla().size)
        assertEquals(0, s.annulla().size)
        assertEquals(1, s.ripristina().size)
        s.registra(emptyList())
        assertTrue(!s.puoRipristinare)
    }

    @Test
    fun `lettura di una risposta openrouteservice reale nel formato e degli errori`() {
        // Struttura come nella documentazione di openrouteservice (valori abbreviati)
        val risposta = """
        {"type":"FeatureCollection","bbox":[8.681423,49.414599,8.690123,49.420514],
         "features":[{"bbox":[8.681423,49.414599,8.690123,49.420514],"type":"Feature",
           "properties":{"segments":[{"distance":1408.8,"duration":281.9,
              "steps":[{"distance":1.8,"duration":0.4,"type":11,"instruction":"Procedi verso est su Gerhart-Hauptmann-Straße","name":"Gerhart-Hauptmann-Straße","way_points":[0,1]},
                       {"distance":1407.0,"duration":281.5,"type":1,"instruction":"Svolta a destra su Wielandtstraße","name":"Wielandtstraße","way_points":[1,3]},
                       {"distance":0.0,"duration":0.0,"type":10,"instruction":"Arrivo a Wielandtstraße, sulla sinistra","name":"-","way_points":[3,3]}]}],
             "way_points":[0,3],"summary":{"distance":1408.8,"duration":281.9},
             "warnings":[{"code":1,"message":"There may be restrictions on some roads"}]},
           "geometry":{"coordinates":[[8.681423,49.414599],[8.681437,49.414615],[8.686,49.418],[8.690123,49.420514]],"type":"LineString"}}],
         "metadata":{"attribution":"openrouteservice.org | OpenStreetMap contributors","service":"routing"}}
        """.trimIndent()
        val ors = Openrouteservice({ "k" }, { RispostaHttp(200, "") })
        val r = RichiestaPercorso(listOf(PuntoRichiesta(Punto(49.414599, 8.681423), TipoPunto.PARTENZA), PuntoRichiesta(Punto(49.420514, 8.690123), TipoPunto.ARRIVO)))
        val p = (ors.leggiPercorsi(risposta, r) as Esito.Ok).valore.single()
        assertEquals(1408.8, p.distanza)
        assertEquals(3, p.manovre.size)
        assertEquals(listOf(0, 3), p.indiciPunti)
        assertEquals("Svolta a destra su Wielandtstraße", p.manovre[1].istruzione)
        assertEquals(1, p.avvisi.size)
        // errori
        val e2010 = ors.erroreDa(RispostaHttp(404, """{"error":{"code":2010,"message":"Could not find routable point within a radius of 350.0 meters of specified coordinate 1: 8.6 49.4."}}"""), "x")
        assertEquals(TipoErrore.PUNTO_NON_RAGGIUNGIBILE, e2010.tipo)
        assertEquals(1, e2010.indicePunto)
        assertEquals(TipoErrore.CHIAVE_NON_VALIDA, ors.erroreDa(RispostaHttp(403, """{"error":"Access to this API has been disallowed"}"""), "x").tipo)
        // la chiave viaggia nell'intestazione, MAI nel corpo della richiesta di percorso
        val corpo = ors.corpoRichiesta(r).toString()
        assertTrue("\"k\"" !in corpo)
        Json.parseToJsonElement(corpo)
    }
}
