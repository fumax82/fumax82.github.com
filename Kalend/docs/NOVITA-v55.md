# Kalend v55 — cosa è cambiato e perché

## 1. Meteo per tutto il mondo, senza vincoli commerciali
Fino alla v54 il meteo arrivava da Open‑Meteo, gratuito solo per uso non
commerciale. Ora (`src/modules/70-weather.js`):

* **Di serie: MET Norway.** Istituto meteorologico norvegese, copertura mondiale
  (modello europeo ECMWF), nessuna chiave, uso commerciale ammesso (NLOD 2.0 /
  CC BY 4.0). Circa 10 giorni. Attribuzione «Data from MET Norway» nei crediti.
* **Con la tua chiave: Open‑Meteo o OpenWeatherMap.** Chi vuole 16 giorni e più
  modelli, o preferisce OpenWeatherMap (piano gratuito con registrazione), crea
  da solo l'account presso il fornitore e incolla la chiave in Impostazioni →
  Funzionalità → Fonte del meteo. Prima di attivarla accetta la dicitura: servizio
  di terzi, a loro termini e costi, Kalend non ne è parte. La chiave sta **cifrata
  nel telefono** (AES‑256‑GCM, chiave non estraibile) e non entra mai in backup,
  esportazioni o sincronizzazione.
* **Nessun meteo.** Cielo, sole e luna calcolati nel telefono: niente esce dal telefono.
* **Cambio di fonte senza perdere nulla**: ogni fornitore viene tradotto nello
  stesso modello interno (codici WMO, temperatura, pioggia, nuvole, vento), quindi
  icone, cielo vivo e particelle restano identici.
* **Cache persistente e storico visto**: una richiesta per luogo copre ~10 giorni
  e si salva in IndexedDB; i giorni passati (fino a 60) mostrano l'ultima
  previsione vista. Richieste in coda, una alla volta, coordinate a ~1 km.
* **Chiave rifiutata o quota finita** → per quella sessione si torna alla base e lo
  si dice una volta. **Senza rete** → ultima previsione in cache, poi solo cielo.
* **Unità per paese**: °F negli USA, Bahamas, Belize, Cayman, Liberia, Palau,
  Micronesia, Isole Marshall; scelta manuale °C/°F nelle impostazioni.
* La chiave Open‑Meteo eventualmente inserita nella v54 viene spostata
  automaticamente nella cassaforte e tolta dalle impostazioni.

Collaudo: `node Kalend/tools/wx-test.js` (risposte simulate dei tre fornitori:
forma dei dati, cache, chiave rifiutata, cassaforte, unità, crediti, migrazione).
**Limite**: la rete di sviluppo non raggiunge i server veri; al primo avvio sul
telefono verificare che MET Norway risponda (la scheda meteo mostra la fonte).

## 2. Luoghi: la maggior parte delle ricerche non esce dal telefono
Un luogo scritto diventa coordinate passando per strati, dal più economico
(`src/modules/80-geo.js`):

1. **coordinate scritte** («45.46, 9.19»);
2. **memoria**: i luoghi già risolti restano nel telefono (400 voci);
3. **atlante offline**: ~24.000 città del mondo con almeno 15.000 abitanti
   (`www/data/cities.json`, da GeoNames CC BY 4.0, generato da
   `tools/build-atlas.py`): «Milan», «Paris, Francia», «Springfield, US» (la più
   popolosa), accenti e maiuscole ignorati; l'autocompletamento propone le città
   per prefisso, ordinate per abitanti, senza rete. I nomi sono in inglese: un
   nome locale («Milano», «東京») passa una volta dalla rete e poi resta in memoria;
4. **Geocoder di Android** tramite il ponte nativo (metodo `geocode`, da aggiungere
   nella Fase 2);
5. **chiave personale** dell'utente, se ha scelto Open‑Meteo o OpenWeatherMap per
   il meteo (la loro geocodifica è inclusa);
6. **Photon** (komoot, dati OpenStreetMap, ODbL) per gli indirizzi: senza chiave,
   «uso corretto», poche richieste grazie agli strati precedenti.

Nominatim e Open‑Meteo gratuito non vengono più interrogati. Crediti aggiornati.
Collaudo: `node Kalend/tools/geo-test.js`.

