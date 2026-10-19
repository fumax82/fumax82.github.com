package com.ric.navigatore.guida

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.media.AudioAttributes
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.speech.tts.TextToSpeech
import com.ric.navigatore.MainActivity
import com.ric.navigatore.R
import com.ric.navigatore.Servizi
import com.ric.navigatore.nucleo.modello.Esito
import com.ric.navigatore.nucleo.modello.Manovra
import com.ric.navigatore.nucleo.modello.Percorso
import com.ric.navigatore.nucleo.modello.Vincolo
import com.ric.navigatore.nucleo.modello.Viaggio
import com.ric.navigatore.nucleo.modello.formattaDistanza
import com.ric.navigatore.nucleo.geo.Pericoli
import com.ric.navigatore.nucleo.navigazione.Annunciatore
import com.ric.navigatore.nucleo.navigazione.AvvisoStrada
import com.ric.navigatore.nucleo.navigazione.GestoreAnteprima
import com.ric.navigatore.nucleo.navigazione.RicercaSulPercorso
import com.ric.navigatore.nucleo.navigazione.SorveglianzaPericoli
import com.ric.navigatore.nucleo.navigazione.Decisione
import com.ric.navigatore.nucleo.navigazione.Inseguitore
import com.ric.navigatore.nucleo.navigazione.PoliticaRicalcolo
import com.ric.navigatore.nucleo.navigazione.Rilevamento
import com.ric.navigatore.nucleo.navigazione.Segnale
import com.ric.navigatore.nucleo.navigazione.StatoGuida
import com.ric.navigatore.nucleo.navigazione.ViaggioResiduo
import com.ric.navigatore.nucleo.pianificazione.Contesto
import com.ric.navigatore.nucleo.validazione.Rapporto
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Locale

/** Ciò che la schermata di guida mostra (condiviso fra servizio e interfaccia). */
data class StatoNavigazione(
    val attiva: Boolean = false,
    val viaggio: Viaggio? = null,
    val percorso: Percorso? = null,
    val guida: StatoGuida? = null,
    val posizione: Location? = null,
    val segnale: Segnale = Segnale.ASSENTE,
    /** Avviso importante da mostrare in alto (GPS perso, ricalcolo non riuscito…). */
    val avviso: String? = null,
    val ricalcolo: Boolean = false,
    val rapporto: Rapporto? = null,
    val voce: Boolean = true,
    val ricalcoli: Int = 0,
    /** Manovra di cui mostrare l'anteprima dell'incrocio (in alto), se c'è. */
    val anteprima: Manovra? = null,
    /** Avvisi per tornanti e pendenze attivi adesso. */
    val avvisiStrada: List<AvvisoStrada> = emptyList(),
    /** Esplorazione del percorso (pannello in basso), se aperta. */
    val esplorazione: Esplorazione? = null,
    /** Vero mentre l'utente modifica i vincoli (evita / passa da) durante la guida. */
    val modifica: Boolean = false,
)

/**
 * Esplorazione del percorso durante la guida: la mappa smette di seguire
 * l'auto e si centra sul punto del percorso scelto (col cursore o con la
 * ricerca a voce).
 */
data class Esplorazione(
    /** Metri dalla partenza del percorso del punto mostrato. */
    val progressiva: Double,
    /** Cosa è stato trovato, es. "Svolta a destra su Via Roma · tra 37 km". */
    val descrizione: String? = null,
    /** Avvertenze o errori della ricerca. */
    val nota: String? = null,
    val cercando: Boolean = false,
    /** Ultima frase cercata (detta o scritta). */
    val frase: String = "",
)

/** Comandi che la schermata può dare al servizio di guida. */
interface ComandiGuida {
    fun nascondiAnteprima()
    /** Ricalcola subito dalla posizione attuale (dopo una modifica dei vincoli). */
    fun ricalcolaOra(): Boolean
}

/** Ponte fra la schermata e il servizio di guida. */
object GuidaCondivisa {
    private val _stato = MutableStateFlow(StatoNavigazione())
    val stato: StateFlow<StatoNavigazione> = _stato

    internal fun aggiorna(f: (StatoNavigazione) -> StatoNavigazione) { _stato.value = f(_stato.value) }

