document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('sidebarReady', () => {
      /* ---------- DOM refs ---------- */
      const clearFiltersButton = document.getElementById('clearFiltersButton');
      const mobileFilterCount = document.getElementById('mobileFilterCount');
      const mobileClearFilters = document.getElementById('mobileClearFilters');
      const filterInputs = document.querySelectorAll('.filter-input, .filter-checkbox');
      const filterToggleBtn = document.getElementById('filterToggleBtn');
      const filterPanel = document.getElementById('filtersPanel');
      const naicsDrillList = document.getElementById('naicsDrillList');
      const naicsChipsContainer = document.getElementById('naicsChipsContainer');
      const naicsBreadcrumb = document.getElementById('naicsBreadcrumb');
      const naicsBackBtn = document.getElementById('naicsBackBtn');
      const naicsCurrentLevel = document.getElementById('naicsCurrentLevel');

      /* ---------- State ---------- */
      let naicsParent = '';
      let naicsOptions = [];
      let naicsChips = [];
      let naicsHierarchy = []; // Track navigation path
      let debounceTimer;
      let suppressSearch = false;
      const naicsDict = {};
      let naicsSearchTerm = '';
      let isNaicsSearching = false;     
      let naicsSearchResults = []; 

      /* ---------- Helpers ---------- */
      function getActiveFilters() {
          const f = {};
          const searchInput = document.getElementById('searchInput');
          f.term = searchInput ? searchInput.value.trim() : '';

          if (naicsChips.length) {
              f.industry = naicsChips.slice();
          }

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
      
        const searchInput = document.getElementById('searchInput');
        if (searchInput && searchInput.value.trim()) cnt++;
      
        document.querySelectorAll('.filter-input, .filter-checkbox').forEach(input => {
          if (input.type === 'checkbox') {
            if (input.checked) cnt++;                 
          } else if (input.value) {
            cnt++;
          }
        });
      
        cnt += naicsChips.length;
      
        clearFiltersButton.innerHTML = `Clear (${cnt})`;
      
        if (mobileFilterCount) {
          mobileFilterCount.textContent = cnt ? `(${cnt})` : '';
          mobileClearFilters.classList.toggle('hidden', cnt === 0);
        }
      }

      function dispatchFilterChange() {
          if (suppressSearch) return;
          const filters = getActiveFilters();
          document.dispatchEvent(new CustomEvent('filtersChanged', { detail: filters }));
      }

      function applyNaicsSearch(list) {
        if (!naicsSearchTerm) return list;
        const q = naicsSearchTerm.toLowerCase();
        return list.filter(o =>
          (o.code && o.code.toLowerCase().includes(q)) ||
          (o.description && o.description.toLowerCase().includes(q))
        );
      }

      /* ---------- NAICS Drill + Chips with improved navigation ---------- */
      async function loadNaicsOptions() {
        const url = `/api/naics${naicsParent ? '?parent=' + naicsParent : ''}`;
        try {
          const resp = await fetch(url);
          naicsOptions = await resp.json();
      
          naicsOptions.forEach(opt => { naicsDict[opt.code] = opt; }); // for chip tooltips
      
          renderNaicsOptions();
          updateBreadcrumb();
        } catch (e) {
          console.error('Error loading NAICS options:', e);
        }
      }

      async function searchNaicsAll(q) {
        try {
          const resp = await fetch(`/api/naics?q=${encodeURIComponent(q)}`);
          naicsSearchResults = await resp.json();
          naicsSearchResults.forEach(opt => { naicsDict[opt.code] = opt; });
          naicsBreadcrumb.classList.add('hidden');
          renderNaicsOptions();
        } catch (e) {
          console.error('Error searching NAICS:', e);
        }
      }

      function updateBreadcrumb() {
        if (isNaicsSearching || naicsHierarchy.length === 0) {
          naicsBreadcrumb.classList.add('hidden');
          return;
        }
        naicsBreadcrumb.classList.remove('hidden');
        const current = naicsHierarchy[naicsHierarchy.length - 1];
        naicsCurrentLevel.textContent =
          current.code === '3' ? current.description : `${current.code} - ${current.description}`;
      }

      function renderNaicsOptions() {
        if (!naicsDrillList) return;
        naicsDrillList.innerHTML = '';
      
        const base = isNaicsSearching ? naicsSearchResults : naicsOptions;
        const list = applyNaicsSearch(base);
      
        if (!list.length) {
          const empty = document.createElement('div');
          empty.className = 'text-xs text-gray-500 px-2 py-1.5';
          empty.textContent = isNaicsSearching ? 'No matches found.' : 'No matches at this level.';
          naicsDrillList.appendChild(empty);
          return;
        }
      
        list.forEach(option => {
          const li = document.createElement('li');
          li.className = 'group text-xs';
      
          const container = document.createElement('div');
          container.className =
            'flex items-center justify-between px-2.5 py-1.5 bg-gray-50 hover:bg-blue-50 ' +
            'rounded-md border border-gray-200 hover:border-blue-200 transition-colors cursor-pointer';
      
          const button = document.createElement('button');
          button.className ='text-left flex-1 min-w-0 font-medium text-gray-900 ' + 'group-hover:text-blue-700 leading-snug whitespace-normal break-words';
      
          const label = option.code === '3' ? option.description : `${option.code} - ${option.description}`;
          button.textContent = label;
      
          button.onclick = () => navigateToNaics(option);
      
          const actions = document.createElement('div');
          actions.className = 'flex items-center space-x-1.5';
      
          const addBtn = document.createElement('button');
          addBtn.className =
            'px-2 py-0.5 text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-full font-medium transition-colors';
          addBtn.textContent = 'Add';
          addBtn.title = `Add ${label}`;
          addBtn.onclick = (e) => {
            e.stopPropagation();
            addNaicsChip(option.code);
          };
      
          const arrow = document.createElement('svg');
          arrow.setAttribute('viewBox', '0 0 24 24');
          arrow.className = 'w-3.5 h-3.5 text-gray-400 group-hover:text-blue-500';
          arrow.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" fill="none" stroke="currentColor" />';
      
          actions.append(addBtn, arrow);
          container.append(button, actions);
          li.appendChild(container);
          naicsDrillList.appendChild(li);
        });
      }

      function navigateToNaics(option) {
        if (isNaicsSearching) {
          isNaicsSearching = false;
          naicsSearchResults = [];
          naicsSearchTerm = '';
          const si = document.getElementById('naicsSearchInput');
          if (si) si.value = '';
        }
        naicsHierarchy.push(option);
        naicsParent = option.code;
        loadNaicsOptions();
      }
      
      function navigateBack() {
        if (isNaicsSearching) return;
        if (naicsHierarchy.length > 0) {
          naicsHierarchy.pop();
          naicsParent = naicsHierarchy.length > 0 ? naicsHierarchy[naicsHierarchy.length - 1].code : '';
          loadNaicsOptions();
        }
      }

      function renderNaicsChips() {
          if (!naicsChipsContainer) return;
          naicsChipsContainer.innerHTML = '';
          
          naicsChips.forEach(code => {
              const chip = document.createElement('div');
              chip.className = 'inline-flex items-center bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium';

              const span = document.createElement('span');
              span.textContent = code;

              const removeBtn = document.createElement('button');
              removeBtn.className = 'ml-2 text-blue-600 hover:text-blue-800 font-bold';
              removeBtn.textContent = 'x';
              const desc = naicsDict[code]?.description || '';
              chip.title = desc ? `${code} - ${desc}` : code;
              removeBtn.onclick = () => removeNaicsChip(code);

              chip.append(span, removeBtn);
              naicsChipsContainer.appendChild(chip);
          });
      }

      function addNaicsChip(code) {
          if (!naicsChips.includes(code)) {
              naicsChips.push(code);
              renderNaicsChips();
              dispatchFilterChange();
          }
      }

      function removeNaicsChip(code) {
          naicsChips = naicsChips.filter(c => c !== code);
          renderNaicsChips();
          dispatchFilterChange();
      }

      /* ---------- Dropdown population ---------- */
      async function fetchInitialFilterData() {
          try {
              const resp = await fetch(`/api/search?limit=500&select=state`);
              if (!resp.ok) throw new Error('Failed to fetch filter options');
              const data = await resp.json();
              const stateSel = document.getElementById('filterState');
              [...new Set(data.map(d => d.state).filter(Boolean))].sort()
                  .forEach(st => {
                      const opt = document.createElement('option');
                      opt.value = st;
                      opt.textContent = st;
                      stateSel.appendChild(opt);
                  });
          } catch (err) {
              console.error('Error fetching initial filter data:', err);
          }
      }

      function hasOtherActiveFiltersExceptMostRecent() {
        const searchInput = document.getElementById('searchInput');
        const hasTerm = !!(searchInput && searchInput.value.trim());
      
        const hasEmployeesMin = !!document.getElementById('filterEmployeesMin').value;
        const hasEmployeesMax = !!document.getElementById('filterEmployeesMax').value;
        const hasState       = !!document.getElementById('filterState').value;
        const hasZip         = !!document.getElementById('filterZip').value;
        const hasSafetyMin   = !!document.getElementById('filterSafetyMin').value;
        const hasSafetyMax   = !!document.getElementById('filterSafetyMax').value;
        const hasIncDetails  = !!document.getElementById('filterIncidentsDetails').checked;
        const hasNaics       = naicsChips.length > 0;
      
        return hasTerm || hasEmployeesMin || hasEmployeesMax || hasState || hasZip ||
               hasSafetyMin || hasSafetyMax || hasIncDetails || hasNaics;
      }

      /* ---------- Event Listeners ---------- */
      filterInputs.forEach(inp => {
        const eventType = (inp.type === 'text' || inp.type === 'number') ? 'input' : 'change';
        inp.addEventListener(eventType, (e) => {
          clearTimeout(debounceTimer);
      
          if (e.target.id === 'filterMostRecentYear' && !hasOtherActiveFiltersExceptMostRecent()) {
            updateClearButtonCount();
            return;
          }
      
          debounceTimer = setTimeout(dispatchFilterChange, eventType === 'input' ? 700 : 0);
        });
      });

      naicsBackBtn.addEventListener('click', navigateBack);

      clearFiltersButton.addEventListener('click', () => {
          suppressSearch = true;
          document.querySelectorAll('.filter-input').forEach(inp => {
              if (inp.type === 'checkbox') {
                  inp.checked = (inp.id === 'filterMostRecentYear');
              } else {
                  inp.value = '';
              }
          });
          naicsChips = [];
          naicsHierarchy = [];
          naicsParent = '';
          renderNaicsChips();
          loadNaicsOptions();
          isNaicsSearching = false;
          naicsSearchResults = [];
          naicsSearchTerm = '';
          const si = document.getElementById('naicsSearchInput');
          if (si) si.value = '';
          updateBreadcrumb();
          
          const searchInput = document.getElementById('searchInput');
          if (searchInput) searchInput.value = '';

          suppressSearch = false;
          dispatchFilterChange();
      });

      if (filterToggleBtn && filterPanel) {
          filterToggleBtn.addEventListener('click', () => {
              const isHidden = filterPanel.classList.toggle('hidden');
              filterToggleBtn.setAttribute('aria-expanded', String(!isHidden));
          });
      }

      const naicsSearchInput = document.getElementById('naicsSearchInput');
      if (naicsSearchInput) {
        naicsSearchInput.addEventListener('input', (e) => {
          clearTimeout(debounceTimer);
          const v = e.target.value.trim();
          debounceTimer = setTimeout(async () => {
            naicsSearchTerm = v;
            if (v.length >= 2) {
              isNaicsSearching = true;
              await searchNaicsAll(v);   // global search
            } else {
              isNaicsSearching = false;
              naicsSearchResults = [];
              updateBreadcrumb();
              renderNaicsOptions();       // show current level again
            }
          }, 200);
        });
      }
      
      document.addEventListener('updateFilterCount', updateClearButtonCount);

      /* ---------- Initialization ---------- */
      fetchInitialFilterData();
      loadNaicsOptions();
      renderNaicsChips();
      updateClearButtonCount();
  });
});