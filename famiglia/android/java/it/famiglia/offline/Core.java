package it.famiglia.offline;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.ResolverStyle;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Core = funzioni di calcolo "pure" (non toccano database né schermo).
 * Sono le regole di base: date, importi, tipo di movimento, abbinamenti.
 */
public final class Core {
    private Core() { }

    /** Minuscolo, senza spazi doppi: serve per confrontare testi. */
    public static String norm(String s) {
        return s == null ? "" : s.toLowerCase(Locale.ROOT).trim().replaceAll("\\s+", " ");
    }

    /** Impronta SHA-256 in esadecimale. */
    public static String hash(String s) {
        return hash(s.getBytes(StandardCharsets.UTF_8));
    }

    public static String hash(byte[] bytes) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(bytes);
            StringBuilder sb = new StringBuilder();
            for (byte b : d) sb.append(String.format("%02x", b & 0xff));
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /**
     * Converte una data Excel in AAAA-MM-GG.
     * Excel può salvare le date come numero di giorni (es. 45678) oppure come testo.
     */
    public static String date(String value, boolean date1904) {
        try {
            if (value.matches("[0-9]+(\\.[0-9]+)?")) {
                LocalDate base = date1904 ? LocalDate.of(1904, 1, 1) : LocalDate.of(1899, 12, 30);
                return base.plusDays(new BigDecimal(value).longValue()).toString();
            }
            if (value.matches("\\d{4}-\\d{2}-\\d{2}.*")) {
                return LocalDate.parse(value.substring(0, 10)).toString();
            }
            return LocalDate.parse(value, DateTimeFormatter.ofPattern("d/M/uuuu")
                    .withResolverStyle(ResolverStyle.STRICT)).toString();
        } catch (Exception e) {
            throw new IllegalArgumentException("Data non valida: " + value);
        }
    }

    /** "-1.234,56 €" -> -123456 centesimi. */
    public static long money(String value) {
        String s = value.trim().replace("€", "").replace(" ", "").replace(" ", "");
        if (s.contains(",")) s = s.replace(".", "").replace(",", ".");
        return new BigDecimal(s).movePointRight(2).setScale(0, RoundingMode.UNNECESSARY).longValueExact();
    }

    /** È un prelievo di contanti (bancomat/ATM)? */
    public static boolean isWithdrawal(Tx t) {
        String op = norm(t.operation) + " " + norm(t.details);
        return t.cents < 0 && (op.contains("prelievo") || op.contains("prelevamento")
                || op.contains("prel. bancomat") || op.contains("atm "));
    }

    /** Deduce il "trattamento" del movimento nei report. */
    public static String kind(Tx t) {
        String cat = norm(t.category), op = norm(t.operation);
        if (op.contains("arrotondamento operazioni")) return "saving";
        if (cat.contains("investiment")) return "investment";
        if (cat.contains("girocont") || op.contains("giroconto")) return "transfer";
        if (cat.contains("rimborsi") || cat.contains("storni")) return "refund";
        if (isWithdrawal(t)) return "withdrawal";
        return t.cents >= 0 ? "income" : "expense";
    }

    /** Assegna fingerprint e numero di occorrenza (righe identiche nello stesso file). */
    public static void numberOccurrences(List<Tx> rows) {
        Map<String, Integer> seen = new HashMap<>();
        for (Tx t : rows) {
            t.fingerprint = t.key();
            Integer n = seen.get(t.fingerprint);
            int next = n == null ? 1 : n + 1;
            seen.put(t.fingerprint, next);
            t.occurrence = next;
        }
    }

    /** Righe del file che non sono già nel database. */
    public static List<Tx> newRows(List<Tx> existing, List<Tx> incoming) {
        Set<String> keys = new HashSet<>();
        for (Tx t : existing) keys.add(t.fingerprint + ":" + t.occurrence);
        List<Tx> out = new ArrayList<>();
        for (Tx t : incoming) if (keys.add(t.fingerprint + ":" + t.occurrence)) out.add(t);
        return out;
    }

    /** Un movimento "in attesa" (NO) può corrispondere a un "contabilizzato" (SI)? */
    public static boolean candidate(Tx pending, Tx booked) {
        if (!"NO".equals(pending.status) || !"SI".equals(booked.status)) return false;
        if (!"active".equals(pending.state) || !"active".equals(booked.state)) return false;
        if (pending.cents != booked.cents || !pending.currency.equals(booked.currency)) return false;
        if (!pending.account.isEmpty() && !booked.account.isEmpty()
                && !norm(pending.account).equals(norm(booked.account))) return false;
        long days = Math.abs(ChronoUnit.DAYS.between(LocalDate.parse(pending.date), LocalDate.parse(booked.date)));
        return days <= 10;
    }

    /** Abbinamento "sicuro": stesso conto e stessa controparte. */
    public static boolean strong(Tx a, Tx b) {
        return candidate(a, b) && !a.account.isEmpty() && !b.account.isEmpty()
                && !a.merchant().isEmpty() && a.merchant().equals(b.merchant());
    }

    /** Coppie (in attesa -> definitivo) abbinabili automaticamente senza ambiguità. */
    public static List<long[]> autoPairs(List<Tx> all) {
        Set<Long> used = new HashSet<>();
        for (Tx t : all) if (t.replaced > 0) used.add(t.replaced);
        List<long[]> out = new ArrayList<>();
        for (Tx p : all) {
            if (!"NO".equals(p.status) || !"active".equals(p.state)) continue;
            List<Tx> matches = new ArrayList<>();
            for (Tx b : all) if (!used.contains(b.id) && strong(p, b)) matches.add(b);
            if (matches.size() != 1) continue;
            Tx booked = matches.get(0);
            int competitors = 0;
            for (Tx other : all) if (strong(other, booked)) competitors++;
            if (competitors == 1) {
                out.add(new long[]{p.id, booked.id});
                used.add(booked.id);
            }
        }
        return out;
    }
}
