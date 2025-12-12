// Chart Creation JavaScript

// Global variables
let currentDataset = null;
let currentChart = null;

// DOM Elements
const noDataState = document.getElementById('noDataState');
const chartBuilder = document.getElementById('chartBuilder');
const xAxisSelect = document.getElementById('xAxisSelect');
const yAxisSelect = document.getElementById('yAxisSelect');
const valueSelect = document.getElementById('valueSelect');
const labelSelect = document.getElementById('labelSelect');
const chartTitle = document.getElementById('chartTitle');
const colorScheme = document.getElementById('colorScheme');
const updateChartBtn = document.getElementById('updateChartBtn');
const saveChartBtn = document.getElementById('saveChartBtn');
const downloadBtn = document.getElementById('downloadBtn');
const chartCanvas = document.getElementById('chartCanvas');
const noChartState = document.getElementById('noChartState');
const yAxisGroup = document.getElementById('yAxisGroup');
const valueGroup = document.getElementById('valueGroup');
const labelGroup = document.getElementById('labelGroup');

// Chart type buttons
const chartTypeButtons = document.querySelectorAll('.chart-type-btn');
let selectedChartType = 'bar';

// Color schemes
const colorSchemes = {
    default: ['#6FC1A3', '#5fb396', '#4da085', '#3d8674', '#2d6d63'],
    blue: ['#3B82F6', '#2563EB', '#1D4ED8', '#1E40AF', '#1E3A8A'],
    purple: ['#8B5CF6', '#7C3AED', '#6D28D9', '#5B21B6', '#4C1D95'],
    rainbow: ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6', '#8B5CF6']
};

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
});

function initializePage() {
    // Try to load dataset from sessionStorage
    const datasetJson = sessionStorage.getItem('currentDataset');
    
    if (datasetJson) {
        currentDataset = JSON.parse(datasetJson);
        showChartBuilder();
        initializeChartBuilder();
    } else {
        showNoDataState();
    }
}

function showNoDataState() {
    noDataState.style.display = 'block';
    chartBuilder.style.display = 'none';
}

function showChartBuilder() {
    noDataState.style.display = 'none';
    chartBuilder.style.display = 'block';
    
    // Update dataset info
    document.getElementById('datasetName').textContent = currentDataset.filename;
    document.getElementById('datasetRows').textContent = `${currentDataset.rows.toLocaleString()} rows`;
    document.getElementById('datasetCols').textContent = `${currentDataset.columns} columns`;
}

function initializeChartBuilder() {
    // Populate column selects
    populateColumnSelects();
    
    // Initialize chart type selection
    initializeChartTypes();
    
    // Add event listeners
    updateChartBtn.addEventListener('click', handleUpdateChart);
    saveChartBtn.addEventListener('click', handleSaveChart);
    downloadBtn.addEventListener('click', handleDownloadChart);
    
    // Add change listeners for dynamic updates
    xAxisSelect.addEventListener('change', validateSelections);
    yAxisSelect.addEventListener('change', validateSelections);
    valueSelect.addEventListener('change', validateSelections);
    labelSelect.addEventListener('change', validateSelections);
}

function populateColumnSelects() {
    const columns = currentDataset.column_names;
    
    // Clear existing options
    clearSelectOptions([xAxisSelect, yAxisSelect, valueSelect, labelSelect]);
    
    // Add default option
    addDefaultOption([xAxisSelect, yAxisSelect, valueSelect, labelSelect]);
    
    // Populate with columns
    columns.forEach(column => {
        addOptionToSelects([xAxisSelect, yAxisSelect, valueSelect, labelSelect], column, column);
    });
}

function clearSelectOptions(selects) {
    selects.forEach(select => {
        select.innerHTML = '';
    });
}

function addDefaultOption(selects) {
    const defaultOptions = [
        'Select X-Axis column...',
        'Select Y-Axis column...',
        'Select value column...',
        'Select label column...'
    ];
    
    selects.forEach((select, index) => {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = defaultOptions[index];
        select.appendChild(option);
    });
}

