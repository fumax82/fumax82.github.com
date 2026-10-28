package app.kalend;

import android.graphics.Bitmap;
import android.graphics.BlurMaskFilter;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.text.TextPaint;
import android.text.TextUtils;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.Locale;
import java.util.Random;

/**
 * PITTORE DEL "CIELO" DEL WIDGET.
 *
 * Disegna in una Bitmap lo sfondo del widget: un cielo il cui colore dipende
 * dall'altezza del sole in questo momento e nel luogo dell'utente (lat/lon nel
 * JSON del widget), con stelle di notte, il sole con il suo alone, la luna con
 * la fase corretta, nuvole se il meteo lo dice, e un velo scuro per rendere
 * leggibile il testo bianco sopra. Opzionalmente (paint con bgOnly = false)
 * scrive anche la "testata" del widget: numero del giorno, giorno della
 * settimana, mese, meteo e l'elenco dei prossimi eventi (o il solo prossimo
 * evento quando il widget è basso).
 *
 * La parte astronomica è una versione ridotta dell'algoritmo di SunCalc
 * (formule di Jean Meeus semplificate): bastano pochi gradi di precisione,
 * perché serve solo a decidere colori e posizione dei due astri.
 *
 * Chiamata da KalendWidget (paint/paintBackground), da WidgetPreviewActivity
 * e da KalendNextWidget. Le stesse tabelle di colori vivono nella pagina web
 * (SkyPal in index.html) così app e widget hanno lo stesso aspetto.
 */
final class SkyPainter {
    /* ───────────── costanti astronomiche (SunCalc) ───────────── */

    /** gradi → radianti */
    private static final double RAD = Math.PI / 180;
    /** obliquità dell'eclittica (inclinazione dell'asse terrestre) in radianti: 23,4397° */
    private static final double E = RAD * 23.4397;
    /** giorno giuliano dell'epoca Unix (1/1/1970) e dell'epoca J2000 (1/1/2000 12:00) */
    private static final double J1970 = 2440588;
    private static final double J2000 = 2451545;
    /** millisecondi in un giorno */
    private static final double DAY_MS = 86400000.0;

    /** anomalia media del sole: 357,5291° + 0,98560028°/giorno */
    private static final double SUN_M0 = 357.5291;
    private static final double SUN_M1 = 0.98560028;
    /** equazione del centro del sole: coefficienti dei tre termini in seno (gradi) */
    private static final double SUN_C1 = 1.9148;
    private static final double SUN_C2 = 0.02;
    private static final double SUN_C3 = 0.0003;
    /** longitudine del perielio della Terra: 102,9372° (già in radianti) */
    private static final double SUN_PERIHELION = RAD * 102.9372;
    /** tempo siderale a Greenwich: 280,16° + 360,9856235°/giorno */
    private static final double SID_0 = 280.16;
    private static final double SID_1 = 360.9856235;

    /** luna: longitudine eclittica media 218,316° + 13,176396°/giorno */
    private static final double MOON_L0 = 218.316;
    private static final double MOON_L1 = 13.176396;
    /** luna: anomalia media 134,963° + 13,064993°/giorno */
    private static final double MOON_M0 = 134.963;
    private static final double MOON_M1 = 13.064993;
    /** luna: argomento della latitudine 93,272° + 13,229350°/giorno */
    private static final double MOON_F0 = 93.272;
    private static final double MOON_F1 = 13.229350;
    /** luna: ampiezza delle correzioni di longitudine (6,289°) e latitudine (5,128°), in radianti */
    private static final double MOON_LON_CORR = RAD * 6.289;
    private static final double MOON_LAT_CORR = RAD * 5.128;
    /** luna: distanza media 385001 km, variazione 20905 km; distanza Terra-Sole 149598000 km */
    private static final double MOON_DIST = 385001;
    private static final double MOON_DIST_VAR = 20905;
    private static final double SUN_DIST_KM = 149598000;

    /* ───────────── palette del cielo ───────────── */

