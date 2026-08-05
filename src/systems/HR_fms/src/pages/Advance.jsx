import React, { useRef, useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Plus, Check, X, Clock, FileText, IndianRupee, UploadCloud, Table, Info, Download, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import supabase from '../../../../SupabaseClient';
import hrSupabase from '../services/supabaseHRClient';
import {
  fetchAdvances,
  fetchAdvancesPaginated,
  upsertAdvance,
  updateAdvanceStatus,
  deleteAdvance,
  fetchEmployees,
  fetchSalaryAdvances,
  upsertSalaryAdvance,
  updateSalaryAdvanceStatus,
  deleteSalaryAdvance,
  fetchSalaryConfigs
} from '../services/supabaseHR';

const Advance = () => {
  const [activeTab, setActiveTab] = useState('Loan');
  const [advances, setAdvances] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [newAdvance, setNewAdvance] = useState({ amount: '', monthlyDeduction: '', reason: '', deduction: 'Yes' });
  const [editingLoanId, setEditingLoanId] = useState(null);
  const [employeesList, setEmployeesList] = useState([]);
  const [selectedEmployeeName, setSelectedEmployeeName] = useState("");
  const [salaryAdvances, setSalaryAdvances] = useState([]);
  const [newSalaryAdvance, setNewSalaryAdvance] = useState({ amount: '', reason: '', deduction: 'Yes', date: new Date().toISOString().split('T')[0] });
  const [editingSalaryAdvanceId, setEditingSalaryAdvanceId] = useState(null);
  const [selectedSalEmpName, setSelectedSalEmpName] = useState("");
  const [salaryConfigs, setSalaryConfigs] = useState([]);
  const [totalDebitAmount, setTotalDebitAmount] = useState(() => {
    const saved = localStorage.getItem('hrfms_advance_total_debit');
    return saved ? parseFloat(saved) || 0 : 0;
  });
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const [selectedAdvMonth, setSelectedAdvMonth] = useState(new Date().getMonth() + 1);
  const [selectedAdvYear, setSelectedAdvYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showFormatModal, setShowFormatModal] = useState(false);
  const [unmatchedImportNames, setUnmatchedImportNames] = useState([]);
  const fileInputRef = useRef(null);

  const ADVANCE_FIELDS = [
    { key: 'employeeId', label: 'Employee ID', required: true, placeholder: 'e.g. EMP001' },
    { key: 'employeeName', label: 'Employee Name', required: true, placeholder: 'e.g. Rahul Sharma' },
    { key: 'amount', label: 'Amount', required: true, placeholder: 'e.g. 5000' },
    { key: 'monthlyDeduction', label: 'Monthly Deduction', required: true, placeholder: 'e.g. 1000' },
    { key: 'deduction', label: 'Deduction', required: false, placeholder: 'e.g. Yes' },
    { key: 'reason', label: 'Reason', required: true, placeholder: 'e.g. Medical' },
    { key: 'date', label: 'Date', required: false, placeholder: 'e.g. 5/9/2026' },
  ];

  const SALARY_ADVANCE_FIELDS = [
    { key: 'employeeName', label: 'Employee Name', required: true, placeholder: 'e.g. Rahul Sharma' },
    { key: 'amount', label: 'Amount', required: true, placeholder: 'e.g. 5000' },
  ];

  const toISODate = (str) => {
    const s = String(str).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (m) {
      const [, dd, mm, yyyy] = m;
      return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }
    if (!isNaN(s) && s !== '') {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const d = new Date(excelEpoch.getTime() + Number(s) * 86400000);
      return d.toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  };

  const downloadCsvTemplate = (fieldsArray) => {
    const headers = fieldsArray.map((f) => f.label).join(',');
    const example = fieldsArray.map((f) => f.placeholder.replace('e.g. ', '')).join(',');
    const csv = `${headers}\n${example}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Get user from local storage
  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : null;
  const isAdmin = user?.Admin === 'Yes';
  const employeeId = localStorage.getItem('employeeId') || user?.employeeId || 'EMP001';
  const employeeName = user?.Name || user?.Username || 'Employee';

  // Pagination states
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const loadData = async () => {
    setLoading(true);
    try {
      const advRes = await fetchAdvancesPaginated({ page, pageSize });
      setAdvances(advRes.data || []);
      setTotalRecords(advRes.totalRecords || 0);
      setTotalPages(advRes.totalPages || 1);

      const salAdvData = await fetchSalaryAdvances();
      setSalaryAdvances(salAdvData || []);

      if (isAdmin) {
        const empData = await fetchEmployees();
        const activeEmps = (empData || [])
          .filter(e => e.status === 'active')
          .map(e => ({
            employeeId: e.employee_id,
            employeeName: e.name
          }));
        setEmployeesList(activeEmps);

        const salConfigs = await fetchSalaryConfigs();
        setSalaryConfigs(salConfigs || []);
      }
    } catch (err) {
      toast.error(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchAsync = async () => {
      setLoading(true);
      try {
        const advRes = await fetchAdvancesPaginated({ page, pageSize });
        const salAdvData = await fetchSalaryAdvances();
        let activeEmps = [];
        let salConfigs = [];

        if (isAdmin) {
          const empData = await fetchEmployees();
          activeEmps = (empData || [])
            .filter(e => e.status === 'active')
            .map(e => ({
              employeeId: e.employee_id,
              employeeName: e.name
            }));
          salConfigs = await fetchSalaryConfigs();
        }

        if (isMounted) {
          setAdvances(advRes.data || []);
          setTotalRecords(advRes.totalRecords || 0);
          setTotalPages(advRes.totalPages || 1);
          setSalaryAdvances(salAdvData || []);
          if (isAdmin) {
            setEmployeesList(activeEmps);
            setSalaryConfigs(salConfigs || []);
          }
        }
      } catch (err) {
        if (isMounted) toast.error(`Failed to load data: ${err.message}`);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchAsync();
    return () => { isMounted = false; };
  }, [isAdmin, page]);

  const handleRequestAdvance = async (e) => {
    e.preventDefault();
    if (!newAdvance.amount || !newAdvance.monthlyDeduction || !newAdvance.reason) {
      toast.error('Please fill in all fields');
      return;
    }
    if (parseFloat(newAdvance.monthlyDeduction) <= 0) {
      toast.error('Monthly deduction must be greater than 0');
      return;
    }
    if (parseFloat(newAdvance.monthlyDeduction) > parseFloat(newAdvance.amount)) {
      toast.error('Monthly deduction cannot be greater than the advance amount');
      return;
    }

    let finalEmployeeId = employeeId;
    let finalEmployeeName = employeeName;

    if (isAdmin) {
      if (!selectedEmployeeName) {
        toast.error('Please select an employee');
        return;
      }
      const selectedEmployee = employeesList.find(e => e.employeeName === selectedEmployeeName);
      if (selectedEmployee) {
        finalEmployeeId = selectedEmployee.employeeId;
        finalEmployeeName = selectedEmployee.employeeName;
      }
    }

    const isEditing = !!editingLoanId;
    const existing = isEditing ? advances.find(a => a.id === editingLoanId) : null;

    const newRequest = {
      ...(isEditing ? { id: editingLoanId } : {}),
      employee_id: finalEmployeeId,
      employee_name: finalEmployeeName,
      amount: parseFloat(newAdvance.amount),
      monthly_deduction: parseFloat(newAdvance.monthlyDeduction),
      remaining_amount: isEditing ? (existing?.remaining_amount ?? parseFloat(newAdvance.amount)) : parseFloat(newAdvance.amount),
      reason: newAdvance.reason,
      deduction: newAdvance.deduction,
      date: isEditing ? (existing?.date ?? new Date().toISOString().split('T')[0]) : new Date().toISOString().split('T')[0],
      status: isEditing ? (existing?.status ?? 'Approved') : (isAdmin ? 'Approved' : 'Pending')
    };

    try {
      await upsertAdvance(newRequest);
      setNewAdvance({ amount: '', monthlyDeduction: '', reason: '', deduction: 'Yes' });
      setSelectedEmployeeName('');
      setEditingLoanId(null);
      setShowModal(false);
      toast.success(isEditing ? 'Loan record updated successfully' : 'Loan request submitted successfully');
      loadData();
    } catch (err) {
      toast.error(`Failed to submit request: ${err.message}`);
    }
  };

  const handleImportFile = (file) => {
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        if (raw.length < 2) throw new Error('The file has no data rows.');

        const header = raw[0].map((h) => String(h).trim().toLowerCase());
        const colIndex = (labels) => header.findIndex((h) => labels.some((l) => h.includes(l)));

        const idx = {
          employeeId: colIndex(['employee id', 'employee_id', 'emp id']),
          employeeName: colIndex(['employee name', 'employee', 'name']),
          amount: colIndex(['amount']),
          monthlyDeduction: colIndex(['monthly deduction', 'monthly_deduction']),
          deduction: colIndex(['deduction']),
          reason: colIndex(['reason']),
          date: colIndex(['date']),
        };

        const rows = raw
          .slice(1)
          .filter((r) => r.some((c) => String(c).trim() !== ''))
          .map((r) => ({
            employee_id: idx.employeeId >= 0 ? String(r[idx.employeeId] || '').trim() : '',
            employee_name: idx.employeeName >= 0 ? String(r[idx.employeeName] || '').trim() : '',
            amount: idx.amount >= 0 ? parseFloat(r[idx.amount]) || 0 : 0,
            monthly_deduction: idx.monthlyDeduction >= 0 ? parseFloat(r[idx.monthlyDeduction]) || 0 : 0,
            remaining_amount: idx.amount >= 0 ? parseFloat(r[idx.amount]) || 0 : 0,
            deduction: idx.deduction >= 0 && r[idx.deduction] ? String(r[idx.deduction]).trim() : 'Yes',
            reason: idx.reason >= 0 ? String(r[idx.reason] || '').trim() : '',
            date: idx.date >= 0 && r[idx.date] ? toISODate(r[idx.date]) : new Date().toISOString().split('T')[0],
            status: 'Approved',
          }))
          .filter((row) => row.employee_id);

        if (rows.length === 0) throw new Error('No valid rows found — check the header row matches the expected columns.');

        const { error } = await supabase.from('advances').insert(rows);
        if (error) throw error;

        toast.success(`Imported ${rows.length} loan record(s) successfully.`);
        loadData();
      } catch (err) {
        toast.error(`Import failed: ${err.message}`);
      } finally {
        setImporting(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      await updateAdvanceStatus(id, newStatus);
      toast.success(`Loan request ${newStatus.toLowerCase()}`);
      loadData();
    } catch (err) {
      toast.error(`Failed to update request: ${err.message}`);
    }
  };

  const handleEditLoanClick = (adv) => {
    setEditingLoanId(adv.id);
    setNewAdvance({
      amount: String(adv.amount ?? ''),
      monthlyDeduction: String(adv.monthly_deduction ?? ''),
      reason: adv.reason ?? '',
      deduction: adv.deduction ?? 'Yes',
    });
    setSelectedEmployeeName(adv.employee_name ?? '');
    setShowModal(true);
  };

  const handleDeleteLoan = async (id) => {
    if (!window.confirm('Delete this loan record? This cannot be undone.')) return;
    try {
      await deleteAdvance(id);
      toast.success('Loan record deleted');
      loadData();
    } catch (err) {
      toast.error(`Failed to delete: ${err.message}`);
    }
  };

  const handleRequestSalaryAdvance = async (e) => {
    e.preventDefault();

    if (!newSalaryAdvance.amount) {
      toast.error('Please fill in all fields');
      return;
    }

    let finalEmployeeId = employeeId;
    let finalEmployeeName = employeeName;

    if (isAdmin) {
      if (!selectedSalEmpName) {
        toast.error('Please select an employee');
        return;
      }
      const selectedEmployee = employeesList.find(e => e.employeeName === selectedSalEmpName);
      if (selectedEmployee) {
        finalEmployeeId = selectedEmployee.employeeId;
        finalEmployeeName = selectedEmployee.employeeName;
      }
    }

    const amount = parseFloat(newSalaryAdvance.amount);
    if (amount <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }

    const empConfig = (salaryConfigs || []).find(c => c.emp_code === finalEmployeeId);

    if (!empConfig) {
      toast.error('No salary record found — submitting without salary cap check.', { duration: 5000 });
    } else {
      const empSalary = parseFloat(empConfig.salary) || 0;
      if (amount >= empSalary) {
        toast.error(`Advance amount (₹${amount}) must be less than employee's salary (₹${empSalary})`);
        return;
      }
    }

    const isEditing = !!editingSalaryAdvanceId;
    const existing = isEditing ? salaryAdvances.find(a => a.id === editingSalaryAdvanceId) : null;

    const advanceDateISO = `${selectedAdvYear}-${String(selectedAdvMonth).padStart(2, '0')}-01`;

    const newRequest = {
      ...(isEditing ? { id: editingSalaryAdvanceId } : {}),
      employee_id: finalEmployeeId,
      employee_name: finalEmployeeName,
      amount: amount,
      deduction: newSalaryAdvance.deduction,
      reason: newSalaryAdvance.reason,
      date: isEditing ? (existing?.date ?? advanceDateISO) : advanceDateISO,
      status: isEditing ? (existing?.status ?? 'Approved') : (isAdmin ? 'Approved' : 'Pending')
    };

    try {
      await upsertSalaryAdvance(newRequest);
      setNewSalaryAdvance({ amount: '', reason: '', deduction: 'Yes', date: new Date().toISOString().split('T')[0] });
      setSelectedSalEmpName('');
      setEditingSalaryAdvanceId(null);
      setShowAdvanceModal(false);
      toast.success(isEditing ? 'Advance record updated successfully' : 'Advance request submitted successfully');
      loadData();
    } catch (err) {
      toast.error(`Failed to submit request: ${err.message}`);
    }
  };

  const handleImportSalaryAdvanceFile = (file) => {
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        // Employee advance data lives on the 1st sheet of the workbook
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        if (raw.length < 1) throw new Error('The file has no data rows.');

        const advanceDateISO = `${selectedAdvYear}-${String(selectedAdvMonth).padStart(2, '0')}-01`;

        // Detect the "Salary" summary format: row 1 col A says "Salary" and col B
        // holds the grand total; every row after is Name (col A) + Amount (col C).
        const firstCellRaw = String(raw[0][0] || '').trim().toLowerCase();
        const isSalarySummaryFormat = firstCellRaw === 'salary';

        if (isSalarySummaryFormat) {
          const sheetTotal = parseFloat(String(raw[0][1] || '').replace(/,/g, '')) || 0;
          let skipped = 0;
          const validRows = [];
          const unmatched = [];

          for (let i = 1; i < raw.length; i++) {
            const r = raw[i];
            if (!r.some((c) => String(c).trim() !== '')) continue;

            const name = String(r[0] || '').trim();
            const amount = parseFloat(String(r[2] || '').replace(/,/g, '')) || 0;
            if (!name || !amount) continue;

            const match = employeesList.find(
              (emp) => emp.employeeName.toLowerCase().trim() === name.toLowerCase().trim()
            );
            if (!match) { skipped++; unmatched.push(name); continue; }

            validRows.push({
              employee_id: match.employeeId,
              employee_name: name,
              amount: amount,
              deduction: 'Yes',
              reason: '',
              date: advanceDateISO,
              status: 'Approved',
            });
          }

          setTotalDebitAmount(sheetTotal);
          localStorage.setItem('hrfms_advance_total_debit', String(sheetTotal));
          setUnmatchedImportNames(unmatched);

          if (validRows.length > 0) {
           const { error } = await hrSupabase.from('salary_advances').insert(validRows);
            if (error) throw error;
          }

          if (skipped > 0) {
            toast.success(`Imported ${validRows.length} advance record(s). Skipped ${skipped} — employee name not matched.`);
          } else {
            toast.success(`Imported ${validRows.length} advance record(s) successfully.`);
          }
          loadData();
          setImporting(false);
          return;
        }

        // Detect the D/C ledger format: column A is a single "D" or "C" code,
        // not a text header — meaning there is NO header row, data starts at row 1.
        const firstCell = String(raw[0][0] || '').trim().toUpperCase();
        const isLedgerFormat = firstCell === 'D' || firstCell === 'C';

        // Helper: find the first usable numeric amount in a row (amount column
        // shifts between C/D in the sheet, so scan instead of fixing an index)
        const findAmount = (row) => {
          for (let c = 2; c < row.length; c++) {
            const n = parseFloat(String(row[c]).replace(/,/g, ''));
            if (!isNaN(n) && n > 0) return n;
          }
          return 0;
        };

        let debitTotal = 0;
        let skipped = 0;
        const validRows = [];
        const unmatched = [];

        if (isLedgerFormat) {
          // No header — every row (starting from row 0) is real data
          for (let i = 0; i < raw.length; i++) {
            const r = raw[i];
            if (!r.some((c) => String(c).trim() !== '')) continue;

            const code = String(r[0] || '').trim().toUpperCase();
            const name = String(r[1] || '').trim();

            if (code === 'D') {
              // Debit row = total salary paid out, not an employee advance
              debitTotal += findAmount(r);
              continue;
            }
            if (code !== 'C' || !name) continue;

            const amount = findAmount(r);
            if (!amount) continue;

            const match = employeesList.find(
              (emp) => emp.employeeName.toLowerCase().trim() === name.toLowerCase().trim()
            );
            const empId = match ? match.employeeId : '';
            if (!empId) {
              skipped++;
              unmatched.push(name);
              continue;
            }

            validRows.push({
              employee_id: empId,
              employee_name: name,
              amount: amount,
              deduction: 'Yes',
              reason: '',
              date: advanceDateISO,
              status: 'Approved',
            });
          }
          setTotalDebitAmount(debitTotal);
          localStorage.setItem('hrfms_advance_total_debit', String(debitTotal));
        } else {
          // Fallback: original header-based format (Employee ID / Name / Amount / Date)
          const header = raw[0].map((h) => String(h).trim().toLowerCase());
          const colIndex = (labels) => header.findIndex((h) => labels.some((l) => h.includes(l)));
          const idx = {
            employeeId: colIndex(['employee id', 'employee_id', 'emp id']),
            employeeName: colIndex(['employee name', 'employee', 'name']),
            amount: colIndex(['amount']),
            date: colIndex(['date']),
          };

          for (let i = 1; i < raw.length; i++) {
            const r = raw[i];
            if (!r.some((c) => String(c).trim() !== '')) continue;

            let empName = idx.employeeName >= 0 ? String(r[idx.employeeName] || '').trim() : '';
            let empId = idx.employeeId >= 0 ? String(r[idx.employeeId] || '').trim() : '';
            if (!empId && empName) {
              const match = employeesList.find(
                (e) => e.employeeName.toLowerCase().trim() === empName.toLowerCase().trim()
              );
              if (match) empId = match.employeeId;
            }
            if (!empId) continue;

            const amount = idx.amount >= 0 ? parseFloat(r[idx.amount]) || 0 : 0;
            const empConfig = salaryConfigs.find(c => c.emp_code === empId);
            const empSalary = empConfig ? parseFloat(empConfig.salary) : 0;
            if (empSalary && amount >= empSalary) { skipped++; continue; }

            validRows.push({
              employee_id: empId,
              employee_name: empName,
              amount: amount,
              deduction: 'Yes',
              reason: '',
              date: idx.date >= 0 && r[idx.date] ? toISODate(r[idx.date]) : new Date().toISOString().split('T')[0],
              status: 'Approved',
            });
          }
        }

        setUnmatchedImportNames(unmatched);

        console.log('validRows built:', validRows);

        if (validRows.length > 0) {
          const { data: insertedData, error } = await hrSupabase.from('salary_advances').insert(validRows).select();
          if (error) {
            console.error('Supabase insert error:', error);
            throw error;
          }
          console.log('Inserted rows:', insertedData);
        }

        if (skipped > 0) {
          toast.success(`Imported ${validRows.length} advance record(s). Skipped ${skipped} record(s) — employee not matched or amount exceeded salary.`);
        } else {
          toast.success(`Imported ${validRows.length} advance record(s) successfully.`);
        }
        loadData();
      } catch (err) {
        console.error('Import failed, full error:', err);
        toast.error(`Import failed: ${err.message || 'Unknown error'}`);
      } finally {
        setImporting(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSalaryAdvanceStatusUpdate = async (id, newStatus) => {
    try {
      await updateSalaryAdvanceStatus(id, newStatus);
      toast.success(`Advance request ${newStatus.toLowerCase()}`);
      loadData();
    } catch (err) {
      toast.error(`Failed to update request: ${err.message}`);
    }
  };

  const handleEditSalaryAdvanceClick = (adv) => {
    setEditingSalaryAdvanceId(adv.id);
    setNewSalaryAdvance({
      amount: String(adv.amount ?? ''),
      reason: adv.reason ?? '',
      deduction: adv.deduction ?? 'Yes',
      date: adv.date ?? new Date().toISOString().split('T')[0],
    });
    setSelectedSalEmpName(adv.employee_name ?? '');
    setShowAdvanceModal(true);
  };

  const handleDeleteSalaryAdvance = async (id) => {
    if (!window.confirm('Delete this advance record? This cannot be undone.')) return;
    try {
      await deleteSalaryAdvance(id);
      toast.success('Advance record deleted');
      loadData();
    } catch (err) {
      toast.error(`Failed to delete: ${err.message}`);
    }
  };

  // Filter advances based on role in the frontend
  const displayedAdvances = isAdmin
    ? advances
    : advances.filter(adv => adv.employee_id === employeeId);

  const displayedSalaryAdvances = isAdmin
    ? salaryAdvances
    : salaryAdvances.filter(adv => adv.employee_id === employeeId);

  const liveTotalDebit = displayedSalaryAdvances.reduce(
    (sum, adv) => sum + (parseFloat(adv.amount) || 0),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-blue-900 flex items-center">
          <IndianRupee className="mr-2" />
          {activeTab === 'Advance' ? 'Advance Management' : 'Loan Management'}
        </h1>

        <div className="flex p-1 bg-gray-100 rounded-xl border border-gray-200 w-fit">
          <button
            onClick={() => setActiveTab('Loan')}
            className={`px-6 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${activeTab === 'Loan'
              ? 'bg-white text-blue-900 shadow-sm ring-1 ring-gray-900/5'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50/50'
              }`}
          >
            Loan
          </button>
          <button
            onClick={() => setActiveTab('Advance')}
            className={`px-6 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${activeTab === 'Advance'
              ? 'bg-white text-blue-900 shadow-sm ring-1 ring-gray-900/5'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50/50'
              }`}
          >
            Advance
          </button>
        </div>
      </div>

      {activeTab === 'Loan' ? (
        <>
          <div className="flex justify-end items-center gap-2">
            {isAdmin && (
              <>
                <button
                  onClick={() => setShowFormatModal(true)}
                  disabled={importing}
                  className={`px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors flex items-center ${importing ? 'cursor-wait opacity-60' : ''}`}
                >
                  <UploadCloud size={18} className="mr-2" />
                  {importing ? 'Importing…' : 'Import Excel'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  disabled={importing}
                  onChange={(e) => {
                    handleImportFile(e.target.files[0]);
                    e.target.value = '';
                  }}
                />
              </>
            )}
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center"
            >
              <Plus size={18} className="mr-2" />
              {isAdmin ? "Add Loan" : "Request Loan"}
            </button>
          </div>

          <div className="bg-white bg-opacity-70 backdrop-blur-md rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
            <div className="p-4 md:p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">
                {isAdmin ? "All Loan Requests" : "My Loan Requests"}
              </h2>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {isAdmin && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Employee
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Monthly Deduction
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Remaining Balance
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Deduction
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reason
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      {isAdmin && (
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan={isAdmin ? 8 : 6} className="px-6 py-12 text-center text-gray-500">
                          <div className="flex justify-center flex-col items-center">
                            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
                            <span className="text-sm font-medium">Loading requests...</span>
                          </div>
                        </td>
                      </tr>
                    ) : displayedAdvances.length > 0 ? (
                      displayedAdvances.map((adv) => (
                        <tr key={adv.id} className="hover:bg-gray-50">
                          {isAdmin && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {adv.employee_name}
                              <div className="text-xs text-gray-500 font-mono">{adv.employee_id}</div>
                            </td>
                          )}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {adv.date}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                            ₹{(adv.amount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            ₹{(adv.monthly_deduction || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                            ₹{(adv.remaining_amount !== undefined && adv.remaining_amount !== null ? adv.remaining_amount : adv.amount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {adv.deduction || 'Yes'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                            {adv.reason}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center w-fit ${adv.status === 'Approved' ? 'bg-green-100 text-green-800' :
                              adv.status === 'Fully Paid' ? 'bg-indigo-100 text-indigo-800' :
                                adv.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                                  'bg-yellow-100 text-yellow-800'
                              }`}>
                              {adv.status === 'Pending' && <Clock size={12} className="mr-1" />}
                              {(adv.status === 'Approved' || adv.status === 'Fully Paid') && <Check size={12} className="mr-1" />}
                              {adv.status === 'Rejected' && <X size={12} className="mr-1" />}
                              {adv.status}
                            </span>
                          </td>
                          {isAdmin && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
                              <div className="flex justify-center space-x-2">
                                {adv.status === 'Pending' && (
                                  <>
                                    <button
                                      onClick={() => handleStatusUpdate(adv.id, 'Approved')}
                                      className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                                      title="Approve"
                                    >
                                      <Check size={18} />
                                    </button>
                                    <button
                                      onClick={() => handleStatusUpdate(adv.id, 'Rejected')}
                                      className="p-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                                      title="Reject"
                                    >
                                      <X size={18} />
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => handleEditLoanClick(adv)}
                                  className="p-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                                  title="Edit"
                                >
                                  <Pencil size={18} />
                                </button>
                                <button
                                  onClick={() => handleDeleteLoan(adv.id)}
                                  className="p-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={isAdmin ? 8 : 6} className="px-6 py-8 text-center text-gray-500">
                          <FileText size={32} className="mx-auto text-gray-400 mb-2" />
                          No loan requests found
                        </td>
                      </tr>
                    )}
                  </tbody>
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
            </div>
          </div>

          {/* Request Loan Modal */}
          {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-900">{editingLoanId ? 'Edit Loan' : 'Request Loan'}</h2>
                  <button
                    onClick={() => { setShowModal(false); setEditingLoanId(null); }}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleRequestAdvance} className="p-6 space-y-4">
                  {isAdmin && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Select Employee
                      </label>
                      <select
                        required
                        value={selectedEmployeeName}
                        onChange={(e) => setSelectedEmployeeName(e.target.value)}
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      >
                        <option value="">Select an employee</option>
                        {employeesList.map((emp, index) => (
                          <option key={index} value={emp.employeeName}>
                            {emp.employeeName}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount (₹) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={newAdvance.amount}
                      onChange={(e) => setNewAdvance({ ...newAdvance, amount: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="Enter amount"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Monthly Deduction (₹) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={newAdvance.monthlyDeduction}
                      onChange={(e) => setNewAdvance({ ...newAdvance, monthlyDeduction: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="Enter monthly deduction amount"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Deduction *
                    </label>
                    <select
                      value={newAdvance.deduction}
                      onChange={(e) => setNewAdvance({ ...newAdvance, deduction: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reason *
                    </label>
                    <textarea
                      required
                      rows="3"
                      value={newAdvance.reason}
                      onChange={(e) => setNewAdvance({ ...newAdvance, reason: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="Provide reason for loan"
                    ></textarea>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => { setShowModal(false); setEditingLoanId(null); }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {editingLoanId ? 'Update Loan' : 'Submit Request'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          </>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
           {isAdmin && (
              <div className="px-4 py-2 bg-red-50 border border-red-200 rounded-lg w-fit">
                <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">Total Debit (Advances) </span>
                <span className="text-sm font-bold text-red-800 ml-1">₹{totalDebitAmount.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-end items-center gap-2 ml-auto">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowFormatModal(true)}
                  disabled={importing}
                  className={`px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors flex items-center ${importing ? 'cursor-wait opacity-60' : ''}`}
                >
                  <UploadCloud size={18} className="mr-2" />
                  {importing ? 'Importing…' : 'Import Excel'}
                </button>
              )}
              <button
                onClick={() => setShowAdvanceModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center"
              >
                <Plus size={18} className="mr-2" />
                {isAdmin ? "Add Advance" : "Request Advance"}
              </button>
            </div>
          </div>
          {isAdmin && unmatchedImportNames.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 md:p-6">
              <h3 className="text-sm font-bold text-yellow-800 uppercase tracking-wide mb-2">
                Not Imported — Employee Name Not Found ({unmatchedImportNames.length})
              </h3>
              <p className="text-xs text-yellow-700 mb-3">
                These names from the uploaded sheet didn't match any active employee. Fix the spelling in the sheet, or add/activate the employee, then re-import.
              </p>
              <div className="flex flex-wrap gap-2">
                {unmatchedImportNames.map((name, i) => (
                  <span key={i} className="px-3 py-1 bg-white border border-yellow-300 rounded-full text-xs font-medium text-yellow-800">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white bg-opacity-70 backdrop-blur-md rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
            <div className="p-4 md:p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">
                {isAdmin ? "All Advance Requests" : "My Advance Requests"}
              </h2>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {isAdmin && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Employee
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      {isAdmin && (
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan={isAdmin ? 5 : 3} className="px-6 py-12 text-center text-gray-500">
                          <div className="flex justify-center flex-col items-center">
                            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
                            <span className="text-sm font-medium">Loading requests...</span>
                          </div>
                        </td>
                      </tr>
                    ) : displayedSalaryAdvances.length > 0 ? (
                      displayedSalaryAdvances.map((adv) => (
                        <tr key={adv.id} className="hover:bg-gray-50">
                          {isAdmin && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {adv.employee_name}
                              <div className="text-xs text-gray-500 font-mono">{adv.employee_id}</div>
                            </td>
                          )}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {adv.date}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                            ₹{(adv.amount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center w-fit ${adv.status === 'Approved' ? 'bg-green-100 text-green-800' :
                              adv.status === 'Deducted' ? 'bg-indigo-100 text-indigo-800' :
                                adv.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                                  'bg-yellow-100 text-yellow-800'
                              }`}>
                              {adv.status === 'Pending' && <Clock size={12} className="mr-1" />}
                              {(adv.status === 'Approved' || adv.status === 'Deducted') && <Check size={12} className="mr-1" />}
                              {adv.status === 'Rejected' && <X size={12} className="mr-1" />}
                              {adv.status}
                            </span>
                          </td>
                          {isAdmin && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
                              <div className="flex justify-center space-x-2">
                                {adv.status === 'Pending' && (
                                  <>
                                    <button
                                      onClick={() => handleSalaryAdvanceStatusUpdate(adv.id, 'Approved')}
                                      className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                                      title="Approve"
                                    >
                                      <Check size={18} />
                                    </button>
                                    <button
                                      onClick={() => handleSalaryAdvanceStatusUpdate(adv.id, 'Rejected')}
                                      className="p-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                                      title="Reject"
                                    >
                                      <X size={18} />
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => handleEditSalaryAdvanceClick(adv)}
                                  className="p-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                                  title="Edit"
                                >
                                  <Pencil size={18} />
                                </button>
                                <button
                                  onClick={() => handleDeleteSalaryAdvance(adv.id)}
                                  className="p-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={isAdmin ? 5 : 3} className="px-6 py-8 text-center text-gray-500">
                          <FileText size={32} className="mx-auto text-gray-400 mb-2" />
                          No advance requests found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Add Advance Modal */}
          {showAdvanceModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-900">{editingSalaryAdvanceId ? 'Edit Advance' : 'Request Advance'}</h2>
                  <button
                    onClick={() => { setShowAdvanceModal(false); setEditingSalaryAdvanceId(null); }}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

               <form onSubmit={handleRequestSalaryAdvance} className="p-6 space-y-4">
                  {isAdmin && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Select Employee
                      </label>
                      <select
                        required
                        value={selectedSalEmpName}
                        onChange={(e) => setSelectedSalEmpName(e.target.value)}
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      >
                        <option value="">Select an employee</option>
                        {employeesList.map((emp, index) => (
                          <option key={index} value={emp.employeeName}>
                            {emp.employeeName}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Month *</label>
                      <select
                        value={selectedAdvMonth}
                        onChange={(e) => setSelectedAdvMonth(parseInt(e.target.value))}
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      >
                        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Year *</label>
                      <select
                        value={selectedAdvYear}
                        onChange={(e) => setSelectedAdvYear(parseInt(e.target.value))}
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      >
                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount (₹) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={newSalaryAdvance.amount}
                      onChange={(e) => setNewSalaryAdvance({ ...newSalaryAdvance, amount: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="Enter amount"
                    />
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => { setShowAdvanceModal(false); setEditingSalaryAdvanceId(null); }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {editingSalaryAdvanceId ? 'Update Advance' : 'Submit Request'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
{showFormatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowFormatModal(false)} />
      
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-8 text-white relative">
              <button
                onClick={() => setShowFormatModal(false)}
                className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-4 mb-2">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Table className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black tracking-tight">Field Format</h3>
                  <p className="text-blue-100 text-xs font-bold uppercase tracking-widest">Required CSV Structure</p>
                </div>
              </div>
            </div>

            <div className="p-8">
              {activeTab === 'Advance' && (
                <div className="mb-8 flex items-center gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Month</label>
                    <select
                      value={selectedAdvMonth}
                      onChange={(e) => setSelectedAdvMonth(parseInt(e.target.value))}
                      className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    >
                      {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Year</label>
                    <select
                      value={selectedAdvYear}
                      onChange={(e) => setSelectedAdvYear(parseInt(e.target.value))}
                      className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    >
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
              )}
              <div className="mb-8">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2 px-1">
                  <Info className="w-3 h-3" /> Column Header Alignment: Provide data according to format below
                </p>
                <div className="overflow-x-auto bg-slate-50 rounded-2xl border border-slate-200 shadow-inner p-1">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr>
                        {(activeTab === 'Loan' ? ADVANCE_FIELDS : SALARY_ADVANCE_FIELDS).map((field) => (
                          <th key={field.key} className="px-6 py-4 text-left border-r border-slate-200 last:border-0 min-w-[140px]">
                            <div className="flex flex-col gap-1.5">
                              <span className="text-[11px] font-black text-slate-900 uppercase tracking-tight whitespace-nowrap">
                                {field.label}
                              </span>
                              {field.required ? (
                                <span className="text-[8px] font-black text-red-500 uppercase tracking-tighter bg-red-50 px-1.5 py-0.5 rounded w-fit">
                                  Required
                                </span>
                              ) : (
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter bg-slate-100 px-1.5 py-0.5 rounded w-fit">
                                  Optional
                                </span>
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-white">
                        {(activeTab === 'Loan' ? ADVANCE_FIELDS : SALARY_ADVANCE_FIELDS).map((field) => (
                          <td key={field.key} className="px-6 py-5 border-r border-slate-200 last:border-0 bg-slate-50/30">
                            <span className="text-[10px] font-bold text-slate-400 italic">{field.placeholder}</span>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => downloadCsvTemplate(activeTab === 'Loan' ? ADVANCE_FIELDS : SALARY_ADVANCE_FIELDS)}
                  className="py-5 bg-white border-2 border-slate-900 text-slate-900 rounded-2xl font-black shadow-lg flex items-center justify-center gap-3 hover:bg-slate-50 transition-all"
                >
                  <Download className="w-5 h-5" />
                  Download Template
                </button>

                <label className="cursor-pointer group">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    disabled={importing}
                    onChange={(e) => {
                      if (activeTab === 'Loan') {
                        handleImportFile(e.target.files[0]);
                      } else {
                        handleImportSalaryAdvanceFile(e.target.files[0]);
                      }
                      setShowFormatModal(false);
                      e.target.value = '';
                    }}
                  />
                  <div className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black shadow-xl hover:bg-blue-600 transition-all flex items-center justify-center gap-3">
                    <UploadCloud className="w-5 h-5" />
                    {importing ? 'Processing...' : 'Upload CSV Now'}
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Advance;