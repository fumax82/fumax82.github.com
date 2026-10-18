package com.ric.navigatore.mappa

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.PointF
import android.location.Location
import android.view.Gravity
import com.ric.navigatore.nucleo.geo.Geo
import com.ric.navigatore.nucleo.geo.Linea
import com.ric.navigatore.nucleo.geo.Poligono
import com.ric.navigatore.nucleo.geo.Punto
import com.ric.navigatore.nucleo.modello.EvitaArea
import com.ric.navigatore.nucleo.modello.EvitaTratto
import com.ric.navigatore.nucleo.modello.PassaArea
import com.ric.navigatore.nucleo.modello.PassaPunto
import com.ric.navigatore.nucleo.modello.PassaTratto
import com.ric.navigatore.nucleo.modello.Vincolo
import com.ric.navigatore.nucleo.strade.StradaLocale
import org.maplibre.android.camera.CameraPosition
import org.maplibre.android.camera.CameraUpdateFactory
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.geometry.LatLngBounds
import org.maplibre.android.location.LocationComponentActivationOptions
import org.maplibre.android.location.modes.CameraMode
import org.maplibre.android.location.modes.RenderMode
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.maps.Style
import org.maplibre.android.style.expressions.Expression
import org.maplibre.android.style.layers.CircleLayer
import org.maplibre.android.style.layers.FillLayer
import org.maplibre.android.style.layers.LineLayer
import org.maplibre.android.style.layers.Property
import org.maplibre.android.style.layers.PropertyFactory
import org.maplibre.android.style.layers.SymbolLayer
import org.maplibre.android.style.sources.GeoJsonSource
import org.maplibre.android.style.sources.VectorSource
import org.maplibre.geojson.Feature
import org.maplibre.geojson.FeatureCollection
import org.maplibre.geojson.LineString
import org.maplibre.geojson.MultiLineString
import org.maplibre.geojson.Point
import org.maplibre.geojson.Polygon

/**
 * Mappe usate. OpenFreeMap: gratuito, senza chiave e senza registrazione,
 * dati OpenStreetMap nello schema OpenMapTiles. Attribuzione obbligatoria
 * (la mostra MapLibre col tasto "i" in basso).
 */
object StiliMappa {
    const val GIORNO = "https://tiles.openfreemap.org/styles/liberty"
    const val NOTTE = "https://tiles.openfreemap.org/styles/dark"
}

/** Colori dei disegni sulla mappa (come richiesto: rosso, verde, blu). */
object ColoriMappa {
    const val PERCORSO = "#2F6FDE"         // blu: percorso attivo
    const val PERCORSO_BORDO = "#FFFFFF"
    const val ALTERNATIVA = "#8A94A6"      // grigio: alternative
    const val INIZIALE = "#5B6B8C"         // grigio-blu tratteggiato: percorso prima delle modifiche
    const val SCARTATO = "#B07A7A"         // percorso trovato ma non valido
    const val ESCLUSIONE = "#E5484D"       // rosso: da evitare
    const val PASSAGGIO = "#2E9E5B"        // verde: da attraversare
    const val ANTEPRIMA = "#F2A900"        // ambra: selezione in corso
    const val FERMATA = "#1F2A44"
}

/** Cosa disegnare sopra la mappa. */
data class DatiMappa(
    val percorso: Linea? = null,
    val alternative: List<Linea> = emptyList(),
    val iniziale: Linea? = null,
    val scartato: Linea? = null,
    /** Fermate: punto + etichetta ("A", "1", "2", "B"). */
    val fermate: List<Pair<Punto, String>> = emptyList(),
    val vincoli: List<Vincolo> = emptyList(),
    /** Selezione in corso (anteprima prima della conferma). */
    val anteprimaLinee: List<Linea> = emptyList(),
    val anteprimaAree: List<Poligono> = emptyList(),
    val anteprimaPunti: List<Punto> = emptyList(),
    /** Linee tratteggiate di collegamento (es. tocco → punto agganciato). */
    val anteprimaCollegamenti: List<Linea> = emptyList(),
)

