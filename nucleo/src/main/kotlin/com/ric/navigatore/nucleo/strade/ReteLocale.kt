package com.ric.navigatore.nucleo.strade

import com.ric.navigatore.nucleo.geo.Geo
import com.ric.navigatore.nucleo.geo.Linea
import com.ric.navigatore.nucleo.geo.PianoLocale
import com.ric.navigatore.nucleo.geo.Punto
import kotlin.math.abs

/**
 * Un pezzo di strada letto dai dati della MAPPA visualizzata (tasselli
 * vettoriali OpenMapTiles di OpenFreeMap). Non serve internet: i dati sono
 * già sul telefono perché la mappa li ha scaricati per disegnarli.
 *
 * Attenzione: la mappa e il motore di percorso usano entrambi OpenStreetMap,
 * ma possono essere aggiornati in date diverse e la mappa semplifica un po'
 * le linee. Per questo i confronti usano sempre delle tolleranze in metri.
 */
data class StradaLocale(
    val id: String,
    val linea: Linea,
    val nome: String,
    /** Classe OpenMapTiles: motorway, trunk, primary, secondary, tertiary, minor, service, track… */
    val classe: String,
    /** 1 = senso unico nel verso della linea, -1 = senso unico contrario, 0 = doppio senso. */
    val sensoUnico: Int = 0,
    /** "bridge", "tunnel" o "" */
    val ponteGalleria: String = "",
) {
    val percorribileInAuto: Boolean get() = classe in CLASSI_AUTO

    /** Nome da mostrare all'utente. */
    val nomeMostrato: String get() = nome.ifBlank { "Strada senza nome (${NOMI_CLASSI[classe] ?: classe})" }

    companion object {
        val CLASSI_AUTO = setOf("motorway", "trunk", "primary", "secondary", "tertiary", "minor", "service", "track", "busway", "raceway")
        val NOMI_CLASSI = mapOf(
            "motorway" to "autostrada", "trunk" to "superstrada", "primary" to "strada principale",
            "secondary" to "strada secondaria", "tertiary" to "strada locale", "minor" to "strada urbana",
            "service" to "strada di servizio", "track" to "strada sterrata",
        )
    }
}

/** Una strada vicina al punto toccato. */
data class Candidato(
    val strada: StradaLocale,
    /** Distanza dal tocco, in metri. */
    val distanza: Double,
    /** Il punto della strada più vicino al tocco. */
    val puntoSuStrada: Punto,
)

/**
 * Rete stradale "locale" ricavata dalla mappa: serve a scegliere con un
 * tocco una strada e a ricavare il tratto fra due incroci.
 */
class ReteLocale(strade: List<StradaLocale>) {
    private val strade = strade.filter { it.linea.size >= 2 }

    companion object {
        /** Distanza entro cui due estremi si considerano lo stesso punto. */
        const val TOLLERANZA_GIUNZIONE = 5.0

        /** Distanza entro cui un'altra strada "tocca" quella scelta (incrocio). */
        const val TOLLERANZA_INCROCIO = 3.0
    }

    /**
     * Strade entro [raggio] metri dal punto, dalla più vicina.
     * Pezzi diversi della stessa strada (stesso nome e classe) contano una volta sola.
     */
    fun candidati(p: Punto, raggio: Double = 30.0, soloAuto: Boolean = true): List<Candidato> {
        return strade
            .filter { !soloAuto || it.percorribileInAuto }
            .map { s -> Geo.proietta(s.linea, p).let { Candidato(s, it.distanza, it.punto) } }
            .filter { it.distanza <= raggio }
            .sortedBy { it.distanza }
            .distinctBy { if (it.strada.nome.isBlank()) it.strada.id else it.strada.nome + "|" + it.strada.classe }
    }

    /**
     * Unisce i pezzi della stessa strada (spezzati dai confini dei tasselli
     * della mappa) in un'unica linea continua attorno al pezzo scelto.
     */
    fun catena(scelta: StradaLocale, maxMetri: Double = 8000.0): Linea {
        val stessoGruppo = strade.filter {
            it.id != scelta.id && it.classe == scelta.classe && it.nome == scelta.nome
        }.toMutableList()
        var linea = scelta.linea.toMutableList()
        var cambiato = true
        while (cambiato && Geo.lunghezza(linea) < maxMetri) {
            cambiato = false
            val iter = stessoGruppo.iterator()
            while (iter.hasNext()) {
                val pezzo = iter.next()
                val unito = unisci(linea, pezzo, scelta.nome.isBlank()) ?: continue
                linea = unito.toMutableList()
                iter.remove()
                cambiato = true
            }
        }
        return linea
    }

