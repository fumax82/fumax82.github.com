package com.ric.navigatore.nucleo.pianificazione

import com.ric.navigatore.nucleo.geo.Aree
import com.ric.navigatore.nucleo.geo.Geo
import com.ric.navigatore.nucleo.geo.Poligono
import com.ric.navigatore.nucleo.modello.EvitaArea
import com.ric.navigatore.nucleo.modello.EvitaTratto
import com.ric.navigatore.nucleo.modello.Luogo
import com.ric.navigatore.nucleo.modello.ModoArea
import com.ric.navigatore.nucleo.modello.PassaArea
import com.ric.navigatore.nucleo.modello.PassaPunto
import com.ric.navigatore.nucleo.modello.PassaTratto
import com.ric.navigatore.nucleo.modello.Priorita
import com.ric.navigatore.nucleo.modello.Vincolo
import com.ric.navigatore.nucleo.servizi.Capacita

/** Un problema trovato PRIMA di chiamare il motore. */
data class Conflitto(
    val messaggio: String,
    /** Cosa può fare l'utente per risolverlo. */
    val suggerimento: String,
    /** I vincoli coinvolti. */
    val vincoli: List<Vincolo>,
    /** Vero se impedisce il calcolo (coinvolge solo vincoli obbligatori o limiti del servizio). */
    val bloccante: Boolean,
)

/**
 * Cerca i conflitti evidenti fra tappe e vincoli, senza consumare richieste:
 * tappa dentro un'area vietata, tratto obbligatorio che passa in una zona
 * esclusa, aree troppo grandi per il servizio, ecc.
 */
object Conflitti {

    /** Le aree che un vincolo di esclusione invia al motore. */
    fun areeDi(v: Vincolo): List<Poligono> = when (v) {
        is EvitaArea -> listOf(v.poligono)
        is EvitaTratto -> v.aree()
        else -> emptyList()
    }

    fun verifica(fermate: List<Luogo>, vincoli: List<Vincolo>, capacita: Capacita): List<Conflitto> {
        val out = mutableListOf<Conflitto>()
        val esclusioni = vincoli.filter { it.esclusione }

        fun bloccante(vararg coinvolti: Vincolo) = coinvolti.all { it.priorita == Priorita.OBBLIGATORIO }

        for (e in esclusioni) {
            val aree = areeDi(e)
            // 1) Tappe dentro una zona esclusa
            fermate.forEachIndexed { i, f ->
                if (aree.any { Aree.contiene(it, f.punto) }) {
                    val nome = when (i) { 0 -> "La partenza"; fermate.size - 1 -> "L'arrivo"; else -> "La tappa $i (${f.nome})" }
                    out += Conflitto(
                        "$nome si trova dentro la zona esclusa «${e.nome}».",
                        "Sposta il punto oppure modifica o disattiva l'esclusione.",
                        listOf(e), bloccante(e),
                    )
                }
            }
            // 2) Passaggi obbligati in conflitto con l'esclusione
            for (p in vincoli.filter { !it.esclusione }) {
                val conflitto = when (p) {
                    is PassaPunto -> aree.any { Aree.contiene(it, p.puntoUsato) }
                    is PassaTratto -> aree.any { Aree.metriDentro(it, p.linea, 1.0) > 5 }
                    is PassaArea -> aree.isNotEmpty() && Aree.unisci(aree).any { Aree.copre(it, p.poligono) }
                    else -> false
                }
                if (conflitto) {
                    out += Conflitto(
                        "«${p.nome}» si trova dentro la zona esclusa «${e.nome}»: non possono valere entrambi.",
                        "Disattiva uno dei due, oppure rendi «Preferito» quello meno importante.",
                        listOf(p, e), bloccante(p, e),
                    )
                }
            }
            // 3) Limiti del servizio sulle aree
            for (a in aree) {
                val kmq = Aree.superficie(a) / 1_000_000
                val lato = Aree.estensione(a) / 1000
                val maxKmq = capacita.maxAreaKmq
                val maxLato = capacita.maxEstensioneKm
                if ((maxKmq != null && kmq > maxKmq) || (maxLato != null && lato > maxLato)) {
                    out += Conflitto(
                        "L'area «${e.nome}» è troppo grande per il servizio di percorso " +
                            "(%.0f km², lato %.0f km; massimo ${maxKmq?.toInt()} km² e ${maxLato?.toInt()} km).".format(kmq, lato),
                        "Riduci l'area o dividila in più aree più piccole.",
                        listOf(e), true,
                    )
                }
            }
        }

        // 4) Tratto contemporaneamente obbligatorio ed escluso? (già coperto sopra) — Tratto doppio con sensi opposti:
        val tratti = vincoli.filterIsInstance<PassaTratto>()
        for (i in tratti.indices) for (j in i + 1 until tratti.size) {
            val a = tratti[i]
            val b = tratti[j]
            if (a.senso != com.ric.navigatore.nucleo.modello.Senso.QUALSIASI && b.senso != com.ric.navigatore.nucleo.modello.Senso.QUALSIASI) {
                val stessa = Geo.campiona(a.linea, 20.0).all { Geo.proietta(b.linea, it).distanza < 15 }
                val dirA = Geo.direzione(a.lineaOrientata().first(), a.lineaOrientata().last())
                val dirB = Geo.direzione(b.lineaOrientata().first(), b.lineaOrientata().last())
                if (stessa && Geo.differenzaAngoli(dirA, dirB) > 150) {
                    out += Conflitto(
                        "«${a.nome}» e «${b.nome}» chiedono di percorrere lo stesso tratto in sensi opposti.",
                        "Va bene solo se vuoi davvero un'andata e ritorno: altrimenti eliminane uno.",
                        listOf(a, b), false,
                    )
                }
            }
        }

        // 5) "Attraversa" con la tappa precedente/successiva già dentro l'area
        for (a in vincoli.filterIsInstance<PassaArea>().filter { it.modo == ModoArea.ATTRAVERSA }) {
            if (fermate.firstOrNull()?.let { Aree.contiene(a.poligono, it.punto) } == true ||
                fermate.lastOrNull()?.let { Aree.contiene(a.poligono, it.punto) } == true
            ) {
                out += Conflitto(
                    "La partenza o l'arrivo sono dentro l'area «${a.nome}»: non si può «entrare e poi uscire».",
                    "Usa «Passa all'interno» oppure sposta l'area.",
                    listOf(a), bloccante(a),
                )
            }
        }

        // 6) Distanza massima con aree da evitare
        val maxKm = capacita.maxDistanzaConAreeKm
        if (maxKm != null && esclusioni.isNotEmpty() && fermate.size >= 2) {
            val linea = fermate.zipWithNext().sumOf { (a, b) -> Geo.distanza(a.punto, b.punto) } / 1000
            if (linea > maxKm) {
                out += Conflitto(
                    "Con zone da evitare il servizio calcola percorsi fino a ${maxKm.toInt()} km, e qui la distanza in linea d'aria è già di ${linea.toInt()} km.",
                    "Dividi il viaggio in parti più corte, disattiva le esclusioni lontane, oppure usa un server di percorso proprio (vedi LEGGIMI).",
                    esclusioni, true,
                )
            }
        }
        return out
    }
}
