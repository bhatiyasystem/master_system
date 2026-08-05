import { ShieldAlert, Info } from 'lucide-react';
// src/systems/inventory/components/AuditLogView.jsx
import { useSelector } from 'react-redux';
;

export default function AuditLogView() {
  const { audit } = useSelector((state) => state.inventory);

  const formatTimestamp = (ts) => {
    if (!ts) return '—';
    try {
      const date = new Date(ts);
      if (isNaN(date.getTime())) return ts;

      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const hh = String(date.getHours()).padStart(2, '0');
      const min = String(date.getMinutes()).padStart(2, '0');
      const ss = String(date.getSeconds()).padStart(2, '0');

      return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
    } catch {
      return ts;
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-gray-150 pb-4">
        <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
          <ShieldAlert className="text-indigo-500" size={20} />
          System Audit Trail logs
        </h3>
        <span className="text-xs text-gray-400 font-semibold">{audit.length} entries recorded</span>
      </div>

      <div className="divide-y divide-gray-100 max-h-[65vh] overflow-y-auto pr-2 space-y-0">
        {audit.length === 0 ? (
          <div className="text-center py-10 text-gray-400 flex flex-col items-center justify-center gap-2">
            <Info size={24} className="opacity-40" />
            <span>No audit entries logged yet.</span>
          </div>
        ) : (
          audit.map((log, idx) => (
            <div key={idx} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 hover:bg-gray-50/30 px-2 rounded-xl transition-colors">
              <div className="font-mono text-xs text-gray-400 w-44 flex-shrink-0">
                {formatTimestamp(log.ts)}
              </div>
              <div className="flex-1 text-sm text-gray-700 leading-normal">
                <span className="font-bold text-gray-900 mr-1.5">{log.action}</span>
                <span>· {log.detail || ''}</span>
              </div>
              <div className="flex-shrink-0">
                <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {log.user}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
