import React, { useState, useEffect } from 'react';
import { Plus, Edit3, X, Search, CheckCircle, AlertCircle, Trash2, DollarSign } from 'lucide-react';
import {
  fetchSalaryConfigs,
  fetchSalaryConfigsPaginated,
  upsertSalaryConfig,
  deactivateSalaryConfig,
} from '../services/supabaseHR';

const fmt = (n) => `₹${(n || 0).toLocaleString('en-IN')}`;

// ── Config Form Modal ─────────────────────────────────────────────────────────
const ConfigModal = ({ existing, onSave, onClose }) => {
  const [form, setForm] = useState({
    emp_code: existing?.emp_code || '',
    emp_name: existing?.emp_name || '',
    designation: existing?.designation || '',
    department: existing?.department || '',
    company_name: existing?.company_name || 'Default',
    basic_salary: existing?.basic_salary || 0,
    hra: existing?.hra || 0,
    lta: existing?.lta || 0,
    other_allowances: existing?.other_allowances || 0,
    monthly_working_days: existing?.monthly_working_days || 26,
    pf_applicable: existing?.pf_applicable ?? false,
    pf_percent: existing?.pf_percent || 12,
    esic_applicable: existing?.esic_applicable ?? false,
    esic_percent: existing?.esic_percent || 0.75,
    effective_from: existing?.effective_from || new Date().toISOString().slice(0, 10),
    is_active: existing?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const gross = parseFloat(form.basic_salary || 0)
    + parseFloat(form.hra || 0)
    + parseFloat(form.lta || 0)
    + parseFloat(form.other_allowances || 0);

  const pf = form.pf_applicable ? (parseFloat(form.basic_salary || 0) * parseFloat(form.pf_percent || 0) / 100) : 0;
  const esic = form.esic_applicable ? (gross * parseFloat(form.esic_percent || 0) / 100) : 0;
  const net = gross - pf - esic;

  const handleSave = async () => {
    if (!form.emp_code || !form.emp_name) { setError('Employee Code and Name are required'); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        ...form,
        basic_salary: parseFloat(form.basic_salary),
        hra: parseFloat(form.hra),
        lta: parseFloat(form.lta),
        other_allowances: parseFloat(form.other_allowances),
        monthly_working_days: parseInt(form.monthly_working_days),
        pf_percent: parseFloat(form.pf_percent),
        esic_percent: parseFloat(form.esic_percent),
        id: existing?.id,
      });
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
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  );

  const textField = (label, key, placeholder = '') => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type="text"
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-screen overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 text-lg">
            {existing ? 'Edit Salary Config' : 'Add Salary Config'}
          </h3>
          <button onClick={onClose}><X size={20} className="text-gray-500" /></button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg">{error}</div>
          )}

          {/* Employee Info */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Employee Details</p>
            <div className="grid grid-cols-2 gap-3">
              {textField('Employee Code *', 'emp_code', 'e.g. 211465329820')}
              {textField('Employee Name *', 'emp_name', 'Full name')}
              {textField('Designation', 'designation', 'e.g. Executive')}
              {textField('Department', 'department', 'e.g. Operations')}
              {textField('Company Name', 'company_name', 'Default')}
              {numField('Working Days / Month', 'monthly_working_days', 1, 20)}
            </div>
          </div>

          {/* Salary Structure */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Salary Structure (Monthly)</p>
            <div className="grid grid-cols-2 gap-3">
              {numField('Basic Salary (₹)', 'basic_salary', 100, 0)}
              {numField('HRA (₹)', 'hra', 100, 0)}
              {numField('LTA (₹)', 'lta', 100, 0)}
              {numField('Other Allowances (₹)', 'other_allowances', 100, 0)}
            </div>
          </div>

          {/* Deductions */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Deductions</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="pf"
                  checked={form.pf_applicable}
                  onChange={(e) => set('pf_applicable', e.target.checked)}
                  className="mt-1 rounded"
                />
                <div className="flex-1">
                  <label htmlFor="pf" className="text-sm font-medium text-gray-800 cursor-pointer">PF Applicable</label>
                  {form.pf_applicable && (
                    <div className="mt-2">
                      <label className="text-xs text-gray-500">PF Percent (%)</label>
                      <input
                        type="number"
                        value={form.pf_percent}
                        onChange={(e) => set('pf_percent', e.target.value)}
                        step="0.1"
                        min="0"
                        className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="esic"
                  checked={form.esic_applicable}
                  onChange={(e) => set('esic_applicable', e.target.checked)}
                  className="mt-1 rounded"
                />
                <div className="flex-1">
                  <label htmlFor="esic" className="text-sm font-medium text-gray-800 cursor-pointer">ESIC Applicable</label>
                  {form.esic_applicable && (
                    <div className="mt-2">
                      <label className="text-xs text-gray-500">ESIC Percent (%)</label>
                      <input
                        type="number"
                        value={form.esic_percent}
                        onChange={(e) => set('esic_percent', e.target.value)}
                        step="0.01"
                        min="0"
                        className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Effective Date */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Effective From</label>
            <input
              type="date"
              value={form.effective_from}
              onChange={(e) => set('effective_from', e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Preview */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-indigo-700 uppercase mb-3">Salary Preview (Full Month)</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: 'Gross', value: fmt(gross), color: 'text-green-700' },
                { label: 'Deductions', value: fmt(pf + esic), color: 'text-red-600' },
                { label: 'Net', value: fmt(net), color: 'text-indigo-700 font-bold' },
              ].map(item => (
                <div key={item.label} className="bg-white rounded-lg p-3">
                  <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                  <p className="text-xs text-gray-500">{item.label}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-indigo-600 mt-2 text-center">
              Per day rate: {fmt(parseFloat(form.basic_salary || 0) / parseInt(form.monthly_working_days || 26))}
            </p>
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm text-gray-700 hover:bg-gray-50 font-medium">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : existing ? 'Update Config' : 'Add Config'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const SalaryConfig = () => {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [modalData, setModalData] = useState(null); // null=closed | {}=add | {..}=edit
  const [notification, setNotification] = useState(null);

  const notify = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Pagination states
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSalaryConfigsPaginated({ search, page, pageSize });
      setConfigs(res.data || []);
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
        const res = await fetchSalaryConfigsPaginated({ search, page, pageSize });
        if (isMounted) {
          setConfigs(res.data || []);
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
  }, [search, page]);

  const handleSave = async (config) => {
    await upsertSalaryConfig(config);
    notify(config.id ? '✓ Config updated' : '✓ Config added');
    await load();
  };

  const handleDeactivate = async (id, name) => {
    if (!confirm(`Deactivate salary config for ${name}?`)) return;
    try {
      await deactivateSalaryConfig(id);
      notify(`✓ Config deactivated for ${name}`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const filtered = configs;

  return (
    <div className="space-y-5 ml-0 lg:ml-64 p-4 md:p-6">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white
          ${notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {notification.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Salary Configuration</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configure employee salary structures for payroll calculation</p>
        </div>
        <button
          onClick={() => setModalData({})}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 shadow-md"
        >
          <Plus size={16} /> Add Employee Config
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
          <AlertCircle size={16} />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="relative max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, code or designation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 text-gray-400">
          <DollarSign size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No salary configs found</p>
          <p className="text-sm mt-1">Click "Add Employee Config" to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(cfg => {
            const gross = (cfg.basic_salary || 0) + (cfg.hra || 0) + (cfg.lta || 0) + (cfg.other_allowances || 0);
            const pf = cfg.pf_applicable ? (cfg.basic_salary * cfg.pf_percent / 100) : 0;
            const esic = cfg.esic_applicable ? (gross * cfg.esic_percent / 100) : 0;
            const net = gross - pf - esic;

            return (
              <div key={cfg.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                {/* Card Header */}
                <div className="bg-indigo-900 text-white px-4 py-3 flex justify-between items-start">
                  <div>
                    <p className="font-bold text-base">{cfg.emp_name}</p>
                    <p className="text-indigo-300 text-xs font-mono">{cfg.emp_code}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setModalData(cfg)}
                      className="p-1.5 rounded-lg hover:bg-indigo-800 text-indigo-300 hover:text-white"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeactivate(cfg.id, cfg.emp_name)}
                      className="p-1.5 rounded-lg hover:bg-red-800 text-indigo-300 hover:text-red-300"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3">
                  <div className="flex gap-2 flex-wrap">
                    {cfg.designation && (
                      <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{cfg.designation}</span>
                    )}
                    {cfg.department && (
                      <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{cfg.department}</span>
                    )}
                    <span className="bg-indigo-50 text-indigo-600 text-xs px-2 py-0.5 rounded-full">
                      {cfg.monthly_working_days} working days
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-xs text-gray-400">Basic</p>
                      <p className="font-semibold text-gray-800">{fmt(cfg.basic_salary)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-xs text-gray-400">HRA</p>
                      <p className="font-semibold text-gray-800">{fmt(cfg.hra)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-xs text-gray-400">LTA</p>
                      <p className="font-semibold text-gray-800">{fmt(cfg.lta)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-xs text-gray-400">Others</p>
                      <p className="font-semibold text-gray-800">{fmt(cfg.other_allowances)}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 text-xs">
                    {cfg.pf_applicable && (
                      <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                        PF {cfg.pf_percent}%
                      </span>
                    )}
                    {cfg.esic_applicable && (
                      <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                        ESIC {cfg.esic_percent}%
                      </span>
                    )}
                  </div>

                  <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                    <div>
                      <p className="text-xs text-gray-400">Net Salary</p>
                      <p className="text-xl font-black text-indigo-700">{fmt(net)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Gross</p>
                      <p className="text-sm font-semibold text-gray-700">{fmt(gross)}</p>
                      <p className="text-xs text-red-500">-{fmt(pf + esic)} ded.</p>
                    </div>
                  </div>

                  <p className="text-xs text-gray-400">
                    Effective from: {new Date(cfg.effective_from).toLocaleDateString('en-IN')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border border-gray-100 bg-white gap-3 rounded-2xl shadow-sm">
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

      {/* Modal */}
      {modalData !== null && (
        <ConfigModal
          existing={Object.keys(modalData).length ? modalData : null}
          onSave={handleSave}
          onClose={() => setModalData(null)}
        />
      )}
    </div>
  );
};

export default SalaryConfig;
