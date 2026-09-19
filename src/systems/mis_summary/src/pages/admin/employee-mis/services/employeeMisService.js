/**
 * employeeMisService.js
 * Service layer for the Employee MIS module.
 *
 * Handles:
 * - Data fetching from HR FMS Supabase project (`hrSupabase`)
 * - Data fetching from eSSL biometric attendance API (`/api/attendance/range`)
 * - Defensive time and duration parsing/formatting
 * - Roster filtering and merging logic for Daily and Monthly views
 */

import hrSupabase from '../../../../../../HR_fms/src/services/supabaseHRClient';

let hasLoggedRawEsslRow = false;

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Pure helper: Parses duration or time strings ("HH:MM", "H:MM", "HH:MM:SS") into total integer minutes.
 * Returns null if the value is missing, invalid, or cannot be parsed.
 *
 * @param {string|number|null} str
 * @returns {number|null}
 */
export function parseDurationToMinutes(str) {
  if (str === null || str === undefined) return null;
  const s = String(str).trim();
  if (!s || s === '-' || s === '—') return null;

  // Handle "HH:MM:SS" or "HH:MM"
  if (s.includes(':')) {
    const parts = s.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parts[2] ? parseInt(parts[2], 10) : 0;
    if (isNaN(hours) || isNaN(minutes)) return null;
    return hours * 60 + minutes + Math.round(seconds / 60);
  }

  // Handle decimal hours (e.g. "8.5")
  const num = parseFloat(s);
  if (!isNaN(num)) {
    return Math.round(num * 60);
  }

  return null;
}

/**
 * Pure helper: Formats minutes integer back into "H:MM" format.
 * Returns "—" if mins is null, undefined, or NaN.
 * Floored at 0.
 *
 * @param {number|null} mins
 * @returns {string}
 */
export function formatMinutesToHm(mins) {
  if (mins === null || mins === undefined || isNaN(mins)) return '—';
  const clamped = Math.max(0, Math.floor(mins));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/**
 * Helper to inspect dynamic eSSL table headers case-insensitively and trimmed.
 *
 * NOTE FOR PRODUCTION / LIVE DEPLOYMENT:
 * The eSSL eTimeTrackLite portal HTML table headers can vary slightly across
 * installations, versions, or export modes (e.g. 'Emp Code' vs 'EmpCode' vs 'emp_code').
 * This helper tries the provided variant list. If any field comes back blank in
 * real-world testing, check the one-time raw eSSL row logged to the browser console
 * and adjust the variant list below.
 *
 * @param {object} row
 * @param  {...string} possibleKeys
 * @returns {string}
 */
export function pick(row, ...possibleKeys) {
  if (!row || typeof row !== 'object') return '';
  const rowKeys = Object.keys(row);
  for (const key of possibleKeys) {
    const target = key.trim().toLowerCase();
    const matchedKey = rowKeys.find(k => k.trim().toLowerCase() === target);
    if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
      return String(row[matchedKey]).trim();
    }
  }
  return '';
}

/**
 * Synthesizes or completes a daily_status object for an employee when daily columns
 * are sparse, assigning WO on Sundays.
 * Reused from HR_fms supabaseHR logic.
 */
export function fillDailyStatus(emp, year, month) {
  if (!year || !month || !emp) return emp?.daily_status || {};

  const totalDaysInMonth = new Date(year, month, 0).getDate();
  const existingDaily = emp.daily_status || {};
  const result = { ...existingDaily };

  // Assign WO on Sundays if not already set
  for (let d = 1; d <= totalDaysInMonth; d++) {
    if (!result[d]) {
      const dateObj = new Date(year, month - 1, d);
      if (dateObj.getDay() === 0) {
        result[d] = 'WO';
      }
    }
  }

  return result;
}

/**
 * Fetches the active employee roster from HR Supabase for a given date.
 * Confirmed columns on employees table: employee_id, name, date_of_joining, date_of_leaving, status.
 *
 * @param {string} selectedDate YYYY-MM-DD
 * @returns {Promise<Array>}
 */
