// Live Data Visualization JavaScript

// Global Variables
let socket = null;
let liveChart = null;
let sessionId = null;
let isStreaming = false;
let isPaused = false;
let dataBuffer = [];
let animationFrame = null;

// DOM Elements
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const dataSource = document.getElementById('dataSource');
const liveChartType = document.getElementById('liveChartType');
const updateInterval = document.getElementById('updateInterval');
const maxDataPoints = document.getElementById('maxDataPoints');
const animationSpeed = document.getElementById('animationSpeed');
const liveColorScheme = document.getElementById('liveColorScheme');

const startStreamBtn = document.getElementById('startStreamBtn');
const pauseStreamBtn = document.getElementById('pauseStreamBtn');
const stopStreamBtn = document.getElementById('stopStreamBtn');
const clearDataBtn = document.getElementById('clearDataBtn');

const liveChartCanvas = document.getElementById('liveChart');
const chartPlaceholder = document.getElementById('chartPlaceholder');
const dataPointCount = document.getElementById('dataPointCount');
const latestValue = document.getElementById('latestValue');
const avgValue = document.getElementById('avgValue');

// Color Schemes
const colorSchemes = {
    default: ['#6FC1A3', '#5fb396', '#4da085', '#3d8674', '#2d6d63'],
    blue: ['#3B82F6', '#2563EB', '#1D4ED8', '#1E40AF', '#1E3A8A'],
    rainbow: ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6', '#8B5CF6'],
    gradient: ['#667eea', '#764ba2', '#f093fb', '#4facfe'],
    dynamic: ['#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#f59e0b']
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeWebSocket();
    setupEventListeners();
    sessionId = generateSessionId();
});

// Initialize WebSocket Connection
function initializeWebSocket() {
    socket = io();
    
    socket.on('connect', function() {
        updateStatus('connected', 'Connected');
        console.log('WebSocket connected');
    });
    
    socket.on('disconnect', function() {
        updateStatus('disconnected', 'Disconnected');
        console.log('WebSocket disconnected');
    });
    
    socket.on('new_data_point', function(data) {
        if (data.session_id === sessionId && !isPaused) {
            handleNewDataPoint(data.data);
        }
    });
    
    socket.on('error', function(data) {
        console.error('Socket error:', data);
        alert('Error: ' + data.message);
    });
}

// Setup Event Listeners
function setupEventListeners() {
    startStreamBtn.addEventListener('click', startStream);
    pauseStreamBtn.addEventListener('click', togglePause);
    stopStreamBtn.addEventListener('click', stopStream);
    clearDataBtn.addEventListener('click', clearData);
    
    liveChartType.addEventListener('change', recreateChart);
    liveColorScheme.addEventListener('change', updateChartColors);
}

// Start Live Stream
function startStream() {
    if (isStreaming) return;
    
    const source = dataSource.value;
    const interval = parseInt(updateInterval.value);
    const chartType = liveChartType.value;
    
    isStreaming = true;
    isPaused = false;
    
    // Update UI
    updateStatus('streaming', 'Streaming');
    startStreamBtn.disabled = true;
    pauseStreamBtn.disabled = false;
    stopStreamBtn.disabled = false;
    chartPlaceholder.style.display = 'none';
    liveChartCanvas.classList.add('active');
    
    // Join session
    socket.emit('join_live_session', { session_id: sessionId });
    
    // Initialize chart if needed
    if (!liveChart) {
        initializeLiveChart();
    }
    
    // Start data flow animation
    startDataFlowAnimation();
    
    // Start simulation
    if (source === 'simulation') {
        socket.emit('start_simulation', {
            session_id: sessionId,
            chart_type: chartType,
            interval: interval
        });
    }
}

// Toggle Pause
function togglePause() {
    isPaused = !isPaused;
    
    if (isPaused) {
        updateStatus('paused', 'Paused');
        pauseStreamBtn.innerHTML = '▶️ Resume';
        stopDataFlowAnimation();
    } else {
        updateStatus('streaming', 'Streaming');
        pauseStreamBtn.innerHTML = '⏸️ Pause';
        startDataFlowAnimation();
    }
}

// Stop Stream
function stopStream() {
    isStreaming = false;
    isPaused = false;
    
    updateStatus('connected', 'Connected');
    startStreamBtn.disabled = false;
    pauseStreamBtn.disabled = true;
    stopStreamBtn.disabled = true;
    pauseStreamBtn.innerHTML = '⏸️ Pause';
    
    // Leave session
    socket.emit('leave_live_session', { session_id: sessionId });
    
    // Stop animations
    stopDataFlowAnimation();
}

// Clear Data
function clearData() {
    dataBuffer = [];
    
    if (liveChart) {
        liveChart.data.labels = [];
        liveChart.data.datasets[0].data = [];
        liveChart.update('none');
    }
    
    updateStats();
}

