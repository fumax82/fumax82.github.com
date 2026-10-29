package app.kalend;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.GeolocationPermissions;
import android.webkit.MimeTypeMap;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import android.window.OnBackInvokedDispatcher;

import org.json.JSONObject;

import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * ATTIVITÀ PRINCIPALE: una WebView a schermo intero che mostra la pagina
 * dell'app (assets/www/index.html) servita all'indirizzo
 * https://appassets.androidplatform.net/www/index.html e collegata al
 * telefono tramite il ponte JavaScript {@link Bridge} ("KalendNative").
 *
 * Sicurezza (riassunto):
 *  · la pagina è servita da un'origine https fittizia, non da file://;
 *    nessun accesso a file o content:// dalla WebView, Safe Browsing attivo,
 *    contenuti misti vietati, debug della WebView spento;
 *  · ogni metodo del ponte controlla {@link #trusted()}: risponde solo se la
 *    pagina caricata è quella dell'app;
 *  · i valori che arrivano dagli Intent (widget, notifiche) sono verificati
 *    con espressioni regolari e passati alla pagina con JSONObject.quote;
 *  · la navigazione verso altri siti esce nel browser: dentro la WebView
 *    resta solo la pagina dell'app.
 *
 * Novità rispetto alla v53: target API 36 (schermo intero gestito, gesto
 * «indietro» con il nuovo sistema), User-Agent con contatto (Net.java),
 * metodo geocode() nel ponte (Geocoder di Android).
 */
public class MainActivity extends Activity {
    static final String HOST = "appassets.androidplatform.net";
    static final String START = "https://" + HOST + "/www/index.html";

    private static final int RQ_FILE_SAVE = 11, RQ_FILE_OPEN = 12, RQ_SPEECH = 13;
    private static final int RQ_PERM_NOTIF = 21, RQ_PERM_CAL = 22, RQ_PERM_GEO = 23, RQ_MIC = 31, RQ_PERM_REM = 99;

    /** istanza visibile (per mostrare un promemoria dentro l'app invece che come notifica) */
    static volatile MainActivity INST;

    private WebView web;
    /* v55: la pagina sta fra due strisce colorate che occupano lo spazio delle barre di sistema
       (stato in alto, navigazione/tastiera in basso): così nulla finisce sotto le barre */
    private android.widget.LinearLayout root;
    private View topStrip, bottomStrip;
    private int topColor = 0xFF2D4C8C, bottomColor = 0xFFF5F0EB;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService pool = Executors.newFixedThreadPool(3);
    private final Map<Integer, Integer> permCb = new HashMap<>();   // richiesta permesso → id callback della pagina
    private ValueCallback<Uri[]> fileCb;                            // <input type=file> in corso
    private GeolocationPermissions.Callback geoCb;
    private String geoOrigin;
    private int saveCbId = -1;
    private String saveContent;
    private int speechCbId = -1;
    private boolean pageReady;
    private volatile String pageUrl = "";
    private String pendingJs;
    volatile boolean visible;

    /* dettatura dal vivo (SpeechRecognizer) */
    private SpeechRecognizer sr;
    private int srId = -1;
    private String srLang;
    private boolean srDevice, srRetried;
    private long lastRms;

    /* ────────────────────────────────────────────────────────────────
       ciclo di vita
    ──────────────────────────────────────────────────────────────── */
    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        Window w = getWindow();
        w.setStatusBarColor(Color.parseColor("#2D4C8C"));
        w.setNavigationBarColor(Color.parseColor("#F5F0EB"));
        Reminders.ensureChannel(this);

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#F5F0EB"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setGeolocationEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        if (Build.VERSION.SDK_INT >= 26) s.setSafeBrowsingEnabled(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setTextZoom(100);
        s.setSupportZoom(false);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.addJavascriptInterface(new Bridge(), "KalendNative");
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());
        /* contenitore: striscia superiore · pagina · striscia inferiore */
        root = new android.widget.LinearLayout(this);
        root.setOrientation(android.widget.LinearLayout.VERTICAL);
        root.setBackgroundColor(bottomColor);
        topStrip = new View(this); topStrip.setBackgroundColor(topColor);
        bottomStrip = new View(this); bottomStrip.setBackgroundColor(bottomColor);
        root.addView(topStrip, new android.widget.LinearLayout.LayoutParams(android.widget.LinearLayout.LayoutParams.MATCH_PARENT, 0));
        root.addView(web, new android.widget.LinearLayout.LayoutParams(android.widget.LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));
        root.addView(bottomStrip, new android.widget.LinearLayout.LayoutParams(android.widget.LinearLayout.LayoutParams.MATCH_PARENT, 0));
        setContentView(root);
        applyInsets();                                   // API 35+: la finestra è a schermo intero (edge-to-edge)
        if (saved == null) web.loadUrl(START); else web.restoreState(saved);
        INST = this;
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        if (prefs().getBoolean("secure", false)) w.addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE);
        registerBack();
        handleIntent(getIntent());
    }

    /** Con target 35+ le barre di sistema sono trasparenti e la finestra occupa tutto lo schermo.
     *  Invece di dare un padding alla WebView (che non lo rispetta in modo affidabile), le due
     *  strisce prendono l'altezza esatta della barra di stato e della barra di navigazione (o
     *  della tastiera, quando è aperta): la pagina resta sempre interamente visibile e cliccabile. */
    private void applyInsets() {
        if (Build.VERSION.SDK_INT < 30) return;
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            android.graphics.Insets top = insets.getInsets(WindowInsets.Type.statusBars() | WindowInsets.Type.displayCutout());
            android.graphics.Insets nav = insets.getInsets(WindowInsets.Type.navigationBars());
            android.graphics.Insets ime = insets.getInsets(WindowInsets.Type.ime());
            setHeight(topStrip, top.top);
            setHeight(bottomStrip, Math.max(nav.bottom, ime.bottom));
            root.setPadding(Math.max(top.left, nav.left), 0, Math.max(top.right, nav.right), 0);
            return WindowInsets.CONSUMED;
        });
    }

    private static void setHeight(View v, int h) {
        android.view.ViewGroup.LayoutParams lp = v.getLayoutParams();
        if (lp.height != h) { lp.height = h; v.setLayoutParams(lp); }
    }

    /** icone chiare o scure sulle barre, secondo la luminosità del colore sottostante */
    private void barIcons(int color, boolean statusBar) {
        double lum = (Color.red(color) * 0.299 + Color.green(color) * 0.587 + Color.blue(color) * 0.114) / 255.0;
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController wic = getWindow().getInsetsController();
            int mask = statusBar ? WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS : WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
            if (wic != null) wic.setSystemBarsAppearance(lum > 0.7 ? mask : 0, mask);
        }
    }

    /** gesto «indietro»: prima la pagina (chiude popup, dettatura, avvisi), poi il sistema */
    private void registerBack() {
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::backFromPage);
        }
    }

    private void backFromPage() {
        web.evaluateJavascript("(window.kalendBack&&window.kalendBack())?'1':'0'", v -> {
            if (v != null && v.contains("1")) return;   // la pagina ha gestito il gesto
            if (Build.VERSION.SDK_INT >= 33) finish(); else superBack();
        });
    }

    private void superBack() { super.onBackPressed(); }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {    // Android ≤ 12
        backFromPage();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.resumeTimers();
        web.onResume();
        visible = true;
        INST = this;
        WidgetAudio.stop();
        web.evaluateJavascript("try{KX.Music&&KX.Music.appHidden(false)}catch(e){}", null);
        if (pageReady) web.evaluateJavascript("try{KX.takeListQueue&&KX.takeListQueue()}catch(e){}", null);
    }

    @Override
    protected void onPause() {
        super.onPause();
        visible = false;
        try { if (sr != null) sr.cancel(); } catch (Exception ignored) {}
        web.evaluateJavascript("try{EventsStore.save&&EventsStore.save()}catch(e){}", null);
        web.evaluateJavascript("try{KX.Music&&KX.Music.appHidden(true)}catch(e){}", null);
        web.onPause();
        main.postDelayed(() -> { try { if (!visible) web.pauseTimers(); } catch (Exception ignored) {} }, 450);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onDestroy() {
        try { if (sr != null) { sr.cancel(); sr.destroy(); sr = null; } } catch (Exception ignored) {}
        pool.shutdownNow();
        web.destroy();
        super.onDestroy();
    }

    SharedPreferences prefs() { return getSharedPreferences("kalend", MODE_PRIVATE); }

    /* ────────────────────────────────────────────────────────────────
       Intent in arrivo (widget, notifiche): extra verificati → JavaScript
    ──────────────────────────────────────────────────────────────── */
    private void handleIntent(Intent in) {
        if (in == null) return;
        String js = null;
        String date = in.getStringExtra("date");
        boolean dateOk = date != null && date.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}");
        if (dateOk) js = "try{KX.openDate('" + date + "')}catch(e){}";
        else if (in.getStringExtra("add") != null) js = "try{document.getElementById('btn-add').click()}catch(e){}";

        String list = in.getStringExtra("list");
        if (list != null && list.matches("[A-Za-z0-9_\\-]{1,48}")) {
            js = "try{setTimeout(function(){KX.openLists(" + JSONObject.quote(list) + ")},400)}catch(e){}";
        } else if ("*".equals(list)) {
            js = "try{setTimeout(function(){KX.openLists()},400)}catch(e){}";
        }
        String ev = in.getStringExtra("ev");
        if (list == null && ev != null && ev.matches("[A-Za-z0-9_\\-]{1,64}") && dateOk) {
            js = "try{KX.openEventById(" + JSONObject.quote(ev) + ",'" + date + "')}catch(e){}";
        }
        /* un avviso (promemoria) viene accettato solo con il token segreto dell'app */
        String alert = in.getStringExtra("alert");
        if (alert != null && alertToken(this).equals(in.getStringExtra("tok"))) {
            js = "try{KX.alert(" + JSONObject.quote(alert) + ")}catch(e){}";
        }
        for (String k : new String[]{"date", "add", "list", "ev", "alert", "tok"}) in.removeExtra(k);
        if (js == null) return;
        if (!pageReady) { pendingJs = js; return; }
        final String code = js;
        main.postDelayed(() -> web.evaluateJavascript(code, null), 250);
    }

    /** token casuale, creato una volta: le notifiche lo portano con sé */
    static String alertToken(Context c) {
        SharedPreferences p = c.getSharedPreferences("kalend", MODE_PRIVATE);
        String t = p.getString("alert_tok", null);
        if (t == null) {
            t = UUID.randomUUID().toString() + UUID.randomUUID().toString();
            p.edit().putString("alert_tok", t).apply();
        }
        return t;
    }

    /** un promemoria scatta mentre l'app è visibile: lo mostra la pagina (true) */
    static boolean showAlert(String json) {
        MainActivity a = INST;
        if (a == null || !a.visible || !a.pageReady) return false;
        a.main.post(() -> a.web.evaluateJavascript("try{KX.alert(" + JSONObject.quote(json) + ")}catch(e){}", null));
        return true;
    }

    /* ────────────────────────────────────────────────────────────────
       strumenti
    ──────────────────────────────────────────────────────────────── */
    /** la pagina caricata è quella dell'app? Ogni metodo del ponte lo pretende. */
    boolean trusted() {
        try {
            Uri u = Uri.parse(pageUrl);
            return "https".equals(u.getScheme()) && HOST.equals(u.getHost());
        } catch (Exception e) {
            return false;
        }
    }

    private boolean has(String perm) { return checkSelfPermission(perm) == PackageManager.PERMISSION_GRANTED; }

    /** esegue JavaScript nella pagina (sempre dentro try/catch) */
    void js(String code) { main.post(() -> web.evaluateJavascript("try{" + code + "}catch(e){}", null)); }

    /** risposta a una chiamata del ponte: window.__knCb(id, ok, dato) */
    void reply(int id, boolean ok, String data) {
        String code = "window.__knCb&&__knCb(" + id + "," + ok + "," + JSONObject.quote(data == null ? "" : data) + ")";
        main.post(() -> web.evaluateJavascript(code, null));
    }

    /** apre un indirizzo fuori dall'app: solo schemi innocui */
    private void openExternal(String url) {
        String scheme;
        try { scheme = String.valueOf(Uri.parse(url).getScheme()).toLowerCase(Locale.ROOT); } catch (Exception e) { scheme = ""; }
        if (!(scheme.equals("https") || scheme.equals("http") || scheme.equals("mailto") || scheme.equals("tel") || scheme.equals("geo"))) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (Exception e) {
            Toast.makeText(this, url, Toast.LENGTH_LONG).show();
        }
    }

    /* ────────────────────────────────────────────────────────────────
       dettatura dal vivo
    ──────────────────────────────────────────────────────────────── */
    private void startRecognizer() {
        try {
            if (sr != null) { sr.destroy(); sr = null; }
            boolean device = false;
            if (!srRetried && Build.VERSION.SDK_INT >= 31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(this)) {
                sr = SpeechRecognizer.createOnDeviceSpeechRecognizer(this);   // sul telefono: niente rete
                device = true;
            } else if (SpeechRecognizer.isRecognitionAvailable(this)) {
                sr = SpeechRecognizer.createSpeechRecognizer(this);           // servizio di sistema
            }
            if (sr == null) { reply(srId, false, "nospeech"); srId = -1; return; }
            srDevice = device;
            js("KX.voice&&KX.voice.mode('" + (device ? "device" : "system") + "')");
            sr.setRecognitionListener(new Listener());
            Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            if (srLang != null && !srLang.isEmpty()) i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, srLang);
            i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            i.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
            i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
            i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2200L);
            i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1800L);
            sr.startListening(i);
        } catch (Exception e) {
            int id = srId; srId = -1;
            if (id >= 0) reply(id, false, String.valueOf(e.getMessage()));
        }
    }

    private class Listener implements RecognitionListener {
        public void onReadyForSpeech(Bundle b) { js("KX.voice&&KX.voice.ready()"); }
        public void onBeginningOfSpeech() {}
        public void onRmsChanged(float rms) {
            long now = System.currentTimeMillis();
            if (now - lastRms > 70) {
                lastRms = now;
                js("KX.voice&&KX.voice.level(" + Math.max(0f, Math.min(1f, (rms + 2f) / 12f)) + ")");
            }
        }
        public void onBufferReceived(byte[] b) {}
        public void onEndOfSpeech() { js("KX.voice&&KX.voice.thinking()"); }
        public void onError(int code) {
            /* il riconoscitore sul telefono può mancare della lingua: si riprova con quello di sistema */
            boolean retry = srDevice && !srRetried && (code == SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED
                    || code == SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE || code == SpeechRecognizer.ERROR_CLIENT
                    || code == SpeechRecognizer.ERROR_TOO_MANY_REQUESTS);
            if (retry) { srRetried = true; main.post(MainActivity.this::startRecognizer); return; }
            int id = srId; srId = -1;
            if (id >= 0) reply(id, false, "err" + code);
        }
        public void onPartialResults(Bundle b) {
            ArrayList<String> r = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            if (r != null && !r.isEmpty()) js("KX.voice&&KX.voice.partial(" + JSONObject.quote(r.get(0)) + ")");
        }
        public void onResults(Bundle b) {
            ArrayList<String> r = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            int id = srId; srId = -1;
            if (id >= 0) reply(id, true, (r == null || r.isEmpty()) ? "" : r.get(0));
        }
        public void onEvent(int t, Bundle b) {}
    }

    /* ────────────────────────────────────────────────────────────────
       risultati di attività e permessi
    ──────────────────────────────────────────────────────────────── */
    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == RQ_FILE_OPEN) {                         // <input type=file>: import di backup/ICS
            if (fileCb == null) return;
            Uri u = (res == RESULT_OK && data != null) ? data.getData() : null;
            fileCb.onReceiveValue(u != null ? new Uri[]{u} : null);
            fileCb = null;
        } else if (req == RQ_SPEECH) {                     // dettatura con la finestra di sistema
            int id = speechCbId; speechCbId = -1;
            String txt = "";
            if (res == RESULT_OK && data != null) {
                ArrayList<String> r = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
                if (r != null && !r.isEmpty()) txt = r.get(0);
            }
            reply(id, true, txt);
        } else if (req == RQ_FILE_SAVE) {                  // "Salva con nome" del sistema
            int id = saveCbId; saveCbId = -1;
            if (res == RESULT_OK && data != null && data.getData() != null) {
                Uri u = data.getData();
                String content = saveContent; saveContent = null;
                pool.execute(() -> {
                    try (OutputStream out = getContentResolver().openOutputStream(u, "wt")) {
                        out.write(content.getBytes(StandardCharsets.UTF_8));
                        reply(id, true, "ok");
                    } catch (Exception e) {
                        reply(id, false, e.getMessage());
                    }
                });
            } else {
                reply(id, true, "cancel");
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int req, String[] perms, int[] grants) {
        boolean ok = grants.length > 0 && grants[0] == PackageManager.PERMISSION_GRANTED;
        if (req == RQ_PERM_GEO) {
            if (geoCb != null) {
                boolean any = ok || (grants.length > 1 && grants[1] == PackageManager.PERMISSION_GRANTED);
                geoCb.invoke(geoOrigin, any, false);
                geoCb = null;
            }
        } else if (req == RQ_MIC) {
            if (ok) startRecognizer();
            else { int id = srId; srId = -1; if (id >= 0) reply(id, false, "denied"); }
        } else {
            Integer id = permCb.remove(req);
            if (id != null) reply(id, true, ok ? "granted" : "denied");
        }
    }

    /* ────────────────────────────────────────────────────────────────
       WebViewClient: serve la pagina dagli assets, tiene fuori il resto
    ──────────────────────────────────────────────────────────────── */
    private class Client extends WebViewClient {
        @Override
        public void onPageStarted(WebView v, String url, android.graphics.Bitmap fav) { pageUrl = url == null ? "" : url; }

        @Override
        public void onPageFinished(WebView v, String url) {
            pageUrl = url == null ? "" : url;
            pageReady = true;
            if (pendingJs != null) {
                final String code = pendingJs; pendingJs = null;
                main.postDelayed(() -> web.evaluateJavascript(code, null), 1600);
            }
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
            Uri u = req.getUrl();
            if (!HOST.equals(u.getHost())) return null;
            String path = u.getPath() == null ? "" : u.getPath();
            if (path.startsWith("/")) path = path.substring(1);
            if (path.isEmpty() || path.endsWith("/")) path += "index.html";
            try {
                InputStream in = getAssets().open(path, android.content.res.AssetManager.ACCESS_STREAMING);
                String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(MimeTypeMap.getFileExtensionFromUrl(path));
                if (path.endsWith(".js")) mime = "text/javascript";
                if (path.endsWith(".json")) mime = "application/json";
                if (path.endsWith(".woff2")) mime = "font/woff2";
                if (mime == null) mime = "application/octet-stream";
                WebResourceResponse r = new WebResourceResponse(mime, mime.startsWith("text") || mime.endsWith("json") ? "utf-8" : null, in);
                Map<String, String> h = new HashMap<>();
                h.put("Cache-Control", "no-cache");
                r.setResponseHeaders(h);
                return r;
            } catch (Exception e) {
                return new WebResourceResponse("text/plain", "utf-8", 404, "Not found", null, null);
            }
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
            Uri u = req.getUrl();
            if (HOST.equals(u.getHost())) return false;    // la pagina dell'app
            openExternal(u.toString());                      // tutto il resto: fuori, nel browser
            return true;
        }
    }

    /* ────────────────────────────────────────────────────────────────
       WebChromeClient: posizione e selezione file
    ──────────────────────────────────────────────────────────────── */
    private class Chrome extends WebChromeClient {
        @Override
        public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
            if (origin == null || !origin.startsWith("https://" + HOST)) { cb.invoke(origin, false, false); return; }
            if (has(Manifest.permission.ACCESS_COARSE_LOCATION) || has(Manifest.permission.ACCESS_FINE_LOCATION)) {
                cb.invoke(origin, true, false);
            } else {
                geoCb = cb; geoOrigin = origin;
                requestPermissions(new String[]{Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION}, RQ_PERM_GEO);
            }
        }

        @Override
        public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
            if (fileCb != null) fileCb.onReceiveValue(null);
            fileCb = cb;
            Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType("*/*");
            i.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/calendar", "text/plain", "application/octet-stream"});
            try { startActivityForResult(i, RQ_FILE_OPEN); return true; }
            catch (ActivityNotFoundException e) { fileCb = null; return false; }
        }
    }

    /* ────────────────────────────────────────────────────────────────
       PONTE JAVASCRIPT — window.KalendNative
       Convenzione: i metodi con un "id" rispondono in modo asincrono con
       reply(id, ok, dato) → window.__knCb(id, ok, dato) nella pagina.
       Ogni metodo controlla trusted().
    ──────────────────────────────────────────────────────────────── */
    class Bridge {
        @android.webkit.JavascriptInterface public String version() { return "2"; }

        /* ── rete ── */
        @android.webkit.JavascriptInterface public void httpGet(int id, String url) {
            pool.execute(() -> {
                try { if (!trusted()) throw new Exception("non consentito"); reply(id, true, Net.fetchPublic(url)); }
                catch (Exception e) { reply(id, false, e.getMessage()); }
            });
        }

        /* ── cassaforte dei link ── */
        @android.webkit.JavascriptInterface public void vaultPut(int id, String key, String url) {
            if (!trusted()) { reply(id, false, "non consentito"); return; }
            pool.execute(() -> {
                try {
                    String u = Net.normUrl(url);
                    Net.checkPublicHttps(u);
                    Vault.put(MainActivity.this, key, u);
                    reply(id, true, Vault.mask(u));
                } catch (Exception e) { reply(id, false, e.getMessage()); }
            });
        }
        @android.webkit.JavascriptInterface public void vaultFetch(int id, String key) {
            if (!trusted()) { reply(id, false, "non consentito"); return; }
            pool.execute(() -> {
                try {
                    String u = Vault.get(MainActivity.this, key);
                    if (u == null) throw new Exception("indirizzo non trovato");
                    reply(id, true, Net.fetchPublic(u));
                } catch (Exception e) { reply(id, false, e.getMessage()); }
            });
        }
        @android.webkit.JavascriptInterface public void vaultDel(String key) { if (trusted()) Vault.del(MainActivity.this, key); }
        @android.webkit.JavascriptInterface public boolean vaultHas(String key) { return trusted() && Vault.has(MainActivity.this, key); }

        /* ── luoghi (v55): Geocoder di Android, senza servizi di terzi dell'app ── */
        @android.webkit.JavascriptInterface public void geocode(int id, String text, String lang) {
            if (!trusted()) { reply(id, false, "non consentito"); return; }
            pool.execute(() -> {
                try { reply(id, true, Geo.lookup(MainActivity.this, text, lang)); }
                catch (Exception e) { reply(id, false, e.getMessage()); }
            });
        }

        /* ── file, condivisione, link ── */
        @android.webkit.JavascriptInterface public void saveFile(int id, String name, String mime, String text) {
            if (!trusted()) { reply(id, false, "non consentito"); return; }
            main.post(() -> {
                saveCbId = id; saveContent = text;
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                String type = mime == null ? "*/*" : (mime.startsWith("text/calendar") ? "text/calendar" : mime.split(";")[0]);
                i.setType(type);
                i.putExtra(Intent.EXTRA_TITLE, name);
                try { startActivityForResult(i, RQ_FILE_SAVE); } catch (Exception e) { reply(id, false, e.getMessage()); }
            });
        }
        @android.webkit.JavascriptInterface public void shareText(int id, String title, String text) {
            if (!trusted()) { reply(id, false, "non consentito"); return; }
            main.post(() -> {
                try {
                    startActivity(Intent.createChooser(new Intent(Intent.ACTION_SEND).setType("text/plain")
                            .putExtra(Intent.EXTRA_SUBJECT, title).putExtra(Intent.EXTRA_TEXT, text), title));
                    reply(id, true, "ok");
                } catch (Exception e) { reply(id, false, e.getMessage()); }
            });
        }
        @android.webkit.JavascriptInterface public void openUrl(int id, String url) {
            if (!trusted()) { reply(id, false, "non consentito"); return; }
            main.post(() -> { openExternal(url); reply(id, true, "ok"); });
        }
        @android.webkit.JavascriptInterface public void saveClip(int id, String name, String wavB64) {
            if (!(trusted() && name != null && name.matches("[a-z0-9-]{1,40}") && wavB64 != null && wavB64.length() <= 3_000_000)) {
                reply(id, false, "non valido"); return;
            }
            pool.execute(() -> {
                try {
                    java.io.File dir = new java.io.File(getFilesDir(), "clips");
                    dir.mkdirs();
                    byte[] bytes = android.util.Base64.decode(wavB64, android.util.Base64.DEFAULT);
                    try (java.io.FileOutputStream out = new java.io.FileOutputStream(new java.io.File(dir, name + ".wav"))) { out.write(bytes); }
                    reply(id, true, "ok");
                } catch (Exception e) { reply(id, false, e.getMessage()); }
            });
        }

        /* ── calendario del telefono ── */
        @android.webkit.JavascriptInterface public void calPermission(int id) {
            if (!trusted()) { reply(id, false, "non consentito"); return; }
            if (has(Manifest.permission.READ_CALENDAR)) { reply(id, true, "granted"); return; }
            main.post(() -> { permCb.put(RQ_PERM_CAL, id); requestPermissions(new String[]{Manifest.permission.READ_CALENDAR}, RQ_PERM_CAL); });
        }
        @android.webkit.JavascriptInterface public void calList(int id) {
            if (!trusted()) { reply(id, false, "non consentito"); return; }
            pool.execute(() -> { try { reply(id, true, DeviceCalendar.list(MainActivity.this)); } catch (Exception e) { reply(id, false, e.getMessage()); } });
        }
        @android.webkit.JavascriptInterface public void calEvents(int id, double from, double to, String ids) {
            if (!trusted()) { reply(id, false, "non consentito"); return; }
            pool.execute(() -> { try { reply(id, true, DeviceCalendar.events(MainActivity.this, (long) from, (long) to, ids)); } catch (Exception e) { reply(id, false, e.getMessage()); } });
        }
        @android.webkit.JavascriptInterface public void calInsert(int id, String json) {
            if (!trusted()) { reply(id, false, "non consentito"); return; }
            main.post(() -> {
                try { DeviceCalendar.insert(MainActivity.this, json); reply(id, true, "ok"); }
                catch (Exception e) { reply(id, false, "Nessuna app calendario disponibile"); }
            });
        }

        /* ── notifiche, promemoria, widget ── */
        @android.webkit.JavascriptInterface public void notifPermission(int id) {
            if (!trusted()) { reply(id, false, "non consentito"); return; }
            if (Build.VERSION.SDK_INT >= 33 && !has(Manifest.permission.POST_NOTIFICATIONS)) {
                main.post(() -> { permCb.put(RQ_PERM_NOTIF, id); requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, RQ_PERM_NOTIF); });
            } else reply(id, true, "granted");
        }
        @android.webkit.JavascriptInterface public void setReminders(String json) {
            if (!trusted()) return;
            Reminders.replaceAll(MainActivity.this, json);
            if (Build.VERSION.SDK_INT >= 33 && !has(Manifest.permission.POST_NOTIFICATIONS) && json != null && json.length() > 4) {
                main.post(() -> requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, RQ_PERM_REM));
            }
        }
        @android.webkit.JavascriptInterface public void snoozeAlert(String json) { if (trusted()) Reminders.snooze(MainActivity.this, json, 10); }
        @android.webkit.JavascriptInterface public void testReminder(String title, String text, int seconds) {
            try {
                if (!trusted()) return;
                Reminders.snoozeSeconds(MainActivity.this, new JSONObject().put("id", 777001).put("title", title).put("text", text).put("k", "").toString(),
                        Math.max(5, Math.min(120, seconds)));
            } catch (Exception ignored) {}
        }
        @android.webkit.JavascriptInterface public boolean exactAlarms() {
            if (Build.VERSION.SDK_INT < 31) return true;
            android.app.AlarmManager am = (android.app.AlarmManager) getSystemService(ALARM_SERVICE);
            return am != null && am.canScheduleExactAlarms();
        }
        /** stato dei permessi che rendono i promemoria affidabili (scheda nelle impostazioni) */
        @android.webkit.JavascriptInterface public String reliability() {
            if (!trusted()) return "{}";
            try {
                JSONObject o = new JSONObject();
                o.put("notif", Build.VERSION.SDK_INT < 33 || has(Manifest.permission.POST_NOTIFICATIONS));
                o.put("notifOn", ((android.app.NotificationManager) getSystemService(NOTIFICATION_SERVICE)).areNotificationsEnabled());
                o.put("exact", exactAlarms());
                o.put("battery", ((android.os.PowerManager) getSystemService(POWER_SERVICE)).isIgnoringBatteryOptimizations(getPackageName()));
                o.put("maker", Build.MANUFACTURER);
                return o.toString();
            } catch (Exception e) { return "{}"; }
        }
        @android.webkit.JavascriptInterface public void openSettings(String which) {
            if (!trusted()) return;
            main.post(() -> {
                Intent i;
                if ("notif".equals(which)) {
                    i = new Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, getPackageName());
                } else if ("exact".equals(which) && Build.VERSION.SDK_INT >= 31) {
                    i = new Intent(android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getPackageName()));
                } else if ("battery".equals(which)) {
                    i = new Intent(android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                } else {
                    i = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()));
                }
                try { startActivity(i); } catch (Exception ignored) {}
            });
        }
        @android.webkit.JavascriptInterface public void updateWidget(String json) {
            if (!trusted() || json == null || json.length() > 3_000_000) return;
            SharedPreferences p = prefs();
            p.edit().putString("widget", WidgetLists.overlay(p, json)).apply();
            KalendWidget.updateAll(MainActivity.this);
        }
        @android.webkit.JavascriptInterface public String takeListQueue() { return trusted() ? WidgetLists.take(prefs()) : "[]"; }

        /* ── dettatura ── */
        @android.webkit.JavascriptInterface public void speech(int id, String lang) {   // finestra di sistema
            main.post(() -> {
                Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                if (lang != null && !lang.isEmpty()) i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
                i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
                speechCbId = id;
                try { startActivityForResult(i, RQ_SPEECH); }
                catch (ActivityNotFoundException e) { speechCbId = -1; reply(id, false, "nospeech"); }
            });
        }
        @android.webkit.JavascriptInterface public void speechLive(int id, String lang) {   // dentro l'app, con parziali
            if (!trusted()) { reply(id, false, "non consentito"); return; }
            main.post(() -> {
                if (srId >= 0) reply(srId, false, "busy");
                srId = id; srLang = lang; srRetried = false;
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) startRecognizer();
                else requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, RQ_MIC);
            });
        }
        @android.webkit.JavascriptInterface public void speechStop() { if (trusted()) main.post(() -> { try { if (sr != null) sr.stopListening(); } catch (Exception ignored) {} }); }
        @android.webkit.JavascriptInterface public void speechCancel() {
            if (!trusted()) return;
            main.post(() -> { if (sr != null) sr.cancel(); int id = srId; srId = -1; if (id >= 0) reply(id, true, ""); });
        }

        /* ── varie ── */
        @android.webkit.JavascriptInterface public void vibrate(int ms) {
            android.os.Vibrator v = (android.os.Vibrator) getSystemService(VIBRATOR_SERVICE);
            if (v != null && Build.VERSION.SDK_INT >= 26) v.vibrate(android.os.VibrationEffect.createOneShot(Math.max(10, ms), android.os.VibrationEffect.DEFAULT_AMPLITUDE));
        }
        @android.webkit.JavascriptInterface public void setSecure(boolean on) {
            if (!trusted()) return;
            main.post(() -> { if (on) getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE); else getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE); });
            prefs().edit().putBoolean("secure", on).apply();
        }
        /** colore della barra di stato (segue il cielo della pagina) */
        @android.webkit.JavascriptInterface public void setBarColor(String hex) {
            if (!trusted()) return;
            main.post(() -> {
                try {
                    int c = Color.parseColor(hex);
                    topColor = c; topStrip.setBackgroundColor(c);
                    if (Build.VERSION.SDK_INT < 35) getWindow().setStatusBarColor(c);
                    barIcons(c, true);
                } catch (Exception ignored) {}
            });
        }
        /** v55: colore della barra di navigazione in basso (segue lo sfondo della pagina: tema chiaro o scuro) */
        @android.webkit.JavascriptInterface public void setNavColor(String hex) {
            if (!trusted()) return;
            main.post(() -> {
                try {
                    int c = Color.parseColor(hex);
                    bottomColor = c; bottomStrip.setBackgroundColor(c); root.setBackgroundColor(c);
                    if (Build.VERSION.SDK_INT < 35) getWindow().setNavigationBarColor(c);
                    barIcons(c, false);
                } catch (Exception ignored) {}
            });
        }
    }
}
