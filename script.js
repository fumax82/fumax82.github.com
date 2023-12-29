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
                    let row = tile.parentElement;
                    let allTiles = row.querySelectorAll('.tile');
                    allTiles.forEach(t => {
                        t.classList.toggle("extended");
                        t.style.backgroundColor = t.classList.contains("extended") ? "lime" : "bisque";
                    });
                }
            });

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

    // Aspetta che tutti gli elementi vengano caricati (ad esempio, immagini)
    window.onload = () => {
        adjustCenteredObjectSize();
    };

    // Prevenire il comportamento di trascinamento predefinito del browser
    document.addEventListener('dragstart', e => e.preventDefault());
});
