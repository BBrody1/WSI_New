//api/naics/index.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl      = process.env.SUPABASE_URL;
const supabaseAnonKey  = process.env.SUPABASE_ANON_KEY;
const supabase         = createClient(supabaseUrl, supabaseAnonKey);

module.exports = async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase client not initialized.' });
  }

  const { parent } = req.query;

  const pattern = parent
    ? `${parent}_`
    : '__';

  try {
    const { data, error } = await supabase
      .from('naics')
      .select('code, description')
      .like('code', pattern)
      .order('code', { ascending: true });

    if (error) {
      console.error('Error fetching NAICS codes:', error);
      return res.status(500).json({ error: error.message });
    }

    res.status(200).json(data);
  } catch (err) {
    console.error('Unexpected error in NAICS API:', err);
    res.status(500).json({ error: err.message });
  }
};