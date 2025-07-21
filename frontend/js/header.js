// --- Desktop Header Search ---
const headerSearchForm = document.getElementById('headerSearchForm');
const headerSearchInput = document.getElementById('headerSearchInput');
const headerSearchResults = document.getElementById('headerSearchResults');
let debounceTimer = null;

function hideResults() {
    if (headerSearchResults) {
        headerSearchResults.innerHTML = '';
        headerSearchResults.classList.add('hidden');
    }
}

// Desktop search submit
if (headerSearchForm && headerSearchInput) {
    headerSearchForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const term = headerSearchInput.value.trim();
        if (term.length < 2) {
            headerSearchInput.focus();
            return;
        }
        window.location.href = `/search?term=${encodeURIComponent(term)}`;
    });

    // Desktop instant autocomplete (optional)
    if (headerSearchResults) {
        headerSearchInput.addEventListener('input', function () {
            const term = headerSearchInput.value.trim();
            clearTimeout(debounceTimer);
            if (term.length < 2) {
                hideResults();
                return;
            }
            debounceTimer = setTimeout(async () => {
                try {
                    const response = await fetch(`/api/search?term=${encodeURIComponent(term)}&limit=8`);
                    if (!response.ok) throw new Error('Search failed');
                    const results = await response.json();
                    if (results && results.length > 0) {
                        headerSearchResults.innerHTML = results.map(company =>
                            `<a href="/company?ein=${encodeURIComponent(company.ein)}"
                                class="block px-4 py-2 text-gray-800 hover:bg-blue-50 border-b last:border-b-0 border-gray-100">
                                ${company.company_name || 'N/A Company'}
                                <span class="ml-2 text-xs text-gray-400">${company.industry_description || ''}</span>
                            </a>`
                        ).join('');
                        headerSearchResults.classList.remove('hidden');
                    } else {
                        headerSearchResults.innerHTML = '<div class="px-4 py-2 text-gray-500">No companies found</div>';
                        headerSearchResults.classList.remove('hidden');
                    }
                } catch {
                    hideResults();
                }
            }, 250);
        });

        // Hide results when clicking outside
        document.addEventListener('click', (e) => {
            if (!headerSearchForm.contains(e.target)) {
                hideResults();
            }
        });
    }
}

// --- Hamburger menu toggle (Mobile) ---
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileMenu = document.getElementById('mobileMenu');
if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        const expanded = mobileMenu.classList.toggle('hidden') ? 'false' : 'true';
        // For accessibility
        mobileMenuBtn.setAttribute('aria-expanded', expanded);
    });
    // Hide when clicking outside the menu/hamburger
    document.addEventListener('click', function(e) {
        if (
            !mobileMenu.contains(e.target) &&
            !mobileMenuBtn.contains(e.target)
        ) {
            mobileMenu.classList.add('hidden');
            mobileMenuBtn.setAttribute('aria-expanded', 'false');
        }
    });
    // Hide on mobile link click
    mobileMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.add('hidden');
            mobileMenuBtn.setAttribute('aria-expanded', 'false');
        });
    });
}

// --- Mobile search ---
const mobileSearchForm = document.getElementById('mobileSearchForm');
const mobileSearchInput = document.getElementById('mobileSearchInput');
if (mobileSearchForm && mobileSearchInput) {
    mobileSearchForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const term = mobileSearchInput.value.trim();
        if (term.length < 2) {
            mobileSearchInput.focus();
            return;
        }
        window.location.href = `/search?term=${encodeURIComponent(term)}`;
    });
}