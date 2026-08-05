import React, { useEffect, useState, useCallback } from 'react';
import {
  Users, Plus, Pencil, Trash2, Save, X, Settings2, Phone,
  Calendar, RefreshCw, CheckCircle2, AlertCircle, ChevronUp, ChevronDown,
} from 'lucide-react';
import {
  fetchEmployeeBirthdays,
  addEmployeeBirthday,
  updateEmployeeBirthday,
  deleteEmployeeBirthday,
  getGreetingsConfig,
  upsertGreetingsConfig,
  sendBirthdayGreeting,
} from '../services/greetingsService';

const EMPTY_FORM = {
  employee_name: '',
  phone_number: '',
  date_of_birth: '',
  is_active: true,
  notes: '',
};

const monthDay = (dob) => {
  if (!dob) return '—';
  const d = new Date(dob);
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', timeZone: 'UTC' });
};

export default function BirthdaySetup() {
  const [employees, setEmployees] = useState([]);
  const [config, setConfig] = useState({ birthday_template_name: 'birthday_wishes', birthday_template_language: 'en' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');

  const [configOpen, setConfigOpen] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testName, setTestName] = useState('');
  const [testSending, setTestSending] = useState(false);

  const [sortField, setSortField] = useState('employee_name');
  const [sortDir, setSortDir] = useState('asc');
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [emps, cfg] = await Promise.all([fetchEmployeeBirthdays(), getGreetingsConfig()]);
      setEmployees(emps);
      setConfig((prev) => ({ ...prev, ...cfg }));
    } catch (err) {
      showToast(err.message || 'Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (emp) => {
    setForm({
      employee_name: emp.employee_name,
      phone_number: emp.phone_number,
      date_of_birth: emp.date_of_birth,
      is_active: emp.is_active,
      notes: emp.notes || '',
    });
    setEditId(emp.id);
    setFormError('');
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditId(null); setFormError(''); };

  const handleSave = async () => {
    if (!form.employee_name.trim()) return setFormError('Employee name is required.');
    if (!form.phone_number.trim()) return setFormError('Phone number is required.');
    if (!form.date_of_birth) return setFormError('Date of birth is required.');
    setSaving(true);
    try {
      if (editId) {
        const updated = await updateEmployeeBirthday(editId, form);
        setEmployees((prev) => prev.map((e) => (e.id === editId ? updated : e)));
        showToast('Employee updated successfully.');
      } else {
        const added = await addEmployeeBirthday(form);
        setEmployees((prev) => [...prev, added]);
        showToast('Employee added successfully.');
      }
      closeForm();
    } catch (err) {
      setFormError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteEmployeeBirthday(id);
      setEmployees((prev) => prev.filter((e) => e.id !== id));
      showToast('Employee removed.');
    } catch (err) {
      showToast(err.message || 'Delete failed.', 'error');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      await Promise.all([
        upsertGreetingsConfig('birthday_template_name', config.birthday_template_name),
        upsertGreetingsConfig('birthday_template_language', config.birthday_template_language),
      ]);
      showToast('Configuration saved.');
    } catch (err) {
      showToast(err.message || 'Config save failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async () => {
    if (!testPhone.trim() || !testName.trim()) {
      showToast('Enter a name and phone number to test.', 'error');
      return;
    }
    setTestSending(true);
    try {
      const fakeEmp = {
        id: 'test',
        employee_name: testName,
        phone_number: testPhone,
        date_of_birth: new Date().toISOString().split('T')[0],
        is_active: true,
      };
      const result = await sendBirthdayGreeting(fakeEmp, config);
      if (result.success || result.skipped) showToast('Test message sent!');
      else showToast(result.error || 'Send failed.', 'error');
    } catch (err) {
      showToast(err.message || 'Test failed.', 'error');
    } finally {
      setTestSending(false);
    }
  };

  const toggleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronUp className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-blue-500" />
      : <ChevronDown className="w-3 h-3 text-blue-500" />;
  };

  const filtered = employees
    .filter((e) =>
      e.employee_name.toLowerCase().includes(search.toLowerCase()) ||
      e.phone_number.includes(search)
    )
    .sort((a, b) => {
      const va = String(a[sortField] || '').toLowerCase();
      const vb = String(b[sortField] || '').toLowerCase();
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });

  const today = new Date();
  const upcomingIds = new Set(
    employees
      .filter((e) => {
        const dob = new Date(e.date_of_birth);
        const bday = new Date(today.getFullYear(), dob.getUTCMonth(), dob.getUTCDate());
        if (bday < today) bday.setFullYear(today.getFullYear() + 1);
        const diff = (bday - today) / 86400000;
        return diff >= 0 && diff <= 7;
      })
      .map((e) => e.id)
  );

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all
          ${toast.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
          {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Birthday Setup</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage employee birthdays and WhatsApp template configuration.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={openAdd} className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium">
            <Plus className="w-4 h-4" /> Add Employee
          </button>
        </div>
      </div>

      {/* Template Config Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <button
          onClick={() => setConfigOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-left"
        >
          <div className="flex items-center gap-2 font-semibold text-gray-800">
            <Settings2 className="w-5 h-5 text-purple-500" />
            WhatsApp Template Configuration
          </div>
          {configOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {configOpen && (
          <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Template Name</label>
                <input
                  type="text"
                  value={config.birthday_template_name}
                  onChange={(e) => setConfig((c) => ({ ...c, birthday_template_name: e.target.value }))}
                  placeholder="e.g. birthday_wishes"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Approved template: <span className="font-mono text-gray-500">birthday_wishes</span> — sends
                  <em> "🎉 Happy Birthday, {`{name}`}! 🎂 Wishing you a day filled with happiness…"</em>
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Language Code</label>
                <input
                  type="text"
                  value={config.birthday_template_language}
                  onChange={(e) => setConfig((c) => ({ ...c, birthday_template_language: e.target.value }))}
                  placeholder="e.g. en"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveConfig}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-60 font-medium"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving…' : 'Save Config'}
              </button>
            </div>

            {/* Test Send */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">Test Send</p>
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Name</label>
                  <input
                    type="text"
                    value={testName}
                    onChange={(e) => setTestName(e.target.value)}
                    placeholder="John Doe"
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-44"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Phone</label>
                  <input
                    type="text"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="9876543210"
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-44"
                  />
                </div>
                <button
                  onClick={handleTestSend}
                  disabled={testSending}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60 font-medium"
                >
                  {testSending ? 'Sending…' : 'Send Test'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Employee Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-semibold text-gray-800">
            <Users className="w-5 h-5 text-blue-500" />
            Employees ({employees.length})
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or phone…"
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-56"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Users className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No employees found</p>
            <p className="text-xs mt-1">Add an employee to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {[
                    { label: 'Employee', field: 'employee_name' },
                    { label: 'Phone', field: 'phone_number' },
                    { label: 'Date of Birth', field: 'date_of_birth' },
                    { label: 'Status', field: 'is_active' },
                  ].map(({ label, field }) => (
                    <th
                      key={field}
                      onClick={() => toggleSort(field)}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 select-none"
                    >
                      <span className="inline-flex items-center gap-1">{label} <SortIcon field={field} /></span>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((emp) => (
                  <tr key={emp.id} className={`hover:bg-gray-50 transition-colors ${upcomingIds.has(emp.id) ? 'bg-yellow-50' : ''}`}>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        {upcomingIds.has(emp.id) && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-semibold">Soon</span>
                        )}
                        {emp.employee_name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{emp.phone_number}</td>
                    <td className="px-4 py-3 text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        {monthDay(emp.date_of_birth)}
                        <span className="text-gray-400 text-xs">
                          ({new Date(emp.date_of_birth).getUTCFullYear()})
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                        ${emp.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {emp.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">{emp.notes || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        <button
                          onClick={() => openEdit(emp)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(emp.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">{editId ? 'Edit Employee' : 'Add Employee'}</h2>
              <button onClick={closeForm} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Employee Name *</label>
                <input
                  type="text"
                  value={form.employee_name}
                  onChange={(e) => setForm((f) => ({ ...f, employee_name: e.target.value }))}
                  placeholder="Full name"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phone Number *</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="tel"
                    value={form.phone_number}
                    onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))}
                    placeholder="10-digit mobile"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date of Birth *</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="date"
                    value={form.date_of_birth}
                    onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional notes"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Active (will receive birthday greetings)</span>
              </label>

              {formError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {formError}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-60 font-medium"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving…' : editId ? 'Update' : 'Add Employee'}
              </button>
              <button onClick={closeForm} className="px-5 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-start gap-3 mb-5">
              <div className="p-2 rounded-full bg-red-100"><Trash2 className="w-5 h-5 text-red-600" /></div>
              <div>
                <h3 className="font-bold text-gray-900">Remove Employee?</h3>
                <p className="text-sm text-gray-500 mt-1">
                  This will also delete all associated birthday greeting records. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2.5 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium"
              >
                Yes, Remove
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
