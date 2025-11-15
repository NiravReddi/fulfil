// Manage Page JavaScript

let allProducts = [];
let filteredProducts = [];
let currentPage = 1;
const itemsPerPage = 10;
let editingProduct = null;
let deleteProductSKU = null;

const API_BASE = 'http://127.0.0.1:5000';

function initializeManagePage() {
    // Load all products on page load
    loadAllProducts();
    
    // Event listeners
    setupEventListeners();
}

function setupEventListeners() {
    // Add product button
    const addBtn = document.getElementById('add-product-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => openProductModal());
    }
    
    // Refresh button
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => loadAllProducts());
    }
    
    // Filter buttons
    const applyFiltersBtn = document.getElementById('apply-filters-btn');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => applyFilters());
    }
    
    const clearFiltersBtn = document.getElementById('clear-filters-btn');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => clearFilters());
    }
    
    // Modal controls
    const modalClose = document.getElementById('modal-close');
    const modalCancel = document.getElementById('modal-cancel');
    const modalSave = document.getElementById('modal-save');
    
    if (modalClose) modalClose.addEventListener('click', closeProductModal);
    if (modalCancel) modalCancel.addEventListener('click', closeProductModal);
    if (modalSave) modalSave.addEventListener('click', saveProduct);
    
    // Delete modal controls
    const deleteCancel = document.getElementById('delete-cancel');
    const deleteConfirm = document.getElementById('delete-confirm');
    
    if (deleteCancel) deleteCancel.addEventListener('click', closeDeleteModal);
    if (deleteConfirm) deleteConfirm.addEventListener('click', confirmDelete);
    
    // Pagination
    const prevPage = document.getElementById('prev-page');
    const nextPage = document.getElementById('next-page');
    
    if (prevPage) prevPage.addEventListener('click', () => changePage(-1));
    if (nextPage) nextPage.addEventListener('click', () => changePage(1));
    
    // Close modals on overlay click
    const productModal = document.getElementById('product-modal');
    const deleteModal = document.getElementById('delete-modal');
    
    if (productModal) {
        productModal.addEventListener('click', (e) => {
            if (e.target === productModal) closeProductModal();
        });
    }
    
    if (deleteModal) {
        deleteModal.addEventListener('click', (e) => {
            if (e.target === deleteModal) closeDeleteModal();
        });
    }
}

// Load all products
async function loadAllProducts() {
    try {
        const response = await fetch(`${API_BASE}/get_all_products`);
        const data = await response.json();
        
        if (data.success && data.products) {
            allProducts = data.products;
            filteredProducts = [...allProducts];
            currentPage = 1;
            renderProducts();
        } else {
            showError('Failed to load products');
            allProducts = [];
            filteredProducts = [];
            renderProducts();
        }
    } catch (error) {
        console.error('Error loading products:', error);
        showError('Error loading products: ' + error.message);
        allProducts = [];
        filteredProducts = [];
        renderProducts();
    }
}

// Apply filters
async function applyFilters() {
    const sku = document.getElementById('filter-sku')?.value.trim();
    const name = document.getElementById('filter-name')?.value.trim();
    const description = document.getElementById('filter-description')?.value.trim();
    const active = document.getElementById('filter-active')?.value;
    
    filteredProducts = [];
    
    try {
        // If all filters are empty, load all products
        if (!sku && !name && !description && !active) {
            await loadAllProducts();
            return;
        }
        
        // Apply filters sequentially
        let products = [...allProducts];
        
        if (sku) {
            const response = await fetch(`${API_BASE}/get_by_sku?sku=${encodeURIComponent(sku)}`);
            const data = await response.json();
            if (data.success && data.products) {
                products = products.filter(p => 
                    data.products.some(sp => sp.SKU === p.SKU)
                );
            } else {
                products = [];
            }
        }
        
        if (name) {
            const response = await fetch(`${API_BASE}/get_by_name?name=${encodeURIComponent(name)}`);
            const data = await response.json();
            if (data.success && data.products) {
                products = products.filter(p => 
                    data.products.some(sp => sp.SKU === p.SKU)
                );
            } else {
                products = [];
            }
        }
        
        if (description) {
            const response = await fetch(`${API_BASE}/get_by_description?description=${encodeURIComponent(description)}`);
            const data = await response.json();
            if (data.success && data.products) {
                products = products.filter(p => 
                    data.products.some(sp => sp.SKU === p.SKU)
                );
            } else {
                products = [];
            }
        }
        
        if (active !== '') {
            const isActive = active === 'true';
            const response = await fetch(`${API_BASE}/get_by_is_active?is_active=${isActive}`);
            const data = await response.json();
            if (data.success && data.products) {
                products = products.filter(p => 
                    data.products.some(sp => sp.SKU === p.SKU)
                );
            } else {
                products = [];
            }
        }
        
        // Remove duplicates
        const uniqueProducts = [];
        const seenSKUs = new Set();
        products.forEach(p => {
            if (!seenSKUs.has(p.SKU)) {
                seenSKUs.add(p.SKU);
                uniqueProducts.push(p);
            }
        });
        
        filteredProducts = uniqueProducts;
        currentPage = 1;
        renderProducts();
    } catch (error) {
        console.error('Error applying filters:', error);
        showError('Error applying filters: ' + error.message);
    }
}