/**
 * Tutto ciò che riguarda la mappa MapLibre: stile giorno/notte, disegno
 * di percorsi e vincoli, lettura delle strade per la selezione col dito,
 * posizione GPS e inquadrature.
 */
class ControlloreMappa(private val context: Context) : com.ric.navigatore.ui.LettoreMappa {
    var mappa: MapLibreMap? = null
        private set
    private var stile: Style? = null
    private var notte = false
    private var ultimiDati = DatiMappa()
    private var posizioneAttiva = false

    companion object {
        private const val S_VINCOLI_AREE = "vincoli-aree"
        private const val S_VINCOLI_LINEE = "vincoli-linee"
        private const val S_VINCOLI_PUNTI = "vincoli-punti"
        private const val S_PERCORSI = "percorsi"
        private const val S_FERMATE = "fermate"
        private const val S_ANTEPRIMA = "anteprima"

        /** Zoom minimo per scegliere una strada col dito (i tasselli hanno tutte le strade da 14 in su). */
        const val ZOOM_STRADE = 14.0
    }

    /** Collega la mappa appena pronta e carica lo stile. */
    fun collega(m: MapLibreMap, notte: Boolean, pronto: () -> Unit) {
        mappa = m
        m.uiSettings.apply {
            isCompassEnabled = true
            setCompassGravity(Gravity.TOP or Gravity.END)
            setAttributionGravity(Gravity.BOTTOM or Gravity.START)
            setLogoGravity(Gravity.BOTTOM or Gravity.START)
            isTiltGesturesEnabled = false
        }
        if (m.cameraPosition.zoom < 3) {
            // Prima apertura: inquadriamo l'Italia settentrionale
            m.cameraPosition = CameraPosition.Builder().target(LatLng(45.4064, 11.8768)).zoom(11.0).build()
        }
        caricaStile(notte, pronto)
    }

    fun cambiaTema(notte: Boolean) {
        if (notte != this.notte || stile == null) caricaStile(notte) {}
    }

    private fun caricaStile(notte: Boolean, pronto: () -> Unit) {
        this.notte = notte
        val m = mappa ?: return
        m.setStyle(Style.Builder().fromUri(if (notte) StiliMappa.NOTTE else StiliMappa.GIORNO)) { s ->
            stile = s
            aggiungiStrati(s)
            disegna(ultimiDati)
            if (posizioneAttiva) attivaPosizioneInterna(s)
            pronto()
        }
    }

    // ------------------------------------------------------------------
    // Strati di disegno
    // ------------------------------------------------------------------

