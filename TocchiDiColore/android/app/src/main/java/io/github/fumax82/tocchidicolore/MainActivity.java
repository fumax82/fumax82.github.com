package io.github.fumax82.tocchidicolore;

import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

// Attivita' principale dell'app: Capacitor (BridgeActivity) apre la WebView
// che mostra il gioco (i file della cartella www).
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Prima lasciamo che Capacitor prepari la WebView e i plugin.
        super.onCreate(savedInstanceState);

        // Tiene lo schermo acceso mentre si gioca (niente spegnimento automatico).
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Attiva subito lo schermo intero.
        attivaSchermoIntero();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // Quando l'app torna in primo piano (es. dopo una notifica o dopo aver
        // cambiato app) le barre di sistema possono ricomparire: le nascondiamo di nuovo.
        if (hasFocus) {
            attivaSchermoIntero();
        }
    }

    // Modalita' "immersiva": nasconde la barra di stato (in alto) e la barra di
    // navigazione (in basso) per usare tutto lo schermo.
    private void attivaSchermoIntero() {
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());

        // Nasconde entrambe le barre di sistema.
        controller.hide(WindowInsetsCompat.Type.systemBars());

        // Con uno swipe dal bordo le barre riappaiono per poco tempo,
        // sopra al gioco, e poi si nascondono da sole.
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
