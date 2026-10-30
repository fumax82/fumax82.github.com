package it.famiglia.offline;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

/**
 * Lettore dei file Excel (.xlsx) esportati da Intesa Sanpaolo.
 *
 * Un .xlsx è uno ZIP che contiene file XML. Qui leggiamo:
 *  - xl/sharedStrings.xml  (i testi delle celle)
 *  - xl/worksheets/sheetN.xml (le righe)
 * Le righe prima dell'intestazione contengono il periodo ("Data inizio
 * periodo", "Data fine periodo") che serve all'analisi dei buchi.
 */
public final class Xlsx {
    private Xlsx() { }

    /** Risultato della lettura di un file. */
    public static class Parsed {
        public List<Tx> rows = new ArrayList<>();
        public String start = "";   // inizio periodo dichiarato nel file
        public String end = "";     // fine periodo dichiarata nel file
        public String meta = "";    // righe descrittive sopra la tabella
        public int expected = -1;   // numero di movimenti dichiarato dalla banca
    }

    private static final long MAX_EXPANDED = 80_000_000L;

    public static Parsed parse(byte[] file) throws Exception {
        Map<String, byte[]> parts = unzip(file);
        if (!parts.containsKey("xl/workbook.xml")) {
            throw new IOException("Seleziona un file .xlsx Intesa, non .xls o PDF");
        }
        // Le date Excel possono partire dal 1900 (default) o dal 1904
        boolean date1904 = false;
        NodeList pr = xml(parts.get("xl/workbook.xml")).getElementsByTagName("workbookPr");
        if (pr.getLength() > 0) date1904 = ((Element) pr.item(0)).getAttribute("date1904").matches("1|true");

        List<String> shared = new ArrayList<>();
        if (parts.containsKey("xl/sharedStrings.xml")) {
            NodeList si = xml(parts.get("xl/sharedStrings.xml")).getElementsByTagName("si");
            for (int i = 0; i < si.getLength(); i++) shared.add(texts((Element) si.item(i), "t"));
        }

        Parsed out = new Parsed();
        StringBuilder meta = new StringBuilder();
        boolean headerFound = false;
        List<String> names = new ArrayList<>(parts.keySet());
        Collections.sort(names);

        for (String sheet : names) {
            if (!sheet.matches("xl/worksheets/sheet[0-9]+\\.xml")) continue;
            NodeList rows = xml(parts.get(sheet)).getElementsByTagName("row");
            Map<Integer, String> header = null;

            for (int r = 0; r < rows.getLength(); r++) {
                Element row = (Element) rows.item(r);
                String rowRef = row.getAttribute("r");
                Map<Integer, String> cells = readCells(row, shared);

                if (header == null) {
                    // Siamo ancora sopra la tabella: cerchiamo l'intestazione
                    if (cells.containsValue("Contabilizzazione") || trimmedContains(cells, "Contabilizzazione")) {
                        header = cells;
                        headerFound = true;
                        continue;
                    }
                    meta.append(sheet).append(':').append(rowRef).append(' ').append(cells).append('\n');
                    readPeriod(new ArrayList<>(cells.values()), out, date1904);
                    continue;
                }
                if (allBlank(cells)) continue;

                // Riga della tabella: nome colonna -> valore
                Map<String, String> rec = new LinkedHashMap<>();
                for (Map.Entry<Integer, String> e : cells.entrySet()) {
                    String col = header.containsKey(e.getKey()) ? header.get(e.getKey()) : "Colonna " + (e.getKey() + 1);
                    rec.put(col.trim(), e.getValue());
                }
                String date = get(rec, "Data"), amount = get(rec, "Importo");
                if (date.isEmpty() && amount.isEmpty()) {
                    meta.append(cells).append('\n'); // righe di totale o note
                    continue;
                }
                if (date.isEmpty() || amount.isEmpty()) {
                    throw new IOException("Riga " + rowRef + ": data/importo mancanti");
                }
                out.rows.add(toTx(rec, sheet, rowRef, date, amount, date1904));
            }
        }
        if (!headerFound || out.rows.isEmpty()) throw new IOException("Nessuna tabella Intesa riconosciuta");
        if (out.expected >= 0 && out.rows.size() != out.expected) {
            throw new IOException("Righe lette " + out.rows.size() + ", attese " + out.expected + ". Importazione annullata.");
        }
        // Se il file non dichiara il periodo, usiamo la prima e l'ultima data presenti
        if (out.start.isEmpty() || out.end.isEmpty()) {
            String min = null, max = null;
            for (Tx t : out.rows) {
                if (min == null || t.date.compareTo(min) < 0) min = t.date;
                if (max == null || t.date.compareTo(max) > 0) max = t.date;
            }
            if (out.start.isEmpty()) out.start = min;
            if (out.end.isEmpty()) out.end = max;
        }
        out.meta = meta.toString();
        Core.numberOccurrences(out.rows);
        return out;
    }

