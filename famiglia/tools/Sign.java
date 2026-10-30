// Sign.java - Firma l'APK con lo schema v2 usando la libreria ufficiale apksig.
// Uso: java -cp apksig.jar:. Sign keystore.p12 password input.apk output.apk
import com.android.apksig.ApkSigner;
import java.io.File;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.Collections;

public class Sign {
    public static void main(String[] args) throws Exception {
        char[] password = args[1].toCharArray();
        KeyStore ks = KeyStore.getInstance("PKCS12");
        try (FileInputStream in = new FileInputStream(args[0])) { ks.load(in, password); }
        String alias = ks.aliases().nextElement();
        PrivateKey key = (PrivateKey) ks.getKey(alias, password);
        X509Certificate cert = (X509Certificate) ks.getCertificate(alias);
        ApkSigner.SignerConfig signer = new ApkSigner.SignerConfig.Builder(
                "FAMIGLIA", key, Collections.singletonList(cert)).build();
        new ApkSigner.Builder(Collections.singletonList(signer))
                .setInputApk(new File(args[2]))
                .setOutputApk(new File(args[3]))
                .setMinSdkVersion(26)
                .setV1SigningEnabled(false) // v1 non serve: minSdk 26 usa lo schema v2
                .setV2SigningEnabled(true)
                .build()
                .sign();
        System.out.println("APK firmato: " + args[3]);
    }
}
