// CFT Inventory System v3 - App Logic

const CONFIG = {
    SHEET_ID: '1MrwDU0XtemyfpwWNX551ulfUIAFECB4cLCPhNJH1yuo',
    // Using Netlify function to proxy CSV (avoids CORS issues)
    CSV_URL: '/.netlify/functions/get-inventory',
    // Google Apps Script for write operations (deployed from the spreadsheet)
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxGpuUe8AkkQCrO9zB4uolgX2smc_Ih66k8VXrlWdB3794D5YuYckhaAoTq6TcozOHT/exec'
};

const CATEGORY_PREFIXES = {
    'IT Assets': 'IT',
    'Electronics': 'EC',
    'Event Equipment': 'EV',
    'Mechanical Division': 'MC',
    'Office Assets': 'OA',
    'Dead Stock': 'DS',
    'Rented Equipment': 'RE'
};

const CATEGORY_ICONS = {
    'IT Assets': '💻',
    'Electronics': '🔌',
    'Event Equipment': '🎪',
    'Mechanical Division': '⚙️',
    'Office Assets': '🪑',
    'Dead Stock': '📦',
    'Rented Equipment': '🔄'
};

const CATEGORY_COLORS = {
    'IT Assets': '#6366f1',
    'Electronics': '#22c55e',
    'Event Equipment': '#f59e0b',
    'Mechanical Division': '#ef4444',
    'Office Assets': '#3b82f6',
    'Dead Stock': '#64748b',
    'Rented Equipment': '#ec4899'
};

const STATUS_COLORS = {
    'Available': '#22c55e',
    'In Use': '#3b82f6',
    'Checked Out': '#f59e0b',
    'Maintenance': '#ef4444',
    'Dead Stock': '#64748b'
};

const SUB_CATEGORIES = {
    'IT Assets': [
        'Laptops',
        'Desktops',
        'Monitors',
        'Networking',
        'Storage',
        'Printers',
        'Peripherals'
    ],
    'Electronics': [
        'Microcontrollers',
        'Power Supplies',
        'Sensors',
        'Cables',
        'PCBs',
        'Buttons',
        'Peripherals'
    ],
    'Event Equipment': [
        'Sensors',
        'IT Assets',
        'LED Panels',
        'Kinetic Displays',
        'Projectors',
        'Holofans',
        'Photobooths'
    ],
    'Mechanical Division': [
        'Motors',
        'Gears',
        'Aluminum Profiles',
        'Bearings',
        'Winches',
        'Hardware',
        'Frames',
        'Tools'
    ],
    'Office Assets': [
        'Furniture',
        'Appliances',
        'Storage',
        'Stationery',
        'Cleaning'
    ],
    'Dead Stock': [
        'Damaged',
        'Obsolete',
        'Spare Parts',
        'Pending Disposal'
    ],
    'Rented Equipment': [
        'Laptops',
        'Camera',
        'Printer',
        'Accessories',
        'VR Headsets',
        'Other'
    ]
};

let inventoryData = [];
let filteredData = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    loadData();
});

// Navigation
function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = item.dataset.view;
            switchView(view);
        });
    });
}

function switchView(viewName) {
    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === viewName);
    });
    
    // Update views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    document.getElementById(viewName + 'View').classList.add('active');
    
    // Update title
    const titles = {
        dashboard: 'Dashboard',
        inventory: 'All Items',
        add: 'Add New Item',
        categories: 'Categories'
    };
    document.getElementById('pageTitle').textContent = titles[viewName] || 'Dashboard';
}

// Parse CSV string into array of arrays
function parseCSV(csv) {
    const lines = [];
    let currentLine = [];
    let currentField = '';
    let inQuotes = false;
    
    for (let i = 0; i < csv.length; i++) {
        const char = csv[i];
        const nextChar = csv[i + 1];
        
        if (inQuotes) {
            if (char === '"' && nextChar === '"') {
                currentField += '"';
                i++; // Skip next quote
            } else if (char === '"') {
                inQuotes = false;
            } else {
                currentField += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                currentLine.push(currentField);
                currentField = '';
            } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
                currentLine.push(currentField);
                lines.push(currentLine);
                currentLine = [];
                currentField = '';
                if (char === '\r') i++; // Skip \n after \r
            } else if (char !== '\r') {
                currentField += char;
            }
        }
    }
    
    // Handle last field/line
    if (currentField || currentLine.length > 0) {
        currentLine.push(currentField);
        lines.push(currentLine);
    }
    
    return lines;
}

// Load Data from Google Sheets (via CSV export)
async function loadData() {
    try {
        // Add cache-busting parameter
        const cacheBuster = Date.now();
        const response = await fetch(CONFIG.CSV_URL + '?_=' + cacheBuster, {
            cache: 'no-store'
        });
        const csvText = await response.text();
        const data = parseCSV(csvText);
        
        if (data && data.length > 1) {
            // Skip header row
            inventoryData = data.slice(1).filter(row => row[0]).map((row, index) => ({
                rowIndex: index + 2, // +2 because of 0-index and header
                itemId: row[0] || '',
                name: row[1] || '',
                category: row[2] || '',
                subCategory: row[3] || '',
                quantity: parseInt(row[4]) || 0,
                status: row[5] || 'Available',
                location: row[6] || '',
                value: parseInt(row[7]) || 0,
                addedDate: row[8] || '',
                notes: row[9] || '',
                // Rental fields (columns K-P)
                returnDate: row[10] || '',
                eventProject: row[11] || '',
                vendorName: row[12] || '',
                vendorContact: row[13] || '',
                rentalCost: parseInt(row[14]) || 0,
                deposit: parseInt(row[15]) || 0
            }));
            
            filteredData = [...inventoryData];
            
            updateDashboard();
            updateInventoryTable();
            updateCategoriesView();
            
            document.getElementById('lastSync').textContent = new Date().toLocaleTimeString();
            showToast('Data synced successfully!', 'success');
        }
    } catch (error) {
        console.error('Error loading data:', error);
        showToast('Failed to load data. Check console.', 'error');
    }
}

// Update Dashboard
function updateDashboard() {
    // Stats
    const totalItems = inventoryData.reduce((sum, item) => sum + item.quantity, 0);
    const availableItems = inventoryData.filter(i => i.status === 'Available').reduce((sum, item) => sum + item.quantity, 0);
    const inUseItems = inventoryData.filter(i => i.status === 'In Use').reduce((sum, item) => sum + item.quantity, 0);
    const totalValue = inventoryData.reduce((sum, item) => sum + (item.value * item.quantity), 0);
    
    document.getElementById('totalItems').textContent = totalItems;
    document.getElementById('availableItems').textContent = availableItems;
    document.getElementById('inUseItems').textContent = inUseItems;
    document.getElementById('totalValue').textContent = '₹' + totalValue.toLocaleString('en-IN');
    
    // Category Chart
    const categoryChart = document.getElementById('categoryChart');
    const categoryCounts = {};
    Object.keys(CATEGORY_PREFIXES).forEach(cat => categoryCounts[cat] = 0);
    inventoryData.forEach(item => {
        if (categoryCounts.hasOwnProperty(item.category)) {
            categoryCounts[item.category] += item.quantity;
        }
    });
    
    const maxCount = Math.max(...Object.values(categoryCounts), 1);
    categoryChart.innerHTML = Object.entries(categoryCounts).map(([cat, count]) => `
        <div class="category-bar">
            <span class="category-bar-label">${cat}</span>
            <div class="category-bar-track">
                <div class="category-bar-fill" style="width: ${(count/maxCount)*100}%; background: ${CATEGORY_COLORS[cat]}"></div>
            </div>
            <span class="category-bar-value">${count}</span>
        </div>
    `).join('');
    
    // Status Chart
    const statusChart = document.getElementById('statusChart');
    const statusCounts = {};
    Object.keys(STATUS_COLORS).forEach(status => statusCounts[status] = 0);
    inventoryData.forEach(item => {
        if (statusCounts.hasOwnProperty(item.status)) {
            statusCounts[item.status] += item.quantity;
        }
    });
    
    statusChart.innerHTML = Object.entries(statusCounts).map(([status, count]) => `
        <div class="status-item">
            <span class="status-dot" style="background: ${STATUS_COLORS[status]}"></span>
            <span class="status-item-label">${status}</span>
            <span class="status-item-value">${count}</span>
        </div>
    `).join('');
    
    // Recent Items
    const recentList = document.getElementById('recentList');
    const recentItems = [...inventoryData]
        .sort((a, b) => new Date(b.addedDate) - new Date(a.addedDate))
        .slice(0, 5);
    
    recentList.innerHTML = recentItems.map(item => `
        <div class="recent-item">
            <div>
                <div class="recent-item-name">${item.name}</div>
                <div class="recent-item-category">${item.category}</div>
            </div>
            <span class="recent-item-date">${item.addedDate}</span>
        </div>
    `).join('');
}

// Update Inventory Table
function updateInventoryTable() {
    const tbody = document.getElementById('inventoryTableBody');
    
    if (filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">No items found</td></tr>';
        return;
    }
    
    tbody.innerHTML = filteredData.map(item => `
        <tr>
            <td><code>${item.itemId}</code></td>
            <td>${item.name}</td>
            <td>${CATEGORY_ICONS[item.category] || '📦'} ${item.category}</td>
            <td>${item.quantity}</td>
            <td><span class="status-badge status-${item.status.toLowerCase().replace(' ', '-')}">${item.status}</span></td>
            <td>${item.location || '-'}</td>
            <td>₹${item.value.toLocaleString('en-IN')}</td>
            <td><button class="action-btn" onclick="editItem(${item.rowIndex})">✏️ Edit</button></td>
        </tr>
    `).join('');
}

// Update Categories View
function updateCategoriesView() {
    const grid = document.getElementById('categoriesGrid');
    const categoryCounts = {};
    Object.keys(CATEGORY_PREFIXES).forEach(cat => categoryCounts[cat] = 0);
    inventoryData.forEach(item => {
        if (categoryCounts.hasOwnProperty(item.category)) {
            categoryCounts[item.category] += item.quantity;
        }
    });
    
    grid.innerHTML = Object.entries(categoryCounts).map(([cat, count]) => `
        <div class="category-card" onclick="filterByCategory('${cat}')">
            <div class="category-card-icon">${CATEGORY_ICONS[cat]}</div>
            <div class="category-card-name">${cat}</div>
            <div class="category-card-count">${count}</div>
            <div class="category-card-label">items</div>
        </div>
    `).join('');
}

// Filter Items
function filterItems() {
    const search = document.getElementById('globalSearch').value.toLowerCase();
    const category = document.getElementById('categoryFilter')?.value || '';
    const status = document.getElementById('statusFilter')?.value || '';
    
    filteredData = inventoryData.filter(item => {
        const matchSearch = !search || 
            item.name.toLowerCase().includes(search) ||
            item.itemId.toLowerCase().includes(search) ||
            item.category.toLowerCase().includes(search);
        const matchCategory = !category || item.category === category;
        const matchStatus = !status || item.status === status;
        
        return matchSearch && matchCategory && matchStatus;
    });
    
    updateInventoryTable();
}

function filterByCategory(category) {
    document.getElementById('categoryFilter').value = category;
    switchView('inventory');
    filterItems();
}

// Add Item
async function addItem(e) {
    e.preventDefault();
    
    const category = document.getElementById('itemCategory').value;
    const itemId = generateItemId(category);
    const today = new Date().toISOString().split('T')[0];
    
    const newItem = {
        itemId: itemId,
        name: document.getElementById('itemName').value,
        category: category,
        subCategory: document.getElementById('itemSubCategory').value,
        quantity: parseInt(document.getElementById('itemQuantity').value) || 1,
        status: document.getElementById('itemStatus').value,
        location: document.getElementById('itemLocation').value,
        value: parseInt(document.getElementById('itemValue').value) || 0,
        addedDate: today,
        notes: document.getElementById('itemNotes').value,
        // Rental fields (only relevant for Rented Equipment)
        returnDate: document.getElementById('itemReturnDate')?.value || '',
        eventProject: document.getElementById('itemEventProject')?.value || '',
        vendorName: document.getElementById('itemVendorName')?.value || '',
        vendorContact: document.getElementById('itemVendorContact')?.value || '',
        rentalCost: parseInt(document.getElementById('itemRentalCost')?.value) || 0,
        deposit: parseInt(document.getElementById('itemDeposit')?.value) || 0
    };
    
    try {
        showToast('Adding item...', 'success');
        
        const response = await fetch(CONFIG.APPS_SCRIPT_URL + '?action=add', {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newItem)
        });
        
        showToast('✅ Item added successfully!', 'success');
        document.getElementById('addItemForm').reset();
        toggleRentalFields(); // Hide rental fields after reset
        
        // Reload data after short delay
        setTimeout(() => loadData(), 1500);
        
    } catch (error) {
        console.error('Error adding item:', error);
        showToast('Failed to add item: ' + error.message, 'error');
    }
}

function generateItemId(category) {
    const prefix = CATEGORY_PREFIXES[category] || 'XX';
    const existing = inventoryData.filter(i => i.category === category).length;
    const num = String(existing + 1).padStart(3, '0');
    return `${prefix}-${num}`;
}

function updateItemId() {
    const category = document.getElementById('itemCategory').value;
    if (category) {
        const newId = generateItemId(category);
        console.log('Generated ID:', newId);
    }
    updateSubCategoryDropdown('itemSubCategory', category);
}

function updateSubCategoryDropdown(selectId, category) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    const subCats = SUB_CATEGORIES[category] || [];
    select.innerHTML = '<option value="">Select Sub-Category</option>' +
        subCats.map(sub => `<option value="${sub}">${sub}</option>`).join('');
}

function updateEditSubCategory() {
    const category = document.getElementById('editItemCategory').value;
    updateSubCategoryDropdown('editItemSubCategory', category);
}

// Toggle rental fields visibility
function toggleRentalFields() {
    const category = document.getElementById('itemCategory').value;
    const rentalFields = document.getElementById('rentalFields');
    if (rentalFields) {
        rentalFields.style.display = (category === 'Rented Equipment') ? 'block' : 'none';
    }
}

function toggleEditRentalFields() {
    const category = document.getElementById('editItemCategory').value;
    const rentalFields = document.getElementById('editRentalFields');
    if (rentalFields) {
        rentalFields.style.display = (category === 'Rented Equipment') ? 'block' : 'none';
    }
}

