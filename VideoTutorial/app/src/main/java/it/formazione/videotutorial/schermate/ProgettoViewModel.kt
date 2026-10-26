/*
 * ProgettoViewModel.kt
 * Il "cervello" dell'app: contiene tutti i dati mostrati sullo schermo e
 * tutte le operazioni (scegliere cartella e video, catturare foto, commenti,
 * scorrimento del video, audio, fine lavoro).
 *
 * Le schermate si limitano a mostrare questi dati e a chiamare queste funzioni.
 * Ogni cambiamento al progetto passa dalla funzione modifica(), che aggiorna
 * i dati e riscrive indice.json e tutorial_input.md.
 */
package it.formazione.videotutorial.schermate

import android.app.Application
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import androidx.annotation.OptIn
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.SeekParameters
import androidx.work.WorkInfo
import androidx.work.WorkManager
import it.formazione.videotutorial.archivio.CartellaFormazione
import it.formazione.videotutorial.archivio.ImprontaVideo
import it.formazione.videotutorial.archivio.NomiFile
import it.formazione.videotutorial.archivio.Preferenze
import it.formazione.videotutorial.media.EstrattoreFotogrammi
import it.formazione.videotutorial.media.GeneratoreMiniature
import it.formazione.videotutorial.media.LavoroEstrazioneAudio
import it.formazione.videotutorial.modello.Passo
import it.formazione.videotutorial.modello.ProgettoVideo
import it.formazione.videotutorial.modello.SchedaVideo
import it.formazione.videotutorial.modello.StatoAudio
import it.formazione.videotutorial.modello.TipoPasso
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.LocalDate
import java.util.UUID
import kotlin.math.abs
import kotlin.math.roundToLong

/** Le tre schermate dell'app. */
enum class Schermata { HOME, SCHEDA, PLAYER }

/** Video appena scelto, in attesa che l'utente compili la scheda. */
data class VideoScelto(
    val uri: Uri,
    val nomeFile: String,
    val impronta: String,
    val durataMs: Long,
)

@OptIn(UnstableApi::class)
class ProgettoViewModel(applicazione: Application) : AndroidViewModel(applicazione) {

    companion object {
        /** Oltre questo numero di foto l'app avvisa (ogni foto costa risorse a Claude). */
        const val SOGLIA_FOTO = 25

        /** Fino a questa velocità il video scorre in avanti riproducendo; oltre, a salti. */
        const val VELOCITA_MAX_RIPRODUZIONE = 4f

        /** Ogni quanti millisecondi si fa un salto durante lo scorrimento veloce. */
        const val INTERVALLO_SALTI_MS = 40L

        /** Fotogrammi al secondo da usare se il video non lo dice. */
        const val FPS_PREDEFINITI = 30f
    }

    private val contesto: Application get() = getApplication()
    private val preferenze = Preferenze(applicazione)
    private val estrattore = EstrattoreFotogrammi(applicazione)

    // ---------------------------------------------------------------------
    // Dati mostrati sullo schermo (ogni cambiamento aggiorna l'interfaccia)
    // ---------------------------------------------------------------------

    var schermata by mutableStateOf(Schermata.HOME)
        private set

    /** Cartella condivisa "Formazione" (null se non ancora scelta). */
    var cartella by mutableStateOf<CartellaFormazione?>(null)
        private set

    /** true mentre l'app lavora (es. calcolo dell'impronta): mostra una rotellina. */
    var occupato by mutableStateOf(false)
        private set

    /** Messaggio breve da mostrare all'utente (poi si cancella). */
    var messaggio by mutableStateOf<String?>(null)
        private set

    var videoScelto by mutableStateOf<VideoScelto?>(null)
        private set

    /** Progetto aperto nel lettore. */
    var progetto by mutableStateOf<ProgettoVideo?>(null)
        private set

    /** Lettore video. */
    var player by mutableStateOf<ExoPlayer?>(null)
        private set

    var inRiproduzione by mutableStateOf(false)
        private set

    /** Velocità attuale della barra di scorrimento (negativa = indietro, 0 = ferma). */
    var velocitaScorrimento by mutableStateOf(0f)
        private set

    /** Foto catturate che si stanno ancora salvando in sottofondo. */
    var fotoInSalvataggio by mutableIntStateOf(0)
        private set

