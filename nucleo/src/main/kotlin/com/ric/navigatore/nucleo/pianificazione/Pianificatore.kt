package com.ric.navigatore.nucleo.pianificazione

import com.ric.navigatore.nucleo.geo.Aree
import com.ric.navigatore.nucleo.geo.Geo
import com.ric.navigatore.nucleo.geo.Linea
import com.ric.navigatore.nucleo.geo.Poligono
import com.ric.navigatore.nucleo.geo.Punto
import com.ric.navigatore.nucleo.modello.Esito
import com.ric.navigatore.nucleo.modello.Luogo
import com.ric.navigatore.nucleo.modello.ModoArea
import com.ric.navigatore.nucleo.modello.PassaArea
import com.ric.navigatore.nucleo.modello.PassaPunto
import com.ric.navigatore.nucleo.modello.PassaTratto
import com.ric.navigatore.nucleo.modello.Percorso
import com.ric.navigatore.nucleo.modello.Priorita
import com.ric.navigatore.nucleo.modello.PuntoRichiesta
import com.ric.navigatore.nucleo.modello.RichiestaPercorso
import com.ric.navigatore.nucleo.modello.Senso
import com.ric.navigatore.nucleo.modello.TipoErrore
import com.ric.navigatore.nucleo.modello.TipoPunto
import com.ric.navigatore.nucleo.modello.Viaggio
import com.ric.navigatore.nucleo.modello.Vincolo
import com.ric.navigatore.nucleo.servizi.Agganciatore
import com.ric.navigatore.nucleo.servizi.MotorePercorsi
import com.ric.navigatore.nucleo.strade.ReteLocale
import com.ric.navigatore.nucleo.validazione.EsitoControllo
import com.ric.navigatore.nucleo.validazione.Rapporto
import com.ric.navigatore.nucleo.validazione.Validatore
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

/** Risultato completo di una pianificazione. */
data class EsitoPianificazione(
    /** Il percorso scelto (null se non è stato possibile calcolarlo). */
    val percorso: Percorso?,
    /** Percorsi alternativi (solo quando il motore li fornisce). */
    val alternative: List<Percorso> = emptyList(),
    /** Esito dei controlli sul percorso scelto. */
    val rapporto: Rapporto = Rapporto(emptyList()),
    /** Conflitti trovati prima del calcolo. */
    val conflitti: List<Conflitto> = emptyList(),
    /** Vincoli preferiti che non è stato possibile rispettare. */
    val preferitiNonRispettati: List<Vincolo> = emptyList(),
    /** Note per l'utente (metodi euristici, alternative non disponibili…). */
    val note: List<String> = emptyList(),
    /** Errore del servizio o spiegazione del fallimento. */
    val errore: Esito.Errore? = null,
    /** Vincoli che, tolti, rendono possibile il percorso (diagnosi del conflitto). */
    val vincoliCheBloccano: List<Vincolo> = emptyList(),
    /** Quante richieste di percorso sono state usate. */
    val richiesteUsate: Int = 0,
    /** Percorso trovato ma SCARTATO perché viola vincoli obbligatori (solo da mostrare, non da seguire). */
    val percorsoScartato: Percorso? = null,
) {
    val riuscito: Boolean get() = percorso != null
}

/** Informazioni aggiuntive per il calcolo (usate soprattutto durante la navigazione). */
data class Contesto(
    /** Direzione di marcia attuale: evita di proporre un'inversione a U appena ripartiti. */
    val direzioneIniziale: Double? = null,
    /** Rete stradale letta dalla mappa (facoltativa). */
    val reteLocale: ReteLocale? = null,
)