    /** Avvia la guida sul percorso indicato. */
    fun avvia(context: Context, viaggio: Viaggio, percorso: Percorso, rapporto: Rapporto?) {
        _stato.value = StatoNavigazione(
            attiva = true, viaggio = viaggio, percorso = percorso, rapporto = rapporto,
            voce = Servizi.archivio.dati.impostazioni.voce,
        )
        val i = Intent(context, ServizioGuida::class.java)
        context.startForegroundService(i)
    }

    fun termina(context: Context) {
        context.stopService(Intent(context, ServizioGuida::class.java))
        _stato.value = StatoNavigazione()
    }

    fun voce(attiva: Boolean) {
        aggiorna { it.copy(voce = attiva) }
    }

    /** Collegamento al servizio in corso (impostato dal servizio stesso). */
    internal var comandi: ComandiGuida? = null

    fun nascondiAnteprima() {
        comandi?.nascondiAnteprima()
        aggiorna { it.copy(anteprima = null) }
    }

    // ---------------- Esplorazione del percorso ----------------

    /** Apre l'esplorazione sul punto [progressiva] (di solito: dove sono adesso). */
    fun esplora(progressiva: Double? = null) = aggiorna {
        val s = progressiva ?: it.guida?.progressiva ?: 0.0
        it.copy(esplorazione = (it.esplorazione ?: Esplorazione(s)).copy(progressiva = s))
    }

    /** Sposta il punto esplorato (cursore lungo il percorso). */
    fun spostaEsplorazione(progressiva: Double) = aggiorna {
        it.copy(esplorazione = it.esplorazione?.copy(progressiva = progressiva, descrizione = null, nota = null))
    }

    fun chiudiEsplorazione() = aggiorna { it.copy(esplorazione = null) }

    /** Mostra un'avvertenza nel pannello di esplorazione. */
    fun notaEsplorazione(testo: String) = aggiorna {
        it.copy(esplorazione = (it.esplorazione ?: Esplorazione(it.guida?.progressiva ?: 0.0)).copy(nota = testo))
    }

    /**
     * Cerca un punto LUNGO IL PERCORSO ATTUALE a partire da una frase
     * (detta o scritta), es. "prima dell'uscita per Bologna".
     * Si cerca solo nella parte di percorso ancora da fare.
     */
    fun cerca(frase: String, ambito: CoroutineScope) {
        val st = _stato.value
        val percorso = st.percorso ?: return
        val da = st.guida?.progressiva ?: 0.0
        val base = (st.esplorazione ?: Esplorazione(da)).copy(frase = frase, nota = null, descrizione = null)
        val domanda = RicercaSulPercorso.interpreta(frase)
        if (domanda == null) {
            aggiorna { it.copy(esplorazione = base.copy(nota = "Non ho capito cosa cercare. Prova con «prima dell'uscita per Bologna» o «prima di Roma».")) }
            return
        }
        // 1) fra le indicazioni del percorso (nessuna richiesta in rete)
        RicercaSulPercorso.cercaNelleIndicazioni(domanda, percorso, da)?.let { t ->
            aggiorna { it.copy(esplorazione = base.copy(progressiva = t.progressiva, descrizione = t.descrizione, nota = t.nota)) }
            return
        }
        // 2) cerco il luogo per nome e prendo il punto del percorso che gli corrisponde
        val geo = Servizi.geocodifica
        if (geo == null) {
            aggiorna { it.copy(esplorazione = base.copy(nota = "«${domanda.nomeLeggibile}» non compare nelle indicazioni del percorso e manca un servizio di ricerca (Impostazioni).")) }
            return
        }
        aggiorna { it.copy(esplorazione = base.copy(cercando = true)) }
        ambito.launch {
            val esito = withContext(Dispatchers.IO) { geo.cerca(domanda.nome, st.guida?.puntoSulPercorso) }
            val nuova = when (esito) {
                is Esito.Errore -> base.copy(nota = "Ricerca non riuscita: ${esito.messaggio}")
                is Esito.Ok -> if (esito.valore.isEmpty()) base.copy(nota = "Non trovo «${domanda.nomeLeggibile}».") else {
                    val i = RicercaSulPercorso.piuVicinoAlPercorso(esito.valore.map { it.punto }, percorso, da)
                    val r = esito.valore[i]
                    val t = RicercaSulPercorso.vicinoAlLuogo(domanda, percorso, da, r.punto, r.nome.ifBlank { domanda.nomeLeggibile })
                    base.copy(progressiva = t.progressiva, descrizione = t.descrizione, nota = t.nota)
                }
            }
            aggiorna { it.copy(esplorazione = nuova) }
        }
    }

