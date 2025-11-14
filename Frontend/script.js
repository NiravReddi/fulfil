// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    initializeNavigation();
    loadDefaultPage();
});

// Navigation functionality
function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.getAttribute('data-page');
            navigateToPage(page);
            
            // Update active state
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

// Load CSS dynamically
function loadPageCSS(page) {
    const stylesheet = document.getElementById('pageStylesheet');
    const cssPath = `${page}/${page}.css`;
    stylesheet.href = cssPath;
}

// Load HTML dynamically - tries multiple methods
function loadPageHTML(page, callback) {
    // Method 1: Try to load from HTML file via XMLHttpRequest (works with HTTP server)
    const htmlPath = `${page}/${page}.html`;
    const xhr = new XMLHttpRequest();
    xhr.open('GET', htmlPath, true);
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200 || xhr.status === 0) {
                // Status 200 for HTTP, 0 for file:// protocol (if browser allows)
                callback(xhr.responseText);
                return;
            }
        }
    };
    
    xhr.onerror = function() {
        // Method 2: Try loading template JS file
        loadHTMLFromTemplate(page, callback);
    };
    
    xhr.send();
    
    // Also try template as backup
    setTimeout(() => {
        if (xhr.readyState !== 4) {
            loadHTMLFromTemplate(page, callback);
        }
    }, 100);
}

// Load HTML from template JS file
function loadHTMLFromTemplate(page, callback) {
    const templatePath = `${page}/${page}-template.js`;
    const htmlVar = `${page}HTML`;
    
    // Check if already loaded
    if (typeof window[htmlVar] !== 'undefined') {
        callback(window[htmlVar]);
        return;
    }
    
    const script = document.createElement('script');
    script.src = templatePath;
    
    script.onload = function() {
        // Small delay to ensure variable is set
        setTimeout(() => {
            if (typeof window[htmlVar] !== 'undefined') {
                const html = window[htmlVar];
                callback(html);
                // Don't delete - keep for potential reuse
            } else {
                callback(getFallbackHTML(page));
            }
        }, 10);
    };
    
    script.onerror = function() {
        // Final fallback - try to read from HTML file directly as last resort
        callback(getFallbackHTML(page));
    };
    
    document.head.appendChild(script);
}

// Fallback HTML content
function getFallbackHTML(page) {
    return `
        <h2 class="section-title">Error Loading ${page.charAt(0).toUpperCase() + page.slice(1)}</h2>
        <div class="section-content">
            <p>Failed to load page content. Please ensure you're running this through a web server (HTTP) or check if the HTML files exist.</p>
        </div>
    `;
}

// Load JS dynamically
function loadPageJS(page, callback) {
    // Remove existing page script
    const existingScript = document.getElementById('pageScript');
    if (existingScript && existingScript.src) {
        existingScript.remove();
    }
    
    // Create new script element
    const script = document.createElement('script');
    script.id = 'pageScript';
    script.src = `${page}/${page}.js`;
    script.onload = callback;
    script.onerror = function() {
        console.error(`Failed to load ${page}/${page}.js`);
        callback(); // Still call callback to continue
    };
    document.body.appendChild(script);
}

// Navigate to different pages
function navigateToPage(page) {
    const contentArea = document.getElementById('contentArea');
    
    // Remove existing content sections
    const existingSections = contentArea.querySelectorAll('.content-section');
    existingSections.forEach(section => section.remove());
    
    // Load page-specific CSS
    loadPageCSS(page);
    
    // Create new content section
    const section = document.createElement('div');
    section.className = `content-section active ${page}-section`;
    contentArea.appendChild(section);
    
    // Load page-specific HTML
    loadPageHTML(page, function(html) {
        section.innerHTML = html;
        
        // Load page-specific JavaScript after HTML is loaded
        loadPageJS(page, function() {
            // Initialize page-specific functionality
            switch(page) {
                case 'upload':
                    if (typeof initializeUploadPage === 'function') {
                        initializeUploadPage();
                    }
                    break;
                case 'manage':
                    if (typeof initializeManagePage === 'function') {
                        initializeManagePage();
                    }
                    break;
                case 'delete':
                    if (typeof initializeDeletePage === 'function') {
                        initializeDeletePage();
                    }
                    break;
            }
        });
    });
}

// Load default page on initial load
function loadDefaultPage() {
    const firstNavItem = document.querySelector('.nav-item');
    if (firstNavItem) {
        firstNavItem.classList.add('active');
        navigateToPage(firstNavItem.getAttribute('data-page'));
    }
}

