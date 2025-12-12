// My Charts Page JavaScript

let currentModalChart = null;
let currentChartData = null;

// Color schemes (same as create_chart.js)
const colorSchemes = {
    default: ['#6FC1A3', '#5fb396', '#4da085', '#3d8674', '#2d6d63'],
    blue: ['#3B82F6', '#2563EB', '#1D4ED8', '#1E40AF', '#1E3A8A'],
    purple: ['#8B5CF6', '#7C3AED', '#6D28D9', '#5B21B6', '#4C1D95'],
    rainbow: ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6', '#8B5CF6']
};

// View Chart in Modal
async function viewChartModal(chartId) {
    try {
        // Fetch chart data from server
        const response = await fetch(`/get-chart/${chartId}`);
        const data = await response.json();
        
        if (data.success) {
            currentChartData = data.chart;
            openChartModal(data.chart);
        } else {
            alert('Error loading chart: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error fetching chart:', error);
        alert('Error loading chart. Please try again.');
    }
}

// Open Modal and Render Chart
function openChartModal(chartData) {
    const modal = document.getElementById('chartModal');
    const modalTitle = document.getElementById('modalChartTitle');
    const modalEditBtn = document.getElementById('modalEditBtn');
    const downloadPNGBtn = document.getElementById('downloadChartPNG');
    const downloadPDFBtn = document.getElementById('downloadChartPDF');
    const shareBtn = document.getElementById('shareChartBtn');
    
    // Set title
    modalTitle.textContent = chartData.title;
    
    // Show modal
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    
    // Set up buttons
    modalEditBtn.onclick = () => editChart(chartData.id);
    downloadPNGBtn.onclick = () => downloadChartAsPNG(chartData.title);
    downloadPDFBtn.onclick = () => downloadChartAsPDF(chartData.title);
    shareBtn.onclick = () => shareChart(chartData.id, chartData.is_public);
    
    // Update share button text based on public status
    if (chartData.is_public && chartData.share_token) {
        shareBtn.textContent = ' Copy Link';
        shareBtn.classList.add('btn-success');
    } else {
        shareBtn.textContent = ' Share';
        shareBtn.classList.remove('btn-success');
    }
    
    // Render chart after a short delay (to ensure modal is visible)
    setTimeout(() => {
        renderModalChart(chartData);
    }, 100);
}

// Close Modal
function closeChartModal() {
    const modal = document.getElementById('chartModal');
    modal.classList.remove('show');
    document.body.style.overflow = 'auto';
    
    // Destroy chart
    if (currentModalChart) {
        currentModalChart.destroy();
        currentModalChart = null;
    }
}

// Render Chart in Modal
function renderModalChart(chartData) {
    const canvas = document.getElementById('modalChartCanvas');
    const ctx = canvas.getContext('2d');
    
    // Destroy existing chart
    if (currentModalChart) {
        currentModalChart.destroy();
    }
    
    const config = chartData.config;
    const dataset = chartData.dataset;
    
    // Prepare chart data based on type
    let preparedData;
    if (chartData.chart_type === 'pie') {
        preparedData = preparePieData(dataset.preview, config.value_column, config.label_column, config.color_scheme);
    } else {
        preparedData = prepareAxisData(dataset.preview, config.x_axis, config.y_axis, chartData.chart_type, config.color_scheme);
    }
    
    // Create chart
    currentModalChart = new Chart(ctx, {
        type: chartData.chart_type,
        data: preparedData,
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                title: {
                    display: false
                },
                legend: {
                    display: chartData.chart_type === 'pie',
                    position: 'bottom'
                }
            },
            scales: chartData.chart_type !== 'pie' ? {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#E2E8F0'
                    },
                    ticks: {
                        color: '#4A5568'
                    }
                },
                x: {
                    grid: {
                        color: '#E2E8F0'
                    },
                    ticks: {
                        color: '#4A5568'
                    }
                }
            } : {}
        }
    });
}

// Prepare Pie Chart Data
function preparePieData(data, valueColumn, labelColumn, colorScheme) {
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
            backgroundColor: getColors(values.length, colorScheme)
        }]
    };
}

// Prepare Axis Chart Data (Bar, Line, Scatter)
function prepareAxisData(data, xColumn, yColumn, chartType, colorScheme) {
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
            backgroundColor: getColors(values.length, colorScheme),
            borderColor: colorSchemes[colorScheme][0],
            borderWidth: chartType === 'line' ? 2 : 1,
            tension: chartType === 'line' ? 0.4 : 0
        }]
    };
}

// Get Colors from Scheme
function getColors(count, scheme = 'default') {
    const colors = colorSchemes[scheme] || colorSchemes.default;
    const result = [];
    
    for (let i = 0; i < count; i++) {
        result.push(colors[i % colors.length]);
    }
    
    return result;
}

// Edit Chart
function editChart(chartId) {
    alert(`Edit Chart functionality coming soon!\n\nChart ID: ${chartId}\n\nWill redirect to chart editor with pre-loaded configuration.`);
    // TODO: Implement edit functionality
    // window.location.href = `/create-chart?edit=${chartId}`;
}

