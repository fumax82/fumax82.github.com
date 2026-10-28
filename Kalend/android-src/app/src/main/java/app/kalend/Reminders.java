package app.kalend;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.os.Build;
import android.text.TextPaint;
import android.text.TextUtils;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * PROMEMORIA degli eventi: sveglie di sistema e notifiche.
 *
 * Come funziona, in breve:
 *  · la pagina web dell'app (tramite MainActivity.Bridge.setReminders) consegna l'elenco
 *    dei promemoria come JSON; {@link #replaceAll} lo salva nelle SharedPreferences "kalend"
 *    (chiave "rem") e programma una sveglia esatta per ciascuno con AlarmManager;
 *  · quando una sveglia scatta, Android invia a questo BroadcastReceiver l'azione
 *    {@link #ACTION_FIRE}: se l'app è aperta e visibile la pagina mostra l'avviso da sé
 *    (MainActivity.showAlert), altrimenti viene pubblicata una notifica con due pulsanti,
 *    "posticipa" ({@link #ACTION_SNOOZE}) e "fatto" ({@link #ACTION_DONE});
 *  · i posticipi vengono memorizzati a parte (chiave "rem_snz") così sopravvivono a un
 *    riavvio: dopo BOOT_COMPLETED, aggiornamento dell'app o cambio di ora/fuso orario
 *    {@link #scheduleAll} riarma tutto;
 *  · la notifica ha una "versione pubblica" per la schermata di blocco (titolo e testo
 *    presi dal JSON del widget, sezione "s": lockTitle/lockText) e un'immagine grande
 *    dipinta da {@link SkyPainter#paintBackground} con il titolo dell'evento sopra.
 *
 * Collegamenti: MainActivity (ensureChannel, replaceAll, snooze, snoozeSeconds, alertToken,
 * showAlert), KalendWidget (data, updateAll), SkyPainter (paintBackground).
 * Il receiver è dichiarato nel manifest per le azioni di sistema elencate in onReceive.
 */
public class Reminders extends BroadcastReceiver {

    /** azione della sveglia: "è ora di mostrare il promemoria" */
    static final String ACTION_FIRE = "app.kalend.REMINDER";
    /** pulsante "posticipa" della notifica (10 minuti) */
    static final String ACTION_SNOOZE = "app.kalend.SNOOZE";
    /** pulsante "fatto" della notifica: chiude e basta */
    static final String ACTION_DONE = "app.kalend.DONE";
    /** canale di notifica (quello vecchio "kalend_reminders" viene cancellato) */
    static final String CH = "kalend_reminders_private";
    /** bit alto aggiunto al request code dei posticipi, per non collidere con le sveglie normali */
    static final int SNZ = 0x20000000;

    /** vecchio canale, da rimuovere se ancora presente */
    private static final String OLD_CH = "kalend_reminders";
    /** file delle preferenze condiviso con tutta l'app */
    private static final String PREFS = "kalend";
    /** chiave: elenco JSON dei promemoria programmati */
    private static final String KEY_REM = "rem";
    /** chiave: elenco JSON dei posticipi in attesa */
    private static final String KEY_SNZ = "rem_snz";

    /** colore dell'app (#2AABB8) usato per l'accento della notifica e la barra nell'immagine */
    private static final int ACCENT = 0xFF2AABB8;
    /** finestra di tolleranza quando le sveglie esatte non sono permesse: 5 minuti */
    private static final long WINDOW_MS = 300_000L;
    /** idem per i posticipi: 1 minuto */
    private static final long SNOOZE_WINDOW_MS = 60_000L;
    /** un posticipo scaduto da più di un minuto viene dimenticato */
    private static final long SNOOZE_GRACE_MS = 60_000L;
    /** minuti di posticipo del pulsante "posticipa" */
    private static final int SNOOZE_MINUTES = 10;

    /** dimensioni e misure dell'immagine grande della notifica (BigPictureStyle) */
    private static final int PIC_W = 960, PIC_H = 440;
    private static final float PIC_DENSITY = 2.2f;
    private static final int TITLE_MAX_W = 830;

    /** NEW_TASK | CLEAR_TOP: riapre l'app in cima allo stack */
    private static final int OPEN_FLAGS = Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP;
    /** flag standard dei PendingIntent delle notifiche */
    private static final int PI_FLAGS = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;

    public Reminders() {}

    /* ────────────────────────────────────────────────────────────────
       canale di notifica
    ──────────────────────────────────────────────────────────────── */

    /** crea (una volta) il canale privato dei promemoria e cancella quello vecchio */
    static void ensureChannel(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        try {
            if (nm.getNotificationChannel(OLD_CH) != null) nm.deleteNotificationChannel(OLD_CH);
        } catch (Exception ignored) {}
        if (nm.getNotificationChannel(CH) == null) {
            NotificationChannel ch = new NotificationChannel(CH, c.getString(R.string.channel_name), NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription(c.getString(R.string.channel_desc));
            ch.enableVibration(true);
            ch.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
            ch.setBypassDnd(false);
            nm.createNotificationChannel(ch);
        }
    }

    /* ────────────────────────────────────────────────────────────────
       PendingIntent delle sveglie
    ──────────────────────────────────────────────────────────────── */

    /** sveglia normale senza "k" né "j" (serve per cancellare: FLAG_NO_CREATE) */
    private static PendingIntent pi(Context c, int id, String title, String text, int flags) {
        return pi(c, id, title, text, null, flags);
    }

    private static PendingIntent pi(Context c, int id, String title, String text, String k, int flags) {
        return pi(c, id, title, text, k, null, flags);
    }

    /**
     * Il PendingIntent di una sveglia: request code = id del promemoria, azione ACTION_FIRE,
     * extra "id", "title", "text", "k" (chiave dell'evento) e "j" (il promemoria intero come JSON).
     */
    private static PendingIntent pi(Context c, int id, String title, String text, String k, String j, int flags) {
        Intent i = new Intent(c, Reminders.class).setAction(ACTION_FIRE)
                .putExtra("id", id).putExtra("title", title).putExtra("text", text).putExtra("k", k).putExtra("j", j);
        return PendingIntent.getBroadcast(c, id, i, PendingIntent.FLAG_IMMUTABLE | flags);
    }

    /** PendingIntent di un posticipo: stesso intent, ma request code con il bit SNZ acceso */
    private static PendingIntent snzPi(Context c, JSONObject o, int flags) {
        int id = o.optInt("id", 1);
        Intent i = new Intent(c, Reminders.class).setAction(ACTION_FIRE)
                .putExtra("id", id).putExtra("title", o.optString("title")).putExtra("text", o.optString("text"))
                .putExtra("k", o.optString("k", null)).putExtra("j", o.toString());
        return PendingIntent.getBroadcast(c, (id & (SNZ - 1)) | SNZ, i, flags | PendingIntent.FLAG_IMMUTABLE);
    }

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /* ────────────────────────────────────────────────────────────────
       programmazione
    ──────────────────────────────────────────────────────────────── */

    /**
     * Sostituisce l'intero elenco dei promemoria: cancella le sveglie già programmate
     * (quelle della lista precedente), salva il nuovo JSON (null → "[]") e riprogramma tutto.
     */
    static synchronized void replaceAll(Context c, String json) {
        // NOTA RICOSTRUZIONE: il decompilato non mostra il try/catch (nascosto dal blocco synchronized),
        // ma new JSONArray lancia un'eccezione controllata e i chiamanti non la gestiscono: va assorbita qui.
        try {
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            JSONArray old = new JSONArray(prefs(c).getString(KEY_REM, "[]"));
            for (int i = 0; i < old.length(); i++) {
                PendingIntent p = pi(c, old.getJSONObject(i).getInt("id"), "", "", PendingIntent.FLAG_NO_CREATE);
                if (p != null) {
                    am.cancel(p);
                    p.cancel();
                }
            }
        } catch (Exception ignored) {}
        prefs(c).edit().putString(KEY_REM, json == null ? "[]" : json).apply();
        scheduleAll(c);
    }

    /**
     * Programma una sveglia per ogni promemoria futuro ("at" > adesso) e riarma i posticipi
     * ancora validi. Se dal 31 in poi l'app non può usare sveglie esatte, usa una finestra.
     */
    static void scheduleAll(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        long now = System.currentTimeMillis();
        try {
            JSONArray arr = new JSONArray(prefs(c).getString(KEY_REM, "[]"));
            boolean exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                long at = o.getLong("at");
                if (at <= now) continue;
                PendingIntent p = pi(c, o.getInt("id"), o.optString("title"), o.optString("text"), o.optString("k", null),
                        o.toString(), PendingIntent.FLAG_UPDATE_CURRENT);
                if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, p);
                else am.setWindow(AlarmManager.RTC_WAKEUP, at, WINDOW_MS, p);
            }
        } catch (Exception ignored) {}
        try {
            JSONArray snz = new JSONArray(prefs(c).getString(KEY_SNZ, "[]"));
            for (int i = 0; i < snz.length(); i++) {
                JSONObject e = snz.getJSONObject(i);
                long at = e.optLong("at");
                if (at > now) snzArm(c, new JSONObject(e.optString("j", "{}")), at);
            }
        } catch (Exception ignored) {}
    }

    /* ────────────────────────────────────────────────────────────────
       posticipi
    ──────────────────────────────────────────────────────────────── */

    /** posticipa di N minuti il promemoria descritto dal JSON */
    static void snooze(Context c, String json, int minutes) {
        snoozeAt(c, json, System.currentTimeMillis() + (long) (minutes * 60) * 1000L);
    }

    /** posticipa di N secondi (usato dal promemoria di prova della pagina) */
    static void snoozeSeconds(Context c, String json, int seconds) {
        snoozeAt(c, json, System.currentTimeMillis() + (long) seconds * 1000L);
    }

    /** riprogramma il promemoria a un istante preciso e lo annota tra i posticipi ("snz": 1) */
    static void snoozeAt(Context c, String json, long at) {
        try {
            JSONObject o = new JSONObject(json);
            o.put("snz", 1);
            snzArm(c, o, at);
            snzStore(c, o, at, true);
        } catch (Exception ignored) {}
    }

    /** arma la sveglia di un posticipo (finestra di 1 minuto se le sveglie esatte non sono permesse) */
    private static void snzArm(Context c, JSONObject o, long at) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        PendingIntent p = snzPi(c, o, PendingIntent.FLAG_UPDATE_CURRENT);
        if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) {
            am.setWindow(AlarmManager.RTC_WAKEUP, at, SNOOZE_WINDOW_MS, p);
        } else {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, p);
        }
    }

    /**
     * Aggiorna l'elenco "rem_snz": toglie le voci con lo stesso id e quelle scadute da più
     * di un minuto; se add è true aggiunge la nuova voce {id, at, j}.
     */
    private static synchronized void snzStore(Context c, JSONObject o, long at, boolean add) {
        try {
            JSONArray old = new JSONArray(prefs(c).getString(KEY_SNZ, "[]"));
            JSONArray out = new JSONArray();
            long now = System.currentTimeMillis();
            int id = o.optInt("id", 1);
            for (int i = 0; i < old.length(); i++) {
                JSONObject e = old.getJSONObject(i);
                if (e.optInt("id") != id && e.optLong("at") > now - SNOOZE_GRACE_MS) out.put(e);
            }
            if (add) out.put(new JSONObject().put("id", id).put("at", at).put("j", o.toString()));
            prefs(c).edit().putString(KEY_SNZ, out.toString()).apply();
        } catch (Exception ignored) {}
    }

    /* ────────────────────────────────────────────────────────────────
       immagine grande della notifica
    ──────────────────────────────────────────────────────────────── */

    /** stile della notifica: immagine grande se riesce a dipingerla, altrimenti testo esteso */
    static Notification.Style bigStyle(Context c, String json, String text) {
        Bitmap bmp;
        try {
            bmp = picture(c, new JSONObject(json));
        } catch (Exception e) {
            return new Notification.BigTextStyle().bigText(text);
        }
        if (bmp == null) return new Notification.BigTextStyle().bigText(text);
        return new Notification.BigPictureStyle().bigPicture(bmp).setSummaryText(text);
    }

    /**
     * Dipinge il cielo del widget (960×440) e vi scrive sopra: una barretta colorata
     * (colore "c" del promemoria, altrimenti l'accento dell'app), il titolo in grassetto
     * (troncato con "…" se più largo di 830 px), il testo e una campanella. null se fallisce.
     */
    static Bitmap picture(Context c, JSONObject o) {
        try {
            JSONObject data = KalendWidget.data(c);
            if (data == null) data = new JSONObject();
            Bitmap bmp = SkyPainter.paintBackground(PIC_W, PIC_H, PIC_DENSITY, data, System.currentTimeMillis());
            Canvas cv = new Canvas(bmp);
            int color;
            try {
                color = Color.parseColor(o.optString("c", "#2AABB8"));
            } catch (Exception e) {
                color = ACCENT;
            }
            Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
            p.setColor(color);
            p.setAlpha(230);
            cv.drawRoundRect(48f, 290f, 62f, 400f, 7f, 7f, p);           // barretta verticale colorata
            p.setColor(Color.WHITE);
            p.setAlpha(255);
            p.setShadowLayer(8f, 0f, 2f, Color.argb(140, 0, 0, 0));
            p.setTypeface(Typeface.create("sans-serif", Typeface.BOLD));
            p.setTextSize(58f);
            String title = TextUtils.ellipsize(o.optString("title"), new TextPaint(p), TITLE_MAX_W, TextUtils.TruncateAt.END).toString();
            cv.drawText(title, 84f, 348f, p);
            p.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
            p.setTextSize(32f);
            p.setAlpha(235);
            cv.drawText(o.optString("text"), 86f, 394f, p);
            p.setTextSize(120f);
            p.setAlpha(255);
            cv.drawText("🔔", 770f, 150f, p);
            return bmp;
        } catch (Throwable t) {
            return null;
        }
    }

    /* ────────────────────────────────────────────────────────────────
       ricezione
    ──────────────────────────────────────────────────────────────── */

    @Override
    @SuppressWarnings("deprecation")
    public void onReceive(Context c, Intent intent) {
        String a = intent.getAction();
        // eventi di sistema: le sveglie vanno riprogrammate (Android le perde al riavvio)
        if (Intent.ACTION_BOOT_COMPLETED.equals(a) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)
                || Intent.ACTION_TIME_CHANGED.equals(a) || Intent.ACTION_TIMEZONE_CHANGED.equals(a)) {
            scheduleAll(c);
            KalendWidget.updateAll(c);
            return;
        }
        int id = intent.getIntExtra("id", 1);
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (ACTION_DONE.equals(a)) {
            nm.cancel(id);
            return;
        }
        // NOTA RICOSTRUZIONE: il decompilato mostra solo catch (SecurityException) all'esterno, ma il ramo
        // SNOOZE costruisce un JSONObject (eccezione controllata) senza catch visibile: qui si assorbe
        // qualunque eccezione, che per la SecurityException (notifiche non permesse) è lo stesso comportamento.
        try {
            if (ACTION_SNOOZE.equals(a)) {
                nm.cancel(id);
                String j = intent.getStringExtra("j");
                if (j == null) j = fromExtras(intent, id);
                snooze(c, j, SNOOZE_MINUTES);
                return;
            }
            if (!ACTION_FIRE.equals(a)) return;

            String j = intent.getStringExtra("j");
            // un posticipo che scatta va tolto dall'elenco dei posticipi in attesa
            try {
                if (j != null) {
                    JSONObject o = new JSONObject(j);
                    if (o.optInt("snz") == 1) snzStore(c, o, 0, false);
                }
            } catch (Exception ignored) {}
            if (j == null) {
                try {
                    j = fromExtras(intent, id);
                } catch (Exception e) {
                    j = "{}";
                }
            }
            // se la pagina è in primo piano mostra lei l'avviso: niente notifica
            if (MainActivity.showAlert(j)) return;

            ensureChannel(c);
            Intent open = new Intent(c, MainActivity.class).addFlags(OPEN_FLAGS);
            open.putExtra("alert", j).putExtra("tok", MainActivity.alertToken(c));
            PendingIntent tap = PendingIntent.getActivity(c, id, open, PI_FLAGS);

            // etichette dei pulsanti e testi per la schermata di blocco: dal JSON del widget, sezione "s"
            JSONObject s = null;
            try {
                JSONObject d = KalendWidget.data(c);
                if (d != null) s = d.optJSONObject("s");
            } catch (Exception ignored) {}
            String snoozeLabel = s != null ? s.optString("snooze", "+10 min") : "+10 min";
            String doneLabel = s != null ? s.optString("done", "OK") : "OK";

            Intent snz = new Intent(c, Reminders.class).setAction(ACTION_SNOOZE).putExtra("id", id).putExtra("j", j);
            Intent done = new Intent(c, Reminders.class).setAction(ACTION_DONE).putExtra("id", id);
            PendingIntent snzPi = PendingIntent.getBroadcast(c, 0x02000000 ^ id, snz, PI_FLAGS);
            PendingIntent donePi = PendingIntent.getBroadcast(c, 0x04000000 ^ id, done, PI_FLAGS);

            Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CH) : new Notification.Builder(c);
            b.setSmallIcon(R.drawable.ic_notif)
                    .setContentTitle(intent.getStringExtra("title"))
                    .setContentText(intent.getStringExtra("text"))
                    .setStyle(bigStyle(c, j, intent.getStringExtra("text")))
                    .setAutoCancel(true)
                    .setContentIntent(tap)
                    .setCategory(Notification.CATEGORY_REMINDER)
                    .setColor(ACCENT)
                    .addAction(new Notification.Action.Builder(0, snoozeLabel, snzPi).build())
                    .addAction(new Notification.Action.Builder(0, doneLabel, donePi).build());
            if (Build.VERSION.SDK_INT < 26) b.setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL);

            // versione pubblica (schermata di blocco): non rivela il contenuto dell'evento
            String lockTitle = s != null ? s.optString("lockTitle", "Kalend") : "Kalend";
            String lockText = s != null ? s.optString("lockText", "") : "";
            Notification.Builder pub = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CH) : new Notification.Builder(c);
            pub.setSmallIcon(R.drawable.ic_notif).setContentTitle(lockTitle).setContentText(lockText)
                    .setColor(ACCENT).setCategory(Notification.CATEGORY_REMINDER);
            b.setVisibility(Notification.VISIBILITY_PRIVATE).setPublicVersion(pub.build());
            nm.notify(id, b.build());
        } catch (Exception ignored) {}
    }

    /** ricostruisce il JSON del promemoria dai soli extra dell'intent (quando manca "j") */
    private static String fromExtras(Intent intent, int id) throws Exception {
        return new JSONObject().put("id", id).put("title", intent.getStringExtra("title"))
                .put("text", intent.getStringExtra("text")).put("k", intent.getStringExtra("k")).toString();
    }
}
