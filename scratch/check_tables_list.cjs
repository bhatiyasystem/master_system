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
  console.log("Querying information_schema.tables...");
  // Let's try selecting from information_schema.tables.
  // Sometimes Supabase allows selecting from information_schema via standard HTTP API if not restricted.
  const { data, error } = await supabase.from('information_schema.tables').select('table_name').eq('table_schema', 'public');
  if (error) {
    console.log("Could not query information_schema directly:", error.message);
    // Let's try querying using a system RPC if there is one, or try mapping common tables
  } else {
    console.log("Tables in public schema:", data);
  }
}

check();
