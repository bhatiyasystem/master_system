const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env
const envFile = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  // First, check current record
  const { data: before, error: fetchErr } = await supabase
    .from('vendors')
    .select('id, name, contact')
    .ilike('name', 'Botivate Services LLP')
    .maybeSingle();

  if (fetchErr) {
    console.error('Error fetching vendor:', fetchErr.message);
    process.exit(1);
  }

  if (!before) {
    console.error('Vendor "Botivate Services LLP" not found in vendors table.');
    process.exit(1);
  }

  console.log('Current record:', before);

  // Update contact
  const { data: updated, error: updateErr } = await supabase
    .from('vendors')
    .update({ contact: '6260764761' })
    .eq('id', before.id)
    .select('id, name, contact')
    .single();

  if (updateErr) {
    console.error('Error updating vendor:', updateErr.message);
    process.exit(1);
  }

  console.log('Updated record:', updated);
  console.log('✅ Done.');
}

run();
