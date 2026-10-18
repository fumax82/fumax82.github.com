package com.ric.navigatore.nucleo.validazione

import com.ric.navigatore.nucleo.geo.Aree
import com.ric.navigatore.nucleo.geo.Geo
import com.ric.navigatore.nucleo.modello.EvitaArea
import com.ric.navigatore.nucleo.modello.EvitaTratto
import com.ric.navigatore.nucleo.modello.ModoArea
import com.ric.navigatore.nucleo.modello.PassaArea
import com.ric.navigatore.nucleo.modello.PassaPunto
import com.ric.navigatore.nucleo.modello.PassaTratto
import com.ric.navigatore.nucleo.modello.Percorso
import com.ric.navigatore.nucleo.modello.Priorita
import com.ric.navigatore.nucleo.modello.Senso
import com.ric.navigatore.nucleo.modello.TipoPunto
import com.ric.navigatore.nucleo.modello.Vincolo
import com.ric.navigatore.nucleo.modello.formattaDistanza
import kotlin.math.abs
import kotlin.math.max

/** Esito di un singolo controllo. */
enum class EsitoControllo(val simbolo: String) {
    RISPETTATO("✓"),
    VIOLATO("✗"),
    AVVISO("!"),
}

/** Un controllo eseguito sul percorso calcolato. */
data class Controllo(
    val titolo: String,
    val esito: EsitoControllo,
    val dettaglio: String,
    /** Il vincolo controllato (null per i controlli generali). */
    val vincolo: Vincolo? = null,
)

/** Tutti i controlli su un percorso. */
data class Rapporto(val controlli: List<Controllo>) {
    /** Vincoli OBBLIGATORI non rispettati: il percorso non va accettato. */
    val violazioniObbligatorie: List<Controllo>
        get() = controlli.filter { it.esito == EsitoControllo.VIOLATO && (it.vincolo == null || it.vincolo.priorita == Priorita.OBBLIGATORIO) }

    val valido: Boolean get() = violazioniObbligatorie.isEmpty()
}

/**
 * Controlla DOPO ogni calcolo che il percorso rispetti davvero i vincoli.
 * Il motore di percorso potrebbe ignorare un vincolo (per esempio se una
 * tappa viene agganciata alla strada sbagliata): qui ce ne accorgiamo.
 *
 * Tutte le tolleranze sono dichiarate qui sotto, in metri.
 */
object Validatore {
    /** Le aree escluse vengono "ristrette" di questi metri prima del controllo (errori di arrotondamento). */
    const val TOLLERANZA_ESCLUSIONE = 2.0

    /** Metri massimi fra un punto obbligatorio e il percorso. */
    const val TOLLERANZA_PUNTO = 25.0

    /** Distanza massima fra il tratto obbligatorio e il percorso, punto per punto. */
    const val TOLLERANZA_TRATTO = 20.0

    /** Quota minima del tratto obbligatorio che deve essere percorsa. */
    const val COPERTURA_MINIMA_TRATTO = 0.9

    /** Metri minimi di percorso dentro un'area "Passa all'interno". */
    const val MINIMO_DENTRO_AREA = 20.0

    /** Ingresso e uscita di un "Attraversa" devono distare almeno così (altrimenti è un'andata e ritorno). */
    const val DISTANZA_MINIMA_INGRESSO_USCITA = 50.0

    fun valida(percorso: Percorso, vincoli: List<Vincolo>): Rapporto {
        val controlli = mutableListOf<Controllo>()
        for (v in vincoli.filter { it.attivo }) {
            controlli += when (v) {
                is EvitaArea -> controllaEsclusione(percorso, v, listOf(v.poligono))
                is EvitaTratto -> controllaEsclusione(percorso, v, v.aree())
                is PassaPunto -> controllaPunto(percorso, v)
                is PassaTratto -> controllaTratto(percorso, v)
                is PassaArea -> controllaArea(percorso, v)
            }
        }
        controlli += controllaTappe(percorso)
        controlli += controllaIstruzioni(percorso)
        return Rapporto(controlli)
    }

    private fun controllaEsclusione(p: Percorso, v: Vincolo, aree: List<com.ric.navigatore.nucleo.geo.Poligono>): Controllo {
        val metri = aree.sumOf { Aree.metriDentro(it, p.geometria, TOLLERANZA_ESCLUSIONE) }
        return if (metri < 1.0) {
            Controllo(v.nome, EsitoControllo.RISPETTATO, "Il percorso non entra nella zona esclusa.", v)
        } else {
            Controllo(v.nome, EsitoControllo.VIOLATO, "Il percorso entra nella zona esclusa per ${formattaDistanza(metri)}.", v)
        }
    }

