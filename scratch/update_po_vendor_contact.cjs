const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  // Check how many POs have Botivate with old number
  const { data: pos, error: fetchErr } = await supabase
    .from('purchase_pos')
    .select('id, po_no, vendor_name, vendor_contact')
    .ilike('vendor_name', '%botivate%');

  if (fetchErr) { console.error('Fetch error:', fetchErr.message); process.exit(1); }

  console.log('Botivate POs found:', pos.length);
  pos.forEach(p => console.log(` - ${p.po_no} | contact: ${p.vendor_contact}`));

  // Update all Botivate POs to new number
  const { data: updated, error: updErr } = await supabase
    .from('purchase_pos')
    .update({ vendor_contact: '6260764761' })
    .ilike('vendor_name', '%botivate%')
    .select('id, po_no, vendor_contact');

  if (updErr) { console.error('Update error:', updErr.message); process.exit(1); }

  console.log('\n✅ Updated POs:');
  updated.forEach(p => console.log(` - ${p.po_no} | new contact: ${p.vendor_contact}`));
}

run();