    /** Miniature dell'intero video per la striscia di anteprime (null = non ancora pronta). */
    val miniature = mutableStateListOf<ImageBitmap?>()

    /** Ogni quanti millisecondi c'è una miniatura. */
    var intervalloMiniatureMs by mutableLongStateOf(GeneratoreMiniature.INTERVALLO_MINIMO_MS)
        private set

    /** Passo di cui è aperta la finestra del commento (null = finestra chiusa). */
    var passoInCommento by mutableStateOf<String?>(null)
        private set

    /** true se la finestra del commento è per una foto appena catturata (dettatura automatica). */
    var commentoDiNuovaFoto by mutableStateOf(false)
        private set

    /** Segnalibro che si sta spostando (null = nessuno). */
    var passoInSpostamento by mutableStateOf<String?>(null)
        private set

    /** Progetti presenti nella cartella condivisa (elenco della Home). */
    var progettiSalvati by mutableStateOf<List<ProgettoVideo>>(emptyList())
        private set

    /** true mentre si legge l'elenco dei progetti. */
    var caricamentoProgetti by mutableStateOf(false)
        private set

    /** true quando la Home deve far scegliere di nuovo il video (non più raggiungibile). */
    var richiestaSceltaVideo by mutableStateOf(false)
        private set

    /** true se è aperta la finestra "Termina". */
    var finestraTermina by mutableStateOf(false)
        private set

    // ---------------------------------------------------------------------
    // Variabili interne
    // ---------------------------------------------------------------------

    private var osservatoreAudio: Job? = null
    private var lavoroSalti: Job? = null
    private var lavoroMiniature: Job? = null
    private var posizioneVirtualeMs = 0.0

    /**
     * Coda delle operazioni sui file (salvare foto, rinominarle, scrivere
     * indice.json...). Vengono eseguite in sottofondo, una alla volta e
     * nell'ordine in cui sono state chieste: così lo schermo non aspetta mai.
     */
    private val codaFile = Channel<suspend () -> Unit>(Channel.UNLIMITED)