/**
 * Il "cervello" della pianificazione.
 *
 * Trasforma tappe e vincoli in una o più richieste al motore, controlla
 * ogni risultato col [Validatore] e, se serve, riprova con varianti
 * (entro un numero massimo di richieste, [budgetRichieste]).
 *
 * Metodi usati (da dichiarare all'utente):
 *  - ESCLUSIONI: aree da evitare inviate al motore (vincolo rigido del motore).
 *    I tratti di strada sono approssimati con una fascia (vedi EvitaTratto).
 *  - PUNTI: punto intermedio agganciato alla strada.
 *  - TRATTI: punti intermedi lungo il tratto, con direzione di marcia; poi verifica.
 *  - AREE DA ATTRAVERSARE: EURISTICA. Si cercano punti stradali dentro l'area
 *    (non il centro geometrico, che potrebbe essere irraggiungibile), si prova
 *    il più "comodo" e, se la verifica fallisce, il successivo. Non garantisce
 *    il percorso migliore in assoluto.
 */
class Pianificatore(
    private val motore: MotorePercorsi,
    private val agganciatore: Agganciatore? = null,
    var budgetRichieste: Int = 8,
    /** Quanti punti candidati provare al massimo per ogni area da attraversare. */
    var tentativiPerArea: Int = 3,
) {
    /** Contatore delle richieste della pianificazione in corso. */
    private var usate = 0

    // ==================================================================
    // Percorso SENZA vincoli (per il confronto "prima/dopo")
    // ==================================================================

    fun calcolaSenzaVincoli(viaggio: Viaggio, contesto: Contesto = Contesto()): EsitoPianificazione {
        usate = 0
        return calcolaInterno(viaggio.copy(vincoli = emptyList()), contesto)
    }

    // ==================================================================
    // Percorso CON vincoli
    // ==================================================================

    fun calcola(viaggio: Viaggio, contesto: Contesto = Contesto()): EsitoPianificazione {
        usate = 0
        return calcolaInterno(viaggio, contesto)
    }

    private fun calcolaInterno(viaggio: Viaggio, contesto: Contesto): EsitoPianificazione {
        val fermate = viaggio.fermate
        if (fermate.size < 2) {
            return EsitoPianificazione(null, errore = Esito.Errore(TipoErrore.RICHIESTA_NON_VALIDA, "Scegli partenza e destinazione."))
        }
        val note = mutableListOf<String>()
        var vincoli = viaggio.vincoliAttivi

        // 1) Conflitti evidenti, senza consumare richieste
        val conflitti = Conflitti.verifica(fermate, vincoli, motore.capacita)
        if (conflitti.any { it.bloccante }) {
            return EsitoPianificazione(
                null, conflitti = conflitti,
                errore = Esito.Errore(TipoErrore.RICHIESTA_NON_VALIDA, "Ci sono vincoli incompatibili: correggili prima del calcolo."),
            )
        }
        // i vincoli PREFERITI coinvolti in conflitti non bloccanti vengono messi da parte
        val preferitiScartati = conflitti.flatMap { it.vincoli }.filter { it.priorita == Priorita.PREFERITO }.distinct()
        vincoli = vincoli - preferitiScartati.toSet()

        // 2) Primo tentativo: tutti i vincoli
        val primo = tentativo(viaggio, vincoli, contesto, note)
        if (primo.percorso != null && primo.rapporto.valido) {
            val nonRispettati = preferitiScartati + preferitiViolati(primo.rapporto)
            return primo.copy(conflitti = conflitti, preferitiNonRispettati = nonRispettati, note = note.distinct(), richiesteUsate = usate)
        }

        // 3) Secondo tentativo: solo gli obbligatori
        val preferiti = vincoli.filter { it.priorita == Priorita.PREFERITO }
        if (preferiti.isNotEmpty() && usate < budgetRichieste) {
            val obbligatori = vincoli - preferiti.toSet()
            val secondo = tentativo(viaggio, obbligatori, contesto, note)
            if (secondo.percorso != null && secondo.rapporto.valido) {
                // rivalutiamo anche i preferiti sul percorso ottenuto (qualcuno può essere rispettato per caso)
                val rapportoCompleto = Validatore.valida(secondo.percorso, obbligatori + preferiti)
                note += "Non è stato possibile rispettare tutti i vincoli preferiti: il percorso rispetta solo quelli obbligatori."
                return secondo.copy(
                    rapporto = rapportoCompleto,
                    conflitti = conflitti,
                    preferitiNonRispettati = preferitiScartati + preferitiViolati(rapportoCompleto),
                    note = note.distinct(),
                    richiesteUsate = usate,
                )
            }
        }

        // 4) Nessun percorso valido: cerchiamo QUALE vincolo obbligatorio lo impedisce
        val obbligatori = vincoli.filter { it.priorita == Priorita.OBBLIGATORIO }
        val colpevoli = mutableListOf<Vincolo>()
        for (v in obbligatori) {
            if (usate >= budgetRichieste) break
            val prova = tentativo(viaggio, vincoli.filter { it.priorita == Priorita.OBBLIGATORIO } - v, contesto, mutableListOf())
            if (prova.percorso != null && prova.rapporto.valido) colpevoli += v
        }
        val errore = primo.errore ?: Esito.Errore(
            TipoErrore.NESSUN_PERCORSO,
            "Il percorso trovato non rispetta tutti i vincoli obbligatori.",
            primo.rapporto.violazioniObbligatorie.joinToString("; ") { it.titolo + ": " + it.dettaglio },
        )
        if (colpevoli.isEmpty() && obbligatori.isNotEmpty() && usate >= budgetRichieste) {
            note += "Raggiunto il limite di $budgetRichieste richieste per questo calcolo: diagnosi incompleta."
        }
        return primo.copy(
            percorso = null,
            percorsoScartato = primo.percorso,
            alternative = emptyList(),
            conflitti = conflitti,
            errore = errore,
            vincoliCheBloccano = colpevoli,
            note = note.distinct(),
            richiesteUsate = usate,
            // teniamo il rapporto del primo tentativo per mostrare cosa non andava
        )
    }

    private fun preferitiViolati(r: Rapporto): List<Vincolo> =
        r.controlli.filter { it.esito == EsitoControllo.VIOLATO && it.vincolo?.priorita == Priorita.PREFERITO }.mapNotNull { it.vincolo }

    // ==================================================================
    // Un tentativo con un certo insieme di vincoli
    // ==================================================================

    /** Un passaggio da tradurre in punti intermedi, già assegnato a un tratto di viaggio. */
    private data class PassaggioOrdinato(val vincolo: Vincolo, val tratto: Int)

    private fun tentativo(viaggio: Viaggio, vincoli: List<Vincolo>, contesto: Contesto, note: MutableList<String>): EsitoPianificazione {
        val fermate = viaggio.fermate
        // Aree da evitare: uniamo quelle sovrapposte
        val aree = Aree.unisci(vincoli.flatMap { Conflitti.areeDi(it) }.flatMap { if (Aree.valido(it)) listOf(it) else Aree.correggi(it) })
        val passaggi = ordinaPassaggi(fermate, vincoli.filter { !it.esclusione })

        // Per le aree da attraversare prepariamo i candidati (punti stradali dentro l'area)
        val candidati = mutableMapOf<String, List<List<PuntoRichiesta>>>()
        for (pa in passaggi.map { it.vincolo }.filterIsInstance<PassaArea>()) {
            val idx = passaggi.indexOfFirst { it.vincolo.id == pa.id }
            val (prima, dopo) = vicini(fermate, passaggi, idx)
            candidati[pa.id] = candidatiArea(pa, prima, dopo, aree, contesto.reteLocale, note)
            if (candidati[pa.id].isNullOrEmpty()) {
                return EsitoPianificazione(
                    null,
                    errore = Esito.Errore(
                        TipoErrore.PUNTO_NON_RAGGIUNGIBILE,
                        "Nell'area «${pa.nome}» non è stata trovata nessuna strada percorribile in auto (fuori dalle zone escluse).",
                    ),
                    vincoliCheBloccano = listOf(pa),
                )
            }
            note += "«${pa.nome}»: metodo euristico (punti stradali candidati dentro l'area, verificati dopo il calcolo). Non garantisce il percorso più breve possibile."
        }

        // Scelta corrente per ogni area: indice del candidato in prova
        val scelte = candidati.keys.associateWith { 0 }.toMutableMap()
        // Tratti con eventuale inversione del senso (per "senso qualsiasi")
        var densita = 1
        var ultimo: EsitoPianificazione? = null

        while (usate < budgetRichieste) {
            val punti = costruisciPunti(fermate, passaggi, candidati, scelte, densita, contesto)
            if (punti.size > motore.capacita.maxPunti) {
                return EsitoPianificazione(
                    null,
                    errore = Esito.Errore(
                        TipoErrore.LIMITI_SUPERATI,
                        "Servirebbero ${punti.size} punti intermedi, ma il servizio ne accetta al massimo ${motore.capacita.maxPunti}. Riduci tappe o tratti obbligatori.",
                    ),
                )
            }
            val conAusiliari = punti.any { it.tipo == TipoPunto.AUSILIARIO }
            val maxAlt = motore.capacita.maxDistanzaAlternativeKm
            val alternative = if (viaggio.opzioni.alternative && punti.size == 2 &&
                (maxAlt == null || Geo.distanza(punti[0].punto, punti[1].punto) / 1000 < maxAlt)
            ) 2 else 0
            if (viaggio.opzioni.alternative && alternative == 0 && motore.capacita.alternativeSoloSenzaIntermedi && punti.size > 2) {
                note += "Percorsi alternativi non disponibili: il servizio li calcola solo senza tappe o passaggi intermedi."
            }
            val richiesta = RichiestaPercorso(
                punti = punti,
                areeDaEvitare = aree,
                opzioni = viaggio.opzioni,
                alternative = alternative,
                proseguiDritto = conAusiliari,
            )
            usate++
            when (val esito = motore.calcola(richiesta)) {
                is Esito.Errore -> {
                    // Un punto ausiliario non raggiungibile appartenente a un'area: proviamo il candidato successivo
                    val area = areaDelPunto(punti, esito.indicePunto, candidati.keys)
                    if (area != null && avanza(scelte, candidati, area)) continue
                    return EsitoPianificazione(null, errore = esito)
                }
                is Esito.Ok -> {
                    val percorsi = esito.valore
                    // controlliamo ogni percorso restituito (il primo e le alternative)
                    val validati = percorsi.map { it to Validatore.valida(it, vincoli) }
                    val buoni = validati.filter { it.second.valido }
                    val migliore = buoni.firstOrNull() ?: validati.first()
                    val risultato = EsitoPianificazione(
                        percorso = migliore.first,
                        alternative = buoni.map { it.first }.filter { it !== migliore.first },
                        rapporto = migliore.second,
                    )
                    if (migliore.second.valido) return risultato
                    ultimo = risultato
                    // Correzioni possibili, in ordine:
                    val violati = migliore.second.violazioniObbligatorie.mapNotNull { it.vincolo }
                    // a) area non rispettata -> candidato successivo
                    val areaViolata = violati.filterIsInstance<PassaArea>().firstOrNull { it.id in candidati }
                    if (areaViolata != null && avanza(scelte, candidati, areaViolata.id)) continue
                    // b) tratto non rispettato -> più punti intermedi lungo il tratto
                    if (violati.any { it is PassaTratto } && densita < 3) { densita++; continue }
                    break
                }
            }
        }
        return ultimo?.copy(percorso = ultimo.percorso) ?: EsitoPianificazione(
            null,
            errore = Esito.Errore(TipoErrore.LIMITI_SUPERATI, "Raggiunto il limite di $budgetRichieste richieste per questo calcolo."),
        )
    }

    private fun avanza(scelte: MutableMap<String, Int>, candidati: Map<String, List<List<PuntoRichiesta>>>, id: String): Boolean {
        val prossimo = (scelte[id] ?: 0) + 1
        if (prossimo >= (candidati[id]?.size ?: 0)) return false
        scelte[id] = prossimo
        return true
    }

    private fun areaDelPunto(punti: List<PuntoRichiesta>, indice: Int?, aree: Set<String>): String? {
        if (indice == null) return null
        return punti.getOrNull(indice)?.idVincolo?.takeIf { it in aree }
    }

    // ==================================================================
    // Ordine dei passaggi fra le tappe
    // ==================================================================

    /**
     * Assegna ogni passaggio al tratto di viaggio giusto (fra due fermate).
     * Se l'utente non l'ha scelto ([Vincolo.dopoTappa] = null) usiamo il tratto
     * in cui la deviazione in linea d'aria è minima. Dentro lo stesso tratto
     * vale l'ordine dell'elenco dei vincoli (che l'utente può riordinare).
     */
    private fun ordinaPassaggi(fermate: List<Luogo>, passaggi: List<Vincolo>): List<PassaggioOrdinato> {
        val tratti = fermate.size - 1
        return passaggi.mapIndexed { i, v ->
            val t = v.dopoTappa?.coerceIn(0, tratti - 1) ?: trattoConsigliato(fermate, puntoRappresentativo(v))
            Triple(v, t, i)
        }.sortedWith(compareBy({ it.second }, { it.third })).map { PassaggioOrdinato(it.first, it.second) }
    }

    /** Il tratto di viaggio (0 = partenza→prima fermata successiva) dove inserire un punto. */
    fun trattoConsigliato(fermate: List<Luogo>, p: Punto): Int =
        (0 until fermate.size - 1).minByOrNull { t ->
            val a = fermate[t].punto
            val b = fermate[t + 1].punto
            Geo.distanza(a, p) + Geo.distanza(p, b) - Geo.distanza(a, b)
        } ?: 0

    private fun puntoRappresentativo(v: Vincolo): Punto = when (v) {
        is PassaPunto -> v.puntoUsato
        is PassaTratto -> Geo.puntoAProgressiva(v.linea, Geo.lunghezza(v.linea) / 2)
        is PassaArea -> Geo.centroRiquadro(v.poligono.esterno)
        else -> error("non è un passaggio")
    }

    /** Punto prima e dopo il passaggio [idx] (per stimare le deviazioni). */
    private fun vicini(fermate: List<Luogo>, passaggi: List<PassaggioOrdinato>, idx: Int): Pair<Punto, Punto> {
        val t = passaggi[idx].tratto
        val prima = passaggi.subList(0, idx).lastOrNull { it.tratto == t }?.let { puntoRappresentativo(it.vincolo) } ?: fermate[t].punto
        val dopo = passaggi.subList(idx + 1, passaggi.size).firstOrNull { it.tratto == t }?.let { puntoRappresentativo(it.vincolo) }
            ?: fermate[t + 1].punto
        return prima to dopo
    }

    // ==================================================================
    // Costruzione dei punti della richiesta
    // ==================================================================

    private fun costruisciPunti(
        fermate: List<Luogo>,
        passaggi: List<PassaggioOrdinato>,
        candidati: Map<String, List<List<PuntoRichiesta>>>,
        scelte: Map<String, Int>,
        densita: Int,
        contesto: Contesto,
    ): List<PuntoRichiesta> {
        val out = mutableListOf<PuntoRichiesta>()
        for ((i, f) in fermate.withIndex()) {
            val tipo = when (i) { 0 -> TipoPunto.PARTENZA; fermate.size - 1 -> TipoPunto.ARRIVO; else -> TipoPunto.TAPPA }
            out += PuntoRichiesta(
                f.punto, tipo,
                direzione = if (i == 0) contesto.direzioneIniziale else null,
                tolleranzaDirezione = 60.0,
            )
            if (i == fermate.size - 1) break
            for (p in passaggi.filter { it.tratto == i }) {
                val precedente = out.last().punto
                out += when (val v = p.vincolo) {
                    is PassaPunto -> listOf(
                        PuntoRichiesta(v.puntoUsato, TipoPunto.AUSILIARIO, raggio = if (v.agganciato != null) 50.0 else 150.0, idVincolo = v.id),
                    )
                    is PassaTratto -> puntiTratto(v, precedente, densita)
                    is PassaArea -> candidati[v.id]!![scelte[v.id] ?: 0]
                    else -> emptyList()
                }
            }
        }
        return out
    }

    /**
     * Punti lungo un tratto obbligatorio, con la direzione di marcia.
     * densita 1: inizio e fine (più uno ogni km); 2 e 3: punti più fitti.
     */
    private fun puntiTratto(v: PassaTratto, precedente: Punto, densita: Int): List<PuntoRichiesta> {
        // senso qualsiasi: scegliamo il verso che parte dall'estremo più vicino al punto precedente
        val inverti = v.senso == Senso.QUALSIASI && Geo.distanza(precedente, v.linea.last()) < Geo.distanza(precedente, v.linea.first())
        val linea = v.lineaOrientata(inverti)
        val prog = Geo.progressive(linea)
        val tot = prog.last()
        val conDirezione = v.senso != Senso.QUALSIASI || v.sensoUnico
        if (tot < 40) {
            val m = tot / 2
            return listOf(puntoSuTratto(linea, prog, m, v.id, conDirezione))
        }
        val rientro = min(15.0, tot * 0.1)
        val passo = when (densita) { 1 -> 1000.0; 2 -> 300.0; else -> 120.0 }
        val n = max(1, ceil((tot - 2 * rientro) / passo).toInt())
        return (0..n).map { k ->
            val m = rientro + (tot - 2 * rientro) * k / n
            puntoSuTratto(linea, prog, m, v.id, conDirezione)
        }
    }

    private fun puntoSuTratto(linea: Linea, prog: DoubleArray, m: Double, id: String, conDirezione: Boolean) = PuntoRichiesta(
        Geo.puntoAProgressiva(linea, m, prog), TipoPunto.AUSILIARIO,
        direzione = if (conDirezione) Geo.direzioneAProgressiva(linea, m, prog) else null,
        tolleranzaDirezione = 30.0,
        raggio = 25.0,
        idVincolo = id,
    )

    // ==================================================================
    // Candidati per le aree da attraversare
    // ==================================================================

    /**
     * Elenco ordinato di "proposte" di punti per un'area: ogni proposta è
     * una lista di 1 punto (passa all'interno) o 2 punti (ingresso e uscita
     * per "attraversa"). Ordinate dalla deviazione minore stimata.
     */
    private fun candidatiArea(
        a: PassaArea,
        prima: Punto,
        dopo: Punto,
        areeEscluse: List<Poligono>,
        rete: ReteLocale?,
        note: MutableList<String>,
    ): List<List<PuntoRichiesta>> {
        fun valido(p: Punto) = Aree.contiene(a.poligono, p) && areeEscluse.none { Aree.contiene(it, p) }
        var punti: List<Punto> = emptyList()
        var verificati = false

        // 1) Punti stradali presi dalla mappa (gratis, senza richieste)
        if (rete != null) {
            punti = rete.puntiStradaliDentro(::valido).map { it.first }
            verificati = punti.isNotEmpty()
        }
        // 2) Griglia di punti agganciati alla rete del motore (1 richiesta di aggancio)
        if (punti.isEmpty() && agganciatore != null) {
            val griglia = griglia(a.poligono, 25)
            val passo = sqrt(Aree.superficie(a.poligono) / max(1, griglia.size))
            when (val e = agganciatore.aggancia(griglia, max(50.0, passo))) {
                is Esito.Ok -> {
                    punti = e.valore.filterNotNull().map { it.agganciato }.filter(::valido)
                    verificati = punti.isNotEmpty()
                }
                is Esito.Errore -> note += "Aggancio alla strada non disponibile (${e.messaggio}): uso punti approssimati."
            }
        }
        // 3) Ultima risorsa: griglia non agganciata (il motore li sposterà sulla strada più vicina)
        if (punti.isEmpty()) {
            punti = griglia(a.poligono, 16).filter(::valido)
            if (punti.isNotEmpty()) note += "«${a.nome}»: punti dell'area non verificati sulla rete stradale; il risultato verrà comunque controllato."
        }
        // Rimuoviamo i doppioni troppo vicini (< 60 m)
        val distinti = mutableListOf<Punto>()
        for (p in punti) if (distinti.none { Geo.distanza(it, p) < 60 }) distinti += p
        if (distinti.isEmpty()) return emptyList()

        val raggio = if (verificati) 30.0 else 150.0
        fun richiesta(p: Punto) = PuntoRichiesta(p, TipoPunto.AUSILIARIO, raggio = raggio, idVincolo = a.id)
        fun deviazione(p: Punto) = Geo.distanza(prima, p) + Geo.distanza(p, dopo)

        val margine = { p: Punto -> distanzaDalBordo(a.poligono, p) }
        val singoli = distinti
            // preferiamo punti non attaccati al bordo (almeno 30 m dentro)
            .sortedWith(compareBy({ if (margine(it) >= 30) 0 else 1 }, { deviazione(it) }))
            .take(tentativiPerArea)
            .map { listOf(richiesta(it)) }

        if (a.modo == ModoArea.PASSA_ALL_INTERNO) return singoli

        // ATTRAVERSA: proviamo prima un punto singolo; poi una coppia ingresso/uscita
        // (ingresso = il punto più vicino a "prima", uscita = il più vicino a "dopo")
        val ingresso = distinti.minByOrNull { Geo.distanza(prima, it) }!!
        val uscita = distinti.filter { Geo.distanza(it, ingresso) > 100 }.minByOrNull { Geo.distanza(it, dopo) }
        val coppia = uscita?.let { listOf(listOf(richiesta(ingresso), richiesta(it))) } ?: emptyList()
        return (singoli.take(1) + coppia + singoli.drop(1)).take(max(2, tentativiPerArea))
    }

    private fun distanzaDalBordo(p: Poligono, punto: Punto): Double =
        Geo.proietta(p.esterno + p.esterno.first(), punto).distanza

    /** Circa [n] punti a griglia dentro l'area (NON il centro geometrico soltanto). */
    private fun griglia(p: Poligono, n: Int): List<Punto> {
        val minLat = p.esterno.minOf { it.lat }
        val maxLat = p.esterno.maxOf { it.lat }
        val minLon = p.esterno.minOf { it.lon }
        val maxLon = p.esterno.maxOf { it.lon }
        val lato = ceil(sqrt(n.toDouble() * 2)).toInt() // più punti del necessario: parte cade fuori
        val out = mutableListOf<Punto>()
        for (i in 0 until lato) for (j in 0 until lato) {
            val q = Punto(minLat + (maxLat - minLat) * (i + 0.5) / lato, minLon + (maxLon - minLon) * (j + 0.5) / lato)
            if (Aree.contiene(p, q)) out += q
        }
        return out.take(n * 2)
    }

    /** Messaggio riassuntivo leggibile di un rapporto. */
    fun riassunto(r: Rapporto): String = r.controlli.joinToString("\n") { "${it.esito.simbolo} ${it.titolo}: ${it.dettaglio}" }
}
