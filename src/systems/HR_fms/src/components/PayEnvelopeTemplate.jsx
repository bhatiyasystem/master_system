import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { MONTHS } from '../services/supabaseHR';

export const fmt = (n) =>
  `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: (n || 0) % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;

// 1. React Screen Preview Component
export const PayEnvelopeCard = ({ row }) => {
  const monthName = MONTHS[(row?.month || 1) - 1];
  const year = row?.year || new Date().getFullYear();

  return (
    <div className="border-2 border-indigo-900 rounded-xl p-8 bg-white shadow-sm space-y-6">
      <div className="border-2 border-indigo-900 rounded-xl p-4 bg-black shadow-sm space-y-3">
        {/* CENTERED HEADING */}
        <h2 className="text-center text-xl font-extrabold text-white tracking-wider uppercase">
          EMPLOYEE PAY ENVELOPE
        </h2>
        {/* LEFT ALIGNED MONTH YEAR */}
        <div className="text-left font-bold text-white text-base mx-2">
          {monthName} {year}
        </div>
      </div>

      {/* SIDE-BY-SIDE CARDS: EMPLOYEE NAME & SALARY */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="bg-slate-50 rounded-xl p-5 border border-slate-300">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">EMPLOYEE NAME</p>
          <p className="text-xl font-extrabold text-slate-900 break-words">{row?.emp_name || '—'}</p>
        </div>

        <div className="bg-emerald-600 rounded-xl p-5 text-white">
          <p className="text-xs text-emerald-100 font-bold uppercase tracking-wider mb-2">SALARY</p>
          <p className="text-2xl font-black text-white">{fmt(row?.net_salary)}</p>
        </div>
      </div>
    </div>
  );
};

// 2. HTML Print Generator
export const generatePayEnvelopeHTML = (rows, title = 'Pay Envelopes') => {
  const envelopePages = (rows || []).map((row) => {
    const monthName = MONTHS[(row.month || 1) - 1];
    const year = row.year || new Date().getFullYear();
    const netSalaryFmt = fmt(row.net_salary);

    return `
      <div class="envelope-page">
        <div class="envelope-container">
          <div class="header-black-box">
            <div class="envelope-header-title">EMPLOYEE PAY ENVELOPE</div>
            <div class="envelope-period">${monthName} ${year}</div>
          </div>
          <div class="envelope-cards">
            <div class="info-card">
              <div class="card-label">EMPLOYEE NAME</div>
              <div class="card-value">${row.emp_name || '—'}</div>
            </div>
            <div class="salary-card">
              <div class="salary-label">SALARY</div>
              <div class="salary-value">${netSalaryFmt}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 0;
            color: #0f172a;
            background-color: #ffffff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .envelope-page {
            page-break-after: always;
            break-after: page;
            padding: 15px;
            box-sizing: border-box;
          }
          .envelope-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          .envelope-container {
            border: 2px solid #312e81;
            border-radius: 12px;
            padding: 32px;
            background: #ffffff;
            min-height: 150mm;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
          }
          .header-black-box {
            border: 2px solid #312e81;
            border-radius: 12px;
            background-color: #000000;
            padding: 16px 20px;
            margin-bottom: 24px;
          }
          .envelope-header-title {
            text-align: center;
            font-size: 22px;
            font-weight: 800;
            color: #ffffff;
            letter-spacing: 1.5px;
            text-transform: uppercase;
          }
          .envelope-period {
            text-align: left;
            font-size: 16px;
            font-weight: 700;
            color: #ffffff;
            margin-top: 12px;
            margin-left: 4px;
          }
          .envelope-cards {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            align-items: stretch;
          }
          .info-card {
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            padding: 24px;
            border-radius: 12px;
          }
          .salary-card {
            background: #16a34a;
            color: #ffffff;
            padding: 24px;
            border-radius: 12px;
          }
          .card-label {
            font-size: 11px;
            color: #64748b;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
          }
          .card-value {
            font-size: 22px;
            font-weight: 800;
            color: #0f172a;
            word-break: break-word;
          }
          .salary-label {
            font-size: 11px;
            color: #dcfce7;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
          }
          .salary-value {
            font-size: 28px;
            font-weight: 900;
            color: #ffffff;
          }
        </style>
      </head>
      <body>
        ${envelopePages}
        <script>
          window.onload = function() {
            window.focus();
            window.print();
          };
        </script>
      </body>
    </html>
  `;
};

// 3. React-PDF Component for PDF Generation
const pdfStyles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    backgroundColor: '#ffffff',
    padding: 30,
    color: '#0f172a',
  },
  envelopeContainer: {
    border: '2 solid #312e81',
    borderRadius: 12,
    padding: 32,
    height: '100%',
    flexDirection: 'column',
    backgroundColor: '#ffffff',
  },
  headerBlackBox: {
    border: '2 solid #312e81',
    borderRadius: 10,
    backgroundColor: '#000000',
    padding: 16,
    marginBottom: 24,
  },
  headerTitle: {
    textAlign: 'center',
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  periodText: {
    textAlign: 'left',
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    marginTop: 12,
    marginLeft: 4,
  },
  bodyGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 20,
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 20,
    border: '1 solid #cbd5e1',
    marginRight: 10,
  },
  salaryCard: {
    flex: 1,
    backgroundColor: '#16a34a',
    borderRadius: 10,
    padding: 20,
    marginLeft: 10,
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
    fontSize: 20,
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
    fontSize: 26,
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
  },
});

export const SingleEnvelopePDFPage = ({ row }) => {
  const monthName = MONTHS[(row?.month || 1) - 1];
  const year = row?.year || new Date().getFullYear();

  return (
    <Page size="A4" orientation="landscape" style={pdfStyles.page}>
      <View style={pdfStyles.envelopeContainer}>
        <View style={pdfStyles.headerBlackBox}>
          <Text style={pdfStyles.headerTitle}>EMPLOYEE PAY ENVELOPE</Text>
          <Text style={pdfStyles.periodText}>{monthName} {year}</Text>
        </View>
        <View style={pdfStyles.bodyGrid}>
          <View style={pdfStyles.infoCard}>
            <Text style={pdfStyles.label}>EMPLOYEE NAME</Text>
            <Text style={pdfStyles.empNameValue}>{row?.emp_name || '—'}</Text>
          </View>

          <View style={pdfStyles.salaryCard}>
            <Text style={pdfStyles.salaryLabel}>SALARY</Text>
            <Text style={pdfStyles.salaryValue}>{fmt(row?.net_salary)}</Text>
          </View>
        </View>
      </View>
    </Page>
  );
};

export const EnvelopePDFDocument = ({ row }) => (
  <Document>
    <SingleEnvelopePDFPage row={row} />
  </Document>
);

export default EnvelopePDFDocument;
