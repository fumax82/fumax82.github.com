package app.kalend;

import org.junit.BeforeClass;
import org.junit.Test;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import java.io.File;
import java.util.Arrays;
import java.util.Set;
import java.util.TreeSet;

import javax.xml.parsers.DocumentBuilderFactory;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

/**
 * IL MANIFEST (AndroidManifest.xml) e le impostazioni di build: ciò che Android e Google Play
 * leggono per decidere cosa l'app può fare. Ogni allargamento (un permesso in più, un
 * componente esportato in più) fa fallire il test e va deciso consapevolmente.
 */
public class ManifestTest {

    private static final String A = "http://schemas.android.com/apk/res/android";
    private static Document manifest;

    @BeforeClass public static void load() throws Exception {
        DocumentBuilderFactory f = DocumentBuilderFactory.newInstance();
        f.setNamespaceAware(true);
        f.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        manifest = f.newDocumentBuilder().parse(new File(TestFiles.appDir(), "src/main/AndroidManifest.xml"));
    }

    private static Set<String> names(String tag) {
        Set<String> out = new TreeSet<>();
        NodeList nl = manifest.getElementsByTagName(tag);
        for (int i = 0; i < nl.getLength(); i++) out.add(((Element) nl.item(i)).getAttributeNS(A, "name"));
        return out;
    }

    private static Element component(String name) {
        for (String tag : new String[]{"activity", "receiver", "service", "provider"}) {
            NodeList nl = manifest.getElementsByTagName(tag);
            for (int i = 0; i < nl.getLength(); i++) {
                Element e = (Element) nl.item(i);
                if (name.equals(e.getAttributeNS(A, "name"))) return e;
            }
        }
        throw new AssertionError("componente non trovato: " + name);
    }

    @Test public void permessiApprovati() {
        Set<String> expected = new TreeSet<>(Arrays.asList(
                "android.permission.INTERNET",                 // meteo, calendari collegati, luoghi
                "android.permission.POST_NOTIFICATIONS",       // promemoria
                "android.permission.RECEIVE_BOOT_COMPLETED",   // riarmare i promemoria dopo il riavvio
                "android.permission.SCHEDULE_EXACT_ALARM",     // promemoria puntuali (fino ad Android 12L)
                "android.permission.USE_EXACT_ALARM",          // promemoria puntuali (app calendario, Android 13+)
                "android.permission.VIBRATE",
                "android.permission.READ_CALENDAR",            // mostrare il calendario del telefono (solo lettura)
                "android.permission.RECORD_AUDIO",             // dettatura
                "android.permission.ACCESS_COARSE_LOCATION",   // meteo e cielo del posto
                "android.permission.ACCESS_FINE_LOCATION"));
        assertEquals("permessi cambiati: aggiornare anche la privacy policy e il modulo «Sicurezza dei dati»",
                expected, names("uses-permission"));
    }

    @Test public void sveglieEsatteSoloDoveServe() {
        NodeList nl = manifest.getElementsByTagName("uses-permission");
        for (int i = 0; i < nl.getLength(); i++) {
            Element e = (Element) nl.item(i);
            if ("android.permission.SCHEDULE_EXACT_ALARM".equals(e.getAttributeNS(A, "name"))) {
                assertEquals("da Android 13 si usa USE_EXACT_ALARM", "32", e.getAttributeNS(A, "maxSdkVersion"));
            }
        }
    }

    @Test public void soloIComponentiNecessariSonoEsportati() {
        Set<String> exported = new TreeSet<>();
        for (String tag : new String[]{"activity", "receiver", "service", "provider"}) {
            NodeList nl = manifest.getElementsByTagName(tag);
            for (int i = 0; i < nl.getLength(); i++) {
                Element e = (Element) nl.item(i);
                String ex = e.getAttributeNS(A, "exported");
                assertFalse("android:exported va dichiarato sempre (Android 12+): " + e.getAttributeNS(A, "name"), ex.isEmpty());
                if ("true".equals(ex)) exported.add(e.getAttributeNS(A, "name"));
            }
        }
        // l'attività principale (icona dell'app) e i due widget, che il sistema deve poter raggiungere
        assertEquals(new TreeSet<>(Arrays.asList(".MainActivity", ".KalendWidget", ".KalendNextWidget")), exported);
    }

    @Test public void promemoriaEServizioWidgetProtetti() {
        assertEquals("false", component(".Reminders").getAttributeNS(A, "exported"));
        Element svc = component(".WidgetService");
        assertEquals("false", svc.getAttributeNS(A, "exported"));
        assertEquals("android.permission.BIND_REMOTEVIEWS", svc.getAttributeNS(A, "permission"));
        assertEquals("false", component(".WidgetFilterActivity").getAttributeNS(A, "exported"));
        assertEquals("false", component(".WidgetPreviewActivity").getAttributeNS(A, "exported"));
    }

    @Test public void applicazioneSenzaTrafficoInChiaroNeDebug() {
        Element app = (Element) manifest.getElementsByTagName("application").item(0);
        assertFalse("niente http in chiaro", "true".equals(app.getAttributeNS(A, "usesCleartextTraffic")));
        assertTrue("il debug lo decide Gradle, non il manifest", app.getAttributeNS(A, "debuggable").isEmpty());
        assertEquals("@xml/backup_rules", app.getAttributeNS(A, "fullBackupContent"));
        assertEquals("@xml/data_rules", app.getAttributeNS(A, "dataExtractionRules"));
    }

    /** la cassaforte dei link privati non finisce mai nei backup né nei trasferimenti fra telefoni */
    @Test public void cassaforteEsclusaDaiBackup() {
        String backup = TestFiles.read(new File(TestFiles.appDir(), "src/main/res/xml/backup_rules.xml"));
        String data = TestFiles.read(new File(TestFiles.appDir(), "src/main/res/xml/data_rules.xml"));
        String rule = "<exclude domain=\"sharedpref\" path=\"kalend_vault.xml\"/>";
        assertTrue(backup.contains(rule));
        assertTrue("backup nel cloud", data.substring(data.indexOf("<cloud-backup>"), data.indexOf("</cloud-backup>")).contains(rule));
        assertTrue("passaggio a un nuovo telefono", data.substring(data.indexOf("<device-transfer>"), data.indexOf("</device-transfer>")).contains(rule));
    }

    @Test public void hardwareFacoltativo() {
        NodeList nl = manifest.getElementsByTagName("uses-feature");
        assertTrue(nl.getLength() > 0);
        for (int i = 0; i < nl.getLength(); i++) {
            Element e = (Element) nl.item(i);
            assertEquals("microfono e GPS non obbligatori (tablet, Chromebook): " + e.getAttributeNS(A, "name"),
                    "false", e.getAttributeNS(A, "required"));
        }
    }

    @Test public void livelliApiEFirma() {
        String gradle = TestFiles.read(new File(TestFiles.appDir(), "build.gradle"));
        assertTrue("compileSdk 36", gradle.matches("(?s).*\\bcompileSdk 36\\b.*"));
        assertTrue("targetSdk 36 (richiesto da Google Play dal 31 agosto 2026)", gradle.matches("(?s).*\\btargetSdk 36\\b.*"));
        assertTrue("minSdk 24", gradle.matches("(?s).*\\bminSdk 24\\b.*"));
        assertTrue("password della firma solo da variabili d'ambiente",
                gradle.contains("storePassword System.getenv(\"KALEND_KEYSTORE_PASS\")")
                        && gradle.contains("keyPassword System.getenv(\"KALEND_KEY_PASS\")"));
    }
}
