package com.ric.navigatore.nucleo

import com.ric.navigatore.nucleo.geo.Geo
import com.ric.navigatore.nucleo.geo.PianoLocale
import com.ric.navigatore.nucleo.geo.Pericoli
import com.ric.navigatore.nucleo.geo.Punto
import com.ric.navigatore.nucleo.geo.TipoPericolo
import com.ric.navigatore.nucleo.modello.Manovra
import com.ric.navigatore.nucleo.modello.Percorso
import com.ric.navigatore.nucleo.modello.TipoManovra
import com.ric.navigatore.nucleo.navigazione.Anteprima
import com.ric.navigatore.nucleo.navigazione.GestoreAnteprima
import com.ric.navigatore.nucleo.navigazione.Posizione
import com.ric.navigatore.nucleo.navigazione.RicercaSulPercorso
import com.ric.navigatore.nucleo.navigazione.Riferimento
import com.ric.navigatore.nucleo.navigazione.Segnale
import com.ric.navigatore.nucleo.navigazione.SorveglianzaPericoli
import com.ric.navigatore.nucleo.navigazione.StatoGuida
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Prove della versione 1.2: anteprima degli incroci, avvisi per tornanti
 * e pendenze, ricerca di un punto lungo il percorso.
 * Tutte su percorsi costruiti a mano (nessun servizio esterno).
 */
class GuidaAvanzataTest {
    private val piano = PianoLocale(Punto(46.10, 12.70))
    private fun p(x: Double, y: Double) = piano.punto(x, y)

    /** Percorso semplice dai punti dati, con le manovre indicate. */
    private fun percorso(punti: List<Punto>, manovre: List<Manovra> = emptyList(), quote: List<Double>? = null): Percorso {
        val lung = Geo.lunghezza(punti)
        val tutte = listOf(Manovra(TipoManovra.PARTENZA, "Parti", "", lung, 60.0, 0, 0)) + manovre +
            Manovra(TipoManovra.ARRIVO, "Sei arrivato", "", 0.0, 0.0, punti.lastIndex, punti.lastIndex)
        return Percorso(punti, lung, lung / 14, tutte, listOf(0, punti.lastIndex), quote = quote)
    }

    private fun stato(m: Manovra, distanza: Double, s: Double = 0.0) = StatoGuida(
        puntoSulPercorso = p(0.0, 0.0), progressiva = s, distanzaDalPercorso = 0.0, manovra = m, distanzaManovra = distanza,
        manovraDopo = null, distanzaResidua = 5000.0, tempoResiduo = 300.0, arrivoPrevisto = 0, fuoriPercorso = false,
        segnale = Segnale.BUONO, arrivato = false, puntiRaggiunti = emptySet(),
    )

    @Test
    fun `anteprima con anticipo proporzionale alla velocita`() {
        val svolta = Manovra(TipoManovra.DESTRA, "Svolta a destra su Via Roma", "Via Roma", 500.0, 40.0, 1, 2)
        val uscita = Manovra(TipoManovra.MANTIENI_DESTRA, "Tieni la destra", "", 500.0, 40.0, 1, 2)
        // a passo d'uomo: mai meno di 150 m
        assertEquals(150.0, Anteprima.anticipo(3.0, svolta), 1e-6)
        // a 50 km/h (13,9 m/s): 12 secondi = ~167 m
        assertEquals(13.9 * 12, Anteprima.anticipo(13.9, svolta), 0.1)
        // a 130 km/h (36 m/s) per un'uscita: 20 secondi = 720 m
        assertEquals(720.0, Anteprima.anticipo(36.0, uscita), 0.1)
        // un'uscita anche a 70 km/h usa 20 secondi
        assertTrue(Anteprima.anticipo(19.4, uscita) > Anteprima.anticipo(19.4, svolta))
        // mai oltre 1,5 km
        assertEquals(1500.0, Anteprima.anticipo(100.0, uscita), 1e-6)

        val g = GestoreAnteprima()
        assertNull(g.aggiorna(stato(svolta, 400.0), 13.9))      // troppo lontano
        assertEquals(svolta, g.aggiorna(stato(svolta, 160.0), 13.9))
        // se rallento, l'anteprima NON sparisce finché la svolta non è superata
        assertEquals(svolta, g.aggiorna(stato(svolta, 155.0), 2.0))
        // "prosegui dritto" e arrivo non hanno anteprima
        assertNull(GestoreAnteprima().aggiorna(stato(Manovra(TipoManovra.DRITTO, "Prosegui", "", 1.0, 1.0, 1, 2), 50.0), 10.0))
        // l'utente la chiude: non torna per la stessa manovra
        g.nascondi()
        assertNull(g.aggiorna(stato(svolta, 100.0), 13.9))
        assertEquals("Rotatoria: 2ª uscita", Anteprima.titolo(Manovra(TipoManovra.ROTATORIA, "", "", 1.0, 1.0, 1, 2, uscita = 2)))
    }

