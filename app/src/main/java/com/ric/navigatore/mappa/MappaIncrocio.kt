package com.ric.navigatore.mappa

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import com.ric.navigatore.nucleo.geo.Geo
import com.ric.navigatore.nucleo.geo.Punto
import com.ric.navigatore.nucleo.navigazione.GeometriaAnteprima
import org.maplibre.android.camera.CameraPosition
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.maps.Style
import org.maplibre.android.style.expressions.Expression
import org.maplibre.android.style.layers.CircleLayer
import org.maplibre.android.style.layers.LineLayer
import org.maplibre.android.style.layers.Property
import org.maplibre.android.style.layers.PropertyFactory
import org.maplibre.android.style.layers.SymbolLayer
import org.maplibre.android.style.sources.GeoJsonSource
import org.maplibre.geojson.Feature
import org.maplibre.geojson.FeatureCollection
import org.maplibre.geojson.LineString
import org.maplibre.geojson.Point

/**
 * La piccola mappa dell'anteprima di un incrocio.
 *
 * È una mappa VERA (gli stessi dati OpenStreetMap della mappa principale),
 * disegnata in modo schematico: solo strade, acqua e nomi delle strade,
 * ruotata in modo che la direzione da cui si arriva sia in alto.
 * Il percorso è disegnato con lo stesso blu della mappa principale e
 * termina con una freccia dopo la manovra.
 *
 * Così la forma dell'incrocio (bivio, incrocio a quattro vie, rotatoria
 * con le sue uscite, rampa d'uscita) è quella reale della mappa, non un
 * disegno inventato. Le corsie NON sono disegnate: i dati gratuiti usati
 * non le contengono.
 */
class MappaIncrocio {
    private var mappa: MapLibreMap? = null
    private var stile: Style? = null
    private var geometria: GeometriaAnteprima? = null
    private var auto: Punto? = null
    /** Vero quando l'incrocio attuale è già stato disegnato sulla mappa (a stile caricato). */
    private var disegnato = false

    companion object {
        private const val S_PERCORSO = "incrocio-percorso"
        private const val S_FRECCIA = "incrocio-freccia"
        private const val S_AUTO = "incrocio-auto"
        private const val IMG_FRECCIA = "freccia-percorso"
    }

    /** Collega la mappa appena pronta e carica lo stile schematico. */
    fun collega(m: MapLibreMap, notte: Boolean) {
        mappa = m
        m.uiSettings.apply {
            // vista fissa: niente rotazione o inclinazione col dito (lo zoom con due dita resta)
            isRotateGesturesEnabled = false
            isTiltGesturesEnabled = false
            isScrollGesturesEnabled = false
            isCompassEnabled = false
            isLogoEnabled = false
        }
        m.setStyle(Style.Builder().fromJson(StiliMappa.schema(notte))) { s ->
            stile = s
            prepara(s)
            disegnato = false
            geometria?.let { mostra(it, auto) }
        }
    }

    /** Mostra l'incrocio [g]; [posizione] è dove si trova l'auto (se vicina). */
    fun mostra(g: GeometriaAnteprima, posizione: Punto?) {
        if (g != geometria) disegnato = false
        geometria = g
        auto = posizione
        // se lo stile non è ancora pronto, l'incrocio verrà disegnato appena lo è
        val s = stile ?: return
        val m = mappa ?: return
        if (!disegnato) {
            disegnato = true
            (s.getSource(S_PERCORSO) as? GeoJsonSource)?.setGeoJson(FeatureCollection.fromFeatures(listOf(
                Feature.fromGeometry(LineString.fromLngLats(g.prima.map(::pt))),
                Feature.fromGeometry(LineString.fromLngLats(g.dopo.map(::pt))),
            )))
            // freccia alla fine del pezzo "dopo", orientata come l'ultimo tratto
            val fine = g.dopo.last()
            val primaDellaFine = g.dopo.getOrNull(g.dopo.size - 2) ?: g.centro
            val freccia = Feature.fromGeometry(pt(fine)).apply { addNumberProperty("dir", Geo.direzione(primaDellaFine, fine)) }
            (s.getSource(S_FRECCIA) as? GeoJsonSource)?.setGeoJson(FeatureCollection.fromFeatures(listOf(freccia)))
            m.cameraPosition = CameraPosition.Builder()
                .target(LatLng(g.centro.lat, g.centro.lon))
                .zoom(g.zoom)
                .bearing(g.direzioneArrivo)
                .tilt(40.0)
                .build()
        }
        val features = posizione?.let { listOf(Feature.fromGeometry(pt(it))) } ?: emptyList()
        (s.getSource(S_AUTO) as? GeoJsonSource)?.setGeoJson(FeatureCollection.fromFeatures(features))
    }