// Initialize Live Chart
function initializeLiveChart() {
    const ctx = liveChartCanvas.getContext('2d');
    const chartType = liveChartType.value;
    const speed = parseInt(animationSpeed.value);
    
    liveChart = new Chart(ctx, {
        type: chartType === 'gauge' ? 'doughnut' : chartType,
        data: {
            labels: [],
            datasets: [{
                label: 'Live Data',
                data: [],
                backgroundColor: getColors(1)[0],
                borderColor: getColors(1)[0],
                borderWidth: 2,
                tension: 0.4,
                fill: chartType === 'line' ? false : true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: speed
            },
            scales: chartType !== 'gauge' ? {
                y: {
                    beginAtZero: true,
                    grid: { color: '#3a3a3a' },
                    ticks: { color: '#E2E2E2' }
                },
                x: {
                    grid: { color: '#3a3a3a' },
                    ticks: { 
                        color: '#E2E2E2',
                        maxTicksLimit: 10
                    }
                }
            } : {},
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            }
        }
    });
}

// Handle New Data Point
function handleNewDataPoint(dataPoint) {
    const maxPoints = parseInt(maxDataPoints.value);
    
    // Add to buffer
    dataBuffer.push(dataPoint);
    
    // Keep only max points
    if (dataBuffer.length > maxPoints) {
        dataBuffer.shift();
    }
    
    // Update chart
    updateChartWithData();
    
    // Update stats
    updateStats();
    
    // Animate data particle
    createDataParticle();
}

// Update Chart with Data
function updateChartWithData() {
    if (!liveChart) return;
    
    const labels = dataBuffer.map(d => d.timestamp || d.label);
    const values = dataBuffer.map(d => d.value);
    const scheme = liveColorScheme.value;
    
    liveChart.data.labels = labels;
    liveChart.data.datasets[0].data = values;
    
    // Update colors based on scheme
    if (scheme === 'dynamic') {
        liveChart.data.datasets[0].backgroundColor = getColors(values.length);
        liveChart.data.datasets[0].borderColor = getColors(values.length);
    } else if (scheme === 'gradient') {
        const gradientColors = colorSchemes.gradient;
        const colors = values.map((_, i) => {
            const index = Math.floor((i / values.length) * gradientColors.length);
            return gradientColors[index];
        });
        liveChart.data.datasets[0].backgroundColor = colors;
        liveChart.data.datasets[0].borderColor = colors;
    }
    
    liveChart.update('active');
}

// Update Statistics
function updateStats() {
    dataPointCount.textContent = dataBuffer.length;
    
    if (dataBuffer.length > 0) {
        const latest = dataBuffer[dataBuffer.length - 1].value;
        latestValue.textContent = latest.toFixed(2);
        
        const sum = dataBuffer.reduce((acc, d) => acc + d.value, 0);
        const avg = sum / dataBuffer.length;
        avgValue.textContent = avg.toFixed(2);
    } else {
        latestValue.textContent = '--';
        avgValue.textContent = '--';
    }
}

// Get Colors
function getColors(count) {
    const scheme = liveColorScheme.value;
    const colors = colorSchemes[scheme] || colorSchemes.default;
    const result = [];
    
    for (let i = 0; i < count; i++) {
        result.push(colors[i % colors.length]);
    }
    
    return result;
}

// Recreate Chart
function recreateChart() {
    if (liveChart) {
        liveChart.destroy();
        liveChart = null;
    }
    
    if (isStreaming) {
        initializeLiveChart();
        updateChartWithData();
    }
}

// Update Chart Colors
function updateChartColors() {
    if (liveChart && dataBuffer.length > 0) {
        updateChartWithData();
    }
}

// Update Status
function updateStatus(status, text) {
    statusDot.className = 'status-dot ' + status;
    statusText.textContent = text;
    
    if (status === 'streaming') {
        statusText.innerHTML = text + '<span class="spinner"></span>';
    }
}

// Data Flow Animation
function startDataFlowAnimation() {
    const nodes = document.querySelectorAll('.flow-node');
    const lines = document.querySelectorAll('.flow-line');
    
    nodes.forEach(node => node.classList.add('active'));
    lines.forEach(line => line.classList.add('active'));
    
    // Start particle animation loop
    createParticleLoop();
}

function stopDataFlowAnimation() {
    const nodes = document.querySelectorAll('.flow-node');
    const lines = document.querySelectorAll('.flow-line');
    
    nodes.forEach(node => node.classList.remove('active'));
    lines.forEach(line => line.classList.remove('active'));
    
    // Stop particle loop
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }
}

function createDataParticle() {
    const containers = document.querySelectorAll('.data-particles');
    
    containers.forEach((container, index) => {
        const particle = document.createElement('div');
        particle.className = 'data-particle';
        
        // Random vertical position
        const randomY = 30 + Math.random() * 40;
        particle.style.top = randomY + '%';
        
        container.appendChild(particle);
        
        // Remove after animation
        setTimeout(() => {
            particle.remove();
        }, 2000);
    });
}

function createParticleLoop() {
    if (!isStreaming || isPaused) return;
    
    createDataParticle();
    
    // Create particle every 500ms
    setTimeout(() => {
        animationFrame = requestAnimationFrame(createParticleLoop);
    }, 500);
}

// Utility Functions
function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (socket && socket.connected) {
        socket.emit('leave_live_session', { session_id: sessionId });
        socket.disconnect();
    }
    
    if (liveChart) {
        liveChart.destroy();
    }
});