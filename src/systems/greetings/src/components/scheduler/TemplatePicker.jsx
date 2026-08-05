import { useState } from 'react';

const OCCASIONS = ['Diwali', 'Holi', 'New Year', 'Eid', 'Christmas', 'Raksha Bandhan', 'Pongal', 'Dussehra', 'Custom'];

export default function TemplatePicker({
  occasion,
  onOccasionChange,
  scheduleDate,
  onScheduleDateChange,
  scheduleTime,
  onScheduleTimeChange,
}) {
  const isCustom = occasion && !OCCASIONS.slice(0, -1).includes(occasion);
  const [customMode, setCustomMode] = useState(isCustom);

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2 space-y-1.5">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Occasion</label>
        {customMode ? (
          <input
            type="text"
            autoFocus
            value={occasion}
            onChange={(e) => onOccasionChange(e.target.value)}
            placeholder="Enter custom occasion"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300"
          />
        ) : (
          <select
            value={occasion}
            onChange={(e) => {
              if (e.target.value === 'Custom') {
                setCustomMode(true);
                onOccasionChange('');
              } else {
                onOccasionChange(e.target.value);
              }
            }}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300"
          >
            <option value="">Select an occasion…</option>
            {OCCASIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</label>
        <input
          type="date"
          value={scheduleDate}
          onChange={(e) => onScheduleDateChange(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Time (IST)</label>
        <input
          type="time"
          value={scheduleTime}
          onChange={(e) => onScheduleTimeChange(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300"
        />
      </div>
    </div>
  );
}
