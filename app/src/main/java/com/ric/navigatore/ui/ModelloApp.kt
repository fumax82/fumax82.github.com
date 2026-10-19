package com.ric.navigatore.ui

import android.content.Context
import com.ric.navigatore.Servizi
import com.ric.navigatore.dati.Impostazioni
import com.ric.navigatore.dati.PercorsoSalvato
import com.ric.navigatore.guida.GuidaCondivisa
import com.ric.navigatore.nucleo.geo.Aree
import com.ric.navigatore.nucleo.geo.Geo
import com.ric.navigatore.nucleo.geo.Linea
import com.ric.navigatore.nucleo.geo.Poligono
import com.ric.navigatore.nucleo.geo.Punto
import com.ric.navigatore.nucleo.modello.Durata
import com.ric.navigatore.nucleo.modello.Esito
import com.ric.navigatore.nucleo.modello.EvitaArea
import com.ric.navigatore.nucleo.modello.EvitaTratto
import com.ric.navigatore.nucleo.modello.FormaArea
import com.ric.navigatore.nucleo.modello.Luogo
import com.ric.navigatore.nucleo.modello.ModoArea
import com.ric.navigatore.nucleo.modello.OpzioniPercorso
import com.ric.navigatore.nucleo.modello.PassaArea
import com.ric.navigatore.nucleo.modello.PassaPunto
import com.ric.navigatore.nucleo.modello.PassaTratto
import com.ric.navigatore.nucleo.modello.Percorso
import com.ric.navigatore.nucleo.modello.Priorita
import com.ric.navigatore.nucleo.modello.Senso
import com.ric.navigatore.nucleo.modello.Storico
import com.ric.navigatore.nucleo.modello.Viaggio
import com.ric.navigatore.nucleo.modello.Vincolo
import com.ric.navigatore.nucleo.modello.formattaDistanza
import com.ric.navigatore.nucleo.pianificazione.Contesto
import com.ric.navigatore.nucleo.servizi.PuntoAgganciato
import com.ric.navigatore.nucleo.servizi.RisultatoRicerca
import com.ric.navigatore.nucleo.strade.Candidato
import com.ric.navigatore.nucleo.strade.ReteLocale
import com.ric.navigatore.nucleo.strade.StradaLocale
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.math.max
import kotlin.math.roundToInt
import com.ric.navigatore.nucleo.modello.Modifiche
import com.ric.navigatore.nucleo.modello.TipoManiglia

/** Ciò che il modello chiede alla mappa (lo implementa ControlloreMappa). */
interface LettoreMappa {
    fun leggiStrade(centro: Punto, raggioMetri: Double): List<StradaLocale>
    fun metriPerPixel(): Double
    fun zoom(): Double
    fun centroMappa(): Punto?
}

/** Eventi "una tantum" per l'interfaccia. */
sealed class Evento {
    data class Inquadra(val punti: List<Punto>) : Evento()
    data class Centra(val punto: Punto, val zoom: Double? = null) : Evento()
    data class Messaggio(val testo: String) : Evento()
}

/**
 * Il "cervello" della schermata di pianificazione: tiene lo stato
 * (viaggio, vincoli, selezione in corso, risultato) e reagisce ai tocchi.
 *
 * Non dipende da Compose: l'interfaccia legge [stato] e chiama le funzioni.
 */
class ModelloApp {
    private val ambito = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val _stato = MutableStateFlow(StatoUi())
    val stato: StateFlow<StatoUi> = _stato
    private val _eventi = MutableSharedFlow<Evento>(extraBufferCapacity = 8)
    val eventi: SharedFlow<Evento> = _eventi

    /** Collegato dalla schermata quando la mappa è pronta. */
    var lettore: LettoreMappa? = null

    private val storico: Storico<Viaggio>
    private var rete: ReteLocale? = null
    private var lavoroRicerca: Job? = null
    /** Chiave del viaggio per cui è stato calcolato il percorso "senza vincoli". */
    private var chiaveIniziale: String? = null

    init {
        val iniziale = Viaggio(vincoli = Servizi.archivio.dati.vincoliSalvati)
        storico = Storico(iniziale)
        _stato.value = StatoUi(viaggio = iniziale)
        ambito.launch { Servizi.rete.collect { r -> aggiorna { it.copy(rete = r) } } }
    }

    private fun aggiorna(f: (StatoUi) -> StatoUi) { _stato.value = f(_stato.value) }
    private fun avvisa(testo: String) { _eventi.tryEmit(Evento.Messaggio(testo)) }

    /** Messaggio breve in basso (usato anche dalle schermate). */
    fun messaggio(testo: String) = avvisa(testo)
    private val s get() = _stato.value

    val impostazioni: Impostazioni get() = Servizi.archivio.dati.impostazioni

    // ==================================================================
    // Viaggio: modifiche, annulla e ripristina
    // ==================================================================

    /** Ogni modifica a tappe o vincoli passa da qui (così Annulla funziona sempre). */
    private fun cambiaViaggio(nuovo: Viaggio) {
        storico.registra(nuovo)
        applica(nuovo)
    }

    private fun applica(v: Viaggio) {
        aggiorna {
            it.copy(
                viaggio = v, daRicalcolare = it.esito != null,
                puoAnnullare = storico.puoAnnullare, puoRipristinare = storico.puoRipristinare,
            )
        }
        // i vincoli "salvati per i prossimi viaggi" vanno subito su disco
        Servizi.archivio.modifica { d -> d.copy(vincoliSalvati = v.vincoli.filter { it.durata == Durata.SALVATO }) }
    }

    fun annulla() = applica(storico.annulla())
    fun ripristina() = applica(storico.ripristina())

    fun nuovoViaggio() {
        val v = Viaggio(vincoli = s.viaggio.vincoli.filter { it.durata == Durata.SALVATO }, opzioni = s.viaggio.opzioni)
        storico.azzera(v)
        chiaveIniziale = null
        aggiorna { StatoUi(viaggio = v, posizione = it.posizione, rete = it.rete) }
    }

