// search.js - Handles search functionality for the company database
document.addEventListener('DOMContentLoaded', () => {
  /* ---------- DOM refs ---------- */
  const searchInput            = document.getElementById('searchInput');
  const resultsContainer       = document.getElementById('resultsContainer');
  const searchTermDisplay      = document.getElementById('searchTermDisplay');
  const resultsCountDisplay    = document.getElementById('resultsCount');
  const clearFiltersButton     = document.getElementById('clearFiltersButton');

  const filterInputs           = document.querySelectorAll('.filter-input, .filter-checkbox');
  const sortButtons            = document.querySelectorAll('.sort-button');
  const collapsibleTriggers    = document.querySelectorAll('.collapsible-trigger');
  const filterToggleBtn = document.getElementById('filterToggleBtn');
const filterPanel    = document.getElementById('filterPanel');
const mobileFilterCount  = document.getElementById('mobileFilterCount');
const mobileClearFilters = document.getElementById('mobileClearFilters');

  /* ---------- Constants ---------- */
  const API_ENDPOINT    = '/api/search';
  const resultsPerPage  = 20;            // matches API default limit
  const urlParams       = new URLSearchParams(window.location.search);

  /* ---------- State ---------- */
  let debounceTimer;
  let currentSortBy     = 'relevance';
  let currentPage       = 0;
  let suppressSearch = false;

  /* ---------- Helpers ---------- */
  function hasActiveCriteria(filters) {
    if (filters.term) return true;

    const otherKeys = ['industry', 'employeesMin', 'employeesMax', 'state', 'zip', 'safetyMin', 'safetyMax'];
    for (const k of otherKeys) {
      if (filters[k]) return true;
    }
    // User unchecked "Most Recent Year" (default = true)
    if (filters.mostRecentYear === false) return true;

    return false;
  }

  function getActiveFilters() {
    const f = {};
    f.term = searchInput.value.trim();

    const industry = document.getElementById('filterIndustry').value;
    if (industry) f.industry = industry;

    const empMin = document.getElementById('filterEmployeesMin').value;
    if (empMin) f.employeesMin = empMin;

    const empMax = document.getElementById('filterEmployeesMax').value;
    if (empMax) f.employeesMax = empMax;

    const state = document.getElementById('filterState').value;
    if (state) f.state = state;

    const zip = document.getElementById('filterZip').value;
    if (zip) f.zip = zip;

    const safetyMin = document.getElementById('filterSafetyMin').value;
    if (safetyMin) f.safetyMin = safetyMin;
const safetyMax = document.getElementById('filterSafetyMax').value;
if (safetyMax) f.safetyMax = safetyMax;

    f.mostRecentYear = document.getElementById('filterMostRecentYear').checked;

    updateClearButtonCount();
    return f;
  }

  function updateClearButtonCount() {
    let cnt = 0;
    if (searchInput.value.trim()) cnt++;

    document.querySelectorAll('.filter-input').forEach(input => {
      if (input.type === 'checkbox') {
        if (input.checked && input.id !== 'filterMostRecentYear') cnt++;
      } else if (input.value) cnt++;
    });
    if (!document.getElementById('filterMostRecentYear').checked) cnt++;

  }

  function resetUI() {
    resultsContainer.innerHTML =
      '<p class="text-gray-500 text-center">Enter a search term or apply filters to see results.</p>';
    resultsCountDisplay.textContent = '0';
    searchTermDisplay.textContent = '';
    currentPage = 0;
  }

  /* ---------- Core search ---------- */
  async function performSearch(page = 0) {
    currentPage = page;
    const active = getActiveFilters();

    /* If nothing to search/filter, clear results and stop */
    if (!hasActiveCriteria(active)) {
      resultsContainer.innerHTML =
        '<p class="text-gray-500 text-center">Enter a search term or apply filters to see results.</p>';
      resultsCountDisplay.textContent = '0';
      return;
    }

    const params = new URLSearchParams();
    for (const k in active) {
      if (active[k] !== '' && active[k] !== null && active[k] !== false) {
        params.append(k, active[k]);
      }
    }
    params.append('sortBy', currentSortBy);
    params.append('limit', resultsPerPage);
    params.append('offset', page * resultsPerPage);

    searchTermDisplay.textContent = active.term || 'all records';
    resultsContainer.innerHTML = '<div class="loading-spinner"></div>';
    resultsCountDisplay.textContent = '...';

    try {
      const res   = await fetch(`${API_ENDPOINT}?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP error ${res.status}`);
      }
      const data       = await res.json();
      const totalCount = res.headers.get('X-Total-Count') || data.length;
      displayResults(data, parseInt(totalCount, 10), active.term);
    } catch (err) {
      resultsContainer.innerHTML =
        `<p class="text-red-500 text-center">Error: ${err.message}</p>`;
      resultsCountDisplay.textContent = '0';
    }
  }

  /* ---------- Result rendering ---------- */
  function createCompanyCard(c) {
    const score = typeof c.safety_score === 'number' ? Math.max(0, Math.min(100, Math.round(c.safety_score))) : 0;
    const badgeClass =
      score > 85 ? 'border-green-500 text-green-600'
    : score > 60 ? 'border-yellow-500 text-yellow-600'
    : 'border-red-500 text-red-600';

    return `
      <a href="company?ein=${encodeURIComponent(c.ein)}" class="block hover:bg-blue-50 transition rounded-lg">
        <article class="bg-white p-4 sm:p-6 rounded-lg shadow border border-gray-200">
          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between">
            <div class="flex items-start space-x-4 mb-4 sm:mb-0 flex-1">
              <div class="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0 rounded logo-na flex items-center justify-center text-sm font-medium">
                N/A
              </div>
              <div>
                <h3 class="text-base sm:text-lg font-semibold text-gray-900">
                  ${c.company_name || c.establishment_name || 'N/A Company'}
                </h3>
                <p class="text-xs sm:text-sm text-gray-600 mt-1">${c.industry_description || 'Industry not specified'}</p>
                <p class="text-xs sm:text-sm text-gray-500 mt-1">
                  Filing Year: ${c.year_filing_for || 'N/A'} |
                  Locations: ${c.num_establishments != null ? c.num_establishments.toLocaleString() : 'N/A'} |
                  Employees: ${c.total_employees != null ? c.total_employees.toLocaleString() : 'N/A'}
                </p>
              </div>
            </div>
            <div class="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-full border-4 ${badgeClass} flex items-center justify-center ml-0 sm:ml-4">
              <span class="font-bold text-xl sm:text-2xl">${score}</span>
            </div>
          </div>
        </article>
      </a>
    `;
  }

  function getPaginationButtons(current, total) {
    const delta = 2;
    const range = [];
    for (let i = Math.max(0, current - delta); i <= Math.min(total - 1, current + delta); i++) {
      range.push(i);
    }
    if (range[0] > 0) {
      if (range[0] > 1) range.unshift('…');
      range.unshift(0);
    }
    if (range[range.length - 1] < total - 1) {
      if (range[range.length - 1] < total - 2) range.push('…');
      range.push(total - 1);
    }
    return range;
  }

  function displayResults(list, totalCount, term) {
    resultsContainer.innerHTML = '';
    resultsCountDisplay.textContent = totalCount;

    if (list && list.length) {
      list.forEach(c => resultsContainer.insertAdjacentHTML('beforeend', createCompanyCard(c)));
    } else {
      const msg = term || Object.values(getActiveFilters()).some(v => v) ?
        'No companies found matching your criteria.' :
        'Enter a search term or apply filters to see results.';
      resultsContainer.innerHTML = `<p class="text-gray-500 text-center">${msg}</p>`;
    }

    if (totalCount > resultsPerPage) {
      const totalPages = Math.ceil(totalCount / resultsPerPage);
      let html = '<div class="pagination-scroll mt-6 flex justify-center space-x-2">';
      getPaginationButtons(currentPage, totalPages).forEach(p => {
        html += p === '…'
          ? `<span class="px-3 py-1 text-gray-400">…</span>`
          : `<button data-page="${p}" class="px-3 py-1 border rounded ${p === currentPage ? 'bg-blue-500 text-white' : 'bg-white'}">${p + 1}</button>`;
      });
      html += '</div>';
      resultsContainer.insertAdjacentHTML('beforeend', html);
      document.querySelectorAll('#resultsContainer button[data-page]').forEach(btn =>
        btn.addEventListener('click', e => performSearch(parseInt(e.target.dataset.page, 10)))
      );
    }
  }

  /* ---------- Dropdown population ---------- */
  async function fetchInitialFilterData() {
    try {
      const resp = await fetch(`${API_ENDPOINT}?limit=500&select=sector,state`);
      if (!resp.ok) throw new Error('Failed to fetch filter options');
      const data = await resp.json();
      populateFilterDropdowns(data);
    } catch (err) {
      console.error('Error fetching initial filter data:', err);
    }
  }

  function populateFilterDropdowns(data) {
    const sectorSel = document.getElementById('filterIndustry');
    const stateSel  = document.getElementById('filterState');

    [...new Set(data.map(d => d.sector).filter(Boolean))].sort().forEach(sec => {
      const opt = document.createElement('option');
      opt.value = sec; opt.textContent = sec;
      sectorSel.appendChild(opt);
    });
    [...new Set(data.map(d => d.state).filter(Boolean))].sort().forEach(st => {
      const opt = document.createElement('option');
      opt.value = st; opt.textContent = st;
      stateSel.appendChild(opt);
    });
  }

  /* ---------- Listeners ---------- */
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
  
    const val = searchInput.value.trim();
    const f   = getActiveFilters();
    const otherActive = !!(
      f.industry || f.employeesMin || f.employeesMax ||
      f.state || f.zip || f.safetyMin || f.safetyMax ||
      f.mostRecentYear === false
    );
  
    if (!val && !otherActive) {
      resetUI();
      return;
    }
  
    debounceTimer = setTimeout(() => performSearch(0), 500);
  });

  filterInputs.forEach(inp => {
    inp.addEventListener('change', () => {
      if (suppressSearch) return;
      if (inp.id === 'filterMostRecentYear') {
        const f = getActiveFilters();    
        const otherActive = !!(
          f.term ||
          f.industry || f.employeesMin || f.employeesMax ||
          f.state   || f.zip ||
          f.safetyMin || f.safetyMax
        );
        if (!otherActive) return;           
      }
  
      performSearch(0);
    });
  
    if (inp.type === 'text' || inp.type === 'number') {
      inp.addEventListener('input', () => {
        if (suppressSearch) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => performSearch(0), 700);
      });
    }
  });

  sortButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      sortButtons.forEach(b => b.classList.remove('bg-blue-600', 'text-white', 'bg-gray-200', 'text-gray-700', 'hover:bg-gray-300'));
      btn.classList.add('bg-blue-600', 'text-white');
      currentSortBy = btn.dataset.sort;
      performSearch(0);
    });
  });

  collapsibleTriggers.forEach(trg => {
    const contentId = trg.id.replace('Toggle', 'Content');
    const arrowId   = trg.id.replace('Toggle', 'Arrow');
    const content   = document.getElementById(contentId);
    const arrow     = document.getElementById(arrowId);
    const openInit  = trg.id === 'companyInfoToggle' || trg.id === 'locationToggle' || trg.id === 'safetyToggle';
    if (content) content.classList.toggle('hidden', !openInit);
    if (arrow)   arrow.classList.toggle('rotate-180', openInit);

    trg.addEventListener('click', () => {
      if (content) content.classList.toggle('hidden');
      if (arrow)   arrow.classList.toggle('rotate-180');
    });
  });

  clearFiltersButton.addEventListener('click', () => {
    suppressSearch = true;
  
    searchInput.value = '';
    document.querySelectorAll('.filter-input').forEach(inp => {
      if (inp.type === 'checkbox') {
        inp.checked = (inp.id === 'filterMostRecentYear');
      } else {
        inp.value = '';
      }
    });
  
    updateClearButtonCount();
    resetUI();          // <— here
  
    suppressSearch = false;
  });

// Mobile filter toggle
if (filterToggleBtn && filtersPanel) {
    filterToggleBtn.addEventListener('click', () => {
      const isHidden = filtersPanel.classList.toggle('hidden');
      if (!isHidden) {
        filterPanel.classList.add('block'); 
      } else {
        filterPanel.classList.remove('block');
      }
      filterToggleBtn.setAttribute('aria-expanded', String(!isHidden));
    });
  }

  /* ---------- Init ---------- */
  fetchInitialFilterData();
  updateClearButtonCount();

  const urlTerm = urlParams.get('term');
  if (urlTerm) {
    searchInput.value = urlTerm.trim();
    performSearch(0);
  }
});