function addOptionToSelects(selects, value, text) {
    selects.forEach(select => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        select.appendChild(option);
    });
}

function initializeChartTypes() {
    chartTypeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove active class from all buttons
            chartTypeButtons.forEach(b => b.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Update selected chart type
            selectedChartType = this.dataset.type;
            
            // Show/hide relevant form fields
            updateFormFields();
            
            // Validate selections
            validateSelections();
        });
    });
}

function updateFormFields() {
    if (selectedChartType === 'pie') {
        // For pie charts, show value and label selects
        yAxisGroup.style.display = 'none';
        valueGroup.style.display = 'block';
        labelGroup.style.display = 'block';
    } else {
        // For other charts, show X and Y axis selects
        yAxisGroup.style.display = 'block';
        valueGroup.style.display = 'none';
        labelGroup.style.display = 'none';
    }
}

function validateSelections() {
    let isValid = false;
    
    if (selectedChartType === 'pie') {
        isValid = valueSelect.value !== '' && labelSelect.value !== '';
    } else {
        isValid = xAxisSelect.value !== '' && yAxisSelect.value !== '';
    }
    
    updateChartBtn.disabled = !isValid;
    
    if (!isValid) {
        updateChartBtn.textContent = '🔄 Select Data to Update Chart';
        updateChartBtn.style.opacity = '0.6';
    } else {
        updateChartBtn.textContent = '🔄 Update Chart';
        updateChartBtn.style.opacity = '1';
    }
    
    return isValid;
}

function handleUpdateChart() {
    console.log('Update chart clicked'); // Debug log
    console.log('Selected chart type:', selectedChartType);
    console.log('X-axis value:', xAxisSelect.value);
    console.log('Y-axis value:', yAxisSelect.value);
    console.log('Value select:', valueSelect.value);
    console.log('Label select:', labelSelect.value);
    
    const isValid = validateSelections();
    console.log('Is valid:', isValid);
    
    if (!isValid) {
        alert('Please select the required data columns');
        return;
    }
    
    // Show loading state
    showChartLoading();
    
    // Prepare chart data
    const chartData = prepareChartData();
    console.log('Chart data:', chartData);
    
    // Create chart
    setTimeout(() => {
        createChart(chartData);
        showChartSuccess();
    }, 500); // Small delay for better UX
}

function showChartLoading() {
    chartCanvas.style.display = 'none';
    noChartState.innerHTML = `
        <div class="loading-chart">
            <div class="loading-spinner"></div>
            <p>Creating your chart...</p>
        </div>
    `;
}

function showChartSuccess() {
    noChartState.style.display = 'none';
    chartCanvas.style.display = 'block';
    chartCanvas.classList.add('visible');
    
    // Show additional buttons
    saveChartBtn.style.display = 'block';
    downloadBtn.style.display = 'block';
}

function prepareChartData() {
    const data = currentDataset.preview;
    let chartData;
    
    if (selectedChartType === 'pie') {
        chartData = preparePieChartData(data);
    } else {
        chartData = prepareAxisChartData(data);
    }
    
    return chartData;
}

function preparePieChartData(data) {
    const valueColumn = valueSelect.value;
    const labelColumn = labelSelect.value;
    
    const labels = [];
    const values = [];
    
    data.forEach(row => {
        const label = row[labelColumn];
        const value = parseFloat(row[valueColumn]) || 0;
        
        if (label && !isNaN(value)) {
            labels.push(label);
            values.push(value);
        }
    });
    
    return {
        labels: labels,
        datasets: [{
            data: values,
            backgroundColor: getColors(values.length)
        }]
    };
}