    fun impostaLuogo(scopo: Scopo, luogo: Luogo) {
        val v = s.viaggio
        cambiaViaggio(
            when (scopo) {
                Scopo.PARTENZA -> v.copy(partenza = luogo)
                Scopo.ARRIVO -> v.copy(arrivo = luogo)
                Scopo.TAPPA -> v.copy(tappe = v.tappe + luogo)
            },
        )
        if (scopo == Scopo.ARRIVO || scopo == Scopo.TAPPA) aggiungiCronologia(luogo)
        _eventi.tryEmit(Evento.Centra(luogo.punto, 15.0))
    }

    fun usaPosizioneAttuale(scopo: Scopo) {
        val p = s.posizione
        if (p == null) { avvisa("Posizione non ancora disponibile: controlla che il GPS sia acceso e il permesso concesso."); return }
        impostaLuogo(scopo, Luogo(p, "La mia posizione", posizioneAttuale = true))
    }

    fun inverti() {
        val v = s.viaggio
        cambiaViaggio(v.copy(partenza = v.arrivo, arrivo = v.partenza, tappe = v.tappe.reversed()))
    }

    fun rimuoviTappa(i: Int) = cambiaViaggio(s.viaggio.copy(tappe = s.viaggio.tappe.filterIndexed { k, _ -> k != i }))

    fun spostaTappa(i: Int, su: Boolean) {
        val t = s.viaggio.tappe.toMutableList()
        val j = if (su) i - 1 else i + 1
        if (j !in t.indices) return
        t[i] = t[j].also { t[j] = t[i] }
        cambiaViaggio(s.viaggio.copy(tappe = t))
    }

    fun opzioni(o: OpzioniPercorso) = cambiaViaggio(s.viaggio.copy(opzioni = o))

    // ==================================================================
    // Vincoli: elenco, modifica, ordine
    // ==================================================================

    private fun cambiaVincolo(id: String, f: (Vincolo) -> Vincolo) =
        cambiaViaggio(s.viaggio.copy(vincoli = s.viaggio.vincoli.map { if (it.id == id) f(it) else it }))

    fun attivaVincolo(id: String, attivo: Boolean) = cambiaVincolo(id) { it.cambia(attivo = attivo) }
    fun prioritaVincolo(id: String, p: Priorita) = cambiaVincolo(id) { it.cambia(priorita = p) }
    fun durataVincolo(id: String, d: Durata) = cambiaVincolo(id) { it.cambia(durata = d) }
    fun rinominaVincolo(id: String, nome: String) = cambiaVincolo(id) { it.cambia(nome = nome.ifBlank { it.nome }) }
    fun rimuoviVincolo(id: String) = cambiaViaggio(s.viaggio.copy(vincoli = s.viaggio.vincoli.filter { it.id != id }))

    fun sensoVincolo(id: String, senso: Senso) = cambiaVincolo(id) { if (it is PassaTratto && !it.sensoUnico) it.copy(senso = senso) else it }
    fun modoArea(id: String, modo: ModoArea) = cambiaVincolo(id) { if (it is PassaArea) it.copy(modo = modo) else it }
    fun larghezzaFascia(id: String, metri: Double) = cambiaVincolo(id) { if (it is EvitaTratto) it.copy(larghezzaFascia = metri) else it }

    /** Fra quali tappe va fatto un passaggio (null = automatico). */
    fun dopoTappa(id: String, tappa: Int?) = cambiaVincolo(id) {
        when (it) {
            is PassaPunto -> it.copy(dopoTappa = tappa)
            is PassaTratto -> it.copy(dopoTappa = tappa)
            is PassaArea -> it.copy(dopoTappa = tappa)
            else -> it
        }
    }

    /** Sposta un vincolo su o giù nell'elenco (per i passaggi = ordine di percorrenza). */
    fun spostaVincolo(id: String, su: Boolean) {
        val l = s.viaggio.vincoli.toMutableList()
        val i = l.indexOfFirst { it.id == id }
        val j = if (su) i - 1 else i + 1
        if (i < 0 || j !in l.indices) return
        l[i] = l[j].also { l[j] = l[i] }
        cambiaViaggio(s.viaggio.copy(vincoli = l))
    }

    fun mostraVincolo(v: Vincolo) {
        val punti = when (v) {
            is EvitaArea -> v.poligono.esterno
            is PassaArea -> v.poligono.esterno
            is EvitaTratto -> v.linea
            is PassaTratto -> v.linea
            is PassaPunto -> listOf(v.puntoUsato)
        }
        aggiorna { it.copy(foglio = null) }
        _eventi.tryEmit(Evento.Inquadra(punti))
    }

    // ==================================================================
    // Fogli e modi
    // ==================================================================

    fun apri(f: Foglio?) = aggiorna { it.copy(foglio = f, menuPunto = null) }

    fun apriRicerca(scopo: Scopo) = aggiorna {
        it.copy(foglio = Foglio.RICERCA, scopoRicerca = scopo, testoRicerca = "", risultatiRicerca = emptyList(), messaggioRicerca = null)
    }

    fun avviaModo(m: Modo) {
        val suggerimento = when (m) {
            Modo.Normale -> null
            is Modo.SceltaPunto -> "Tocca la mappa nel punto di ${m.scopo.etichetta.lowercase()}."
            is Modo.Strada -> if (m.evita) "Tocca la strada da evitare." else "Tocca la strada da percorrere."
            Modo.PezzoPercorso -> if (s.percorsoScelto == null) "Prima calcola un percorso." else "Tocca sul percorso blu l'INIZIO del pezzo da evitare."
            Modo.Punto -> "Tocca il punto da cui vuoi passare."
            is Modo.Disegno -> "Tocca la mappa per disegnare l'area."
            is Modo.Modifica -> "Tocca una maniglia (cerchietto bianco) e poi il punto dove spostarla."
        }
        aggiorna { it.copy(modo = m, selezione = Selezione(suggerimento = suggerimento), foglio = null, menuPunto = null) }
    }

    fun annullaModo() = aggiorna { it.copy(modo = Modo.Normale, selezione = Selezione()) }