// Edit Item
function editItem(rowIndex) {
    const item = inventoryData.find(i => i.rowIndex === rowIndex);
    if (!item) return;
    
    document.getElementById('editRowIndex').value = rowIndex;
    document.getElementById('editItemId').value = item.itemId;
    document.getElementById('editItemName').value = item.name;
    document.getElementById('editItemCategory').value = item.category;
    
    // Populate sub-category dropdown first, then set value
    updateSubCategoryDropdown('editItemSubCategory', item.category);
    document.getElementById('editItemSubCategory').value = item.subCategory;
    
    document.getElementById('editItemQuantity').value = item.quantity;
    document.getElementById('editItemStatus').value = item.status;
    document.getElementById('editItemLocation').value = item.location;
    document.getElementById('editItemValue').value = item.value;
    document.getElementById('editItemNotes').value = item.notes;
    
    // Rental fields
    document.getElementById('editItemReturnDate').value = item.returnDate || '';
    document.getElementById('editItemEventProject').value = item.eventProject || '';
    document.getElementById('editItemVendorName').value = item.vendorName || '';
    document.getElementById('editItemVendorContact').value = item.vendorContact || '';
    document.getElementById('editItemRentalCost').value = item.rentalCost || 0;
    document.getElementById('editItemDeposit').value = item.deposit || 0;
    
    // Toggle rental fields visibility
    toggleEditRentalFields();
    
    document.getElementById('editModal').classList.add('active');
}

function closeModal() {
    document.getElementById('editModal').classList.remove('active');
}

async function saveEdit(e) {
    e.preventDefault();
    
    const rowIndex = parseInt(document.getElementById('editRowIndex').value);
    const existingItem = inventoryData.find(i => i.rowIndex == rowIndex);
    
    const updatedData = {
        rowIndex: rowIndex,
        itemId: document.getElementById('editItemId').value,
        name: document.getElementById('editItemName').value,
        category: document.getElementById('editItemCategory').value,
        subCategory: document.getElementById('editItemSubCategory').value,
        quantity: parseInt(document.getElementById('editItemQuantity').value) || 1,
        status: document.getElementById('editItemStatus').value,
        location: document.getElementById('editItemLocation').value,
        value: parseInt(document.getElementById('editItemValue').value) || 0,
        addedDate: existingItem?.addedDate || '',
        notes: document.getElementById('editItemNotes').value,
        // Rental fields
        returnDate: document.getElementById('editItemReturnDate')?.value || '',
        eventProject: document.getElementById('editItemEventProject')?.value || '',
        vendorName: document.getElementById('editItemVendorName')?.value || '',
        vendorContact: document.getElementById('editItemVendorContact')?.value || '',
        rentalCost: parseInt(document.getElementById('editItemRentalCost')?.value) || 0,
        deposit: parseInt(document.getElementById('editItemDeposit')?.value) || 0
    };
    
    try {
        showToast('Updating item...', 'success');
        
        await fetch(CONFIG.APPS_SCRIPT_URL + '?action=update', {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });
        
        closeModal();
        showToast('✅ Item updated successfully!', 'success');
        
        // Reload data after short delay
        setTimeout(() => loadData(), 1500);
        
    } catch (error) {
        console.error('Error updating item:', error);
        showToast('Failed to update item: ' + error.message, 'error');
    }
}

async function deleteItem() {
    const rowIndex = document.getElementById('editRowIndex').value;
    
    if (!confirm('Are you sure you want to delete this item?')) {
        return;
    }
    
    try {
        showToast('Deleting item...', 'success');
        
        await fetch(CONFIG.APPS_SCRIPT_URL + '?action=delete&row=' + rowIndex, {
            method: 'POST',
            mode: 'no-cors'
        });
        
        closeModal();
        showToast('✅ Item deleted successfully!', 'success');
        
        // Reload data after short delay
        setTimeout(() => loadData(), 1500);
        
    } catch (error) {
        console.error('Error deleting item:', error);
        showToast('Failed to delete item: ' + error.message, 'error');
    }
}

// Export
function exportData() {
    const headers = ['Item ID', 'Name', 'Category', 'Sub-Category', 'Quantity', 'Status', 'Location', 'Value', 'Added Date', 'Notes'];
    const rows = filteredData.map(item => [
        item.itemId, item.name, item.category, item.subCategory,
        item.quantity, item.status, item.location, item.value,
        item.addedDate, item.notes
    ]);
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `cft-inventory-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    
    showToast('Exported to CSV!', 'success');
}

// Toast
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show ' + type;
    
    setTimeout(async () => {
        toast.classList.remove('show');
    }, 3000);
}

// Close modal on outside click
document.getElementById('editModal').addEventListener('click', (e) => {
    if (e.target.id === 'editModal') {
        closeModal();
    }
});

// ============================================
// DELIVERY CHANNELS FUNCTIONALITY
// ============================================

let dcData = [];
let filteredDCs = [];
let selectedDCItems = [];

// DC Status labels
const DC_STATUS_LABELS = {
    'Draft': '📝 Draft',
    'Pending Approval': '⏳ Pending Approval',
    'Approved': '✅ Approved',
    'Dispatched': '🚚 Dispatched',
    'At Event': '📍 At Event',
    'Returning': '↩️ Returning',
    'Inspection': '🔍 Inspection',
    'Closed': '✅ Closed'
};

// Load DC Data
async function loadDCData() {
    try {
        const cacheBuster = Date.now();
        const response = await fetch('/.netlify/functions/get-delivery-channels?_=' + cacheBuster, {
            cache: 'no-store'
        });
        const csvText = await response.text();
        const data = parseCSV(csvText);
        
        if (data && data.length > 1) {
            dcData = data.slice(1).filter(row => row[0]).map((row, index) => ({
                rowIndex: index + 2,
                dcNumber: row[0] || '',
                eventName: row[1] || '',
                activity: row[2] || '',
                eventDate: row[3] || '',
                eventLocation: row[4] || '',
                clientName: row[5] || '',
                clientPOC: row[6] || '',
                clientPhone: row[7] || '',
                sitePOC: row[8] || '',
                sitePhone: row[9] || '',
                carrierName: row[10] || '',
                carrierPhone: row[11] || '',
                vehicleNumber: row[12] || '',
                dispatchDate: row[13] || '',
                expectedReturn: row[14] || '',
                actualReturn: row[15] || '',
                status: row[16] || 'Draft',
                pmApprover: row[17] || '',
                approvalDate: row[18] || '',
                notes: row[19] || '',
                createdDate: row[20] || '',
                fromAddress: row[21] || '',
                toAddress: row[22] || ''
            }));
            
            filteredDCs = [...dcData];
            updateDCList();
        }
    } catch (error) {
        console.error('Error loading DC data:', error);
    }
}

// Generate DC Number
function generateDCNumber() {
    const existing = dcData.length;
    const num = String(existing + 1).padStart(3, '0');
    return `DC-${num}`;
}

// Update DC List View
function updateDCList() {
    const container = document.getElementById('dcList');
    if (!container) return;
    
    if (filteredDCs.length === 0) {
        container.innerHTML = '<div class="empty-state" style="text-align: center; padding: 60px; color: var(--text-muted);">No delivery channels found. Create one to get started!</div>';
        return;
    }
    
    container.innerHTML = filteredDCs.map(dc => `
        <div class="dc-card" onclick="viewDCDetail('${dc.dcNumber}')">
            <div class="dc-card-header">
                <div>
                    <div class="dc-card-title">${dc.eventName}</div>
                    <div class="dc-card-number">${dc.dcNumber} • ${dc.activity}</div>
                </div>
                <span class="dc-card-status dc-status-${dc.status.toLowerCase().replace(' ', '')}">${DC_STATUS_LABELS[dc.status] || dc.status}</span>
            </div>
            <div class="dc-card-details">
                <div class="dc-card-detail">
                    <span class="dc-card-detail-label">Client</span>
                    <span class="dc-card-detail-value">${dc.clientName}</span>
                </div>
                <div class="dc-card-detail">
                    <span class="dc-card-detail-label">Event Date</span>
                    <span class="dc-card-detail-value">${dc.eventDate}</span>
                </div>
                <div class="dc-card-detail">
                    <span class="dc-card-detail-label">Location</span>
                    <span class="dc-card-detail-value">${dc.eventLocation}</span>
                </div>
                <div class="dc-card-detail">
                    <span class="dc-card-detail-label">Carrier</span>
                    <span class="dc-card-detail-value">${dc.carrierName}</span>
                </div>
                <div class="dc-card-detail">
                    <span class="dc-card-detail-label">Expected Return</span>
                    <span class="dc-card-detail-value">${dc.expectedReturn}</span>
                </div>
                <div class="dc-card-detail">
                    <span class="dc-card-detail-label">Created</span>
                    <span class="dc-card-detail-value">${dc.createdDate}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// Filter DCs
function filterDCs() {
    const status = document.getElementById('dcStatusFilter')?.value || '';
    const search = document.getElementById('dcSearch')?.value.toLowerCase() || '';
    
    filteredDCs = dcData.filter(dc => {
        const matchStatus = !status || dc.status === status;
        const matchSearch = !search || 
            dc.eventName.toLowerCase().includes(search) ||
            dc.clientName.toLowerCase().includes(search) ||
            dc.dcNumber.toLowerCase().includes(search);
        return matchStatus && matchSearch;
    });
    
    updateDCList();
}

// Populate Available Items for DC
function populateAvailableItems() {
    const container = document.getElementById('availableItemsList');
    if (!container) return;
    
    const availableItems = inventoryData.filter(item => 
        item.status === 'Available' && item.category !== 'Dead Stock'
    );
    
    container.innerHTML = availableItems.map(item => `
        <div class="item-row" onclick="toggleItemSelection('${item.itemId}')" id="avail-${item.itemId}">
            <div class="item-row-info">
                <div class="item-row-name">${item.name}</div>
                <div class="item-row-meta">${item.itemId} • ${item.category} • Qty: ${item.quantity}</div>
            </div>
            <div class="item-row-qty">
                <input type="number" min="1" max="${item.quantity}" value="1" 
                       onclick="event.stopPropagation()" 
                       id="qty-${item.itemId}">
            </div>
        </div>
    `).join('');
}

// Filter Available Items
function filterAvailableItems() {
    const search = document.getElementById('itemSearchDC')?.value.toLowerCase() || '';
    const container = document.getElementById('availableItemsList');
    
    const availableItems = inventoryData.filter(item => 
        item.status === 'Available' && 
        item.category !== 'Dead Stock' &&
        (!search || item.name.toLowerCase().includes(search) || item.itemId.toLowerCase().includes(search))
    );
    
    container.innerHTML = availableItems.map(item => {
        const isSelected = selectedDCItems.find(s => s.itemId === item.itemId);
        return `
            <div class="item-row ${isSelected ? 'selected' : ''}" onclick="toggleItemSelection('${item.itemId}')" id="avail-${item.itemId}">
                <div class="item-row-info">
                    <div class="item-row-name">${item.name}</div>
                    <div class="item-row-meta">${item.itemId} • ${item.category} • Qty: ${item.quantity}</div>
                </div>
                <div class="item-row-qty">
                    <input type="number" min="1" max="${item.quantity}" value="${isSelected?.qty || 1}" 
                           onclick="event.stopPropagation()" 
                           onchange="updateItemQty('${item.itemId}', this.value)"
                           id="qty-${item.itemId}">
                </div>
            </div>
        `;
    }).join('');
}

// Toggle Item Selection
function toggleItemSelection(itemId) {
    const item = inventoryData.find(i => i.itemId === itemId);
    if (!item) return;
    
    const existingIndex = selectedDCItems.findIndex(s => s.itemId === itemId);
    const qtyInput = document.getElementById(`qty-${itemId}`);
    const qty = parseInt(qtyInput?.value) || 1;
    
    if (existingIndex >= 0) {
        selectedDCItems.splice(existingIndex, 1);
    } else {
        selectedDCItems.push({
            itemId: item.itemId,
            name: item.name,
            category: item.category,
            qty: qty,
            maxQty: item.quantity
        });
    }
    
    updateSelectedItemsList();
    filterAvailableItems();
}

// Update Item Quantity
function updateItemQty(itemId, qty) {
    const item = selectedDCItems.find(s => s.itemId === itemId);
    if (item) {
        item.qty = Math.min(parseInt(qty) || 1, item.maxQty);
    }
    updateSelectedItemsList();
}

// Update Selected Items List
function updateSelectedItemsList() {
    const container = document.getElementById('selectedItemsList');
    const countSpan = document.getElementById('selectedCount');
    
    if (countSpan) countSpan.textContent = selectedDCItems.length;
    
    if (!container) return;
    
    if (selectedDCItems.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No items selected</div>';
        return;
    }
    
    container.innerHTML = selectedDCItems.map(item => `
        <div class="item-row selected">
            <div class="item-row-info">
                <div class="item-row-name">${item.name}</div>
                <div class="item-row-meta">${item.itemId} • ${item.category}</div>
            </div>
            <div class="item-row-qty">
                <span>Qty: ${item.qty}</span>
                <button onclick="removeSelectedItem('${item.itemId}')" style="background: none; border: none; color: var(--danger); cursor: pointer; font-size: 16px;">✕</button>
            </div>
        </div>
    `).join('');
}

// Remove Selected Item
function removeSelectedItem(itemId) {
    selectedDCItems = selectedDCItems.filter(i => i.itemId !== itemId);
    updateSelectedItemsList();
    filterAvailableItems();
}

// Create Delivery Channel
async function createDC(e) {
    e.preventDefault();
    
    const form = document.getElementById('createDCForm');
    const isEditing = form.dataset.editingDC;
    
    // For new DC, require items. For edit, items are optional (keep existing)
    if (!isEditing && selectedDCItems.length === 0) {
        showToast('Please select at least one item!', 'error');
        return;
    }
    
    const dcNumber = isEditing ? form.dataset.editingDC : generateDCNumber();
    const today = new Date().toISOString().split('T')[0];
    
    const dcPayload = {
        dcNumber: dcNumber,
        rowIndex: form.dataset.rowIndex || null,
        eventName: document.getElementById('dcEventName').value,
        activity: document.getElementById('dcActivity').value,
        eventDate: document.getElementById('dcEventDate').value,
        eventLocation: document.getElementById('dcEventLocation').value,
        clientName: document.getElementById('dcClientName').value,
        clientPOC: document.getElementById('dcClientPOC').value || '',
        clientPhone: document.getElementById('dcClientPhone').value || '',
        sitePOC: document.getElementById('dcSitePOC').value || '',
        sitePhone: document.getElementById('dcSitePhone').value || '',
        carrierName: document.getElementById('dcCarrierName').value,
        carrierPhone: document.getElementById('dcCarrierPhone').value || '',
        vehicleNumber: document.getElementById('dcVehicleNumber').value || '',
        dispatchDate: document.getElementById('dcDispatchDate').value || '',
        expectedReturn: document.getElementById('dcExpectedReturn').value,
        actualReturn: '',
        status: 'Draft',
        pmApprover: '',
        approvalDate: '',
        notes: document.getElementById('dcNotes').value || '',
        createdDate: today,
        fromAddress: document.getElementById('dcFromAddress').value || '',
        toAddress: document.getElementById('dcToAddress').value || '',
        items: selectedDCItems
    };
    
    try {
        const action = isEditing ? 'updateDC' : 'createDC';
        showToast(isEditing ? 'Updating DC...' : 'Creating Delivery Channel...', 'success');
        
        await fetch(CONFIG.APPS_SCRIPT_URL + '?action=' + action, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dcPayload)
        });
        
        showToast(`✅ ${dcNumber} ${isEditing ? 'updated' : 'created'} successfully!`, 'success');
        
        // Reset form and edit mode
        form.reset();
        delete form.dataset.editingDC;
        delete form.dataset.rowIndex;
        selectedDCItems = [];
        updateSelectedItemsList();
        
        // Reset button text
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = '📦 Create DC';
        
        // Reload and switch view
        setTimeout(async () => {
            await loadDCData(); await new Promise(r => setTimeout(r, 1000));
            switchView('deliveryChannels');
        }, 1500);
        
    } catch (error) {
        console.error('Error with DC:', error);
        showToast('Failed to process DC', 'error');
    }
}

