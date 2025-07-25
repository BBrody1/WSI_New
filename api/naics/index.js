// api/naics/index.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl     = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase        = createClient(supabaseUrl, supabaseAnonKey);

module.exports = async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase client not initialized.' });
  }

  const { parent } = req.query;

  try {
    // 1) Top-level: two-digit sectors
    if (!parent) {
      const { data, error } = await supabase
        .from('naics')
        .select('code, description')
        .like('code', '__')        // two-digit codes only
        .order('code', { ascending: true });

      if (error) throw error;

      // inject the single “Manufacturing” sector
      // at the point where 31–33 should live (after '21', before '22')
      const sectors = data || [];
      const insertAt = sectors.findIndex(s => s.code > '21');
      sectors.splice(
        insertAt === -1 ? sectors.length : insertAt,
        0,
        { code: '3', 
        description: '31 - 33 Manufacturing' }
      );

      return res.status(200).json(sectors);
    }

    // 2) “Manufacturing” clicked: show every code under 3xxx
    const pattern = parent === '3'
      ? '3%'     // everything starting with 3
      : `${parent}_`;   // default: one level deeper

    const { data, error } = await supabase
      .from('naics')
      .select('code, description')
      .like('code', pattern)
      .order('code', { ascending: true });

    if (error) throw error;
    return res.status(200).json(data);

  } catch (err) {
    console.error('NAICS API error:', err);
    return res.status(500).json({ error: err.message });
  }
};