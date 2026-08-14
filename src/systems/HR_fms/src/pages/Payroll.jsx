import { X, RefreshCw, Download, Loader2, FileText, Eye, Play, AlertCircle, Search, DollarSign, Edit3, Mail, Printer } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { pdf } from '@react-pdf/renderer';
import { getPreviousProcessingPeriod } from '../utils/dateUtils.js';
import { fetchAttendanceMonthly, fetchEmployees, fetchPayroll, fetchPayrollPaginated, generatePayrollBatch, updatePayrollStatus, updatePayrollRow, savePayslip, fetchPayslips, fetchPayslipData, updateEmployeePutthaStatus, recalculateMonthPutthaAndPayroll, parseOtHours, formatOtDisplay, MONTHS, fetchEmployeeLoanBalance, fetchEmployeeAdvanceBalance, } from '../services/supabaseHR';
import EnvelopePDF from '../components/EnvelopePDF';
import PayslipPDF from '../components/PayslipPDF';
import { PayEnvelopeCard, generatePayEnvelopeHTML } from '../components/PayEnvelopeTemplate';
// ── Status badge ─────────────────────────────────────────────────────────────
const statusStyle = {
  draft: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  reviewed: { bg: 'bg-blue-100', text: 'text-blue-800' },
  approved: { bg: 'bg-indigo-100', text: 'text-indigo-800' },
  paid: { bg: 'bg-green-100', text: 'text-green-800' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-800' },
};

const StatusBadge = ({ status }) => {
  const s = statusStyle[status] || statusStyle.draft;
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${s.bg} ${s.text}`}>
      {status}
    </span>
  );
};

const fmt = (n) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: (n || 0) % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;

// ── Payslip Modal (preview) ───────────────────────────────────────────────────
const PayslipModal = ({ row, onClose }) => {
  if (!row) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-y-auto">
        <div className="bg-indigo-900 text-white rounded-t-2xl px-6 py-5 flex justify-between items-start">
          <div>
            <p className="text-indigo-300 text-xs uppercase tracking-widest font-semibold">Payslip</p>
            <h2 className="text-xl font-bold mt-1">{row.emp_name}</h2>
            <p className="text-indigo-300 text-sm">{row.emp_code} · {MONTHS[row.month - 1]} {row.year}</p>
          </div>
          <div className="text-right">
            <StatusBadge status={row.status} />
            <p className="text-indigo-300 text-xs mt-2">Pay Date: {row.pay_date || '—'}</p>
          </div>
          <button onClick={onClose} className="ml-4"><X size={20} className="text-indigo-300" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Earnings</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Base Salary</span>
                  <span className="font-medium text-gray-900">{fmt(row.basic_salary)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Earned Basic ({row.payable_days || 0} present days)</span>
                  <span className="font-medium text-gray-900">{fmt(((row.basic_salary / (row.month ? new Date(row.year || new Date().getFullYear(), row.month, 0).getDate() : 30)) * (row.payable_days || 0)))}</span>
                </div>
                {(row.ot_amount > 0 || parseOtHours(row.ot_hours) > 0) && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">OT ({formatOtDisplay(row.ot_hours)} hrs @ ₹50/hr)</span>
                    <span className="font-medium text-gray-900">{fmt(row.ot_amount || 0)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Puttha Price</span>
                  <span className="font-medium text-gray-900">{fmt(row.puttha_price)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-2 mt-2">
                  <span className="text-gray-900">Gross Salary</span>
                  <span className="text-green-700">{fmt(row.gross_salary)}</span>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Deductions</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Advance Taken</span>
                  <span className="font-medium text-gray-900">{fmt(row.advance)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Loan Deduction</span>
                  <span className="font-medium text-red-600">-{fmt(row.loan_deduction || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Advance Deduction</span>
                  <span className="font-medium text-red-600">-{fmt(row.salary_advance_deduction || 0)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-2 mt-2">
                  <span className="text-gray-900">Total Deductions</span>
                  <span className="text-red-600">-{fmt(row.total_deductions)}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-indigo-900 rounded-xl p-4 flex justify-between items-center">
            <span className="text-indigo-200 font-medium">Net Salary</span>
            <span className="text-3xl font-black text-white">{fmt(row.net_salary)}</span>
          </div>
          {row.remarks && <p className="text-sm text-gray-500">Remarks: {row.remarks}</p>}
        </div>
      </div>
    </div>
  );
};

// ── Edit Deductions Modal ─────────────────────────────────────────────────────
const EditDeductionsModal = ({ row, onSave, onClose }) => {
  const [form, setForm] = useState({
    loan_deduction: row.loan_deduction ?? 0,
    salary_advance_deduction: row.salary_advance_deduction ?? 0,
    remarks: row.remarks || '',
  });
  const [saving, setSaving] = useState(false);
  const [dbBalance, setDbBalance] = useState(0);
  const [dbAdvBalance, setDbAdvBalance] = useState(0);
  const [loadingLoan, setLoadingLoan] = useState(true);
  const [loadingAdv, setLoadingAdv] = useState(true);
  const [validationError, setValidationError] = useState(null);

  useEffect(() => {
    let active = true;
    async function loadBalances() {
      try {
        const [loanBal, advBal] = await Promise.all([
          fetchEmployeeLoanBalance(row.emp_code),
          fetchEmployeeAdvanceBalance(row.emp_code)
        ]);
        if (active) {
          setDbBalance(loanBal);
          setDbAdvBalance(advBal);
        }
      } catch (err) {
        console.error('Error fetching balances:', err);
      } finally {
        if (active) {
          setLoadingLoan(false);
          setLoadingAdv(false);
        }
      }
    }
    loadBalances();
    return () => { active = false; };
  }, [row.emp_code]);

  const availableBalance = parseFloat(dbBalance.toFixed(2));
  const availableAdvBalance = parseFloat(dbAdvBalance.toFixed(2));

  const handleSave = async () => {
    const loanDeduction = parseFloat(form.loan_deduction || 0);
    if (isNaN(loanDeduction) || loanDeduction < 0) {
      setValidationError("Loan deduction must be a non-negative number.");
      return;
    }
    if (loanDeduction > 0 && availableBalance <= 0) {
      setValidationError("This employee has no active loan. Loan deduction cannot be added.");
      return;
    }
    if (loanDeduction > availableBalance) {
      setValidationError(`Loan deduction cannot be greater than the employee's remaining loan balance of ₹${availableBalance}.`);
      return;
    }

    const salaryAdvanceDeduction = parseFloat(form.salary_advance_deduction || 0);
    if (isNaN(salaryAdvanceDeduction) || salaryAdvanceDeduction < 0) {
      setValidationError("Advance deduction must be a non-negative number.");
      return;
    }
    if (salaryAdvanceDeduction > 0 && availableAdvBalance <= 0) {
      setValidationError("This employee has no active advance. Advance deduction cannot be added.");
      return;
    }
    if (salaryAdvanceDeduction > availableAdvBalance) {
      setValidationError(`Advance deduction cannot be greater than the employee's remaining advance balance of ₹${availableAdvBalance}.`);
      return;
    }

    setSaving(true);
    try {
      const advanceDeduction = loanDeduction + salaryAdvanceDeduction;
      const rawNet = Math.max(0, row.gross_salary - advanceDeduction);
      // Upward rounding to nearest 10
      const netSalary = rawNet > 0 ? Math.ceil(rawNet / 10) * 10 : 0;
      await onSave(row.id, {
        loan_deduction: loanDeduction,
        salary_advance_deduction: salaryAdvanceDeduction,
        advance_deduction: advanceDeduction,
        total_deductions: parseFloat(advanceDeduction.toFixed(2)),
        net_salary: netSalary,
        remarks: form.remarks,
      });
      onClose();
    } catch (err) {
      setValidationError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h3 className="font-bold text-gray-900">Adjust — {row.emp_name}</h3>
          <button onClick={onClose}><X size={20} className="text-gray-500" /></button>
        </div>
        <div className="p-6 space-y-4">
          {validationError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3 font-semibold">
              {validationError}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Loan Deduction (₹)</label>
            {loadingLoan ? (
              <div className="text-xs text-gray-400">Loading loan balance...</div>
            ) : (
              <>
                <input
                  type="number" min="0" step="0.01"
                  value={form.loan_deduction}
                  onChange={(e) => {
                    setForm(f => ({ ...f, loan_deduction: e.target.value }));
                    setValidationError(null);
                  }}
                  disabled={availableBalance === 0}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-400"
                />
                <div className="text-[10px] mt-1 font-semibold text-gray-500">
                  {availableBalance === 0 ? (
                    <span className="text-red-500">No active loan available for this employee.</span>
                  ) : (
                    <span>Available Loan Balance: ₹{availableBalance}</span>
                  )}
                </div>
              </>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Advance Deduction (₹)</label>
            {loadingAdv ? (
              <div className="text-xs text-gray-400">Loading advance balance...</div>
            ) : (
              <>
                <input
                  type="number" min="0" step="0.01"
                  value={form.salary_advance_deduction}
                  onChange={(e) => {
                    setForm(f => ({ ...f, salary_advance_deduction: e.target.value }));
                    setValidationError(null);
                  }}
                  disabled={availableAdvBalance === 0}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-400"
                />
                <div className="text-[10px] mt-1 font-semibold text-gray-500">
                  {availableAdvBalance === 0 ? (
                    <span className="text-red-500">No active advance available for this employee.</span>
                  ) : (
                    <span>Available Advance Balance: ₹{availableAdvBalance}</span>
                  )}
                </div>
              </>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Remarks</label>
            <textarea
              value={form.remarks}
              onChange={(e) => setForm(f => ({ ...f, remarks: e.target.value }))}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving || loadingLoan || loadingAdv} className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Employee Envelope Modal ───────────────────────────────────────────────────
const EmployeeEnvelopeModal = ({ row, onClose }) => {
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);

  if (!row) return null;

  const monthName = MONTHS[(row.month || 1) - 1];
  const year = row.year || new Date().getFullYear();

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const blob = await pdf(<EnvelopePDF row={row} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Pay_Envelope_${row.emp_name.replace(/\s+/g, '_')}_${monthName}_${year}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generating envelope PDF', err);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    setPrinting(true);
    try {
      const printWindow = window.open('', '_blank', 'width=1000,height=700');
      if (!printWindow) {
        alert('Please allow popups for printing.');
        return;
      }

      printWindow.document.write(generatePayEnvelopeHTML([row], `Pay Envelope - ${row.emp_name}`));
      printWindow.document.close();
    } catch (err) {
      console.error('Error printing envelope', err);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white px-6 py-4 flex justify-between items-center border-b border-indigo-800">
          <div className="flex items-center gap-2">
            <Mail size={18} className="text-blue-300" />
            <h3 className="font-bold text-lg text-white">Employee Pay Envelope</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
            <X size={20} className="text-blue-200" />
          </button>
        </div>

        {/* Envelope Preview Box */}
        <div className="p-6 space-y-6">
          <PayEnvelopeCard row={row} />

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md"
            >
              {downloading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              {downloading ? 'Downloading...' : 'Download PDF'}
            </button>
            <button
              onClick={handlePrint}
              disabled={printing}
              className="flex items-center gap-2 px-5 py-2 bg-slate-800 text-white rounded-xl text-sm font-semibold hover:bg-slate-900 disabled:opacity-50 transition-all shadow-md"
            >
              {printing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Printer size={16} />
              )}
              {printing ? 'Preparing...' : 'Print'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Payslips Tab ──────────────────────────────────────────────────────────────
// ── Payslips Tab ──────────────────────────────────────────────────────────────
const PayslipsTab = ({ filterYear, filterMonth, search, notify, onPaidRecordsChange }) => {
  const [paidRecords, setPaidRecords] = useState([]);
  const [payslipMap, setPayslipMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  const notifyRef = useRef(notify);
  useEffect(() => { notifyRef.current = notify; });

  const loadPayslips = useCallback(async () => {
    setLoading(true);
    try {
      const [payrollData, slipsData] = await Promise.all([
        fetchPayroll({ year: filterYear, month: filterMonth, status: 'paid' }),
        fetchPayslips({ year: filterYear, month: filterMonth }),
      ]);

      const map = {};
      (slipsData || []).forEach(s => {
        if (s.emp_code) map[s.emp_code] = s;
      });
      setPayslipMap(map);
      setPaidRecords(payrollData || []);
    } catch (err) {
      notifyRef.current(`Failed to fetch payslips: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [filterYear, filterMonth]);

  useEffect(() => {
    loadPayslips();
  }, [loadPayslips]);

  const totalDaysInMonth = (filterYear && filterMonth) ? new Date(filterYear, filterMonth, 0).getDate() : 30;

  const yesCount = paidRecords.filter(r => (r.puttha_status || 'Yes') !== 'No' && (parseFloat(r.payable_days) || 0) >= 15).length;
  const totalPutthaPool = paidRecords.reduce((s, r) => s + (parseFloat(r.puttha_price) || 0), 0);
  const perYesPutthaPrice = yesCount > 0 ? parseFloat((totalPutthaPool / yesCount).toFixed(2)) : 0;

  const processedPaidRecords = paidRecords.map(r => {
    const presentDays = parseFloat(r.payable_days) || 0;
    const baseSalary = parseFloat(r.basic_salary) || 0;
    const earnedBasic = parseFloat(((baseSalary / totalDaysInMonth) * presentDays).toFixed(2));
    const parsedOt = parseOtHours(r.ot_hours || r.total_ot || 0);
    const otAmount = parseFloat((parsedOt * 50).toFixed(2));
    const putthaStatus = r.puttha_status || 'Yes';
    const isPutthaEligible = putthaStatus !== 'No' && presentDays >= 15;
    const putthaPrice = isPutthaEligible ? (perYesPutthaPrice > 0 ? perYesPutthaPrice : parseFloat(r.puttha_price || 0)) : 0;

    const grossSalary = parseFloat((earnedBasic + otAmount + putthaPrice).toFixed(2));
    const totalDeductions = parseFloat(r.total_deductions || 0);
    const rawNet = Math.max(0, grossSalary - totalDeductions);
    const netSalary = rawNet > 0 ? Math.ceil(rawNet / 10) * 10 : 0;

    return {
      ...r,
      ot_hours: parsedOt,
      ot_amount: otAmount,
      puttha_status: putthaStatus,
      puttha_price: putthaPrice,
      earned_basic: earnedBasic,
      gross_salary: grossSalary,
      net_salary: netSalary,
    };
  });

  // Notify parent whenever paid records change so it can include them in bulk envelope printing
  useEffect(() => {
    if (onPaidRecordsChange) {
      onPaidRecordsChange(processedPaidRecords);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paidRecords]);

  const filteredPaid = processedPaidRecords.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.emp_name && r.emp_name.toLowerCase().includes(q)) ||
      (r.emp_code && r.emp_code.toLowerCase().includes(q));
  });

  const handleGeneratePayslips = async () => {
    setGenerating(true);
    try {
      if (!processedPaidRecords?.length) {
        notify('No paid payroll records found for this month.', 'warn');
        return;
      }

      let count = 0;
      for (const row of processedPaidRecords) {
        try {
          const { employee, attendance } = await fetchPayslipData(row.emp_code, row.year, row.month);
          const blob = await pdf(<PayslipPDF row={row} employee={employee} attendance={attendance} />).toBlob();
          await savePayslip({
            payrollId: row.id,
            empCode: row.emp_code,
            empName: row.emp_name,
            year: row.year,
            month: row.month,
            pdfBlob: blob,
          });
          count++;
        } catch (err) {
          console.error(`Error generating payslip for ${row.emp_name}`, err);
        }
      }

      notify(`✓ ${count} payslip${count > 1 ? 's' : ''} generated successfully`);
      await loadPayslips();
    } catch (err) {
      notify(`Failed to generate payslips: ${err.message}`, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadSingle = async (row) => {
    setDownloadingId(row.emp_code);
    try {
      const slip = payslipMap[row.emp_code];
      if (slip && slip.pdf_url) {
        window.open(slip.pdf_url, '_blank');
      } else {
        const { employee, attendance } = await fetchPayslipData(row.emp_code, row.year, row.month);
        const blob = await pdf(<PayslipPDF row={row} employee={employee} attendance={attendance} />).toBlob();
        const saved = await savePayslip({
          payrollId: row.id,
          empCode: row.emp_code,
          empName: row.emp_name,
          year: row.year,
          month: row.month,
          pdfBlob: blob,
        });
        if (saved?.pdf_url) {
          window.open(saved.pdf_url, '_blank');
        } else {
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
        }
        await loadPayslips();
      }
    } catch (err) {
      notify(`Failed to load payslip PDF: ${err.message}`, 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  const totalGross = filteredPaid.reduce((s, r) => s + (r.gross_salary || 0), 0);
  const totalDeductions = filteredPaid.reduce((s, r) => s + (r.total_deductions || 0), 0);
  const totalNet = filteredPaid.reduce((s, r) => s + (r.net_salary || 0), 0);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">
            Paid Employees Payslips for {MONTHS[filterMonth - 1]} {filterYear}
          </p>
          <p className="text-xs text-gray-500">Paid employees with full breakdown ({filteredPaid.length} records)</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadPayslips}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={handleGeneratePayslips}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {generating ? 'Generating...' : 'Generate All Payslips'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredPaid.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <FileText size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No paid employees found for {MONTHS[filterMonth - 1]} {filterYear}</p>
            <p className="text-sm mt-1">Mark employees as "Paid" in the Payroll tab to show them here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-indigo-900 text-white">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Emp Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Name</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase bg-indigo-800 bg-opacity-40">Present Days</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Pay Cycle</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Basic Salary</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase">OT</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Puttha Price</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase">Puttha Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Gross Salary</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase bg-red-900 bg-opacity-40">Advance</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase bg-red-900 bg-opacity-40">Loan Ded.</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase bg-red-900 bg-opacity-40">Adv. Ded.</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase bg-red-900 bg-opacity-40">Total Ded.</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase bg-green-900 bg-opacity-50">Net Salary</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPaid.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">

                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">{row.emp_code}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{row.emp_name}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                        {row.payable_days ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-left text-sm text-gray-700 whitespace-nowrap">{MONTHS[filterMonth - 1]} {filterYear.toString().slice(-2)}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">{fmt(row.basic_salary)}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">
                      {(row.ot_amount > 0 || parseOtHours(row.ot_hours) > 0) ? (
                        <span className="inline-flex items-center gap-1 font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full text-xs border border-amber-200" title={`${formatOtDisplay(row.ot_hours)} hrs @ ₹50/hr = ₹${row.ot_amount}`}>
                          {formatOtDisplay(row.ot_hours)} ({fmt(row.ot_amount)})
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">{fmt(row.puttha_price)}</td>
                    <td className="px-4 py-3 text-center text-sm">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold shadow-sm ${(row.puttha_status || 'Yes') === 'Yes'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}>
                        {row.puttha_status || 'Yes'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{fmt(row.gross_salary)}</td>
                    <td className="px-4 py-3 text-right text-sm text-red-600">{fmt(row.advance)}</td>
                    <td className="px-4 py-3 text-right text-sm text-red-600">{fmt(row.loan_deduction || 0)}</td>
                    <td className="px-4 py-3 text-right text-sm text-red-600">{fmt(row.salary_advance_deduction || 0)}</td>
                    <td className="px-4 py-3 text-right text-sm text-red-700 font-medium">{fmt(row.total_deductions)}</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-green-700">{fmt(row.net_salary)}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={row.status} /></td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDownloadSingle(row)}
                        disabled={downloadingId === row.emp_code}
                        title="View PDF Payslip"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50 border border-green-200 transition-colors"
                      >
                        {downloadingId === row.emp_code ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <FileText size={13} />
                        )}
                        <span>View PDF</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 border-t-2 border-gray-300">
                  <td className="px-4 py-3" />
                  <td colSpan={2} className="px-4 py-3 text-sm font-bold text-gray-700">
                    Total ({filteredPaid.length} paid employees)
                  </td>
                  <td className="px-4 py-3 text-center text-sm font-bold text-indigo-700">
                    {filteredPaid.length > 0 ? (filteredPaid.reduce((s, r) => s + (parseFloat(r.payable_days) || 0), 0) / filteredPaid.length).toFixed(1) : 0} avg
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{fmt(filteredPaid.reduce((s, r) => s + (r.basic_salary || 0), 0))}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-amber-700">{fmt(filteredPaid.reduce((s, r) => s + (r.ot_amount || 0), 0))}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{fmt(filteredPaid.reduce((s, r) => s + (r.puttha_price || 0), 0))}</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{fmt(totalGross)}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-red-700">{fmt(filteredPaid.reduce((s, r) => s + (r.advance || 0), 0))}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-red-700">{fmt(filteredPaid.reduce((s, r) => s + (r.loan_deduction || 0), 0))}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-red-700">{fmt(filteredPaid.reduce((s, r) => s + (r.salary_advance_deduction || 0), 0))}</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right text-sm font-bold text-red-700">{fmt(totalDeductions)}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-green-700">{fmt(totalNet)}</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main Payroll Page Component ───────────────────────────────────────────────

const Payroll = () => {
  const [activeTab, setActiveTab] = useState('payroll');
  const [payrollData, setPayrollData] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const prevPeriod = getPreviousProcessingPeriod();
  const [filterYear, setFilterYear] = useState(prevPeriod.year);
  const [filterMonth, setFilterMonth] = useState(prevPeriod.month);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [paidCount, setPaidCount] = useState(0);

  // Tracks processed paid-employee records from PayslipsTab so we can include them in bulk envelope printing
  const [paidProcessedRecords, setPaidProcessedRecords] = useState([]);

  const [payslipRow, setPayslipRow] = useState(null);
  const [envelopeRow, setEnvelopeRow] = useState(null);
  const [editRow, setEditRow] = useState(null);



  const notify = useCallback((msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const loadPayroll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, paidRes] = await Promise.all([
        fetchPayrollPaginated({
          year: filterYear,
          month: filterMonth,
          statusNot: 'paid',
          search,
          page,
          pageSize
        }),
        fetchPayrollPaginated({
          year: filterYear,
          month: filterMonth,
          status: 'paid',
          page: 1,
          pageSize: 1   // we only need the count
        })
      ]);
      setPayrollData(res.data || []);

      setTotalRecords(res.totalRecords || 0);
      setTotalPages(res.totalPages || 1);
      setPaidCount(paidRes.totalRecords || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterYear, filterMonth, search, page, pageSize]);

  useEffect(() => {
    loadPayroll();
  }, [loadPayroll]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const period = getPreviousProcessingPeriod();
      const existing = await fetchPayroll({ year: period.year, month: period.month });
      if (existing && existing.length > 0) {
        notify(`Payroll for ${MONTHS[period.month - 1]} ${period.year} already generated. Re-generating draft records...`, 'success');
      }

      const attendance = (await fetchAttendanceMonthly({ year: period.year, month: period.month })) || [];
      const employees = await fetchEmployees();

      const activeEmployees = employees
        ? employees.filter(e => !e.status || String(e.status).trim().toLowerCase() === 'active')
        : [];

      if (!attendance.length && !activeEmployees.length) {
        throw new Error('No attendance data or active employees found for this month.');
      }

      const employeeMap = {};
      activeEmployees.forEach(e => {
        if (e.employee_id) {
          const id = String(e.employee_id).trim();
          const empObj = { ...e, puttha_status: e.puttha_status || 'Yes' };
          employeeMap[id] = empObj;
          employeeMap[id.toLowerCase()] = empObj;
          employeeMap[id.toUpperCase()] = empObj;
        }
      });

      await generatePayrollBatch(attendance, employeeMap, period.year, period.month);
      notify(`✓ Payroll generated successfully`);
      setFilterMonth(period.month);
      setFilterYear(period.year);
      await loadPayroll();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleStatusBulk = async (newStatus) => {
    if (!selectedIds.length) return;
    try {
      if (newStatus === 'paid') {
        const rowsToLock = filtered.filter(r => selectedIds.includes(r.id));
        await Promise.all(
          rowsToLock.map(r =>
            updatePayrollRow(r.id, {
              status: 'paid',
              basic_salary: r.basic_salary,
              payable_days: r.payable_days,
              ot_hours: r.ot_hours,
              ot_amount: r.ot_amount,
              puttha_price: r.puttha_price,
              puttha_status: r.puttha_status,
              gross_salary: r.gross_salary,
              advance: r.advance,
              loan_deduction: r.loan_deduction,
              salary_advance_deduction: r.salary_advance_deduction,
              total_deductions: r.total_deductions,
              net_salary: r.net_salary,
            })
          )
        );
      } else {
        await updatePayrollStatus(selectedIds, newStatus);
      }
      notify(`✓ ${selectedIds.length} records marked as "${newStatus}"`);
      setSelectedIds([]);
      await loadPayroll();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEditSave = async (id, updates) => {
    await updatePayrollRow(id, updates);
    notify('✓ Payroll updated');
    await loadPayroll();
  };

  const handleTogglePutthaStatus = async (row) => {
    if (row.status === 'paid') {
      notify('Cannot change Puttha status for an employee already marked as Paid.', 'warn');
      return;
    }

    const currentStatus = row.puttha_status || 'Yes';
    const newStatus = currentStatus === 'Yes' ? 'No' : 'Yes';
    try {
      // 1. Update employee master record in backend database
      await updateEmployeePutthaStatus(row.emp_code, newStatus);

      // 2. Recalculate Puttha amount per eligible employee & update all payroll rows for this month
      await recalculateMonthPutthaAndPayroll(row.year, row.month);

      notify(`✓ Puttha status updated to "${newStatus}" for ${row.emp_name}`);
      await loadPayroll();
    } catch (err) {
      setError(`Failed to update Puttha status: ${err.message}`);
    }
  };



  const handlePrintAllEnvelopes = (targetRows) => {
    // If specific rows are passed (e.g. selected rows), print only those.
    // Otherwise merge unpaid (payroll tab) + paid (payslips tab) employees.
    const rowsToPrint = targetRows && targetRows.length > 0
      ? targetRows
      : [...filtered, ...paidProcessedRecords];

    if (!rowsToPrint || rowsToPrint.length === 0) {
      notify('No records available to print envelopes', 'warn');
      return;
    }

    try {
      const printWindow = window.open('', '_blank', 'width=1000,height=700');
      if (!printWindow) {
        alert('Please allow popups for printing.');
        return;
      }

      printWindow.document.write(generatePayEnvelopeHTML(rowsToPrint, `All Pay Envelopes - ${MONTHS[filterMonth - 1]} ${filterYear}`));
      printWindow.document.close();
    } catch (err) {
      console.error('Error printing envelopes', err);
      notify('Failed to print envelopes', 'error');
    }
  };

  const totalDaysInMonth = (filterYear && filterMonth) ? new Date(filterYear, filterMonth, 0).getDate() : 30;

  const unpaidData = payrollData.filter(r => r.status !== 'paid');

  const yesCount = unpaidData.filter(r => (r.puttha_status || 'Yes') !== 'No' && (parseFloat(r.payable_days) || 0) >= 15).length;
  const totalPutthaPool = unpaidData.reduce((s, r) => s + (parseFloat(r.puttha_price) || 0), 0);
  const perYesPutthaPrice = yesCount > 0 ? parseFloat((totalPutthaPool / yesCount).toFixed(2)) : 0;

  const filtered = unpaidData.map(r => {
    const presentDays = parseFloat(r.payable_days) || 0;
    const baseSalary = parseFloat(r.basic_salary) || 0;
    const earnedBasic = parseFloat(((baseSalary / totalDaysInMonth) * presentDays).toFixed(2));
    const parsedOt = parseOtHours(r.ot_hours || r.total_ot || 0);
    const otAmount = parseFloat((parsedOt * 50).toFixed(2));
    const putthaStatus = r.puttha_status || 'Yes';
    const isPutthaEligible = putthaStatus !== 'No' && presentDays >= 15;
    const putthaPrice = isPutthaEligible ? (perYesPutthaPrice > 0 ? perYesPutthaPrice : parseFloat(r.puttha_price || 0)) : 0;

    const grossSalary = parseFloat((earnedBasic + otAmount + putthaPrice).toFixed(2));
    const totalDeductions = parseFloat(r.total_deductions || 0);
    const rawNet = Math.max(0, grossSalary - totalDeductions);
    const netSalary = rawNet > 0 ? Math.ceil(rawNet / 10) * 10 : 0;

    return {
      ...r,
      ot_hours: parsedOt,
      ot_amount: otAmount,
      puttha_status: putthaStatus,
      puttha_price: putthaPrice,
      earned_basic: earnedBasic,
      gross_salary: grossSalary,
      net_salary: netSalary,
    };
  });

  const toggleSelect = (id) => setSelectedIds(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]);
  const toggleAll = () => setSelectedIds(selectedIds.length === filtered.length ? [] : filtered.map(r => r.id));

  const totalGross = filtered.reduce((s, r) => s + (r.gross_salary || 0), 0);
  const totalDeductions = filtered.reduce((s, r) => s + (r.total_deductions || 0), 0);
  const totalNet = filtered.reduce((s, r) => s + (r.net_salary || 0), 0);
  const goto = [
    { id: 'payroll', label: 'Payroll', },
    { id: 'payslips', label: 'Payslips', }]
  // paidCount is fetched from DB — not derived from filtered (which excludes paid rows)

  return (
    <div className="space-y-5">
      {/* Notification toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 transition-all
          ${notification.type === 'success' ? 'bg-green-600 text-white' : notification.type === 'warn' ? 'bg-amber-500 text-white' : 'bg-red-600 text-white'}`}>
          {notification.msg}
          <button onClick={() => setNotification(null)}><X size={14} /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Generate & manage monthly payroll from attendance data</p>
        </div>
        <div className="flex items-center gap-2">
          {(payrollData.length > 0 || paidProcessedRecords.length > 0) && (
            <button
              onClick={() => handlePrintAllEnvelopes(null)}
              className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700 shadow-md transition-all"
              title={`Print envelopes for all employees (${filtered.length} payroll + ${paidProcessedRecords.length} paid)`}
            >
              <Printer size={15} />
              Print All Envelopes ({filtered.length + paidProcessedRecords.length})
            </button>
          )}
          {activeTab !== "payslips" && <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 shadow-md disabled:opacity-50 transition-all"
          >
            {generating
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating...</>
              : <><Play size={15} /> Generate Payroll</>}
          </button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {/* {[
          { id: 'payroll', label: 'Payroll' },
          { id: 'payslips', label: 'Payslips' },
        ].map(tab => ( */}
        {goto.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all
              ${activeTab === tab.id ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {tab.label}
            {tab.id === 'payslips' && paidCount > 0 && (
              <span className="ml-1.5 bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded-full">{paidCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X size={16} /></button>
        </div>
      )}

      {/* ── PAYROLL TAB ── */}
      {activeTab === 'payroll' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or emp code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <select
                value={`${filterMonth}-${filterYear}`}
                onChange={e => {
                  const [m, y] = e.target.value.split('-').map(Number);
                  setFilterMonth(m);
                  setFilterYear(y);
                  setPage(1);
                }}
                className="border rounded-lg px-3 py-2 text-sm font-medium bg-white text-gray-700 border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
              >
                <option value={`${currentMonth}-${currentYear}`}>
                  {MONTHS[currentMonth - 1]} {currentYear}
                </option>
                <option value={`${currentMonth === 1 ? 12 : currentMonth - 1}-${currentMonth === 1 ? currentYear - 1 : currentYear}`}>
                  {MONTHS[currentMonth === 1 ? 11 : currentMonth - 2]} {currentMonth === 1 ? currentYear - 1 : currentYear}
                </option>
              </select>
              <button
                onClick={loadPayroll}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                {loading ? 'Loading...' : 'Load'}
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          {payrollData.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Employees', value: filtered.length, color: 'indigo', sub: `${paidCount} paid` },
                { label: 'Total Gross', value: fmt(totalGross), color: 'green', sub: `${MONTHS[filterMonth - 1]} ${filterYear}` },
                { label: 'Total Deductions', value: fmt(totalDeductions), color: 'red', sub: 'Advance recovery' },
                { label: 'Net Payout', value: fmt(totalNet), color: 'blue', sub: 'To be disbursed' },
              ].map(card => (
                <div key={card.label} className={`bg-${card.color}-50 border border-${card.color}-100 rounded-2xl p-4`}>
                  <p className={`text-xl font-black text-${card.color}-700`}>{card.value}</p>
                  <p className="text-xs font-semibold text-gray-700 mt-1">{card.label}</p>
                  <p className="text-xs text-gray-400">{card.sub}</p>
                </div>
              ))}
            </div>
          )}

          {/* Bulk Actions */}
          {selectedIds.length > 0 && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex flex-wrap items-center gap-3 text-sm">
              <span className="font-semibold text-indigo-800">{selectedIds.length} selected</span>
              {[
                { label: 'Mark Reviewed', status: 'reviewed', color: 'bg-blue-600' },
                { label: 'Mark Approved', status: 'approved', color: 'bg-indigo-600' },
                { label: 'Mark Paid', status: 'paid', color: 'bg-green-600' },
              ].map(btn => (
                <button
                  key={btn.status}
                  onClick={() => handleStatusBulk(btn.status)}
                  className={`${btn.color} text-white px-3 py-1.5 rounded-lg text-xs font-medium`}
                >
                  {btn.label}
                </button>
              ))}
              <button
                onClick={() => handlePrintAllEnvelopes(filtered.filter(r => selectedIds.includes(r.id)))}
                className="bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 hover:bg-purple-700 transition-all"
              >
                <Printer size={13} />
                Print Selected Envelopes ({selectedIds.length})
              </button>
              <button onClick={() => setSelectedIds([])} className="text-gray-500 hover:text-gray-700 ml-auto">
                <X size={16} />
              </button>
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <DollarSign size={48} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">No payroll records found</p>
                <p className="text-sm mt-1">Click "Generate Payroll" to create payroll from attendance data</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-indigo-900 text-white">
                        <th className="px-4 py-3 text-left">
                          <input type="checkbox" checked={selectedIds.length === filtered.length} onChange={toggleAll} className="rounded" />
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Emp Code</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Name</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase bg-indigo-800 bg-opacity-40">Present Days</th>
                        {/* <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Pay Cycle</th> */}
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Basic Salary</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase">OT</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Puttha Price</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase">Puttha Status</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Gross Salary</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase bg-red-900 bg-opacity-40">Advance</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase bg-red-900 bg-opacity-40">Loan Ded.</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase bg-red-900 bg-opacity-40">Adv. Ded.</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase bg-red-900 bg-opacity-40">Total Ded.</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase bg-green-900 bg-opacity-50">Net Salary</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase">Status</th>

                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filtered.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleSelect(row.id)} className="rounded" />
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 font-mono">{row.emp_code}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{row.emp_name}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                              {row.payable_days ?? '—'}
                            </span>
                          </td>
                          {/* <td className="px-4 py-3 text-left text-sm text-gray-700 whitespace-nowrap">{MONTHS[filterMonth - 1]} {filterYear.toString().slice(-2)}</td> */}

                          <td className="px-4 py-3 text-right text-sm text-gray-700">{fmt(row.basic_salary)}</td>
                          <td className="px-4 py-3 text-right text-sm text-gray-700">
                            {(row.ot_amount > 0 || parseOtHours(row.ot_hours) > 0) ? (
                              <span className="inline-flex items-center gap-1 font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full text-xs border border-amber-200" title={`${formatOtDisplay(row.ot_hours)} hrs @ ₹50/hr = ₹${row.ot_amount}`}>
                                {formatOtDisplay(row.ot_hours)} ({fmt(row.ot_amount)})
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-700">{fmt(row.puttha_price)}</td>
                          <td className="px-4 py-3 text-center text-sm">
                            <button
                              onClick={() => handleTogglePutthaStatus(row)}
                              title="Click to toggle Puttha Status (Yes / No)"
                              className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer shadow-sm ${(row.puttha_status || 'Yes') === 'Yes'
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300'
                                : 'bg-rose-100 text-rose-800 hover:bg-rose-200 border border-rose-300'
                                }`}
                            >
                              {row.puttha_status || 'Yes'}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{fmt(row.gross_salary)}</td>
                          <td className="px-4 py-3 text-right text-sm text-red-600">{fmt(row.advance)}</td>
                          <td className="px-4 py-3 text-right text-sm text-red-600">{fmt(row.loan_deduction || 0)}</td>
                          <td className="px-4 py-3 text-right text-sm text-red-600">{fmt(row.salary_advance_deduction || 0)}</td>
                          <td className="px-4 py-3 text-right text-sm text-red-700 font-medium">{fmt(row.total_deductions)}</td>
                          <td className="px-4 py-3 text-right text-sm font-bold text-green-700">{fmt(row.net_salary)}</td>
                          <td className="px-4 py-3 text-center"><StatusBadge status={row.status} /></td>

                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-center">
                              <button onClick={() => setPayslipRow(row)} title="View payslip" className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600">
                                <Eye size={14} />
                              </button>
                              <button onClick={() => setEnvelopeRow(row)} title="Employee Envelope" className="p-1.5 rounded-lg hover:bg-purple-50 text-purple-600">
                                <Mail size={14} />
                              </button>
                              {row.status !== 'paid' && (
                                <button onClick={() => setEditRow(row)} title="Adjust advance deduction" className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600">
                                  <Edit3 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-100 border-t-2 border-gray-300">
                        <td colSpan={3} className="px-4 py-3 text-sm font-bold text-gray-700">
                          Total ({filtered.length} employees)
                        </td>
                        <td className="px-4 py-3 text-center text-sm font-bold text-indigo-700">
                          {filtered.length > 0 ? (filtered.reduce((s, r) => s + (parseFloat(r.payable_days) || 0), 0) / filtered.length).toFixed(1) : 0} avg
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{fmt(filtered.reduce((s, r) => s + (r.basic_salary || 0), 0))}</td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-amber-700">{fmt(filtered.reduce((s, r) => s + (r.ot_amount || 0), 0))}</td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{fmt(filtered.reduce((s, r) => s + (r.puttha_price || 0), 0))}</td>
                        <td className="px-4 py-3" />
                        <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{fmt(totalGross)}</td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-red-700">{fmt(filtered.reduce((s, r) => s + (r.advance || 0), 0))}</td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-red-700">{fmt(filtered.reduce((s, r) => s + (r.loan_deduction || 0), 0))}</td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-red-700">{fmt(filtered.reduce((s, r) => s + (r.salary_advance_deduction || 0), 0))}</td>
                        <td className="px-4 py-3" />
                        <td className="px-4 py-3 text-right text-sm font-bold text-red-700">{fmt(totalDeductions)}</td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-green-700">{fmt(totalNet)}</td>
                        <td colSpan={3} />
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-gray-100 bg-white gap-3 rounded-b-2xl">
                  <div className="text-xs text-gray-500 font-medium">
                    Showing <span className="font-bold text-gray-800">{totalRecords > 0 ? (page - 1) * pageSize + 1 : 0}</span> to{' '}
                    <span className="font-bold text-gray-800">{Math.min(page * pageSize, totalRecords)}</span> of{' '}
                    <span className="font-bold text-gray-800">{totalRecords}</span> records (Page {page} of {totalPages || 1})
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1 || loading}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="text-xs font-semibold px-2.5 py-1 bg-gray-100 rounded-md text-gray-800">
                      {page} / {totalPages || 1}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages || loading}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── PAYSLIPS TAB ── */}
      {activeTab === 'payslips' && (
        <PayslipsTab
          filterYear={filterYear}
          filterMonth={filterMonth}
          search={search}
          notify={notify}
          onPaidRecordsChange={setPaidProcessedRecords}
        />
      )}

      {/* Modals */}
      {payslipRow && <PayslipModal row={payslipRow} onClose={() => setPayslipRow(null)} />}
      {envelopeRow && <EmployeeEnvelopeModal row={envelopeRow} onClose={() => setEnvelopeRow(null)} />}
      {editRow && (
        <EditDeductionsModal key={editRow.id} row={editRow} onSave={handleEditSave} onClose={() => setEditRow(null)} />
      )}
    </div>
  );
};

export default Payroll;