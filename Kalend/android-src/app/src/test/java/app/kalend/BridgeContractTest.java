package app.kalend;

import org.junit.Test;

import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

/**
 * IL PONTE FRA PAGINA E TELEFONO (window.KalendNative ↔ MainActivity.Bridge).
 *
 * Tre contratti, verificati a ogni modifica:
 *  1. ELENCO APPROVATO: i metodi esposti alla pagina sono esattamente quelli qui sotto.
 *     Aggiungerne uno è una decisione di sicurezza: il test fallisce finché l'elenco non
 *     viene aggiornato (e il nuovo metodo controlla trusted()).
 *  2. PAGINA → NATIVO: ogni metodo che la pagina chiama esiste davvero nel ponte.
 *  3. NATIVO → PAGINA: ogni funzione della pagina che il nativo richiama (KX.openDate,
 *     window.__knCb, …) esiste ancora nella pagina.
 */
public class BridgeContractTest {

    /** i metodi del ponte con i tipi dei parametri, in ordine alfabetico */
    private static final String[] APPROVED = {
            "calEvents(int,double,double,String)", "calInsert(int,String)", "calList(int)", "calPermission(int)",
            "exactAlarms()", "geocode(int,String,String)", "httpGet(int,String)", "notifPermission(int)",
            "openSettings(String)", "openUrl(int,String)", "reliability()", "saveClip(int,String,String)",
            "saveFile(int,String,String,String)", "setBarColor(String)", "setNavColor(String)", "setReminders(String)",
            "setSecure(boolean)", "shareText(int,String,String)", "snoozeAlert(String)", "speech(int,String)",
            "speechCancel()", "speechLive(int,String)", "speechStop()", "takeListQueue()",
            "testReminder(String,String,int)", "updateWidget(String)", "vaultDel(String)", "vaultFetch(int,String)",
            "vaultHas(String)", "vaultPut(int,String,String)", "version()", "vibrate(int)",
    };
    /** l'unico metodo che non deve controllare la pagina: restituisce solo un numero di versione */
    private static final Set<String> NO_TRUST_NEEDED = new TreeSet<>(Arrays.asList("version"));

    /** i metodi del ponte, letti dalla classe compilata (senza avviare Android) */
    private static List<Method> bridgeMethods() throws Exception {
        Class<?> bridge = Class.forName("app.kalend.MainActivity$Bridge", false, BridgeContractTest.class.getClassLoader());
        List<Method> out = new ArrayList<>();
        for (Method m : bridge.getDeclaredMethods()) {
            if (m.isAnnotationPresent(android.webkit.JavascriptInterface.class)) out.add(m);
        }
        return out;
    }

    private static String signature(Method m) {
        StringBuilder sb = new StringBuilder(m.getName()).append('(');
        Class<?>[] p = m.getParameterTypes();
        for (int i = 0; i < p.length; i++) sb.append(i > 0 ? "," : "").append(p[i].getSimpleName());
        return sb.append(')').toString();
    }

    @Test public void elencoApprovatoDeiMetodi() throws Exception {
        Set<String> found = new TreeSet<>();
        for (Method m : bridgeMethods()) found.add(signature(m));
        assertEquals("metodi del ponte cambiati: aggiornare APPROVED solo dopo una revisione di sicurezza",
                new TreeSet<>(Arrays.asList(APPROVED)), found);
    }

    @Test public void metodiPubblici() throws Exception {
        for (Method m : bridgeMethods()) {
            assertTrue("la WebView vede solo i metodi pubblici: " + m.getName(), Modifier.isPublic(m.getModifiers()));
        }
    }

    /** ogni metodo, tranne version(), controlla che la pagina caricata sia quella dell'app */
    @Test public void ogniMetodoControllaLaPagina() {
        String src = TestFiles.source("MainActivity");
        int start = src.indexOf("class Bridge {");
        assertTrue("classe Bridge non trovata", start >= 0);
        String bridge = src.substring(start);
        String marker = "@android.webkit.JavascriptInterface public ";
        List<Integer> pos = new ArrayList<>();
        for (int i = bridge.indexOf(marker); i >= 0; i = bridge.indexOf(marker, i + 1)) pos.add(i);
        assertEquals("tutti i metodi del ponte usano la stessa annotazione", APPROVED.length, pos.size());
        for (int k = 0; k < pos.size(); k++) {
            String body = bridge.substring(pos.get(k), k + 1 < pos.size() ? pos.get(k + 1) : bridge.length());
            Matcher name = Pattern.compile("\\s(\\w+)\\(").matcher(body.substring(marker.length() - 1));
            assertTrue(name.find());
            String n = name.group(1);
            if (NO_TRUST_NEEDED.contains(n)) continue;
            assertTrue("il metodo " + n + " deve controllare trusted()", body.contains("trusted()"));
        }
    }

    /** ogni metodo chiamato dalla pagina (KalendNative.x, KN.has('x'), KN.call('x', …)) esiste */
    @Test public void laPaginaChiamaSoloMetodiEsistenti() throws Exception {
        Set<String> names = new TreeSet<>();
        for (Method m : bridgeMethods()) names.add(m.getName());
        String page = TestFiles.pageSources();
        Set<String> used = new TreeSet<>();
        Matcher a = Pattern.compile("KalendNative\\.(\\w+)").matcher(page);
        while (a.find()) used.add(a.group(1));
        Matcher b = Pattern.compile("KN\\.(?:has|call)\\(\\s*['\"](\\w+)['\"]").matcher(page);
        while (b.find()) used.add(b.group(1));
        assertTrue("la pagina usa il ponte (" + used.size() + " metodi)", used.size() >= 20);
        Set<String> missing = new TreeSet<>(used);
        missing.removeAll(names);
        assertTrue("la pagina chiama metodi che il ponte non ha: " + missing, missing.isEmpty());
    }

    /** le funzioni della pagina richiamate dal nativo esistono ancora nella pagina */
    @Test public void ilNativoChiamaSoloFunzioniEsistenti() {
        String nativeSrc = TestFiles.allSources();
        String page = TestFiles.pageSources();
        // simboli citati dal codice Java dentro le stringhe JavaScript
        Set<String> symbols = new TreeSet<>();
        Matcher m = Pattern.compile("(KX(?:\\.\\w+)+|EventsStore\\.\\w+|window\\.(?:__knCb|kalendBack))").matcher(nativeSrc);
        while (m.find()) symbols.add(m.group(1));
        assertTrue("trovati i richiami del nativo (" + symbols + ")", symbols.size() >= 10);
        List<String> missing = new ArrayList<>();
        for (String s : symbols) {
            String last = s.substring(s.lastIndexOf('.') + 1);
            String q = Pattern.quote(s), l = Pattern.quote(last);
            // definizione come assegnazione (KX.x=…), proprietà ({x:…}), metodo abbreviato (x(a){…}) o funzione
            Pattern def = Pattern.compile(q + "\\s*=|[{,\\s]" + l + "\\s*:|[{,\\s]" + l + "\\s*\\([^)]*\\)\\s*\\{|function\\s+" + l + "\\s*\\(");
            if (!def.matcher(page).find()) missing.add(s);
        }
        assertTrue("il nativo richiama funzioni che la pagina non definisce più: " + missing, missing.isEmpty());
    }
}
