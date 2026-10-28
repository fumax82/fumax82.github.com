package app.kalend;

import android.content.Context;
import android.location.Address;
import android.location.Geocoder;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.List;
import java.util.Locale;

/**
 * RICERCA LUOGHI con il Geocoder di Android (novità v55).
 *
 * Perché: la pagina cerca i luoghi prima nella sua memoria e nell'atlante
 * offline; quando non basta, invece di interrogare un servizio web scelto
 * dall'app, chiede al TELEFONO. Il Geocoder usa il servizio di geocodifica
 * installato sul dispositivo (su Android con Google Play è Google, altrove
 * quello del produttore): il rapporto contrattuale è fra l'utente e il suo
 * telefono, non con l'app. Se il dispositivo non ha un geocoder (Android
 * senza Play Services), lookup() risponde con una lista vuota e la pagina
 * passa allo strato successivo.
 *
 * Risposta: [{name, display, lat, lon, country, admin, cc}] (al massimo 6
 * risultati): "display" è la riga completa "Città, Regione, Paese" che la
 * pagina mostra nell'elenco (vedi nativeGeocode in 80-geo.js).
 */
final class Geo {
    private Geo() {}

    private static final int MAX_RESULTS = 6;

    static String lookup(Context c, String text, String lang) throws Exception {
        JSONArray out = new JSONArray();
        if (text == null || text.trim().length() < 2 || text.length() > 120) return out.toString();
        if (!Geocoder.isPresent()) return out.toString();
        Locale loc = (lang == null || lang.isEmpty()) ? Locale.getDefault() : Locale.forLanguageTag(lang);
        Geocoder g = new Geocoder(c, loc);
        @SuppressWarnings("deprecation")
        List<Address> res = g.getFromLocationName(text.trim(), MAX_RESULTS);   // bloccante: viene chiamata da un thread di servizio
        if (res == null) return out.toString();
        for (Address a : res) {
            if (!a.hasLatitude() || !a.hasLongitude()) continue;
            JSONObject o = new JSONObject();
            String name = a.getLocality() != null ? a.getLocality()
                    : a.getSubAdminArea() != null ? a.getSubAdminArea()
                    : a.getFeatureName() != null ? a.getFeatureName() : text.trim();
            o.put("name", name);
            StringBuilder disp = new StringBuilder(name);
            if (a.getAdminArea() != null && !a.getAdminArea().equals(name)) disp.append(", ").append(a.getAdminArea());
            if (a.getCountryName() != null) disp.append(", ").append(a.getCountryName());
            o.put("display", disp.toString());
            o.put("lat", Math.round(a.getLatitude() * 10000) / 10000.0);
            o.put("lon", Math.round(a.getLongitude() * 10000) / 10000.0);
            o.put("country", a.getCountryName() == null ? "" : a.getCountryName());
            o.put("admin", a.getAdminArea() == null ? "" : a.getAdminArea());
            o.put("cc", a.getCountryCode() == null ? "" : a.getCountryCode());
            out.put(o);
        }
        return out.toString();
    }
}
