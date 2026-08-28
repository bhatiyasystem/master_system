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
  // Let's run a test update query using supabase.from('purchase_receivings') to see if it allows update or returns error/0 rows
  console.log("Testing update on purchase_receivings for id 'cd38eea8-ceac-46e0-a88c-e53d113a071f'...");
  const { data, error } = await supabase
    .from('purchase_receivings')
    .update({ received_by: 'test_rls' })
    .eq('id', 'cd38eea8-ceac-46e0-a88c-e53d113a071f')
    .select();
  
  if (error) {
    console.error("Update failed with error:", error);
  } else {
    console.log("Update result data:", data);
  }
}

check();
