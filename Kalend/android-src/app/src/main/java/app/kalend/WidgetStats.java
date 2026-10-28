package app.kalend;

import android.content.Context;
import android.graphics.Color;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * VISTA "STATISTICHE" DEL WIDGET (layout res/layout/widget_stats.xml).
 *
 * Riceve i dati del widget (il JSON "widget" salvato nelle SharedPreferences
 * da MainActivity, letto da KalendWidget.data) e riempie la RemoteViews con:
 *  - il numero di eventi dei prossimi 7 giorni e le ore occupate;
 *  - un mini-grafico a barre (caratteri ▁▂▃…█) con un carattere per giorno;
 *  - le 4 etichette/famiglie di eventi più frequenti nei prossimi 30 giorni,
 *    con una barra di progresso proporzionale;
 *  - fino a 5 "spunti" testuali (sovrapposizioni, scadenze, ricorrenze, giorno
 *    più pieno, serate libere, confronto con la settimana scorsa, persona più
 *    presente).
 *
 * Ogni evento nel JSON "items" ha: k = giorno "aaaa-mm-gg", s/e = inizio/fine
 * in minuti dalla mezzanotte (-1 se tutto il giorno), h = 1 se è una festività,
 * f = etichetta/famiglia, pp = persone separate da virgola, m = tipo di
 * ricorrenza (compleanno, natale, capodanno), t = titolo, c = colore.
 * "wdFull" e "wdShort" sono i nomi dei giorni della settimana (indice 0 =
 * domenica, come Calendar.DAY_OF_WEEK - 1).
 *
 * Chiamata da KalendWidget quando la modalità del widget è "statistiche".
 */
final class WidgetStats {
    /** gli otto livelli del grafico a barre, dal più basso al più alto */
    private static final String BARS = "▁▂▃▄▅▆▇█";

    /** colonne del mini-grafico: barra, nome del giorno, numero di eventi */
    private static final int[] BAR_IDS = {R.id.s_b0, R.id.s_b1, R.id.s_b2, R.id.s_b3, R.id.s_b4, R.id.s_b5, R.id.s_b6};
    private static final int[] DAY_IDS = {R.id.s_d0, R.id.s_d1, R.id.s_d2, R.id.s_d3, R.id.s_d4, R.id.s_d5, R.id.s_d6};
    private static final int[] CNT_IDS = {R.id.s_k0, R.id.s_k1, R.id.s_k2, R.id.s_k3, R.id.s_k4, R.id.s_k5, R.id.s_k6};

    /** le 4 righe delle famiglie più frequenti: riga, etichetta, barra di progresso, conteggio */
    private static final int[] FROW = {R.id.s_fr0, R.id.s_fr1, R.id.s_fr2, R.id.s_fr3};
    private static final int[] FLAB = {R.id.s_fl0, R.id.s_fl1, R.id.s_fl2, R.id.s_fl3};
    private static final int[] FPRO = {R.id.s_fp0, R.id.s_fp1, R.id.s_fp2, R.id.s_fp3};
    private static final int[] FCNT = {R.id.s_fc0, R.id.s_fc1, R.id.s_fc2, R.id.s_fc3};

    /** colori del grafico: barra di un giorno poco pieno → molto pieno, barra vuota, nome del giorno, "oggi" */
    private static final int BAR_LOW = 0xFF2AABB8;
    private static final int BAR_HIGH = 0xFFF07856;
    private static final int BAR_EMPTY = 0x55FFFFFF;
    private static final int DAY_NORMAL = 0xCCFFFFFF;
    private static final int DAY_TODAY = 0xFFFFD27A;

    /** finestra della "serata": 18:00 - 18:30 in minuti dalla mezzanotte */
    private static final int EVENING_START = 18 * 60;
    private static final int EVENING_END = 18 * 60 + 30;

