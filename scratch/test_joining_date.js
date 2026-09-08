function isEmployeeEligibleForPayroll(employee, year, month) {
  if (!employee || !year || !month) return true;

  const dojRaw = employee.date_of_joining || employee.joining_date || employee.date_joining || employee.doj;
  if (!dojRaw) return true;

  const lastDayNum = new Date(year, month, 0).getDate();
  const monthPadded = String(month).padStart(2, '0');
  const lastDayPadded = String(lastDayNum).padStart(2, '0');
  const payrollMonthEndDateStr = `${year}-${monthPadded}-${lastDayPadded}`;

  let dojStr = '';
  if (typeof dojRaw === 'string') {
    const trimmed = dojRaw.trim();
    if (trimmed.match(/^\d{4}-\d{2}-\d{2}/)) {
      dojStr = trimmed.slice(0, 10);
    } else if (trimmed.includes('-') || trimmed.includes('/')) {
      const parts = trimmed.split(/[-/]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          dojStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        } else if (parts[2].length === 4) {
          dojStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
    }
  } else if (dojRaw instanceof Date && !isNaN(dojRaw)) {
    dojStr = dojRaw.toISOString().slice(0, 10);
  }

  if (!dojStr) return true;

  return dojStr <= payrollMonthEndDateStr;
}

console.log('====================================================');
console.log('Testing Joining Date Eligibility for August 2026 Payroll');
console.log('Payroll Month: August 2026');
console.log('Payroll End Date: 31-Aug-2026');
console.log('====================================================\n');

const testCases = [
  { doj: '2026-07-15', expected: true, label: 'Joining Date: 15-Jul-2026 (ISO YYYY-MM-DD)' },
  { doj: '2026-08-01', expected: true, label: 'Joining Date: 01-Aug-2026 (ISO YYYY-MM-DD)' },
  { doj: '2026-08-31', expected: true, label: 'Joining Date: 31-Aug-2026 (ISO YYYY-MM-DD)' },
  { doj: '2026-09-01', expected: false, label: 'Joining Date: 01-Sep-2026 (ISO YYYY-MM-DD)' },
  { doj: '2026-09-15', expected: false, label: 'Joining Date: 15-Sep-2026 (ISO YYYY-MM-DD)' },
  { doj: '15-07-2026', expected: true, label: 'Joining Date: 15-07-2026 (DD-MM-YYYY)' },
  { doj: '01-08-2026', expected: true, label: 'Joining Date: 01-08-2026 (DD-MM-YYYY)' },
  { doj: '31-08-2026', expected: true, label: 'Joining Date: 31-08-2026 (DD-MM-YYYY)' },
  { doj: '01-09-2026', expected: false, label: 'Joining Date: 01-09-2026 (DD-MM-YYYY)' },
  { doj: '15-09-2026', expected: false, label: 'Joining Date: 15-09-2026 (DD-MM-YYYY)' },
];

let passed = 0;
testCases.forEach((tc, idx) => {
  const result = isEmployeeEligibleForPayroll({ date_of_joining: tc.doj }, 2026, 8);
  const isMatch = result === tc.expected;
  const badge = isMatch ? 'PASSED ✅' : 'FAILED ❌';
  console.log(`Test ${idx + 1}: ${badge}`);
  console.log(`  Case: ${tc.label}`);
  console.log(`  Result: ${result ? 'INCLUDE (true)' : 'EXCLUDE (false)'} | Expected: ${tc.expected ? 'INCLUDE (true)' : 'EXCLUDE (false)'}\n`);
  if (isMatch) passed++;
});

console.log(`Summary: ${passed} / ${testCases.length} tests passed.`);
