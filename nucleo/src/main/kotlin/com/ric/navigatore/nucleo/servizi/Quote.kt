package com.ric.navigatore.nucleo.servizi

import kotlinx.serialization.Serializable
import java.time.Instant
import java.time.ZoneId

/**
 * Limiti di uso di un servizio (es. "Percorsi: 2000 al giorno, 40 al minuto").
 * I valori predefiniti sono quelli indicati da openrouteservice per il piano
 * gratuito al momento dello sviluppo: possono cambiare, si controllano
 * nella propria pagina personale del fornitore e si modificano nelle Impostazioni.
 */
@Serializable
data class LimiteServizio(
    val chiave: String,
    val nome: String,
    val alGiorno: Int,
    val alMinuto: Int,
)

/** Quanto è stato usato un servizio (oggi e nell'ultimo minuto). */
data class UsoServizio(
    val limite: LimiteServizio,
    val oggi: Int,
    val ultimoMinuto: Int,
    /** Residuo dichiarato dal server nell'ultima risposta, se lo comunica. */
    val residuoServer: Int?,
)

/** Dati da salvare sul telefono per ricordare l'uso fra una sessione e l'altra. */
@Serializable
data class StatoQuote(
    val giorno: String = "",
    val usateOggi: Map<String, Int> = emptyMap(),
    val residuoServer: Map<String, Int> = emptyMap(),
)

/**
 * Conta le richieste fatte ai servizi, per:
 *  1. non superare i limiti al minuto (evita errori inutili);
 *  2. mostrare all'utente quante richieste restano oggi.
 * Il conteggio "vero" lo fa il fornitore: questo è solo un promemoria locale.
 */
class ContatoreQuote(
    limiti: List<LimiteServizio>,
    stato: StatoQuote = StatoQuote(),
    private val orologio: () -> Long = System::currentTimeMillis,
) {
    private val limiti = limiti.associateBy { it.chiave }.toMutableMap()
    private val recenti = mutableMapOf<String, ArrayDeque<Long>>()
    private var giorno = stato.giorno
    private val usateOggi = stato.usateOggi.toMutableMap()
    private val residuoServer = stato.residuoServer.toMutableMap()

    /** Chiamato ad ogni modifica (l'app lo usa per salvare). */
    var alCambio: ((StatoQuote) -> Unit)? = null

    private fun oggi(): String =
        Instant.ofEpochMilli(orologio()).atZone(ZoneId.systemDefault()).toLocalDate().toString()

    private fun nuovoGiornoSeServe() {
        val g = oggi()
        if (g != giorno) {
            giorno = g
            usateOggi.clear()
            residuoServer.clear()
        }
    }

    @Synchronized
    fun cambiaLimite(limite: LimiteServizio) { limiti[limite.chiave] = limite }

    /**
     * Controlla PRIMA di inviare. Restituisce null se si può procedere,
     * altrimenti il messaggio da mostrare.
     */
    @Synchronized
    fun controlla(servizio: String): String? {
        nuovoGiornoSeServe()
        val limite = limiti[servizio] ?: return null
        val adesso = orologio()
        val coda = recenti.getOrPut(servizio) { ArrayDeque() }
        while (coda.isNotEmpty() && adesso - coda.first() > 60_000) coda.removeFirst()
        if (coda.size >= limite.alMinuto) {
            val attesa = 60 - (adesso - coda.first()) / 1000
            return "Limite di ${limite.alMinuto} richieste al minuto per «${limite.nome}» raggiunto: riprova tra $attesa secondi."
        }
        if (residuoServer[servizio] == 0) {
            return "Il fornitore segnala che la quota giornaliera di «${limite.nome}» è esaurita. Si azzera ogni giorno."
        }
        return null
    }

    /** Da chiamare DOPO ogni richiesta effettivamente inviata. */
    @Synchronized
    fun registra(servizio: String, intestazioni: Map<String, String> = emptyMap()) {
        nuovoGiornoSeServe()
        recenti.getOrPut(servizio) { ArrayDeque() }.addLast(orologio())
        usateOggi[servizio] = (usateOggi[servizio] ?: 0) + 1
        // Alcuni server comunicano quante richieste restano (intestazione non garantita)
        intestazioni["x-ratelimit-remaining"]?.substringBefore(',')?.trim()?.toIntOrNull()?.let {
            residuoServer[servizio] = it
        }
        alCambio?.invoke(stato())
    }

    /** Segna la quota come esaurita (dopo un errore "quota" del server). */
    @Synchronized
    fun segnaEsaurita(servizio: String) {
        nuovoGiornoSeServe()
        residuoServer[servizio] = 0
        alCambio?.invoke(stato())
    }

    @Synchronized
    fun stato() = StatoQuote(giorno, usateOggi.toMap(), residuoServer.toMap())

    @Synchronized
    fun riepilogo(): List<UsoServizio> {
        nuovoGiornoSeServe()
        val adesso = orologio()
        return limiti.values.map { l ->
            UsoServizio(
                l,
                usateOggi[l.chiave] ?: 0,
                recenti[l.chiave]?.count { adesso - it <= 60_000 } ?: 0,
                residuoServer[l.chiave],
            )
        }
    }
}
