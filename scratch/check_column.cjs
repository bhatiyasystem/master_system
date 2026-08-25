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
  console.log("Checking columns of purchase_indents table...");
  const { data: rows, error: rowErr } = await supabase.from('purchase_indents').select('*').limit(1);
  if (rowErr) {
    console.error("Error reading purchase_indents:", rowErr.message);
  } else {
    console.log("Columns present in database:", Object.keys(rows[0] || {}));
  }
}

check();
