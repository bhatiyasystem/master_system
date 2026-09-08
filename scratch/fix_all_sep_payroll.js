import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_HR_SUPABASE_URL;
const key = process.env.VITE_HR_SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

function parseOtHours(otValue) {
  if (otValue === null || otValue === undefined || otValue === '') return 0;
  if (typeof otValue === 'number') {
    if (isNaN(otValue) || otValue <= 0) return 0;
    if (otValue >= 100) return otValue / 60;
    return otValue;
  }
  const str = String(otValue).trim();
  if (!str || str === '—' || str === '-' || str === '0' || str === '00:00' || str === '0:00') return 0;
  if (str.includes(':')) {
    const parts = str.split(':');
    const h = parseFloat(parts[0]) || 0;
    const m = parseFloat(parts[1]) || 0;
    if (h >= 100 && m === 0) return h / 60;
    return h + (m / 60);
  }
  const num = parseFloat(str);
  if (isNaN(num) || num <= 0) return 0;
  if (num >= 100) return num / 60;
  return num;
}

async function fixAllSepPayroll() {
  console.log('--- Fixing all September 2026 payroll records in DB ---');

  // Fetch monthly attendance for Sep 2026
  const { data: attRows } = await supabase
    .from('attendance_monthly')
    .select('*')
    .eq('year', 2026)
    .eq('month', 9);

  // Fetch payroll rows for Sep 2026
  const { data: payRows } = await supabase
    .from('payroll')
    .select('*')
    .eq('year', 2026)
    .eq('month', 9);

  const attMap = {};
  (attRows || []).forEach(a => {
    attMap[String(a.emp_code).trim()] = a;
  });

  const totalDaysInMonth = 30;

  for (const pay of (payRows || [])) {
    const att = attMap[String(pay.emp_code).trim()];
    const rawOt = att?.total_ot || att?.ot_hours || pay.ot_hours || '00:00';
    const parsedOtHours = parseOtHours(rawOt);
    const otAmount = parseFloat((parsedOtHours * 50).toFixed(2));

    const presentDays = parseFloat(pay.payable_days) || 0;
    const baseSalary = parseFloat(pay.basic_salary) || 0;
    const earnedBasic = parseFloat(((baseSalary / totalDaysInMonth) * presentDays).toFixed(2));
    const putthaPrice = parseFloat(pay.puttha_price || 0);

    const grossSalary = parseFloat((earnedBasic + otAmount + putthaPrice).toFixed(2));
    const totalDeductions = parseFloat(pay.total_deductions || 0);
    const rawNet = Math.max(0, grossSalary - totalDeductions);
    const netSalary = rawNet > 0 ? Math.ceil(rawNet / 10) * 10 : 0;

    await supabase
      .from('payroll')
      .update({
        ot_hours: parsedOtHours,
        ot_amount: otAmount,
        gross_salary: grossSalary,
        net_salary: netSalary,
        updated_at: new Date().toISOString()
      })
      .eq('id', pay.id);
  }

  console.log('Successfully updated all September 2026 payroll records in Supabase DB.');

  const { data: sample } = await supabase
    .from('payroll')
    .select('emp_code, emp_name, payable_days, basic_salary, ot_hours, ot_amount, gross_salary, net_salary, status')
    .in('emp_code', ['637139305123', '434834976844'])
    .eq('month', 9)
    .eq('year', 2026);

  console.log('Sample updated records for Aarti Jagat & Chandni Maravi:');
  console.log(sample);
}

fixAllSepPayroll();
