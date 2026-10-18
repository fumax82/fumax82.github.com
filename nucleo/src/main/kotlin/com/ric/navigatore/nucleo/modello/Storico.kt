package com.ric.navigatore.nucleo.modello

/**
 * "Annulla" e "Ripristina": conserva le versioni precedenti di un dato.
 * Ad ogni modifica si chiama [registra] con il nuovo valore.
 */
class Storico<T>(iniziale: T, private val massimo: Int = 50) {
    private val indietro = ArrayDeque<T>()
    private val avanti = ArrayDeque<T>()

    var attuale: T = iniziale
        private set

    val puoAnnullare: Boolean get() = indietro.isNotEmpty()
    val puoRipristinare: Boolean get() = avanti.isNotEmpty()

    /** Nuovo valore: la storia "in avanti" si cancella. */
    fun registra(nuovo: T) {
        if (nuovo == attuale) return
        indietro.addLast(attuale)
        if (indietro.size > massimo) indietro.removeFirst()
        avanti.clear()
        attuale = nuovo
    }

    fun annulla(): T {
        if (indietro.isNotEmpty()) {
            avanti.addLast(attuale)
            attuale = indietro.removeLast()
        }
        return attuale
    }

    fun ripristina(): T {
        if (avanti.isNotEmpty()) {
            indietro.addLast(attuale)
            attuale = avanti.removeLast()
        }
        return attuale
    }

    /** Ricomincia da capo (es. nuovo viaggio). */
    fun azzera(valore: T) {
        indietro.clear()
        avanti.clear()
        attuale = valore
    }
}
