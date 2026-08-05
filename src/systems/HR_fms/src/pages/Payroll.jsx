import { useState, useEffect } from 'react';
import { pdf } from '@react-pdf/renderer';
import {
  DollarSign, RefreshCw, Search, AlertCircle,
  Play, Eye, X, Edit3, FileText, Download, Loader2,
} from 'lucide-react';
import {
  fetchAttendanceMonthly,
  fetchEmployees,
  fetchPayroll,
  fetchPayrollPaginated,
  generatePayrollBatch,
  updatePayrollStatus,
  updatePayrollRow,
  updateEmployeePutthaStatus,
  savePayslip,
  fetchPayslips,
  fetchPayslipData,
  MONTHS,
} from '../services/supabaseHR';
import PayslipPDF from '../components/PayslipPDF';

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

const fmt = (n) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
                  <span className="text-gray-600">Basic Salary</span>
                  <span className="font-medium text-gray-900">{fmt(row.basic_salary)}</span>
                </div>
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
    loan_deduction: row.loan_deduction || 0,
    salary_advance_deduction: row.salary_advance_deduction || 0,
    remarks: row.remarks || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const loanDeduction = parseFloat(form.loan_deduction || 0);
      const salaryAdvanceDeduction = parseFloat(form.salary_advance_deduction || 0);
      const advanceDeduction = loanDeduction + salaryAdvanceDeduction;
      const netSalary = row.gross_salary - advanceDeduction;
      await onSave(row.id, {
        loan_deduction: loanDeduction,
        salary_advance_deduction: salaryAdvanceDeduction,
        advance_deduction: advanceDeduction,
        total_deductions: parseFloat(advanceDeduction.toFixed(2)),
        net_salary: parseFloat(netSalary.toFixed(2)),
        remarks: form.remarks,
      });
      onClose();
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
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Loan Deduction (₹)</label>
            <input
              type="number" min="0" step="0.01"
              value={form.loan_deduction}
              onChange={(e) => setForm(f => ({ ...f, loan_deduction: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Advance Deduction (₹)</label>
            <input
              type="number" min="0" step="0.01"
              value={form.salary_advance_deduction}
              onChange={(e) => setForm(f => ({ ...f, salary_advance_deduction: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            />
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
          <button onClick={handleSave} disabled={saving} className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Payslips Tab ──────────────────────────────────────────────────────────────
const PayslipsTab = ({ filterYear, filterMonth, notify }) => {
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  const loadPayslips = async () => {
    setLoading(true);
    try {
      const data = await fetchPayslips({ year: filterYear, month: filterMonth });
      setPayslips(data || []);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPayslips(); }, [filterYear, filterMonth]);

  // Generate payslips for all paid employees this month
  const handleGenerateAll = async () => {
    setGenerating(true);
    try {
      const paidRows = await fetchPayroll({ year: filterYear, month: filterMonth, status: 'paid' });
      if (!paidRows?.length) {
        notify('No paid payroll records found for this month. Mark employees as paid first.', 'warn');
        return;
      }

      let count = 0;
      for (const row of paidRows) {
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
      }
      notify(`✓ ${count} payslips generated and stored`);
      await loadPayslips();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadOne = async (slip) => {
    setDownloadingId(slip.id);
    try {
      // Fetch the paid payroll row to render fresh PDF
      const rows = await fetchPayroll({ year: slip.year, month: slip.month, empCode: slip.emp_code });
      const row = rows?.[0];
      if (!row) { notify('Payroll record not found', 'error'); return; }

      const { employee, attendance } = await fetchPayslipData(row.emp_code, row.year, row.month);
      const blob = await pdf(<PayslipPDF row={row} employee={employee} attendance={attendance} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Payslip_${slip.emp_code}_${MONTHS[slip.month - 1]}_${slip.year}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadAll = async () => {
    if (!payslips.length) return;
    setGenerating(true);
    try {
      for (const slip of payslips) {
        await handleDownloadOne(slip);
      }
      notify(`✓ ${payslips.length} payslips downloaded`);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">
            {MONTHS[filterMonth - 1]} {filterYear} — Payslips
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Payslips are auto-generated for employees marked as <span className="font-medium text-green-700">Paid</span>.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadPayslips}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          {payslips.length > 0 && (
            <button
              onClick={handleDownloadAll}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-2 border border-indigo-300 text-indigo-700 rounded-lg text-sm hover:bg-indigo-50"
            >
              <Download size={13} />
              Download All
            </button>
          )}
          <button
            onClick={handleGenerateAll}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {generating
              ? <><Loader2 size={13} className="animate-spin" /> Generating...</>
              : <><FileText size={13} /> Generate Payslips</>}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : payslips.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <FileText size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No payslips generated yet</p>
            <p className="text-sm mt-1">Mark employees as "Paid" in the Payroll tab, then click "Generate Payslips"</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-indigo-900 text-white">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Emp Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Employee Name</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase">Month</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase">Generated At</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payslips.map((slip, idx) => (
                  <tr key={slip.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-400">{idx + 1}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">{slip.emp_code}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{slip.emp_name}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">
                      {MONTHS[slip.month - 1]} {slip.year}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-400">
                      {slip.generated_at
                        ? new Date(slip.generated_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-center">
                        {slip.pdf_url && (
                          <a
                            href={slip.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open stored PDF"
                            className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600"
                          >
                            <Eye size={14} />
                          </a>
                        )}
                        <button
                          onClick={() => handleDownloadOne(slip)}
                          disabled={downloadingId === slip.id}
                          title="Download PDF"
                          className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 disabled:opacity-40"
                        >
                          {downloadingId === slip.id
                            ? <Loader2 size={14} className="animate-spin" />
                            : <Download size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info note */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">Storage Details</p>
        <p className="text-xs">PDFs are stored in Supabase Storage bucket: <code className="bg-blue-100 px-1 rounded font-mono">payslips</code></p>
        <p className="text-xs mt-0.5">Path pattern: <code className="bg-blue-100 px-1 rounded font-mono">{filterYear}/{String(filterMonth).padStart(2, '0')}/{'<emp_code>'}.pdf</code></p>
      </div>
    </div>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const Payroll = () => {
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [search, setSearch] = useState('');
  const [payrollData, setPayrollData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  const [payslipRow, setPayslipRow] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [activeTab, setActiveTab] = useState('payroll'); // 'payroll' | 'payslips'

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const notify = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Pagination states
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const loadPayroll = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPayrollPaginated({
        year: filterYear,
        month: filterMonth,
        search,
        page,
        pageSize
      });
      setPayrollData(res.data || []);
      setTotalRecords(res.totalRecords || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchAsync = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchPayrollPaginated({
          year: filterYear,
          month: filterMonth,
          search,
          page,
          pageSize
        });
        if (isMounted) {
          setPayrollData(res.data || []);
          setTotalRecords(res.totalRecords || 0);
          setTotalPages(res.totalPages || 1);
        }
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchAsync();
    return () => { isMounted = false; };
  }, [filterYear, filterMonth, search, page]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const attendance = await fetchAttendanceMonthly({ year: filterYear, month: filterMonth });
      if (!attendance?.length) throw new Error('No attendance data found for this month. Upload the Excel first.');

      const employees = await fetchEmployees();
      const activeEmployees = employees ? employees.filter(e => e.status === 'active') : [];
      if (!activeEmployees.length) throw new Error('No active employees found. Add employee details first.');

      const employeeMap = {};
      activeEmployees.forEach(e => {
        employeeMap[e.employee_id] = {
          ...e,
          puttha_status: e.puttha_status || 'Yes',
        };
      });

      const missing = attendance.filter(a => !employeeMap[a.emp_code]).map(a => a.emp_name);
      if (missing.length) {
        notify(`⚠ ${missing.length} employees missing from Employee table: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '...' : ''}`, 'warn');
      }

      const result = await generatePayrollBatch(attendance, employeeMap);
      notify(`✓ Payroll generated for ${result.length} employees`);
      await loadPayroll();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  // When marking as paid, auto-generate payslips for those employees
  const handleStatusBulk = async (newStatus) => {
    if (!selectedIds.length) return;
    try {
      await updatePayrollStatus(selectedIds, newStatus);
      notify(`✓ ${selectedIds.length} records marked as "${newStatus}"`);
      setSelectedIds([]);
      await loadPayroll();

      // Auto-generate payslips when marking as paid
      if (newStatus === 'paid') {
        const paidRows = payrollData.filter(r => selectedIds.includes(r.id));
        if (paidRows.length > 0) {
          let count = 0;
          for (const row of paidRows) {
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
            } catch {
              // Don't fail the status update if payslip generation errors
            }
          }
          if (count > 0) {
            notify(`✓ ${count} payslip${count > 1 ? 's' : ''} auto-generated. View in the Payslips tab.`);
          }
        }
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEditSave = async (id, updates) => {
    await updatePayrollRow(id, updates);
    notify('✓ Payroll updated');
    await loadPayroll();
  };

  const filtered = payrollData;

  const toggleSelect = (id) => setSelectedIds(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]);
  const toggleAll = () => setSelectedIds(selectedIds.length === filtered.length ? [] : filtered.map(r => r.id));

  const totalGross = filtered.reduce((s, r) => s + (r.gross_salary || 0), 0);
  const totalDeductions = filtered.reduce((s, r) => s + (r.total_deductions || 0), 0);
  const totalNet = filtered.reduce((s, r) => s + (r.net_salary || 0), 0);
  const paidCount = filtered.filter(r => r.status === 'paid').length;

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
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 shadow-md disabled:opacity-50 transition-all"
        >
          {generating
            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating...</>
            : <><Play size={15} /> Generate Payroll</>}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { id: 'payroll', label: 'Payroll' },
          { id: 'payslips', label: 'Payslips' },
        ].map(tab => (
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
                value={filterYear}
                onChange={(e) => setFilterYear(parseInt(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(parseInt(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
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
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Basic Salary</th>
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
                        <td className="px-4 py-3 text-right text-sm text-gray-700">{fmt(row.basic_salary)}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-700">{fmt(row.puttha_price)}</td>
                        <td className="px-4 py-3 text-center text-sm text-gray-700">{row.puttha_status || '—'}</td>
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
                            <button onClick={() => setEditRow(row)} title="Adjust advance deduction" className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600">
                              <Edit3 size={14} />
                            </button>
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
                      <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{fmt(filtered.reduce((s, r) => s + (r.puttha_price || 0), 0))}</td>
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{fmt(totalGross)}</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-red-700">{fmt(filtered.reduce((s, r) => s + (r.advance || 0), 0))}</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-red-700">{fmt(filtered.reduce((s, r) => s + (r.loan_deduction || 0), 0))}</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-red-700">{fmt(filtered.reduce((s, r) => s + (r.salary_advance_deduction || 0), 0))}</td>
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
          notify={notify}
        />
      )}

      {/* Modals */}
      {payslipRow && <PayslipModal row={payslipRow} onClose={() => setPayslipRow(null)} />}
      {editRow && (
        <EditDeductionsModal row={editRow} onSave={handleEditSave} onClose={() => setEditRow(null)} />
      )}
    </div>
  );
};

export default Payroll;