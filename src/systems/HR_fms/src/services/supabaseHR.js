/**
 * supabaseHR.js
 * Central Supabase service layer for HR FMS
 * Covers: attendance_uploads, attendance_monthly, employees, advances, putthas, payroll
 *
 * Uses its OWN Supabase project (VITE_HR_SUPABASE_URL / VITE_HR_SUPABASE_ANON_KEY)
 * — separate from the master system Supabase credentials.
 */

import supabase, { hrSupabaseProjectUrl } from './supabaseHRClient.js';
import masterSupabase from '../../../../SupabaseClient.js';
import populatedDays from '../pages/Attendance.jsx'
import { getPreviousProcessingPeriod } from '../utils/dateUtils.js';

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
  '-': '#94a3b8',
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
  '-': 'No Data',
};

/**
 * Calculates leave breakdown (CL, PL, SL, Total Leave) for an employee row.
 * Checks explicit total_cl/pl/sl fields or dynamically scans daily_status JSONB.
 */
export function calculateRowLeaveStats(row) {
  if (!row) return { cl: 0, pl: 0, sl: 0, totalLeave: 0 };

  const meta = row.daily_status?._meta || {};
  let cl = parseFloat(row.total_cl ?? meta.total_cl) || 0;
  let pl = parseFloat(row.total_pl ?? meta.total_pl) || 0;
  let sl = parseFloat(row.total_sl ?? meta.total_sl) || 0;

  if (row.daily_status && typeof row.daily_status === 'object') {
    let dsCL = 0;
    let dsPL = 0;
    let dsSL = 0;

    Object.entries(row.daily_status).forEach(([key, val]) => {
      if (key === '_meta' || !val) return;
      const code = String(val).trim().toUpperCase();
      if (code === 'CL') dsCL += 1;
      else if (code === '½CL' || code === '0.5CL') dsCL += 0.5;
      else if (code === 'PL') dsPL += 1;
      else if (code === '½PL' || code === '0.5PL') dsPL += 0.5;
      else if (code === 'SL') dsSL += 1;
      else if (code === '½SL' || code === '0.5SL') dsSL += 0.5;
    });

    if (dsCL > 0 || cl === 0) cl = dsCL;
    if (dsPL > 0 || pl === 0) pl = dsPL;
    if (dsSL > 0 || sl === 0) sl = dsSL;
  }

  const explicitLeave = parseFloat(row.total_leave ?? meta.total_leave);
  const calculatedSum = cl + pl + sl;
  const totalLeave = (!isNaN(explicitLeave) && explicitLeave > 0)
    ? Math.max(explicitLeave, calculatedSum)
    : calculatedSum;

  return { cl, pl, sl, totalLeave };
}

/**
 * Synthesizes or completes a daily_status object for an employee when daily columns were missing in Excel
 * or when daily_status is empty/incomplete.
 * Places WO on Sundays, H on holidays, Leaves (CL/PL/SL/L), P on present days, A on absent days.
 */

export function fillDailyStatusFromSummary(emp, year, month) {
  if (!year || !month || !emp) return emp?.daily_status || {};

  const today = new Date();
  const isCurrentMonth = (year === today.getFullYear() && month === (today.getMonth() + 1));
  const daysInMonth = new Date(year, month, 0).getDate();
  const limitDay = isCurrentMonth ? today.getDate() : daysInMonth;

  const existingDaily = emp.daily_status || {};

  // For the current month/year: Do NOT generate proxy/default attendance data.
  // Fetch attendance only through today. Keep all subsequent days blank.
  // Never convert missing data into P, A, WO, or any other status.
  if (isCurrentMonth) {
    const result = { ...existingDaily };
    for (let d = limitDay + 1; d <= daysInMonth; d++) {
      delete result[d];
      if (result._meta && result._meta[d]) {
        delete result._meta[d];
      }
    }
    return result;
  }

  const totalPresent = parseFloat(emp.total_present ?? emp.total_p) || 0;
  const totalAbsent = parseFloat(emp.total_absent ?? emp.total_a) || 0;
  const totalHoliday = parseFloat(emp.total_holiday ?? emp.total_h) || 0;
  const totalWO = parseFloat(emp.total_wo) || 0;
  const totalWOP = parseFloat(emp.total_wop) || 0;

  const leaveObj = calculateRowLeaveStats(emp);

  const hasSummaryMetrics = (totalPresent > 0 || totalAbsent > 0 || totalHoliday > 0 || totalWO > 0 || totalWOP > 0 || leaveObj.totalLeave > 0 || populatedDays > 0);

  if (!hasSummaryMetrics) {
    if (isCurrentMonth) {
      const result = { ...existingDaily };
      for (let d = limitDay + 1; d <= daysInMonth; d++) {
        delete result[d];
        if (result._meta && result._meta[d]) {
          delete result._meta[d];
        }
      }
      return result;
    }
    return { ...existingDaily };
  }

  const result = { ...existingDaily };

  // Clear future days
  if (isCurrentMonth) {
    for (let d = limitDay + 1; d <= daysInMonth; d++) {
      delete result[d];
      if (result._meta && result._meta[d]) {
        delete result._meta[d];
      }
    }
  }

  let remCL = leaveObj.cl;
  let remPL = leaveObj.pl;
  let remSL = leaveObj.sl;
  let remOtherLeave = Math.max(0, leaveObj.totalLeave - (remCL + remPL + remSL));

  let remWO = totalWO;
  let remWOP = totalWOP;
  let remH = totalHoliday;
  let remP = totalPresent;
  let remA = totalAbsent;

  // Step 1: Identify Sundays in this month for WO assignment
  const sundays = [];
  const nonSundays = [];
  for (let d = 1; d <= limitDay; d++) {
    if (result[d]) continue;
    const dateObj = new Date(year, month - 1, d);
    if (dateObj.getDay() === 0) { // Sunday
      sundays.push(d);
    } else {
      nonSundays.push(d);
    }
  }

  // Step 2: Assign WO to Sundays first
  sundays.forEach(d => {
    if (remWO > 0) {
      result[d] = 'WO';
      remWO--;
    } else {
      nonSundays.unshift(d);
    }
  });

  // Step 3: Assign remaining WO to non-Sundays if any
  for (let i = nonSundays.length - 1; i >= 0 && remWO > 0; i--) {
    const d = nonSundays[i];
    if (!result[d]) {
      result[d] = 'WO';
      remWO--;
      nonSundays.splice(i, 1);
    }
  }

  // Helper to assign code to unassigned days
  const assignCode = (code, count) => {
    let assigned = 0;
    for (let i = 0; i < nonSundays.length && assigned < count; i++) {
      const d = nonSundays[i];
      if (!result[d]) {
        result[d] = code;
        assigned++;
        nonSundays.splice(i, 1);
        i--;
      }
    }
  };

  if (remWOP > 0) assignCode('WOP', remWOP);
  if (remH > 0) assignCode('H', remH);
  if (remCL > 0) assignCode('CL', remCL);
  if (remPL > 0) assignCode('PL', remPL);
  if (remSL > 0) assignCode('SL', remSL);
  if (remOtherLeave > 0) assignCode('L', remOtherLeave);
  if (remP > 0) assignCode('P', remP);
  if (remA > 0) assignCode('A', remA);

  // Fallback for any remaining unassigned days
  for (let d = 1; d <= limitDay; d++) {
    if (!result[d]) {
      result[d] = remP > 0 ? 'P' : (remA > 0 ? 'A' : '');
    }
  }

  return result;
}

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

  // ── Identify day columns (if present in detailed daily report) ──
  const dayColIndices = [];
  headers.forEach((h, idx) => {
    const str = String(h || '').trim();
    if (!str) return;

    // Pattern 1: Pure day number "1" .. "31" or "01" .. "31"
    let m = str.match(/^0*([1-9]|[12]\d|3[01])$/);
    if (m) {
      dayColIndices.push({ colIdx: idx, dayNum: parseInt(m[1], 10) });
      return;
    }

    // Pattern 2: "1 Jul", "01 Jul", "1-Jul", "01-Jul", "1/Jul"
    m = str.match(/^0*([1-9]|[12]\d|3[01])[\s/.-]+[A-Za-z]{1,4}$/i);
    if (m) {
      dayColIndices.push({ colIdx: idx, dayNum: parseInt(m[1], 10) });
      return;
    }

    // Pattern 3: "01/07", "1/7", "01/07/2026", "1-7-2026"
    m = str.match(/^0*([1-9]|[12]\d|3[01])[/.-]\d{1,2}([/.-]\d{2,4})?$/);
    if (m) {
      dayColIndices.push({ colIdx: idx, dayNum: parseInt(m[1], 10) });
      return;
    }
  });

  // Fallback: check row above or below header row for day numbers if dayColIndices is empty
  if (dayColIndices.length === 0 && headerRowIdx > 0) {
    const candidateRows = [rawRows[headerRowIdx - 1], rawRows[headerRowIdx + 1]].filter(Boolean);
    candidateRows.forEach(candRow => {
      candRow.forEach((cell, idx) => {
        const str = String(cell || '').trim();
        const m = str.match(/^0*([1-9]|[12]\d|3[01])$/);
        if (m && !dayColIndices.some(d => d.colIdx === idx)) {
          dayColIndices.push({ colIdx: idx, dayNum: parseInt(m[1], 10) });
        }
      });
    });
  }

  if (!periodFrom || isNaN(periodFrom)) {
    // Fallback: use current month
    periodFrom = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    periodTo = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
  }

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
    totalHP: findCol('hp', 'halfpresent', 'half present', 'holidaypresent', 'holiday present'),
    totalWO: findExactCol('wo') !== -1 ? findExactCol('wo') : findCol('weeklyoff', 'weekly off'),
    totalWOP: findExactCol('wop') !== -1 ? findExactCol('wop') : findCol('wopresent', 'wo present'),
    totalCL: findExactCol('cl') !== -1 ? findExactCol('cl') : findCol('casualleave', 'casual leave'),
    totalPL: findExactCol('pl') !== -1 ? findExactCol('pl') : findCol('paidleave', 'paid leave'),
    totalSL: (() => {
      const empCodeIdx = findCol('empcode', 'emp.code', 'emp code', 'code');
      const nameIdx = findCol('employeename', 'employee name', 'name', 'employee');
      const afterIdx = Math.max(empCodeIdx, nameIdx);
      const slIdx = headers.findIndex((h, idx) => idx > afterIdx && cleanHeader(h) === 'sl');
      if (slIdx !== -1) return slIdx;
      return findCol('sickleave', 'sick leave');
    })(),
    totalOtherLeave: findCol('otherleave', 'other leave'),
    totalLeave: findCol('totalleave', 'total leave') !== -1 ? findCol('totalleave', 'total leave') : findExactCol('l'),
    totalPresent: findCol('totalpresent', 'total present'),
    totalPayDays: findCol('totalpaydays', 'total pay days', 'paydays', 'pay days', 'payable days', 'payabledays'),
    totalOT: (() => {
      const otIdx = findCol('totalot', 'total ot in hrs', 'total ot (in hrs.)', 'total ot', 'otinhrs', 'overtime', 'over time', 'ot hrs', 'othours', 'ot(hh:mm)', 'ot time', 'ot(hrs)');
      if (otIdx !== -1) return otIdx;
      const exactIdx = findExactCol('ot', 'overtime');
      if (exactIdx !== -1) return exactIdx;
      // Fallback: inspect first data rows for HH:MM pattern in non-day columns
      for (let i = headerRowIdx + 1; i < Math.min(rawRows.length, headerRowIdx + 10); i++) {
        const r = rawRows[i] || [];
        for (let c = 0; c < r.length; c++) {
          if (dayColIndices.some(d => d.colIdx === c)) continue;
          const val = String(r[c] || '').trim();
          if (/^\d{1,3}:\d{2}(:\d{2})?$/.test(val)) {
            return c;
          }
        }
      }
      return -1;
    })(),
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
      const cell = String(row[colIdx] !== undefined && row[colIdx] !== null ? row[colIdx] : '').trim();
      if (cell && cell !== '—' && cell !== '-') {
        dailyStatus[dayNum] = cell;
      }
    });

    const totalPresent = parseFloat(row[summaryMap.totalPresent] !== undefined && row[summaryMap.totalPresent] !== '' ? row[summaryMap.totalPresent] : (row[summaryMap.totalP] || 0)) || 0;
    const totalAbsent = parseFloat(row[summaryMap.totalA] || 0) || 0;
    const totalHoliday = parseFloat(row[summaryMap.totalH] || 0) || 0;
    const totalHalfPresent = parseFloat(row[summaryMap.totalHP] || 0) || 0;
    const totalWO = parseFloat(row[summaryMap.totalWO] || 0) || 0;
    const totalWOP = parseFloat(row[summaryMap.totalWOP] || 0) || 0;
    let totalCL = parseFloat(row[summaryMap.totalCL] || 0) || 0;
    let totalPL = parseFloat(row[summaryMap.totalPL] || 0) || 0;
    let totalSL = parseFloat(row[summaryMap.totalSL] || 0) || 0;
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

    let totalOT = '00:00';
    if (summaryMap.totalOT !== -1 && row[summaryMap.totalOT] !== undefined && row[summaryMap.totalOT] !== null) {
      const rawOt = row[summaryMap.totalOT];
      if (typeof rawOt === 'number') {
        totalOT = formatOtDisplay(rawOt);
      } else {
        const strOt = String(rawOt).trim();
        if (strOt && strOt !== '—' && strOt !== '-') {
          totalOT = strOt;
        }
      }
    }
    const totalLate = parseFloat(row[summaryMap.totalLate] || 0) || 0;
    const totalEarly = parseFloat(row[summaryMap.totalEarly] || 0) || 0;

    dailyStatus._meta = {
      total_cl: totalCL,
      total_pl: totalPL,
      total_sl: totalSL,
      total_hp: totalHalfPresent,
      total_other_leave: totalOtherLeave,
      total_leave: totalLeave,
      total_present: totalPresent,
      payable_days: payableDays,
      total_late: totalLate,
      total_early: totalEarly,
    };

    const empObj = {
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
    };

    console.log('Parsed employee:', empObj);
    console.log('Daily status:', empObj.daily_status);
    employees.push(empObj);
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

