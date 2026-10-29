package app.kalend;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.text.SpannableString;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.text.style.StrikethroughSpan;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * LISTE (cose da fare) nel widget "Liste" di Kalend.
 *
 * I dati arrivano dal JSON del widget salvato nelle preferenze (KalendWidget.data):
 *  · "lists": fino a N liste, ognuna con "id", "n" (nome), "t" (totale voci), "d" (voci fatte),
 *    "e" (riga di testo in più, facoltativa) e "it" (le voci: "i" id, "t" testo, "d" 1 = fatta);
 *  · "items": le righe generiche del widget, che riportano "li" (id lista) e "ld" (fatte)
 *    e vanno tenute allineate quando si spunta una voce.
 *
 * Il layout widget_lists.xml ha 4 "schede" fisse (l_b0..l_b3), ognuna con 5 righe di voci
 * (l_i<scheda>_<riga>, con casella l_k… e testo l_t…): le tabelle di id qui sotto permettono
 * di riempirle in un ciclo. {@link #fill} decide quante schede e righe entrano nell'altezza
 * disponibile del widget.
 *
 * Toccare una voce nel widget manda a KalendWidget l'azione {@link #A_LTOG}; KalendWidget chiama
 * {@link #toggle}, che aggiorna il JSON, ridisegna il widget e accoda la modifica in "li_q"
 * (una coda che la pagina web ritira con {@link #take} tramite MainActivity.Bridge.takeListQueue;
 * finché non lo fa, {@link #overlay} riapplica la coda sopra ogni JSON nuovo inviato dalla pagina,
 * così le spunte fatte dal widget non vengono perse).
 */
final class WidgetLists {

    /** azione: apri la pagina delle liste (usata da KalendWidget) */
    static final String A_LISTS = "app.kalend.W_LISTS";
    /** azione: spunta/despunta una voce dal widget (extra "appWidgetId", "l" lista, "t" voce) */
    static final String A_LTOG = "app.kalend.W_LTOG";

    /** scheda (contenitore) di ogni lista */
    static final int[] B = {R.id.l_b0, R.id.l_b1, R.id.l_b2, R.id.l_b3};
    /** intestazione cliccabile della scheda */
    static final int[] H = {R.id.l_h0, R.id.l_h1, R.id.l_h2, R.id.l_h3};
    /** icona di stato (da fare / in corso / fatta) */
    static final int[] IC = {R.id.l_ic0, R.id.l_ic1, R.id.l_ic2, R.id.l_ic3};
    /** nome della lista */
    static final int[] N = {R.id.l_n0, R.id.l_n1, R.id.l_n2, R.id.l_n3};
    /** conteggio "fatte/totale" (o "tutto fatto") */
    static final int[] C = {R.id.l_c0, R.id.l_c1, R.id.l_c2, R.id.l_c3};
    /** barra di avanzamento */
    static final int[] P = {R.id.l_p0, R.id.l_p1, R.id.l_p2, R.id.l_p3};
    /** riga di testo in più ("e") */
    static final int[] E = {R.id.l_e0, R.id.l_e1, R.id.l_e2, R.id.l_e3};
    /** "+N altre" voci non mostrate */
    static final int[] M = {R.id.l_m0, R.id.l_m1, R.id.l_m2, R.id.l_m3};
    /** righe delle voci (scheda × riga) */
    static final int[][] IR = {
            {R.id.l_i0_0, R.id.l_i0_1, R.id.l_i0_2, R.id.l_i0_3, R.id.l_i0_4},
            {R.id.l_i1_0, R.id.l_i1_1, R.id.l_i1_2, R.id.l_i1_3, R.id.l_i1_4},
            {R.id.l_i2_0, R.id.l_i2_1, R.id.l_i2_2, R.id.l_i2_3, R.id.l_i2_4},
            {R.id.l_i3_0, R.id.l_i3_1, R.id.l_i3_2, R.id.l_i3_3, R.id.l_i3_4}};
    /** caselle di spunta delle voci */
    static final int[][] IK = {
            {R.id.l_k0_0, R.id.l_k0_1, R.id.l_k0_2, R.id.l_k0_3, R.id.l_k0_4},
            {R.id.l_k1_0, R.id.l_k1_1, R.id.l_k1_2, R.id.l_k1_3, R.id.l_k1_4},
            {R.id.l_k2_0, R.id.l_k2_1, R.id.l_k2_2, R.id.l_k2_3, R.id.l_k2_4},
            {R.id.l_k3_0, R.id.l_k3_1, R.id.l_k3_2, R.id.l_k3_3, R.id.l_k3_4}};
    /** testi delle voci */
    static final int[][] IT = {
            {R.id.l_t0_0, R.id.l_t0_1, R.id.l_t0_2, R.id.l_t0_3, R.id.l_t0_4},
            {R.id.l_t1_0, R.id.l_t1_1, R.id.l_t1_2, R.id.l_t1_3, R.id.l_t1_4},
            {R.id.l_t2_0, R.id.l_t2_1, R.id.l_t2_2, R.id.l_t2_3, R.id.l_t2_4},
            {R.id.l_t3_0, R.id.l_t3_1, R.id.l_t3_2, R.id.l_t3_3, R.id.l_t3_4}};

    /** chiave prefs: coda delle spunte fatte dal widget, non ancora ritirate dalla pagina */
    private static final String KEY_QUEUE = "li_q";
    /** chiave prefs: JSON del widget */
    private static final String KEY_WIDGET = "widget";
    /** la coda non cresce oltre questo numero di voci */
    static final int QUEUE_MAX = 300;
    /** lunghezza massima accettata per l'id di una voce */
    static final int ID_MAX = 64;

    /** testo di una voce fatta: bianco al 60% e barrato */
    private static final int DONE_TEXT = 0x99FFFFFF;
    /** colore del conteggio nel riepilogo (giallo caldo) */
    private static final int SUMMARY_COUNT = 0xFFFFD27A;

    /** altezze (dp) usate per capire cosa entra nel widget */
    private static final int MIN_ROOM = 60, HEADER_DP = 66, CARD_DP = 57, EXTRA_LINE_DP = 16;
    private static final int ROW_DP = 30, CARD_PAD_DP = 18, MORE_DP = 18, MIN_CARD_DP = 87;
    /** request code: base per widget e offset delle varie zone cliccabili */
    private static final int RC_PER_WIDGET = 100, RC_WIDGETS = 20000, RC_LISTS = 100000;
    private static final int RC_PER_LIST = 10, RC_MORE_ITEMS = 8, RC_MORE_LISTS = 100098, RC_EMPTY = 100099;

    private static final int OPEN_FLAGS = Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP;
    private static final int PI_FLAGS = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;

    WidgetLists() {}

    /* ────────────────────────────────────────────────────────────────
       conteggi
    ──────────────────────────────────────────────────────────────── */

    /** l'array "lists" del JSON del widget (null se manca) */
    static JSONArray lists(JSONObject data) {
        return data != null ? data.optJSONArray("lists") : null;
    }

    /** voci ancora da fare in una lista: totale − fatte, mai negativo */
    static int open(JSONObject list) {
        return list != null ? Math.max(0, list.optInt("t") - list.optInt("d")) : 0;
    }

    /** voci da fare in tutte le liste */
    static int openAll(JSONArray lists) {
        if (lists == null) return 0;
        int n = 0;
        for (int i = 0; i < lists.length(); i++) n += open(lists.optJSONObject(i));
        return n;
    }

    /** quante liste hanno ancora qualcosa da fare */
    static int openLists(JSONArray lists) {
        if (lists == null) return 0;
        int n = 0;
        for (int i = 0; i < lists.length(); i++) if (open(lists.optJSONObject(i)) > 0) n++;
        return n;
    }

    /** tra le prime `limit` voci, quante non sono fatte */
    private static int countOpen(JSONArray items, int limit) {
        int n = 0;
        for (int i = 0; items != null && i < Math.min(limit, items.length()); i++) {
            JSONObject it = items.optJSONObject(i);
            if (it != null && it.optInt("d") != 1) n++;
        }
        return n;
    }

    /* ────────────────────────────────────────────────────────────────
       disegno del widget
    ──────────────────────────────────────────────────────────────── */

    /**
     * Riempie le RemoteViews del widget "Liste".
     * @param widgetId id del widget (serve per request code diversi per ogni widget)
     * @param heightDp altezza disponibile in dp: decide quante schede e righe mostrare
     */
    static void fill(Context c, RemoteViews rv, JSONObject data, int widgetId, int heightDp) {
        JSONArray ls = lists(data);
        int n = ls != null ? ls.length() : 0;
        int base = (widgetId % RC_WIDGETS) * RC_PER_WIDGET;   // request code di base per questo widget
        int rcLists = RC_LISTS + base;                       // da qui partono i request code delle liste

        rv.setTextViewText(R.id.w_title, "☑ " + c.getString(R.string.wl_title));
        String sub = n != 0
                ? c.getResources().getQuantityString(R.plurals.wl_lists, n, n) + "  ·  " + c.getString(R.string.wl_todo, openAll(ls))
                : "";
        rv.setTextViewText(R.id.w_sub, sub);
        rv.setViewVisibility(R.id.l_empty, n != 0 ? View.GONE : View.VISIBLE);
        rv.setOnClickPendingIntent(R.id.l_empty, openApp(c, RC_EMPTY + base, "*"));

        int room = Math.max(MIN_ROOM, heightDp - HEADER_DP);  // dp ancora liberi sotto l'intestazione
        int shown = 0;                                        // schede effettivamente mostrate
        boolean full = false;                                 // una lista non è entrata: le successive nemmeno
        for (int i = 0; i < B.length; i++) {
            JSONObject l = i < n ? ls.optJSONObject(i) : null;
            int extra = l != null && !l.optString("e").isEmpty() ? EXTRA_LINE_DP : 0;
            int cardDp = CARD_DP + extra;
            // la prima scheda entra sempre; le altre solo se c'è posto per intestazione + una riga
            if (l == null || full || (i > 0 && room < extra + MIN_CARD_DP)) {
                if (l != null) full = true;
                rv.setViewVisibility(B[i], View.GONE);
                continue;
            }
            shown++;
            rv.setViewVisibility(B[i], View.VISIBLE);
            String lid = l.optString("id");
            int d = l.optInt("d"), t = l.optInt("t");
            boolean complete = d >= t && t > 0;
            rv.setTextViewText(N[i], l.optString("n"));
            rv.setTextViewText(C[i], complete ? c.getString(R.string.wl_done) : d + "/" + t);
            rv.setImageViewResource(IC[i], complete ? R.drawable.w_li_done : (d <= 0 ? R.drawable.w_li_todo : R.drawable.w_li_doing));
            rv.setProgressBar(P[i], 100, t <= 0 ? 0 : Math.round(d * 100f / t), false);
            String e = l.optString("e");
            rv.setTextViewText(E[i], e);
            rv.setViewVisibility(E[i], e.isEmpty() ? View.GONE : View.VISIBLE);
            int rc = rcLists + i * RC_PER_LIST;
            rv.setOnClickPendingIntent(H[i], openApp(c, rc, lid));

            // righe delle voci: quante ne entrano (la prima scheda ne mostra almeno una)
            JSONArray items = l.optJSONArray("it");
            int ni = items != null ? items.length() : 0;
            int minRows = i == 0 ? 1 : 0;
            int rows = Math.min(ni, Math.max(minRows, Math.min(IR[i].length, (room - cardDp - CARD_PAD_DP) / ROW_DP)));
            for (int r = 0; r < IR[i].length; r++) {
                JSONObject it = r < rows ? items.optJSONObject(r) : null;
                if (it == null) {
                    rv.setViewVisibility(IR[i][r], View.GONE);
                    continue;
                }
                boolean done = it.optInt("d") == 1;
                rv.setViewVisibility(IR[i][r], View.VISIBLE);
                rv.setImageViewResource(IK[i][r], done ? R.drawable.w_ck_on : R.drawable.w_ck_off);
                SpannableString txt = new SpannableString(it.optString("t"));
                if (done) {
                    txt.setSpan(new StrikethroughSpan(), 0, txt.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                    txt.setSpan(new ForegroundColorSpan(DONE_TEXT), 0, txt.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                }
                rv.setTextViewText(IT[i][r], txt);
                rv.setOnClickPendingIntent(IR[i][r], tog(c, widgetId, rc + 1 + r, lid, it.optString("i")));
            }

            // "+N altre": voci da fare che non sono tra le righe mostrate
            int left = Math.max(0, t - d - countOpen(items, rows));
            rv.setTextViewText(M[i], c.getString(R.string.wl_more, left));
            rv.setViewVisibility(M[i], left > 0 ? View.VISIBLE : View.GONE);
            rv.setOnClickPendingIntent(M[i], openApp(c, rc + RC_MORE_ITEMS, lid));
            room -= cardDp + rows * ROW_DP + (left > 0 ? MORE_DP : 0);
        }

        int moreLists = Math.max(0, n - shown);
        rv.setTextViewText(R.id.l_more, c.getString(R.string.wl_more_lists, moreLists));
        rv.setViewVisibility(R.id.l_more, moreLists > 0 ? View.VISIBLE : View.GONE);
        rv.setOnClickPendingIntent(R.id.l_more, openApp(c, base + RC_MORE_LISTS, "*"));
    }

    /** riepilogo testuale per l'altro widget: "N da fare · Spesa 2/5 · …" (al massimo 4 liste aperte) */
    static CharSequence summary(Context c, JSONArray lists) {
        SpannableStringBuilder sb = new SpannableStringBuilder(c.getString(R.string.wl_todo, openAll(lists)));
        int shown = 0;
        for (int i = 0; lists != null && i < lists.length() && shown < 4; i++) {
            JSONObject l = lists.optJSONObject(i);
            if (l == null || open(l) == 0) continue;
            sb.append("  ·  ").append(l.optString("n"));
            int start = sb.length();
            sb.append(" ").append(String.valueOf(l.optInt("d"))).append("/").append(String.valueOf(l.optInt("t")));
            sb.setSpan(new ForegroundColorSpan(SUMMARY_COUNT), start, sb.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            shown++;
        }
        return sb;
    }

    /** PendingIntent che apre l'app sulla lista indicata ("*" = tutte); l'URI rende unico l'intent */
    private static PendingIntent openApp(Context c, int rc, String listId) {
        Intent i = new Intent(c, MainActivity.class).addFlags(OPEN_FLAGS).putExtra("list", listId);
        i.setData(Uri.parse("kalend://list/" + rc));
        return PendingIntent.getActivity(c, rc, i, PI_FLAGS);
    }

    /** PendingIntent che spunta una voce: broadcast A_LTOG a KalendWidget */
    private static PendingIntent tog(Context c, int widgetId, int rc, String listId, String itemId) {
        Intent i = new Intent(c, KalendWidget.class).setAction(A_LTOG)
                .putExtra("appWidgetId", widgetId).putExtra("l", listId).putExtra("t", itemId)
                .putExtra("tok", MainActivity.alertToken(c));   // v55: vedi KalendWidget.bc
        i.setData(Uri.parse("kalend://ltog/" + widgetId + "/" + rc));
        return PendingIntent.getBroadcast(c, rc, i, PI_FLAGS);
    }

    /* ────────────────────────────────────────────────────────────────
       stato delle voci e coda verso la pagina
    ──────────────────────────────────────────────────────────────── */

    /**
     * Riapplica al JSON `json` (appena arrivato dalla pagina) le spunte ancora in coda "li_q",
     * così il widget non torna indietro prima che la pagina le abbia ritirate.
     * Ritorna il JSON aggiornato, o quello originale se la coda è vuota o qualcosa va storto.
     */
    static String overlay(SharedPreferences p, String json) {
        String q = p.getString(KEY_QUEUE, "[]");
        try {
            if (q == null || q.length() < 3) return json;   // "[]" o vuota: niente da fare
            JSONObject data = new JSONObject(json);
            JSONArray arr = new JSONArray(q);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject e = arr.optJSONObject(i);
                if (e != null) setState(data, e.optString("t"), e.optInt("d") == 1 ? 1 : 0);
            }
            return data.toString();
        } catch (Exception ex) {
            return json;
        }
    }

    /** la pagina ritira la coda delle spunte: la restituisce e la svuota */
    static synchronized String take(SharedPreferences p) {
        String q = p.getString(KEY_QUEUE, "[]");
        p.edit().remove(KEY_QUEUE).apply();
        return q == null ? "[]" : q;
    }

    /**
     * Imposta lo stato (1 fatta / 0 da fare) della voce `itemId` dentro il JSON del widget.
     * Se cambia, aggiorna anche il contatore "d" della lista (tra 0 e "t") e il campo "ld"
     * delle righe "items" che si riferiscono a quella lista.
     * @return true se la voce esiste (anche se lo stato era già quello richiesto)
     */
    static boolean setState(JSONObject data, String itemId, int state) {
        JSONArray ls = lists(data);
        if (ls == null || itemId == null) return false;
        for (int i = 0; i < ls.length(); i++) {
            JSONObject l = ls.optJSONObject(i);
            if (l == null) continue;
            JSONArray items = l.optJSONArray("it");
            if (items == null) continue;
            for (int k = 0; k < items.length(); k++) {
                JSONObject it = items.optJSONObject(k);
                if (it == null || !itemId.equals(it.optString("i"))) continue;
                try {
                    int cur = it.optInt("d") == 1 ? 1 : 0;
                    if (cur != state) {
                        it.put("d", state);
                        int t = l.optInt("t"), d = l.optInt("d");
                        int nd = Math.max(0, Math.min(t, d + (state == 1 ? 1 : -1)));
                        l.put("d", nd);
                        JSONArray rows = data.optJSONArray("items");
                        String lid = l.optString("id");
                        if (rows != null) {
                            for (int r = 0; r < rows.length(); r++) {
                                JSONObject row = rows.optJSONObject(r);
                                if (row != null && lid.equals(row.optString("li"))) row.put("ld", nd);
                            }
                        }
                    }
                } catch (Exception ignored) {}
                return true;
            }
        }
        return false;
    }

    /**
     * Tocco su una voce dal widget: inverte il suo stato nel JSON salvato, accoda la modifica
     * in "li_q" (con l'istante "at") e ridisegna tutti i widget. Id vuoti o più lunghi di 64
     * caratteri vengono ignorati.
     */
    static synchronized void toggle(Context c, String itemId) {
        if (itemId == null || itemId.isEmpty() || itemId.length() > ID_MAX) return;
        SharedPreferences p = KalendWidget.prefs(c);
        JSONObject data = KalendWidget.data(c);
        if (data == null) return;
        int newState = toggledState(data, itemId);
        if (newState < 0 || !setState(data, itemId, newState)) return;
        // NOTA RICOSTRUZIONE: il try/catch non è visibile nel decompilato (metodo synchronized), ma
        // new JSONArray/put lanciano eccezioni controllate e KalendWidget chiama toggle senza gestirle.
        try {
            String q = enqueue(p.getString(KEY_QUEUE, "[]"), itemId, newState, System.currentTimeMillis());
            p.edit().putString(KEY_WIDGET, data.toString()).putString(KEY_QUEUE, q).apply();
            KalendWidget.updateAll(c);
        } catch (Exception ignored) {}
    }

    /**
     * Lo stato che una voce avrà dopo un tocco: 0 se ora è fatta, 1 se è da fare,
     * -1 se la voce non esiste nel JSON (allora il tocco non fa nulla).
     */
    static int toggledState(JSONObject data, String itemId) {
        JSONArray ls = lists(data);
        for (int i = 0; ls != null && itemId != null && i < ls.length(); i++) {
            JSONObject l = ls.optJSONObject(i);
            JSONArray items = l != null ? l.optJSONArray("it") : null;
            for (int k = 0; items != null && k < items.length(); k++) {
                JSONObject it = items.optJSONObject(k);
                if (it != null && itemId.equals(it.optString("i"))) return it.optInt("d") == 1 ? 0 : 1;
            }
        }
        return -1;
    }

    /**
     * Aggiunge una spunta alla coda verso la pagina ({t: voce, d: stato, at: istante}) e la
     * accorcia alle ultime {@link #QUEUE_MAX} voci. Ritorna la coda come testo JSON.
     */
    static String enqueue(String queueJson, String itemId, int state, long at) throws org.json.JSONException {
        JSONArray q = new JSONArray(queueJson == null ? "[]" : queueJson);
        q.put(new JSONObject().put("t", itemId).put("d", state).put("at", at));
        while (q.length() > QUEUE_MAX) q.remove(0);
        return q.toString();
    }
}
