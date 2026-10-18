package com.ric.navigatore.ui

import com.ric.navigatore.nucleo.geo.Linea
import com.ric.navigatore.nucleo.geo.Punto
import com.ric.navigatore.nucleo.modello.Durata
import com.ric.navigatore.nucleo.modello.FormaArea
import com.ric.navigatore.nucleo.modello.Percorso
import com.ric.navigatore.nucleo.modello.Priorita
import com.ric.navigatore.nucleo.modello.Senso
import com.ric.navigatore.nucleo.modello.Viaggio
import com.ric.navigatore.nucleo.pianificazione.EsitoPianificazione
import com.ric.navigatore.nucleo.servizi.PuntoAgganciato
import com.ric.navigatore.nucleo.servizi.RisultatoRicerca
import com.ric.navigatore.nucleo.strade.Candidato

/** Per quale fermata si sta scegliendo un luogo. */
enum class Scopo(val etichetta: String) { PARTENZA("Partenza"), ARRIVO("Destinazione"), TAPPA("Tappa") }

/** Cosa si vuole fare con un'area disegnata. */
enum class ObiettivoArea(val etichetta: String) { EVITA("Evita l'area"), PASSA_ALL_INTERNO("Passa all'interno"), ATTRAVERSA("Attraversa") }

/** Cosa fa il prossimo tocco sulla mappa. */
sealed class Modo {
    /** Nessuna azione particolare: un tocco lungo apre il menu del punto. */
    data object Normale : Modo()

    /** Scegli la partenza, la destinazione o una tappa toccando la mappa. */
    data class SceltaPunto(val scopo: Scopo) : Modo()

    /** Tocca una strada (da evitare o da percorrere). */
    data class Strada(val evita: Boolean) : Modo()

    /** Tocca due punti del percorso calcolato: il pezzo in mezzo sarà evitato. */
    data object PezzoPercorso : Modo()

    /** Tocca un punto da cui passare. */
    data object Punto : Modo()

    /** Disegna un'area. */
    data class Disegno(val obiettivo: ObiettivoArea) : Modo()
}

/** Dati della selezione in corso (anteprima prima della conferma). */
data class Selezione(
    /** Strade vicine al tocco, fra cui scegliere. */
    val candidati: List<Candidato> = emptyList(),
    val scelto: Candidato? = null,
    /** Vero se il prossimo tocco imposta la FINE del tratto. */
    val attesaFine: Boolean = false,
    /** Il tratto selezionato (strada o pezzo di percorso). */
    val linea: Linea? = null,
    /** Strade che verrebbero bloccate anche loro dalla fascia (avviso). */
    val coinvolte: List<String> = emptyList(),
    val larghezza: Double = 10.0,
    val senso: Senso = Senso.DA_INIZIO_A_FINE,
    /** 1/-1 se la mappa dice che è a senso unico, 0 altrimenti. */
    val sensoUnico: Int = 0,
    /** Per "Passa da qui": tocco e punto agganciato alla strada. */
    val tocco: Punto? = null,
    val agganciato: PuntoAgganciato? = null,
    /** Disegno di aree. */
    val forma: FormaArea = FormaArea.POLIGONO,
    val vertici: List<Punto> = emptyList(),
    val raggio: Double = 300.0,
    /** Primo punto scelto sul percorso (modo PezzoPercorso). */
    val primoSulPercorso: Double? = null,
    val priorita: Priorita = Priorita.OBBLIGATORIO,
    val durata: Durata = Durata.SOLO_QUESTO_VIAGGIO,
    val inAttesa: Boolean = false,
    /** Istruzione o avviso da mostrare nel pannello. */
    val suggerimento: String? = null,
)

/** Fogli (pannelli che salgono dal basso) e schermate a tutto schermo. */
enum class Foglio { MENU_EVITA, MENU_PASSA, VINCOLI, TAPPE, DETTAGLI, SALVATI, RICERCA, IMPOSTAZIONI, INFORMAZIONI }

/** Stato completo della schermata di pianificazione. */
data class StatoUi(
    val viaggio: Viaggio = Viaggio(),
    val esito: EsitoPianificazione? = null,
    /** Percorso senza vincoli, per il confronto "prima / dopo". */
    val iniziale: Percorso? = null,
    /** 0 = percorso principale, 1.. = alternative. */
    val sceltaAlternativa: Int = 0,
    /** Vero se tappe o vincoli sono cambiati dopo l'ultimo calcolo. */
    val daRicalcolare: Boolean = false,
    val calcoloInCorso: Boolean = false,
    val modo: Modo = Modo.Normale,
    val selezione: Selezione = Selezione(),
    val foglio: Foglio? = null,
    val scopoRicerca: Scopo = Scopo.ARRIVO,
    val testoRicerca: String = "",
    val risultatiRicerca: List<RisultatoRicerca> = emptyList(),
    val ricercaInCorso: Boolean = false,
    val messaggioRicerca: String? = null,
    /** Menu del tocco lungo sulla mappa. */
    val menuPunto: Punto? = null,
    val posizione: Punto? = null,
    val puoAnnullare: Boolean = false,
    val puoRipristinare: Boolean = false,
    val rete: Boolean = true,
) {
    /** Il percorso attualmente scelto (principale o alternativa). */
    val percorsoScelto: Percorso?
        get() = esito?.percorso?.let { p -> if (sceltaAlternativa == 0) p else esito.alternative.getOrNull(sceltaAlternativa - 1) ?: p }
}
