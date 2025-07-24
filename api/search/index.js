const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

let supabase;
if (supabaseUrl && supabaseAnonKey) {
    try {
        supabase = createClient(supabaseUrl, supabaseAnonKey);
    } catch (error) {
        console.error("Error initializing Supabase client:", error);
        supabase = null;
    }
} else {
    console.error("Supabase URL or Key is missing from environment variables.");
    supabase = null;
}

module.exports = async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ error: 'Supabase client not initialized.' });
    }

    const {
        term,
        industry,
        employeesMin,
        employeesMax,
        state,
        zip,
        mostRecentYear,
        sortBy = 'relevance',
        limit = '20',
        offset = '0'
    } = req.query;

    let query = supabase
    .from('search_mat')
    .select(
      `ein,
       year_filing_for,
       company_name,
       naics_code,
       industry_description,
       num_establishments,
       total_employees,
       dart_rate,
       trir,
       severity_rate,
       safety_score,
       state`,
      { count: 'exact' }
    ) .eq('is_latest', true);

    // Fuzzy search by company name
    let searchTerm = '';
    if (typeof term === 'string' && term.trim() !== '') {
        searchTerm = decodeURIComponent(term.replace(/\+/g, ' '));
    }
    if (searchTerm !== '') {
        const terms = searchTerm.trim().split(/\s+/);
        for (const t of terms) {
            query = query.ilike('company_name', `%${t}%`);
        }
    }

        const industries = Array.isArray(req.query.industry)
        ? req.query.industry
        : req.query.industry
        ? [req.query.industry]
        : [];
    
    if (industries.length) {
        const orFilters = industries.map(code => `naics_code.ilike.${code}%`).join(',');
        query = query.or(orFilters);
    }

    if (employeesMin) {
        query = query.gte('total_employees', parseInt(employeesMin));
    }

    if (employeesMax) {
        query = query.lte('total_employees', parseInt(employeesMax));
    }

    if (state) {
        query = query.eq('state', state.toUpperCase());
    }

    if (zip) {
        query = query.eq('zip_code', zip.trim());
    }

    if (mostRecentYear === 'true') {
        const currentYear = new Date().getFullYear();
        query = query.gte('year_filing_for', currentYear - 2).lte('year_filing_for', currentYear);
    }

    if (req.query.safetyMin) query = query.gte('safety_score', parseFloat(req.query.safetyMin));
if (req.query.safetyMax) query = query.lte('safety_score', parseFloat(req.query.safetyMax));
    // Sorting logic
    if (sortBy && sortBy !== 'relevance') {
        const [sortColumn, sortDirection] = sortBy.split('.');
        if (sortColumn && (sortDirection === 'asc' || sortDirection === 'desc')) {
          query = query.order(sortColumn, { ascending: sortDirection === 'asc' });
        } else {
          query = query.order('safety_score', { ascending: false });
        }
      } else {
            // relevance → first non-null employees, then highest employees, then newest year
            query = query
            .order('total_employees', { ascending: false, nullsFirst: false })
            .order('year_filing_for', { ascending: false });
    }

    query = query.limit(parseInt(limit)).range(
        parseInt(offset),
        parseInt(offset) + parseInt(limit) - 1
    );

    try {
        const { data, error, count } = await query;

        if (error) {
            console.error('Supabase query error:', error);
            return res.status(500).json({ error: 'Error fetching data from database.', details: error.message });
        }

        res.setHeader('X-Total-Count', count);
        res.status(200).json(data);
    } catch (err) {
        console.error('Unexpected error in serverless function:', err);
        res.status(500).json({ error: 'An unexpected server error occurred.' });
    }
};