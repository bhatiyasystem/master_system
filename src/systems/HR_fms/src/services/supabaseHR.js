/**
 * supabaseHR.js
 * Central Supabase service layer for HR FMS
 * Covers: attendance_uploads, attendance_monthly, employees, advances, putthas, payroll
 *
 * Uses its OWN Supabase project (VITE_HR_SUPABASE_URL / VITE_HR_SUPABASE_ANON_KEY)
 * — separate from the master system Supabase credentials.
 */

import supabase from './supabaseHRClient.js';
import masterSupabase from '../../../../SupabaseClient.js';

// Fetch puttha_status from the MASTER project's users table, keyed by name
export async function fetchMasterPutthaStatusByName() {
  const { data, error } = await masterSupabase
    .from('users')
    .select('user_name, puttha_status');
  if (error) throw error;
  const map = {};
  (data || []).forEach(u => {
    if (u.user_name) {
      map[u.user_name.trim().toLowerCase()] = u.puttha_status || 'Yes';
    }
  });
  return map;
}

// ─── Status code pay-value map ────────────────────────────────────────────────
export const STATUS_PAY_VALUE = {
  'P': 1,
  'p': 1,
  'P(OD)': 1,
  'HP': 1,
  'H': 1,
  'L': 1,
  'WOP': 1,
  '½P': 0.5,
  'WO': 0,
  'A': 0,
};

export const STATUS_COLORS = {
  'P': '#22c55e',
  'p': '#22c55e',
  'P(OD)': '#10b981',
  'HP': '#6366f1',
  'H': '#8b5cf6',
  'L': '#f59e0b',
  'WOP': '#3b82f6',
  '½P': '#84cc16',
  'WO': '#94a3b8',
  'A': '#ef4444',
};

export const STATUS_LABELS = {
  'P': 'Present',
  'p': 'Present',
  'P(OD)': 'Official Duty',
  'HP': 'Holiday Present',
  'H': 'Public Holiday',
  'L': 'Leave',
  'WOP': 'Weekly Off Present',
  '½P': 'Half Day',
  'WO': 'Weekly Off',
  'A': 'Absent',
};

// ─── EXCEL PARSER ─────────────────────────────────────────────────────────────

/**
 * Parse the Monthly Status Report Excel into structured data
 * @param {Array<Array>} rawRows - 2D array from XLSX.utils.sheet_to_json (with header:1)
 * @returns {{ uploadMeta, employees }}
 */
