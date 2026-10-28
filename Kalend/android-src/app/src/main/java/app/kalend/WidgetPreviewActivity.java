package app.kalend;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.GestureDetector;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;

/**
 * FINESTRA "ANTEPRIMA EVENTO" DEL WIDGET.
 *
 * Si apre toccando un evento sul widget agenda ({@link KalendWidget} la lancia
 * con gli extra "appWidgetId", "eid"/"date"/"row" per dire da quale evento
 * partire, e "listen" per l'ascolto guidato). È una finestra di dialogo
 * (tema Theme.DeviceDefault.Dialog.NoActionBar) costruita interamente in
 * codice: una card scura con icona, giorno, titolo, priorità, orario, una
 * barra della giornata ({@link DayBar}) e i dettagli (luogo, persone, tag,
 * lista, catena, promemoria, note). Si sfoglia con i pulsanti ‹ › o con uno
 * scorrimento laterale del dito; il pulsante ♪ accende la musica dell'evento
 * (tramite {@link WidgetAudio}) e ▶ avvia l'ascolto guidato, che passa da
 * solo all'evento successivo ogni {@link #ADV_MS} millisecondi per al massimo
 * {@link #MAX_MS}. "Apri in Kalend" porta all'evento dentro {@link MainActivity}.
 *
 * Se l'Intent contiene l'extra "list" (tocco su una lista del widget) la
 * finestra non viene mostrata: apre subito l'app sulla lista e si chiude.
 *
 * Gli eventi vengono presi dalla stessa fabbrica che riempie il widget
 * ({@link WidgetService.Factory} in modalità "agenda"): le righe di tipo
 * evento (type == 2) sono quelle sfogliabili, le altre (intestazioni di
 * giorno ecc.) servono solo a capire da dove partire.
 *
 * Collegamenti: {@link KalendWidget#prefs} (chiave "wp_snd" = musica attiva),
 * {@link KalendWidget#paintMusic} (aggiorna l'icona musica sul widget),
 * {@link WidgetAudio#play}/{@link WidgetAudio#stop}/{@link WidgetAudio#playing},
 * {@link WidgetService.Factory#key} per riconoscere il giorno di oggi.
 */
public class WidgetPreviewActivity extends Activity {

    /** Ogni quanti millisecondi l'ascolto guidato passa all'evento successivo. */
    private static final int ADV_MS = 8000;
    /** Durata massima dell'ascolto guidato (4 minuti). */
    private static final long MAX_MS = 240000L;

    /** Extra dell'Intent. */
    private static final String EXTRA_WIDGET_ID = "appWidgetId";
    private static final String EXTRA_LIST = "list";
    private static final String EXTRA_DATE = "date";
    private static final String EXTRA_EVENT_ID = "eid";
    private static final String EXTRA_ROW = "row";
    private static final String EXTRA_LISTEN = "listen";
    /** Extra passati a {@link MainActivity} quando si apre l'app. */
    private static final String EXTRA_OPEN_EVENT = "ev";

    /** Chiave preferenze: la musica dell'anteprima è accesa. */
    private static final String PREF_SOUND = "wp_snd";

    /** Tipo di riga "evento" nella lista della fabbrica del widget. */
    private static final int ROW_EVENT = 2;
    /** Tipo di riga "intestazione di giorno". */
    private static final int ROW_DAY = 0;

    /** Colori dell'app. */
    private static final int ACCENT_TEAL = 0xFF2AABB8;
    private static final int ACCENT_BLUE = 0xFF4E97C9;
    private static final int ACCENT_CORAL = 0xFFF07856;
    private static final int GOLD = 0xFFFFD27A;
    /** Sfondo della card: sfumatura blu notte → viola → prugna, leggermente trasparente. */
    private static final int[] CARD_GRADIENT = {0xF2142246, 0xF233205A, 0xF26A1F44};
    private static final int CARD_STROKE = 0x73FFD27A;
    /** Pillole semitrasparenti dei pulsanti. */
    private static final int PILL_FILL = 0x26FFFFFF;
    private static final int PILL_STROKE = 0x40FFFFFF;
    private static final int PILL_STROKE_SOFT = 0x33FFFFFF;
    /** Sfondo del badge di priorità (urgente / importante). */
    private static final int PRIO_URGENT_BG = 0xCCE8404F;
    private static final int PRIO_IMPORTANT_BG = 0xCC8A6BE0;

    /** Glifi dei pulsanti tondi. */
    private static final String GLYPH_PREV = "‹";   // ‹
    private static final String GLYPH_NEXT = "›";   // ›
    private static final String GLYPH_MUSIC = "♪";  // ♪
    private static final String GLYPH_PLAY = "▶";   // ▶
    private static final String GLYPH_PAUSE = "⏸";  // ⏸