// View DC Detail
function viewDCDetail(dcNumber) {
    const dc = dcData.find(d => d.dcNumber === dcNumber);
    if (!dc) return;
    
    const container = document.getElementById('dcDetailContainer');
    
    // Simplified status flow: Draft → Checked Out → Checked In → Closed
    const statuses = ['Draft', 'Checked Out', 'Checked In', 'Closed'];
    const statusMap = {
        'Draft': 0,
        'Pending Approval': 0,
        'Approved': 0,
        'Dispatched': 1,
        'At Event': 1,
        'Returning': 2,
        'Inspection': 2,
        'Closed': 3
    };
    const currentStep = statusMap[dc.status] || 0;
    
    // Determine which action buttons to show
    let checkOutBtn = '';
    let checkInBtn = '';
    
    // Show Check Out button when Draft (simplified - no approval needed)
    if (['Draft', 'Pending Approval', 'Approved'].includes(dc.status)) {
        checkOutBtn = `<button class="btn-checkout" onclick="openCheckoutModal('${dcNumber}')">📤 Check Out</button>`;
    }
    
    // Show Check In button when Checked Out
    if (['Dispatched', 'At Event', 'Returning', 'Inspection'].includes(dc.status)) {
        checkInBtn = `<button class="btn-checkin" onclick="openCheckinModal('${dcNumber}')">📥 Check In</button>`;
    }
    
    container.innerHTML = `
        <div class="dc-detail-header">
            <div>
                <h2>${dc.eventName}</h2>
                <p style="color: var(--text-muted);">${dc.dcNumber} • ${dc.activity}</p>
            </div>
            <div class="dc-detail-actions">
                ${checkOutBtn}
                ${checkInBtn}
                <button class="btn-edit-dc" onclick="editDC('${dcNumber}')">✏️ Edit</button>
                <button class="btn-delete-dc" onclick="deleteDC('${dcNumber}')">🗑️ Delete</button>
                <button class="btn-pdf-download" onclick="downloadPDF('${dcNumber}')">
                    <span>📄</span> Download PDF
                </button>
                <button class="btn-back" onclick="switchView('deliveryChannels')">← Back</button>
            </div>
        </div>
        
        <!-- Status Tabs (Minimalistic) -->
        <div class="status-tabs">
            ${statuses.map((status, idx) => `
                <div class="status-tab ${idx < currentStep ? 'completed' : ''} ${idx === currentStep ? 'active' : ''}">
                    ${status}
                </div>
            `).join('')}
        </div>
        
        <div class="dc-detail-section">
            <h4>Event Details</h4>
            <div class="dc-detail-grid">
                <div class="dc-detail-field">
                    <span class="dc-detail-field-label">Event Name</span>
                    <span class="dc-detail-field-value">${dc.eventName}</span>
                </div>
                <div class="dc-detail-field">
                    <span class="dc-detail-field-label">Activity</span>
                    <span class="dc-detail-field-value">${dc.activity}</span>
                </div>
                <div class="dc-detail-field">
                    <span class="dc-detail-field-label">Event Date</span>
                    <span class="dc-detail-field-value">${dc.eventDate}</span>
                </div>
                <div class="dc-detail-field">
                    <span class="dc-detail-field-label">Location</span>
                    <span class="dc-detail-field-value">${dc.eventLocation}</span>
                </div>
                <div class="dc-detail-field">
                    <span class="dc-detail-field-label">Client</span>
                    <span class="dc-detail-field-value">${dc.clientName}</span>
                </div>
            </div>
        </div>
        
        <div class="dc-detail-section">
            <h4>Point of Contact</h4>
            <div class="dc-detail-grid">
                <div class="dc-detail-field">
                    <span class="dc-detail-field-label">Client POC</span>
                    <span class="dc-detail-field-value">${dc.clientPOC || '-'}</span>
                </div>
                <div class="dc-detail-field">
                    <span class="dc-detail-field-label">Client Phone</span>
                    <span class="dc-detail-field-value">${dc.clientPhone || '-'}</span>
                </div>
                <div class="dc-detail-field">
                    <span class="dc-detail-field-label">Site POC</span>
                    <span class="dc-detail-field-value">${dc.sitePOC || '-'}</span>
                </div>
                <div class="dc-detail-field">
                    <span class="dc-detail-field-label">Site Phone</span>
                    <span class="dc-detail-field-value">${dc.sitePhone || '-'}</span>
                </div>
            </div>
        </div>
        
        <div class="dc-detail-section">
            <h4>Logistics</h4>
            <div class="dc-detail-grid">
                <div class="dc-detail-field">
                    <span class="dc-detail-field-label">Carrier</span>
                    <span class="dc-detail-field-value">${dc.carrierName}</span>
                </div>
                <div class="dc-detail-field">
                    <span class="dc-detail-field-label">Carrier Phone</span>
                    <span class="dc-detail-field-value">${dc.carrierPhone}</span>
                </div>
                <div class="dc-detail-field">
                    <span class="dc-detail-field-label">Vehicle</span>
                    <span class="dc-detail-field-value">${dc.vehicleNumber || '-'}</span>
                </div>
                <div class="dc-detail-field">
                    <span class="dc-detail-field-label">Dispatch Date</span>
                    <span class="dc-detail-field-value">${dc.dispatchDate || 'Not dispatched'}</span>
                </div>
                <div class="dc-detail-field">
                    <span class="dc-detail-field-label">Expected Return</span>
                    <span class="dc-detail-field-value">${dc.expectedReturn}</span>
                </div>
                <div class="dc-detail-field">
                    <span class="dc-detail-field-label">Actual Return</span>
                    <span class="dc-detail-field-value">${dc.actualReturn || '-'}</span>
                </div>
            </div>
        </div>
        
        ${dc.pmApprover ? `
        <div class="dc-detail-section">
            <h4>Approval</h4>
            <div class="dc-detail-grid">
                <div class="dc-detail-field">
                    <span class="dc-detail-field-label">Approved By</span>
                    <span class="dc-detail-field-value">${dc.pmApprover}</span>
                </div>
                <div class="dc-detail-field">
                    <span class="dc-detail-field-label">Approval Date</span>
                    <span class="dc-detail-field-value">${dc.approvalDate}</span>
                </div>
            </div>
        </div>
        ` : ''}
        
        <div class="dc-detail-section">
            <h4>Items (Loading...)</h4>
            <div id="dcItemsTable">Loading items...</div>
        </div>
        
        ${dc.notes ? `
        <div class="dc-detail-section">
            <h4>Notes</h4>
            <p>${dc.notes}</p>
        </div>
        ` : ''}
    `;
    
    switchView('dcDetail');
    loadDCItems(dcNumber);
}

// Load DC Items
// Edit DC - Open form with existing data
async function editDC(dcNumber) {
    const dc = dcData.find(d => d.dcNumber === dcNumber);
    if (!dc) return;
    
    // Switch to create DC view and populate form
    switchView('createDC');
    
    // Populate form fields
    document.getElementById('dcEventName').value = dc.eventName || '';
    document.getElementById('dcActivity').value = dc.activity || '';
    document.getElementById('dcEventDate').value = dc.eventDate || '';
    document.getElementById('dcEventLocation').value = dc.eventLocation || '';
    document.getElementById('dcClientName').value = dc.clientName || '';
    document.getElementById('dcClientPOC').value = dc.clientPOC || '';
    document.getElementById('dcClientPhone').value = dc.clientPhone || '';
    document.getElementById('dcSitePOC').value = dc.sitePOC || '';
    document.getElementById('dcSitePhone').value = dc.sitePhone || '';
    document.getElementById('dcCarrierName').value = dc.carrierName || '';
    document.getElementById('dcCarrierPhone').value = dc.carrierPhone || '';
    document.getElementById('dcVehicleNumber').value = dc.vehicleNumber || '';
    document.getElementById('dcDispatchDate').value = dc.dispatchDate || '';
    document.getElementById('dcExpectedReturn').value = dc.expectedReturn || '';
    document.getElementById('dcNotes').value = dc.notes || '';
    document.getElementById('dcFromAddress').value = dc.fromAddress || '';
    document.getElementById('dcToAddress').value = dc.toAddress || '';
    
    // Store the DC number for update
    document.getElementById('createDCForm').dataset.editingDC = dcNumber;
    document.getElementById('createDCForm').dataset.rowIndex = dc.rowIndex;
    
    // Change button text
    const submitBtn = document.querySelector('#createDCForm button[type="submit"]');
    if (submitBtn) submitBtn.textContent = '💾 Update DC';
    
    // Load existing DC items
    try {
        const response = await fetch('/.netlify/functions/get-dc-items?dc=' + dcNumber + '&_=' + Date.now());
        const csvText = await response.text();
        const data = parseCSV(csvText);
        const existingItems = data.slice(1).filter(row => row[0] === dcNumber);
        
        // Clear and populate selectedDCItems with existing items
        selectedDCItems = existingItems.map(item => ({
            itemId: item[1],
            name: item[2],
            category: item[3],
            qty: parseInt(item[4]) || 1,
            maxQty: 999 // Allow flexible qty in edit mode
        }));
        
        updateSelectedItemsList();
        showToast(`Edit mode - ${selectedDCItems.length} items loaded`, 'success');
    } catch (e) {
        console.error('Error loading DC items:', e);
        showToast('Edit mode - Could not load existing items', 'warning');
    }
}

// Delete DC
async function deleteDC(dcNumber) {
    const dc = dcData.find(d => d.dcNumber === dcNumber);
    if (!dc) return;
    
    if (!confirm(`Delete ${dcNumber} - "${dc.eventName}"?\n\nThis will also remove all items linked to this DC.`)) {
        return;
    }
    
    try {
        showToast('Deleting DC...', 'success');
        
        await fetch(CONFIG.APPS_SCRIPT_URL + '?action=deleteDC', {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dcNumber: dcNumber, rowIndex: dc.rowIndex })
        });
        
        showToast('✅ DC deleted!', 'success');
        
        setTimeout(async () => {
            await loadDCData(); await new Promise(r => setTimeout(r, 1000));
            switchView('deliveryChannels');
        }, 1500);
        
    } catch (error) {
        console.error('Error deleting DC:', error);
        showToast('Failed to delete DC', 'error');
    }
}

async function loadDCItems(dcNumber) {
    try {
        const response = await fetch('/.netlify/functions/get-dc-items?dc=' + dcNumber + '&_=' + Date.now());
        const csvText = await response.text();
        const data = parseCSV(csvText);
        
        const items = data.slice(1).filter(row => row[0] === dcNumber);
        
        const container = document.getElementById('dcItemsTable');
        if (items.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted);">No items found</p>';
            return;
        }
        
        container.innerHTML = `
            <table class="dc-items-table">
                <thead>
                    <tr>
                        <th>Item ID</th>
                        <th>Name</th>
                        <th>Category</th>
                        <th>Qty</th>
                        <th>Return Condition</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => `
                        <tr>
                            <td><code>${item[1]}</code></td>
                            <td>${item[2]}</td>
                            <td>${item[3]}</td>
                            <td>${item[4]}</td>
                            <td>${item[5] || '-'}</td>
                            <td>${item[6] || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Error loading DC items:', error);
        document.getElementById('dcItemsTable').innerHTML = '<p style="color: var(--danger);">Error loading items</p>';
    }
}

// Status Updates
async function submitForApproval(dcNumber) {
    await updateDCStatus(dcNumber, 'Pending Approval');
}

async function approveDC(dcNumber) {
    const approver = prompt('Enter PM name for approval:');
    if (!approver) return;
    
    try {
        await fetch(CONFIG.APPS_SCRIPT_URL + '?action=approveDC', {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dcNumber, approver, date: new Date().toISOString().split('T')[0] })
        });
        
        showToast('✅ DC Approved!', 'success');
        setTimeout(async () => { await loadDCData(); await new Promise(r => setTimeout(r, 1000)); viewDCDetail(dcNumber); }, 1500);
    } catch (error) {
        showToast('Error approving DC', 'error');
    }
}