export function parseAttendanceExcel(rawRows) {
  // ── Find header row (contains "Emp. Code" or "Emp Code" and "Name" or "EmployeeName") ──
  let headerRowIdx = -1;
  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row) continue;
    const joined = row.map(c => String(c || '')).join(' ').toLowerCase();
    if (joined.includes('emp') && (joined.includes('code') || joined.includes('emp.code')) && (joined.includes('name') || joined.includes('employee'))) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) throw new Error('Could not find header row in Excel. Expected "Emp. Code" and "EmployeeName" (or "Name") columns.');

  const headers = rawRows[headerRowIdx].map(h => String(h || '').trim());

  // ── Detect period from rows above header ──
  let periodFrom = null, periodTo = null, company = 'Default', department = 'Default', printedOn = null;
  for (let i = 0; i < headerRowIdx; i++) {
    const row = rawRows[i] || [];
    const rowText = row.map(c => String(c || '')).join(' ');

    // Match "01/07/2026 To 31/07/2026" or "01-07-2026 To 31-07-2026"
    const slashPeriodMatch = rowText.match(/(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\s+To\s+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i);
    if (slashPeriodMatch) {
      const parseDateStr = (str) => {
        const parts = str.split(/[/.-]/);
        if (parts.length === 3) {
          return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
        return new Date(str);
      };
      const df = parseDateStr(slashPeriodMatch[1]);
      const dt = parseDateStr(slashPeriodMatch[2]);
      if (!isNaN(df)) periodFrom = df;
      if (!isNaN(dt)) periodTo = dt;
    }

    // Match "Apr 01 2026  To  Apr 30 2026"
    const periodMatch = rowText.match(/(\w+\s+\d+\s+\d{4})\s+To\s+(\w+\s+\d+\s+\d{4})/i);
    if (periodMatch) {
      const df = new Date(periodMatch[1]);
      const dt = new Date(periodMatch[2]);
      if (!isNaN(df)) periodFrom = df;
      if (!isNaN(dt)) periodTo = dt;
    }

    // Match company
    if (rowText.toLowerCase().includes('company')) {
      const parts = row.filter(c => c && String(c).trim());
      if (parts.length >= 2) company = String(parts[1]).trim();
    }

    // Match department
    if (rowText.toLowerCase().includes('department')) {
      const parts = row.filter(c => c && String(c).trim());
      if (parts.length >= 2) department = String(parts[1]).trim();
    }

    // Match "Printed On"
    const printedMatch = rowText.match(/Printed On\s*:\s*(\w+\s+\d+\s+\d{4})/i);
    if (printedMatch) {
      printedOn = new Date(printedMatch[1]);
    }
  }

  if (!periodFrom || isNaN(periodFrom)) {
    // Fallback: use current month
    periodFrom = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    periodTo = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
  }

  // ── Identify day columns (if present in detailed daily report) ──
  const dayColIndices = [];
  headers.forEach((h, idx) => {
    const m = h.match(/^(\d{1,2})\s+[A-Za-z]{1,3}$/);
    if (m) dayColIndices.push({ colIdx: idx, dayNum: parseInt(m[1]) });
  });

  // ── Summary column indices ──
  const cleanHeader = (h) => String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const findCol = (...keywords) => {
    return headers.findIndex(h => {
      const c = cleanHeader(h);
      return keywords.some(k => c.includes(cleanHeader(k)));
    });
  };

  const findExactCol = (...exactNames) => {
    return headers.findIndex(h => {
      const c = cleanHeader(h);
      return exactNames.some(e => c === cleanHeader(e));
    });
  };

  const summaryMap = {
    sl: findCol('sl', 'sn', 'sno', 'slno') !== -1 ? findCol('sl', 'sn', 'sno', 'slno') : 0,
    empCode: findCol('empcode', 'emp.code', 'emp code', 'code'),
    name: findCol('employeename', 'employee name', 'name', 'employee'),
    totalP: findExactCol('p') !== -1 ? findExactCol('p') : findCol('totalpresent', 'total present'),
    totalA: findExactCol('a') !== -1 ? findExactCol('a') : findCol('totalabsent', 'total absent'),
    totalH: findExactCol('h') !== -1 ? findExactCol('h') : findCol('totalholiday', 'holiday'),
    totalHP: findExactCol('hp') !== -1 ? findExactCol('hp') : findCol('halfpresent', 'half present'),
    totalWO: findExactCol('wo') !== -1 ? findExactCol('wo') : findCol('weeklyoff', 'weekly off'),
    totalWOP: findExactCol('wop') !== -1 ? findExactCol('wop') : findCol('wopresent', 'wo present'),
    totalCL: findExactCol('cl') !== -1 ? findExactCol('cl') : findCol('casualleave', 'casual leave'),
    totalPL: findExactCol('pl') !== -1 ? findExactCol('pl') : findCol('paidleave', 'paid leave'),
    totalSL: findExactCol('sl') !== -1 ? findExactCol('sl') : findCol('sickleave', 'sick leave'),
    totalOtherLeave: findCol('otherleave', 'other leave'),
    totalLeave: findCol('totalleave', 'total leave') !== -1 ? findCol('totalleave', 'total leave') : findExactCol('l'),
    totalPresent: findCol('totalpresent', 'total present'),
    totalPayDays: findCol('totalpaydays', 'total pay days', 'paydays', 'pay days', 'payable days', 'payabledays'),
    totalOT: findCol('totalot', 'total ot in hrs', 'total ot', 'otinhrs', 'ot'),
    totalLate: findCol('totallateby', 'total late by', 'totallate', 'total late', 'lateby', 'late'),
    totalEarly: findCol('totalearlyby', 'total early by', 'totalearly', 'total early', 'earlyby', 'early'),
  };

  // ── Parse employee rows ──
  const employees = [];
  for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
    const row = rawRows[i] || [];
    if (!row || row.every(c => c === null || c === undefined || String(c).trim() === '')) continue;

    const empCode = String(row[summaryMap.empCode] !== undefined ? row[summaryMap.empCode] : '').trim();
    const empName = String(row[summaryMap.name] !== undefined ? row[summaryMap.name] : '').trim();

    // Skip empty or header rows
    if (!empCode || !empName || empCode.toLowerCase().includes('code') || empName.toLowerCase().includes('name')) continue;

    // Build daily_status JSONB if day columns are present
    const dailyStatus = {};
    dayColIndices.forEach(({ colIdx, dayNum }) => {
      const cell = String(row[colIdx] || '').trim();
      if (cell) dailyStatus[dayNum] = cell;
    });

    const totalPresent = parseFloat(row[summaryMap.totalPresent] !== undefined && row[summaryMap.totalPresent] !== '' ? row[summaryMap.totalPresent] : (row[summaryMap.totalP] || 0)) || 0;
    const totalAbsent = parseFloat(row[summaryMap.totalA] || 0) || 0;
    const totalHoliday = parseFloat(row[summaryMap.totalH] || 0) || 0;
    const totalHalfPresent = parseFloat(row[summaryMap.totalHP] || 0) || 0;
    const totalWO = parseFloat(row[summaryMap.totalWO] || 0) || 0;
    const totalWOP = parseFloat(row[summaryMap.totalWOP] || 0) || 0;
    const totalCL = parseFloat(row[summaryMap.totalCL] || 0) || 0;
    const totalPL = parseFloat(row[summaryMap.totalPL] || 0) || 0;
    const totalSL = parseFloat(row[summaryMap.totalSL] || 0) || 0;
    const totalOtherLeave = parseFloat(row[summaryMap.totalOtherLeave] || 0) || 0;
    const totalLeave = parseFloat(row[summaryMap.totalLeave] !== undefined && row[summaryMap.totalLeave] !== '' ? row[summaryMap.totalLeave] : (totalCL + totalPL + totalSL + totalOtherLeave)) || 0;

    // Attendance / Payable Days calculation logic: P + WO + H + HP + WOP (+ Leave)
    const formulaDays = totalPresent + totalWO + totalHoliday + totalHalfPresent + totalWOP + totalLeave;

    let payableDays = formulaDays;
    if (summaryMap.totalPayDays !== -1 && row[summaryMap.totalPayDays] !== undefined && String(row[summaryMap.totalPayDays]).trim() !== '') {
      const explicitPayDays = parseFloat(row[summaryMap.totalPayDays]);
      if (!isNaN(explicitPayDays) && explicitPayDays > 0) {
        payableDays = explicitPayDays;
      }
    }

    const totalOT = String(row[summaryMap.totalOT] !== undefined ? row[summaryMap.totalOT] : '00:00').trim();
    const totalLate = parseFloat(row[summaryMap.totalLate] || 0) || 0;
    const totalEarly = parseFloat(row[summaryMap.totalEarly] || 0) || 0;

    employees.push({
      sl_no: employees.length + 1,
      emp_code: empCode,
      emp_name: empName,
      daily_status: dailyStatus,
      total_present: totalPresent,
      total_absent: totalAbsent,
      total_leave: totalLeave,
      total_holiday: totalHoliday,
      total_half_present: totalHalfPresent,
      total_wo: totalWO,
      total_wop: totalWOP,
      total_cl: totalCL,
      total_pl: totalPL,
      total_sl: totalSL,
      total_other_leave: totalOtherLeave,
      payable_days: payableDays,
      total_ot: totalOT,
      total_late: totalLate,
      total_early: totalEarly,
    });
  }

  return {
    uploadMeta: {
      period_from: periodFrom.toISOString().slice(0, 10),
      period_to: periodTo.toISOString().slice(0, 10),
      company_name: company,
      department,
      printed_on: printedOn ? printedOn.toISOString().slice(0, 10) : null,
    },
    employees,
  };
}

