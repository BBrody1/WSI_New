// pages/api/company.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl    = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

let supabase;
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.error("Supabase credentials missing");
  supabase = null;
}

module.exports = async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase client not initialized.' });
  }

  const { ein } = req.query;
  if (!ein) {
    return res.status(400).json({ error: 'Missing required EIN parameter.' });
  }

  try {
    // 🔄 Switch to search_mat
    const { data, error } = await supabase
      .from('search_mat')
      .select('*')
      .eq('ein', ein)
      .order('year_filing_for', { ascending: false });

    if (error) {
      console.error('Supabase query error:', error);
      return res
        .status(500)
        .json({ error: 'Error fetching data from database.', details: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Company not found.' });
    }

    // The first row is the most recent—use it for the header
    const first = data[0];

    res.status(200).json({
      ein: first.ein,
      company_name: first.company_name,
      naics_code: first.naics_code,
      industry_description: first.industry_description,
      total_employees: first.total_employees,
      num_establishments: first.num_establishments,
      state: first.state,
      city: first.city,
      zip_code: first.zip_code,
      safety_score: first.safety_score,
      // Pass the full time series for the chart/table
      years: data.map(row => ({
        year_filing_for: row.year_filing_for,
        total_deaths: row.total_deaths,
        total_dafw_cases: row.total_dafw_cases,
        total_djtr_cases: row.total_djtr_cases,
        total_other_cases: row.total_other_cases,
        dart_rate: row.dart_rate,
        trir: row.trir,
        severity_rate: row.severity_rate,
        safety_score: row.safety_score
      }))
    });

  } catch (err) {
    console.error('Unexpected error in serverless function:', err);
    res.status(500).json({ error: 'An unexpected server error occurred.' });
  }
};