    private fun aggiungiStrati(s: Style) {
        listOf(S_VINCOLI_AREE, S_VINCOLI_LINEE, S_VINCOLI_PUNTI, S_PERCORSI, S_FERMATE, S_ANTEPRIMA).forEach {
            if (s.getSource(it) == null) s.addSource(GeoJsonSource(it))
        }
        val colore = Expression.toColor(Expression.get("colore"))
        val opacita = Expression.get("opacita")
        val larghezza = Expression.get("larghezza")

        // Aree dei vincoli (riempimento + bordo)
        s.addLayer(FillLayer("vincoli-aree-riemp", S_VINCOLI_AREE).withProperties(
            PropertyFactory.fillColor(colore), PropertyFactory.fillOpacity(opacita),
        ))
        s.addLayer(LineLayer("vincoli-aree-bordo", S_VINCOLI_AREE).withProperties(
            PropertyFactory.lineColor(colore), PropertyFactory.lineWidth(2f), PropertyFactory.lineOpacity(0.9f),
        ))
        // Percorsi: alternative e iniziale sotto, attivo sopra (con bordo bianco)
        s.addLayer(LineLayer("percorsi-bordo", S_PERCORSI).withFilter(Expression.eq(Expression.get("tipo"), Expression.literal("attivo"))).withProperties(
            PropertyFactory.lineColor(ColoriMappa.PERCORSO_BORDO), PropertyFactory.lineWidth(10f),
            PropertyFactory.lineCap(Property.LINE_CAP_ROUND), PropertyFactory.lineJoin(Property.LINE_JOIN_ROUND),
        ))
        s.addLayer(LineLayer("percorsi-altri", S_PERCORSI).withFilter(Expression.neq(Expression.get("tipo"), Expression.literal("attivo"))).withProperties(
            PropertyFactory.lineColor(colore), PropertyFactory.lineWidth(5f), PropertyFactory.lineOpacity(0.85f),
            PropertyFactory.lineDasharray(arrayOf(2f, 1.5f)),
            PropertyFactory.lineCap(Property.LINE_CAP_ROUND), PropertyFactory.lineJoin(Property.LINE_JOIN_ROUND),
        ))
        s.addLayer(LineLayer("percorsi-attivo", S_PERCORSI).withFilter(Expression.eq(Expression.get("tipo"), Expression.literal("attivo"))).withProperties(
            PropertyFactory.lineColor(ColoriMappa.PERCORSO), PropertyFactory.lineWidth(6.5f),
            PropertyFactory.lineCap(Property.LINE_CAP_ROUND), PropertyFactory.lineJoin(Property.LINE_JOIN_ROUND),
        ))
        // Tratti dei vincoli (strade da evitare o da percorrere)
        s.addLayer(LineLayer("vincoli-linee", S_VINCOLI_LINEE).withProperties(
            PropertyFactory.lineColor(colore), PropertyFactory.lineWidth(larghezza), PropertyFactory.lineOpacity(opacita),
            PropertyFactory.lineCap(Property.LINE_CAP_ROUND), PropertyFactory.lineJoin(Property.LINE_JOIN_ROUND),
        ))
        // Punti dei vincoli e fermate
        s.addLayer(CircleLayer("vincoli-punti", S_VINCOLI_PUNTI).withProperties(
            PropertyFactory.circleColor(colore), PropertyFactory.circleRadius(8f), PropertyFactory.circleOpacity(opacita),
            PropertyFactory.circleStrokeColor("#FFFFFF"), PropertyFactory.circleStrokeWidth(2.5f),
        ))
        s.addLayer(CircleLayer("fermate", S_FERMATE).withProperties(
            PropertyFactory.circleColor(ColoriMappa.FERMATA), PropertyFactory.circleRadius(12f),
            PropertyFactory.circleStrokeColor("#FFFFFF"), PropertyFactory.circleStrokeWidth(3f),
        ))
        s.addLayer(SymbolLayer("fermate-testo", S_FERMATE).withProperties(
            PropertyFactory.textField(Expression.get("etichetta")), PropertyFactory.textSize(13f),
            PropertyFactory.textColor("#FFFFFF"), PropertyFactory.textFont(arrayOf("Noto Sans Regular")),
            PropertyFactory.textAllowOverlap(true), PropertyFactory.textIgnorePlacement(true),
        ))
        // Anteprima della selezione (ambra), sopra a tutto
        s.addLayer(FillLayer("anteprima-riemp", S_ANTEPRIMA).withFilter(Expression.eq(Expression.geometryType(), Expression.literal("Polygon"))).withProperties(
            PropertyFactory.fillColor(colore), PropertyFactory.fillOpacity(0.25f),
        ))
        s.addLayer(LineLayer("anteprima-linee", S_ANTEPRIMA).withFilter(Expression.neq(Expression.geometryType(), Expression.literal("Point"))).withProperties(
            PropertyFactory.lineColor(colore), PropertyFactory.lineWidth(larghezza), PropertyFactory.lineOpacity(0.95f),
            PropertyFactory.lineCap(Property.LINE_CAP_ROUND),
        ))
        s.addLayer(CircleLayer("anteprima-punti", S_ANTEPRIMA).withFilter(Expression.eq(Expression.geometryType(), Expression.literal("Point"))).withProperties(
            PropertyFactory.circleColor(colore), PropertyFactory.circleRadius(9f),
            PropertyFactory.circleStrokeColor("#FFFFFF"), PropertyFactory.circleStrokeWidth(2.5f),
        ))
    }

    // ------------------------------------------------------------------
    // Conversioni
    // ------------------------------------------------------------------

