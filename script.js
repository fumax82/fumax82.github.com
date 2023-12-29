
// Modification 1: Visualizzazione Limitata ai Soli Rettangoli Chiusi

// Add a state attribute to each rectangle
document.querySelectorAll('.rectangle').forEach(rect => {
    rect.setAttribute('data-state', 'closed'); // default state is closed
});

// Modify resetAllRectangles function to only reset closed rectangles
function resetAllRectangles() {
    document.querySelectorAll('.rectangle[data-state="closed"]').forEach(rect => {
        rect.style.width = '100px';
        rect.style.display = ''; // Show the rectangle if it was hidden
    });
}

// Add logic to hide rectangles that are not active
function hideInactiveRectangles() {
    document.querySelectorAll('.rectangle[data-state="closed"]').forEach(rect => {
        rect.style.display = 'none'; // Hide the rectangle
    });
}

// Modification 2: Scrolling Orizzontale per Singola Riga

// Function to enable horizontal drag scrolling for each row
function enableHorizontalScrolling() {
    document.querySelectorAll('.row').forEach(row => {
        let isDown = false;
        let startX;
        let scrollLeft;

        row.addEventListener('mousedown', (e) => {
            isDown = true;
            row.classList.add('active');
            startX = e.pageX - row.offsetLeft;
            scrollLeft = row.scrollLeft;
        });

        row.addEventListener('mouseleave', () => {
            isDown = false;
            row.classList.remove('active');
        });

        row.addEventListener('mouseup', () => {
            isDown = false;
            row.classList.remove('active');
        });

        row.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - row.offsetLeft;
            const walk = (x - startX) * 3; // scroll-fast
            row.scrollLeft = scrollLeft - walk;
        });
    });
}

// Call the function to enable horizontal scrolling on rows
enableHorizontalScrolling();

// Modification 3: Comportamento Dinamico dei Clic sui Rettangoli

// Function to toggle the size of a rectangle
function toggleRectangleSize(rectangle) {
    const currentState = rectangle.getAttribute('data-state');
    const newState = currentState === 'closed' ? 'open' : 'closed';
    rectangle.setAttribute('data-state', newState);

    if (newState === 'open') {
        rectangle.style.width = '400px'; // Example expanded size
    } else {
        rectangle.style.width = '100px'; // Original size
    }
}

// Add click event to each rectangle
document.querySelectorAll('.rectangle').forEach(rectangle => {
    rectangle.addEventListener('click', (e) => {
        toggleRectangleSize(rectangle);
        e.stopPropagation(); // Prevent event from bubbling up to the row
    });
});

// Add click event on the body to reset all rectangles in a row if clicked outside
document.body.addEventListener('click', (e) => {
    const clickedElement = e.target;
    
    if (!clickedElement.classList.contains('rectangle')) {
        document.querySelectorAll('.row').forEach(row => {
            row.querySelectorAll('.rectangle').forEach(rectangle => {
                if (rectangle.getAttribute('data-state') === 'open') {
                    toggleRectangleSize(rectangle);
                }
            });
        });
    }
});

// Ensuring that the new functionalities do not interfere with existing graphic effects

// Keep existing functionalities related to graphic effects intact
// For example, functions like applyFilterToAll and clearAllFilters remain unchanged

// Ensure that the new functionalities are integrated smoothly with existing ones
// This includes checking that the state changes of rectangles do not conflict with graphic effects

// Pseudocode for final integration check:
/*
function checkGraphicEffectsIntegrity() {
    // Check if the new state changes (open/close) of rectangles interfere with existing graphic effects
    // Ensure that functions like applyFilterToAll and clearAllFilters work as expected with the new functionalities
    // Perform tests to confirm that graphic effects are applied correctly even when rectangles change state
}
*/

// Call the check function (this is a placeholder, actual implementation may vary)
// checkGraphicEffectsIntegrity();

// Calcola la larghezza totale della riga considerando i rettangoli e i gap
function calculateRowWidth() {
    let rowWidth = 0;
    document.querySelectorAll('.row').forEach(row => {
        let rectangles = row.querySelectorAll('.rectangle');
        rowWidth = (rectangles.length * 100) + ((rectangles.length - 1) * 5); // larghezza rettangolo + gap
        row.style.width = rowWidth + 'px';
    });
}

// Aggiorna la funzione di scorrimento per limitare il movimento a destra/sinistra
function updateScrolling() {
    // Aggiungi qui la logica per limitare lo scorrimento
    // ...
}

// Chiamata alla funzione per calcolare la larghezza iniziale della riga
calculateRowWidth();

// Aggiornamento della funzione di scorrimento per consentire il movimento in entrambe le direzioni
// e limitare il movimento per evitare spazi vuoti all'inizio e alla fine della riga

// Assumiamo che una funzione di scorrimento esista già e la modifichiamo
function updateFlexibleScrollingLogic() {
    // Qui si aggiunge la logica per gestire lo scorrimento flessibile
    // ...
}

// Chiamata alla funzione aggiornata per il controllo dello scorrimento flessibile
updateFlexibleScrollingLogic();
