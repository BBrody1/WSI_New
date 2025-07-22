/**
 * Gets a query parameter from the current URL.
 * @param {string} name The name of the parameter to get.
 * @returns {string|null}
 */
function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

/**
 * Formats a number for display, handling null/undefined and decimals.
 * @param {number|string|null|undefined} v The value to format.
 * @returns {string|number}
 */
function fmtNum(v) {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'number') {
        // Return integers as is, format floats to 2 decimal places
        return Number.isInteger(v) ? v : v.toFixed(2);
    }
    return v;
}

/**
 * Main function to run when the DOM is loaded.
 */
document.addEventListener('DOMContentLoaded', async () => {
    const ein = getQueryParam('ein');
    
    // Get references to all necessary DOM elements
    const loadingDiv = document.getElementById('locationsLoading');
    const errorDiv = document.getElementById('locationsError');
    const gridDiv = document.getElementById('locationsGrid');
    const noResultsDiv = document.getElementById('noResults');
    const companyNameSpan = document.getElementById('companyName');

    if (!ein) {
        loadingDiv.classList.add('hidden');
        errorDiv.textContent = 'No company EIN was specified in the URL.';
        errorDiv.classList.remove('hidden');
        return;
    }

    try {
        // Fetch both company and location data in parallel for efficiency
        const [companyData, locations] = await Promise.all([
            fetchCompany(ein),
            fetchAllLocations(ein)
        ]);
        
        // Update the page title with the company name
        if (companyData && companyData.company_name) {
            companyNameSpan.textContent = companyData.company_name;
            document.title = `All Locations for ${companyData.company_name} – Work Safety Index`;
        }

        // Hide loading indicator
        loadingDiv.classList.add('hidden');

        if (!locations || locations.length === 0) {
            noResultsDiv.classList.remove('hidden');
            return;
        }
        
        // If we have locations, display them
        displayLocationCards(locations, gridDiv);

    } catch (err) {
        // Handle any errors during the fetch process
        loadingDiv.classList.add('hidden');
        errorDiv.textContent = err.message || 'An unexpected error occurred while loading locations.';
        errorDiv.classList.remove('hidden');
    }
});

/**
 * Fetches the main company profile data.
 * @param {string} ein The company's Employer Identification Number.
 * @returns {Promise<object>}
 */
async function fetchCompany(ein) {
    const url = `/api/company?ein=${encodeURIComponent(ein)}`;
    const response = await fetch(url);
    if (!response.ok) {
        // This is not a fatal error for this page, so we just log it
        console.error('Could not fetch main company data.');
        return null;
    }
    return response.json();
}

/**
 * Fetches all locations associated with a given EIN.
 * The API is called with a high limit to get all records.
 * @param {string} ein The company's Employer Identification Number.
 * @returns {Promise<Array<object>>}
 */
async function fetchAllLocations(ein) {
    // We set a high limit to fetch all locations. Adjust if pagination is needed.
    const url = `/api/location?ein=${encodeURIComponent(ein)}&limit=1000&latest=1`;
    const response = await fetch(url);
    
    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `API error (${response.status}) while fetching locations.`);
    }
    
    return response.json();
}

/**
 * Renders the location data into cards and appends them to the grid.
 * @param {Array<object>} locations The array of location data.
 * @param {HTMLElement} gridElement The container element to append cards to.
 */
function displayLocationCards(locations, gridElement) {
    if (!locations || !gridElement) return;

    gridElement.innerHTML = locations.map(loc => `
        <div class="bg-white p-5 rounded-lg shadow border border-gray-200 flex flex-col space-y-3">
            <h3 class="text-lg font-bold text-gray-900">
                ${loc.establishment_name || 'N/A'}
            </h3>
            <p class="text-sm text-gray-600">
                ${loc.city || ''}${loc.state ? ', ' + loc.state : ''}
            </p>
            <p class="text-sm text-gray-600">
                Employees: <span class="font-semibold">${loc.annual_average_employees != null ? fmtNum(loc.annual_average_employees) : '—'}</span>
            </p>
            
            <div class="grid grid-cols-3 gap-2 text-center pt-2 border-t">
                <div>
                    <div class="font-bold text-blue-700 text-lg">${fmtNum(loc.safety_score)}</div>
                    <div class="text-xs text-gray-500">Score</div>
                </div>
                <div>
                    <div class="font-bold text-gray-800 text-lg">${fmtNum(loc.dart_rate)}</div>
                    <div class="text-xs text-gray-500">DART</div>
                </div>
                <div>
                    <div class="font-bold text-gray-800 text-lg">${fmtNum(loc.trir)}</div>
                    <div class="text-xs text-gray-500">TRIR</div>
                </div>
            </div>

            <div class="pt-2">
                <a href="/location?id=${encodeURIComponent(loc.establishment_id || '')}" 
                   class="inline-block w-full text-center bg-blue-600 text-white font-medium py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
                    View Details
                </a>
            </div>
        </div>
    `).join('');
}