    private fun prepara(s: Style) {
        listOf(S_PERCORSO, S_FRECCIA, S_AUTO).forEach { if (s.getSource(it) == null) s.addSource(GeoJsonSource(it)) }
        s.addImage(IMG_FRECCIA, frecciaBitmap())
        // percorso: bordo bianco + blu, come sulla mappa principale (ma più spesso)
        s.addLayer(LineLayer("incrocio-percorso-bordo", S_PERCORSO).withProperties(
            PropertyFactory.lineColor(ColoriMappa.PERCORSO_BORDO), PropertyFactory.lineWidth(15f),
            PropertyFactory.lineCap(Property.LINE_CAP_ROUND), PropertyFactory.lineJoin(Property.LINE_JOIN_ROUND),
        ))
        s.addLayer(LineLayer("incrocio-percorso", S_PERCORSO).withProperties(
            PropertyFactory.lineColor(ColoriMappa.PERCORSO), PropertyFactory.lineWidth(10f),
            PropertyFactory.lineCap(Property.LINE_CAP_ROUND), PropertyFactory.lineJoin(Property.LINE_JOIN_ROUND),
        ))
        s.addLayer(SymbolLayer("incrocio-freccia", S_FRECCIA).withProperties(
            PropertyFactory.iconImage(IMG_FRECCIA),
            PropertyFactory.iconRotate(Expression.get("dir")),
            PropertyFactory.iconRotationAlignment(Property.ICON_ROTATION_ALIGNMENT_MAP),
            PropertyFactory.iconPitchAlignment(Property.ICON_PITCH_ALIGNMENT_MAP),
            PropertyFactory.iconAllowOverlap(true), PropertyFactory.iconIgnorePlacement(true),
        ))
        s.addLayer(CircleLayer("incrocio-auto", S_AUTO).withProperties(
            PropertyFactory.circleColor(ColoriMappa.FERMATA), PropertyFactory.circleRadius(8f),
            PropertyFactory.circleStrokeColor("#FFFFFF"), PropertyFactory.circleStrokeWidth(3f),
            PropertyFactory.circlePitchAlignment(Property.CIRCLE_PITCH_ALIGNMENT_MAP),
        ))
    }

    /** Punta di freccia (verso il nord: la mappa la ruota) nello stesso blu del percorso. */
    private fun frecciaBitmap(): Bitmap {
        val lato = 72
        val b = Bitmap.createBitmap(lato, lato, Bitmap.Config.ARGB_8888)
        val c = Canvas(b)
        val forma = Path().apply {
            moveTo(lato / 2f, 4f)
            lineTo(lato - 6f, lato - 10f)
            lineTo(lato / 2f, lato - 24f)
            lineTo(6f, lato - 10f)
            close()
        }
        c.drawPath(forma, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE; style = Paint.Style.STROKE; strokeWidth = 8f; strokeJoin = Paint.Join.ROUND })
        c.drawPath(forma, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.parseColor(ColoriMappa.PERCORSO); style = Paint.Style.FILL })
        return b
    }

    private fun pt(p: Punto): Point = Point.fromLngLat(p.lon, p.lat)
}