    // ---------------- Modifica dei vincoli durante la guida ----------------

    fun iniziaModifica() = aggiorna { it.copy(modifica = true) }

    fun annullaModifica() = aggiorna { it.copy(modifica = false) }

    /**
     * Applica alla guida i vincoli modificati e ricalcola dalla posizione
     * attuale. Restituisce un messaggio per l'utente.
     */
    fun applicaVincoli(vincoli: List<Vincolo>): String {
        aggiorna { it.copy(modifica = false, esplorazione = null, viaggio = it.viaggio?.copy(vincoli = vincoli)) }
        return if (comandi?.ricalcolaOra() == true) "Ricalcolo il percorso con le modifiche…"
        else "Le modifiche saranno usate appena il GPS dà la posizione."
    }
}

/**
 * Servizio "in primo piano" della guida.
 *
 * Android permette di leggere il GPS a schermo spento solo a un servizio in
 * primo piano con notifica fissa: è il meccanismo corretto (niente trucchi).
 * Qui avviene la navigazione vera e propria:
 *   GPS → [Inseguitore] (posizione sul percorso, prossima svolta, uscita dal percorso)
 *       → [Annunciatore] (frasi) → sintesi vocale di Android
 *       → [PoliticaRicalcolo] → nuovo calcolo che mantiene TUTTE le esclusioni.
 */
class ServizioGuida : Service(), TextToSpeech.OnInitListener {
    private val ambito = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private lateinit var lm: LocationManager
    private var tts: TextToSpeech? = null
    private var ttsPronta = false
    private var inseguitore: Inseguitore? = null
    private val annunciatore = Annunciatore()
    private val anteprime = GestoreAnteprima()
    private var sorveglianza: SorveglianzaPericoli? = null
    /** Una modifica dei vincoli è arrivata durante un ricalcolo: ricalcolare di nuovo alla fine. */
    private var ricalcoloPendente = false
    private val politica = PoliticaRicalcolo()
    private var fuoriDa: Long? = null
    private var ricalcoloInCorso = false
    private var gpsPersoAnnunciato = false
    private var arrivoAnnunciato = false
    private var ultimaNotifica = 0L
    private var ultimaPosizione: Location? = null
    private val orologio = Handler(Looper.getMainLooper())

