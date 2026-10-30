package it.famiglia.offline;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.KeyguardManager;
import android.content.ClipData;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

/**
 * Schermata unica dell'app. Mostra l'interfaccia web (cartella assets/) in
 * una WebView e fa da "ponte" verso le funzioni del telefono:
 * database, file, backup, fotocamera.
 *
 * Nota tecnica: le pagine sono servite dall'indirizzo finto
 * https://appassets.androidplatform.net/assets/ (gestito qui dentro, senza
 * Internet). Serve un indirizzo "https" perché la fotocamera e l'OCR
 * funzionano solo in un contesto sicuro.
 */
public class MainActivity extends Activity {
    static final String HOST = "appassets.androidplatform.net";
    static final String START_URL = "https://" + HOST + "/assets/index.html";

    // Codici per riconoscere a cosa risponde onActivityResult
    static final int REQ_IMPORT = 10, REQ_EXPORT = 11, REQ_RESTORE = 12, REQ_UNLOCK = 13, REQ_IMAGES = 14;
    static final int REQ_CAMERA_PERMISSION = 20;

    WebView web;
    Store store;
    final ExecutorService work = Executors.newSingleThreadExecutor(); // lavori lenti in sottofondo
    boolean unlocked = false;
    byte[] output;                                  // file in attesa di essere salvato
    ValueCallback<Uri[]> fileCallback;              // risposta al selettore di immagini
    PermissionRequest pendingCamera;                // richiesta fotocamera in attesa del permesso

    /** Piccola interfaccia per le azioni che richiedono una password. */
    interface PasswordAction {
        void go(char[] password);
    }

