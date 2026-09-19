import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Calendar,
  Clock,
  RefreshCw,
  AlertTriangle,
  Users,
  CheckCircle2,
  Coffee,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { MONTHS, fetchMonthlyAggregates } from './services/employeeMisService';

export default function MonthlyTab() {
  const navigate = useNavigate();
  const today = useMemo(() => new Date(), []);
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [searchTerm, setSearchTerm] = useState('');
  const [dataRows, setDataRows] = useState([]);
  const [hasMonthlyData, setHasMonthlyData] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadMonthlyData = useCallback(async (year, month) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchMonthlyAggregates(year, month);
      setDataRows(result.rows);
      setHasMonthlyData(result.hasData);
    } catch (err) {
      console.error('[EmployeeMIS] Failed to fetch monthly aggregates:', err);
      setError(err.message || 'Failed to load monthly attendance records.');
      setDataRows([]);
      setHasMonthlyData(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMonthlyData(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth, loadMonthlyData]);

  // Client-side filtering by employee name or code (instant, case-insensitive)
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return dataRows;
    const q = searchTerm.toLowerCase();
    return dataRows.filter(
      (r) =>
        (r.emp_name || '').toLowerCase().includes(q) ||
        (r.emp_code || '').toLowerCase().includes(q)
    );
  }, [dataRows, searchTerm]);

  // Year options: current year - 3 to current year + 1
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const years = [];
    for (let y = current - 3; y <= current + 1; y++) {
      years.push(y);
    }
    return years;
  }, []);

  // Summary statistics across filtered employees
  const summaryStats = useMemo(() => {
    const totalEmps = filteredRows.length;
    if (totalEmps === 0) {
      return { total: 0, avgPresent: '0', avgHours: '—' };
    }

    let sumDays = 0;
    filteredRows.forEach((r) => {
      sumDays += r.days_present || 0;
    });

    const avgPresentDays = (sumDays / totalEmps).toFixed(1);

    return {
      total: totalEmps,
      avgPresent: avgPresentDays,
    };
  }, [filteredRows]);

  const monthName = MONTHS[selectedMonth - 1] || '';

  return (
    <div className="space-y-6">
      {/* Filters and Month/Year Selector */}
      <div className="bg-white rounded-2xl p-5 shadow-xs border border-gray-200/80 transition-all">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search Box */}
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

          {/* Month & Year Dropdowns + Refresh Button */}
          <div className="flex items-center gap-3 self-end md:self-auto">
            {/* Month Select */}
            <div className="flex items-center gap-2 bg-gray-50/50 border border-gray-200 rounded-xl px-3 py-2">
              <Calendar className="w-4 h-4 text-gray-500 shrink-0" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                className="bg-transparent text-sm font-medium text-gray-800 focus:outline-none cursor-pointer"
              >
                {MONTHS.map((m, idx) => (
                  <option key={m} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Year Select */}
            <div className="flex items-center bg-gray-50/50 border border-gray-200 rounded-xl px-3 py-2">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                className="bg-transparent text-sm font-medium text-gray-800 focus:outline-none cursor-pointer"
              >
                {yearOptions.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => loadMonthlyData(selectedYear, selectedMonth)}
              disabled={loading}
              title="Refresh monthly records"
              className="p-2.5 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-200 rounded-xl transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Quick Stats Badges */}
        {hasMonthlyData && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2.5 px-3 py-2 bg-gray-50/70 rounded-xl border border-gray-100">
              <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                  Total Active
                </p>
                <p className="text-sm font-bold text-gray-900">{summaryStats.total}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 px-3 py-2 bg-emerald-50/50 rounded-xl border border-emerald-100">
              <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-emerald-600 uppercase tracking-wider">
                  Avg Present Days
                </p>
                <p className="text-sm font-bold text-emerald-800">{summaryStats.avgPresent} days</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 px-3 py-2 bg-amber-50/50 rounded-xl border border-amber-100 col-span-2 sm:col-span-1">
              <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-amber-600 uppercase tracking-wider">
                  Selected Period
                </p>
                <p className="text-sm font-bold text-amber-800">
                  {monthName} {selectedYear}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 shadow-xs">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Failed to load monthly attendance data</p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => loadMonthlyData(selectedYear, selectedMonth)}
            className="px-4 py-1.5 bg-white text-red-700 font-medium text-xs rounded-xl border border-red-200 hover:bg-red-50 transition-colors shadow-xs"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl shadow-xs border border-gray-200/80 overflow-hidden">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-gray-500">
              Aggregating monthly attendance, working hours, and breaks...
            </p>
          </div>
        ) : !hasMonthlyData ? (
          /* Empty State linking to /dashboard/hr-attendance */
          <div className="py-20 px-6 text-center max-w-lg mx-auto">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-100">
              <Calendar className="w-7 h-7 text-indigo-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1.5">
              No attendance data found for {monthName} {selectedYear}
            </h3>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Attendance records for this month have not been synced or uploaded yet. Sync the biometric logs from the Monthly Attendance page first.
            </p>
            <button
              type="button"
              onClick={() => navigate('/dashboard/hr-attendance')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors"
            >
              <span>Go to Monthly Attendance</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[72vh]">
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-xs text-gray-600 text-xs font-semibold uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    Employee Name
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-center">
                    Days Present
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-center">
                    Avg Working Hours/day
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-center">
                    Avg Break (min)
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-center" title="Average delay arriving to work">
                    Avg In Delay
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-center" title="Average leaving early from work">
                    Avg Out Early
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    Total Overtime
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Users className="w-8 h-8 text-gray-300" />
                        <p className="text-sm font-medium">
                          No matching employees found in {monthName} {selectedYear}
                        </p>
                        {searchTerm && (
                          <p className="text-xs text-gray-400">
                            Try adjusting your search query: "{searchTerm}"
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr
                      key={row.emp_code || row.emp_id}
                      className="hover:bg-indigo-50/30 transition-colors"
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

                      {/* 2. Days Present */}
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                          {row.days_present}
                        </span>
                      </td>

                      {/* 3. Avg Working Hours/day */}
                      <td className="px-4 py-3.5 text-center font-mono text-xs font-semibold text-gray-800">
                        {row.avg_working_hours !== '—' ? (
                          <span className="bg-gray-100 text-gray-800 px-2.5 py-1 rounded-lg">
                            {row.avg_working_hours}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* 4. Avg Break (min) */}
                      <td className="px-4 py-3.5 text-center font-mono text-xs">
                        {row.avg_break !== '—' ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                            <Coffee className="w-3 h-3 text-amber-500" />
                            {row.avg_break}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* 5. Avg In Delay */}
                      <td className="px-4 py-3.5 text-center font-mono text-xs text-gray-700">
                        {row.avg_in_delay !== '—' && row.avg_in_delay !== '0 min' ? (
                          <span className="text-rose-600 font-medium">{row.avg_in_delay}</span>
                        ) : (
                          <span className="text-gray-400">{row.avg_in_delay}</span>
                        )}
                      </td>

                      {/* 6. Avg Out Early */}
                      <td className="px-4 py-3.5 text-center font-mono text-xs text-gray-700">
                        {row.avg_out_early !== '—' && row.avg_out_early !== '0 min' ? (
                          <span className="text-amber-600 font-medium">{row.avg_out_early}</span>
                        ) : (
                          <span className="text-gray-400">{row.avg_out_early}</span>
                        )}
                      </td>

                      {/* 7. Total Overtime */}
                      <td className="px-5 py-3.5 text-right font-mono text-xs font-semibold">
                        {row.total_ot !== '0:00' && row.total_ot !== '—' ? (
                          <span className="text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg">
                            <Clock className="w-3 h-3 inline-block mr-1 text-indigo-500" />
                            {row.total_ot}
                          </span>
                        ) : (
                          <span className="text-gray-400">{row.total_ot}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
