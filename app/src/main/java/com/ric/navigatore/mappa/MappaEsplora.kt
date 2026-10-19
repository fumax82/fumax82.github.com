package com.ric.navigatore.mappa

import com.ric.navigatore.nucleo.geo.Linea
import com.ric.navigatore.nucleo.geo.Punto
import org.maplibre.android.camera.CameraPosition
import org.maplibre.android.camera.CameraUpdateFactory
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.geometry.LatLngBounds
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.maps.Style
import org.maplibre.android.style.layers.LineLayer
import org.maplibre.android.style.layers.Property
import org.maplibre.android.style.layers.PropertyFactory
import org.maplibre.android.style.sources.GeoJsonSource
import org.maplibre.geojson.Feature
import org.maplibre.geojson.LineString
import org.maplibre.geojson.Point

/**
 * La piccola mappa della finestra "Esplora il percorso".
 *
 * Durante la guida la mappa grande resta SEMPRE centrata sulla posizione
 * GPS: il punto cercato (col cursore o a voce) si guarda qui. Questa mappa
 * si può spostare e ingrandire col dito; il mirino al centro indica il
 * punto usato da «Evita la zona» e «Passa da qui».
 */
class MappaEsplora {
    private var mappa: MapLibreMap? = null
    private var stile: Style? = null
    private var percorso: Linea? = null
    private var centro: Punto? = null

    companion object {
        private const val S_PERCORSO = "esplora-percorso"
        const val ZOOM = 15.5
    }

    fun collega(m: MapLibreMap, notte: Boolean) {
        mappa = m
        m.uiSettings.apply {
            isRotateGesturesEnabled = false
            isTiltGesturesEnabled = false
            isCompassEnabled = false
            isLogoEnabled = false
        }
        m.setStyle(Style.Builder().fromUri(if (notte) StiliMappa.NOTTE else StiliMappa.GIORNO)) { s ->
            stile = s
            s.addSource(GeoJsonSource(S_PERCORSO))
            s.addLayer(LineLayer("esplora-percorso-bordo", S_PERCORSO).withProperties(
                PropertyFactory.lineColor(ColoriMappa.PERCORSO_BORDO), PropertyFactory.lineWidth(9f),
                PropertyFactory.lineCap(Property.LINE_CAP_ROUND), PropertyFactory.lineJoin(Property.LINE_JOIN_ROUND),
            ))
            s.addLayer(LineLayer("esplora-percorso", S_PERCORSO).withProperties(
                PropertyFactory.lineColor(ColoriMappa.PERCORSO), PropertyFactory.lineWidth(6f),
                PropertyFactory.lineCap(Property.LINE_CAP_ROUND), PropertyFactory.lineJoin(Property.LINE_JOIN_ROUND),
            ))
            percorso?.let(::disegnaPercorso)
            centro?.let { m.cameraPosition = CameraPosition.Builder().target(LatLng(it.lat, it.lon)).zoom(ZOOM).build() }
        }
    }

    /** Il percorso da disegnare (in blu, come sulla mappa grande). */
    fun percorso(l: Linea) {
        if (l == percorso) return
        percorso = l
        if (stile != null) disegnaPercorso(l)
    }

    /** Porta la piccola mappa sul punto [p]. */
    fun vaiA(p: Punto) {
        centro = p
        val m = mappa ?: return
        if (stile == null) return
        m.animateCamera(CameraUpdateFactory.newLatLngZoom(LatLng(p.lat, p.lon), maxOf(m.cameraPosition.zoom, ZOOM)), 400)
    }

    /** Inquadra tutta la linea [l] (es. la parte di percorso che resta). */
    fun inquadra(l: Linea) {
        val m = mappa ?: return
        if (l.size < 2) return
        val b = LatLngBounds.Builder().apply { l.forEach { include(LatLng(it.lat, it.lon)) } }.build()
        m.animateCamera(CameraUpdateFactory.newLatLngBounds(b, 40), 500)
    }

    /** Il punto sotto il mirino (centro della piccola mappa). */
    fun puntoAlCentro(): Punto? = mappa?.cameraPosition?.target?.let { Punto(it.latitude, it.longitude) }

    private fun disegnaPercorso(l: Linea) {
        (stile?.getSource(S_PERCORSO) as? GeoJsonSource)?.setGeoJson(
            Feature.fromGeometry(LineString.fromLngLats(l.map { Point.fromLngLat(it.lon, it.lat) })),
        )
    }
}
