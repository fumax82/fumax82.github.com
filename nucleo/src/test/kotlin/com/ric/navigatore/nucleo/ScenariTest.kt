package com.ric.navigatore.nucleo

import com.ric.navigatore.nucleo.geo.Altimetria
import com.ric.navigatore.nucleo.geo.Aree
import com.ric.navigatore.nucleo.geo.Geo
import com.ric.navigatore.nucleo.geo.PianoLocale
import com.ric.navigatore.nucleo.geo.Punto
import com.ric.navigatore.nucleo.modello.EvitaArea
import com.ric.navigatore.nucleo.modello.EvitaTratto
import com.ric.navigatore.nucleo.modello.FormaArea
import com.ric.navigatore.nucleo.modello.Luogo
import com.ric.navigatore.nucleo.modello.ModoArea
import com.ric.navigatore.nucleo.modello.OpzioniPercorso
import com.ric.navigatore.nucleo.modello.PassaArea
import com.ric.navigatore.nucleo.modello.PassaPunto
import com.ric.navigatore.nucleo.modello.PassaTratto
import com.ric.navigatore.nucleo.modello.Percorso
import com.ric.navigatore.nucleo.modello.Priorita
import com.ric.navigatore.nucleo.modello.Senso
import com.ric.navigatore.nucleo.modello.TipoErrore
import com.ric.navigatore.nucleo.modello.TipoPunto
import com.ric.navigatore.nucleo.modello.Viaggio
import com.ric.navigatore.nucleo.modello.formattaDistanza
import com.ric.navigatore.nucleo.modello.formattaDurata
import com.ric.navigatore.nucleo.navigazione.Decisione
import com.ric.navigatore.nucleo.navigazione.Inseguitore
import com.ric.navigatore.nucleo.navigazione.PoliticaRicalcolo
import com.ric.navigatore.nucleo.navigazione.Rilevamento
import com.ric.navigatore.nucleo.navigazione.Segnale
import com.ric.navigatore.nucleo.navigazione.ViaggioResiduo
import com.ric.navigatore.nucleo.ors.Openrouteservice
import com.ric.navigatore.nucleo.pianificazione.Contesto
import com.ric.navigatore.nucleo.pianificazione.EsitoPianificazione
import com.ric.navigatore.nucleo.pianificazione.Pianificatore
import com.ric.navigatore.nucleo.servizi.ContatoreQuote
import com.ric.navigatore.nucleo.servizi.LimiteServizio
import com.ric.navigatore.nucleo.servizi.RispostaHttp
import com.ric.navigatore.nucleo.simulazione.ServerOrsFinto
import com.ric.navigatore.nucleo.strade.ReteLocale
import com.ric.navigatore.nucleo.validazione.EsitoControllo
import com.ric.navigatore.nucleo.validazione.Validatore
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Gli scenari richiesti, provati su una città simulata con un finto
 * openrouteservice (vedi simulazione/). Sono PROVE SIMULATE: non
 * sostituiscono le prove con il servizio vero e su strada.
 */
class ScenariTest {
    private var orologio = 1_800_000_000_000L
    private val server = ServerOrsFinto()
    private val citta = server.citta
    private val quote = ContatoreQuote(Openrouteservice.LIMITI_PREDEFINITI, orologio = { orologio })
    private val ors = Openrouteservice({ "chiave-di-prova" }, server, quote)
    private val pianificatore = Pianificatore(ors.motore, ors.agganciatore)
    private val piano = PianoLocale(citta.origine)

    /** Un luogo vicino all'incrocio (i, j), spostato di qualche metro. */
    private fun luogo(i: Int, j: Int, nome: String = "($i,$j)", dx: Double = 0.0, dy: Double = 0.0): Luogo {
        val (x, y) = piano.xy(citta.nodo(i, j))
        return Luogo(piano.punto(x + dx, y + dy), nome)
    }

