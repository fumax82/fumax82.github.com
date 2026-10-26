/*
 * CartellaFormazione.kt
 * Tutte le operazioni sui file della cartella condivisa "Formazione":
 * creare la sottocartella di un video, salvare foto e testi, rinominare,
 * eliminare e ritrovare un video già elaborato.
 *
 * La cartella si raggiunge con lo "Storage Access Framework" di Android
 * (DocumentFile): l'utente la sceglie una volta e l'app ottiene il permesso
 * di scriverci per sempre, senza permessi speciali.
 *
 * Struttura di una sottocartella:
 *   AAAA-MM-GG_titolo/
 *     tutorial_input.md
 *     foto/
 *     _archivio/indice.json, audio_completo.m4a, foto_originali/
 */
package it.formazione.videotutorial.archivio

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.documentfile.provider.DocumentFile
import it.formazione.videotutorial.modello.ProgettoVideo
import it.formazione.videotutorial.modello.StatoAudio
import it.formazione.videotutorial.testo.GeneratoreTutorialInput
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.Json
import java.io.File

class CartellaFormazione(private val context: Context, val uriRadice: Uri) {

    companion object {
        // Nomi fissi di file e cartelle
        const val FILE_TUTORIAL = "tutorial_input.md"
        const val CARTELLA_FOTO = "foto"
        const val CARTELLA_ARCHIVIO = "_archivio"
        const val CARTELLA_ORIGINALI = "foto_originali"
        const val FILE_INDICE = "indice.json"
        const val FILE_AUDIO = "audio_completo.m4a"

        // Qualità JPG (da 0 a 100)
        const val QUALITA_FOTO_RIDOTTA = 85
        const val QUALITA_FOTO_ORIGINALE = 95

        /**
         * Tipo dei file di testo e audio. Con "application/octet-stream" Android
         * non aggiunge estensioni al nome (es. non crea "indice.json.txt").
         */
        private const val TIPO_GENERICO = "application/octet-stream"
        private const val TIPO_JPG = "image/jpeg"

        /** Formato di indice.json: leggibile e tollerante verso campi nuovi o mancanti. */
        val json = Json {
            prettyPrint = true
            ignoreUnknownKeys = true
            encodeDefaults = true
        }

        /** Lucchetto: evita che due salvataggi di indice.json avvengano insieme. */
        val lucchetto = Mutex()
    }

    private val radice: DocumentFile? = DocumentFile.fromTreeUri(context, uriRadice)

    /** Nome della cartella condivisa da mostrare all'utente. */
    val nome: String get() = radice?.name ?: "(cartella sconosciuta)"

    /** true se la cartella esiste ancora e l'app può scriverci. */
    fun accessibile(): Boolean = radice?.let { it.exists() && it.canWrite() } == true

    // ---------------------------------------------------------------------
    // Progetti (sottocartelle dei video)
    // ---------------------------------------------------------------------

    /** Cerca tra le sottocartelle un progetto con questa impronta; null se non c'è. */
    fun cercaProgetto(impronta: String): ProgettoVideo? =
        elencoProgetti().firstOrNull { it.impronta == impronta }

    /**
     * Tutti i progetti presenti nella cartella condivisa (le sottocartelle
     * con un _archivio/indice.json), dal più recente al più vecchio.
     */
    fun elencoProgetti(): List<ProgettoVideo> {
        val cartelle = radice?.listFiles()?.filter { it.isDirectory } ?: return emptyList()
        return cartelle.mapNotNull { cartella ->
            val indice = cartella.findFile(CARTELLA_ARCHIVIO)?.findFile(FILE_INDICE) ?: return@mapNotNull null
            val progetto = leggiProgetto(indice) ?: return@mapNotNull null
            // Il nome reale della cartella vince (se l'utente l'ha rinominata).
            progetto.copy(nomeCartella = cartella.name ?: progetto.nomeCartella)
        }.sortedWith(compareByDescending<ProgettoVideo> { it.scheda.data }.thenByDescending { it.nomeCartella })
    }

    /**
     * Legge una foto ridotta di foto/ in versione piccola (lato lungo circa
     * "latoMassimo" pixel), per le anteprime della Home. Null se non c'è.
     */
    fun leggiAnteprima(nomeCartella: String, nomeFile: String, latoMassimo: Int): Bitmap? {
        val file = cartellaProgetto(nomeCartella)?.findFile(CARTELLA_FOTO)?.findFile(nomeFile) ?: return null
        val resolver = context.contentResolver
        // 1. legge solo le dimensioni, 2. legge l'immagine già rimpicciolita
        val dimensioni = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        resolver.openInputStream(file.uri)?.use { BitmapFactory.decodeStream(it, null, dimensioni) }
        var riduzione = 1
        while (maxOf(dimensioni.outWidth, dimensioni.outHeight) / (riduzione * 2) >= latoMassimo) riduzione *= 2
        val opzioni = BitmapFactory.Options().apply { inSampleSize = riduzione }
        return resolver.openInputStream(file.uri)?.use { BitmapFactory.decodeStream(it, null, opzioni) }
    }

