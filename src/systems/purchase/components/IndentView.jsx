import { Loader2, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CardPanel, EmptyState, FilterBar, StatusBadge } from './ui';
import { uniqueValues } from '../utils/helpers';
import { fetchIndents, createIndentManual } from '../services/purchaseService';
import supabase from '../../../SupabaseClient';
import ImportView from './ImportView';
import { fetchTatTracking, renderPlannedDateCell, fetchTatSettings } from '../../../core/services/tatService';

export default function IndentView({ onTabChange, refreshKey, onImported }) {
  const [indents, setIndents] = useState([]);
  const [tatTracking, setTatTracking] = useState({});
  const [tatMins, setTatMins] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [vendor, setVendor] = useState('');
  const [status, setStatus] = useState('');
  const [expanded, setExpanded] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  const toggleVendor = (v) => {
    setExpanded((prev) => ({ ...prev, [v]: !prev[v] }));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchIndents()
      .then(async (rows) => {
        if (cancelled) return;
        setIndents(rows);

        const dbIds = rows.map(r => r.dbId);
        if (dbIds.length > 0) {
          try {
            const trackings = await fetchTatTracking('indent_approval', dbIds);
            const trackingMap = {};
            trackings.forEach(t => {
              trackingMap[t.entity_id] = t;
            });
            if (!cancelled) setTatTracking(trackingMap);
          } catch (tatErr) {
            console.error('Failed to load TAT tracking:', tatErr);
          }
        }

        try {
          const settingsData = await fetchTatSettings();
          const setting = settingsData.find(s => s.stage_key === 'indent_approval');
          if (setting && setting.is_active) {
            setTatMins(setting.tat_minutes);
          }
        } catch (settingsErr) {
          console.error('Failed to load TAT settings:', settingsErr);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load indent data.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const categories = useMemo(() => uniqueValues(indents, 'category'), [indents]);
  const vendors = useMemo(() => uniqueValues(indents, 'vendor'), [indents]);

  const rows = useMemo(() => {
    const term = search.toLowerCase().trim();
    return indents.filter((i) => {
      if (term && !`${i.itemDetails} ${i.vendor} ${i.category}`.toLowerCase().includes(term)) return false;
      if (category && i.category !== category) return false;
      if (vendor && i.vendor !== vendor) return false;
      if (status && i.status !== status) return false;
      return true;
    });
  }, [indents, search, category, vendor, status]);

  const groups = useMemo(() => {
    const g = {};
    rows.forEach((i) => {
      const v = i.vendor || 'Unspecified Vendor';
      (g[v] = g[v] || []).push(i);
    });
    return g;
  }, [rows]);

  const clear = () => {
    setSearch('');
    setCategory('');
    setVendor('');
    setStatus('');
  };

  return (
    <CardPanel
      title="Indent Data"
      desc="Every item imported from Excel or added manually, with its generated Unique Number."
      action={
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:from-blue-700 hover:to-purple-700 transition"
          >
            Create Indent
          </button>
          <ImportView onImported={onImported} />
        </div>
      }
    >
      <FilterBar onClear={clear}>
        <input
          type="text"
          placeholder="Search item, vendor..."
          className="min-w-[150px] flex-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-[12.5px]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="min-w-[130px] rounded-lg border border-gray-300 px-2.5 py-1.5 text-[12.5px]" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select className="min-w-[130px] rounded-lg border border-gray-300 px-2.5 py-1.5 text-[12.5px]" value={vendor} onChange={(e) => setVendor(e.target.value)}>
          <option value="">All Vendors</option>
          {vendors.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <select className="min-w-[130px] rounded-lg border border-gray-300 px-2.5 py-1.5 text-[12.5px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>
      </FilterBar>

      {loading ? (
        <EmptyState icon={<Loader2 size={36} className="animate-spin" />}>Loading indent data…</EmptyState>
      ) : error ? (
        <EmptyState icon={<FileText size={36} />}>{error}</EmptyState>
      ) : indents.length === 0 ? (
        <EmptyState icon={<FileText size={36} />} action={
          <button className="mt-3 rounded-lg bg-[#173254] px-4 py-2 text-sm font-semibold text-white" onClick={() => onTabChange('import')}>
            Import Indent
          </button>
        }>
          No indent data yet. Import an Excel file to get started.
        </EmptyState>
      ) : (
        <>
          {Object.keys(groups).sort().map((v) => {
            const items = groups[v];
            const isOpen = !!expanded[v];
            return (
              <div key={v} className="mb-3 overflow-hidden rounded-xl border border-gray-200">
                <button
                  type="button"
                  onClick={() => toggleVendor(v)}
                  className="flex w-full items-center justify-between gap-2 bg-gray-50 px-3.5 py-2.5 text-left hover:bg-gray-100"
                >
                  <span className="flex items-center gap-1.5 text-[13px] font-bold text-[#173254]">
                    {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    {v}
                    <span className="font-normal text-gray-500">({items.length} item{items.length > 1 ? 's' : ''})</span>
                  </span>
                </button>
                {isOpen && (
                  <div className="overflow-x-auto border-t border-gray-200">
                    <table className="w-full text-[12.6px]">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500">
                          {['Unique No.', 'Item Details', 'Category', 'Vendor', 'Unit', 'Parent Group', 'Shelf Cap.', 'Max Level', 'ROL Qty', 'Cl. Qty', 'Conv. Unit', 'Order Formula', 'Status', 'Planned Date'].map((h) => (
                            <th key={h} className="whitespace-nowrap border-b border-gray-200 px-2.5 py-2 text-left text-[10.3px] font-bold uppercase tracking-wide">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((i) => (
                          <tr key={i.dbId} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="px-2.5 py-2 font-semibold">{i.id}</td>
                            <td className="px-2.5 py-2">{i.itemDetails}</td>
                            <td className="px-2.5 py-2">{i.category}</td>
                            <td className="px-2.5 py-2">{i.vendor}</td>
                            <td className="px-2.5 py-2">{i.unit}</td>
                            <td className="px-2.5 py-2">{i.parentGroup}</td>
                            <td className="px-2.5 py-2">{i.shelfCapacity}</td>
                            <td className="px-2.5 py-2">{i.maxLevelQty}</td>
                            <td className="px-2.5 py-2">{i.rolQty}</td>
                            <td className="px-2.5 py-2">{i.clQty}</td>
                            <td className="px-2.5 py-2">{i.conversionUnit}</td>
                            <td className="px-2.5 py-2 font-semibold">{i.orderFormula}</td>
                            <td className="px-2.5 py-2"><StatusBadge status={i.status} /></td>
                            <td className="px-2.5 py-2">{renderPlannedDateCell(tatTracking[i.dbId], i.createdAt, tatMins)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
          <div className="mt-2 text-sm text-gray-500">
            Showing {rows.length} of {indents.length} item(s) across {Object.keys(groups).length} vendor(s).
          </div>
        </>
      )}
      {showAddModal && (
        <AddIndentModal
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            setShowAddModal(false);
            onImported();
          }}
        />
      )}
    </CardPanel>
  );
}

function AddIndentModal({ onClose, onSaved }) {
    const [form, setForm] = useState({
        item_details: '',
        category: '',
        vendor: '',
        unit: 'Pcs.',
        alt_unit: '',
        parent_group: '',
        shelf_capacity: '',
        max_level_qty: '',
        rol_qty: '',
        cl_qty: '',
        conversion_unit: '',
        order_formula: '',
        status: 'Pending',
        remarks: '',
        approved_qty: '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const update = (key, val) => {
        setForm((prev) => ({ ...prev, [key]: val }));
    };

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        if (!form.item_details.trim()) {
            setError('Item Name is required.');
            return;
        }
        setSaving(true);
        try {
            await createIndentManual(form);
            onSaved();
        } catch (err) {
            setError(err.message || 'Failed to save indent.');
        } finally {
            setSaving(false);
        }
    }

    const fields = [
        { key: 'item_details', label: 'Item Name', placeholder: 'Enter item name', required: true },
        { key: 'category', label: 'Category', placeholder: 'Enter category', comboTable: 'purchase_indents', comboColumn: 'category' },
        { key: 'vendor', label: 'Vendor Name', placeholder: 'Enter vendor name', comboTable: 'vendors', comboColumn: 'name' },
        { key: 'unit', label: 'Unit', placeholder: 'Enter unit', comboTable: 'purchase_indents', comboColumn: 'unit' },
        { key: 'parent_group', label: 'Parent Group', placeholder: 'Enter parent group', comboTable: 'purchase_indents', comboColumn: 'parent_group' },
        { key: 'alt_unit', label: 'Alt Unit', placeholder: 'Enter alt unit' },
        { key: 'shelf_capacity', label: 'Shelf Capacity', placeholder: 'Enter shelf capacity' },
        { key: 'max_level_qty', label: 'Max Level Qty', placeholder: 'Enter max level qty' },
        { key: 'rol_qty', label: 'ROL Qty', placeholder: 'Enter ROL qty' },
        { key: 'cl_qty', label: 'CL Qty', placeholder: 'Enter CL qty' },
        { key: 'conversion_unit', label: 'Conversion Unit', placeholder: 'Enter conversion unit' },
        { key: 'order_formula', label: 'Order Formula', placeholder: 'Enter order formula' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] border border-blue-50 overflow-hidden">
                {/* Header — sticky */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-4 flex justify-between items-center border-b border-blue-50 flex-shrink-0">
                    <h3 className="font-black text-gray-900 text-lg">Add Indent</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
                        <span className="text-xl font-bold">×</span>
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    {/* Scrollable fields */}
                    <div className="overflow-y-auto flex-1 px-6 py-5">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                            {fields.map((f) => (
                                <div key={f.key} className={`space-y-1 ${f.key === 'remarks' || f.key === 'item_details' ? 'col-span-2' : ''}`}>
                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                        {f.label} {f.required && <span className="text-rose-500">*</span>}
                                    </label>

                                    {f.options ? (
                                        <select
                                            value={form[f.key]}
                                            onChange={(e) => update(f.key, e.target.value)}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                                        >
                                            {f.options.map((opt) => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    ) : f.comboTable ? (
                                        <ComboSelect
                                            table={f.comboTable}
                                            column={f.comboColumn}
                                            value={form[f.key]}
                                            onChange={(val) => update(f.key, val)}
                                            label={f.label}
                                            placeholder={f.placeholder}
                                        />
                                    ) : f.isTextArea ? (
                                        <textarea
                                            rows={2}
                                            value={form[f.key]}
                                            onChange={(e) => update(f.key, e.target.value)}
                                            placeholder={f.placeholder}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all resize-none"
                                        />
                                    ) : (
                                        <input
                                            type="text"
                                            value={form[f.key]}
                                            onChange={(e) => update(f.key, e.target.value)}
                                            placeholder={f.placeholder || ''}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                                        />
                                    )}
                                </div>
                            ))}
                        </div>

                        {error && <div className="mt-3 text-xs font-semibold text-rose-600">{error}</div>}
                    </div>

                    {/* Footer — sticky */}
                    <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex-shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-2.5 text-xs font-bold text-white disabled:opacity-60"
                        >
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function ComboSelect({ table, column, value, onChange, label, placeholder }) {
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [customValue, setCustomValue] = useState(value || '');

    useEffect(() => {
        let isMounted = true;
        async function fetchOptions() {
            try {
                const targetColumn = table === 'vendors' ? 'name' : column;
                const { data, error } = await supabase
                    .from(table)
                    .select(targetColumn);
                if (error) throw error;
                const vals = Array.from(
                    new Set((data || []).map((r) => r[targetColumn]).filter(Boolean))
                ).sort();
                if (isMounted) {
                    setOptions(vals);
                    setLoading(false);
                    if (value && !vals.includes(value)) {
                        setShowCustomInput(true);
                        setCustomValue(value);
                    }
                }
            } catch (err) {
                console.error(err);
                if (isMounted) setLoading(false);
            }
        }
        fetchOptions();
        return () => { isMounted = false; };
    }, [table, column, value]);

    if (loading) {
        return <div className="px-4 py-3 text-xs text-gray-400 bg-gray-50 border border-gray-150 rounded-2xl">Loading {label || column}...</div>;
    }

    return (
        <div className="space-y-2">
            <select
                value={showCustomInput ? '__custom__' : value || ''}
                onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__custom__') {
                        setShowCustomInput(true);
                        onChange(customValue);
                    } else {
                        setShowCustomInput(false);
                        onChange(val);
                    }
                }}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            >
                <option value="">Select {label || column}</option>
                {options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                ))}
                <option value="__custom__">➕ Type Custom Value...</option>
            </select>

            {showCustomInput && (
                <input
                    type="text"
                    value={customValue}
                    onChange={(e) => {
                        const val = e.target.value;
                        setCustomValue(val);
                        onChange(val);
                    }}
                    placeholder={placeholder || `Enter custom ${label || column}`}
                    className="w-full px-4 py-3 bg-white border border-blue-400 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
            )}
        </div>
    );
}
