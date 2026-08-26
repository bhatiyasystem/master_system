const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

function evaluateFormula(formulaStr) {
  if (formulaStr === undefined || formulaStr === null) return 0;
  const str = String(formulaStr).trim();
  if (!str) return 0;
  const num = Number(str);
  if (!isNaN(num)) return num;
  try {
    const sanitized = str.replace(/[^0-9+\-*/().]/g, '');
    if (!sanitized) return 0;
    return new Function(`return ${sanitized}`)();
  } catch (err) {
    return 0;
  }
}

async function check() {
  const tables = ['purchase_pos', 'purchase_payment_approvals', 'purchase_deliveries', 'purchase_payments'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (error) {
      console.log(`Table '${t}' error:`, error.message);
    } else {
      console.log(`Table '${t}' EXISTS! columns:`, Object.keys(data[0] || {}));
    }
  }
}
check();