    /**
     * Crea la sottocartella di un video nuovo con le sue cartelle interne.
     * Se il nome esiste già aggiunge _2, _3... Restituisce il nome usato.
     */
    fun creaCartellaProgetto(nomeBase: String): String {
        val r = radice ?: error("Cartella condivisa non disponibile")
        var nome = nomeBase
        var contatore = 2
        while (r.findFile(nome) != null) {
            nome = "${nomeBase}_$contatore"
            contatore++
        }
        val cartella = r.createDirectory(nome) ?: error("Impossibile creare la cartella $nome")
        cartella.createDirectory(CARTELLA_FOTO)
        val archivio = cartella.createDirectory(CARTELLA_ARCHIVIO)
            ?: error("Impossibile creare $CARTELLA_ARCHIVIO")
        archivio.createDirectory(CARTELLA_ORIGINALI)
        return cartella.name ?: nome
    }

    /**
     * Riscrive indice.json e tutorial_input.md con i dati attuali del progetto.
     * Se su disco c'è uno stato dell'audio più recente (scritto dal lavoro in
     * sottofondo), tiene quello.
     */
    suspend fun salvaProgetto(progetto: ProgettoVideo) = lucchetto.withLock {
        val suDisco = cartellaArchivio(progetto.nomeCartella)?.findFile(FILE_INDICE)?.let { leggiProgetto(it) }
        val daSalvare = if (suDisco != null && suDisco.impronta == progetto.impronta &&
            suDisco.statoAudioAggiornatoMs > progetto.statoAudioAggiornatoMs
        ) {
            progetto.copy(statoAudio = suDisco.statoAudio, statoAudioAggiornatoMs = suDisco.statoAudioAggiornatoMs)
        } else {
            progetto
        }
        salvaProgettoSenzaLucchetto(daSalvare)
    }

    /**
     * Aggiorna solo lo stato dell'audio leggendo indice.json dal disco.
     * Usata dal lavoro in sottofondo, che può finire anche ad app chiusa.
     */
    suspend fun aggiornaStatoAudio(nomeCartella: String, stato: StatoAudio) = lucchetto.withLock {
        val indice = cartellaArchivio(nomeCartella)?.findFile(FILE_INDICE) ?: return@withLock
        val progetto = leggiProgetto(indice) ?: return@withLock
        salvaProgettoSenzaLucchetto(
            progetto.copy(statoAudio = stato, statoAudioAggiornatoMs = System.currentTimeMillis())
        )
    }

    private fun salvaProgettoSenzaLucchetto(progetto: ProgettoVideo) {
        val cartella = cartellaProgetto(progetto.nomeCartella)
            ?: error("Cartella ${progetto.nomeCartella} non trovata")
        val archivio = cartella.findFile(CARTELLA_ARCHIVIO)
            ?: cartella.createDirectory(CARTELLA_ARCHIVIO)
            ?: error("Impossibile creare $CARTELLA_ARCHIVIO")
        scriviTesto(archivio, FILE_INDICE, json.encodeToString(ProgettoVideo.serializer(), progetto))
        scriviTesto(cartella, FILE_TUTORIAL, GeneratoreTutorialInput.genera(progetto))
    }

    // ---------------------------------------------------------------------
    // Foto
    // ---------------------------------------------------------------------

    /**
     * Salva una foto in due copie con lo stesso nome:
     * - foto/                     ridotta (lato lungo = latoLungoPx), JPG 85%
     * - _archivio/foto_originali/ piena risoluzione, JPG 95%
     */
    fun salvaFoto(nomeCartella: String, nomeFile: String, originale: Bitmap, latoLungoPx: Int) {
        val cartella = cartellaProgetto(nomeCartella) ?: error("Cartella $nomeCartella non trovata")
        val foto = cartella.findFile(CARTELLA_FOTO) ?: cartella.createDirectory(CARTELLA_FOTO)
            ?: error("Impossibile creare $CARTELLA_FOTO")
        val originali = cartellaOriginali(cartella) ?: error("Impossibile creare $CARTELLA_ORIGINALI")

        scriviJpg(originali, nomeFile, originale, QUALITA_FOTO_ORIGINALE)
        val ridotta = ridimensiona(originale, latoLungoPx)
        scriviJpg(foto, nomeFile, ridotta, QUALITA_FOTO_RIDOTTA)
        if (ridotta !== originale) ridotta.recycle()
    }

    /** Rinomina una foto sia in foto/ sia in foto_originali/. */
    fun rinominaFoto(nomeCartella: String, vecchioNome: String, nuovoNome: String) {
        val cartella = cartellaProgetto(nomeCartella) ?: return
        listOfNotNull(cartella.findFile(CARTELLA_FOTO), cartellaOriginali(cartella)).forEach { dir ->
            dir.findFile(vecchioNome)?.renameTo(nuovoNome)
        }
    }

