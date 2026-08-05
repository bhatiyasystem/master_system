import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Users, ScrollText, AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { fetchRecipients, fetchLogs } from '../../services/festivalSchedulerService';

const TABS = [
  { id: 'recipients', label: 'Recipients', icon: Users },
  { id: 'logs', label: 'Logs', icon: ScrollText },
  { id: 'failed', label: 'Failed', icon: AlertTriangle },
];

const STATUS_ICONS = { Pending: Clock, Sent: CheckCircle2, Failed: XCircle, Skipped: Clock };

const fmtTime = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  });
};

export default function ScheduleProgressPanel({ schedule, onClose }) {
  const [tab, setTab] = useState('recipients');
  const [recipients, setRecipients] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, l] = await Promise.all([fetchRecipients(schedule.id), fetchLogs(schedule.id)]);
      setRecipients(r);
      setLogs(l);
    } finally {
      setLoading(false);
    }
  }, [schedule.id]);

  useEffect(() => { load(); }, [load]);

  const failedRecipients = recipients.filter((r) => r.status === 'Failed');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose}></div>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-blue-50 flex flex-col max-h-[85vh]"
      >
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-4 flex justify-between items-center border-b border-blue-50 shrink-0">
          <div>
            <h3 className="font-black text-gray-900 text-lg">{schedule.occasion}</h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
              {schedule.completed_recipients}/{schedule.total_recipients} sent · {schedule.failed_recipients} failed
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/60">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex gap-2 px-6 pt-4 shrink-0">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border ${
                tab === id ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-10">Loading…</p>
          ) : tab === 'recipients' ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
                  <th className="py-2">Client</th>
                  <th className="py-2">Phone</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Sent At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recipients.map((r) => {
                  const Icon = STATUS_ICONS[r.status] || Clock;
                  return (
                    <tr key={r.id}>
                      <td className="py-2">{r.festival_contacts?.name || '—'}</td>
                      <td className="py-2 text-gray-500">{r.festival_contacts?.phone_number || '—'}</td>
                      <td className="py-2">
                        <span className="inline-flex items-center gap-1 text-xs font-medium">
                          <Icon className="w-3.5 h-3.5" /> {r.status}
                        </span>
                      </td>
                      <td className="py-2 text-gray-400 text-xs">{fmtTime(r.sent_at)}</td>
                    </tr>
                  );
                })}
                {recipients.length === 0 && (
                  <tr><td colSpan={4} className="text-center text-gray-400 py-8">No recipients yet.</td></tr>
                )}
              </tbody>
            </table>
          ) : tab === 'logs' ? (
            <div className="space-y-2">
              {logs.map((l) => (
                <div key={l.id} className={`text-xs rounded-lg px-3 py-2 border ${l.level === 'error' ? 'bg-red-50 border-red-100 text-red-600' : 'bg-gray-50 border-gray-100 text-gray-600'}`}>
                  <span className="font-mono text-gray-400 mr-2">{fmtTime(l.created_at)}</span>
                  {l.message}
                </div>
              ))}
              {logs.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No log entries yet.</p>}
            </div>
          ) : (
            <div className="space-y-2">
              {failedRecipients.map((r) => (
                <div key={r.id} className="text-xs rounded-lg px-3 py-2 border bg-red-50 border-red-100">
                  <p className="font-medium text-gray-800">{r.festival_contacts?.name || r.festival_contacts?.phone_number}</p>
                  <p className="text-red-600 mt-0.5">{r.error_message || 'Unknown error'}</p>
                </div>
              ))}
              {failedRecipients.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No failed messages.</p>}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
