import { useEffect, useState } from 'react';
import supabase from '../../../SupabaseClient';
import { createIndentsManualBulk } from '../services/purchaseService';

export default function CreateIndentFormModal({ onClose, onSaved }) {
    const [vendor, setVendor] = useState('');
    const [items, setItems] = useState([
        { category: '', unit: 'Pcs.', parent_group: '', conversion_unit: '', order_formula: '', item_details: '', qty: '' }
    ]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const updateItem = (index, key, val) => {
        setItems((prev) => {
            const copy = [...prev];
            copy[index] = { ...copy[index], [key]: val };
            return copy;
        });
    };

    const addItem = () => {
        setItems((prev) => [
            ...prev,
            { category: '', unit: 'Pcs.', parent_group: '', conversion_unit: '', order_formula: '', item_details: '', qty: '' }
        ]);
    };

    const removeItem = (index) => {
        setItems((prev) => prev.filter((_, i) => i !== index));
    };

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        if (!vendor) {
            setError('Vendor Name is required.');
            return;
        }
        const invalidItem = items.find(it => !it.item_details.trim());
        if (invalidItem) {
            setError('Item Name is required for all items.');
            return;
        }
        setSaving(true);
        try {
            await createIndentsManualBulk(vendor, items);
            onSaved();
        } catch (err) {
            setError(err.message || 'Failed to save indents.');
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
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    {/* Scrollable fields */}
                    <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
                        {/* Vendor Select at very top */}
                        <div className="bg-blue-50/40 p-5 rounded-2xl border border-blue-100/50 space-y-2">
                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                                Vendor Name <span className="text-rose-500">*</span>
                            </label>
                            <ComboSelect
                                table="vendors"
                                column="name"
                                value={vendor}
                                onChange={(val) => setVendor(val)}
                                label="Vendor"
                                placeholder="Enter vendor name"
                            />
                        </div>

                        {/* List of items */}
                        <div className="space-y-4">
                            {items.map((item, index) => (
                                <div key={index} className="relative p-5 bg-gray-50/50 border border-gray-150 rounded-2xl space-y-4">
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

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Category</label>
                                            <ComboSelect
                                                table="purchase_indents"
                                                column="category"
                                                value={item.category}
                                                onChange={(val) => updateItem(index, 'category', val)}
                                                label="Category"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Unit</label>
                                            <ComboSelect
                                                table="purchase_indents"
                                                column="unit"
                                                value={item.unit}
                                                onChange={(val) => updateItem(index, 'unit', val)}
                                                label="Unit"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Parent Group</label>
                                            <ComboSelect
                                                table="purchase_indents"
                                                column="parent_group"
                                                value={item.parent_group}
                                                onChange={(val) => updateItem(index, 'parent_group', val)}
                                                label="Parent Group"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Conversion Unit</label>
                                            <ComboSelect
                                                table="purchase_indents"
                                                column="conversion_unit"
                                                value={item.conversion_unit}
                                                onChange={(val) => updateItem(index, 'conversion_unit', val)}
                                                label="Conversion Unit"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Order Formula</label>
                                            <input
                                                type="text"
                                                value={item.order_formula}
                                                onChange={(e) => updateItem(index, 'order_formula', e.target.value)}
                                                placeholder="Order formula"
                                                className="w-full px-4 py-3 bg-white border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                            />
                                        </div>
                                        <div className="space-y-1 md:col-span-2">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Item Name <span className="text-rose-500">*</span></label>
                                            <input
                                                type="text"
                                                value={item.item_details}
                                                onChange={(e) => updateItem(index, 'item_details', e.target.value)}
                                                placeholder="Enter item name"
                                                className="w-full px-4 py-3 bg-white border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Qty</label>
                                            <input
                                                type="text"
                                                value={item.qty}
                                                onChange={(e) => updateItem(index, 'qty', e.target.value)}
                                                placeholder="Enter quantity"
                                                className="w-full px-4 py-3 bg-white border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Plus Option in last */}
                        <div className="flex justify-center pt-2">
                            <button
                                type="button"
                                onClick={addItem}
                                className="inline-flex items-center gap-2 rounded-xl border border-dashed border-blue-300 px-6 py-3 text-xs font-bold text-blue-600 hover:bg-blue-50 transition"
                            >
                                ➕ Add Another Item (Same Vendor)
                            </button>
                        </div>

                        {error && <div className="mt-3 text-xs font-semibold text-rose-600 text-center">{error}</div>}
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
