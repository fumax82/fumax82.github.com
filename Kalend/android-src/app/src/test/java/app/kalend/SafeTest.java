package app.kalend;

import org.json.JSONArray;
import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

/**
 * Controlli di sicurezza del ponte nativo (classe Safe).
 *
 * Cosa protegge:
 *  · solo la pagina dell'app può usare il ponte KalendNative (isAppPage);
 *  · i dati che arrivano da widget e notifiche non possono diventare codice JavaScript
 *    (intentJs): altre app possono aprire Kalend con extra a piacere;
 *  · i link che escono dall'app non possono usare schemi pericolosi (externalAllowed);
 *  · il token segreto dei PendingIntent si confronta senza scorciatoie (sameToken).
 */
public class SafeTest {

    private static final String HOST = MainActivity.HOST;
    private static final String START = "https://" + HOST + "/www/index.html";

    /* ───────────────────────── pagina fidata ───────────────────────── */

    @Test public void paginaDellAppAccettata() {
        assertTrue(Safe.isAppPage(START, HOST));
        assertTrue(Safe.isAppPage(START + "?v=55#oggi", HOST));
        assertTrue(Safe.isAppPage("https://" + HOST, HOST));
        assertTrue(Safe.isAppPage("https://" + HOST + "?x", HOST));
    }

    @Test public void altrePagineRifiutate() {
        String[] bad = {
                null, "", "about:blank", "data:text/html,<b>x</b>",
                "http://" + HOST + "/www/index.html",              // non https
                "HTTPS://" + HOST + "/www/index.html",             // schema non esatto
                "https://evil.example/www/index.html",
                "https://" + HOST + ".evil.example/",                // host che INIZIA come il nostro
                "https://evil" + HOST + "/",                          // host che FINISCE come il nostro
                "https://evil.example/" + HOST + "/",                 // il nostro host nel percorso
                "https://evil.example/?https://" + HOST + "/",        // ... o nella query
                "https://" + HOST + "@evil.example/",                 // credenziali: l'host vero è evil.example
                "https://user@" + HOST + "/",                         // credenziali sul nostro host: rifiutate
                "https://" + HOST + ":8443/www/index.html",           // porta
                "https://" + HOST + "\\@evil.example/",
                "file:///android_asset/www/index.html",
                "javascript:alert(1)",
                "content://app.kalend/www/index.html",
        };
        for (String u : bad) assertFalse("doveva essere rifiutata: " + u, Safe.isAppPage(u, HOST));
        assertFalse(Safe.isAppPage(START, null));
        assertFalse(Safe.isAppPage(START, ""));
    }

    /* ─────────────────────── Intent → JavaScript ─────────────────────── */

    @Test public void dataValidaApreIlGiorno() {
        assertEquals("try{KX.openDate('2026-10-29')}catch(e){}", Safe.intentJs("2026-10-29", null, null, null, null, false));
    }

    @Test public void dataNonValidaIgnorata() {
        String[] bad = {"2026-10-29');alert(1);//", "2026-10-29\n", "26-10-29", "2026/10/29", "", "２０２６-10-29", "2026-10-29 "};
        for (String d : bad) assertNull("data accettata: " + d, Safe.intentJs(d, null, null, null, null, false));
    }

    @Test public void aggiungiApreIlModulo() {
        assertEquals("try{document.getElementById('btn-add').click()}catch(e){}", Safe.intentJs(null, "1", null, null, null, false));
        // con una data valida vince la data
        assertEquals("try{KX.openDate('2026-01-02')}catch(e){}", Safe.intentJs("2026-01-02", "1", null, null, null, false));
    }

    @Test public void listeConIdControllato() {
        assertEquals("try{setTimeout(function(){KX.openLists(\"spesa_1-a\")},400)}catch(e){}",
                Safe.intentJs(null, null, "spesa_1-a", null, null, false));
        assertEquals("try{setTimeout(function(){KX.openLists()},400)}catch(e){}", Safe.intentJs(null, null, "*", null, null, false));
        String[] bad = {"a'b", "a\"b", "a)b", "lista spesa", "лист", "", repeat("x", 49)};
        for (String l : bad) assertNull("lista accettata: " + l, Safe.intentJs(null, null, l, null, null, false));
        assertEquals(repeat("x", 48).length(), 48);
        assertTrue(Safe.intentJs(null, null, repeat("x", 48), null, null, false).contains("openLists"));
    }

