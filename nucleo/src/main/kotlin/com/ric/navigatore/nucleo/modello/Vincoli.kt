package com.ric.navigatore.nucleo.modello

import com.ric.navigatore.nucleo.geo.Aree
import com.ric.navigatore.nucleo.geo.Geo
import com.ric.navigatore.nucleo.geo.Linea
import com.ric.navigatore.nucleo.geo.Poligono
import com.ric.navigatore.nucleo.geo.Punto
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.util.UUID

/** Quanto è "forte" un vincolo. */
@Serializable
enum class Priorita(val etichetta: String) {
    /** Deve essere rispettato: se è impossibile, il calcolo si ferma e spiega perché. */
    OBBLIGATORIO("Obbligatorio"),

    /** Si prova a rispettarlo; se non si riesce, il percorso viene dato lo stesso, segnalandolo. */
    PREFERITO("Preferito"),
}

/** Per quanto tempo resta valido un vincolo. */
@Serializable
enum class Durata(val etichetta: String) {
    /** Sparisce quando si inizia un nuovo viaggio. */
    SOLO_QUESTO_VIAGGIO("Solo questo viaggio"),

    /** Resta salvato e viene riproposto nei viaggi successivi. */
    SALVATO("Salvato per i prossimi viaggi"),
}

/** Senso di percorrenza richiesto per un tratto obbligatorio. */
@Serializable
enum class Senso(val etichetta: String) {
    DA_INIZIO_A_FINE("Dal primo punto al secondo"),
    DA_FINE_A_INIZIO("Dal secondo punto al primo"),
    QUALSIASI("In un senso qualsiasi"),
}

/** Come va usata un'area "da attraversare". */
@Serializable
enum class ModoArea(val etichetta: String, val spiegazione: String) {
    PASSA_ALL_INTERNO(
        "Passa all'interno",
        "Il percorso deve contenere almeno un pezzo di strada dentro l'area.",
    ),
    ATTRAVERSA(
        "Attraversa",
        "Il percorso deve entrare nell'area e poi uscirne da un altro lato.",
    ),
}

/** Forma con cui l'utente ha disegnato un'area. */
@Serializable
enum class FormaArea(val etichetta: String) { POLIGONO("Poligono"), RETTANGOLO("Rettangolo"), CERCHIO("Cerchio") }

/**
 * Un vincolo imposto dall'utente sul percorso.
 *
 * Ci sono due famiglie:
 *  - ESCLUSIONI (in rosso sulla mappa): [EvitaTratto], [EvitaArea]
 *  - PASSAGGI   (in verde sulla mappa): [PassaPunto], [PassaTratto], [PassaArea]
 */
@Serializable
sealed class Vincolo {
    abstract val id: String
    abstract val nome: String
    abstract val attivo: Boolean
    abstract val priorita: Priorita
    abstract val durata: Durata

    /** Vero per i vincoli "rossi" (da evitare). */
    val esclusione: Boolean get() = this is EvitaTratto || this is EvitaArea

    /**
     * Fra quali tappe va rispettato un passaggio: 0 = fra partenza e prima
     * tappa (o arrivo), 1 = dopo la prima tappa, ecc. null = scelta automatica.
     */
    open val dopoTappa: Int? get() = null

    /** Descrizione breve per l'elenco dei vincoli. */
    abstract fun descrizione(): String

    /** Copia con alcuni campi cambiati (comodo per l'interfaccia). */
    fun cambia(
        nome: String = this.nome,
        attivo: Boolean = this.attivo,
        priorita: Priorita = this.priorita,
        durata: Durata = this.durata,
    ): Vincolo = when (this) {
        is EvitaTratto -> copy(nome = nome, attivo = attivo, priorita = priorita, durata = durata)
        is EvitaArea -> copy(nome = nome, attivo = attivo, priorita = priorita, durata = durata)
        is PassaPunto -> copy(nome = nome, attivo = attivo, priorita = priorita, durata = durata)
        is PassaTratto -> copy(nome = nome, attivo = attivo, priorita = priorita, durata = durata)
        is PassaArea -> copy(nome = nome, attivo = attivo, priorita = priorita, durata = durata)
    }

    companion object {
        fun nuovoId(): String = UUID.randomUUID().toString()
    }
}

/**
 * Evita un tratto di strada.
 *
 * IMPORTANTE: il servizio openrouteservice NON permette di escludere un
 * singolo "arco" stradale. Escludiamo quindi una fascia (poligono) larga
 * [larghezzaFascia] metri per lato attorno alla strada, accorciata di
 * [rientroEstremi] metri alle due estremità per non bloccare gli incroci.
 * È un'APPROSSIMAZIONE: la fascia blocca anche ogni strada che la tocca
 * (incroci intermedi, strade parallele molto vicine, cavalcavia). Inoltre il
 * motore blocca l'intero arco stradale che tocca la fascia, quindi
 * l'esclusione effettiva arriva fino al primo incrocio.
 */
@Serializable
@SerialName("evita_tratto")
data class EvitaTratto(
    override val id: String = Vincolo.nuovoId(),
    override val nome: String,
    /** Geometria della strada, presa dai dati della mappa. */
    val linea: Linea,
    val larghezzaFascia: Double = 10.0,
    val rientroEstremi: Double = 15.0,
    override val attivo: Boolean = true,
    override val priorita: Priorita = Priorita.OBBLIGATORIO,
    override val durata: Durata = Durata.SOLO_QUESTO_VIAGGIO,
) : Vincolo() {
    /** La linea effettivamente usata (accorciata alle estremità). */
    fun lineaEffettiva(): Linea {
        val prog = Geo.progressive(linea)
        val tot = prog.last()
        // non accorciamo mai più di un quarto per lato, sui tratti corti
        val rientro = minOf(rientroEstremi, tot / 4)
        return Geo.sottoLinea(linea, rientro, tot - rientro, prog)
    }

    /** Le aree che verranno inviate al motore. */
    fun aree(): List<Poligono> = Aree.fascia(lineaEffettiva(), larghezzaFascia)

    override fun descrizione() =
        "Evita tratto di ${formattaDistanza(Geo.lunghezza(linea))} (fascia ±${larghezzaFascia.toInt()} m, approssimata)"
}

