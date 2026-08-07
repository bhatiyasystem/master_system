import { StyleSheet } from '@react-pdf/renderer';
import { MONTHS } from '../services/supabaseHR';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    backgroundColor: '#ffffff',
    padding: 32,
    color: '#1e293b',
  },

  // ── Header band ──
  headerBand: {
    backgroundColor: '#1e3a8a',
    borderRadius: 6,
    padding: '14 20',
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  companyName: { color: '#ffffff', fontSize: 16, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },
  companyTagline: { color: '#93c5fd', fontSize: 8, marginTop: 3 },
  headerRight: { alignItems: 'flex-end' },
  payslipLabel: { color: '#93c5fd', fontSize: 8, letterSpacing: 1.5 },
  payPeriod: { color: '#ffffff', fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 3 },

  // ── Employee info strip ──
  infoStrip: {
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    padding: '10 14',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    borderLeft: '3 solid #3b82f6',
  },
  infoBlock: { flex: 1 },
  infoLabel: { color: '#64748b', fontSize: 7.5, marginBottom: 2 },
  infoValue: { color: '#0f172a', fontSize: 9, fontFamily: 'Helvetica-Bold' },

  // ── Section heading ──
  sectionHeading: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#64748b',
    letterSpacing: 1,
    marginBottom: 5,
    marginTop: 2,
  },

  // ── Salary summary strip (actual vs earned) ──
  salaryStrip: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  salaryCard: {
    flex: 1,
    borderRadius: 4,
    padding: '10 12',
    border: '1 solid #e2e8f0',
  },
  salaryCardBlue: { backgroundColor: '#eff6ff', border: '1 solid #bfdbfe' },
  salaryCardGreen: { backgroundColor: '#f0fdf4', border: '1 solid #bbf7d0' },
  salaryCardLabel: { fontSize: 7.5, color: '#64748b', marginBottom: 3 },
  salaryCardValue: { fontSize: 15, fontFamily: 'Helvetica-Bold' },
  salaryCardValueBlue: { color: '#1d4ed8' },
  salaryCardValueGreen: { color: '#15803d' },
  salaryCardSub: { fontSize: 7, color: '#94a3b8', marginTop: 2 },

  // ── Attendance grid ──
  attendanceGrid: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  attCell: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    padding: '8 6',
    alignItems: 'center',
    border: '1 solid #e2e8f0',
  },
  attCellHighlight: {
    backgroundColor: '#eff6ff',
    border: '1 solid #bfdbfe',
  },
  attCellRed: {
    backgroundColor: '#fff1f2',
    border: '1 solid #fecdd3',
  },
  attValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#1e3a8a' },
  attValueRed: { color: '#be123c' },
  attValueGray: { color: '#475569' },
  attLabel: { fontSize: 6.5, color: '#64748b', marginTop: 2, textAlign: 'center' },

  // ── Two-column layout ──
  columns: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  column: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    border: '1 solid #e2e8f0',
    padding: '10 12',
  },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  lineLabel: { color: '#475569', fontSize: 8.5 },
  lineValue: { color: '#1e293b', fontSize: 8.5, fontFamily: 'Helvetica-Bold' },
  divider: { borderBottom: '1 solid #e2e8f0', marginVertical: 5 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4 },
  totalLabel: { color: '#0f172a', fontSize: 9, fontFamily: 'Helvetica-Bold' },
  totalValueGreen: { color: '#16a34a', fontSize: 9, fontFamily: 'Helvetica-Bold' },
  totalValueRed: { color: '#dc2626', fontSize: 9, fontFamily: 'Helvetica-Bold' },

  // ── Net salary highlight ──
  netBox: {
    backgroundColor: '#1e3a8a',
    borderRadius: 6,
    padding: '14 18',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  netLabel: { color: '#bfdbfe', fontSize: 9, fontFamily: 'Helvetica-Bold' },
  netValue: { color: '#ffffff', fontSize: 20, fontFamily: 'Helvetica-Bold' },

  // ── Remarks ──
  remarksBox: {
    backgroundColor: '#fffbeb',
    border: '1 solid #fde68a',
    borderRadius: 4,
    padding: '7 10',
    marginBottom: 14,
  },
  remarksLabel: { fontSize: 7.5, color: '#92400e', fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  remarksText: { fontSize: 8, color: '#78350f' },

  // ── Footer ──
  footer: {
    borderTop: '1 solid #e2e8f0',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  footerNote: { color: '#94a3b8', fontSize: 7 },
  signature: {
    alignItems: 'center',
    borderTop: '1 solid #94a3b8',
    paddingTop: 4,
    minWidth: 120,
  },
  signatureLabel: { fontSize: 7, color: '#64748b' },
});

const fmt = (n) =>
  `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * PayslipPDF
 * @param {object} row        - payroll row (required)
 * @param {object} employee   - employees table row (for actual/contracted salary)
 * @param {object} attendance - attendance_monthly row (for leave/WO days)
 * @param {string} companyName
 */
const PayslipPDF = ({ row, employee, attendance, companyName = 'Bhatia Enterprises' }) => {
  const monthName = MONTHS[(row.month || 1) - 1];
  const generatedOn = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  const actualSalary = parseFloat(employee?.salary || 0);
  const totalDaysInMonth = new Date(row.year, row.month, 0).getDate();

  // Attendance figures — prefer attendance row, fall back to payroll row fields
  const payableDays  = parseFloat(attendance?.payable_days_override ?? attendance?.payable_days ?? row.payable_days ?? 0);
  const leaveDays    = parseInt(attendance?.total_leave   ?? row.total_leave   ?? 0);
  const woDays       = parseInt(attendance?.total_wo      ?? row.total_wo      ?? 0);
  const presentDays  = parseFloat(attendance?.total_present ?? row.total_present ?? 0);
  const absentDays   = parseInt(attendance?.total_absent  ?? row.total_absent  ?? 0);
  const holidayDays  = parseInt(attendance?.total_holiday ?? row.total_holiday ?? 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* ── Header ── */}
        <View style={styles.headerBand}>
          <View>
            <Text style={styles.companyName}>{companyName}</Text>
            <Text style={styles.companyTagline}>Employee Payslip — Confidential</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.payslipLabel}>PAY PERIOD</Text>
            <Text style={styles.payPeriod}>{monthName} {row.year}</Text>
          </View>
        </View>

        {/* ── Employee Info ── */}
        <View style={styles.infoStrip}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Employee Name</Text>
            <Text style={styles.infoValue}>{row.emp_name}</Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Employee Code</Text>
            <Text style={styles.infoValue}>{row.emp_code}</Text>
          </View>
          {employee?.designation && (
            <View style={styles.infoBlock}>
              <Text style={styles.infoLabel}>Designation</Text>
              <Text style={styles.infoValue}>{employee.designation}</Text>
            </View>
          )}
          {/* <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Pay Date</Text>
            <Text style={styles.infoValue}>{row.pay_date || '—'}</Text>
          </View> */}
          <View style={[styles.infoBlock, { alignItems: 'flex-end' }]}>
            <Text style={styles.infoLabel}>Status</Text>
            <Text style={[styles.infoValue, { color: '#16a34a' }]}>{(row.status || '').toUpperCase()}</Text>
          </View>
        </View>

        {/* ── Salary Summary: Actual vs Earned ── */}
        <Text style={styles.sectionHeading}>SALARY SUMMARY</Text>
        <View style={styles.salaryStrip}>
          <View style={[styles.salaryCard, styles.salaryCardBlue]}>
            <Text style={styles.salaryCardLabel}>Contracted Monthly Salary</Text>
            <Text style={[styles.salaryCardValue, styles.salaryCardValueBlue]}>{fmt(actualSalary)}</Text>
            <Text style={styles.salaryCardSub}>As per employee record · {totalDaysInMonth} calendar days</Text>
          </View>
          <View style={[styles.salaryCard, styles.salaryCardGreen]}>
            <Text style={styles.salaryCardLabel}>Earned Basic Salary</Text>
            <Text style={[styles.salaryCardValue, styles.salaryCardValueGreen]}>{fmt((actualSalary / totalDaysInMonth) * payableDays)}</Text>
            <Text style={styles.salaryCardSub}>For {payableDays} present days @ {actualSalary > 0 ? fmt(actualSalary / totalDaysInMonth) + '/day' : '—'}</Text>
          </View>
        </View>

        {/* ── Attendance Summary ── */}
        <Text style={styles.sectionHeading}>ATTENDANCE SUMMARY — {monthName} {row.year} ({totalDaysInMonth} days)</Text>
        <View style={styles.attendanceGrid}>
          <View style={[styles.attCell, styles.attCellHighlight]}>
            <Text style={styles.attValue}>{payableDays}</Text>
            <Text style={styles.attLabel}>Payable Days</Text>
          </View>
          <View style={styles.attCell}>
            <Text style={[styles.attValue, { color: '#16a34a' }]}>{presentDays}</Text>
            <Text style={styles.attLabel}>Present</Text>
          </View>
          <View style={[styles.attCell, styles.attCellRed]}>
            <Text style={[styles.attValue, styles.attValueRed]}>{absentDays}</Text>
            <Text style={styles.attLabel}>Absent</Text>
          </View>
          <View style={styles.attCell}>
            <Text style={[styles.attValue, { color: '#d97706' }]}>{leaveDays}</Text>
            <Text style={styles.attLabel}>On Leave</Text>
          </View>
          <View style={styles.attCell}>
            <Text style={[styles.attValue, styles.attValueGray]}>{woDays}</Text>
            <Text style={styles.attLabel}>Weekly Off</Text>
          </View>
          <View style={styles.attCell}>
            <Text style={[styles.attValue, { color: '#7c3aed' }]}>{holidayDays}</Text>
            <Text style={styles.attLabel}>Holiday</Text>
          </View>
        </View>

        {/* ── Earnings & Deductions ── */}
        <View style={styles.columns}>
          <View style={styles.column}>
            <Text style={styles.sectionHeading}>EARNINGS</Text>
            <View style={styles.lineRow}>
              <Text style={styles.lineLabel}>Earned Basic ({payableDays} present days)</Text>
              <Text style={styles.lineValue}>{fmt((actualSalary / totalDaysInMonth) * payableDays)}</Text>
            </View>
            {(row.ot_amount > 0 || row.ot_hours > 0) && (
              <View style={styles.lineRow}>
                <Text style={styles.lineLabel}>Overtime ({row.ot_hours || 0} hrs @ ₹50/hr)</Text>
                <Text style={styles.lineValue}>{fmt(row.ot_amount || 0)}</Text>
              </View>
            )}
            <View style={styles.lineRow}>
              <Text style={styles.lineLabel}>Puttha Price (bonus)</Text>
              <Text style={styles.lineValue}>{fmt(row.puttha_price)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Gross Salary</Text>
              <Text style={styles.totalValueGreen}>{fmt(row.gross_salary)}</Text>
            </View>
          </View>

          <View style={styles.column}>
            <Text style={styles.sectionHeading}>DEDUCTIONS</Text>
            <View style={styles.lineRow}>
              <Text style={styles.lineLabel}>Advance Taken</Text>
              <Text style={styles.lineValue}>{fmt(row.advance)}</Text>
            </View>
            <View style={styles.lineRow}>
              <Text style={styles.lineLabel}>Loan Deduction</Text>
              <Text style={[styles.lineValue, { color: '#dc2626' }]}>-{fmt(row.loan_deduction || 0)}</Text>
            </View>
            <View style={styles.lineRow}>
              <Text style={styles.lineLabel}>Advance Deduction</Text>
              <Text style={[styles.lineValue, { color: '#dc2626' }]}>-{fmt(row.salary_advance_deduction || 0)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Deductions</Text>
              <Text style={styles.totalValueRed}>-{fmt(row.total_deductions)}</Text>
            </View>
          </View>
        </View>

        {/* ── Net Salary ── */}
        <View style={styles.netBox}>
          <View>
            <Text style={styles.netLabel}>Net Salary (Take Home)</Text>
            <Text style={[styles.netLabel, { fontSize: 7, marginTop: 2 }]}>
              Gross {fmt(row.gross_salary)} − Deductions {fmt(row.total_deductions)}
            </Text>
          </View>
          <Text style={styles.netValue}>{fmt(row.net_salary)}</Text>
        </View>

        {/* ── Remarks ── */}
        {row.remarks && (
          <View style={styles.remarksBox}>
            <Text style={styles.remarksLabel}>Remarks</Text>
            <Text style={styles.remarksText}>{row.remarks}</Text>
          </View>
        )}

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <View>
            <Text style={styles.footerNote}>Generated on: {generatedOn}</Text>
            <Text style={styles.footerNote}>This is a system-generated payslip. No signature required.</Text>
          </View>
        </View>

      </Page>
    </Document>
  );
};

export default PayslipPDF;
