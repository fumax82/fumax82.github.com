package app.kalend;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

/**
 * Trova i file del progetto che alcuni test leggono (manifest, sorgenti Java, pagina web).
 *
 * Funziona in tre situazioni:
 *  · Android Studio / Gradle: la cartella di lavoro dei test è il modulo "app";
 *  · tools/native-test.sh: passa la proprietà di sistema -Dkalend.appDir=<.../android-src/app>;
 *  · lancio a mano dalla radice del repository o da Kalend/.
 */
final class TestFiles {
    private TestFiles() {}

    /** la cartella del modulo Android: Kalend/android-src/app */
    static File appDir() {
        String p = System.getProperty("kalend.appDir");
        if (p != null && new File(p, "src/main/AndroidManifest.xml").isFile()) return new File(p);
        File here = new File(System.getProperty("user.dir")).getAbsoluteFile();
        File[] guesses = {here, new File(here, "app"), new File(here, "android-src/app"), new File(here, "Kalend/android-src/app")};
        for (File f : guesses) if (new File(f, "src/main/AndroidManifest.xml").isFile()) return f;
        throw new IllegalStateException("non trovo il modulo app (AndroidManifest.xml) partendo da " + here);
    }

    /** la cartella Kalend/ (contiene src/index.html, la pagina dell'app) */
    static File kalendDir() {
        return appDir().getParentFile().getParentFile();
    }

    /** il file sorgente Java di una classe dell'app, es. source("MainActivity") */
    static String source(String className) {
        return read(new File(appDir(), "src/main/java/app/kalend/" + className + ".java"));
    }

    /** tutti i sorgenti Java dell'app, uniti (per le regole che valgono ovunque) */
    static String allSources() {
        File dir = new File(appDir(), "src/main/java/app/kalend");
        File[] files = dir.listFiles((d, n) -> n.endsWith(".java"));
        if (files == null) throw new IllegalStateException("cartella sorgenti mancante: " + dir);
        StringBuilder sb = new StringBuilder();
        for (File f : files) sb.append(read(f)).append('\n');
        return sb.toString();
    }

    /** il sorgente della pagina: src/index.html più i moduli src/modules/*.js */
    static String pageSources() {
        File k = kalendDir();
        StringBuilder sb = new StringBuilder(read(new File(k, "src/index.html")));
        File[] mods = new File(k, "src/modules").listFiles((d, n) -> n.endsWith(".js"));
        if (mods != null) for (File f : mods) sb.append('\n').append(read(f));
        return sb.toString();
    }

    static String read(File f) {
        try {
            return new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("non riesco a leggere " + f, e);
        }
    }
}