    /** altezze del sole (gradi) in cui cambia la palette: notte piena, crepuscoli, giorno */
    private static final double[] PA = {-90, -18, -12, -7, -3, 0, 3, 8, 18, 40, 90};
    /** per ogni altezza di PA: colore in alto, al centro e in basso del cielo */
    private static final String[][] PC = {
            {"#03060F", "#070C1C", "#0C1530"},
            {"#050914", "#0A1430", "#15224A"},
            {"#081129", "#142A57", "#2C3F74"},
            {"#122452", "#344B88", "#7A6AA4"},
            {"#1E3570", "#5864A6", "#E2907E"},
            {"#2D4C8C", "#7D8FC2", "#FFB17A"},
            {"#3A66A8", "#8EA9D6", "#FFC98C"},
            {"#4683CB", "#9AC4EA", "#FFE4B8"},
            {"#3D8BD9", "#79B8EC", "#CBE5F7"},
            {"#2E84DE", "#6CB1EE", "#BEE0F8"},
            {"#2A7FDD", "#64ACEE", "#B6DCF8"},
    };
    /** grigi delle nuvole: di giorno (sole ≥ 3°), al crepuscolo (−6°…3°), di notte */
    private static final String[] CLOUD_DAY = {"#7E8B9B", "#A3AEBB", "#C7CED6"};
    private static final String[] CLOUD_DUSK = {"#4A5068", "#7C7E92", "#B69A90"};
    private static final String[] CLOUD_NIGHT = {"#141922", "#1D2430", "#262E3C"};

    /** quanto il cielo si "ingrigisce" con le nuvole: fattore, extra con precipitazioni, massimo */
    private static final double CLOUD_MIX = 0.75;
    private static final double PRECIP_EXTRA = 0.15;
    private static final double CLOUD_MIX_MAX = 0.9;

    /** copertura nuvolosa stimata dallo stato meteo ("st" del JSON "wx") */
    private static final double CLOUD_CLOUDY = 0.85;
    private static final double CLOUD_FOG = 0.7;
    private static final double CLOUD_PARTLY = 0.45;
    private static final double CLOUD_OTHER = 0.9; // pioggia, neve, temporale…

    /** posizione di default (Roma) se il JSON non ha lat/lon */
    private static final double DEFAULT_LAT = 41.9;
    private static final double DEFAULT_LON = 12.5;

    /** punti del bordo organico e i suoi tre "tremolii" (ampiezza e frequenza angolare) */
    private static final int EDGE_POINTS = 96;
    private static final double EDGE_SUPER = 2.0 / 7.0; // esponente della superellisse (angoli morbidi)

    private SkyPainter() {}

    /* ═════════════════ astronomia semplificata (SunCalc) ═════════════════ */

    /** Giorni (con frazione) trascorsi dall'epoca J2000. */
    private static double toDays(long ms) {
        return ms / DAY_MS - 0.5 + J1970 - J2000;
    }

    /** Longitudine eclittica del sole data la sua anomalia media M (radianti). */
    private static double eclL(double m) {
        double c = (Math.sin(m) * SUN_C1 + Math.sin(2 * m) * SUN_C2 + Math.sin(3 * m) * SUN_C3) * RAD;
        return m + c + SUN_PERIHELION + Math.PI;
    }

    /** Ascensione retta da longitudine l e latitudine b eclittiche. */
    private static double ra(double l, double b) {
        return Math.atan2(Math.sin(l) * Math.cos(E) - Math.tan(b) * Math.sin(E), Math.cos(l));
    }

    /** Declinazione da longitudine l e latitudine b eclittiche. */
    private static double dec(double l, double b) {
        return Math.asin(Math.sin(b) * Math.cos(E) + Math.cos(b) * Math.sin(E) * Math.sin(l));
    }

    /** Tempo siderale locale per i giorni d e la longitudine ovest lw (radianti). */
    private static double sid(double d, double lw) {
        return (d * SID_1 + SID_0) * RAD - lw;
    }

