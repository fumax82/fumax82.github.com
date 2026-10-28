package app.kalend;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.widget.EditText;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * FINESTRA "FILTRA IL WIDGET".
 *
 * È una piccola finestra di dialogo (nel manifest usa il tema
 * Theme.DeviceDefault.Dialog.NoActionBar) che si apre toccando l'icona
 * dell'imbuto sul widget agenda ({@link KalendWidget} la lancia con l'extra
 * "appWidgetId"). Permette di mostrare nel widget solo gli eventi che
 * contengono una parola (titolo, luogo, persone…) e/o che hanno un certo tag.
 *
 * Tutta l'interfaccia è costruita in codice, non da un layout XML: una
 * "card" con titolo, sottotitolo, casella di testo, una riga scorrevole di
 * "chip" con i tag trovati negli eventi (ordinati per frequenza) e i due
 * pulsanti Cancella / Applica.
 *
 * Collegamenti con il resto dell'app:
 *  · legge e scrive le preferenze del widget tramite {@link KalendWidget#prefs}
 *    con le chiavi "w_fq_<id>" (parola cercata) e "w_ftg_<id>" (tag scelto);
 *  · prende l'elenco degli eventi da {@link KalendWidget#data} (campo "items",
 *    i tag sono nel campo "tg" di ogni evento);
 *  · dopo il salvataggio ridisegna il widget con {@link KalendWidget#render}
 *    e avvisa le liste remote (w_list, w_grid) che i dati sono cambiati.
 */
public class WidgetFilterActivity extends Activity {

    /** Prefisso della chiave preferenze con la parola da cercare (seguita dall'id del widget). */
    private static final String PREF_QUERY = "w_fq_";
    /** Prefisso della chiave preferenze con il tag selezionato (seguita dall'id del widget). */
    private static final String PREF_TAG = "w_ftg_";
    /** Extra dell'Intent con l'id del widget da configurare. */
    private static final String EXTRA_WIDGET_ID = "appWidgetId";

    /** Colore "acqua" dell'app, inizio delle sfumature dei pulsanti. */
    private static final int ACCENT_TEAL = 0xFF2AABB8;
    /** Colore "corallo" dell'app, fine delle sfumature dei pulsanti. */
    private static final int ACCENT_CORAL = 0xFFF07856;

    /* Tavolozza di giorno (sfondo chiaro). */
    private static final int DAY_BG = 0xFFFFFBF6;
    private static final int DAY_BG_END = 0xFFFFF1EA;
    private static final int DAY_FG = 0xFF1C2333;
    private static final int DAY_MUTED = 0x991C2333;
    private static final int DAY_FIELD_FILL = 0x0D1C2333;
    private static final int DAY_FIELD_STROKE = 0x221C2333;
    private static final int DAY_CHIP_FILL = 0x0A1C2333;
    private static final int DAY_CHIP_STROKE = 0x2A1C2333;
    private static final int DAY_CLEAR_STROKE = 0x331C2333;

    /* Tavolozza di notte (sfondo scuro, segue il tema di sistema). */
    private static final int NIGHT_BG = 0xFF161D30;
    private static final int NIGHT_BG_END = 0xFF22193A;
    private static final int NIGHT_FG = 0xFFF2F4FA;
    private static final int NIGHT_MUTED = 0xB3F2F4FA;
    private static final int NIGHT_FIELD_FILL = 0x1FFFFFFF;
    private static final int NIGHT_FIELD_STROKE = 0x33FFFFFF;
    private static final int NIGHT_CHIP_FILL = 0x14FFFFFF;
    private static final int NIGHT_CHIP_STROKE = 0x40FFFFFF;
    private static final int NIGHT_CLEAR_STROKE = 0x55FFFFFF;

    /** Spessore del bordo delle "pillole" (in dp). */
    private static final float PILL_STROKE_DP = 1.2f;
    /** Larghezza massima della finestra (in dp). */
    private static final float MAX_WIDTH_DP = 460f;
    /** Margine laterale totale sottratto alla larghezza dello schermo (in dp). */
    private static final float SIDE_MARGIN_DP = 32f;

    /** Durata dell'animazione di comparsa della card (ms). */
    private static final long SHOW_ANIM_MS = 260;
    /** Durata del "rimpicciolimento" di un chip toccato (ms). */
    private static final long CHIP_PRESS_MS = 80;
    /** Durata del ritorno a dimensione normale del chip (ms). */
    private static final long CHIP_RELEASE_MS = 120;
    /** Scala a cui il chip si rimpicciolisce quando viene toccato. */
    private static final float CHIP_PRESS_SCALE = 0.92f;

    /** I chip dei tag creati, per ricolorarli quando cambia la selezione. */
    private final List<TextView> chips = new ArrayList<>();
    /** Id del widget che stiamo configurando. */
    private int id;
    /** Tag attualmente selezionato ("" = nessuno). */
    private String tagSel = "";

    /** Converte dp in pixel (arrotondati) secondo la densità dello schermo. */
    private int dp(float dp) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, dp, getResources().getDisplayMetrics()));
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        id = getIntent().getIntExtra(EXTRA_WIDGET_ID, -1);
        if (id < 0) {
            // Aperta senza un widget valido: non c'è nulla da configurare.
            finish();
            return;
        }

        // Valori già salvati per questo widget.
        SharedPreferences sp = KalendWidget.prefs(this);
        String query = sp.getString(PREF_QUERY + id, "");
        tagSel = sp.getString(PREF_TAG + id, "");

        // Tavolozza chiara o scura a seconda del tema di sistema.
        final boolean night = KalendWidget.sysNight(this);
        int bg = night ? NIGHT_BG : DAY_BG;
        final int fg = night ? NIGHT_FG : DAY_FG;
        int muted = night ? NIGHT_MUTED : DAY_MUTED;
        int bgEnd = night ? NIGHT_BG_END : DAY_BG_END;

        // La "card" che contiene tutto.
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(20), dp(18), dp(20), dp(16));
        GradientDrawable card = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[] {bg, bg, bgEnd});
        card.setCornerRadius(dp(24));
        root.setBackground(card);

        // Titolo.
        TextView title = new TextView(this);
        title.setText(getString(R.string.wf_title));
        title.setTextColor(fg);
        title.setTextSize(19f);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        root.addView(title);

        // Sottotitolo esplicativo.
        TextView sub = new TextView(this);
        sub.setText(getString(R.string.wf_sub));
        sub.setTextColor(muted);
        sub.setTextSize(12.5f);
        sub.setPadding(0, dp(2), 0, dp(12));
        root.addView(sub);

        // Casella di testo con la parola da cercare.
        final EditText input = new EditText(this);
        input.setText(query);
        input.setHint(getString(R.string.wf_hint));
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT);
        input.setImeOptions(EditorInfo.IME_ACTION_DONE);
        input.setTextColor(fg);
        input.setHintTextColor(muted);
        input.setTextSize(15f);
        input.setPadding(dp(14), dp(10), dp(14), dp(10));
        int fieldFill = night ? NIGHT_FIELD_FILL : DAY_FIELD_FILL;
        int fieldStroke = night ? NIGHT_FIELD_STROKE : DAY_FIELD_STROKE;
        input.setBackground(pill(fieldFill, fieldStroke, 14f));
        root.addView(input, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        // Conta quante volte compare ogni tag negli eventi del widget
        // (la mappa è ordinata per inserimento, poi verrà riordinata per frequenza).
        Map<String, Integer> counts = new LinkedHashMap<>();
        try {
            JSONObject data = KalendWidget.data(this);
            JSONArray items = data != null ? data.optJSONArray("items") : null;
            if (items != null) {
                for (int i = 0; i < items.length(); i++) {
                    JSONObject item = items.optJSONObject(i);
                    String tg = item != null ? item.optString("tg", "") : "";
                    for (String word : tg.split("\\s+")) {
                        String tag = word.replace("#", "").trim().toLowerCase();
                        if (tag.isEmpty()) continue;
                        Integer n = counts.get(tag);
                        counts.put(tag, n == null ? 1 : n + 1);
                    }
                }
            }
        } catch (Exception ignored) {
            // Dati del widget assenti o malformati: nessun chip.
        }
        List<Map.Entry<String, Integer>> sorted = new ArrayList<>(counts.entrySet());
        Collections.sort(sorted, (a, b) -> b.getValue() - a.getValue()); // dal più frequente

        if (!sorted.isEmpty()) {
            // Intestazione "TAG".
            TextView head = new TextView(this);
            head.setText(getString(R.string.wf_tags));
            head.setTextColor(muted);
            head.setTextSize(11f);
            head.setLetterSpacing(0.1f);
            head.setTypeface(Typeface.DEFAULT_BOLD);
            head.setPadding(0, dp(14), 0, dp(6));
            root.addView(head);

            // Riga di chip scorrevole orizzontalmente.
            HorizontalScrollView scroll = new HorizontalScrollView(this);
            scroll.setHorizontalScrollBarEnabled(false);
            LinearLayout row = new LinearLayout(this);
            row.setOrientation(LinearLayout.HORIZONTAL);
            scroll.addView(row);

            for (Map.Entry<String, Integer> e : sorted) {
                final String tag = e.getKey();
                TextView chip = new TextView(this);
                chip.setText("#" + tag);
                chip.setTag(tag);
                chip.setTextSize(13.5f);
                chip.setTypeface(Typeface.DEFAULT_BOLD);
                chip.setPadding(dp(13), dp(7), dp(13), dp(7));
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
                lp.rightMargin = dp(7);
                row.addView(chip, lp);
                chips.add(chip);
                chip.setOnClickListener(v -> onChipClick(tag, fg, ACCENT_TEAL, night, v));
            }
            root.addView(scroll);
            paint(fg, ACCENT_TEAL, night);
        }

        // Riga dei pulsanti, allineata a destra.
        LinearLayout buttons = new LinearLayout(this);
        buttons.setOrientation(LinearLayout.HORIZONTAL);
        buttons.setGravity(Gravity.END);
        buttons.setPadding(0, dp(18), 0, 0);

        // "Cancella": pillola trasparente con solo il bordo.
        TextView clear = new TextView(this);
        clear.setText(getString(R.string.wf_clear));
        clear.setTextColor(fg);
        clear.setTextSize(14.5f);
        clear.setTypeface(Typeface.DEFAULT_BOLD);
        clear.setPadding(dp(18), dp(11), dp(18), dp(11));
        int clearStroke = night ? NIGHT_CLEAR_STROKE : DAY_CLEAR_STROKE;
        clear.setBackground(pill(0, clearStroke, 14f));

        // "Applica": pillola con sfumatura acqua → corallo e un po' di ombra.
        TextView apply = new TextView(this);
        apply.setText(getString(R.string.wf_apply));
        apply.setTextColor(Color.WHITE);
        apply.setTextSize(14.5f);
        apply.setTypeface(Typeface.DEFAULT_BOLD);
        apply.setPadding(dp(22), dp(11), dp(22), dp(11));
        GradientDrawable applyBg = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[] {ACCENT_TEAL, ACCENT_CORAL});
        applyBg.setCornerRadius(dp(14));
        apply.setBackground(applyBg);
        apply.setElevation(dp(3));
        LinearLayout.LayoutParams applyLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        applyLp.leftMargin = dp(10);
        buttons.addView(clear);
        buttons.addView(apply, applyLp);
        root.addView(buttons);

        // Azioni: Cancella azzera tutto, Applica (o il tasto "Fine" della tastiera) salva.
        clear.setOnClickListener(v -> save("", ""));
        apply.setOnClickListener(v -> save(input.getText().toString(), tagSel));
        input.setOnEditorActionListener((tv, actionId, event) -> {
            save(input.getText().toString(), tagSel);
            return true;
        });

        // Finestra: larghezza limitata, sfondo trasparente (la card ha i suoi angoli arrotondati).
        setContentView(root);
        getWindow().setLayout(Math.min(getResources().getDisplayMetrics().widthPixels - dp(SIDE_MARGIN_DP), dp(MAX_WIDTH_DP)),
                ViewGroup.LayoutParams.WRAP_CONTENT);
        getWindow().setBackgroundDrawableResource(android.R.color.transparent);

        // Comparsa animata: la card sale di 18dp mentre diventa opaca.
        root.setAlpha(0f);
        root.setTranslationY(dp(18));
        root.animate().alpha(1f).translationY(0f).setDuration(SHOW_ANIM_MS).start();
    }

    /**
     * Tocco su un chip: seleziona il tag (o lo deseleziona se era già quello
     * scelto), ricolora tutti i chip e fa un piccolo "rimbalzo" sul chip toccato.
     * Il parametro {@code accent} è conservato per fedeltà all'originale ma
     * {@link #paint} usa sempre i colori fissi dell'app.
     */
    private void onChipClick(String tag, int fg, int accent, boolean night, View chip) {
        if (tag.equals(tagSel)) tag = "";
        tagSel = tag;
        paint(fg, accent, night);
        chip.animate().scaleX(CHIP_PRESS_SCALE).scaleY(CHIP_PRESS_SCALE).setDuration(CHIP_PRESS_MS)
                .withEndAction(() -> chip.animate().scaleX(1f).scaleY(1f).setDuration(CHIP_RELEASE_MS).start())
                .start();
    }

    /**
     * Ricolora i chip: quello selezionato è bianco su sfumatura acqua → corallo,
     * gli altri hanno il colore del testo normale su una pillola quasi trasparente.
     */
    private void paint(int fg, int accent, boolean night) {
        for (TextView chip : chips) {
            boolean selected = tagSel.equals(chip.getTag());
            chip.setTextColor(selected ? Color.WHITE : fg);
            if (selected) {
                GradientDrawable g = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[] {ACCENT_TEAL, ACCENT_CORAL});
                g.setCornerRadius(dp(16));
                chip.setBackground(g);
            } else {
                int fill = night ? NIGHT_CHIP_FILL : DAY_CHIP_FILL;
                int stroke = night ? NIGHT_CHIP_STROKE : DAY_CHIP_STROKE;
                chip.setBackground(pill(fill, stroke, 16f));
            }
        }
    }

    /** Crea una "pillola": rettangolo arrotondato con riempimento e, se diverso da 0, un bordo sottile. */
    private GradientDrawable pill(int fill, int stroke, float radiusDp) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(fill);
        g.setCornerRadius(dp(radiusDp));
        if (stroke != 0) g.setStroke(dp(PILL_STROKE_DP), stroke);
        return g;
    }

    /**
     * Salva parola e tag nelle preferenze del widget, ridisegna il widget,
     * avvisa le sue liste che i dati sono cambiati e chiude la finestra.
     */
    private void save(String query, String tag) {
        KalendWidget.prefs(this).edit()
                .putString(PREF_QUERY + id, query.trim().toLowerCase())
                .putString(PREF_TAG + id, tag == null ? "" : tag)
                .apply();
        AppWidgetManager mgr = AppWidgetManager.getInstance(this);
        KalendWidget.render(this, mgr, id);
        mgr.notifyAppWidgetViewDataChanged(new int[] {id}, R.id.w_list);
        mgr.notifyAppWidgetViewDataChanged(new int[] {id}, R.id.w_grid);
        finish();
    }
}
