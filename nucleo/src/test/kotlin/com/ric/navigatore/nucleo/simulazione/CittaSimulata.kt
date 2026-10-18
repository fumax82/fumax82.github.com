package com.ric.navigatore.nucleo.simulazione

import com.ric.navigatore.nucleo.geo.Aree
import com.ric.navigatore.nucleo.geo.Geo
import com.ric.navigatore.nucleo.geo.PianoLocale
import com.ric.navigatore.nucleo.geo.Poligono
import com.ric.navigatore.nucleo.geo.Punto
import com.ric.navigatore.nucleo.strade.StradaLocale
import java.util.PriorityQueue

/**
 * Una città FINTA a griglia, per le prove automatiche.
 *
 * - strade ogni 200 m, 15 × 15 incroci (circa 2,8 × 2,8 km) attorno a Padova;
 * - un "lago" al centro senza strade (incroci da (6,6) a (8,8) rimossi);
 * - Via Verticale 3 è a senso unico verso nord;
 * - il Corso (riga 2) è più veloce delle altre strade.
 *
 * Calcola percorsi veri (algoritmo di Dijkstra) rispettando aree da evitare,
 * direzione di marcia nei punti e "prosegui dritto" ai punti intermedi, come
 * fa openrouteservice. NON è openrouteservice: serve a provare la nostra logica.
 */