export async function fetchEmployeesRoster(selectedDate) {
  const { data, error } = await hrSupabase
    .from('employees')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;

  // Roster correctness rules:
  // 1. Exclude employees who joined after selectedDate (date_of_joining > selectedDate)
  // 2. Exclude employees who left before selectedDate (date_of_leaving < selectedDate)
  // 3. Exclude employees with status 'left' or 'inactive' whose date_of_leaving < selectedDate or unspecified
  const activeEmployees = (data || []).filter(emp => {
    if (emp.date_of_joining && emp.date_of_joining > selectedDate) {
      return false;
    }

    if (emp.date_of_leaving && emp.date_of_leaving < selectedDate) {
      return false;
    }

    const status = String(emp.status || '').trim().toLowerCase();
    if (status === 'left' || status === 'inactive') {
      if (emp.date_of_leaving && emp.date_of_leaving >= selectedDate) {
        return true;
      }
      return false;
    }

    return true;
  });

  return activeEmployees;
}

/**
 * Fetches eSSL biometric attendance logs for a single day from the backend endpoint.
 *
 * @param {string} selectedDate YYYY-MM-DD
 * @returns {Promise<Array>}
 */
export async function fetchEsslAttendance(selectedDate) {
  const response = await fetch(`/api/attendance/range?from=${selectedDate}&to=${selectedDate}`);
  if (!response.ok) {
    let errMsg = `Failed to fetch attendance logs (${response.status})`;
    try {
      const errJson = await response.json();
      if (errJson.error) errMsg = errJson.error;
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }

  const json = await response.json();
  const rows = json.rows || [];

  if (!hasLoggedRawEsslRow && rows.length > 0) {
    console.log('RAW ESSL ROW (inspect real header names here):', rows[0]);
    hasLoggedRawEsslRow = true;
  }

  return rows;
}

/**
 * Fetches all breaks for all employees on a specific date from HR Supabase.
 *
 * @param {string} date YYYY-MM-DD
 * @returns {Promise<Array>}
 */
export async function fetchBreaksForDate(date) {
  const { data, error } = await hrSupabase
    .from('employee_breaks')
    .select('*')
    .eq('break_date', date);

  if (error) throw error;
  return data || [];
}

/**
 * Inserts a new break or updates an existing break in employee_breaks.
 * Note: `break_minutes` is a generated column in Postgres and is not directly modified.
 *
 * @param {object} payload
 * @returns {Promise<object>}
 */
export async function upsertEmployeeBreak(payload) {
  const { id, emp_code, emp_name, break_date, break_start, break_end, reason } = payload;

  const cleanedBreakEnd = break_end && String(break_end).trim() !== '' ? String(break_end).trim() : null;
  const cleanedBreakStart = break_start && String(break_start).trim() !== '' ? String(break_start).trim() : null;
  const cleanedReason = reason && String(reason).trim() !== '' ? String(reason).trim() : null;

  if (id) {
    const updateData = {
      break_start: cleanedBreakStart,
      break_end: cleanedBreakEnd,
      reason: cleanedReason,
      updated_at: new Date().toISOString(),
    };
    if (emp_name) updateData.emp_name = emp_name;

    const { data, error } = await hrSupabase
      .from('employee_breaks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } else {
    const insertData = {
      emp_code: String(emp_code).trim(),
      emp_name: emp_name ? String(emp_name).trim() : null,
      break_date,
      break_start: cleanedBreakStart,
      break_end: cleanedBreakEnd,
      reason: cleanedReason,
    };

    const { data, error } = await hrSupabase
      .from('employee_breaks')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

/**
 * Merges employee roster, parsed eSSL attendance, and breaks for a date.
 * Separated into pure helper to allow partial re-sync of eSSL rows without re-fetching roster.
 *
 * @param {Array} employees
 * @param {Array} esslRows
 * @param {Array} breaks
 * @returns {Array}
 */
export function mergeDailyRoster(employees, esslRows, breaks) {
  const breaksMap = new Map();
  breaks.forEach(b => {
    if (b.emp_code) {
      breaksMap.set(String(b.emp_code).trim().toLowerCase(), b);
    }
  });

  const parsedEsslRows = (esslRows || []).map(row => ({
    raw: row,
    emp_code: pick(row, 'Emp Code', 'EmpCode', 'emp_code'),
    emp_name: pick(row, 'Emp Name', 'EmpName', 'emp_name'),
    status: pick(row, 'Status', 'status'),
    in_time: pick(row, 'In Time', 'InTime', 'in_time'),
    out_time: pick(row, 'Out Time', 'OutTime', 'out_time'),
    overtime: pick(row, 'Over Time', 'OverTime', 'OT', 'ot'),
    shift: pick(row, 'Shift', 'ShiftName', 'Shift Name', 'shift'),
    work_duration: pick(row, 'Work Duration', 'Duration', 'Direct Duration', 'work_duration', 'WorkDuration', 'Working Hours', 'WorkingHours', 'Work Dur'),
    total_duration: pick(row, 'Total Duration', 'total_duration', 'TotalDuration', 'Tot Duration', 'TotDuration', 'Total Hours', 'TotalHours', 'Tot Hours'),
  }));

  return employees.map(emp => {
    const empCode = String(emp.employee_id || emp.emp_code || '').trim();
    const empCodeLower = empCode.toLowerCase();
    const empName = String(emp.name || '').trim();
    const empNameLower = empName.toLowerCase();

    let esslMatch = null;
    if (empCodeLower) {
      esslMatch = parsedEsslRows.find(
        r => r.emp_code && r.emp_code.toLowerCase() === empCodeLower
      );
    }

    if (!esslMatch) {
      const fallback = parsedEsslRows.find(
        r => !r.emp_code && r.emp_name && r.emp_name.toLowerCase() === empNameLower
      );
      if (fallback) {
        console.warn(
          `[EmployeeMIS] Warning: Falling back to name match for "${empName}" (code "${empCode}") because eSSL row had no emp_code.`
        );
        esslMatch = fallback;
      }
    }

    const breakRow = breaksMap.get(empCodeLower) || null;

    let breakMinutes = null;
    const isBreakOngoing = Boolean(breakRow && !breakRow.break_end);

    if (breakRow) {
      if (breakRow.break_minutes !== null && breakRow.break_minutes !== undefined) {
        breakMinutes = breakRow.break_minutes;
      } else if (breakRow.break_start && breakRow.break_end) {
        const startMins = parseDurationToMinutes(breakRow.break_start);
        const endMins = parseDurationToMinutes(breakRow.break_end);
        if (startMins !== null && endMins !== null && endMins >= startMins) {
          breakMinutes = endMins - startMins;
        }
      }
    }

    // Extract all candidate values
    const rawInTime = esslMatch?.in_time || '';
    const rawOutTime = esslMatch?.out_time || '';
    const rawWorkDuration = esslMatch?.work_duration || '';
    const rawOvertime = esslMatch?.overtime || '';
    const rawTotalDuration = esslMatch?.total_duration || '';

    const inMins = parseDurationToMinutes(rawInTime);
    const outMins = parseDurationToMinutes(rawOutTime);
    const workDurationMins = parseDurationToMinutes(rawWorkDuration);
    const otMins = parseDurationToMinutes(rawOvertime) || 0;
    let totalDurationMins = parseDurationToMinutes(rawTotalDuration);

    // Calculate duration between punches (in_time & out_time) if both exist
    let punchDurationMins = null;
    if (inMins !== null && outMins !== null) {
      let diff = outMins - inMins;
      if (diff < 0) diff += 1440; // overnight shift handling
      punchDurationMins = diff;
    }

    // 1. Resolve Total Duration if missing or 0
    if (totalDurationMins === null || (totalDurationMins === 0 && ((punchDurationMins || 0) > 0 || (workDurationMins || 0) > 0))) {
      if (punchDurationMins !== null && punchDurationMins > 0) {
        totalDurationMins = punchDurationMins;
      } else if (workDurationMins !== null && workDurationMins > 0) {
        totalDurationMins = workDurationMins + otMins;
      }
    }

    // 2. Resolve Work Duration if missing but total_duration exists
    let resolvedWorkDuration = rawWorkDuration;
    if ((!resolvedWorkDuration || resolvedWorkDuration === '—' || resolvedWorkDuration === '00:00') && totalDurationMins !== null && totalDurationMins > 0) {
      const derivedWorkMins = Math.max(0, totalDurationMins - otMins);
      resolvedWorkDuration = formatMinutesToHm(derivedWorkMins);
    }

    // 3. Resolve Hours Worked: Total Duration - break_minutes (floored at 0)
    let hoursWorkedMins = null;
    if (totalDurationMins !== null && totalDurationMins > 0) {
      if (isBreakOngoing) {
        hoursWorkedMins = totalDurationMins;
      } else {
        hoursWorkedMins = Math.max(0, totalDurationMins - (breakMinutes || 0));
      }
    } else if (punchDurationMins !== null && punchDurationMins > 0) {
      if (isBreakOngoing) {
        hoursWorkedMins = punchDurationMins;
      } else {
        hoursWorkedMins = Math.max(0, punchDurationMins - (breakMinutes || 0));
      }
    } else if (workDurationMins !== null && workDurationMins > 0) {
      const netFromWork = workDurationMins + otMins;
      if (isBreakOngoing) {
        hoursWorkedMins = netFromWork;
      } else {
        hoursWorkedMins = Math.max(0, netFromWork - (breakMinutes || 0));
      }
    }

    // 4. Guarantee bidirectional consistency:
    // If Hours Worked has a value but Total Duration was empty, derive Total Duration
    if ((totalDurationMins === null || totalDurationMins === 0) && hoursWorkedMins !== null && hoursWorkedMins > 0) {
      totalDurationMins = isBreakOngoing ? hoursWorkedMins : (hoursWorkedMins + (breakMinutes || 0));
    }

    // If Total Duration has a value but Hours Worked was empty, derive Hours Worked
    if (totalDurationMins !== null && totalDurationMins > 0 && (hoursWorkedMins === null || hoursWorkedMins === undefined)) {
      hoursWorkedMins = isBreakOngoing ? totalDurationMins : Math.max(0, totalDurationMins - (breakMinutes || 0));
    }

    // Format resolved values
    const finalTotalDuration = (totalDurationMins !== null && totalDurationMins > 0)
      ? formatMinutesToHm(totalDurationMins)
      : (rawTotalDuration && rawTotalDuration !== '—' && rawTotalDuration !== '00:00' && rawTotalDuration !== '0:00' ? rawTotalDuration : '—');

    const finalHoursWorked = (hoursWorkedMins !== null && hoursWorkedMins > 0)
      ? formatMinutesToHm(hoursWorkedMins)
      : (finalTotalDuration !== '—' && (!breakMinutes || breakMinutes === 0) ? finalTotalDuration : '—');

    const finalWorkDuration = (resolvedWorkDuration && resolvedWorkDuration !== '—' && resolvedWorkDuration !== '00:00')
      ? resolvedWorkDuration
      : (finalTotalDuration !== '—' ? finalTotalDuration : '—');

    return {
      emp_id: emp.id,
      emp_code: empCode,
      emp_name: empName,
      shift: esslMatch?.shift || '—',
      in_time: esslMatch?.in_time || '—',
      out_time: esslMatch?.out_time || '—',
      work_duration: finalWorkDuration,
      overtime: esslMatch?.overtime || '—',
      total_duration: finalTotalDuration,
      status: esslMatch?.status || 'A',
      breakRow,
      break_minutes: breakMinutes,
      isBreakOngoing,
      hours_worked: finalHoursWorked,
      raw_essl: esslMatch?.raw || null,
    };
  });
}

/**
 * Fetches and merges employee roster, eSSL biometric attendance, and breaks for a date.
 * Gracefully captures eSSL 502 / network failures so roster still loads.
 *
 * @param {string} selectedDate YYYY-MM-DD
 * @returns {Promise<{ rows: Array, employees: Array, breaks: Array, esslError: string|null }>}
 */
export async function fetchDailyRoster(selectedDate) {
  const [employees, breaks] = await Promise.all([
    fetchEmployeesRoster(selectedDate),
    fetchBreaksForDate(selectedDate),
  ]);

  let esslRows = [];
  let esslError = null;

  try {
    esslRows = await fetchEsslAttendance(selectedDate);
  } catch (err) {
    console.warn(`[EmployeeMIS] Could not reach attendance portal for ${selectedDate}:`, err.message);
    esslError = err.message || 'Could not reach attendance portal.';
  }

  const rows = mergeDailyRoster(employees, esslRows, breaks);

  return {
    rows,
    employees,
    breaks,
    esslError,
  };
}

/**
 * Fetches monthly aggregated attendance, working hours, breaks, and overtime for all employees.
 *
 * @param {number} year
 * @param {number} month 1-12
 * @returns {Promise<{ rows: Array, hasData: boolean }>}
 */
export async function fetchMonthlyAggregates(year, month) {
  const pad = (n) => String(n).padStart(2, '0');
  const totalDaysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfMonth = `${year}-${pad(month)}-01`;
  const lastDayOfMonth = `${year}-${pad(month)}-${pad(totalDaysInMonth)}`;

  // Query in parallel:
  // 1. attendance_monthly from HR Supabase
  // 2. employees roster to know join date, leaving date, status
  // 3. employee_breaks across the entire month
  const [monthlyRes, employeesRes, breaksRes] = await Promise.all([
    hrSupabase
      .from('attendance_monthly')
      .select('*')
      .eq('year', year)
      .eq('month', month)
      .order('emp_name', { ascending: true }),
    hrSupabase
      .from('employees')
      .select('employee_id, name, date_of_joining, date_of_leaving, status'),
    hrSupabase
      .from('employee_breaks')
      .select('*')
      .gte('break_date', firstDayOfMonth)
      .lte('break_date', lastDayOfMonth),
  ]);

  if (monthlyRes.error) throw monthlyRes.error;
  if (employeesRes.error) throw employeesRes.error;
  if (breaksRes.error) throw breaksRes.error;

  const monthlyRows = monthlyRes.data || [];
  const employees = employeesRes.data || [];
  const breaks = breaksRes.data || [];

  if (monthlyRows.length === 0) {
    return { rows: [], hasData: false };
  }

  // Index employees by employee_id lowercase
  const empProfileMap = new Map();
  employees.forEach(emp => {
    if (emp.employee_id) {
      empProfileMap.set(String(emp.employee_id).trim().toLowerCase(), emp);
    }
  });

  // Group breaks by employee code and date
  // Map: emp_code -> Map(break_date -> breakRow)
  const breaksByEmp = new Map();
  breaks.forEach(b => {
    const code = String(b.emp_code || '').trim().toLowerCase();
    if (!code) return;
    if (!breaksByEmp.has(code)) {
      breaksByEmp.set(code, new Map());
    }
    breaksByEmp.get(code).set(b.break_date, b);
  });

  const aggregateRows = [];

  for (const row of monthlyRows) {
    const empCode = String(row.emp_code || '').trim();
    const empCodeLower = empCode.toLowerCase();
    const profile = empProfileMap.get(empCodeLower);

    // Filter joiners/leavers across the month:
    // Exclude if joined after this month
    if (profile?.date_of_joining && profile.date_of_joining > lastDayOfMonth) {
      continue;
    }
    // Exclude if left before this month
    if (profile?.date_of_leaving && profile.date_of_leaving < firstDayOfMonth) {
      continue;
    }
    // Exclude if marked left/inactive before this month
    const profileStatus = String(profile?.status || '').trim().toLowerCase();
    if ((profileStatus === 'left' || profileStatus === 'inactive') &&
        profile?.date_of_leaving && profile.date_of_leaving < firstDayOfMonth) {
      continue;
    }

    // Determine active employment day boundaries within this month
    let employedStartDay = 1;
    let employedEndDay = totalDaysInMonth;

    if (profile?.date_of_joining && profile.date_of_joining >= firstDayOfMonth && profile.date_of_joining <= lastDayOfMonth) {
      const joinDay = parseInt(profile.date_of_joining.slice(8, 10), 10);
      if (!isNaN(joinDay)) employedStartDay = joinDay;
    }

    if (profile?.date_of_leaving && profile.date_of_leaving >= firstDayOfMonth && profile.date_of_leaving <= lastDayOfMonth) {
      const leaveDay = parseInt(profile.date_of_leaving.slice(8, 10), 10);
      if (!isNaN(leaveDay)) employedEndDay = leaveDay;
    }

    // Complete daily status (assigns Sunday WO etc.)
    const dailyStatus = fillDailyStatus(row, year, month);
    const meta = dailyStatus._meta || row.daily_status?._meta || {};

    let daysPresent = 0;
    const presentDays = [];

    // Count present days within the employee's active period
    for (let d = employedStartDay; d <= employedEndDay; d++) {
      const code = String(dailyStatus[d] || '').trim();
      if (code === 'P' || code === 'p' || code === 'P(OD)') {
        daysPresent += 1;
        presentDays.push(d);
      } else if (code === 'HP') {
        daysPresent += 0.5;
        presentDays.push(d);
      }
      // Explicitly excluded: WO, H, L, CL, PL, SL, A, and days outside employed period
    }

    const empBreaksMap = breaksByEmp.get(empCodeLower) || new Map();

    // 1. Avg Working Hours / Day
    let totalWorkedMinutes = 0;
    let presentDaysWithHours = 0;

    presentDays.forEach(d => {
      const dayMeta = meta[d] || {};
      const inMins = parseDurationToMinutes(dayMeta.in_time);
      const outMins = parseDurationToMinutes(dayMeta.out_time);
      const directDurationMins = parseDurationToMinutes(
        dayMeta.total_duration || dayMeta.duration || dayMeta.work_duration || dayMeta.direct_duration
      );

      let dayTotalMins = null;
      if (inMins !== null && outMins !== null) {
        let diff = outMins - inMins;
        if (diff < 0) diff += 1440; // overnight shift handling
        dayTotalMins = diff;
      } else if (directDurationMins !== null && directDurationMins > 0) {
        dayTotalMins = directDurationMins;
      }

      if (dayTotalMins !== null) {
        const dateStr = `${year}-${pad(month)}-${pad(d)}`;
        const dayBreak = empBreaksMap.get(dateStr);
        if (dayBreak && dayBreak.break_minutes !== null && dayBreak.break_minutes !== undefined) {
          dayTotalMins = Math.max(0, dayTotalMins - dayBreak.break_minutes);
        }
        totalWorkedMinutes += dayTotalMins;
        presentDaysWithHours++;
      }
    });

    const divisor = presentDaysWithHours > 0 ? presentDaysWithHours : daysPresent;
    const avgWorkingMins = divisor > 0 ? (totalWorkedMinutes / divisor) : 0;
    const avgWorkingHoursDisplay = (totalWorkedMinutes > 0 && divisor > 0)
      ? formatMinutesToHm(avgWorkingMins)
      : '—';

    // 2. Avg Break (min)
    let totalBreakMinutes = 0;
    empBreaksMap.forEach(b => {
      if (b.break_minutes !== null && b.break_minutes !== undefined) {
        totalBreakMinutes += b.break_minutes;
      }
    });
    const avgBreakMins = daysPresent > 0 ? Math.round(totalBreakMinutes / daysPresent) : 0;
    const avgBreakDisplay = daysPresent > 0 ? `${avgBreakMins} min` : '—';

    // 3. Avg In Delay
    let totalLateBy = 0;
    presentDays.forEach(d => {
      const late = Number(meta[d]?.late_by) || 0;
      totalLateBy += late;
    });
    const avgLateBy = daysPresent > 0 ? Math.round(totalLateBy / daysPresent) : 0;
    const avgLateDisplay = daysPresent > 0 ? `${avgLateBy} min` : '—';

    // 4. Avg Out Delay/Early (leaving early)
    let totalEarlyBy = 0;
    presentDays.forEach(d => {
      const early = Number(meta[d]?.early_by) || 0;
      totalEarlyBy += early;
    });
    const avgEarlyBy = daysPresent > 0 ? Math.round(totalEarlyBy / daysPresent) : 0;
    const avgEarlyDisplay = daysPresent > 0 ? `${avgEarlyBy} min` : '—';

    // 5. Total Overtime
    let totalOtMinutes = 0;
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const otStr = meta[d]?.ot;
      if (otStr) {
        const otM = parseDurationToMinutes(otStr);
        if (otM !== null) totalOtMinutes += otM;
      }
    }

    // Cross check with attendance_monthly row total_ot
    const rowTotalOtM = parseDurationToMinutes(row.total_ot);
    if (rowTotalOtM !== null && Math.abs(rowTotalOtM - totalOtMinutes) > 5) {
      console.warn(
        `[EmployeeMIS] Total OT divergence for ${row.emp_name} (${row.emp_code}): day-by-day sum = ${totalOtMinutes} mins vs monthly row total_ot = ${rowTotalOtM} mins`
      );
    }

    const totalOtDisplay = formatMinutesToHm(totalOtMinutes);

    aggregateRows.push({
      emp_id: row.id,
      emp_code: empCode,
      emp_name: row.emp_name || profile?.name || empCode,
      days_present: daysPresent,
      avg_working_hours: avgWorkingHoursDisplay,
      avg_break: avgBreakDisplay,
      avg_in_delay: avgLateDisplay,
      avg_out_early: avgEarlyDisplay,
      total_ot: totalOtDisplay,
    });
  }

  return {
    rows: aggregateRows,
    hasData: true,
  };
}
