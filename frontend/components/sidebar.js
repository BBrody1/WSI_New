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

          document.querySelectorAll('.filter-input').forEach(input => {
              if (input.type === 'checkbox') {
                  if (input.checked && input.id !== 'filterMostRecentYear') cnt++;
              } else if (input.value) {
                  cnt++;
              }
          });

          cnt += naicsChips.length;

          if (!document.getElementById('filterMostRecentYear').checked) cnt++;

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

      /* ---------- NAICS Drill + Chips with improved navigation ---------- */
      async function loadNaicsOptions() {
          const url = `/api/naics${naicsParent ? '?parent=' + naicsParent : ''}`;
          try {
              const resp = await fetch(url);
              naicsOptions = await resp.json();
              renderNaicsOptions();
              updateBreadcrumb();
          } catch (e) {
              console.error('Error loading NAICS options:', e);
          }
      }

      function updateBreadcrumb() {
        if (naicsHierarchy.length === 0) {
          naicsBreadcrumb.classList.add('hidden');
        } else {
          naicsBreadcrumb.classList.remove('hidden');
          const current = naicsHierarchy[naicsHierarchy.length - 1];
          naicsCurrentLevel.textContent =
            current.code === '3'
              ? current.description                      
              : `${current.code} – ${current.description}`; 
        }
      }

      function renderNaicsOptions() {
          if (!naicsDrillList) return;
          naicsDrillList.innerHTML = '';
          
          naicsOptions.forEach(option => {
              const li = document.createElement('li');
              li.className = 'group';

              const container = document.createElement('div');
              container.className = 'flex items-center justify-between p-3 bg-gray-50 hover:bg-blue-50 rounded-lg border border-gray-200 hover:border-blue-200 transition-colors cursor-pointer';

              const button = document.createElement('button');
              button.className = 'text-left flex-1 text-sm font-medium text-gray-900 group-hover:text-blue-700';
                        const label = option.code === '3'
            ? option.description
            : `${option.code} - ${option.description}`;
          button.textContent = label;
              button.onclick = () => navigateToNaics(option);

              const actions = document.createElement('div');
              actions.className = 'flex items-center space-x-2';

              // Add button
              const addBtn = document.createElement('button');
              addBtn.className = 'px-3 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full font-medium transition-colors';
              addBtn.textContent = 'Add';
              addBtn.onclick = (e) => {
                  e.stopPropagation();
                  addNaicsChip(option.code);
              };

              // Drill down arrow
              const arrow = document.createElement('svg');
              arrow.className = 'w-4 h-4 text-gray-400 group-hover:text-blue-500';
              arrow.fill = 'none';
              arrow.stroke = 'currentColor';
              arrow.viewBox = '0 0 24 24';
              arrow.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />';

              actions.append(addBtn, arrow);
              container.append(button, actions);
              li.appendChild(container);
              naicsDrillList.appendChild(li);
          });
      }

      function navigateToNaics(option) {
          naicsHierarchy.push(option);
          naicsParent = option.code;
          loadNaicsOptions();
      }

      function navigateBack() {
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
              removeBtn.textContent = '×';
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

      /* ---------- Event Listeners ---------- */
      filterInputs.forEach(inp => {
          const eventType = (inp.type === 'text' || inp.type === 'number') ? 'input' : 'change';
          inp.addEventListener(eventType, () => {
              clearTimeout(debounceTimer);
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
      
      document.addEventListener('updateFilterCount', updateClearButtonCount);

      /* ---------- Initialization ---------- */
      fetchInitialFilterData();
      loadNaicsOptions();
      renderNaicsChips();
      updateClearButtonCount();
  });
});