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
  const tables = ['purchase_receivings', 'purchase_receiving_items'];
  for (const table of tables) {
    console.log(`Checking table ${table}...`);
    const { data: rows, error: rowErr } = await supabase.from(table).select('*').limit(1);
    if (rowErr) {
      console.log(`Error reading ${table}:`, rowErr.message);
    } else {
      console.log(`Columns of ${table}:`, Object.keys(rows[0] || {}));
    }
  }
}

check();
