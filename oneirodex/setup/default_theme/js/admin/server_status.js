// Server Status page — CPU aurora meter + charts
let cpuUsage, memoryUsage, diskUsage, gamesUsage;

function initializeServerData(data) {
    cpuUsage = data.cpuUsage;
    memoryUsage = data.memoryUsage;
    diskUsage = data.diskUsage;
    gamesUsage = data.gamesUsage;
}

function updateCpuBar() {
    const cpuBar = document.getElementById('cpuBar');
    const cpuMeter = document.getElementById('cpuMeter');
    const label = cpuMeter ? cpuMeter.querySelector('.od-meter__label') : null;
    if (!cpuBar || cpuUsage == null) return;

    const pct = Number(cpuUsage) || 0;
    cpuBar.style.width = pct + '%';
    if (label) label.textContent = pct + '%';
    if (cpuMeter) {
        cpuMeter.setAttribute('aria-valuenow', String(pct));
        cpuMeter.classList.remove('is-warn', 'is-danger');
        if (pct > 90) {
            cpuMeter.classList.add('is-danger');
        } else if (pct > 50) {
            cpuMeter.classList.add('is-warn');
        }
    }
}

function initializeMemoryChart() {
    if (!memoryUsage) return;

    const chartData = {
        labels: ['Used', 'Available'],
        datasets: [{
            data: [memoryUsage.used, memoryUsage.available],
            backgroundColor: ['rgba(255, 99, 132, 0.8)', 'rgba(75, 192, 192, 0.8)'],
            borderWidth: 1
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: { position: 'bottom' },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return context.label + ': ' +
                               (context.label === 'Used' ? memoryUsage.used_formatted : memoryUsage.available_formatted);
                    }
                }
            }
        }
    };

    createChart('memoryChart', 'pie', chartData, chartOptions);
}

function initializeDiskChart() {
    if (!diskUsage) return;

    const chartData = {
        labels: ['Used', 'Free'],
        datasets: [{
            data: [diskUsage.used, diskUsage.free],
            backgroundColor: ['rgba(255, 99, 132, 0.8)', 'rgba(75, 192, 192, 0.8)'],
            borderWidth: 1
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: { position: 'bottom' },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return context.label + ': ' +
                               (context.label === 'Used' ? diskUsage.used_formatted : diskUsage.free_formatted);
                    }
                }
            }
        }
    };

    createChart('diskChart', 'pie', chartData, chartOptions);
}

function initializeGamesDiskChart() {
    if (!gamesUsage) return;

    const chartData = {
        labels: ['Used', 'Free'],
        datasets: [{
            data: [gamesUsage.used, gamesUsage.free],
            backgroundColor: ['rgba(255, 159, 64, 0.8)', 'rgba(75, 192, 192, 0.8)'],
            borderWidth: 1
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: { position: 'bottom' },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return context.label + ': ' +
                               (context.label === 'Used' ? gamesUsage.used_formatted : gamesUsage.free_formatted);
                    }
                }
            }
        }
    };

    createChart('gamesDiskChart', 'pie', chartData, chartOptions);
}

function initializeServerStatus() {
    updateCpuBar();
    initializeMemoryChart();
    initializeDiskChart();
    initializeGamesDiskChart();
}
