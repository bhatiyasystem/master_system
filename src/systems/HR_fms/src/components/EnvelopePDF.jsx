import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { MONTHS } from '../services/supabaseHR';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    backgroundColor: '#ffffff',
    padding: 30,
    color: '#0f172a',
  },
  envelopeContainer: {
    border: '2 solid #1e3a8a',
    borderRadius: 8,
    padding: 24,
    height: '100%',
    flexDirection: 'column',
    justifyContent: 'space-between',
    backgroundColor: '#fafafa',
  },
  headerBand: {
    backgroundColor: '#1e3a8a',
    borderRadius: 6,
    padding: '16 24',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  companyName: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5,
  },
  companyTagline: {
    color: '#93c5fd',
    fontSize: 9,
    marginTop: 3,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  payslipLabel: {
    color: '#93c5fd',
    fontSize: 9,
    letterSpacing: 1.5,
    fontFamily: 'Helvetica-Bold',
  },
  payPeriod: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginTop: 3,
  },
  bodyContent: {
    marginVertical: 15,
    gap: 15,
  },
  infoGrid: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 6,
    padding: '12 16',
    border: '1 solid #cbd5e1',
    justifyContent: 'space-between',
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 8,
    color: '#64748b',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  infoValue: {
    fontSize: 12,
    color: '#0f172a',
    fontFamily: 'Helvetica-Bold',
  },
  salaryGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  salaryCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 6,
    padding: 12,
    border: '1 solid #e2e8f0',
  },
  salaryCardHeader: {
    fontSize: 8,
    color: '#64748b',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  salaryCardValue: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
  },
  netSalaryCard: {
    flex: 1.2,
    backgroundColor: '#16a34a',
    borderRadius: 6,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  netSalaryLabel: {
    fontSize: 9,
    color: '#dcfce7',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
  },
  netSalaryValue: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    marginTop: 2,
  },
  footer: {
    borderTop: '1 dashed #94a3b8',
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 8,
    color: '#64748b',
  },
  sigBox: {
    borderTop: '1 solid #94a3b8',
    width: 140,
    alignItems: 'center',
    paddingTop: 4,
  },
  sigText: {
    fontSize: 8,
    color: '#475569',
  },
});

const fmt = (n) =>
  `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const EnvelopePDF = ({ row, companyName = 'Bhatia Enterprises' }) => {
  const monthName = MONTHS[(row?.month || 1) - 1];
  const year = row?.year || new Date().getFullYear();

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.envelopeContainer}>
          {/* Header */}
          <View style={styles.headerBand}>
            <View>
              <Text style={styles.companyName}>{companyName}</Text>
              <Text style={styles.companyTagline}>SALARY DISBURSEMENT ENVELOPE — CONFIDENTIAL</Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.payslipLabel}>PAY PERIOD</Text>
              <Text style={styles.payPeriod}>{monthName} {year}</Text>
            </View>
          </View>

          {/* Main Info */}
          <View style={styles.bodyContent}>
            {/* Employee Information */}
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Employee Name</Text>
                <Text style={styles.infoValue}>{row?.emp_name || '—'}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Employee Code</Text>
                <Text style={styles.infoValue}>{row?.emp_code || '—'}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Payable Days</Text>
                <Text style={styles.infoValue}>{row?.payable_days ?? '—'}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Status</Text>
                <Text style={[styles.infoValue, { color: '#16a34a' }]}>{(row?.status || 'PAID').toUpperCase()}</Text>
              </View>
            </View>

            {/* Salary Figures */}
            <View style={styles.salaryGrid}>
              <View style={styles.salaryCard}>
                <Text style={styles.salaryCardHeader}>Basic Salary</Text>
                <Text style={styles.salaryCardValue}>{fmt(row?.basic_salary)}</Text>
              </View>
              <View style={styles.salaryCard}>
                <Text style={styles.salaryCardHeader}>Puttha Bonus</Text>
                <Text style={styles.salaryCardValue}>{fmt(row?.puttha_price)}</Text>
              </View>
              <View style={styles.salaryCard}>
                <Text style={styles.salaryCardHeader}>Gross Salary</Text>
                <Text style={[styles.salaryCardValue, { color: '#1d4ed8' }]}>{fmt(row?.gross_salary)}</Text>
              </View>
              <View style={styles.salaryCard}>
                <Text style={styles.salaryCardHeader}>Total Deductions</Text>
                <Text style={[styles.salaryCardValue, { color: '#dc2626' }]}>-{fmt(row?.total_deductions)}</Text>
              </View>
              <View style={styles.netSalaryCard}>
                <Text style={styles.netSalaryLabel}>Net Salary Paid</Text>
                <Text style={styles.netSalaryValue}>{fmt(row?.net_salary)}</Text>
              </View>
            </View>
          </View>

          {/* Footer & Signature */}
          <View style={styles.footer}>
            <View>
              <Text style={styles.footerText}>This is an official pay envelope slip generated for {row?.emp_name}.</Text>
              <Text style={styles.footerText}>Issued by: HR & Payroll Department</Text>
            </View>
            <View style={styles.sigBox}>
              <Text style={styles.sigText}>Receiver Signature</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default EnvelopePDF;
