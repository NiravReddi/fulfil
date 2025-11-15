// Upload Page JavaScript

function initializeUploadPage() {
    const form = document.getElementById('upload-form');
    const fileInput = document.getElementById('csv_file');
    const responseDiv = document.getElementById('response');
    const uploadButton = document.getElementById('upload-button');
    const buttonText = document.getElementById('button-text');
    const buttonLoading = document.getElementById('button-loading');
    
    if (!form) return; // Exit if form doesn't exist yet
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Validate file is selected
        if (!fileInput.files || !fileInput.files[0]) {
            showResponse('Please select a CSV file to upload.', 'error');
            return;
        }
        
        const file = fileInput.files[0];
        
        // Validate file type
        if (!file.name.toLowerCase().endsWith('.csv')) {
            showResponse('Please select a valid CSV file.', 'error');
            return;
        }
        
        // Show loading state
        setLoadingState(true);
        clearResponse();
        showProgressContainer(true);
        resetProgress();
        
        const formData = new FormData();
        // Important: Backend expects 'csv_file' as the field name
        formData.append('csv_file', file);
        
        try {
            const res = await fetch(`${API_BASE}/upload`, {
                method: 'POST',
                body: formData
            });
            
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            
            // Handle Server-Sent Events (SSE) stream
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            
                            if (data.type === 'progress') {
                                updateProgress(data);
                            } else if (data.type === 'complete') {
                                showProgressContainer(false);
                                showResponse(
                                    `✅ ${data.message}\n\nRows processed: ${data.rows_processed || 'N/A'}`,
                                    'success'
                                );
                            } else if (data.type === 'error') {
                                showProgressContainer(false);
                                showResponse(`❌ ${data.error}: ${data.message}`, 'error');
                            }
                        } catch (e) {
                            console.error('Error parsing SSE data:', e);
                        }
                    }
                }
            }
        } catch (err) {
            // Network or parsing error
            showProgressContainer(false);
            showResponse(`❌ Upload failed: ${err.message}`, 'error');
        } finally {
            setLoadingState(false);
        }
    });
    
    function setLoadingState(loading) {
        if (loading) {
            uploadButton.disabled = true;
            buttonText.style.display = 'none';
            buttonLoading.style.display = 'inline';
            uploadButton.style.opacity = '0.7';
            uploadButton.style.cursor = 'not-allowed';
        } else {
            uploadButton.disabled = false;
            buttonText.style.display = 'inline';
            buttonLoading.style.display = 'none';
            uploadButton.style.opacity = '1';
            uploadButton.style.cursor = 'pointer';
        }
    }
    
    function showResponse(message, type) {
        responseDiv.innerHTML = '';
        const messageDiv = document.createElement('div');
        messageDiv.className = `response-message response-${type}`;
        messageDiv.style.cssText = `
            padding: 1rem 1.5rem;
            border-radius: 8px;
            margin-top: 1rem;
            white-space: pre-wrap;
            font-family: monospace;
            ${type === 'success' 
                ? 'background-color: #E8F5E9; color: #2E7D32; border: 2px solid #4CAF50;' 
                : 'background-color: #FFEBEE; color: #C62828; border: 2px solid #F44336;'
            }
        `;
        messageDiv.textContent = message;
        responseDiv.appendChild(messageDiv);
    }
    
    function clearResponse() {
        responseDiv.innerHTML = '';
    }
    
    function showProgressContainer(show) {
        const progressContainer = document.getElementById('progress-container');
        if (progressContainer) {
            progressContainer.style.display = show ? 'block' : 'none';
        }
    }
    
    function resetProgress() {
        updateProgress({
            total_batches: 0,
            current_batch: 0,
            total_rows: 0,
            rows_processed: 0
        });
    }
    
    function updateProgress(data) {
        const progressBar = document.getElementById('progress-bar');
        const batchInfo = document.getElementById('batch-info');
        const rowsInfo = document.getElementById('rows-info');
        
        if (!progressBar || !batchInfo || !rowsInfo) return;
        
        const totalBatches = data.total_batches || 1;
        const currentBatch = data.current_batch || 0;
        const totalRows = data.total_rows || 0;
        const rowsProcessed = data.rows_processed || 0;
        
        // Calculate percentage based on batches
        const percentage = totalBatches > 0 ? Math.round((currentBatch / totalBatches) * 100) : 0;
        
        // Update progress bar width (animated)
        progressBar.style.width = `${percentage}%`;
        
        // Update batch info
        batchInfo.textContent = `Batch ${currentBatch} of ${totalBatches}`;
        
        // Update rows info
        rowsInfo.textContent = `${rowsProcessed.toLocaleString()} of ${totalRows.toLocaleString()} rows processed`;
    }
}

