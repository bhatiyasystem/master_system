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
  console.log("Checking data type of received_by in purchase_receivings...");
  // Let's run a query to get database schema columns for purchase_receivings
  const { data, error } = await supabase.from('purchase_receivings').select('received_by').limit(1);
  if (error) {
    console.error("Error:", error.message);
  } else {
    console.log("Sample received_by value:", data);
  }
}

check();