    private fun stampa(titolo: String, e: EsitoPianificazione) {
        println("=== $titolo ===")
        e.percorso?.let { println("Percorso: ${formattaDistanza(it.distanza)}, ${formattaDurata(it.durata)}, ${it.puntiRichiesta.size} punti") }
        e.errore?.let { println("Errore: ${it.tipo} – ${it.messaggio} ${it.dettaglio ?: ""}") }
        e.conflitti.forEach { println("Conflitto${if (it.bloccante) " BLOCCANTE" else ""}: ${it.messaggio}") }
        e.rapporto.controlli.forEach { println("  ${it.esito.simbolo} ${it.titolo}: ${it.dettaglio}") }
        e.note.forEach { println("  nota: $it") }
        if (e.vincoliCheBloccano.isNotEmpty()) println("  bloccano: ${e.vincoliCheBloccano.map { it.nome }}")
        println("  richieste di percorso usate: ${e.richiesteUsate}")
    }

    private fun corsoUsato(p: Percorso, daJ: Int, aJ: Int): Double {
        val linea = listOf(citta.nodo(2, daJ), citta.nodo(2, aJ))
        return Geo.campiona(p.geometria, 10.0).count { Geo.proietta(linea, it).distanza < 3 } * 10.0
    }

    // ------------------------------------------------------------------
    // 1. Esclusione di un tratto del percorso
    // ------------------------------------------------------------------
    @Test
    fun `1 esclusione di un tratto del percorso calcolato`() {
        val viaggio = Viaggio(luogo(0, 0, "Partenza", dx = 20.0), arrivo = luogo(0, 14, "Arrivo", dx = -20.0))
        val iniziale = pianificatore.calcola(viaggio)
        stampa("Percorso iniziale", iniziale)
        val p0 = assertNotNull(iniziale.percorso)
        assertTrue(corsoUsato(p0, 5, 9) > 700, "il percorso iniziale usa il Corso veloce")

        // L'utente seleziona sul percorso il pezzo di Corso fra la colonna 5 e la 9 (metodo C)
        val prog = Geo.progressive(p0.geometria)
        val da = Geo.proietta(p0.geometria, citta.nodo(2, 5), prog).progressiva
        val a = Geo.proietta(p0.geometria, citta.nodo(2, 9), prog).progressiva
        val tratto = Geo.sottoLinea(p0.geometria, da, a, prog)
        val esclusione = EvitaTratto(nome = "Corso in centro", linea = tratto)

        // Avviso sulle strade coinvolte dalla fascia (approssimazione dichiarata)
        val rete = ReteLocale(citta.stradeLocali())
        val coinvolte = rete.stradeCoinvolte(esclusione.lineaEffettiva(), esclusione.larghezzaFascia, null)
        println("Strade toccate dalla fascia: ${coinvolte.map { it.nome }}")
        assertEquals(setOf("Via Verticale 6", "Via Verticale 7", "Via Verticale 8"), coinvolte.map { it.nome }.toSet())

        val modificato = pianificatore.calcola(viaggio.copy(vincoli = listOf(esclusione)))
        stampa("Percorso con tratto escluso", modificato)
        val p1 = assertNotNull(modificato.percorso)
        assertTrue(modificato.rapporto.valido)
        assertEquals(0.0, corsoUsato(p1, 6, 8), "il Corso fra le colonne 6 e 8 non è più usato")
        assertTrue(Aree.metriDentro(esclusione.aree().first(), p1.geometria) < 1)
        // La richiesta inviata contiene le aree da evitare
        val corpo = Json.parseToJsonElement(server.ricevute.last { "/directions/" in it.url }.corpo!!).jsonObject
        assertEquals("MultiPolygon", corpo["options"]!!.jsonObject["avoid_polygons"]!!.jsonObject["type"]!!.jsonPrimitive.content)
        // Confronto iniziale / modificato
        val dKm = (p1.distanza - p0.distanza) / 1000
        val dMin = (p1.durata - p0.durata) / 60
        println("Differenza: %+.2f km, %+.1f min".format(dKm, dMin))
        assertTrue(p1.durata > p0.durata)
    }