    fun cambiaSelezione(f: (Selezione) -> Selezione) {
        aggiorna { it.copy(selezione = f(it.selezione)) }
        // se cambia la larghezza della fascia ricalcoliamo le strade coinvolte
        val sel = s.selezione
        if (s.modo == Modo.Strada(true) || s.modo == Modo.PezzoPercorso) sel.linea?.let { aggiornaCoinvolte(it) }
    }

    fun chiudiMenuPunto() = aggiorna { it.copy(menuPunto = null) }

    // ==================================================================
    // Tocchi sulla mappa
    // ==================================================================

    fun toccoLungo(p: Punto) {
        if (s.modo != Modo.Normale) { tocco(p); return }
        aggiorna { it.copy(menuPunto = p) }
    }

    fun tocco(p: Punto) {
        if (s.menuPunto != null) { chiudiMenuPunto(); return }
        when (val m = s.modo) {
            Modo.Normale -> {
                // un tocco su un vincolo già disegnato lo seleziona per modificarlo
                val v = Modifiche.colpito(s.viaggio.vincoli, p, sogliaTocco())
                if (v != null) selezionaVincolo(v.id) else sceltaAlternativaVicina(p)
            }
            is Modo.Modifica -> toccoModifica(m.id, p)
            is Modo.SceltaPunto -> {
                impostaLuogo(m.scopo, Luogo(p, "Punto sulla mappa"))
                annullaModo()
                daiNome(m.scopo, p)
            }
            is Modo.Strada -> toccoStrada(p, m.evita)
            Modo.PezzoPercorso -> toccoPercorso(p)
            Modo.Punto -> toccoPunto(p)
            is Modo.Disegno -> toccoDisegno(p)
        }
    }

    /** Dal menu del tocco lungo. */
    fun azioneMenu(p: Punto, azione: String) {
        chiudiMenuPunto()
        when (azione) {
            "partenza" -> { impostaLuogo(Scopo.PARTENZA, Luogo(p, "Punto sulla mappa")); daiNome(Scopo.PARTENZA, p) }
            "arrivo" -> { impostaLuogo(Scopo.ARRIVO, Luogo(p, "Punto sulla mappa")); daiNome(Scopo.ARRIVO, p) }
            "tappa" -> { impostaLuogo(Scopo.TAPPA, Luogo(p, "Tappa sulla mappa")); daiNome(Scopo.TAPPA, p) }
            "passa" -> { avviaModo(Modo.Punto); toccoPunto(p) }
            "evita" -> { avviaModo(Modo.Strada(true)); toccoStrada(p, true) }
            "preferito" -> aggiungiPreferito(Luogo(p, "Preferito"))
            "quota" -> chiediQuota(p)
        }
    }

    /** Cerca l'indirizzo del punto per dargli un nome leggibile (se il servizio è disponibile). */
    private fun daiNome(scopo: Scopo, p: Punto) {
        val geo = Servizi.geocodifica ?: return
        if (!s.rete) return
        ambito.launch {
            val r = withContext(Dispatchers.IO) { geo.indirizzo(p) }
            val nome = (r as? Esito.Ok)?.valore?.nome ?: return@launch
            val v = s.viaggio
            fun rinomina(l: Luogo?) = if (l != null && l.punto == p) l.copy(nome = nome) else l
            // il nome non è una modifica da annullare: aggiorniamo direttamente
            val nuovo = when (scopo) {
                Scopo.PARTENZA -> v.copy(partenza = rinomina(v.partenza))
                Scopo.ARRIVO -> v.copy(arrivo = rinomina(v.arrivo))
                Scopo.TAPPA -> v.copy(tappe = v.tappe.map { rinomina(it)!! })
            }
            aggiorna { it.copy(viaggio = nuovo) }
        }
    }

    private fun sogliaTocco(): Double = max(15.0, 28 * (lettore?.metriPerPixel() ?: 1.0))

    private fun sceltaAlternativaVicina(p: Punto) {
        val e = s.esito ?: return
        val tutte = listOfNotNull(e.percorso) + e.alternative
        if (tutte.size < 2) return
        val soglia = sogliaTocco()
        val i = tutte.indices.minByOrNull { Geo.proietta(tutte[it].geometria, p).distanza } ?: return
        if (Geo.proietta(tutte[i].geometria, p).distanza <= soglia) aggiorna { it.copy(sceltaAlternativa = i) }
    }

    // ---------------- Modifica di un vincolo già creato ----------------

    /** Il vincolo attualmente selezionato per la modifica. */
    fun vincoloSelezionato(st: StatoUi = s): Vincolo? =
        (st.modo as? Modo.Modifica)?.let { m -> st.viaggio.vincoli.firstOrNull { it.id == m.id } }

    fun selezionaVincolo(id: String) {
        val v = s.viaggio.vincoli.firstOrNull { it.id == id } ?: return
        val testo = when (v) {
            is EvitaTratto, is PassaTratto -> "Tratto di strada selezionato: puoi cambiarne le opzioni, spostarlo o eliminarlo."
            is PassaPunto -> "Punto selezionato: tocca il cerchietto e poi il nuovo punto, oppure «Sposta»."
            else -> "Area selezionata: tocca un cerchietto bianco e poi dove spostarlo. I cerchietti piccoli aggiungono un vertice."
        }
        aggiorna { it.copy(modo = Modo.Modifica(id), selezione = Selezione(suggerimento = testo), foglio = null, menuPunto = null) }
    }

    /** Il prossimo tocco sposterà tutto il vincolo. */
    fun spostaTutto() = cambiaSelezione { it.copy(spostaTutto = true, maniglia = null, suggerimento = "Tocca il punto dove spostare il vincolo.") }

    fun eliminaSelezionato() {
        val v = vincoloSelezionato() ?: return
        rimuoviVincolo(v.id)
        annullaModo()
        avvisa("«${v.nome}» eliminato. Puoi recuperarlo con Annulla.")
    }

    fun raggioSelezionato(raggio: Double) {
        val v = vincoloSelezionato() ?: return
        cambiaVincolo(v.id) { Modifiche.cambiaRaggio(it, raggio) }
    }

