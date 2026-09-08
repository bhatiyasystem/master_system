import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_HR_SUPABASE_URL;
const key = process.env.VITE_HR_SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function checkPaidDb() {
  console.log('--- Inspecting payroll table for Aarti Jagat & Chandni Maravi ---');
  const { data } = await supabase
    .from('payroll')
    .select('*')
    .in('emp_code', ['637139305123', '434834976844'])
    .eq('month', 9)
    .eq('year', 2026);

  console.log(data);
}

checkPaidDb();
