package app.kalend;

import org.junit.Test;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

/**
 * REGOLE SUL CODICE che non si possono provare senza un telefono (WebView, widget, notifiche):
 * il test legge i sorgenti Java e controlla che le impostazioni di sicurezza ci siano ancora.
 * È un "guardiano": se una modifica futura toglie una protezione, il test lo segnala.
 */
public class SourceRulesTest {

    private static final String MAIN = TestFiles.source("MainActivity");

    private static int count(String text, String what) {
        int n = 0;
        for (int i = text.indexOf(what); i >= 0; i = text.indexOf(what, i + 1)) n++;
        return n;
    }

    /* ───────────────────────── WebView ───────────────────────── */

    @Test public void webViewChiusaVersoFileEContenuti() {
        assertTrue(MAIN.contains("s.setAllowFileAccess(false)"));
        assertTrue(MAIN.contains("s.setAllowContentAccess(false)"));
        assertTrue(MAIN.contains("s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW)"));
        assertTrue(MAIN.contains("s.setSafeBrowsingEnabled(true)"));
        String all = TestFiles.allSources();
        assertFalse(all.contains("setAllowUniversalAccessFromFileURLs(true)"));
        assertFalse(all.contains("setAllowFileAccessFromFileURLs(true)"));
        assertFalse(all.contains("MIXED_CONTENT_ALWAYS_ALLOW"));
        assertFalse(all.contains("setJavaScriptCanOpenWindowsAutomatically(true)"));
    }

    @Test public void debugDellaPaginaSoloNellaVersioneDiProva() {
        assertTrue(MAIN.contains("WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)"));
        assertFalse(TestFiles.allSources().contains("setWebContentsDebuggingEnabled(true)"));
    }

    @Test public void paginaServitaDaHttpsInterno() {
        assertTrue(MAIN.contains("static final String HOST = \"appassets.androidplatform.net\""));
        assertTrue(MAIN.contains("static final String START = \"https://\" + HOST + \"/www/index.html\""));
        assertFalse("niente file:// per la pagina", MAIN.contains("loadUrl(\"file:"));
    }

    @Test public void unSoloPonteConUnSoloNome() {
        assertEquals(1, count(TestFiles.allSources(), "addJavascriptInterface("));
        assertTrue(MAIN.contains("web.addJavascriptInterface(new Bridge(), \"KalendNative\")"));
        assertTrue("trusted() usa la regola stretta di Safe", MAIN.contains("return Safe.isAppPage(pageUrl, HOST);"));
    }

    @Test public void navigazioneEsternaFuoriDallApp() {
        Matcher m = Pattern.compile("shouldOverrideUrlLoading\\(WebView v, WebResourceRequest req\\) \\{(.*?)\\n        \\}", Pattern.DOTALL).matcher(MAIN);
        assertTrue(m.find());
        String body = m.group(1);
        assertTrue("dentro la WebView resta solo l'host dell'app", body.contains("if (HOST.equals(u.getHost())) return false;"));
        assertTrue("tutto il resto esce", body.contains("openExternal(") && body.contains("return true;"));
        assertTrue("i link esterni passano dal filtro degli schemi", MAIN.contains("if (!Safe.externalAllowed(url)) return;"));
    }

    @Test public void posizioneSoloAllaPaginaDellApp() {
        assertTrue(MAIN.contains("if (origin == null || !origin.startsWith(\"https://\" + HOST)) { cb.invoke(origin, false, false); return; }"));
    }

    /* ───────────────────────── Intent e widget ───────────────────────── */

    @Test public void intentInArrivoPassanoDaSafe() {
        assertTrue(MAIN.contains("Safe.intentJs("));
        assertTrue("l'avviso vale solo con il token", MAIN.contains("Safe.sameToken(alertToken(this), in.getStringExtra(\"tok\"))"));
        assertTrue("gli extra vengono consumati", MAIN.contains("for (String k : new String[]{\"date\", \"add\", \"list\", \"ev\", \"alert\", \"tok\"}) in.removeExtra(k);"));
    }

    /** il widget è esportato: i suoi pulsanti funzionano solo con il token segreto dell'app */
    @Test public void pulsantiDelWidgetConToken() {
        String w = TestFiles.source("KalendWidget");
        int recv = w.indexOf("public void onReceive(Context c, Intent intent)");
        int check = w.indexOf("Safe.sameToken(MainActivity.alertToken(c), intent.getStringExtra(\"tok\"))", recv);
        int sw = w.indexOf("switch (action)", recv);
        assertTrue("controllo del token in onReceive", recv > 0 && check > recv);
        assertTrue("il controllo viene PRIMA di eseguire le azioni", check < sw);

        // ogni Intent verso KalendWidget (tranne il tick periodico, innocuo) porta il token
        String all = TestFiles.allSources();
        Matcher m = Pattern.compile("new Intent\\(c, KalendWidget\\.class\\)[^;]*;").matcher(all);
        int seen = 0;
        while (m.find()) {
            String stmt = m.group();
            if (stmt.contains("A_TICK")) continue;
            seen++;
            assertTrue("Intent del widget senza token: " + stmt, stmt.contains("putExtra(\"tok\", MainActivity.alertToken(c))"));
        }
        assertEquals("pulsanti del widget e spunte delle liste", 2, seen);
    }

    @Test public void notificheConTokenEVersionePubblica() {
        String r = TestFiles.source("Reminders");
        assertTrue("toccare la notifica apre l'avviso con il token",
                r.contains("open.putExtra(\"alert\", j).putExtra(\"tok\", MainActivity.alertToken(c));"));
        assertTrue("sulla schermata di blocco non si legge l'evento",
                r.contains("b.setVisibility(Notification.VISIBILITY_PRIVATE).setPublicVersion(pub.build());"));
    }

    /** PendingIntent immutabili; l'unica eccezione è il modello delle righe del widget (serve ai fill-in) */
    @Test public void pendingIntentImmutabili() {
        String all = TestFiles.allSources();
        assertEquals("FLAG_MUTABLE usato una sola volta", 1, count(all, "PendingIntent.FLAG_MUTABLE"));
        assertTrue(TestFiles.source("KalendWidget").contains("PendingIntent.FLAG_MUTABLE"));
        Matcher m = Pattern.compile("PendingIntent\\.get(Activity|Broadcast|Service)\\(([^;]*)\\);").matcher(all);
        int n = 0;
        while (m.find()) {
            n++;
            String call = m.group(2);
            boolean ok = call.contains("FLAG_IMMUTABLE") || call.contains("PI_FLAGS") || call.contains("tplFlags");
            assertTrue("PendingIntent senza flag di immutabilità: " + m.group(), ok);
        }
        assertTrue("trovati i PendingIntent (" + n + ")", n >= 6);
    }

    /* ───────────────────────── rete e segreti ───────────────────────── */

    @Test public void reteSoloTramiteNet() {
        String all = TestFiles.allSources();
        assertEquals("una sola connessione HTTP nel codice (Net.fetchPublic)", 1, count(all, ".openConnection()"));
        assertTrue(TestFiles.source("Net").contains("c.setInstanceFollowRedirects(false);"));
    }

    @Test public void nessunaChiaveNelCodice() {
        String all = TestFiles.allSources();
        String[] patterns = {"AIza[0-9A-Za-z_\\-]{20,}", "sk-[A-Za-z0-9]{20,}", "-----BEGIN [A-Z ]*PRIVATE KEY-----", "ghp_[A-Za-z0-9]{20,}"};
        for (String p : patterns) assertFalse("possibile chiave nel codice: " + p, Pattern.compile(p).matcher(all).find());
    }
}
