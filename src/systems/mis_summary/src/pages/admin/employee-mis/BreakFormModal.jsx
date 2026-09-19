import React, { useState } from 'react';
import { X, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { upsertEmployeeBreak } from './services/employeeMisService';

/**
 * Normalizes SQL time strings (e.g. "13:30:00" or "09:15:00.123") into "HH:MM"
 * so standard HTML <input type="time"> can parse and display it.
 */
function toInputTime(val) {
  if (!val) return '';
  const s = String(val).trim();
  const match = s.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    const hours = match[1].padStart(2, '0');
    const minutes = match[2];
    return `${hours}:${minutes}`;
  }
  return '';
}

/**
 * BreakFormModal Component
 *
 * Handles Add/Edit break modal for an employee on a specific date.
 */
export default function BreakFormModal({ employee, selectedDate, onClose, onSuccess }) {
  const existingBreak = employee?.breakRow;
  const isEdit = Boolean(existingBreak?.id);

  const [breakStart, setBreakStart] = useState(toInputTime(existingBreak?.break_start) || '');
  const [breakEnd, setBreakEnd] = useState(toInputTime(existingBreak?.break_end) || '');
  const [reason, setReason] = useState(existingBreak?.reason || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!breakStart) {
      setError('Break Time is required.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await upsertEmployeeBreak({
        id: existingBreak?.id || null,
        emp_code: employee.emp_code,
        emp_name: employee.emp_name,
        break_date: selectedDate,
        break_start: breakStart,
        break_end: breakEnd || null,
        reason: reason || null,
      });

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save break record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {isEdit ? 'Edit Employee Break' : 'Add Employee Break'}
              </h3>
              <p className="text-xs text-gray-500">Date: {selectedDate}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Employee Name (Read-only) */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Employee Name
            </label>
            <div className="px-3.5 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 flex justify-between items-center">
              <span>{employee?.emp_name || '—'}</span>
              <span className="text-xs text-gray-500 font-mono">
                {employee?.emp_code ? `(${employee.emp_code})` : ''}
              </span>
            </div>
          </div>

          {/* Break Times */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Break Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={breakStart}
                onChange={(e) => setBreakStart(e.target.value)}
                required
                className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              />
              <p className="text-[11px] text-gray-400 mt-1">When break started</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Return Time
              </label>
              <input
                type="time"
                value={breakEnd}
                onChange={(e) => setBreakEnd(e.target.value)}
                className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              />
              <p className="text-[11px] text-gray-400 mt-1">Leave blank if ongoing</p>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Reason <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Lunch, Doctor appointment, Personal..."
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none bg-white"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-sm transition-all disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{isEdit ? 'Update Break' : 'Save Break'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