    private static Tx toTx(Map<String, String> rec, String sheet, String rowRef, String date, String amount,
                           boolean date1904) throws IOException {
        Tx t = new Tx();
        t.raw = rec;
        t.raw.put("_foglio", sheet);
        t.raw.put("_riga", rowRef);
        t.date = Core.date(date, date1904);
        t.operation = get(rec, "Operazione");
        t.details = get(rec, "Dettagli");
        t.account = get(rec, "Conto o carta");
        t.status = get(rec, "Contabilizzazione").trim().toUpperCase(Locale.ROOT).replace("Ì", "I");
        if (!t.status.equals("SI") && !t.status.equals("NO")) {
            throw new IOException("Stato sconosciuto alla riga " + rowRef);
        }
        t.category = get(rec, "Categoria");
        t.currency = get(rec, "Valuta").trim().toUpperCase(Locale.ROOT);
        if (!t.currency.equals("EUR")) throw new IOException("Questa versione supporta EUR. Nessuna riga importata.");
        t.cents = Core.money(amount);
        t.kind = Core.kind(t);
        t.classifiedBy = t.category.isEmpty() ? "" : "bank";
        return t;
    }

    /** Cerca nelle righe sopra la tabella le date del periodo e il numero di movimenti. */
    private static void readPeriod(List<String> values, Parsed out, boolean date1904) {
        for (int i = 0; i < values.size() - 1; i++) {
            String label = values.get(i), next = values.get(i + 1);
            try {
                if (label.contains("Data inizio periodo")) out.start = Core.date(next.trim(), date1904);
                if (label.contains("Data fine periodo")) out.end = Core.date(next.trim(), date1904);
                if (label.contains("I movimenti selezionati")) out.expected = (int) Double.parseDouble(next.trim());
            } catch (Exception ignored) {
                // valore non leggibile: lo ignoriamo, non è essenziale
            }
        }
    }

    private static Map<Integer, String> readCells(Element row, List<String> shared) {
        Map<Integer, String> cells = new TreeMap<>();
        NodeList cs = row.getElementsByTagName("c");
        for (int i = 0; i < cs.getLength(); i++) {
            Element c = (Element) cs.item(i);
            String type = c.getAttribute("t");
            String value = texts(c, "v");
            if (type.equals("s")) value = shared.get(Integer.parseInt(value));
            else if (type.equals("inlineStr")) value = texts(c, "t");
            cells.put(col(c.getAttribute("r")), value);
        }
        return cells;
    }

    private static boolean trimmedContains(Map<Integer, String> cells, String text) {
        for (String v : cells.values()) if (v.trim().equals(text)) return true;
        return false;
    }

    private static boolean allBlank(Map<Integer, String> cells) {
        for (String v : cells.values()) if (!v.trim().isEmpty()) return false;
        return true;
    }

    private static String get(Map<String, String> m, String k) {
        String v = m.get(k);
        return v == null ? "" : v;
    }

    /** "C12" -> 2 (indice colonna da zero). */
    static int col(String ref) {
        int n = 0;
        for (char ch : ref.toCharArray()) {
            if (ch < 'A' || ch > 'Z') break;
            n = n * 26 + (ch - 'A' + 1);
        }
        return n - 1;
    }

    static String texts(Element el, String tag) {
        NodeList list = el.getElementsByTagName(tag);
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < list.getLength(); i++) sb.append(list.item(i).getTextContent());
        return sb.toString();
    }

    /** Legge XML rifiutando DOCTYPE/ENTITY (protezione da file malevoli). */
    static Document xml(byte[] bytes) throws Exception {
        if (bytes == null) throw new IOException("Parte XLSX mancante");
        String text = new String(bytes, StandardCharsets.UTF_8);
        if (text.contains("<!DOCTYPE") || text.contains("<!ENTITY")) throw new IOException("XML non consentito");
        DocumentBuilderFactory f = DocumentBuilderFactory.newInstance();
        f.setNamespaceAware(false);
        f.setExpandEntityReferences(false);
        return f.newDocumentBuilder().parse(new ByteArrayInputStream(bytes));
    }

    /** Estrae lo ZIP in memoria con un limite di sicurezza sulla dimensione. */
    private static Map<String, byte[]> unzip(byte[] file) throws IOException {
        Map<String, byte[]> parts = new HashMap<>();
        long total = 0;
        try (ZipInputStream zin = new ZipInputStream(new ByteArrayInputStream(file))) {
            ZipEntry e;
            byte[] buf = new byte[8192];
            while ((e = zin.getNextEntry()) != null) {
                if (e.isDirectory()) continue;
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                int n;
                while ((n = zin.read(buf)) != -1) {
                    total += n;
                    if (total > MAX_EXPANDED) throw new IOException("File espanso troppo grande (80 MB)");
                    out.write(buf, 0, n);
                }
                parts.put(e.getName(), out.toByteArray());
            }
        }
        return parts;
    }
}