    private fun controllaPunto(p: Percorso, v: PassaPunto): Controllo {
        val pr = Geo.proietta(p.geometria, v.puntoUsato)
        if (pr.distanza > TOLLERANZA_PUNTO) {
            return Controllo(
                v.nome, EsitoControllo.VIOLATO,
                "Il percorso passa a ${formattaDistanza(pr.distanza)} dal punto (tolleranza ${TOLLERANZA_PUNTO.toInt()} m).", v,
            )
        }
        // Andata e ritorno sullo stesso tratto per "toccare" il punto?
        val prog = Geo.progressive(p.geometria)
        val prima = Geo.direzioneAProgressiva(p.geometria, pr.progressiva - 30, prog)
        val dopo = Geo.direzioneAProgressiva(p.geometria, pr.progressiva + 30, prog)
        return if (pr.progressiva > 40 && pr.progressiva < prog.last() - 40 && Geo.differenzaAngoli(prima, dopo) > 160) {
            Controllo(v.nome, EsitoControllo.AVVISO, "Il percorso raggiunge il punto e torna indietro (inversione a U).", v)
        } else {
            Controllo(v.nome, EsitoControllo.RISPETTATO, "Il percorso passa a ${formattaDistanza(pr.distanza)} dal punto.", v)
        }
    }

    /**
     * Copertura e senso di marcia di un tratto obbligatorio.
     * Restituisce (quota percorsa nel senso giusto 0..1, senso rispettato).
     *
     * Il tratto viene campionato ogni 15 m. Per ogni campione si cercano
     * tutti i passaggi del percorso vicini (il percorso potrebbe ripassare
     * sulla stessa strada nel senso opposto) e si verifica che esista una
     * sequenza di passaggi in avanti che li tocchi in ordine.
     */
    fun coperturaTratto(p: Percorso, v: PassaTratto): Pair<Double, Boolean> {
        val prog = Geo.progressive(p.geometria)
        val campioni = Geo.campiona(v.lineaOrientata(), 15.0)
        val posizioni = campioni.map { Geo.posizioniVicine(p.geometria, it, TOLLERANZA_TRATTO, prog) }
        fun inOrdine(lista: List<List<Double>>): Int {
            var ultima = -1.0
            var coperti = 0
            for (c in lista) {
                val scelta = c.filter { it >= ultima - 1 }.minOrNull() ?: continue
                ultima = scelta
                coperti++
            }
            return coperti
        }
        val toccati = posizioni.count { it.isNotEmpty() }
        val avanti = inOrdine(posizioni)
        val indietro = if (v.senso == Senso.QUALSIASI) inOrdine(posizioni.reversed()) else 0
        val migliore = max(avanti, indietro)
        val quota = migliore.toDouble() / campioni.size
        val quotaToccata = toccati.toDouble() / campioni.size
        // senso sbagliato = il percorso tocca il tratto ma non nell'ordine richiesto
        val senso = quota >= COPERTURA_MINIMA_TRATTO || quotaToccata < COPERTURA_MINIMA_TRATTO
        return (if (senso) quota else quotaToccata) to senso
    }

    private fun controllaTratto(p: Percorso, v: PassaTratto): Controllo {
        val (quota, senso) = coperturaTratto(p, v)
        val perc = (quota * 100).toInt()
        return when {
            quota < COPERTURA_MINIMA_TRATTO -> Controllo(
                v.nome, EsitoControllo.VIOLATO,
                "Il percorso segue solo il $perc% del tratto (minimo ${(COPERTURA_MINIMA_TRATTO * 100).toInt()}%, tolleranza ${TOLLERANZA_TRATTO.toInt()} m).", v,
            )
            !senso -> Controllo(v.nome, EsitoControllo.VIOLATO, "Il tratto viene percorso nel senso sbagliato.", v)
            else -> Controllo(v.nome, EsitoControllo.RISPETTATO, "Tratto percorso al $perc%, nel senso richiesto.", v)
        }
    }