// Clear filters
function clearFilters() {
    document.getElementById('filter-sku').value = '';
    document.getElementById('filter-name').value = '';
    document.getElementById('filter-description').value = '';
    document.getElementById('filter-active').value = '';
    loadAllProducts();
}

// Render products table
function renderProducts() {
    const tbody = document.getElementById('products-tbody');
    const countEl = document.getElementById('products-count');
    
    if (!tbody) return;
    
    // Update count
    if (countEl) {
        countEl.textContent = `Products (${filteredProducts.length})`;
    }
    
    // Calculate pagination
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageProducts = filteredProducts.slice(startIndex, endIndex);
    
    // Clear table
    tbody.innerHTML = '';
    
    if (pageProducts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No products found</td></tr>';
        updatePagination(0, 0);
        return;
    }
    
    // Render products
    pageProducts.forEach(product => {
        const row = createProductRow(product);
        tbody.appendChild(row);
    });
    
    updatePagination(currentPage, totalPages);
}

// Create product table row
function createProductRow(product) {
    const row = document.createElement('tr');
    
    row.innerHTML = `
        <td class="editable" data-field="SKU" data-sku="${product.SKU}">${product.SKU}</td>
        <td class="editable" data-field="Name" data-sku="${product.SKU}">${product.Name || ''}</td>
        <td class="editable" data-field="Description" data-sku="${product.SKU}">${product.Description || ''}</td>
        <td>
            <span class="status-badge ${product.IsActive ? 'status-active' : 'status-inactive'}">
                ${product.IsActive ? 'Active' : 'Inactive'}
            </span>
        </td>
        <td>
            <div class="action-buttons">
                <button class="action-btn action-btn-edit" onclick="editProduct('${product.SKU}')">Edit</button>
                <button class="action-btn action-btn-delete" onclick="deleteProduct('${product.SKU}')">Delete</button>
            </div>
        </td>
    `;
    
    // Add inline editing
    const editableCells = row.querySelectorAll('.editable');
    editableCells.forEach(cell => {
        cell.addEventListener('dblclick', () => {
            enableInlineEdit(cell, product.SKU);
        });
    });
    
    return row;
}

// Enable inline editing
function enableInlineEdit(cell, sku) {
    const field = cell.getAttribute('data-field');
    const currentValue = cell.textContent.trim();
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'editable-input';
    input.value = currentValue;
    
    const originalContent = cell.innerHTML;
    cell.innerHTML = '';
    cell.appendChild(input);
    input.focus();
    input.select();
    
    const saveEdit = async () => {
        const newValue = input.value.trim();
        if (newValue !== currentValue) {
            await updateProductField(sku, field, newValue);
        }
        cell.innerHTML = originalContent;
    };
    
    const cancelEdit = () => {
        cell.innerHTML = originalContent;
    };
    
    input.addEventListener('blur', saveEdit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            saveEdit();
        } else if (e.key === 'Escape') {
            cancelEdit();
        }
    });
}