    // ------------------------------------------------------------------
    // 2. Più aree escluse contemporaneamente
    // ------------------------------------------------------------------
    @Test
    fun `2 piu aree escluse insieme`() {
        val viaggio = Viaggio(luogo(0, 0, dx = 20.0), arrivo = luogo(14, 14, dx = -20.0))
        val cerchio1 = EvitaArea(nome = "Cerchio A", forma = FormaArea.CERCHIO, poligono = Aree.cerchio(citta.nodo(2, 3), 250.0), centro = citta.nodo(2, 3), raggio = 250.0)
        val cerchio2 = EvitaArea(nome = "Cerchio B", forma = FormaArea.CERCHIO, poligono = Aree.cerchio(citta.nodo(3, 4), 250.0), centro = citta.nodo(3, 4), raggio = 250.0)
        val rettangolo = EvitaArea(nome = "Rettangolo", forma = FormaArea.RETTANGOLO, poligono = Aree.rettangolo(citta.nodo(10, 9).let { piano.xy(it) }.let { piano.punto(it.first - 50, it.second - 50) }, citta.nodo(12, 13)))
        val e = pianificatore.calcola(viaggio.copy(vincoli = listOf(cerchio1, cerchio2, rettangolo)))
        stampa("Tre aree escluse", e)
        val p = assertNotNull(e.percorso)
        assertTrue(e.rapporto.valido)
        for (v in listOf(cerchio1, cerchio2, rettangolo)) assertTrue(Aree.metriDentro(v.poligono, p.geometria, Validatore.TOLLERANZA_ESCLUSIONE) < 1, v.nome)
        // i due cerchi sovrapposti sono stati uniti: al motore arrivano 2 aree, non 3
        val corpo = Json.parseToJsonElement(server.ricevute.last { "/directions/" in it.url }.corpo!!).jsonObject
        val aree = corpo["options"]!!.jsonObject["avoid_polygons"]!!.jsonObject["coordinates"]!!.jsonArray
        assertEquals(2, aree.size)
        // ogni anello è chiuso (primo punto = ultimo)
        aree.forEach { poli -> poli.jsonArray.forEach { anello -> assertEquals(anello.jsonArray.first(), anello.jsonArray.last()) } }
    }

    // ------------------------------------------------------------------
    // 3. Punto e tratto obbligatori
    // ------------------------------------------------------------------
    @Test
    fun `3 punto e tratto obbligatori`() {
        val viaggio = Viaggio(luogo(0, 0, dx = 20.0), arrivo = luogo(14, 14, dx = -20.0))
        // Punto toccato a 30 m dalla strada: va agganciato
        val tocco = luogo(10, 2, dx = 30.0, dy = 100.0).punto
        val aggancio = (ors.agganciatore.aggancia(listOf(tocco), 350.0) as com.ric.navigatore.nucleo.modello.Esito.Ok).valore.first()!!
        println("Punto toccato $tocco agganciato a ${aggancio.agganciato} su ${aggancio.nomeStrada} (${aggancio.spostamento.toInt()} m)")
        assertTrue(aggancio.spostamento in 25.0..35.0)
        val punto = PassaPunto(nome = "Passa da qui", punto = tocco, agganciato = aggancio.agganciato, nomeStrada = aggancio.nomeStrada)
        // Tratto obbligatorio da percorrere VERSO SUD (contrario alla direzione generale del viaggio)
        val tratto = PassaTratto(nome = "Via Verticale 12 verso sud", linea = listOf(citta.nodo(6, 12), citta.nodo(4, 12)), senso = Senso.DA_INIZIO_A_FINE)
        val e = pianificatore.calcola(viaggio.copy(vincoli = listOf(punto, tratto)))
        stampa("Punto + tratto obbligatori", e)
        val p = assertNotNull(e.percorso)
        assertTrue(e.rapporto.valido)
        val (copertura, senso) = Validatore.coperturaTratto(p, tratto)
        assertTrue(copertura >= 0.9 && senso, "tratto coperto ${copertura} nel senso giusto")
        assertTrue(Geo.proietta(p.geometria, punto.puntoUsato).distanza < Validatore.TOLLERANZA_PUNTO)
        // Non un solo punto: per il tratto sono stati inviati più punti con direzione
        val corpo = Json.parseToJsonElement(server.ricevute.last { "/directions/" in it.url }.corpo!!).jsonObject
        val direzioni = corpo["bearings"]!!.jsonArray
        assertEquals(corpo["coordinates"]!!.jsonArray.size, direzioni.size)
        assertTrue(direzioni.count { it.jsonArray[1].jsonPrimitive.content.toDouble() < 180 } >= 2)
        // Le istruzioni non annunciano gli arrivi ai punti tecnici
        val ins = Inseguitore(p)
        assertEquals(1, ins.manovreUtili.count { it.tipo == 10 })
    }