    /** Elimina una foto sia da foto/ sia da foto_originali/. */
    fun eliminaFoto(nomeCartella: String, nomeFile: String) {
        val cartella = cartellaProgetto(nomeCartella) ?: return
        listOfNotNull(cartella.findFile(CARTELLA_FOTO), cartellaOriginali(cartella)).forEach { dir ->
            dir.findFile(nomeFile)?.delete()
        }
    }

    // ---------------------------------------------------------------------
    // Archivio (audio)
    // ---------------------------------------------------------------------

    /** true se in _archivio c'è già un file con questo nome e non è vuoto. */
    fun esisteInArchivio(nomeCartella: String, nomeFile: String): Boolean {
        val file = cartellaArchivio(nomeCartella)?.findFile(nomeFile) ?: return false
        return file.length() > 0
    }

    /** Copia un file del telefono (es. l'audio estratto) dentro _archivio. */
    fun copiaInArchivio(nomeCartella: String, nomeFile: String, sorgente: File) {
        val archivio = cartellaArchivio(nomeCartella) ?: error("Cartella $CARTELLA_ARCHIVIO non trovata")
        archivio.findFile(nomeFile)?.delete()
        val destinazione = archivio.createFile(TIPO_GENERICO, nomeFile)
            ?: error("Impossibile creare $nomeFile")
        context.contentResolver.openOutputStream(destinazione.uri, "w")?.use { uscita ->
            sorgente.inputStream().use { it.copyTo(uscita) }
        } ?: error("Impossibile scrivere $nomeFile")
    }

    // ---------------------------------------------------------------------
    // Funzioni di supporto
    // ---------------------------------------------------------------------

    private fun cartellaProgetto(nome: String): DocumentFile? = radice?.findFile(nome)

    private fun cartellaArchivio(nomeCartella: String): DocumentFile? =
        cartellaProgetto(nomeCartella)?.findFile(CARTELLA_ARCHIVIO)

    /** Cartella _archivio/foto_originali (la crea se manca). */
    private fun cartellaOriginali(cartella: DocumentFile): DocumentFile? {
        val archivio = cartella.findFile(CARTELLA_ARCHIVIO)
            ?: cartella.createDirectory(CARTELLA_ARCHIVIO) ?: return null
        return archivio.findFile(CARTELLA_ORIGINALI) ?: archivio.createDirectory(CARTELLA_ORIGINALI)
    }

    /** Legge e interpreta un indice.json; null se il file è illeggibile. */
    private fun leggiProgetto(indice: DocumentFile): ProgettoVideo? = try {
        val testo = context.contentResolver.openInputStream(indice.uri)?.use {
            it.readBytes().toString(Charsets.UTF_8)
        }
        testo?.let { json.decodeFromString(ProgettoVideo.serializer(), it) }
    } catch (e: Exception) {
        null
    }

    /** Scrive (o riscrive da capo) un file di testo UTF-8. */
    private fun scriviTesto(cartella: DocumentFile, nome: String, testo: String) {
        val file = cartella.findFile(nome) ?: cartella.createFile(TIPO_GENERICO, nome)
            ?: error("Impossibile creare $nome")
        val dati = testo.toByteArray(Charsets.UTF_8)
        val uscita = try {
            // "wt" = scrivi da capo, cancellando il contenuto precedente
            context.contentResolver.openOutputStream(file.uri, "wt")
        } catch (e: Exception) {
            null
        }
        if (uscita != null) {
            uscita.use { it.write(dati) }
        } else {
            // Alcune app di archiviazione non conoscono "wt": si ricrea il file.
            file.delete()
            val nuovo = cartella.createFile(TIPO_GENERICO, nome) ?: error("Impossibile creare $nome")
            context.contentResolver.openOutputStream(nuovo.uri, "w")?.use { it.write(dati) }
                ?: error("Impossibile scrivere $nome")
        }
    }

    /** Salva un'immagine come JPG, sostituendo un eventuale file con lo stesso nome. */
    private fun scriviJpg(cartella: DocumentFile, nome: String, immagine: Bitmap, qualita: Int) {
        cartella.findFile(nome)?.delete()
        val file = cartella.createFile(TIPO_JPG, nome) ?: error("Impossibile creare $nome")
        context.contentResolver.openOutputStream(file.uri, "w")?.use { uscita ->
            immagine.compress(Bitmap.CompressFormat.JPEG, qualita, uscita)
        } ?: error("Impossibile scrivere $nome")
    }

    /** Riduce l'immagine in modo che il lato lungo sia al massimo "latoLungo" pixel. */
    private fun ridimensiona(immagine: Bitmap, latoLungo: Int): Bitmap {
        val lato = maxOf(immagine.width, immagine.height)
        if (lato <= latoLungo) return immagine
        val scala = latoLungo.toFloat() / lato
        val larghezza = (immagine.width * scala).toInt().coerceAtLeast(1)
        val altezza = (immagine.height * scala).toInt().coerceAtLeast(1)
        return Bitmap.createScaledBitmap(immagine, larghezza, altezza, true)
    }
}