    /** Altezza sull'orizzonte (radianti) dato angolo orario h, latitudine phi e declinazione dec. */
    private static double alt(double h, double phi, double dec) {
        return Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(h));
    }

    /**
     * Posizione del sole: {altezza in gradi, angolo orario in radianti}
     * (angolo orario 0 = sole a sud, negativo prima di mezzogiorno).
     */
    static double[] sun(long ms, double lat, double lon) {
        double d = toDays(ms);
        double l = eclL((SUN_M1 * d + SUN_M0) * RAD);
        double h = sid(d, -lon * RAD) - ra(l, 0);
        return new double[] {alt(h, lat * RAD, dec(l, 0)) / RAD, h};
    }

    /** Posizione della luna: {altezza in gradi, angolo orario in radianti}. */
    static double[] moon(long ms, double lat, double lon) {
        double d = toDays(ms);
        double f = (MOON_F1 * d + MOON_F0) * RAD;
        double l = (MOON_L1 * d + MOON_L0) * RAD + Math.sin((MOON_M1 * d + MOON_M0) * RAD) * MOON_LON_CORR;
        double b = Math.sin(f) * MOON_LAT_CORR;
        double h = sid(d, -lon * RAD) - ra(l, b);
        return new double[] {alt(h, lat * RAD, dec(l, b)) / RAD, h};
    }

    /** Fase lunare da 0 (luna nuova) a 0,5 (piena) a 1 (nuova di nuovo). */
    static double moonPhase(long ms) {
        double d = toDays(ms);
        // coordinate equatoriali del sole
        double sl = eclL((SUN_M1 * d + SUN_M0) * RAD);
        double sdec = dec(sl, 0);
        double sra = ra(sl, 0);
        // coordinate della luna e sua distanza in km
        double m = (MOON_M1 * d + MOON_M0) * RAD;
        double f = (MOON_F1 * d + MOON_F0) * RAD;
        double ml = (MOON_L1 * d + MOON_L0) * RAD + Math.sin(m) * MOON_LON_CORR;
        double mb = Math.sin(f) * MOON_LAT_CORR;
        double mdist = MOON_DIST - Math.cos(m) * MOON_DIST_VAR;
        double mdec = dec(ml, mb);
        double dra = sra - ra(ml, mb);
        // angolo di fase (sole-luna-Terra) e angolo di posizione del lembo illuminato
        double phi = Math.acos(Math.sin(sdec) * Math.sin(mdec) + Math.cos(sdec) * Math.cos(mdec) * Math.cos(dra));
        double inc = Math.atan2(Math.sin(phi) * SUN_DIST_KM, mdist - Math.cos(phi) * SUN_DIST_KM) * 0.5;
        double angle = Math.atan2(Math.cos(sdec) * Math.sin(dra),
                Math.sin(sdec) * Math.cos(mdec) - Math.cos(sdec) * Math.sin(mdec) * Math.cos(dra));
        double sign = angle >= 0 ? 1 : -1;
        return inc * sign / Math.PI + 0.5;
    }

    /* ═════════════════ colori ═════════════════ */

    /** Interpola due colori (t limitato a 0…1), canale per canale. */
    private static int mix(int a, int b, double t) {
        double k = Math.max(0, Math.min(1.0, t));
        return Color.rgb(
                (int) (Color.red(a) + (Color.red(b) - Color.red(a)) * k),
                (int) (Color.green(a) + (Color.green(b) - Color.green(a)) * k),
                (int) (Color.blue(a) + (Color.blue(b) - Color.blue(a)) * k));
    }

    /** Un colore "#RRGGBB" dal JSON, oppure il colore di riserva se non è valido. */
    private static int parse(String s, int fallback) {
        try {
            return Color.parseColor(s);
        } catch (Exception e) {
            return fallback;
        }
    }

    /**
     * I tre colori del cielo (alto, centro, basso) per l'altezza del sole in gradi,
     * la copertura nuvolosa 0…1 e la presenza di precipitazioni.
     */
    static int[] palette(double sunAlt, double cloud, boolean precip) {
        // fascia della tabella in cui cade l'altezza del sole
        int i = 0;
        while (i < PA.length - 2 && sunAlt > PA[i + 1]) i++;
        double a0 = PA[i];
        int j = i + 1;
        int[] out = new int[3];
        for (int k = 0; k < 3; k++) {
            out[k] = mix(Color.parseColor(PC[i][k]), Color.parseColor(PC[j][k]), (sunAlt - a0) / (PA[j] - a0));
        }
        if (cloud > 0) {
            String[] grey;
            if (sunAlt >= -6) {
                grey = sunAlt >= 3 ? CLOUD_DAY : CLOUD_DUSK;
            } else {
                grey = CLOUD_NIGHT;
            }
            double extra = precip ? PRECIP_EXTRA : 0;
            double t = Math.min(CLOUD_MIX_MAX, cloud * CLOUD_MIX + extra);
            for (int k = 0; k < 3; k++) out[k] = mix(out[k], Color.parseColor(grey[k]), t);
        }
        return out;
    }

    /* ═════════════════ elementi disegnati ═════════════════ */

    /**
     * Posizione sullo schermo di un astro: x dall'angolo orario (a sud = centro),
     * y dall'altezza in gradi (orizzonte in basso, zenit sopra il bordo).
     */
    private static float[] pos(double hourAngle, double altDeg, int w, float skyH) {
        double twoPi = 2 * Math.PI;
        float y = (float) ((0.95 - Math.sin(Math.max(-0.2, altDeg) * Math.PI / 180) * 1.1) * skyH);
        // angolo orario normalizzato in [-π, π), poi portato in 0,5 ± 0,62 della larghezza
        // NOTA RICOSTRUZIONE: il decompilato ha perso il valore sottratto dopo la normalizzazione;
        // per avere l'astro al centro quando è a sud (angolo orario 0) deve essere π.
        double norm = ((hourAngle + Math.PI) % twoPi + twoPi) % twoPi - Math.PI;
        float x = (float) ((norm / Math.PI * 0.62 + 0.5) * w);
        return new float[] {x, y};
    }

    /** Disegna la luna: alone, disco scuro e la parte illuminata secondo la fase. */
    private static void drawMoon(Canvas c, float cx, float cy, float r, double phase, boolean southern, float alpha) {
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        float glowR = r * 4;
        p.setShader(new RadialGradient(cx, cy, glowR,
                Color.argb((int) (alpha * 90), 255, 250, 225), Color.argb(0, 255, 250, 225), Shader.TileMode.CLAMP));
        c.drawCircle(cx, cy, glowR, p);
        p.setShader(null);
        p.setColor(Color.argb((int) (140 * alpha), 60, 66, 90));
        c.drawCircle(cx, cy, r, p);

        // prima della luna piena la parte illuminata è a destra (a sinistra nell'emisfero sud)
        boolean litRight = phase < 0.5;
        if (southern) litRight = !litRight;
        double k = Math.cos(2 * phase * Math.PI); // larghezza relativa del terminatore
        Path path = new Path();
        float top = cy - r;
        float bottom = cy + r;
        RectF outer = new RectF(cx - r, top, cx + r, bottom);
        path.arcTo(outer, -90, litRight ? 180 : -180, true);
        float rx = (float) (r * Math.abs(k));
        RectF inner = new RectF(cx - rx, top, cx + rx, bottom);
        boolean innerSame = k <= 0 ? !litRight : litRight;
        path.arcTo(inner, 90, innerSame ? -180 : 180, false);
        path.close();
        p.setColor(Color.argb((int) (245 * alpha), 255, 246, 216));
        c.drawPath(path, p);
    }

    /**
     * Ritaglia la bitmap con un bordo "organico": una superellisse leggermente
     * ondulata (la forma cambia ogni 15 minuti) con i bordi sfumati.
     */
    static void organicEdge(Bitmap bmp, float density, long time) {
        try {
            int w = bmp.getWidth();
            int h = bmp.getHeight();
            float blur = Math.max(7 * density, Math.min(w, h) * 0.075f);
            float inset = blur * 1.05f;
            Bitmap mask = Bitmap.createBitmap(w, h, Bitmap.Config.ALPHA_8);
            Canvas mc = new Canvas(mask);
            Random rnd = new Random(time / 900000); // stessa forma per 15 minuti
            double ph1 = rnd.nextDouble() * 6.283;
            double ph2 = rnd.nextDouble() * 6.283;
            double ph3 = rnd.nextDouble() * 6.283;
            double cx = w / 2.0;
            double cy = h / 2.0;
            double rx = cx - inset;
            double ry = cy - inset;
            float[] xs = new float[EDGE_POINTS];
            float[] ys = new float[EDGE_POINTS];
            for (int i = 0; i < EDGE_POINTS; i++) {
                double a = i * (2 * Math.PI) / EDGE_POINTS;
                double cos = Math.cos(a);
                double sin = Math.sin(a);
                double sx = Math.signum(cos) * Math.pow(Math.abs(cos), EDGE_SUPER);
                double sy = Math.pow(Math.abs(sin), EDGE_SUPER) * Math.signum(sin);
                double wobble = Math.sin(3 * a + ph1) * 0.022 + 1.0
                        + Math.sin(7 * a + ph2) * 0.016
                        + Math.sin(a * 11 + ph3) * 0.01;
                xs[i] = (float) (cx + sx * rx * wobble);
                ys[i] = (float) (cy + sy * ry * wobble);
            }
            // curva chiusa che passa per i punti medi, con i punti come controlli
            Path path = new Path();
            path.moveTo((xs[EDGE_POINTS - 1] + xs[0]) / 2, (ys[EDGE_POINTS - 1] + ys[0]) / 2);
            for (int i = 0; i < EDGE_POINTS; i++) {
                int j = (i + 1) % EDGE_POINTS;
                path.quadTo(xs[i], ys[i], (xs[j] + xs[i]) / 2, (ys[j] + ys[i]) / 2);
            }
            path.close();
            Paint pm = new Paint(Paint.ANTI_ALIAS_FLAG);
            pm.setColor(Color.BLACK);
            pm.setMaskFilter(new BlurMaskFilter(blur, BlurMaskFilter.Blur.NORMAL));
            mc.drawPath(path, pm);
            // la maschera diventa l'alfa della bitmap originale
            Paint px = new Paint(Paint.FILTER_BITMAP_FLAG);
            px.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.DST_IN));
            new Canvas(bmp).drawBitmap(mask, 0, 0, px);
            mask.recycle();
        } catch (Throwable ignored) {
            // se manca memoria o la bitmap non è valida, resta il bordo rettangolare
        }
    }

    /* ═════════════════ il quadro completo ═════════════════ */

    /** Cielo + testata + eventi (il widget "normale"). */
    static Bitmap paint(int w, int h, float density, JSONObject data, long now) {
        return paint(w, h, density, data, now, false);
    }

    /** Solo il cielo, più scuro e con una cornice sottile: sfondo per le altre viste del widget. */
    static Bitmap paintBackground(int w, int h, float density, JSONObject data, long now) {
        return paint(w, h, density, data, now, true);
    }

    /**
     * Disegna tutto. data è il JSON del widget: lat/lon, h12 (orologio a 12 ore),
     * wx (meteo: st = stato, t = testo), wd/month (nomi del giorno e del mese),
     * items (eventi), labels (nomi dei giorni per le intestazioni), empty/allDay (testi).
     */
    static Bitmap paint(int w, int h, float density, JSONObject data, long now, boolean bgOnly) {
        Bitmap bmp = Bitmap.createBitmap(Math.max(w, 10), Math.max(h, 10), Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);
        double lat = data.optDouble("lat", DEFAULT_LAT);
        double lon = data.optDouble("lon", DEFAULT_LON);
        boolean h12 = data.optBoolean("h12", false);
        JSONObject wx = data.optJSONObject("wx");
        String st = wx == null ? "" : wx.optString("st", "");

        // copertura nuvolosa e precipitazioni stimate dallo stato meteo
        double cloud;
        if ("cloudy".equals(st)) {
            cloud = CLOUD_CLOUDY;
        } else if ("partly".equals(st)) {
            cloud = CLOUD_PARTLY;
        } else if ("fog".equals(st)) {
            cloud = CLOUD_FOG;
        } else if (!st.isEmpty() && !"clear".equals(st)) {
            cloud = CLOUD_OTHER;
        } else {
            cloud = 0;
        }
        boolean precip = st.equals("rain") || st.equals("thunder") || st.equals("drizzle") || st.equals("snow");

        double[] sun = sun(now, lat, lon);
        double[] moon = moon(now, lat, lon);
        double sunAlt = sun[0];
        int[] pal = palette(sunAlt, cloud, precip);

        // ── cielo: angoli arrotondati e sfumatura verticale ──
        float corner = (bgOnly ? 24 : 22) * density;
        RectF full = new RectF(0, 0, w, h);
        Path clip = new Path();
        clip.addRoundRect(full, corner, corner, Path.Direction.CW);
        c.clipPath(clip);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setShader(new LinearGradient(0, 0, 0, h, new int[] {pal[0], pal[1], pal[2]},
                new float[] {0, 0.6f, 1f}, Shader.TileMode.CLAMP));
        c.drawRect(full, p);
        p.setShader(null);

        // ── stelle: compaiono quando il sole è sotto -2° e spariscono sotto le nuvole ──
        double stars = Math.max(0, Math.min(1.0, (-sunAlt - 2.0) / 10.0)) * (1.0 - cloud * 0.9);
        if (stars > 0.02) {
            Random rnd = new Random(42); // sempre le stesse stelle
            p.setColor(Color.WHITE);
            for (int i = 0; i < 70; i++) {
                p.setAlpha((int) (255 * stars * (rnd.nextDouble() * 0.6 + 0.4)));
                c.drawCircle((float) (rnd.nextDouble() * w), (float) (rnd.nextDouble() * h * 0.8),
                        (float) (density * (rnd.nextDouble() + 0.5)), p);
            }
            p.setAlpha(255);
        }

        // ── sole: alone e disco (visibile da -8° in su, il disco da -1°) ──
        float skyH = Math.min(h, 120 * density);
        if (sunAlt > -8) {
            float[] sp = pos(sun[1], sunAlt, w, skyH);
            double low = Math.max(0, Math.min(1.0, 1.0 - sunAlt / 12.0)); // 1 = sole basso (più arancione)
            float glowR = (float) ((36 * low + 36) * density);
            p.setShader(new RadialGradient(sp[0], sp[1], glowR,
                    Color.argb((int) ((1.0 - cloud * 0.7) * 190), 255, (int) (240 - 70 * low), (int) (200 - 110 * low)),
                    Color.argb(0, 255, 200, 120), Shader.TileMode.CLAMP));
            c.drawCircle(sp[0], sp[1], glowR, p);
            p.setShader(null);
            if (sunAlt > -1) {
                p.setColor(Color.argb((int) ((1.0 - 0.75 * cloud) * 255), 255,
                        (int) (250 - 60 * low), (int) (225 - low * 120)));
                c.drawCircle(sp[0], sp[1], 7 * density, p);
            }
        }

        // ── luna (visibile da -2° in su), più tenue di giorno e sotto le nuvole ──
        if (moon[0] > -2) {
            float[] mp = pos(moon[1], moon[0], w, skyH);
            float mr = 6.5f * density;
            double phase = moonPhase(now);
            boolean southern = lat < 0;
            double visible = Math.max(0.15, 1.0 - cloud * 0.8);
            double daylight = sunAlt <= 5 ? 1.0 : 0.55;
            drawMoon(c, mp[0], mp[1], mr, phase, southern, (float) (visible * daylight));
        }

        // ── nuvole: tre cerchi per nuvola, colorate dal cielo (rosate all'alba, scure di notte) ──
        if (cloud > 0.3 && !bgOnly) {
            Random rnd = new Random(7);
            int warm = mix(Color.WHITE, Color.parseColor("#FFC3A8"), Math.max(0, 1.0 - Math.abs(sunAlt - 2.0) / 8.0) * 0.8);
            p.setColor(mix(warm, Color.parseColor("#2E3546"), Math.max(0, Math.min(1.0, (-sunAlt + 2.0) / 10.0))));
            p.setAlpha((int) (80 * cloud + 120));
            int n = (int) (6 * cloud);
            for (int i = 0; i < n; i++) {
                float x = (float) (rnd.nextDouble() * w);
                float y = (float) (rnd.nextDouble() * skyH * 0.6);
                float cr = (float) ((rnd.nextDouble() * 16 + 14) * density);
                c.drawCircle(x, y, 0.55f * cr, p);
                float dx = 0.5f * cr;
                c.drawCircle(x + dx, 0.1f * cr + y, cr * 0.45f, p);
                c.drawCircle(x - dx, y + 0.15f * cr, cr * 0.4f, p);
            }
            p.setAlpha(255);
        }

        // ── velo scuro, più forte in basso, per far leggere il testo ──
        p.setShader(new LinearGradient(0, 0, 0, h,
                new int[] {Color.argb(40, 0, 0, 0), Color.argb(30, 0, 0, 0), Color.argb(115, 0, 0, 0)},
                new float[] {0, 0.35f, 1f}, Shader.TileMode.CLAMP));
        c.drawRect(full, p);
        p.setShader(null);

        if (bgOnly) {
            // pannello blu notte semitrasparente con cornice e riflesso in alto
            p.setShader(new LinearGradient(0, 0, 0, h,
                    new int[] {Color.argb(70, 14, 19, 40), Color.argb(205, 18, 24, 48), Color.argb(240, 11, 15, 32)},
                    new float[] {0, 0.34f, 1f}, Shader.TileMode.CLAMP));
            c.drawRect(full, p);
            p.setShader(null);
            Paint stroke = new Paint(Paint.ANTI_ALIAS_FLAG);
            stroke.setStyle(Paint.Style.STROKE);
            stroke.setStrokeWidth(Math.max(1f, density));
            stroke.setColor(Color.argb(34, 255, 255, 255));
            float in = 0.5f * density;
            c.drawRoundRect(new RectF(in, in, w - in, h - in), corner, corner, stroke);
            stroke.setShader(new LinearGradient(0, 0, w, 0,
                    new int[] {Color.argb(0, 255, 255, 255), Color.argb(70, 255, 255, 255), Color.argb(0, 255, 255, 255)},
                    null, Shader.TileMode.CLAMP));
            c.drawLine(corner, density, w - corner, density, stroke);
            return bmp;
        }

        // ── testata: numero del giorno, giorno della settimana, mese, meteo ──
        TextPaint tp = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        tp.setColor(Color.WHITE);
        float chipW = 4 * density; // larghezza della barretta colorata degli eventi (e raggio dell'ombra)
        tp.setShadowLayer(chipW, 0, density, Color.argb(120, 0, 0, 0));
        Typeface bold = Typeface.create("sans-serif", Typeface.BOLD);
        Typeface medium = Typeface.create("sans-serif-medium", Typeface.NORMAL);
        Typeface normal = Typeface.create("sans-serif", Typeface.NORMAL);
        Calendar cal = Calendar.getInstance();
        cal.setTimeInMillis(now);
        String dayNum = String.valueOf(cal.get(Calendar.DAY_OF_MONTH));
        String wd = data.optString("wd", "");
        String month = data.optString("month", "");
        String wxText = wx == null ? "" : (icon(st) + " " + wx.optString("t", "")).trim();
        float pad = 14 * density;
        float hDp = h / density;
        float wDp = w / density;
        int nowMin = cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE);
        JSONArray items = data.optJSONArray("items");
        JSONObject labels = data.optJSONObject("labels");
        String todayKey = String.format(Locale.ROOT, "%04d-%02d-%02d",
                cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1, cal.get(Calendar.DAY_OF_MONTH));

        if (hDp >= 105) {
            // ── widget alto: testata grande e lista degli eventi sotto ──
            tp.setTypeface(bold);
            float bigSize = 34 * density;
            tp.setTextSize(bigSize);
            float x = pad;
            float baseY = pad + 30 * density;
            c.drawText(dayNum, x, baseY, tp);
            float gap10 = 10 * density;
            float x2 = tp.measureText(dayNum) + x + gap10;
            tp.setTypeface(medium);
            float size13 = 13 * density;
            tp.setTextSize(size13);
            float size15 = 15 * density;
            c.drawText(TextUtils.ellipsize(wd, tp, w - x2 - x - 60 * density, TextUtils.TruncateAt.END).toString(),
                    x2, baseY - size15, tp);
            tp.setTypeface(normal);
            tp.setTextSize(11.5f * density);
            tp.setAlpha(225);
            c.drawText(month, x2, baseY, tp);
            tp.setAlpha(255);
            if (!wxText.isEmpty()) {
                tp.setTypeface(medium);
                tp.setTextSize(x); // 14dp
                c.drawText(wxText, w - x - tp.measureText(wxText), 18 * density + x, tp);
            }

            float cursor = baseY + x;          // bordo inferiore dell'ultima cosa disegnata
            float headGap = 18 * density;      // spazio preso da un'intestazione di giorno
            float maxY = h - 0.6f * x;         // limite inferiore utile
            if (items == null) return bmp;
            float rowH = 22 * density;
            String lastKey = "";
            int drawn = 0;
            for (int i = 0; i < items.length(); i++) {
                JSONObject it = items.optJSONObject(i);
                if (it == null) continue;
                String k = it.optString("k");
                int end = it.optInt("e", -1);
                // gli eventi di oggi già finiti non si mostrano
                if (k.equals(todayKey) && end >= 0 && end < nowMin) continue;
                float rowTop;
                if (k.equals(lastKey)) {
                    rowTop = cursor;
                } else {
                    float afterHead = cursor + headGap;
                    if (afterHead + rowH > maxY) {
                        // NOTA RICOSTRUZIONE: nel decompilato il caso "non c'è spazio" (sia per
                        // l'intestazione sia per la riga, qui sotto) finisce nello stesso blocco:
                        // se non è stato disegnato nulla scrive il testo "empty" e termina.
                        if (drawn == 0) drawEmpty(c, tp, data, medium, size13, x, w, cursor + headGap);
                        return bmp;
                    }
                    tp.setTypeface(bold);
                    tp.setTextSize(gap10);
                    tp.setAlpha(200);
                    c.drawText(label(labels, k, todayKey).toUpperCase(Locale.getDefault()), x, cursor + size13, tp);
                    tp.setAlpha(255);
                    lastKey = k;
                    rowTop = afterHead;
                }
                float rowBottom = rowTop + rowH;
                if (rowBottom > maxY) {
                    if (drawn == 0) drawEmpty(c, tp, data, medium, size13, x, w, rowTop + headGap);
                    return bmp;
                }
                // barretta colorata dell'evento
                p.setColor(parse(it.optString("c"), Color.WHITE));
                float in3 = 3 * density;
                c.drawRoundRect(new RectF(x, rowTop + in3, x + chipW, rowBottom - in3), 2 * density, 2 * density, p);
                // orario (o "tutto il giorno" / stella per le festività)
                int start = it.optInt("s", -1);
                String time;
                if (start < 0) {
                    time = it.optInt("h", 0) == 1 ? "★" : data.optString("allDay", "—");
                } else {
                    time = fmtTime(start, h12);
                }
                tp.setTypeface(normal);
                tp.setTextSize(11 * density);
                tp.setAlpha(225);
                float timeMax = 70 * density;
                float timeW = Math.min(tp.measureText(time), timeMax);
                float timeX = x + gap10;
                float textY = rowTop + size15;
                c.drawText(TextUtils.ellipsize(time, tp, timeMax, TextUtils.TruncateAt.END).toString(), timeX, textY, tp);
                // titolo
                tp.setTypeface(medium);
                tp.setTextSize(size13);
                tp.setAlpha(255);
                float titleX = timeX + Math.max(timeW, bigSize) + 8 * density;
                c.drawText(TextUtils.ellipsize(it.optString("t"), tp, w - titleX - x, TextUtils.TruncateAt.END).toString(),
                        titleX, textY, tp);
                drawn++;
                lastKey = k;
                cursor = rowBottom;
            }
            return bmp;
        }

        // ── widget basso: una riga con giorno, nome, mese/meteo e (se largo) il prossimo evento ──
        tp.setTypeface(bold);
        float size40 = 40 * density;
        tp.setTextSize(Math.min(0.55f * h, size40));
        float midY = h / 2f;
        c.drawText(dayNum, pad, midY + tp.getTextSize() * 0.36f, tp);
        float gap8 = 8 * density;
        float x2 = tp.measureText(dayNum) + pad + gap8;
        tp.setTypeface(medium);
        tp.setTextSize(12 * density);
        float d2 = 2 * density;
        c.drawText(TextUtils.ellipsize(wd, tp, Math.max(size40, 0.3f * w), TextUtils.TruncateAt.END).toString(),
                x2, midY - d2, tp);
        tp.setTypeface(normal);
        tp.setTextSize(11 * density);
        tp.setAlpha(220);
        String line2 = month + (wxText.isEmpty() ? "" : "  " + wxText);
        float size13 = 13 * density;
        float lowY = midY + size13;
        c.drawText(line2, x2, lowY, tp);
        tp.setAlpha(255);
        if (wDp > 200 && items != null) {
            JSONObject next = firstUpcoming(items);
            float x3 = 0.47f * w;
            if (next != null) {
                p.setColor(parse(next.optString("c"), Color.WHITE));
                float half = 16 * density;
                c.drawRoundRect(new RectF(x3, midY - half, x3 + chipW, midY + half), d2, d2, p);
                String sub = label(labels, next.optString("k"), todayKey)
                        + (next.optInt("s", -1) < 0 ? "" : " · " + fmtTime(next.optInt("s"), h12));
                tp.setTypeface(normal);
                tp.setTextSize(10.5f * density);
                tp.setAlpha(220);
                float avail = w - x3 - pad - gap8;
                float x4 = x3 + 10 * density;
                c.drawText(TextUtils.ellipsize(sub, tp, avail, TextUtils.TruncateAt.END).toString(),
                        x4, midY - 3 * density, tp);
                tp.setTypeface(bold);
                tp.setTextSize(size13);
                tp.setAlpha(255);
                c.drawText(TextUtils.ellipsize(next.optString("t"), tp, avail, TextUtils.TruncateAt.END).toString(),
                        x4, lowY, tp);
            }
        }
        return bmp;
    }

    /** Il testo "nessun evento" (chiave "empty" del JSON) quando non c'è spazio per nessuna riga. */
    private static void drawEmpty(Canvas c, TextPaint tp, JSONObject data, Typeface medium, float size13,
                                  float x, int w, float y) {
        tp.setTypeface(medium);
        tp.setTextSize(size13);
        tp.setAlpha(230);
        c.drawText(TextUtils.ellipsize(data.optString("empty", "—"), tp, w - x * 2, TextUtils.TruncateAt.END).toString(),
                x, y, tp);
    }

    /* ═════════════════ testi di supporto ═════════════════ */

    /** Il primo evento non festivo della lista, altrimenti il primo in assoluto (null se vuota). */
    private static JSONObject firstUpcoming(JSONArray items) {
        for (int i = 0; i < items.length(); i++) {
            JSONObject it = items.optJSONObject(i);
            if (it != null && it.optInt("h", 0) == 0) return it;
        }
        return items.length() > 0 ? items.optJSONObject(0) : null;
    }

    /** Minuti dalla mezzanotte → "08:30", oppure "8:30a" / "8p" con l'orologio a 12 ore. */
    private static String fmtTime(int minutes, boolean h12) {
        int hh = (minutes / 60) % 24;
        int mm = minutes % 60;
        if (!h12) return String.format(Locale.ROOT, "%02d:%02d", hh, mm);
        int h = hh % 12;
        if (h == 0) h = 12;
        String ap = hh >= 12 ? "p" : "a";
        if (mm != 0) return String.format(Locale.ROOT, "%d:%02d%s", h, mm, ap);
        return h + ap;
    }

    /** L'emoji dello stato meteo ("st" del JSON "wx"); stringa vuota se sconosciuto. */
    private static String icon(String st) {
        switch (st) {
            case "cloudy": return "☁️";          // ☁️
            case "thunder": return "⛈️";         // ⛈️
            case "partly": return "⛅";                // ⛅
            case "fog": return "🌫️";       // 🌫️
            case "rain": return "🌧️";      // 🌧️
            case "snow": return "❄️";            // ❄️
            case "clear": return "☀️";           // ☀️
            case "drizzle": return "🌦️";   // 🌦️
            default: return "";
        }
    }

    /** Il nome da mostrare per il giorno "key" (es. "Oggi", "Domani", "Gio 12"), preso da "labels". */
    private static String label(JSONObject labels, String key, String todayKey) {
        return labels == null ? key : labels.optString(key, key);
    }
}
