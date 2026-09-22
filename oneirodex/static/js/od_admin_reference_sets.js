/* Extracted from the matching Jinja template so the page has no inline
 * <script>. Lives under static/js, not a theme copy — no Reset Themes. */
(function () {
  function csrfHeaders(extra) {
    var headers = extra || { 'Content-Type': 'application/json' };
    if (window.CSRFUtils && window.CSRFUtils.getHeaders) {
      return window.CSRFUtils.getHeaders(headers);
    }
    var meta = document.querySelector('meta[name="csrf-token"]');
    if (meta && meta.content) headers['X-CSRFToken'] = meta.content;
    return headers;
  }

  var btn = document.getElementById('rehash-btn');
  var sel = document.getElementById('rehash-platform');
  var status = document.getElementById('rehash-status');
  if (btn && sel && status) {
    btn.addEventListener('click', function () {
      status.textContent = 'Hashing…';
      fetch('/api/reference-sets/rehash', {
        method: 'POST',
        credentials: 'same-origin',
        headers: csrfHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ library_platform: sel.value })
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok) {
            status.textContent = res.j.error || 'Rehash failed';
            return;
          }
          status.textContent = 'Hashed ' + res.j.hashed + ' / ' + res.j.considered +
            ' (skipped ' + res.j.skipped + ')';
        })
        .catch(function (err) {
          status.textContent = String(err);
        });
    });
  }

  var catalogBtn = document.getElementById('catalog-refresh-btn');
  var catalogSel = document.getElementById('catalog-refresh-platform');
  var catalogStatus = document.getElementById('catalog-refresh-status');
  if (catalogBtn && catalogSel && catalogStatus) {
    catalogBtn.addEventListener('click', function () {
      catalogStatus.textContent = 'Refreshing from IGDB… this can take a minute.';
      catalogBtn.disabled = true;
      fetch('/api/licensed-catalog/refresh', {
        method: 'POST',
        credentials: 'same-origin',
        headers: csrfHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ library_platform: catalogSel.value })
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          catalogBtn.disabled = false;
          if (!res.ok) {
            catalogStatus.textContent = res.j.error || 'Refresh failed';
            return;
          }
          catalogStatus.textContent = 'Cached ' + res.j.unique_titles + ' titles (' +
            res.j.cached_rows + ' region rows, ' + res.j.pages + ' pages).';
        })
        .catch(function (err) {
          catalogBtn.disabled = false;
          catalogStatus.textContent = String(err);
        });
    });
  }

  // INSP-24 -- DAT repair preview. A dry run: the server sorts owned files
  // into buckets and this only draws them. No rename lives anywhere here.
  var repairBtn = document.getElementById('repair-btn');
  var repairPlatform = document.getElementById('repair-platform');
  var repairRegion = document.getElementById('repair-region');
  var repairStatus = document.getElementById('repair-status');
  var repairReport = document.getElementById('repair-report');
  if (repairBtn && repairPlatform && repairRegion && repairStatus && repairReport) {
    var BUCKETS = [
      { key: 'rename_candidates', title: 'Hash matches, name differs (rename candidates)',
        cols: [['file_name', 'File'], ['suggested_name', 'Set name'], ['matched_by', 'Matched by']] },
      { key: 'hash_mismatches', title: 'Name matches, hash differs',
        cols: [['file_name', 'File'], ['entry_name', 'Set name'], ['file_crc', 'File CRC'], ['entry_crc', 'Set CRC']] },
      { key: 'clone_named', title: 'Clone-named files',
        cols: [['file_name', 'File'], ['clone_of', 'Clone of'], ['parent_owned', 'Parent owned']] },
      { key: 'unknown', title: 'Not in the set',
        cols: [['file_name', 'File'], ['name', 'Catalogue name'], ['hashed', 'Hashed']] }
    ];

    function cell(value) {
      var td = document.createElement('td');
      if (value === true) value = 'yes';
      else if (value === false) value = 'no';
      td.textContent = value == null ? '' : String(value);
      return td;
    }

    function renderBucket(spec, rows, total) {
      var wrap = document.createElement('div');
      wrap.className = 'mb-3';
      var head = document.createElement('h3');
      head.className = 'h6';
      head.textContent = spec.title + ' · ' + total;
      wrap.appendChild(head);
      if (!rows.length) {
        var none = document.createElement('p');
        none.className = 'text-muted';
        none.textContent = 'None.';
        wrap.appendChild(none);
        return wrap;
      }
      var table = document.createElement('table');
      table.className = 'table table-sm';
      var thead = document.createElement('thead');
      var hr = document.createElement('tr');
      spec.cols.forEach(function (c) {
        var th = document.createElement('th');
        th.textContent = c[1];
        hr.appendChild(th);
      });
      thead.appendChild(hr);
      table.appendChild(thead);
      var tbody = document.createElement('tbody');
      rows.forEach(function (row) {
        var tr = document.createElement('tr');
        spec.cols.forEach(function (c) { tr.appendChild(cell(row[c[0]])); });
        tr.title = row.path || '';
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
      if (rows.length < total) {
        var more = document.createElement('p');
        more.className = 'text-muted';
        more.textContent = 'Showing the first ' + rows.length + ' of ' + total + '.';
        wrap.appendChild(more);
      }
      return wrap;
    }

    repairBtn.addEventListener('click', function () {
      repairStatus.textContent = 'Comparing…';
      repairReport.hidden = true;
      repairReport.textContent = '';
      repairBtn.disabled = true;
      var body = { library_platform: repairPlatform.value };
      if (repairRegion.value) body.region = repairRegion.value;
      fetch('/api/reference-sets/repair-preview', {
        method: 'POST',
        credentials: 'same-origin',
        headers: csrfHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body)
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          repairBtn.disabled = false;
          if (!res.ok) {
            repairStatus.textContent = res.j.error || 'Preview failed';
            return;
          }
          var r = res.j;
          repairStatus.textContent = r.owned_total + ' owned · ' + r.verified + ' verified by hash and name · ' +
            r.unhashed_name_matches + ' name-only (not hashed yet) · dry run, nothing changed.';
          BUCKETS.forEach(function (spec) {
            repairReport.appendChild(renderBucket(spec, r[spec.key] || [], (r.counts || {})[spec.key] || 0));
          });
          repairReport.hidden = false;
        })
        .catch(function (err) {
          repairBtn.disabled = false;
          repairStatus.textContent = String(err);
        });
    });
  }
})();