async function dispatchDC(dcNumber) {
    const today = new Date().toISOString().split('T')[0];
    try {
        await fetch(CONFIG.APPS_SCRIPT_URL + '?action=dispatchDC', {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dcNumber, dispatchDate: today })
        });
        
        showToast('🚚 DC Dispatched!', 'success');
        setTimeout(async () => { await loadDCData(); await new Promise(r => setTimeout(r, 1000)); viewDCDetail(dcNumber); }, 1500);
    } catch (error) {
        showToast('Error dispatching DC', 'error');
    }
}

async function updateDCStatus(dcNumber, newStatus) {
    try {
        await fetch(CONFIG.APPS_SCRIPT_URL + '?action=updateDCStatus', {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dcNumber, status: newStatus })
        });
        
        showToast(`Status updated to ${newStatus}`, 'success');
        setTimeout(async () => { await loadDCData(); await new Promise(r => setTimeout(r, 1000)); viewDCDetail(dcNumber); }, 1500);
    } catch (error) {
        showToast('Error updating status', 'error');
    }
}

async function closeDC(dcNumber) {
    const today = new Date().toISOString().split('T')[0];
    try {
        await fetch(CONFIG.APPS_SCRIPT_URL + '?action=closeDC', {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dcNumber, actualReturn: today })
        });
        
        showToast('✅ DC Closed!', 'success');
        setTimeout(async () => { await loadDCData(); await new Promise(r => setTimeout(r, 1000)); viewDCDetail(dcNumber); }, 1500);
    } catch (error) {
        showToast('Error closing DC', 'error');
    }
}

