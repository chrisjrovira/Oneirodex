/** Bytes → human size. Statistics show a library total, which is often TB. */
function gtFormatBytes(bytes) {
    var n = Number(bytes);
    if (!isFinite(n) || n < 0) return 'n/a';
    var units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    var i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i += 1; }
    return (i === 0 ? n : n.toFixed(1)) + ' ' + units[i];
}

/** Headline totals (UX-C13) — exact figures a chart cannot be read for. */
function gtRenderTotals(totals) {
    if (!totals) return;
    document.querySelectorAll('#statTotals [data-total]').forEach(function (el) {
        var key = el.getAttribute('data-total');
        var value = totals[key];
        if (value == null) { el.textContent = 'n/a'; return; }
        el.textContent = key === 'library_bytes'
            ? gtFormatBytes(value)
            : Number(value).toLocaleString();
    });
}

function gtRenderTopGamesTable(rows) {
    var body = document.querySelector('#topGamesTable tbody');
    if (!body) return;
    body.innerHTML = '';
    if (!rows || !rows.length) {
        var empty = document.createElement('tr');
        var cell = document.createElement('td');
        cell.colSpan = 3;
        cell.className = 'text-muted';
        cell.textContent = 'No downloads recorded yet.';
        empty.appendChild(cell);
        body.appendChild(empty);
        return;
    }
    rows.forEach(function (row, index) {
        var tr = document.createElement('tr');
        // textContent throughout — titles come from scraped store metadata.
        var rank = document.createElement('td');
        rank.textContent = String(index + 1);
        var name = document.createElement('td');
        name.textContent = row.name || 'Unknown';
        var count = document.createElement('td');
        count.className = 'text-end';
        count.textContent = Number(row.downloads || 0).toLocaleString();
        tr.appendChild(rank); tr.appendChild(name); tr.appendChild(count);
        body.appendChild(tr);
    });
}

document.addEventListener('DOMContentLoaded', function() {
    // Fetch statistics data from the server
    fetch('/admin/statistics/data')
        .then(response => response.json())
        .then(data => {
            gtRenderTotals(data.totals);
            gtRenderTopGamesTable(data.top_games_table);
            // Downloads per user chart
            createChart('downloadsPerUserChart', 'bar', {
                labels: data.downloads_per_user.labels,
                datasets: [{
                    label: 'Downloads per User',
                    data: data.downloads_per_user.data,
                    backgroundColor: 'rgba(54, 162, 235, 0.5)'
                }]
            }, {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Downloads per User'
                    }
                }
            });

            // Top downloaded games chart
            createChart('topGamesChart', 'bar', {
                labels: data.top_games.labels,
                datasets: [{
                    label: 'Most Downloaded Games',
                    data: data.top_games.data,
                    backgroundColor: 'rgba(255, 99, 132, 0.5)'
                }]
            }, {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Most Downloaded Games'
                    }
                }
            });

            // Download trends chart
            createChart('downloadTrendsChart', 'line', {
                labels: data.download_trends.labels,
                datasets: [{
                    label: 'Downloads Over Time',
                    data: data.download_trends.data,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    tension: 0.1
                }]
            }, {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Download Trends'
                    }
                }
            });

            // Invite tokens per user chart
            createChart('inviteTokensChart', 'bar', {
                labels: data.users_with_invites.labels,
                datasets: [{
                    label: 'Invite Tokens Generated',
                    data: data.users_with_invites.data,
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            }, {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Users with Invite Tokens Generated'
                    }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            });

            // Top downloaders chart
            createChart('topDownloadersChart', 'bar', {
                labels: data.top_downloaders.labels,
                datasets: [{
                    label: 'Users with Most Downloads',
                    data: data.top_downloaders.data,
                    backgroundColor: 'rgba(153, 102, 255, 0.5)'
                }]
            }, {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Top Downloaders'
                    }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            });

            // Top collectors chart
            createChart('topCollectorsChart', 'bar', {
                labels: data.top_collectors.labels,
                datasets: [{
                    label: 'Users with Most Favorites',
                    data: data.top_collectors.data,
                    backgroundColor: 'rgba(255, 159, 64, 0.5)'
                }]
            }, {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Top Game Collectors'
                    }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            });
        });
});