    @Test
    fun `geometria dell'anteprima orientata come si arriva`() {
        // si va verso nord per 500 m, poi a destra (est)
        val punti = listOf(p(0.0, 0.0), p(0.0, 500.0), p(400.0, 500.0))
        val svolta = Manovra(TipoManovra.DESTRA, "Svolta a destra", "", 400.0, 30.0, 1, 2)
        val g = Anteprima.geometria(percorso(punti, listOf(svolta)), svolta)
        assertTrue(Geo.distanza(g.centro, punti[1]) < 1)
        assertEquals(0.0, g.direzioneArrivo, 2.0)   // si arriva da sud andando a nord
        assertEquals(90.0, g.direzioneUscita, 2.0)  // si esce verso est
        assertTrue(Geo.distanza(g.prima.last(), punti[1]) < 1 && Geo.distanza(g.dopo.first(), punti[1]) < 1)
    }

    /** Strada di montagna: tratti di 250 m alternati est/ovest, collegati da tornanti di 12 m di raggio. */
    private fun stradaATornanti(numero: Int): List<Punto> {
        val out = mutableListOf(p(0.0, 0.0))
        var y = 0.0
        var x = 0.0
        for (k in 0..numero) {
            val verso = if (k % 2 == 0) 1 else -1
            x += 250.0 * verso
            out += p(x, y)
            if (k == numero) break
            // semicerchio verso nord
            for (a in 1..8) {
                val ang = PI * a / 8
                out += p(x + verso * 12 * sin(ang), y + 12 - 12 * cos(ang))
            }
            y += 24
        }
        return out
    }

    @Test
    fun `serie di tornanti riconosciuta, svolte agli incroci ignorate`() {
        val tratti = Pericoli.serieDiCurve(percorso(stradaATornanti(4)))
        assertEquals(1, tratti.size, "una sola serie: $tratti")
        assertEquals(4, tratti[0].tornanti)
        assertEquals("Serie di 4 tornanti", Pericoli.descrizione(tratti[0]))

        // svolta a 90° in un incrocio (c'è una manovra): non è una curva
        val incrocio = listOf(p(0.0, 0.0), p(0.0, 500.0), p(400.0, 500.0))
        assertTrue(Pericoli.curve(percorso(incrocio, listOf(Manovra(TipoManovra.DESTRA, "Svolta", "", 400.0, 30.0, 1, 2)))).isEmpty())
        // un'inversione stretta SENZA manovra (es. tornante isolato) invece sì
        val isolato = listOf(p(0.0, 0.0), p(0.0, 500.0), p(10.0, 512.0), p(20.0, 500.0), p(20.0, 0.0))
        val unico = Pericoli.serieDiCurve(percorso(isolato))
        assertEquals(1, unico.size)
        assertEquals("Tornante", Pericoli.descrizione(unico[0]))
        // strada dritta: nulla
        assertTrue(Pericoli.serieDiCurve(percorso(listOf(p(0.0, 0.0), p(0.0, 3000.0)))).isEmpty())
    }

    @Test
    fun `discesa ripida dalle quote, avviso per tutto il tratto`() {
        // 3 km verso nord: 1 km in piano, 1 km in discesa al 10%, 1 km in piano
        val punti = (0..30).map { p(0.0, it * 100.0) }
        val quote = (0..30).map { i -> when { i <= 10 -> 500.0; i <= 20 -> 500.0 - (i - 10) * 10.0; else -> 400.0 } }
        val tratti = Pericoli.pendenze(percorso(punti, quote = quote), 8.0)
        assertEquals(1, tratti.size, "$tratti")
        val t = tratti[0]
        assertEquals(TipoPericolo.DISCESA_RIPIDA, t.tipo)
        assertTrue(t.inizio in 800.0..1100.0 && t.fine in 1900.0..2200.0, "$t")
        assertTrue(t.pendenzaMedia in -11.0..-7.5, "$t")
        // pendenza leggera (5%): nessun avviso
        val dolci = (0..30).map { 500.0 - it * 5.0 }
        assertTrue(Pericoli.pendenze(percorso(punti, quote = dolci), 8.0).isEmpty())

        val s = SorveglianzaPericoli(tratti)
        val v = 14.0 // ~50 km/h: anticipo 210 m
        assertTrue(s.aggiorna(t.inizio - 400, v).first.isEmpty())
        val (avvisi, frase) = s.aggiorna(t.inizio - 150, v)
        assertEquals(1, avvisi.size)
        assertTrue(!avvisi[0].inCorso && avvisi[0].testo.startsWith("Tra"))
        assertNotNull(frase)
        assertTrue(frase.contains("discesa ripida"), frase)
        // la voce lo dice UNA volta sola, ma l'avviso resta per tutta la discesa
        val (dentro, ancora) = s.aggiorna(t.inizio + 300, v)
        assertNull(ancora)
        assertTrue(dentro.single().inCorso && dentro.single().testo.contains("ancora"))
        assertTrue(s.aggiorna(t.fine + 10, v).first.isEmpty())
    }

