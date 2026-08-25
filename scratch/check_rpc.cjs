const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

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
  console.log("Listing database RPC functions...");
  try {
    const { data, error } = await supabase.rpc('get_table_columns_v2', { p_table: 'purchase_indents' });
    console.log("get_table_columns_v2 data:", data, "error:", error);
  } catch (err) {
    console.log("get_table_columns_v2 threw:", err.message);
  }

  try {
    const { data: procs, error: procErr } = await supabase.from('pg_proc').select('*').limit(5);
    console.log("pg_proc select:", procErr ? procErr.message : procs);
  } catch (err) {
    console.log("pg_proc select threw:", err.message);
  }
}

check();