    fun togliVerticeScelto() {
        val v = vincoloSelezionato() ?: return
        val m = s.selezione.maniglia ?: return
        cambiaVincolo(v.id) { Modifiche.togliVertice(it, m.indice) }
        cambiaSelezione { it.copy(maniglia = null) }
    }

    private fun toccoModifica(id: String, p: Punto) {
        val v = s.viaggio.vincoli.firstOrNull { it.id == id } ?: run { annullaModo(); return }
        val sel = s.selezione
        val soglia = sogliaTocco()
        when {
            // 1) spostamento dell'intero vincolo
            sel.spostaTutto -> {
                if (v is PassaPunto) riposizionaPunto(v, p) else cambiaVincolo(id) { Modifiche.trasla(it, p) }
                cambiaSelezione { it.copy(spostaTutto = false, suggerimento = "Spostato. Puoi continuare a modificarlo o premere «Fatto».") }
            }
            // 2) una maniglia è già scelta: il tocco la sposta qui
            sel.maniglia != null -> {
                val m = sel.maniglia
                when {
                    v is PassaPunto -> riposizionaPunto(v, p)
                    m.tipo == TipoManiglia.META_LATO -> cambiaVincolo(id) { Modifiche.inserisciVertice(it, m.indice, p) }
                    else -> cambiaVincolo(id) { Modifiche.spostaManiglia(it, m, p) }
                }
                cambiaSelezione { it.copy(maniglia = null, suggerimento = "Fatto. Tocca un'altra maniglia o premi «Fatto».") }
            }
            else -> {
                // 3) scelta di una maniglia vicina al tocco
                val m = Modifiche.maniglie(v).minByOrNull { Geo.distanza(it.punto, p) }?.takeIf { Geo.distanza(it.punto, p) <= soglia * 1.3 }
                if (m != null) {
                    cambiaSelezione {
                        it.copy(maniglia = m, suggerimento = when (m.tipo) {
                            TipoManiglia.META_LATO -> "Tocca dove mettere il nuovo vertice."
                            else -> "Ora tocca il punto dove spostarlo."
                        })
                    }
                } else {
                    // 4) tocco su un altro vincolo: si passa a quello; altrove: fine modifica
                    val altro = Modifiche.colpito(s.viaggio.vincoli, p, soglia)
                    if (altro != null && altro.id != id) selezionaVincolo(altro.id) else annullaModo()
                }
            }
        }
    }

    /** Sposta un punto di passaggio e lo riaggancia alla strada (1 richiesta, se disponibile). */
    private fun riposizionaPunto(v: PassaPunto, p: Punto) {
        cambiaSelezione { it.copy(inAttesa = true, suggerimento = "Cerco la strada più vicina…") }
        ambito.launch {
            val a = agganciaPunto(p)
            cambiaVincolo(v.id) { (it as? PassaPunto)?.copy(punto = p, agganciato = a?.agganciato, nomeStrada = a?.nomeStrada) ?: it }
            cambiaSelezione {
                it.copy(inAttesa = false, suggerimento = if (a == null) "Nessuna strada vicina: userò il punto toccato." else "Userò il punto su ${a.nomeStrada.ifBlank { "strada senza nome" }}.")
            }
        }
    }

    /** Aggancio di un punto alla strada: prima il servizio, poi le strade della mappa. */
    private suspend fun agganciaPunto(p: Punto): PuntoAgganciato? {
        if (Servizi.haChiave && s.rete) {
            val e = withContext(Dispatchers.IO) { Servizi.ors.agganciatore.aggancia(listOf(p), 350.0) }
            if (e is Esito.Ok) e.valore.firstOrNull()?.let { return it }
        }
        val l = lettore ?: return null
        if (l.zoom() < 13) return null
        val c = ReteLocale(l.leggiStrade(p, 400.0)).candidati(p, 350.0).firstOrNull() ?: return null
        return PuntoAgganciato(p, c.puntoSuStrada, c.strada.nome, Geo.distanza(p, c.puntoSuStrada))
    }

    // ---------------- Altitudine e profilo ----------------

    /** Altitudine del punto toccato (1 richiesta a openrouteservice). */
    private fun chiediQuota(p: Punto) {
        if (!Servizi.haChiave) { avvisa("Per l'altitudine serve la chiave openrouteservice (Impostazioni)."); return }
        if (!s.rete) { avvisa("Nessuna connessione."); return }
        aggiorna { it.copy(quotaPunto = p to "Calcolo l'altitudine…") }
        ambito.launch {
            val e = withContext(Dispatchers.IO) { Servizi.ors.altitudine(p) }
            val testo = when (e) {
                is Esito.Ok -> "Altitudine: ${e.valore.roundToInt()} m s.l.m. (modello del terreno, precisione di qualche metro)"
                is Esito.Errore -> "Altitudine non disponibile: ${e.messaggio}"
            }
            aggiorna { it.copy(quotaPunto = p to testo) }
        }
    }

    fun chiudiQuota() = aggiorna { it.copy(quotaPunto = null) }

    /** Dal grafico altimetrico: mostra sulla mappa il punto a [progressiva] metri dalla partenza. */
    fun indicaSulProfilo(progressiva: Double?) {
        val p = s.percorsoScelto ?: return
        aggiorna { it.copy(puntoProfilo = progressiva?.let { d -> Geo.puntoAProgressiva(p.geometria, d) }) }
    }

    // ---------------- Strade (evita / percorri) ----------------

    private fun toccoStrada(p: Punto, evita: Boolean) {
        val sel = s.selezione
        val reteAttuale = rete
        if (sel.attesaFine && sel.scelto != null && reteAttuale != null) {
            val tratto = reteAttuale.trattoFra(sel.scelto, p)
            if (tratto == null) {
                cambiaSelezione { it.copy(suggerimento = "Il punto finale deve essere lungo la stessa strada (evidenziata in ambra). Riprova.") }
                return
            }
            impostaTratto(sel.scelto, tratto, evita, "Tratto scelto: ${formattaDistanza(Geo.lunghezza(tratto))}.")
            cambiaSelezione { it.copy(attesaFine = false) }
            return
        }
        val l = lettore ?: return
        if (l.zoom() < 14.0) {
            _eventi.tryEmit(Evento.Centra(p, 16.5))
            cambiaSelezione { it.copy(suggerimento = "Ho avvicinato la mappa: ora tocca di nuovo la strada.") }
            return
        }
        val strade = l.leggiStrade(p, 3000.0)
        val r = ReteLocale(strade)
        rete = r
        val candidati = r.candidati(p, sogliaTocco())
        when {
            candidati.isEmpty() -> cambiaSelezione {
                Selezione(suggerimento = "Nessuna strada percorribile in auto proprio qui: tocca più vicino alla strada.")
            }
            candidati.size == 1 -> scegliCandidato(candidati.first())
            else -> cambiaSelezione {
                Selezione(candidati = candidati, suggerimento = "Qui vicino ci sono ${candidati.size} strade: scegli quella giusta.")
            }
        }
    }