    private fun pt(p: Punto): Point = Point.fromLngLat(p.lon, p.lat)
    private fun linea(l: Linea): LineString = LineString.fromLngLats(l.map(::pt))
    private fun poligono(p: Poligono): Polygon =
        Polygon.fromLngLats((listOf(p.esterno) + p.buchi).map { anello -> (anello + anello.first()).map(::pt) })

    private fun Feature.con(colore: String, opacita: Double = 1.0, larghezza: Double = 6.0, tipo: String = ""): Feature = apply {
        addStringProperty("colore", colore)
        addNumberProperty("opacita", opacita)
        addNumberProperty("larghezza", larghezza)
        addStringProperty("tipo", tipo)
    }

    // ------------------------------------------------------------------
    // Disegno
    // ------------------------------------------------------------------

    /** Aggiorna tutto ciò che è disegnato sopra la mappa. */
    fun disegna(d: DatiMappa) {
        ultimiDati = d
        val s = stile ?: return
        if (!s.isFullyLoaded) return

        val aree = mutableListOf<Feature>()
        val linee = mutableListOf<Feature>()
        val punti = mutableListOf<Feature>()
        for (v in d.vincoli) {
            val colore = if (v.esclusione) ColoriMappa.ESCLUSIONE else ColoriMappa.PASSAGGIO
            // i vincoli disattivati restano visibili ma sbiaditi
            val k = if (v.attivo) 1.0 else 0.35
            when (v) {
                is EvitaArea -> aree += Feature.fromGeometry(poligono(v.poligono)).con(colore, 0.22 * k)
                is PassaArea -> aree += Feature.fromGeometry(poligono(v.poligono)).con(colore, 0.18 * k)
                is EvitaTratto -> {
                    // la fascia approssimata (ciò che il motore escluderà davvero) + la strada
                    v.aree().forEach { aree += Feature.fromGeometry(poligono(it)).con(colore, 0.30 * k) }
                    linee += Feature.fromGeometry(linea(v.linea)).con(colore, 0.75 * k, 7.0)
                }
                is PassaTratto -> linee += Feature.fromGeometry(linea(v.linea)).con(colore, 0.85 * k, 8.0)
                is PassaPunto -> punti += Feature.fromGeometry(pt(v.puntoUsato)).con(colore, k)
            }
        }
        s.getSourceAs<GeoJsonSource>(S_VINCOLI_AREE)?.setGeoJson(FeatureCollection.fromFeatures(aree))
        s.getSourceAs<GeoJsonSource>(S_VINCOLI_LINEE)?.setGeoJson(FeatureCollection.fromFeatures(linee))
        s.getSourceAs<GeoJsonSource>(S_VINCOLI_PUNTI)?.setGeoJson(FeatureCollection.fromFeatures(punti))

        val percorsi = mutableListOf<Feature>()
        d.iniziale?.let { percorsi += Feature.fromGeometry(linea(it)).con(ColoriMappa.INIZIALE, tipo = "iniziale") }
        d.scartato?.let { percorsi += Feature.fromGeometry(linea(it)).con(ColoriMappa.SCARTATO, tipo = "scartato") }
        d.alternative.forEach { percorsi += Feature.fromGeometry(linea(it)).con(ColoriMappa.ALTERNATIVA, tipo = "alternativa") }
        d.percorso?.let { percorsi += Feature.fromGeometry(linea(it)).con(ColoriMappa.PERCORSO, tipo = "attivo") }
        s.getSourceAs<GeoJsonSource>(S_PERCORSI)?.setGeoJson(FeatureCollection.fromFeatures(percorsi))

        s.getSourceAs<GeoJsonSource>(S_FERMATE)?.setGeoJson(
            FeatureCollection.fromFeatures(d.fermate.map { (p, etichetta) -> Feature.fromGeometry(pt(p)).apply { addStringProperty("etichetta", etichetta) } }),
        )

        val ant = mutableListOf<Feature>()
        d.anteprimaAree.forEach { ant += Feature.fromGeometry(poligono(it)).con(ColoriMappa.ANTEPRIMA, larghezza = 2.0) }
        d.anteprimaLinee.forEach { if (it.size >= 2) ant += Feature.fromGeometry(linea(it)).con(ColoriMappa.ANTEPRIMA, larghezza = 9.0) }
        d.anteprimaCollegamenti.forEach { if (it.size >= 2) ant += Feature.fromGeometry(linea(it)).con("#6B7280", larghezza = 2.0) }
        d.anteprimaPunti.forEach { ant += Feature.fromGeometry(pt(it)).con(ColoriMappa.ANTEPRIMA) }
        s.getSourceAs<GeoJsonSource>(S_ANTEPRIMA)?.setGeoJson(FeatureCollection.fromFeatures(ant))
    }