    /** Spostamento orizzontale (dp) dell'animazione di cambio evento. */
    private static final float SLIDE_DP = 22f;
    /** Durata delle animazioni di uscita/entrata del contenuto (ms). */
    private static final long SLIDE_OUT_MS = 110;
    private static final long SLIDE_IN_MS = 170;
    /** Durata della comparsa della card (ms). */
    private static final long SHOW_ANIM_MS = 240;
    /** Attesa prima di aggiornare i pulsanti dopo l'avvio della musica (ms). */
    private static final long BUTTONS_REFRESH_MS = 250;
    /** Larghezza massima della finestra e margine laterale (dp). */
    private static final float MAX_WIDTH_DP = 480f;
    private static final float SIDE_MARGIN_DP = 24f;
    /** Altezza massima dell'area dettagli: frazione dell'altezza dello schermo. */
    private static final float INFO_MAX_HEIGHT_FRACTION = 0.38f;
    /** Soglie per riconoscere uno scorrimento laterale (fling). */
    private static final float FLING_HORIZONTAL_RATIO = 1.3f;
    private static final float FLING_MIN_DISTANCE_DP = 50f;

    /** Tutte le righe prodotte dalla fabbrica del widget. */
    private List<WidgetService.Row> rows = new ArrayList<>();
    /** Indici (dentro {@link #rows}) delle sole righe evento. */
    private final List<Integer> evIdx = new ArrayList<>();
    /** Posizione corrente dentro {@link #evIdx}. */
    private int pos = 0;
    /** Id del widget da cui siamo stati aperti. */
    private int id;
    /** Musica accesa / ascolto guidato attivo. */
    private boolean sound, auto;
    /** Istante di avvio dell'ascolto guidato (per il limite {@link #MAX_MS}). */
    private long autoSince;

    private final Handler h = new Handler(Looper.getMainLooper());
    /** Passo dell'ascolto guidato: avanza di un evento e si riprogramma, finché ha senso. */
    private final Runnable adv = new Runnable() {
        @Override
        public void run() {
            if (!auto) return;
            if (System.currentTimeMillis() - autoSince <= MAX_MS && pos < evIdx.size() - 1) {
                go(pos + 1, 1);
                h.postDelayed(this, ADV_MS);
            } else {
                setAuto(false);
            }
        }
    };

    /* Viste della card. */
    private LinearLayout content, info;
    private TextView icon, kicker, sub, air, title, prio, timeTv, durTv, bSound, bAuto;
    private DayBar dayBar;
    private GestureDetector gd;