    /** L'utente ha scelto una delle strade vicine al tocco. */
    fun scegliCandidato(c: Candidato) {
        val r = rete ?: return
        val evita = (s.modo as? Modo.Strada)?.evita ?: true
        val tratto = r.trattoFraIncroci(c)
        impostaTratto(c, tratto, evita, "Selezionato il tratto fra due incroci (${formattaDistanza(Geo.lunghezza(tratto))}). Puoi confermare o scegliere tu la fine.")
    }

    private fun impostaTratto(c: Candidato, tratto: Linea, evita: Boolean, testo: String) {
        // senso di marcia: per i sensi unici lo impone la mappa
        val sensoUnico = c.strada.sensoUnico
        var senso = if (evita) Senso.QUALSIASI else Senso.QUALSIASI
        var nota = testo
        if (sensoUnico != 0 && tratto.size >= 2) {
            val prog = Geo.progressive(c.strada.linea)
            val pr = Geo.proietta(c.strada.linea, Geo.puntoAProgressiva(tratto, Geo.lunghezza(tratto) / 2), prog)
            val dirStrada = Geo.direzioneAProgressiva(c.strada.linea, pr.progressiva, prog).let { if (sensoUnico < 0) (it + 180) % 360 else it }
            val dirTratto = Geo.direzione(tratto.first(), tratto.last())
            senso = if (Geo.differenzaAngoli(dirStrada, dirTratto) < 90) Senso.DA_INIZIO_A_FINE else Senso.DA_FINE_A_INIZIO
            if (!evita) nota += " Strada a senso unico: verrà percorsa nel senso consentito."
        } else if (!evita) {
            senso = Senso.DA_INIZIO_A_FINE
        }
        cambiaSelezione {
            it.copy(candidati = emptyList(), scelto = c, linea = tratto, sensoUnico = sensoUnico, senso = senso, suggerimento = nota)
        }
        if (evita) aggiornaCoinvolte(tratto)
    }

    /** Dopo il primo tocco, il secondo tocco sceglierà la fine del tratto. */
    fun sceltaFine() = cambiaSelezione { it.copy(attesaFine = true, suggerimento = "Tocca il punto dove deve FINIRE il tratto (sulla stessa strada).") }

    private fun aggiornaCoinvolte(linea: Linea) {
        val sel = s.selezione
        val r = rete ?: lettore?.let { l ->
            ReteLocale(l.leggiStrade(Geo.puntoAProgressiva(linea, Geo.lunghezza(linea) / 2), Geo.lunghezza(linea) / 2 + 300))
        } ?: return
        val provvisorio = EvitaTratto(nome = "", linea = linea, larghezzaFascia = sel.larghezza)
        val coinvolte = r.stradeCoinvolte(provvisorio.lineaEffettiva(), sel.larghezza, sel.scelto?.strada).map { it.nomeMostrato }
        aggiorna { it.copy(selezione = it.selezione.copy(coinvolte = coinvolte)) }
    }

    // ---------------- Pezzo del percorso ----------------

    private fun toccoPercorso(p: Punto) {
        val percorso = s.percorsoScelto ?: run {
            cambiaSelezione { it.copy(suggerimento = "Prima calcola un percorso.") }
            return
        }
        val prog = Geo.progressive(percorso.geometria)
        val pr = Geo.proietta(percorso.geometria, p, prog)
        if (pr.distanza > sogliaTocco()) {
            cambiaSelezione { it.copy(suggerimento = "Tocca proprio sulla linea blu del percorso.") }
            return
        }
        val primo = s.selezione.primoSulPercorso
        if (primo == null) {
            cambiaSelezione { it.copy(primoSulPercorso = pr.progressiva, tocco = pr.punto, suggerimento = "Ora tocca sul percorso la FINE del pezzo da evitare.") }
            return
        }
        if (kotlin.math.abs(pr.progressiva - primo) < 20) {
            cambiaSelezione { it.copy(suggerimento = "Il pezzo è troppo corto: tocca un punto più lontano.") }
            return
        }
        val tratto = Geo.sottoLinea(percorso.geometria, primo, pr.progressiva, prog)
        rete = null
        cambiaSelezione { it.copy(linea = tratto, tocco = null, suggerimento = "Pezzo di percorso di ${formattaDistanza(Geo.lunghezza(tratto))} da evitare.") }
        aggiornaCoinvolte(tratto)
    }

    // ---------------- Punto di passaggio ----------------

    private fun toccoPunto(p: Punto) {
        cambiaSelezione { Selezione(tocco = p, inAttesa = true, suggerimento = "Cerco la strada più vicina…", priorita = it.priorita, durata = it.durata) }
        ambito.launch {
            var agganciato: PuntoAgganciato? = null
            var nota: String? = null
            // 1) aggancio vero alla rete del motore di percorso (1 richiesta)
            if (Servizi.haChiave && s.rete) {
                when (val e = withContext(Dispatchers.IO) { Servizi.ors.agganciatore.aggancia(listOf(p), 350.0) }) {
                    is Esito.Ok -> agganciato = e.valore.firstOrNull()
                    is Esito.Errore -> nota = "Aggancio dal servizio non riuscito (${e.messaggio}): uso le strade della mappa."
                }
            }
            // 2) riserva: strade della mappa, senza rete
            if (agganciato == null && lettore != null && (lettore?.zoom() ?: 0.0) >= 13) {
                val r = ReteLocale(lettore!!.leggiStrade(p, 400.0))
                r.candidati(p, 350.0).firstOrNull()?.let { c ->
                    agganciato = PuntoAgganciato(p, c.puntoSuStrada, c.strada.nome, Geo.distanza(p, c.puntoSuStrada))
                }
            }
            val a = agganciato
            cambiaSelezione {
                it.copy(
                    inAttesa = false, agganciato = a,
                    suggerimento = when {
                        a == null -> "Nessuna strada percorribile in auto entro 350 m da qui."
                        else -> listOfNotNull(
                            "Userò il punto su ${a.nomeStrada.ifBlank { "strada senza nome" }}, a ${formattaDistanza(a.spostamento)} dal tocco.",
                            nota,
                        ).joinToString(" ")
                    },
                )
            }
        }
    }

