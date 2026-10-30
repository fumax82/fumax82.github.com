package it.famiglia.offline;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.util.Base64;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Store = il database SQLite locale ("famiglia.db").
 *
 * Tabelle principali:
 *   tx              movimenti (dalla banca o inseriti a mano)
 *   imports         file importati, con periodo coperto (start/end)
 *   observations    in quale file è comparso ogni movimento
 *   prefs           impostazioni in formato JSON (regole, categorie, budget...)
 *   rejected        abbinamenti che hai detto essere "distinti"
 *   audit           registro delle azioni
 *   links           collegamenti tra movimenti (contanti<-prelievo, rimborsi...)   [v2]
 *   receipts        scontrini letti con OCR e righe di spesa                        [v2]
 *   receipt_photos  foto degli scontrini (JPEG compressi)                           [v2]
 *
 * Colonna tx.extra (v3): campi manuali aggiuntivi in formato JSON, es.
 *   {"need":"superflua","nature":"variabile","tags":["Vacanza 2026"],"merchant":"Bar Sport"}
 * Nuovi campi si aggiungono dall'interfaccia (fields.js) senza cambiare il database.
 */
public class Store extends SQLiteOpenHelper {
    /** Versione 3 = Famiglia 2.1. Gli aggiornamenti 1 -> 2 -> 3 sono automatici (onUpgrade). */
    public static final int VERSION = 3;

    static final List<String> KINDS = Arrays.asList(
            "expense", "income", "refund", "saving", "investment", "transfer", "withdrawal");
    static final List<String> LINK_TYPES = Arrays.asList("cash", "refund", "transfer", "reimburse");

    public Store(Context ctx) {
        super(ctx, "famiglia.db", null, VERSION);
    }

    // ------------------------------------------------------------------
    // Creazione e aggiornamento dello schema
    // ------------------------------------------------------------------

    @Override
    public void onConfigure(SQLiteDatabase db) {
        db.setForeignKeyConstraintsEnabled(true);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        // Schema della versione 1 (identico all'app originale)...
        db.execSQL("CREATE TABLE imports(id INTEGER PRIMARY KEY,hash TEXT UNIQUE NOT NULL,name TEXT,created TEXT,"
                + "start TEXT,end TEXT,count INTEGER,metadata TEXT,original BLOB)");
        db.execSQL("CREATE TABLE tx(id INTEGER PRIMARY KEY,fingerprint TEXT NOT NULL,occurrence INTEGER NOT NULL,"
                + "data TEXT NOT NULL,category TEXT,kind TEXT,note TEXT DEFAULT '',person TEXT DEFAULT 'Famiglia',"
                + "state TEXT DEFAULT 'active',replaced INTEGER DEFAULT 0,UNIQUE(fingerprint,occurrence))");
        db.execSQL("CREATE TABLE observations(import_id INTEGER,tx_id INTEGER,row_data TEXT,"
                + "FOREIGN KEY(import_id) REFERENCES imports(id),FOREIGN KEY(tx_id) REFERENCES tx(id))");
        db.execSQL("CREATE TABLE audit(id INTEGER PRIMARY KEY,created TEXT,action TEXT,detail TEXT)");
        db.execSQL("CREATE TABLE prefs(key TEXT PRIMARY KEY,value TEXT)");
        db.execSQL("CREATE TABLE rejected(pending INTEGER,booked INTEGER,PRIMARY KEY(pending,booked))");
        // ...poi le aggiunte delle versioni successive
        upgradeTo2(db);
        upgradeTo3(db);
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        if (oldVersion < 2) upgradeTo2(db);
        if (oldVersion < 3) upgradeTo3(db);
    }

    /** Aggiunta della versione 2.1: campi manuali extra (necessità, etichette, ...). */
    private void upgradeTo3(SQLiteDatabase db) {
        db.execSQL("ALTER TABLE tx ADD COLUMN extra TEXT DEFAULT '{}'");
    }

