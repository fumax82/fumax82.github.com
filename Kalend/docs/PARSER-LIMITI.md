# Parser in linguaggio naturale — limiti noti per lingua

**Totale**: 542 frasi in 19 lingue, 24 limiti noti.

Generato da `tools/nl-limits.js` dai casi marcati `skip` in `tools/nl-suite/<lingua>.json`.
Ogni riga: la frase, cosa ci si aspetterebbe e la causa (come annotata nel banco di prova).
Per rilanciare il banco: `node Kalend/tools/nl-suite.js all`.

## العربية (ar) — 25 frasi, 1 limiti noti

- «عشاء مع سارة وأحمد الجمعة الساعة 8 مساءً»  
  atteso: title: "عشاء", date: "wd:5", start: "20:00", people: ["سارة","أحمد"]  
  la congiunzione «و» attaccata al secondo nome (وأحمد) non viene separata; caselessPeople cerca solo « e » tra i nomi

## বাংলা (bn) — 25 frasi, 3 limiti noti

- «শুক্রবার রাত ৮টায় আনিকার সাথে ঢাকায় ডিনার #পরিবার»  
  atteso: title: "ডিনার", date: "wd:5", start: "20:00", people: ["আনিকার"], loc: "ঢাকা"  
  il suffisso locativo attaccato (ঢাকায়, গুলশানে, বনানীতে) non è riconosciuto; la regola PLACE_AFTER vuole la posposizione separata da uno spazio
- «আনিকা ও রাহুলের সাথে ডিনার শুক্রবার রাত ৮টায়»  
  atteso: title: "ডিনার", date: "wd:5", start: "20:00", people: ["আনিকা","রাহুলের"]  
  la regola WITH_AFTER prende una sola parola prima di «সাথে»; «আনিকা ও» resta nel titolo
- «৫ই মার্চ দুপুর ২টায় ডেন্টিস্ট»  
  atteso: title: "ডেন্টিস্ট", date: "md:3-5", start: "14:00"  
  il suffisso ordinale attaccato al giorno (৫ই, ২০শে, ১লা, ২রা, ৩রা, ৪ঠা) impedisce di leggere «5 marzo»; daySuffix è usato solo insieme a monthSuffix

## Deutsch (de) — 27 frasi, 2 limiti noti

