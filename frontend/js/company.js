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
    // Back button behavior
const backLink = document.getElementById('backToResults');
if (backLink) {
  const stored = sessionStorage.getItem('lastSearchUrl');
  const fromSearch =
    document.referrer && /\/search/i.test(new URL(document.referrer).pathname);

  // Prefer the stored URL, then referrer, then default /search
  const target = stored || (fromSearch ? document.referrer : '/search');
  backLink.setAttribute('href', target);

  backLink.addEventListener('click', (e) => {
    // If we have real history to go back to, use it (keeps scroll pos, etc.)
    if (fromSearch && window.history.length > 1) {
      e.preventDefault();
      window.history.back();
    }
  });
}

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
            href="/locationsAll?ein=${encodeURIComponent(ein)}"
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
  
    // 1) Sort ascending by year
    const sorted = years.slice().sort((a, b) => a.year_filing_for - b.year_filing_for);
  
    // 2) Labels (the X-axis)
    const labels = sorted.map(r => r.year_filing_for);
  
    // 3) Build two series per metric
    const trends = {
      trir: {
        company:  sorted.map(r => r.trir),
        industry: sorted.map(r => r.industry_trir)
      },
      dart_rate: {
        company:  sorted.map(r => r.dart_rate),
        industry: sorted.map(r => r.industry_dart_rate)
      },
      severity_rate: {
        company:  sorted.map(r => r.severity_rate),
        industry: null   // we’ll skip industry for severity
      }
    };
  
    // 4) Friendly labels + colors
    const names = { trir: 'TRIR', dart_rate: 'DART Rate', severity_rate: 'Severity Rate' };
    const colors = {
      trir:          { company: '#16a34a', industry: '#a7f3d0' },
      dart_rate:     { company: '#2563eb', industry: '#bfdbfe' },
      severity_rate: { company: '#f59e42', industry: null }
    };
  
    // 5) Chart.js setup
    const ctx = document.getElementById('trendChart').getContext('2d');
    let current = 'trir';  // default metric
  
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          // company line
          {
            label: `Company ${names[current]}`,
            data: trends[current].company,
            borderColor: colors[current].company,
            backgroundColor: 'rgba(0,0,0,0.05)',
            tension: 0.3,
            fill: false
          },
          // industry line (dashed)
          ...(trends[current].industry
            ? [{
                label: `Industry ${names[current]}`,
                data: trends[current].industry,
                borderColor: colors[current].industry,
                borderDash: [5,5],
                tension: 0.3,
                fill: false
              }]
            : [])
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: {
          x: { title: { display: true, text: 'Year' } },
          y: { title: { display: true, text: names[current] }, beginAtZero: true }
        }
      }
    });
  
    // 6) Wire up your buttons to switch metric
    document.querySelectorAll('.trend-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const metric = btn.dataset.trend;  // e.g. 'dart_rate'
        if (!trends[metric]) return;
  
        // update button styles
        document.querySelectorAll('.trend-btn')
          .forEach(b => b.classList.replace('bg-blue-600','bg-gray-200') & b.classList.replace('text-white','text-gray-800'));
        btn.classList.replace('bg-gray-200','bg-blue-600');
        btn.classList.replace('text-gray-800','text-white');
  
        // update chart data & labels
        const ds = [
          {
            label: `Company ${names[metric]}`,
            data: trends[metric].company,
            borderColor: colors[metric].company
          },
          ...(trends[metric].industry
            ? [{
                label: `Industry ${names[metric]}`,
                data: trends[metric].industry,
                borderColor: colors[metric].industry,
                borderDash: [5,5]
              }]
            : [])
        ];
  
        chart.data.labels = labels;
        chart.data.datasets = ds;
        chart.options.scales.y.title.text = names[metric];
        chart.update();
  
        current = metric;
      });
    });
  }

/* ---------------- Helpers ---------------- */
function fmtNum(v) {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'number') return Number.isInteger(v) ? v : v.toFixed(2);
    return v;
}

function augmentWith2024Estimate(years) {
    const sorted = [...years].sort((a, b) => a.year_filing_for - b.year_filing_for);
  
    // collect year-over-year % changes
    const trirDeltas = [];
    const dartDeltas = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1], curr = sorted[i];
      if (prev.industry_trir != null && curr.industry_trir != null) {
        trirDeltas.push((curr.industry_trir - prev.industry_trir) / prev.industry_trir);
      }
      if (prev.industry_dart_rate != null && curr.industry_dart_rate != null) {
        dartDeltas.push((curr.industry_dart_rate - prev.industry_dart_rate) / prev.industry_dart_rate);
      }
    }
  
    // if we have any deltas, compute the mean
    if (trirDeltas.length && dartDeltas.length) {
      const avgTrirDelta = trirDeltas.reduce((sum, d) => sum + d, 0) / trirDeltas.length;
      const avgDartDelta = dartDeltas.reduce((sum, d) => sum + d, 0) / dartDeltas.length;
      const last = sorted[sorted.length - 1];
  
      // only add an estimate if the latest year lacks industry rates
      if (last.industry_trir == null || last.industry_dart_rate == null) {
        years.push({
          ...last,
          year_filing_for:    last.year_filing_for + 1,
          industry_trir:      last.industry_trir      * (1 + avgTrirDelta),
          industry_dart_rate: last.industry_dart_rate * (1 + avgDartDelta),
          is_estimate: true
        });
      }
    }
    return years;
  }