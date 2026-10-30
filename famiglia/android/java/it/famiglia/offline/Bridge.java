package it.famiglia.offline;

import android.database.Cursor;
import android.webkit.JavascriptInterface;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/**
 * Bridge = le funzioni che JavaScript può chiamare con
 *     Native.action("nomeAzione", "{...json...}")
 *
 * Ogni azione che modifica i dati viene eseguita in sottofondo e poi
 * l'interfaccia riceve i dati aggiornati (refresh).
 */
public class Bridge {
    private final MainActivity app;

    Bridge(MainActivity app) {
        this.app = app;
    }

    @JavascriptInterface
    public void action(final String command, final String json) {
        if (!app.unlocked) return;
        app.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                dispatch(command, json);
            }
        });
    }

    /** Smista l'azione. Le prime richiedono finestre di sistema (thread grafico). */
    private void dispatch(final String command, String json) {
        final JSONObject o;
        try {
            o = new JSONObject(json == null || json.isEmpty() ? "{}" : json);
        } catch (Exception e) {
            app.message(e.getMessage());
            return;
        }
        switch (command) {
            case "import":
                app.pick(MainActivity.REQ_IMPORT, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
                return;
            case "restore":
                app.pick(MainActivity.REQ_RESTORE, "*/*");
                return;
            case "backup":
                app.password("Proteggi backup", new MainActivity.PasswordAction() {
                    @Override
                    public void go(final char[] pw) {
                        app.work.execute(new Runnable() {
                            @Override
                            public void run() {
                                app.backup(pw);
                            }
                        });
                    }
                });
                return;
            default:
                app.work.execute(new Runnable() {
                    @Override
                    public void run() {
                        background(command, o);
                    }
                });
        }
    }

    /** Azioni eseguite in sottofondo (database, file). */
    private void background(String command, JSONObject o) {
        try {
            Store s = app.store;
            switch (command) {
                case "csv":
                    app.output = s.csv().getBytes(StandardCharsets.UTF_8);
                    saveOnUi("Famiglia-movimenti.csv", "text/csv");
                    return;
                case "original":
                    try (Cursor c = s.getReadableDatabase().rawQuery("SELECT original,name FROM imports WHERE id=?",
                            new String[]{o.optString("id")})) {
                        if (c.moveToFirst()) {
                            app.output = c.getBlob(0);
                            saveOnUi(c.getString(1), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
                        }
                    }
                    return;
                case "receiptPhotos":
                    app.js("window.receivePhotos(" + o.getLong("id") + "," + s.receiptPhotos(o.getLong("id")) + ")");
                    return;
                // --- azioni che modificano i dati ---
                case "edit": s.edit(o); break;
                case "bulkEdit":
                    int n = s.bulkEdit(o.getJSONArray("items"), o.optString("reason", ""));
                    if (!o.optBoolean("silent")) app.message(n + " movimenti aggiornati");
                    break;
                case "pref": s.pref(o.getString("key"), o.getString("value")); break;
                case "link": s.link(o.getLong("pending"), o.getLong("booked")); break;
                case "distinct": s.reject(o.getLong("pending"), o.getLong("booked")); break;
                case "undo": s.undo(o.getLong("id")); break;
                case "exclude": s.dismiss(o.getLong("id")); break;
                case "saveManual":
                    long id = s.saveManual(o);
                    app.js("window.onSaved && window.onSaved('manual'," + id + ")");
                    break;
                case "deleteManual": s.deleteManual(o.getLong("id")); break;
                case "addLink": s.addLink(o); break;
                case "removeLink": s.removeLink(o.getLong("id")); break;
                case "saveReceipt":
                    long rid = s.saveReceipt(o);
                    app.js("window.onSaved && window.onSaved('receipt'," + rid + ")");
                    break;
                case "deleteReceipt": s.deleteReceipt(o.getLong("id")); break;
                default:
                    throw new Exception("Azione non riconosciuta: " + command);
            }
            app.refresh();
        } catch (Exception e) {
            app.message(e.getMessage() == null ? e.toString() : e.getMessage());
        }
    }

    private void saveOnUi(final String name, final String mime) {
        app.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                app.save(name, mime);
            }
        });
    }
}
