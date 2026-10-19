package com.ric.navigatore.nucleo.navigazione

import com.ric.navigatore.nucleo.geo.Geo
import com.ric.navigatore.nucleo.geo.Punto
import com.ric.navigatore.nucleo.modello.Manovra
import com.ric.navigatore.nucleo.modello.Percorso
import com.ric.navigatore.nucleo.modello.TipoManovra
import com.ric.navigatore.nucleo.modello.formattaDistanza
import java.text.Normalizer
import kotlin.math.max

/** Cosa cerca l'utente: un'uscita, una svolta o un luogo (città, paese…). */
enum class Riferimento { USCITA, SVOLTA, LUOGO }

/** Dove mettere la mappa rispetto a ciò che si cerca. */
enum class Posizione { PRIMA, DOPO, SU }

/** Una frase interpretata, es. "prima dell'uscita per Bologna". */
data class Domanda(
    val frase: String,
    /** Il nome cercato, es. "bologna" (minuscolo e senza accenti). */
    val nome: String,
    val riferimento: Riferimento,
    val posizione: Posizione,
) {
    /** Il nome con le iniziali maiuscole, per mostrarlo. */
    val nomeLeggibile: String get() = nome.split(' ').joinToString(" ") { it.replaceFirstChar(Char::uppercase) }
}

/** Il punto del percorso trovato. */
data class PuntoTrovato(
    /** Metri dalla partenza del percorso: la mappa va centrata qui. */
    val progressiva: Double,
    val punto: Punto,
    /** Testo da mostrare, es. "Svolta a destra su Via Roma · tra 37 km". */
    val descrizione: String,
    /** La manovra trovata (se il punto è un incrocio). */
    val manovra: Manovra? = null,
    /** Avvertenza, es. "Roma è a 25 km dal percorso". */
    val nota: String? = null,
)

/**
 * Ricerca "a voce" (o scritta) di un punto LUNGO IL PERCORSO ATTUALE,
 * es. "prima dell'uscita per Bologna", "prima della svolta per Meduno",
 * "prima di Roma".
 *
 * Si cerca SOLO nella parte di percorso che resta da fare:
 *  1. prima fra le indicazioni del percorso (nomi delle strade e direzioni);
 *  2. altrimenti si cerca il luogo per nome (geocodifica) e si prende
 *     l'incrocio del percorso più vicino a quel luogo, oppure, per una
 *     città, il punto in cui il percorso vi entra.
 */
object RicercaSulPercorso {
    /** Parole che precedono il nome e che non ne fanno parte. */
    private val PAROLE_INIZIALI = setOf(
        "centra", "centrati", "centrare", "centrala", "mostra", "mostrami", "fammi", "vedere", "vai", "portami", "porta",
        "cerca", "trova", "zoom", "mappa", "sulla", "sul", "sullo", "punto", "zona", "la", "il", "lo", "l", "i", "gli",
        "le", "un", "una", "uno", "mi", "ci", "e", "prima", "dopo", "poco", "subito", "appena", "del", "dello", "della",
        "dell", "dei", "degli", "delle", "di", "da", "dal", "dalla", "dall", "per", "verso", "a", "al", "alla", "all",
        "allo", "in", "nel", "nella", "nell", "su", "uscita", "uscite", "svincolo", "casello", "raccordo", "svolta",
        "bivio", "incrocio", "rotonda", "rotatoria", "deviazione", "girare", "giro", "citta", "paese", "centro",
        "arrivare", "arrivo", "entrare", "ingresso", "raggiungere", "passare", "direzione", "autostrada", "autostradale",
        "superstrada", "tangenziale",
    )
    private val PAROLE_FINALI = setOf("per", "favore", "grazie", "piacere", "adesso", "ora")

    /** Minuscolo, senza accenti e apostrofi, spazi semplici. */
    fun normalizza(t: String): String =
        Normalizer.normalize(t.lowercase(), Normalizer.Form.NFD).replace(Regex("\\p{M}+"), "")
            .replace(Regex("[^a-z0-9]+"), " ").trim()

    /** Interpreta la frase. Null se non contiene un nome da cercare. */
    fun interpreta(frase: String): Domanda? {
        val t = normalizza(frase)
        if (t.isBlank()) return null
        val parole = t.split(' ')
        val posizione = when {
            "prima" in parole -> Posizione.PRIMA
            "dopo" in parole -> Posizione.DOPO
            else -> Posizione.SU
        }
        val riferimento = when {
            Regex("\\b(uscit|svincol|casell|raccord)").containsMatchIn(t) -> Riferimento.USCITA
            Regex("\\b(svolt|bivi|incroci|rotond|rotatori|deviazion|girare)").containsMatchIn(t) -> Riferimento.SVOLTA
            else -> Riferimento.LUOGO
        }
        // il nome è ciò che resta dopo le parole iniziali (e senza le parole di cortesia finali)
        val resto = parole.dropWhile { it in PAROLE_INIZIALI }.toMutableList()
        while (resto.isNotEmpty() && resto.last() in PAROLE_FINALI) resto.removeAt(resto.lastIndex)
        if (resto.isEmpty()) return null
        return Domanda(frase, resto.joinToString(" "), riferimento, posizione)
    }

