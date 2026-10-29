# Pacchetti linguistici di Kalend — `src/i18n/<lingua>.json`

Ogni lingua supportata dall'app ha un file JSON con QUATTRO sezioni.
Il build (`tools/build.js`) le inietta nella pagina: `strings` finisce in
`L10N.DICT` (traduzioni dell'interfaccia), le altre tre in `window.KX_PACKS`
e vengono lette dai moduli v54 (parser multilingue, auto-tag, tag culturali).

```json
{
  "lang": "xx",
  "name": "Nome della lingua nella lingua stessa",
  "strings":  { "testo italiano sorgente": "traduzione", ... },
  "lexicon":  { ... parole del parser in linguaggio naturale ... },
  "autotag":  { "idFamiglia": ["parola chiave", ...], ... },
  "culture":  { ... nomi delle famiglie, tag predefiniti, tag culturali ... }
}
```

## 1. `strings` — traduzioni dell'interfaccia
* La CHIAVE è il testo italiano esatto (con emoji, punteggiatura, «», {segnaposto}).
* Il VALORE è la traduzione. Regole:
  * mantenere identici i segnaposto `{n}`, `{t}`, `{d}`, `{a}`, `{b}`, `{h}`, `{m}`, `{f}`, `{x}`, `{o}`, `{e}`, `{i}`, `{s}`;
  * mantenere le emoji iniziali e i simboli (✕ ＋ ‹ › ⛓ ☑ …) nella stessa posizione;
  * tono: informale, diretto, come un'app moderna di qualità nella lingua di destinazione
    (il "tu" dove la lingua lo usa normalmente per le app; forme cortesi dove è la norma, es. giapponese, coreano);
  * stringhe brevi per i pulsanti (non più lunghe del necessario);
  * nomi propri e marchi restano (Kalend, Google Calendar, Outlook, iCloud, Open-Meteo, Nager.Date, OpenStreetMap);
  * i nomi delle musiche (`◎ Family Aura`, `✚ Care Halo`, `🎷 Jazz club`, `🌆 Synthwave`, `⚰️ Mortorio`…) si traducono solo se la lingua ha un equivalente naturale, altrimenti si lasciano;
  * `#tag` iniziali (`#lavoro`, `#famiglia`…) → `#` + parola nella lingua, minuscola, senza spazi (usare `-` se servono due parole).
* Le lingue da destra a sinistra (ar, he) scrivono normalmente: l'app gestisce la direzione.

## 2. `lexicon` — parole del parser in linguaggio naturale
Il parser legge frasi come «Cena con Anna venerdì alle 20 a Roma #famiglia» e compila
data, ora, luogo, persone, tag, promemoria, ricorrenza. Tutte le voci sono liste di
parole/espressioni **in minuscolo**, nella forma in cui la gente le scrive o le detta.
Includere varianti (con/senza accento, abbreviazioni, forme colloquiali). Ordine libero.

| chiave | significato | esempio italiano |
|---|---|---|
| `today`, `tomorrow`, `after` | oggi · domani · dopodomani | `["oggi"]`, `["domani"]`, `["dopodomani"]` |
| `tonight`, `thisMorning` | stasera · stamattina (vanno su "oggi" + momento) | `["stasera"]`, `["stamattina"]` |
| `next` | qualificatore prima di un giorno: «prossimo lunedì», «questo venerdì» | `["prossimo","prossima","questo","questa"]` |
| `nextWeek` | «la settimana prossima» | `["settimana prossima","la prossima settimana"]` |
| `weekend` | «fine settimana» | `["fine settimana","weekend"]` |
| `weekdaysWord` | «giorni feriali» (lun-ven) | `["giorni feriali","feriali","giorni lavorativi"]` |
| `allday` | giornata intera | `["tutto il giorno","giornata intera"]` |
| `urgent`, `important` | priorità | `["urgente"]`, `["importante"]` |
| `remind` | chiedere un promemoria | `["ricordamelo","ricordami","avvisami","promemoria"]` |
| `before` | «prima» in «10 minuti prima» | `["prima"]` |
| `every` | «ogni» (ricorrenza) | `["ogni","tutti i","tutte le"]` |
| `until` | «fino al» (fine ricorrenza) | `["fino al","fino a","fino alla"]` |
| `daily`,`weekly`,`monthly`,`yearly` | aggettivi di ricorrenza | `["giornaliero","quotidiano"]`… |
| `times` | «volte» in «per 5 volte» | `["volte"]` |
| `biweekly` | «ogni due settimane», «a settimane alterne» (v55) | `["ogni due settimane","quindicinale"]` |
| `birthday` | parole di compleanno/anniversario: l'evento diventa di giornata intera e annuale (v55) | `["compleanno","anniversario","onomastico"]` |
| `quantities` | oggetto parola → «N unità» per duali e quantità fisse (arabo, ebraico) (v55) | `{"أسبوعين":"2 settimane"}` |
| `halfPrefix`, `quarterPrefix`, `threeQuartersPrefix` | frazione PRIMA dell'ora (hindi, bengalese): «साढ़े 7» = 7:30, «सवा 7» = 7:15, «पौने 8» = 7:45 (v55) | `["साढ़े"]`, `["सवा"]`, `["पौने"]` |
| `at` | preposizione prima di UN orario | `["alle","alle ore","all'","ore","verso le"]` |
| `from`, `to` | intervallo orario «dalle 9 alle 11» | `["dalle","dal","dalla"]`, `["alle","al","a","fino alle"]` |
| `for` | durata «per 2 ore» | `["per","durata","durante"]` |
| `in` | relativo «tra 2 giorni», «tra un'ora» | `["tra","fra"]` |
| `hours`,`minutes`,`days`,`weeks`,`months`,`years` | unità (singolare, plurale, abbreviazioni) | `["ora","ore","h"]`… |
| `halfHour`, `oneHour` | «mezz'ora», «un'ora» | `["mezz'ora","mezzora"]`, `["un'ora","un ora"]` |
| `half`, `quarter`, `threeQuarters` | frazioni dopo l'ora: «e mezza», «e un quarto», «meno un quarto» | `["mezza","mezzo"]`, `["un quarto"]`, `["tre quarti"]` |
| `plus`, `minus` | congiunzione tra ora e frazione: «otto E mezza», «nove MENO un quarto» | `["e"]`, `["meno"]` |
| `pm`, `am` | parole che portano l'ora al pomeriggio/sera o al mattino | `["di sera","della sera","di pomeriggio","del pomeriggio","di notte"]`, `["di mattina","del mattino"]` |
| `moments` | oggetto: momento della giornata → parole | `{"morning":["mattina","mattino"],"noon":["mezzogiorno"],"afternoon":["pomeriggio"],"evening":["sera"],"night":["notte"],"midnight":["mezzanotte"],"breakfast":["colazione"],"lunch":["pranzo"],"dinner":["cena"]}` |
| `with` | preposizione che introduce le persone | `["con","col","coi"]` |
| `withStrong` | espressioni che introducono SOLO persone (mai luoghi) | `["assieme a","insieme a","in compagnia di","accompagnato da"]` |
| `and` | congiunzioni tra nomi (senza spazi attorno) | `["e","ed"]` |
| `relatives` | parole di parentela/relazione riconosciute come persone | `["mamma","papà","moglie","marito","nonna","colleghi",…]` |
| `place` | preposizioni che introducono un luogo | `["a","in","presso","da"]` |
| `streets` | tipi di via (minuscolo) per riconoscere indirizzi | `["via","viale","piazza","corso","largo","vicolo"]` |
| `note` | marcatori della descrizione | `["note","nota","descrizione","dettagli"]` |
| `numbers` | oggetto parola → numero (0-31, più decine utili) | `{"uno":1,"una":1,"due":2,…,"trenta":30}` |
| `ordinals` | oggetto: «primo»…«quarto», «ultimo» → 1..4, -1 | `{"primo":1,"prima":1,"secondo":2,"terzo":3,"quarto":4,"ultimo":-1,"ultima":-1}` |
| `ofMonth` | «del mese» in «il primo lunedì del mese» | `["del mese","di ogni mese","al mese"]` |
| `stopwords` | parole funzionali da togliere da inizio/fine titolo | `["il","lo","la","i","gli","le","un","una","di","a","da","in","con","per","su","al","alle","e"]` |
| `weekdays` | SOLO forme extra non date da Intl: abbreviazioni, plurali → `[parola, indice]` (0=domenica … 6=sabato) | `[["lun",1],["mar",2],["lunedi",1],["domeniche",0]]` |
| `months` | SOLO forme extra: abbreviazioni → `[parola, indice]` (0=gennaio) | `[["gen",0],["feb",1]]` |
| `dateOrder` | ordine dei numeri in «5/3»: `"dmy"` o `"mdy"` | `"dmy"` |
| `hourSuffix`, `minuteSuffix`, `halfSuffix`, `monthSuffix`, `daySuffix` | SOLO per lingue che scrivono l'ora/data con suffissi (cinese, giapponese, coreano…): «3点半», «15時», «3시», «5月3日» | `[]` per l'italiano; `["点","點","时"]`, `["分"]`, `["半"]`, `["月"]`, `["日","号"]` per il cinese |
| `pmPrefix`, `amPrefix` | SOLO lingue con il momento PRIMA dell'ora: «下午3点», «午後3時», «오후 3시» | `["下午","晚上"]`, `["上午","早上"]` |
| `noSpaces` | `true` se la lingua non separa le parole con spazi (zh, ja, th) | `false` |

## 3. `autotag` — parole chiave per famiglia
L'auto-tag legge titolo e descrizione del nuovo evento e sceglie la famiglia.
Per ciascuna delle 20 famiglie, 25-60 parole/espressioni in minuscolo, **nella lingua e
nella cultura di destinazione**: le cose che la gente scrive davvero nel titolo di un
evento (non traduzioni letterali dell'italiano). Includere sigle locali, nomi di
istituzioni/abitudini locali, anglicismi usati nella lingua.

Famiglie (id → significato): `lavoro` lavoro/ufficio · `famiglia` · `amici` · `salute` medici,
esami · `sport` · `tavola` pranzi e cene fuori · `colazione` · `aperitivo` drink dopo il lavoro ·
`appuntamenti` incontri generici · `feste` compleanni, matrimoni, ricorrenze · `amore` coppia ·
`cultura` cinema, teatro, concerti, mostre · `commissioni` spesa, banca, posta, riparazioni ·
`natura` gite, montagna, mare · `bambini` scuola, pediatra · `pagamenti` bollette, scadenze,
tasse · `studio` esami, lezioni, corsi · `viaggi` · `relax` spa, meditazione · `altro`.

## 4. `culture` — come la lingua "pensa" il calendario
```json
"culture": {
  "families": { "lavoro": "Lavoro", "famiglia": "Famiglia", ... tutte e 20 ... },
  "familyTag": { "lavoro": "lavoro", "famiglia": "famiglia", ... tutte e 20 ... },
  "extraTags": [
    { "tag": "ramadan", "family": "feste", "emoji": "🌙",
      "keywords": ["iftar", "suhoor", "taraweeh"],
      "why": "una riga: perché serve a chi parla questa lingua" }
  ],
  "sampleSentence": "Cena con Anna venerdì alle 20 a Roma #famiglia",
  "sampleVoice": "domani dalle 9 alle 10 riunione assieme a Marco",
  "sampleFull": "Corso di yoga ogni lunedì e giovedì alle 18:30 fino al 20 dicembre in via Roma 5, Milano #sport ricordamelo 30 minuti prima",
  "notes": "una o due righe su convenzioni locali utili (formato data, weekend, usi)"
}
```
* `families`: il nome della famiglia come apparirebbe in un'app locale di qualità (breve).
* `familyTag`: la parola-tag predefinita (minuscola, senza spazi, `-` tra parole) con cui un
  utente locale etichetterebbe quella famiglia.
* `extraTags`: 4-10 tag che un utente di quella cultura si aspetterebbe di trovare già pronti
  (feste religiose e civili ricorrenti, abitudini sociali, istituzioni: es. «juku», «nomikai»
  per il giapponese; «hoesik», «hagwon» per il coreano; «arisan», «pengajian» per l'indonesiano;
  «imieniny» per il polacco; «dacha», «banya» per il russo; «iftar», «eid» per l'arabo;
  «puja», «tuition» per l'hindi; «shabbat» per l'ebraico…). Ogni tag ha famiglia, emoji,
  parole chiave per l'auto-tag e una riga di motivazione. Deve essere ciò che la gente usa
  davvero, non folklore.
* `sampleSentence` / `sampleVoice` / `sampleFull`: esempi NATURALI nella lingua, con nomi
  propri e città tipici del paese; devono essere frasi che il parser di quella lingua sa
  leggere (usare le parole del proprio `lexicon`).
