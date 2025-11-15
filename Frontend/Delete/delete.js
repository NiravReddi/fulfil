// Delete Page JavaScript

function initializeDeletePage() {
    const deleteButton = document.getElementById('delete-all-button');
    const confirmDialog = document.getElementById('delete-confirm-dialog');
    const confirmYes = document.getElementById('confirm-yes');
    const confirmNo = document.getElementById('confirm-no');
    const responseDiv = document.getElementById('delete-response');
    
    if (!deleteButton) return; // Exit if button doesn't exist yet
    
    // Show confirmation dialog when delete button is clicked
    deleteButton.addEventListener('click', function() {
        if (confirmDialog) {
            confirmDialog.style.display = 'flex';
        }
    });
    
    // Handle "No" button - close dialog
    if (confirmNo) {
        confirmNo.addEventListener('click', function() {
            if (confirmDialog) {
                confirmDialog.style.display = 'none';
            }
        });
    }
    
    // Handle "Yes" button - proceed with deletion
    if (confirmYes) {
        confirmYes.addEventListener('click', async function() {
            // Close dialog
            if (confirmDialog) {
                confirmDialog.style.display = 'none';
            }
            
            // Disable button and show loading state
            deleteButton.disabled = true;
            const originalText = deleteButton.textContent;
            deleteButton.textContent = 'Deleting...';
            clearResponse();
            
            try {
                const res = await fetch(`${API_BASE}/delete`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                // Check if response is OK and is JSON
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(`HTTP ${res.status}: ${text.substring(0, 100)}`);
                }
                
                const contentType = res.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    const text = await res.text();
                    throw new Error('Response is not JSON. Received: ' + text.substring(0, 100));
                }
                
                const data = await res.json();
                
                if (res.ok && data.success) {
                    // Success response
                    showResponse(
                        `✅ ${data.message}`,
                        'success'
                    );
                } else {
                    // Error response
                    const errorMsg = data.error || data.message || 'Delete failed';
                    showResponse(`❌ ${errorMsg}`, 'error');
                }
            } catch (err) {
                // Network or parsing error
                showResponse(`❌ Delete failed: ${err.message}`, 'error');
            } finally {
                // Re-enable button
                deleteButton.disabled = false;
                deleteButton.textContent = originalText;
            }
        });
    }
    
    // Close dialog when clicking outside
    if (confirmDialog) {
        confirmDialog.addEventListener('click', function(e) {
            if (e.target === confirmDialog) {
                confirmDialog.style.display = 'none';
            }
        });
    }
    
    function showResponse(message, type) {
        if (!responseDiv) return;
        
        responseDiv.innerHTML = '';
        const messageDiv = document.createElement('div');
        messageDiv.className = `response-message response-${type}`;
        messageDiv.textContent = message;
        responseDiv.appendChild(messageDiv);
    }
    
    function clearResponse() {
        if (responseDiv) {
            responseDiv.innerHTML = '';
        }
    }
}

// Call initialize when script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDeletePage);
} else {
    initializeDeletePage();
}