    /** Aggiunte della versione 2.0: nuove colonne e nuove tabelle. */
    private void upgradeTo2(SQLiteDatabase db) {
        db.execSQL("ALTER TABLE tx ADD COLUMN family TEXT DEFAULT ''");
        db.execSQL("ALTER TABLE tx ADD COLUMN account_user TEXT DEFAULT ''");
        db.execSQL("ALTER TABLE tx ADD COLUMN classified_by TEXT DEFAULT ''");
        db.execSQL("ALTER TABLE tx ADD COLUMN source TEXT DEFAULT 'bank'");
        db.execSQL("CREATE TABLE links(id INTEGER PRIMARY KEY,type TEXT NOT NULL,from_tx INTEGER NOT NULL,"
                + "to_tx INTEGER DEFAULT 0,cents INTEGER DEFAULT 0,note TEXT DEFAULT '',created TEXT)");
        db.execSQL("CREATE TABLE receipts(id INTEGER PRIMARY KEY,tx_id INTEGER DEFAULT 0,created TEXT,shop TEXT,"
                + "date TEXT,total INTEGER,items TEXT,ocr_text TEXT)");
        db.execSQL("CREATE TABLE receipt_photos(id INTEGER PRIMARY KEY,receipt_id INTEGER,jpeg BLOB)");
        // Le categorie presenti arrivano dalla banca
        db.execSQL("UPDATE tx SET classified_by='bank' WHERE category IS NOT NULL AND category<>''");
        // I prelievi bancomat diventano "withdrawal" (prima erano contati come spesa)
        Cursor c = db.rawQuery("SELECT id,data FROM tx WHERE kind='expense'", null);
        try {
            while (c.moveToNext()) {
                JSONObject d = new JSONObject(c.getString(1));
                Tx t = new Tx();
                t.operation = d.optString("operation");
                t.details = d.optString("details");
                t.cents = d.optLong("cents");
                if (Core.isWithdrawal(t)) {
                    db.execSQL("UPDATE tx SET kind='withdrawal' WHERE id=?", new Object[]{c.getLong(0)});
                }
            }
        } catch (Exception e) {
            throw new IllegalStateException("Aggiornamento database fallito: " + e.getMessage());
        } finally {
            c.close();
        }
    }

    // ------------------------------------------------------------------
    // Lettura
    // ------------------------------------------------------------------

    /** JSON salvato nella colonna "data" (dati originali, non modificabili). */
    static JSONObject json(Tx t) throws Exception {
        JSONObject o = new JSONObject();
        o.put("date", t.date);
        o.put("operation", t.operation);
        o.put("details", t.details);
        o.put("account", t.account);
        o.put("currency", t.currency);
        o.put("cents", t.cents);
        o.put("status", t.status);
        o.put("originalCategory", t.category);
        o.put("raw", new JSONObject(t.raw));
        return o;
    }

    /** Tutti i movimenti come oggetti Java. */
    public List<Tx> all() throws Exception {
        List<Tx> out = new ArrayList<>();
        Cursor c = getReadableDatabase().rawQuery("SELECT * FROM tx ORDER BY id", null);
        try {
            while (c.moveToNext()) {
                JSONObject d = new JSONObject(c.getString(c.getColumnIndexOrThrow("data")));
                Tx t = new Tx();
                t.id = c.getLong(c.getColumnIndexOrThrow("id"));
                t.fingerprint = c.getString(c.getColumnIndexOrThrow("fingerprint"));
                t.occurrence = c.getInt(c.getColumnIndexOrThrow("occurrence"));
                t.date = d.getString("date");
                t.operation = d.getString("operation");
                t.details = d.getString("details");
                t.account = d.getString("account");
                t.currency = d.getString("currency");
                t.cents = d.getLong("cents");
                t.status = d.getString("status");
                t.category = str(c, "category");
                t.kind = str(c, "kind");
                t.note = str(c, "note");
                t.person = str(c, "person");
                t.state = str(c, "state");
                t.replaced = c.getLong(c.getColumnIndexOrThrow("replaced"));
                t.family = str(c, "family");
                t.accountUser = str(c, "account_user");
                t.classifiedBy = str(c, "classified_by");
                t.source = str(c, "source");
                t.extra = str(c, "extra");
                out.add(t);
            }
        } finally {
            c.close();
        }
        return out;
    }

