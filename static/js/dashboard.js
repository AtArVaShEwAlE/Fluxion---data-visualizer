// Dashboard JavaScript

// DOM Elements
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const dataPreview = document.getElementById('dataPreview');
const createChartBtn = document.getElementById('createChartBtn');

// Current dataset
let currentDataset = null;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeUpload();
});

function initializeUpload() {
    if (!fileInput || !uploadArea) {
        console.error('Upload elements not found');
        return;
    }

    // File input change event
    fileInput.addEventListener('change', handleFileUpload);
    
    // Drag and drop events
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    
    // Create chart button
    if (createChartBtn) {
        createChartBtn.addEventListener('click', handleCreateChart);
    }
}

// Drag and Drop Handlers
function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        fileInput.files = files;
        handleFileUpload();
    }
}

// File Upload Handler
async function handleFileUpload() {
    const file = fileInput.files[0];
    if (!file) return;

    console.log('Uploading file:', file.name);

    // Validate file type
    const validExtensions = ['csv', 'xlsx', 'xls'];
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
        showErrorState('Invalid file type. Please upload CSV or Excel files only.');
        return;
    }

    // Validate file size (16MB)
    const maxSize = 16 * 1024 * 1024;
    if (file.size > maxSize) {
        showErrorState('File size exceeds 16MB limit.');
        return;
    }

    // Show loading state
    showLoadingState();

    // Create form data
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Upload response:', result);

        if (result.success) {
            currentDataset = result.data;
            showDataPreview(result.data);
        } else {
            showErrorState(result.error || 'Upload failed');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showErrorState('Error uploading file: ' + error.message);
    }
}

// Show different states
function showLoadingState() {
    if (uploadArea) uploadArea.style.display = 'none';
    if (errorState) errorState.style.display = 'none';
    if (dataPreview) dataPreview.style.display = 'none';
    if (loadingState) loadingState.style.display = 'block';
}

function showErrorState(message) {
    console.error('Error:', message);
    
    if (loadingState) loadingState.style.display = 'none';
    if (dataPreview) dataPreview.style.display = 'none';
    if (uploadArea) uploadArea.style.display = 'block';
    
    const errorMessageEl = document.getElementById('errorMessage');
    if (errorMessageEl) {
        errorMessageEl.textContent = message;
    }
    
    if (errorState) errorState.style.display = 'block';
    
    // Hide error after 5 seconds
    setTimeout(() => {
        if (errorState) errorState.style.display = 'none';
    }, 5000);
}

function showDataPreview(data) {
    console.log('Showing preview for:', data);
    
    if (loadingState) loadingState.style.display = 'none';
    if (errorState) errorState.style.display = 'none';
    if (uploadArea) uploadArea.style.display = 'none';
    
    // Update dataset info
    const datasetTitleEl = document.getElementById('datasetTitle');
    const rowCountEl = document.getElementById('rowCount');
    const colCountEl = document.getElementById('colCount');
    const fileSizeEl = document.getElementById('fileSize');
    
    if (datasetTitleEl) datasetTitleEl.textContent = ` ${data.filename || 'Dataset'}`;
    if (rowCountEl) rowCountEl.textContent = (data.rows || 0).toLocaleString();
    if (colCountEl) colCountEl.textContent = data.columns || data.column_names?.length || 0;
    if (fileSizeEl) fileSizeEl.textContent = formatBytes(data.size || 0);
    
    // Build data table
    buildDataTable(data);
    
    // Show preview
    if (dataPreview) {
        dataPreview.style.display = 'block';
        // Scroll to preview
        setTimeout(() => {
            dataPreview.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }
}

function buildDataTable(data) {
    const tableHead = document.getElementById('tableHead');
    const tableBody = document.getElementById('tableBody');
    
    if (!tableHead || !tableBody) {
        console.error('Table elements not found');
        return;
    }
    
    // Clear previous content
    tableHead.innerHTML = '';
    tableBody.innerHTML = '';

    // Get column names
    const columns = data.column_names || [];
    
    if (columns.length === 0) {
        console.error('No columns found in data');
        return;
    }

    // Create header row
    const headerRow = document.createElement('tr');
    columns.forEach(col => {
        const th = document.createElement('th');
        th.textContent = col;
        th.title = col;
        headerRow.appendChild(th);
    });
    tableHead.appendChild(headerRow);

    // Get preview data
    const previewData = data.preview || [];
    
    if (previewData.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = columns.length;
        td.textContent = 'No data to preview';
        td.style.textAlign = 'center';
        td.style.padding = '2rem';
        tr.appendChild(td);
        tableBody.appendChild(tr);
        return;
    }

    // Create data rows (show first 5 rows initially)
    const rowsToShow = Math.min(5, previewData.length);
    for (let i = 0; i < rowsToShow; i++) {
        const row = previewData[i];
        const tr = document.createElement('tr');
        
        columns.forEach(col => {
            const td = document.createElement('td');
            const cellValue = row[col] !== null && row[col] !== undefined ? String(row[col]) : '';
            td.textContent = cellValue;
            td.title = cellValue;
            tr.appendChild(td);
        });
        
        tableBody.appendChild(tr);
    }

    // Show "Show More" button if there are more rows
    const tableFooter = document.getElementById('tableFooter');
    const showMoreBtn = document.getElementById('showMoreBtn');
    
    if (tableFooter && showMoreBtn) {
        if (previewData.length > rowsToShow) {
            tableFooter.style.display = 'block';
            showMoreBtn.onclick = () => showMoreRows(data);
        } else {
            tableFooter.style.display = 'none';
        }
    }
}

function showMoreRows(data) {
    const tableBody = document.getElementById('tableBody');
    if (!tableBody) return;
    
    const currentRows = tableBody.children.length;
    const previewData = data.preview || [];
    const columns = data.column_names || [];
    const totalRows = previewData.length;
    
    // Show next 5 rows
    const endRow = Math.min(currentRows + 5, totalRows);
    
    for (let i = currentRows; i < endRow; i++) {
        const row = previewData[i];
        const tr = document.createElement('tr');
        
        columns.forEach(col => {
            const td = document.createElement('td');
            const cellValue = row[col] !== null && row[col] !== undefined ? String(row[col]) : '';
            td.textContent = cellValue;
            td.title = cellValue;
            tr.appendChild(td);
        });
        
        tableBody.appendChild(tr);
    }
    
    // Hide button if all rows are shown
    const tableFooter = document.getElementById('tableFooter');
    if (tableFooter && endRow >= totalRows) {
        tableFooter.style.display = 'none';
    }
}

function handleCreateChart() {
    if (!currentDataset) {
        alert('Please upload a dataset first');
        return;
    }
    
    console.log('Storing dataset for chart creation:', currentDataset);
    
    // Store dataset in sessionStorage for chart creation page
    sessionStorage.setItem('currentDataset', JSON.stringify(currentDataset));
    
    // Navigate to chart creation page
    window.location.href = '/create-chart';
}

// Utility Functions
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function resetUpload() {
    if (uploadArea) uploadArea.style.display = 'block';
    if (loadingState) loadingState.style.display = 'none';
    if (errorState) errorState.style.display = 'none';
    if (dataPreview) dataPreview.style.display = 'none';
    if (fileInput) fileInput.value = '';
    currentDataset = null;
}