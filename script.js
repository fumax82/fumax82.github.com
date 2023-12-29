document.querySelectorAll('.rectangle').forEach(rect => {
    rect.setAttribute('data-state', 'closed');
});

function resetAllRectangles() {
    document.querySelectorAll('.rectangle[data-state="closed"]').forEach(rect => {
        rect.style.width = '100px';
        rect.style.display = '';
    });
}

function hideInactiveRectangles() {
    document.querySelectorAll('.rectangle[data-state="closed"]').forEach(rect => {
        rect.style.display = 'none';
    });
}

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
            const walk = (x - startX) * 3;
            row.scrollLeft = scrollLeft - walk;
        });
    });
}

enableHorizontalScrolling();

function toggleRectangleSize(rectangle) {
    const currentState = rectangle.getAttribute('data-state');
    const newState = currentState === 'closed' ? 'open' : 'closed';
    rectangle.setAttribute('data-state', newState);

    if (newState === 'open') {
        rectangle.style.width = '400px';
    } else {
        rectangle.style.width = '100px';
    }
}

document.querySelectorAll('.rectangle').forEach(rectangle => {
    rectangle.addEventListener('click', (e) => {
        toggleRectangleSize(rectangle);
        e.stopPropagation();
    });
});

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

function calculateRowWidth() {
    document.querySelectorAll('.row').forEach(row => {
        let rectangles = row.querySelectorAll('.rectangle');
        let rowWidth = (rectangles.length * 100) + ((rectangles.length - 1) * 5);
        row.style.width = rowWidth + 'px';
    });
}

calculateRowWidth();

// Aggiunta della nuova logica di drag-and-drop
document.querySelectorAll('.row').forEach(row => {
    let isDragging = false;
    let startX, startY, initialX, initialY;

    function dragStart(e) {
        if (!e.target.classList.contains('rectangle')) return;

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialX = e.target.offsetLeft;
        initialY = e.target.offsetTop;
        e.target.classList.add('dragging');
    }

    function dragging(e) {
        if (!isDragging) return;
        e.preventDefault();

        let deltaX = e.clientX - startX;
        let deltaY = e.clientY - startY;
        
        const rowRects = Array.from(row.children);
        rowRects.forEach(rect => {
            rect.style.left = (initialX + deltaX) + 'px';
            rect.style.top = (initialY + deltaY) + 'px';
        });
    }

    function dragEnd(e) {
        if (isDragging) {
            isDragging = false;
            const rowRects = Array.from(row.children);
            rowRects.forEach(rect => {
                rect.classList.remove('dragging');
                rect.style.left = '';
                rect.style.top = '';
            });
        }
    }

    row.addEventListener('mousedown', dragStart);
    row.addEventListener('mousemove', dragging);
    row.addEventListener('mouseup', dragEnd);
    row.addEventListener('mouseleave', dragEnd);
});
