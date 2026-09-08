import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_HR_SUPABASE_URL;
const key = process.env.VITE_HR_SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function checkAarti() {
  console.log('--- Inspecting ALL payroll records for Aarti Jagat across all months ---');
  const { data } = await supabase
    .from('payroll')
    .select('*')
    .eq('emp_code', '637139305123');

  console.log(data);
}

checkAarti();
