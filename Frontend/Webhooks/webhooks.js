// Webhooks Page JavaScript

let allWebhooks = [];
let editingWebhook = null;
let deleteWebhookId = null;
let testWebhookId = null;

// API_BASE is defined in config.js

function initializeWebhooksPage() {
    // Event listeners - set up first
    setupEventListeners();
    
    // Try to initialize table first, then load webhooks
    initializeWebhookTable().then(() => {
        loadWebhooks();
    }).catch(err => {
        console.error('Error initializing webhook table:', err);
        loadWebhooks(); // Try to load anyway
    });
}

function setupEventListeners() {
    // Add webhook button
    const addBtn = document.getElementById('add-webhook-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => openWebhookModal());
    }
    
    // Refresh button
    const refreshBtn = document.getElementById('refresh-webhooks-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => loadWebhooks());
    }
    
    // Modal controls
    const modalClose = document.getElementById('webhook-modal-close');
    const modalCancel = document.getElementById('webhook-modal-cancel');
    const modalSave = document.getElementById('webhook-modal-save');
    
    if (modalClose) modalClose.addEventListener('click', closeWebhookModal);
    if (modalCancel) modalCancel.addEventListener('click', closeWebhookModal);
    if (modalSave) {
        modalSave.addEventListener('click', (e) => {
            e.preventDefault();
            saveWebhook();
        });
    }
    
    // Prevent form submission
    const webhookForm = document.getElementById('webhook-form');
    if (webhookForm) {
        webhookForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveWebhook();
        });
    }
    
    // Test modal controls
    const testModalClose = document.getElementById('test-webhook-modal-close');
    const testModalCloseBtn = document.getElementById('test-webhook-modal-close-btn');
    
    if (testModalClose) testModalClose.addEventListener('click', closeTestModal);
    if (testModalCloseBtn) testModalCloseBtn.addEventListener('click', closeTestModal);
    
    // Delete modal controls
    const deleteCancel = document.getElementById('delete-webhook-cancel');
    const deleteConfirm = document.getElementById('delete-webhook-confirm');
    
    if (deleteCancel) deleteCancel.addEventListener('click', closeDeleteModal);
    if (deleteConfirm) deleteConfirm.addEventListener('click', confirmDelete);
    
    // Close modals on overlay click
    const webhookModal = document.getElementById('webhook-modal');
    const testModal = document.getElementById('test-webhook-modal');
    const deleteModal = document.getElementById('delete-webhook-modal');
    
    if (webhookModal) {
        webhookModal.addEventListener('click', (e) => {
            if (e.target === webhookModal) closeWebhookModal();
        });
    }
    
    if (testModal) {
        testModal.addEventListener('click', (e) => {
            if (e.target === testModal) closeTestModal();
        });
    }
    
    if (deleteModal) {
        deleteModal.addEventListener('click', (e) => {
            if (e.target === deleteModal) closeDeleteModal();
        });
    }
}

// Load webhooks
async function loadWebhooks() {
    try {
        const response = await fetch(`${API_BASE}/webhooks`);
        const data = await response.json();
        
        if (data.success && data.webhooks) {
            allWebhooks = data.webhooks;
            renderWebhooks();
        } else {
            // Try to initialize if we get an error
            if (data.error && data.message && (data.message.includes('relation') || data.message.includes('table'))) {
                await initializeWebhookTable();
                await loadWebhooks();
                return;
            }
            showError('Failed to load webhooks: ' + (data.message || 'Unknown error'));
            allWebhooks = [];
            renderWebhooks();
        }
    } catch (error) {
        console.error('Error loading webhooks:', error);
        showError('Error loading webhooks: ' + error.message);
        allWebhooks = [];
        renderWebhooks();
    }
}

