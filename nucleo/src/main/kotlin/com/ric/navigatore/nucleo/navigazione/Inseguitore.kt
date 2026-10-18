package com.ric.navigatore.nucleo.navigazione

import com.ric.navigatore.nucleo.geo.Geo
import com.ric.navigatore.nucleo.geo.Punto
import com.ric.navigatore.nucleo.modello.Manovra
import com.ric.navigatore.nucleo.modello.Percorso
import com.ric.navigatore.nucleo.modello.TipoManovra
import com.ric.navigatore.nucleo.modello.TipoPunto
import kotlin.math.max
import kotlin.math.min

/** Una posizione letta dal GPS. */
data class Rilevamento(
    val punto: Punto,
    /** Precisione dichiarata dal GPS, in metri (più è piccola, meglio è). */
    val accuratezza: Double,
    /** Velocità in m/s, se disponibile. */
    val velocita: Double? = null,
    /** Direzione di marcia in gradi da nord, se disponibile. */
    val direzione: Double? = null,
    /** Istante della lettura, in millisecondi. */
    val tempo: Long,
)

/** Qualità del segnale GPS. */
enum class Segnale { BUONO, DEBOLE, ASSENTE }

/** Tutto ciò che la schermata di guida deve mostrare. */
data class StatoGuida(
    /** Posizione "agganciata" al percorso. */
    val puntoSulPercorso: Punto,
    /** Metri percorsi dall'inizio del percorso. */
    val progressiva: Double,
    /** Distanza fra la posizione GPS e il percorso. */
    val distanzaDalPercorso: Double,
    val manovra: Manovra?,
    val distanzaManovra: Double,
    /** La manovra subito dopo (per "poi svolta a…"). */
    val manovraDopo: Manovra?,
    val distanzaResidua: Double,
    val tempoResiduo: Double,
    /** Ora di arrivo prevista (millisecondi). SENZA traffico in tempo reale. */
    val arrivoPrevisto: Long,
    val fuoriPercorso: Boolean,
    val segnale: Segnale,
    val arrivato: Boolean,
    /** Indici (nella richiesta) dei punti già raggiunti: tappe e punti ausiliari. */
    val puntiRaggiunti: Set<Int>,
    /** Tappa appena raggiunta (indice nella richiesta), da annunciare. */
    val tappaAppenaRaggiunta: Int? = null,
    /** Direzione del percorso nel punto attuale. */
    val direzionePercorso: Double = 0.0,
)

/** Parametri della guida (tutti in metri o millisecondi). */
data class ParametriGuida(
    /** Distanza minima dal percorso per considerarsi "fuori". */
    val sogliaFuoriPercorso: Double = 40.0,
    /** Oltre questa precisione il GPS è considerato inaffidabile (non si dichiara "fuori percorso"). */
    val accuratezzaMassima: Double = 60.0,
    /** Letture consecutive "fuori" necessarie. */
    val lettureFuori: Int = 3,
    /** Tempo minimo "fuori" prima di confermare (filtra i salti del GPS). */
    val tempoFuoriMs: Long = 4_000,
    /** Senza letture per questo tempo il segnale è "assente". */
    val segnalePersoMs: Long = 10_000,
    /** Distanza dalla fine per considerarsi arrivati. */
    val sogliaArrivo: Double = 25.0,
)

/**
 * Segue l'auto lungo il percorso durante la guida.
 *
 * Il motore di percorso fornisce solo istruzioni "statiche" (una lista di
 * svolte con la loro posizione). La guida vera e propria la fa questa classe:
 *  - aggancia ogni lettura GPS al punto giusto del percorso, cercando
 *    prima vicino all'ultima posizione nota (così, se il percorso ripassa
 *    sulla stessa strada, non si "salta" avanti o indietro);
 *  - calcola la prossima manovra, la sua distanza, km e tempo residui;
 *  - capisce quando si è usciti dal percorso, ignorando il rumore del GPS;
 *  - segnala le tappe raggiunte.
 */
