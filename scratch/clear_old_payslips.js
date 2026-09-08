import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_HR_SUPABASE_URL;
const key = process.env.VITE_HR_SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function checkOldPayslips() {
  console.log('--- Inspecting all records in payslips table ---');
  const { data, error } = await supabase
    .from('payslips')
    .select('*');

  if (error) console.error(error);
  else {
    console.log(`Found ${data.length} records in payslips table:`);
    console.log(data);
  }
}

checkOldPayslips();
