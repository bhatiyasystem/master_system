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
    borderRadius: 12,
    padding: 32,
    height: '100%',
    flexDirection: 'column',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
  },
  headerBand: {
    backgroundColor: '#1e3a8a',
    borderRadius: 8,
    padding: '20 28',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  companyName: {
    color: '#ffffff',
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5,
  },
  companyTagline: {
    color: '#93c5fd',
    fontSize: 10,
    marginTop: 4,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  payslipLabel: {
    color: '#93c5fd',
    fontSize: 10,
    letterSpacing: 1.5,
    fontFamily: 'Helvetica-Bold',
  },
  payPeriod: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginTop: 4,
  },
  bodyContent: {
    marginVertical: 30,
    gap: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 24,
    border: '1 solid #cbd5e1',
    marginRight: 15,
  },
  salaryCard: {
    flex: 1,
    backgroundColor: '#16a34a',
    borderRadius: 10,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  empNameValue: {
    fontSize: 22,
    color: '#0f172a',
    fontFamily: 'Helvetica-Bold',
  },
  salaryLabel: {
    fontSize: 11,
    color: '#dcfce7',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  salaryValue: {
    fontSize: 30,
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
  },
});

const fmt = (n) =>
  `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const EnvelopePDF = ({ row, _companyName = 'Bhatia Enterprises' }) => {
  const monthName = MONTHS[(row?.month || 1) - 1];
  const year = row?.year || new Date().getFullYear();

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.envelopeContainer}>
          {/* Header */}
          <View style={styles.headerBand}>
            <View>
              <Text style={styles.envelopeSub}>EMPLOYEE PAY ENVELOPE</Text>
              <Text style={styles.empTitle}>{row?.emp_name || '—'}</Text>
              <Text style={styles.periodSub}>{monthName} {year}</Text>
            </View>
          </View>

          {/* Main Content - Pay Period, Employee Name & Salary */}
          <View style={styles.bodyContent}>
            <View style={styles.infoCard}>
              <Text style={styles.label}>PAY PERIOD</Text>
              <Text style={styles.empNameValue}>{monthName} {year}</Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.label}>EMPLOYEE NAME</Text>
              <Text style={styles.empNameValue}>{row?.emp_name || '—'}</Text>
            </View>

            <View style={styles.salaryCard}>
              <Text style={styles.salaryLabel}>SALARY</Text>
              <Text style={styles.salaryValue}>{fmt(row?.net_salary)}</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default EnvelopePDF;
