package app.kalend;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * CASSAFORTE DEI LINK SEGRETI (es. l'indirizzo iCal privato di Google Calendar).
 *
 * Ogni indirizzo viene cifrato con AES-256-GCM usando una chiave che vive nel
 * Keystore di Android (hardware dove disponibile) e che non può essere
 * estratta. Il testo cifrato sta nelle SharedPreferences "kalend_vault",
 * ESCLUSE dal backup di sistema (res/xml/backup_rules.xml).
 *
 * La pagina non legge mai l'indirizzo: chiede al nativo di SCARICARLO
 * (vaultFetch) e riceve solo il contenuto. Alla pagina torna una "maschera"
 * (host + ••••) da mostrare nell'elenco dei calendari collegati.
 */
final class Vault {
    private static final String ALIAS = "kalend_vault";

    private Vault() {}

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("kalend_vault", Context.MODE_PRIVATE);
    }

    /** la chiave della preferenza: solo caratteri sicuri */
    private static String safe(String id) {
        return "v_" + String.valueOf(id).replaceAll("[^A-Za-z0-9_]", "_");
    }

    /** chiave AES nel Keystore: creata una volta per sempre */
    private static SecretKey key() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (!ks.containsAlias(ALIAS)) {
            KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            kg.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256)
                    .setRandomizedEncryptionRequired(true)
                    .build());
            kg.generateKey();
        }
        return ((KeyStore.SecretKeyEntry) ks.getEntry(ALIAS, null)).getSecretKey();
    }

    static synchronized void put(Context c, String id, String url) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key());
        byte[] iv = cipher.getIV();                       // 12 byte, generato dal sistema
        byte[] ct = cipher.doFinal(url.getBytes(StandardCharsets.UTF_8));
        byte[] all = new byte[iv.length + ct.length];     // [iv][testo cifrato + tag]
        System.arraycopy(iv, 0, all, 0, iv.length);
        System.arraycopy(ct, 0, all, iv.length, ct.length);
        prefs(c).edit().putString(safe(id), Base64.encodeToString(all, Base64.NO_WRAP)).apply();
    }

    /** l'indirizzo in chiaro, oppure null se non c'è o non si riesce a decifrare */
    static synchronized String get(Context c, String id) {
        try {
            String b64 = prefs(c).getString(safe(id), null);
            if (b64 == null) return null;
            byte[] all = Base64.decode(b64, Base64.NO_WRAP);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, all, 0, 12));
            return new String(cipher.doFinal(all, 12, all.length - 12), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }

    static boolean has(Context c, String id) {
        return prefs(c).contains(safe(id));
    }

    static void del(Context c, String id) {
        prefs(c).edit().remove(safe(id)).apply();
    }

    /** "calendar.google.com · ••••": quello che la pagina può mostrare */
    static String mask(String url) {
        try {
            return new URL(url).getHost() + " · ••••";
        } catch (Exception e) {
            return "••••";
        }
    }
}