    // ------------------------------------------------------------------
    // 4. Attraversamento di un'area con centro non raggiungibile
    // ------------------------------------------------------------------
    @Test
    fun `4 attraversa area con centro irraggiungibile (lago)`() {
        val viaggio = Viaggio(luogo(3, 0, dx = 20.0), arrivo = luogo(3, 14, dx = -20.0))
        val area = Aree.rettangolo(
            piano.xy(citta.nodo(5, 5)).let { piano.punto(it.first - 60, it.second - 60) },
            piano.xy(citta.nodo(9, 9)).let { piano.punto(it.first + 60, it.second + 60) },
        )
        val centro = Geo.centroRiquadro(area.esterno)
        assertTrue(Geo.distanza(centro, citta.nodo(7, 7)) < 5, "il centro è nel lago, senza strade")
        for (modo in ModoArea.entries) {
            for (conRete in listOf(false, true)) {
                val vincolo = PassaArea(nome = "Quartiere del lago", forma = FormaArea.RETTANGOLO, poligono = area, modo = modo)
                val contesto = Contesto(reteLocale = if (conRete) ReteLocale(citta.stradeLocali()) else null)
                val prima = server.ricevute.size
                val e = pianificatore.calcola(viaggio.copy(vincoli = listOf(vincolo)), contesto)
                stampa("${modo.etichetta} – candidati da ${if (conRete) "mappa" else "aggancio"}", e)
                val p = assertNotNull(e.percorso)
                assertTrue(e.rapporto.valido)
                assertTrue(e.note.any { "euristico" in it })
                // nessun punto della richiesta è il centro geometrico
                val ausiliari = p.puntiRichiesta.filter { it.tipo == TipoPunto.AUSILIARIO }
                assertTrue(ausiliari.none { Geo.distanza(it.punto, centro) < 150 })
                println("  richieste totali (percorso + aggancio): ${server.ricevute.size - prima}")
            }
        }
    }

    // ------------------------------------------------------------------
    // 5. Vincoli incompatibili
    // ------------------------------------------------------------------
    @Test
    fun `5a arrivo dentro area esclusa - conflitto prima del calcolo`() {
        val viaggio = Viaggio(luogo(0, 0), arrivo = luogo(10, 10))
        val area = EvitaArea(nome = "Zona vietata", forma = FormaArea.CERCHIO, poligono = Aree.cerchio(citta.nodo(10, 10), 300.0))
        val e = pianificatore.calcola(viaggio.copy(vincoli = listOf(area)))
        stampa("Arrivo dentro zona esclusa", e)
        assertNull(e.percorso)
        assertTrue(e.conflitti.any { it.bloccante && "arrivo" in it.messaggio.lowercase() })
        assertEquals(0, server.richiestePercorso, "nessuna richiesta sprecata")
    }

    @Test
    fun `5b tratto obbligatorio ed escluso insieme`() {
        val viaggio = Viaggio(luogo(0, 0), arrivo = luogo(14, 14))
        val tratto = PassaTratto(nome = "Corso", linea = listOf(citta.nodo(2, 4), citta.nodo(2, 6)))
        val esclusione = EvitaTratto(nome = "Corso escluso", linea = listOf(citta.nodo(2, 3), citta.nodo(2, 7)))
        val e1 = pianificatore.calcola(viaggio.copy(vincoli = listOf(tratto, esclusione)))
        stampa("Tratto obbligatorio ed escluso (entrambi obbligatori)", e1)
        assertNull(e1.percorso)
        assertTrue(e1.conflitti.any { it.bloccante })
        // Se l'esclusione è solo "preferita", si calcola rispettando il tratto e lo si dichiara
        val e2 = pianificatore.calcola(viaggio.copy(vincoli = listOf(tratto, esclusione.copy(priorita = Priorita.PREFERITO))))
        stampa("Tratto obbligatorio, esclusione preferita", e2)
        assertNotNull(e2.percorso)
        assertTrue(esclusione.id in e2.preferitiNonRispettati.map { it.id })
    }

