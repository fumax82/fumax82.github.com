package it.famiglia.offline;

import java.io.ByteArrayOutputStream;
import java.security.SecureRandom;
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * Backup cifrato del database (formato identico alla versione 1.0, così i
 * vecchi backup si ripristinano nella 2.0).
 *
 * Struttura file: "FMB1" + sale(16) + iv(12) + dati cifrati AES-256-GCM.
 * La chiave è derivata dalla password con PBKDF2 (150.000 iterazioni).
 */
public final class Backup {
    private Backup() { }

    private static final byte[] MAGIC = {'F', 'M', 'B', '1'};

    public static byte[] encrypt(byte[] plain, char[] password) throws Exception {
        SecureRandom rnd = new SecureRandom();
        byte[] salt = new byte[16], iv = new byte[12];
        rnd.nextBytes(salt);
        rnd.nextBytes(iv);
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.ENCRYPT_MODE, key(password, salt), new GCMParameterSpec(128, iv));
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(MAGIC);
        out.write(salt);
        out.write(iv);
        out.write(c.doFinal(plain));
        return out.toByteArray();
    }

    public static byte[] decrypt(byte[] file, char[] password) throws Exception {
        if (file.length < 48 || file[0] != 'F' || file[1] != 'M' || file[2] != 'B' || file[3] != '1') {
            throw new Exception("Formato non riconosciuto");
        }
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.DECRYPT_MODE, key(password, Arrays.copyOfRange(file, 4, 20)),
                new GCMParameterSpec(128, Arrays.copyOfRange(file, 20, 32)));
        return c.doFinal(Arrays.copyOfRange(file, 32, file.length));
    }

    private static SecretKey key(char[] password, byte[] salt) throws Exception {
        PBEKeySpec spec = new PBEKeySpec(password, salt, 150000, 256);
        try {
            byte[] k = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
            return new SecretKeySpec(k, "AES");
        } finally {
            spec.clearPassword();
            Arrays.fill(password, '\0'); // cancella la password dalla memoria
        }
    }
}