## 3. Festività: tutte nel telefono, indicative, personalizzabili
Nager.Date non viene più interrogato (`src/modules/31-holidays.js`):

* regole per i paesi che mancavano: Filippine, Nigeria, Kenya, Ghana, Venezuela,
  Ecuador, Guatemala, Cuba, Bolivia, Rep. Dominicana, Honduras, Paraguay, El Salvador,
  Nicaragua, Costa Rica, Panama, Uruguay, Porto Rico, Monaco, Senegal, Costa d'Avorio,
  Tunisia, Algeria, Liechtenstein, Angola, Mozambico, Suriname, Bielorussia,
  Kazakistan, Iraq, Giordania, Libano, Kuwait, Qatar, Bahrein, Oman, Siria, Libia,
  Sudan, Yemen, Palestina, Macao; versioni migliorate per USA, Regno Unito, Irlanda,
  Giappone, Australia, Nuova Zelanda, Canada, Sudafrica, Hong Kong, India;
* **giorni sostitutivi**: USA (sabato→venerdì, domenica→lunedì), Regno Unito,
  Australia, Canada, Nuova Zelanda (fine settimana→primo feriale libero), Giappone
  振替休日, Sudafrica e Hong Kong (domenica→lunedì). La festa resta nel suo giorno e
  si aggiunge il sostitutivo;
* feste lunari, islamiche ed ebraiche calcolate (ora funzionano davvero: nella v54
  l'aggancio non raggiungeva il codice del sorgente storico); Diwali, Holi, Dussehra,
  Matariki da tabella ufficiale 2025–2032;
* scheda **Festività del paese** (Impostazioni → Lingua e paese): elenco dell'anno,
  tocca per nascondere o mostrare, aggiungi una festa propria, ripristina;
  dicitura «indicative: controlla le fonti ufficiali».

Collaudo: `node Kalend/tools/hol-test.js` (date note del 2026 per 20 paesi).

## 4. Testi legali, informative sui permessi, CSP
* **Termini d'uso e Informativa sulla privacy in 20 lingue** (`src/legal/*.json`):
  licenza, dati solo sul dispositivo, servizi di terzi a loro termini, natura
  indicativa delle informazioni, responsabilità nei limiti di legge, diritti dei
  consumatori, legge applicabile; privacy con l'elenco esatto di ciò che esce dal
  telefono e verso chi. I dati del venditore stanno in `src/legal/seller.json` e
  vengono inseriti al build. **Da far rileggere a un professionista.**
* Pagina **Informazioni legali** (Impostazioni → Aiuto): Termini, Privacy, Crediti
  (con le attribuzioni della fonte meteo e dei luoghi in uso).
* **Avviso una tantum** dopo l'aggiornamento dei testi, non bloccante.
* **Informative prima dei permessi** (posizione, microfono, calendario del telefono,
  notifiche): schermata breve nella lingua dell'app con cosa serve, a cosa e cosa
  esce dal telefono; «Non ora» non interroga il sistema. Valgono anche per la
  richiesta di posizione all'avvio e aspettano la chiusura del sipario di benvenuto.
* **Pagine web** `legal/privacy-<lingua>.html` e `terms-<lingua>.html`
  (`tools/build-legal.js`), da pubblicare per l'indirizzo richiesto da Google Play.
* **CSP ristretta**: la pagina può contattare solo gli host dei servizi (MET Norway,
  Open‑Meteo con chiave, OpenWeatherMap, Photon); `--web` per la versione browser.

Collaudo: `node Kalend/tools/legal-test.js`.

## 5. Da fare nella parte nativa (Fase 2 del piano)
* `User-Agent` con nome, versione e contatto (es. `Kalend/55 (+https://…; email)`):
  MET Norway lo richiede per identificare l'app; oggi il nativo invia `Kalend/1.0`.
* Metodo `geocode(id, testo, lingua)` nel ponte, con `android.location.Geocoder`,
  che risponde via `__knCb` con `[{name, display, lat, lon}]`: la pagina lo usa
  già se c'è.

## Cosa NON è cambiato
Grafica, viste, cielo vivo, parser, tag, calendari, widget: identici alla v54.