    init {
        // Riprende la cartella scelta l'ultima volta
        preferenze.uriCartella?.let { uri ->
            val c = CartellaFormazione(contesto, uri)
            if (c.accessibile()) cartella = c
        }
        // Esecuzione della coda dei file, un'operazione dopo l'altra
        viewModelScope.launch(Dispatchers.IO) {
            for (operazione in codaFile) {
                try {
                    operazione()
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) { mostra("Errore nei file: ${e.message}") }
                }
            }
        }
    }

    // ---------------------------------------------------------------------
    // Messaggi
    // ---------------------------------------------------------------------

    private fun mostra(testo: String) {
        messaggio = testo
    }

    /** Chiamata dalla schermata dopo aver mostrato il messaggio. */
    fun messaggioMostrato() {
        messaggio = null
    }

    // ---------------------------------------------------------------------
    // Home: cartella condivisa e scelta del video
    // ---------------------------------------------------------------------

    /** L'utente ha scelto la cartella condivisa (uri null = ha annullato). */
    fun cartellaScelta(uri: Uri?) {
        if (uri == null) return
        try {
            contesto.contentResolver.takePersistableUriPermission(
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION,
            )
        } catch (e: SecurityException) {
            mostra("Permesso sulla cartella non ottenuto")
        }
        preferenze.uriCartella = uri
        cartella = CartellaFormazione(contesto, uri)
    }

    /**
     * L'utente ha scelto un video. Calcola l'impronta: se il video è già stato
     * elaborato riapre la sua cartella, altrimenti mostra la scheda.
     */
    fun videoSelezionato(uri: Uri?) {
        val c = cartella ?: return
        if (uri == null) return
        try {
            contesto.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        } catch (_: SecurityException) {
            // Alcune app non concedono il permesso permanente: il video si apre comunque.
        }
        occupato = true
        viewModelScope.launch {
            try {
                val (scelto, esistente) = withContext(Dispatchers.IO) {
                    val impronta = ImprontaVideo.calcola(contesto, uri)
                    val scelto = VideoScelto(
                        uri = uri,
                        nomeFile = nomeVisibile(uri),
                        impronta = impronta,
                        durataMs = EstrattoreFotogrammi.leggiDurataMs(contesto, uri),
                    )
                    scelto to c.cercaProgetto(impronta)
                }
                if (esistente != null) {
                    apriProgetto(esistente.copy(uriVideo = uri.toString(), nomeFileVideo = scelto.nomeFile))
                    mostra("Video già elaborato: riaperta la cartella ${esistente.nomeCartella}")
                } else {
                    videoScelto = scelto
                    schermata = Schermata.SCHEDA
                }
            } catch (e: Exception) {
                mostra("Impossibile aprire il video: ${e.message}")
            } finally {
                occupato = false
            }
        }
    }

    /** Nome del file (es. "pompa.mp4") a partire dal suo indirizzo. */
    private fun nomeVisibile(uri: Uri): String {
        contesto.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
            ?.use { cursore ->
                if (cursore.moveToFirst()) {
                    val nome = cursore.getString(0)
                    if (!nome.isNullOrBlank()) return nome
                }
            }
        return uri.lastPathSegment ?: "video"
    }

    // ---------------------------------------------------------------------
    // Scheda del video
    // ---------------------------------------------------------------------

    /** Valori iniziali della scheda: macchina, reparto e autore dell'ultima volta. */
    fun schedaIniziale(): SchedaVideo = SchedaVideo(
        titolo = "",
        macchina = preferenze.ultimaMacchina,
        reparto = preferenze.ultimoReparto,
        scopo = "",
        autore = preferenze.ultimoAutore,
        data = LocalDate.now().toString(),
    )

    /** L'utente ha confermato la scheda: crea la cartella e apre il lettore. */
    fun confermaScheda(scheda: SchedaVideo) {
        val v = videoScelto ?: return
        val c = cartella ?: return
        if (scheda.titolo.isBlank()) {
            mostra("Il titolo della procedura è obbligatorio")
            return
        }
        preferenze.ultimaMacchina = scheda.macchina.trim()
        preferenze.ultimoReparto = scheda.reparto.trim()
        preferenze.ultimoAutore = scheda.autore.trim()

        val pulita = scheda.copy(
            titolo = scheda.titolo.trim(),
            macchina = scheda.macchina.trim(),
            reparto = scheda.reparto.trim(),
            scopo = scheda.scopo.trim(),
            autore = scheda.autore.trim(),
            data = LocalDate.now().toString(),
        )
        occupato = true
        viewModelScope.launch {
            try {
                val nomeCartella = withContext(Dispatchers.IO) {
                    c.creaCartellaProgetto(NomiFile.nomeCartella(pulita.data, pulita.titolo))
                }
                apriProgetto(
                    ProgettoVideo(
                        impronta = v.impronta,
                        nomeCartella = nomeCartella,
                        uriVideo = v.uri.toString(),
                        nomeFileVideo = v.nomeFile,
                        durataMs = v.durataMs,
                        scheda = pulita,
                    )
                )
            } catch (e: Exception) {
                mostra("Impossibile creare la cartella: ${e.message}")
            } finally {
                occupato = false
            }
        }
    }

    // ---------------------------------------------------------------------
    // Progetti già creati (elenco della Home)
    // ---------------------------------------------------------------------

    /**
     * Legge l'elenco dei progetti nella cartella condivisa. Passa dalla coda
     * dei file, così vede anche gli ultimi salvataggi appena fatti.
     */
    fun caricaProgetti() {
        val c = cartella ?: run {
            progettiSalvati = emptyList()
            return
        }
        caricamentoProgetti = true
        accoda {
            val elenco = try {
                c.elencoProgetti()
            } catch (e: Exception) {
                emptyList()
            }
            withContext(Dispatchers.Main) {
                progettiSalvati = elenco
                caricamentoProgetti = false
            }
        }
    }

    /** Miniatura della prima foto di un progetto (null se non ha foto). */
    suspend fun anteprimaProgetto(p: ProgettoVideo): ImageBitmap? {
        val c = cartella ?: return null
        val prima = p.passi.firstOrNull() ?: return null
        return withContext(Dispatchers.IO) {
            try {
                c.leggiAnteprima(p.nomeCartella, prima.nomeFile, 240)?.asImageBitmap()
            } catch (e: Exception) {
                null
            }
        }
    }

    /**
     * Riapre un progetto dall'elenco. Se il video non è più raggiungibile
     * (spostato o permesso perso) chiede di sceglierlo di nuovo: l'impronta
     * lo ricollega al progetto giusto.
     */
    fun riapriProgetto(p: ProgettoVideo) {
        occupato = true
        viewModelScope.launch {
            val raggiungibile = withContext(Dispatchers.IO) { videoRaggiungibile(Uri.parse(p.uriVideo)) }
            occupato = false
            if (raggiungibile) {
                apriProgetto(p)
            } else {
                mostra("Il video «${p.nomeFileVideo}» non si trova più: selezionalo di nuovo.")
                richiestaSceltaVideo = true
            }
        }
    }

    /** La Home ha aperto la scelta del video richiesta. */
    fun sceltaVideoAvviata() {
        richiestaSceltaVideo = false
    }

    private fun videoRaggiungibile(uri: Uri): Boolean = try {
        contesto.contentResolver.openFileDescriptor(uri, "r")?.use { true } ?: false
    } catch (e: Exception) {
        false
    }

    // ---------------------------------------------------------------------
    // Apertura e chiusura di un progetto
    // ---------------------------------------------------------------------

    private fun apriProgetto(p: ProgettoVideo) {
        progetto = p
        videoScelto = null
        modifica { it } // scrive subito indice.json e tutorial_input.md
        creaPlayer(Uri.parse(p.uriVideo))
        avviaMiniature(p)
        schermata = Schermata.PLAYER
        if (p.statoAudio.inLavorazione || p.statoAudio == StatoAudio.ERRORE) avviaAudio()
    }

    /** Torna alla Home chiudendo il progetto (i dati sono già salvati). */
    fun tornaHome() {
        fermaSalti()
        osservatoreAudio?.cancel()
        osservatoreAudio = null
        lavoroMiniature?.cancel()
        lavoroMiniature = null
        miniature.clear()
        player?.release()
        player = null
        inRiproduzione = false
        velocitaScorrimento = 0f
        accoda { estrattore.chiudi() } // dopo le foto ancora in coda
        progetto = null
        videoScelto = null
        passoInCommento = null
        passoInSpostamento = null
        finestraTermina = false
        schermata = Schermata.HOME
    }

    /**
     * L'UNICA funzione che cambia il progetto: applica la modifica e mette in
     * coda il salvataggio di indice.json e tutorial_input.md.
     */
    private fun modifica(cambia: (ProgettoVideo) -> ProgettoVideo) {
        val attuale = progetto ?: return
        val nuovo = cambia(attuale)
        progetto = nuovo
        val c = cartella ?: return
        accoda { c.salvaProgetto(nuovo) }
    }

    /** Aggiunge un'operazione sui file in fondo alla coda. */
    private fun accoda(operazione: suspend () -> Unit) {
        codaFile.trySend(operazione)
    }

    override fun onCleared() {
        player?.release()
        estrattore.chiudi()
        super.onCleared()
    }

    // ---------------------------------------------------------------------
    // Audio in sottofondo
    // ---------------------------------------------------------------------

    private fun avviaAudio() {
        val p = progetto ?: return
        val c = cartella ?: return
        modifica { it.copy(statoAudio = StatoAudio.IN_CORSO, statoAudioAggiornatoMs = System.currentTimeMillis()) }
        LavoroEstrazioneAudio.avvia(contesto, p, c.uriRadice)

        // Segue l'avanzamento del lavoro e aggiorna lo stato nel progetto
        osservatoreAudio?.cancel()
        osservatoreAudio = viewModelScope.launch {
            WorkManager.getInstance(contesto)
                .getWorkInfosForUniqueWorkFlow(LavoroEstrazioneAudio.nomeLavoro(p.impronta))
                .collect { lavori ->
                    val lavoro = lavori.firstOrNull { !it.state.isFinished } ?: lavori.lastOrNull()
                        ?: return@collect
                    val stato = when (lavoro.state) {
                        WorkInfo.State.SUCCEEDED ->
                            lavoro.outputData.getString(LavoroEstrazioneAudio.CHIAVE_STATO)
                                ?.let { nome -> StatoAudio.entries.firstOrNull { it.name == nome } }
                                ?: StatoAudio.ERRORE
                        WorkInfo.State.FAILED, WorkInfo.State.CANCELLED -> StatoAudio.ERRORE
                        else -> StatoAudio.IN_CORSO
                    }
                    val attuale = progetto
                    if (attuale != null && attuale.impronta == p.impronta && attuale.statoAudio != stato) {
                        modifica { it.copy(statoAudio = stato, statoAudioAggiornatoMs = System.currentTimeMillis()) }
                    }
                }
        }
    }

    // ---------------------------------------------------------------------
    // Lettore video
    // ---------------------------------------------------------------------

    private fun creaPlayer(uri: Uri) {
        player?.release()
        val nuovo = ExoPlayer.Builder(contesto).build()
        nuovo.setMediaItem(MediaItem.fromUri(uri))
        nuovo.setSeekParameters(SeekParameters.EXACT)
        nuovo.playWhenReady = false
        nuovo.addListener(object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                inRiproduzione = isPlaying
            }

            override fun onPlayerError(error: PlaybackException) {
                mostra("Errore di riproduzione: ${error.errorCodeName}")
            }
        })
        nuovo.prepare()
        player = nuovo
    }

    /** Durata del video in ms (dal lettore o, se non ancora nota, dal progetto). */
    fun durataMs(): Long {
        val dalLettore = player?.duration ?: 0L
        return if (dalLettore > 0) dalLettore else progetto?.durataMs ?: 0L
    }

    /** Pulsante Play/Pausa. */
    fun playPausa() {
        val pl = player ?: return
        if (pl.isPlaying) {
            pl.pause()
        } else {
            pl.playbackParameters = PlaybackParameters.DEFAULT
            pl.volume = 1f
            if (pl.playbackState == Player.STATE_ENDED) pl.seekTo(0)
            pl.play()
        }
    }

    /** Avanti (+1) o indietro (-1) di un fotogramma. */
    fun fotogramma(direzione: Int) {
        val pl = player ?: return
        pl.pause()
        val fps = pl.videoFormat?.frameRate?.takeIf { it > 0f } ?: FPS_PREDEFINITI
        val passoMs = (1000f / fps).roundToLong()
        pl.setSeekParameters(SeekParameters.EXACT)
        pl.seekTo((pl.currentPosition + direzione * passoMs).coerceIn(0L, durataMs()))
    }

    /** Porta il video al tempo indicato (in pausa, nel fotogramma esatto). */
    fun vaiA(tempoMs: Long) {
        val pl = player ?: return
        pl.pause()
        pl.setSeekParameters(SeekParameters.EXACT)
        pl.seekTo(tempoMs.coerceIn(0L, durataMs()))
    }

    // ---------------------------------------------------------------------
    // Segnalibri (passi): tasti precedente e successivo
    // ---------------------------------------------------------------------

    /** Tolleranza: un segnalibro a meno di 50 ms conta come "qui". */
    private val toleranzaSegnalibroMs = 50L

    /** Segnalibro prima del punto indicato (null se non ce ne sono). */
    fun segnalibroPrecedente(posizioneMs: Long): Passo? =
        progetto?.passi?.lastOrNull { it.tempoMs < posizioneMs - toleranzaSegnalibroMs }

    /** Segnalibro dopo il punto indicato (null se non ce ne sono). */
    fun segnalibroSuccessivo(posizioneMs: Long): Passo? =
        progetto?.passi?.firstOrNull { it.tempoMs > posizioneMs + toleranzaSegnalibroMs }

    // ---------------------------------------------------------------------
    // Striscia di anteprime
    // ---------------------------------------------------------------------

    /**
     * Crea in sottofondo le miniature dell'intero video. Si mette in pausa
     * mentre ci sono foto da salvare, per non rallentarle.
     */
    private fun avviaMiniature(p: ProgettoVideo) {
        lavoroMiniature?.cancel()
        miniature.clear()
        val durata = p.durataMs
        if (durata <= 0) return
        val intervallo = GeneratoreMiniature.intervalloPer(durata)
        val numero = GeneratoreMiniature.numeroPer(durata, intervallo)
        intervalloMiniatureMs = intervallo
        miniature.addAll(List(numero) { null })

        lavoroMiniature = viewModelScope.launch(Dispatchers.IO) {
            val generatore = GeneratoreMiniature(contesto, Uri.parse(p.uriVideo), p.impronta, intervallo)
            try {
                for (indice in GeneratoreMiniature.ordine(numero)) {
                    ensureActive() // si ferma subito se si esce dal progetto
                    while (fotoInSalvataggio > 0) delay(100)
                    val immagine = try {
                        generatore.miniatura(indice)
                    } catch (e: Exception) {
                        null
                    } ?: continue
                    val pronta = immagine.asImageBitmap()
                    withContext(Dispatchers.Main) {
                        if (progetto?.impronta == p.impronta && indice < miniature.size) miniature[indice] = pronta
                    }
                }
            } finally {
                generatore.chiudi()
            }
        }
    }

    // ---------------------------------------------------------------------
    // Barra di scorrimento
    // ---------------------------------------------------------------------

    /** Il dito si è appoggiato sulla barra. */
    fun iniziaScorrimento() {
        val pl = player ?: return
        pl.volume = 0f // audio muto durante lo scorrimento
        posizioneVirtualeMs = pl.currentPosition.toDouble()
    }

    /**
     * Il dito si è spostato: "velocita" è positiva in avanti, negativa
     * indietro, 0 nella zona morta centrale.
     */
    fun aggiornaScorrimento(velocita: Float) {
        val pl = player ?: return
        velocitaScorrimento = velocita
        when {
            velocita == 0f -> {
                if (lavoroSalti != null) fermaSalti()
                pl.pause()
            }
            velocita > 0f && velocita <= VELOCITA_MAX_RIPRODUZIONE -> {
                // Avanti fino a 4x: riproduzione normale accelerata
                if (lavoroSalti != null) {
                    fermaSalti()
                    pl.setSeekParameters(SeekParameters.EXACT)
                    pl.seekTo(posizioneVirtualeMs.toLong())
                }
                pl.playbackParameters = PlaybackParameters(velocita)
                if (!pl.isPlaying) pl.play()
            }
            else -> {
                // Indietro oppure oltre 4x: salti ogni 40 ms
                if (lavoroSalti == null) {
                    pl.pause()
                    posizioneVirtualeMs = pl.currentPosition.toDouble()
                    avviaSalti(pl)
                }
            }
        }
    }

    /** Il dito si è staccato: pausa, velocità normale, posizione esatta. */
    fun fineScorrimento() {
        val pl = player ?: return
        val posizione = if (lavoroSalti != null) posizioneVirtualeMs.toLong() else pl.currentPosition
        fermaSalti()
        pl.pause()
        pl.playbackParameters = PlaybackParameters.DEFAULT
        pl.volume = 1f
        pl.setSeekParameters(SeekParameters.EXACT)
        pl.seekTo(posizione.coerceIn(0L, durataMs()))
        velocitaScorrimento = 0f
    }

    private fun avviaSalti(pl: ExoPlayer) {
        lavoroSalti = viewModelScope.launch {
            while (isActive) {
                val v = velocitaScorrimento
                val durata = durataMs().toDouble()
                posizioneVirtualeMs = (posizioneVirtualeMs + v * INTERVALLO_SALTI_MS).coerceIn(0.0, durata)
                // Sotto 4x salto preciso, sopra salto al fotogramma chiave più vicino (più veloce)
                pl.setSeekParameters(if (abs(v) < VELOCITA_MAX_RIPRODUZIONE) SeekParameters.EXACT else SeekParameters.CLOSEST_SYNC)
                pl.seekTo(posizioneVirtualeMs.toLong())
                delay(INTERVALLO_SALTI_MS)
            }
        }
    }

    private fun fermaSalti() {
        lavoroSalti?.cancel()
        lavoroSalti = null
    }

    // ---------------------------------------------------------------------
    // Cattura delle foto e passi
    // ---------------------------------------------------------------------

    /**
     * Pulsante di cattura. È istantaneo: il nuovo passo compare subito e si
     * apre la finestra del commento; il fotogramma viene estratto e salvato
     * in sottofondo (vedi codaFile), mentre si scrive il commento.
     */
    fun cattura(tipo: TipoPasso) {
        val p = progetto ?: return
        val pl = player ?: return
        if (passoInSpostamento != null) return
        pl.pause()
        val tempoMs = pl.currentPosition.coerceIn(0L, durataMs())
        val nuovo = Passo(id = UUID.randomUUID().toString(), tempoMs = tempoMs, tipo = tipo, nomeFile = "")
        salvaPassoConFoto(p.passi + nuovo, nuovo, fileVecchio = null)
        passoInCommento = nuovo.id
        commentoDiNuovaFoto = true
        val totale = p.passi.size + 1
        if (totale > SOGLIA_FOTO) mostra("Attenzione: $totale foto, oltre la soglia di $SOGLIA_FOTO")
    }

    /**
     * Inserisce "passo" (nuovo, spostato o con il tipo cambiato) nell'elenco,
     * rinumera tutto e aggiorna subito il progetto. In sottofondo: cancella
     * la vecchia foto (se c'è), rinomina le altre e salva il fotogramma al
     * tempo del passo. "passi" deve già contenere "passo" con nomeFile vuoto.
     */
    private fun salvaPassoConFoto(passi: List<Passo>, passo: Passo, fileVecchio: String?) {
        val p = progetto ?: return
        val c = cartella ?: return
        val (numerati, rinomine) = numera(passi)
        val nomeFile = numerati.first { it.id == passo.id }.nomeFile
        val uriVideo = Uri.parse(p.uriVideo)
        val nomeCartella = p.nomeCartella

        // 1. In sottofondo: file
        fotoInSalvataggio++
        accoda {
            try {
                if (fileVecchio != null) c.eliminaFoto(nomeCartella, fileVecchio)
                applicaRinomine(c, nomeCartella, rinomine)
                val immagine = estrattore.estrai(uriVideo, passo.tempoMs) ?: error("fotogramma non leggibile")
                try {
                    c.salvaFoto(nomeCartella, nomeFile, immagine, passo.tipo.latoLungoPx)
                } finally {
                    immagine.recycle()
                }
            } catch (e: Exception) {
                // Foto non salvata: si toglie il passo per non lasciarlo senza file
                withContext(Dispatchers.Main) {
                    mostra("Foto non salvata: ${e.message}")
                    eliminaPasso(passo.id, avvisa = false)
                }
            } finally {
                withContext(Dispatchers.Main) { fotoInSalvataggio-- }
            }
        }

        // 2. Subito: aggiorna l'elenco (una modifica alle foto riporta il lavoro "IN CORSO")
        modifica { it.copy(passi = numerati, terminato = false) }
    }

    /** Una foto da rinominare: dal nome "da" al nome "a". */
    private data class Rinomina(val id: String, val da: String, val a: String)

    /**
     * Mette i passi in ordine di tempo e assegna i numeri (P01, P02...).
     * Restituisce l'elenco numerato e le foto da rinominare perché hanno
     * cambiato numero. Non tocca i file.
     */
    private fun numera(passi: List<Passo>): Pair<List<Passo>, List<Rinomina>> {
        val ordinati = passi.sortedBy { it.tempoMs }
        val numerati = ordinati.mapIndexed { indice, passo ->
            passo.copy(nomeFile = NomiFile.nomeFoto(indice + 1, passo.tempoMs, passo.tipo))
        }
        val rinomine = ordinati.zip(numerati)
            .filter { (vecchio, nuovo) -> vecchio.nomeFile.isNotEmpty() && vecchio.nomeFile != nuovo.nomeFile }
            .map { (vecchio, nuovo) -> Rinomina(vecchio.id, vecchio.nomeFile, nuovo.nomeFile) }
        return numerati to rinomine
    }

    /**
     * Rinomina i file delle foto in due fasi (prima nomi temporanei) per non
     * sovrascrivere foto con lo stesso nome. Da eseguire nella coda dei file.
     */
    private fun applicaRinomine(c: CartellaFormazione, nomeCartella: String, rinomine: List<Rinomina>) {
        rinomine.forEach { c.rinominaFoto(nomeCartella, it.da, "tmp_${it.id}.jpg") }
        rinomine.forEach { c.rinominaFoto(nomeCartella, "tmp_${it.id}.jpg", it.a) }
    }

    // ---------------------------------------------------------------------
    // Modifica dei segnalibri (commento, tipo, spostamento, eliminazione)
    // ---------------------------------------------------------------------

    /** Segnalibro nel punto indicato (quello su cui si trova il video), o null. */
    fun segnalibroQui(posizioneMs: Long): Passo? =
        progetto?.passi?.firstOrNull { abs(it.tempoMs - posizioneMs) <= toleranzaSegnalibroMs }

    /** Apre la finestra di modifica di un segnalibro esistente (dal fumetto). */
    fun apriModificaPasso(idPasso: String) {
        player?.pause()
        passoInCommento = idPasso
        commentoDiNuovaFoto = false
    }

    /** Pulsante "Salva" della finestra: aggiorna commento e, se cambiato, il tipo. */
    fun salvaPasso(idPasso: String, testo: String, tipo: TipoPasso) {
        passoInCommento = null
        val p = progetto ?: return
        val passo = p.passi.firstOrNull { it.id == idPasso } ?: return
        if (tipo != passo.tipo) {
            // Il tipo cambia nome e misura della foto: la si rifà
            val modificato = passo.copy(commento = testo.trim(), tipo = tipo, nomeFile = "")
            salvaPassoConFoto(p.passi.map { if (it.id == idPasso) modificato else it }, modificato, passo.nomeFile)
        } else {
            modifica { pr ->
                pr.copy(passi = pr.passi.map { if (it.id == idPasso) it.copy(commento = testo.trim()) else it })
            }
        }
    }

    /** Chiude la finestra del commento senza salvare ("Salta" o "Annulla"). */
    fun chiudiFinestraPasso() {
        passoInCommento = null
    }

    /** Inizia lo spostamento: l'utente porta il video nel punto giusto e conferma. */
    fun iniziaSpostamento(idPasso: String) {
        player?.pause()
        passoInCommento = null
        passoInSpostamento = idPasso
    }

    /** Annulla lo spostamento e torna al punto originale del segnalibro. */
    fun annullaSpostamento() {
        val id = passoInSpostamento ?: return
        passoInSpostamento = null
        progetto?.passi?.firstOrNull { it.id == id }?.let { vaiA(it.tempoMs) }
    }

    /** "Fissa qui": sposta il segnalibro nel punto attuale e rifà la foto. */
    fun confermaSpostamento() {
        val id = passoInSpostamento ?: return
        passoInSpostamento = null
        val p = progetto ?: return
        val pl = player ?: return
        val passo = p.passi.firstOrNull { it.id == id } ?: return
        pl.pause()
        val nuovoTempo = pl.currentPosition.coerceIn(0L, durataMs())
        if (nuovoTempo == passo.tempoMs) return
        val spostato = passo.copy(tempoMs = nuovoTempo, nomeFile = "")
        salvaPassoConFoto(p.passi.map { if (it.id == id) spostato else it }, spostato, passo.nomeFile)
        mostra("Segnalibro spostato a ${NomiFile.tempoFoto(nuovoTempo)}")
    }

    /**
     * Elimina un segnalibro: lo toglie subito e rinumera gli altri;
     * i file vengono cancellati e rinominati in sottofondo.
     */
    fun eliminaPasso(idPasso: String, avvisa: Boolean = true) {
        val p = progetto ?: return
        val c = cartella ?: return
        val passo = p.passi.firstOrNull { it.id == idPasso } ?: return
        if (passoInCommento == idPasso) passoInCommento = null
        if (passoInSpostamento == idPasso) passoInSpostamento = null
        val (numerati, rinomine) = numera(p.passi.filter { it.id != idPasso })
        val nomeCartella = p.nomeCartella
        accoda {
            c.eliminaFoto(nomeCartella, passo.nomeFile)
            applicaRinomine(c, nomeCartella, rinomine)
        }
        modifica { it.copy(passi = numerati) }
        if (avvisa) mostra("Segnalibro eliminato")
    }

    // ---------------------------------------------------------------------
    // Fine lavoro
    // ---------------------------------------------------------------------

    fun apriTermina() {
        player?.pause()
        finestraTermina = true
    }

    fun chiudiTermina() {
        finestraTermina = false
    }

    /** Pulsante "Termina": salva le note finali e chiude il progetto. */
    fun termina(noteFinali: String) {
        val p = progetto ?: return
        modifica { it.copy(terminato = true, noteFinali = noteFinali.trim()) }
        finestraTermina = false
        mostra(
            if (p.statoAudio.inLavorazione) {
                "Salvato. Sarà COMPLETO appena finisce l'estrazione dell'audio."
            } else {
                "Lavoro COMPLETO: la cartella ${p.nomeCartella} è pronta per Claude."
            }
        )
        tornaHome()
    }
}