// ─── ATTENDANCE UPLOADS ───────────────────────────────────────────────────────

export async function createUploadRecord({ periodFrom, periodTo, companyName, department, printedOn, fileName, uploadedBy, year, month }) {
  const { data, error } = await supabase
    .from('attendance_uploads')
    .insert({
      period_from: periodFrom,
      period_to: periodTo,
      company_name: companyName || 'Default',
      department: department || 'Default',
      printed_on: printedOn || null,
      file_name: fileName,
      uploaded_by: uploadedBy || null,
      status: 'processing',
      ...(year && { year }),
      ...(month && { month }),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateUploadRecord(id, updates) {
  const { data, error } = await supabase
    .from('attendance_uploads')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchUploads({ year, month } = {}) {
  let query = supabase
    .from('attendance_uploads')
    .select('*')
    .order('created_at', { ascending: false });

  if (year) query = query.eq('year', year);
  if (month) query = query.eq('month', month);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// ─── ATTENDANCE MONTHLY ───────────────────────────────────────────────────────

export async function saveAttendanceRows(uploadId, employees, year, month, companyName, department) {
  const rows = employees.map(emp => ({
    upload_id: uploadId,
    year,
    month,
    company_name: companyName || 'Default',
    department: department || 'Default',
    sl_no: emp.sl_no,
    emp_code: emp.emp_code,
    emp_name: emp.emp_name,
    daily_status: emp.daily_status,
    total_present: emp.total_present,
    total_absent: emp.total_absent,
    total_leave: emp.total_leave,
    total_holiday: emp.total_holiday,
    total_half_present: emp.total_half_present,
    total_wo: emp.total_wo,
    total_wop: emp.total_wop,
    payable_days: emp.payable_days,
  }));

  // Upsert: update on conflict (same emp_code, year, month, company)
  const { data, error } = await supabase
    .from('attendance_monthly')
    .upsert(rows, {
      onConflict: 'emp_code,year,month,company_name',
      ignoreDuplicates: false,
    })
    .select();

  if (error) throw error;
  return data;
}

export async function fetchAttendanceMonthly({ year, month, companyName, empCode } = {}) {
  let query = supabase
    .from('attendance_monthly')
    .select('*')
    .order('sl_no', { ascending: true });

  if (year) query = query.eq('year', year);
  if (month) query = query.eq('month', month);
  if (companyName) query = query.eq('company_name', companyName);
  if (empCode) query = query.eq('emp_code', empCode);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function updatePayableDaysOverride(id, overrideDays, reason) {
  const { data, error } = await supabase
    .from('attendance_monthly')
    .update({
      payable_days_override: overrideDays,
      override_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── EMPLOYEE SALARY CONFIG ───────────────────────────────────────────────────

export async function fetchSalaryConfigs({ empCode, activeOnly = true } = {}) {
  let query = supabase
    .from('employee_salary_config')
    .select('*')
    .order('effective_from', { ascending: false });

  if (empCode) query = query.eq('emp_code', empCode);
  if (activeOnly) query = query.eq('is_active', true);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function upsertSalaryConfig(config) {
  const { data, error } = await supabase
    .from('employee_salary_config')
    .upsert(config, { onConflict: 'emp_code,effective_from' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deactivateSalaryConfig(id) {
  const { error } = await supabase
    .from('employee_salary_config')
    .update({ is_active: false })
    .eq('id', id);
  if (error) throw error;
}

// ─── PAYROLL ──────────────────────────────────────────────────────────────────

/**
 * Calculate payroll for a single employee based on simplified columns and daily rate formula
 */
export function calculatePayroll(employee, payableDays, totalDaysInMonth, putthaPrice = 0, advance = 0, loanDeduction = 0, salaryAdvanceDeduction = 0) {
  const monthlySalary = parseFloat(employee.salary || 0);

  // Basic Salary matches Employee Management salary directly
  const basicSalary = parseFloat(monthlySalary.toFixed(2));

  // Gross Salary = Basic Salary + Puttha Price
  const gross = parseFloat((basicSalary + putthaPrice).toFixed(2));

  // Deductions
  const loanDed = parseFloat(loanDeduction.toFixed(2));
  const salAdvDed = parseFloat(salaryAdvanceDeduction.toFixed(2));
  const totalDeductions = parseFloat((loanDed + salAdvDed).toFixed(2));

  // Net Salary = Gross Salary - Total Deductions
  // Roundoff UPWARDS to nearest 10 (e.g. 5381 -> 5390, not 5380)
  const rawNet = parseFloat((gross - totalDeductions).toFixed(2));
  const net = rawNet > 0 ? Math.ceil(rawNet / 10) * 10 : 0;

  return {
    basic_salary: basicSalary,
    puttha_price: putthaPrice,
    gross_salary: gross,
    advance: advance,
    loan_deduction: loanDed,
    salary_advance_deduction: salAdvDed,
    advance_deduction: totalDeductions, // for backward compatibility
    total_deductions: totalDeductions,
    net_salary: net,
  };
}

/**
 * Reverts a previously deducted advance amount by adding it back to the employee's active advances.
 * If an advance was fully paid, its status is set back to 'Approved'.
 */
export async function revertAdvanceDeduction(empCode, revertAmount) {
  if (revertAmount <= 0) return;

  const { data: advs, error } = await supabase
    .from('advances')
    .select('*')
    .eq('employee_id', empCode)
    .in('status', ['Approved', 'Fully Paid'])
    .order('date', { ascending: false }); // Revert newest first

  if (error || !advs || advs.length === 0) return;

  let remainingToRevert = revertAmount;
  for (const adv of advs) {
    const originalAmount = parseFloat(adv.amount) || 0;
    const currentRemaining = parseFloat(adv.remaining_amount !== null && adv.remaining_amount !== undefined ? adv.remaining_amount : adv.amount) || 0;
    const capacity = originalAmount - currentRemaining;
    if (capacity <= 0) continue;

    const toRestore = Math.min(remainingToRevert, capacity);
    const newRemaining = parseFloat((currentRemaining + toRestore).toFixed(2));
    remainingToRevert -= toRestore;

    // If it was Fully Paid and now has remaining balance, set status back to Approved
    const newStatus = newRemaining > 0 ? 'Approved' : adv.status;

    await supabase
      .from('advances')
      .update({
        remaining_amount: newRemaining,
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', adv.id);

    if (remainingToRevert <= 0) break;
  }
}

export async function revertSalaryAdvanceDeduction(empCode, revertAmount) {
  if (revertAmount <= 0) return;

  const { data: advs, error } = await supabase
    .from('salary_advances')
    .select('*')
    .eq('employee_id', empCode)
    .in('status', ['Approved', 'Deducted'])
    .order('date', { ascending: false }); // Revert newest first

  if (error || !advs || advs.length === 0) return;

  let remainingToRevert = revertAmount;
  for (const adv of advs) {
    const currentAmount = parseFloat(adv.amount) || 0;

    // We don't have original amount, so we just restore to this advance. 
    // In practice, it's a one-time deduction so this will usually just be the full amount restoring.
    const toRestore = remainingToRevert;
    const newAmount = parseFloat((currentAmount + toRestore).toFixed(2));
    remainingToRevert -= toRestore;

    await supabase
      .from('salary_advances')
      .update({
        amount: newAmount,
        status: 'Approved',
        deducted_in_payroll_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', adv.id);

    if (remainingToRevert <= 0) break;
  }
}

export async function generatePayrollBatch(attendanceRows, employeeMap) {
  const payrollRows = [];

  if (attendanceRows.length === 0) return [];
  const { year, month } = attendanceRows[0];

  // Calculate total days in the selected month
  const totalDaysInMonth = new Date(year, month, 0).getDate();

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(totalDaysInMonth).padStart(2, '0')}`;

  // ── 1. Revert previous deductions for this month to prevent double-deduction ──
  const { data: existingPayrolls, error: existingPayrollsError } = await supabase
    .from('payroll')
    .select('id, emp_code, advance_deduction, loan_deduction, salary_advance_deduction')
    .eq('year', year)
    .eq('month', month);

  if (!existingPayrollsError && existingPayrolls && existingPayrolls.length > 0) {
    const revertPromises = [];
    for (const ep of existingPayrolls) {
      const prevLoanDec = parseFloat(ep.loan_deduction !== null ? ep.loan_deduction : ep.advance_deduction) || 0;
      if (prevLoanDec > 0) {
        revertPromises.push(revertAdvanceDeduction(ep.emp_code, prevLoanDec));
      }

      const prevSalAdvDec = parseFloat(ep.salary_advance_deduction) || 0;
      if (prevSalAdvDec > 0) {
        revertPromises.push(revertSalaryAdvanceDeduction(ep.emp_code, prevSalAdvDec));
      }
    }
    if (revertPromises.length > 0) {
      await Promise.all(revertPromises);
    }
  }

  // ── 2, 3, 4, 5. Fetch all required datasets IN PARALLEL ──
  const [advancesRes, activeAdvsRes, putthasRes, salAdvsRes] = await Promise.all([
    supabase.from('advances').select('employee_id, amount').eq('status', 'Approved').gte('date', startDate).lte('date', endDate),
    supabase.from('advances').select('*').eq('status', 'Approved').order('date', { ascending: true }),
    supabase.from('putthas').select('total_price').eq('status', 'Approved').gte('date', startDate).lte('date', endDate),
    supabase.from('salary_advances').select('*').eq('status', 'Approved').eq('deduction', 'Yes').order('date', { ascending: true })
  ]);

  const advances = advancesRes.data || [];
  const allActiveAdvances = activeAdvsRes.data || [];
  const putthas = putthasRes.data || [];
  const allSalaryAdvs = salAdvsRes.data || [];

  const advanceMap = {};
  advances.forEach(adv => {
    const empCode = adv.employee_id;
    advanceMap[empCode] = (advanceMap[empCode] || 0) + (parseFloat(adv.amount) || 0);
  });

  const employeeActiveAdvs = {};
  allActiveAdvances.forEach(adv => {
    const empCode = adv.employee_id;
    const remaining = parseFloat(adv.remaining_amount !== null && adv.remaining_amount !== undefined ? adv.remaining_amount : adv.amount) || 0;
    if (remaining > 0) {
      if (!employeeActiveAdvs[empCode]) {
        employeeActiveAdvs[empCode] = [];
      }
      employeeActiveAdvs[empCode].push({
        ...adv,
        remaining
      });
    }
  });

  let totalPutthaAmount = 0;
  putthas.forEach(p => {
    totalPutthaAmount += parseFloat(p.total_price) || 0;
  });

  const employeeSalaryAdvs = {};
  allSalaryAdvs.forEach(adv => {
    const empCode = adv.employee_id;
    if (!employeeSalaryAdvs[empCode]) {
      employeeSalaryAdvs[empCode] = [];
    }
    employeeSalaryAdvs[empCode].push(adv);
  });

  // ── Determine eligible employees (payable_days >= 15) ──────────────────────
  const eligibleRows = attendanceRows.filter(att => {
    const days = parseFloat(att.payable_days_override ?? att.payable_days) || 0;
    const emp = employeeMap[att.emp_code];
    return emp && days >= 15 && (emp.puttha_status || 'Yes') !== 'No';
  });
  const eligibleCount = eligibleRows.length;

  const putthaPerEmployee = eligibleCount > 0
    ? parseFloat((totalPutthaAmount / eligibleCount).toFixed(2))
    : 0;

  const advanceUpdatesToPerform = [];

  // ── Build payroll rows ──────────────────────────────────────────────────────
  for (const att of attendanceRows) {
    const employee = employeeMap[att.emp_code];
    if (!employee) continue;

    const empCode = att.emp_code;
    const payableDays = parseFloat(att.payable_days_override ?? att.payable_days) || 0;
    const putthaPrice = (payableDays >= 15 && (employee.puttha_status || 'Yes') !== 'No') ? putthaPerEmployee : 0;
    const advanceAmount = parseFloat(advanceMap[empCode] || 0);

    let loanDeduction = 0;
    const empAdvs = employeeActiveAdvs[empCode] || [];
    for (const adv of empAdvs) {
      if (adv.deduction === 'No') continue;

      const monthlyDec = parseFloat(adv.monthly_deduction) || 0;
      if (monthlyDec <= 0 || adv.remaining <= 0) continue;

      const dec = Math.min(monthlyDec, adv.remaining);
      const newRemaining = parseFloat((adv.remaining - dec).toFixed(2));

      advanceUpdatesToPerform.push({
        id: adv.id,
        remaining_amount: newRemaining,
        status: newRemaining <= 0 ? 'Fully Paid' : 'Approved',
        updated_at: new Date().toISOString()
      });

      adv.remaining = newRemaining;
      loanDeduction += dec;
    }

    const tempCalc = calculatePayroll(employee, payableDays, totalDaysInMonth, putthaPrice, advanceAmount, loanDeduction, 0);
    let currentNetSalary = tempCalc.net_salary;

    let salaryAdvanceDeduction = 0;
    const empSalAdvs = employeeSalaryAdvs[empCode] || [];
    const salaryAdvsToUpdate = [];

    for (const adv of empSalAdvs) {
      const amount = parseFloat(adv.amount) || 0;
      if (amount <= 0) continue;

      const deductionAmount = Math.min(amount, currentNetSalary);
      if (deductionAmount <= 0) continue;

      salaryAdvanceDeduction += deductionAmount;
      currentNetSalary -= deductionAmount;

      salaryAdvsToUpdate.push({
        id: adv.id,
        newAmount: parseFloat((amount - deductionAmount).toFixed(2)),
        status: deductionAmount >= amount ? 'Deducted' : 'Approved'
      });
    }

    const calc = calculatePayroll(employee, payableDays, totalDaysInMonth, putthaPrice, advanceAmount, loanDeduction, salaryAdvanceDeduction);

    payrollRows.push({
      emp_code: att.emp_code,
      emp_name: employee.name,
      year: att.year,
      month: att.month,
      payable_days: payableDays,
      puttha_status: employee.puttha_status || 'Yes',
      ...calc,
      status: 'draft',
      _salaryAdvsUpdates: salaryAdvsToUpdate
    });
  }

  if (payrollRows.length === 0) return [];

  // Batch update advance remaining balances in parallel
  if (advanceUpdatesToPerform.length > 0) {
    await Promise.all(
      advanceUpdatesToPerform.map(upd =>
        supabase.from('advances').update({
          remaining_amount: upd.remaining_amount,
          status: upd.status,
          updated_at: upd.updated_at
        }).eq('id', upd.id)
      )
    );
  }

  // Upsert payroll rows in single bulk batch
  const dbRows = payrollRows.map(({ _salaryAdvsUpdates, ...rest }) => rest);
  const { data, error } = await supabase
    .from('payroll')
    .upsert(dbRows, { onConflict: 'emp_code,year,month' })
    .select();

  if (error) throw error;

  // Batch update salary advances in parallel
  const salAdvPromises = [];
  for (const pr of data) {
    const rowObj = payrollRows.find(r => r.emp_code === pr.emp_code);
    if (rowObj && rowObj._salaryAdvsUpdates) {
      for (const advUpd of rowObj._salaryAdvsUpdates) {
        salAdvPromises.push(
          supabase
            .from('salary_advances')
            .update({
              amount: advUpd.newAmount,
              status: advUpd.status,
              deducted_in_payroll_id: advUpd.status === 'Deducted' ? pr.id : null,
              updated_at: new Date().toISOString()
            })
            .eq('id', advUpd.id)
        );
      }
    }
  }

  if (salAdvPromises.length > 0) {
    await Promise.all(salAdvPromises);
  }

  return data;
}

export async function fetchPayroll({ year, month, status, empCode } = {}) {
  let query = supabase
    .from('payroll')
    .select('*')
    .order('emp_name', { ascending: true });

  if (year) query = query.eq('year', year);
  if (month) query = query.eq('month', month);
  if (status) query = query.eq('status', status);
  if (empCode) query = query.eq('emp_code', empCode);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// ─── SERVER-SIDE PAGINATED FETCH HELPERS ─────────────────────────────────────

export async function fetchEmployeesPaginated({ page = 1, pageSize = 50, search = '', status = '' } = {}) {
  const from = (page - 1) * pageSize;
  const to = page * pageSize - 1;

  let query = supabase
    .from('employees')
    .select('*', { count: 'exact' })
    .order('name', { ascending: true });

  if (status) {
    query = query.eq('status', status);
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,employee_id.ilike.%${search}%,designation.ilike.%${search}%,work_location.ilike.%${search}%`);
  }

  const { data, count, error } = await query.range(from, to);
  if (error) throw error;

  return {
    data: data || [],
    totalRecords: count || 0,
    currentPage: page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  };
}

export async function fetchAttendanceMonthlyPaginated({ year, month, page = 1, pageSize = 50, search = '' } = {}) {
  const from = (page - 1) * pageSize;
  const to = page * pageSize - 1;

  let query = supabase
    .from('attendance_monthly')
    .select('*', { count: 'exact' })
    .order('emp_name', { ascending: true });

  if (year) query = query.eq('year', year);
  if (month) query = query.eq('month', month);
  if (search) {
    query = query.or(`emp_name.ilike.%${search}%,emp_code.ilike.%${search}%`);
  }

  const { data, count, error } = await query.range(from, to);
  if (error) throw error;

  return {
    data: data || [],
    totalRecords: count || 0,
    currentPage: page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  };
}

export async function fetchPayrollPaginated({ year, month, status, empCode, search = '', page = 1, pageSize = 50 } = {}) {
  const from = (page - 1) * pageSize;
  const to = page * pageSize - 1;

  let query = supabase
    .from('payroll')
    .select('*', { count: 'exact' })
    .order('emp_name', { ascending: true });

  if (year) query = query.eq('year', year);
  if (month) query = query.eq('month', month);
  if (status) query = query.eq('status', status);
  if (empCode) query = query.eq('emp_code', empCode);
  if (search) {
    query = query.or(`emp_name.ilike.%${search}%,emp_code.ilike.%${search}%`);
  }

  let { data, count, error } = await query.range(from, to);
  if (error) throw error;

  // Sync latest puttha_status from employees master table & recalculate if any eligible employee has 0 puttha price
  if (data && data.length > 0) {
    let needsRecalc = false;

    const empCodes = [...new Set(data.map(r => r.emp_code))];
    const { data: emps } = await supabase
      .from('employees')
      .select('employee_id, puttha_status')
      .in('employee_id', empCodes);

    if (emps && emps.length > 0) {
      const empStatusMap = {};
      emps.forEach(e => {
        empStatusMap[e.employee_id] = e.puttha_status || 'Yes';
      });

      data.forEach(r => {
        if (empStatusMap[r.emp_code] && empStatusMap[r.emp_code] !== r.puttha_status) {
          r.puttha_status = empStatusMap[r.emp_code];
          needsRecalc = true;
        }
      });
    }

    // Check if any row has non-zero puttha_price, but some eligible employees still have 0.00
    const hasBatchPuttha = data.some(r => (parseFloat(r.puttha_price) || 0) > 0);
    if (hasBatchPuttha) {
      const hasMissingPuttha = data.some(r => (r.puttha_status || 'Yes') !== 'No' && (parseFloat(r.payable_days) || 0) >= 15 && (parseFloat(r.puttha_price) || 0) === 0);
      if (hasMissingPuttha) {
        needsRecalc = true;
      }
    }

    // Check if any row has net_salary that is not rounded UPWARDS to nearest 10 (e.g., 5381 -> 5390)
    data.forEach(r => {
      const rawNet = Math.max(0, (parseFloat(r.gross_salary) || 0) - (parseFloat(r.total_deductions) || 0));
      const expectedNet = rawNet > 0 ? Math.ceil(rawNet / 10) * 10 : 0;
      if (parseFloat(r.net_salary) !== expectedNet) {
        needsRecalc = true;
      }
    });

    if (needsRecalc && year && month) {
      await recalculateMonthPutthaAndPayroll(year, month);
      let refetchQuery = supabase
        .from('payroll')
        .select('*', { count: 'exact' })
        .order('emp_name', { ascending: true });

      if (year) refetchQuery = refetchQuery.eq('year', year);
      if (month) refetchQuery = refetchQuery.eq('month', month);
      if (status) refetchQuery = refetchQuery.eq('status', status);
      if (empCode) refetchQuery = refetchQuery.eq('emp_code', empCode);
      if (search) {
        refetchQuery = refetchQuery.or(`emp_name.ilike.%${search}%,emp_code.ilike.%${search}%`);
      }
      const refetchRes = await refetchQuery.range(from, to);
      if (refetchRes.data) data = refetchRes.data;
    }
  }

  return {
    data: data || [],
    totalRecords: count || 0,
    currentPage: page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  };
}

export async function fetchAdvancesPaginated({ page = 1, pageSize = 50, search = '' } = {}) {
  const from = (page - 1) * pageSize;
  const to = page * pageSize - 1;

  let query = supabase
    .from('advances')
    .select('*', { count: 'exact' })
    .order('date', { ascending: false });

  if (search) {
    query = query.or(`employee_name.ilike.%${search}%,employee_id.ilike.%${search}%`);
  }

  const { data, count, error } = await query.range(from, to);
  if (error) throw error;

  return {
    data: data || [],
    totalRecords: count || 0,
    currentPage: page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  };
}

export async function fetchSalaryConfigsPaginated({ page = 1, pageSize = 50, search = '' } = {}) {
  const from = (page - 1) * pageSize;
  const to = page * pageSize - 1;

  let query = supabase
    .from('employee_salary_config')
    .select('*', { count: 'exact' })
    .order('emp_name', { ascending: true });

  if (search) {
    query = query.or(`emp_name.ilike.%${search}%,emp_code.ilike.%${search}%`);
  }

  const { data, count, error } = await query.range(from, to);
  if (error) throw error;

  return {
    data: data || [],
    totalRecords: count || 0,
    currentPage: page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  };
}

export async function updatePayrollRow(id, updates) {
  const { data, error } = await supabase
    .from('payroll')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePayrollStatus(ids, status) {
  const { data, error } = await supabase
    .from('payroll')
    .update({ status, updated_at: new Date().toISOString() })
    .in('id', ids)
    .select();
  if (error) throw error;
  return data;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function getMonthNumber(monthName) {
  return MONTHS.findIndex(m => m.toLowerCase() === monthName.toLowerCase()) + 1;
}

// ─── EMPLOYEES ────────────────────────────────────────────────────────────────

export async function fetchEmployees() {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return data;
}

export async function recalculateMonthPutthaAndPayroll(year, month) {
  if (!year || !month) return;

  const totalDaysInMonth = new Date(year, month, 0).getDate();
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(totalDaysInMonth).padStart(2, '0')}`;

  // Fetch total approved puttha amount for this month
  const { data: putthas } = await supabase
    .from('putthas')
    .select('total_price')
    .gte('date', startDate)
    .lte('date', endDate);

  let totalPutthaAmount = 0;
  (putthas || []).forEach(p => {
    totalPutthaAmount += parseFloat(p.total_price) || 0;
  });

  // Fetch all payroll rows for this year and month
  const { data: payrollRows, error } = await supabase
    .from('payroll')
    .select('*')
    .eq('year', year)
    .eq('month', month);

  if (error || !payrollRows || payrollRows.length === 0) return;

  // Count eligible employees (payable_days >= 15 and puttha_status != 'No')
  const eligibleRows = payrollRows.filter(r => {
    const days = parseFloat(r.payable_days) || 0;
    return days >= 15 && (r.puttha_status || 'Yes') !== 'No';
  });
  const eligibleCount = eligibleRows.length;

  // Determine the per-employee puttha share for the batch
  let batchPutthaPrice = 0;
  if (totalPutthaAmount > 0 && eligibleCount > 0) {
    batchPutthaPrice = parseFloat((totalPutthaAmount / eligibleCount).toFixed(2));
  } else {
    // Fallback: use existing non-zero puttha_price in the batch if available
    const existingRow = payrollRows.find(r => (parseFloat(r.puttha_price) || 0) > 0);
    if (existingRow) {
      batchPutthaPrice = parseFloat(existingRow.puttha_price);
    }
  }

  // Fetch latest employee salaries
  const empCodes = [...new Set(payrollRows.map(r => r.emp_code))];
  const { data: emps } = await supabase
    .from('employees')
    .select('employee_id, salary')
    .in('employee_id', empCodes);

  const empSalaryMap = {};
  (emps || []).forEach(e => {
    if (e.salary !== undefined && e.salary !== null) {
      empSalaryMap[e.employee_id] = parseFloat(e.salary) || 0;
    }
  });

  // Update every payroll row in the batch
  for (const row of payrollRows) {
    const days = parseFloat(row.payable_days) || 0;
    const isEligible = days >= 15 && (row.puttha_status || 'Yes') !== 'No';

    const putthaPrice = isEligible ? batchPutthaPrice : 0;
    const basicSalary = empSalaryMap[row.emp_code] !== undefined
      ? empSalaryMap[row.emp_code]
      : parseFloat(row.basic_salary || 0);
    const newGross = parseFloat((basicSalary + putthaPrice).toFixed(2));
    const totalDeductions = parseFloat(row.total_deductions || 0);
    const rawNet = Math.max(0, newGross - totalDeductions);
    const newNet = rawNet > 0 ? Math.ceil(rawNet / 10) * 10 : 0;

    await supabase
      .from('payroll')
      .update({
        basic_salary: basicSalary,
        puttha_price: putthaPrice,
        gross_salary: newGross,
        net_salary: newNet,
        updated_at: new Date().toISOString()
      })
      .eq('id', row.id);
  }
}

export async function syncPayrollForEmployeeSalary(empCode, salary) {
  if (!empCode || salary === undefined || salary === null) return;
  const basicSalary = parseFloat(salary) || 0;

  const { data: payrollRows, error } = await supabase
    .from('payroll')
    .select('*')
    .eq('emp_code', empCode);

  if (error || !payrollRows || payrollRows.length === 0) return;

  for (const row of payrollRows) {
    const putthaPrice = parseFloat(row.puttha_price || 0);
    const newGross = parseFloat((basicSalary + putthaPrice).toFixed(2));
    const totalDeductions = parseFloat(row.total_deductions || 0);
    const rawNet = Math.max(0, newGross - totalDeductions);
    const newNet = rawNet > 0 ? Math.ceil(rawNet / 10) * 10 : 0;

    await supabase
      .from('payroll')
      .update({
        basic_salary: basicSalary,
        gross_salary: newGross,
        net_salary: newNet,
        updated_at: new Date().toISOString()
      })
      .eq('id', row.id);
  }
}

export async function syncPayrollForEmployeePutthaStatus(empCode, putthaStatus) {
  if (!empCode) return;
  const { data: payrollRows, error } = await supabase
    .from('payroll')
    .select('*')
    .eq('emp_code', empCode);

  if (!error && payrollRows && payrollRows.length > 0) {
    for (const row of payrollRows) {
      await supabase
        .from('payroll')
        .update({ puttha_status: putthaStatus || 'Yes' })
        .eq('id', row.id);

      await recalculateMonthPutthaAndPayroll(row.year, row.month);
    }
  }
}

export async function upsertEmployee(employee) {
  const { data, error } = await supabase
    .from('employees')
    .upsert(employee, { onConflict: 'employee_id' })
    .select()
    .single();
  if (error) throw error;

  if (employee.employee_id) {
    try {
      if (employee.puttha_status) {
        await syncPayrollForEmployeePutthaStatus(employee.employee_id, employee.puttha_status);
      }
      if (employee.salary !== undefined) {
        await syncPayrollForEmployeeSalary(employee.employee_id, employee.salary);
      }
    } catch (e) {
      console.error('Error syncing payroll for employee:', e);
    }
  }

  return data;
}

// Directly update an employee's puttha status by employee_id (source of truth for payroll)
export async function updateEmployeePutthaStatus(employeeId, status) {
  const { data, error } = await supabase
    .from('employees')
    .update({ puttha_status: status })
    .eq('employee_id', employeeId)
    .select();
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(`No employee found with employee_id "${employeeId}" — puttha status was not updated.`);
  }

  try {
    await syncPayrollForEmployeePutthaStatus(employeeId, status);
  } catch (e) {
    console.error('Error syncing payroll puttha status:', e);
  }

  return data[0];
}

export async function bulkUpsertEmployees(employees) {
  const { data, error } = await supabase
    .from('employees')
    .upsert(employees, { onConflict: 'employee_id' })
    .select();
  if (error) throw error;

  if (Array.isArray(employees)) {
    for (const emp of employees) {
      if (emp.employee_id) {
        try {
          if (emp.puttha_status) {
            await syncPayrollForEmployeePutthaStatus(emp.employee_id, emp.puttha_status);
          }
          if (emp.salary !== undefined) {
            await syncPayrollForEmployeeSalary(emp.employee_id, emp.salary);
          }
        } catch (e) {
          console.error('Error syncing payroll for employee bulk update:', e);
        }
      }
    }
  }

  return data;
}

export async function deleteEmployee(id) {
  const { error } = await supabase
    .from('employees')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ─── ADVANCES ────────────────────────────────────────────────────────────────

export async function fetchAdvances() {
  const { data, error } = await supabase
    .from('advances')
    .select('*')
    .order('date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function upsertAdvance(advance) {
  const { data, error } = await supabase
    .from('advances')
    .upsert(advance)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateAdvanceStatus(id, status) {
  const { data, error } = await supabase
    .from('advances')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAdvance(id) {
  const { error } = await supabase
    .from('advances')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ─── SALARY ADVANCES ────────────────────────────────────────────────────────

export async function syncPayrollForEmployeeAdvance(empCode) {
  if (!empCode) return;

  const { data: salAdvs } = await supabase
    .from('salary_advances')
    .select('amount')
    .eq('employee_id', empCode)
    .in('status', ['Approved', 'Deducted']);

  const totalSalAdv = (salAdvs || []).reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);

  const { data: payrollRows } = await supabase
    .from('payroll')
    .select('*')
    .eq('emp_code', empCode);

  if (!payrollRows || payrollRows.length === 0) return;

  for (const row of payrollRows) {
    const gross = parseFloat(row.gross_salary) || 0;
    const loanDed = parseFloat(row.loan_deduction) || 0;
    const otherDed = parseFloat(row.other_deduction) || 0;
    const pfDed = parseFloat(row.pf_deduction) || 0;
    const esiDed = parseFloat(row.esi_deduction) || 0;

    const newTotalDed = totalSalAdv + loanDed + otherDed + pfDed + esiDed;
    const rawNet = gross - newTotalDed;
    const newNet = rawNet > 0 ? Math.ceil(rawNet / 10) * 10 : 0;

    await supabase
      .from('payroll')
      .update({
        advance_deduction: totalSalAdv,
        salary_advance_deduction: totalSalAdv,
        total_deduction: newTotalDed,
        net_salary: newNet,
        updated_at: new Date().toISOString()
      })
      .eq('id', row.id);
  }
}

export async function fetchSalaryAdvances() {
  const { data, error } = await supabase
    .from('salary_advances')
    .select('*')
    .order('date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function upsertSalaryAdvance(advance) {
  const { data, error } = await supabase
    .from('salary_advances')
    .upsert(advance)
    .select()
    .single();
  if (error) throw error;

  if (advance.employee_id) {
    try {
      await syncPayrollForEmployeeAdvance(advance.employee_id);
    } catch (e) {
      console.error('Error syncing payroll for salary advance:', e);
    }
  }

  return data;
}

export async function updateSalaryAdvanceStatus(id, status) {
  const { data, error } = await supabase
    .from('salary_advances')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;

  if (data && data.employee_id) {
    try {
      await syncPayrollForEmployeeAdvance(data.employee_id);
    } catch (e) {
      console.error('Error syncing payroll for salary advance status:', e);
    }
  }

  return data;
}

export async function deleteSalaryAdvance(id) {
  const { data: existing } = await supabase
    .from('salary_advances')
    .select('employee_id')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('salary_advances')
    .delete()
    .eq('id', id);
  if (error) throw error;

  if (existing && existing.employee_id) {
    try {
      await syncPayrollForEmployeeAdvance(existing.employee_id);
    } catch (e) {
      console.error('Error syncing payroll after deleting salary advance:', e);
    }
  }
}

// ─── PAYSLIPS ────────────────────────────────────────────────────────────────

/**
 * Fetch all data needed to render a payslip PDF for one employee-month.
 * Returns { payroll, employee, attendance } — any may be null if not found.
 */
export async function fetchPayslipData(empCode, year, month) {
  const [{ data: payroll }, { data: employee }, { data: attendance }] = await Promise.all([
    supabase.from('payroll').select('*').eq('emp_code', empCode).eq('year', year).eq('month', month).maybeSingle(),
    supabase.from('employees').select('*').eq('employee_id', empCode).maybeSingle(),
    supabase.from('attendance_monthly').select('*').eq('emp_code', empCode).eq('year', year).eq('month', month).maybeSingle(),
  ]);
  return { payroll, employee, attendance };
}

/**
 * Upsert a payslip record and upload the PDF blob to storage bucket "payslips".
 * Bucket name: payslips
 * Path pattern: {year}/{month_padded}/{emp_code}.pdf
 */
export async function savePayslip({ payrollId, empCode, empName, year, month, pdfBlob }) {
  const monthPadded = String(month).padStart(2, '0');
  const storagePath = `${year}/${monthPadded}/${empCode}.pdf`;

  // Upload PDF to storage (upsert)
  const { error: uploadError } = await supabase.storage
    .from('payslips')
    .upload(storagePath, pdfBlob, {
      contentType: 'application/pdf',
      upsert: true,
    });
  if (uploadError) throw uploadError;

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('payslips')
    .getPublicUrl(storagePath);
  const pdfUrl = urlData?.publicUrl || null;

  // Upsert record in payslips table
  const { data, error } = await supabase
    .from('payslips')
    .upsert({
      payroll_id: payrollId,
      emp_code: empCode,
      emp_name: empName,
      year,
      month,
      pdf_url: pdfUrl,
      storage_path: storagePath,
      generated_at: new Date().toISOString(),
    }, { onConflict: 'emp_code,year,month' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchPayslips({ year, month, empCode } = {}) {
  let query = supabase
    .from('payslips')
    .select('*')
    .order('emp_name', { ascending: true });

  if (year) query = query.eq('year', year);
  if (month) query = query.eq('month', month);
  if (empCode) query = query.eq('emp_code', empCode);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function deletePayslip(id) {
  const { error } = await supabase
    .from('payslips')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ─── PUTTHAS ──────────────────────────────────────────────────────────────────

export async function fetchPutthas({ empCode, status, startDate, endDate } = {}) {
  let query = supabase
    .from('putthas')
    .select('*')
    .order('date', { ascending: false });

  if (empCode) query = query.eq('employee_id', empCode);
  if (status) query = query.eq('status', status);
  if (startDate) query = query.gte('date', startDate);
  if (endDate) query = query.lte('date', endDate);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function upsertPuttha(puttha) {
  const { data, error } = await supabase
    .from('putthas')
    .upsert(puttha)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePutthaStatus(id, status) {
  const { data, error } = await supabase
    .from('putthas')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePuttha(id) {
  const { error } = await supabase
    .from('putthas')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