    // ------------------------------------------------------------------
    // Lettura delle strade dai tasselli della mappa (nessuna richiesta in rete)
    // ------------------------------------------------------------------

    /** Metri rappresentati da un pixel, al centro della mappa. */
    override fun metriPerPixel(): Double {
        val m = mappa ?: return 1.0
        return m.projection.getMetersPerPixelAtLatitude(m.cameraPosition.target?.latitude ?: 45.0)
    }

    override fun zoom(): Double = mappa?.cameraPosition?.zoom ?: 0.0

    override fun centroMappa(): Punto? = mappa?.cameraPosition?.target?.let { Punto(it.latitude, it.longitude) }

    /**
     * Strade (tasselli già caricati) entro [raggioMetri] dal punto.
     * Restituisce lista vuota se lo zoom è troppo basso (strade minori assenti).
     */
    override fun leggiStrade(centro: Punto, raggioMetri: Double): List<StradaLocale> {
        val s = stile ?: return emptyList()
        val sorgenti = s.sources.filterIsInstance<VectorSource>()
        val strade = mutableListOf<StradaLocale>()
        val nomi = IndiceNomi()
        for (src in sorgenti) {
            val fNomi = try { src.querySourceFeatures(arrayOf("transportation_name"), null) } catch (e: Exception) { emptyList() }
            for (f in fNomi) {
                val nome = f.getStringProperty("name") ?: continue
                val classe = f.getStringProperty("class") ?: ""
                lineeDi(f).forEach { l -> nomi.aggiungi(l, nome, classe) }
            }
            val fStrade = try { src.querySourceFeatures(arrayOf("transportation"), null) } catch (e: Exception) { emptyList() }
            fStrade.forEachIndexed { i, f ->
                val classe = f.getStringProperty("class") ?: return@forEachIndexed
                val sensoUnico = (f.getProperty("oneway")?.takeIf { it.isJsonPrimitive }?.asJsonPrimitive?.let {
                    if (it.isNumber) it.asInt else it.asString.toIntOrNull()
                }) ?: 0
                val brunnel = f.getStringProperty("brunnel") ?: ""
                lineeDi(f).forEachIndexed { k, l ->
                    // teniamo solo i pezzi vicini al punto
                    if (l.any { Geo.distanza(it, centro) < raggioMetri } || Geo.proietta(l, centro).distanza < raggioMetri) {
                        strade += StradaLocale("${src.id}-$i-$k", l, "", classe, sensoUnico, brunnel)
                    }
                }
            }
        }
        // assegniamo i nomi (dallo strato "transportation_name")
        return strade.map { it.copy(nome = nomi.nomePer(it.linea, it.classe)) }
    }

    private fun lineeDi(f: Feature): List<Linea> = when (val g = f.geometry()) {
        is LineString -> listOf(g.coordinates().map { Punto(it.latitude(), it.longitude()) })
        is MultiLineString -> g.coordinates().map { l -> l.map { Punto(it.latitude(), it.longitude()) } }
        else -> emptyList()
    }.filter { it.size >= 2 }

    /** Tocco sullo schermo vicino al percorso? Restituisce il punto della mappa corrispondente. */
    fun punto(schermo: PointF): Punto? = mappa?.projection?.fromScreenLocation(schermo)?.let { Punto(it.latitude, it.longitude) }

    // ------------------------------------------------------------------
    // Inquadrature
    // ------------------------------------------------------------------

