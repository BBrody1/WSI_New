function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }
  
  async function fetchLocation(id) {
    // CORRECTED: Use the singular '/api/location' endpoint
    const res = await fetch(`/api/location?id=${encodeURIComponent(id)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `API error (${res.status})`);
    }
    return res.json();
  }
  
  document.addEventListener('DOMContentLoaded', async () => {
    const id = getQueryParam('id');
    const loadEl = document.getElementById('locationLoading');
    const profileEl = document.getElementById('locationProfile');
    const errorEl = document.getElementById('locationError');
  
    if (!id) {
      loadEl.classList.add('hidden');
      errorEl.textContent = 'No location ID specified.';
      errorEl.classList.remove('hidden');
      return;
    }
  
    try {
      const data = await fetchLocation(id);
  
      // Populate main content
      document.getElementById('locationName').textContent = data.establishment_name || 'N/A';
      document.getElementById('locationAddress').textContent = [data.street_address, data.city, data.state, data.zip_code].filter(Boolean).join(', ');
      document.getElementById('locationEmployees').textContent = data.annual_average_employees != null ? Number(data.annual_average_employees).toLocaleString() : '—';
  
      // Populate safety badge
      const score = typeof data.safety_score === 'number' ? Math.round(data.safety_score) : null;
      document.getElementById('locationSafetyValue').textContent = score != null ? score : '—';
      const badge = document.getElementById('locationSafetyBadge');
      badge.classList.remove('border-green-500', 'border-yellow-500', 'border-red-500');
      if (score >= 85) badge.classList.add('border-green-500');
      else if (score >= 60) badge.classList.add('border-yellow-500');
      else badge.classList.add('border-red-500');
  
      // Build charts and tables
      const years = data.years || [];
      if (years.length) {
        buildIncidentSummary(years[0]);
        buildRatesSummary(years[0]);
      }
      buildIncidentsTable(years);
      buildTrendChart(years);
  
      // Load the sidebar with other locations
      if (data.ein) {
        loadOtherLocationsSidebar(data.ein, data.establishment_id);
      }
      
      // Show UI
      loadEl.classList.add('hidden');
      profileEl.classList.remove('hidden');
  
    } catch (e) {
      loadEl.classList.add('hidden');
      errorEl.textContent = e.message || 'Error loading location data.';
      errorEl.classList.remove('hidden');
    }
  });
  
  
  /* ---------------- Sidebar (Other Locations) ---------------- */
  const sidebarCache = new Map();
  
  /**
   * Loads other locations from the same company into the sidebar.
   * @param {string} ein - The company's Employer Identification Number.
   * @param {string} currentEstablishmentId - The ID of the location to exclude.
   */
  async function loadOtherLocationsSidebar(ein, currentEstablishmentId) {
    const sidebar = document.getElementById('establishmentSidebarList');
    if (!sidebar) return;
  
    sidebar.innerHTML = `<li class="text-gray-400 text-sm italic">Loading...</li>`;
  
    const viewAllBtn = document.getElementById('viewAllLocationsBtn');
    if (viewAllBtn) {
      viewAllBtn.href = `/locationsAll?ein=${encodeURIComponent(ein)}`;
    }
  
    try {
      let locations;
      if (sidebarCache.has(ein)) {
        locations = sidebarCache.get(ein);
      } else {
        // CORRECTED: Use the singular '/api/location' endpoint
        const res = await fetch(
          `/api/location?ein=${encodeURIComponent(ein)}&limit=9&latest=1`
        );
        if (!res.ok) throw new Error('Sidebar API error');
        
        locations = await res.json();
        sidebarCache.set(ein, locations);
      }
  
      const otherLocations = locations
        .filter(loc => loc.establishment_id !== currentEstablishmentId)
        .slice(0, 8);
  
      if (otherLocations.length === 0) {
        sidebar.innerHTML = `<li class="text-gray-400 text-sm italic">No other locations found.</li>`;
        return;
      }
  
      sidebar.innerHTML = otherLocations
        .map(loc => `
          <li class="bg-gray-50 rounded-lg border px-4 py-3 flex flex-col space-y-1">
            <div class="font-semibold text-gray-900 text-base">${loc.establishment_name || 'N/A'}</div>
            <div class="text-xs text-gray-500">${loc.city || ''}${loc.state ? ', ' + loc.state : ''}</div>
            <div class="text-xs text-gray-500">Employees: ${loc.annual_average_employees != null ? fmtNum(loc.annual_average_employees) : '—'}</div>
            <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
              <span class="text-xs text-gray-700">Score: <span class="font-bold text-blue-700">${fmtNum(loc.safety_score)}</span></span>
              <span class="text-xs text-gray-700">DART: ${fmtNum(loc.dart_rate)}</span>
              <span class="text-xs text-gray-700">TRIR: ${fmtNum(loc.trir)}</span>
            </div>
            <a href="/location?id=${encodeURIComponent(loc.establishment_id || '')}" class="text-blue-600 text-xs font-medium hover:underline mt-2">
              Details →
            </a>
          </li>
        `).join('');
  
    } catch (e) {
      sidebar.innerHTML = `<li class="text-red-400 text-sm italic">Failed to load other locations.</li>`;
      console.error("Sidebar load error:", e);
    }
  }
  
  
  /* ---------------- UI Builders (Re-usable) ---------------- */
  function buildIncidentSummary(m) {
    const summaryEl = document.getElementById('incidentSummary');
    if (!summaryEl || !m) return;
    summaryEl.innerHTML = `
      <div class="text-center">
        <div class="text-2xl font-bold text-red-600">${fmtNum(m.total_deaths)}</div>
        <div class="text-xs text-gray-600">Total Deaths</div>
      </div>
      <div class="text-center">
        <div class="text-2xl font-bold text-yellow-600">${fmtNum(m.total_dafw_cases)}</div>
        <div class="text-xs text-gray-600">DAFW Cases</div>
      </div>
      <div class="text-center">
        <div class="text-2xl font-bold text-orange-500">${fmtNum(m.total_djtr_cases)}</div>
        <div class="text-xs text-gray-600">DJTR Cases</div>
      </div>
      <div class="text-center">
        <div class="text-2xl font-bold text-gray-800">${fmtNum(m.total_other_cases)}</div>
        <div class="text-xs text-gray-600">Other Cases</div>
      </div>
    `;
  }
  
  function buildRatesSummary(m) {
    const ratesEl = document.getElementById('ratesSummary');
    if (!ratesEl || !m) return;
    ratesEl.innerHTML = `
      <div class="flex-1 min-w-[160px] bg-gray-50 p-4 rounded text-center">
        <div class="text-sm text-gray-600 mb-1">DART Rate</div>
        <div class="font-semibold text-lg text-blue-700">${fmtNum(m.dart_rate)}</div>
      </div>
      <div class="flex-1 min-w-[160px] bg-gray-50 p-4 rounded text-center">
        <div class="text-sm text-gray-600 mb-1">TRIR</div>
        <div class="font-semibold text-lg text-blue-700">${fmtNum(m.trir)}</div>
      </div>
      <div class="flex-1 min-w-[160px] bg-gray-50 p-4 rounded text-center">
        <div class="text-sm text-gray-600 mb-1">Severity Rate</div>
        <div class="font-semibold text-lg text-blue-700">${fmtNum(m.severity_rate)}</div>
      </div>
    `;
  }
  
  function buildIncidentsTable(years) {
    const tableBody = document.getElementById('incidentsTable');
    if (!tableBody || !years) return;
    tableBody.innerHTML = years.map(y => `
      <tr>
        <td class="px-4 py-2 text-gray-900">${y.year_filing_for || '—'}</td>
        <td class="px-4 py-2 text-gray-700">${fmtNum(y.total_deaths)}</td>
        <td class="px-4 py-2 text-gray-700">${fmtNum(y.total_dafw_cases)}</td>
        <td class="px-4 py-2 text-gray-700">${fmtNum(y.total_djtr_cases)}</td>
        <td class="px-4 py-2 text-gray-700">${fmtNum(y.total_other_cases)}</td>
        <td class="px-4 py-2 text-gray-700">${fmtNum(y.dart_rate)}</td>
        <td class="px-4 py-2 text-gray-700">${fmtNum(y.trir)}</td>
        <td class="px-4 py-2 text-gray-700">${fmtNum(y.severity_rate)}</td>
        <td class="px-4 py-2 text-gray-700">${typeof y.safety_score === 'number' ? Math.round(y.safety_score) : '—'}</td>
      </tr>
    `).join('');
  }
  
  let trendChartInstance;
  
  function buildTrendChart(years) {
    const ctx = document.getElementById('trendChart')?.getContext('2d');
    if (!ctx || !years || years.length === 0) return;
  
    const yearsSorted = [...years].sort((a, b) => a.year_filing_for - b.year_filing_for);
    const labels = yearsSorted.map(r => r.year_filing_for);
    const trends = {
      trir: yearsSorted.map(r => r.trir),
      dart_rate: yearsSorted.map(r => r.dart_rate),
      severity_rate: yearsSorted.map(r => r.severity_rate),
    };
    const trendNames = { trir: 'TRIR', dart_rate: 'DART Rate', severity_rate: 'Severity Rate' };
    const trendColors = { trir: '#16a34a', dart_rate: '#2563eb', severity_rate: '#f59e42' };
  
    let currentTrend = 'trir';
  
    if (trendChartInstance) {
      trendChartInstance.destroy();
    }
  
    trendChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: trendNames[currentTrend],
          data: trends[currentTrend],
          borderColor: trendColors[currentTrend],
          tension: 0.3,
          fill: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
        scales: {
          x: { title: { display: true, text: 'Year' } },
          y: { title: { display: true, text: trendNames[currentTrend] }, beginAtZero: true }
        }
      }
    });
  
    document.querySelectorAll('.trend-btn').forEach(btn => {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
  
      if (newBtn.dataset.trend === currentTrend) {
        newBtn.classList.add('bg-blue-600', 'text-white');
        newBtn.classList.remove('bg-gray-200', 'text-gray-800');
      } else {
        newBtn.classList.add('bg-gray-200', 'text-gray-800');
        newBtn.classList.remove('bg-blue-600', 'text-white');
      }
  
      newBtn.addEventListener('click', function() {
        const trendKey = this.dataset.trend;
        if (!trends[trendKey] || trendKey === currentTrend) return;
        currentTrend = trendKey;
  
        document.querySelectorAll('.trend-btn').forEach(b => {
          b.classList.remove('bg-blue-600', 'text-white');
          b.classList.add('bg-gray-200', 'text-gray-800');
        });
        this.classList.remove('bg-gray-200', 'text-gray-800');
        this.classList.add('bg-blue-600', 'text-white');
  
        trendChartInstance.data.datasets[0].data = trends[trendKey];
        trendChartInstance.data.datasets[0].label = trendNames[trendKey];
        trendChartInstance.data.datasets[0].borderColor = trendColors[trendKey];
        trendChartInstance.options.scales.y.title.text = trendNames[trendKey];
        trendChartInstance.update();
      });
    });
  }
  
  /* ---------------- Helpers ---------------- */
  function fmtNum(v) {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'number') return Number.isInteger(v) ? v : v.toFixed(2);
    return v;
  }