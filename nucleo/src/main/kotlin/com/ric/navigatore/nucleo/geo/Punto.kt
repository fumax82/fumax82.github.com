package com.ric.navigatore.nucleo.geo

import kotlinx.serialization.Serializable

/**
 * Un punto sulla Terra, in gradi decimali.
 *
 * ATTENZIONE all'ordine: qui scriviamo (latitudine, longitudine) come si
 * fa a voce, ma i servizi web in formato GeoJSON vogliono [lon, lat].
 * La conversione avviene in un solo posto (ors/JsonOrs.kt) per evitare errori.
 */
@Serializable
data class Punto(val lat: Double, val lon: Double) {
    override fun toString(): String = "%.6f, %.6f".format(java.util.Locale.ROOT, lat, lon)
}

/** Una linea fatta di punti in sequenza (una strada, un percorso…). */
typealias Linea = List<Punto>

/** Un'area chiusa: elenco dei vertici del bordo (il primo NON va ripetuto in fondo). */
typealias Anello = List<Punto>
