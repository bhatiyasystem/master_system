import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_HR_SUPABASE_URL;
const key = process.env.VITE_HR_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Supabase URL or Key missing in .env');
  process.exit(1);
}

const supabase = createClient(url, key);

function parseOtHours(otValue) {
  if (otValue === null || otValue === undefined || otValue === '') return 0;

  if (typeof otValue === 'number') {
    if (isNaN(otValue) || otValue <= 0) return 0;
    if (otValue >= 60) return otValue / 60;
    return otValue;
  }

  const str = String(otValue).trim();
  if (!str || str === '—' || str === '-' || str === '0' || str === '00:00' || str === '0:00') return 0;

  if (str.includes(':')) {
    const parts = str.split(':');
    const h = parseFloat(parts[0]) || 0;
    const m = parseFloat(parts[1]) || 0;
    const s = parseFloat(parts[2]) || 0;
    if ((m === 0 && s === 0 && h >= 60) || h >= 100) {
      return h / 60;
    }
    return h + (m / 60) + (s / 3600);
  }

  const hMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)/i);
  const mMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)/i);
  if (hMatch || mMatch) {
    const h = hMatch ? parseFloat(hMatch[1]) : 0;
    const m = mMatch ? parseFloat(mMatch[1]) : 0;
    return h + (m / 60);
  }

  const num = parseFloat(str);
  if (isNaN(num) || num <= 0) return 0;
  if (num >= 60) return num / 60;
  return num;
}

function formatOtDisplay(parsedHours) {
  if (!parsedHours || parsedHours <= 0) return '00:00';
  const totalMinutes = Math.round(parsedHours * 60);
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

async function recalculateAugustPayroll() {
  console.log('Fetching August 2026 payroll & attendance records...');
  
  const year = 2026;
  const month = 8;
  const daysInMonth = new Date(year, month, 0).getDate(); // 31

  const [{ data: payrollRows, error: payErr }, { data: attRows, error: attErr }, { data: empRows, error: empErr }] = await Promise.all([
    supabase.from('payroll').select('*').eq('year', year).eq('month', month),
    supabase.from('attendance_monthly').select('*').eq('year', year).eq('month', month),
    supabase.from('employees').select('*')
  ]);

  if (payErr) {
    console.error('Error fetching payroll:', payErr);
    return;
  }

  console.log(`Found ${payrollRows.length} payroll records for August 2026.`);

  const attMap = {};
  (attRows || []).forEach(r => {
    if (r.emp_code) attMap[String(r.emp_code).trim().toLowerCase()] = r;
  });

  const empMap = {};
  (empRows || []).forEach(r => {
    if (r.employee_id) empMap[String(r.employee_id).trim().toLowerCase()] = r;
    if (r.name) empMap[String(r.name).trim().toLowerCase()] = r;
  });

  // Calculate Puttha pool
  const yesCount = payrollRows.filter(r => (r.puttha_status || 'Yes') !== 'No' && (parseFloat(r.payable_days) || 0) >= 15).length;
  const totalPutthaPool = payrollRows.reduce((s, r) => s + (parseFloat(r.puttha_price) || 0), 0);
  const perYesPutthaPrice = yesCount > 0 ? parseFloat((totalPutthaPool / yesCount).toFixed(2)) : 0;

  console.log(`Puttha calculation: ${yesCount} eligible employees, pool ₹${totalPutthaPool}, per-employee ₹${perYesPutthaPrice}`);

  const updates = [];

  for (const row of payrollRows) {
    const codeKey = String(row.emp_code || '').trim().toLowerCase();
    const att = attMap[codeKey];
    const emp = empMap[codeKey];

    const rawOverride = att?.payable_days_override;
    const rawPayable = att?.payable_days;
    let presentDays = parseFloat(row.payable_days) || 0;
    if (rawOverride !== null && rawOverride !== undefined && String(rawOverride).trim() !== '') {
      presentDays = parseFloat(rawOverride);
    } else if (rawPayable !== null && rawPayable !== undefined && String(rawPayable).trim() !== '') {
      presentDays = parseFloat(rawPayable);
    }

    const baseSalary = emp?.salary !== undefined ? parseFloat(emp.salary) : (parseFloat(row.basic_salary) || 0);
    const earnedBasic = parseFloat(((baseSalary / daysInMonth) * presentDays).toFixed(2));

    const rawOt = att?.total_ot || att?.ot_hours || row.ot_hours || row.total_ot || 0;
    const parsedOtHours = parseOtHours(rawOt);
    const otAmount = parseFloat((parsedOtHours * 50).toFixed(2));

    const putthaStatus = emp?.puttha_status || row.puttha_status || 'Yes';
    const isPutthaEligible = putthaStatus !== 'No' && presentDays >= 15;
    const putthaPrice = isPutthaEligible ? (perYesPutthaPrice > 0 ? perYesPutthaPrice : parseFloat(row.puttha_price || 0)) : 0;

    const grossSalary = parseFloat((earnedBasic + otAmount + putthaPrice).toFixed(2));
    const totalDeductions = parseFloat(row.total_deductions || 0);
    const rawNet = Math.max(0, grossSalary - totalDeductions);
    const netSalary = rawNet > 0 ? Math.ceil(rawNet / 10) * 10 : 0;

    const otDisplay = formatOtDisplay(parsedOtHours);

    updates.push({
      id: row.id,
      emp_code: row.emp_code,
      emp_name: row.emp_name,
      old_ot: row.ot_hours,
      old_ot_amount: row.ot_amount,
      old_gross: row.gross_salary,
      old_net: row.net_salary,
      new_ot_hours: parsedOtHours,
      new_ot_display: otDisplay,
      new_ot_amount: otAmount,
      new_gross: grossSalary,
      new_net: netSalary,
      update_payload: {
        basic_salary: baseSalary,
        payable_days: presentDays,
        ot_hours: parsedOtHours,
        ot_amount: otAmount,
        puttha_price: putthaPrice,
        gross_salary: grossSalary,
        net_salary: netSalary,
        updated_at: new Date().toISOString()
      }
    });
  }

  console.log('\n--- Recalculation Summary for August 2026 ---');
  console.table(updates.map(u => ({
    Code: u.emp_code,
    Name: u.emp_name,
    'Old OT': u.old_ot,
    'New OT': u.new_ot_display,
    'Old OT ₹': u.old_ot_amount,
    'New OT ₹': u.new_ot_amount,
    'Old Gross': u.old_gross,
    'New Gross': u.new_gross,
    'Old Net': u.old_net,
    'New Net': u.new_net
  })));

  console.log('\nUpdating records in Supabase...');
  for (const u of updates) {
    const { error } = await supabase
      .from('payroll')
      .update(u.update_payload)
      .eq('id', u.id);

    if (error) {
      console.error(`Error updating record for ${u.emp_name} (${u.emp_code}):`, error);
    }
  }

  console.log(`\n✓ Successfully updated ${updates.length} payroll records for August 2026!`);
}

recalculateAugustPayroll();
