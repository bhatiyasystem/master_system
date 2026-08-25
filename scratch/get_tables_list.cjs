const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Manually parse .env
const envFile = fs.readFileSync('.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function check() {
  console.log("Fetching list of all tables in database...");
  const { data, error } = await supabase.rpc('get_tables_list'); // wait, do we have this RPC?
  if (error) {
    // If no RPC, let's try querying standard schema tables via SQL-like queries
    console.log("No RPC get_tables_list. Querying a known query...");
    const { data: list, error: err } = await supabase.from('purchase_deliveries').select('*').limit(1);
    console.log("purchase_deliveries columns:", Object.keys(list?.[0] || {}));
  } else {
    console.log("Tables:", data);
  }
}

check();
