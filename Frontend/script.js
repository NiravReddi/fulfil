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
    let htmlLoaded = false;
    let callbackExecuted = false;
    
    // Wrapper to ensure callback is only called once
    const safeCallback = function(html) {
        if (!callbackExecuted) {
            callbackExecuted = true;
            callback(html);
        }
    };
    
    // Method 1: Try to load from HTML file via XMLHttpRequest (works with HTTP server)
    const htmlPath = `${page}/${page}.html`;
    const xhr = new XMLHttpRequest();
    xhr.open('GET', htmlPath, true);
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200 || xhr.status === 0) {
                // Status 200 for HTTP, 0 for file:// protocol (if browser allows)
                if (!htmlLoaded) {
                    htmlLoaded = true;
                    safeCallback(xhr.responseText);
                }
                return;
            } else if (xhr.status === 404) {
                // File not found, try template
                if (!htmlLoaded && !callbackExecuted) {
                    htmlLoaded = true;
                    loadHTMLFromTemplate(page, safeCallback);
                }
            }
        }
    };
    
    xhr.onerror = function() {
        // Method 2: Try loading template JS file
        if (!htmlLoaded && !callbackExecuted) {
            htmlLoaded = true;
            loadHTMLFromTemplate(page, safeCallback);
        }
    };
    
    xhr.send();
    
    // Fallback to template only if request hasn't completed after timeout
    setTimeout(() => {
        if (!htmlLoaded && xhr.readyState !== 4 && !callbackExecuted) {
            htmlLoaded = true;
            loadHTMLFromTemplate(page, safeCallback);
        }
    }, 1000);
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
    let templateLoaded = false;
    
    script.onload = function() {
        // Small delay to ensure variable is set
        setTimeout(() => {
            if (!templateLoaded) {
                templateLoaded = true;
                if (typeof window[htmlVar] !== 'undefined') {
                    const html = window[htmlVar];
                    // Only call callback if HTML hasn't been set yet (prevent overwriting)
                    callback(html);
                    // Don't delete - keep for potential reuse
                } else {
                    // Template variable not found - don't show error, HTML file should have loaded
                    console.warn(`Template variable ${htmlVar} not found for ${page}, but HTML file may have loaded`);
                }
            }
        }, 50);
    };
    
    script.onerror = function() {
        if (!templateLoaded) {
            templateLoaded = true;
            // Only show error if we haven't already loaded HTML successfully
            // Don't call callback with error HTML - let the HTML file loading handle it
            console.warn(`Failed to load template ${templatePath} for ${page}`);
            // Don't call callback here - the HTML file should have already loaded
        }
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
    script.onload = function() {
        // For webhooks, wait a bit longer to ensure function is available
        if (page === 'webhooks') {
            setTimeout(callback, 150);
        } else {
            callback();
        }
    };
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
    let htmlSet = false;
    loadPageHTML(page, function(html) {
        // Only set HTML once - prevent template fallback from overwriting
        if (!htmlSet) {
            htmlSet = true;
            section.innerHTML = html;
        }
        
        // Load page-specific JavaScript after HTML is loaded
        loadPageJS(page, function() {
            // Small delay to ensure DOM is fully ready
            setTimeout(() => {
                // Initialize page-specific functionality
                switch(page) {
                    case 'upload':
                        if (typeof initializeUploadPage === 'function') {
                            initializeUploadPage();
                        } else {
                            console.error('initializeUploadPage function not found!');
                        }
                        break;
                    case 'manage':
                        if (typeof initializeManagePage === 'function') {
                            initializeManagePage();
                        } else {
                            console.error('initializeManagePage function not found!');
                        }
                        break;
                    case 'delete':
                        if (typeof initializeDeletePage === 'function') {
                            initializeDeletePage();
                        } else {
                            console.error('initializeDeletePage function not found!');
                        }
                        break;
                    case 'webhooks':
                        const initFunc = window.initializeWebhooksPage || initializeWebhooksPage;
                        if (typeof initFunc === 'function') {
                            try {
                                initFunc();
                            } catch (err) {
                                console.error('Error calling initializeWebhooksPage:', err);
                            }
                        }
                        break;
                }
            }, 200);
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