// Initialize webhook table
async function initializeWebhookTable() {
    try {
        const response = await fetch(`${API_BASE}/webhooks/init`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        await response.json();
    } catch (error) {
        console.error('Error initializing webhook table:', error);
    }
}

// Render webhooks table
function renderWebhooks() {
    const tbody = document.getElementById('webhooks-tbody');
    const countEl = document.getElementById('webhooks-count');
    
    if (!tbody) return;
    
    // Update count
    if (countEl) {
        countEl.textContent = `Webhooks (${allWebhooks.length})`;
    }
    
    // Clear table
    tbody.innerHTML = '';
    
    if (allWebhooks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No webhooks configured. Click "Add New Webhook" to create one.</td></tr>';
        return;
    }
    
    // Render webhooks
    allWebhooks.forEach(webhook => {
        const row = createWebhookRow(webhook);
        tbody.appendChild(row);
    });
}

// Create webhook table row
function createWebhookRow(webhook) {
    const row = document.createElement('tr');
    
    // Format last test info
    let lastTestInfo = 'Never tested';
    if (webhook.last_test_at) {
        const testDate = new Date(webhook.last_test_at);
        const statusClass = webhook.last_test_status >= 200 && webhook.last_test_status < 300 
            ? 'last-test-success' 
            : 'last-test-error';
        lastTestInfo = `<span class="${statusClass}">
            ${testDate.toLocaleString()} - 
            ${webhook.last_test_status || 'N/A'} 
            (${webhook.last_test_response_time || 0}ms)
        </span>`;
    }
    
    // Format event type
    const eventTypeLabels = {
        'product.created': 'Product Created',
        'product.updated': 'Product Updated',
        'product.deleted': 'Product Deleted',
        'product.uploaded': 'Product Uploaded',
        'all': 'All Events'
    };
    
    row.innerHTML = `
        <td>
            <div class="webhook-url" title="${webhook.url}">${webhook.url}</div>
        </td>
        <td>
            <span class="event-type-badge">${eventTypeLabels[webhook.event_type] || webhook.event_type}</span>
        </td>
        <td>
            <span class="status-badge ${webhook.enabled ? 'status-enabled' : 'status-disabled'}">
                ${webhook.enabled ? 'Enabled' : 'Disabled'}
            </span>
        </td>
        <td>
            <div class="last-test-info">${lastTestInfo}</div>
        </td>
        <td>
            <div class="action-buttons">
                <button class="action-btn action-btn-test" onclick="testWebhook(${webhook.id})">Test</button>
                <button class="action-btn action-btn-toggle" onclick="toggleWebhook(${webhook.id})">
                    ${webhook.enabled ? 'Disable' : 'Enable'}
                </button>
                <button class="action-btn action-btn-edit" onclick="editWebhook(${webhook.id})">Edit</button>
                <button class="action-btn action-btn-delete" onclick="deleteWebhook(${webhook.id})">Delete</button>
            </div>
        </td>
    `;
    
    return row;
}

// Edit webhook
function editWebhook(id) {
    const webhook = allWebhooks.find(w => w.id === id);
    if (!webhook) return;
    
    editingWebhook = webhook;
    openWebhookModal();
}

// Delete webhook
function deleteWebhook(id) {
    const webhook = allWebhooks.find(w => w.id === id);
    if (!webhook) return;
    
    deleteWebhookId = id;
    const deleteModal = document.getElementById('delete-webhook-modal');
    const deleteInfo = document.getElementById('delete-webhook-info');
    
    if (deleteInfo) {
        deleteInfo.textContent = `URL: ${webhook.url} | Event: ${webhook.event_type}`;
    }
    
    if (deleteModal) {
        deleteModal.style.display = 'flex';
    }
}

// Toggle webhook
async function toggleWebhook(id) {
    try {
        const response = await fetch(`${API_BASE}/webhooks/${id}/toggle`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Update local data
            const index = allWebhooks.findIndex(w => w.id === id);
            if (index !== -1 && data.webhook) {
                allWebhooks[index] = data.webhook;
            }
            
            renderWebhooks();
        } else {
            showError('Failed to toggle webhook: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error toggling webhook:', error);
        showError('Error toggling webhook: ' + error.message);
    }
}

// Test webhook
async function testWebhook(id) {
    const webhook = allWebhooks.find(w => w.id === id);
    if (!webhook) return;
    
    testWebhookId = id;
    openTestModal(webhook);
    
    // Show loading
    const loadingEl = document.getElementById('test-webhook-loading');
    const resultEl = document.getElementById('test-webhook-result');
    if (loadingEl) loadingEl.style.display = 'block';
    if (resultEl) resultEl.style.display = 'none';
    
    try {
        const response = await fetch(`${API_BASE}/webhooks/${id}/test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        // Hide loading
        if (loadingEl) loadingEl.style.display = 'none';
        if (resultEl) resultEl.style.display = 'block';
        
        // Update webhook data
        if (data.webhook) {
            const index = allWebhooks.findIndex(w => w.id === id);
            if (index !== -1) {
                allWebhooks[index] = data.webhook;
            }
        }
        
        // Display results
        displayTestResults(data);
        
        // Refresh table to show updated test info
        renderWebhooks();
    } catch (error) {
        console.error('Error testing webhook:', error);
        if (loadingEl) loadingEl.style.display = 'none';
        if (resultEl) resultEl.style.display = 'block';
        
        displayTestResults({
            success: false,
            error: error.message,
            status_code: null,
            response_time: null
        });
    }
}

// Display test results
function displayTestResults(data) {
    const statusCodeEl = document.getElementById('test-status-code');
    const responseTimeEl = document.getElementById('test-response-time');
    const statusEl = document.getElementById('test-status');
    const responseBodyEl = document.getElementById('test-response-body');
    const responseBodyContainer = document.getElementById('test-response-body-container');
    
    if (statusCodeEl) {
        if (data.status_code !== null && data.status_code !== undefined) {
            statusCodeEl.textContent = data.status_code;
            statusCodeEl.className = data.status_code >= 200 && data.status_code < 300 
                ? 'result-value status-code-success' 
                : 'result-value status-code-error';
        } else {
            statusCodeEl.textContent = 'N/A';
            statusCodeEl.className = 'result-value status-code-error';
        }
    }
    
    if (responseTimeEl) {
        responseTimeEl.textContent = data.response_time !== null && data.response_time !== undefined 
            ? `${data.response_time}ms` 
            : 'N/A';
    }
    
    if (statusEl) {
        if (data.success) {
            statusEl.textContent = 'Success';
            statusEl.className = 'result-value status-code-success';
        } else {
            statusEl.textContent = data.error || 'Failed';
            statusEl.className = 'result-value status-code-error';
        }
    }
    
    if (responseBodyEl && data.response_body) {
        responseBodyEl.textContent = data.response_body;
        if (responseBodyContainer) responseBodyContainer.style.display = 'flex';
    } else if (responseBodyContainer) {
        responseBodyContainer.style.display = 'none';
    }
}

// Open webhook modal
function openWebhookModal() {
    const modal = document.getElementById('webhook-modal');
    const title = document.getElementById('webhook-modal-title');
    const form = document.getElementById('webhook-form');
    
    if (!modal || !form) return;
    
    if (editingWebhook) {
        // Edit mode
        if (title) title.textContent = 'Edit Webhook';
        const urlInput = document.getElementById('webhook-url');
        const eventTypeInput = document.getElementById('webhook-event-type');
        const enabledInput = document.getElementById('webhook-enabled');
        if (urlInput) urlInput.value = editingWebhook.url;
        if (eventTypeInput) eventTypeInput.value = editingWebhook.event_type;
        if (enabledInput) enabledInput.checked = editingWebhook.enabled;
    } else {
        // Add mode
        if (title) title.textContent = 'Add New Webhook';
        form.reset();
        const enabledInput = document.getElementById('webhook-enabled');
        if (enabledInput) enabledInput.checked = true;
    }
    
    modal.style.display = 'flex';
}

// Close webhook modal
function closeWebhookModal() {
    const modal = document.getElementById('webhook-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    editingWebhook = null;
    const form = document.getElementById('webhook-form');
    if (form) form.reset();
}

// Open test modal
function openTestModal(webhook) {
    const modal = document.getElementById('test-webhook-modal');
    const infoEl = document.getElementById('test-webhook-info');
    
    if (!modal) return;
    
    if (infoEl) {
        infoEl.innerHTML = `
            <strong>URL:</strong> ${webhook.url}<br>
            <strong>Event Type:</strong> ${webhook.event_type}<br>
            <strong>Status:</strong> ${webhook.enabled ? 'Enabled' : 'Disabled'}
        `;
    }
    
    modal.style.display = 'flex';
}

// Close test modal
function closeTestModal() {
    const modal = document.getElementById('test-webhook-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    testWebhookId = null;
}

// Close delete modal
function closeDeleteModal() {
    const modal = document.getElementById('delete-webhook-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    deleteWebhookId = null;
}

// Save webhook
async function saveWebhook() {
    const form = document.getElementById('webhook-form');
    if (!form) return;
    
    const url = document.getElementById('webhook-url')?.value.trim();
    const eventType = document.getElementById('webhook-event-type')?.value;
    const enabled = document.getElementById('webhook-enabled')?.checked;
    
    if (!url || !eventType) {
        showError('URL and Event Type are required');
        return;
    }
    
    try {
        const endpoint = editingWebhook 
            ? `${API_BASE}/webhooks/${editingWebhook.id}`
            : `${API_BASE}/webhooks`;
        const method = editingWebhook ? 'PUT' : 'POST';
        
        const response = await fetch(endpoint, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: url,
                event_type: eventType,
                enabled: enabled
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeWebhookModal();
            await loadWebhooks();
        } else {
            showError('Failed to save webhook: ' + (data.error || data.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error saving webhook:', error);
        showError('Error saving webhook: ' + error.message);
    }
}

// Confirm delete
async function confirmDelete() {
    if (!deleteWebhookId) return;
    
    try {
        const response = await fetch(`${API_BASE}/webhooks/${deleteWebhookId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeDeleteModal();
            await loadWebhooks();
        } else {
            showError('Failed to delete webhook: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error deleting webhook:', error);
        showError('Error deleting webhook: ' + error.message);
    }
}

// Show error message
function showError(message) {
    // Simple alert for now - can be enhanced with a toast notification
    alert(message);
}

// Make functions globally available for onclick handlers
window.editWebhook = editWebhook;
window.deleteWebhook = deleteWebhook;
window.toggleWebhook = toggleWebhook;
window.testWebhook = testWebhook;

// Make sure function is globally accessible
window.initializeWebhooksPage = initializeWebhooksPage;

// Fallback initialization if script.js doesn't call it
setTimeout(() => {
    if (document.getElementById('webhooks-tbody') && typeof window.initializeWebhooksPage === 'function') {
        window.initializeWebhooksPage();
    }
}, 1000);