// Delete Chart
function deleteChart(chartId, chartTitle) {
    // Confirm before deleting
    const confirmed = confirm(`Are you sure you want to delete "${chartTitle}"?\n\nThis action cannot be undone.`);
    
    if (confirmed) {
        // Show loading state
        const chartCard = event.target.closest('.chart-card');
        if (chartCard) {
            chartCard.style.opacity = '0.5';
            chartCard.style.pointerEvents = 'none';
        }
        
        // Send delete request
        fetch(`/delete-chart/${chartId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Remove the card from DOM
                if (chartCard) {
                    chartCard.style.transition = 'all 0.3s ease';
                    chartCard.style.transform = 'scale(0)';
                    setTimeout(() => {
                        chartCard.remove();
                        
                        // Check if there are any charts left
                        const remainingCharts = document.querySelectorAll('.chart-card');
                        if (remainingCharts.length === 0) {
                            // Reload page to show empty state
                            window.location.reload();
                        }
                    }, 300);
                }
                
                // Show success message
                showAlert('Chart deleted successfully!', 'success');
            } else {
                // Show error message
                showAlert(data.error || 'Failed to delete chart', 'error');
                
                // Restore card state
                if (chartCard) {
                    chartCard.style.opacity = '1';
                    chartCard.style.pointerEvents = 'auto';
                }
            }
        })
        .catch(error => {
            console.error('Error deleting chart:', error);
            showAlert('Error deleting chart. Please try again.', 'error');
            
            // Restore card state
            if (chartCard) {
                chartCard.style.opacity = '1';
                chartCard.style.pointerEvents = 'auto';
            }
        });
    }
}

// Show Alert Message
function showAlert(message, type = 'info') {
    // Create flash message container if it doesn't exist
    let flashContainer = document.querySelector('.flash-messages');
    if (!flashContainer) {
        flashContainer = document.createElement('div');
        flashContainer.className = 'flash-messages';
        document.body.appendChild(flashContainer);
    }
    
    // Create alert element
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="alert-close" onclick="this.parentElement.remove()"></button>
    `;
    
    // Add to container
    flashContainer.appendChild(alert);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        alert.style.opacity = '0';
        setTimeout(() => {
            alert.remove();
        }, 300);
    }, 5000);
}

// Export Functions

// Download Chart as PNG
function downloadChartAsPNG(title) {
    if (!currentModalChart) {
        alert('No chart to download');
        return;
    }
    
    const canvas = document.getElementById('modalChartCanvas');
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `${title || 'chart'}.png`;
    link.href = url;
    link.click();
    
    showAlert('Chart downloaded as PNG!', 'success');
}

// Download Chart as PDF
function downloadChartAsPDF(title) {
    if (!currentModalChart) {
        alert('No chart to download');
        return;
    }
    
    // Load jsPDF library if not already loaded
    if (typeof window.jspdf === 'undefined') {
        // Load jsPDF dynamically
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload = () => {
            generatePDF(title);
        };
        document.head.appendChild(script);
    } else {
        generatePDF(title);
    }
}

// Generate PDF from canvas
function generatePDF(title) {
    const canvas = document.getElementById('modalChartCanvas');
    const imgData = canvas.toDataURL('image/png');
    
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height]
    });
    
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save(`${title || 'chart'}.pdf`);
    
    showAlert('Chart downloaded as PDF!', 'success');
}

// Share Chart
async function shareChart(chartId, isCurrentlyPublic) {
    const shareBtn = document.getElementById('shareChartBtn');
    
    // If already public, just copy the link
    if (isCurrentlyPublic && currentChartData.share_token) {
        const shareUrl = window.location.origin + '/shared/' + currentChartData.share_token;
        copyToClipboard(shareUrl);
        showAlert('Share link copied to clipboard!', 'success');
        return;
    }
    
    // Otherwise, generate share link
    shareBtn.disabled = true;
    shareBtn.textContent = ' Generating...';
    
    try {
        const response = await fetch(`/share-chart/${chartId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            const shareUrl = data.share_url;
            
            // Copy to clipboard
            copyToClipboard(shareUrl);
            
            // Update button
            shareBtn.textContent = ' Copy Link';
            shareBtn.classList.add('btn-success');
            
            // Update current chart data
            currentChartData.is_public = true;
            currentChartData.share_token = data.share_token;
            
            // Show success message with the link
            showAlert('Chart is now public! Link copied to clipboard.', 'success');
            
            // Show a prompt with the link
            setTimeout(() => {
                const showLink = confirm(`Share link copied!\n\n${shareUrl}\n\nClick OK to open in new tab.`);
                if (showLink) {
                    window.open(shareUrl, '_blank');
                }
            }, 500);
        } else {
            showAlert(data.error || 'Failed to generate share link', 'error');
        }
    } catch (error) {
        console.error('Error sharing chart:', error);
        showAlert('Error generating share link', 'error');
    } finally {
        shareBtn.disabled = false;
    }
}

// Copy to clipboard helper
function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
    } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }
}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    console.log('My Charts page loaded');
    
    // Close modal on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const modal = document.getElementById('chartModal');
            if (modal.classList.contains('show')) {
                closeChartModal();
            }
        }
    });
});