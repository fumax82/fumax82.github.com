package app.kalend;

import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.text.style.RelativeSizeSpan;
import android.text.style.StyleSpan;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * SERVIZIO DELLA LISTA DEL WIDGET PRINCIPALE.
 *
 * Il widget grande (KalendWidget) mostra, sotto il titolo, una lista scorrevole:
 *  · in modalità "agenda" le righe sono intestazioni di giorno + eventi (layout widget_row_day / widget_row_ev);
 *  · in modalità "month" le righe sono le celle di una griglia 7 colonne (intestazioni dei giorni della
 *    settimana + 35/42 celle, layout widget_cell).
 *
 * Android chiede le righe a questo servizio (RemoteViewsService): per ogni widget crea una {@link Factory}
 * che legge il JSON "widget" salvato dalla pagina web nelle SharedPreferences "kalend"
 * (tramite {@link KalendWidget#data(Context)}), lo trasforma in una lista di {@link Row} e disegna ogni riga.
 *
 * KalendWidget passa nell'Intent l'id del widget ("appWidgetId") e la modalità ("mode");
 * KalendWidget.onReceive e WidgetPreviewActivity costruiscono direttamente una Factory per leggere le righe
 * (es. per trovare la musica del prossimo evento o per l'anteprima a tutto schermo).
 */
public class WidgetService extends RemoteViewsService {

    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new Factory(getApplicationContext(), intent.getIntExtra("appWidgetId", 0), intent.getStringExtra("mode"));
    }

    /**
     * UNA RIGA DELLA LISTA. È un semplice contenitore di dati (nessuna logica): i campi hanno nomi brevi
     * perché ricalcano le chiavi del JSON prodotto dalla pagina web (t = titolo, l = luogo, c = colore…).
     * Usata anche da WidgetPreviewActivity.
     */
    static final class Row {
        /** tipo di riga: intestazione di giorno (agenda) o del giorno della settimana (mese) */
        static final int TYPE_HEADER = 0;
        /** cella della griglia mensile */
        static final int TYPE_CELL = 1;
        /** evento in agenda */
        static final int TYPE_EVENT = 2;

        int type;
        /** data "aaaa-mm-gg" a cui appartiene la riga */
        String k;
        /** testo delle intestazioni e numero del giorno nelle celle del mese */
        String label;
        /** id univoco stabile per la ListView (calcolato alla fine di onDataSetChanged) */
        long uid;

        // --- dati dell'evento ---
        String title;
        String loc;
        int color;
        boolean hol;          // festività
        String m;             // musica (url o nome) legata all'evento
        String f;             // famiglia / persona
        String pp;            // persone
        String tg;            // tag "#..."
        String rm;            // promemoria
        int st = -1;          // inizio in minuti dalla mezzanotte (-1 = tutto il giorno)
        int en = -1;          // fine in minuti dalla mezzanotte
        String d;             // descrizione
        String pr;            // priorità: "urgent" / "important" / ""
        String li;            // nome della lista di cose da fare collegata
        int ld;               // voci della lista già fatte
        int ln;               // voci della lista in totale
        String ch;            // catena ("chain") di eventi collegati
        String eid;           // id dell'evento nella pagina
        String fi;            // iniziale / emoji della famiglia mostrata nel cerchietto
        String time;          // orario già formattato ("09:00\n10:30", "★", "—")

        // --- bande laterali mese/settimana (modalità agenda) ---
        int mo = -1;          // mese assoluto (anno*12 + mese), -1 = riga senza bande
        String wkKey;         // data del lunedì (o primo giorno) della settimana
        int wk;               // numero della settimana; il segno alterna di settimana in settimana
        int wkMo;             // mese a cui appartiene l'inizio della settimana
        boolean moTop, moBot; // la banda del mese inizia / finisce su questa riga
        boolean wkTop, wkBot; // la banda della settimana inizia / finisce su questa riga
        boolean curWk;        // la riga è nella settimana corrente
        String moLab = "";    // etichetta verticale del mese ("O\nT\nT"), solo su una riga per mese
        String wkLab = "";    // numero della settimana, solo su una riga per settimana

        // --- celle del mese ---
        boolean today;
        boolean other;        // giorno di un altro mese
        boolean wknd;         // fine settimana
        List<Integer> dots;   // colori degli eventi del giorno (max 4)
    }

    /**
     * COSTRUISCE E DISEGNA LE RIGHE. Android la crea una volta per widget e chiama
     * onDataSetChanged() ogni volta che KalendWidget.refreshList segnala che i dati sono cambiati.
     */
    static final class Factory implements RemoteViewsFactory {
        /** colori delle bande laterali dei mesi (gennaio → dicembre) */
        static final int[] MO_COL = {
            0xFF5B8DEF, 0xFF9071E8, 0xFF3DB57F, 0xFFE57BA8, 0xFFE8B23E, 0xFF2CB3CF,
            0xFFF07A52, 0xFFF2A03D, 0xFFB48A4E, 0xFFE0703F, 0xFF8A7FC4, 0xFFD94A5C
        };

        /** limiti della lista agenda: giorni esaminati e righe massime */
        static final int MAX_DAYS = 120;
        static final int MAX_ROWS = 160;
        /** celle della griglia mensile (6 settimane) */
        static final int MONTH_CELLS = 42;
        /** punti colorati massimi per cella del mese */
        static final int MAX_DOTS = 4;

        /** colori usati nelle righe */
        static final int COL_WK_CUR = 0xFFF2B233;       // settimana corrente (banda e pillola)
        static final int COL_WK_OTHER = 0xFFC9D2E6;     // altre settimane (banda)
        static final int COL_WK_PILL = 0xFF4A5778;      // altre settimane (pillola)
        static final int COL_DAY_PREFIX = 0xFFFFD27A;   // "OGGI ·" nell'intestazione del giorno
        static final int COL_TIME_END = 0x8CFFFFFF;     // ora di fine, più tenue
        static final int COL_CELL_WKND = 0xFFFFC2B0;    // fine settimana nel mese
        static final int COL_CELL_HOL = 0xFFFF9EAE;     // festività nel mese
        static final int COL_CELL_OTHER = 0x66FFFFFF;   // giorni di un altro mese
        static final int COL_CELL_HEAD = 0xCCFFFFFF;    // intestazioni dei giorni della settimana

        /** altezze stimate (dp) delle righe, usate per centrare le etichette delle bande */
        static final float H_EVENT_SMALL = 56f;
        static final float H_EVENT_FULL = 70f;
        static final float H_HEADER = 30f;

        final Context c;
        final int id;
        final String mode;
        final List<Row> rows = new ArrayList<>();

        Factory(Context c, int id, String mode) {
            this.c = c;
            this.id = id;
            this.mode = mode == null ? "agenda" : mode;
        }

        // ------------------------------------------------------------------ funzioni di servizio

        /** "#RRGGBB" → colore; bianco se il testo non è un colore valido */
        static int col(String s) {
            try {
                return Color.parseColor(s);
            } catch (Exception e) {
                return Color.WHITE;
            }
        }

        /** altezza stimata della riga (dp) */
        static float estH(Row r) {
            if (r.type != Row.TYPE_EVENT) return H_HEADER;
            boolean noLoc = r.loc == null || r.loc.isEmpty();
            boolean noDur = r.st < 0 || r.en <= r.st;
            boolean noChain = r.ch == null || r.ch.isEmpty();
            return (noLoc && noDur && noChain) ? H_EVENT_SMALL : H_EVENT_FULL;
        }

        /** minuti dalla mezzanotte → "09:05" oppure "9:05 am" se h12 */
        static String fmt(int min, boolean h12) {
            int h = (min / 60) % 24;
            int m = min % 60;
            if (h12) {
                int h12v = h % 12;
                if (h12v == 0) h12v = 12;
                return String.format(Locale.ROOT, "%d:%02d %s", h12v, m, h >= 12 ? "pm" : "am");
            }
            return String.format(Locale.ROOT, "%02d:%02d", h, m);
        }

        /** il giorno della settimana (0 = domenica … 6 = sabato) è fine settimana? */
        static boolean isWk(JSONArray weekend, int dow) {
            if (weekend != null) {
                for (int i = 0; i < weekend.length(); i++) if (weekend.optInt(i) == dow) return true;
                return false;
            }
            return dow == 0 || dow == 6;
        }

        /** chiave data "aaaa-mm-gg" di un Calendar (usata anche da KalendWidget e WidgetPreviewActivity) */
        static String key(Calendar cal) {
            return String.format(Locale.ROOT, "%04d-%02d-%02d",
                    cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1, cal.get(Calendar.DAY_OF_MONTH));
        }

        /** schiarisce un colore (per i puntini del mese) */
        static int lighten(int col) {
            return Color.rgb(Math.min(255, Color.red(col) + 70), Math.min(255, Color.green(col) + 70),
                    Math.min(255, Color.blue(col) + 70));
        }

        /** immagine della banda laterale a seconda che la riga sia l'inizio e/o la fine del gruppo */
        static int railRes(boolean top, boolean bot) {
            if (top && bot) return R.drawable.w_rl_one;
            if (top) return R.drawable.w_rl_top;
            if (bot) return R.drawable.w_rl_bot;
            return R.drawable.w_rl_mid;
        }

        /** disegna le due bande laterali (mese e settimana) con le relative pillole-etichetta */
        static void strips(RemoteViews v, Row r) {
            if (r.mo == -1) {
                v.setViewVisibility(R.id.r_mo_ln, View.GONE);
                v.setViewVisibility(R.id.r_wk_ln, View.GONE);
                v.setViewVisibility(R.id.r_mo_pill, View.GONE);
                v.setViewVisibility(R.id.r_wk_pill, View.GONE);
                return;
            }
            int moCol = MO_COL[r.mo % 12];
            int wkCol = r.curWk ? COL_WK_CUR : COL_WK_OTHER;
            v.setViewVisibility(R.id.r_mo_ln, View.VISIBLE);
            v.setViewVisibility(R.id.r_wk_ln, View.VISIBLE);
            v.setImageViewResource(R.id.r_mo_ln, railRes(r.moTop, r.moBot));
            v.setInt(R.id.r_mo_ln, "setColorFilter", moCol);
            v.setInt(R.id.r_mo_ln, "setImageAlpha", 210);
            v.setImageViewResource(R.id.r_wk_ln, railRes(r.wkTop, r.wkBot));
            v.setInt(R.id.r_wk_ln, "setColorFilter", wkCol);
            v.setInt(R.id.r_wk_ln, "setImageAlpha", r.curWk ? 230 : 110);

            if (r.moLab == null || r.moLab.isEmpty()) {
                v.setViewVisibility(R.id.r_mo_pill, View.GONE);
            } else {
                v.setViewVisibility(R.id.r_mo_pill, View.VISIBLE);
                v.setInt(R.id.r_mo_pbg, "setColorFilter", moCol);
                v.setTextViewText(R.id.r_mo, r.moLab);
            }

            if (r.wkLab == null || r.wkLab.isEmpty()) {
                v.setViewVisibility(R.id.r_wk_pill, View.GONE);
                return;
            }
            v.setViewVisibility(R.id.r_wk_pill, View.VISIBLE);
            v.setInt(R.id.r_wk_pbg, "setColorFilter", r.curWk ? COL_WK_CUR : COL_WK_PILL);
            // "wk" (o ★ per la settimana corrente) piccolo, numero più grande sotto
            String txt = (r.curWk ? "★" : "wk") + "\n" + r.wkLab;
            SpannableStringBuilder sb = new SpannableStringBuilder(txt);
            int split = sb.length() - r.wkLab.length();
            sb.setSpan(new RelativeSizeSpan(0.78f), 0, split, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            sb.setSpan(new RelativeSizeSpan(1.15f), split, sb.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            v.setTextViewText(R.id.r_wk, sb);
        }

        // ------------------------------------------------------------------ RemoteViewsFactory

        @Override public int getCount() { return rows.size(); }

        @Override
        public long getItemId(int pos) {
            return pos >= rows.size() ? pos : rows.get(pos).uid;
        }

        @Override
        public RemoteViews getLoadingView() {
            return new RemoteViews(c.getPackageName(), "month".equals(mode) ? R.layout.widget_cell : R.layout.widget_row_day);
        }

        @Override public int getViewTypeCount() { return 3; }
        @Override public boolean hasStableIds() { return true; }
        @Override public void onCreate() {}
        @Override public void onDestroy() { rows.clear(); }

        /** disegna la riga in posizione pos */
        @Override
        public RemoteViews getViewAt(int pos) {
            if (pos >= rows.size()) return null;
            Row r = rows.get(pos);
            // Intent "di riempimento": completa il modello di PendingIntent impostato da KalendWidget
            Intent fill = new Intent();
            if (r.k != null) fill.putExtra("date", r.k);

            if ("month".equals(mode)) return monthCell(r, fill);

            fill.putExtra("row", pos);
            if (r.eid != null && !r.eid.isEmpty()) fill.putExtra("eid", r.eid);
            if (r.type == Row.TYPE_HEADER) return dayHeader(r, fill);
            return eventRow(r, fill);
        }

        /** cella della griglia mensile (intestazione del giorno della settimana o giorno) */
        private RemoteViews monthCell(Row r, Intent fill) {
            RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_cell);
            v.setTextViewText(R.id.c_num, r.label);
            if (r.type == Row.TYPE_HEADER) {
                v.setTextColor(R.id.c_num, r.wknd ? COL_CELL_WKND : COL_CELL_HEAD);
                v.setTextViewTextSize(R.id.c_num, TypedValue.COMPLEX_UNIT_SP, 10f);
                v.setTextViewText(R.id.c_dots, "");
                return v;
            }
            int col;
            if (r.other) col = COL_CELL_OTHER;
            else if (r.hol) col = COL_CELL_HOL;
            else if (r.wknd) col = COL_CELL_WKND;
            else col = Color.WHITE;
            if (r.today) col = Color.WHITE;
            v.setTextColor(R.id.c_num, col);
            v.setInt(R.id.c_num, "setBackgroundResource", r.today ? R.drawable.w_today_bg : 0);
            SpannableStringBuilder dots = new SpannableStringBuilder();
            for (Integer dc : r.dots) {
                int start = dots.length();
                dots.append("●");
                dots.setSpan(new ForegroundColorSpan(lighten(dc)), start, start + 1, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            }
            v.setTextViewText(R.id.c_dots, dots);
            v.setOnClickFillInIntent(R.id.c_box, fill);
            return v;
        }

        /** intestazione di un giorno in agenda ("OGGI · LUNEDÌ 3 OTTOBRE") */
        private RemoteViews dayHeader(Row r, Intent fill) {
            RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_row_day);
            String lab = r.label == null ? "" : r.label.toUpperCase(Locale.getDefault());
            SpannableStringBuilder sb = new SpannableStringBuilder(lab);
            int sep = lab.indexOf(" · ");
            if (sep > 0) sb.setSpan(new ForegroundColorSpan(COL_DAY_PREFIX), 0, sep, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            v.setTextViewText(R.id.r_day, sb);
            strips(v, r);
            v.setOnClickFillInIntent(R.id.r_day, fill);
            return v;
        }

        /** riga di un evento in agenda */
        private RemoteViews eventRow(Row r, Intent fill) {
            RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_row_ev);
            strips(v, r);

            // cerchietto della famiglia
            if (r.fi == null || r.fi.isEmpty()) {
                v.setViewVisibility(R.id.r_fam, View.GONE);
            } else {
                v.setTextViewText(R.id.r_fam, r.fi);
                v.setViewVisibility(R.id.r_fam, View.VISIBLE);
            }

            // barra e alone del colore dell'evento
            v.setInt(R.id.r_bar, "setColorFilter", r.color);
            v.setInt(R.id.r_glow, "setColorFilter", r.color);
            v.setInt(R.id.r_glow, "setImageAlpha", 46);

            // durata: "45′" oppure "1h30"
            String dur = "";
            if (r.st >= 0 && r.en > r.st) {
                int mins = r.en - r.st;
                if (mins < 60) {
                    dur = mins + "′";
                } else {
                    int rem = mins % 60;
                    dur = (mins / 60) + "h" + (rem > 0 ? String.format(Locale.ROOT, "%02d", rem) : "");
                }
            }

            // riga "meta": luogo · durata   ⛓catena   ☑ fatte/totali
            boolean hasLoc = r.loc != null && !r.loc.isEmpty();
            String meta = (hasLoc ? r.loc : "") + (dur.isEmpty() ? "" : (hasLoc ? "  ·  " : "") + dur);
            meta = meta.trim();
            if (r.ch != null && !r.ch.isEmpty()) {
                meta = (meta + "   ⛓" + r.ch.split(" ")[0].split("·")[0]).trim();
            }
            if (r.li != null && !r.li.isEmpty() && r.ln > 0) {
                meta = (meta + "   ☑ " + r.ld + "/" + r.ln).trim();
            }
            v.setTextViewText(R.id.r_meta, meta);
            v.setViewVisibility(R.id.r_meta, meta.isEmpty() ? View.GONE : View.VISIBLE);

            // distintivo "ORA" se l'evento è in corso adesso
            String badge = "";
            if (r.k != null && r.k.equals(key(Calendar.getInstance())) && r.st >= 0) {
                Calendar now = Calendar.getInstance();
                int nowMin = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
                if (nowMin >= r.st && (r.en < 0 || nowMin < r.en)) badge = "ORA";
            }
            v.setTextViewText(R.id.r_badge, badge);
            v.setViewVisibility(R.id.r_badge, badge.isEmpty() ? View.GONE : View.VISIBLE);
            v.setInt(R.id.r_badge, "setBackgroundResource", "ORA".equals(badge) ? R.drawable.w_badge_now : R.drawable.w_badge_bg);

            // orario: la seconda riga (ora di fine) più piccola e tenue
            String time = r.time != null ? r.time : "";
            SpannableStringBuilder ts = new SpannableStringBuilder(time);
            int nl = time.indexOf('\n');
            if (nl > 0) {
                ts.setSpan(new RelativeSizeSpan(0.8f), nl, time.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                ts.setSpan(new ForegroundColorSpan(COL_TIME_END), nl, time.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            }
            v.setTextViewText(R.id.r_time, ts);
            v.setInt(R.id.r_ev, "setBackgroundResource", R.drawable.w_row_bg);

            // titolo con simbolo di priorità; in corsivo se festività
            String pre = "urgent".equals(r.pr) ? "❗ " : "important".equals(r.pr) ? "◆ " : "";
            SpannableStringBuilder title = new SpannableStringBuilder("" + pre + r.title);
            if (r.hol) title.setSpan(new StyleSpan(Typeface.ITALIC), 0, title.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            v.setTextViewText(R.id.r_title, title);
            v.setViewVisibility(R.id.r_loc, View.GONE);
            v.setViewVisibility(R.id.r_place, View.GONE);

            // lista di cose da fare collegata: icona + barra di avanzamento
            if (r.li == null || r.li.isEmpty() || r.ln <= 0) {
                v.setViewVisibility(R.id.r_list, View.GONE);
                v.setViewVisibility(R.id.r_lp, View.GONE);
            } else {
                v.setViewVisibility(R.id.r_list, View.VISIBLE);
                int icon = r.ld < r.ln ? (r.ld <= 0 ? R.drawable.w_li_todo : R.drawable.w_li_doing) : R.drawable.w_li_done;
                v.setImageViewResource(R.id.r_list, icon);
                Intent li = new Intent();
                li.putExtra("list", r.li);
                if (r.k != null) li.putExtra("date", r.k);
                v.setOnClickFillInIntent(R.id.r_list, li);
                v.setViewVisibility(R.id.r_lp, View.VISIBLE);
                v.setProgressBar(R.id.r_lp, 100, Math.round(r.ld * 100f / r.ln), false);
            }
            v.setOnClickFillInIntent(R.id.r_ev, fill);
            return v;
        }

        // ------------------------------------------------------------------ costruzione delle righe

        /** rilegge il JSON e ricostruisce tutte le righe */
        @Override
        public void onDataSetChanged() {
            rows.clear();
            JSONObject data = KalendWidget.data(c);
            if (data == null) return;

            JSONArray items = data.optJSONArray("items");
            JSONObject s = data.optJSONObject("s");          // testi tradotti ("today", "tomorrow", "allDay"…)
            JSONArray wdFull = data.optJSONArray("wdFull");   // nomi completi dei giorni (domenica = 0)
            JSONArray wdShort = data.optJSONArray("wdShort"); // nomi brevi dei giorni
            JSONArray months = data.optJSONArray("months");   // nomi dei mesi
            boolean h12 = data.optBoolean("h12", false);
            int off = KalendWidget.offset(c, id);
            String fq = KalendWidget.prefs(c).getString("w_fq_" + id, "").trim().toLowerCase();   // filtro testo
            String ftg = KalendWidget.prefs(c).getString("w_ftg_" + id, "").trim().toLowerCase(); // filtro tag

            // eventi raggruppati per data
            Map<String, List<JSONObject>> byDay = new HashMap<>();
            if (items != null) {
                for (int i = 0; i < items.length(); i++) {
                    JSONObject o = items.optJSONObject(i);
                    if (o == null) continue;
                    List<JSONObject> l = byDay.get(o.optString("k"));
                    if (l == null) {
                        l = new ArrayList<>();
                        byDay.put(o.optString("k"), l);
                    }
                    l.add(o);
                }
            }

            Calendar now = Calendar.getInstance();
            String todayKey = key(now);
            int nowMin = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
            JSONArray weekend = data.optJSONArray("weekend");

            if (!"month".equals(mode)) {
                buildAgenda(data, s, wdFull, months, h12, off, fq, ftg, byDay, todayKey, nowMin);
            } else {
                buildMonth(data, wdShort, off, byDay, todayKey, weekend);
            }

            if (!"month".equals(mode)) {
                alternateWeekSign();
                placeStripLabels(months);
                markStripEnds(data);
            }

            // id stabili: hash della firma della riga, più un contatore per le righe identiche
            Map<String, Integer> seen = new HashMap<>();
            for (Row r : rows) {
                String sig = r.type + "|" + r.k + "|" + r.st + "|" + r.title + "|" + r.label;
                Integer prev = seen.get(sig);
                int n = prev == null ? 0 : prev + 1;
                seen.put(sig, n);
                r.uid = ((long) n) ^ (((long) sig.hashCode()) << 8);
            }
        }

        /** modalità agenda: fino a 120 giorni a partire da oggi + offset settimane */
        private void buildAgenda(JSONObject data, JSONObject s, JSONArray wdFull, JSONArray months, boolean h12, int off,
                                 String fq, String ftg, Map<String, List<JSONObject>> byDay, String todayKey, int nowMin) {
            Calendar day = Calendar.getInstance();
            int dayOff = off * 7;
            day.add(Calendar.DAY_OF_MONTH, dayOff);
            for (int i = 0; i < MAX_DAYS; i++, day.add(Calendar.DAY_OF_MONTH, 1)) {
                if (rows.size() >= MAX_ROWS) break;
                String k = key(day);
                List<JSONObject> evs = byDay.get(k);
                if (evs == null || evs.isEmpty()) continue;

                List<Row> dayRows = new ArrayList<>();
                for (JSONObject o : evs) {
                    int st = o.optInt("s", -1);
                    int en = o.optInt("e", -1);
                    // gli eventi di oggi già finiti non si mostrano
                    if (k.equals(todayKey) && en >= 0 && en < nowMin) continue;
                    if (!fq.isEmpty()) {
                        String hay = o.optString("t") + " " + o.optString("l") + " " + o.optString("pp") + " " + o.optString("tg");
                        if (!hay.toLowerCase().contains(fq)) continue;
                    }
                    if (!ftg.isEmpty()) {
                        String tags = " " + o.optString("tg").toLowerCase() + " ";
                        if (!tags.contains(" #" + ftg + " ")) continue;
                    }
                    Row r = new Row();
                    r.type = Row.TYPE_EVENT;
                    r.k = k;
                    r.title = o.optString("t");
                    r.loc = o.optString("l", "");
                    r.color = col(o.optString("c"));
                    r.hol = o.optInt("h", 0) == 1;
                    r.m = o.optString("m", "");
                    r.f = o.optString("f", "");
                    r.pp = o.optString("pp", "");
                    r.tg = o.optString("tg", "");
                    r.rm = o.optString("rm", "");
                    r.st = st;
                    r.en = en;
                    r.d = o.optString("d", "");
                    r.pr = o.optString("pr", "");
                    r.li = o.optString("li", "");
                    r.ld = o.optInt("ld", 0);
                    r.ln = o.optInt("ln", 0);
                    r.ch = o.optString("ch", "");
                    r.eid = o.optString("id", "");
                    r.fi = o.optString("fi", "");
                    if (r.fi.isEmpty() && !o.optString("f", "").isEmpty() && !o.optString("tg", "").isEmpty()) {
                        r.fi = o.optString("f").split(" ")[0];
                    }
                    if (st < 0) {
                        r.time = r.hol ? "★" : (s == null ? "—" : s.optString("allDay", "—"));
                    } else {
                        r.time = fmt(st, h12) + (en > st ? "\n" + fmt(en, h12) : "");
                    }
                    dayRows.add(r);
                }
                if (dayRows.isEmpty()) continue;

                // intestazione del giorno: "[oggi · ]lunedì 3 ottobre"
                Row hdr = new Row();
                hdr.type = Row.TYPE_HEADER;
                hdr.k = k;
                int dayIdx = i + dayOff;
                String wd = wdFull == null ? "" : wdFull.optString(day.get(Calendar.DAY_OF_WEEK) - 1);
                String mn = months == null ? "" : months.optString(day.get(Calendar.MONTH));
                String pre = "";
                if (dayIdx == 0 && s != null) pre = s.optString("today") + " · ";
                else if (dayIdx == 1 && s != null) pre = s.optString("tomorrow") + " · ";
                hdr.label = pre + wd + " " + day.get(Calendar.DAY_OF_MONTH) + " " + mn;

                // mese e settimana di appartenenza (per le bande laterali)
                int firstDow = data.optInt("firstDow", 1);
                Calendar weekStart = (Calendar) day.clone();
                weekStart.add(Calendar.DAY_OF_MONTH, -(((day.get(Calendar.DAY_OF_WEEK) - 1) - firstDow + 7) % 7));
                Calendar wc = (Calendar) day.clone();
                wc.setFirstDayOfWeek(firstDow != 0 ? Calendar.MONDAY : Calendar.SUNDAY);
                wc.setMinimalDaysInFirstWeek(firstDow == 1 ? 4 : 1);  // settimane ISO se si parte dal lunedì
                hdr.mo = day.get(Calendar.MONTH) + day.get(Calendar.YEAR) * 12;
                hdr.wkKey = key(weekStart);
                hdr.wk = wc.get(Calendar.WEEK_OF_YEAR);
                for (Row r : dayRows) {
                    r.mo = hdr.mo;
                    r.wkKey = hdr.wkKey;
                    r.wk = hdr.wk;
                }
                rows.add(hdr);
                rows.addAll(dayRows);
            }
        }

        /** modalità mese: 7 intestazioni + celle del mese (offset mesi rispetto a quello corrente) */
        private void buildMonth(JSONObject data, JSONArray wdShort, int off, Map<String, List<JSONObject>> byDay,
                                String todayKey, JSONArray weekend) {
            int firstDow = data.optInt("firstDow", 1);
            Calendar first = Calendar.getInstance();
            first.set(Calendar.DAY_OF_MONTH, 1);
            first.add(Calendar.MONTH, off);
            int month = first.get(Calendar.MONTH);

            for (int i = 0; i < 7; i++) {
                Row h = new Row();
                h.type = Row.TYPE_HEADER;
                h.label = wdShort == null ? "" : wdShort.optString((firstDow + i) % 7);
                if (h.label.length() > 3) h.label = h.label.substring(0, 3);
                h.wknd = isWk(weekend, (firstDow + i) % 7);
                rows.add(h);
            }

            Calendar d = (Calendar) first.clone();
            d.add(Calendar.DAY_OF_MONTH, -(((d.get(Calendar.DAY_OF_WEEK) - 1) - firstDow + 7) % 7));
            for (int i = 0; i < MONTH_CELLS; i++) {
                Row r = new Row();
                r.type = Row.TYPE_CELL;
                r.k = key(d);
                r.label = String.valueOf(d.get(Calendar.DAY_OF_MONTH));
                r.today = r.k.equals(todayKey);
                r.other = d.get(Calendar.MONTH) != month;
                r.wknd = isWk(weekend, d.get(Calendar.DAY_OF_WEEK) - 1);
                r.dots = new ArrayList<>();
                List<JSONObject> evs = byDay.get(r.k);
                if (evs != null) {
                    for (JSONObject o : evs) {
                        if (o.optInt("h", 0) == 1) r.hol = true;
                        else if (r.dots.size() < MAX_DOTS) r.dots.add(col(o.optString("c")));
                    }
                }
                rows.add(r);
                d.add(Calendar.DAY_OF_MONTH, 1);
                // bastano 5 settimane se la sesta non contiene giorni del mese
                if (i == 34 && d.get(Calendar.MONTH) != month) break;
            }
        }

        /** il numero della settimana cambia segno a settimane alterne (serve a chi disegna le bande) */
        private void alternateWeekSign() {
            int n = 0;
            String lastWk = null;
            for (Row r : rows) {
                if (r.mo == -1) continue;
                if (!r.wkKey.equals(lastWk)) {
                    lastWk = r.wkKey;
                    n++;
                }
                r.wk = (n % 2 != 0 ? 1 : -1) * Math.abs(r.wk);
            }
        }

        /**
         * Sceglie, per ogni gruppo di righe dello stesso mese (passata 0) e della stessa settimana (passata 1),
         * l'evento più vicino al centro verticale del gruppo e gli assegna l'etichetta (moLab / wkLab).
         */
        private void placeStripLabels(JSONArray months) {
            for (int pass = 0; pass < 2; pass++) {
                int start = -1;
                for (int i = 0; i <= rows.size(); i++) {
                    Row r = i < rows.size() ? rows.get(i) : null;
                    if (r != null && r.mo != -1 && start >= 0) {
                        Row first = rows.get(start);
                        boolean same = pass == 0 ? first.mo == r.mo : first.wkKey.equals(r.wkKey);
                        if (same) continue;   // il gruppo prosegue
                    }
                    if (start >= 0) {
                        // chiude il gruppo [start, i)
                        float total = 0f;
                        for (int j = start; j < i; j++) total += estH(rows.get(j));
                        float acc = 0f, best = 1e9f;
                        int bestIdx = -1;
                        for (int j = start; j < i; j++) {
                            Row rj = rows.get(j);
                            float h = estH(rj);
                            float centre = acc + h / 2f;
                            acc += h;
                            if (rj.type == Row.TYPE_EVENT) {
                                float diff = centre - total / 2f;
                                if (Math.abs(diff) < best) {
                                    best = Math.abs(diff);
                                    bestIdx = j;
                                }
                            }
                        }
                        if (bestIdx >= 0) {
                            Row target = rows.get(bestIdx);
                            if (pass == 0) {
                                String mn = months == null ? "" : months.optString(target.mo % 12);
                                if (mn.length() > 3) mn = mn.substring(0, 3);
                                StringBuilder sb = new StringBuilder();
                                for (char ch : mn.toUpperCase(Locale.ROOT).toCharArray()) {
                                    if (sb.length() > 0) sb.append('\n');
                                    sb.append(ch);
                                }
                                target.moLab = sb.toString();
                            } else {
                                target.wkLab = String.valueOf(Math.abs(target.wk));
                            }
                        }
                    }
                    start = (r != null && r.mo != -1) ? i : -1;
                }
            }
        }

        /** calcola dove iniziano/finiscono le bande e quale settimana è quella corrente */
        private void markStripEnds(JSONObject data) {
            Calendar c0 = Calendar.getInstance();
            c0.add(Calendar.DAY_OF_MONTH, -(((c0.get(Calendar.DAY_OF_WEEK) - 1) - data.optInt("firstDow", 1) + 7) % 7));
            String curWkKey = key(c0);
            Row prev = null;
            for (Row r : rows) {
                if (r.mo == -1) continue;
                r.moTop = prev == null || prev.mo != r.mo;
                r.wkTop = prev == null || !prev.wkKey.equals(r.wkKey);
                r.curWk = r.wkKey.equals(curWkKey);
                r.wkMo = r.wkTop ? r.mo : prev.wkMo;
                if (prev != null) {
                    prev.moBot = r.moTop;
                    prev.wkBot = r.wkTop;
                }
                prev = r;
            }
            if (prev != null) {
                prev.moBot = true;
                prev.wkBot = true;
            }
        }
    }
}
