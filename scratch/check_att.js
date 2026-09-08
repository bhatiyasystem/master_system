import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_HR_SUPABASE_URL;
const key = process.env.VITE_HR_SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function checkAtt() {
  const empCodes = ['637139305123', '434834976844'];
  console.log('--- Inspecting attendance_monthly for Sep 2026 ---');

  const { data: attData, error: attErr } = await supabase
    .from('attendance_monthly')
    .select('*')
    .in('emp_code', empCodes)
    .eq('month', 9)
    .eq('year', 2026);

  console.log('attendance_monthly records:');
  console.log(attData);

  console.log('\n--- Inspecting payroll for Sep 2026 ---');
  const { data: payData, error: payErr } = await supabase
    .from('payroll')
    .select('*')
    .in('emp_code', empCodes)
    .eq('month', 9)
    .eq('year', 2026);

  console.log('payroll records:');
  console.log(payData);
}

checkAtt();
