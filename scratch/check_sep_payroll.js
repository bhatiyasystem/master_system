import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_HR_SUPABASE_URL;
const key = process.env.VITE_HR_SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function checkPayroll() {
  console.log('--- Checking Payroll for Month 9 (September) ---');
  const { data: sepData, count: sepCount, error: sepErr } = await supabase
    .from('payroll')
    .select('*', { count: 'exact' })
    .eq('month', 9);

  if (sepErr) {
    console.error('Error querying September payroll:', sepErr);
  } else {
    console.log(`Found ${sepCount || 0} records for month=9 (September).`);
    if (sepData && sepData.length > 0) {
      console.log('Sample record for September:');
      console.log(sepData[0]);
    }
  }

  console.log('\n--- Checking all available months in payroll table ---');
  const { data: allData, error: allErr } = await supabase
    .from('payroll')
    .select('year, month, status');

  if (allErr) {
    console.error('Error fetching all payroll records:', allErr);
  } else if (allData) {
    const summary = {};
    allData.forEach(r => {
      const key = `${r.year || 'N/A'}-M${r.month}`;
      if (!summary[key]) summary[key] = { total: 0, statuses: {} };
      summary[key].total++;
      const st = r.status || 'NULL/empty';
      summary[key].statuses[st] = (summary[key].statuses[st] || 0) + 1;
    });
    console.log('Payroll Breakdown by Year-Month and Status:');
    console.log(JSON.stringify(summary, null, 2));
  }
}

checkPayroll();
