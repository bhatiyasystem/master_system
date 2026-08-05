import { useEffect } from 'react';

const FIELD_OPTIONS = [
  { value: 'name', label: 'Client Name' },
  { value: 'phone_number', label: 'Phone Number' },
  { value: 'email', label: 'Email' },
  { value: 'occasion', label: 'Occasion (this schedule)' },
  { value: 'extra_fields.business_name', label: 'Business Name (CSV field)' },
];

const BLANK_ENTRY = { type: 'custom', value: '' };

// WhatsApp templates already wrap {{n}} in their own *bold*/_italic_/~strike~
// markers. A custom value that also contains one of those characters (e.g.
// typing "*Holi") collides with the template's own marker at send time and
// shows up as a stray/mismatched asterisk (e.g. "**Holi*") — so these
// characters aren't allowed in custom variable text at all.
const stripMarkupChars = (value) => value.replace(/[*_~`]/g, '');

// Renders one row per {{n}} body variable (+ 1 header row iff the template's
// header format is TEXT and its header text itself contains a variable).
export default function VariableMapper({ template, variableMapping, onChange }) {
  const bodyCount = template?.body_variable_count || 0;
  const hasHeaderVariable = template?.header_variable_present;

  // Every {{n}} must be explicitly mapped by the admin — no automatic default
  // (e.g. always "Client Name"), otherwise multiple variables silently end up
  // with the same value (this previously made {{2}}, meant for the occasion,
  // resolve to the client's name because both were auto-defaulted the same
  // way). Missing entries are seeded blank so Meta always gets the right
  // *count* of parameters (avoiding error 132000), while the *value* of each
  // one is always a deliberate choice.
  useEffect(() => {
    if (!template) return;
    const requiredKeys = [
      ...(hasHeaderVariable ? ['header'] : []),
      ...Array.from({ length: bodyCount }, (_, i) => String(i + 1)),
    ];
    const missing = requiredKeys.filter((k) => !variableMapping[k]);
    if (missing.length === 0) return;
    const patch = {};
    missing.forEach((k) => { patch[k] = { ...BLANK_ENTRY }; });
    onChange({ ...variableMapping, ...patch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.name, bodyCount, hasHeaderVariable]);

  if (!template) return null;

  const setEntry = (key, entry) => {
    onChange({ ...variableMapping, [key]: entry });
  };

  const renderRow = (key, label, exampleValue) => {
    const entry = variableMapping[key] || BLANK_ENTRY;
    const isUnset = !entry.value;
    return (
      <div key={key} className={`flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg ${isUnset ? 'bg-amber-50/60' : ''}`}>
        <span className="text-xs font-mono font-semibold text-gray-500 w-16 shrink-0">{label}</span>
        <select
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
          value={entry.type}
          onChange={(e) => setEntry(key, { type: e.target.value, value: '' })}
        >
          <option value="field">Client field</option>
          <option value="custom">Custom value</option>
        </select>
        {entry.type === 'field' ? (
          <select
            className={`flex-1 text-sm border rounded-lg px-2 py-1.5 bg-white ${isUnset ? 'border-amber-300' : 'border-gray-200'}`}
            value={entry.value}
            onChange={(e) => setEntry(key, { type: 'field', value: e.target.value })}
          >
            <option value="" disabled>Choose a field…</option>
            {FIELD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            className={`flex-1 text-sm border rounded-lg px-2 py-1.5 ${isUnset ? 'border-amber-300' : 'border-gray-200'}`}
            placeholder={exampleValue ? `e.g. ${exampleValue}` : 'Enter a value'}
            value={entry.value}
            onChange={(e) => setEntry(key, { type: 'custom', value: stripMarkupChars(e.target.value) })}
          />
        )}
        {isUnset && <span className="text-[10px] font-semibold text-amber-600 shrink-0">Required</span>}
      </div>
    );
  };

  const exampleParams = template.example_body_params || [];

  return (
    <div className="divide-y divide-gray-100">
      {hasHeaderVariable && renderRow('header', 'Header', null)}
      {Array.from({ length: bodyCount }, (_, i) => i + 1).map((n) =>
        renderRow(String(n), `{{${n}}}`, exampleParams[n - 1])
      )}
      {bodyCount === 0 && !hasHeaderVariable && (
        <p className="text-xs text-gray-400 py-2">This template has no variables to map.</p>
      )}
    </div>
  );
}
