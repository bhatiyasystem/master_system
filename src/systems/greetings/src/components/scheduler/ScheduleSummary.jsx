import { Gift, Calendar, Clock, MessageSquare, Users, Loader2 } from 'lucide-react';

const AUDIENCE_LABEL = { all: 'All clients', selected: 'Selected clients', csv: 'Uploaded CSV list' };

export default function ScheduleSummary({
  occasion,
  scheduleDate,
  scheduleTime,
  template,
  audienceType,
  recipientCount,
  saving,
  onSaveDraft,
  onSchedule,
}) {
  const rows = [
    { icon: Gift, label: 'Occasion', value: occasion || '—' },
    { icon: Calendar, label: 'Date', value: scheduleDate || '—' },
    { icon: Clock, label: 'Time (IST)', value: scheduleTime || '—' },
    { icon: MessageSquare, label: 'Template', value: template?.name || '—' },
    { icon: Users, label: 'Audience', value: `${AUDIENCE_LABEL[audienceType] || '—'} (~${recipientCount} recipient${recipientCount === 1 ? '' : 's'})` },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-violet-100 bg-white divide-y divide-gray-100">
        {rows.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-3 px-4 py-3">
            <Icon className="w-4 h-4 text-violet-400 shrink-0" />
            <span className="text-xs font-semibold text-gray-500 w-28 shrink-0">{label}</span>
            <span className="text-sm text-gray-800 font-medium truncate">{value}</span>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={onSaveDraft}
          disabled={saving}
          className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-60 flex items-center gap-1.5 transition-colors"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save as Draft
        </button>
        <button
          onClick={onSchedule}
          disabled={saving}
          className="px-4 py-2 text-sm rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700 disabled:opacity-60 flex items-center gap-1.5 shadow-sm transition-colors"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Schedule
        </button>
      </div>
    </div>
  );
}
