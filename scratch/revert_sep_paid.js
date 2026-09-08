import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_HR_SUPABASE_URL;
const key = process.env.VITE_HR_SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function cleanRecordDetails() {
  console.log('--- Setting exact OT calculations for Aarti Jagat & Chandni Maravi ---');

  // Aarti Jagat (481 mins OT = 8.01666 hrs = 08:01, ₹400.83 OT pay)
  await supabase
    .from('payroll')
    .update({
      status: 'draft',
      payable_days: 3,
      basic_salary: 6500,
      ot_hours: 8.016666666666667,
      ot_amount: 400.83,
      gross_salary: 1050.83,
      total_deductions: 0,
      loan_deduction: 0,
      salary_advance_deduction: 0,
      net_salary: 1060,
      updated_at: new Date().toISOString()
    })
    .eq('emp_code', '637139305123')
    .eq('month', 9)
    .eq('year', 2026);

  // Chandni Maravi (714 mins OT = 11.9 hrs = 11:54, ₹595 OT pay)
  await supabase
    .from('payroll')
    .update({
      status: 'draft',
      payable_days: 4,
      basic_salary: 6500,
      ot_hours: 11.9,
      ot_amount: 595,
      gross_salary: 1461.67,
      total_deductions: 0,
      loan_deduction: 0,
      salary_advance_deduction: 0,
      net_salary: 1470,
      updated_at: new Date().toISOString()
    })
    .eq('emp_code', '434834976844')
    .eq('month', 9)
    .eq('year', 2026);

  const { data } = await supabase
    .from('payroll')
    .select('emp_code, emp_name, status, payable_days, ot_hours, ot_amount, gross_salary, net_salary')
    .in('emp_code', ['637139305123', '434834976844'])
    .eq('month', 9)
    .eq('year', 2026);

  console.log('Updated September Payroll Records in Supabase:');
  console.log(data);
}

cleanRecordDetails();
