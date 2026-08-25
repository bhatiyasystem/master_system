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
  console.log("Checking Supabase tables and column details...");
  
  // select one row to inspect columns of purchase_indents
  const { data: rows, error: rowErr } = await supabase.from('purchase_indents').select('*').limit(1);
  if (rowErr) {
    console.error("Error reading purchase_indents:", rowErr);
  } else {
    console.log("purchase_indents columns:", Object.keys(rows[0] || {}));
  }

  // Let's check other tables
  const tablesToCheck = ['purchase_indents', 'purchase_items', 'master_items', 'purchase_master_items', 'items'];
  for (const t of tablesToCheck) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (error) {
      console.log(`Table '${t}' does not exist or error:`, error.message);
    } else {
      console.log(`Table '${t}' EXISTS! sample row keys:`, Object.keys(data[0] || {}));
    }
  }
}

check();
