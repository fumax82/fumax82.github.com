package app.kalend;

import android.content.ContentUris;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * CALENDARIO DEL TELEFONO (sola lettura + inserimento tramite l'app di sistema).
 *
 * La pagina può mostrare, accanto ai propri eventi, quelli dei calendari
 * già presenti sul dispositivo (Google, Exchange, locali…). Qui ci sono le
 * tre operazioni esposte dal ponte: elenco dei calendari, eventi in un
 * intervallo, inserimento di un nuovo evento. L'inserimento NON scrive nel
 * calendario direttamente: apre la finestra "nuovo evento" dell'app
 * calendario del telefono, così l'utente conferma da sé (e non serve il
 * permesso di scrittura).
 *
 * Il permesso READ_CALENDAR viene chiesto dalla pagina con calPermission()
 * prima di usare list()/events(); senza permesso la query lancia una
 * SecurityException che il ponte rimanda alla pagina come errore.
 */
final class DeviceCalendar {
    private DeviceCalendar() {}

    /** limite di sicurezza: oltre tanti eventi la lista non serve a nessuno */
    private static final int MAX_EVENTS = 5000;

    /** colore ARGB del provider → "#RRGGBB" */
    private static String hexColor(int argb) {
        return String.format("#%06X", argb & 0xFFFFFF);
    }

    /** Elenco dei calendari del dispositivo: [{id,name,account,color,visible}] */
    static String list(Context c) throws Exception {
        JSONArray out = new JSONArray();
        String[] cols = {
                CalendarContract.Calendars._ID,
                CalendarContract.Calendars.CALENDAR_DISPLAY_NAME,
                CalendarContract.Calendars.ACCOUNT_NAME,
                CalendarContract.Calendars.CALENDAR_COLOR,
                CalendarContract.Calendars.VISIBLE
        };
        try (Cursor cur = c.getContentResolver().query(CalendarContract.Calendars.CONTENT_URI, cols, null, null,
                CalendarContract.Calendars.ACCOUNT_NAME)) {
            while (cur != null && cur.moveToNext()) {
                JSONObject o = new JSONObject();
                o.put("id", String.valueOf(cur.getLong(0)));
                o.put("name", cur.getString(1));
                o.put("account", cur.getString(2));
                o.put("color", hexColor(cur.getInt(3)));
                o.put("visible", cur.getInt(4) == 1);
                out.put(o);
            }
        }
        return out.toString();
    }

    /**
     * Eventi (istanze, quindi anche le ricorrenze espanse) fra due istanti.
     * @param ids elenco di id calendario separati da virgola, oppure vuoto = tutti
     * @return [{id,title,begin,end,allDay,loc,desc,color,calName}]
     */
    static String events(Context c, long from, long to, String ids) throws Exception {
        JSONArray out = new JSONArray();
        Uri.Builder b = CalendarContract.Instances.CONTENT_URI.buildUpon();
        ContentUris.appendId(b, from);
        ContentUris.appendId(b, to);

        /* filtro sui calendari scelti: gli id vengono riconvertiti in numeri,
           così nella query non può entrare testo arbitrario dalla pagina */
        String where = null;
        if (ids != null && !ids.trim().isEmpty()) {
            StringBuilder sb = new StringBuilder(CalendarContract.Instances.CALENDAR_ID + " IN (");
            String[] parts = ids.split(",");
            for (int i = 0; i < parts.length; i++) {
                sb.append(i == 0 ? "" : ",").append(Long.parseLong(parts[i].trim()));
            }
            where = sb.append(")").toString();
        }
        String[] cols = {
                CalendarContract.Instances.EVENT_ID,
                CalendarContract.Instances.TITLE,
                CalendarContract.Instances.BEGIN,
                CalendarContract.Instances.END,
                CalendarContract.Instances.ALL_DAY,
                CalendarContract.Instances.EVENT_LOCATION,
                CalendarContract.Instances.DESCRIPTION,
                CalendarContract.Instances.DISPLAY_COLOR,
                CalendarContract.Instances.CALENDAR_DISPLAY_NAME
        };
        try (Cursor cur = c.getContentResolver().query(b.build(), cols, where, null, CalendarContract.Instances.BEGIN)) {
            int n = 0;
            while (cur != null && cur.moveToNext() && n++ < MAX_EVENTS) {
                JSONObject o = new JSONObject();
                o.put("id", cur.getLong(0));
                o.put("title", cur.getString(1));
                o.put("begin", cur.getLong(2));
                o.put("end", cur.getLong(3));
                o.put("allDay", cur.getInt(4) == 1);
                o.put("loc", cur.getString(5));
                o.put("desc", cur.getString(6));
                o.put("color", hexColor(cur.getInt(7)));
                o.put("calName", cur.getString(8));
                out.put(o);
            }
        }
        return out.toString();
    }

    /** Apre l'app calendario del telefono sulla schermata "nuovo evento" precompilata. */
    static void insert(Context c, String json) throws Exception {
        JSONObject e = new JSONObject(json);
        Intent i = new Intent(Intent.ACTION_INSERT)
                .setData(CalendarContract.Events.CONTENT_URI)
                .putExtra(CalendarContract.Events.TITLE, e.optString("title"))
                .putExtra(CalendarContract.Events.DESCRIPTION, e.optString("desc"))
                .putExtra(CalendarContract.Events.EVENT_LOCATION, e.optString("loc"))
                .putExtra(CalendarContract.EXTRA_EVENT_ALL_DAY, e.optBoolean("allDay"))
                .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, e.optLong("begin"))
                .putExtra(CalendarContract.EXTRA_EVENT_END_TIME, e.optLong("end"));
        c.startActivity(i);
    }
}
