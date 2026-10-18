package com.ric.navigatore.guida

import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Looper
import com.ric.navigatore.nucleo.geo.Punto
import com.ric.navigatore.nucleo.navigazione.Rilevamento

/** Da posizione Android a [Rilevamento] del nucleo. */
fun Location.comeRilevamento(): Rilevamento = Rilevamento(
    punto = Punto(latitude, longitude),
    accuratezza = if (hasAccuracy()) accuracy.toDouble() else 50.0,
    velocita = if (hasSpeed()) speed.toDouble() else null,
    // la direzione GPS ha senso solo in movimento
    direzione = if (hasBearing() && hasSpeed() && speed > 1f) bearing.toDouble() else null,
    tempo = System.currentTimeMillis(),
)

/**
 * Posizione per la PIANIFICAZIONE (la guida usa [ServizioGuida]).
 * Usa direttamente il GPS del telefono (LocationManager), senza i servizi Google.
 */
class Posizione(private val context: Context, private val alCambio: (Location) -> Unit) {
    private val lm = context.getSystemService(LocationManager::class.java)
    private var attiva = false

    private val ascoltatore = LocationListener { l -> alCambio(l) }

    fun permessoConcesso(): Boolean =
        context.checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            context.checkSelfPermission(android.Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

    /** Vero se il GPS (o la localizzazione) del telefono è acceso. */
    fun localizzazioneAccesa(): Boolean = lm.isProviderEnabled(LocationManager.GPS_PROVIDER) || lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)

    @SuppressLint("MissingPermission")
    fun avvia() {
        if (attiva || !permessoConcesso()) return
        attiva = true
        // l'ultima posizione nota, per mostrare subito qualcosa
        listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
            .mapNotNull { runCatching { lm.getLastKnownLocation(it) }.getOrNull() }
            .maxByOrNull { it.time }?.let(alCambio)
        for (p in listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)) {
            if (runCatching { lm.isProviderEnabled(p) }.getOrDefault(false)) {
                lm.requestLocationUpdates(p, 3000L, 5f, ascoltatore, Looper.getMainLooper())
            }
        }
    }

    fun ferma() {
        if (!attiva) return
        attiva = false
        lm.removeUpdates(ascoltatore)
    }
}
