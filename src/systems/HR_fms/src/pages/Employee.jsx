import { X, FileSpreadsheet, Upload, Plus, Search, CheckCircle, Clock, AlertCircle, User, Edit3, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
;
import * as XLSX from 'xlsx';
import { fetchEmployeesPaginated, upsertEmployee, bulkUpsertEmployees, deleteEmployee } from '../services/supabaseHR';
import supabase from '../services/supabaseHRClient';
import toast from 'react-hot-toast';

const fmt = (n) => `₹${(n || 0).toLocaleString('en-IN')}`;

// ── Employee Form Modal ───────────────────────────────────────────────────────
const EmployeeModal = ({ existing, onSave, onClose }) => {
  const [form, setForm] = useState({
    employee_id: existing?.employee_id || '',
    name: existing?.name || '',
    date_of_joining: existing?.date_of_joining || new Date().toISOString().slice(0, 10),
    mobile_number: existing?.mobile_number || '',
    father_name: existing?.father_name || '',
    work_location: existing?.work_location || '',
    designation: existing?.designation || '',
    salary: existing?.salary || 0,
    status: existing?.status || 'active',
    puttha_status: existing?.puttha_status || 'Yes',
    date_of_leaving: existing?.date_of_leaving || '',
    reason_of_leaving: existing?.reason_of_leaving || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.employee_id || !form.name || !form.date_of_joining) {
      setError('Employee ID, Name, and Date of Joining are required');
      return;
    }
    setSaving(true);
    setError(null);

    // Clean up optional fields for PostgreSQL DATE compatibility (convert "" to null)
    const cleanedForm = {
      ...form,
      salary: typeof form.salary === 'number' ? form.salary : (parseFloat(String(form.salary || '').replace(/[^\d\.]/g, '')) || 0),
      puttha_status: form.puttha_status || 'Yes',
      date_of_leaving: form.status === 'left' && form.date_of_leaving ? form.date_of_leaving : null,
      reason_of_leaving: form.status === 'left' && form.reason_of_leaving ? form.reason_of_leaving : null,
      id: existing?.id, // include database UUID if editing
    };

    try {
      await onSave(cleanedForm);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const numField = (label, key, step = 1, min = 0) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type="number"
        step={step}
        min={min}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900"
      />
    </div>
  );

  const textField = (label, key, placeholder = '', required = false) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label} {required && '*'}
      </label>
      <input
        type="text"
        required={required}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-screen overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 text-lg">
            {existing ? 'Edit Employee Details' : 'Add New Employee'}
          </h3>
          <button onClick={onClose}><X size={20} className="text-gray-500" /></button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {textField('Employee ID', 'employee_id', 'e.g. EMP1001', true)}
            {textField('Full Name', 'name', 'Enter name', true)}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date of Joining *</label>
              <input
                type="date"
                required
                value={form.date_of_joining}
                onChange={(e) => set('date_of_joining', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900"
              />
            </div>

            {textField('Mobile Number', 'mobile_number', 'e.g. 9876543210')}
            {textField('Father Name', 'father_name', 'Enter father name')}
            {textField('Work Location', 'work_location', 'e.g. Factory')}
            {textField('Designation', 'designation', 'e.g. Executive')}
            {numField('Salary (Monthly Basic) (₹)', 'salary', 100, 0)}
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Employment Status</label>
                <select
                  value={form.status}
                  onChange={(e) => set('status', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900"
                >
                  <option value="active">Active</option>
                  <option value="left">Left Company</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Puttha Status</label>
                <select
                  value={form.puttha_status}
                  onChange={(e) => set('puttha_status', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900"
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
            </div>

            {form.status === 'left' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-fadeIn">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date of Leaving</label>
                  <input
                    type="date"
                    required
                    value={form.date_of_leaving}
                    onChange={(e) => set('date_of_leaving', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Reason for Leaving</label>
                  <input
                    type="text"
                    required
                    value={form.reason_of_leaving}
                    onChange={(e) => set('reason_of_leaving', e.target.value)}
                    placeholder="e.g. Resigned"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-3">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm text-gray-700 hover:bg-gray-50 font-medium">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : existing ? 'Update Details' : 'Add Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Bulk Import Modal ─────────────────────────────────────────────────────────
const REQUIRED_COLUMNS = ['employee_id', 'name', 'date_of_joining'];
const COLUMN_ALIASES = {
  employee_id: ['employee_id', 'employee id', 'emp_code', 'emp code', 'emp id', 'id'],
  name: ['name', 'full name', 'employee name'],
  date_of_joining: ['date_of_joining', 'date of joining', 'joining date', 'doj'],
  mobile_number: ['mobile_number', 'mobile number', 'mobile', 'phone', 'contact number'],
  father_name: ['father_name', "father's name", 'father name'],
  work_location: ['work_location', 'work location', 'location'],
  designation: ['designation', 'role', 'position'],
  salary: ['salary', 'monthly salary', 'basic salary'],
  status: ['status', 'employment status'],
  date_of_leaving: ['date_of_leaving', 'date of leaving', 'leaving date', 'dol'],
  reason_of_leaving: ['reason_of_leaving', 'reason of leaving', 'reason'],
};

const normalizeKey = (k) => String(k || '').trim().toLowerCase();

const excelSerialToDate = (value) => {
  if (typeof value === 'number') {
    const d = XLSX.SSF.parse_date_code(value);
    if (!d) return '';
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  
  const str = String(value || '').trim();
  if (!str) return '';

  const parts = str.split(/[\/\-]/);
  if (parts.length === 3) {
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10) - 1;
    let year = parseInt(parts[2], 10);

    if (year < 100) year += 2000;

    if (month > 11) {
      const temp = day;
      day = month + 1;
      month = temp - 1;
    }

    const testDate = new Date(year, month, day);
    if (!isNaN(testDate.getTime())) {
      return `${testDate.getFullYear()}-${String(testDate.getMonth() + 1).padStart(2, '0')}-${String(testDate.getDate()).padStart(2, '0')}`;
    }
  }

  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return str;
};

const BulkImportModal = ({ onImport, onClose }) => {
  const fileInputRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [rowErrors, setRowErrors] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parseError, setParseError] = useState(null);

  const handleFile = async (file) => {
    if (!file) return;
    setParsing(true);
    setParseError(null);
    setRows([]);
    setRowErrors([]);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (json.length === 0) {
        setParseError('No data rows found in the file.');
        setParsing(false);
        return;
      }

      // Build a mapping from each expected field to the actual column name present in the file
      const sourceKeys = Object.keys(json[0]);
      const keyMap = {}; // expectedField -> actualColumnKey
      Object.entries(COLUMN_ALIASES).forEach(([field, aliases]) => {
        const match = sourceKeys.find(k => aliases.includes(normalizeKey(k)));
        if (match) keyMap[field] = match;
      });

      const missingRequired = REQUIRED_COLUMNS.filter(f => !keyMap[f]);
      if (missingRequired.length > 0) {
        setParseError(`Missing required column(s): ${missingRequired.join(', ')}. Please check the file headers.`);
        setParsing(false);
        return;
      }

      const parsedRows = [];
      const errors = [];
      json.forEach((row, idx) => {
        const get = (field) => keyMap[field] ? row[keyMap[field]] : '';
        const employee_id = String(get('employee_id') || '').trim();
        const name = String(get('name') || '').trim();
        const rawDoj = get('date_of_joining');
        const date_of_joining = rawDoj ? excelSerialToDate(rawDoj) : '';

        const lineNo = idx + 2; // +1 for header row, +1 for 1-based index
        if (!employee_id || !name || !date_of_joining) {
          errors.push(`Row ${lineNo}: missing required value (Employee ID, Name, or Date of Joining)`);
          return;
        }

        const statusRaw = String(get('status') || 'active').trim().toLowerCase();
        const status = statusRaw === 'left' ? 'left' : 'active';
        const rawDol = get('date_of_leaving');

        parsedRows.push({
          employee_id,
          name,
          date_of_joining,
          mobile_number: String(get('mobile_number') || '').trim(),
          father_name: String(get('father_name') || '').trim(),
          work_location: String(get('work_location') || '').trim(),
          designation: String(get('designation') || '').trim(),
          salary: typeof get('salary') === 'number' ? get('salary') : (parseFloat(String(get('salary') || '').replace(/[^\d\.]/g, '')) || 0),
          status,
          date_of_leaving: status === 'left' && rawDol ? excelSerialToDate(rawDol) : null,
          reason_of_leaving: status === 'left' ? String(get('reason_of_leaving') || '').trim() || null : null,
        });
      });

      setRows(parsedRows);
      setRowErrors(errors);
    } catch (err) {
      setParseError(`Could not read file: ${err.message}`);
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    try {
      await onImport(rows);
      onClose();
    } catch (err) {
      setParseError(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-screen overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 text-lg">Bulk Import Employees</h3>
          <button onClick={onClose}><X size={20} className="text-gray-500" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Instructions */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-900">
            <p className="font-semibold mb-1">File requirements</p>
            <p className="mb-2">Upload an Excel (.xlsx, .xls) or CSV file with one employee per row. The first row must be a header row.</p>
            <p className="mb-1"><span className="font-semibold">Required columns:</span> Employee ID, Name, Date of Joining (e.g. 2026-01-31).</p>
            <p><span className="font-semibold">Optional columns:</span> Mobile Number, Father Name, Work Location, Designation, Salary, Status (active/left), Date of Leaving, Reason of Leaving.</p>
            <p className="mt-2 text-xs text-indigo-700">Column names are matched flexibly (e.g. "Emp Code", "Employee ID" are both accepted). Existing employees with the same Employee ID will be updated; new Employee IDs will be added.</p>
          </div>

          {/* File picker */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl py-8 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
            >
              <FileSpreadsheet size={28} />
              <span className="text-sm font-medium">{fileName || 'Click to choose a file'}</span>
              <span className="text-xs text-gray-400">.xlsx, .xls or .csv</span>
            </button>
          </div>

          {parsing && (
            <div className="text-sm text-gray-500 text-center py-2">Parsing file...</div>
          )}

          {parseError && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg">{parseError}</div>
          )}

          {rowErrors.length > 0 && (
            <div className="bg-amber-50 text-amber-800 text-sm px-4 py-3 rounded-lg max-h-32 overflow-y-auto">
              <p className="font-semibold mb-1">{rowErrors.length} row(s) skipped:</p>
              <ul className="list-disc list-inside space-y-0.5">
                {rowErrors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                {rowErrors.length > 10 && <li>...and {rowErrors.length - 10} more</li>}
              </ul>
            </div>
          )}

          {rows.length > 0 && (
            <div className="bg-green-50 text-green-800 text-sm px-4 py-2 rounded-lg">
              {rows.length} employee record(s) ready to import.
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm text-gray-700 hover:bg-gray-50 font-medium">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={rows.length === 0 || importing}
              className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              {importing ? 'Importing...' : `Import ${rows.length || ''} Employee(s)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── MAIN EMPLOYEE COMPONENT ──────────────────────────────────────────────────
const Employee = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('joining'); // 'joining' is Active, 'leaving' is Left
  const [modalData, setModalData] = useState(null); // null = closed, {} = add, {...} = edit
  const [showBulkImport, setShowBulkImport] = useState(false);

  // Pagination & Count states
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [activeCount, setActiveCount] = useState(0);
  const [leftCount, setLeftCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const fetchAsync = async () => {
      setLoading(true);
      setError(null);
      try {
        const currentStatus = activeTab === 'joining' ? 'active' : 'left';
        const otherStatus = activeTab === 'joining' ? 'left' : 'active';

        const [res, otherCountRes] = await Promise.all([
          fetchEmployeesPaginated({
            page,
            pageSize,
            search: searchTerm,
            status: currentStatus
          }),
          supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', otherStatus)
        ]);

        if (isMounted) {
          setEmployees(res.data || []);
          setTotalRecords(res.totalRecords || 0);
          setTotalPages(res.totalPages || 1);

          if (activeTab === 'joining') {
            setActiveCount(res.totalRecords || 0);
            setLeftCount(otherCountRes.count || 0);
          } else {
            setLeftCount(res.totalRecords || 0);
            setActiveCount(otherCountRes.count || 0);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          toast.error(`Failed to load employee data: ${err.message}`);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchAsync();

    return () => {
      isMounted = false;
    };
  }, [page, searchTerm, activeTab]);

  const loadData = async () => {
    setPage(1);
    setLoading(true);
    setError(null);
    try {
      const currentStatus = activeTab === 'joining' ? 'active' : 'left';
      const otherStatus = activeTab === 'joining' ? 'left' : 'active';

      const [res, otherCountRes] = await Promise.all([
        fetchEmployeesPaginated({
          page: 1,
          pageSize,
          search: searchTerm,
          status: currentStatus
        }),
        supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', otherStatus)
      ]);

      setEmployees(res.data || []);
      setTotalRecords(res.totalRecords || 0);
      setTotalPages(res.totalPages || 1);

      if (activeTab === 'joining') {
        setActiveCount(res.totalRecords || 0);
        setLeftCount(otherCountRes.count || 0);
      } else {
        setLeftCount(res.totalRecords || 0);
        setActiveCount(otherCountRes.count || 0);
      }
    } catch (err) {
      setError(err.message);
      toast.error(`Failed to load employee data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (employee) => {
    try {
      await upsertEmployee(employee);
      toast.success(employee.id ? 'Employee details updated successfully' : 'New employee added successfully');
      loadData();
    } catch (err) {
      toast.error(`Failed to save employee: ${err.message}`);
      throw err;
    }
  };

  const handleBulkImport = async (rows) => {
    try {
      await bulkUpsertEmployees(rows);
      toast.success(`${rows.length} employee record(s) imported successfully`);
      loadData();
    } catch (err) {
      toast.error(`Bulk import failed: ${err.message}`);
      throw err;
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to delete employee ${name}?`)) return;
    try {
      await deleteEmployee(id);
      toast.success(`Employee ${name} deleted successfully`);
      loadData();
    } catch (err) {
      toast.error(`Failed to delete employee: ${err.message}`);
    }
  };

  // Safe tab array access for compatibility
  const _activeEmployees = activeTab === 'joining' ? employees : [];
  const _leftEmployees = activeTab === 'leaving' ? employees : [];

  // Data is filtered and paginated on server side
  const filteredData = employees;

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-IN');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employee Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage and track employee details, joining, and leaving records</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBulkImport(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 shadow-sm transition-colors"
          >
            <Upload size={16} /> Bulk Import
          </button>
          <button
            onClick={() => setModalData({})}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 shadow-md transition-colors"
          >
            <Plus size={16} /> Add Employee
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl shadow border border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-4">
        <div className="flex flex-1 max-w-md">
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Search by name, employee ID, designation, location..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white text-gray-900 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-100">
        <div className="border-b border-gray-200 bg-gray-50">
          <nav className="flex -mb-px">
            <button
              className={`py-4 px-6 font-semibold text-sm border-b-2 flex items-center transition-colors ${activeTab === 'joining'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              onClick={() => setActiveTab('joining')}
            >
              <CheckCircle size={16} className="mr-2" />
              Active ({activeCount})
            </button>
            <button
              className={`py-4 px-6 font-semibold text-sm border-b-2 flex items-center transition-colors ${activeTab === 'leaving'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              onClick={() => setActiveTab('leaving')}
            >
              <Clock size={16} className="mr-2" />
              Left Company ({leftCount})
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertCircle size={36} className="mx-auto text-red-500 mb-2" />
              <p className="text-red-500 font-medium">Error loading employee data: {error}</p>
              <button
                onClick={loadData}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700"
              >
                Retry
              </button>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <User size={48} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No employees found</p>
              <p className="text-sm mt-1">Click "Add Employee" to create a new employee record</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee ID</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date Of Joining</th>
                    {activeTab === 'leaving' && (
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date Of Leaving</th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Mobile Number</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Father Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Work Location</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Designation</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Salary</th>
                    {activeTab === 'leaving' && (
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason Of Leaving</th>
                    )}
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100 text-gray-700">
                  {filteredData.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">{item.employee_id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{item.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{formatDate(item.date_of_joining)}</td>
                      {activeTab === 'leaving' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{formatDate(item.date_of_leaving)}</td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{item.mobile_number || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{item.father_name || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{item.work_location || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{item.designation || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">{fmt(item.salary)}</td>
                      {activeTab === 'leaving' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.reason_of_leaving || '-'}</td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-medium">
                        <div className="flex items-center gap-2 justify-center">
                          <button
                            onClick={() => setModalData(item)}
                            title="Edit Employee"
                            className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition-colors"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id, item.name)}
                            title="Delete Employee"
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

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

      {/* Modal */}
      {modalData !== null && (
        <EmployeeModal
          existing={Object.keys(modalData).length ? modalData : null}
          onSave={handleSave}
          onClose={() => setModalData(null)}
        />
      )}

      {/* Bulk Import Modal */}
      {showBulkImport && (
        <BulkImportModal
          onImport={handleBulkImport}
          onClose={() => setShowBulkImport(false)}
        />
      )}
    </div>
  );
};

export default Employee;