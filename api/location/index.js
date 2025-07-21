import { createClient } from '@supabase/supabase-js';

// Initialize the client once, outside the handler, for connection reuse
const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  const {
    id,
    ein,
    year,
    term,
    limit = '10',
    offset = '0',
    sortBy = 'establishment_name.asc',
    includeCount,
    latest
  } = req.query;

  // --- Logic for fetching a single location by ID ---
  if (id) {
    try {
      const { data: yearData, error } = await supabase
        .from('locations_mat')
        .select('*')
        .eq('establishment_id', id)
        .order('year_filing_for', { ascending: false });

      if (error) {
        console.error('single-location DB error', error);
        return res.status(500).json({ error: 'Database error', details: error.message });
      }

      if (!yearData || yearData.length === 0) {
        return res.status(404).json({ error: 'Location not found' });
      }

      const mostRecentRecord = yearData[0];
      
      // *** THE FIX IS HERE ***
      // We must include the 'ein' in the response object.
      const responseData = {
        ein: mostRecentRecord.ein, // <-- ADD THIS LINE
        establishment_id: mostRecentRecord.establishment_id,
        establishment_name: mostRecentRecord.establishment_name,
        street_address: mostRecentRecord.street_address,
        city: mostRecentRecord.city,
        state: mostRecentRecord.state,
        zip_code: mostRecentRecord.zip_code,
        annual_average_employees: mostRecentRecord.annual_average_employees,
        safety_score: mostRecentRecord.safety_score,
        years: yearData
      };
      
      return res.status(200).json(responseData);

    } catch (e) {
      console.error('single-location unexpected error', e);
      return res.status(500).json({ error: 'Unexpected server error' });
    }
  }

  // --- Logic for fetching multiple locations by EIN ---
  if (!ein) {
    return res.status(400).json({ error: 'An `id` or `ein` parameter is required.' });
  }

  const columns = 'establishment_id,establishment_name,annual_average_employees,city,state,trir,dart_rate,safety_score';

  let q = supabase
    .from('locations_mat')
    .select(columns, { count: includeCount === '1' ? 'exact' : undefined })
    .eq('ein', ein);

  if (year) q = q.eq('year_filing_for', year);
  if (latest === '1') q = q.eq('is_latest_ein_year', true);
  if (term && term.length >= 2) q = q.or(`establishment_name.ilike.%${term}%,city.ilike.%${term}%,state.ilike.%${term}%`);

  const ALLOWED_SORT = new Set(['establishment_name', 'city', 'state', 'trir', 'dart_rate', 'safety_score']);
  if (sortBy) {
    const [col, dir] = sortBy.split('.');
    if (col && ALLOWED_SORT.has(col)) {
      q = q.order(col, { ascending: (dir || '').toLowerCase() !== 'desc' });
    }
  }

  const start = Math.max(0, parseInt(offset, 10) || 0);
  const lim = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  const end = start + lim - 1;
  q = q.range(start, end);

  try {
    const t0 = Date.now();
    const { data, error, count } = await q;
    const ms = Date.now() - t0;

    if (error) {
      console.error('locations-list error', error);
      return res.status(500).json({ error: 'Database error', details: error.message });
    }

    if (includeCount === '1') res.setHeader('X-Total-Count', count ?? 0);
    res.setHeader('X-Query-Time-ms', ms);
    return res.status(200).json(data || []);
  } catch (e) {
    console.error('locations-list unexpected error', e);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
}