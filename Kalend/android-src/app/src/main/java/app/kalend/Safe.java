package app.kalend;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;

/**
 * CONTROLLI DI SICUREZZA della parte nativa, in forma "pura".
 *
 * Qui non c'è nessuna API di Android (niente Context, Uri, Intent): solo
 * stringhe in ingresso e una risposta in uscita. Per questo le stesse regole
 * si possono verificare con i test automatici sul computer, senza telefono
 * (vedi app/src/test/java/app/kalend/SafeTest.java e tools/native-test.sh).
 *
 * Chi la usa:
 *  · MainActivity.trusted()        → {@link #isAppPage}: la pagina caricata è quella dell'app?
 *  · MainActivity.handleIntent()   → {@link #intentJs}: extra di widget e notifiche → JavaScript
 *  · MainActivity.openExternal()   → {@link #externalAllowed}: quali link possono uscire dall'app
 *  · MainActivity / KalendWidget   → {@link #sameToken}: il token segreto dei PendingIntent
 *  · MainActivity.Bridge.vibrate() → {@link #vibrateMs}: durata della vibrazione entro limiti
 */
final class Safe {

    /** schemi che possono essere aperti fuori dall'app (browser, posta, telefono, mappe) */
    static final String[] EXTERNAL_SCHEMES = {"https", "http", "mailto", "tel", "geo"};
    /** formato delle date passate dagli Intent: AAAA-MM-GG */
    static final String DATE_RE = "[0-9]{4}-[0-9]{2}-[0-9]{2}";
    /** id di una lista: lettere latine, cifre, _ e -, al massimo 48 */
    static final String LIST_RE = "[A-Za-z0-9_\\-]{1,48}";
    /** id di un evento: lettere latine, cifre, _ e -, al massimo 64 */
    static final String EVENT_RE = "[A-Za-z0-9_\\-]{1,64}";
    /** limiti della vibrazione chiesta dalla pagina (millisecondi) */
    static final int VIBRATE_MIN_MS = 10, VIBRATE_MAX_MS = 1000;

    private Safe() {}

    /**
     * La pagina all'indirizzo {@code url} è quella dell'app servita dall'host interno {@code host}?
     * Regola volutamente stretta: schema esattamente "https", nessun utente/password, nessuna
     * porta, host identico. Le pagine dell'app non hanno mai porta o credenziali nell'indirizzo,
     * quindi qualunque variante viene rifiutata.
     */
    static boolean isAppPage(String url, String host) {
        if (url == null || host == null || host.isEmpty()) return false;
        final String prefix = "https://";
        if (!url.startsWith(prefix)) return false;
        int end = url.length();
        for (int i = prefix.length(); i < url.length(); i++) {
            char ch = url.charAt(i);
            if (ch == '/' || ch == '?' || ch == '#') { end = i; break; }
        }
        // "authority" = la parte fra "https://" e il primo / ? #: deve essere SOLO l'host
        return host.equals(url.substring(prefix.length(), end));
    }

    /**
     * Traduce gli extra di un Intent arrivato da widget o notifiche nel JavaScript da eseguire
     * nella pagina, oppure {@code null} se non c'è nulla da fare.
     * Ogni valore è controllato con un'espressione regolare; i testi liberi passano solo
     * attraverso {@link JSONObject#quote}, che li trasforma in una stringa JavaScript sicura.
     *
     * Precedenze (dall'ultima vince): data o «aggiungi» → lista → evento → avviso del promemoria.
     *
     * @param date    extra "date" (AAAA-MM-GG)
     * @param add     extra "add" (qualunque valore non nullo: apre l'inserimento)
     * @param list    extra "list" (id della lista, oppure "*" = tutte)
     * @param ev      extra "ev" (id dell'evento; serve anche la data)
     * @param alert   extra "alert" (JSON del promemoria da mostrare)
     * @param tokenOk true se l'Intent porta il token segreto dell'app (solo allora l'avviso vale)
     */
    static String intentJs(String date, String add, String list, String ev, String alert, boolean tokenOk) {
        String js = null;
        boolean dateOk = date != null && date.matches(DATE_RE);
        if (dateOk) js = "try{KX.openDate('" + date + "')}catch(e){}";
        else if (add != null) js = "try{document.getElementById('btn-add').click()}catch(e){}";

        if (list != null && list.matches(LIST_RE)) {
            js = "try{setTimeout(function(){KX.openLists(" + JSONObject.quote(list) + ")},400)}catch(e){}";
        } else if ("*".equals(list)) {
            js = "try{setTimeout(function(){KX.openLists()},400)}catch(e){}";
        }
        if (list == null && ev != null && ev.matches(EVENT_RE) && dateOk) {
            js = "try{KX.openEventById(" + JSONObject.quote(ev) + ",'" + date + "')}catch(e){}";
        }
        // un avviso (promemoria) viene accettato solo con il token segreto dell'app
        if (alert != null && tokenOk) {
            js = "try{KX.alert(" + JSONObject.quote(alert) + ")}catch(e){}";
        }
        return js;
    }

    /**
     * Lo schema di un indirizzo, in minuscolo: la parte prima del primo ":" (come fa
     * android.net.Uri). Stringa vuota se non c'è.
     */
    static String scheme(String url) {
        if (url == null) return "";
        int i = url.indexOf(':');
        return i <= 0 ? "" : url.substring(0, i).toLowerCase(Locale.ROOT);
    }

    /** l'indirizzo può essere aperto fuori dall'app? Solo schemi innocui (niente javascript:, file:, intent:…) */
    static boolean externalAllowed(String url) {
        String s = scheme(url);
        for (String ok : EXTERNAL_SCHEMES) if (ok.equals(s)) return true;
        return false;
    }

    /**
     * Confronta il token atteso con quello ricevuto in tempo costante (non si può indovinare
     * un carattere alla volta misurando i tempi). Token mancante o vuoto → false.
     */
    static boolean sameToken(String expected, String got) {
        if (expected == null || expected.isEmpty() || got == null) return false;
        return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), got.getBytes(StandardCharsets.UTF_8));
    }

    /** durata della vibrazione chiesta dalla pagina, ricondotta fra 10 ms e 1 s */
    static int vibrateMs(int ms) {
        return Math.max(VIBRATE_MIN_MS, Math.min(VIBRATE_MAX_MS, ms));
    }
}