// WhatsApp Share
function shareToWhatsApp(dcNumber) {
    const dc = dcData.find(d => d.dcNumber === dcNumber);
    if (!dc) return;
    
    const text = `🚚 *DELIVERY CHANNEL - ${dc.dcNumber}*

📋 *Event:* ${dc.eventName}
🎯 *Activity:* ${dc.activity}
📅 *Date:* ${dc.eventDate}
📍 *Location:* ${dc.eventLocation}
🏢 *Client:* ${dc.clientName}

👤 *Client POC:* ${dc.clientPOC || '-'} (${dc.clientPhone || '-'})
👷 *Carrier:* ${dc.carrierName} (${dc.carrierPhone})
🚗 *Vehicle:* ${dc.vehicleNumber || '-'}

📦 *Status:* ${DC_STATUS_LABELS[dc.status]}
📅 *Expected Return:* ${dc.expectedReturn}

${dc.notes ? `📝 *Notes:* ${dc.notes}` : ''}

---
_CFT Inventory System_`;

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

// PDF Download
async function downloadPDF(dcNumber) {
    const dc = dcData.find(d => d.dcNumber === dcNumber);
    if (!dc) return;
    
    showToast('Generating PDF...', 'success');
    
    // Fetch items for this DC and inventory data for descriptions
    let itemsHtml = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#666;">No items</td></tr>';
    let totalItems = 0;
    try {
        // Fetch DC items
        const response = await fetch('/.netlify/functions/get-dc-items?dc=' + dcNumber + '&_=' + Date.now());
        const csvText = await response.text();
        const data = parseCSV(csvText);
        const items = data.slice(1).filter(row => row[0] === dcNumber);
        
        // Fetch inventory to get item notes/descriptions
        const invResponse = await fetch('/.netlify/functions/get-inventory?_=' + Date.now());
        const invCsv = await invResponse.text();
        const invData = parseCSV(invCsv);
        const inventoryMap = {};
        invData.slice(1).forEach(row => {
            if (row[0]) inventoryMap[row[0]] = { notes: row[9] || '', category: row[2] || '' };
        });
        
        if (items.length > 0) {
            totalItems = items.reduce((sum, item) => sum + (parseInt(item[4]) || 0), 0);
            // Columns: Item SKU | Name | Description (notes) | Qty | Out | In | Remarks
            itemsHtml = items.map((item, idx) => {
                const invItem = inventoryMap[item[1]] || {};
                const description = invItem.notes || item[3] || '-';
                return `
                <tr>
                    <td>${item[1]}</td>
                    <td>${item[2]}</td>
                    <td style="font-size:9px;">${description}</td>
                    <td style="text-align:center;">${item[4]}</td>
                    <td style="text-align:center;"><div class="checkbox"></div></td>
                    <td style="text-align:center;"><div class="checkbox"></div></td>
                    <td style="min-height:40px;"></td>
                </tr>
            `}).join('');
        }
    } catch (e) {
        console.error('Error fetching items for PDF:', e);
    }
    
    // Craftech360 Brand Colors
    const brandOrange = '#F5A623';
    const brandDark = '#1A1A1A';
    const brandLight = '#FFF8E7';
    
    // Create printable content - Clean tabular layout
    const printContent = `
        <html>
        <head>
            <title>Delivery Challan - ${dc.dcNumber}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 15px; font-size: 11px; color: #333; }
                .container { max-width: 800px; margin: 0 auto; }
                
                /* Header */
                .header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 2px solid ${brandOrange}; margin-bottom: 12px; }
                .company-info { display: flex; align-items: center; gap: 12px; }
                .company-logo { width: 70px; height: 70px; flex-shrink: 0; }
                .company-logo img { width: 100%; height: auto; }
                .company-text { }
                .company-name { font-size: 16px; font-weight: bold; color: #000; }
                .company-details { font-size: 9px; color: #666; line-height: 1.4; margin-top: 4px; }
                .doc-info { text-align: right; }
                .doc-title { font-size: 18px; font-weight: bold; color: ${brandOrange}; }
                .doc-number { font-size: 14px; font-weight: 600; margin-top: 4px; }
                .doc-date { font-size: 11px; color: #666; }
                
                /* Section Title */
                .section-title { font-size: 11px; font-weight: bold; color: ${brandOrange}; margin: 12px 0 6px 0; text-transform: uppercase; }
                
                /* Info Table */
                .info-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
                .info-table td { padding: 6px 10px; border: 1px solid #ddd; vertical-align: top; }
                .info-table .label { font-size: 9px; color: #888; text-transform: uppercase; }
                .info-table .value { font-size: 11px; font-weight: 500; color: #000; margin-top: 2px; }
                
                /* Items Table */
                .items-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
                .items-table th { background: ${brandOrange}; color: white; padding: 8px 6px; text-align: left; font-size: 9px; text-transform: uppercase; border: 1px solid ${brandOrange}; }
                .items-table td { padding: 8px 6px; border: 1px solid #ddd; vertical-align: middle; font-size: 10px; }
                .items-table tr:nth-child(even) { background: #fafafa; }
                .checkbox { width: 16px; height: 16px; border: 1.5px solid #333; display: inline-block; }
                
                /* Signatures */
                .signature-section { display: flex; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 15px; }
                .signature-box { flex: 1; text-align: center; }
                .signature-line { border-bottom: 1px solid #333; width: 140px; margin: 35px auto 8px; }
                .signature-label { font-size: 10px; color: #666; }
                
                /* Footer */
                .footer { margin-top: 15px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 8px; color: #999; text-align: center; }
                
                @media print { body { padding: 10px; } }
            </style>
        </head>
        <body>
            <div class="container">
                <!-- Header: Logo + Company + DC# & Date -->
                <div class="header">
                    <div class="company-info">
                        <div class="company-logo">
                            <img src="${typeof CRAFTECH_LOGO_BASE64 !== 'undefined' ? CRAFTECH_LOGO_BASE64 : ''}" alt="Craftech360">
                        </div>
                        <div class="company-text">
                            <div class="company-name">CFT360 Design Studio Pvt Ltd</div>
                            <div class="company-details">
                                Survey no 7/2, 1st floor, Divitigeramanahally, Mysore Road,<br>
                                near BHEL, Bengaluru 560026 | GSTIN: 29AALCC4500D1ZY
                            </div>
                        </div>
                    </div>
                    <div class="doc-info">
                        <div class="doc-title">DELIVERY CHALLAN</div>
                        <div class="doc-number">${dc.dcNumber}</div>
                        <div class="doc-date">Date: ${dc.createdDate || new Date().toISOString().split('T')[0]}</div>
                    </div>
                </div>
                
                <!-- Event Details Table -->
                <div class="section-title">Event Details</div>
                <table class="info-table">
                    <tr>
                        <td style="width:25%"><div class="label">Event Name</div><div class="value">${dc.eventName}</div></td>
                        <td style="width:25%"><div class="label">Activity</div><div class="value">${dc.activity}</div></td>
                        <td style="width:25%"><div class="label">Event Date</div><div class="value">${dc.eventDate}</div></td>
                        <td style="width:25%"><div class="label">Client</div><div class="value">${dc.clientName}</div></td>
                    </tr>
                    <tr>
                        <td><div class="label">Location</div><div class="value">${dc.eventLocation || '-'}</div></td>
                        <td><div class="label">Client POC</div><div class="value">${dc.clientPOC || '-'} ${dc.clientPhone ? '<br>' + dc.clientPhone : ''}</div></td>
                        <td><div class="label">Site POC</div><div class="value">${dc.sitePOC || '-'} ${dc.sitePhone ? '<br>' + dc.sitePhone : ''}</div></td>
                        <td><div class="label">Setup Date</div><div class="value">${dc.dispatchDate || '-'}</div></td>
                    </tr>
                </table>
                
                <!-- Shipping Addresses -->
                <div class="section-title">Shipping</div>
                <table class="info-table">
                    <tr>
                        <td style="width:50%"><div class="label">Ship From</div><div class="value" style="white-space:pre-line;">${dc.fromAddress || 'CFT360 Design Studio Pvt Ltd\nBengaluru, Karnataka'}</div></td>
                        <td style="width:50%"><div class="label">Ship To</div><div class="value" style="white-space:pre-line;">${dc.toAddress || dc.eventLocation || '-'}</div></td>
                    </tr>
                </table>
                
                <!-- Logistics Details Table -->
                <div class="section-title">Logistics & Approvals</div>
                <table class="info-table">
                    <tr>
                        <td style="width:20%"><div class="label">Dispatch Date</div><div class="value">${dc.dispatchDate || '-'}</div></td>
                        <td style="width:20%"><div class="label">Expected Return</div><div class="value">${dc.expectedReturn || '-'}</div></td>
                        <td style="width:20%"><div class="label">Carrier / Vehicle</div><div class="value">${dc.carrierName || '-'}<br>${dc.vehicleNumber || ''}</div></td>
                        <td style="width:20%"><div class="label">Event Executor</div><div class="value">${dc.sitePOC || '-'}</div></td>
                        <td style="width:20%"><div class="label">DC Approver</div><div class="value">${dc.pmApprover || '-'}</div></td>
                    </tr>
                </table>
                
                <!-- Items Table -->
                <div class="section-title">Items</div>
                <table class="items-table">
                    <thead>
                        <tr>
                            <th style="width:65px;">Item SKU</th>
                            <th style="width:120px;">Name</th>
                            <th style="width:180px;">Description</th>
                            <th style="width:35px;text-align:center;">Qty</th>
                            <th style="width:35px;text-align:center;">Out</th>
                            <th style="width:35px;text-align:center;">In</th>
                            <th style="width:130px;">Remarks</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
                
                <!-- Notes -->
                ${dc.notes ? `<div style="margin-top:10px;font-size:10px;"><strong>Notes:</strong> ${dc.notes}</div>` : ''}
                
                <!-- Signatures -->
                <div class="signature-section">
                    <div class="signature-box">
                        <div class="signature-line"></div>
                        <div class="signature-label">Dispatched By</div>
                    </div>
                    <div class="signature-box">
                        <div class="signature-line"></div>
                        <div class="signature-label">Received By</div>
                    </div>
                    <div class="signature-box">
                        <div class="signature-line"></div>
                        <div class="signature-label">Returned By</div>
                    </div>
                </div>
                
                <!-- Footer -->
                <div class="footer">
                    CFT360 Design Studio Pvt Ltd | www.craftech360.com | Generated: ${new Date().toLocaleString()}
                </div>
            </div>
        </body>
        </html>
    `;
    
    // Create temporary container for PDF generation
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = printContent;
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    document.body.appendChild(tempDiv);
    
    // Generate and download PDF
    const opt = {
        margin: 10,
        filename: `${dc.dcNumber}-${dc.eventName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(tempDiv.querySelector('.container') || tempDiv).save().then(() => {
        document.body.removeChild(tempDiv);
        showToast('✅ PDF downloaded!', 'success');
    }).catch(err => {
        console.error('PDF generation error:', err);
        document.body.removeChild(tempDiv);
        // Fallback to print
        const printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.print();
    });
}

// ==================== CHECK OUT / CHECK IN ====================

let currentCheckoutDC = null;
let currentCheckinDC = null;
let checkoutItems = [];
let checkinItems = [];

// Open Check Out Modal
async function openCheckoutModal(dcNumber) {
    currentCheckoutDC = dcNumber;
    const modal = document.getElementById('checkoutModal');
    const itemsList = document.getElementById('checkoutItemsList');
    
    itemsList.innerHTML = '<p style="text-align:center;padding:20px;">Loading items...</p>';
    modal.classList.add('active');
    
    try {
        const response = await fetch('/.netlify/functions/get-dc-items?dc=' + dcNumber + '&_=' + Date.now());
        const csvText = await response.text();
        const data = parseCSV(csvText);
        checkoutItems = data.slice(1).filter(row => row[0] === dcNumber).map(item => ({
            itemId: item[1],
            itemName: item[2],
            category: item[3],
            qty: parseInt(item[4]) || 1,
            checked: false
        }));
        
        if (checkoutItems.length === 0) {
            itemsList.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-muted);">No items in this DC</p>';
            return;
        }
        
        renderCheckoutItems();
        updateCheckoutCount();
    } catch (e) {
        console.error('Error loading items:', e);
        itemsList.innerHTML = '<p style="text-align:center;padding:20px;color:var(--danger);">Error loading items</p>';
    }
}

function renderCheckoutItems() {
    const itemsList = document.getElementById('checkoutItemsList');
    itemsList.innerHTML = checkoutItems.map((item, idx) => `
        <div class="checkout-item ${item.checked ? 'checked' : ''}" onclick="toggleCheckoutItem(${idx})">
            <div class="checkout-item-checkbox">${item.checked ? '✓' : ''}</div>
            <div class="checkout-item-info">
                <div class="checkout-item-name">${item.itemName}</div>
                <div class="checkout-item-meta">${item.itemId} • ${item.category}</div>
            </div>
            <div class="checkout-item-qty">×${item.qty}</div>
        </div>
    `).join('');
}

function toggleCheckoutItem(idx) {
    checkoutItems[idx].checked = !checkoutItems[idx].checked;
    renderCheckoutItems();
    updateCheckoutCount();
}

function updateCheckoutCount() {
    const checked = checkoutItems.filter(i => i.checked).length;
    const total = checkoutItems.length;
    document.getElementById('checkoutCount').textContent = `${checked} / ${total} items verified`;
    document.getElementById('confirmCheckoutBtn').disabled = checked !== total;
}

function selectAllCheckout() {
    checkoutItems.forEach(item => item.checked = true);
    renderCheckoutItems();
    updateCheckoutCount();
}

function closeCheckoutModal() {
    document.getElementById('checkoutModal').classList.remove('active');
    currentCheckoutDC = null;
    checkoutItems = [];
}

async function confirmCheckout() {
    if (!currentCheckoutDC) return;
    
    showToast('Processing check out...', 'success');
    
    // Update DC status to Dispatched
    await updateDCStatus(currentCheckoutDC, 'Dispatched');
    
    // Update inventory items status to "In Use"
    const itemIds = checkoutItems.map(item => item.itemId);
    await fetch(CONFIG.APPS_SCRIPT_URL + '?action=updateItemsStatus', {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: itemIds, status: 'In Use' })
    });
    
    closeCheckoutModal();
    showToast('✅ Items checked out! DC dispatched.', 'success');
    loadData(); // Reload inventory to reflect status change
    viewDCDetail(currentCheckoutDC);
}

// Open Check In Modal
async function openCheckinModal(dcNumber) {
    currentCheckinDC = dcNumber;
    const modal = document.getElementById('checkinModal');
    const itemsList = document.getElementById('checkinItemsList');
    
    itemsList.innerHTML = '<p style="text-align:center;padding:20px;">Loading items...</p>';
    modal.classList.add('active');
    
    try {
        const response = await fetch('/.netlify/functions/get-dc-items?dc=' + dcNumber + '&_=' + Date.now());
        const csvText = await response.text();
        const data = parseCSV(csvText);
        checkinItems = data.slice(1).filter(row => row[0] === dcNumber).map(item => ({
            itemId: item[1],
            itemName: item[2],
            category: item[3],
            qty: parseInt(item[4]) || 1,
            checked: false
        }));
        
        if (checkinItems.length === 0) {
            itemsList.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-muted);">No items to check in</p>';
            return;
        }
        
        renderCheckinItems();
        updateCheckinCount();
    } catch (e) {
        console.error('Error loading items:', e);
        itemsList.innerHTML = '<p style="text-align:center;padding:20px;color:var(--danger);">Error loading items</p>';
    }
}

function renderCheckinItems() {
    const itemsList = document.getElementById('checkinItemsList');
    itemsList.innerHTML = checkinItems.map((item, idx) => `
        <div class="checkout-item ${item.checked ? 'checked' : ''}" onclick="toggleCheckinItem(${idx})">
            <div class="checkout-item-checkbox">${item.checked ? '✓' : ''}</div>
            <div class="checkout-item-info">
                <div class="checkout-item-name">${item.itemName}</div>
                <div class="checkout-item-meta">${item.itemId} • ${item.category}</div>
            </div>
            <div class="checkout-item-qty">×${item.qty}</div>
        </div>
    `).join('');
}

function toggleCheckinItem(idx) {
    checkinItems[idx].checked = !checkinItems[idx].checked;
    renderCheckinItems();
    updateCheckinCount();
}

function updateCheckinCount() {
    const checked = checkinItems.filter(i => i.checked).length;
    const total = checkinItems.length;
    document.getElementById('checkinCount').textContent = `${checked} / ${total} items returned`;
}

function selectAllCheckin() {
    checkinItems.forEach(item => item.checked = true);
    renderCheckinItems();
    updateCheckinCount();
}

function closeCheckinModal() {
    document.getElementById('checkinModal').classList.remove('active');
    currentCheckinDC = null;
    checkinItems = [];
    document.getElementById('checkinNotes').value = '';
}

async function confirmCheckin() {
    if (!currentCheckinDC) return;
    
    const checkedCount = checkinItems.filter(i => i.checked).length;
    const totalCount = checkinItems.length;
    const notes = document.getElementById('checkinNotes').value;
    
    if (checkedCount < totalCount) {
        const missing = totalCount - checkedCount;
        if (!confirm(`⚠️ ${missing} item(s) not checked in. Continue anyway?`)) {
            return;
        }
    }
    
    showToast('Processing check in...', 'success');
    
    // Update DC status to Closed
    await closeDC(currentCheckinDC);
    
    // Update checked items status back to "Available"
    const checkedItemIds = checkinItems.filter(i => i.checked).map(item => item.itemId);
    if (checkedItemIds.length > 0) {
        await fetch(CONFIG.APPS_SCRIPT_URL + '?action=updateItemsStatus', {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemIds: checkedItemIds, status: 'Available' })
        });
    }
    
    closeCheckinModal();
    showToast('✅ Items checked in! DC closed.', 'success');
    loadData(); // Reload inventory to reflect status change
}

// ==================== END CHECK OUT / CHECK IN ====================

// Open Inspection Modal (legacy - now using check in)
function openInspection(dcNumber) {
    openCheckinModal(dcNumber);
}

// Update switchView to handle DC views
const originalSwitchView = switchView;
switchView = function(viewName) {
    // Handle DC-specific views
    if (viewName === 'deliveryChannels') {
        loadDCData();
    } else if (viewName === 'createDC') {
        selectedDCItems = [];
        updateSelectedItemsList();
        populateAvailableItems();
    }
    
    // Update nav for DC views
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === viewName);
    });
    
    // Update views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    
    const targetView = document.getElementById(viewName + 'View');
    if (targetView) {
        targetView.classList.add('active');
    }
    
    // Update title
    const titles = {
        dashboard: 'Dashboard',
        inventory: 'All Items',
        add: 'Add New Item',
        categories: 'Categories',
        deliveryChannels: 'Delivery Channels',
        createDC: 'Create Delivery Channel',
        dcDetail: 'DC Details'
    };
    document.getElementById('pageTitle').textContent = titles[viewName] || 'Dashboard';
};

// Load DC data on init
document.addEventListener('DOMContentLoaded', () => {
    await loadDCData(); await new Promise(r => setTimeout(r, 1000));
});

// ==================== PURCHASE REQUESTS ====================

let prData = [];
let currentPRFilter = 'all';

const PR_STATUS_LABELS = {
    'Request': '📝 Request',
    'Approved': '✅ Approved',
    'Ordered': '📦 Ordered',
    'In Transit': '🚚 In Transit',
    'Received': '📥 Received',
    'Closed': '✔️ Closed',
    'Rejected': '❌ Rejected'
};

// Load PR Data
async function loadPRData() {
    try {
        const response = await fetch('/.netlify/functions/get-purchase-requests?_=' + Date.now());
        const csvText = await response.text();
        const data = parseCSV(csvText);
        
        if (data.length > 1) {
            prData = data.slice(1).map(row => ({
                prNumber: row[0] || '',
                itemName: row[1] || '',
                description: row[2] || '',
                quantity: row[3] || '1',
                project: row[4] || '',
                department: row[5] || '',
                requestedBy: row[6] || '',
                priority: row[7] || 'Medium',
                neededBy: row[8] || '',
                vendor: row[9] || '',
                status: row[10] || 'Request',
                createdDate: row[11] || '',
                approvedBy: row[12] || '',
                approvedDate: row[13] || '',
                orderedDate: row[14] || '',
                receivedDate: row[15] || '',
                notes: row[16] || '',
                // New fields for enhanced flow
                quoteAmount: row[17] || '',
                quoteNotes: row[18] || '',
                quotedBy: row[19] || '',
                trackingId: row[20] || '',
                orderId: row[21] || '',
                invoiceNumber: row[22] || '',
                finalAmount: row[23] || ''
            }));
        }
        
        renderPRList();
    } catch (e) {
        console.error('Error loading PR data:', e);
        document.getElementById('prList').innerHTML = '<div class="pr-empty"><div class="pr-empty-icon">⚠️</div><p>Error loading purchase requests</p></div>';
    }
}

// Render PR List
function renderPRList() {
    const container = document.getElementById('prList');
    
    let filtered = prData;
    if (currentPRFilter !== 'all') {
        filtered = prData.filter(pr => pr.status === currentPRFilter);
    }
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="pr-empty">
                <div class="pr-empty-icon">🛒</div>
                <p>No purchase requests ${currentPRFilter !== 'all' ? 'with status "' + currentPRFilter + '"' : 'yet'}</p>
                <button class="btn-primary" style="margin-top: 16px;" onclick="switchView('createPR')">Create First Request</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filtered.map(pr => `
        <div class="pr-card" onclick="viewPRDetail('${pr.prNumber}')">
            <div class="pr-card-priority ${pr.priority.toLowerCase()}"></div>
            <div class="pr-card-main">
                <div class="pr-card-header">
                    <span class="pr-card-number">${pr.prNumber}</span>
                    <span class="pr-card-title">${pr.itemName}</span>
                </div>
                <div class="pr-card-meta">
                    <span>📦 Qty: ${pr.quantity}</span>
                    <span>📁 ${pr.project}</span>
                    <span>👤 ${pr.requestedBy}</span>
                    ${pr.neededBy ? `<span>📅 ${pr.neededBy}</span>` : ''}
                </div>
            </div>
            ${pr.quoteAmount ? `<div class="pr-card-quote">₹${pr.quoteAmount}</div>` : ''}
            <div class="pr-card-status pr-status-${pr.status.toLowerCase().replace(' ', '')}">${pr.status}</div>
        </div>
    `).join('');
}

// Setup PR Filters
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.pr-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.pr-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentPRFilter = btn.dataset.filter;
            renderPRList();
        });
    });
});

// Create PR
async function createPR(event) {
    event.preventDefault();
    
    const pr = {
        prNumber: 'PR-' + String(prData.length + 1).padStart(3, '0'),
        itemName: document.getElementById('prItemName').value,
        description: document.getElementById('prDescription').value,
        quantity: document.getElementById('prQuantity').value,
        project: document.getElementById('prProject').value,
        department: document.getElementById('prDepartment').value,
        requestedBy: document.getElementById('prRequestedBy').value,
        priority: document.getElementById('prPriority').value,
        neededBy: document.getElementById('prNeededBy').value,
        vendor: document.getElementById('prVendor').value,
        status: 'Request',
        createdDate: new Date().toISOString().split('T')[0]
    };
    
    showToast('Creating purchase request...', 'success');
    
    try {
        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'createPR',
                data: pr
            })
        });
        
        // Add to local data
        prData.unshift(pr);
        
        showToast('✅ Purchase Request ' + pr.prNumber + ' created!', 'success');
        document.getElementById('createPRForm').reset();
        switchView('purchaseRequests');
        renderPRList();
    } catch (e) {
        console.error('Error creating PR:', e);
        showToast('Error creating request', 'error');
    }
}

// View PR Detail
function viewPRDetail(prNumber) {
    const pr = prData.find(p => p.prNumber === prNumber);
    if (!pr) return;
    
    const container = document.getElementById('prDetailContainer');
    
    // Updated status flow with Quoted step
    const statuses = ['Request', 'Quoted', 'Approved', 'Ordered', 'In Transit', 'Received', 'Closed'];
    const statusMap = {
        'Request': 0,
        'Quoted': 1,
        'Approved': 2,
        'Ordered': 3,
        'In Transit': 4,
        'Received': 5,
        'Closed': 6,
        'Rejected': -1
    };
    const currentStep = statusMap[pr.status] || 0;
    
    // Action buttons based on status
    let actionButtons = '';
    if (pr.status === 'Quoted') {
        // Finance/Founders can approve after quote is added
        actionButtons = `
            <button class="btn-approve-pr" onclick="updatePRStatus('${prNumber}', 'Approved')">✅ Approve (₹${pr.quoteAmount || '0'})</button>
            <button class="btn-reject-pr" onclick="updatePRStatus('${prNumber}', 'Rejected')">❌ Reject</button>
        `;
    } else if (pr.status === 'Approved') {
        actionButtons = `<button class="btn-status-update" onclick="showOrderModal('${prNumber}')">📦 Mark Ordered</button>`;
    } else if (pr.status === 'Ordered') {
        actionButtons = `<button class="btn-status-update" onclick="showTransitModal('${prNumber}')">🚚 Mark In Transit</button>`;
    } else if (pr.status === 'In Transit') {
        actionButtons = `<button class="btn-status-update" onclick="updatePRStatus('${prNumber}', 'Received')">📥 Mark Received</button>`;
    }
    // No button for Received - invoice form is shown inline
    
    // PM Edit Section (visible when Request status - PM adds quote)
    let pmEditSection = '';
    if (pr.status === 'Request') {
        pmEditSection = `
            <div class="pr-detail-section">
                <h4>📝 PM: Add Quote Details</h4>
                <div class="pm-edit-section">
                    <div class="pm-edit-grid">
                        <div class="form-group">
                            <label>Quote Amount (₹) *</label>
                            <input type="number" id="pmQuoteAmount" placeholder="Enter price" value="${pr.quoteAmount || ''}">
                        </div>
                        <div class="form-group">
                            <label>Vendor Name *</label>
                            <input type="text" id="pmVendorName" placeholder="Selected vendor" value="${pr.vendor || ''}">
                        </div>
                        <div class="form-group" style="grid-column: span 2;">
                            <label>Quote Notes</label>
                            <textarea id="pmQuoteNotes" rows="2" placeholder="Vendor details, comparison notes...">${pr.quoteNotes || ''}</textarea>
                        </div>
                    </div>
                    <button class="btn-save-quote" onclick="saveQuote('${prNumber}')">💾 Save Quote & Submit for Approval</button>
                </div>
            </div>
        `;
    }
    
    // Quote display (if quoted/approved)
    let quoteDisplay = '';
    if (pr.quoteAmount && pr.status !== 'Request') {
        quoteDisplay = `
            <div class="pr-detail-section">
                <h4>💰 Quote Details</h4>
                <div class="pr-detail-grid">
                    <div class="pr-detail-field">
                        <div class="pr-detail-field-label">Quote Amount</div>
                        <div class="pr-detail-field-value" style="font-size: 18px; color: var(--success);">₹${pr.quoteAmount}</div>
                    </div>
                    <div class="pr-detail-field">
                        <div class="pr-detail-field-label">Vendor</div>
                        <div class="pr-detail-field-value">${pr.vendor || '-'}</div>
                    </div>
                    <div class="pr-detail-field">
                        <div class="pr-detail-field-label">Quoted By</div>
                        <div class="pr-detail-field-value">${pr.quotedBy || 'PM'}</div>
                    </div>
                </div>
                ${pr.quoteNotes ? `<div style="margin-top: 12px;"><div class="pr-detail-field-label">Notes</div><div class="pr-detail-field-value">${pr.quoteNotes}</div></div>` : ''}
            </div>
        `;
    }
    
    // Tracking info (if in transit or later)
    let trackingDisplay = '';
    if (pr.trackingId && ['In Transit', 'Received', 'Closed'].includes(pr.status)) {
        trackingDisplay = `
            <div class="pr-detail-section">
                <h4>🚚 Tracking Details</h4>
                <div class="pr-detail-grid">
                    <div class="pr-detail-field">
                        <div class="pr-detail-field-label">Tracking ID</div>
                        <div class="pr-detail-field-value">${pr.trackingId}</div>
                    </div>
                    <div class="pr-detail-field">
                        <div class="pr-detail-field-label">Order ID</div>
                        <div class="pr-detail-field-value">${pr.orderId || '-'}</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Invoice edit section (when Received - PM closes with invoice)
    let invoiceEditSection = '';
    if (pr.status === 'Received') {
        invoiceEditSection = `
            <div class="pr-detail-section">
                <h4>🧾 Close with Invoice Details</h4>
                <div class="pm-edit-section">
                    <div class="pm-edit-grid">
                        <div class="form-group">
                            <label>Invoice Number *</label>
                            <input type="text" id="pmInvoiceNumber" placeholder="INV-XXXX" value="${pr.invoiceNumber || ''}">
                        </div>
                        <div class="form-group">
                            <label>Final Amount (₹) *</label>
                            <input type="number" id="pmFinalAmount" placeholder="Amount paid" value="${pr.finalAmount || pr.quoteAmount || ''}">
                        </div>
                        <div class="form-group">
                            <label>Invoice Date</label>
                            <input type="date" id="pmInvoiceDate" value="${pr.invoiceDate || ''}">
                        </div>
                        <div class="form-group">
                            <label>Payment Mode</label>
                            <select id="pmPaymentMode">
                                <option value="">Select</option>
                                <option value="Bank Transfer">Bank Transfer</option>
                                <option value="UPI">UPI</option>
                                <option value="Credit Card">Credit Card</option>
                                <option value="Cash">Cash</option>
                                <option value="Cheque">Cheque</option>
                            </select>
                        </div>
                        <div class="form-group" style="grid-column: span 2;">
                            <label>Invoice Attachment (Image/PDF)</label>
                            <input type="file" id="pmInvoiceFile" accept="image/*,.pdf" onchange="previewInvoiceFile(this)">
                            <div id="invoiceFilePreview" style="margin-top: 8px;"></div>
                        </div>
                        <div class="form-group" style="grid-column: span 2;">
                            <label>Notes</label>
                            <textarea id="pmInvoiceNotes" rows="2" placeholder="Payment reference, remarks...">${pr.invoiceNotes || ''}</textarea>
                        </div>
                    </div>
                    <button class="btn-save-quote" style="background: var(--success);" onclick="saveInvoiceAndClose('${prNumber}')">✔️ Save Invoice & Close PR</button>
                </div>
            </div>
        `;
    }
    
    // Invoice info (if closed)
    let invoiceDisplay = '';
    if (pr.invoiceNumber && pr.status === 'Closed') {
        invoiceDisplay = `
            <div class="pr-detail-section">
                <h4>🧾 Invoice Details</h4>
                <div class="pr-detail-grid">
                    <div class="pr-detail-field">
                        <div class="pr-detail-field-label">Invoice Number</div>
                        <div class="pr-detail-field-value">${pr.invoiceNumber}</div>
                    </div>
                    <div class="pr-detail-field">
                        <div class="pr-detail-field-label">Final Amount</div>
                        <div class="pr-detail-field-value" style="font-size: 18px; color: var(--success);">₹${pr.finalAmount || pr.quoteAmount}</div>
                    </div>
                    <div class="pr-detail-field">
                        <div class="pr-detail-field-label">Invoice Date</div>
                        <div class="pr-detail-field-value">${pr.invoiceDate || '-'}</div>
                    </div>
                    <div class="pr-detail-field">
                        <div class="pr-detail-field-label">Payment Mode</div>
                        <div class="pr-detail-field-value">${pr.paymentMode || '-'}</div>
                    </div>
                </div>
                ${pr.invoiceNotes ? `<div style="margin-top: 12px;"><div class="pr-detail-field-label">Notes</div><div class="pr-detail-field-value">${pr.invoiceNotes}</div></div>` : ''}
                ${pr.invoiceFileUrl ? `<div style="margin-top: 12px;"><a href="${pr.invoiceFileUrl}" target="_blank" class="btn-view-invoice">📎 View Invoice Attachment</a></div>` : ''}
            </div>
        `;
    }
    
    container.innerHTML = `
        <div class="pr-detail-header">
            <div>
                <h2 class="pr-detail-title">${pr.itemName}</h2>
                <p class="pr-detail-subtitle">${pr.prNumber} • ${pr.department}${pr.quoteAmount ? ' • ₹' + pr.quoteAmount : ''}</p>
            </div>
            <div class="pr-detail-actions">
                ${actionButtons}
                <button class="btn-back" onclick="switchView('purchaseRequests')">← Back</button>
            </div>
        </div>
        
        <!-- Status Tabs -->
        <div class="pr-status-tabs">
            ${statuses.map((status, idx) => `
                <div class="pr-status-tab ${idx < currentStep ? 'completed' : ''} ${idx === currentStep ? 'active' : ''} ${pr.status === 'Rejected' ? 'rejected' : ''}">
                    ${status}
                </div>
            `).join('')}
        </div>
        
        ${pr.status === 'Rejected' ? '<div style="color: var(--danger); margin-bottom: 16px; padding: 10px; background: rgba(239,68,68,0.1); border-radius: 8px;">❌ This request was rejected</div>' : ''}
        
        ${pmEditSection}
        ${quoteDisplay}
        ${trackingDisplay}
        ${invoiceEditSection}
        ${invoiceDisplay}
        
        <div class="pr-detail-section">
            <h4>Request Details</h4>
            <div class="pr-detail-grid">
                <div class="pr-detail-field">
                    <div class="pr-detail-field-label">Item Name</div>
                    <div class="pr-detail-field-value">${pr.itemName}</div>
                </div>
                <div class="pr-detail-field">
                    <div class="pr-detail-field-label">Quantity</div>
                    <div class="pr-detail-field-value">${pr.quantity}</div>
                </div>
                <div class="pr-detail-field">
                    <div class="pr-detail-field-label">Priority</div>
                    <div class="pr-detail-field-value">${pr.priority}</div>
                </div>
                <div class="pr-detail-field">
                    <div class="pr-detail-field-label">Project / Event</div>
                    <div class="pr-detail-field-value">${pr.project}</div>
                </div>
                <div class="pr-detail-field">
                    <div class="pr-detail-field-label">Department</div>
                    <div class="pr-detail-field-value">${pr.department}</div>
                </div>
                <div class="pr-detail-field">
                    <div class="pr-detail-field-label">Needed By</div>
                    <div class="pr-detail-field-value">${pr.neededBy || '-'}</div>
                </div>
            </div>
            ${pr.description ? `<div style="margin-top: 16px;"><div class="pr-detail-field-label">Description</div><div class="pr-detail-field-value">${pr.description}</div></div>` : ''}
        </div>
        
        <div class="pr-detail-section">
            <h4>Request Info</h4>
            <div class="pr-detail-grid">
                <div class="pr-detail-field">
                    <div class="pr-detail-field-label">Requested By</div>
                    <div class="pr-detail-field-value">${pr.requestedBy}</div>
                </div>
                <div class="pr-detail-field">
                    <div class="pr-detail-field-label">Request Date</div>
                    <div class="pr-detail-field-value">${pr.createdDate}</div>
                </div>
                <div class="pr-detail-field">
                    <div class="pr-detail-field-label">Approved By</div>
                    <div class="pr-detail-field-value">${pr.approvedBy || '-'}</div>
                </div>
                <div class="pr-detail-field">
                    <div class="pr-detail-field-label">Approved Date</div>
                    <div class="pr-detail-field-value">${pr.approvedDate || '-'}</div>
                </div>
                <div class="pr-detail-field">
                    <div class="pr-detail-field-label">Status</div>
                    <div class="pr-detail-field-value"><span class="pr-card-status pr-status-${pr.status.toLowerCase().replace(' ', '')}">${pr.status}</span></div>
                </div>
            </div>
        </div>
        
        ${pr.notes ? `<div class="pr-detail-section"><h4>Notes</h4><p>${pr.notes}</p></div>` : ''}
    `;
    
    switchView('prDetail');
}

// Update PR Status
async function updatePRStatus(prNumber, newStatus) {
    const pr = prData.find(p => p.prNumber === prNumber);
    if (!pr) return;
    
    showToast('Updating status...', 'success');
    
    const today = new Date().toISOString().split('T')[0];
    
    // Prepare updates based on status
    let updates = { status: newStatus };
    
    if (newStatus === 'Approved') {
        updates.approvedDate = today;
        updates.approvedBy = 'Leadership';
        pr.approvedDate = today;
        pr.approvedBy = 'Leadership';
    } else if (newStatus === 'Ordered') {
        updates.orderedDate = today;
        updates.orderId = pr.orderId || '';
        pr.orderedDate = today;
    } else if (newStatus === 'In Transit') {
        updates.trackingId = pr.trackingId || '';
    } else if (newStatus === 'Received') {
        updates.receivedDate = today;
        pr.receivedDate = today;
    } else if (newStatus === 'Closed') {
        updates.invoiceNumber = pr.invoiceNumber || '';
        updates.finalAmount = pr.finalAmount || pr.quoteAmount || '';
    }
    
    // Update local data
    pr.status = newStatus;
    
    try {
        await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'updatePR',
                prNumber: prNumber,
                updates: updates
            })
        });
        
        showToast('✅ Status updated to ' + newStatus, 'success');
        viewPRDetail(prNumber);
    } catch (e) {
        console.error('Error updating status:', e);
        showToast('Error updating status', 'error');
    }
}