class Inseguitore(
    val percorso: Percorso,
    private val parametri: ParametriGuida = ParametriGuida(),
) {
    private val linea = percorso.geometria
    private val prog = Geo.progressive(linea)
    private val totale = prog.last()

    /** Indici geometrici dei punti ausiliari: le loro "arrivo/partenza" non vanno annunciate. */
    private val indiciAusiliari: Set<Int> = percorso.puntiRichiesta.indices
        .filter { percorso.puntiRichiesta[it].tipo == TipoPunto.AUSILIARIO }
        .mapNotNull { percorso.indiciPunti.getOrNull(it) }.toSet()

    /** Le manovre da mostrare/annunciare, senza quelle "tecniche" dei punti ausiliari. */
    val manovreUtili: List<Manovra> = percorso.manovre.filterIndexed { i, m ->
        val tecnica = (m.tipo == TipoManovra.ARRIVO && m.daIndice in indiciAusiliari && i != percorso.manovre.lastIndex) ||
            (m.tipo == TipoManovra.PARTENZA && m.daIndice in indiciAusiliari && i != 0)
        !tecnica
    }

    private var ultimaProgressiva = 0.0
    private var fuoriContatore = 0
    private var fuoriDa: Long? = null
    private var ultimoRilevamento: Long? = null
    private val raggiunti = mutableSetOf<Int>()

    /** Elabora una nuova lettura GPS. */
    fun aggiorna(r: Rilevamento): StatoGuida {
        ultimoRilevamento = r.tempo
        val segnale = if (r.accuratezza > parametri.accuratezzaMassima) Segnale.DEBOLE else Segnale.BUONO

        // 1) Cerchiamo prima in una "finestra" attorno all'ultima posizione
        val avanti = max(500.0, (r.velocita ?: 15.0) * 30)
        var pr = Geo.proietta(linea, r.punto, prog, segmentoA(ultimaProgressiva - 60), segmentoA(ultimaProgressiva + avanti) + 1)
        val soglia = min(100.0, max(parametri.sogliaFuoriPercorso, 1.5 * r.accuratezza))
        // 2) Se lì non c'è, cerchiamo su tutto il percorso (es. dopo una galleria)
        if (pr.distanza > soglia) {
            val globale = Geo.proietta(linea, r.punto, prog)
            if (globale.distanza <= soglia && direzioneCoerente(r, globale.progressiva)) pr = globale
        }
        val sulPercorso = pr.distanza <= soglia && direzioneCoerente(r, pr.progressiva)

        // 3) Fuori percorso solo se confermato da più letture e da un po' di tempo
        if (!sulPercorso && segnale == Segnale.BUONO) {
            fuoriContatore++
            if (fuoriDa == null) fuoriDa = r.tempo
        } else if (sulPercorso) {
            fuoriContatore = 0
            fuoriDa = null
        }
        val fuori = fuoriContatore >= parametri.lettureFuori && r.tempo - (fuoriDa ?: r.tempo) >= parametri.tempoFuoriMs

        // 4) Avanzamento (non torniamo indietro per piccoli errori del GPS)
        if (sulPercorso && pr.progressiva > ultimaProgressiva - 30) ultimaProgressiva = max(ultimaProgressiva, pr.progressiva)
        val s = ultimaProgressiva

        // 5) Punti raggiunti (tappe e ausiliari)
        var appena: Int? = null
        if (sulPercorso) {
            percorso.indiciPunti.forEachIndexed { k, idx ->
                if (k == 0 || k in raggiunti) return@forEachIndexed
                val pk = prog.getOrNull(idx) ?: return@forEachIndexed
                if (s >= pk - 15) {
                    raggiunti += k
                    if (percorso.puntiRichiesta.getOrNull(k)?.tipo == TipoPunto.TAPPA) appena = k
                }
            }
        }

        // 6) Prossima manovra e tempi
        val iProssima = manovreUtili.indexOfFirst { prog[it.daIndice.coerceIn(0, prog.lastIndex)] > s + 2 }
        val prossima = manovreUtili.getOrNull(iProssima)
        val distanzaManovra = prossima?.let { prog[it.daIndice.coerceIn(0, prog.lastIndex)] - s } ?: (totale - s)
        val residuo = max(0.0, totale - s)
        val tempo = tempoResiduo(s)
        return StatoGuida(
            puntoSulPercorso = Geo.puntoAProgressiva(linea, s, prog),
            progressiva = s,
            distanzaDalPercorso = pr.distanza,
            manovra = prossima,
            distanzaManovra = distanzaManovra,
            manovraDopo = if (iProssima >= 0) manovreUtili.getOrNull(iProssima + 1) else null,
            distanzaResidua = residuo,
            tempoResiduo = tempo,
            arrivoPrevisto = r.tempo + (tempo * 1000).toLong(),
            fuoriPercorso = fuori,
            segnale = segnale,
            arrivato = residuo <= parametri.sogliaArrivo,
            puntiRaggiunti = raggiunti.toSet(),
            tappaAppenaRaggiunta = appena,
            direzionePercorso = Geo.direzioneAProgressiva(linea, s, prog),
        )
    }

    /** Da chiamare periodicamente: dice se il GPS tace da troppo tempo. */
    fun segnale(adesso: Long): Segnale {
        val u = ultimoRilevamento ?: return Segnale.ASSENTE
        return if (adesso - u > parametri.segnalePersoMs) Segnale.ASSENTE else Segnale.BUONO
    }

    /** Se andiamo abbastanza veloci, la direzione GPS deve essere simile a quella del percorso. */
    private fun direzioneCoerente(r: Rilevamento, s: Double): Boolean {
        val v = r.velocita ?: return true
        val d = r.direzione ?: return true
        if (v < 4) return true // a bassa velocità la direzione GPS non è affidabile
        return Geo.differenzaAngoli(d, Geo.direzioneAProgressiva(linea, s, prog)) < 100
    }

    private fun segmentoA(metri: Double): Int {
        if (metri <= 0) return 0
        var i = 0
        while (i < prog.size - 2 && prog[i + 1] < metri) i++
        return i
    }

    /** Secondi residui: somma delle durate delle manovre rimanenti (in proporzione per quella in corso). */
    private fun tempoResiduo(s: Double): Double {
        var t = 0.0
        for (m in percorso.manovre) {
            val a = prog[m.daIndice.coerceIn(0, prog.lastIndex)]
            val b = prog[m.aIndice.coerceIn(0, prog.lastIndex)]
            when {
                a >= s -> t += m.durata
                b > s && b > a -> t += m.durata * (b - s) / (b - a)
            }
        }
        return t
    }
}