    private static String str(Cursor c, String col) {
        String v = c.getString(c.getColumnIndexOrThrow(col));
        return v == null ? "" : v;
    }

    /** Fotografia completa dei dati, inviata all'interfaccia (JavaScript). */
    public JSONObject snapshot() throws Exception {
        SQLiteDatabase db = getReadableDatabase();
        List<Tx> all = all();
        Set<Long> usedBooked = new HashSet<>();
        for (Tx t : all) if (t.replaced > 0) usedBooked.add(t.replaced);

        JSONArray txs = new JSONArray();
        Cursor c = db.rawQuery("SELECT * FROM tx", null);
        try {
            String[] cols = {"category", "kind", "note", "person", "state"};
            while (c.moveToNext()) {
                JSONObject o = new JSONObject(c.getString(c.getColumnIndexOrThrow("data")));
                o.put("id", c.getLong(c.getColumnIndexOrThrow("id")));
                o.put("occurrence", c.getInt(c.getColumnIndexOrThrow("occurrence")));
                for (String col : cols) o.put(col, str(c, col));
                o.put("replaced", c.getLong(c.getColumnIndexOrThrow("replaced")));
                o.put("family", str(c, "family"));
                o.put("accountUser", str(c, "account_user"));
                o.put("classifiedBy", str(c, "classified_by"));
                o.put("source", str(c, "source"));
                o.put("extra", parseExtra(str(c, "extra")));
                txs.put(o);
            }
        } finally {
            c.close();
        }

        // Possibili abbinamenti "in attesa" -> "definitivo" da confermare
        Set<String> rejected = new HashSet<>();
        c = db.rawQuery("SELECT pending,booked FROM rejected", null);
        try {
            while (c.moveToNext()) rejected.add(c.getLong(0) + ":" + c.getLong(1));
        } finally {
            c.close();
        }
        JSONArray pairs = new JSONArray();
        for (Tx p : all) {
            if (!"NO".equals(p.status) || !"active".equals(p.state)) continue;
            for (Tx b : all) {
                if (usedBooked.contains(b.id) || !Core.candidate(p, b)) continue;
                if (rejected.contains(p.id + ":" + b.id)) continue;
                pairs.put(new JSONObject().put("pending", p.id).put("booked", b.id));
            }
        }

        // Prima e ultima data effettivamente presenti in ogni file importato
        java.util.Map<Long, String> dateById = new java.util.HashMap<>();
        for (Tx t : all) dateById.put(t.id, t.date);
        java.util.Map<Long, String[]> range = new java.util.HashMap<>();
        c = db.rawQuery("SELECT import_id,tx_id FROM observations", null);
        try {
            while (c.moveToNext()) {
                String d = dateById.get(c.getLong(1));
                if (d == null) continue;
                String[] r = range.get(c.getLong(0));
                if (r == null) range.put(c.getLong(0), new String[]{d, d});
                else {
                    if (d.compareTo(r[0]) < 0) r[0] = d;
                    if (d.compareTo(r[1]) > 0) r[1] = d;
                }
            }
        } finally {
            c.close();
        }
        JSONArray imports = new JSONArray();
        c = db.rawQuery("SELECT id,name,created,start,end,count FROM imports ORDER BY id DESC", null);
        try {
            while (c.moveToNext()) {
                String[] r = range.get(c.getLong(0));
                JSONObject o = new JSONObject();
                o.put("id", c.getLong(0));
                o.put("name", c.getString(1));
                o.put("created", c.getString(2));
                o.put("start", c.isNull(3) ? "" : c.getString(3));
                o.put("end", c.isNull(4) ? "" : c.getString(4));
                o.put("count", c.getInt(5));
                o.put("firstDate", r == null ? "" : r[0]);
                o.put("lastDate", r == null ? "" : r[1]);
                imports.put(o);
            }
        } finally {
            c.close();
        }

        JSONArray audit = new JSONArray();
        c = db.rawQuery("SELECT created,action,detail FROM audit ORDER BY id DESC LIMIT 100", null);
        try {
            while (c.moveToNext()) {
                audit.put(new JSONObject().put("date", c.getString(0)).put("action", c.getString(1))
                        .put("detail", c.getString(2)));
            }
        } finally {
            c.close();
        }

        JSONObject prefs = new JSONObject();
        c = db.rawQuery("SELECT key,value FROM prefs", null);
        try {
            while (c.moveToNext()) prefs.put(c.getString(0), c.getString(1));
        } finally {
            c.close();
        }

        JSONArray links = new JSONArray();
        c = db.rawQuery("SELECT id,type,from_tx,to_tx,cents,note,created FROM links ORDER BY id", null);
        try {
            while (c.moveToNext()) {
                links.put(new JSONObject().put("id", c.getLong(0)).put("type", c.getString(1))
                        .put("from", c.getLong(2)).put("to", c.getLong(3)).put("cents", c.getLong(4))
                        .put("note", c.getString(5)).put("created", c.getString(6)));
            }
        } finally {
            c.close();
        }

        JSONArray receipts = new JSONArray();
        c = db.rawQuery("SELECT r.id,r.tx_id,r.created,r.shop,r.date,r.total,r.items,"
                + "(SELECT count(*) FROM receipt_photos p WHERE p.receipt_id=r.id) FROM receipts r ORDER BY r.date DESC", null);
        try {
            while (c.moveToNext()) {
                receipts.put(new JSONObject().put("id", c.getLong(0)).put("txId", c.getLong(1))
                        .put("created", c.getString(2)).put("shop", c.getString(3)).put("date", c.getString(4))
                        .put("total", c.getLong(5)).put("items", new JSONArray(c.getString(6)))
                        .put("photos", c.getInt(7)));
            }
        } finally {
            c.close();
        }

        return new JSONObject().put("transactions", txs).put("imports", imports).put("audit", audit)
                .put("pairs", pairs).put("prefs", prefs).put("links", links).put("receipts", receipts);
    }

