package app.kalend;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * WIDGET PRINCIPALE DI KALEND (quello grande nella schermata iniziale).
 *
 * Non legge il calendario da solo: la pagina web (MainActivity) salva nelle SharedPreferences "kalend",
 * sotto la chiave "widget", un JSON con gli eventi dei prossimi mesi, i nomi dei giorni e dei mesi,
 * il meteo e i testi tradotti. Questa classe lo legge con {@link #data(Context)} e lo disegna.
 *
 * Ogni widget ha una MODALITÀ (prefs "w_mode_<id>"): "agenda" (lista eventi), "month" (griglia del mese),
 * "stats" (statistiche, disegnate da WidgetStats) e "lists" (liste di cose da fare, WidgetLists); il pulsante
 * ▦ le fa ruotare. Lo SPOSTAMENTO (prefs "w_off_<id>") sono le settimane (agenda) o i mesi (mese) di cui si è
 * sfogliato avanti o indietro.
 *
 * Lo sfondo è un'immagine del cielo (sole, luna, nuvole) dipinta da SkyPainter alle dimensioni del widget;
 * in tema scuro viene velata ({@link #nightVeil}). Le righe della lista le fornisce WidgetService.
 *
 * Collegamenti: MainActivity e Reminders chiamano {@link #updateAll(Context)} quando i dati cambiano;
 * WidgetFilterActivity e WidgetPreviewActivity usano prefs/mode/offset/render/paintMusic;
 * KalendNextWidget riusa data/nextEvent/rel/nightVeil/tick.
 */
public class KalendWidget extends AppWidgetProvider {
    /** azioni dei pulsanti del widget (arrivano in onReceive) */
    static final String A_MODE = "app.kalend.W_MODE";    // ruota la modalità
    static final String A_MUSIC = "app.kalend.W_MUSIC";  // accende/spegne la musica del prossimo evento
    static final String A_NEXT = "app.kalend.W_NEXT";    // settimana/mese successivo
    static final String A_PICK = "app.kalend.W_PICK";    // (riservata: nessuna azione)
    static final String A_PREV = "app.kalend.W_PREV";    // settimana/mese precedente
    static final String A_TICK = "app.kalend.W_TICK";    // aggiornamento periodico dell'AlarmManager
    /** azioni definite da WidgetLists (stessi valori di WidgetLists.A_LISTS / A_LTOG) */
    static final String A_LISTS = "app.kalend.W_LISTS";  // passa alla modalità liste
    static final String A_LTOG = "app.kalend.W_LTOG";    // spunta una voce di una lista
    /** preferenza: musica del widget accesa */
    static final String SND = "wp_snd";

    /** nome del file delle SharedPreferences condiviso con la pagina web */
    static final String PREFS = "kalend";

    /** basi dei request code dei PendingIntent (si sommano all'id del widget per renderli unici) */
    static final int RC_MODE = 3000;
    static final int RC_MUSIC = 3500;
    static final int RC_ADD = 4000;
    static final int RC_TITLE = 5000;
    static final int RC_EMPTY = 6000;
    static final int RC_STATS = 6100;
    static final int RC_LIST_MONTH = 7000;
    static final int RC_LIST_AGENDA = 7600;
    static final int RC_FILTER = 8000;
    static final int RC_TICK = 9999;

    /** intervallo dell'aggiornamento periodico (15 minuti) e distanza minima fra due tick (20 s) */
    static final long TICK_MS = 900_000L;
    static final long TICK_MIN_GAP_MS = 20_000L;
    /** il prossimo evento compare nel titolo se inizia entro 12 ore */
    static final long NEXT_IN_TITLE_MS = 43_200_000L;
    /** nextEvent cerca solo nelle prossime 36 ore */
    static final long NEXT_WINDOW_MS = 129_600_000L;

    /** dimensioni (dp) di ripiego se il launcher non comunica quelle del widget */
    static final int DEFAULT_W = 250;
    static final int DEFAULT_H = 180;
    /** lato massimo (px) dell'immagine di sfondo */
    static final float MAX_BG_PX = 900f;
    /** soglie di larghezza (dp) sotto le quali si nascondono i pulsanti */
    static final int MIN_W_MODE = 180;
    static final int MIN_W_MUSIC = 230;
    static final int MIN_W_FILTER = 250;
    /** altezza (dp) sotto la quale il widget è "compatto" (niente pulsante modalità) */
    static final int MIN_H_FULL = 110;

    /** colori */
    static final int COL_MUSIC_OFF = 0x8CFFFFFF;

    /** flag standard dei PendingIntent/Intent usati nel widget */
    static final int PI_FLAGS = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
    static final int OPEN_FLAGS = Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP;

    /** ultimo layout applicato a ogni widget: se non cambia basta un aggiornamento parziale */
    private static final Map<Integer, Integer> LAY = new HashMap<>();
    private static long lastTick;

    // ------------------------------------------------------------------ preferenze e dati

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** il JSON "widget" salvato dalla pagina, o null se manca o non è valido */
    static JSONObject data(Context c) {
        try {
            String s = prefs(c).getString("widget", null);
            return s != null ? new JSONObject(s) : null;
        } catch (Exception e) {
            return null;
        }
    }

    static String mode(Context c, int id) {
        return prefs(c).getString("w_mode_" + id, "agenda");
    }

    static int offset(Context c, int id) {
        return prefs(c).getInt("w_off_" + id, 0);
    }

    static boolean soundOn(Context c) {
        return prefs(c).getBoolean(SND, false);
    }

    /** il sistema è in tema scuro? */
    static boolean sysNight(Context c) {
        return (c.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
    }

    /** in tema scuro scurisce leggermente lo sfondo */
    static void nightVeil(Context c, Bitmap bg) {
        if (sysNight(c)) new Canvas(bg).drawColor(Color.argb(60, 0, 0, 12));
    }

    // ------------------------------------------------------------------ PendingIntent

    /** apre l'app (MainActivity) con un eventuale extra, es. "date" → "2026-10-28" */
    static PendingIntent open(Context c, int rc, String extraKey, String extraVal) {
        Intent i = new Intent(c, MainActivity.class).addFlags(OPEN_FLAGS);
        if (extraKey != null) i.putExtra(extraKey, extraVal);
        return PendingIntent.getActivity(c, rc, i, PI_FLAGS);
    }

    /** broadcast verso questo stesso widget (azioni A_*).
     *  v55: porta il token segreto dell'app ("tok"): il ricevitore è esportato (lo esige il
     *  sistema dei widget), quindi senza token qualunque app potrebbe premere i pulsanti. */
    static PendingIntent bc(Context c, int id, String action, int rc) {
        Intent i = new Intent(c, KalendWidget.class).setAction(action).putExtra("appWidgetId", id)
                .putExtra("tok", MainActivity.alertToken(c));
        return PendingIntent.getBroadcast(c, rc, i, PI_FLAGS);
    }

    // ------------------------------------------------------------------ prossimo evento

    /**
     * Il prossimo evento non ancora finito che inizia entro 36 ore, come JSON
     * {t, at (inizio in ms), end, k, l, c, s, e}; null se non c'è.
     */
    static JSONObject nextEvent(JSONObject data) {
        if (data == null) return null;
        JSONArray items = data.optJSONArray("items");
        if (items == null) return null;
        long now = System.currentTimeMillis();
        long bestAt = Long.MAX_VALUE;
        JSONObject best = null;
        for (int i = 0; i < items.length(); i++) {
            JSONObject o = items.optJSONObject(i);
            if (o == null || o.optInt("h") == 1) continue;      // le festività non contano
            int st = o.optInt("s", -1);
            if (st < 0) continue;                                // tutto il giorno: no
            String k = o.optString("k");
            if (k.length() != 10) continue;
            Calendar cal = Calendar.getInstance();
            cal.set(Integer.parseInt(k.substring(0, 4)), Integer.parseInt(k.substring(5, 7)) - 1,
                    Integer.parseInt(k.substring(8, 10)), st / 60, st % 60, 0);
            long at = cal.getTimeInMillis();
            int en = o.optInt("e", st);
            long end = at + Math.max(0, en - st) * 60_000L;
            if (end <= now || at - now > NEXT_WINDOW_MS || at >= bestAt) continue;
            bestAt = at;
            try {
                best = new JSONObject().put("t", o.optString("t")).put("at", at).put("end", end).put("k", k)
                        .put("l", o.optString("l")).put("c", o.optString("c")).put("s", st).put("e", en);
            } catch (Exception ignored) {
                // NOTA RICOSTRUZIONE: nel decompilato un errore di put aggiorna comunque bestAt lasciando il
                // candidato precedente; put con stringhe/numeri non fallisce mai, quindi è solo formale.
            }
        }
        return best;
    }

    /** tempo relativo all'istante at: "fra 5 min" / "fra 2 h" (testi dal JSON "s") oppure "adesso" */
    static String rel(JSONObject s, long at) {
        long min = Math.round((at - System.currentTimeMillis()) / 60_000.0);
        if (min <= 0) return s == null ? "" : s.optString("now", "");
        if (min >= 60) {
            long h = Math.round(min / 60.0);
            String t = s == null ? "{n} h" : s.optString("inH", "{n} h");
            return t.replace("{n}", String.valueOf(h));
        }
        String t = s == null ? "{n} min" : s.optString("inMin", "{n} min");
        if (min >= 10) min = Math.round(min / 5.0) * 5;   // oltre i 10 minuti arrotonda ai 5
        return t.replace("{n}", String.valueOf(min));
    }

    // ------------------------------------------------------------------ pulsante musica

    /** aspetto del pulsante ♪ a seconda che la musica sia accesa */
    static void musicBtn(Context c, RemoteViews rv) {
        boolean on = soundOn(c);
        rv.setInt(R.id.w_music, "setBackgroundResource", on ? R.drawable.w_btn_on : R.drawable.w_btn_bg);
        rv.setTextColor(R.id.w_music, on ? Color.WHITE : COL_MUSIC_OFF);
        rv.setTextViewText(R.id.w_music, "♪");
        rv.setContentDescription(R.id.w_music, c.getString(on ? R.string.wp_music_on : R.string.wp_music_off));
    }

    /** ridisegna solo il pulsante ♪ su tutti i widget in modalità agenda */
    static void paintMusic(Context c) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(c);
        for (int id : mgr.getAppWidgetIds(new ComponentName(c, KalendWidget.class))) {
            if (!"agenda".equals(mode(c, id))) continue;
            RemoteViews rv = new RemoteViews(c.getPackageName(), R.layout.widget);
            musicBtn(c, rv);
            try {
                mgr.partiallyUpdateAppWidget(id, rv);
            } catch (Exception ignored) {
            }
        }
    }

    // ------------------------------------------------------------------ disegno

    /**
     * Applica le RemoteViews: aggiornamento completo se il layout è cambiato (o se partialOk è falso),
     * altrimenti parziale (più leggero, non resetta lo scorrimento della lista).
     */
    static void apply(AppWidgetManager mgr, int id, RemoteViews rv, int layout, boolean partialOk) {
        Integer prev = LAY.get(id);
        try {
            if (!partialOk || prev == null || prev != layout) {
                mgr.updateAppWidget(id, rv);
                LAY.put(id, layout);
            } else {
                mgr.partiallyUpdateAppWidget(id, rv);
            }
        } catch (Exception e) {
            mgr.updateAppWidget(id, rv);
            LAY.put(id, layout);
        }
    }

    /** disegna per intero il widget id (titolo, sfondo, pulsanti, lista/griglia/statistiche/liste) */
    static void render(Context c, AppWidgetManager mgr, int id) {
        try {
            // dimensioni in dp comunicate dal launcher (in orizzontale si usano gli altri estremi)
            Bundle opt = mgr.getAppWidgetOptions(id);
            boolean land = c.getResources().getConfiguration().orientation == Configuration.ORIENTATION_LANDSCAPE;
            int w = opt.getInt(land ? "appWidgetMaxWidth" : "appWidgetMinWidth");
            int h = opt.getInt(land ? "appWidgetMinHeight" : "appWidgetMaxHeight");
            if (w <= 0) w = DEFAULT_W;
            if (h <= 0) h = DEFAULT_H;

            // sfondo: scala = densità, ridotta se il lato maggiore supera MAX_BG_PX
            float density = c.getResources().getDisplayMetrics().density;
            float scale = density * Math.min(1f, MAX_BG_PX / (Math.max(w, h) * density));
            JSONObject data = data(c);
            JSONObject safe = data == null ? new JSONObject() : data;
            Bitmap bg = SkyPainter.paintBackground(Math.round(w * scale), Math.round(h * scale), scale, safe,
                    System.currentTimeMillis());

            String mode = mode(c, id);
            int off = offset(c, id);
            boolean stats = "stats".equals(mode);
            boolean lists = "lists".equals(mode);
            boolean month = "month".equals(mode);
            int layout = lists ? R.layout.widget_lists : stats ? R.layout.widget_stats
                    : month ? R.layout.widget_month : R.layout.widget;
            RemoteViews rv = new RemoteViews(c.getPackageName(), layout);
            nightVeil(c, bg);
            rv.setImageViewBitmap(R.id.widget_img, bg);

            JSONObject s = data == null ? null : data.optJSONObject("s");
            JSONArray months = data == null ? null : data.optJSONArray("months");
            JSONArray wdFull = data == null ? null : data.optJSONArray("wdFull");
            boolean compact = h < MIN_H_FULL;

            // ---- titolo e sottotitolo
            if (!month) {
                Calendar now = Calendar.getInstance();
                String wd = wdFull == null ? "" : wdFull.optString(now.get(Calendar.DAY_OF_WEEK) - 1);
                String mn = months == null ? "" : months.optString(now.get(Calendar.MONTH));
                rv.setTextViewText(R.id.w_title, now.get(Calendar.DAY_OF_MONTH) + " " + mn);
                String wxSep = (data == null || data.optString("wx", "").isEmpty()) ? "" : "  ·  " + data.optString("wx");
                String sub = wd + wxSep;
                if (off != 0) {
                    // si è sfogliato avanti/indietro: "→ 12 novembre"
                    Calendar t = Calendar.getInstance();
                    t.add(Calendar.DAY_OF_MONTH, off * 7);
                    sub = "→ " + t.get(Calendar.DAY_OF_MONTH) + " " + (months == null ? "" : months.optString(t.get(Calendar.MONTH)));
                }
                JSONObject nx = off != 0 ? null : nextEvent(data);
                if (nx != null && nx.optLong("at") - System.currentTimeMillis() < NEXT_IN_TITLE_MS) {
                    // prossimo evento entro 12 ore: meteo nel titolo, "⏱ fra 20 min · Titolo" sotto
                    String wx = data.optString("wx", "");
                    rv.setTextViewText(R.id.w_title, now.get(Calendar.DAY_OF_MONTH) + " " + mn + (wx.isEmpty() ? "" : "  " + wx));
                    sub = "⏱ " + rel(s, nx.optLong("at")) + " · " + nx.optString("t");
                }
                rv.setTextViewText(R.id.w_sub, sub);
            } else {
                Calendar cal = Calendar.getInstance();
                cal.set(Calendar.DAY_OF_MONTH, 1);
                cal.add(Calendar.MONTH, off);
                String mn = months == null ? String.valueOf(cal.get(Calendar.MONTH) + 1) : months.optString(cal.get(Calendar.MONTH));
                rv.setTextViewText(R.id.w_title, mn + " " + cal.get(Calendar.YEAR));
                rv.setTextViewText(R.id.w_sub, data == null ? "" : data.optString("wx", ""));
            }

            // ---- pulsante modalità: l'icona indica la modalità che verrà dopo
            String icon = lists ? "☰" : stats ? "☑" : month ? "📊" : "▦";
            rv.setTextViewText(R.id.w_mode, icon);
            int modeVis = compact ? View.GONE : View.VISIBLE;
            if (w < MIN_W_MODE) modeVis = View.GONE;
            rv.setViewVisibility(R.id.w_mode, modeVis);

            // ---- statistiche
            if (stats) {
                rv.setTextViewText(R.id.w_title, "📊 " + c.getString(R.string.st_title));
                rv.setTextViewText(R.id.w_sub, c.getString(R.string.st_sub));
                WidgetStats.fill(c, rv, data);
                rv.setOnClickPendingIntent(R.id.w_mode, bc(c, id, A_MODE, id + RC_MODE));
                rv.setViewVisibility(R.id.w_music, View.GONE);
                rv.setViewVisibility(R.id.w_filter, View.GONE);
                rv.setOnClickPendingIntent(R.id.w_add, open(c, id + RC_ADD, "add", "1"));
                rv.setOnClickPendingIntent(R.id.w_titlebox, open(c, id + RC_TITLE, null, null));
                rv.setOnClickPendingIntent(R.id.s_root, open(c, id + RC_STATS, null, null));
                apply(mgr, id, rv, layout, false);
                return;
            }

            // ---- liste di cose da fare
            if (lists) {
                WidgetLists.fill(c, rv, data, id, h);
                rv.setOnClickPendingIntent(R.id.w_mode, bc(c, id, A_MODE, id + RC_MODE));
                rv.setViewVisibility(R.id.w_music, View.GONE);
                rv.setViewVisibility(R.id.w_filter, View.GONE);
                rv.setOnClickPendingIntent(R.id.w_add, open(c, id + RC_ADD, "list", "*"));
                rv.setOnClickPendingIntent(R.id.w_titlebox, open(c, id + RC_TITLE, "list", "*"));
                apply(mgr, id, rv, layout, false);
                return;
            }

            // ---- agenda / mese: lista fornita da WidgetService
            Intent svc = new Intent(c, WidgetService.class).putExtra("appWidgetId", id).putExtra("mode", mode);
            svc.setData(Uri.parse("kalend://widget/" + id + "/" + mode));   // Uri diverso per widget = adapter distinti
            int listId = month ? R.id.w_grid : R.id.w_list;
            rv.setRemoteAdapter(listId, svc);
            rv.setEmptyView(listId, R.id.w_empty);
            String empty = data != null ? (s == null ? "" : s.optString("empty", "")) : c.getString(R.string.widget_open_app);
            rv.setTextViewText(R.id.w_empty, empty);

            // modello del tocco sulle righe: in agenda apre l'anteprima, nel mese apre l'app sul giorno
            int tplFlags = (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0) | PendingIntent.FLAG_UPDATE_CURRENT;
            Intent tpl;
            if (month) {
                tpl = new Intent(c, MainActivity.class).addFlags(OPEN_FLAGS);
            } else {
                tpl = new Intent(c, WidgetPreviewActivity.class).putExtra("appWidgetId", id);
                tpl.setData(Uri.parse("kalend://preview/" + id));
            }
            int tplRc = (month ? RC_LIST_MONTH : RC_LIST_AGENDA) + id;
            rv.setPendingIntentTemplate(listId, PendingIntent.getActivity(c, tplRc, tpl, tplFlags));
            rv.setOnClickPendingIntent(R.id.w_mode, bc(c, id, A_MODE, id + RC_MODE));
            // NOTA RICOSTRUZIONE: qui il decompilato costruisce un Intent verso WidgetPreviewActivity con
            // extra "listen" e dati "kalend://listen/<id>" senza mai usarlo (codice morto): omesso.

            // pulsante musica (solo in agenda, se c'è spazio)
            rv.setOnClickPendingIntent(R.id.w_music, bc(c, id, A_MUSIC, id + RC_MUSIC));
            musicBtn(c, rv);
            rv.setViewVisibility(R.id.w_music, month ? View.GONE : (w >= MIN_W_MUSIC ? View.VISIBLE : View.GONE));
            rv.setOnClickPendingIntent(R.id.w_add, open(c, id + RC_ADD, "add", "1"));

            // pulsante filtro: acceso se c'è un filtro per testo o per tag
            String fq = prefs(c).getString("w_fq_" + id, "");
            String ftg = prefs(c).getString("w_ftg_" + id, "");
            boolean filtered = !fq.isEmpty() || !ftg.isEmpty();
            Intent fi = new Intent(c, WidgetFilterActivity.class).putExtra("appWidgetId", id)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            fi.setData(Uri.parse("kalend://filter/" + id));
            rv.setOnClickPendingIntent(R.id.w_filter, PendingIntent.getActivity(c, id + RC_FILTER, fi, PI_FLAGS));
            rv.setInt(R.id.w_filter, "setBackgroundResource", filtered ? R.drawable.w_btn_on : R.drawable.w_btn_bg);
            rv.setViewVisibility(R.id.w_filter, month ? View.GONE : (w >= MIN_W_FILTER ? View.VISIBLE : View.GONE));
            if (filtered && !month) {
                rv.setTextViewText(R.id.w_sub, "🔎 " + (fq.isEmpty() ? "" : "«" + fq + "» ") + (ftg.isEmpty() ? "" : "#" + ftg));
            }

            // tocco sul titolo: apre l'app su oggi; sul testo "vuoto": apre l'app
            Calendar today = Calendar.getInstance();
            String todayKey = String.format(Locale.ROOT, "%04d-%02d-%02d", today.get(Calendar.YEAR),
                    today.get(Calendar.MONTH) + 1, today.get(Calendar.DAY_OF_MONTH));
            rv.setOnClickPendingIntent(R.id.w_titlebox, open(c, id + RC_TITLE, "date", todayKey));
            rv.setOnClickPendingIntent(R.id.w_empty, open(c, id + RC_EMPTY, null, null));
            WidgetLists.lists(data);   // NOTA RICOSTRUZIONE: chiamata presente nel decompilato, risultato ignorato
            rv.setViewVisibility(R.id.w_lbar, View.GONE);
            apply(mgr, id, rv, layout, true);
        } catch (Exception ignored) {
        }
    }

    // ------------------------------------------------------------------ lista

    /**
     * Firma dello stato della lista: modalità, offset, filtri, data di oggi, hash degli eventi e numero
     * di eventi di oggi già iniziati/finiti. Se cambia, la lista va rigenerata.
     */
    static String listSig(Context c, int id) {
        StringBuilder sb = new StringBuilder(mode(c, id));
        sb.append('|').append(offset(c, id));
        sb.append('|').append(prefs(c).getString("w_fq_" + id, ""));
        sb.append('|').append(prefs(c).getString("w_ftg_" + id, ""));
        Calendar now = Calendar.getInstance();
        String todayKey = WidgetService.Factory.key(now);
        int nowMin = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
        sb.append('|').append(todayKey);
        JSONObject data = data(c);
        JSONArray items = data == null ? null : data.optJSONArray("items");
        if (items != null) {
            sb.append('|').append(items.toString().hashCode());
            int started = 0, ended = 0;
            for (int i = 0; i < items.length(); i++) {
                JSONObject o = items.optJSONObject(i);
                if (o == null || !todayKey.equals(o.optString("k"))) continue;
                int st = o.optInt("s", -1);
                int en = o.optInt("e", -1);
                if (st >= 0 && st <= nowMin) started++;
                if (en >= 0 && en < nowMin) ended++;
            }
            sb.append('|').append(started).append('|').append(ended);
        }
        return sb.toString();
    }

    /** chiede ad Android di rigenerare le righe se la firma è cambiata (o se force) */
    static void refreshList(Context c, AppWidgetManager mgr, int id, boolean force) {
        String mode = mode(c, id);
        if (!"agenda".equals(mode) && !"month".equals(mode)) return;
        String sig = listSig(c, id);
        String key = "w_sig_" + id;
        if (force || !sig.equals(prefs(c).getString(key, ""))) {
            prefs(c).edit().putString(key, sig).apply();
            mgr.notifyAppWidgetViewDataChanged(id, "month".equals(mode) ? R.id.w_grid : R.id.w_list);
        }
    }

    // ------------------------------------------------------------------ aggiornamento globale e tick

    /** ridisegna tutti i widget (grande e "prossimo evento") e riprogramma il tick */
    static void updateAll(Context c) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(c);
        for (int id : mgr.getAppWidgetIds(new ComponentName(c, KalendWidget.class))) {
            boolean first = !LAY.containsKey(id);
            render(c, mgr, id);
            refreshList(c, mgr, id, first);
        }
        KalendNextWidget.updateAll(c);
        tick(c);
    }

    /** programma (o annulla, se non ci sono widget) l'aggiornamento periodico ogni 15 minuti */
    static void tick(Context c) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(c);
        boolean any = mgr.getAppWidgetIds(new ComponentName(c, KalendWidget.class)).length > 0
                || mgr.getAppWidgetIds(new ComponentName(c, KalendNextWidget.class)).length > 0;
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pi = PendingIntent.getBroadcast(c, RC_TICK,
                new Intent(c, KalendWidget.class).setAction(A_TICK), PI_FLAGS);
        am.cancel(pi);
        if (any) {
            am.setInexactRepeating(AlarmManager.ELAPSED_REALTIME, SystemClock.elapsedRealtime() + TICK_MS, TICK_MS, pi);
        }
    }

    // ------------------------------------------------------------------ callback di AppWidgetProvider

    @Override
    public void onUpdate(Context c, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) {
            boolean first = !LAY.containsKey(id);
            render(c, mgr, id);
            refreshList(c, mgr, id, first);
        }
    }

    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager mgr, int id, Bundle opts) {
        render(c, mgr, id);
    }

    @Override public void onEnabled(Context c) { tick(c); }
    @Override public void onDisabled(Context c) { tick(c); }

    /** gestisce il tick periodico e i pulsanti del widget */
    @Override
    public void onReceive(Context c, Intent intent) {
        super.onReceive(c, intent);
        String action = intent.getAction();
        int id = intent.getIntExtra("appWidgetId", -1);

        if (A_TICK.equals(action)) {
            long now = System.currentTimeMillis();
            if (now - lastTick >= TICK_MIN_GAP_MS) {
                lastTick = now;
                updateAll(c);
            }
            return;
        }
        if (id < 0 || action == null) return;

        // v55: i pulsanti valgono solo con il token segreto messo dall'app nei suoi PendingIntent.
        // Un tocco senza token viene da un'altra app, oppure da pulsanti disegnati da una versione
        // precedente: in quel caso si ridisegna (al massimo ogni 20 s) così i pulsanti si aggiornano.
        if (!Safe.sameToken(MainActivity.alertToken(c), intent.getStringExtra("tok"))) {
            long now = System.currentTimeMillis();
            if (now - lastTick >= TICK_MIN_GAP_MS) {
                lastTick = now;
                updateAll(c);
            }
            return;
        }

        // si agisce solo se l'id appartiene davvero a un widget di questo tipo
        boolean mine = false;
        for (int w : AppWidgetManager.getInstance(c).getAppWidgetIds(new ComponentName(c, KalendWidget.class))) {
            if (w == id) {
                mine = true;
                break;
            }
        }
        if (!mine) return;

        SharedPreferences.Editor ed = prefs(c).edit();
        switch (action) {
            case A_MUSIC:
                toggleMusic(c, id);
                return;

            case A_LTOG:
                WidgetLists.toggle(c, intent.getStringExtra("t"));
                return;

            case A_LISTS:
                ed.putString("w_mode_" + id, "lists").putInt("w_off_" + id, 0).apply();
                render(c, AppWidgetManager.getInstance(c), id);
                return;

            case A_MODE: {
                // agenda → month → stats → lists → agenda
                String cur = mode(c, id);
                String next = "agenda";
                if ("agenda".equals(cur)) next = "month";
                else if ("month".equals(cur)) next = "stats";
                else if ("stats".equals(cur)) next = "lists";
                ed.putString("w_mode_" + id, next).putInt("w_off_" + id, 0);
                break;
            }
            case A_PREV:
                ed.putInt("w_off_" + id, offset(c, id) - 1);
                break;

            case A_NEXT:
                ed.putInt("w_off_" + id, offset(c, id) + 1);
                break;

            default:   // A_PICK e azioni sconosciute: niente
                return;
        }
        ed.apply();
        AppWidgetManager mgr = AppWidgetManager.getInstance(c);
        render(c, mgr, id);
        refreshList(c, mgr, id, true);
    }

    /** pulsante ♪: accende la musica del primo evento in agenda con musica (45 s al massimo) o la spegne */
    private static void toggleMusic(Context c, int id) {
        boolean wasOn = soundOn(c);
        prefs(c).edit().putBoolean(SND, !wasOn).apply();
        try {
            if (wasOn) {
                WidgetAudio.stop();
            } else {
                WidgetService.Factory f = new WidgetService.Factory(c, id, "agenda");
                f.onDataSetChanged();
                for (WidgetService.Row r : f.rows) {
                    if (r.type == WidgetService.Row.TYPE_EVENT && r.m != null && !r.m.isEmpty()) {
                        WidgetAudio.play(c, r.m);
                        WidgetAudio.limit(45_000L);
                        break;
                    }
                }
            }
        } catch (Exception ignored) {
        }
        paintMusic(c);
    }
}
