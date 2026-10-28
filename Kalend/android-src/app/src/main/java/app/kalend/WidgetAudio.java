package app.kalend;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import java.io.File;

/**
 * AUDIO DAL WIDGET: riproduce in loop una clip (file .wav in filesDir/clips) quando si tocca
 * il pulsante "musica" del widget.
 *
 * Collegamenti: KalendWidget chiama {@link #play} con il nome della clip di una riga e poi
 * {@link #limit}(45000) per fermarla dopo 45 secondi; MainActivity chiama {@link #stop}
 * quando l'app torna in primo piano. Tutto è statico: c'è un solo lettore per tutta l'app.
 *
 * Il "guard" ({@link #guard}) accompagna la riproduzione:
 *  · chiede il focus audio (così la musica di altre app si abbassa) e lo rilascia alla fine;
 *    se un'altra app prende il focus, la clip si ferma ({@link #FOCUS});
 *  · registra un ricevitore per SCREEN_OFF: a schermo spento la clip si ferma.
 * Per sicurezza il nome della clip deve essere semplice ([A-Za-z0-9_-], max 40 caratteri):
 * nessun percorso, nessun carattere strano.
 */
final class WidgetAudio {

    /** cartella delle clip dentro filesDir e loro estensione */
    private static final String CLIPS_DIR = "clips";
    private static final String CLIP_EXT = ".wav";
    /** nomi di clip accettati */
    private static final String NAME_RX = "[A-Za-z0-9_\\-]{1,40}";
    /** volume di riproduzione (0..1) */
    private static final float VOLUME = 0.85f;

    /** handler sul thread principale: timer di durata e callback del focus audio */
    private static final Handler H = new Handler(Looper.getMainLooper());
    /** scade il tempo massimo: ferma tutto */
    private static final Runnable LIMIT = WidgetAudio::stop;
    /** un'altra app ha preso il focus audio (perso o perso temporaneamente): ferma subito */
    private static final AudioManager.OnAudioFocusChangeListener FOCUS = change -> {
        if (change == AudioManager.AUDIOFOCUS_LOSS || change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) stopNow();
    };

    private static Context app;                 // application context, impostato da play()
    private static MediaPlayer mp;              // lettore attivo (null = fermo)
    private static String curM = "";            // nome della clip in riproduzione
    private static AudioFocusRequest afr;       // richiesta di focus attiva (API 26+)
    private static BroadcastReceiver screenRx;  // ricevitore SCREEN_OFF registrato

    WidgetAudio() {}

    /** attributi audio della clip: contenuto musicale, uso "media" */
    private static AudioAttributes attrs() {
        return new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build();
    }

    /**
     * Avvia la clip `name`. Nome non valido → ferma tutto. Se la stessa clip è già in
     * riproduzione non riparte da capo. File mancante → ferma e rilascia il guard.
     */
    static synchronized void play(Context c, String name) {
        app = c.getApplicationContext();
        if (name == null || !name.matches(NAME_RX)) {
            stop();
            return;
        }
        H.removeCallbacks(LIMIT);
        if (name.equals(curM) && mp != null) return;   // già in riproduzione
        File f = new File(new File(app.getFilesDir(), CLIPS_DIR), name + CLIP_EXT);
        stopPlayer();
        if (!f.exists()) {
            guard(false);
            return;
        }
        guard(true);
        // NOTA RICOSTRUZIONE: setDataSource/prepare lanciano IOException ma nel decompilato (metodo synchronized)
        // il catch non è visibile e KalendWidget chiama play senza gestirla: in caso di errore si libera il
        // lettore e si rilascia il guard, la scelta più sicura.
        try {
            mp = new MediaPlayer();
            mp.setAudioAttributes(attrs());
            mp.setDataSource(f.getPath());
            mp.setLooping(true);
            mp.setVolume(VOLUME, VOLUME);
            mp.prepare();
            mp.start();
            curM = name;
        } catch (Exception e) {
            stopPlayer();
            guard(false);
        }
    }

    /** ferma la clip tra `ms` millisecondi (se ce n'è una in riproduzione) */
    static void limit(long ms) {
        H.removeCallbacks(LIMIT);
        if (mp != null) H.postDelayed(LIMIT, ms);
    }

    /** c'è una clip in riproduzione? */
    static boolean playing() {
        return mp != null;
    }

    /** ferma e rilascia tutto (lettore, focus audio, ricevitore schermo) */
    static synchronized void stop() {
        stopPlayer();
        guard(false);
    }

    /**
     * Ferma "subito" da un callback (focus perso, schermo spento): azzera il volume e mette in
     * pausa senza aspettare il lock, poi programma lo {@link #stop} completo sul thread principale.
     */
    static void stopNow() {
        try {
            MediaPlayer p = mp;
            if (p != null) {
                p.setVolume(0f, 0f);
                p.pause();
            }
        } catch (Exception ignored) {}
        H.post(WidgetAudio::stop);
    }

    /** libera il MediaPlayer e dimentica la clip corrente */
    private static void stopPlayer() {
        if (mp != null) {
            try {
                mp.stop();
                mp.release();
            } catch (Exception ignored) {}
            mp = null;
        }
        curM = "";
    }

    /**
     * on = true: registra il ricevitore SCREEN_OFF e chiede il focus audio (transitorio, con
     * "duck" delle altre app). on = false: toglie il ricevitore e rilascia il focus.
     */
    private static void guard(boolean on) {
        try {
            Context c = app;
            if (c == null) return;
            AudioManager am = (AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
            if (on) {
                if (screenRx == null) {
                    screenRx = new BroadcastReceiver() {
                        @Override
                        public void onReceive(Context ctx, Intent intent) {
                            stopNow();
                        }
                    };
                    IntentFilter f = new IntentFilter(Intent.ACTION_SCREEN_OFF);
                    try {
                        if (Build.VERSION.SDK_INT >= 33) app.registerReceiver(screenRx, f, Context.RECEIVER_NOT_EXPORTED);
                        else app.registerReceiver(screenRx, f);
                    } catch (Exception e) {
                        screenRx = null;
                    }
                }
                if (am != null && afr == null && Build.VERSION.SDK_INT >= 26) {
                    afr = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                            .setAudioAttributes(attrs())
                            .setOnAudioFocusChangeListener(FOCUS, H)
                            .build();
                    am.requestAudioFocus(afr);
                }
            } else {
                // NOTA RICOSTRUZIONE: il decompilato rende i due passi come if/else (focus rilasciato solo se il
                // ricevitore non era registrato); è quasi certamente un artefatto del try/catch interno: qui sono
                // sequenziali, simmetrici al ramo "on", così il focus audio viene sempre restituito.
                if (screenRx != null) {
                    try {
                        app.unregisterReceiver(screenRx);
                    } catch (Exception ignored) {}
                    screenRx = null;
                }
                if (am != null && afr != null && Build.VERSION.SDK_INT >= 26) {
                    try {
                        am.abandonAudioFocusRequest(afr);
                    } catch (Exception ignored) {}
                    afr = null;
                }
            }
        } catch (Exception ignored) {}
    }
}