    @Test public void eventoSoloConDataESenzaLista() {
        assertEquals("try{KX.openEventById(\"ev_12-x\",'2026-10-29')}catch(e){}",
                Safe.intentJs("2026-10-29", null, null, "ev_12-x", null, false));
        // senza data valida l'evento non si apre
        assertNull(Safe.intentJs(null, null, null, "ev1", null, false));
        // con una lista vince la lista
        assertTrue(Safe.intentJs("2026-10-29", null, "l1", "ev1", null, false).contains("openLists"));
        // id evento con caratteri non ammessi: resta solo l'apertura del giorno
        assertEquals("try{KX.openDate('2026-10-29')}catch(e){}", Safe.intentJs("2026-10-29", null, null, "e'v", null, false));
        assertEquals("try{KX.openDate('2026-10-29')}catch(e){}", Safe.intentJs("2026-10-29", null, null, repeat("e", 65), null, false));
    }

    @Test public void avvisoSoloConToken() {
        assertNull(Safe.intentJs(null, null, null, null, "{\"title\":\"x\"}", false));
        String js = Safe.intentJs("2026-10-29", null, null, null, "{\"title\":\"x\"}", true);
        assertTrue(js.startsWith("try{KX.alert("));
    }

    /** qualunque testo dentro l'avviso resta UNA stringa JavaScript: non può chiudere la chiamata */
    @Test public void avvisoNonDiventaCodice() throws Exception {
        String[] nasty = {
                "\"});alert(1);//",
                "'); alert(1); //",
                "\\\"); alert(1); //",
                "riga1\nriga2\r\n\u2028\u2029fine",
                "</script><script>alert(1)</script>",
                "\u0000\u0001\u001f",
                "emoji 🎉 e accenti àèìòù 漢字 עברית",
                "${alert(1)}`",
        };
        for (String s : nasty) {
            String js = Safe.intentJs(null, null, null, null, s, true);
            String pre = "try{KX.alert(", post = ")}catch(e){}";
            assertTrue(js.startsWith(pre) && js.endsWith(post));
            String literal = js.substring(pre.length(), js.length() - post.length());
            assertTrue("deve essere una stringa tra virgolette: " + literal, literal.startsWith("\"") && literal.endsWith("\""));
            assertFalse("a capo non protetto", literal.contains("\n") || literal.contains("\r"));
            JSONArray back = new JSONArray("[" + literal + "]");
            assertEquals("una sola stringa", 1, back.length());
            assertEquals("il testo torna identico", s, back.getString(0));
        }
    }

    /* ───────────────────────── link esterni ───────────────────────── */

    @Test public void schemiInnocuiPermessi() {
        String[] ok = {"https://example.org/a?b#c", "HTTPS://EXAMPLE.ORG", "http://example.org", "mailto:a@b.c", "tel:+390612345", "geo:41.9,12.5?q=Roma"};
        for (String u : ok) assertTrue("doveva essere permesso: " + u, Safe.externalAllowed(u));
    }

    @Test public void schemiPericolosiBloccati() {
        String[] bad = {"javascript:alert(1)", "JavaScript:alert(1)", " javascript:alert(1)", "file:///sdcard/x", "content://x/y",
                "intent://scan/#Intent;scheme=zxing;end", "data:text/html,x", "vbscript:x", "market://details?id=x",
                "sms:123", "", null, "senza-schema", ":vuoto"};
        for (String u : bad) assertFalse("doveva essere bloccato: " + u, Safe.externalAllowed(u));
        assertEquals("https", Safe.scheme("HTTPS://x"));
        assertEquals("", Safe.scheme("nessuno"));
    }

    /* ───────────────────────── token e vibrazione ───────────────────────── */

    @Test public void tokenConfrontatoPerIntero() {
        String t = "a1b2c3d4-e5f6";
        assertTrue(Safe.sameToken(t, "a1b2c3d4-e5f6"));
        assertFalse(Safe.sameToken(t, "a1b2c3d4-e5f"));
        assertFalse(Safe.sameToken(t, "a1b2c3d4-e5f6x"));
        assertFalse(Safe.sameToken(t, ""));
        assertFalse(Safe.sameToken(t, null));
        assertFalse(Safe.sameToken(null, null));
        assertFalse(Safe.sameToken("", ""));
    }

    @Test public void vibrazioneEntroLimiti() {
        assertEquals(10, Safe.vibrateMs(-5));
        assertEquals(10, Safe.vibrateMs(0));
        assertEquals(40, Safe.vibrateMs(40));
        assertEquals(580, Safe.vibrateMs(580));      // la sequenza più lunga che usa la pagina
        assertEquals(1000, Safe.vibrateMs(100_000));
        assertEquals(1000, Safe.vibrateMs(Integer.MAX_VALUE));
        assertEquals(10, Safe.vibrateMs(Integer.MIN_VALUE));
    }

    private static String repeat(String s, int n) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < n; i++) sb.append(s);
        return sb.toString();
    }
}