// const fetchattendance = async (url) => {
//   try {
//     const response = await fetch(url);
//     if (!response.ok) {
//       throw new Error(`HTTP error! status: ${response.status}`);
//     }
//     const data = await response.json();
//     return data;
//   } catch (error) {
//     console.error('Error fetching attendance:', error);
//     throw error;
//   }
// }


export async function saveAttendanceRows(uploadId, employees, year, month, companyName, department) {
  const period = getPreviousProcessingPeriod();
  const today = new Date();
  const isCurrentMonth = (year === today.getFullYear() && month === (today.getMonth() + 1));
  if (year !== period.year || month !== period.month) {
    if (!isCurrentMonth) {
      throw new Error(`Enforcement Error: Attendance can only be uploaded and saved for the previous processing month (${period.month}/${period.year}) or the current month (${today.getMonth() + 1}/${today.getFullYear()})`);
    }
  }
  const rows = employees.map(emp => ({
    upload_id: uploadId,
    year,
    month,
    company_name: 'Default',
    department: 'Default',
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
    total_ot: emp.total_ot || '00:00',
  }));

  // Upsert: update on conflict (same emp_code, year, month, company)
  try {
    const { data, error } = await supabase
      .from('attendance_monthly')
      .upsert(rows, {
        onConflict: 'emp_code,year,month,company_name',
        ignoreDuplicates: false,
      })
      .select();

    if (error) throw error;
    if (data && data.length > 0) {
      console.log('Saved attendance row:', data[0]);
    }
    return data;
  } catch (err) {
    if (err?.message && (err.message.includes('total_ot') || err.message.includes('column'))) {
      console.warn('total_ot column missing in attendance_monthly, falling back without total_ot:', err.message);
      const fallbackRows = rows.map(({ total_ot, ...rest }) => rest);
      const { data: fallbackData, error: fallbackErr } = await supabase
        .from('attendance_monthly')
        .upsert(fallbackRows, {
          onConflict: 'emp_code,year,month,company_name',
          ignoreDuplicates: false,
        })
        .select();

      if (fallbackErr) throw fallbackErr;
      return fallbackData;
    }
    throw err;
  }
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

export async function updatePayableDaysOverride(idOrEmpCode, overrideDays, reason, targetYear, targetMonth) {
  const parsedDays = parseFloat(overrideDays) || 0;
  let attRecord = null;

  // 1. Try updating by primary key ID if idOrEmpCode is numeric or numeric string
  if (idOrEmpCode && (typeof idOrEmpCode === 'number' || (typeof idOrEmpCode === 'string' && !isNaN(idOrEmpCode)))) {
    const { data: updated, error } = await supabase
      .from('attendance_monthly')
      .update({
        payable_days_override: parsedDays,
        override_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', idOrEmpCode)
      .select()
      .maybeSingle();

    if (!error && updated) {
      attRecord = updated;
    }
  }

  // 2. Fallback: find or upsert by emp_code, year, month
  const empCode = typeof idOrEmpCode === 'object'
    ? (idOrEmpCode.emp_code || idOrEmpCode.employee_id)
    : String(idOrEmpCode);
  const year = targetYear || (attRecord ? attRecord.year : new Date().getFullYear());
  const month = targetMonth || (attRecord ? attRecord.month : new Date().getMonth() + 1);

  if (!attRecord && empCode) {
    const { data: existing } = await supabase
      .from('attendance_monthly')
      .select('*')
      .eq('emp_code', empCode)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle();

    if (existing) {
      const { data: updated } = await supabase
        .from('attendance_monthly')
        .update({
          payable_days_override: parsedDays,
          override_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();
      attRecord = updated;
    } else {
      const { data: inserted } = await supabase
        .from('attendance_monthly')
        .insert({
          emp_code: empCode,
          year,
          month,
          payable_days: 0,
          payable_days_override: parsedDays,
          override_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      attRecord = inserted;
    }
  }

  const finalEmpCode = attRecord?.emp_code || empCode;
  const finalYear = attRecord?.year || year;
  const finalMonth = attRecord?.month || month;

  // 3. Directly update payroll database table row for this employee if non-paid payroll record exists
  if (finalEmpCode && finalYear && finalMonth) {
    const totalDaysInMonth = new Date(finalYear, finalMonth, 0).getDate();

    const { data: emp } = await supabase
      .from('employees')
      .select('employee_id, name, salary, puttha_status')
      .eq('employee_id', finalEmpCode)
      .maybeSingle();

    const monthlySalary = parseFloat(emp?.salary || 0);
    const earnedBasic = parseFloat(((monthlySalary / totalDaysInMonth) * parsedDays).toFixed(2));

    const { data: existingPayroll } = await supabase
      .from('payroll')
      .select('*')
      .eq('emp_code', finalEmpCode)
      .eq('year', finalYear)
      .eq('month', finalMonth)
      .maybeSingle();

    if (existingPayroll && existingPayroll.status !== 'paid') {
      const putthaPrice = (existingPayroll.puttha_status || emp?.puttha_status || 'Yes') === 'No' ? 0 : (parseFloat(existingPayroll.puttha_price) || 0);
      const otAmount = parseFloat(existingPayroll.ot_amount || 0);
      const grossSalary = parseFloat((earnedBasic + otAmount + putthaPrice).toFixed(2));
      const totalDeductions = parseFloat(existingPayroll.total_deductions || 0);
      const rawNet = Math.max(0, grossSalary - totalDeductions);
      const netSalary = rawNet > 0 ? Math.ceil(rawNet / 10) * 10 : 0;

      await supabase
        .from('payroll')
        .update({
          payable_days: parsedDays,
          basic_salary: monthlySalary,
          earned_basic: earnedBasic,
          gross_salary: grossSalary,
          net_salary: netSalary,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingPayroll.id);
    }
  }

  // 4. Trigger monthly batch recalculation for puttha pool and deductions
  if (finalYear && finalMonth) {
    try {
      await recalculateMonthPutthaAndPayroll(finalYear, finalMonth);
    } catch (e) {
      console.error('Error syncing payroll after payable days override:', e);
    }
  }

  return attRecord;
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

export function parseOtHours(otValue) {
  if (otValue === null || otValue === undefined || otValue === '') return 0;

  if (typeof otValue === 'number') {
    if (isNaN(otValue) || otValue <= 0) return 0;
    if (otValue < 5 && String(otValue).includes('.') && String(otValue).split('.')[1].length > 3) {
      return otValue * 24;
    }
    return otValue;
  }

  const str = String(otValue).trim();
  if (!str || str === '—' || str === '-' || str === '0' || str === '00:00' || str === '0:00') return 0;

  if (str.includes(':')) {
    const parts = str.split(':');
    const h = parseFloat(parts[0]) || 0;
    const m = parseFloat(parts[1]) || 0;
    const s = parseFloat(parts[2]) || 0;
    return h + (m / 60) + (s / 3600);
  }

  const hMatch = str.match(/(\d+)\s*(?:h|hr|hrs|hour|hours)/i);
  const mMatch = str.match(/(\d+)\s*(?:m|min|mins|minute|minutes)/i);
  if (hMatch || mMatch) {
    const h = hMatch ? parseFloat(hMatch[1]) : 0;
    const m = mMatch ? parseFloat(mMatch[1]) : 0;
    return h + (m / 60);
  }

  const num = parseFloat(str);
  if (isNaN(num) || num <= 0) return 0;
  if (num < 5 && str.includes('.') && str.split('.')[1].length > 3) {
    return num * 24;
  }
  return num;
}

export function formatOtDisplay(otValue) {
  if (otValue === null || otValue === undefined || otValue === '' || otValue === 0) return '00:00';
  if (typeof otValue === 'string' && otValue.includes(':')) return otValue;
  const num = typeof otValue === 'number' ? otValue : parseFloat(otValue);
  if (isNaN(num) || num <= 0) return '00:00';
  const hrs = Math.floor(num);
  const mins = Math.round((num - hrs) * 60);
  return `${hrs}:${String(mins).padStart(2, '0')}`;
}

export function calculatePayroll(employee, payableDays, totalDaysInMonth, putthaPrice = 0, advance = 0, loanDeduction = 0, salaryAdvanceDeduction = 0, otHours = 0) {
  const monthlySalary = parseFloat(employee.salary || 0);

  // Basic Salary column matches full month Employee Base Salary (same as Employee Management)
  const basicSalary = parseFloat(monthlySalary.toFixed(2));

  // Earned Basic Salary for Gross calculation based on present days
  const daysInMonth = totalDaysInMonth > 0 ? totalDaysInMonth : 30;
  const presentDays = parseFloat(payableDays) || 0;
  const earnedBasic = parseFloat(((monthlySalary / daysInMonth) * presentDays).toFixed(2));

  const parsedOtHours = parseOtHours(otHours);
  const otAmount = parseFloat((parsedOtHours * 50).toFixed(2));

  const putthaStatus = employee?.puttha_status || 'Yes';
  const actualPutthaPrice = putthaStatus === 'No' ? 0 : putthaPrice;

  // Gross Salary = (basic_salary / totalDaysInMonth * presentDays) + Puttha Price + OT Amount
  const gross = parseFloat((earnedBasic + actualPutthaPrice + otAmount).toFixed(2));

  // Deductions
  const loanDed = parseFloat(loanDeduction.toFixed(2));
  const salAdvDed = parseFloat(salaryAdvanceDeduction.toFixed(2));
  const totalDeductions = parseFloat((loanDed + salAdvDed).toFixed(2));

  // Net Salary = Gross Salary - Total Deductions (round up to nearest 10)
  const rawNet = parseFloat((gross - totalDeductions).toFixed(2));
  const net = rawNet > 0 ? Math.ceil(rawNet / 10) * 10 : 0;

  return {
    basic_salary: basicSalary,
    ot_hours: parsedOtHours,
    ot_amount: otAmount,
    puttha_price: actualPutthaPrice,
    gross_salary: gross,
    advance: parseFloat(advance.toFixed(2)),
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

export async function deductAdvanceAmount(empCode, deductAmount) {
  if (deductAmount <= 0) return;

  const { data: advs, error } = await supabase
    .from('advances')
    .select('*')
    .eq('employee_id', empCode)
    .in('status', ['Approved', 'Pending'])
    .order('date', { ascending: true });

  if (error || !advs || advs.length === 0) return;

  let remainingToDeduct = deductAmount;
  for (const adv of advs) {
    if (adv.deduction === 'No') continue;
    const currentRemaining = parseFloat(adv.remaining_amount !== null && adv.remaining_amount !== undefined ? adv.remaining_amount : adv.amount) || 0;
    if (currentRemaining <= 0) continue;

    const dec = Math.min(remainingToDeduct, currentRemaining);
    const newRemaining = parseFloat((currentRemaining - dec).toFixed(2));
    remainingToDeduct -= dec;

    await supabase
      .from('advances')
      .update({
        remaining_amount: newRemaining,
        status: newRemaining <= 0 ? 'Fully Paid' : 'Approved',
        updated_at: new Date().toISOString()
      })
      .eq('id', adv.id);

    if (remainingToDeduct <= 0) break;
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
    const originalAmount = parseFloat(adv.amount) || 0;
    const currentRemaining = parseFloat(adv.remaining_amount !== null && adv.remaining_amount !== undefined ? adv.remaining_amount : adv.amount) || 0;
    const capacity = originalAmount - currentRemaining;
    if (capacity <= 0) continue;

    const toRestore = Math.min(remainingToRevert, capacity);
    const newRemaining = parseFloat((currentRemaining + toRestore).toFixed(2));
    remainingToRevert -= toRestore;

    await supabase
      .from('salary_advances')
      .update({
        remaining_amount: newRemaining,
        status: newRemaining > 0 ? 'Approved' : adv.status,
        deducted_in_payroll_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', adv.id);

    if (remainingToRevert <= 0) break;
  }
}

export async function deductLoanAmount(empCode, deductAmount, payrollId = null) {
  if (deductAmount <= 0) return;

  const { data: loans, error } = await supabase
    .from('salary_advances')
    .select('*')
    .eq('employee_id', empCode)
    .in('status', ['Approved', 'Pending'])
    .order('date', { ascending: true });

  if (error || !loans || loans.length === 0) return;

  let remainingToDeduct = deductAmount;
  for (const loan of loans) {
    if (loan.deduction === 'No') continue;
    const currentRemaining = parseFloat(loan.remaining_amount !== null && loan.remaining_amount !== undefined ? loan.remaining_amount : loan.amount) || 0;
    if (currentRemaining <= 0) continue;

    const dec = Math.min(remainingToDeduct, currentRemaining);
    const newRemaining = parseFloat((currentRemaining - dec).toFixed(2));
    remainingToDeduct -= dec;

    await supabase
      .from('salary_advances')
      .update({
        remaining_amount: newRemaining,
        status: newRemaining <= 0 ? 'Deducted' : 'Approved',
        deducted_in_payroll_id: payrollId,
        updated_at: new Date().toISOString()
      })
      .eq('id', loan.id);

    if (remainingToDeduct <= 0) break;
  }
}

export async function generatePayrollBatch(attendanceRows, employeeMap, targetYear, targetMonth) {
  const payrollRows = [];

  const year = (attendanceRows && attendanceRows.length > 0) ? attendanceRows[0].year : targetYear;
  const month = (attendanceRows && attendanceRows.length > 0) ? attendanceRows[0].month : targetMonth;

  if (!year || !month) return [];

  const periodPrev = getPreviousProcessingPeriod();
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  const isPrev = (year === periodPrev.year && month === periodPrev.month);
  const isCurrent = (year === currentYear && month === currentMonth);

  if (!isPrev && !isCurrent) {
    throw new Error(`Enforcement Error: Payroll can only be generated for the current month (${currentMonth}/${currentYear}) or the previous month (${periodPrev.month}/${periodPrev.year})`);
  }

  // Fetch database attendance_monthly records for this month to guarantee capturing payable_days_override
  const { data: dbAttRows } = await supabase
    .from('attendance_monthly')
    .select('emp_code, payable_days, payable_days_override, total_ot, ot_hours')
    .eq('year', year)
    .eq('month', month);

  const dbAttMap = {};
  (dbAttRows || []).forEach(a => {
    if (a.emp_code) {
      dbAttMap[String(a.emp_code).trim().toLowerCase()] = a;
    }
  });

  // Calculate total days in the selected month
  const totalDaysInMonth = new Date(year, month, 0).getDate();

  // Synthesize full attendance list including active employees missing from attendanceRows
  const existingEmpCodes = new Set(
    (attendanceRows || []).map(att => String(att.emp_code || '').trim().toLowerCase())
  );
  (dbAttRows || []).forEach(a => {
    if (a.emp_code) existingEmpCodes.add(String(a.emp_code).trim().toLowerCase());
  });

  const fullAttendanceRows = [...(attendanceRows || [])];
  Object.values(employeeMap || {}).forEach(emp => {
    if (!emp.employee_id) return;
    const empCodeKey = String(emp.employee_id).trim().toLowerCase();
    if (!existingEmpCodes.has(empCodeKey)) {
      existingEmpCodes.add(empCodeKey);
      const dbRec = dbAttMap[empCodeKey];
      fullAttendanceRows.push(dbRec || {
        year,
        month,
        emp_code: String(emp.employee_id).trim(),
        emp_name: emp.name || emp.employee_id,
        payable_days: totalDaysInMonth,
        is_synthesized: true,
        total_ot: '00:00',
      });
    }
  });

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(totalDaysInMonth).padStart(2, '0')}`;

  // Fetch existing payrolls to skip paid records
  const { data: existingPayrolls, error: existingPayrollsError } = await supabase
    .from('payroll')
    .select('id, emp_code, advance_deduction, loan_deduction, salary_advance_deduction, status')
    .eq('year', year)
    .eq('month', month);

  // ── 2. Fetch all required datasets IN PARALLEL ──
  // Source 1: advances table -> Payroll Advance & Advance Deduction
  // Source 2: salary_advances table -> Payroll Loan Deduction
  // Source 3: putthas table -> Puttha pricing
  const [advancesRes, putthasRes, salAdvsRes] = await Promise.all([
    supabase.from('advances').select('*').in('status', ['Approved', 'Pending']).order('date', { ascending: true }),
    supabase.from('putthas').select('total_price').eq('status', 'Approved').gte('date', startDate).lte('date', endDate),
    supabase.from('salary_advances').select('*').in('status', ['Approved', 'Pending']).order('date', { ascending: true })
  ]);

  const allAdvances = advancesRes.data || [];
  const putthas = putthasRes.data || [];
  const allSalaryAdvs = salAdvsRes.data || [];

  console.log('[Payroll Batch] Fetched records count:');
  console.log(`  advances (Advance source): ${allAdvances.length}`);
  console.log(`  salary_advances (Loan source): ${allSalaryAdvs.length}`);

  // Group advances by normalized employee_id
  const employeeActiveAdvs = {};
  allAdvances.forEach(adv => {
    if (!adv.employee_id) return;
    const empCodeKey = String(adv.employee_id).trim().toLowerCase();
    const original = parseFloat(adv.amount) || 0;
    const remaining = parseFloat(adv.remaining_amount !== null && adv.remaining_amount !== undefined ? adv.remaining_amount : adv.amount) || 0;
    if (remaining > 0 || adv.status === 'Approved') {
      if (!employeeActiveAdvs[empCodeKey]) {
        employeeActiveAdvs[empCodeKey] = [];
      }
      employeeActiveAdvs[empCodeKey].push({
        ...adv,
        original,
        remaining
      });
    }
  });

  // Group salary_advances (Loans) by normalized employee_id
  const employeeSalaryAdvs = {};
  allSalaryAdvs.forEach(adv => {
    if (!adv.employee_id) return;
    if (adv.deduction === 'No') return;
    const empCodeKey = String(adv.employee_id).trim().toLowerCase();
    if (!employeeSalaryAdvs[empCodeKey]) {
      employeeSalaryAdvs[empCodeKey] = [];
    }
    employeeSalaryAdvs[empCodeKey].push(adv);
  });

  let totalPutthaAmount = 0;
  putthas.forEach(p => {
    totalPutthaAmount += parseFloat(p.total_price) || 0;
  });

  // ── Determine eligible employees for Puttha ──
  const eligibleRows = fullAttendanceRows.filter(att => {
    const code = String(att.emp_code || '').trim();
    const emp = employeeMap[code] || employeeMap[code.toLowerCase()] || employeeMap[code.toUpperCase()];
    if (!emp || (emp.puttha_status || 'Yes') === 'No') return false;

    const dbAtt = dbAttMap[code.toLowerCase()] || dbAttMap[code] || att;
    const rawOverride = dbAtt?.payable_days_override ?? att?.payable_days_override;
    const rawPayable = dbAtt?.payable_days ?? att?.payable_days;

    let payableDays = 0;
    if (rawOverride !== null && rawOverride !== undefined && String(rawOverride).trim() !== '') {
      payableDays = parseFloat(rawOverride);
    } else if (rawPayable !== null && rawPayable !== undefined && String(rawPayable).trim() !== '' && !att.is_synthesized) {
      payableDays = parseFloat(rawPayable);
    } else {
      payableDays = 0;
    }
    return payableDays >= 15;
  });
  const eligibleCount = eligibleRows.length;

  const putthaPerEmployee = eligibleCount > 0
    ? parseFloat((totalPutthaAmount / eligibleCount).toFixed(2))
    : 0;

  // ── Build payroll rows ──
  for (const att of fullAttendanceRows) {
    const code = String(att.emp_code || '').trim();
    const empCodeKey = code.toLowerCase();
    const employee = employeeMap[code] || employeeMap[empCodeKey] || employeeMap[code.toUpperCase()];
    if (!employee) continue;

    const existingRow = (existingPayrolls || []).find(ep => String(ep.emp_code || '').trim().toLowerCase() === empCodeKey);
    if (existingRow && existingRow.status === 'paid') continue;

    const dbAtt = dbAttMap[empCodeKey] || dbAttMap[code] || att;
    const rawOverride = dbAtt?.payable_days_override ?? att?.payable_days_override;
    const rawPayable = dbAtt?.payable_days ?? att?.payable_days;

    let payableDays = 0;
    if (rawOverride !== null && rawOverride !== undefined && String(rawOverride).trim() !== '') {
      payableDays = parseFloat(rawOverride);
    } else if (rawPayable !== null && rawPayable !== undefined && String(rawPayable).trim() !== '' && !att.is_synthesized) {
      payableDays = parseFloat(rawPayable);
    } else {
      payableDays = 0;
    }
    const isPutthaEligible = (employee.puttha_status || 'Yes') !== 'No' && payableDays >= 15;
    const putthaPrice = isPutthaEligible ? putthaPerEmployee : 0;

    // --- 1. ADVANCE DATA from advances table ---
    const empAdvs = employeeActiveAdvs[empCodeKey] || [];
    // Advance column  = sum of ORIGINAL amounts (immutable, display-only)
    const totalOriginalAdvance = empAdvs.reduce((sum, adv) => sum + (parseFloat(adv.original) || 0), 0);
    // Adv. Ded. column = sum of CURRENT remaining balances (pending deduction)
    const totalRemainingAdvance = empAdvs.reduce((sum, adv) => sum + (parseFloat(adv.remaining) || 0), 0);

    // --- 2. LOAN DATA from salary_advances table ---
    const empSalAdvs = employeeSalaryAdvs[empCodeKey] || [];
    let loansDeductionAmount = 0;

    for (const adv of empSalAdvs) {
      const monthlyDed = parseFloat(adv.monthly_deduction !== null && adv.monthly_deduction !== undefined && parseFloat(adv.monthly_deduction) > 0 ? adv.monthly_deduction : adv.amount) || 0;
      if (monthlyDed <= 0) continue;

      const remainingLoan = parseFloat(adv.remaining_amount !== null && adv.remaining_amount !== undefined ? adv.remaining_amount : adv.amount) || 0;
      if (remainingLoan <= 0) continue;

      const deductionAmount = Math.min(monthlyDed, remainingLoan);
      loansDeductionAmount += deductionAmount;
    }

    const otHours = att.total_ot || att.ot_hours || 0;

    // Final payroll calculation:
    // advance               = totalOriginalAdvance  (Advance col: original full amount)
    // loanDeduction          = loansDeductionAmount
    // salaryAdvanceDeduction = totalRemainingAdvance (Adv. Ded. col: current remaining balance)
    const calc = calculatePayroll(employee, payableDays, totalDaysInMonth, putthaPrice, totalOriginalAdvance, loansDeductionAmount, totalRemainingAdvance, otHours);

    console.log(`[Payroll Debug] emp_id: ${att.emp_code || employee.employee_id} (${employee.name || att.emp_name})`);
    console.log(`  table: advances -> original: ₹${totalOriginalAdvance}, remaining: ₹${totalRemainingAdvance}`);
    console.log(`  table: salary_advances -> loan monthly deduction: ₹${loansDeductionAmount}`);
    console.log(`  Payroll Advance: ₹${calc.advance}, Payroll Adv Ded: ₹${calc.salary_advance_deduction}, Payroll Loan Ded: ₹${calc.loan_deduction}, Total Ded: ₹${calc.total_deductions}, Net Salary: ₹${calc.net_salary}`);

    payrollRows.push({
      emp_code: att.emp_code || employee.employee_id,
      emp_name: employee.name || att.emp_name || att.emp_code,
      year: att.year || year,
      month: att.month || month,
      payable_days: payableDays,
      puttha_status: employee.puttha_status || 'Yes',
      ...calc,
      status: 'draft'
    });
  }

  if (payrollRows.length === 0) return [];

  // Upsert payroll rows in single bulk batch
  const dbRows = payrollRows.map(({ earned_basic, ...rest }) => rest);
  const { data, error } = await supabase
    .from('payroll')
    .upsert(dbRows, { onConflict: 'emp_code,year,month' })
    .select();

  if (error) throw error;

  if (data && data.length > 0) {
    for (const row of data) {
      const advDed = parseFloat(row.salary_advance_deduction) || 0;
      const loanDed = parseFloat(row.loan_deduction) || 0;
      await updateRemainingBalancesForEmployee(row.emp_code, advDed, loanDed, row.status === 'paid' ? row.id : null);
    }
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
  let query = supabase
    .from('attendance_monthly')
    .select('*')
    .order('emp_name', { ascending: true });

  if (year) query = query.eq('year', year);
  if (month) query = query.eq('month', month);
  if (search) {
    query = query.or(`emp_name.ilike.%${search}%,emp_code.ilike.%${search}%`);
  }

  const { data: attData, error } = await query;
  if (error) throw error;

  if (!attData || attData.length === 0) {
    return {
      data: [],
      totalRecords: 0,
      currentPage: page,
      pageSize,
      totalPages: 1,
    };
  }

  const existingCodes = new Set((attData || []).map(a => String(a.emp_code || '').trim().toLowerCase()));

  // Fetch active employees to include any newly created employee missing from attendance_monthly
  const { data: emps } = await supabase
    .from('employees')
    .select('employee_id, name, status');

  const activeEmps = (emps || []).filter(e => !e.status || String(e.status).trim().toLowerCase() === 'active');

  const fullList = [...(attData || [])];
  activeEmps.forEach(e => {
    if (!e.employee_id) return;
    const codeKey = String(e.employee_id).trim().toLowerCase();
    if (!existingCodes.has(codeKey)) {
      if (!search || e.name?.toLowerCase().includes(search.toLowerCase()) || e.employee_id?.toLowerCase().includes(search.toLowerCase())) {
        existingCodes.add(codeKey);
        fullList.push({
          emp_code: e.employee_id,
          emp_name: e.name || e.employee_id,
          year,
          month,
          payable_days: 0,
          total_present: 0,
          total_absent: 0,
          total_holiday: 0,
          total_wo: 0,
          total_wop: 0,
          total_leave: 0,
          total_ot: '00:00',
        });
      }
    }
  });

  const count = fullList.length;
  const from = (page - 1) * pageSize;
  const pagedData = fullList.slice(from, from + pageSize);

  return {
    data: pagedData,
    totalRecords: count,
    currentPage: page,
    pageSize,
    totalPages: Math.ceil(count / pageSize) || 1,
  };
}

export async function fetchAttendanceMonthlyStats({ year, month, search = '' } = {}) {
  let query = supabase
    .from('attendance_monthly')
    .select('total_present, total_absent, total_holiday, total_wo, total_wop, total_leave, payable_days, payable_days_override, total_ot, ot_hours, daily_status');

  if (year) query = query.eq('year', year);
  if (month) query = query.eq('month', month);
  if (search) {
    query = query.or(`emp_name.ilike.%${search}%,emp_code.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function fetchPayrollPaginated({ year, month, status, statusNot, empCode, search = '', page = 1, pageSize = 50 } = {}) {
  const from = (page - 1) * pageSize;
  const to = page * pageSize - 1;

  let query = supabase
    .from('payroll')
    .select('*', { count: 'exact' })
    .order('emp_name', { ascending: true });

  if (year) query = query.eq('year', year);
  if (month) query = query.eq('month', month);
  if (status) query = query.eq('status', status);
  if (statusNot) query = query.neq('status', statusNot);
  if (empCode) query = query.eq('emp_code', empCode);
  if (search) {
    query = query.or(`emp_name.ilike.%${search}%,emp_code.ilike.%${search}%`);
  }

  let { data, count, error } = await query.range(from, to);
  if (error) throw error;

  // Sync latest puttha_status from employees master table & recalculate if any eligible employee has 0 puttha price
  if (data && data.length > 0) {
    let needsRecalc = false;

    const empCodes = [...new Set(data.map(r => r.emp_code))].filter(Boolean);
    const empSalaryMap = {};
    if (empCodes.length > 0) {
      const { data: emps, error: empsErr } = await supabase
        .from('employees')
        .select('employee_id, puttha_status, salary')
        .in('employee_id', empCodes);

      if (!empsErr && emps && emps.length > 0) {
        const empStatusMap = {};
        emps.forEach(e => {
          empStatusMap[e.employee_id] = e.puttha_status || 'Yes';
          if (e.salary !== undefined && e.salary !== null) {
            empSalaryMap[e.employee_id] = parseFloat(e.salary) || 0;
          }
        });

        data.forEach(r => {
          if (empStatusMap[r.emp_code] && empStatusMap[r.emp_code] !== r.puttha_status) {
            r.puttha_status = empStatusMap[r.emp_code];
            needsRecalc = true;
          }
          if (empSalaryMap[r.emp_code] !== undefined && parseFloat(r.basic_salary) !== empSalaryMap[r.emp_code]) {
            r.basic_salary = empSalaryMap[r.emp_code];
            needsRecalc = true;
          }
        });
      }
    }

    // Check if any row has non-zero puttha_price, but some eligible employees still have 0.00
    const hasBatchPuttha = data.some(r => (parseFloat(r.puttha_price) || 0) > 0);
    if (hasBatchPuttha) {
      const hasMissingPuttha = data.some(r => {
        const pDays = parseFloat(r.payable_days || 0);
        return (r.puttha_status || 'Yes') !== 'No' && pDays >= 15 && (parseFloat(r.puttha_price) || 0) === 0;
      });
      if (hasMissingPuttha) {
        needsRecalc = true;
      }
    }

    // Fetch attendance_monthly to check if OT or payable_days need syncing
    const { data: attRows } = await supabase
      .from('attendance_monthly')
      .select('emp_code, total_ot, ot_hours, payable_days, payable_days_override')
      .eq('year', year)
      .eq('month', month);

    const attMap = {};
    (attRows || []).forEach(a => {
      if (a.emp_code) {
        attMap[String(a.emp_code).trim().toLowerCase()] = a;
      }
    });

    // Check if any row has puttha_price, ot_amount, gross_salary or net_salary that requires recalculation
    data.forEach(r => {
      if (r.status === 'paid') return;
      const daysInMonth = (year && month) ? new Date(year, month, 0).getDate() : 30;
      const codeKey = String(r.emp_code || '').trim().toLowerCase();
      const att = attMap[codeKey] || attMap[r.emp_code];
      const rawOverride = att?.payable_days_override;
      const rawPayable = att?.payable_days ?? r.payable_days;

      let presentDays = 0;
      if (rawOverride !== null && rawOverride !== undefined && String(rawOverride).trim() !== '') {
        presentDays = parseFloat(rawOverride);
      } else if (rawPayable !== null && rawPayable !== undefined && String(rawPayable).trim() !== '' && att) {
        presentDays = parseFloat(rawPayable);
      } else {
        presentDays = 0;
      }

      if (parseFloat(r.payable_days || 0) !== presentDays) {
        r.payable_days = presentDays;
        needsRecalc = true;
      }

      const baseSalary = empSalaryMap[r.emp_code] !== undefined ? empSalaryMap[r.emp_code] : (parseFloat(r.basic_salary) || 0);
      const earnedBasic = parseFloat(((baseSalary / daysInMonth) * presentDays).toFixed(2));
      const rawOt = att?.total_ot || att?.ot_hours || r.ot_hours || r.total_ot || 0;
      const expectedOtHours = parseOtHours(rawOt);
      const expectedOtAmount = parseFloat((expectedOtHours * 50).toFixed(2));

      const isPutthaEligible = (r.puttha_status || 'Yes') !== 'No' && presentDays >= 15;
      const putthaPrice = isPutthaEligible ? (parseFloat(r.puttha_price) || 0) : 0;
      const expectedGross = parseFloat((earnedBasic + expectedOtAmount + putthaPrice).toFixed(2));
      const rawNet = Math.max(0, expectedGross - (parseFloat(r.total_deductions) || 0));
      const expectedNet = rawNet > 0 ? Math.ceil(rawNet / 10) * 10 : 0;

      if (
        parseFloat(r.payable_days || 0) !== presentDays ||
        Math.abs((parseFloat(r.ot_amount) || 0) - expectedOtAmount) > 0.01 ||
        parseFloat(r.puttha_price) !== putthaPrice ||
        Math.abs(parseFloat(r.gross_salary) - expectedGross) > 0.01 ||
        parseFloat(r.net_salary) !== expectedNet
      ) {
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
      if (statusNot) refetchQuery = refetchQuery.neq('status', statusNot);
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

const normalizedAmount = value => Number.parseFloat(value) || 0;

// Keep database schemas independent from the component's display model.
export const normalizeAdvance = row => {
  const amt = normalizedAmount(row.amount);
  let rem = row.remaining_amount;
  if (rem === null || rem === undefined || (parseFloat(rem) === 0 && row.status === 'Approved')) {
    rem = amt;
  }
  return {
    ...row,
    employee_id: row.employee_id ?? '',
    employee_name: row.employee_name ?? '',
    amount: amt,
    monthly_deduction: normalizedAmount(row.monthly_deduction),
    remaining_amount: normalizedAmount(rem),
    deduction: row.deduction ?? 'Yes',
    reason: row.reason ?? '',
    date: row.date ?? row.created_at?.slice(0, 10) ?? '',
    status: row.status ?? 'Pending',
  };
};

export const normalizeLoan = row => {
  const amt = normalizedAmount(row.amount);
  let rem = row.remaining_amount;
  if (rem === null || rem === undefined || (parseFloat(rem) === 0 && row.status === 'Approved')) {
    rem = amt;
  }
  return {
    ...row,
    employee_id: row.employee_id ?? '',
    employee_name: row.employee_name ?? '',
    amount: amt,
    monthly_deduction: normalizedAmount(row.monthly_deduction),
    remaining_amount: normalizedAmount(rem),
    deduction: row.deduction ?? 'Yes',
    reason: row.reason ?? '',
    date: row.date ?? row.created_at?.slice(0, 10) ?? '',
    status: row.status ?? 'Pending',
  };
};

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

  console.log('[Advance] Supabase project:', hrSupabaseProjectUrl);
  console.log('[Advance] Fetching table: advances');
  const { data, count, error } = await query.range(from, to);
  console.log('[Advance] Raw response:', data);
  if (error) {
    console.error('[Advance] Fetch error:', error);
    throw error;
  }

  return {
    data: (data || []).map(normalizeAdvance),
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

export async function updateRemainingBalancesForEmployee(empCode, advanceDeductionAmount, loanDeductionAmount, payrollId = null) {
  // This function is now a no-op stub.
  // Advance and Loan deductions are handled atomically on Mark-as-Paid via
  // deductAdvanceAmount / deductLoanAmount (called from updatePayrollRow).
  void empCode; void advanceDeductionAmount; void loanDeductionAmount; void payrollId;
}

export async function updatePayrollRow(id, updates) {
  // Fetch current record first to check status/details if needed
  const { data: current, error: fetchError } = await supabase
    .from('payroll')
    .select('*')
    .eq('id', id)
    .single();
  if (fetchError) throw fetchError;

  if (updates.loan_deduction !== undefined && updates.loan_deduction !== null) {
    const newLoanDed = parseFloat(updates.loan_deduction || 0);
    if (newLoanDed < 0) {
      throw new Error("Validation Error: Loan deduction cannot be negative.");
    }
    const empCode = current.emp_code;
    const dbLoanBalance = await fetchEmployeeLoanBalance(empCode);
    const existingDraftLoanDed = parseFloat(current.loan_deduction || 0);
    const availableLoanBalance = parseFloat((dbLoanBalance + existingDraftLoanDed).toFixed(2));

    if (newLoanDed > 0 && availableLoanBalance <= 0) {
      throw new Error("Validation Error: This employee has no active loan. Loan deduction cannot be added.");
    }
    if (newLoanDed > availableLoanBalance) {
      throw new Error(`Validation Error: Loan deduction cannot be greater than the employee's remaining loan balance of ₹${availableLoanBalance}.`);
    }
  }
  if (updates.salary_advance_deduction !== undefined && updates.salary_advance_deduction !== null) {
    const newAdvDed = parseFloat(updates.salary_advance_deduction || 0);
    if (newAdvDed < 0) {
      throw new Error("Validation Error: Advance deduction cannot be negative.");
    }
    const empCode = current.emp_code;
    const dbAdvBalance = await fetchEmployeeAdvanceBalance(empCode);
    const availableAdvBalance = parseFloat(dbAdvBalance.toFixed(2));

    if (newAdvDed > 0 && availableAdvBalance <= 0) {
      throw new Error("Validation Error: This employee has no active advance. Advance deduction cannot be added.");
    }
    if (newAdvDed > availableAdvBalance) {
      throw new Error(`Validation Error: Advance deduction cannot be greater than the employee's remaining advance balance of ₹${availableAdvBalance}.`);
    }
  }

  const { data, error } = await supabase
    .from('payroll')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;

  // Sync Loans (salary_advances): Paid-only gate — mirrors Advance logic
  const loanDed = parseFloat(data.loan_deduction) || 0;
  const isPayingNow = (current.status !== 'paid' && data.status === 'paid');
  const isEditingPaid = (current.status === 'paid' && updates.loan_deduction !== undefined);

  if (isPayingNow) {
    await deductLoanAmount(data.emp_code, loanDed, id);
    // Also apply advance deduction on paid transition
    const advDed = parseFloat(data.salary_advance_deduction) || 0;
    await deductAdvanceAmount(data.emp_code, advDed);
  } else if (isEditingPaid) {
    const oldLoanDed = parseFloat(current.loan_deduction) || 0;
    const loanDiff = loanDed - oldLoanDed;
    if (loanDiff > 0) {
      await deductLoanAmount(data.emp_code, loanDiff, id);
    } else if (loanDiff < 0) {
      await revertSalaryAdvanceDeduction(data.emp_code, Math.abs(loanDiff));
    }
    const oldAdvDed = parseFloat(current.salary_advance_deduction) || 0;
    const advDed = parseFloat(data.salary_advance_deduction) || 0;
    const advDiff = advDed - oldAdvDed;
    if (advDiff > 0) {
      await deductAdvanceAmount(data.emp_code, advDiff);
    } else if (advDiff < 0) {
      await revertAdvanceDeduction(data.emp_code, Math.abs(advDiff));
    }
  }

  return data;
}

export async function updatePayrollStatus(ids, status) {
  if (status === 'paid') {
    // If status is paid, update them one by one through updatePayrollRow to ensure recoveries are committed safely
    const results = [];
    for (const id of ids) {
      const res = await updatePayrollRow(id, { status });
      results.push(res);
    }
    return results;
  }
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

  // Fetch monthly attendance to get latest OT and payable days per employee
  const { data: attRows } = await supabase
    .from('attendance_monthly')
    .select('emp_code, total_ot, ot_hours, payable_days, payable_days_override')
    .eq('year', year)
    .eq('month', month);

  const attMap = {};
  (attRows || []).forEach(a => {
    if (a.emp_code) {
      attMap[String(a.emp_code).trim().toLowerCase()] = a;
    }
  });

  const getRowPresentDays = (r) => {
    const codeKey = String(r.emp_code || '').trim().toLowerCase();
    const att = attMap[codeKey] || attMap[r.emp_code];
    const rawOverride = att?.payable_days_override;
    const rawPayable = att?.payable_days ?? r.payable_days;

    if (rawOverride !== null && rawOverride !== undefined && String(rawOverride).trim() !== '') {
      return parseFloat(rawOverride);
    } else if (rawPayable !== null && rawPayable !== undefined && String(rawPayable).trim() !== '' && att) {
      return parseFloat(rawPayable);
    }
    return 0;
  };

  // Count eligible employees (puttha_status != 'No' AND presentDays >= 15)
  const eligibleRows = payrollRows.filter(r => (r.puttha_status || 'Yes') !== 'No' && getRowPresentDays(r) >= 15);
  const eligibleCount = eligibleRows.length;

  // Determine the per-employee puttha share for the batch
  let batchPutthaPrice = 0;
  if (totalPutthaAmount > 0 && eligibleCount > 0) {
    batchPutthaPrice = parseFloat((totalPutthaAmount / eligibleCount).toFixed(2));
  } else {
    // Fallback: sum of all existing puttha_prices divided by eligibleCount
    const totalExistingPuttha = payrollRows.reduce((sum, r) => sum + (parseFloat(r.puttha_price) || 0), 0);
    if (totalExistingPuttha > 0 && eligibleCount > 0) {
      batchPutthaPrice = parseFloat((totalExistingPuttha / eligibleCount).toFixed(2));
    }
  }

  // Fetch latest employee salaries
  const empCodes = [...new Set(payrollRows.map(r => r.emp_code))].filter(Boolean);
  const empSalaryMap = {};
  if (empCodes.length > 0) {
    const { data: emps, error: empsErr } = await supabase
      .from('employees')
      .select('employee_id, salary')
      .in('employee_id', empCodes);

    if (!empsErr && emps) {
      emps.forEach(e => {
        if (e.salary !== undefined && e.salary !== null) {
          empSalaryMap[e.employee_id] = parseFloat(e.salary) || 0;
        }
      });
    }
  }

  // Update every payroll row in the batch
  for (const row of payrollRows) {
    if (row.status === 'paid') continue;
    const presentDays = getRowPresentDays(row);
    const codeKey = String(row.emp_code || '').trim().toLowerCase();
    const att = attMap[codeKey] || attMap[row.emp_code];
    const isEligible = (row.puttha_status || 'Yes') !== 'No' && presentDays >= 15;

    const putthaPrice = isEligible ? batchPutthaPrice : 0;
    const empBaseSalary = empSalaryMap[row.emp_code] !== undefined
      ? empSalaryMap[row.emp_code]
      : (parseFloat(row.basic_salary) || 0);

    const basicSalary = parseFloat(empBaseSalary.toFixed(2));
    const earnedBasic = parseFloat(((empBaseSalary / totalDaysInMonth) * presentDays).toFixed(2));
    const rawOt = att?.total_ot || att?.ot_hours || row.ot_hours || row.total_ot || 0;
    const otHours = parseOtHours(rawOt);
    const otAmount = parseFloat((otHours * 50).toFixed(2));

    const newGross = parseFloat((earnedBasic + putthaPrice + otAmount).toFixed(2));
    const totalDeductions = parseFloat(row.total_deductions || 0);
    const rawNet = Math.max(0, newGross - totalDeductions);
    const newNet = rawNet > 0 ? Math.ceil(rawNet / 10) * 10 : 0;

    await supabase
      .from('payroll')
      .update({
        basic_salary: basicSalary,
        payable_days: presentDays,
        ot_hours: otHours,
        ot_amount: otAmount,
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
  const _empBaseSalary = parseFloat(salary) || 0;

  const { data: payrollRows, error } = await supabase
    .from('payroll')
    .select('*')
    .eq('emp_code', empCode);

  if (error || !payrollRows || payrollRows.length === 0) return;

  for (const row of payrollRows) {
    if (row.status === 'paid') continue;
    const year = row.year || new Date().getFullYear();
    const month = row.month || (new Date().getMonth() + 1);
    const totalDaysInMonth = new Date(year, month, 0).getDate() || 30;
    const presentDays = parseFloat(row.payable_days) || 0;

    const empBaseSalary = parseFloat(salary) || 0;
    const basicSalary = parseFloat(empBaseSalary.toFixed(2));
    const earnedBasic = parseFloat(((empBaseSalary / totalDaysInMonth) * presentDays).toFixed(2));
    const putthaPrice = parseFloat(row.puttha_price || 0);
    const otHours = parseOtHours(row.ot_hours || row.total_ot || 0);
    const otAmount = parseFloat((otHours * 50).toFixed(2));
    const newGross = parseFloat((earnedBasic + putthaPrice + otAmount).toFixed(2));
    const totalDeductions = parseFloat(row.total_deductions || 0);
    const rawNet = Math.max(0, newGross - totalDeductions);
    const newNet = rawNet > 0 ? Math.ceil(rawNet / 10) * 10 : 0;

    await supabase
      .from('payroll')
      .update({
        basic_salary: basicSalary,
        ot_hours: otHours,
        ot_amount: otAmount,
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
      if (row.status === 'paid') continue;
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
  return (data || []).map(normalizeAdvance);
}

export async function syncPayrollForEmployeeSalaryAdvance(empCode) {
  if (!empCode) return;

  const empCodeKey = String(empCode).trim();
  const { data: advs } = await supabase
    .from('advances')
    .select('*')
    .eq('employee_id', empCodeKey)
    .in('status', ['Approved', 'Pending']);

  const totalActiveAdvance = (advs || [])
    .filter(a => a.deduction !== 'No')
    .reduce((sum, a) => {
      const remaining = parseFloat(a.remaining_amount !== null && a.remaining_amount !== undefined ? a.remaining_amount : a.amount) || 0;
      return sum + remaining;
    }, 0);

  const { data: payrollRows } = await supabase
    .from('payroll')
    .select('*')
    .eq('emp_code', empCodeKey);

  if (!payrollRows || payrollRows.length === 0) return;

  for (const row of payrollRows) {
    if (row.status === 'paid') continue;
    const gross = parseFloat(row.gross_salary) || 0;
    const currentAdvDed = parseFloat(row.salary_advance_deduction !== null && row.salary_advance_deduction !== undefined ? row.salary_advance_deduction : totalActiveAdvance) || 0;
    const advDedToUse = Math.min(currentAdvDed, totalActiveAdvance);
    const loanDed = parseFloat(row.loan_deduction) || 0;
    const otherDed = parseFloat(row.other_deduction) || 0;
    const pfDed = parseFloat(row.pf_deduction) || 0;
    const esiDed = parseFloat(row.esi_deduction) || 0;

    const newTotalDed = advDedToUse + loanDed + otherDed + pfDed + esiDed;
    const rawNet = gross - newTotalDed;
    const newNet = rawNet > 0 ? Math.ceil(rawNet / 10) * 10 : 0;

    await supabase
      .from('payroll')
      .update({
        advance: totalActiveAdvance,
        salary_advance_deduction: advDedToUse,
        total_deductions: newTotalDed,
        advance_deduction: newTotalDed,
        net_salary: newNet,
        updated_at: new Date().toISOString()
      })
      .eq('id', row.id);
  }
}

export async function upsertAdvance(advance) {
  if (!advance.id && advance.date) {
    const d = new Date(advance.date);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const period = getPreviousProcessingPeriod();
    if (year !== period.year || month !== period.month) {
      throw new Error(`Enforcement Error: Advances can only be processed for the previous processing month (${period.month}/${period.year})`);
    }
  }
  const { data, error } = await supabase
    .from('advances')
    .upsert(advance)
    .select()
    .single();
  if (error) throw error;

  if (advance.employee_id) {
    try {
      await syncPayrollForEmployeeSalaryAdvance(advance.employee_id);
    } catch (e) {
      console.error('Error syncing payroll for advance:', e);
    }
  }

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

  if (data && data.employee_id) {
    try {
      await syncPayrollForEmployeeSalaryAdvance(data.employee_id);
    } catch (e) {
      console.error('Error syncing payroll for advance status:', e);
    }
  }

  return data;
}

export async function deleteAdvance(id) {
  const { data: existing } = await supabase
    .from('advances')
    .select('employee_id')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('advances')
    .delete()
    .eq('id', id);
  if (error) throw error;

  if (existing && existing.employee_id) {
    try {
      await syncPayrollForEmployeeSalaryAdvance(existing.employee_id);
    } catch (e) {
      console.error('Error syncing payroll for deleted advance:', e);
    }
  }
}

// ─── SALARY ADVANCES ────────────────────────────────────────────────────────

export async function syncPayrollForEmployeeAdvance(empCode) {
  if (!empCode) return;

  const empCodeKey = String(empCode).trim();
  const { data: salAdvs } = await supabase
    .from('salary_advances')
    .select('*')
    .eq('employee_id', empCodeKey)
    .in('status', ['Approved', 'Pending']);

  const totalLoanMonthlyDed = (salAdvs || [])
    .filter(a => a.deduction !== 'No')
    .reduce((sum, a) => {
      const mDed = parseFloat(a.monthly_deduction !== null && a.monthly_deduction !== undefined && parseFloat(a.monthly_deduction) > 0 ? a.monthly_deduction : a.amount) || 0;
      return sum + mDed;
    }, 0);

  const { data: payrollRows } = await supabase
    .from('payroll')
    .select('*')
    .eq('emp_code', empCodeKey);

  if (!payrollRows || payrollRows.length === 0) return;

  for (const row of payrollRows) {
    if (row.status === 'paid') continue;
    const gross = parseFloat(row.gross_salary) || 0;
    const advDed = parseFloat(row.salary_advance_deduction) || 0;
    const otherDed = parseFloat(row.other_deduction) || 0;
    const pfDed = parseFloat(row.pf_deduction) || 0;
    const esiDed = parseFloat(row.esi_deduction) || 0;

    const newTotalDed = totalLoanMonthlyDed + advDed + otherDed + pfDed + esiDed;
    const rawNet = gross - newTotalDed;
    const newNet = rawNet > 0 ? Math.ceil(rawNet / 10) * 10 : 0;

    await supabase
      .from('payroll')
      .update({
        loan_deduction: totalLoanMonthlyDed,
        total_deductions: newTotalDed,
        advance_deduction: newTotalDed,
        net_salary: newNet,
        updated_at: new Date().toISOString()
      })
      .eq('id', row.id);
  }
}

export async function fetchEmployeeLoanBalance(employeeId) {
  const { data, error } = await supabase
    .from('salary_advances')
    .select('amount, remaining_amount, status, deduction')
    .eq('employee_id', employeeId)
    .in('status', ['Approved', 'Pending']);
  if (error) throw error;

  let balance = 0;
  (data || []).forEach(row => {
    if (row.deduction === 'No') return;
    const amt = parseFloat(row.amount) || 0;
    const rem = row.remaining_amount !== null && row.remaining_amount !== undefined ? parseFloat(row.remaining_amount) : amt;
    balance += rem;
  });
  return balance;
}

export async function fetchEmployeeAdvanceBalance(employeeId) {
  const { data, error } = await supabase
    .from('advances')
    .select('amount, remaining_amount, status, deduction')
    .eq('employee_id', employeeId)
    .in('status', ['Approved', 'Pending']);
  if (error) throw error;

  let balance = 0;
  (data || []).forEach(row => {
    if (row.deduction === 'No') return;
    const amt = parseFloat(row.amount) || 0;
    const rem = row.remaining_amount !== null && row.remaining_amount !== undefined ? parseFloat(row.remaining_amount) : amt;
    balance += rem;
  });
  return balance;
}

export async function fetchSalaryAdvances() {
  console.log('[Loan] Supabase project:', hrSupabaseProjectUrl);
  console.log('[Loan] Fetching table: salary_advances');
  const { data, error } = await supabase
    .from('salary_advances')
    .select('*')
    .order('date', { ascending: false });
  console.log('[Loan] Raw response:', data);
  if (error) {
    console.error('[Loan] Fetch error:', error);
    throw error;
  }
  return (data || []).map(normalizeLoan);
}

export async function upsertSalaryAdvance(advance) {
  if (!advance.id && advance.date) {
    const d = new Date(advance.date);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const period = getPreviousProcessingPeriod();
    if (year !== period.year || month !== period.month) {
      throw new Error(`Enforcement Error: Loans can only be processed for the previous processing month (${period.month}/${period.year})`);
    }
  }
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

export async function syncAttendanceFromPortal(year, month) {
  const pad = (n) => String(n).padStart(2, '0');
  const today = new Date();
  const isCurrentMonth = (year === today.getFullYear() && month === (today.getMonth() + 1));
  const lastDay = isCurrentMonth ? today.getDate() : new Date(year, month, 0).getDate();
  const from = `${year}-${pad(month)}-01`;
  const to = `${year}-${pad(month)}-${pad(lastDay)}`;

  let backendUrl = import.meta.env.VITE_ESSL_BACKEND_URL || import.meta.env.VITE_ESSL_BASE || 'http://localhost:5000/api/';
  if (!backendUrl.endsWith('/')) {
    backendUrl += '/';
  }
  if (!backendUrl.includes('/api/')) {
    backendUrl += 'api/';
  }
  // Fetch each day's attendance in parallel to avoid Render's 30-second request timeout limit
  const dayQueries = [];
  for (let d = 1; d <= lastDay; d++) {
    dayQueries.push(d);
  }

  const results = await Promise.all(
    dayQueries.map(day =>
      fetch(`${backendUrl}attendance?day=${day}&month=${month}&year=${year}`)
        .then(res => {
          if (!res.ok) {
            throw new Error(`Failed to fetch for day ${day}: ${res.statusText}`);
          }
          return res.json();
        })
        .then(json => json.rows || [])
        .catch(err => {
          console.warn(`Error fetching logs for day ${day}:`, err.message);
          return [];
        })
    )
  );

  const esslRows = results.flat();

  if (esslRows.length === 0) {
    throw new Error('No attendance logs found in the portal for the selected month.');
  }

  const employeesMap = {};

  esslRows.forEach(row => {
    const empCode = String(row['Emp Code']).trim();
    const empName = String(row['Emp Name']).trim();
    if (!empCode || !empName) return;

    if (!employeesMap[empCode]) {
      employeesMap[empCode] = {
        emp_code: empCode,
        emp_name: empName,
        daily_status: { _meta: {} }
      };
    }

    const dateStr = row['Attendance Date'];
    const dayMatch = /^(\d+)/.exec(dateStr);
    if (dayMatch) {
      const dayNum = parseInt(dayMatch[1], 10);
      employeesMap[empCode].daily_status[dayNum] = String(row.Status).trim();
      employeesMap[empCode].daily_status._meta[dayNum] = {
        ot: row['Over Time'] || '00:00',
        in_time: row.InTime || null,
        late_by: parseInt(row.LateBy || '0', 10),
        early_by: parseInt(row.EarlyBy || '0', 10),
        out_time: row.OutTime || null,
        punch_records: row.PunchRecords || null,
      };
    }
  });

  const employees = Object.values(employeesMap).map((emp, index) => {
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalLeave = 0;
    let totalHoliday = 0;
    let totalHalfPresent = 0;
    let totalWO = 0;
    let totalWOP = 0;
    let payableDays = 0;
    let totalOTMinutes = 0;
    let totalLate = 0;
    let totalEarly = 0;

    Object.entries(emp.daily_status).forEach(([key, val]) => {
      if (key === '_meta' || !val) return;
      const code = String(val).trim();

      const payVal = STATUS_PAY_VALUE[code] !== undefined ? STATUS_PAY_VALUE[code] : 0;
      payableDays += payVal;

      if (code === 'P' || code === 'p' || code === 'P(OD)') totalPresent++;
      else if (code === 'A') totalAbsent++;
      else if (code === 'L' || code === 'CL' || code === 'PL' || code === 'SL') totalLeave++;
      else if (code === 'H') totalHoliday++;
      else if (code === 'HP') totalHalfPresent++;
      else if (code === 'WO') totalWO++;
      else if (code === 'WOP') totalWOP++;
    });

    Object.entries(emp.daily_status._meta).forEach(([_, mVal]) => {
      if (mVal) {
        totalLate += mVal.late_by || 0;
        totalEarly += mVal.early_by || 0;
        if (mVal.ot && mVal.ot !== '00:00') {
          const parts = mVal.ot.split(':');
          const h = parseInt(parts[0] || '0', 10);
          const m = parseInt(parts[1] || '0', 10);
          totalOTMinutes += (h * 60 + m);
        }
      }
    });

    const otHours = Math.floor(totalOTMinutes / 60);
    const otMins = totalOTMinutes % 60;
    const totalOT = `${String(otHours).padStart(2, '0')}:${String(otMins).padStart(2, '0')}`;

    emp.daily_status._meta.total_cl = 0;
    emp.daily_status._meta.total_pl = 0;
    emp.daily_status._meta.total_sl = 0;
    emp.daily_status._meta.total_hp = totalHalfPresent;
    emp.daily_status._meta.total_other_leave = 0;
    emp.daily_status._meta.total_leave = totalLeave;
    emp.daily_status._meta.total_present = totalPresent;
    emp.daily_status._meta.payable_days = payableDays;
    emp.daily_status._meta.total_late = totalLate;
    emp.daily_status._meta.total_early = totalEarly;

    return {
      sl_no: index + 1,
      emp_code: emp.emp_code,
      emp_name: emp.emp_name,
      daily_status: emp.daily_status,
      total_present: totalPresent,
      total_absent: totalAbsent,
      total_leave: totalLeave,
      total_holiday: totalHoliday,
      total_half_present: totalHalfPresent,
      total_wo: totalWO,
      total_wop: totalWOP,
      payable_days: payableDays,
      total_ot: totalOT,
      total_late: totalLate,
      total_early: totalEarly,
    };
  });

  const dummyUpload = {
    periodFrom: from,
    periodTo: to,
    companyName: 'Default',
    department: 'Default',
    fileName: 'Portal Sync',
    uploadedBy: null,
    year: year,
    month: month,
  };

  const uploadRecord = await createUploadRecord(dummyUpload);

  await saveAttendanceRows(
    uploadRecord.id,
    employees,
    year,
    month,
    'Default',
    'Default'
  );

  await updateUploadRecord(uploadRecord.id, {
    status: 'processed',
    total_rows: employees.length,
    processed_rows: employees.length,
  });

  return { count: employees.length };
}

