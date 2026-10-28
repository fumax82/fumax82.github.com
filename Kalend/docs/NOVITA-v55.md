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

## 2. Da fare nella parte nativa (Fase 2 del piano)
* `User-Agent` con nome, versione e contatto (es. `Kalend/55 (+https://…; email)`):
  MET Norway lo richiede per identificare l'app; oggi il nativo invia `Kalend/1.0`.

## Cosa NON è cambiato
Grafica, viste, cielo vivo, parser, tag, calendari, widget: identici alla v54.
