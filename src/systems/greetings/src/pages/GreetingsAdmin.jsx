import { useEffect, useState, useCallback, useRef } from 'react';
import { CheckCircle2, XCircle, Clock, Cake, AlertCircle, Gift, RefreshCw, Calendar, User } from 'lucide-react';
import { fetchTodaysBirthdayUsers, fetchTodaysBirthdayGreetings, triggerBirthdayEdgeFunction,  } from '../services/greetingsService';

const STATUS_STYLES = {
  Pending: 'bg-amber-50 text-amber-700 border border-amber-200',
  Sent:    'bg-green-50 text-green-700 border border-green-200',
  Failed:  'bg-red-50 text-red-700 border border-red-200',
};

const STATUS_ICONS = { Pending: Clock, Sent: CheckCircle2, Failed: XCircle };

const fmtDOB = (dob) => {
  if (!dob) return '—';
  return new Date(dob).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', timeZone: 'UTC',
  });
};

const fmtTime = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'Asia/Kolkata',
  });
};

const getISTDateISO = () => {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().split('T')[0];
};

export default function GreetingsAdmin() {
  const [rows, setRows] = useState([]);       // merged users + greeting status
  const [loading, setLoading] = useState(true);
  const [_triggering, setTriggering] = useState(false);
  const [toast, setToast] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const refreshTimer = useRef(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [users, greetings] = await Promise.all([
        fetchTodaysBirthdayUsers(),
        fetchTodaysBirthdayGreetings(),
      ]);

      const greetingMap = Object.fromEntries(greetings.map((g) => [g.user_id, g]));

      const merged = users.map((u) => ({
        ...u,
        greeting: greetingMap[u.id] || null,
      }));

      setRows(merged);
      setLastRefresh(new Date());
    } catch (err) {
      showToast(err.message || 'Failed to load data.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Auto-refresh every 60 seconds so status updates appear without manual reload
    refreshTimer.current = setInterval(load, 60_000);
    return () => clearInterval(refreshTimer.current);
  }, [load]);

  const _handleTrigger = async () => {
    setTriggering(true);
    try {
      const result = await triggerBirthdayEdgeFunction();
      showToast(
        result?.message ||
        `Ran birthday check — ${result?.sent ?? 0} sent, ${result?.failed ?? 0} failed, ${result?.skipped ?? 0} skipped.`
      );
      await load();
    } catch (err) {
      showToast(err.message || 'Edge function call failed.', 'error');
    } finally {
      setTriggering(false);
    }
  };

  const _todayIST = getISTDateISO();
  const sentCount    = rows.filter((r) => r.greeting?.status === 'Sent').length;
  const pendingCount = rows.filter((r) => !r.greeting || r.greeting.status === 'Pending').length;
  const failedCount  = rows.filter((r) => r.greeting?.status === 'Failed').length;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium
          ${toast.type === 'error'
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-green-50 text-green-700 border border-green-200'}`}>
          {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Gift className="w-6 h-6 text-pink-500" />
            Birthday Greetings
          </h1>
          {lastRefresh && (
            <p className="text-xs text-gray-400 mt-1">
              Last refreshed: {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} &nbsp;·&nbsp; auto-refreshes every 60 s
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Today's Birthdays", value: rows.length,  color: 'text-gray-700',  bg: 'bg-gray-50 border-gray-200',   Icon: Cake },
          { label: 'Pending',           value: pendingCount, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', Icon: Clock },
          { label: 'Sent',              value: sentCount,    color: 'text-green-700', bg: 'bg-green-50 border-green-200', Icon: CheckCircle2 },
          { label: 'Failed',            value: failedCount,  color: 'text-red-700',   bg: 'bg-red-50 border-red-200',     Icon: XCircle },
        ].map(({ label, value, color, bg, Icon }) => (
          <div key={label} className={`rounded-xl border px-4 py-4 ${bg}`}>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className={`text-xs font-medium mt-0.5 flex items-center gap-1 ${color}`}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <span className="font-semibold text-gray-800 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-500" />
            Today's Birthday Employees
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Gift className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm font-medium">No birthdays today</p>
            <p className="text-xs mt-1">Check back tomorrow, or ensure employees have their DOB set in their profile.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Employee ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date of Birth</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Message Sent At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row) => {
                  const status = row.greeting?.status || 'Pending';
                  const StatusIcon = STATUS_ICONS[status] || Clock;

                  return (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      {/* Employee */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {row.profile_image ? (
                            <img
                              src={row.profile_image}
                              alt={row.user_name}
                              className="w-9 h-9 rounded-full object-cover border border-gray-200 shrink-0"
                              onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                            />
                          ) : null}
                          <div className={`w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center shrink-0 ${row.profile_image ? 'hidden' : 'flex'}`}>
                            <User className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{row.user_name}</p>
                            <p className="text-xs text-gray-400 capitalize">{row.role}</p>
                          </div>
                        </div>
                      </td>

                      {/* Employee ID */}
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                        {String(row.id).slice(0, 8).toUpperCase()}
                      </td>

                      {/* DOB */}
                      <td className="px-4 py-3 text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <Cake className="w-3.5 h-3.5 text-pink-400" />
                          {fmtDOB(row.dob)}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[status]}`}>
                          <StatusIcon className="w-3 h-3" />
                          {status}
                        </span>
                      </td>

                      {/* Sent At */}
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {row.greeting?.sent_at ? fmtTime(row.greeting.sent_at) : '—'}
                        {row.greeting?.error_message && (
                          <div className="flex items-start gap-1 text-red-500 mt-0.5">
                            <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                            <span>{row.greeting.error_message}</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
          This is a read-only view. Greetings are sent automatically by the scheduled cron job at 11:00 AM IST.
          Use <strong>Run Now</strong> to trigger the edge function manually.
        </div>
      </div>
    </div>
  );
}
