package app.kalend;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

/**
 * Liste nel widget (classe WidgetLists): conteggi, spunte, coda verso la pagina.
 *
 * Scenario: l'utente spunta una voce dal widget mentre l'app è chiusa. La spunta deve
 * (1) aggiornare subito i contatori del widget, (2) finire in una coda che la pagina ritira
 * all'apertura, (3) non andare persa se nel frattempo la pagina manda un JSON vecchio.
 */
public class WidgetListsTest {

    /** JSON del widget con due liste: "spesa" (1 fatta su 3) e "casa" (0 su 1) */
    private static JSONObject sample() throws Exception {
        return new JSONObject("{"
                + "\"lists\":["
                + " {\"id\":\"spesa\",\"n\":\"Spesa\",\"t\":3,\"d\":1,\"it\":["
                + "   {\"i\":\"a1\",\"t\":\"Latte\",\"d\":1},{\"i\":\"a2\",\"t\":\"Pane\",\"d\":0},{\"i\":\"a3\",\"t\":\"Uova\"}]},"
                + " {\"id\":\"casa\",\"n\":\"Casa\",\"t\":1,\"d\":0,\"it\":[{\"i\":\"b1\",\"t\":\"Lampadina\",\"d\":0}]}"
                + "],"
                + "\"items\":[{\"li\":\"spesa\",\"ld\":1},{\"li\":\"casa\",\"ld\":0},{\"title\":\"evento\"}]"
                + "}");
    }

    private static JSONObject list(JSONObject data, int i) { return data.optJSONArray("lists").optJSONObject(i); }

    @Test public void conteggi() throws Exception {
        JSONObject d = sample();
        assertEquals(2, WidgetLists.open(list(d, 0)));
        assertEquals(1, WidgetLists.open(list(d, 1)));
        assertEquals(3, WidgetLists.openAll(WidgetLists.lists(d)));
        assertEquals(2, WidgetLists.openLists(WidgetLists.lists(d)));
        // dati strani: mai numeri negativi, mai errori
        assertEquals(0, WidgetLists.open(new JSONObject("{\"t\":2,\"d\":5}")));
        assertEquals(0, WidgetLists.open(null));
        assertEquals(0, WidgetLists.openAll(null));
        assertEquals(0, WidgetLists.openLists(null));
        assertEquals(null, WidgetLists.lists(new JSONObject("{}")));
    }

    @Test public void spuntaAggiornaContatoriERighe() throws Exception {
        JSONObject d = sample();
        assertTrue(WidgetLists.setState(d, "a2", 1));
        assertEquals(1, list(d, 0).optJSONArray("it").optJSONObject(1).optInt("d"));
        assertEquals(2, list(d, 0).optInt("d"));
        JSONArray rows = d.optJSONArray("items");
        assertEquals("riga della stessa lista aggiornata", 2, rows.optJSONObject(0).optInt("ld"));
        assertEquals("riga di un'altra lista intatta", 0, rows.optJSONObject(1).optInt("ld"));
        assertFalse("riga senza lista non toccata", rows.optJSONObject(2).has("ld"));

        // togliere la spunta riporta indietro
        assertTrue(WidgetLists.setState(d, "a2", 0));
        assertEquals(1, list(d, 0).optInt("d"));
    }

    @Test public void spuntaRipetutaNonContaDueVolte() throws Exception {
        JSONObject d = sample();
        assertTrue(WidgetLists.setState(d, "a1", 1));     // era già fatta
        assertEquals(1, list(d, 0).optInt("d"));
    }

    @Test public void contatoreSempreFraZeroETotale() throws Exception {
        JSONObject d = new JSONObject("{\"lists\":[{\"id\":\"x\",\"t\":1,\"d\":1,\"it\":[{\"i\":\"q\",\"d\":0}]}]}");
        WidgetLists.setState(d, "q", 1);                 // d sarebbe 2 > t: resta 1
        assertEquals(1, list(d, 0).optInt("d"));
        JSONObject z = new JSONObject("{\"lists\":[{\"id\":\"x\",\"t\":3,\"d\":0,\"it\":[{\"i\":\"q\",\"d\":1}]}]}");
        WidgetLists.setState(z, "q", 0);                 // d sarebbe -1: resta 0
        assertEquals(0, list(z, 0).optInt("d"));
    }

    @Test public void voceInesistente() throws Exception {
        JSONObject d = sample();
        String before = d.toString();
        assertFalse(WidgetLists.setState(d, "zz", 1));
        assertFalse(WidgetLists.setState(d, null, 1));
        assertFalse(WidgetLists.setState(new JSONObject("{}"), "a1", 1));
        assertEquals("nessuna modifica", before, d.toString());
        assertEquals(-1, WidgetLists.toggledState(d, "zz"));
        assertEquals(-1, WidgetLists.toggledState(d, null));
    }

    @Test public void statoDopoIlTocco() throws Exception {
        JSONObject d = sample();
        assertEquals(0, WidgetLists.toggledState(d, "a1"));   // fatta → da fare
        assertEquals(1, WidgetLists.toggledState(d, "a2"));   // da fare → fatta
        assertEquals(1, WidgetLists.toggledState(d, "a3"));   // senza "d" = da fare
    }

    @Test public void codaDelleSpunteLimitata() throws Exception {
        String q = WidgetLists.enqueue(null, "a2", 1, 1000L);
        JSONObject e = new JSONArray(q).getJSONObject(0);
        assertEquals("a2", e.getString("t"));
        assertEquals(1, e.getInt("d"));
        assertEquals(1000L, e.getLong("at"));

        for (int i = 0; i < WidgetLists.QUEUE_MAX + 25; i++) q = WidgetLists.enqueue(q, "v" + i, i % 2, i);
        JSONArray arr = new JSONArray(q);
        assertEquals(WidgetLists.QUEUE_MAX, arr.length());
        assertEquals("restano le più recenti", "v" + (WidgetLists.QUEUE_MAX + 24), arr.getJSONObject(arr.length() - 1).getString("t"));
    }

    @Test public void lePrimeSpunteNonSiPerdono() throws Exception {
        FakePrefs p = new FakePrefs();
        // coda vuota: il JSON della pagina passa così com'è
        String fromPage = sample().toString();
        assertEquals(fromPage, WidgetLists.overlay(p, fromPage));

        // spunta fatta dal widget, la pagina non l'ha ancora vista e manda un JSON vecchio
        p.edit().putString("li_q", WidgetLists.enqueue("[]", "a2", 1, 5L)).apply();
        JSONObject merged = new JSONObject(WidgetLists.overlay(p, fromPage));
        assertEquals(1, list(merged, 0).optJSONArray("it").optJSONObject(1).optInt("d"));
        assertEquals(2, list(merged, 0).optInt("d"));

        // JSON rovinato: torna l'originale, nessun errore
        assertEquals("{rotto", WidgetLists.overlay(p, "{rotto"));
    }

    @Test public void laPaginaRitiraLaCoda() throws Exception {
        FakePrefs p = new FakePrefs();
        assertEquals("[]", WidgetLists.take(p));
        String q = WidgetLists.enqueue("[]", "b1", 1, 7L);
        p.edit().putString("li_q", q).apply();
        assertEquals(q, WidgetLists.take(p));
        assertEquals("dopo il ritiro la coda è vuota", "[]", WidgetLists.take(p));
        assertFalse(p.contains("li_q"));
    }
}
