// company.js

function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

document.addEventListener('DOMContentLoaded', async () => {
    const ein = getQueryParam('ein');
    const loadingDiv = document.getElementById('companyLoading');
    const profileDiv = document.getElementById('companyProfile');
    const errorDiv = document.getElementById('companyError');

    if (!ein) {
        loadingDiv.classList.add('hidden');
        errorDiv.textContent = 'No company EIN specified in the URL.';
        errorDiv.classList.remove('hidden');
        return;
    }

    try {
        const data = await fetchCompany(ein);

        // Top info
        document.getElementById('companyName').textContent = data.company_name || 'N/A';
        document.getElementById('industryDescription').textContent = data.industry_description || 'Industry not specified';
        document.getElementById('totalEmployees').textContent =
            data.total_employees != null ? Number(data.total_employees).toLocaleString() : 'N/A';
        document.getElementById('numEstablishments').textContent = data.num_establishments ?? 'N/A';
        const totalLocations = data.num_establishments;
        loadEstablishmentsSidebar(ein, totalLocations);

        // Safety Score badge
        const safetyScore = typeof data.safety_score === 'number' ? Math.round(data.safety_score) : null;
        const scoreBadge = document.getElementById('mainSafetyScore');
        const scoreValue = document.getElementById('mainSafetyScoreValue');
        scoreValue.textContent = safetyScore != null ? safetyScore : '—';
        if (scoreBadge) {
            scoreBadge.classList.remove('border-green-500', 'border-yellow-500', 'border-red-500');
            if (safetyScore >= 85) scoreBadge.classList.add('border-green-500');
            else if (safetyScore >= 60) scoreBadge.classList.add('border-yellow-500');
            else scoreBadge.classList.add('border-red-500');
        }

        // Incident summary (most recent)
        const mostRecent = (data.years && data.years.length > 0) ? data.years[0] : {};
        buildIncidentSummary(mostRecent);
        buildRatesSummary(mostRecent);
        buildIncidentsTable(data.years || []);

        buildTrendChart(data.years || []);

        // Show UI
        loadingDiv.classList.add('hidden');
        profileDiv.classList.remove('hidden');
        errorDiv.classList.add('hidden');
    } catch (err) {
        loadingDiv.classList.add('hidden');
        errorDiv.textContent = err.message || 'Error loading company data.';
        errorDiv.classList.remove('hidden');
    }

    // View all locations button
    document.getElementById('viewAllLocationsBtn')?.addEventListener('click', function(e) {
        e.preventDefault();
        const einParam = getQueryParam('ein'); // ensure scope
        window.location.href = `/locationsAll?ein=${encodeURIComponent(einParam)}`;
    });
});

/* ---------------- Company Fetch ---------------- */
async function fetchCompany(ein) {
    const url = `/api/company?ein=${encodeURIComponent(ein)}`;
    const response = await fetch(url);
    let payload = null;
    try { payload = await response.json(); } catch { /* ignore */ }
    if (!response.ok) {
        const msg = payload && payload.error ? payload.error : `API error (${response.status})`;
        throw new Error(msg);
    }
    return payload;
}

/* ---------------- Sidebar (Locations) ---------------- */
const sidebarCache = new Map(); // key: ein -> array

/**
 * @param {string} ein
 * @param {number} totalCount — total number of locations for this EIN
 */
