// api/naics/index.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl     = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase        = createClient(supabaseUrl, supabaseAnonKey);

module.exports = async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase client not initialized.' });
  }

  const { parent, q } = req.query;

  try {
    // 0) Global search across ALL levels
    if (q && String(q).trim().length) {
      const term = String(q).trim();
      const { data, error } = await supabase
        .from('naics')
        .select('code, description')
        .or(`code.ilike.%${term}%,description.ilike.%${term}%`)
        .order('code', { ascending: true })
        .limit(400);

      if (error) throw error;

      // Optional: include the synthetic Manufacturing sector ("3") if query obviously targets it
      const out = data || [];
      const maybeManufact = /^3$|^31$|^32$|^33$|manufact/i.test(term);
      if (maybeManufact && !out.some(r => r.code === '3')) {
        out.unshift({ code: '3', description: '31 - 33 Manufacturing' });
      }

      return res.status(200).json(out);
    }

    // 1) Top-level: two-digit sectors
    if (!parent) {
      const { data, error } = await supabase
        .from('naics')
        .select('code, description')
        .like('code', '__') // two-digit codes
        .order('code', { ascending: true });

      if (error) throw error;

      // inject the single “Manufacturing” sector where 31–33 lives
      const sectors = data || [];
      const insertAt = sectors.findIndex(s => s.code > '21');
      sectors.splice(
        insertAt === -1 ? sectors.length : insertAt,
        0,
        { code: '3', description: '31 - 33 Manufacturing' }
      );

      return res.status(200).json(sectors);
    }

    // 2) Child level
    const pattern = parent === '3'
      ? '3%'          // everything starting with 3
      : `${parent}_`; // one level deeper

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