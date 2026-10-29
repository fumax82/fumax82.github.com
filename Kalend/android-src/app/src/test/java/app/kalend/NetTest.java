package app.kalend;

import com.sun.net.httpserver.HttpServer;

import org.junit.Test;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

/**
 * Rete sicura (classe Net): l'app scarica solo da indirizzi https pubblici.
 *
 * I casi usano indirizzi IP scritti per esteso, così non serve Internet né un DNS:
 * Java li riconosce da sé. L'ultimo test accende un piccolo server sul computer
 * (127.0.0.1) e verifica che Net si rifiuti di contattarlo: zero richieste ricevute.
 */
public class NetTest {

    @Test public void webcalDiventaHttps() {
        assertEquals("https://example.org/cal.ics", Net.normUrl("webcal://example.org/cal.ics"));
        assertEquals("https://example.org/cal.ics", Net.normUrl("WEBCAL://example.org/cal.ics"));
        assertEquals("https://example.org/cal.ics", Net.normUrl("webcals://example.org/cal.ics"));
        assertEquals("https://example.org/x", Net.normUrl("  https://example.org/x \n"));
        assertEquals("", Net.normUrl(null));
    }

    @Test public void indirizziLocaliRifiutati() {
        String[] bad = {
                "http://1.1.1.1/",                         // non https
                "ftp://1.1.1.1/",
                "https://user:pw@1.1.1.1/",                // credenziali nell'indirizzo
                "https:///solo-percorso",                  // senza host
                "non è un indirizzo",
                "https://127.0.0.1/", "https://127.8.9.10/", "https://[::1]/",              // questo dispositivo
                "https://0.0.0.0/", "https://[::]/",
                "https://10.0.0.1/", "https://172.16.0.1/", "https://172.31.255.254/",    // reti private
                "https://192.168.1.1/",
                "https://169.254.169.254/", "https://[fe80::1]/",                          // link-local
                "https://100.64.0.1/", "https://100.127.255.254/",                         // CGNAT 100.64/10
                "https://[fc00::1]/", "https://[fd12:3456::1]/",                           // IPv6 privati (ULA)
                "https://224.0.0.1/", "https://[ff02::1]/",                                // multicast
                "https://[::ffff:127.0.0.1]/", "https://[::ffff:192.168.0.1]/",            // IPv4 travestiti da IPv6
        };
        for (String u : bad) {
            try {
                Net.checkPublicHttps(u);
                fail("doveva essere rifiutato: " + u);
            } catch (Exception expected) {
                // ok: nessuna richiesta parte verso questo indirizzo
            }
        }
    }

    @Test public void indirizziPubbliciAccettati() throws Exception {
        String[] ok = {
                "https://1.1.1.1/dns-query", "https://8.8.8.8/",
                "https://[2606:4700:4700::1111]/",
                "https://100.63.255.255/", "https://100.128.0.1/",     // appena fuori da 100.64/10
                "https://172.15.255.255/", "https://172.32.0.1/",      // appena fuori da 172.16/12
                "https://9.255.255.255/", "https://11.0.0.1/",         // appena fuori da 10/8
        };
        for (String u : ok) Net.checkPublicHttps(u);   // nessuna eccezione = accettato
    }

    @Test public void limitiDellaRete() {
        assertTrue("risposta massima ragionevole", Net.MAX_BYTES > 0 && Net.MAX_BYTES <= 8_000_000L);
        assertEquals(5, Net.MAX_REDIRECTS);
        assertTrue("User-Agent con nome e versione", Net.USER_AGENT.startsWith("Kalend/" + BuildConfig.VERSION_NAME));
        assertTrue("User-Agent con contatto (richiesto da MET Norway)", Net.USER_AGENT.contains("+" + BuildConfig.CONTACT));
    }

    /** un server sul computer stesso non deve ricevere nulla: il controllo scatta prima di connettersi */
    @Test public void nessunaRichiestaVersoIlDispositivo() throws Exception {
        AtomicInteger hits = new AtomicInteger();
        HttpServer srv = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        srv.createContext("/", ex -> {
            hits.incrementAndGet();
            byte[] b = "segreto del router".getBytes(StandardCharsets.UTF_8);
            ex.sendResponseHeaders(200, b.length);
            ex.getResponseBody().write(b);
            ex.close();
        });
        srv.start();
        try {
            int port = srv.getAddress().getPort();
            String[] urls = {"https://127.0.0.1:" + port + "/", "http://127.0.0.1:" + port + "/", "webcal://127.0.0.1:" + port + "/cal.ics"};
            for (String u : urls) {
                try {
                    Net.fetchPublic(u);
                    fail("doveva essere rifiutato: " + u);
                } catch (Exception expected) {
                    // ok
                }
            }
            assertEquals("il server locale non deve aver ricevuto richieste", 0, hits.get());
        } finally {
            srv.stop(0);
        }
    }
}