- «Mama anrufen heute Abend um halb neun»  
  atteso: titleIncludes: "Mama", date: "today", start: "20:30"  
  «halb neun» = 8:30 (mezz'ora PRIMA delle nove): né il lessico né il modulo hanno una regola «halb + ora successiva»; canon «um mezza neun», nessun orario. Correzione proposta: in ranges() una regola per le lingue con «halb/half» prefisso (de, nl) che sottragga 30 minuti all'ora seguente.
- «Comic Con Stuttgart am Samstag um 10 Uhr»  
  atteso: titleIncludes: "Comic Con", people: [], date: "wd:6", start: "10:00"  
  il parser storico NL2 ha «con» (e «Con») in W.with per tutte le lingue: «Con Stuttgart» → persona «Stuttgart» e il titolo resta «Comic». Ottenuto titolo «Comic», persone [Stuttgart].

## English (en) — 25 frasi, 1 limiti noti

- «Call mum tonight at half past eight»  
  atteso: titleIncludes: "mum", date: "today", start: "20:30"  
  normalize() di NL2 traduce «half past eight» in «at 08:30» ma non applica il contesto serale («tonight»); la regola +12h del parser scatta solo per «alle/at [1-7]» scritto in cifre. Ottenuto 08:30.

## Español (es) — 26 frasi, 1 limiti noti

- «Ver Mamma Mia en el teatro el sábado a las 20»  
  atteso: titleIncludes: "Mamma Mia", people: [], date: "wd:6", start: "20:00"  
  il hook v44 people() di index.html applica a tutte le lingue la regola italiana «REL + Nome» («mia moglie Laura» → Laura): «Mamma Mia» produce la persona «Mia». Ottenuto persone [Mia].

## Français (fr) — 28 frasi, 2 limiti noti

- «Appeler maman ce soir à huit heures et demie»  
  atteso: titleIncludes: "maman", date: "today", start: "20:30"  
  la regola plus di ranges() («8 et demie» → «8 e mezza») gira prima che «demie» diventi «mezza» (regole SIMPLE), quindi la frazione si perde: canon «alle 8 ore et mezza», ottenuto 20:00. Stessa causa del caso spagnolo «ocho y media».
- «Cours de yoga tous les lundis et jeudis à 18h30 jusqu'au 20 décembre au 5 rue de Rivoli, Paris»  
  atteso: title: "Cours de yoga", loc: "5 rue de Rivoli, Paris", rrule: {"freq":"WEEKLY","byday":[1,4],"until":"md:12-20"}  
  la regex indirizzi di NL2 (riga ~19302) vuole il civico DOPO il nome della via (stile italiano); «au 5 rue de Rivoli» lascia «au 5» nel titolo e il luogo perde il numero. Ottenuto titolo «Cours de yoga au 5», luogo «rue de Rivoli, Paris».

## עברית (he) — 26 frasi, 2 limiti noti

- «פגישה עם נועה ויוסי מחר בשעה 10»  
  atteso: title: "פגישה", date: "+1", start: "10:00", people: ["נועה","יוסי"]  
  la «ו» attaccata al secondo nome (ויוסי) non viene separata in « e »
- «הופעה בירושלים ב-3 ביולי בשעה 21»  
  atteso: titleIncludes: "הופעה", date: "md:7-3", start: "21:00", loc: "ירושלים"  
  il prefisso «ב» attaccato alla città (בירושלים) non è riconosciuto come preposizione di luogo

## हिन्दी (hi) — 26 frasi, 1 limiti noti

- «प्रिया और रोहित के साथ डिनर शुक्रवार रात 8 बजे»  
  atteso: title: "डिनर", date: "wd:5", start: "20:00", people: ["प्रिया","रोहित"]  
  la regola WITH_AFTER prende una sola parola prima di «के साथ»; «प्रिया और» resta nel titolo

## Bahasa Indonesia (id) — 37 frasi, 2 limiti noti

- «Jumat jam setengah 8 malam nonton sama Rina»  
  atteso: title: "Nonton", date: "wd:5", start: "19:30", people: ["Rina"]  
  «setengah 8» = 7:30 (mezza PRIMA dell'ora); canon «jam mezza 8 di sera» → 20:00. Servirebbe una regola «half + H» → H-1:30 per id (e «wpół do», «пів на»)
- «Nonton bioskop sama ayah sabtu malam jam 8»  
  atteso: titleIncludes: "bioskop", date: "wd:6", start: "20:00", people: ["Ayah"]  
  «sabtu malam jam 8» (momento PRIMA dell'ora, senza suffisso orario): pmPrefix agisce solo con hourSuffix in suffixTimes(); proposta: estendere suffixTimes a «pmPrefix (at)? H»

## Italiano (it) — 20 frasi, 0 limiti noti


## 日本語 (ja) — 28 frasi, 1 limiti noti

- «明日15時〜16時 鈴木さんと面談»  
  atteso: title: "面談", date: "+1", start: "15:00", end: "16:00", people: ["鈴木"]  
  «〜» (tilde giapponese fra due orari) non ha lettere e viene scartato da arr() nel lessico `to`; resta «alle 15:00 〜 alle 16:00» e «〜 16:00» finisce nel titolo. Correzione: in preNormalize mappare 〜/～/~ fra due orari in «-» (NL2 capisce già «15:00-16:00»)

## 한국어 (ko) — 28 frasi, 1 limiti noti

- «세 시에 치과»  
  atteso: title: "치과", start: "15:00"  
  ora con numero nativo a parole («세 시»): numberWords() gira DOPO suffixTimes(), così «세 시에» diventa «3 시에» ma non un orario (e «시» finisce fra le unità ore). Correzione: in canonicalize() chiamare numberWords prima di suffixTimes. L'attesa 15:00 segue l'uso coreano (le 3 senza qualificatore = pomeriggio); 03:00 sarebbe comunque accettabile

## Polski (pl) — 37 frasi, 2 limiti noti

- «Wyjazd na Mazury w piątek przypomnij dzień wcześniej»  
  atteso: title: "Wyjazd", date: "wd:5", loc: "Mazury", rem: 1440  
  «dzień wcześniej» senza numero → la regola before in guarded() vuole «N unità»; servirebbe un «un giorno» come halfHour/oneHour
- «Pociąg do Gdańska w sobotę o 8 rano»  
  atteso: title: "Pociąg do Gdańska", titleIncludes: "do Gdańska", date: "wd:6", start: "08:00"  
  «do» (until) è sostituito con «fino al» anche se non seguito da una data; servirebbe «until» solo davanti a cifra/mese/giorno in rules()

## Português (pt) — 27 frasi, 1 limiti noti

- «Comic Con Experience no sábado às 10h»  
  atteso: titleIncludes: "Comic Con", people: [], date: "wd:6", start: "10:00"  
  «Con» (W.with del parser storico, anche maiuscolo) + parola maiuscola → persona «Experience», titolo «Comic». Vale per tutte le lingue (CCXP è l'evento reale di San Paolo).

## Русский (ru) — 34 frasi, 1 limiti noti

- «Созвон с Димой во вторник в половине девятого»  
  atteso: title: "Созвон", date: "wd:2", start: "08:30", people: ["Димой"]  
  «в половине девятого» = 8:30 (mezza PRIMA dell'ora, come «wpół do»); nessuna regola «half + ordinale» → ore -1:30

## ไทย (th) — 28 frasi, 1 limiti noti

- «ประชุมที่ถนนสุขุมวิท 24 กรุงเทพ วันพฤหัส บ่าย 2 โมง»  
  atteso: title: "ประชุม", loc: "ถนนสุขุมวิท 24 กรุงเทพ", date: "wd:4", start: "14:00"  
  indirizzo con numero civico (è la forma della sampleFull del pacchetto): cjkPlace() per th prende dopo «ที่» solo fino al primo spazio, quindi il luogo è «ถนนสุขุมวิท» e «24 กรุงเทพ» resta nel titolo. Correzione: proseguire il gruppo con (?:\s+\d+[^\s]*)?(?:\s+[\p{Script=Thai}]+)? quando il seguito non è una parola chiave

## Türkçe (tr) — 35 frasi, 0 limiti noti


## Українська (uk) — 32 frasi, 0 limiti noti


## 中文 (zh) — 28 frasi, 2 limiti noti

- «三点半看牙医»  
  atteso: title: "看牙医", start: "15:30"  
  numero cinese a parole davanti a 点: numberWords() gira DOPO suffixTimes(), «三点半» → «3 点 mezza» ma non un orario. Correzione: numberWords prima di suffixTimes in canonicalize()
- «3天后取快递»  
  atteso: title: "取快递", date: "+3"  
  «3天后» (tra 3 giorni): in guarded() le unità usano altPlain()+LA e «天» seguito da «后» (lettera) non supera il confine, quindi niente «3 giorni» e niente «tra». Stesso problema per «2周后». Correzione: per le lingue noSpaces usare (?![\p{N}]) al posto di LA nelle regole delle unità, lasciando «后» alla regola `in` di postpositions()