// Update product field
async function updateProductField(sku, field, value) {
    try {
        // Get current product
        const product = allProducts.find(p => p.SKU === sku);
        if (!product) return;
        
        const updateData = {
            SKU: sku,
            Name: field === 'Name' ? value : product.Name,
            Description: field === 'Description' ? value : product.Description,
            IsActive: product.IsActive
        };
        
        const response = await fetch(`${API_BASE}/update_by_sku`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Update local data
            const index = allProducts.findIndex(p => p.SKU === sku);
            if (index !== -1) {
                allProducts[index] = { ...allProducts[index], ...updateData };
            }
            
            // Update filtered products
            const filteredIndex = filteredProducts.findIndex(p => p.SKU === sku);
            if (filteredIndex !== -1) {
                filteredProducts[filteredIndex] = { ...filteredProducts[filteredIndex], ...updateData };
            }
            
            renderProducts();
        } else {
            showError('Failed to update product: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error updating product:', error);
        showError('Error updating product: ' + error.message);
    }
}

// Edit product (open modal)
function editProduct(sku) {
    const product = allProducts.find(p => p.SKU === sku);
    if (!product) return;
    
    editingProduct = product;
    openProductModal();
}

// Delete product
function deleteProduct(sku) {
    const product = allProducts.find(p => p.SKU === sku);
    if (!product) return;
    
    deleteProductSKU = sku;
    const deleteModal = document.getElementById('delete-modal');
    const deleteInfo = document.getElementById('delete-product-info');
    
    if (deleteInfo) {
        deleteInfo.textContent = `SKU: ${product.SKU} | Name: ${product.Name}`;
    }
    
    if (deleteModal) {
        deleteModal.style.display = 'flex';
    }
}

// Confirm delete
async function confirmDelete() {
    if (!deleteProductSKU) return;
    
    try {
        const response = await fetch(`${API_BASE}/delete_by_sku`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                SKU: deleteProductSKU
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Remove from local arrays
            allProducts = allProducts.filter(p => p.SKU !== deleteProductSKU);
            filteredProducts = filteredProducts.filter(p => p.SKU !== deleteProductSKU);
            
            closeDeleteModal();
            renderProducts();
        } else {
            showError('Failed to delete product: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error deleting product:', error);
        showError('Error deleting product: ' + error.message);
    }
}

// Open product modal
function openProductModal() {
    const modal = document.getElementById('product-modal');
    const title = document.getElementById('modal-title');
    const form = document.getElementById('product-form');
    
    if (!modal || !form) return;
    
    if (editingProduct) {
        // Edit mode
        if (title) title.textContent = 'Edit Product';
        document.getElementById('modal-sku').value = editingProduct.SKU;
        document.getElementById('modal-sku').disabled = true;
        document.getElementById('modal-name').value = editingProduct.Name || '';
        document.getElementById('modal-description').value = editingProduct.Description || '';
        document.getElementById('modal-active').checked = editingProduct.IsActive !== false;
    } else {
        // Add mode
        if (title) title.textContent = 'Add New Product';
        form.reset();
        document.getElementById('modal-sku').disabled = false;
        document.getElementById('modal-active').checked = true;
    }
    
    modal.style.display = 'flex';
}

// Close product modal
function closeProductModal() {
    const modal = document.getElementById('product-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    editingProduct = null;
    const form = document.getElementById('product-form');
    if (form) form.reset();
}

// Close delete modal
function closeDeleteModal() {
    const modal = document.getElementById('delete-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    deleteProductSKU = null;
}

// Save product
async function saveProduct() {
    const form = document.getElementById('product-form');
    if (!form) return;
    
    const sku = document.getElementById('modal-sku')?.value.trim();
    const name = document.getElementById('modal-name')?.value.trim();
    const description = document.getElementById('modal-description')?.value.trim();
    const isActive = document.getElementById('modal-active')?.checked;
    
    if (!sku || !name) {
        showError('SKU and Name are required');
        return;
    }
    
    try {
        if (editingProduct) {
            // Update existing product
            const response = await fetch(`${API_BASE}/update_by_sku`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    SKU: sku,
                    Name: name,
                    Description: description || '',
                    IsActive: isActive
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                closeProductModal();
                await loadAllProducts();
            } else {
                showError('Failed to update product: ' + (data.error || 'Unknown error'));
            }
        } else {
            // Create new product
            const response = await fetch(`${API_BASE}/insert_by_sku`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    SKU: sku,
                    Name: name,
                    Description: description || '',
                    IsActive: isActive
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                closeProductModal();
                await loadAllProducts();
            } else {
                showError('Failed to create product: ' + (data.error || 'Unknown error'));
            }
        }
    } catch (error) {
        console.error('Error saving product:', error);
        showError('Error saving product: ' + error.message);
    }
}

// Pagination
function changePage(direction) {
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const newPage = currentPage + direction;
    
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderProducts();
    }
}

function updatePagination(page, totalPages) {
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const infoEl = document.getElementById('pagination-info');
    
    if (prevBtn) {
        prevBtn.disabled = page <= 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = page >= totalPages || totalPages === 0;
    }
    
    if (infoEl) {
        infoEl.textContent = `Page ${page} of ${totalPages || 1}`;
    }
}

// Show error message
function showError(message) {
    // Simple alert for now - can be enhanced with a toast notification
    alert(message);
}

// Make functions globally available for onclick handlers
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;

// Call initialize when script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeManagePage);
} else {
    initializeManagePage();
}