    companion object {
        private const val CANALE = "guida"
        private const val ID_NOTIFICA = 1
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        lm = getSystemService(LocationManager::class.java)
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CANALE, "Guida in corso", NotificationManager.IMPORTANCE_LOW))
        tts = TextToSpeech(this, this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notifica = notifica("Guida avviata", "In attesa del GPS…")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(ID_NOTIFICA, notifica, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        } else {
            startForeground(ID_NOTIFICA, notifica)
        }
        GuidaCondivisa.stato.value.percorso?.let(::nuovoPercorso)
        GuidaCondivisa.comandi = object : ComandiGuida {
            override fun nascondiAnteprima() = anteprime.nascondi()
            override fun ricalcolaOra(): Boolean {
                val l = ultimaPosizione ?: return false
                if (ricalcoloInCorso) ricalcoloPendente = true else ricalcola(l.comeRilevamento())
                return true
            }
        }
        avviaGps()
        orologio.post(controlloPeriodico)
        return START_NOT_STICKY
    }

    /** Prepara la guida su un percorso (all'avvio e dopo ogni ricalcolo). */
    private fun nuovoPercorso(p: Percorso) {
        inseguitore = Inseguitore(p)
        val imp = Servizi.archivio.dati.impostazioni
        // tornanti e pendenze: calcolati una volta per tutto il percorso
        sorveglianza = if (imp.avvisiStrada) SorveglianzaPericoli(Pericoli.analizza(p, imp.sogliaPendenza.toDouble())) else null
    }

    override fun onDestroy() {
        GuidaCondivisa.comandi = null
        orologio.removeCallbacks(controlloPeriodico)
        lm.removeUpdates(ascoltatore)
        tts?.stop()
        tts?.shutdown()
        ambito.cancel()
        super.onDestroy()
    }

    // ------------------------------------------------------------------
    // Voce
    // ------------------------------------------------------------------

    override fun onInit(status: Int) {
        val t = tts ?: return
        if (status == TextToSpeech.SUCCESS) {
            val esito = t.setLanguage(Locale.ITALIAN)
            ttsPronta = esito != TextToSpeech.LANG_MISSING_DATA && esito != TextToSpeech.LANG_NOT_SUPPORTED
            t.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build(),
            )
            if (!ttsPronta) GuidaCondivisa.aggiorna { it.copy(avviso = "Voce italiana non installata: le indicazioni saranno solo scritte.") }
        }
    }

    /** Pronuncia una frase. Con [accoda] aspetta la fine della frase in corso invece di interromperla. */
    private fun parla(frase: String, accoda: Boolean = false) {
        if (!GuidaCondivisa.stato.value.voce || !ttsPronta) return
        tts?.speak(frase, if (accoda) TextToSpeech.QUEUE_ADD else TextToSpeech.QUEUE_FLUSH, Bundle(), frase.hashCode().toString())
    }

    // ------------------------------------------------------------------
    // GPS
    // ------------------------------------------------------------------

    private val ascoltatore = object : LocationListener {
        override fun onLocationChanged(location: Location) = nuovaPosizione(location)
        override fun onProviderDisabled(provider: String) {
            GuidaCondivisa.aggiorna { it.copy(avviso = "Il GPS del telefono è spento: riaccendilo per continuare la guida.") }
            parla("Il GPS è spento")
        }
        override fun onProviderEnabled(provider: String) {
            GuidaCondivisa.aggiorna { it.copy(avviso = null) }
        }
    }

    @SuppressLint("MissingPermission")
    private fun avviaGps() {
        try {
            // una lettura al secondo, senza filtro di distanza: serve precisione
            lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, ascoltatore, Looper.getMainLooper())
        } catch (e: SecurityException) {
            GuidaCondivisa.aggiorna { it.copy(avviso = "Manca il permesso di posizione.") }
        } catch (e: IllegalArgumentException) {
            GuidaCondivisa.aggiorna { it.copy(avviso = "Questo telefono non ha il GPS.") }
        }
    }

    private fun nuovaPosizione(l: Location) {
        ultimaPosizione = l
        val ins = inseguitore ?: return
        val r = l.comeRilevamento()
        val g = ins.aggiorna(r)
        if (gpsPersoAnnunciato && g.segnale == Segnale.BUONO) {
            gpsPersoAnnunciato = false
            parla("Segnale GPS ritrovato")
        }
        // anteprima dell'incrocio e avvisi per tornanti e pendenze
        val imp = Servizi.archivio.dati.impostazioni
        val anteprima = if (imp.anteprimaIncroci) anteprime.aggiorna(g, r.velocita) else null
        val (avvisiStrada, frasePericolo) = if (g.fuoriPercorso || g.arrivato) emptyList<AvvisoStrada>() to null
            else sorveglianza?.aggiorna(g.progressiva, r.velocita) ?: (emptyList<AvvisoStrada>() to null)
        GuidaCondivisa.aggiorna {
            it.copy(
                anteprima = anteprima, avvisiStrada = avvisiStrada,
                guida = g, posizione = l, segnale = g.segnale,
                avviso = when {
                    g.segnale == Segnale.DEBOLE -> "Segnale GPS debole (precisione ${r.accuratezza.toInt()} m)"
                    it.avviso?.startsWith("Segnale GPS") == true -> null
                    else -> it.avviso
                },
            )
        }

        // Annunci
        g.tappaAppenaRaggiunta?.let { parla("Hai raggiunto la tappa") }
        if (g.arrivato && !arrivoAnnunciato) {
            arrivoAnnunciato = true
            parla("Sei arrivato a destinazione")
        } else if (!g.arrivato && !g.fuoriPercorso) {
            annunciatore.frase(g, r.velocita)?.let { parla(it) }
            frasePericolo?.let { parla(it, accoda = true) }
        }

        // Uscita dal percorso -> ricalcolo (con attesa e limiti)
        if (g.fuoriPercorso && !g.arrivato) {
            if (fuoriDa == null) {
                fuoriDa = r.tempo
                parla("Sei uscito dal percorso")
            }
            valutaRicalcolo(r)
        } else {
            fuoriDa = null
        }
        aggiornaNotifica(g)
    }

    /** Ogni 2 secondi: controlla se il GPS tace. */
    private val controlloPeriodico = object : Runnable {
        override fun run() {
            val ins = inseguitore
            if (ins != null && ins.segnale(System.currentTimeMillis()) == Segnale.ASSENTE) {
                GuidaCondivisa.aggiorna { it.copy(segnale = Segnale.ASSENTE, avviso = "Segnale GPS perso: la posizione mostrata potrebbe non essere aggiornata.") }
                if (!gpsPersoAnnunciato && ultimaPosizione != null) {
                    gpsPersoAnnunciato = true
                    parla("Segnale GPS perso")
                }
            }
            orologio.postDelayed(this, 2000)
        }
    }

    // ------------------------------------------------------------------
    // Ricalcolo
    // ------------------------------------------------------------------

    private fun valutaRicalcolo(r: Rilevamento) {
        if (ricalcoloInCorso) return
        val adesso = System.currentTimeMillis()
        when (val d = politica.decidi(adesso, fuoriDa ?: adesso)) {
            is Decisione.Attendi -> GuidaCondivisa.aggiorna { it.copy(avviso = d.motivo) }
            Decisione.Procedi -> {
                if (!Servizi.rete.value) {
                    GuidaCondivisa.aggiorna { it.copy(avviso = "Fuori percorso e senza connessione: impossibile ricalcolare. Il percorso precedente resta visibile.") }
                    politica.registra(adesso) // riproveremo più tardi senza insistere
                    return
                }
                politica.registra(adesso)
                ricalcola(r)
            }
        }
    }

    private fun ricalcola(r: Rilevamento) {
        val stato = GuidaCondivisa.stato.value
        val viaggio = stato.viaggio ?: return
        val percorso = stato.percorso ?: return
        val raggiunti = stato.guida?.puntiRaggiunti ?: emptySet()
        ricalcoloInCorso = true
        GuidaCondivisa.aggiorna { it.copy(ricalcolo = true, avviso = "Ricalcolo del percorso…") }
        parla("Ricalcolo")
        ambito.launch {
            // Viaggio residuo: tappe già raggiunte tolte, TUTTE le esclusioni mantenute
            val residuo = ViaggioResiduo.calcola(viaggio, percorso, raggiunti, r)
            val esito = withContext(Dispatchers.IO) {
                Servizi.nuovoPianificatore().calcola(residuo, Contesto(direzioneIniziale = r.direzione))
            }
            ricalcoloInCorso = false
            val nuovo = esito.percorso
            if (nuovo != null) {
                nuovoPercorso(nuovo)
                fuoriDa = null
                GuidaCondivisa.aggiorna {
                    it.copy(
                        viaggio = residuo, percorso = nuovo, rapporto = esito.rapporto, ricalcolo = false,
                        avviso = if (esito.preferitiNonRispettati.isEmpty()) null else "Ricalcolato: alcuni vincoli preferiti non sono rispettati.",
                        ricalcoli = it.ricalcoli + 1,
                    )
                }
                parla("Percorso ricalcolato")
            } else {
                val motivo = esito.errore?.messaggio ?: esito.conflitti.firstOrNull()?.messaggio ?: "errore sconosciuto"
                GuidaCondivisa.aggiorna { it.copy(ricalcolo = false, avviso = "Ricalcolo non riuscito: $motivo") }
            }
            // vincoli cambiati mentre si ricalcolava: si ricalcola ancora con quelli nuovi
            if (ricalcoloPendente) {
                ricalcoloPendente = false
                ultimaPosizione?.let { ricalcola(it.comeRilevamento()) }
            }
        }
    }

    // ------------------------------------------------------------------
    // Notifica fissa
    // ------------------------------------------------------------------

    private fun notifica(titolo: String, testo: String): Notification {
        val apri = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE,
        )
        return Notification.Builder(this, CANALE)
            .setSmallIcon(R.drawable.ic_notifica)
            .setContentTitle(titolo)
            .setContentText(testo)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(apri)
            .build()
    }

    private fun aggiornaNotifica(g: StatoGuida) {
        val adesso = System.currentTimeMillis()
        if (adesso - ultimaNotifica < 3000) return
        ultimaNotifica = adesso
        val titolo = g.manovra?.let { "${formattaDistanza(g.distanzaManovra)} · ${it.istruzione}" } ?: "Guida in corso"
        val testo = "Mancano ${formattaDistanza(g.distanzaResidua)}" + if (g.fuoriPercorso) " · fuori percorso" else ""
        getSystemService(NotificationManager::class.java).notify(ID_NOTIFICA, notifica(titolo, testo))
    }
}