// Save Quote (PM action)
async function saveQuote(prNumber) {
    const pr = prData.find(p => p.prNumber === prNumber);
    if (!pr) return;
    
    const quoteAmount = document.getElementById('pmQuoteAmount').value;
    const vendorName = document.getElementById('pmVendorName').value;
    const quoteNotes = document.getElementById('pmQuoteNotes').value;
    
    if (!quoteAmount || !vendorName) {
        showToast('Please enter quote amount and vendor', 'error');
        return;
    }
    
    showToast('Saving quote...', 'success');
    
    // Update local data
    pr.quoteAmount = quoteAmount;
    pr.vendor = vendorName;
    pr.quoteNotes = quoteNotes;
    pr.quotedBy = 'PM';
    pr.status = 'Quoted';
    
    // Save to sheet via Apps Script
    try {
        await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'updatePR',
                prNumber: prNumber,
                updates: {
                    status: 'Quoted',
                    vendor: vendorName,
                    quoteAmount: quoteAmount,
                    quoteNotes: quoteNotes,
                    quotedBy: 'PM'
                }
            })
        });
    } catch (e) {
        console.error('Error saving quote:', e);
    }
    
    showToast('✅ Quote saved! Awaiting Finance/Leadership approval.', 'success');
    viewPRDetail(prNumber);
}

// Show Order Modal (when marking as Ordered)
function showOrderModal(prNumber) {
    const orderId = prompt('Enter Order ID / Reference Number:');
    if (orderId) {
        const pr = prData.find(p => p.prNumber === prNumber);
        if (pr) {
            pr.orderId = orderId;
            pr.orderedDate = new Date().toISOString().split('T')[0];
        }
        updatePRStatus(prNumber, 'Ordered');
    }
}

// Show Transit Modal (when marking as In Transit)
function showTransitModal(prNumber) {
    const trackingId = prompt('Enter Tracking ID / AWB Number:');
    if (trackingId) {
        const pr = prData.find(p => p.prNumber === prNumber);
        if (pr) {
            pr.trackingId = trackingId;
        }
        updatePRStatus(prNumber, 'In Transit');
    }
}

// Preview Invoice File
let invoiceFileData = null;
function previewInvoiceFile(input) {
    const preview = document.getElementById('invoiceFilePreview');
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const reader = new FileReader();
        
        reader.onload = function(e) {
            invoiceFileData = {
                name: file.name,
                type: file.type,
                data: e.target.result
            };
            
            if (file.type.startsWith('image/')) {
                preview.innerHTML = `<img src="${e.target.result}" style="max-width: 200px; max-height: 150px; border-radius: 8px; border: 1px solid var(--border);">`;
            } else {
                preview.innerHTML = `<div style="padding: 12px; background: var(--bg-card); border-radius: 8px; border: 1px solid var(--border);">📄 ${file.name}</div>`;
            }
        };
        
        reader.readAsDataURL(file);
    }
}

