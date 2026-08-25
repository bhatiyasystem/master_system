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
  console.log("Querying latest purchase_indents...");
  const { data: rows, error: rowErr } = await supabase
    .from('purchase_indents')
    .select('id, unique_no, item_details, status, order_formula, hide_in_master, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  if (rowErr) {
    console.error("Error reading purchase_indents:", rowErr.message);
  } else {
    console.log("Latest indents:");
    rows.forEach(r => {
      console.log(`- UniqueNo: ${r.unique_no}, Item: ${r.item_details}, Status: ${r.status}, OrderFormula: ${r.order_formula}, HideInMaster: ${r.hide_in_master}`);
    });
  }
}

check();