/** Evita un'area disegnata (poligono, rettangolo o cerchio). */
@Serializable
@SerialName("evita_area")
data class EvitaArea(
    override val id: String = Vincolo.nuovoId(),
    override val nome: String,
    val forma: FormaArea,
    val poligono: Poligono,
    /** Solo per i cerchi: centro e raggio, per poterli modificare dopo. */
    val centro: Punto? = null,
    val raggio: Double? = null,
    override val attivo: Boolean = true,
    override val priorita: Priorita = Priorita.OBBLIGATORIO,
    override val durata: Durata = Durata.SOLO_QUESTO_VIAGGIO,
) : Vincolo() {
    override fun descrizione(): String = when (forma) {
        FormaArea.CERCHIO -> "Evita cerchio di raggio ${formattaDistanza(raggio ?: 0.0)}"
        else -> "Evita ${forma.etichetta.lowercase()} di ${formattaSuperficie(Aree.superficie(poligono))}"
    }
}

/** Passa da un punto preciso. */
@Serializable
@SerialName("passa_punto")
data class PassaPunto(
    override val id: String = Vincolo.nuovoId(),
    override val nome: String,
    /** Dove ha toccato l'utente. */
    val punto: Punto,
    /** Il punto sulla strada percorribile più vicino (dopo l'"aggancio"). */
    val agganciato: Punto? = null,
    val nomeStrada: String? = null,
    override val dopoTappa: Int? = null,
    override val attivo: Boolean = true,
    override val priorita: Priorita = Priorita.OBBLIGATORIO,
    override val durata: Durata = Durata.SOLO_QUESTO_VIAGGIO,
) : Vincolo() {
    /** Il punto da usare per il calcolo. */
    val puntoUsato: Punto get() = agganciato ?: punto

    override fun descrizione(): String =
        "Passa da " + (nomeStrada?.takeIf { it.isNotBlank() } ?: puntoUsato.toString()) +
            (agganciato?.let { " (spostato di ${formattaDistanza(Geo.distanza(punto, it))} sulla strada)" } ?: "")
}

/** Percorre un tratto di strada (in un senso preciso o qualsiasi). */
@Serializable
@SerialName("passa_tratto")
data class PassaTratto(
    override val id: String = Vincolo.nuovoId(),
    override val nome: String,
    val linea: Linea,
    val senso: Senso = Senso.DA_INIZIO_A_FINE,
    /** Vero se i dati della mappa indicano una strada a senso unico. */
    val sensoUnico: Boolean = false,
    override val dopoTappa: Int? = null,
    override val attivo: Boolean = true,
    override val priorita: Priorita = Priorita.OBBLIGATORIO,
    override val durata: Durata = Durata.SOLO_QUESTO_VIAGGIO,
) : Vincolo() {
    /** La linea orientata nel senso richiesto (per QUALSIASI: com'è stata disegnata). */
    fun lineaOrientata(inverti: Boolean = false): Linea =
        if ((senso == Senso.DA_FINE_A_INIZIO) xor inverti) linea.reversed() else linea

    override fun descrizione() =
        "Percorri tratto di ${formattaDistanza(Geo.lunghezza(linea))} – ${senso.etichetta.lowercase()}"
}

/** Passa dentro un'area o attraversala. */
@Serializable
@SerialName("passa_area")
data class PassaArea(
    override val id: String = Vincolo.nuovoId(),
    override val nome: String,
    val forma: FormaArea,
    val poligono: Poligono,
    val modo: ModoArea = ModoArea.PASSA_ALL_INTERNO,
    val centro: Punto? = null,
    val raggio: Double? = null,
    override val dopoTappa: Int? = null,
    override val attivo: Boolean = true,
    override val priorita: Priorita = Priorita.OBBLIGATORIO,
    override val durata: Durata = Durata.SOLO_QUESTO_VIAGGIO,
) : Vincolo() {
    override fun descrizione() =
        "${modo.etichetta} ${forma.etichetta.lowercase()} di ${formattaSuperficie(Aree.superficie(poligono))}"
}

/** "1,2 km" oppure "350 m". */
fun formattaDistanza(metri: Double): String = when {
    metri >= 10_000 -> "%d km".format((metri / 1000).toInt())
    metri >= 1000 -> String.format(java.util.Locale.ITALY, "%.1f km", metri / 1000)
    metri >= 100 -> "${(metri / 10).toInt() * 10} m"
    else -> "${metri.toInt()} m"
}

/** "3,4 km²" oppure "8.000 m²". */
fun formattaSuperficie(mq: Double): String =
    if (mq >= 100_000) String.format(java.util.Locale.ITALY, "%.1f km²", mq / 1_000_000)
    else String.format(java.util.Locale.ITALY, "%,d m²", mq.toInt())

/** "1 h 25 min" oppure "12 min". */
fun formattaDurata(secondi: Double): String {
    val min = Math.round(secondi / 60.0).toInt()
    return if (min >= 60) "${min / 60} h ${min % 60} min" else "$min min"
}