    // ---------------- Disegno di aree ----------------

    private fun toccoDisegno(p: Punto) = cambiaSelezione { sel ->
        when (sel.forma) {
            FormaArea.POLIGONO -> sel.copy(vertici = sel.vertici + p, suggerimento = if (sel.vertici.size + 1 < 3) "Aggiungi altri vertici (almeno 3)." else "Aggiungi vertici o conferma.")
            FormaArea.RETTANGOLO -> sel.copy(
                vertici = if (sel.vertici.size >= 2) listOf(sel.vertici[0], p) else sel.vertici + p,
                suggerimento = if (sel.vertici.isEmpty()) "Tocca l'angolo opposto." else "Puoi toccare di nuovo per spostare l'angolo, o confermare.",
            )
            FormaArea.CERCHIO -> sel.copy(vertici = listOf(p), suggerimento = "Regola il raggio con il cursore, poi conferma.")
        }
    }

    fun togliUltimoVertice() = cambiaSelezione { it.copy(vertici = it.vertici.dropLast(1)) }

    /** Cambia lo scopo dell'area (evita / passa all'interno / attraversa) senza perdere il disegno. */
    fun cambiaObiettivo(o: ObiettivoArea) = aggiorna { it.copy(modo = Modo.Disegno(o)) }

    /** Cambia la forma: il disegno riparte da zero. */
    fun cambiaForma(f: FormaArea) = cambiaSelezione {
        it.copy(forma = f, vertici = emptyList(), suggerimento = when (f) {
            FormaArea.POLIGONO -> "Tocca la mappa per mettere i vertici (almeno 3)."
            FormaArea.RETTANGOLO -> "Tocca un angolo, poi l'angolo opposto."
            FormaArea.CERCHIO -> "Tocca il centro del cerchio."
        })
    }

    /** L'area attualmente disegnata, o null se incompleta. */
    fun areaDisegnata(sel: Selezione = s.selezione): Poligono? = when (sel.forma) {
        FormaArea.POLIGONO -> if (sel.vertici.size >= 3) Aree.correggi(Poligono(sel.vertici)).maxByOrNull { Aree.superficie(it) } else null
        FormaArea.RETTANGOLO -> if (sel.vertici.size == 2) Aree.rettangolo(sel.vertici[0], sel.vertici[1]) else null
        FormaArea.CERCHIO -> sel.vertici.firstOrNull()?.let { Aree.cerchio(it, sel.raggio) }
    }

    // ---------------- Conferma ----------------

    /** Crea il vincolo dalla selezione e lo aggiunge al viaggio. */
    fun conferma() {
        val sel = s.selezione
        val n = s.viaggio.vincoli.size + 1
        val nuovo: Vincolo = when (val m = s.modo) {
            is Modo.Strada -> {
                val linea = sel.linea ?: return
                val nome = sel.scelto?.strada?.nomeMostrato ?: "strada"
                if (m.evita) {
                    EvitaTratto(nome = "Evita $nome", linea = linea, larghezzaFascia = sel.larghezza, priorita = sel.priorita, durata = sel.durata)
                } else {
                    PassaTratto(nome = "Percorri $nome", linea = linea, senso = sel.senso, sensoUnico = sel.sensoUnico != 0, priorita = sel.priorita, durata = sel.durata)
                }
            }
            Modo.PezzoPercorso -> EvitaTratto(
                nome = "Evita pezzo di percorso ($n)", linea = sel.linea ?: return,
                larghezzaFascia = sel.larghezza, priorita = sel.priorita, durata = sel.durata,
            )
            Modo.Punto -> {
                val tocco = sel.tocco ?: return
                val a = sel.agganciato
                PassaPunto(
                    nome = "Passa da " + (a?.nomeStrada?.ifBlank { null } ?: "punto $n"),
                    punto = tocco, agganciato = a?.agganciato, nomeStrada = a?.nomeStrada,
                    priorita = sel.priorita, durata = sel.durata,
                )
            }
            is Modo.Disegno -> {
                val area = areaDisegnata(sel) ?: return
                val centro = if (sel.forma == FormaArea.CERCHIO) sel.vertici.firstOrNull() else null
                val raggio = if (sel.forma == FormaArea.CERCHIO) sel.raggio else null
                when (m.obiettivo) {
                    ObiettivoArea.EVITA -> EvitaArea(
                        nome = "Area da evitare ($n)", forma = sel.forma, poligono = area, centro = centro, raggio = raggio,
                        priorita = sel.priorita, durata = sel.durata,
                    )
                    else -> PassaArea(
                        nome = "${m.obiettivo.etichetta} ($n)", forma = sel.forma, poligono = area,
                        modo = if (m.obiettivo == ObiettivoArea.ATTRAVERSA) ModoArea.ATTRAVERSA else ModoArea.PASSA_ALL_INTERNO,
                        centro = centro, raggio = raggio, priorita = sel.priorita, durata = sel.durata,
                    )
                }
            }
            else -> return
        }
        cambiaViaggio(s.viaggio.copy(vincoli = inserisci(s.viaggio, nuovo)))
        aggiorna { it.copy(modo = Modo.Normale, selezione = Selezione()) }
        avvisa(if (s.esito != null) "Vincolo aggiunto: premi «Ricalcola»." else "Vincolo aggiunto.")
    }