    /** Converte dp in pixel (arrotondati) secondo la densità dello schermo. */
    private int dp(float dp) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, dp, getResources().getDisplayMetrics()));
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Intent in = getIntent();
        id = in.getIntExtra(EXTRA_WIDGET_ID, -1);

        // Tocco su una lista del widget: niente anteprima, apri subito l'app.
        String list = in.getStringExtra(EXTRA_LIST);
        if (list != null) {
            openApp(null, in.getStringExtra(EXTRA_DATE), list);
            finish();
            overridePendingTransition(0, 0);
            return;
        }

        // Stesse righe che vede il widget in modalità agenda.
        try {
            WidgetService.Factory f = new WidgetService.Factory(this, Math.max(0, id), "agenda");
            f.onDataSetChanged();
            rows = f.rows;
        } catch (Exception ignored) {
            // Senza dati l'anteprima mostra "Niente in programma".
        }
        for (int i = 0; i < rows.size(); i++) {
            if (rows.get(i).type == ROW_EVENT) evIdx.add(i);
        }

        // "listen" = ascolto guidato richiesto dal widget: musica accesa e avanzamento automatico.
        boolean listen = in.getBooleanExtra(EXTRA_LISTEN, false);
        sound = listen || KalendWidget.prefs(this).getBoolean(PREF_SOUND, false);
        auto = listen && evIdx.size() > 1;

        pos = startPos(in);
        build();
        if (evIdx.isEmpty()) showEmpty(); else show(0);
        if (auto) {
            autoSince = System.currentTimeMillis();
            h.postDelayed(adv, ADV_MS);
        }
        paintButtons();
    }

    /**
     * Decide da quale evento partire, in base agli extra dell'Intent:
     * prima l'id evento (+ data), poi la riga toccata sul widget, poi la data.
     */
    private int startPos(Intent in) {
        if (evIdx.isEmpty()) return 0;
        String eid = in.getStringExtra(EXTRA_EVENT_ID);
        String date = in.getStringExtra(EXTRA_DATE);
        int row = in.getIntExtra(EXTRA_ROW, -1);

        // 1) evento con quell'id (e, se indicata, quella data).
        if (eid != null && !eid.isEmpty()) {
            for (int i = 0; i < evIdx.size(); i++) {
                WidgetService.Row r = rows.get(evIdx.get(i));
                if (eid.equals(r.eid) && (date == null || date.equals(r.k))) return i;
            }
        }
        // 2) la riga toccata: se è un evento (della data giusta) parte da lì,
        //    se è un'intestazione di giorno parte dal primo evento che la segue.
        if (row >= 0 && row < rows.size()) {
            WidgetService.Row r = rows.get(row);
            if (r.type == ROW_EVENT && (date == null || date.equals(r.k))) {
                return Math.max(0, evIdx.indexOf(row));
            }
            if (r.type == ROW_DAY) {
                for (int i = 0; i < evIdx.size(); i++) {
                    if (evIdx.get(i) > row) return i;
                }
            }
        }
        // 3) il primo evento che non è prima della data indicata.
        if (date != null) {
            for (int i = 0; i < evIdx.size(); i++) {
                if (rows.get(evIdx.get(i)).k.compareTo(date) >= 0) return i;
            }
        }
        return 0;
    }

    /** Costruisce tutta l'interfaccia della card e la imposta come contenuto della finestra. */
    private void build() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), dp(10), dp(18), dp(14));
        GradientDrawable cardBg = grad(CARD_GRADIENT, 26f);
        cardBg.setStroke(dp(1.2f), CARD_STROKE);
        root.setBackground(cardBg);

        // Linea decorativa in alto: trasparente → bianco → trasparente.
        View divider = new View(this);
        divider.setBackground(new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT,
                new int[] {0x002AABB8, Color.WHITE, 0x00F07856}));
        LinearLayout.LayoutParams dividerLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3));
        dividerLp.setMargins(dp(12), 0, dp(12), dp(12));
        root.addView(divider, dividerLp);

        // Contenitore della parte che scorre quando si cambia evento.
        content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        root.addView(content);

        // Riga in alto: icona, (giorno + riga secondaria), badge "ON AIR".
        LinearLayout head = new LinearLayout(this);
        head.setOrientation(LinearLayout.HORIZONTAL);
        head.setGravity(Gravity.CENTER_VERTICAL);

        icon = new TextView(this);
        icon.setGravity(Gravity.CENTER);
        icon.setTextSize(25f);
        icon.setBackground(grad(new int[] {ACCENT_TEAL, ACCENT_BLUE, ACCENT_CORAL}, 16f));
        head.addView(icon, new LinearLayout.LayoutParams(dp(52), dp(52)));

        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setPadding(dp(12), 0, dp(6), 0);
        kicker = new TextView(this);
        kicker.setTextColor(0xE6FFFFFF);
        kicker.setTextSize(11.5f);
        kicker.setTypeface(Typeface.DEFAULT_BOLD);
        kicker.setLetterSpacing(0.08f);
        kicker.setAllCaps(true);
        kicker.setSingleLine(true);
        kicker.setEllipsize(TextUtils.TruncateAt.END);
        sub = new TextView(this);
        sub.setTextColor(0xFF8FE6DF);
        sub.setTextSize(12.5f);
        sub.setSingleLine(true);
        sub.setEllipsize(TextUtils.TruncateAt.END);
        col.addView(kicker);
        col.addView(sub);
        head.addView(col, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));

        air = new TextView(this);
        air.setText(getString(R.string.wp_air));
        air.setTextColor(Color.WHITE);
        air.setTextSize(10.5f);
        air.setTypeface(Typeface.DEFAULT_BOLD);
        air.setLetterSpacing(0.08f);
        air.setPadding(dp(8), dp(3), dp(8), dp(3));
        GradientDrawable airBg = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[] {0xFFE8404F, 0xFFFF7A59});
        airBg.setCornerRadius(dp(9));
        air.setBackground(airBg);
        head.addView(air);
        content.addView(head);

        // Titolo dell'evento, con una leggera ombra.
        title = new TextView(this);
        title.setTextColor(Color.WHITE);
        title.setTextSize(22f);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setMaxLines(3);
        title.setEllipsize(TextUtils.TruncateAt.END);
        title.setPadding(0, dp(12), 0, 0);
        title.setShadowLayer(dp(3), 0f, dp(1), 0x66000000);
        content.addView(title);

        // Badge di priorità (visibile solo per urgente / importante).
        prio = new TextView(this);
        prio.setTextColor(Color.WHITE);
        prio.setTextSize(12f);
        prio.setTypeface(Typeface.DEFAULT_BOLD);
        prio.setPadding(dp(9), dp(3), dp(9), dp(3));
        LinearLayout.LayoutParams prioLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        prioLp.topMargin = dp(6);
        content.addView(prio, prioLp);

        // Riga orario + durata.
        LinearLayout timeRow = new LinearLayout(this);
        timeRow.setOrientation(LinearLayout.HORIZONTAL);
        timeRow.setGravity(Gravity.CENTER_VERTICAL);
        timeRow.setPadding(0, dp(10), 0, 0);
        timeTv = new TextView(this);
        timeTv.setTextColor(Color.WHITE);
        timeTv.setTextSize(17f);
        timeTv.setTypeface(Typeface.DEFAULT_BOLD);
        timeRow.addView(timeTv);
        durTv = new TextView(this);
        durTv.setTextColor(GOLD);
        durTv.setTextSize(13f);
        durTv.setTypeface(Typeface.DEFAULT_BOLD);
        durTv.setPadding(dp(9), dp(2), dp(9), dp(2));
        durTv.setBackground(pill(PILL_FILL, PILL_STROKE_SOFT, 10f));
        LinearLayout.LayoutParams durLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        durLp.leftMargin = dp(9);
        timeRow.addView(durTv, durLp);
        content.addView(timeRow);

        // Barra della giornata con l'intervallo dell'evento.
        dayBar = new DayBar(this);
        LinearLayout.LayoutParams barLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(14));
        barLp.topMargin = dp(9);
        content.addView(dayBar, barLp);

        // Dettagli, in un'area scorrevole alta al massimo il 38% dello schermo.
        ScrollView scroll = new ScrollView(this) {
            @Override
            protected void onMeasure(int widthSpec, int heightSpec) {
                int max = Math.round(getResources().getDisplayMetrics().heightPixels * INFO_MAX_HEIGHT_FRACTION);
                super.onMeasure(widthSpec, MeasureSpec.makeMeasureSpec(max, MeasureSpec.AT_MOST));
            }
        };
        scroll.setVerticalScrollBarEnabled(false);
        info = new LinearLayout(this);
        info.setOrientation(LinearLayout.VERTICAL);
        info.setPadding(0, dp(6), 0, dp(4));
        scroll.addView(info);
        content.addView(scroll);

        // Pulsanti tondi: precedente, musica, ascolto guidato, successivo.
        LinearLayout buttons = new LinearLayout(this);
        buttons.setOrientation(LinearLayout.HORIZONTAL);
        buttons.setGravity(Gravity.CENTER);
        buttons.setPadding(0, dp(12), 0, 0);
        TextView prev = roundBtn(GLYPH_PREV, getString(R.string.wp_prev));
        TextView next = roundBtn(GLYPH_NEXT, getString(R.string.wp_next));
        bSound = roundBtn(GLYPH_MUSIC, getString(R.string.wp_music));
        bAuto = roundBtn(GLYPH_PLAY, getString(R.string.wp_listen));
        buttons.addView(prev);
        buttons.addView(bSound);
        buttons.addView(bAuto);
        buttons.addView(next);
        root.addView(buttons);

        // Pulsante largo "Apri in Kalend".
        TextView open = new TextView(this);
        open.setText(getString(R.string.wp_open));
        open.setTextColor(Color.WHITE);
        open.setTextSize(13.5f);
        open.setTypeface(Typeface.DEFAULT_BOLD);
        open.setGravity(Gravity.CENTER);
        open.setSingleLine(true);
        open.setEllipsize(TextUtils.TruncateAt.END);
        open.setPadding(dp(12), 0, dp(12), 0);
        GradientDrawable openBg = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[] {ACCENT_TEAL, ACCENT_CORAL});
        openBg.setCornerRadius(dp(19));
        open.setBackground(openBg);
        LinearLayout.LayoutParams openLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(38));
        openLp.topMargin = dp(10);
        root.addView(open, openLp);

        // Azioni dei pulsanti.
        prev.setOnClickListener(v -> {
            setAuto(false);
            go(pos - 1, -1);
        });
        next.setOnClickListener(v -> {
            setAuto(false);
            go(pos + 1, 1);
        });
        bSound.setOnClickListener(v -> {
            sound = !sound;
            KalendWidget.prefs(this).edit().putBoolean(PREF_SOUND, sound).apply();
            playCur();
            paintButtons();
            KalendWidget.paintMusic(this);
        });
        bAuto.setOnClickListener(v -> setAuto(!auto));
        open.setOnClickListener(v -> {
            WidgetService.Row r = cur();
            openApp(r != null ? r.eid : null, r != null ? r.k : null, null);
            finish();
        });

        // Scorrimento laterale del dito: evento precedente / successivo.
        gd = new GestureDetector(this, new GestureDetector.SimpleOnGestureListener() {
            @Override
            public boolean onDown(MotionEvent e) {
                return true;
            }

            @Override
            public boolean onFling(MotionEvent e1, MotionEvent e2, float vx, float vy) {
                if (e1 == null || e2 == null) return false;
                boolean horizontal = Math.abs(vx) >= Math.abs(vy) * FLING_HORIZONTAL_RATIO;
                boolean farEnough = Math.abs(e2.getX() - e1.getX()) >= dp(FLING_MIN_DISTANCE_DP);
                if (!horizontal || !farEnough) return false;
                setAuto(false);
                if (vx >= 0) go(pos - 1, -1); else go(pos + 1, 1);
                return true;
            }
        });

        setContentView(root);
        setFinishOnTouchOutside(true);
        getWindow().setLayout(Math.min(getResources().getDisplayMetrics().widthPixels - dp(SIDE_MARGIN_DP), dp(MAX_WIDTH_DP)),
                ViewGroup.LayoutParams.WRAP_CONTENT);
        getWindow().setBackgroundDrawableResource(android.R.color.transparent);

        // Comparsa animata della card.
        root.setAlpha(0f);
        root.setTranslationY(dp(18));
        root.animate().alpha(1f).translationY(0f).setDuration(SHOW_ANIM_MS).start();
    }

    /** Crea una sfumatura diagonale (alto-sinistra → basso-destra) con angoli arrotondati. */
    private GradientDrawable grad(int[] colors, float radiusDp) {
        GradientDrawable g = new GradientDrawable(GradientDrawable.Orientation.TL_BR, colors);
        g.setCornerRadius(dp(radiusDp));
        return g;
    }

    /** Crea una "pillola": rettangolo arrotondato con riempimento e, se diverso da 0, un bordo di 1dp. */
    private GradientDrawable pill(int fill, int stroke, float radiusDp) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(fill);
        g.setCornerRadius(dp(radiusDp));
        if (stroke != 0) g.setStroke(dp(1f), stroke);
        return g;
    }

    /** Pulsante tondo di 42dp con un glifo (‹ › più grandi degli altri) e una descrizione per l'accessibilità. */
    private TextView roundBtn(String glyph, String description) {
        TextView b = new TextView(this);
        b.setText(glyph);
        b.setTextColor(Color.WHITE);
        b.setTextSize(glyph.equals(GLYPH_PREV) || glyph.equals(GLYPH_NEXT) ? 24f : 18f);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setGravity(Gravity.CENTER);
        b.setContentDescription(description);
        b.setBackground(pill(PILL_FILL, PILL_STROKE, 22f));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(42), dp(42));
        lp.leftMargin = dp(5);
        lp.rightMargin = dp(5);
        b.setLayoutParams(lp);
        return b;
    }

    /** Aggiunge una riga di dettaglio (icona a sinistra, testo a destra) all'area {@link #info}. */
    private void addInfo(String iconText, String text, int maxLines) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setPadding(0, dp(7), 0, 0);
        TextView ic = new TextView(this);
        ic.setText(iconText);
        ic.setTextSize(15f);
        row.addView(ic, new LinearLayout.LayoutParams(dp(28), ViewGroup.LayoutParams.WRAP_CONTENT));
        TextView tv = new TextView(this);
        tv.setText(text);
        tv.setTextColor(0xF2FFFFFF);
        tv.setTextSize(14.5f);
        tv.setLineSpacing(dp(2), 1f);
        tv.setMaxLines(maxLines);
        tv.setEllipsize(TextUtils.TruncateAt.END);
        row.addView(tv, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        info.addView(row);
    }

    /** La riga evento attualmente mostrata, o null se non ci sono eventi. */
    private WidgetService.Row cur() {
        if (evIdx.isEmpty()) return null;
        int i = Math.max(0, Math.min(pos, evIdx.size() - 1));
        return rows.get(evIdx.get(i));
    }

    /**
     * Passa all'evento in posizione {@code p} (limitata all'intervallo valido)
     * con un'animazione di scorrimento nella direzione {@code dir} (−1 = indietro, +1 = avanti).
     */
    private void go(int p, int dir) {
        if (evIdx.isEmpty()) return;
        p = Math.max(0, Math.min(evIdx.size() - 1, p));
        if (p == pos) return;
        pos = p;
        content.animate().cancel();
        content.animate().alpha(0f).translationX(-dir * dp(SLIDE_DP)).setDuration(SLIDE_OUT_MS)
                .withEndAction(() -> {
                    show(dir);
                    content.setTranslationX(dir * dp(SLIDE_DP));
                    content.animate().alpha(1f).translationX(0f).setDuration(SLIDE_IN_MS).start();
                })
                .start();
    }

    /**
     * Riempie la card con l'evento corrente.
     * Il parametro {@code dir} è la direzione di scorrimento; non viene usato
     * qui (lo gestisce {@link #go}) ma la firma è quella dell'originale.
     */
    private void show(int dir) {
        WidgetService.Row r = cur();
        if (r == null) return;

        // Campo "f": primo pezzo = emoji/icona, il resto = testo aggiuntivo per la riga secondaria.
        String f = r.f != null ? r.f.trim() : "";
        String ico = !f.isEmpty() ? f.split(" ")[0] : (r.hol ? "★" : "📅");
        String extra = f.contains(" ") ? f.substring(f.indexOf(' ') + 1) : "";
        icon.setText(ico);
        GradientDrawable iconBg = grad(new int[] {lighten(r.color, 40), r.color, lighten(r.color, -30)}, 16f);
        iconBg.setStroke(dp(1f), 0x66FFFFFF);
        icon.setBackground(iconBg);

        kicker.setText(dayName(r.k));
        sub.setText(relDay(r.k)
                + (!extra.isEmpty() ? "  ·  " + extra : "")
                + "  ·  "
                + getString(R.string.wp_of, pos + 1, evIdx.size()));
        title.setText(r.title);

        // Priorità.
        boolean urgent = "urgent".equals(r.pr);
        if (urgent || "important".equals(r.pr)) {
            prio.setVisibility(View.VISIBLE);
            prio.setText(getString(urgent ? R.string.wp_urg : R.string.wp_imp));
            prio.setBackground(pill(urgent ? PRIO_URGENT_BG : PRIO_IMPORTANT_BG, 0, 9f));
        } else {
            prio.setVisibility(View.GONE);
        }

        // Orario e durata (st/en sono minuti dalla mezzanotte, −1 = evento senza orario).
        timeTv.setText(r.time != null ? r.time.replace("\n", " → ") : "");
        boolean hasDur = r.st >= 0 && r.en > r.st;
        durTv.setVisibility(hasDur ? View.VISIBLE : View.GONE);
        if (hasDur) durTv.setText("⏱ " + dur(r.en - r.st));
        dayBar.set(r.st, r.en, r.color, r.k);
        dayBar.setVisibility(r.st >= 0 ? View.VISIBLE : View.GONE);

        // Dettagli.
        info.removeAllViews();
        if (r.loc != null && !r.loc.isEmpty()) addInfo("📍", r.loc, 3);
        if (r.pp != null && !r.pp.isEmpty()) addInfo("👥", r.pp, 3);
        if (r.tg != null && !r.tg.isEmpty()) addInfo("🏷", r.tg, 2);
        if (r.li != null && !r.li.isEmpty() && r.ln > 0) {
            // Lista collegata: "Lista 3/5" e una spunta se è completata.
            String done = r.ld < r.ln ? "" : "  ✓";
            addInfo("☑", getString(R.string.wp_list) + " " + r.ld + "/" + r.ln + done, 1);
        }
        if (r.ch != null && !r.ch.isEmpty()) {
            // Catena di eventi: ogni voce è "nome·dettaglio", separate da spazi.
            StringBuilder sb = new StringBuilder();
            for (String part : r.ch.split(" ")) {
                String[] pc = part.split("·");
                if (sb.length() > 0) sb.append("   ");
                sb.append(getString(R.string.wp_chain)).append(" ").append(pc[0]);
                sb.append(pc.length > 1 ? " · " + pc[1] : "");
            }
            addInfo("⛓", sb.toString(), 2);
        }
        if (r.rm != null && !r.rm.isEmpty()) addInfo("🔔", r.rm, 2);
        if (r.d != null && !r.d.isEmpty()) addInfo("📝", r.d, 40);

        playCur();
        paintButtons();
    }

    /** Card vuota: nessun evento in programma. */
    private void showEmpty() {
        icon.setText("✨");
        kicker.setText("");
        sub.setText("");
        title.setText(getString(R.string.wp_none));
        prio.setVisibility(View.GONE);
        timeTv.setText("");
        durTv.setVisibility(View.GONE);
        dayBar.setVisibility(View.GONE);
        info.removeAllViews();
    }

    /** Nome del giorno per una chiave "aaaa-mm-gg", es. "lunedì 3 marzo" (nella lingua del telefono). */
    private String dayName(String k) {
        Calendar c = Calendar.getInstance();
        try {
            c.set(Integer.parseInt(k.substring(0, 4)), Integer.parseInt(k.substring(5, 7)) - 1, Integer.parseInt(k.substring(8, 10)), 12, 0, 0);
        } catch (Exception ignored) {
            // Chiave malformata: resta la data di oggi.
        }
        return new SimpleDateFormat("EEEE d MMMM", Locale.getDefault()).format(c.getTime());
    }

    /** Distanza da oggi in parole: "Oggi", "Domani", "Ieri", "tra N giorni", "N giorni fa". */
    private String relDay(String k) {
        try {
            Calendar now = Calendar.getInstance();
            now.set(Calendar.HOUR_OF_DAY, 12);
            now.set(Calendar.MINUTE, 0);
            now.set(Calendar.SECOND, 0);
            now.set(Calendar.MILLISECOND, 0);
            Calendar day = (Calendar) now.clone();
            day.set(Integer.parseInt(k.substring(0, 4)), Integer.parseInt(k.substring(5, 7)) - 1, Integer.parseInt(k.substring(8, 10)));
            long days = Math.round((day.getTimeInMillis() - now.getTimeInMillis()) / 86400000.0);
            if (days == 0) return getString(R.string.wp_today);
            if (days == 1) return getString(R.string.wp_tomorrow);
            if (days == -1) return getString(R.string.wp_yesterday);
            if (days < 0) return getString(R.string.wp_ago, (int) -days);
            return getString(R.string.wp_in_days, (int) days);
        } catch (Exception e) {
            return "";
        }
    }

    /**
     * Durata in forma compatta: sotto l'ora "45′", altrimenti "2h" o "2h30".
     * Statica e condivisa a livello di package, come nell'originale.
     */
    static String dur(int minutes) {
        if (minutes < 60) return minutes + "′";
        int rest = minutes % 60;
        return (minutes / 60) + "h" + (rest > 0 ? String.format(Locale.ROOT, "%02d", rest) : "");
    }

    /**
     * Schiarisce (delta positivo) o scurisce (delta negativo) un colore
     * sommando delta a ogni canale RGB, con limiti 0..255. L'alfa diventa opaco.
     */
    static int lighten(int color, int delta) {
        return Color.rgb(
                Math.max(0, Math.min(255, Color.red(color) + delta)),
                Math.max(0, Math.min(255, Color.green(color) + delta)),
                Math.max(0, Math.min(255, Color.blue(color) + delta)));
    }

    /** Avvia (o ferma) la musica dell'evento corrente e poco dopo aggiorna i pulsanti. */
    private void playCur() {
        WidgetService.Row r = cur();
        if (!sound || r == null || r.m == null || r.m.isEmpty()) {
            WidgetAudio.stop();
        } else {
            WidgetAudio.play(this, r.m);
        }
        h.postDelayed(this::paintButtons, BUTTONS_REFRESH_MS);
    }

    /**
     * Accende o spegne l'ascolto guidato. Si accende solo se ci sono almeno
     * due eventi; accendendolo si attiva anche la musica.
     */
    private void setAuto(boolean on) {
        h.removeCallbacks(adv);
        auto = on && evIdx.size() > 1;
        if (auto) {
            autoSince = System.currentTimeMillis();
            if (!sound) {
                sound = true;
                playCur();
            }
            h.postDelayed(adv, ADV_MS);
        }
        paintButtons();
    }

    /** Colora i pulsanti ♪ e ▶/⏸ in base allo stato e mostra "ON AIR" se la musica sta suonando. */
    private void paintButtons() {
        if (bSound != null) {
            bSound.setBackground(sound ? activePill() : pill(PILL_FILL, PILL_STROKE, 22f));
        }
        if (bAuto != null) {
            bAuto.setBackground(auto ? activePill() : pill(PILL_FILL, PILL_STROKE, 22f));
            bAuto.setText(auto ? GLYPH_PAUSE : GLYPH_PLAY);
        }
        if (air != null) {
            air.setVisibility(sound && WidgetAudio.playing() ? View.VISIBLE : View.GONE);
        }
    }

    /** Sfondo di un pulsante tondo "acceso": sfumatura acqua → corallo. */
    private GradientDrawable activePill() {
        GradientDrawable g = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[] {ACCENT_TEAL, ACCENT_CORAL});
        g.setCornerRadius(dp(22));
        return g;
    }

    /** Apre l'app principale su un evento, una data e/o una lista (parametri facoltativi). */
    private void openApp(String eid, String date, String list) {
        Intent i = new Intent(this, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (list != null) i.putExtra(EXTRA_LIST, list);
        if (eid != null && !eid.isEmpty()) i.putExtra(EXTRA_OPEN_EVENT, eid);
        if (date != null) i.putExtra(EXTRA_DATE, date);
        try {
            startActivity(i);
        } catch (Exception ignored) {
            // Activity non avviabile: la finestra si chiude comunque.
        }
    }

    /** Passa ogni tocco anche al rilevatore di gesti, per lo scorrimento laterale. */
    @Override
    public boolean dispatchTouchEvent(MotionEvent ev) {
        if (gd != null) gd.onTouchEvent(ev);
        return super.dispatchTouchEvent(ev);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (sound) playCur();
        if (auto) {
            h.removeCallbacks(adv);
            h.postDelayed(adv, ADV_MS);
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        h.removeCallbacks(adv);
        WidgetAudio.stop();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        h.removeCallbacksAndMessages(null);
        WidgetAudio.stop();
    }

    /**
     * BARRA DELLA GIORNATA: una striscia che rappresenta le 24 ore (sfumatura
     * notte → giorno → sera → notte, con tacche ogni 6 ore), sopra la quale
     * viene disegnato l'intervallo dell'evento nel suo colore, con un bordo
     * bianco. Se il giorno mostrato è oggi, una linea rossa segna l'ora attuale.
     */
    static final class DayBar extends View {
        /** Minuti in un giorno. */
        private static final float DAY_MINUTES = 1440f;
        /** Colori della striscia (notte, mattino, mezzogiorno, sera, notte). */
        private static final int[] STRIP_COLORS = {0x66304A90, 0x88FFC85A, 0x88FFE08A, 0x88C86E8C, 0x66304A90};
        private static final float[] STRIP_STOPS = {0f, 0.3f, 0.55f, 0.8f, 1f};
        private static final int TICK_COLOR = 0x40FFFFFF;
        private static final int NOW_COLOR = 0xFFFF5A6A;

        private int st = -1, en = -1;        // inizio/fine dell'evento in minuti (−1 = assente)
        private int color = 0xFF2AABB8;      // colore dell'evento
        private String k = "";               // chiave del giorno "aaaa-mm-gg"
        private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final float d;               // densità dello schermo (pixel per dp)

        DayBar(Context c) {
            super(c);
            d = c.getResources().getDisplayMetrics().density;
        }

        /** Imposta l'evento da rappresentare e ridisegna. */
        void set(int start, int end, int eventColor, String dayKey) {
            st = start;
            en = end;
            color = eventColor;
            k = dayKey == null ? "" : dayKey;
            invalidate();
        }

        @Override
        protected void onDraw(Canvas c) {
            float w = getWidth();
            float h = getHeight();
            float r = h / 2f;

            // Striscia delle 24 ore, alta il 44% della vista e centrata verticalmente.
            p.setShader(new LinearGradient(0, 0, w, 0, STRIP_COLORS, STRIP_STOPS, Shader.TileMode.CLAMP));
            float top = h * 0.28f;
            float bottom = h * 0.72f;
            c.drawRoundRect(new RectF(0, top, w, bottom), r, r, p);
            p.setShader(null);

            // Tacche alle 6, 12 e 18.
            p.setColor(TICK_COLOR);
            for (int i = 1; i < 4; i++) {
                float x = w * i / 4f;
                c.drawRect(x - d * 0.5f, top, x + d * 0.5f, bottom, p);
            }

            // Intervallo dell'evento: bordo bianco e dentro il colore dell'evento (reso opaco).
            if (st >= 0) {
                float x0 = w * st / DAY_MINUTES;
                float x1 = Math.max(x0 + d * 4f, w * Math.max(st, en) / DAY_MINUTES);
                p.setColor(Color.WHITE);
                c.drawRoundRect(new RectF(x0 - d * 1.5f, 0, x1 + d * 1.5f, h), r, r, p);
                p.setColor(color | 0xFF000000);
                c.drawRoundRect(new RectF(x0, d * 1.5f, x1, h - d * 1.5f), r, r, p);
            }

            // Linea dell'ora attuale, solo se il giorno mostrato è oggi.
            Calendar now = Calendar.getInstance();
            if (k.equals(WidgetService.Factory.key(now))) {
                float x = w * (now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)) / DAY_MINUTES;
                p.setColor(NOW_COLOR);
                c.drawRect(x - d, 0, x + d, h, p);
            }
        }
    }
}