function prepareAxisChartData(data) {
    const xColumn = xAxisSelect.value;
    const yColumn = yAxisSelect.value;
    
    const labels = [];
    const values = [];
    
    data.forEach(row => {
        const xValue = row[xColumn];
        const yValue = parseFloat(row[yColumn]) || 0;
        
        if (xValue !== undefined && xValue !== '') {
            labels.push(xValue);
            values.push(yValue);
        }
    });
    
    return {
        labels: labels,
        datasets: [{
            label: yColumn,
            data: values,
            backgroundColor: getColors(values.length),
            borderColor: colorSchemes[colorScheme.value][0],
            borderWidth: selectedChartType === 'line' ? 2 : 1
        }]
    };
}

function getColors(count) {
    const scheme = colorSchemes[colorScheme.value];
    const colors = [];
    
    for (let i = 0; i < count; i++) {
        colors.push(scheme[i % scheme.length]);
    }
    
    return colors;
}

function createChart(data) {
    // Destroy existing chart
    if (currentChart) {
        currentChart.destroy();
    }
    
    const ctx = chartCanvas.getContext('2d');
    const title = chartTitle.value || `${selectedChartType.charAt(0).toUpperCase() + selectedChartType.slice(1)} Chart`;
    
    const config = {
        type: selectedChartType,
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: title,
                    font: {
                        size: 16,
                        weight: 'bold'
                    },
                    color: '#ffffffff'
                },
                legend: {
                    display: selectedChartType === 'pie',
                    position: 'bottom'
                }
            },
            scales: selectedChartType !== 'pie' ? {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#ffffffff'
                    },
                    ticks: {
                        color: '#ffffffff'
                    }
                },
                x: {
                    grid: {
                        color: '#ffffffff'
                    },
                    ticks: {
                        color: '#ffffffff'
                    }
                }
            } : {}
        }
    };
    
    currentChart = new Chart(ctx, config);
}

function handleSaveChart() {
    if (!currentChart) {
        alert('Please create a chart first');
        return;
    }
    
    if (!currentDataset || !currentDataset.id) {
        alert('No dataset loaded. Please go back to dashboard and upload a file first.');
        return;
    }
    
    // Get chart configuration
    const chartConfig = {
        title: chartTitle.value || `${selectedChartType.charAt(0).toUpperCase() + selectedChartType.slice(1)} Chart`,
        chart_type: selectedChartType,
        dataset_id: currentDataset.id,
        color_scheme: colorScheme.value
    };
    
    // Add axis/value/label columns based on chart type
    if (selectedChartType === 'pie') {
        chartConfig.value_column = valueSelect.value;
        chartConfig.label_column = labelSelect.value;
    } else {
        chartConfig.x_axis = xAxisSelect.value;
        chartConfig.y_axis = yAxisSelect.value;
    }
    
    console.log('Saving chart with config:', chartConfig);
    
    // Show loading state
    saveChartBtn.disabled = true;
    saveChartBtn.textContent = ' Saving...';
    
    // Send to server
    fetch('/save-chart', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(chartConfig)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('✅ Chart saved successfully!\n\nYou can view it in "My Charts" page.');
            // Optionally redirect to charts page
            const goToCharts = confirm('Would you like to go to My Charts page now?');
            if (goToCharts) {
                window.location.href = '/charts';
            }
        } else {
            alert('❌ Error saving chart: ' + (data.error || 'Unknown error'));
        }
    })
    .catch(error => {
        console.error('Error saving chart:', error);
        alert('❌ Error saving chart: ' + error.message);
    })
    .finally(() => {
        saveChartBtn.disabled = false;
        saveChartBtn.textContent = ' Save Chart';
    });
}

function handleDownloadChart() {
    if (!currentChart) {
        alert('Please create a chart first');
        return;
    }
    
    // Create download link
    const link = document.createElement('a');
    link.download = `${chartTitle.value || 'chart'}.png`;
    link.href = chartCanvas.toDataURL();
    link.click();
}

// Reset form when leaving page
window.addEventListener('beforeunload', function() {
    if (currentChart) {
        currentChart.destroy();
    }
});