    /**
     * Inserisce un passaggio nella posizione più logica dell'elenco (quella
     * che allunga meno il viaggio in linea d'aria). Le esclusioni vanno in fondo.
     */
    private fun inserisci(v: Viaggio, nuovo: Vincolo): List<Vincolo> {
        val lista = v.vincoli
        if (nuovo.esclusione || v.fermate.size < 2) return lista + nuovo
        fun rappr(x: Vincolo): Punto? = when (x) {
            is PassaPunto -> x.puntoUsato
            is PassaTratto -> Geo.puntoAProgressiva(x.linea, Geo.lunghezza(x.linea) / 2)
            is PassaArea -> Geo.centroRiquadro(x.poligono.esterno)
            else -> null
        }
        val p = rappr(nuovo) ?: return lista + nuovo
        val pian = Servizi.nuovoPianificatore()
        val tratto = pian.trattoConsigliato(v.fermate, p)
        val stessi = lista.filter { !it.esclusione && it.dopoTappa == null && rappr(it)?.let { q -> pian.trattoConsigliato(v.fermate, q) } == tratto }
        val a = v.fermate[tratto].punto
        val b = v.fermate[tratto + 1].punto
        var migliore = stessi.size
        var costo = Double.MAX_VALUE
        for (k in 0..stessi.size) {
            val seq = listOf(a) + stessi.take(k).mapNotNull(::rappr) + p + stessi.drop(k).mapNotNull(::rappr) + b
            val c = seq.zipWithNext().sumOf { (x, y) -> Geo.distanza(x, y) }
            if (c < costo) { costo = c; migliore = k }
        }
        if (stessi.isEmpty()) return lista + nuovo
        val out = lista.toMutableList()
        val indice = if (migliore < stessi.size) out.indexOf(stessi[migliore]) else out.indexOf(stessi.last()) + 1
        out.add(indice, nuovo)
        return out
    }

    // ==================================================================
    // Calcolo del percorso
    // ==================================================================

    /** Sostituisce "la mia posizione" con la posizione GPS attuale. */
    private fun risolvi(v: Viaggio): Viaggio? {
        val p = s.posizione
        fun r(l: Luogo?): Luogo? = if (l != null && l.posizioneAttuale) (p?.let { l.copy(punto = it) } ?: return null) else l
        if (v.fermate.any { it.posizioneAttuale } && p == null) return null
        return v.copy(partenza = r(v.partenza), arrivo = r(v.arrivo), tappe = v.tappe.map { r(it)!! })
    }

    fun calcola() {
        val v0 = s.viaggio
        if (!v0.pronto) { avvisa("Scegli partenza e destinazione."); return }
        if (!Servizi.haChiave) {
            avvisa("Per calcolare i percorsi serve la chiave gratuita di openrouteservice (Impostazioni).")
            apri(Foglio.IMPOSTAZIONI); return
        }
        if (!s.rete) { avvisa("Nessuna connessione: il calcolo dei percorsi richiede internet."); return }
        val v = risolvi(v0) ?: run { avvisa("La tua posizione non è ancora disponibile."); return }
        // Strade della mappa dentro le aree da attraversare (se visibili): candidati senza richieste
        val reteAree = v.vincoliAttivi.filterIsInstance<PassaArea>().takeIf { it.isNotEmpty() }?.let { aree ->
            val l = lettore ?: return@let null
            if (l.zoom() < 13) return@let null
            val strade = aree.flatMap { a ->
                val c = Geo.centroRiquadro(a.poligono.esterno)
                l.leggiStrade(c, a.poligono.esterno.maxOf { Geo.distanza(c, it) } + 50)
            }
            ReteLocale(strade)
        }
        aggiorna { it.copy(calcoloInCorso = true) }
        ambito.launch {
            val pian = Servizi.nuovoPianificatore()
            val esito = withContext(Dispatchers.IO) { pian.calcola(v, Contesto(reteLocale = reteAree)) }
            // Percorso SENZA vincoli, per il confronto (una richiesta in più, solo se cambiano le fermate)
            var iniziale = s.iniziale
            val chiave = v.fermate.joinToString { it.punto.toString() } + v.opzioni
            if (v.vincoliAttivi.isEmpty()) {
                iniziale = null
            } else if (chiave != chiaveIniziale || iniziale == null) {
                val e0 = withContext(Dispatchers.IO) { pian.calcolaSenzaVincoli(v) }
                iniziale = e0.percorso
                if (iniziale != null) chiaveIniziale = chiave
            }
            aggiorna { it.copy(esito = esito, iniziale = iniziale, calcoloInCorso = false, daRicalcolare = false, sceltaAlternativa = 0, puntoProfilo = null) }
            val p = esito.percorso
            when {
                p != null -> _eventi.tryEmit(Evento.Inquadra(p.geometria))
                else -> {
                    apri(Foglio.DETTAGLI)
                    avvisa(esito.errore?.messaggio ?: "Calcolo non riuscito.")
                }
            }
        }
    }

    fun scegliAlternativa(i: Int) = aggiorna { it.copy(sceltaAlternativa = i) }

    // ==================================================================
    // Guida
    // ==================================================================

    fun avviaGuida(context: Context): Boolean {
        val p = s.percorsoScelto ?: run { avvisa("Prima calcola un percorso valido."); return false }
        val v = risolvi(s.viaggio) ?: return false
        if (s.daRicalcolare) avvisa("Attenzione: hai modificato tappe o vincoli dopo l'ultimo calcolo.")
        GuidaCondivisa.avvia(context, v, p, s.esito?.rapporto)
        return true
    }

    // ==================================================================
    // Ricerca indirizzi
    // ==================================================================

    fun testoRicerca(t: String) {
        aggiorna { it.copy(testoRicerca = t, messaggioRicerca = null) }
        lavoroRicerca?.cancel()
        val geo = Servizi.geocodifica ?: return
        // suggerimenti mentre si scrive solo se il fornitore li permette
        if (!geo.suggerimentiConsentiti || t.trim().length < 3) return
        lavoroRicerca = ambito.launch {
            delay(450) // aspettiamo che l'utente smetta di scrivere (risparmia richieste)
            esegui { geo.suggerisci(t.trim(), vicino()) }
        }
    }

