package app.kalend;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

import static org.junit.Assert.assertEquals;

/**
 * Posticipi dei promemoria (Reminders.snzMerge): l'elenco dei posticipi in attesa sopravvive
 * ai riavvii del telefono, quindi deve restare pulito: un solo posticipo per promemoria,
 * niente voci scadute che si accumulano.
 */
public class RemindersTest {

    private static final long NOW = 1_800_000_000_000L;   // un istante qualunque (anno 2027)

    private static JSONArray old() throws Exception {
        return new JSONArray()
                .put(new JSONObject().put("id", 1).put("at", NOW + 600_000).put("j", "{\"id\":1}"))     // futuro
                .put(new JSONObject().put("id", 2).put("at", NOW - 30_000).put("j", "{\"id\":2}"))      // appena scaduto: si tiene
                .put(new JSONObject().put("id", 3).put("at", NOW - 120_000).put("j", "{\"id\":3}"));    // scaduto da 2 min: via
    }

    @Test public void nuovoPosticipoSostituisceIlVecchio() throws Exception {
        JSONArray out = Reminders.snzMerge(old(), 1, NOW + 900_000, "{\"id\":1,\"snz\":1}", NOW, true);
        assertEquals(2, out.length());
        assertEquals(2, out.getJSONObject(0).getInt("id"));
        JSONObject last = out.getJSONObject(1);
        assertEquals(1, last.getInt("id"));
        assertEquals(NOW + 900_000, last.getLong("at"));
        assertEquals("{\"id\":1,\"snz\":1}", last.getString("j"));
    }

    @Test public void posticipoScattatoVieneTolto() throws Exception {
        JSONArray out = Reminders.snzMerge(old(), 1, 0, "{}", NOW, false);
        assertEquals(1, out.length());
        assertEquals(2, out.getJSONObject(0).getInt("id"));
    }

    @Test public void scadutiDimenticatiDopoUnMinuto() throws Exception {
        JSONArray a = new JSONArray()
                .put(new JSONObject().put("id", 9).put("at", NOW - Reminders.SNOOZE_GRACE_MS))       // esattamente al limite: via
                .put(new JSONObject().put("id", 8).put("at", NOW - Reminders.SNOOZE_GRACE_MS + 1));  // un millisecondo prima: resta
        JSONArray out = Reminders.snzMerge(a, 99, 0, "{}", NOW, false);
        assertEquals(1, out.length());
        assertEquals(8, out.getJSONObject(0).getInt("id"));
    }

    @Test public void elencoVuotoOMancante() throws Exception {
        assertEquals(0, Reminders.snzMerge(new JSONArray(), 1, 0, "{}", NOW, false).length());
        JSONArray out = Reminders.snzMerge(null, 4, NOW + 1, "{\"id\":4}", NOW, true);
        assertEquals(1, out.length());
        assertEquals(4, out.getJSONObject(0).getInt("id"));
    }
}
