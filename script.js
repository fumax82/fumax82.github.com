document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById("container");
    const centeredObject = document.getElementById("centered-object");

    // Funzione per inizializzare gli eventi di trascinamento
    function initializeDragEvents(row) {
        let selectedRow = null;
        let startX;

        row.addEventListener('mousedown', e => {
            selectedRow = row;
            startX = e.pageX;
            row.classList.add('dragging');
            row.querySelectorAll('.tile').forEach(tile => tile.classList.add('pulsating'));
        });

        row.addEventListener('mousemove', e => {
            if (!selectedRow) return;
            const dx = e.pageX - startX;
            selectedRow.style.transform = `translateX(${dx}px)`;
        });

        row.addEventListener('mouseup', () => {
            if (!selectedRow) return;
            selectedRow.classList.remove('dragging');
            selectedRow.querySelectorAll('.tile').forEach(tile => tile.classList.remove('pulsating'));
            setTimeout(() => selectedRow.style.transform = '', 500); // Resetta la trasformazione dopo 0.5 secondi
            selectedRow = null;
        });
    }

    // Funzione per creare una settimana di tiles
    const createWeek = (week = undefined) => {
        let row = document.createElement("div");
        row.classList.add("row");

        for (let i = 0; i < 7; i++) {
            let tile = document.createElement("div");
            tile.classList.add("tile");
            tile.innerHTML = `Giorno ${i} \n sett. ${week}`;

            tile.addEventListener("mouseup", (ev) => {
                if (ev.button == 0) {
                    tile.classList.toggle("open");
                } else if (ev.button == 1) {
                    toggleTileState(tile);
                }
            });

            // Aggiungi le barre e le etichette al tile
            addBarsAndLabelsToTile(tile);

            row.append(tile);
        }

        container.append(row);
        initializeDragEvents(row); // Inizializza gli eventi di trascinamento per la nuova riga
    };

    // Creazione delle settimane
    createWeek("A");
    createWeek("B");
    createWeek("C");
    createWeek("D");
    createWeek("E");

    // Funzione per aggiustare le dimensioni di #centered-object
    const adjustCenteredObjectSize = () => {
        let totalWidth = 0;
        let totalHeight = 0;

        const rows = container.querySelectorAll(".row");
        rows.forEach(row => {
            totalHeight += row.offsetHeight; // Altezza di ogni riga

            let rowWidth = 0;
            row.querySelectorAll(".tile").forEach(tile => {
                rowWidth += tile.offsetWidth; // Larghezza di ogni tile
            });

            if (rowWidth > totalWidth) {
                totalWidth = rowWidth; // Aggiorna la larghezza massima se necessario
            }
        });

        // Imposta le dimensioni di #centered-object in base alle dimensioni totali
        centeredObject.style.width = `${totalWidth}px`;
        centeredObject.style.height = `${totalHeight}px`;
    };

    // Funzione per aggiungere barre e etichette a un tile
    function addBarsAndLabelsToTile(tile) {
        const events = ['Evento 1', 'Evento 2', 'Evento 3'];
        const colors = ['red', 'green', 'blue'];

        events.forEach((event, index) => {
            const bar = document.createElement('div');
            bar.classList.add('bar', `${colors[index]}-bar`);
            tile.appendChild(bar);

            const label = document.createElement('div');
            label.classList.add('label');
            label.textContent = event;
            tile.appendChild(label);
        });
    }

// Funzione per gestire il click del tasto centrale del mouse sui tiles
function handleMouseDown(event) {
    if (event.button === 1) { // Tasto centrale
        const tile = event.target.closest('.tile');
        if (tile && tile.classList.contains('extended')) {
            tile.classList.add('tile-ultra-extended');
        }
    }
}

function handleMouseUp(event) {
    // Nessuna azione necessaria qui per il rilascio del mouse
}

function handleMouseLeave(event) {
    // Nessuna azione necessaria qui per il cursore che lascia il tile
}


    // Aggiungi i gestori eventi a tutti i tiles
    const tiles = document.querySelectorAll('.tile');
    tiles.forEach(tile => {
        tile.addEventListener('mousedown', handleMouseDown);
        tile.addEventListener('mouseup', handleMouseUp);
        tile.addEventListener('mouseleave', handleMouseLeave);
    });

    // Aspetta che tutti gli elementi vengano caricati (ad esempio, immagini)
    window.onload = () => {
        adjustCenteredObjectSize();
    };

    // Prevenire il comportamento di trascinamento predefinito del browser
    document.addEventListener('dragstart', e => e.preventDefault());
});

 function toggleTileState(tile) {
    let row = tile.parentElement;
    let allTiles = row.querySelectorAll('.tile');

    allTiles.forEach(t => {
        if (t.classList.contains('tile-ultra-extended')) {
            t.classList.remove('tile-ultra-extended');
            t.classList.add('extended');
        } else if (t.classList.contains('extended')) {
            t.classList.remove('extended');
            t.classList.add('open');
        } else if (t.classList.contains('open')) {
            t.classList.remove('open');
            t.classList.add('tile-ultra-extended');
        }
    });
}
