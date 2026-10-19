package com.ric.navigatore.nucleo.navigazione

import com.ric.navigatore.nucleo.geo.Geo
import com.ric.navigatore.nucleo.geo.Linea
import com.ric.navigatore.nucleo.geo.Punto
import com.ric.navigatore.nucleo.modello.Manovra
import com.ric.navigatore.nucleo.modello.Percorso
import com.ric.navigatore.nucleo.modello.TipoManovra
import kotlin.math.max

/**
 * Cosa serve per disegnare l'anteprima di un incrocio:
 * la mappa vera attorno al punto della manovra, orientata come si arriva,
 * con sopra il percorso (stesso colore della mappa principale).
 */
data class GeometriaAnteprima(
    /** Punto della manovra (centro dell'incrocio). */
    val centro: Punto,
    /** Direzione con cui si arriva all'incrocio (gradi da nord): diventa "l'alto" dell'anteprima. */
    val direzioneArrivo: Double,
    /** Direzione con cui si esce dall'incrocio. */
    val direzioneUscita: Double,
    /** Pezzo di percorso PRIMA della manovra (fino al centro). */
    val prima: Linea,
    /** Pezzo di percorso DOPO la manovra (dal centro in avanti): termina con la freccia. */
    val dopo: Linea,
    /** Zoom consigliato: più largo per le uscite veloci e le rotatorie grandi. */
    val zoom: Double,
)

/**
 * Regole dell'anteprima degli incroci.
 *
 * L'anteprima compare con un anticipo PROPORZIONALE ALLA VELOCITÀ:
 * circa 12 secondi prima della manovra (20 secondi per uscite, bivi e
 * corsie veloci), mai meno di 150 m e mai più di 1,5 km.
 * Resta visibile finché l'incrocio non è superato.
 */
object Anteprima {
    const val SECONDI = 12.0
    const val SECONDI_VELOCE = 20.0
    const val MINIMO = 150.0
    const val MASSIMO = 1500.0

    /** Oltre ~80 km/h si usano i tempi "veloci". */
    const val VELOCITA_VELOCE = 22.0

    /** Manovre per cui ha senso un'anteprima (non partenza, arrivo, "prosegui dritto"). */
    private val CON_ANTEPRIMA = setOf(
        TipoManovra.SINISTRA, TipoManovra.DESTRA, TipoManovra.SINISTRA_STRETTA, TipoManovra.DESTRA_STRETTA,
        TipoManovra.SINISTRA_LEGGERA, TipoManovra.DESTRA_LEGGERA, TipoManovra.ROTATORIA, TipoManovra.ESCI_ROTATORIA,
        TipoManovra.INVERSIONE, TipoManovra.MANTIENI_SINISTRA, TipoManovra.MANTIENI_DESTRA,
    )

    fun haAnteprima(m: Manovra): Boolean = m.tipo in CON_ANTEPRIMA

    /** Bivi, uscite e corsie di decelerazione: servono più secondi di preavviso. */
    fun eUscita(m: Manovra): Boolean = m.tipo == TipoManovra.MANTIENI_SINISTRA || m.tipo == TipoManovra.MANTIENI_DESTRA

    /** Metri di anticipo con cui mostrare l'anteprima, data la velocità in m/s. */
    fun anticipo(velocita: Double?, m: Manovra): Double {
        // sotto i 30 km/h (o senza velocità) ragioniamo come se fossimo a 30 km/h
        val v = max(velocita ?: 0.0, 8.3)
        val secondi = if (eUscita(m) || v > VELOCITA_VELOCE) SECONDI_VELOCE else SECONDI
        return (v * secondi).coerceIn(MINIMO, MASSIMO)
    }

    /** Titolo breve dell'anteprima, ricavato dai dati del percorso (che vengono da OpenStreetMap). */
    fun titolo(m: Manovra): String = when (m.tipo) {
        TipoManovra.ROTATORIA, TipoManovra.ESCI_ROTATORIA ->
            m.uscita?.let { "Rotatoria: ${it}ª uscita" } ?: "Rotatoria"
        TipoManovra.MANTIENI_SINISTRA -> "Tieni la sinistra"
        TipoManovra.MANTIENI_DESTRA -> "Tieni la destra"
        TipoManovra.SINISTRA -> "Svolta a sinistra"
        TipoManovra.DESTRA -> "Svolta a destra"
        TipoManovra.SINISTRA_STRETTA -> "Svolta stretta a sinistra"
        TipoManovra.DESTRA_STRETTA -> "Svolta stretta a destra"
        TipoManovra.SINISTRA_LEGGERA -> "Svolta leggera a sinistra"
        TipoManovra.DESTRA_LEGGERA -> "Svolta leggera a destra"
        TipoManovra.INVERSIONE -> "Inversione a U"
        else -> "Prosegui"
    }

    /** Prepara la geometria dell'anteprima per la manovra [m] del percorso [p]. */
    fun geometria(p: Percorso, m: Manovra, velocita: Double? = null): GeometriaAnteprima {
        val linea = p.geometria
        val prog = Geo.progressive(linea)
        val s = prog[m.daIndice.coerceIn(0, prog.lastIndex)]
        val centro = Geo.puntoAProgressiva(linea, s, prog)
        // direzione d'arrivo misurata su 40 m (più stabile della direzione "puntuale")
        val arrivo = Geo.direzione(Geo.puntoAProgressiva(linea, s - 40, prog), centro).takeIf { s > 1 }
            ?: Geo.direzioneAProgressiva(linea, s, prog)
        val uscita = Geo.direzione(centro, Geo.puntoAProgressiva(linea, s + 40, prog))
        val rotatoria = m.tipo == TipoManovra.ROTATORIA || m.tipo == TipoManovra.ESCI_ROTATORIA
        val veloce = eUscita(m) || (velocita ?: 0.0) > VELOCITA_VELOCE
        // dopo la manovra: almeno 80 m, oppure fino all'uscita dalla rotatoria
        val lunghezzaDopo = if (rotatoria) max(120.0, prog[m.aIndice.coerceIn(0, prog.lastIndex)] - s + 40) else if (veloce) 250.0 else 80.0
        return GeometriaAnteprima(
            centro = centro,
            direzioneArrivo = arrivo,
            direzioneUscita = uscita,
            prima = Geo.sottoLinea(linea, s - (if (veloce) 400.0 else 200.0), s, prog),
            dopo = Geo.sottoLinea(linea, s, s + lunghezzaDopo, prog),
            zoom = when {
                veloce -> 15.6
                rotatoria -> 16.4
                else -> 16.9
            },
        )
    }
}

/**
 * Decide, lettura dopo lettura, quale anteprima mostrare.
 * Una volta comparsa per una manovra, l'anteprima resta finché la manovra
 * non è superata (così non "lampeggia" se la velocità cambia).
 */
class GestoreAnteprima {
    private var mostrata: Manovra? = null
    private var nascosta: Manovra? = null

    /** La manovra di cui mostrare l'anteprima adesso, oppure null. */
    fun aggiorna(stato: StatoGuida, velocita: Double?): Manovra? {
        val m = stato.manovra
        if (m == null || stato.arrivato || stato.fuoriPercorso || !Anteprima.haAnteprima(m)) {
            mostrata = null
            return null
        }
        if (m == nascosta) return null
        if (m != mostrata) {
            mostrata = if (stato.distanzaManovra <= Anteprima.anticipo(velocita, m)) m else null
        }
        return mostrata
    }

    /** L'utente ha chiuso l'anteprima: non la riproponiamo per questa manovra. */
    fun nascondi() {
        nascosta = mostrata
        mostrata = null
    }
}
