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
  console.log("Checking columns of purchase_deliveries...");
  const { data: listD, error: errD } = await supabase.from('purchase_deliveries').select('*').limit(1);
  if (errD) {
    console.error("Error reading purchase_deliveries:", errD.message);
  } else {
    console.log("purchase_deliveries columns:", Object.keys(listD?.[0] || {}));
  }

  console.log("Checking columns of purchase_receivings...");
  const { data: listR, error: errR } = await supabase.from('purchase_receivings').select('*').limit(1);
  if (errR) {
    console.error("Error reading purchase_receivings:", errR.message);
  } else {
    console.log("purchase_receivings columns:", Object.keys(listR?.[0] || {}));
  }
}

check();
