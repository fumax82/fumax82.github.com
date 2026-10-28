# Kalend v54 "Mondo" — cosa è cambiato e perché

## 1. Tutte le funzioni in tutte le 20 lingue
Prima solo l'inglese era quasi completo (845 voci) e le altre 18 lingue avevano
133 voci: il resto cadeva in inglese o restava in italiano. Ora ogni lingua ha
tutte le ~1060 voci dell'interfaccia (`src/i18n/<lingua>.json`), più le stringhe
dei moduli nuovi. I pannelli costruiti dopo l'avvio (sincronizzazione QR, To Do)
e le etichette per gli screen reader vengono tradotti anch'essi.

Strumento di controllo: `node Kalend/tools/i18n-audit.js Kalend/docs/i18n --lang xx`
elenca i testi ancora in italiano in quella lingua (restano solo nomi propri,
marchi e nomi delle musiche, che non si traducono).

## 2. Compilazione automatica che capisce ogni lingua
Il parser storico capiva l'italiano e un po' di 5 lingue. Ora ogni lingua ha un
**lessico** (oggi/domani, preposizioni di orario, durate, ricorrenze, momenti
della giornata, persone, luoghi, numeri a parole, ordinali…) e il modulo
`10-lang-packs.js` traduce la frase nelle parole che il parser conosce prima di
leggerla. Gestisce anche:
* orari con suffisso o prefisso: «15時», «下午3点半», «오후 3시», «शाम 7 बजे», «2 ทุ่ม»;
* preposizioni dopo il numero: «15時から16時まで», «提前30分钟», «30분 전에»;
* persone con particelle: «田中さんと», «민수랑», «和小明», «प्रिया के साथ», «Ayşe ile»;
* luoghi: «渋谷で», «강남역에서», «在北京», «Kadıköy'de», «Hauptstraße 5, Berlin»;
* alfabeti senza maiuscole (arabo, ebraico, hindi, bengalese, thai) e #tag con
  segni combinati.

Prova: `node Kalend/tools/nl-test.js ja` (usa gli esempi del pacchetto) o con frasi proprie.

## 3. Auto-tag, famiglie e tag culturali
* L'auto-tag ora legge anche cirillico, arabo, ebraico, devanagari, cinese,
  giapponese, coreano, thai; usa le parole chiave della lingua (25-60 per famiglia)
  oltre a quelle aggiunte dall'utente.
* I nomi delle famiglie e le parole chiave predefinite seguono la lingua; le
  personalizzazioni dell'utente restano.
* Ogni cultura porta i suoi tag già pronti (es. 春节/团建/体检 per il cinese,
  忘年会/塾/お盆 per il giapponese, 회식/학원/명절 per il coreano, رمضان/العيد/عزومة
  per l'arabo, दिवाली/पूजा/शादी per l'hindi, imieniny/majówka per il polacco,
  bukber/arisan/mudik per l'indonesiano, churrasco/carnaval per il portoghese,
  Stammtisch/Elternabend/TÜV per il tedesco…): creati una volta per lingua, nella
  loro famiglia, con parole chiave; se l'utente li cancella non tornano.
* Al cambio di lingua l'app propone (con conferma) di rinominare i tag
  predefiniti nella nuova lingua in tutti gli eventi.

## 4. Calendari del mondo
Impostazioni → Lingua e paese → **Calendario secondario**: islamico (Umm al-Qura
o civile), ebraico, cinese/lunare, coreano, persiano, buddhista, indiano, ere
giapponesi, etiope, copto, Minguo. «Automatico» sceglie in base a paese e lingua
(Arabia Saudita → Umm al-Qura, Israele → ebraico, Cina/Vietnam → lunare, Corea →
dangi, Thailandia → buddhista, Giappone → ere…). La data compare in piccolo in ogni
giorno del mese (col nome del mese quando cambia), nel riepilogo e nel dettaglio
della giornata. Tutto calcolato sul telefono.

Festività offline aggiunte per Bangladesh, Thailandia, Pakistan, Indonesia,
Vietnam, Malesia, Sri Lanka, Nepal, Iran e feste islamiche/ebraiche/lunari
calcolate per Arabia Saudita, Emirati, Egitto, Turchia, India, Israele.

## 5. Widget
Tra gli impegni compaiono le righe verdi «🟢 Libero · 2h30» (le due fasce più
lunghe di ogni giorno, prossimi 7 giorni, finestra 8–21) e, a scelta, il
riepilogo «3 impegni · 4h liberi». Si regolano in Impostazioni → Funzionalità.
La parte nativa del widget non cambia: riceve solo righe in più.

## 6. Più intuitiva
* Popup dell'evento: nuovo tasto **🟢 Libero** → Disponibilità di quel giorno.
* Riepilogo giornata: riga **Libero · Liste · Detta**.
* Menu ⋯: **Disponibilità** (in Organizza) e **Calendario secondario** (in Vista e
  atmosfera).
* Suggerimenti: mai sopra un pannello aperto, mai nei primi 6 secondi, al massimo
  uno ogni 45 secondi; due nuovi (Disponibilità, Calendario secondario).
* Il consiglio «tocca due volte un giorno» non copre più il sipario d'apertura.

## 7. Per vendere l'app
Campo **Chiave API Open-Meteo** (Impostazioni → Funzionalità): con la chiave le
richieste meteo e di geocodifica passano dal piano commerciale. Vedi README.

## Cosa NON è cambiato
Nessuna funzione è stata tolta. La grafica, il cielo vivo, la musica, le catene,
le liste, la dettatura e tutto il resto funzionano come prima; in italiano il
parser è identico a prima.

## Limiti noti
* La parte nativa (widget Java, promemoria) non è nel repository: l'APK nuovo è
  l'originale con la pagina sostituita, da firmare con la propria chiave.
* Nel parser alcune forme molto colloquiali (es. «wpół do dziewiątej» in polacco,
  «halb drei» in tedesco, «पौने चार» in hindi) non sono ancora capite: i pacchetti
  lingua le documentano in `culture.notes`.