    fun inquadra(punti: List<Punto>, margine: Int = 160) {
        val m = mappa ?: return
        if (punti.isEmpty()) return
        if (punti.size == 1 || punti.all { Geo.distanza(it, punti.first()) < 30 }) {
            centra(punti.first(), 16.0); return
        }
        val b = LatLngBounds.Builder()
        punti.forEach { b.include(LatLng(it.lat, it.lon)) }
        m.animateCamera(CameraUpdateFactory.newLatLngBounds(b.build(), margine, margine, margine, margine * 2), 700)
    }

    fun centra(p: Punto, zoom: Double? = null) {
        val m = mappa ?: return
        val z = zoom ?: m.cameraPosition.zoom
        m.animateCamera(CameraUpdateFactory.newLatLngZoom(LatLng(p.lat, p.lon), z), 600)
    }

    // ------------------------------------------------------------------
    // Posizione GPS
    // ------------------------------------------------------------------

    /** Mostra il segnaposto della posizione (alimentato dalle nostre letture GPS). */
    fun attivaPosizione() {
        posizioneAttiva = true
        stile?.let { attivaPosizioneInterna(it) }
    }

    @SuppressLint("MissingPermission")
    private fun attivaPosizioneInterna(s: Style) {
        val m = mappa ?: return
        try {
            m.locationComponent.activateLocationComponent(
                LocationComponentActivationOptions.Builder(context, s).useDefaultLocationEngine(false).build(),
            )
            m.locationComponent.isLocationComponentEnabled = true
            m.locationComponent.renderMode = RenderMode.COMPASS
        } catch (e: Exception) {
            // permesso non ancora concesso: riproveremo
        }
    }

    fun aggiornaPosizione(l: Location) {
        val m = mappa ?: return
        try {
            if (m.locationComponent.isLocationComponentActivated) m.locationComponent.forceLocationUpdate(l)
        } catch (_: Exception) {
        }
    }

    /** Durante la guida la mappa segue l'auto, ruotata nel senso di marcia o con il nord in alto. */
    fun modalitaGuida(attiva: Boolean, orientata: Boolean) {
        val m = mappa ?: return
        try {
            if (!m.locationComponent.isLocationComponentActivated) return
            if (attiva) {
                m.locationComponent.renderMode = RenderMode.GPS
                m.locationComponent.cameraMode = if (orientata) CameraMode.TRACKING_GPS else CameraMode.TRACKING_GPS_NORTH
                m.locationComponent.zoomWhileTracking(16.5)
                if (orientata) m.locationComponent.tiltWhileTracking(35.0) else m.locationComponent.tiltWhileTracking(0.0)
            } else {
                m.locationComponent.cameraMode = CameraMode.NONE
                m.locationComponent.renderMode = RenderMode.COMPASS
                m.animateCamera(CameraUpdateFactory.tiltTo(0.0))
            }
        } catch (_: Exception) {
        }
    }

    /** "Ricentra": torna a seguire la posizione. */
    fun ricentra(guida: Boolean, orientata: Boolean, posizione: Punto?) {
        if (guida) modalitaGuida(true, orientata) else posizione?.let { centra(it, maxOf(zoom(), 15.0)) }
    }
}

/**
 * Indice veloce per dare un nome ai pezzi di strada: i nomi stanno in uno
 * strato separato della mappa ("transportation_name"). Dividiamo la zona in
 * celle di circa 30 m e cerchiamo il nome più frequente vicino al pezzo.
 */
private class IndiceNomi {
    private val celle = HashMap<Long, MutableList<Pair<String, String>>>()
    private fun cella(p: Punto): Long = (Math.floor(p.lat / 0.0003).toLong() shl 32) xor (Math.floor(p.lon / 0.0004).toLong() and 0xffffffffL)

    fun aggiungi(l: Linea, nome: String, classe: String) {
        Geo.campiona(l, 20.0).forEach { celle.getOrPut(cella(it)) { mutableListOf() } += nome to classe }
    }

    fun nomePer(l: Linea, classe: String): String {
        val conteggio = HashMap<String, Int>()
        Geo.campiona(l, 20.0).forEach { p ->
            celle[cella(p)]?.forEach { (n, c) -> if (c == classe || c.isEmpty()) conteggio[n] = (conteggio[n] ?: 0) + 1 }
        }
        return conteggio.maxByOrNull { it.value }?.key ?: ""
    }
}
