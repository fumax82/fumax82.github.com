package app.kalend;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * RETE SICURA per la pagina: tutte le richieste HTTP dell'app passano da qui.
 *
 * Regole (le stesse della v53, più lo User-Agent con contatto):
 *  · solo https, niente credenziali nell'indirizzo;
 *  · l'host viene risolto e ogni suo indirizzo IP deve essere pubblico
 *    (niente loopback, rete locale, link-local, multicast, CGNAT 100.64/10,
 *    ULA fc00::/7): così un link ostile non può far interrogare il router
 *    o un NAS di casa;
 *  · i redirect NON sono seguiti automaticamente: ogni salto viene
 *    ricontrollato con le stesse regole, al massimo 5;
 *  · risposta al massimo 8 MB, tempi massimi di connessione e lettura;
 *  · User-Agent "Kalend/<versione> (Android; +contatto)": MET Norway
 *    richiede di identificare l'app con un contatto.
 */
final class Net {
    static final long MAX_BYTES = 8_000_000L;
    static final int MAX_REDIRECTS = 5;
    static final String USER_AGENT = "Kalend/" + BuildConfig.VERSION_NAME + " (Android; +" + BuildConfig.CONTACT + ")";

    private Net() {}

    /** webcal:// e webcals:// diventano https:// */
    static String normUrl(String u) {
        String s = u == null ? "" : u.trim();
        if (s.regionMatches(true, 0, "webcal://", 0, 9)) s = "https://" + s.substring(9);
        if (s.regionMatches(true, 0, "webcals://", 0, 10)) s = "https://" + s.substring(10);
        return s;
    }

    /** lancia un'eccezione se l'indirizzo non è https pubblico */
    static void checkPublicHttps(String u) throws Exception {
        URL url = new URL(u);
        if (!"https".equalsIgnoreCase(url.getProtocol())) throw new Exception("solo https");
        if (url.getUserInfo() != null) throw new Exception("indirizzo non valido");
        String host = url.getHost();
        if (host == null || host.isEmpty()) throw new Exception("indirizzo non valido");
        for (InetAddress a : InetAddress.getAllByName(host)) {
            if (a.isLoopbackAddress() || a.isSiteLocalAddress() || a.isLinkLocalAddress()
                    || a.isAnyLocalAddress() || a.isMulticastAddress()) {
                throw new Exception("indirizzo locale non consentito");
            }
            byte[] b = a.getAddress();
            if (b.length == 4 && (b[0] & 0xFF) == 100 && (b[1] & 0xC0) == 64) throw new Exception("indirizzo locale non consentito"); // 100.64.0.0/10
            if (b.length == 16 && (b[0] & 0xFE) == 0xFC) throw new Exception("indirizzo locale non consentito");                   // fc00::/7
        }
    }

    /** scarica un testo (iCal, JSON meteo…) rispettando le regole sopra */
    static String fetchPublic(String u) throws Exception {
        String cur = normUrl(u);
        for (int hop = 0; hop < MAX_REDIRECTS; hop++) {
            checkPublicHttps(cur);
            HttpURLConnection c = (HttpURLConnection) new URL(cur).openConnection();
            try {
                c.setConnectTimeout(15000);
                c.setReadTimeout(30000);
                c.setInstanceFollowRedirects(false);
                c.setUseCaches(false);
                c.setRequestProperty("User-Agent", USER_AGENT);
                c.setRequestProperty("Accept", "text/calendar, application/json, text/plain, */*");
                int code = c.getResponseCode();
                String loc = c.getHeaderField("Location");
                if (code >= 300 && code < 400 && loc != null) {
                    cur = new URL(new URL(cur), loc).toString();   // nuovo salto: ricontrollato al giro dopo
                    continue;
                }
                if (code != 200) throw new Exception("HTTP " + code);
                try (InputStream in = c.getInputStream()) {
                    ByteArrayOutputStream out = new ByteArrayOutputStream();
                    byte[] buf = new byte[16384];
                    long total = 0;
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        out.write(buf, 0, n);
                        total += n;
                        if (total > MAX_BYTES) throw new Exception("file troppo grande");
                    }
                    return new String(out.toByteArray(), StandardCharsets.UTF_8);
                }
            } finally {
                c.disconnect();
            }
        }
        throw new Exception("troppi redirect");
    }
}
