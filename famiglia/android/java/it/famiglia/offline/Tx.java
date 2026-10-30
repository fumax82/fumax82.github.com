package it.famiglia.offline;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Tx = un singolo movimento (transazione) del conto o della carta.
 *
 * Gli importi sono in CENTESIMI (long) per evitare errori di arrotondamento:
 * -12,50 € diventa -1250.
 */
public class Tx {
    public long id;                 // chiave nel database
    public String fingerprint = ""; // "impronta" per riconoscere doppioni tra file diversi
    public int occurrence;          // 1, 2, 3... se esistono righe perfettamente identiche

    // --- Dati letti dal file della banca ---
    public String date = "";        // formato AAAA-MM-GG
    public String operation = "";   // es. "Pagamento POS"
    public String details = "";     // es. "ANTHROPIC SAN FRANCISCO"
    public String account = "";     // conto o carta indicata dalla banca
    public String currency = "EUR";
    public long cents;              // negativo = uscita, positivo = entrata
    public String status = "";      // "SI" contabilizzato, "NO" in attesa
    public String category = "";    // categoria (bancaria o scelta da te)

    // --- Classificazione personale ---
    public String kind = "";        // expense, income, refund, saving, investment, transfer, withdrawal
    public String note = "";
    public String person = "Famiglia";
    public String family = "";      // "famiglia di spesa" (macro-gruppo, es. Tecnologia)
    public String accountUser = ""; // conto/carta indicata da te quando manca nel file
    public String classifiedBy = "";// chi ha classificato: bank, user, rule:<id>
    public String source = "bank";  // bank = da file, manual = inserito a mano (contanti)
    public String extra = "{}";     // campi manuali aggiuntivi in JSON (necessità, etichette, ...)

    // --- Stato ---
    public String state = "active"; // active, replaced (riconciliato), excluded
    public long replaced;           // id del movimento definitivo che sostituisce questo

    public Map<String, String> raw = new LinkedHashMap<>(); // riga originale del file

    /** Impronta usata per riconoscere lo stesso movimento in importazioni diverse. */
    public String key() {
        return Core.hash(date + "\u001f" + Core.norm(operation) + "\u001f" + Core.norm(details) + "\u001f"
                + Core.norm(account) + "\u001f" + currency + "\u001f" + cents + "\u001f" + status);
    }

    /** Nome "pulito" della controparte (esercente, beneficiario...). */
    public String merchant() {
        return Core.norm(details.isEmpty() ? operation : details);
    }
}
