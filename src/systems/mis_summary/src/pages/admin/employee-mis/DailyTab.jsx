import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Calendar,
  Clock,
  Edit3,
  Plus,
  RefreshCw,
  AlertTriangle,
  Users,
  CheckCircle2,
  XCircle,
  Coffee,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  fetchDailyRoster,
  fetchEsslAttendance,
  mergeDailyRoster,
} from './services/employeeMisService';
import BreakFormModal from './BreakFormModal';

/**
 * Returns today's date formatted as YYYY-MM-DD in local time
 */
function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a time string (e.g. "13:30:00" or "13:30") to "HH:MM"
 */
function formatTimeHhMm(timeStr) {
  if (!timeStr) return '';
  const match = String(timeStr).match(/^(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : timeStr;
}

export default function DailyTab() {
  const todayDate = useMemo(() => getTodayDateString(), []);
  const [selectedDate, setSelectedDate] = useState(todayDate);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'present' | 'absent'
  const [rosterData, setRosterData] = useState([]);
  const [cachedEmployees, setCachedEmployees] = useState([]);
  const [cachedBreaks, setCachedBreaks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [esslPortalError, setEsslPortalError] = useState(null);
  const [retryingEssl, setRetryingEssl] = useState(false);
  const [modalEmployee, setModalEmployee] = useState(null);

  // Helper to check if a row status is Present
  const isPresentStatus = (status) => {
    const s = String(status || '').trim().toUpperCase();
    return s === 'P' || s === 'P(OD)' || s === 'HP';
  };

  // Full fetch of roster + eSSL + breaks
  const loadDailyData = useCallback(async (dateToLoad) => {
    setLoading(true);
    setError(null);
    setEsslPortalError(null);
    try {
      const result = await fetchDailyRoster(dateToLoad);
      setRosterData(result.rows);
      setCachedEmployees(result.employees);
      setCachedBreaks(result.breaks);
      if (result.esslError) {
        setEsslPortalError(result.esslError);
      }
    } catch (err) {
      console.error('[EmployeeMIS] Failed to load daily roster:', err);
      setError(err.message || 'Failed to load employee attendance and break records.');
      setRosterData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDailyData(selectedDate);
  }, [selectedDate, loadDailyData]);

  // Targeted retry of ONLY eSSL punch sync without re-fetching employee roster
  const handleRetryEsslSync = async () => {
    setRetryingEssl(true);
    try {
      const esslRows = await fetchEsslAttendance(selectedDate);
      const updatedRows = mergeDailyRoster(cachedEmployees, esslRows, cachedBreaks);
      setRosterData(updatedRows);
      setEsslPortalError(null);
      toast.success('Attendance punch logs synchronized.');
    } catch (err) {
      console.warn('[EmployeeMIS] Retry punch sync failed:', err.message);
      setEsslPortalError(err.message || 'Could not reach the attendance portal.');
      toast.error('Could not reach attendance portal. Please retry later.');
    } finally {
      setRetryingEssl(false);
    }
  };

  // Aggregate stats across full roster
  const stats = useMemo(() => {
    let presentCount = 0;
    let absentCount = 0;
    let breakCount = 0;

    rosterData.forEach((row) => {
      if (isPresentStatus(row.status)) {
        presentCount += 1;
      } else {
        absentCount += 1;
      }
      if (row.breakRow) {
        breakCount += 1;
      }
    });

    return {
      total: rosterData.length,
      present: presentCount,
      absent: absentCount,
      breaks: breakCount,
    };
  }, [rosterData]);

  // Client-side filtering by employee name/code and status filter toggle
  const filteredRoster = useMemo(() => {
    let list = rosterData;

    // Filter by status toggle
    if (statusFilter === 'present') {
      list = list.filter((r) => isPresentStatus(r.status));
    } else if (statusFilter === 'absent') {
      list = list.filter((r) => !isPresentStatus(r.status));
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (row) =>
          (row.emp_name || '').toLowerCase().includes(q) ||
          (row.emp_code || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [rosterData, statusFilter, searchTerm]);

  const handleModalSuccess = () => {
    toast.success('Break record saved successfully.');
    loadDailyData(selectedDate);
  };

  return (
    <div className="space-y-6">
      {/* Top Filter and Controls Bar */}
      <div className="bg-white rounded-2xl p-5 shadow-xs border border-gray-200/80 transition-all">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by employee name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Status Filter Toggle + Date Picker + Refresh Button */}
          <div className="flex flex-wrap items-center gap-3 self-end md:self-auto">
            {/* Status Segmented Toggle */}
            <div className="flex items-center p-1 bg-gray-100 rounded-xl border border-gray-200 text-xs font-medium">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  statusFilter === 'all'
                    ? 'bg-white text-gray-900 font-semibold shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                All ({stats.total})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('present')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  statusFilter === 'present'
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'text-emerald-700 hover:text-emerald-900'
                }`}
              >
                Present ({stats.present})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('absent')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  statusFilter === 'absent'
                    ? 'bg-rose-600 text-white font-semibold shadow-xs'
                    : 'text-rose-700 hover:text-rose-900'
                }`}
              >
                Absent ({stats.absent})
              </button>
            </div>

            {/* Date Picker */}
            <div className="flex items-center gap-2 bg-gray-50/50 border border-gray-200 rounded-xl px-3 py-2">
              <Calendar className="w-4 h-4 text-gray-500 shrink-0" />
              <input
                type="date"
                max={todayDate}
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedDate(e.target.value);
                  }
                }}
                className="bg-transparent text-sm font-medium text-gray-800 focus:outline-none cursor-pointer"
              />
            </div>

            {/* Full Refresh */}
            <button
              type="button"
              onClick={() => loadDailyData(selectedDate)}
              disabled={loading}
              title="Refresh roster and punch data"
              className="p-2.5 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-200 rounded-xl transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Quick Stats Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2.5 px-3 py-2 bg-gray-50/70 rounded-xl border border-gray-100">
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Total</p>
              <p className="text-sm font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3 py-2 bg-emerald-50/50 rounded-xl border border-emerald-100">
            <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-emerald-600 uppercase tracking-wider">Present</p>
              <p className="text-sm font-bold text-emerald-800">{stats.present}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3 py-2 bg-rose-50/50 rounded-xl border border-rose-100">
            <div className="p-1.5 bg-rose-100 text-rose-600 rounded-lg">
              <XCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-rose-600 uppercase tracking-wider">Absent</p>
              <p className="text-sm font-bold text-rose-800">{stats.absent}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3 py-2 bg-amber-50/50 rounded-xl border border-amber-100">
            <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg">
              <Coffee className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-amber-600 uppercase tracking-wider">Breaks Logged</p>
              <p className="text-sm font-bold text-amber-800">{stats.breaks}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Portal Warning Banner (when eSSL sync fails, but roster is intact) */}
      {esslPortalError && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-sm">
                Could not reach the attendance portal — showing roster without live punch data
              </p>
              <p className="text-xs text-amber-700 mt-0.5">{esslPortalError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRetryEsslSync}
            disabled={retryingEssl}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs rounded-xl transition-all shadow-xs disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${retryingEssl ? 'animate-spin' : ''}`} />
            <span>{retryingEssl ? 'Retrying Portal...' : 'Retry Punch Sync'}</span>
          </button>
        </div>
      )}

      {/* Critical Failure Error Banner (e.g. Supabase connection failed) */}
      {error && (
        <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 shadow-xs">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Failed to load attendance data</p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => loadDailyData(selectedDate)}
            className="px-4 py-1.5 bg-white text-red-700 font-medium text-xs rounded-xl border border-red-200 hover:bg-red-50 transition-colors shadow-xs"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Table Card with Sticky Header and Horizontal Scroll */}
      <div className="bg-white rounded-2xl shadow-xs border border-gray-200/80 overflow-hidden">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-gray-500">Syncing daily attendance and breaks...</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[72vh]">
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-xs text-gray-600 text-xs font-semibold uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th scope="col" className="px-5 py-3.5">Employee Name</th>
                  <th scope="col" className="px-4 py-3.5">Shift</th>
                  <th scope="col" className="px-4 py-3.5">In Time</th>
                  <th scope="col" className="px-4 py-3.5">Out Time</th>
                  <th scope="col" className="px-4 py-3.5">Work Duration</th>
                  <th scope="col" className="px-4 py-3.5">Overtime</th>
                  <th scope="col" className="px-4 py-3.5">Total Duration</th>
                  <th scope="col" className="px-4 py-3.5">Status</th>
                  <th scope="col" className="px-4 py-3.5">Break</th>
                  <th scope="col" className="px-4 py-3.5">Hours Worked</th>
                  <th scope="col" className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRoster.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-16 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Users className="w-8 h-8 text-gray-300" />
                        <p className="text-sm font-medium">No employees found for {selectedDate}</p>
                        {(searchTerm || statusFilter !== 'all') && (
                          <p className="text-xs text-gray-400">
                            Try adjusting your filters: {statusFilter !== 'all' ? `[Status: ${statusFilter}] ` : ''}
                            {searchTerm ? `[Search: "${searchTerm}"]` : ''}
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRoster.map((row) => {
                    const hasBreak = Boolean(row.breakRow);
                    const isBreakOngoing = row.isBreakOngoing;
                    const present = isPresentStatus(row.status);

                    // Fallback logic so columns never show empty when the other column has values
                    const hasTotalDuration = row.total_duration && row.total_duration !== '—' && row.total_duration !== '00:00' && row.total_duration !== '0:00';
                    const hasHoursWorked = row.hours_worked && row.hours_worked !== '—' && row.hours_worked !== '00:00' && row.hours_worked !== '0:00';

                    const effectiveTotalDuration = hasTotalDuration
                      ? row.total_duration
                      : (hasHoursWorked ? row.hours_worked : '—');

                    const effectiveHoursWorked = hasHoursWorked
                      ? row.hours_worked
                      : (hasTotalDuration ? row.total_duration : '—');

                    return (
                      <tr
                        key={row.emp_code || row.emp_name}
                        className="hover:bg-indigo-50/30 transition-colors group"
                      >
                        {/* 1. Employee Name */}
                        <td className="px-5 py-3.5 font-medium text-gray-900">
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-900">{row.emp_name}</span>
                            <span className="text-xs text-gray-400 font-mono">
                              {row.emp_code ? `ID: ${row.emp_code}` : 'No Code'}
                            </span>
                          </div>
                        </td>

                        {/* 2. Shift */}
                        <td className="px-4 py-3.5 text-gray-600 text-xs">
                          {row.shift && row.shift !== '—' ? (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md font-medium">
                              {row.shift}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>

                        {/* 3. In Time */}
                        <td className="px-4 py-3.5 text-gray-700 font-mono text-xs">
                          {row.in_time || '—'}
                        </td>

                        {/* 4. Out Time */}
                        <td className="px-4 py-3.5 text-gray-700 font-mono text-xs">
                          {row.out_time || '—'}
                        </td>

                        {/* 5. Work Duration */}
                        <td className="px-4 py-3.5 text-gray-700 font-mono text-xs">
                          {row.work_duration || '—'}
                        </td>

                        {/* 6. Overtime */}
                        <td className="px-4 py-3.5 font-mono text-xs">
                          {row.overtime && row.overtime !== '00:00' && row.overtime !== '—' ? (
                            <span className="text-amber-600 font-semibold">{row.overtime}</span>
                          ) : (
                            <span className="text-gray-400">{row.overtime || '—'}</span>
                          )}
                        </td>

                        {/* 7. Total Duration */}
                        <td className="px-4 py-3.5 text-gray-900 font-mono font-medium text-xs">
                          {effectiveTotalDuration !== '—' ? (
                            <span className="font-semibold text-gray-800">{effectiveTotalDuration}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>

                        {/* 8. Status */}
                        <td className="px-4 py-3.5">
                          {present ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Present
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Absent
                            </span>
                          )}
                        </td>

                        {/* 9. Break */}
                        <td className="px-4 py-3.5">
                          {hasBreak ? (
                            <div className="flex items-center gap-2">
                              {isBreakOngoing ? (
                                <span
                                  title="Break in progress"
                                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-amber-100/80 text-amber-900 border border-amber-300"
                                >
                                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                  On break since {formatTimeHhMm(row.breakRow.break_start)}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 font-mono">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  {row.break_minutes !== null ? `${row.break_minutes} min` : '—'}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => setModalEmployee(row)}
                                title="Edit break"
                                className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setModalEmployee(row)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-700 border border-indigo-100 transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                              Add Break
                            </button>
                          )}
                        </td>

                        {/* 10. Hours Worked */}
                        <td className="px-4 py-3.5 font-mono font-semibold text-xs text-gray-900">
                          {effectiveHoursWorked !== '—' ? (
                            <div className="inline-flex items-center gap-1">
                              <span className="text-indigo-700 bg-indigo-50/60 px-2 py-0.5 rounded-md">
                                {effectiveHoursWorked}
                              </span>
                              {isBreakOngoing && (
                                <span
                                  className="text-amber-600 font-bold text-xs"
                                  title="Break in progress — total duration shown without break deduction"
                                >
                                  *
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>

                        {/* 11. Actions */}
                        <td className="px-5 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => setModalEmployee(row)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-700 hover:text-indigo-600 bg-gray-50 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-200 rounded-lg transition-all"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>{hasBreak ? 'Edit' : '+ Break'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Break Form Modal */}
      {modalEmployee && (
        <BreakFormModal
          employee={modalEmployee}
          selectedDate={selectedDate}
          onClose={() => setModalEmployee(null)}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
}