    // ------------------------------------------------------------------
    // Avvio e sblocco
    // ------------------------------------------------------------------

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        // Impedisce screenshot e anteprima nelle app recenti (dati riservati)
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        getWindow().setStatusBarColor(0xFF102D35);
        getWindow().setNavigationBarColor(0xFF102D35);
        store = new Store(this);
        KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
        if (km != null && km.isDeviceSecure()) {
            // Chiede PIN/impronta del telefono prima di mostrare i dati
            startActivityForResult(km.createConfirmDeviceCredentialIntent("Famiglia", "Sblocca le tue finanze"), REQ_UNLOCK);
        } else {
            init();
        }
    }

    void init() {
        unlocked = true;
        web = new WebView(this);
        web.setBackgroundColor(0xFFF5F5EF);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);             // memoria locale per l'OCR
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);            // serve per leggere le foto scelte dalla galleria
        s.setMediaPlaybackRequiresUserGesture(false); // anteprima fotocamera
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.addJavascriptInterface(new Bridge(this), "Native");
        web.setWebViewClient(new AssetClient());
        web.setWebChromeClient(new ChromeClient());
        web.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
                return insets.consumeSystemWindowInsets();
            }
        });
        setContentView(web);
        web.loadUrl(START_URL);
    }

    // ------------------------------------------------------------------
    // WebView: pagine locali, fotocamera, selettore immagini
    // ------------------------------------------------------------------

    static final Map<String, String> MIME = new HashMap<>();
    static {
        MIME.put("html", "text/html");
        MIME.put("js", "application/javascript");
        MIME.put("css", "text/css");
        MIME.put("svg", "image/svg+xml");
        MIME.put("png", "image/png");
        MIME.put("json", "application/json");
        MIME.put("wasm", "application/wasm");
        MIME.put("gz", "application/gzip");
        MIME.put("traineddata", "application/octet-stream");
    }

    static boolean isText(String ext) {
        return ext.equals("html") || ext.equals("js") || ext.equals("css") || ext.equals("json") || ext.equals("svg");
    }

    /** Serve i file di assets/ e blocca qualsiasi altro indirizzo (niente Internet). */
    class AssetClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri u = request.getUrl();
            if ("https".equals(u.getScheme()) && HOST.equals(u.getHost()) && u.getPath() != null
                    && u.getPath().startsWith("/assets/") && !u.getPath().contains("..")) {
                String path = u.getPath().substring("/assets/".length());
                String ext = path.substring(path.lastIndexOf('.') + 1);
                String mime = MIME.containsKey(ext) ? MIME.get(ext) : "application/octet-stream";
                try {
                    InputStream in = getAssets().open(path);
                    WebResourceResponse r = new WebResourceResponse(mime, isText(ext) ? "UTF-8" : null, in);
                    Map<String, String> h = new HashMap<>();
                    h.put("Cache-Control", "no-cache");
                    r.setResponseHeaders(h);
                    return r;
                } catch (IOException e) {
                    return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
                            new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
                }
            }
            return new WebResourceResponse("text/plain", "UTF-8", 403, "Blocked",
                    new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return true; // nessuna navigazione verso altri siti
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            refresh();
        }
    }

    class ChromeClient extends WebChromeClient {
        /** La pagina chiede la fotocamera (per gli scontrini). */
        @Override
        public void onPermissionRequest(PermissionRequest request) {
            boolean video = false;
            for (String r : request.getResources()) if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) video = true;
            if (!video) {
                request.deny();
                return;
            }
            if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            } else {
                pendingCamera = request;
                requestPermissions(new String[]{Manifest.permission.CAMERA}, REQ_CAMERA_PERMISSION);
            }
        }

        /** <input type="file">: apre la galleria permettendo più foto. */
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = callback;
            Intent i = new Intent(Intent.ACTION_GET_CONTENT);
            i.setType("image/*");
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            startActivityForResult(Intent.createChooser(i, "Scegli le foto dello scontrino"), REQ_IMAGES);
            return true;
        }
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        if (code != REQ_CAMERA_PERMISSION || pendingCamera == null) return;
        if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) {
            pendingCamera.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
        } else {
            pendingCamera.deny();
            message("Permesso fotocamera negato: puoi scegliere le foto dalla galleria.");
        }
        pendingCamera = null;
    }

    // ------------------------------------------------------------------
    // Comunicazione con JavaScript
    // ------------------------------------------------------------------

    /** Esegue codice JavaScript nella pagina (sempre sul thread grafico). */
    void js(final String code) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (web != null) web.evaluateJavascript(code, null);
            }
        });
    }

    void message(String text) {
        js("window.notice(" + JSONObject.quote(text) + ")");
    }

    /** Rilegge il database e invia tutto all'interfaccia. */
    void refresh() {
        work.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    js("window.receive(" + store.snapshot().toString() + ")");
                } catch (Exception e) {
                    message("Errore lettura: " + e.getMessage());
                }
            }
        });
    }

    // ------------------------------------------------------------------
    // File: apri / salva
    // ------------------------------------------------------------------

    void pick(int code, String mime) {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.setType(mime);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        startActivityForResult(i, code);
    }

    void save(String name, String mime) {
        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        i.setType(mime);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.putExtra(Intent.EXTRA_TITLE, name);
        startActivityForResult(i, REQ_EXPORT);
    }

    static byte[] read(InputStream in, int max) throws IOException {
        try (InputStream src = in; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = src.read(buf)) != -1) {
                if (out.size() + n > max) throw new IOException("File troppo grande");
                out.write(buf, 0, n);
            }
            return out.toByteArray();
        }
    }

    String name(Uri uri) {
        try (Cursor c = getContentResolver().query(uri, null, null, null, null)) {
            if (c != null && c.moveToFirst()) return c.getString(c.getColumnIndexOrThrow("_display_name"));
        } catch (Exception ignored) {
            // nome non disponibile
        }
        return "import.xlsx";
    }

    void password(String title, final PasswordAction action) {
        final EditText input = new EditText(this);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        input.setHint("Almeno 8 caratteri. Conservala.");
        new AlertDialog.Builder(this).setTitle(title)
                .setMessage("La password serve per ripristinare il backup. Non è recuperabile.")
                .setView(input)
                .setNegativeButton("Annulla", null)
                .setPositiveButton("Continua", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface d, int w) {
                        String p = input.getText().toString();
                        input.setText("");
                        if (p.length() < 8) message("Usa almeno 8 caratteri");
                        else action.go(p.toCharArray());
                    }
                }).show();
    }

    @Override
    protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        if (code == REQ_UNLOCK) {
            if (result == RESULT_OK) init();
            else finish();
            return;
        }
        if (code == REQ_IMAGES) {
            deliverImages(result, data);
            return;
        }
        if (result != RESULT_OK || data == null || data.getData() == null) {
            if (code == REQ_EXPORT) output = null;
            return;
        }
        final Uri uri = data.getData();
        if (code == REQ_EXPORT) writeOutput(uri);
        else if (code == REQ_IMPORT) readImport(uri);
        else if (code == REQ_RESTORE) {
            password("Apri backup", new PasswordAction() {
                @Override
                public void go(final char[] pw) {
                    work.execute(new Runnable() {
                        @Override
                        public void run() {
                            restore(uri, pw);
                        }
                    });
                }
            });
        }
    }

    private void deliverImages(int result, Intent data) {
        if (fileCallback == null) return;
        Uri[] uris = null;
        if (result == RESULT_OK && data != null) {
            ClipData clip = data.getClipData();
            if (clip != null) {
                uris = new Uri[clip.getItemCount()];
                for (int i = 0; i < uris.length; i++) uris[i] = clip.getItemAt(i).getUri();
            } else if (data.getData() != null) {
                uris = new Uri[]{data.getData()};
            }
        }
        fileCallback.onReceiveValue(uris);
        fileCallback = null;
    }

    private void writeOutput(final Uri uri) {
        final byte[] bytes = output;
        output = null;
        if (bytes == null) return;
        work.execute(new Runnable() {
            @Override
            public void run() {
                try (OutputStream out = getContentResolver().openOutputStream(uri, "wt")) {
                    out.write(bytes);
                    message("File esportato");
                } catch (Exception e) {
                    message("Esportazione fallita: " + e.getMessage());
                }
            }
        });
    }

    // ------------------------------------------------------------------
    // Importazione Excel
    // ------------------------------------------------------------------

    private void readImport(final Uri uri) {
        message("Lettura e verifica del file…");
        work.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    final byte[] file = read(getContentResolver().openInputStream(uri), 15_000_000);
                    if (store.imported(file)) {
                        message("File identico già importato. Nessun doppione.");
                        return;
                    }
                    final Xlsx.Parsed parsed = Xlsx.parse(file);
                    final String name = name(uri);
                    final int fresh = Core.newRows(store.all(), parsed.rows).size();
                    int pending = 0, noAccount = 0;
                    for (Tx t : parsed.rows) {
                        if ("NO".equals(t.status)) pending++;
                        if (t.account.isEmpty()) noAccount++;
                    }
                    final String summary = name + "\n\n" + parsed.rows.size() + " righe · " + fresh + " nuove\n"
                            + pending + " non contabilizzate\n" + noAccount + " senza conto indicato\nPeriodo: "
                            + parsed.start + " → " + parsed.end
                            + "\n\nLe righe identiche conservano il numero di occorrenze. Gli abbinamenti incerti richiedono verifica.";
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            confirmImport(summary, file, name, parsed);
                        }
                    });
                } catch (Exception e) {
                    message("Importazione annullata: " + e.getMessage());
                }
            }
        });
    }

    private void confirmImport(String summary, final byte[] file, final String name, final Xlsx.Parsed parsed) {
        new AlertDialog.Builder(this).setTitle("Verifica importazione").setMessage(summary)
                .setNegativeButton("Annulla", null)
                .setPositiveButton("Importa", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface d, int w) {
                        work.execute(new Runnable() {
                            @Override
                            public void run() {
                                try {
                                    String result = store.importFile(file, name, parsed);
                                    refresh();
                                    js("window.onImported && window.onImported(" + JSONObject.quote(result) + ")");
                                } catch (Exception e) {
                                    message("Importazione annullata: " + e.getMessage());
                                }
                            }
                        });
                    }
                }).show();
    }

    // ------------------------------------------------------------------
    // Backup e ripristino
    // ------------------------------------------------------------------

    void backup(char[] password) {
        try {
            store.close(); // chiude il database così il file è completo
            output = Backup.encrypt(Files.readAllBytes(getDatabasePath("famiglia.db").toPath()), password);
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    save("Famiglia-" + java.time.LocalDate.now() + ".fmb", "application/octet-stream");
                }
            });
        } catch (Exception e) {
            message(e.getMessage());
        }
    }

    private void restore(Uri uri, char[] password) {
        final File tmp = new File(getCacheDir(), "restore.db");
        try {
            byte[] plain = Backup.decrypt(read(getContentResolver().openInputStream(uri), 150_000_000), password);
            Files.write(tmp.toPath(), plain);
            SQLiteDatabase db = SQLiteDatabase.openDatabase(tmp.getPath(), null, SQLiteDatabase.OPEN_READONLY);
            try {
                int version = db.getVersion();
                if (version < 1 || version > Store.VERSION) throw new Exception("Versione backup non supportata");
                try (Cursor c = db.rawQuery("PRAGMA integrity_check", null)) {
                    if (!c.moveToFirst() || !"ok".equals(c.getString(0))) throw new Exception("Backup danneggiato");
                }
                try (Cursor c = db.rawQuery("SELECT data FROM tx LIMIT 1", null)) {
                    if (c.moveToFirst()) new JSONObject(c.getString(0));
                }
                for (String table : Store.tablesFor(version)) {
                    try (Cursor c = db.rawQuery("SELECT count(*) FROM " + table, null)) {
                        c.moveToFirst();
                    }
                }
            } finally {
                db.close();
            }
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    confirmRestore(tmp);
                }
            });
        } catch (Exception e) {
            tmp.delete();
            message("Backup non valido o password errata");
        }
    }

    private void confirmRestore(final File tmp) {
        new AlertDialog.Builder(this).setTitle("Sostituire tutti i dati?")
                .setMessage("Il backup sostituirà il database attuale. Esporta prima un backup se vuoi conservarlo.")
                .setNegativeButton("Annulla", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface d, int w) {
                        tmp.delete();
                    }
                })
                .setPositiveButton("Ripristina", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface d, int w) {
                        work.execute(new Runnable() {
                            @Override
                            public void run() {
                                try {
                                    store.close();
                                    File dbFile = getDatabasePath("famiglia.db");
                                    // Elimina eventuali file temporanei di SQLite del vecchio database
                                    new File(dbFile.getPath() + "-wal").delete();
                                    new File(dbFile.getPath() + "-shm").delete();
                                    new File(dbFile.getPath() + "-journal").delete();
                                    Files.move(tmp.toPath(), dbFile.toPath(), StandardCopyOption.REPLACE_EXISTING);
                                    store = new Store(MainActivity.this); // aggiorna da v1 a v2 se serve
                                    refresh();
                                    message("Backup ripristinato");
                                } catch (Exception e) {
                                    message("Ripristino fallito: " + e.getMessage());
                                }
                            }
                        });
                    }
                }).show();
    }

    // ------------------------------------------------------------------
    // Ciclo di vita
    // ------------------------------------------------------------------

    @Override
    public void onBackPressed() {
        if (web == null) super.onBackPressed();
        else js("window.back()");
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.removeJavascriptInterface("Native");
            web.destroy();
        }
        work.shutdown();
        super.onDestroy();
    }
}