    @Test
    fun `frasi della ricerca sul percorso`() {
        RicercaSulPercorso.interpreta("Prima dell'uscita per Bologna")!!.let {
            assertEquals("bologna", it.nome); assertEquals(Riferimento.USCITA, it.riferimento); assertEquals(Posizione.PRIMA, it.posizione)
        }
        RicercaSulPercorso.interpreta("centrati prima della svolta per Meduno")!!.let {
            assertEquals("meduno", it.nome); assertEquals(Riferimento.SVOLTA, it.riferimento)
        }
        RicercaSulPercorso.interpreta("prima della città di Roma")!!.let {
            assertEquals("roma", it.nome); assertEquals(Riferimento.LUOGO, it.riferimento)
        }
        RicercaSulPercorso.interpreta("dopo il casello di San Donà di Piave per favore")!!.let {
            assertEquals("san dona di piave", it.nome); assertEquals(Posizione.DOPO, it.posizione); assertEquals("San Dona Di Piave", it.nomeLeggibile)
        }
        assertNull(RicercaSulPercorso.interpreta("prima della svolta"))
    }

    @Test
    fun `ricerca solo sulla parte di percorso ancora da fare`() {
        // nord 2 km, poi a destra su Via Meduno per 2 km, poi a sinistra su Via Roma
        val punti = listOf(p(0.0, 0.0), p(0.0, 2000.0), p(2000.0, 2000.0), p(2000.0, 4000.0))
        val m1 = Manovra(TipoManovra.DESTRA, "Svolta a destra su Via Meduno", "Via Meduno", 2000.0, 100.0, 1, 2)
        val m2 = Manovra(TipoManovra.SINISTRA, "Svolta a sinistra su Via Roma", "Via Roma", 2000.0, 100.0, 2, 3)
        val per = percorso(punti, listOf(m1, m2))

        // 1) trovato fra le indicazioni: la mappa va 200 m PRIMA della svolta
        val d = RicercaSulPercorso.interpreta("prima della svolta per via Meduno")!!
        val r = RicercaSulPercorso.cercaNelleIndicazioni(d, per, 0.0)!!
        assertEquals(m1, r.manovra)
        assertEquals(1800.0, r.progressiva, 1.0)
        // ...ma se la svolta è già alle spalle non si trova più
        assertNull(RicercaSulPercorso.cercaNelleIndicazioni(d, per, 2500.0))

        // 2) luogo trovato per nome vicino al secondo incrocio: si sceglie quell'incrocio
        val luogo = p(-300.0, 2100.0)
        val svolta = RicercaSulPercorso.interpreta("prima della svolta per Meduno")!!
        val r2 = RicercaSulPercorso.vicinoAlLuogo(svolta, per, 0.0, luogo)
        assertEquals(m1, r2.manovra)
        // da metà strada in poi resta solo il secondo incrocio
        assertEquals(m2, RicercaSulPercorso.vicinoAlLuogo(svolta, per, 2500.0, luogo).manovra)

        // 3) una città: "prima di" = poco prima di entrarci (raggio di almeno 3 km attorno al centro)
        val citta = p(2000.0, 7000.0)
        val r3 = RicercaSulPercorso.vicinoAlLuogo(RicercaSulPercorso.interpreta("prima di Roma")!!, per, 0.0, citta)
        assertNull(r3.manovra)
        assertTrue(r3.progressiva in 4000.0..5900.0, "${r3.progressiva}")
        // luogo lontanissimo dal percorso: si avvisa
        val lontano = RicercaSulPercorso.vicinoAlLuogo(RicercaSulPercorso.interpreta("Napoli")!!, per, 0.0, p(0.0, -300_000.0))
        assertNotNull(lontano.nota)
    }

    @Test
    fun `vincoli rapidi creati dalla finestra di esplorazione`() {
        val punti = listOf(p(0.0, 0.0), p(0.0, 2000.0))
        val per = percorso(punti)
        // evita 300 m di percorso attorno al punto a 1 km
        val t = com.ric.navigatore.nucleo.modello.VincoliRapidi.evitaTrattoDelPercorso(per, 1000.0, "Via Roma")
        assertEquals(300.0, Geo.lunghezza(t.linea), 1.0)
        assertTrue(Geo.distanza(t.linea.first(), p(0.0, 850.0)) < 1)
        assertTrue(t.nome.contains("Via Roma"))
        // vicino alla partenza il tratto si accorcia, senza uscire dal percorso
        assertEquals(250.0, Geo.lunghezza(com.ric.navigatore.nucleo.modello.VincoliRapidi.evitaTrattoDelPercorso(per, 100.0).linea), 1.0)
        // zona di 300 m e passaggio
        val z = com.ric.navigatore.nucleo.modello.VincoliRapidi.evitaZona(p(0.0, 1000.0))
        assertTrue(com.ric.navigatore.nucleo.geo.Aree.contiene(z.poligono, p(0.0, 1200.0)))
        assertTrue(!com.ric.navigatore.nucleo.geo.Aree.contiene(z.poligono, p(0.0, 1400.0)))
        assertEquals(p(10.0, 10.0), com.ric.navigatore.nucleo.modello.VincoliRapidi.passaDa(p(10.0, 10.0)).punto)
    }
}