// Save Invoice and Close PR
async function saveInvoiceAndClose(prNumber) {
    const pr = prData.find(p => p.prNumber === prNumber);
    if (!pr) return;
    
    const invoiceNumber = document.getElementById('pmInvoiceNumber').value;
    const finalAmount = document.getElementById('pmFinalAmount').value;
    const invoiceDate = document.getElementById('pmInvoiceDate').value;
    const paymentMode = document.getElementById('pmPaymentMode').value;
    const invoiceNotes = document.getElementById('pmInvoiceNotes').value;
    
    if (!invoiceNumber || !finalAmount) {
        showToast('Please enter invoice number and final amount', 'error');
        return;
    }
    
    showToast('Saving invoice details...', 'success');
    
    // Update local data
    pr.invoiceNumber = invoiceNumber;
    pr.finalAmount = finalAmount;
    pr.invoiceDate = invoiceDate || new Date().toISOString().split('T')[0];
    pr.paymentMode = paymentMode;
    pr.invoiceNotes = invoiceNotes;
    pr.status = 'Closed';
    pr.receivedDate = new Date().toISOString().split('T')[0];
    
    // If file attached, store reference (for now just the name - could upload to Drive)
    if (invoiceFileData) {
        pr.invoiceFileName = invoiceFileData.name;
        // TODO: Upload to Google Drive and get URL
    }
    
    // Save to sheet
    try {
        await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'updatePR',
                prNumber: prNumber,
                updates: {
                    status: 'Closed',
                    invoiceNumber: invoiceNumber,
                    finalAmount: finalAmount,
                    receivedDate: pr.receivedDate
                }
            })
        });
    } catch (e) {
        console.error('Error saving invoice:', e);
    }
    
    invoiceFileData = null;
    showToast('✅ PR Closed with Invoice!', 'success');
    viewPRDetail(prNumber);
}

// Update switchView for PR views
const prOriginalSwitchView = switchView;
switchView = function(viewName) {
    // Handle PR-specific views
    if (viewName === 'purchaseRequests') {
        loadPRData();
    }
    
    // Call original
    prOriginalSwitchView(viewName);
    
    // Update title for PR views
    const prTitles = {
        purchaseRequests: 'Purchase Requests',
        createPR: 'New Purchase Request',
        prDetail: 'PR Details'
    };
    if (prTitles[viewName]) {
        document.getElementById('pageTitle').textContent = prTitles[viewName];
    }
};

// ==================== END PURCHASE REQUESTS ====================

// ==================== DAILY LOG FUNCTIONALITY ====================

let dailyLogData = [];
let filteredLogData = [];

// Load Daily Log Data
async function loadDailyLogData() {
    try {
        const cacheBuster = Date.now();
        const response = await fetch('/.netlify/functions/get-daily-log?_=' + cacheBuster, {
            cache: 'no-store'
        });
        const csvText = await response.text();
        const data = parseCSV(csvText);
        
        if (data && data.length > 0) {
            dailyLogData = data.slice(1).filter(row => row[0]).map((row, index) => ({
                rowIndex: index + 2,
                logId: row[0] || '',
                itemId: row[1] || '',
                itemName: row[2] || '',
                teamMember: row[3] || '',
                purpose: row[4] || '',
                requestDate: row[5] || '',
                expectedReturn: row[6] || '',
                status: row[7] || 'Requested',
                handedOverBy: row[8] || '',
                handoverDate: row[9] || '',
                returnDate: row[10] || '',
                notes: row[11] || ''
            }));
            
            filteredLogData = [...dailyLogData];
            updateDailyLogList();
        }
    } catch (error) {
        console.error('Error loading daily log:', error);
        // If function doesn't exist yet, show empty state
        dailyLogData = [];
        filteredLogData = [];
        updateDailyLogList();
    }
}

// Update Daily Log List
function updateDailyLogList() {
    const container = document.getElementById('dailyLogList');
    if (!container) return;
    
    if (filteredLogData.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 60px; color: var(--text-muted);">
                <div style="font-size: 48px; margin-bottom: 16px;">📋</div>
                <p>No checkout logs yet. Click "New Checkout" to get started!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredLogData.map(log => {
        const statusClass = log.status.toLowerCase().replace(/\s+/g, '');
        const statusIcon = log.status === 'Requested' ? '📋' : log.status === 'Handed Over' ? '🤝' : '✅';
        
        let actionBtn = '';
        if (log.status === 'Requested') {
            actionBtn = `<button class="btn-handover" onclick="event.stopPropagation(); handoverItem('${log.logId}')">🤝 Hand Over</button>`;
        } else if (log.status === 'Handed Over') {
            actionBtn = `<button class="btn-return" onclick="event.stopPropagation(); returnItem('${log.logId}')">✅ Mark Returned</button>`;
        }
        
        return `
            <div class="log-card" onclick="viewLogDetail('${log.logId}')">
                <div class="log-card-header">
                    <div>
                        <div class="log-card-title">${log.itemName}</div>
                        <div class="log-card-meta">${log.logId} • ${log.itemId}</div>
                    </div>
                    <span class="log-card-status log-status-${statusClass}">${statusIcon} ${log.status}</span>
                </div>
                <div class="log-card-details">
                    <div class="log-card-detail">
                        <span class="log-card-detail-label">Team Member</span>
                        <span class="log-card-detail-value">${log.teamMember}</span>
                    </div>
                    <div class="log-card-detail">
                        <span class="log-card-detail-label">Purpose</span>
                        <span class="log-card-detail-value">${log.purpose}</span>
                    </div>
                    <div class="log-card-detail">
                        <span class="log-card-detail-label">Expected Return</span>
                        <span class="log-card-detail-value">${log.expectedReturn}</span>
                    </div>
                    <div class="log-card-detail">
                        <span class="log-card-detail-label">Request Date</span>
                        <span class="log-card-detail-value">${log.requestDate}</span>
                    </div>
                </div>
                ${actionBtn ? `<div class="log-card-actions">${actionBtn}</div>` : ''}
            </div>
        `;
    }).join('');
}

// Filter Daily Log
function filterDailyLog(status) {
    // Update active button
    document.querySelectorAll('.log-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === status);
    });
    
    if (status === 'all') {
        filteredLogData = [...dailyLogData];
    } else {
        filteredLogData = dailyLogData.filter(log => log.status === status);
    }
    
    updateDailyLogList();
}

// Populate checkout item dropdown
function populateCheckoutItems() {
    const select = document.getElementById('checkoutItemSelect');
    if (!select) return;
    
    const availableItems = inventoryData.filter(item => 
        item.status === 'Available' && item.quantity > 0
    );
    
    select.innerHTML = '<option value="">-- Select an item --</option>' +
        availableItems.map(item => 
            `<option value="${item.itemId}" data-name="${item.name}" data-qty="${item.quantity}">${item.name} (${item.itemId}) - Qty: ${item.quantity}</option>`
        ).join('');
}

// Update checkout item info
function updateCheckoutItemInfo() {
    const select = document.getElementById('checkoutItemSelect');
    const qtyInput = document.getElementById('checkoutQty');
    const selected = select.selectedOptions[0];
    
    if (selected && selected.value) {
        const maxQty = parseInt(selected.dataset.qty) || 1;
        qtyInput.max = maxQty;
        if (parseInt(qtyInput.value) > maxQty) {
            qtyInput.value = maxQty;
        }
    }
}

// Generate Log ID
function generateLogId() {
    const count = dailyLogData.length + 1;
    return `LOG-${String(count).padStart(4, '0')}`;
}

// Create Checkout
async function createCheckout(e) {
    e.preventDefault();
    
    const select = document.getElementById('checkoutItemSelect');
    const selectedOption = select.selectedOptions[0];
    
    const logId = generateLogId();
    const today = new Date().toISOString().split('T')[0];
    
    const checkoutData = {
        action: 'createDailyLog',
        logId: logId,
        itemId: select.value,
        itemName: selectedOption.dataset.name,
        teamMember: document.getElementById('checkoutMember').value,
        purpose: document.getElementById('checkoutPurpose').value,
        requestDate: today,
        expectedReturn: document.getElementById('checkoutReturnDate').value,
        status: 'Requested',
        handedOverBy: document.getElementById('checkoutHandedBy').value || '',
        handoverDate: '',
        returnDate: '',
        notes: document.getElementById('checkoutNotes').value || ''
    };
    
    try {
        showToast('Creating checkout...', 'success');
        
        await fetch(CONFIG.APPS_SCRIPT_URL + '?action=createDailyLog', {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(checkoutData)
        });
        
        showToast('✅ Checkout created!', 'success');
        document.getElementById('checkoutForm').reset();
        
        setTimeout(async () => {
            loadDailyLogData();
            switchView('dailyLog');
        }, 1500);
        
    } catch (error) {
        console.error('Error creating checkout:', error);
        showToast('Failed to create checkout', 'error');
    }
}

// Hand over item
async function handoverItem(logId) {
    const handedBy = prompt('Who is handing over? (Your name)');
    if (!handedBy) return;
    
    const today = new Date().toISOString().split('T')[0];
    
    try {
        showToast('Updating...', 'success');
        
        await fetch(CONFIG.APPS_SCRIPT_URL + '?action=updateDailyLog', {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                logId: logId,
                status: 'Handed Over',
                handedOverBy: handedBy,
                handoverDate: today
            })
        });
        
        showToast('🤝 Item handed over!', 'success');
        setTimeout(() => loadDailyLogData(), 1500);
        
    } catch (error) {
        console.error('Error:', error);
        showToast('Failed to update', 'error');
    }
}

// Return item
async function returnItem(logId) {
    if (!confirm('Mark this item as returned?')) return;
    
    const today = new Date().toISOString().split('T')[0];
    
    try {
        showToast('Updating...', 'success');
        
        await fetch(CONFIG.APPS_SCRIPT_URL + '?action=updateDailyLog', {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                logId: logId,
                status: 'Returned',
                returnDate: today
            })
        });
        
        showToast('✅ Item returned!', 'success');
        setTimeout(() => loadDailyLogData(), 1500);
        
    } catch (error) {
        console.error('Error:', error);
        showToast('Failed to update', 'error');
    }
}

// View Log Detail (simple for now)
function viewLogDetail(logId) {
    const log = dailyLogData.find(l => l.logId === logId);
    if (!log) return;
    
    alert(`
Log ID: ${log.logId}
Item: ${log.itemName} (${log.itemId})
Team Member: ${log.teamMember}
Purpose: ${log.purpose}
Request Date: ${log.requestDate}
Expected Return: ${log.expectedReturn}
Status: ${log.status}
${log.handedOverBy ? `Handed Over By: ${log.handedOverBy}` : ''}
${log.handoverDate ? `Handover Date: ${log.handoverDate}` : ''}
${log.returnDate ? `Return Date: ${log.returnDate}` : ''}
${log.notes ? `Notes: ${log.notes}` : ''}
    `.trim());
}

// Update switchView for Daily Log
const logOriginalSwitchView = switchView;
switchView = function(viewName) {
    // Handle Daily Log views
    if (viewName === 'dailyLog') {
        loadDailyLogData();
    }
    if (viewName === 'checkoutItem') {
        populateCheckoutItems();
    }
    
    // Call original
    logOriginalSwitchView(viewName);
    
    // Update title
    const logTitles = {
        dailyLog: 'Daily Inventory Log',
        checkoutItem: 'Checkout Item'
    };
    if (logTitles[viewName]) {
        document.getElementById('pageTitle').textContent = logTitles[viewName];
    }
};

// ==================== END DAILY LOG ====================

// ==================== PRODUCT BUILDS ====================

let buildsData = [];
let filteredBuilds = [];
let selectedBuildItems = [];
let currentBuildFilter = 'all';

// Load Builds Data
async function loadBuildsData() {
    try {
        const cacheBuster = Date.now();
        const response = await fetch('/.netlify/functions/get-builds?_=' + cacheBuster, {
            cache: 'no-store'
        });
        const csvText = await response.text();
        const data = parseCSV(csvText);
        
        if (data && data.length > 0) {
            buildsData = data.slice(1).filter(row => row[0]).map((row, index) => ({
                rowIndex: index + 2,
                buildId: row[0] || '',
                productName: row[1] || '',
                description: row[2] || '',
                targetCategory: row[3] || 'Event Equipment',
                status: row[4] || 'In Progress',
                createdBy: row[5] || '',
                createdDate: row[6] || '',
                completedDate: row[7] || '',
                resultItemId: row[8] || '',
                estValue: parseInt(row[9]) || 0,
                componentCount: parseInt(row[10]) || 0
            }));
            
            filteredBuilds = [...buildsData];
            updateBuildsList();
        }
    } catch (error) {
        console.error('Error loading builds:', error);
        buildsData = [];
        filteredBuilds = [];
        updateBuildsList();
    }
}

