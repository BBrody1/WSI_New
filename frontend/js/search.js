
document.addEventListener('DOMContentLoaded', () => {
  /* ---------- DOM refs ---------- */
  const searchInput = document.getElementById('searchInput');
  const resultsContainer = document.getElementById('resultsContainer');
  const searchTermDisplay = document.getElementById('searchTermDisplay');
  const resultsCountDisplay = document.getElementById('resultsCount');
  const sortButtons = document.querySelectorAll('.sort-button');
  const sidebarContainer = document.getElementById('sidebar-container');

  /* ---------- Constants ---------- */
  const API_ENDPOINT = '/api/search';
  const resultsPerPage = 10;
  const urlParams = new URLSearchParams(window.location.search);

  /* ---------- State ---------- */
  let debounceTimer;
  let currentSortBy = 'relevance';
  let currentPage = 0;
  let currentFilters = {};

  /* ---------- Helpers ---------- */
  function hasActiveCriteria(filters) {
      if (filters.term) return true;
      if ((filters.industry || []).length) return true;
      const otherKeys = ['employeesMin', 'employeesMax', 'state', 'zip', 'safetyMin', 'safetyMax'];
      for (const k of otherKeys) {
          if (filters[k]) return true;
      }
      if (filters.mostRecentYear === false) return true;
      return false;
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

      if (!hasActiveCriteria(currentFilters)) {
          resetUI();
          return;
      }

      const params = new URLSearchParams();
      for (const k in currentFilters) {
          const v = currentFilters[k];
          if (v !== '' && v != null && v !== false) {
              if (k === 'industry' && Array.isArray(v)) {
                  v.forEach(code => params.append('industry', code));
              } else {
                  params.append(k, v);
              }
          }
      }
      params.append('sortBy', currentSortBy);
      params.append('limit', resultsPerPage);
      params.append('offset', page * resultsPerPage);

      searchTermDisplay.textContent = currentFilters.term || 'all records';
      resultsContainer.innerHTML = '<div class="loading-spinner"></div>';
      resultsCountDisplay.textContent = '...';
      // after you build params and before/after the fetch:
sessionStorage.setItem('lastSearchUrl', `${window.location.pathname}?${params.toString()}`);

      try {
          const res = await fetch(`${API_ENDPOINT}?${params.toString()}`);
          if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err.error || `HTTP error ${res.status}`);
          }
          const data = await res.json();
          const totalCount = parseInt(res.headers.get('X-Total-Count') || data.length, 10);
          displayResults(data, totalCount, currentFilters.term);
      } catch (err) {
          resultsContainer.innerHTML =
              `<p class="text-red-500 text-center">Error: ${err.message}</p>`;
          resultsCountDisplay.textContent = '0';
      }
  }

  /* ---------- Result rendering ---------- */
  function createCompanyCard(c) {
      const score = typeof c.safety_score === 'number' ?
          Math.max(0, Math.min(100, Math.round(c.safety_score))) :
          0;
      const badgeClass =
          score > 85 ? 'border-green-500 text-green-600' :
          score > 60 ? 'border-yellow-500 text-yellow-600' :
          'border-red-500 text-red-600';

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
          const msg = term || Object.values(currentFilters).some(v => v) ?
              'No companies found matching your criteria.' :
              'Enter a search term or apply filters to see results.';
          resultsContainer.innerHTML = `<p class="text-gray-500 text-center">${msg}</p>`;
      }

      if (totalCount > resultsPerPage) {
          const totalPages = Math.ceil(totalCount / resultsPerPage);
          let html = '<div class="pagination-scroll mt-6 flex justify-center space-x-2">';
          getPaginationButtons(currentPage, totalPages).forEach(p => {
              html += p === '…' ?
                  `<span class="px-3 py-1 text-gray-400">…</span>` :
                  `<button data-page="${p}" class="px-3 py-1 border rounded ${p === currentPage ? 'bg-blue-500 text-white' : 'bg-white'}">${p + 1}</button>`;
          });
          html += '</div>';
          resultsContainer.insertAdjacentHTML('beforeend', html);
          document.querySelectorAll('#resultsContainer button[data-page]').forEach(btn =>
              btn.addEventListener('click', e => performSearch(parseInt(e.target.dataset.page, 10)))
          );
      }
  }

  /* ---------- Listeners ---------- */
  searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      currentFilters.term = searchInput.value.trim();
      document.dispatchEvent(new CustomEvent('updateFilterCount'));
      debounceTimer = setTimeout(() => performSearch(0), 500);
  });

  sortButtons.forEach(btn => {
      btn.addEventListener('click', () => {
          sortButtons.forEach(b => b.classList.remove(
              'bg-blue-600', 'text-white', 'bg-gray-200', 'text-gray-700', 'hover:bg-gray-300'
          ));
          btn.classList.add('bg-blue-600', 'text-white');
          currentSortBy = btn.dataset.sort;
          performSearch(0);
      });
  });

  // Listen for filter changes from the sidebar
  document.addEventListener('filtersChanged', (e) => {
      currentFilters = e.detail;
      performSearch(0);
  });

  /* ---------- Init ---------- */
  async function initialize() {
      // Load the sidebar HTML
      try {
          const response = await fetch('frontend/components/sidebar.html');
          const sidebarHtml = await response.text();
          if (sidebarContainer) {
              sidebarContainer.innerHTML = sidebarHtml;
              // Let the sidebar script know it can initialize
              document.dispatchEvent(new CustomEvent('sidebarReady'));
          }
      } catch (error) {
          console.error('Error loading sidebar:', error);
      }


      const urlTerm = urlParams.get('term');
      if (urlTerm) {
          searchInput.value = urlTerm.trim();
          currentFilters.term = urlTerm.trim();
      }
      // Initial search if there's a term in the URL
      if (hasActiveCriteria(currentFilters)) {
          performSearch(0);
      }
  }

  initialize();
});