    fun cercaOra() {
        val t = s.testoRicerca.trim()
        if (t.isEmpty()) return
        val geo = Servizi.geocodifica ?: run {
            aggiorna { it.copy(messaggioRicerca = "Nessun servizio di ricerca: inserisci la chiave openrouteservice o attiva Nominatim nelle Impostazioni.") }
            return
        }
        lavoroRicerca?.cancel()
        lavoroRicerca = ambito.launch { esegui { geo.cerca(t, vicino()) } }
    }

    private fun vicino(): Punto? = s.posizione ?: lettore?.centroMappa()

    private suspend fun esegui(f: () -> Esito<List<RisultatoRicerca>>) {
        aggiorna { it.copy(ricercaInCorso = true) }
        val e = withContext(Dispatchers.IO) { f() }
        aggiorna {
            when (e) {
                is Esito.Ok -> it.copy(ricercaInCorso = false, risultatiRicerca = e.valore, messaggioRicerca = if (e.valore.isEmpty()) "Nessun risultato." else null)
                is Esito.Errore -> it.copy(ricercaInCorso = false, messaggioRicerca = e.messaggio)
            }
        }
    }

    fun scegliRisultato(r: RisultatoRicerca) {
        val nome = listOf(r.nome, r.dettaglio).filter { it.isNotBlank() }.joinToString(", ")
        impostaLuogo(s.scopoRicerca, Luogo(r.punto, nome))
        apri(null)
    }

    fun scegliLuogo(l: Luogo) {
        impostaLuogo(s.scopoRicerca, l.copy(posizioneAttuale = false))
        apri(null)
    }

    // ==================================================================
    // Preferiti, percorsi salvati, cronologia
    // ==================================================================

    fun aggiungiPreferito(l: Luogo) {
        Servizi.archivio.modifica { d -> d.copy(preferiti = (listOf(l) + d.preferiti).distinctBy { it.punto }) }
        avvisa("Aggiunto ai preferiti.")
    }

    fun rimuoviPreferito(l: Luogo) = Servizi.archivio.modifica { d -> d.copy(preferiti = d.preferiti - l) }

    private fun aggiungiCronologia(l: Luogo) {
        if (l.posizioneAttuale) return
        Servizi.archivio.modifica { d -> d.copy(cronologia = (listOf(l) + d.cronologia).distinctBy { it.nome + it.punto }.take(30)) }
    }

    fun svuotaCronologia() = Servizi.archivio.modifica { it.copy(cronologia = emptyList()) }

    fun salvaPercorso(nome: String) {
        val n = nome.ifBlank { "Percorso del " + java.text.SimpleDateFormat("d/M HH:mm", java.util.Locale.ITALY).format(java.util.Date()) }
        Servizi.archivio.modifica { d -> d.copy(percorsi = listOf(PercorsoSalvato(n, s.viaggio, System.currentTimeMillis())) + d.percorsi) }
        avvisa("Percorso «$n» salvato.")
    }

    fun caricaPercorso(p: PercorsoSalvato) {
        cambiaViaggio(p.viaggio)
        aggiorna { it.copy(esito = null, iniziale = null, foglio = null, daRicalcolare = false) }
        _eventi.tryEmit(Evento.Inquadra(p.viaggio.fermate.map { it.punto }))
    }

    fun eliminaPercorso(p: PercorsoSalvato) = Servizi.archivio.modifica { d -> d.copy(percorsi = d.percorsi - p) }

    // ==================================================================
    // Impostazioni e posizione
    // ==================================================================

    fun cambiaImpostazioni(f: (Impostazioni) -> Impostazioni) {
        val prima = impostazioni
        Servizi.archivio.modifica { it.copy(impostazioni = f(it.impostazioni)) }
        if (prima.chiaveOrs != impostazioni.chiaveOrs || prima.serverOrs != impostazioni.serverOrs) Servizi.ricreaFornitori()
        aggiorna { it.copy() } // forza il ridisegno
        _stato.value = s.copy(viaggio = s.viaggio)
    }

    fun nuovaPosizione(p: Punto) = aggiorna { it.copy(posizione = p) }

    /** Prova della chiave: un percorso brevissimo (consuma 1 richiesta). */
    fun provaChiave() {
        val c = lettore?.centroMappa() ?: Punto(45.4064, 11.8768)
        ambito.launch {
            val e = withContext(Dispatchers.IO) {
                Servizi.ors.motore.calcola(
                    com.ric.navigatore.nucleo.modello.RichiestaPercorso(
                        listOf(
                            com.ric.navigatore.nucleo.modello.PuntoRichiesta(c, com.ric.navigatore.nucleo.modello.TipoPunto.PARTENZA),
                            com.ric.navigatore.nucleo.modello.PuntoRichiesta(Punto(c.lat + 0.003, c.lon + 0.003), com.ric.navigatore.nucleo.modello.TipoPunto.ARRIVO),
                        ),
                    ),
                )
            }
            avvisa(
                when (e) {
                    is Esito.Ok -> "Chiave valida: openrouteservice risponde correttamente."
                    is Esito.Errore -> "Prova non riuscita: ${e.messaggio}"
                },
            )
        }
    }

    // ==================================================================
    // Disegno sulla mappa
    // ==================================================================

    /** Le fermate da disegnare: A (partenza), 1, 2… (tappe), B (arrivo). */
    fun fermateDaDisegnare(v: Viaggio): List<Pair<Punto, String>> =
        listOfNotNull(v.partenza?.let { it.punto to "A" }) +
            v.tappe.mapIndexed { i, t -> t.punto to "${i + 1}" } +
            listOfNotNull(v.arrivo?.let { it.punto to "B" })

    /** Percorsi alternativi (non scelti) da mostrare in grigio. */
    fun altriPercorsi(st: StatoUi): List<Percorso> {
        val e = st.esito ?: return emptyList()
        val tutti = listOfNotNull(e.percorso) + e.alternative
        return tutti.filterIndexed { i, _ -> i != st.sceltaAlternativa }
    }
}