async function loadEstablishmentsSidebar(ein, totalCount) {
  const sidebar = document.getElementById('establishmentSidebarList');
  if (!sidebar) return;

  // show loading state
  sidebar.innerHTML = `<li class="text-gray-400 text-sm italic">Loading...</li>`;

  try {
    // fetch up to 3 latest locations
    let locations;
    if (sidebarCache.has(ein)) {
      locations = sidebarCache.get(ein);
    } else {
      const res = await fetch(
        `/api/location?ein=${encodeURIComponent(ein)}&limit=8&latest=1`
      );
      if (!res.ok) throw new Error('Sidebar API error');
      locations = await res.json();
      sidebarCache.set(ein, locations);
    }

    // no results
    if (!locations || locations.length === 0) {
      sidebar.innerHTML = `<li class="text-gray-400 text-sm italic">No locations found</li>`;
      return;
    }

    // render the 3 items
    sidebar.innerHTML = locations
      .map(loc => `
        <li class="bg-gray-50 rounded-lg border px-4 py-3 flex flex-col space-y-1">
          <div class="font-semibold text-gray-900 text-base">
            ${loc.establishment_name || 'N/A'}
          </div>
        <div class="text-xs text-gray-500">
        ${loc.city || ''}${loc.state ? ', ' + loc.state : ''}
        </div>
        <div class="text-xs text-gray-500">
        Employees: ${loc.annual_average_employees != null ? fmtNum(loc.annual_average_employees) : '—'}
        </div>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
            <span class="text-xs text-gray-700">
              Score: <span class="font-bold text-blue-700">${fmtNum(loc.safety_score)}</span>
            </span>
            <span class="text-xs text-gray-700">DART: ${fmtNum(loc.dart_rate)}</span>
            <span class="text-xs text-gray-700">TRIR: ${fmtNum(loc.trir)}</span>
          </div>
          <a
            href="/location?id=${encodeURIComponent(loc.establishment_id || '')}"
            class="text-blue-600 text-xs font-medium hover:underline mt-2"
          >
            Details &rarr;
          </a>
        </li>
      `)
      .join('');

    // add the "Showing X of Y" line if there are more
    if (totalCount > locations.length) {
      sidebar.insertAdjacentHTML(
        'beforeend',
        `
        <li class="text-center text-sm text-gray-600 mt-2">
          Showing ${locations.length} of ${totalCount} locations.
          <a
            href="/locations?ein=${encodeURIComponent(ein)}"
            class="underline text-blue-600 ml-1"
          >
            View all
          </a>
        </li>
      `
      );
    }
  } catch (e) {
    sidebar.innerHTML = `<li class="text-red-400 text-sm italic">Failed to load locations</li>`;
  }
}

/* ---------------- UI Builders ---------------- */
function buildIncidentSummary(m) {
    document.getElementById('incidentSummary').innerHTML = `
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
    document.getElementById('ratesSummary').innerHTML = `
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
    document.getElementById('incidentsTable').innerHTML = years.map(y => `
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

function buildTrendChart(years) {
    if (!years.length) return;
    const yearsSorted = years.slice().sort((a, b) => a.year_filing_for - b.year_filing_for);
    const labels = yearsSorted.map(r => r.year_filing_for);
    const trends = {
        trir: yearsSorted.map(r => r.trir),
        dart_rate: yearsSorted.map(r => r.dart_rate),
        severity_rate: yearsSorted.map(r => r.severity_rate),
    };
    const trendNames = { trir: 'TRIR', dart_rate: 'DART Rate', severity_rate: 'Severity Rate' };
    const trendColors = { trir: '#16a34a', dart_rate: '#2563eb', severity_rate: '#f59e42' };

    let current = 'trir';
    const ctx = document.getElementById('trendChart').getContext('2d');
    const chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: trendNames[current],
                data: trends[current],
                borderColor: trendColors[current],
                backgroundColor: 'rgba(0,0,0,0.08)',
                tension: 0.3,
                fill: false
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                x: { title: { display: true, text: 'Year' } },
                y: { title: { display: true, text: trendNames[current] }, beginAtZero: true }
            }
        }
    });

    document.querySelectorAll('.trend-btn').forEach(btn => {
        if (btn.dataset.trend === 'trir') {
            btn.classList.remove('bg-gray-200', 'text-gray-800');
            btn.classList.add('bg-blue-600', 'text-white');
        } else {
            btn.classList.remove('bg-blue-600', 'text-white');
            btn.classList.add('bg-gray-200', 'text-gray-800');
        }

        btn.addEventListener('click', function() {
            const trendKey = this.dataset.trend;
            if (!trends[trendKey]) return;

            document.querySelectorAll('.trend-btn').forEach(b => {
                b.classList.remove('bg-blue-600', 'text-white');
                b.classList.add('bg-gray-200', 'text-gray-800');
            });
            this.classList.remove('bg-gray-200', 'text-gray-800');
            this.classList.add('bg-blue-600', 'text-white');

            chartInstance.data.datasets[0].data = trends[trendKey];
            chartInstance.data.datasets[0].label = trendNames[trendKey];
            chartInstance.data.datasets[0].borderColor = trendColors[trendKey];
            chartInstance.options.scales.y.title.text = trendNames[trendKey];
            chartInstance.update();
            current = trendKey;
        });
    });
}

/* ---------------- Helpers ---------------- */
function fmtNum(v) {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'number') return Number.isInteger(v) ? v : v.toFixed(2);
    return v;
}