    /**
     * Passo 1: cerca il nome fra le indicazioni del percorso ancora da fare.
     * Esempio: "Svolta a destra su Via Meduno" o "Tieni la destra verso Bologna".
     */
    fun cercaNelleIndicazioni(d: Domanda, p: Percorso, progressivaAttuale: Double): PuntoTrovato? {
        val prog = Geo.progressive(p.geometria)
        val parola = Regex("\\b${Regex.escape(d.nome)}\\b")
        val candidate = p.manovre.filter { m ->
            m.tipo != TipoManovra.PARTENZA && m.tipo != TipoManovra.ARRIVO &&
                prog[m.daIndice.coerceIn(0, prog.lastIndex)] > progressivaAttuale + 20 &&
                parola.containsMatchIn(normalizza(m.istruzione + " " + m.nomeStrada))
        }
        // per "uscita" preferiamo bivi e uscite (tieni la destra/sinistra)
        val m = (if (d.riferimento == Riferimento.USCITA) candidate.firstOrNull { Anteprima.eUscita(it) } else null)
            ?: candidate.firstOrNull() ?: return null
        val s = prog[m.daIndice.coerceIn(0, prog.lastIndex)]
        return risultatoManovra(d, p, prog, m, s, progressivaAttuale, null)
    }

    /**
     * Passo 2: il luogo è stato trovato per nome in [luogo]: si cerca il punto
     * del percorso (ancora da fare) che gli corrisponde.
     */
    fun vicinoAlLuogo(d: Domanda, p: Percorso, progressivaAttuale: Double, luogo: Punto, nomeLuogo: String = d.nomeLeggibile): PuntoTrovato {
        val linea = p.geometria
        val prog = Geo.progressive(linea)
        // punto del percorso più vicino al luogo (campionato ogni 100 m)
        val totale = prog.last()
        val passi = generateSequence(progressivaAttuale) { it + 100.0 }.takeWhile { it < totale }.toList() + totale
        val distanze = passi.map { s -> s to Geo.distanza(Geo.puntoAProgressiva(linea, s, prog), luogo) }
        val (sVicino, dVicino) = distanze.minBy { it.second }
        val nota = if (dVicino > 15_000) "$nomeLuogo è a ${formattaDistanza(dVicino)} dal percorso: ti mostro il punto del percorso più vicino." else null

        if (d.riferimento != Riferimento.LUOGO) {
            // l'incrocio (ancora da fare) più vicino al luogo
            val m = p.manovre.filter { Anteprima.haAnteprima(it) && prog[it.daIndice.coerceIn(0, prog.lastIndex)] > progressivaAttuale + 20 }
                .minByOrNull { Geo.distanza(linea[it.daIndice.coerceIn(0, linea.lastIndex)], luogo) }
            if (m != null) {
                val s = prog[m.daIndice.coerceIn(0, prog.lastIndex)]
                // accettiamo l'incrocio se non è molto più lontano dal luogo del percorso stesso
                if (Geo.distanza(linea[m.daIndice.coerceIn(0, linea.lastIndex)], luogo) <= dVicino + 5_000) {
                    return risultatoManovra(d, p, prog, m, s, progressivaAttuale, nota)
                }
            }
        }
        // un luogo (città, paese): dove il percorso "entra" nella zona e dove ne esce
        val raggio = max(dVicino + 1_500, 3_000.0)
        val dentro = distanze.filter { it.second <= raggio }
        val sIngresso = dentro.firstOrNull()?.first ?: sVicino
        val sUscita = dentro.lastOrNull()?.first ?: sVicino
        val (s, cosa) = when (d.posizione) {
            Posizione.PRIMA -> max(progressivaAttuale, sIngresso - 300) to "Prima di $nomeLuogo"
            Posizione.DOPO -> (sUscita + 300).coerceAtMost(prog.last()) to "Dopo $nomeLuogo"
            Posizione.SU -> sVicino to nomeLuogo
        }
        return PuntoTrovato(s, Geo.puntoAProgressiva(linea, s, prog), "$cosa · tra ${formattaDistanza(s - progressivaAttuale)}", nota = nota)
    }

    /** Fra più luoghi con lo stesso nome, l'indice di quello più vicino alla parte di percorso ancora da fare. */
    fun piuVicinoAlPercorso(luoghi: List<Punto>, p: Percorso, progressivaAttuale: Double): Int {
        if (luoghi.size <= 1) return 0
        val prog = Geo.progressive(p.geometria)
        val campioni = generateSequence(progressivaAttuale) { it + 500.0 }.takeWhile { it < prog.last() }
            .map { Geo.puntoAProgressiva(p.geometria, it, prog) }.toList() + p.geometria.last()
        return luoghi.indices.minBy { i -> campioni.minOf { Geo.distanza(it, luoghi[i]) } }
    }

    /** Il risultato quando il punto è un incrocio: la mappa va poco prima, sull'incrocio o poco dopo. */
    private fun risultatoManovra(
        d: Domanda, p: Percorso, prog: DoubleArray, m: Manovra, s: Double, attuale: Double, nota: String?,
    ): PuntoTrovato {
        val centro = when (d.posizione) {
            Posizione.PRIMA -> max(attuale, s - 200)
            Posizione.DOPO -> (s + 200).coerceAtMost(prog.last())
            Posizione.SU -> s
        }
        return PuntoTrovato(
            progressiva = centro,
            punto = Geo.puntoAProgressiva(p.geometria, centro, prog),
            descrizione = "${m.istruzione.trimEnd('.')} · tra ${formattaDistanza(s - attuale)}",
            manovra = m,
            nota = nota,
        )
    }
}
