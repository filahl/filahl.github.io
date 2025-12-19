// js/script.js - Společné funkce pro všechny stránky

// Aktualizace data v horní části
document.addEventListener('DOMContentLoaded', function() {
    // Zobrazit aktuální datum
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateElement = document.getElementById('id1');
    if (dateElement) {
        dateElement.textContent = now.toLocaleDateString('cs-CZ', options);
    }
    
    // Aktualizace copyright roku
    updateCopyrightYear();
    
    // Zvýraznění aktuální stránky v navigaci
    highlightCurrentPage();
    
    // Přidání efektu pro obrázky v galerii
    initGalleryEffects();
});

function updateCopyrightYear() {
    const copyrightElements = document.querySelectorAll('.dole span');
    const currentYear = new Date().getFullYear();
    
    copyrightElements.forEach(element => {
        if (element.textContent.includes('Martin Šustr')) {
            element.textContent = `Martin Šustr ${currentYear}`;
        }
    });
}

function highlightCurrentPage() {
    const currentPage = window.location.pathname.split('/').pop();
    const navLinks = document.querySelectorAll('.odkaz');
    
    // Reset všech odkazů
    navLinks.forEach(link => {
        link.id = '';
    });
    
    // Zvýraznění aktuální stránky
    if (currentPage === '' || currentPage === 'index.html') {
        document.querySelector('a[href="index.html"] .odkaz').id = 'hlav';
    } else if (currentPage.includes('kurzy')) {
        document.querySelector('a[href="kurzy.html"] .odkaz').id = 'hlav';
    } else if (currentPage.includes('prihlaska')) {
        document.querySelector('a[href="prihlaska.html"] .odkaz').id = 'hlav';
    } else if (currentPage.includes('kontakty')) {
        document.querySelector('a[href="kontakty.html"] .odkaz').id = 'hlav';
    } else if (currentPage.includes('fotogalerie')) {
        document.querySelector('a[href*="fotogalerie"] .odkaz').id = 'hlav';
    }
}

function initGalleryEffects() {
    const images = document.querySelectorAll('img:not(.logo)');
    
    images.forEach(img => {
        img.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.05)';
            this.style.transition = 'transform 0.3s ease';
            this.style.zIndex = '100';
        });
        
        img.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
            this.style.zIndex = '1';
        });
    });
}

// AJAX funkce pro fotogalerii
function vytvoritZadost(url) {
    if (window.XMLHttpRequest) {
        http_zadost = new XMLHttpRequest();
    } else if (window.ActiveXObject) {
        try {
            http_zadost = new ActiveXObject("Msxml2.XMLHTTP");
        } catch (e) {
            try {
                http_zadost = new ActiveXObject("Microsoft.XMLHTTP");
            } catch (e) {}
        }
    }

    if (!http_zadost) {
        alert('Nemohu vytvořit XMLHTTP instanci');
        return false;
    }
    
    http_zadost.onreadystatechange = function() {
        if (http_zadost.readyState == 4 && http_zadost.status == 200) {
            document.getElementById("ajax").innerHTML = http_zadost.responseText;
            initGalleryEffects(); // Re-inicializace efektů po načtení nových obrázků
        }
    };
    
    http_zadost.open('GET', url, true);
    http_zadost.send(null);
}

// Validace formulářů (pokud budete přidávat formuláře)
function validateForm(form) {
    let isValid = true;
    const inputs = form.querySelectorAll('input[required], textarea[required]');
    
    inputs.forEach(input => {
        if (!input.value.trim()) {
            input.style.borderColor = 'red';
            isValid = false;
        } else {
            input.style.borderColor = '';
        }
    });
    
    return isValid;
}