class CittaSimulata(
    val lato: Int = 15,
    val passo: Double = 200.0,
    val lago: Set<Pair<Int, Int>> = (6..8).flatMap { i -> (6..8).map { j -> i to j } }.toSet(),
) {
    val origine = Punto(45.40, 11.87)
    private val piano = PianoLocale(origine)

    fun nodo(i: Int, j: Int): Punto = piano.punto(j * passo, i * passo)

    /** Un arco orientato da a a b. */
    data class Arco(val a: Pair<Int, Int>, val b: Pair<Int, Int>, val nome: String, val velocita: Double) {
        val inverso get() = copy(a = b, b = a)
    }

    private fun esiste(n: Pair<Int, Int>) = n.first in 0 until lato && n.second in 0 until lato && n !in lago

    /** Tutti gli archi orientati (doppio senso = due archi). */
    val archi: List<Arco> = buildList {
        for (i in 0 until lato) for (j in 0 until lato) {
            val n = i to j
            if (!esiste(n)) continue
            val est = i to j + 1
            if (esiste(est)) {
                val vel = if (i == 2) 20.0 else 11.0
                val nome = if (i == 2) "Corso Simulato" else "Via Orizzontale $i"
                add(Arco(n, est, nome, vel)); add(Arco(est, n, nome, vel))
            }
            val nord = i + 1 to j
            if (esiste(nord)) {
                val nome = "Via Verticale $j"
                add(Arco(n, nord, nome, 11.0))
                if (j != 3) add(Arco(nord, n, nome, 11.0)) // Via Verticale 3: senso unico verso nord
            }
        }
    }

    fun punto(n: Pair<Int, Int>) = nodo(n.first, n.second)
    fun lunghezza(a: Arco) = Geo.distanza(punto(a.a), punto(a.b))

    /** Le strade come le vedrebbe la mappa (pezzi spezzati a metà, come fanno i tasselli). */
    fun stradeLocali(): List<StradaLocale> {
        val out = mutableListOf<StradaLocale>()
        // righe: spezziamo ogni via orizzontale in due pezzi che si sovrappongono un po' (come ai bordi dei tasselli)
        for (i in 0 until lato) {
            var segmento = mutableListOf<Punto>()
            var parte = 0
            fun chiudi() {
                if (segmento.size >= 2) out += StradaLocale("r$i-${parte++}", segmento.toList(), if (i == 2) "Corso Simulato" else "Via Orizzontale $i", if (i == 2) "primary" else "minor")
                segmento = mutableListOf()
            }
            for (j in 0 until lato) {
                if (!esiste(i to j)) { chiudi(); continue }
                segmento += nodo(i, j)
                if (j == 7) { chiudi(); segmento += nodo(i, j) } // taglio "di tassello"
            }
            chiudi()
        }
        for (j in 0 until lato) {
            var segmento = mutableListOf<Punto>()
            var parte = 0
            fun chiudi() {
                if (segmento.size >= 2) out += StradaLocale("c$j-${parte++}", segmento.toList(), "Via Verticale $j", "minor", sensoUnico = if (j == 3) 1 else 0)
                segmento = mutableListOf()
            }
            for (i in 0 until lato) {
                if (!esiste(i to j)) { chiudi(); continue }
                segmento += nodo(i, j)
            }
            chiudi()
        }
        return out
    }

    // ------------------------------------------------------------------
    // Ricerca del percorso
    // ------------------------------------------------------------------

    /** Un punto agganciato a un arco orientato, alla frazione f (0 = inizio, 1 = fine). */
    data class Aggancio(val arco: Arco, val f: Double, val punto: Punto, val distanza: Double)

    fun archiLiberi(aree: List<Poligono>): List<Arco> =
        archi.filter { a -> aree.none { Aree.distanzaLinea(it, listOf(punto(a.a), punto(a.b))) < 0.01 } }

    /** Aggancia un punto all'arco più vicino che rispetta la direzione richiesta. */
    fun aggancia(p: Punto, liberi: List<Arco>, raggio: Double, direzione: Double?, tolleranza: Double): Aggancio? {
        return liberi.mapNotNull { a ->
            if (direzione != null && Geo.differenzaAngoli(direzione, Geo.direzione(punto(a.a), punto(a.b))) > tolleranza) return@mapNotNull null
            val pr = Geo.proietta(listOf(punto(a.a), punto(a.b)), p)
            if (pr.distanza > raggio) null else Aggancio(a, pr.frazione, pr.punto, pr.distanza)
        }.minByOrNull { it.distanza }
    }

    /** Percorso fra due agganci: lista di nodi intermedi + tempo, o null. */
    fun cerca(da: Aggancio, a: Aggancio, liberi: List<Arco>, penalita: Map<Arco, Double> = emptyMap()): Pair<List<Pair<Int, Int>>, Double>? {
        if (da.arco == a.arco && a.f >= da.f) return emptyList<Pair<Int, Int>>() to lunghezza(da.arco) * (a.f - da.f) / da.arco.velocita
        val uscenti = liberi.groupBy { it.a }
        val costo = HashMap<Pair<Int, Int>, Double>()
        val prima = HashMap<Pair<Int, Int>, Pair<Int, Int>>()
        val coda = PriorityQueue<Pair<Pair<Int, Int>, Double>>(compareBy { it.second })
        val partenza = da.arco.b
        costo[partenza] = lunghezza(da.arco) * (1 - da.f) / da.arco.velocita
        coda += partenza to costo[partenza]!!
        while (coda.isNotEmpty()) {
            val (n, c) = coda.poll()
            if (c > (costo[n] ?: Double.MAX_VALUE)) continue
            if (n == a.arco.a) break
            for (e in uscenti[n].orEmpty()) {
                val nc = c + lunghezza(e) / e.velocita * (penalita[e] ?: 1.0)
                if (nc < (costo[e.b] ?: Double.MAX_VALUE)) {
                    costo[e.b] = nc; prima[e.b] = n; coda += e.b to nc
                }
            }
        }
        val fine = a.arco.a
        val cFine = costo[fine] ?: return null
        val nodi = mutableListOf(fine)
        while (nodi.last() != partenza) nodi += prima[nodi.last()] ?: return null
        return nodi.reversed() to cFine + lunghezza(a.arco) * a.f / a.arco.velocita
    }

    fun nomeArco(n1: Pair<Int, Int>, n2: Pair<Int, Int>): String =
        archi.firstOrNull { it.a == n1 && it.b == n2 }?.nome ?: archi.first { it.a == n2 && it.b == n1 }.nome

    fun velocitaArco(n1: Pair<Int, Int>, n2: Pair<Int, Int>): Double =
        archi.firstOrNull { it.a == n1 && it.b == n2 }?.velocita ?: 11.0
}