    private fun controllaArea(p: Percorso, v: PassaArea): Controllo {
        val intervalli = Aree.intervalliDentro(v.poligono, p.geometria)
        val metri = intervalli.sumOf { it.endInclusive - it.start }
        if (metri < MINIMO_DENTRO_AREA) {
            return Controllo(v.nome, EsitoControllo.VIOLATO, "Il percorso non passa dentro l'area.", v)
        }
        if (v.modo == ModoArea.PASSA_ALL_INTERNO) {
            return Controllo(v.nome, EsitoControllo.RISPETTATO, "Il percorso fa ${formattaDistanza(metri)} dentro l'area.", v)
        }
        // ATTRAVERSA: serve un ingresso da fuori e un'uscita verso fuori, in punti diversi
        val totale = Geo.lunghezza(p.geometria)
        val prog = Geo.progressive(p.geometria)
        val entrataUscita = intervalli.firstOrNull { it.start > 1 && it.endInclusive < totale - 1 }
        return if (entrataUscita == null) {
            Controllo(v.nome, EsitoControllo.VIOLATO, "Il percorso non entra e poi esce dall'area (parte o arriva dentro).", v)
        } else {
            val ingresso = Geo.puntoAProgressiva(p.geometria, entrataUscita.start, prog)
            val uscita = Geo.puntoAProgressiva(p.geometria, entrataUscita.endInclusive, prog)
            if (Geo.distanza(ingresso, uscita) < DISTANZA_MINIMA_INGRESSO_USCITA) {
                Controllo(v.nome, EsitoControllo.VIOLATO, "Il percorso entra ed esce dallo stesso punto: non è un vero attraversamento.", v)
            } else {
                Controllo(v.nome, EsitoControllo.RISPETTATO, "Il percorso attraversa l'area (${formattaDistanza(metri)} all'interno).", v)
            }
        }
    }

    /** Le tappe sono raggiunte nell'ordine giusto e non troppo spostate? */
    private fun controllaTappe(p: Percorso): List<Controllo> {
        val out = mutableListOf<Controllo>()
        val indici = p.indiciPunti
        if (indici.size != p.puntiRichiesta.size) {
            out += Controllo("Tappe", EsitoControllo.AVVISO, "Il motore non ha indicato dove si trovano tutte le tappe.")
            return out
        }
        val ordinato = indici.zipWithNext().all { (a, b) -> a <= b }
        out += if (ordinato) {
            Controllo("Ordine delle tappe", EsitoControllo.RISPETTATO, "Tappe e passaggi raggiunti nell'ordine richiesto.")
        } else {
            Controllo("Ordine delle tappe", EsitoControllo.VIOLATO, "Il motore ha restituito le tappe in un ordine diverso.")
        }
        p.puntiRichiesta.forEachIndexed { i, pr ->
            if (pr.tipo == TipoPunto.AUSILIARIO) return@forEachIndexed
            val qui = p.geometria.getOrNull(indici[i]) ?: return@forEachIndexed
            val d = Geo.distanza(qui, pr.punto)
            if (d > 100) {
                val nome = when (pr.tipo) { TipoPunto.PARTENZA -> "Partenza"; TipoPunto.ARRIVO -> "Arrivo"; else -> "Tappa" }
                out += Controllo(nome, EsitoControllo.AVVISO, "Raggiunta la strada più vicina, a ${formattaDistanza(d)} dal punto scelto.")
            }
        }
        return out
    }

    /** Le istruzioni di svolta corrispondono alla linea disegnata? */
    private fun controllaIstruzioni(p: Percorso): Controllo {
        val n = p.geometria.size
        val problemi = mutableListOf<String>()
        if (p.manovre.isEmpty()) problemi += "nessuna istruzione"
        if (p.manovre.any { it.daIndice < 0 || it.aIndice >= n || it.aIndice < it.daIndice }) problemi += "istruzioni fuori dalla linea"
        val buchi = p.manovre.zipWithNext().count { (a, b) -> b.daIndice != a.aIndice && b.daIndice != a.aIndice + 1 }
        if (buchi > 0) problemi += "$buchi istruzioni non consecutive"
        val sommaIstruzioni = p.manovre.sumOf { it.distanza }
        if (p.distanza > 0 && abs(sommaIstruzioni - p.distanza) > max(30.0, p.distanza * 0.02)) {
            problemi += "somma delle istruzioni ${formattaDistanza(sommaIstruzioni)} ≠ totale ${formattaDistanza(p.distanza)}"
        }
        val lunghezzaLinea = Geo.lunghezza(p.geometria)
        if (p.distanza > 0 && abs(lunghezzaLinea - p.distanza) > max(100.0, p.distanza * 0.05)) {
            problemi += "linea di ${formattaDistanza(lunghezzaLinea)} ≠ totale ${formattaDistanza(p.distanza)}"
        }
        return if (problemi.isEmpty()) {
            Controllo("Istruzioni di guida", EsitoControllo.RISPETTATO, "Istruzioni coerenti con la linea del percorso.")
        } else {
            Controllo("Istruzioni di guida", EsitoControllo.AVVISO, problemi.joinToString("; ").replaceFirstChar { it.uppercase() } + ".")
        }
    }
}