    @Test
    fun `5c esclusione che taglia in due la citta - diagnosi del vincolo colpevole`() {
        val viaggio = Viaggio(luogo(0, 0, dx = 20.0), arrivo = luogo(0, 14, dx = -20.0))
        val (x, _) = piano.xy(citta.nodo(0, 7))
        val muro = EvitaArea(
            nome = "Muro", forma = FormaArea.RETTANGOLO,
            // striscia larga 120 m da sud a nord, che taglia tutte le vie orizzontali
            poligono = Aree.rettangolo(piano.punto(x - 60, -100.0), piano.punto(x + 60, 3000.0)),
        )
        val puntoInnocuo = PassaPunto(nome = "Punto innocuo", punto = citta.nodo(1, 2))
        val e = pianificatore.calcola(viaggio.copy(vincoli = listOf(muro, puntoInnocuo)))
        stampa("Muro invalicabile", e)
        assertNull(e.percorso)
        assertEquals(TipoErrore.NESSUN_PERCORSO, e.errore!!.tipo)
        assertEquals(listOf("Muro"), e.vincoliCheBloccano.map { it.nome })
    }

    @Test
    fun `5d tratto obbligatorio contromano su senso unico`() {
        val viaggio = Viaggio(luogo(0, 0, dx = 20.0), arrivo = luogo(14, 14, dx = -20.0))
        // Via Verticale 3 è a senso unico verso NORD: chiediamo di percorrerla verso sud
        val contromano = PassaTratto(nome = "Verticale 3 verso sud", linea = listOf(citta.nodo(9, 3), citta.nodo(5, 3)), senso = Senso.DA_INIZIO_A_FINE, sensoUnico = true)
        val e = pianificatore.calcola(viaggio.copy(vincoli = listOf(contromano)))
        stampa("Tratto contromano", e)
        assertNull(e.percorso, "un vincolo obbligatorio non viene ignorato in silenzio")
        assertNotNull(e.errore)
        assertEquals(listOf(contromano.id), e.vincoliCheBloccano.map { it.id })
    }

    // ------------------------------------------------------------------
    // 6. Deviazione dal percorso mantenendo le esclusioni
    // ------------------------------------------------------------------
    @Test
    fun `6 deviazione dal percorso con ricalcolo che mantiene le esclusioni`() {
        val tappa = luogo(4, 10, "Tappa")
        val esclusione = EvitaArea(nome = "Zona esclusa", forma = FormaArea.CERCHIO, poligono = Aree.cerchio(citta.nodo(10, 12), 260.0))
        val viaggio = Viaggio(luogo(0, 0, dx = 20.0), tappe = listOf(tappa), arrivo = luogo(14, 14, dx = -20.0), vincoli = listOf(esclusione))
        val e = pianificatore.calcola(viaggio)
        stampa("Viaggio con tappa ed esclusione", e)
        val p = assertNotNull(e.percorso)
        val ins = Inseguitore(p)
        val politica = PoliticaRicalcolo()

        // Guidiamo lungo il percorso fino a 200 m dopo la tappa
        val prog = Geo.progressive(p.geometria)
        val sTappa = prog[p.indiciPunti[1]]
        var s = 0.0
        var ultimo = ins.aggiorna(Rilevamento(p.geometria.first(), 8.0, 13.0, null, orologio))
        while (s < sTappa + 200) {
            s += 20.0
            orologio += 1500
            val q = Geo.puntoAProgressiva(p.geometria, s, prog)
            ultimo = ins.aggiorna(Rilevamento(q, 8.0, 13.0, Geo.direzioneAProgressiva(p.geometria, s, prog), orologio))
            assertFalse(ultimo.fuoriPercorso)
        }
        assertTrue(1 in ultimo.puntiRaggiunti, "tappa raggiunta")

        // Un solo punto GPS "impazzito" a 80 m: NON è un'uscita dal percorso
        val (qx, qy) = piano.xy(ultimo.puntoSulPercorso)
        orologio += 1000
        assertFalse(ins.aggiorna(Rilevamento(piano.punto(qx + 80, qy + 80), 10.0, 13.0, null, orologio)).fuoriPercorso)

        // Ora deviamo davvero: 6 letture sempre più lontane, una al secondo
        var deviazione = ultimo
        var fuoriDa: Long? = null
        for (k in 1..6) {
            orologio += 1000
            deviazione = ins.aggiorna(Rilevamento(piano.punto(qx + 60.0 * k, qy - 60.0 * k), 8.0, 12.0, 135.0, orologio))
            if (deviazione.fuoriPercorso && fuoriDa == null) fuoriDa = orologio
        }
        assertTrue(deviazione.fuoriPercorso, "uscita dal percorso rilevata")
        // debounce: subito dopo la conferma si aspetta
        assertTrue(politica.decidi(fuoriDa!!, fuoriDa) is Decisione.Attendi)
        orologio += 3000
        assertEquals(Decisione.Procedi, politica.decidi(orologio, fuoriDa))
        politica.registra(orologio)
        assertTrue(politica.decidi(orologio + 2000, fuoriDa) is Decisione.Attendi, "niente ricalcoli a raffica")

        // Viaggio residuo: niente tappa già raggiunta, esclusione ancora presente
        val posizione = Rilevamento(piano.punto(qx + 360, qy - 360), 8.0, 12.0, 135.0, orologio)
        val residuo = ViaggioResiduo.calcola(viaggio, p, deviazione.puntiRaggiunti, posizione)
        assertTrue(residuo.tappe.isEmpty())
        assertEquals(listOf(esclusione.id), residuo.vincoli.map { it.id })
        val nuovo = pianificatore.calcola(residuo, Contesto(direzioneIniziale = 135.0))
        stampa("Ricalcolo dopo la deviazione", nuovo)
        val p2 = assertNotNull(nuovo.percorso)
        assertTrue(nuovo.rapporto.valido)
        assertTrue(Aree.metriDentro(esclusione.poligono, p2.geometria, 2.0) < 1)
        assertTrue(Geo.proietta(p2.geometria, tappa.punto).distanza > 100, "non si torna alla tappa già raggiunta")
    }