    /** giorni analizzati per le famiglie/persone e per le scadenze */
    private static final int LOOKAHEAD_DAYS = 30;
    private static final int DEADLINE_DAYS = 14;
    private static final int MAX_INSIGHTS = 5;
    private static final int TOP_FAMILIES = 4;

    WidgetStats() {}

    /** Riempie la vista statistiche con i dati del widget (data può essere null: tutto a zero). */
    static void fill(Context ctx, RemoteViews rv, JSONObject data) {
        JSONArray items = data != null ? data.optJSONArray("items") : null;
        JSONArray wdFull = data != null ? data.optJSONArray("wdFull") : null;
        JSONArray wdShort = data != null ? data.optJSONArray("wdShort") : null;

        // eventi raggruppati per giorno (chiave "aaaa-mm-gg"), festività escluse
        Map<String, List<JSONObject>> byDay = new HashMap<>();
        if (items != null) {
            for (int i = 0; i < items.length(); i++) {
                JSONObject it = items.optJSONObject(i);
                if (it == null || it.optInt("h") == 1) continue;
                String k = it.optString("k");
                List<JSONObject> list = byDay.get(k);
                if (list == null) {
                    list = new ArrayList<>();
                    byDay.put(k, list);
                }
                list.add(it);
            }
        }

        // ── prossimi 7 giorni: conteggi, ore occupate, sovrapposizioni ──
        Calendar cal = Calendar.getInstance();
        int[] counts = new int[7];
        String[] dayNames = new String[7];
        String[] dayShort = new String[7];
        int busyMinutes = 0;
        int maxCount = 0;
        int total = 0;
        int freeDays = 0;
        int freeEvenings = 0;
        int overlaps = 0;
        int busiestDay = -1;
        for (int d = 0; d < 7; d++) {
            String key = key(cal);
            int dow = cal.get(Calendar.DAY_OF_WEEK) - 1;
            String full = wdFull == null ? String.valueOf(dow) : wdFull.optString(dow);
            dayNames[d] = full;
            String sh = wdShort != null ? wdShort.optString(dow) : full;
            if (d == 0) {
                sh = "●"; // oggi: un pallino al posto del nome
            } else if (sh.length() > 2) {
                sh = sh.substring(0, 2);
            }
            dayShort[d] = sh;

            List<JSONObject> list = byDay.get(key);
            int n = list != null ? list.size() : 0;
            counts[d] = n;
            total += n;
            if (n == 0) freeDays++;
            if (n > maxCount) {
                maxCount = n;
                busiestDay = d;
            }

            // intervalli orari del giorno e controllo della serata libera
            List<int[]> spans = new ArrayList<>();
            boolean eveningBusy = false;
            if (list != null) {
                for (JSONObject it : list) {
                    int s = it.optInt("s", -1);
                    int e = it.optInt("e", -1);
                    if (s >= 0 && e > s) spans.add(new int[] {s, e});
                    // tutto il giorno, inizio dalle 18 in poi o fine oltre le 18:30 → serata occupata
                    if (s < 0 || s >= EVENING_START || e > EVENING_END) eveningBusy = true;
                }
            }
            if (!eveningBusy) freeEvenings++;

            // minuti occupati: unione degli intervalli ordinati per inizio
            List<int[]> sorted = new ArrayList<>(spans);
            Collections.sort(sorted, (a, b) -> a[0] - b[0]);
            int curEnd = -1;
            int curStart = -1;
            for (int[] span : sorted) {
                int s = span[0];
                if (s <= curEnd) {
                    curEnd = Math.max(curEnd, span[1]);
                } else {
                    if (curEnd > curStart) busyMinutes += curEnd - curStart;
                    curEnd = span[1];
                    curStart = s;
                }
            }
            if (curEnd > curStart) busyMinutes += curEnd - curStart;

            // coppie di eventi che si sovrappongono
            for (int i = 0; i < spans.size(); i++) {
                for (int j = i + 1; j < spans.size(); j++) {
                    int[] a = spans.get(i);
                    int[] b = spans.get(j);
                    if (a[0] < b[1] && b[0] < a[1]) overlaps++;
                }
            }
            cal.add(Calendar.DAY_OF_MONTH, 1);
        }

        // ── i 7 giorni precedenti, per il confronto con la settimana scorsa ──
        Calendar prev = Calendar.getInstance();
        prev.add(Calendar.DAY_OF_MONTH, -7);
        int lastWeek = 0;
        for (int d = 0; d < 7; d++) {
            List<JSONObject> list = byDay.get(key(prev));
            lastWeek += list != null ? list.size() : 0;
            prev.add(Calendar.DAY_OF_MONTH, 1);
        }

        // ── prossimi 30 giorni: famiglie, persone, scadenze, ricorrenze ──
        Map<String, Integer> families = new LinkedHashMap<>();
        Map<String, Integer> people = new HashMap<>();
        Calendar ahead = Calendar.getInstance();
        String occasion = null;      // es. "🎂 Mario" (prima ricorrenza trovata)
        int occasionDays = -1;       // fra quanti giorni
        String firstDeadline = null; // titolo della prima scadenza
        int deadlines = 0;
        for (int d = 0; d < LOOKAHEAD_DAYS; d++) {
            List<JSONObject> list = byDay.get(key(ahead));
            if (list != null) {
                for (JSONObject it : list) {
                    String f = it.optString("f", "").trim();
                    if (f.isEmpty()) f = "✨ " + ctx.getString(R.string.st_other);
                    Integer fc = families.get(f);
                    families.put(f, fc != null ? fc + 1 : 1);

                    for (String p : it.optString("pp", "").split("\\s*,\\s*")) {
                        if (p.trim().isEmpty()) continue;
                        Integer pc = people.get(p.trim());
                        people.put(p.trim(), pc != null ? pc + 1 : 1);
                    }

                    String m = it.optString("m", "");
                    String lf = f.toLowerCase();
                    if (d < DEADLINE_DAYS && (lf.contains("pagament") || lf.contains("scadenz")
                            || lf.contains("payment") || lf.contains("deadline"))) {
                        deadlines++;
                        if (firstDeadline == null) firstDeadline = it.optString("t");
                    }
                    if (occasion == null
                            && ("compleanno".equals(m) || "natale".equals(m) || "capodanno".equals(m))) {
                        String emoji = "compleanno".equals(m) ? "🎂 " // 🎂
                                : "natale".equals(m) ? "🎄 "           // 🎄
                                : "🥂 ";                               // 🥂
                        occasion = emoji + it.optString("t");
                        occasionDays = d;
                    }
                }
            }
            ahead.add(Calendar.DAY_OF_MONTH, 1);
        }

        // ── intestazione: totale eventi e ore occupate ──
        rv.setTextViewText(R.id.s_n, String.valueOf(total));
        rv.setTextViewText(R.id.s_nl, ctx.getString(R.string.st_events));
        rv.setTextViewText(R.id.s_h, ctx.getString(R.string.st_hours,
                String.format(Locale.getDefault(), "%.1f", busyMinutes / 60.0f),
                String.format(Locale.getDefault(), "%.1f", total / 7.0f)));

        // ── mini-grafico a barre dei 7 giorni ──
        int maxBar = 1;
        for (int d = 0; d < 7; d++) maxBar = Math.max(maxBar, counts[d]);
        for (int d = 0; d < 7; d++) {
            int n = counts[d];
            float frac = n / (float) maxBar;
            int level = n != 0 ? Math.max(1, Math.round(7 * frac)) : 0;
            rv.setTextViewText(BAR_IDS[d], String.valueOf(BARS.charAt(level)));
            rv.setTextColor(BAR_IDS[d], n != 0 ? lerp(BAR_LOW, BAR_HIGH, frac) : BAR_EMPTY);
            rv.setTextViewText(DAY_IDS[d], dayShort[d]);
            rv.setTextColor(DAY_IDS[d], d != 0 ? DAY_NORMAL : DAY_TODAY);
            rv.setTextViewText(CNT_IDS[d], n != 0 ? String.valueOf(n) : "·");
        }

        // ── famiglie più frequenti (ordinate per conteggio decrescente) ──
        List<Map.Entry<String, Integer>> top = new ArrayList<>(families.entrySet());
        Collections.sort(top, (a, b) -> b.getValue() - a.getValue());
        int maxFamily = top.isEmpty() ? 1 : Math.max(1, top.get(0).getValue());
        rv.setViewVisibility(R.id.s_fh, top.isEmpty() ? View.GONE : View.VISIBLE);
        for (int i = 0; i < TOP_FAMILIES; i++) {
            if (i >= top.size()) {
                rv.setViewVisibility(FROW[i], View.GONE);
                continue;
            }
            Map.Entry<String, Integer> e = top.get(i);
            rv.setViewVisibility(FROW[i], View.VISIBLE);
            rv.setTextViewText(FLAB[i], e.getKey());
            rv.setProgressBar(FPRO[i], 100, Math.max(6, Math.round(e.getValue() * 100.0f / maxFamily)), false);
            rv.setTextViewText(FCNT[i], String.valueOf(e.getValue()));
        }

        // ── spunti testuali (al massimo 5) ──
        List<String> tips = new ArrayList<>();
        if (total == 0) tips.add(ctx.getString(R.string.st_empty));
        if (overlaps > 0) tips.add(ctx.getString(R.string.st_overlaps, overlaps));
        if (deadlines > 0) {
            tips.add(ctx.getString(R.string.st_deadlines, deadlines, firstDeadline != null ? firstDeadline : ""));
        }
        if (occasion != null) {
            tips.add(occasionDays != 0
                    ? ctx.getString(R.string.st_occasion, occasion, occasionDays)
                    : ctx.getString(R.string.st_occ_today, occasion));
        }
        if (busiestDay >= 0 && maxCount >= 2) {
            tips.add(ctx.getString(R.string.st_busiest, dayNames[busiestDay], maxCount));
        }
        if (total > 0) tips.add(ctx.getString(R.string.st_free, freeEvenings, freeDays));
        if (total != lastWeek && lastWeek + total > 0) {
            tips.add(total <= lastWeek
                    ? ctx.getString(R.string.st_less, lastWeek - total)
                    : ctx.getString(R.string.st_more, total - lastWeek));
        }
        // la persona che compare più volte (serve almeno 2 presenze)
        int bestCount = 1;
        String bestPerson = null;
        for (Map.Entry<String, Integer> e : people.entrySet()) {
            if (e.getValue() > bestCount) {
                bestCount = e.getValue();
                bestPerson = e.getKey();
            }
        }
        if (bestPerson != null) tips.add(ctx.getString(R.string.st_person, bestPerson, bestCount));

        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < Math.min(MAX_INSIGHTS, tips.size()); i++) {
            if (i > 0) sb.append('\n');
            sb.append(tips.get(i));
        }
        rv.setTextViewText(R.id.s_ins, sb.toString());
    }

    /** La chiave "aaaa-mm-gg" di un giorno, uguale a quella usata dalla pagina nel JSON. */
    private static String key(Calendar c) {
        return String.format(Locale.ROOT, "%04d-%02d-%02d",
                c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    /** Interpola linearmente due colori (t = 0 → a, t = 1 → b), canale per canale. */
    private static int lerp(int a, int b, float t) {
        return Color.rgb(
                (int) (Color.red(a) + (Color.red(b) - Color.red(a)) * t),
                (int) (Color.green(a) + (Color.green(b) - Color.green(a)) * t),
                (int) (Color.blue(a) + (Color.blue(b) - Color.blue(a)) * t));
    }
}
