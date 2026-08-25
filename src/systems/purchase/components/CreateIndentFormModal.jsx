import { useEffect, useState } from 'react';
import supabase from '../../../SupabaseClient';
import { createIndentsManualBulk, previewIndentsManualBulk } from '../services/purchaseService';

export default function CreateIndentFormModal({ onClose, onSaved }) {
    const [items, setItems] = useState([
        { vendor: '', category: '', unit: 'Pcs.', parent_group: '', conversion_unit: '', order_formula: '', item_details: '', alt_unit: '', shelf_capacity: '', max_level_qty: '', rol_qty: '', cl_qty: '' }
    ]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [showErrorPopup, setShowErrorPopup] = useState(false);
    const [step, setStep] = useState('input'); // 'input' or 'review'
    const [previewData, setPreviewData] = useState({ toCreate: [], toSkip: [] });

    const [existingItemsDB, setExistingItemsDB] = useState([]);

    useEffect(() => {
        let isMounted = true;
        async function loadExistingItems() {
            try {
                const { data, error } = await supabase
                    .from('purchase_indents')
                    .select('item_details, category, vendor, unit, alt_unit, parent_group, shelf_capacity, max_level_qty, rol_qty, cl_qty, conversion_unit, order_formula')
                    .order('created_at', { ascending: false });
                if (error) throw error;
                const uniqueMap = {};
                (data || []).forEach(row => {
                    const name = String(row.item_details || '').trim();
                    if (name && !uniqueMap[name]) {
                        uniqueMap[name] = row;
                    }
                });
                if (isMounted) {
                    setExistingItemsDB(Object.values(uniqueMap));
                }
            } catch (err) {
                console.error('Error fetching existing items for prefill:', err);
            }
        }
        loadExistingItems();
        return () => { isMounted = false; };
    }, []);

    const updateItem = (index, key, val) => {
        setItems((prev) => {
            const copy = [...prev];
            copy[index] = { ...copy[index], [key]: val };
            return copy;
        });
    };

    const handleItemNameChange = (index, val) => {
        updateItem(index, 'item_details', val);
        const matched = existingItemsDB.find(dbItem => String(dbItem.item_details || '').trim().toLowerCase() === String(val || '').trim().toLowerCase());
        if (matched) {
            setItems((prev) => {
                const copy = [...prev];
                copy[index] = {
                    ...copy[index],
                    vendor: matched.vendor || copy[index].vendor,
                    category: matched.category || copy[index].category,
                    unit: matched.unit || copy[index].unit,
                    alt_unit: matched.alt_unit || copy[index].alt_unit,
                    parent_group: matched.parent_group || copy[index].parent_group,
                    shelf_capacity: matched.shelf_capacity || copy[index].shelf_capacity,
                    max_level_qty: matched.max_level_qty !== null ? String(matched.max_level_qty) : copy[index].max_level_qty,
                    rol_qty: matched.rol_qty !== null ? String(matched.rol_qty) : copy[index].rol_qty,
                    cl_qty: matched.cl_qty !== null ? String(matched.cl_qty) : copy[index].cl_qty,
                    conversion_unit: matched.conversion_unit || copy[index].conversion_unit,
                    order_formula: matched.order_formula !== null ? String(matched.order_formula) : copy[index].order_formula,
                };
                return copy;
            });
        }
    };

    const addItem = () => {
        setItems((prev) => [
            ...prev,
            { vendor: '', category: '', unit: 'Pcs.', parent_group: '', conversion_unit: '', order_formula: '', item_details: '', alt_unit: '', shelf_capacity: '', max_level_qty: '', rol_qty: '', cl_qty: '' }
        ]);
    };

    const removeItem = (index) => {
        setItems((prev) => prev.filter((_, i) => i !== index));
    };

    async function handleReview(e) {
        e.preventDefault();
        setError('');
        try {
            const missingVendor = items.find(it => !it.vendor || !it.vendor.trim());
            if (missingVendor) {
                const errMsg = 'Vendor Name is required for all items.';
                setError(errMsg);
                setShowErrorPopup(true);
                return;
            }
            const invalidItem = items.find(it => !it.item_details || !it.item_details.trim());
            if (invalidItem) {
                const errMsg = 'Item Name is required for all items.';
                setError(errMsg);
                setShowErrorPopup(true);
                return;
            }
            setSaving(true);
            const data = await previewIndentsManualBulk(null, items);
            setPreviewData(data);
            setStep('review');
        } catch (err) {
            console.error("Error reviewing manual indents:", err);
            const errMsg = err.message || 'Failed to preview indents.';
            setError(errMsg);
            setShowErrorPopup(true);
        } finally {
            setSaving(false);
        }
    }

    async function handleFinalSubmit() {
        setError('');
        setSaving(true);
        try {
            if (previewData.toCreate.length === 0) {
                setError('No new indents to create.');
                setShowErrorPopup(true);
                setSaving(false);
                return;
            }
            await createIndentsManualBulk(null, previewData.toCreate);
            onSaved();
        } catch (err) {
            console.error("Error saving manual indents:", err);
            const errMsg = err.message || 'Failed to save indents.';
            setError(errMsg);
            setShowErrorPopup(true);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] border border-blue-50 overflow-hidden">
                {/* Header — sticky */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-4 flex justify-between items-center border-b border-blue-50 flex-shrink-0">
                    <h3 className="font-black text-gray-900 text-lg">Add Indents</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
                        <span className="text-xl font-bold">×</span>
                    </button>
                </div>
                <form onSubmit={step === 'input' ? handleReview : (e) => { e.preventDefault(); handleFinalSubmit(); }} className="flex flex-col flex-1 min-h-0">
                    {step === 'input' ? (
                        /* Scrollable fields */
                        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
                            {/* List of items */}
                            <div className="space-y-4">
                                {items.map((item, index) => (
                                    <div key={index} className="relative p-5 bg-gray-50/50 border border-gray-155 rounded-2xl space-y-4">
                                        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                            <span className="text-xs font-bold text-gray-700">Item #{index + 1}</span>
                                            {items.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(index)}
                                                    className="text-[11px] font-bold text-rose-500 hover:underline"
                                                >
                                                    Remove Item
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Left half UI section */}
                                            <div className="space-y-4">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                                        Item Name <span className="text-rose-500">*</span>
                                                    </label>
                                                    <ComboSelect
                                                        table="purchase_indents"
                                                        column="item_details"
                                                        value={item.item_details}
                                                        onChange={(val) => handleItemNameChange(index, val)}
                                                        label="Item Name"
                                                        placeholder="Select or enter item name"
                                                    />
                                                </div>

                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Category</label>
                                                    <ComboSelect
                                                        table="purchase_indents"
                                                        column="category"
                                                        value={item.category}
                                                        onChange={(val) => updateItem(index, 'category', val)}
                                                        label="Category"
                                                        disableCustom={true}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                                        Vendor Name <span className="text-rose-500">*</span>
                                                    </label>
                                                    <ComboSelect
                                                        table="vendors"
                                                        column="name"
                                                        value={item.vendor}
                                                        onChange={(val) => updateItem(index, 'vendor', val)}
                                                        label="Vendor"
                                                        placeholder="Select vendor name"
                                                        disableCustom={true}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Parent Group</label>
                                                    <ComboSelect
                                                        table="purchase_indents"
                                                        column="parent_group"
                                                        value={item.parent_group}
                                                        onChange={(val) => updateItem(index, 'parent_group', val)}
                                                        label="Parent Group"
                                                        disableCustom={true}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Unit</label>
                                                    <ComboSelect
                                                        table="purchase_indents"
                                                        column="unit"
                                                        value={item.unit}
                                                        onChange={(val) => updateItem(index, 'unit', val)}
                                                        label="Unit"
                                                    />
                                                </div>
                                            </div>

                                            {/* Right half UI section */}
                                            <div className="space-y-4">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Shelf Capacity</label>
                                                    <input
                                                        type="text"
                                                        value={item.shelf_capacity || ''}
                                                        onChange={(e) => updateItem(index, 'shelf_capacity', e.target.value)}
                                                        placeholder="Shelf Capacity"
                                                        className="w-full px-4 py-3 bg-white border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Max Level Qty</label>
                                                    <input
                                                        type="text"
                                                        value={item.max_level_qty || ''}
                                                        onChange={(e) => updateItem(index, 'max_level_qty', e.target.value)}
                                                        placeholder="Max Level Qty"
                                                        className="w-full px-4 py-3 bg-white border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">ROL Qty</label>
                                                    <input
                                                        type="text"
                                                        value={item.rol_qty || ''}
                                                        onChange={(e) => updateItem(index, 'rol_qty', e.target.value)}
                                                        placeholder="ROL Qty"
                                                        className="w-full px-4 py-3 bg-white border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                                    />
                                                </div>
                                                <div className="space-y-1 text-gray-800">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Order Qty</label>
                                                    <input
                                                        type="text"
                                                        value={item.order_formula}
                                                        onChange={(e) => updateItem(index, 'order_formula', e.target.value)}
                                                        placeholder="Order Qty"
                                                        className="w-full px-4 py-3 bg-white border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        {index === items.length - 1 && (
                                            <div className="flex justify-end pt-2">
                                                <button
                                                    type="button"
                                                    onClick={addItem}
                                                    className="rounded-2xl bg-blue-600 hover:bg-blue-700 px-5 py-3 text-xs font-bold text-white transition flex items-center gap-1 shadow-md shadow-blue-200"
                                                >
                                                    ➕ Add Another Item
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {error && <div className="mt-3 text-xs font-semibold text-rose-600 text-center">{error}</div>}
                        </div>
                    ) : (
                        /* Review step panel */
                        <div className="overflow-y-auto flex-1 px-6 py-6 space-y-6">
                            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs font-semibold text-blue-800 leading-relaxed">
                                Review your indents before final submission. Duplicate active indents will be skipped to prevent duplicates.
                            </div>

                            {/* To Create list */}
                            <div>
                                <h4 className="text-xs font-black text-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <span>New Indents to Create ({previewData.toCreate.length})</span>
                                </h4>
                                {previewData.toCreate.length === 0 ? (
                                    <div className="text-xs text-gray-500 italic p-3 bg-gray-50 rounded-xl border border-gray-200">No new indents to create.</div>
                                ) : (
                                    <div className="overflow-hidden border border-gray-200 rounded-xl">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                                                    <th className="px-3 py-2">Item Name</th>
                                                    <th className="px-3 py-2">Vendor</th>
                                                    <th className="px-3 py-2">Qty</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {previewData.toCreate.map((it, idx) => (
                                                    <tr key={idx} className="border-t border-gray-100 font-semibold text-gray-800">
                                                        <td className="px-3 py-2">{it.item_details}</td>
                                                        <td className="px-3 py-2 text-gray-600">{it.vendor}</td>
                                                        <td className="px-3 py-2 font-bold text-gray-900">{it.order_formula}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* To Skip list */}
                            {previewData.toSkip.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-black text-rose-700 uppercase tracking-wider mb-2">
                                        Duplicate Indents to Skip ({previewData.toSkip.length})
                                    </h4>
                                    <div className="overflow-hidden border border-rose-100 rounded-xl">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-rose-50/50 border-b border-rose-100 text-rose-700 font-bold uppercase tracking-wider text-[10px]">
                                                    <th className="px-3 py-2">Item Name</th>
                                                    <th className="px-3 py-2">Vendor</th>
                                                    <th className="px-3 py-2">Existing Indent No.</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {previewData.toSkip.map((it, idx) => (
                                                    <tr key={idx} className="border-t border-rose-50/50 font-semibold text-rose-900 bg-rose-50/20">
                                                        <td className="px-3 py-2">{it.item_details}</td>
                                                        <td className="px-3 py-2 text-rose-700/80">{it.vendor}</td>
                                                        <td className="px-3 py-2 font-bold text-rose-600">{it.uniqueNo}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {error && <div className="mt-3 text-xs font-semibold text-rose-600 text-center">{error}</div>}
                        </div>
                    )}

                    {/* Footer — sticky */}
                    <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex-shrink-0">
                        {step === 'input' ? (
                            <>
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
                                    className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-2.5 text-xs font-bold text-white disabled:opacity-60 shadow-md shadow-blue-200"
                                >
                                    {saving ? 'Loading…' : 'Next: Review'}
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setError('');
                                        setStep('input');
                                    }}
                                    className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
                                >
                                    Back
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving || previewData.toCreate.length === 0}
                                    className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50 shadow-md shadow-emerald-200 animate-pulse"
                                >
                                    {saving ? 'Saving…' : 'Confirm & Submit'}
                                </button>
                            </>
                        )}
                    </div>
                </form>
            </div>

            {/* Error Alert Modal Popup */}
            {showErrorPopup && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowErrorPopup(false)}></div>
                    <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md border border-rose-100 overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 text-center space-y-4">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                                <span className="text-xl font-bold">⚠️</span>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">Submission Error</h3>
                            <p className="text-xs text-gray-600 leading-relaxed font-semibold">{error}</p>
                            <button
                                type="button"
                                onClick={() => setShowErrorPopup(false)}
                                className="w-full rounded-2xl bg-rose-600 hover:bg-rose-700 py-3 text-xs font-bold text-white transition shadow-lg shadow-rose-200"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
function ComboSelect({ table, column, value, onChange, label, placeholder, disableCustom }) {
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
        return <div className="px-4 py-2 text-xs text-gray-400 bg-gray-50 border border-gray-155 rounded-xl">Loading...</div>;
    }

    return (
        <div className="space-y-2">
            <select
                value={showCustomInput ? '__custom__' : value || ''}
                onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__custom__') {
                        setShowCustomInput(true);
                        setCustomValue('');
                        onChange('');
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
                {!disableCustom && <option value="__custom__">➕ Type Custom Value...</option>}
            </select>

            {!disableCustom && showCustomInput && (
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
