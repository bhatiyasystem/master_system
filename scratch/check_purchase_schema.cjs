const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.rpc('get_columns', { table_name: 'purchase_indents' });
  if (error) {
    // If rpc doesn't exist, query PG internal catalog via standard sql or check schema directly
    const { data: cols, error: err2 } = await supabase.from('purchase_indents').select('*').limit(0);
    console.log("Error querying columns via RPC, falling back. Columns present:", Object.keys(cols?.[0] || {}));
  } else {
    console.log("Columns:", data);
  }
}
check();