    /** Prova ad attaccare [pezzo] a [linea]; null se non sono contigui. */
    private fun unisci(linea: List<Punto>, pezzo: StradaLocale, senzaNome: Boolean): List<Punto>? {
        val p = pezzo.linea
        // Parte del pezzo che NON si sovrappone già alla linea
        if (p.all { Geo.proietta(linea, it).distanza <= TOLLERANZA_INCROCIO }) return linea // già contenuto
        val inizio = linea.first()
        val fine = linea.last()
        fun vicino(a: Punto, b: Punto) = Geo.distanza(a, b) <= TOLLERANZA_GIUNZIONE
        // Per le strade senza nome uniamo solo se proseguono quasi dritte
        fun prosegueDritto(direzioneLinea: Double, direzionePezzo: Double) =
            !senzaNome || Geo.differenzaAngoli(direzioneLinea, direzionePezzo) < 45
        val dirFine = Geo.direzione(linea[linea.size - 2], fine)
        val dirInizio = Geo.direzione(linea[1], inizio)
        // Il pezzo deve toccare la linea vicino a uno dei suoi estremi
        val toccaFine = vicino(p.first(), fine) || vicino(p.last(), fine) ||
            (p.any { vicino(it, fine) } || Geo.proietta(p, fine).distanza <= TOLLERANZA_INCROCIO)
        val toccaInizio = vicino(p.first(), inizio) || vicino(p.last(), inizio) ||
            (p.any { vicino(it, inizio) } || Geo.proietta(p, inizio).distanza <= TOLLERANZA_INCROCIO)
        if (toccaFine) {
            // orientiamo il pezzo in modo che si allontani dalla fine della linea
            val orientato = if (Geo.distanza(p.first(), fine) <= Geo.distanza(p.last(), fine)) p else p.reversed()
            val aggiunta = orientato.filter { Geo.proietta(linea, it).distanza > TOLLERANZA_INCROCIO }
            if (aggiunta.isNotEmpty() && prosegueDritto(dirFine, Geo.direzione(fine, aggiunta.first()))) return linea + aggiunta
        }
        if (toccaInizio) {
            val orientato = if (Geo.distanza(p.last(), inizio) <= Geo.distanza(p.first(), inizio)) p else p.reversed()
            val aggiunta = orientato.filter { Geo.proietta(linea, it).distanza > TOLLERANZA_INCROCIO }
            if (aggiunta.isNotEmpty() && prosegueDritto(dirInizio, Geo.direzione(inizio, aggiunta.last()))) return aggiunta + linea
        }
        return null
    }

    /**
     * Posizioni (metri dall'inizio della [linea]) dove altre strade la incrociano
     * o vi si innestano. Gli incroci "a livelli diversi" (ponti, gallerie senza
     * punti in comune) NON contano come incroci.
     */
    fun incroci(linea: Linea, escludiNome: String? = null, escludiClasse: String? = null): List<Double> {
        val prog = Geo.progressive(linea)
        val out = mutableListOf<Double>()
        for (s in strade) {
            if (!s.percorribileInAuto) continue
            // pezzi della stessa strada: non sono incroci
            if (escludiNome != null && s.nome == escludiNome && s.classe == escludiClasse) continue
            // vertici dell'altra strada che toccano la linea
            for (v in s.linea) {
                val pr = Geo.proietta(linea, v, prog)
                if (pr.distanza <= TOLLERANZA_INCROCIO && pr.progressiva > 1 && pr.progressiva < prog.last() - 1) out += pr.progressiva
            }
            // attraversamenti senza vertice comune (a raso solo se nessuno dei due è ponte/galleria)
            if (s.ponteGalleria.isNotBlank()) continue
            for (x in attraversamenti(linea, prog, s.linea)) out += x
        }
        // incroci vicinissimi (meno di 8 m) contano come uno
        return out.sorted().fold(mutableListOf()) { acc, x ->
            if (acc.isEmpty() || x - acc.last() > 8) acc += x
            acc
        }
    }

    /** Punti in cui i segmenti di [altra] tagliano [linea] (in metri progressivi su [linea]). */
    private fun attraversamenti(linea: Linea, prog: DoubleArray, altra: Linea): List<Double> {
        val piano = PianoLocale(linea.first())
        val a = linea.map { piano.xy(it) }
        val b = altra.map { piano.xy(it) }
        val out = mutableListOf<Double>()
        for (i in 0 until a.size - 1) for (j in 0 until b.size - 1) {
            val t = intersezione(a[i], a[i + 1], b[j], b[j + 1]) ?: continue
            out += prog[i] + (prog[i + 1] - prog[i]) * t
        }
        return out
    }