    // ------------------------------------------------------------------
    // Modifiche della classificazione
    // ------------------------------------------------------------------

    /** Campi modificabili: chiave JSON -> colonna del database. */
    private static final String[][] EDITABLE = {
            {"category", "category"}, {"kind", "kind"}, {"note", "note"}, {"person", "person"},
            {"family", "family"}, {"accountUser", "account_user"}, {"classifiedBy", "classified_by"}};

    static JSONObject parseExtra(String s) {
        try {
            return new JSONObject(s == null || s.isEmpty() ? "{}" : s);
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    /**
     * Unisce i campi extra: le chiavi presenti in "changes" sostituiscono quelle
     * esistenti; un valore vuoto ("" o lista vuota) cancella il campo.
     */
    static String mergeExtra(String current, JSONObject changes) throws Exception {
        JSONObject cur = parseExtra(current);
        Iterator<String> keys = changes.keys();
        while (keys.hasNext()) {
            String k = keys.next();
            Object val = changes.get(k);
            boolean empty = val == JSONObject.NULL || "".equals(val) || (val instanceof JSONArray && ((JSONArray) val).length() == 0);
            if (empty) cur.remove(k);
            else cur.put(k, val);
        }
        return cur.toString();
    }

    private String currentExtra(SQLiteDatabase db, String id) {
        Cursor c = db.rawQuery("SELECT extra FROM tx WHERE id=?", new String[]{id});
        try {
            return c.moveToFirst() && !c.isNull(0) ? c.getString(0) : "{}";
        } finally {
            c.close();
        }
    }

    /** Modifica solo i campi presenti nel JSON (modifica "parziale"). */
    private void editOne(SQLiteDatabase db, JSONObject o) throws Exception {
        if (o.has("kind") && !KINDS.contains(o.getString("kind"))) throw new Exception("Tipo non valido");
        ContentValues v = new ContentValues();
        for (String[] f : EDITABLE) if (o.has(f[0])) v.put(f[1], o.optString(f[0]));
        if (o.has("extra")) v.put("extra", mergeExtra(currentExtra(db, o.getString("id")), o.getJSONObject("extra")));
        if (v.size() == 0) return;
        db.update("tx", v, "id=?", new String[]{o.getString("id")});
    }

    public void edit(JSONObject o) throws Exception {
        if (!o.has("classifiedBy")) o.put("classifiedBy", "user");
        editOne(getWritableDatabase(), o);
        log("Modifica classificazione", o.toString());
    }

    /** Tante modifiche in un'unica transazione (es. applicazione di una regola). */
    public int bulkEdit(JSONArray items, String reason) throws Exception {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            for (int i = 0; i < items.length(); i++) editOne(db, items.getJSONObject(i));
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
        log("Classificazione multipla", items.length() + " movimenti · " + reason);
        return items.length();
    }

    // ------------------------------------------------------------------
    // Movimenti inseriti a mano (es. pagamenti in contanti)
    // ------------------------------------------------------------------

    /** Crea (o aggiorna, se c'è "id") un movimento manuale. Restituisce l'id. */
    public long saveManual(JSONObject o) throws Exception {
        SQLiteDatabase db = getWritableDatabase();
        Tx t = new Tx();
        t.date = o.getString("date");
        java.time.LocalDate.parse(t.date); // verifica formato
        t.operation = o.optString("operation", "Pagamento in contanti");
        t.details = o.optString("details", "");
        t.account = o.optString("account", "Contanti");
        t.cents = o.getLong("cents");
        t.status = "SI";
        t.category = o.optString("category", "");
        t.raw.put("Fonte", "Inserimento manuale");
        String kind = o.optString("kind", t.cents < 0 ? "expense" : "income");
        if (!KINDS.contains(kind)) throw new Exception("Tipo non valido");

        ContentValues v = new ContentValues();
        v.put("data", json(t).toString());
        v.put("category", t.category);
        v.put("kind", kind);
        v.put("note", o.optString("note", ""));
        v.put("person", o.optString("person", "Famiglia"));
        v.put("family", o.optString("family", ""));
        v.put("classified_by", "user");
        v.put("source", "manual");
        if (o.has("extra")) v.put("extra", mergeExtra("{}", o.getJSONObject("extra")));

        long id = o.optLong("id", 0);
        db.beginTransaction();
        try {
            if (id > 0) {
                int n = db.update("tx", v, "id=? AND source='manual'", new String[]{"" + id});
                if (n == 0) throw new Exception("Solo i movimenti manuali sono modificabili");
            } else {
                v.put("fingerprint", "manual:" + UUID.randomUUID());
                v.put("occurrence", 1);
                id = db.insertOrThrow("tx", null, v);
            }
            // Collegamento opzionale creato insieme (es. contanti <- prelievo)
            if (o.has("link")) {
                JSONObject l = o.getJSONObject("link");
                db.delete("links", "from_tx=? AND type=?", new String[]{"" + id, l.getString("type")});
                insertLink(db, l.getString("type"), id, l.optLong("to", 0), l.optLong("cents", -t.cents), l.optString("note", ""));
            }
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
        log("Movimento manuale", id + " · " + t.operation + " · " + t.cents);
        return id;
    }

    public void deleteManual(long id) throws Exception {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            db.delete("links", "from_tx=? OR to_tx=?", new String[]{"" + id, "" + id});
            ContentValues v = new ContentValues();
            v.put("tx_id", 0);
            db.update("receipts", v, "tx_id=?", new String[]{"" + id});
            int n = db.delete("tx", "id=? AND source='manual'", new String[]{"" + id});
            if (n == 0) throw new Exception("Si possono eliminare solo movimenti inseriti a mano");
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
        log("Eliminazione manuale", "" + id);
    }

    // ------------------------------------------------------------------
    // Collegamenti tra movimenti
    // ------------------------------------------------------------------

    private long insertLink(SQLiteDatabase db, String type, long from, long to, long cents, String note) throws Exception {
        if (!LINK_TYPES.contains(type)) throw new Exception("Collegamento non valido");
        ContentValues v = new ContentValues();
        v.put("type", type);
        v.put("from_tx", from);
        v.put("to_tx", to);
        v.put("cents", cents);
        v.put("note", note);
        v.put("created", Instant.now().toString());
        return db.insertOrThrow("links", null, v);
    }

    public void addLink(JSONObject o) throws Exception {
        insertLink(getWritableDatabase(), o.getString("type"), o.getLong("from"), o.optLong("to", 0),
                o.optLong("cents", 0), o.optString("note", ""));
        log("Collegamento", o.toString());
    }

    public void removeLink(long id) {
        getWritableDatabase().delete("links", "id=?", new String[]{"" + id});
        log("Collegamento rimosso", "" + id);
    }

    // ------------------------------------------------------------------
    // Scontrini
    // ------------------------------------------------------------------

    public long saveReceipt(JSONObject o) throws Exception {
        SQLiteDatabase db = getWritableDatabase();
        ContentValues v = new ContentValues();
        v.put("tx_id", o.optLong("txId", 0));
        v.put("shop", o.optString("shop", ""));
        v.put("date", o.optString("date", ""));
        v.put("total", o.optLong("total", 0));
        v.put("items", o.optJSONArray("items") == null ? "[]" : o.getJSONArray("items").toString());
        v.put("ocr_text", o.optString("ocrText", ""));
        long id = o.optLong("id", 0);
        db.beginTransaction();
        try {
            if (id > 0) {
                db.update("receipts", v, "id=?", new String[]{"" + id});
            } else {
                v.put("created", Instant.now().toString());
                id = db.insertOrThrow("receipts", null, v);
            }
            JSONArray photos = o.optJSONArray("photos");
            if (photos != null) {
                for (int i = 0; i < photos.length(); i++) {
                    String b64 = photos.getString(i);
                    int comma = b64.indexOf(',');
                    if (comma >= 0) b64 = b64.substring(comma + 1); // toglie "data:image/jpeg;base64,"
                    ContentValues p = new ContentValues();
                    p.put("receipt_id", id);
                    p.put("jpeg", Base64.decode(b64, Base64.DEFAULT));
                    db.insertOrThrow("receipt_photos", null, p);
                }
            }
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
        log("Scontrino", id + " · " + o.optString("shop"));
        return id;
    }

    public void deleteReceipt(long id) {
        SQLiteDatabase db = getWritableDatabase();
        db.delete("receipt_photos", "receipt_id=?", new String[]{"" + id});
        db.delete("receipts", "id=?", new String[]{"" + id});
        log("Scontrino eliminato", "" + id);
    }

    /** Foto di uno scontrino come "data URL" pronti per un tag <img>. */
    public JSONArray receiptPhotos(long id) {
        JSONArray out = new JSONArray();
        Cursor c = getReadableDatabase().rawQuery("SELECT jpeg FROM receipt_photos WHERE receipt_id=? ORDER BY id",
                new String[]{"" + id});
        try {
            while (c.moveToNext()) {
                out.put("data:image/jpeg;base64," + Base64.encodeToString(c.getBlob(0), Base64.NO_WRAP));
            }
        } finally {
            c.close();
        }
        return out;
    }

    // ------------------------------------------------------------------
    // Importazione file banca
    // ------------------------------------------------------------------

    public boolean imported(byte[] file) {
        Cursor c = getReadableDatabase().rawQuery("SELECT id FROM imports WHERE hash=?", new String[]{Core.hash(file)});
        try {
            return c.moveToFirst();
        } finally {
            c.close();
        }
    }

    public String importFile(byte[] file, String name, Xlsx.Parsed parsed) throws Exception {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            if (imported(file)) return "File già importato: nessun movimento aggiunto.";
            ContentValues iv = new ContentValues();
            iv.put("hash", Core.hash(file));
            iv.put("name", name);
            iv.put("created", Instant.now().toString());
            iv.put("start", parsed.start);
            iv.put("end", parsed.end);
            iv.put("count", parsed.rows.size());
            iv.put("metadata", parsed.meta);
            iv.put("original", file);
            long importId = db.insertOrThrow("imports", null, iv);

            int added = 0, present = 0;
            for (Tx t : parsed.rows) {
                long txId = -1;
                Cursor c = db.rawQuery("SELECT id FROM tx WHERE fingerprint=? AND occurrence=?",
                        new String[]{t.fingerprint, "" + t.occurrence});
                try {
                    if (c.moveToFirst()) txId = c.getLong(0);
                } finally {
                    c.close();
                }
                if (txId >= 0) {
                    present++;
                } else {
                    ContentValues v = new ContentValues();
                    v.put("fingerprint", t.fingerprint);
                    v.put("occurrence", t.occurrence);
                    v.put("data", json(t).toString());
                    v.put("category", t.category);
                    v.put("kind", t.kind);
                    v.put("classified_by", t.classifiedBy);
                    v.put("source", "bank");
                    txId = db.insertOrThrow("tx", null, v);
                    added++;
                }
                ContentValues ov = new ContentValues();
                ov.put("import_id", importId);
                ov.put("tx_id", txId);
                ov.put("row_data", new JSONObject(t.raw).toString());
                db.insertOrThrow("observations", null, ov);
            }

            int reconciled = 0;
            for (long[] pair : Core.autoPairs(all())) {
                if (!isRejected(pair[0], pair[1])) {
                    linkInternal(pair[0], pair[1]);
                    reconciled++;
                }
            }
            String summary = added + " nuovi · " + present + " già presenti · " + reconciled + " riconciliati";
            log("Importazione", name + ": " + summary);
            db.setTransactionSuccessful();
            return summary;
        } finally {
            db.endTransaction();
        }
    }

    // ------------------------------------------------------------------
    // Riconciliazione "in attesa" -> "definitivo"
    // ------------------------------------------------------------------

    public boolean isRejected(long pending, long booked) {
        Cursor c = getReadableDatabase().rawQuery("SELECT 1 FROM rejected WHERE pending=? AND booked=?",
                new String[]{"" + pending, "" + booked});
        try {
            return c.moveToFirst();
        } finally {
            c.close();
        }
    }

    public void link(long pending, long booked) throws Exception {
        Tx p = null, b = null;
        for (Tx t : all()) {
            if (t.id == pending) p = t;
            if (t.id == booked) b = t;
            if (t.replaced == booked) throw new Exception("Il definitivo è già abbinato");
        }
        if (p == null || b == null || !Core.candidate(p, b)) throw new Exception("Abbinamento non valido");
        linkInternal(pending, booked);
    }

    void linkInternal(long pending, long booked) {
        ContentValues v = new ContentValues();
        v.put("state", "replaced");
        v.put("replaced", booked);
        getWritableDatabase().update("tx", v, "id=?", new String[]{"" + pending});
        log("Riconciliazione", pending + " → " + booked);
    }

    public void reject(long pending, long booked) {
        ContentValues v = new ContentValues();
        v.put("pending", pending);
        v.put("booked", booked);
        getWritableDatabase().insertWithOnConflict("rejected", null, v, SQLiteDatabase.CONFLICT_IGNORE);
        log("Movimenti distinti", pending + " / " + booked);
    }

    public void undo(long id) throws Exception {
        Tx t = null;
        for (Tx x : all()) if (x.id == id) t = x;
        if (t == null) throw new Exception("Movimento assente");
        if (t.replaced > 0) reject(id, t.replaced);
        ContentValues v = new ContentValues();
        v.put("state", "active");
        v.put("replaced", 0);
        getWritableDatabase().update("tx", v, "id=?", new String[]{"" + id});
        log("Ripristino", "" + id);
    }

    public void dismiss(long id) {
        ContentValues v = new ContentValues();
        v.put("state", "excluded");
        getWritableDatabase().update("tx", v, "id=? AND state='active'", new String[]{"" + id});
        log("Esclusione manuale", "" + id);
    }

    // ------------------------------------------------------------------
    // Impostazioni, registro, esportazione
    // ------------------------------------------------------------------

    public void pref(String key, String value) {
        ContentValues v = new ContentValues();
        v.put("key", key);
        v.put("value", value);
        getWritableDatabase().insertWithOnConflict("prefs", null, v, SQLiteDatabase.CONFLICT_REPLACE);
    }

    public void log(String action, String detail) {
        ContentValues v = new ContentValues();
        v.put("created", Instant.now().toString());
        v.put("action", action);
        v.put("detail", detail.length() > 2000 ? detail.substring(0, 2000) + "…" : detail);
        getWritableDatabase().insertOrThrow("audit", null, v);
    }

    /** Esporta tutti i movimenti in CSV (separatore ";", compatibile con Excel italiano). */
    public String csv() throws Exception {
        StringBuilder sb = new StringBuilder("﻿ID;Data;Operazione;Dettagli;Conto o carta;Contabilizzazione;"
                + "Famiglia;Categoria;Valuta;Importo;Tipo;Stato;Persona;Note;Fonte;"
                + "Esercizio;Necessità;Natura;Detrazione;Etichette;Rimborso da;Rifarei\r\n");
        for (Tx t : all()) {
            String account = t.account.isEmpty() ? t.accountUser : t.account;
            String[] f = {"" + t.id, t.date, t.operation, t.details, account, t.status, t.family, t.category,
                    t.currency, BigDecimal.valueOf(t.cents, 2).toPlainString().replace('.', ','),
                    t.kind, t.state, t.person, t.note, t.source,
                    ex(t, "merchant"), ex(t, "need"), ex(t, "nature"), ex(t, "tax"), ex(t, "tags"), ex(t, "refund"), ex(t, "rating")};
            for (int i = 0; i < f.length; i++) {
                if (i > 0) sb.append(';');
                String s = f[i] == null ? "" : f[i];
                // Protezione da "formule" malevole quando il CSV si apre in Excel
                if (s.matches("^[=+@\\t\\r].*") || (i != 9 && s.startsWith("-"))) s = "'" + s;
                sb.append('"').append(s.replace("\"", "\"\"")).append('"');
            }
            sb.append("\r\n");
        }
        return sb.toString();
    }

    /** Campo extra come testo (le liste diventano "a, b"). */
    private static String ex(Tx t, String key) {
        Object v = parseExtra(t.extra).opt(key);
        if (v instanceof JSONArray) {
            JSONArray a = (JSONArray) v;
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < a.length(); i++) sb.append(i > 0 ? ", " : "").append(a.optString(i));
            return sb.toString();
        }
        return v == null ? "" : v.toString();
    }

    /** Usato dal ripristino: nomi tabelle attese in un backup di una certa versione. */
    static String[] tablesFor(int version) {
        if (version >= 2) return new String[]{"imports", "observations", "audit", "prefs", "rejected", "links", "receipts"};
        return new String[]{"imports", "observations", "audit", "prefs", "rejected"};
    }

}
