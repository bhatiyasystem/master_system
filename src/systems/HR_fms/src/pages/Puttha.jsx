import React, { useRef, useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Plus, Check, X, Clock, FileText, Package, Trash2, RefreshCw, UploadCloud, Table, Info, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import supabase from '../../../../SupabaseClient';
import {
  fetchPutthas,
  upsertPuttha,
  updatePutthaStatus,
  deletePuttha,
  fetchEmployees,
} from '../services/supabaseHR';

const Puttha = () => {
  const [putthas, setPutthas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newPuttha, setNewPuttha] = useState({
    date: new Date().toISOString().split('T')[0],
    remark: '',
    cashInHand: '',
  });
  const [employeesList, setEmployeesList] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [importing, setImporting] = useState(false);
  const [showFormatModal, setShowFormatModal] = useState(false);
  const fileInputRef = useRef(null);

  const PUTTHA_FIELDS = [
    { key: 'date', label: 'Date', required: false, placeholder: 'e.g. 5/9/2026' },
    { key: 'remark', label: 'Remark', required: true, placeholder: 'e.g. RADDI / PUTTHA / KABADI' },
    { key: 'cashInHand', label: 'Cash in Hand', required: true, placeholder: 'e.g. 5078' },
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

  const downloadCsvTemplate = () => {
    const headers = PUTTHA_FIELDS.map((f) => f.label).join(',');
    const example = PUTTHA_FIELDS.map((f) => f.placeholder.replace('e.g. ', '')).join(',');
    const csv = `${headers}\n${example}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'puttha_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Get user from local storage
  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : null;
  const isAdmin = user?.Admin === 'Yes';
  const currentEmpId = user?.employeeId || '';
  const currentEmpName = user?.Name || user?.Username || 'Employee';

  // ── Load Data ─────────────────────────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    try {
      const [putthaData, empData] = await Promise.all([
        fetchPutthas(isAdmin ? {} : { empCode: currentEmpId }),
        isAdmin ? fetchEmployees() : Promise.resolve([]),
      ]);
      setPutthas(putthaData || []);
      if (isAdmin) setEmployeesList(empData || []);
    } catch (err) {
      toast.error(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ── Submit new puttha ─────────────────────────────────────────────────────────
const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newPuttha.date || !newPuttha.remark || !newPuttha.cashInHand) {
      toast.error('Please fill in all fields');
      return;
    }

    let empId = currentEmpId;
    let empName = currentEmpName;

    if (isAdmin) {
      empId = 'COMPANY';
      empName = 'Company Puttha';
    }

    const totalPrice = parseFloat(newPuttha.cashInHand) || 0;

    try {
      await upsertPuttha({
        employee_id: empId,
        employee_name: empName,
        date: newPuttha.date,
        remark: newPuttha.remark,
        total_price: totalPrice,
        status: isAdmin ? 'Approved' : 'Pending',
      });

      toast.success('Puttha entry submitted successfully');
      setNewPuttha({ date: new Date().toISOString().split('T')[0], remark: '', cashInHand: '' });
      setShowModal(false);
      loadData();
    } catch (err) {
      toast.error(`Failed to save: ${err.message}`);
    }
  };

  // ── Import from Excel ─────────────────────────────────────────────────────
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
          date: colIndex(['date']),
          remark: colIndex(['remark']),
          cashInHand: colIndex(['cash in hand', 'cash_in_hand', 'cash']),
        };

        const rows = raw
          .slice(1)
          .filter((r) => r.some((c) => String(c).trim() !== ''))
          .map((r) => {
            const cashInHand = idx.cashInHand >= 0 ? parseFloat(r[idx.cashInHand]) || 0 : 0;
            return {
              employee_id: 'COMPANY',
              employee_name: 'Company Puttha',
              date: idx.date >= 0 && r[idx.date] ? toISODate(r[idx.date]) : new Date().toISOString().split('T')[0],
              remark: idx.remark >= 0 ? String(r[idx.remark] || '').trim() : '',
              total_price: cashInHand,
              status: 'Approved',
            };
          })
          .filter((row) => row.total_price > 0);

        if (rows.length === 0) throw new Error('No valid rows found — check the header row matches the expected columns.');

        const { error } = await supabase.from('putthas').insert(rows);
        if (error) throw error;

        toast.success(`Imported ${rows.length} puttha entr${rows.length === 1 ? 'y' : 'ies'} successfully.`);
        loadData();
      } catch (err) {
        toast.error(`Import failed: ${err.message}`);
      } finally {
        setImporting(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ── Status actions ─────────────────────────────────────────────────────────
  const handleStatusUpdate = async (id, newStatus) => {
    try {
      await updatePutthaStatus(id, newStatus);
      toast.success(`Puttha ${newStatus.toLowerCase()}`);
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this puttha entry?')) return;
    try {
      await deletePuttha(id);
      toast.success('Entry deleted');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package size={24} className="text-indigo-600" /> Puttha Management
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isAdmin
              ? 'Manage and approve puttha entries. The monthly total is split equally among employees with ≥15 present days.'
              : 'Submit and track your puttha entries'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm hover:bg-gray-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => setShowFormatModal(true)}
                disabled={importing}
                className={`flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl font-semibold text-sm hover:bg-gray-800 shadow-md ${importing ? 'cursor-wait opacity-60' : ''}`}
              >
                <UploadCloud size={16} />
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
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 shadow-md"
          >
            <Plus size={16} /> Add Puttha
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : putthas.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <FileText size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No puttha entries found</p>
            <p className="text-sm mt-1">Click "Add Puttha" to create an entry</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-indigo-900 text-white">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Remark</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Cash in Hand</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase">Status</th>
                  {isAdmin && <th className="px-4 py-3 text-center text-xs font-semibold uppercase">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {putthas.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-600">{p.date}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{p.remark || '—'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                      ₹{parseFloat(p.total_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${p.status === 'Approved' ? 'bg-green-100 text-green-800' :
                          p.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                        }`}>
                        {p.status === 'Approved' && <Check size={11} />}
                        {p.status === 'Rejected' && <X size={11} />}
                        {p.status === 'Pending' && <Clock size={11} />}
                        {p.status}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-center">
                          {p.status === 'Pending' && (
                            <>
                              <button
                                onClick={() => handleStatusUpdate(p.id, 'Approved')}
                                className="p-1.5 rounded-lg hover:bg-green-50 text-green-600"
                                title="Approve"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={() => handleStatusUpdate(p.id, 'Rejected')}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"
                                title="Reject"
                              >
                                <X size={14} />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              {/* Monthly total footer for admin */}
              {isAdmin && putthas.length > 0 && (
                <tfoot>
                  <tr className="bg-indigo-50 border-t-2 border-indigo-200">
                    <td colSpan={2} className="px-4 py-3 text-sm font-bold text-indigo-800">
                      Approved Total (shown month)
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-black text-indigo-900">
                      ₹{putthas
                        .filter(p => p.status === 'Approved')
                        .reduce((s, p) => s + (parseFloat(p.total_price) || 0), 0)
                        .toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* Add Puttha Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">Add Puttha Entry</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

           <form onSubmit={handleSubmit} className="p-6 space-y-4">

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={newPuttha.date}
                  onChange={(e) => setNewPuttha({ ...newPuttha, date: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

             <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Remark *</label>
                <input
                  type="text"
                  required
                  value={newPuttha.remark}
                  onChange={(e) => setNewPuttha({ ...newPuttha, remark: e.target.value })}
                  placeholder="e.g. RADDI / PUTTHA / KABADI"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cash in Hand (₹) *</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={newPuttha.cashInHand}
                  onChange={(e) => setNewPuttha({ ...newPuttha, cashInHand: e.target.value })}
                  placeholder="0.00"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-indigo-700"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showFormatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowFormatModal(false)} />
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-8 text-white relative">
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
                  <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest">Required CSV Structure</p>
                </div>
              </div>
            </div>

            <div className="p-8">
              <div className="mb-8">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2 px-1">
                  <Info className="w-3 h-3" /> Column Header Alignment: Provide data according to format below
                </p>
                <div className="overflow-x-auto bg-slate-50 rounded-2xl border border-slate-200 shadow-inner p-1">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr>
                        {PUTTHA_FIELDS.map((field) => (
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
                        {PUTTHA_FIELDS.map((field) => (
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
                  onClick={downloadCsvTemplate}
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
                      handleImportFile(e.target.files[0]);
                      setShowFormatModal(false);
                      e.target.value = '';
                    }}
                  />
                  <div className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black shadow-xl hover:bg-indigo-600 transition-all flex items-center justify-center gap-3">
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

export default Puttha;