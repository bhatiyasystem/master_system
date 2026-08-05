import { fmt } from '../utils/helpers';

export function StatusBadge({ status }) {
  if (status === 'Approved')
    return (
      <span className="inline-block whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-[10.5px] font-bold text-emerald-700">
        Approved
      </span>
    );
  if (status === 'Rejected')
    return (
      <span className="inline-block whitespace-nowrap rounded-full bg-rose-50 px-2.5 py-1 text-[10.5px] font-bold text-rose-700">
        Rejected
      </span>
    );
  return (
    <span className="inline-block whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-[10.5px] font-bold text-amber-700">
      Pending
    </span>
  );
}

export function EmptyState({ icon, children, action }) {
  return (
    <div className="py-10 px-5 text-center text-sm text-gray-500">
      {icon && <div className="mx-auto mb-2 opacity-50">{icon}</div>}
      <div>{children}</div>
      {action}
    </div>
  );
}

export function CardPanel({ title, desc, action, children, className = '' }) {
  return (
    <div className={`mb-4 rounded-2xl border border-gray-200 bg-white p-5 ${className}`}>
      <div className="mb-0.5 flex items-start justify-between gap-3">
        <div>
          {title && <h2 className="text-[15px] font-bold text-gray-900">{title}</h2>}
          {desc && <div className="mt-0.5 text-[12.3px] text-gray-500">{desc}</div>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      {desc && <div className="mb-3" />}
      {children}
    </div>
  );
}

export function FilterBar({ children, onClear }) {
  return (
    <div className="mb-3.5 flex flex-wrap items-center gap-2">
      {children}
      {onClear && (
        <span
          className="cursor-pointer whitespace-nowrap text-[11.8px] text-gray-500 underline"
          onClick={onClear}
        >
          Clear filters
        </span>
      )}
    </div>
  );
}

export function BarChart({ data, color }) {
  if (!data || data.length === 0) {
    return <div className="py-8 text-center text-sm text-gray-500">No PO data yet.</div>;
  }
  const max = Math.max(...data.map((d) => d.value)) || 1;
  const rowH = 30;
  const topPad = 6;
  const width = 560;
  const labelW = 132;
  const rightPad = 78;
  const barAreaW = width - labelW - rightPad;
  const height = data.length * rowH + topPad;
  return (
    <div className="relative overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="xMinYMin meet" className="block min-w-[280px]">
        {data.map((d, i) => {
          const y = i * rowH + topPad;
          const barW = Math.max((d.value / max) * barAreaW, 3);
          const label = d.label.length > 18 ? d.label.slice(0, 17) + '…' : d.label;
          return (
            <g key={i}>
              <text x={0} y={y + 14} fontSize="11" fill="#374151">
                {label}
              </text>
              <rect x={labelW} y={y} width={barW.toFixed(1)} height={18} rx={4} fill={color} />
              <text x={labelW + barW + 8} y={y + 14} fontSize="10.5" fill="#173254" fontWeight="600">
                ₹{fmt(d.value)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function RevisionChip({ revision }) {
  if (revision > 1)
    return (
      <span className="inline-block whitespace-nowrap rounded-full bg-purple-50 px-2.5 py-1 text-[10.5px] font-bold text-purple-700">
        Rev {revision}
      </span>
    );
  return (
    <span className="inline-block whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-[10.5px] font-bold text-emerald-700">
      Original
    </span>
  );
}
