// frontend/js/locationsAll.js
let allLocations = [];
let filteredLocations = [];
let currentSort = { field: null, direction: 'asc' };

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function fmtNum(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return Number.isInteger(v) ? v : v.toFixed(2);
  return v;
}

function createSafetyBadge(score) {
  const safetyScore = typeof score === 'number' ? Math.round(score) : null;
  let borderColor = 'border-gray-300';
  let textColor = 'text-gray-600';

  if (safetyScore !== null) {
    if (safetyScore >= 85) {
      borderColor = 'border-green-500'; textColor = 'text-green-700';
    } else if (safetyScore >= 60) {
      borderColor = 'border-yellow-500'; textColor = 'text-yellow-700';
    } else {
      borderColor = 'border-red-500'; textColor = 'text-red-700';
    }
  }

  return `
    <div class="w-14 h-14 rounded-full border-4 flex items-center justify-center ${borderColor} ${textColor}">
      <span class="font-bold text-lg">${safetyScore !== null ? safetyScore : '—'}</span>
    </div>
  `;
}

function sortLocations(field) {
  if (currentSort.field === field) {
    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    currentSort.field = field;
    currentSort.direction = 'desc';
  }

  document.querySelectorAll('.sort-button').forEach(btn => {
    btn.classList.remove('bg-blue-600', 'text-white');
    btn.classList.add('bg-white', 'text-gray-700');
  });

  const activeButton = document.querySelector(`[data-sort="${field}"]`);
  if (activeButton) {
    activeButton.classList.remove('bg-white', 'text-gray-700');
    activeButton.classList.add('bg-blue-600', 'text-white');
  }

  filteredLocations.sort((a, b) => {
    let aVal, bVal;

    switch (field) {
      case 'name':
        aVal = (a.establishment_name || '').toLowerCase();
        bVal = (b.establishment_name || '').toLowerCase();
        break;
      case 'safety_score':
        aVal = a.safety_score ?? -1;
        bVal = b.safety_score ?? -1;
        break;
      case 'employees':
        aVal = a.annual_average_employees ?? -1;
        bVal = b.annual_average_employees ?? -1;
        break;
      case 'dart_rate':
        aVal = a.dart_rate ?? -1;
        bVal = b.dart_rate ?? -1;
        break;
      case 'trir':
        aVal = a.trir ?? -1;
        bVal = b.trir ?? -1;
        break;
      case 'city':
        aVal = (a.city || '').toLowerCase();
        bVal = (b.city || '').toLowerCase();
        break;
      default:
        return 0;
    }

    if (currentSort.direction === 'asc') {
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    } else {
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    }
  });

  displayLocationCards(filteredLocations, document.getElementById('locationsGrid'));
  updateLocationCount();
}

function filterLocations(searchTerm) {
  if (!searchTerm.trim()) {
    filteredLocations = [...allLocations];
  } else {
    const term = searchTerm.toLowerCase();
    filteredLocations = allLocations.filter(loc =>
      (loc.establishment_name || '').toLowerCase().includes(term) ||
      (loc.city || '').toLowerCase().includes(term) ||
      (loc.state || '').toLowerCase().includes(term)
    );
  }

  if (currentSort.field) {
    sortLocations(currentSort.field);
  } else {
    displayLocationCards(filteredLocations, document.getElementById('locationsGrid'));
    updateLocationCount();
  }
}

function updateLocationCount() {
  const el = document.getElementById('locationCount');
  const total = allLocations.length;
  const filtered = filteredLocations.length;

  if (!el) return;

  el.textContent =
    filtered === total
      ? `${total} location${total !== 1 ? 's' : ''}`
      : `${filtered} of ${total} location${total !== 1 ? 's' : ''}`;
}

function displayLocationCards(locations, gridElement) {
  if (!locations || !gridElement) return;

  gridElement.innerHTML = locations
    .map(loc => `
      <article
        class="bg-white rounded-lg shadow border border-gray-200 p-4 hover:bg-blue-50 transition"
        onclick="window.location.href='/location?id=${encodeURIComponent(loc.establishment_id || '')}'"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1 min-w-0">
            <h3 class="text-base font-semibold text-gray-900 truncate">
              ${loc.establishment_name || 'N/A'}
            </h3>
            <p class="text-xs text-gray-500 mt-1">
              ${loc.city || ''}${loc.state ? ', ' + loc.state : ''}
            </p>
          </div>
          ${createSafetyBadge(loc.safety_score)}
        </div>

        <div class="mt-4 text-sm text-gray-700">
          Employees:
          <span class="font-semibold">${loc.annual_average_employees != null ? fmtNum(loc.annual_average_employees) : '—'}</span>
        </div>

        <div class="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div class="bg-gray-50 rounded p-2 text-center">
            <div class="font-semibold text-gray-900">${fmtNum(loc.dart_rate)}</div>
            <div class="text-xs text-gray-500">DART Rate</div>
          </div>
          <div class="bg-gray-50 rounded p-2 text-center">
          <div class="font-semibold text-gray-900">${fmtNum(loc.trir)}</div>
            <div class="text-xs text-gray-500">TRIR</div>
          </div>
        </div>
      </article>
    `)
    .join('');
}

async function fetchCompany(ein) {
  const url = `/api/company?ein=${encodeURIComponent(ein)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

async function fetchAllLocations(ein) {
  const url = `/api/location?ein=${encodeURIComponent(ein)}&limit=1000&latest=1`;
  const res = await fetch(url);
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error || `API error (${res.status}) while fetching locations.`);
  }
  return res.json();
}

document.addEventListener('DOMContentLoaded', async () => {
  const ein = getQueryParam('ein');
  const loadingDiv = document.getElementById('locationsLoading');
  const errorDiv = document.getElementById('locationsError');
  const noResultsDiv = document.getElementById('noResults');
  const gridDiv = document.getElementById('locationsGrid');
  const companyLink = document.getElementById('companyLink');
  const searchInput = document.getElementById('searchInput');

  if (!ein) {
    loadingDiv.classList.add('hidden');
    errorDiv.querySelector('p').textContent = 'No company EIN was specified in the URL.';
    errorDiv.classList.remove('hidden');
    return;
  }

  // Header fetch
  fetch('/header.html')
    .then(r => r.text())
    .then(html => {
      document.getElementById('siteHeader').innerHTML = html;
      const script = document.createElement('script');
      script.src = 'frontend/js/header.js';
      document.body.appendChild(script);
    });

  try {
    const [companyData, locations] = await Promise.all([
      fetchCompany(ein),
      fetchAllLocations(ein)
    ]);

    if (companyData?.company_name) {
      companyLink.textContent = companyData.company_name;
      companyLink.href = `/company?ein=${encodeURIComponent(ein)}`;
      document.title = `All Locations – ${companyData.company_name} | Work Safety Index`;
    }

    loadingDiv.classList.add('hidden');

    if (!locations?.length) {
      noResultsDiv.classList.remove('hidden');
      return;
    }

    allLocations = locations;
    filteredLocations = [...locations];
    updateLocationCount();
    displayLocationCards(filteredLocations, gridDiv);

    // Sorting
    document.querySelectorAll('.sort-button').forEach(btn => {
      btn.addEventListener('click', () => sortLocations(btn.dataset.sort));
    });

    // Search
    searchInput.addEventListener('input', e => filterLocations(e.target.value));

  } catch (err) {
    loadingDiv.classList.add('hidden');
    errorDiv.querySelector('p').textContent =
      err.message || 'An unexpected error occurred while loading locations.';
    errorDiv.classList.remove('hidden');
  }
});