    /** Frazione t sul primo segmento dove i due segmenti si tagliano (null se non si tagliano). */
    private fun intersezione(
        p1: Pair<Double, Double>, p2: Pair<Double, Double>,
        q1: Pair<Double, Double>, q2: Pair<Double, Double>,
    ): Double? {
        val rX = p2.first - p1.first
        val rY = p2.second - p1.second
        val sX = q2.first - q1.first
        val sY = q2.second - q1.second
        val den = rX * sY - rY * sX
        if (abs(den) < 1e-9) return null
        val qpX = q1.first - p1.first
        val qpY = q1.second - p1.second
        val t = (qpX * sY - qpY * sX) / den
        val u = (qpX * rY - qpY * rX) / den
        return if (t in 0.0..1.0 && u in 0.0..1.0) t else null
    }

    /**
     * "Evita questo tratto": il pezzo di strada compreso fra l'incrocio
     * precedente e quello successivo rispetto al punto toccato.
     */
    fun trattoFraIncroci(c: Candidato): Linea {
        val linea = catena(c.strada)
        val prog = Geo.progressive(linea)
        val qui = Geo.proietta(linea, c.puntoSuStrada, prog).progressiva
        val inc = incroci(linea, c.strada.nome.takeIf { it.isNotBlank() }, c.strada.classe)
        val da = inc.lastOrNull { it < qui - 1 } ?: 0.0
        val a = inc.firstOrNull { it > qui + 1 } ?: prog.last()
        return Geo.sottoLinea(linea, da, a, prog)
    }

    /**
     * Tratto della stessa strada fra il punto [c] e il punto [fine]
     * (selezione "inizio e fine"). Restituisce null se [fine] non è
     * lungo la stessa strada (oltre [tolleranza] metri).
     * La linea risultante va DA [c] VERSO [fine] (utile per il senso di marcia).
     */
    fun trattoFra(c: Candidato, fine: Punto, tolleranza: Double = 40.0): Linea? {
        val linea = catena(c.strada)
        val prog = Geo.progressive(linea)
        val pFine = Geo.proietta(linea, fine, prog)
        if (pFine.distanza > tolleranza) return null
        val pInizio = Geo.proietta(linea, c.puntoSuStrada, prog)
        if (abs(pFine.progressiva - pInizio.progressiva) < 5) return null
        val tratto = Geo.sottoLinea(linea, pInizio.progressiva, pFine.progressiva, prog)
        return if (pInizio.progressiva <= pFine.progressiva) tratto else tratto.reversed()
    }

    /**
     * Altre strade che toccano la fascia attorno a [linea]: il motore le
     * bloccherà anch'esse (il controllo è "in pianta", quindi anche i ponti
     * e le gallerie che passano sopra o sotto vengono bloccati).
     */
    fun stradeCoinvolte(linea: Linea, larghezza: Double, escludi: StradaLocale?): List<StradaLocale> {
        val prog = Geo.progressive(linea)
        val campioni = Geo.campiona(linea, 10.0)
        // È la strada stessa se ci "corre sopra" per almeno 30 m (un incrocio la tocca in un punto solo)
        fun stessaStrada(s: StradaLocale) =
            (escludi != null && (s.id == escludi.id || (s.nome.isNotBlank() && s.nome == escludi.nome && s.classe == escludi.classe))) ||
                campioni.count { Geo.proietta(s.linea, it).distanza <= TOLLERANZA_INCROCIO } >= 4
        return strade.filter { s ->
            s.percorribileInAuto && !stessaStrada(s) &&
                (s.linea.any { Geo.proietta(linea, it, prog).distanza <= larghezza } ||
                    attraversamenti(linea, prog, s.linea).isNotEmpty())
        }.distinctBy { if (it.nome.isBlank()) it.id else it.nome }
    }

    /** Punti delle strade percorribili dentro un'area: candidati per "Passa da quest'area". */
    fun puntiStradaliDentro(dentro: (Punto) -> Boolean, passo: Double = 40.0): List<Pair<Punto, StradaLocale>> =
        strade.filter { it.percorribileInAuto && it.classe != "track" }
            .flatMap { s -> Geo.campiona(s.linea, passo).filter(dentro).map { it to s } }
}
