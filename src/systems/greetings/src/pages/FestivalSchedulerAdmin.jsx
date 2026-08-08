import { useEffect, useState, useCallback, useRef } from 'react';
import ScheduleProgressPanel from '../components/scheduler/ScheduleProgressPanel';
import CreateScheduleModal from '../components/scheduler/CreateScheduleModal';
import { Clock, Loader, PauseCircle, CheckCircle2, Ban, XCircle, FileEdit, CalendarClock, RefreshCw, Plus, Search, Eye, PlayCircle, Trash2, Pencil, Copy } from 'lucide-react';
import { fetchSchedules, pauseSchedule, resumeSchedule, cancelSchedule, deleteSchedule, duplicateSchedule, } from '../services/festivalSchedulerService';
import { useMagicToast } from '../../../../context/MagicToastContext';

const STATUS_STYLES = {
  Draft: 'bg-gray-50 text-gray-600 border border-gray-200',
  Scheduled: 'bg-blue-50 text-blue-700 border border-blue-200',
  Running: 'bg-amber-50 text-amber-700 border border-amber-200',
  Paused: 'bg-orange-50 text-orange-700 border border-orange-200',
  Completed: 'bg-green-50 text-green-700 border border-green-200',
  Cancelled: 'bg-gray-100 text-gray-500 border border-gray-300',
  Failed: 'bg-red-50 text-red-700 border border-red-200',
};

const STATUS_ICONS = {
  Draft: FileEdit, Scheduled: Clock, Running: Loader, Paused: PauseCircle,
  Completed: CheckCircle2, Cancelled: Ban, Failed: XCircle,
};

const STATUS_FILTERS = ['All', 'Draft', 'Scheduled', 'Running', 'Paused', 'Completed', 'Cancelled', 'Failed'];

const fmtTime = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  });
};

export default function FestivalSchedulerAdmin() {
  const { showToast } = useMagicToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [modalSchedule, setModalSchedule] = useState(undefined); // undefined = closed, null = new, object = edit
  const [progressSchedule, setProgressSchedule] = useState(null);
  const refreshTimer = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSchedules({ status: statusFilter, search });
      setRows(data);
    } catch (err) {
      showToast(err.message || 'Failed to load schedules.', 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, search]);

  useEffect(() => {
    load();
    refreshTimer.current = setInterval(load, 60_000);
    return () => clearInterval(refreshTimer.current);
  }, [load]);

  const counts = STATUS_FILTERS.slice(1).reduce((acc, s) => {
    acc[s] = rows.filter((r) => r.status === s).length;
    return acc;
  }, {});

  const runAction = async (fn, successMsg) => {
    try {
      await fn();
      showToast(successMsg);
      load();
    } catch (err) {
      showToast(err.message || 'Action failed.', 'error');
    }
  };

  const handleDelete = (row) => {
    if (!window.confirm(`Delete schedule "${row.occasion}"? This cannot be undone.`)) return;
    runAction(() => deleteSchedule(row.id), 'Schedule deleted.');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarClock className="w-6 h-6 text-pink-500" />
            Festival Scheduler
          </h1>
          <p className="text-xs text-gray-400 mt-1">Auto-refreshes every 60s · sends run automatically via the scheduled cron job.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={() => setModalSchedule(null)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> Create Schedule
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {STATUS_FILTERS.slice(1).map((s) => {
          const Icon = STATUS_ICONS[s];
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-xl border px-3 py-3 text-left ${STATUS_STYLES[s]} ${statusFilter === s ? 'ring-2 ring-offset-1 ring-blue-300' : ''}`}
            >
              <div className="text-xl font-bold">{counts[s] || 0}</div>
              <div className="text-[11px] font-medium mt-0.5 flex items-center gap-1"><Icon className="w-3 h-3" /> {s}</div>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by occasion or template…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white"
          >
            {STATUS_FILTERS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <CalendarClock className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm font-medium">No schedules yet</p>
            <p className="text-xs mt-1">Click "Create Schedule" to plan your first festival campaign.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Occasion</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Scheduled For</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Template</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Recipients</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row) => {
                  const StatusIcon = STATUS_ICONS[row.status] || Clock;
                  const canEdit = ['Draft', 'Scheduled'].includes(row.status);
                  const canPause = ['Scheduled', 'Running'].includes(row.status);
                  const canResume = row.status === 'Paused';
                  const canCancel = ['Draft', 'Scheduled', 'Paused'].includes(row.status);
                  const canDelete = ['Draft', 'Cancelled', 'Completed', 'Failed'].includes(row.status);

                  return (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{row.occasion}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{fmtTime(row.schedule_at)}</td>
                      <td className="px-4 py-3 text-gray-600">{row.template_name}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {row.completed_recipients}/{row.total_recipients} sent
                        {row.failed_recipients > 0 && <span className="text-red-500"> · {row.failed_recipients} failed</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[row.status]}`}>
                          <StatusIcon className="w-3 h-3" /> {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-gray-400">
                          <button title="View Progress" onClick={() => setProgressSchedule(row)} className="p-1.5 hover:text-blue-600 hover:bg-blue-50 rounded"><Eye className="w-4 h-4" /></button>
                          {canEdit && (
                            <button title="Edit" onClick={() => setModalSchedule(row)} className="p-1.5 hover:text-blue-600 hover:bg-blue-50 rounded"><Pencil className="w-4 h-4" /></button>
                          )}
                          <button title="Duplicate" onClick={() => runAction(() => duplicateSchedule(row.id), 'Duplicated as a new draft.')} className="p-1.5 hover:text-blue-600 hover:bg-blue-50 rounded"><Copy className="w-4 h-4" /></button>
                          {canPause && (
                            <button title="Pause" onClick={() => runAction(() => pauseSchedule(row.id), 'Schedule paused.')} className="p-1.5 hover:text-orange-600 hover:bg-orange-50 rounded"><PauseCircle className="w-4 h-4" /></button>
                          )}
                          {canResume && (
                            <button title="Resume" onClick={() => runAction(() => resumeSchedule(row.id), 'Schedule resumed.')} className="p-1.5 hover:text-green-600 hover:bg-green-50 rounded"><PlayCircle className="w-4 h-4" /></button>
                          )}
                          {canCancel && (
                            <button title="Cancel" onClick={() => runAction(() => cancelSchedule(row.id), 'Schedule cancelled.')} className="p-1.5 hover:text-gray-700 hover:bg-gray-100 rounded"><Ban className="w-4 h-4" /></button>
                          )}
                          {canDelete && (
                            <button title="Delete" onClick={() => handleDelete(row)} className="p-1.5 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalSchedule !== undefined && (
        <CreateScheduleModal
          schedule={modalSchedule}
          onClose={() => setModalSchedule(undefined)}
          onSaved={() => { setModalSchedule(undefined); load(); }}
        />
      )}

      {progressSchedule && (
        <ScheduleProgressPanel schedule={progressSchedule} onClose={() => setProgressSchedule(null)} />
      )}
    </div>
  );
}
