package app.kalend;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.util.Locale;

/**
 * WIDGET PICCOLO "PROSSIMO EVENTO" (layout widget_next).
 *
 * Mostra una sola cosa: il prossimo evento delle prossime 36 ore (titolo, orario, luogo, "fra 20 min"),
 * con una barretta laterale del colore dell'evento sopra lo stesso sfondo-cielo del widget grande.
 * Se non c'è nulla mostra il meteo e il testo "nessun evento".
 *
 * Riusa quasi tutto da KalendWidget: data() per il JSON, nextEvent() per la scelta dell'evento,
 * rel() per il tempo relativo, nightVeil() per il tema scuro e tick() per l'aggiornamento periodico.
 * KalendWidget.updateAll chiama {@link #updateAll(Context)}.
 */
public class KalendNextWidget extends AppWidgetProvider {
    /** dimensioni minime (dp) considerate e valori di ripiego se il launcher non le comunica */
    static final int MIN_W = 110;
    static final int MIN_H = 40;
    static final int DEFAULT_W = 180;
    static final int DEFAULT_H = 80;
    /** lato massimo (px) dello sfondo */
    static final float MAX_BG_PX = 700f;
    /** altezza (dp) da cui si mostra anche il luogo */
    static final int MIN_H_LOC = 70;
    /** request code del tocco (sommato all'id) */
    static final int RC_OPEN = 8000;
    /** colore della barretta se quello dell'evento non è valido */
    static final int COL_DEFAULT = 0xFF2AABB8;

    /** minuti dalla mezzanotte → "09:05" */
    static String hm(int min) {
        return String.format(Locale.ROOT, "%02d:%02d", (min / 60) % 24, min % 60);
    }

    /** disegna il widget id */
    static void render(Context c, AppWidgetManager mgr, int id) {
        try {
            Bundle opt = mgr.getAppWidgetOptions(id);
            int w = Math.max(MIN_W, opt.getInt("appWidgetMinWidth", DEFAULT_W));
            int h = Math.max(MIN_H, opt.getInt("appWidgetMaxHeight", DEFAULT_H));
            float density = c.getResources().getDisplayMetrics().density;
            float scale = density * Math.min(1f, MAX_BG_PX / (Math.max(w, h) * density));
            JSONObject data = KalendWidget.data(c);
            int bw = Math.round(w * scale);
            int bh = Math.round(h * scale);
            JSONObject safe = data == null ? new JSONObject() : data;
            Bitmap bg = SkyPainter.paintBackground(bw, bh, scale, safe, System.currentTimeMillis());
            KalendWidget.nightVeil(c, bg);

            RemoteViews rv = new RemoteViews(c.getPackageName(), R.layout.widget_next);
            rv.setImageViewBitmap(R.id.n_img, bg);
            JSONObject s = data == null ? null : data.optJSONObject("s");
            JSONObject nx = KalendWidget.nextEvent(data);
            Intent openApp = new Intent(c, MainActivity.class).addFlags(KalendWidget.OPEN_FLAGS);

            if (nx != null) {
                openApp.putExtra("date", nx.optString("k"));
                // riga piccola in alto: "PROSSIMO  ·  ⏱ FRA 20 MIN"
                String kicker = (s == null ? "" : s.optString("next", "")) + "  ·  ⏱ " + KalendWidget.rel(s, nx.optLong("at"));
                rv.setTextViewText(R.id.n_kicker, kicker.toUpperCase(Locale.getDefault()));
                rv.setTextViewText(R.id.n_title, nx.optString("t"));
                rv.setTextViewText(R.id.n_time, hm(nx.optInt("s")) + " – " + hm(nx.optInt("e")));
                String loc = nx.optString("l");
                rv.setTextViewText(R.id.n_loc, "📍 " + loc);
                rv.setViewVisibility(R.id.n_loc, loc.isEmpty() ? View.GONE : (h >= MIN_H_LOC ? View.VISIBLE : View.GONE));
                int col;
                try {
                    col = Color.parseColor(nx.optString("c", "#2AABB8"));
                } catch (Exception e) {
                    col = COL_DEFAULT;
                }
                rv.setInt(R.id.n_bar, "setBackgroundColor", col);
            } else {
                // nessun evento: meteo (o "Kalend") e testo "nessun evento"
                String title = (data == null || data.optString("wx").length() <= 0) ? "Kalend" : data.optString("wx");
                rv.setTextViewText(R.id.n_kicker, title);
                String none = data != null ? (s == null ? "" : s.optString("none", "")) : c.getString(R.string.widget_open_app);
                rv.setTextViewText(R.id.n_title, none);
                rv.setTextViewText(R.id.n_time, "");
                rv.setViewVisibility(R.id.n_loc, View.GONE);
                rv.setInt(R.id.n_bar, "setBackgroundColor", Color.argb(120, 255, 255, 255));
            }
            rv.setOnClickPendingIntent(R.id.n_root, PendingIntent.getActivity(c, id + RC_OPEN, openApp, KalendWidget.PI_FLAGS));
            mgr.updateAppWidget(id, rv);
        } catch (Exception ignored) {
        }
    }

    /** ridisegna tutti i widget di questo tipo */
    static void updateAll(Context c) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(c);
        for (int id : mgr.getAppWidgetIds(new ComponentName(c, KalendNextWidget.class))) render(c, mgr, id);
    }

    @Override
    public void onUpdate(Context c, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) render(c, mgr, id);
        KalendWidget.tick(c);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager mgr, int id, Bundle opts) {
        render(c, mgr, id);
    }

    @Override public void onEnabled(Context c) { KalendWidget.tick(c); }
    @Override public void onDisabled(Context c) { KalendWidget.tick(c); }
}