    // ------------------------------------------------------------------
    // 7. Quota API esaurita
    // ------------------------------------------------------------------
    @Test
    fun `7 quota esaurita`() {
        val viaggio = Viaggio(luogo(0, 0), arrivo = luogo(5, 5))
        server.rispostaForzata = RispostaHttp(429, """{"error":"Rate limit exceeded"}""")
        val e1 = pianificatore.calcola(viaggio)
        stampa("Risposta 429", e1)
        assertEquals(TipoErrore.QUOTA_ESAURITA, e1.errore!!.tipo)

        server.rispostaForzata = RispostaHttp(403, """{"error":"Quota exceeded"}""")
        val e2 = pianificatore.calcola(viaggio)
        stampa("Risposta 403 quota", e2)
        assertEquals(TipoErrore.QUOTA_ESAURITA, e2.errore!!.tipo)
        // da qui in poi il contatore locale blocca senza nemmeno contattare il server
        server.rispostaForzata = null
        val inviate = server.ricevute.size
        val e3 = pianificatore.calcola(viaggio)
        assertEquals(TipoErrore.QUOTA_ESAURITA, e3.errore!!.tipo)
        assertEquals(inviate, server.ricevute.size)

        // Limite al minuto rispettato localmente
        val quote2 = ContatoreQuote(listOf(LimiteServizio(Openrouteservice.Q_PERCORSI, "Percorsi", 2000, 2)), orologio = { orologio })
        val ors2 = Openrouteservice({ "k" }, ServerOrsFinto(), quote2)
        val p2 = Pianificatore(ors2.motore)
        assertNotNull(p2.calcola(viaggio).percorso)
        assertNotNull(p2.calcola(viaggio).percorso)
        val bloccato = p2.calcola(viaggio)
        println("Terza richiesta nello stesso minuto: ${bloccato.errore?.messaggio}")
        assertEquals(TipoErrore.QUOTA_ESAURITA, bloccato.errore!!.tipo)
        orologio += 61_000
        assertNotNull(p2.calcola(viaggio).percorso, "dopo un minuto si riparte")
    }