// Update Builds List
function updateBuildsList() {
    const container = document.getElementById('buildsList');
    if (!container) return;
    
    if (filteredBuilds.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 60px; color: var(--text-muted);">
                <div style="font-size: 48px; margin-bottom: 16px;">🔨</div>
                <p>No product builds yet. Click "Build Product" to create one!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredBuilds.map(build => {
        const statusClass = build.status.toLowerCase().replace(/\s+/g, '');
        return `
            <div class="build-card" onclick="viewBuildDetail('${build.buildId}')">
                <div class="build-card-header">
                    <div>
                        <div class="build-card-title">${build.productName}</div>
                        <div class="build-card-number">${build.buildId} • ${build.targetCategory}</div>
                    </div>
                    <span class="build-card-status build-status-${statusClass}">${build.status}</span>
                </div>
                <div class="build-card-details">
                    <div class="build-card-detail">
                        <span class="build-card-detail-label">Components</span>
                        <span class="build-card-detail-value">${build.componentCount} items</span>
                    </div>
                    <div class="build-card-detail">
                        <span class="build-card-detail-label">Est. Value</span>
                        <span class="build-card-detail-value">₹${build.estValue.toLocaleString('en-IN')}</span>
                    </div>
                    <div class="build-card-detail">
                        <span class="build-card-detail-label">Created By</span>
                        <span class="build-card-detail-value">${build.createdBy}</span>
                    </div>
                    <div class="build-card-detail">
                        <span class="build-card-detail-label">Date</span>
                        <span class="build-card-detail-value">${build.createdDate}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Filter Builds
function filterBuilds(status) {
    currentBuildFilter = status;
    
    // Update active button
    document.querySelectorAll('.build-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === status);
    });
    
    if (status === 'all') {
        filteredBuilds = [...buildsData];
    } else {
        filteredBuilds = buildsData.filter(b => b.status === status);
    }
    
    updateBuildsList();
}

// Populate Available Items for Build
function populateBuildItems() {
    const container = document.getElementById('buildAvailableItemsList');
    if (!container) return;
    
    // Filter only Electronics category with available qty > 0
    const availableItems = inventoryData.filter(item => 
        item.category === 'Electronics' && 
        item.status === 'Available' && 
        item.quantity > 0
    );
    
    if (availableItems.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No electronics components available</div>';
        return;
    }
    
    container.innerHTML = availableItems.map(item => {
        const isSelected = selectedBuildItems.find(s => s.itemId === item.itemId);
        return `
            <div class="build-item-row ${isSelected ? 'selected' : ''}" onclick="toggleBuildItem('${item.itemId}')">
                <div class="build-item-info">
                    <div class="build-item-name">${item.name}</div>
                    <div class="build-item-meta">${item.itemId} • Avail: ${item.quantity}</div>
                </div>
                <div class="build-item-qty">
                    <input type="number" min="1" max="${item.quantity}" value="1" 
                           onclick="event.stopPropagation()" 
                           onchange="updateBuildItemQty('${item.itemId}', this.value)"
                           id="build-qty-${item.itemId}">
                </div>
            </div>
        `;
    }).join('');
}

// Filter Build Items by search
function filterBuildItems() {
    const search = document.getElementById('buildItemSearch')?.value.toLowerCase() || '';
    const container = document.getElementById('buildAvailableItemsList');
    
    const availableItems = inventoryData.filter(item => 
        item.category === 'Electronics' && 
        item.status === 'Available' && 
        item.quantity > 0 &&
        (!search || item.name.toLowerCase().includes(search) || item.itemId.toLowerCase().includes(search))
    );
    
    if (availableItems.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No matching components</div>';
        return;
    }
    
    container.innerHTML = availableItems.map(item => {
        const isSelected = selectedBuildItems.find(s => s.itemId === item.itemId);
        const selectedItem = selectedBuildItems.find(s => s.itemId === item.itemId);
        return `
            <div class="build-item-row ${isSelected ? 'selected' : ''}" onclick="toggleBuildItem('${item.itemId}')">
                <div class="build-item-info">
                    <div class="build-item-name">${item.name}</div>
                    <div class="build-item-meta">${item.itemId} • Avail: ${item.quantity}</div>
                </div>
                <div class="build-item-qty">
                    <input type="number" min="1" max="${item.quantity}" value="${selectedItem?.qty || 1}" 
                           onclick="event.stopPropagation()" 
                           onchange="updateBuildItemQty('${item.itemId}', this.value)"
                           id="build-qty-${item.itemId}">
                </div>
            </div>
        `;
    }).join('');
}

// Toggle Build Item Selection
function toggleBuildItem(itemId) {
    const item = inventoryData.find(i => i.itemId === itemId);
    if (!item) return;
    
    const existingIndex = selectedBuildItems.findIndex(s => s.itemId === itemId);
    const qtyInput = document.getElementById(`build-qty-${itemId}`);
    const qty = parseInt(qtyInput?.value) || 1;
    
    if (existingIndex >= 0) {
        selectedBuildItems.splice(existingIndex, 1);
    } else {
        selectedBuildItems.push({
            itemId: item.itemId,
            name: item[1] || item.name || 'Unknown',
            category: item[2] || item.category || '',
            qty: qty,
            maxQty: item[4] || item.quantity || 0,
            value: item[5] || item.value || 0
        });
    }
    
    updateSelectedBuildItems();
    filterBuildItems();
}

// Update Build Item Quantity
function updateBuildItemQty(itemId, qty) {
    const item = selectedBuildItems.find(s => s.itemId === itemId);
    if (item) {
        item.qty = Math.min(Math.max(1, parseInt(qty) || 1), item.maxQty);
    }
    updateSelectedBuildItems();
}

// Update Selected Build Items List
function updateSelectedBuildItems() {
    const container = document.getElementById('buildSelectedItemsList');
    const countSpan = document.getElementById('buildSelectedCount');
    
    if (countSpan) countSpan.textContent = selectedBuildItems.length;
    
    if (!container) return;
    
    if (selectedBuildItems.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No components selected</div>';
        return;
    }
    
    container.innerHTML = selectedBuildItems.map(item => `
        <div class="build-item-row selected">
            <div class="build-item-info">
                <div class="build-item-name">${item.name}</div>
                <div class="build-item-meta">${item.itemId} • Using: ${item.qty} of ${item.maxQty}</div>
            </div>
            <button class="build-item-remove" onclick="removeBuildItem('${item.itemId}')">✕</button>
        </div>
    `).join('');
}

// Remove Build Item
function removeBuildItem(itemId) {
    selectedBuildItems = selectedBuildItems.filter(i => i.itemId !== itemId);
    updateSelectedBuildItems();
    filterBuildItems();
}

// Generate Build ID
function generateBuildId() {
    const count = buildsData.length + 1;
    return `BLD-${String(count).padStart(3, '0')}`;
}

// Create Build
async function createBuild(e) {
    e.preventDefault();
    
    const form = document.getElementById('createBuildForm');
    const isEditing = form.dataset.editingBuild;
    
    if (selectedBuildItems.length === 0) {
        showToast('Please select at least one component!', 'error');
        return;
    }
    
    const buildId = isEditing ? form.dataset.editingBuild : generateBuildId();
    const today = new Date().toISOString().split('T')[0];
    
    // Calculate total component value
    const totalComponentValue = selectedBuildItems.reduce((sum, item) => sum + (item.value * item.qty), 0);
    const estValue = parseInt(document.getElementById('buildEstValue').value) || totalComponentValue;
    
    const buildPayload = {
        buildId: buildId,
        rowIndex: form.dataset.rowIndex || null,
        productName: document.getElementById('buildProductName').value,
        description: document.getElementById('buildDescription').value,
        targetCategory: document.getElementById('buildTargetCategory').value,
        status: 'In Progress',
        createdBy: document.getElementById('buildCreatedBy').value,
        createdDate: today,
        completedDate: '',
        resultItemId: '',
        estValue: estValue,
        componentCount: selectedBuildItems.length,
        items: selectedBuildItems
    };
    
    try {
        const action = isEditing ? 'updateBuild' : 'createBuild';
        showToast(isEditing ? 'Updating build...' : 'Creating build...', 'success');
        
        await fetch(CONFIG.APPS_SCRIPT_URL + '?action=' + action, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildPayload)
        });
        
        showToast(`✅ Build ${buildId} ${isEditing ? 'updated' : 'created'}!`, 'success');
        
        // Reset form and edit mode
        form.reset();
        delete form.dataset.editingBuild;
        delete form.dataset.rowIndex;
        selectedBuildItems = [];
        updateSelectedBuildItems();
        
        // Reset button text
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = '🔨 Create Build';
        
        // Reload data and switch view
        setTimeout(async () => {
            loadBuildsData();
            loadData(); // Reload inventory to reflect qty changes
            switchView('builds');
        }, 1500);
        
    } catch (error) {
        console.error('Error with build:', error);
        showToast('Failed to process build', 'error');
    }
}

// View Build Detail
async function viewBuildDetail(buildId) {
    const build = buildsData.find(b => b.buildId === buildId);
    if (!build) return;
    
    const container = document.getElementById('buildDetailContainer');
    
    const statuses = ['In Progress', 'Completed'];
    const currentStep = build.status === 'Completed' ? 1 : 0;
    
    // Action buttons based on status
    let actionButtons = '';
    if (build.status === 'In Progress') {
        actionButtons = `
            <button class="btn-edit-build" onclick="editBuild('${buildId}')">✏️ Edit Build</button>
            <button class="btn-complete-build" onclick="completeBuild('${buildId}')">✅ Complete Build</button>
            <button class="btn-cancel-build" onclick="cancelBuild('${buildId}')">Cancel Build</button>
        `;
    }
    
    container.innerHTML = `
        <div class="build-detail-header">
            <div>
                <h2 class="build-detail-title">${build.productName}</h2>
                <p class="build-detail-subtitle">${build.buildId} • ${build.targetCategory}</p>
            </div>
            <div class="build-detail-actions">
                ${actionButtons}
                <button class="btn-back" onclick="switchView('builds')">← Back</button>
            </div>
        </div>
        
        <div class="build-status-tabs">
            ${statuses.map((status, idx) => `
                <div class="build-status-tab ${idx <= currentStep ? (idx < currentStep ? 'completed' : 'active') : ''}">
                    ${status}
                </div>
            `).join('')}
        </div>
        
        ${build.status === 'Completed' && build.resultItemId ? `
            <div class="build-detail-section" style="background: rgba(34, 197, 94, 0.1); border-color: var(--success);">
                <h4 style="color: var(--success);">✅ Build Completed</h4>
                <p>New inventory item created: <strong>${build.resultItemId}</strong></p>
            </div>
        ` : ''}
        
        <div class="build-detail-section">
            <h4>Build Details</h4>
            <div class="build-detail-grid">
                <div class="build-detail-field">
                    <div class="build-detail-field-label">Product Name</div>
                    <div class="build-detail-field-value">${build.productName}</div>
                </div>
                <div class="build-detail-field">
                    <div class="build-detail-field-label">Target Category</div>
                    <div class="build-detail-field-value">${build.targetCategory}</div>
                </div>
                <div class="build-detail-field">
                    <div class="build-detail-field-label">Est. Value</div>
                    <div class="build-detail-field-value">₹${build.estValue.toLocaleString('en-IN')}</div>
                </div>
                <div class="build-detail-field">
                    <div class="build-detail-field-label">Components</div>
                    <div class="build-detail-field-value">${build.componentCount} items</div>
                </div>
                <div class="build-detail-field">
                    <div class="build-detail-field-label">Created By</div>
                    <div class="build-detail-field-value">${build.createdBy}</div>
                </div>
                <div class="build-detail-field">
                    <div class="build-detail-field-label">Created Date</div>
                    <div class="build-detail-field-value">${build.createdDate}</div>
                </div>
            </div>
            ${build.description ? `<div style="margin-top: 16px;"><div class="build-detail-field-label">Description</div><div class="build-detail-field-value">${build.description}</div></div>` : ''}
        </div>
        
        <div class="build-detail-section">
            <h4>Components Used</h4>
            <div id="buildComponentsTable">Loading components...</div>
        </div>
    `;
    
    switchView('buildDetail');
    loadBuildComponents(buildId);
}

// Load Build Components
async function loadBuildComponents(buildId) {
    try {
        const response = await fetch('/.netlify/functions/get-build-items?build=' + buildId + '&_=' + Date.now());
        const csvText = await response.text();
        const data = parseCSV(csvText);
        
        const items = data.slice(1).filter(row => row[0] === buildId);
        
        const container = document.getElementById('buildComponentsTable');
        if (items.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted);">No components found</p>';
            return;
        }
        
        container.innerHTML = `
            <table class="build-components-table">
                <thead>
                    <tr>
                        <th>Item ID</th>
                        <th>Name</th>
                        <th>Category</th>
                        <th>Qty Used</th>
                        <th>Date Added</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => `
                        <tr>
                            <td><code>${item[1]}</code></td>
                            <td>${item[2]}</td>
                            <td>${item[3]}</td>
                            <td>${item[4]}</td>
                            <td>${item[5]}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Error loading build components:', error);
        document.getElementById('buildComponentsTable').innerHTML = '<p style="color: var(--danger);">Error loading components</p>';
    }
}

// Complete Build
async function completeBuild(buildId) {
    const build = buildsData.find(b => b.buildId === buildId);
    if (!build) return;
    
    if (!confirm(`Complete build "${build.productName}"?\n\nThis will:\n• Create a new ${build.targetCategory} item\n• Mark build as completed`)) {
        return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    try {
        showToast('Completing build...', 'success');
        
        await fetch(CONFIG.APPS_SCRIPT_URL + '?action=completeBuild', {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                buildId: buildId,
                productName: build.productName,
                targetCategory: build.targetCategory,
                estValue: build.estValue,
                description: build.description,
                completedDate: today
            })
        });
        
        showToast('✅ Build completed! New item created.', 'success');
        
        setTimeout(async () => {
            loadBuildsData();
            loadData(); // Reload inventory to show new item
            viewBuildDetail(buildId);
        }, 1500);
        
    } catch (error) {
        console.error('Error completing build:', error);
        showToast('Failed to complete build', 'error');
    }
}

// Cancel Build
async function cancelBuild(buildId) {
    const build = buildsData.find(b => b.buildId === buildId);
    if (!build) return;
    
    if (!confirm(`Cancel build "${build.productName}"?\n\nThis will:\n• Restore component quantities to inventory\n• Mark build as cancelled`)) {
        return;
    }
    
    try {
        showToast('Cancelling build...', 'success');
        
        await fetch(CONFIG.APPS_SCRIPT_URL + '?action=cancelBuild', {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ buildId: buildId })
        });
        
        showToast('Build cancelled. Components restored.', 'success');
        
        setTimeout(async () => {
            loadBuildsData();
            loadData(); // Reload inventory
            switchView('builds');
        }, 1500);
        
    } catch (error) {
        console.error('Error cancelling build:', error);
        showToast('Failed to cancel build', 'error');
    }
}

// Update switchView for Build views
const buildOriginalSwitchView = switchView;
switchView = function(viewName) {
    // Handle Build views
    if (viewName === 'builds') {
        loadBuildsData();
    }
    if (viewName === 'createBuild') {
        selectedBuildItems = [];
        updateSelectedBuildItems();
        populateBuildItems();
    }
    
    // Call original
    buildOriginalSwitchView(viewName);
    
    // Update title for Build views
    const buildTitles = {
        builds: 'Product Builds',
        createBuild: 'Build New Product',
        buildDetail: 'Build Details'
    };
    if (buildTitles[viewName]) {
        document.getElementById('pageTitle').textContent = buildTitles[viewName];
    }
};

// ==================== END PRODUCT BUILDS ====================

// Delete DC
async function deleteDC(dcNumber) {
    if (!confirm(`Are you sure you want to delete ${dcNumber}?\n\nThis will also remove all associated items.`)) {
        return;
    }
    
    const dc = dcData.find(d => d.dcNumber === dcNumber);
    if (!dc) return;
    
    try {
        showToast('Deleting DC...', 'success');
        
        await fetch(CONFIG.APPS_SCRIPT_URL + '?action=deleteDC', {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dcNumber: dcNumber, rowIndex: dc.rowIndex })
        });
        
        showToast(`✅ ${dcNumber} deleted!`, 'success');
        
        setTimeout(async () => {
            await loadDCData(); await new Promise(r => setTimeout(r, 1000));
            switchView('deliveryChannels');
        }, 1500);
        
    } catch (error) {
        console.error('Error deleting DC:', error);
        showToast('Failed to delete DC', 'error');
    }
}