    // ------------------------------------------------------------------
    // 8. Perdita di rete e GPS
    // ------------------------------------------------------------------
    @Test
    fun `8 perdita di rete e di GPS`() {
        val viaggio = Viaggio(luogo(0, 0, dx = 20.0), arrivo = luogo(6, 9))
        val p = assertNotNull(pianificatore.calcola(viaggio).percorso)
        server.senzaRete = true
        val e = pianificatore.calcola(viaggio)
        stampa("Senza rete", e)
        assertEquals(TipoErrore.RETE_ASSENTE, e.errore!!.tipo)
        assertTrue("già scaricato" in e.errore!!.messaggio)

        // La guida sul percorso già scaricato funziona anche senza rete
        val ins = Inseguitore(p)
        val prog = Geo.progressive(p.geometria)
        val s1 = ins.aggiorna(Rilevamento(Geo.puntoAProgressiva(p.geometria, 300.0, prog), 6.0, 12.0, null, orologio))
        assertTrue(s1.distanzaResidua < p.distanza)
        // GPS poco preciso (100 m): niente falsi "fuori percorso"
        repeat(8) {
            orologio += 1000
            val s = ins.aggiorna(Rilevamento(piano.punto(-300.0, 900.0), 120.0, null, null, orologio))
            assertEquals(Segnale.DEBOLE, s.segnale)
            assertFalse(s.fuoriPercorso)
        }
        // GPS muto per più di 10 secondi: segnale assente
        assertEquals(Segnale.BUONO, ins.segnale(orologio + 5_000))
        assertEquals(Segnale.ASSENTE, ins.segnale(orologio + 11_000))
    }

    // ------------------------------------------------------------------
    // Coerenza fra linea e istruzioni, alternative, ordine tappe
    // ------------------------------------------------------------------
    @Test
    fun `coerenza istruzioni e alternative`() {
        val viaggio = Viaggio(luogo(0, 0, dx = 20.0), arrivo = luogo(0, 14, dx = -20.0), opzioni = OpzioniPercorso(alternative = true))
        val e = pianificatore.calcola(viaggio)
        stampa("Con alternative", e)
        assertNotNull(e.percorso)
        assertTrue(e.alternative.isNotEmpty(), "alternative disponibili senza punti intermedi")
        assertEquals(EsitoControllo.RISPETTATO, e.rapporto.controlli.first { it.titolo == "Istruzioni di guida" }.esito)
        // Con un passaggio intermedio le alternative non sono disponibili (limite del servizio) e lo diciamo
        val e2 = pianificatore.calcola(viaggio.copy(vincoli = listOf(PassaPunto(nome = "p", punto = citta.nodo(1, 5)))))
        assertTrue(e2.note.any { "alternativi non disponibili" in it })
    }

    @Test
    fun `profilo altimetrico del percorso`() {
        // Da sud a nord: il terreno simulato sale di circa 1 m ogni 111 m di latitudine
        val v = Viaggio(partenza = luogo(1, 1), arrivo = luogo(12, 12))
        val e = pianificatore.calcola(v)
        val p = assertNotNull(e.percorso)
        assertNotNull(p.quote, "le quote devono arrivare con il percorso")
        assertEquals(p.geometria.size, p.quote!!.size)
        val prof = assertNotNull(Altimetria.profilo(p))
        println("Profilo: min ${prof.minima}, max ${prof.massima}, salita ${prof.salita}, discesa ${prof.discesa}, pendenza max ${"%.1f".format(prof.pendenzaMassima)}%")
        // salita - discesa = differenza di quota fra arrivo e partenza
        val atteso = server.quotaFinta(p.geometria.last()) - server.quotaFinta(p.geometria.first())
        assertEquals(atteso, prof.salita - prof.discesa, 0.5)
        assertTrue(prof.salita > 1.0, "deve salire")
        assertTrue(prof.massima > prof.minima)
        // dislivelli calcolati in proprio (se il servizio non li desse) coerenti con quelli del servizio
        val (su, _) = Altimetria.dislivelli(p.quote!!, 0.0)
        assertEquals(prof.salita, su, 1.0)
        // altitudine di un singolo punto (menu del tocco lungo)
        val q = ors.altitudine(p.geometria.last())
        assertTrue(q is com.ric.navigatore.nucleo.modello.Esito.Ok)
        assertEquals(server.quotaFinta(p.geometria.last()), q.valore, 0.01)
    }
}
