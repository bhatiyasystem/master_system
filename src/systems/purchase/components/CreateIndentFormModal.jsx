import { useEffect, useState, useRef, useMemo } from 'react';
import Fuse from 'fuse.js';
import { UploadCloud, X, Image as ImageIcon } from 'lucide-react';
import supabase from '../../../SupabaseClient';
import { createIndentsManualBulk, previewIndentsManualBulk, fetchActiveIndentsPool } from '../services/purchaseService';

const DEFAULT_ITEM = {
    vendor: '',
    category: '',
    unit: 'Pcs.',
    parent_group: '',
    conversion_unit: '',
    order_formula: '',
    order_qty: '',
    item_details: '',
    alt_unit: '',
    shelf_capacity: '',
    max_level_qty: '',
    rol_qty: '',
    reorder_level: '',
    cl_qty: '',
    orderQtyRequired: false,
    online_item_name: '',
    min_order_qty: '',
    eligible_for_online: 'No',
    item_description: '',
    image_url: '',
    image_urls: [],
    variant_available: 'No',
};

export default function CreateIndentFormModal({ onClose, onSaved, mode = 'master' }) {
    const isPurchaseMode = mode === 'purchase';
    const [items, setItems] = useState([{ ...DEFAULT_ITEM }]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [showErrorPopup, setShowErrorPopup] = useState(false);
    const [step, setStep] = useState('input'); // 'input' or 'review'
    const [previewData, setPreviewData] = useState({ toCreate: [], toSkip: [] });
    const [existingItemsDB, setExistingItemsDB] = useState([]);
    const [vendorOptions, setVendorOptions] = useState([]);
    const [activePool, setActivePool] = useState({});
    const [normalizeFn, setNormalizeFn] = useState(() => (val) => String(val || '').trim().toLowerCase().replace(/\s+/g, ' '));

    useEffect(() => {
        let isMounted = true;
        async function loadData() {
            try {
                // Paginated fetch of all master items from purchase_indents
                const fetchAllMasterIndents = async () => {
                    const all = [];
                    let from = 0;
                    while (true) {
                        const { data, error } = await supabase
                            .from('purchase_indents')
                            .select('item_details, category, vendor, unit, alt_unit, parent_group, shelf_capacity, max_level_qty, rol_qty, cl_qty, conversion_unit, order_formula, online_item_name, min_order_qty, eligible_for_online, item_description, image_url, variant_available, reorder_level, order_qty')
                            .or('hide_in_master.eq.false,hide_in_master.is.null')
                            .order('created_at', { ascending: false })
                            .range(from, from + 999);
                        if (error) throw error;
                        if (!data || !data.length) break;
                        all.push(...data);
                        if (data.length < 1000) break;
                        from += 1000;
                    }
                    return all;
                };

                const [indentsData, vendorsRes] = await Promise.all([
                    fetchAllMasterIndents(),
                    supabase
                        .from('vendors')
                        .select('name')
                        .order('name', { ascending: true })
                ]);
                if (vendorsRes.error) throw vendorsRes.error;

                const uniqueMap = {};
                (indentsData || []).forEach(row => {
                    const name = String(row.item_details || '').trim();
                    if (!name) return;
                    if (!uniqueMap[name]) {
                        uniqueMap[name] = { ...row };
                    } else {
                        // Merge non-empty values
                        const curr = uniqueMap[name];
                        const keysToMerge = [
                            'category', 'vendor', 'unit', 'alt_unit', 'parent_group',
                            'shelf_capacity', 'max_level_qty', 'rol_qty', 'reorder_level',
                            'cl_qty', 'conversion_unit', 'order_formula', 'order_qty',
                            'online_item_name', 'min_order_qty', 'eligible_for_online',
                            'item_description', 'image_url', 'variant_available'
                        ];
                        keysToMerge.forEach(k => {
                            const ev = curr[k];
                            const rv = row[k];
                            const isEmpty = ev === null || ev === undefined || ev === '' || ev === 0;
                            const hasVal = rv !== null && rv !== undefined && rv !== '' && rv !== 0;
                            if (isEmpty && hasVal) {
                                curr[k] = rv;
                            }
                        });
                    }
                });

                const vNames = (vendorsRes.data || []).map(v => String(v.name || '').trim()).filter(Boolean);
                const { activePool: pool, normalize } = await fetchActiveIndentsPool();

                if (isMounted) {
                    setExistingItemsDB(Object.values(uniqueMap));
                    setVendorOptions(vNames);
                    setActivePool(pool || {});
                    setNormalizeFn(() => normalize);
                }
            } catch (err) {
                console.error('Error fetching existing items/vendors for prefill:', err);
            }
        }
        loadData();
        return () => { isMounted = false; };
    }, []);

    const itemOptions = useMemo(() => {
        return Array.from(new Set(existingItemsDB.map(r => String(r.item_details || '').trim()).filter(Boolean))).sort();
    }, [existingItemsDB]);

    const categoryOptions = useMemo(() => {
        return Array.from(new Set(existingItemsDB.map(r => String(r.category || '').trim()).filter(Boolean))).sort();
    }, [existingItemsDB]);

    const parentGroupOptions = useMemo(() => {
        return Array.from(new Set(existingItemsDB.map(r => String(r.parent_group || '').trim()).filter(Boolean))).sort();
    }, [existingItemsDB]);

    const unitOptions = useMemo(() => {
        return Array.from(new Set(['Pcs.', 'Box', 'Kg', 'Mtr', 'Set', 'Nos.', 'Ltr', ...existingItemsDB.map(r => String(r.unit || '').trim()).filter(Boolean)])).sort();
    }, [existingItemsDB]);

    const updateItem = (index, key, val) => {
        setItems((prev) => {
            const copy = [...prev];
            copy[index] = { ...copy[index], [key]: val };
            return copy;
        });
    };

    const handleItemNameChange = (index, val) => {
        const trimmedVal = String(val || '').trim();
        if (!trimmedVal) {
            setItems(prev => {
                const copy = [...prev];
                copy[index] = { ...copy[index], item_details: val, isNewItem: false };
                return copy;
            });
            return;
        }

        const norm = (s) => String(s || '').trim().toLowerCase().replace(/^[\s*#-]+/, '').replace(/\s+/g, ' ');
        const targetNorm = norm(trimmedVal);
        const targetExact = trimmedVal.toLowerCase();

        const matched = existingItemsDB.find(dbItem => String(dbItem.item_details || '').trim().toLowerCase() === targetExact)
            || existingItemsDB.find(dbItem => norm(dbItem.item_details) === targetNorm);

        setItems((prev) => {
            const copy = [...prev];
            const currentItem = copy[index];
            let updatedVendor = currentItem.vendor;
            if (matched && matched.vendor) {
                const exactVendor = vendorOptions.find(v => v.toLowerCase() === String(matched.vendor || '').trim().toLowerCase());
                updatedVendor = exactVendor || matched.vendor;
            }

            const matchedOrderQty = matched ? (matched.order_qty ?? matched.order_formula) : null;
            const hasOrderQty = matchedOrderQty !== null && matchedOrderQty !== undefined && String(matchedOrderQty).trim() !== '' && String(matchedOrderQty).trim() !== '0';
            const orderQtyVal = hasOrderQty ? String(matchedOrderQty) : '';

            copy[index] = {
                ...currentItem,
                item_details: val,
                vendor: matched ? (updatedVendor || '') : currentItem.vendor,
                category: matched ? (matched.category || '') : currentItem.category,
                unit: matched ? (matched.unit || 'Pcs.') : (currentItem.unit || 'Pcs.'),
                alt_unit: matched ? (matched.alt_unit || '') : currentItem.alt_unit,
                parent_group: matched ? (matched.parent_group || '') : currentItem.parent_group,
                shelf_capacity: matched ? (matched.shelf_capacity !== null && matched.shelf_capacity !== undefined ? String(matched.shelf_capacity) : '') : currentItem.shelf_capacity,
                max_level_qty: matched ? (matched.max_level_qty !== null && matched.max_level_qty !== undefined ? String(matched.max_level_qty) : '') : currentItem.max_level_qty,
                rol_qty: matched ? (matched.rol_qty !== null && matched.rol_qty !== undefined ? String(matched.rol_qty) : (matched.reorder_level !== null && matched.reorder_level !== undefined ? String(matched.reorder_level) : '')) : currentItem.rol_qty,
                reorder_level: matched ? (matched.reorder_level !== null && matched.reorder_level !== undefined ? String(matched.reorder_level) : (matched.rol_qty !== null && matched.rol_qty !== undefined ? String(matched.rol_qty) : '')) : currentItem.reorder_level,
                cl_qty: matched ? (matched.cl_qty !== null && matched.cl_qty !== undefined ? String(matched.cl_qty) : '') : currentItem.cl_qty,
                conversion_unit: matched ? (matched.conversion_unit || '') : currentItem.conversion_unit,
                online_item_name: matched ? (matched.online_item_name || '') : currentItem.online_item_name,
                min_order_qty: matched ? (matched.min_order_qty !== null && matched.min_order_qty !== undefined ? String(matched.min_order_qty) : '') : currentItem.min_order_qty,
                eligible_for_online: matched ? (matched.eligible_for_online || 'No') : currentItem.eligible_for_online,
                item_description: matched ? (matched.item_description || '') : currentItem.item_description,
                image_url: matched ? (matched.image_url || '') : currentItem.image_url,
                image_urls: matched ? (matched.image_url ? [matched.image_url] : []) : currentItem.image_urls,
                variant_available: matched ? (matched.variant_available || 'No') : currentItem.variant_available,
                order_formula: orderQtyVal || (matched ? '' : currentItem.order_formula),
                order_qty: orderQtyVal || (matched ? '' : currentItem.order_qty),
                orderQtyRequired: !orderQtyVal,
                isNewItem: !matched && !!trimmedVal,
            };
            return copy;
        });
    };

    const addItem = () => {
        setItems((prev) => [
            ...prev,
            { ...DEFAULT_ITEM }
        ]);
    };

    const handleImageFiles = async (index, files) => {
        if (!files || files.length === 0) return;
        try {
            const fileList = Array.from(files);
            const uploadedUrls = [];
            for (const file of fileList) {
                const ext = file.name.split('.').pop();
                const fileName = `item-images/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
                const { error: uploadError } = await supabase.storage.from('purchase-builty').upload(fileName, file);
                if (uploadError) throw uploadError;
                const { data } = supabase.storage.from('purchase-builty').getPublicUrl(fileName);
                uploadedUrls.push(data.publicUrl);
            }
            setItems((prev) => {
                const copy = [...prev];
                const currentItem = copy[index];
                const existing = Array.isArray(currentItem.image_urls) && currentItem.image_urls.length
                    ? currentItem.image_urls
                    : (currentItem.image_url ? [currentItem.image_url] : []);
                const combined = [...existing, ...uploadedUrls];
                copy[index] = {
                    ...currentItem,
                    image_urls: combined,
                    image_url: combined[0] || '',
                };
                return copy;
            });
        } catch (err) {
            console.error('Error uploading images:', err);
            setError('Failed to upload images: ' + (err.message || 'Unknown error'));
            setShowErrorPopup(true);
        }
    };

    const removeImage = (itemIndex, imgIndex) => {
        setItems((prev) => {
            const copy = [...prev];
            const currentItem = copy[itemIndex];
            const existing = Array.isArray(currentItem.image_urls) && currentItem.image_urls.length
                ? currentItem.image_urls
                : (currentItem.image_url ? [currentItem.image_url] : []);
            const list = existing.filter((_, i) => i !== imgIndex);
            copy[itemIndex] = {
                ...currentItem,
                image_urls: list,
                image_url: list[0] || '',
            };
            return copy;
        });
    };

    const addImageUrl = (itemIndex, url) => {
        const trimmed = String(url || '').trim();
        if (!trimmed) return;
        setItems((prev) => {
            const copy = [...prev];
            const currentItem = copy[itemIndex];
            const existing = Array.isArray(currentItem.image_urls) && currentItem.image_urls.length
                ? currentItem.image_urls
                : (currentItem.image_url ? [currentItem.image_url] : []);
            const combined = [...existing, trimmed];
            copy[itemIndex] = {
                ...currentItem,
                image_urls: combined,
                image_url: combined[0] || '',
            };
            return copy;
        });
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
            // Validate Order Qty — must be filled and non-zero
            const missingQty = items.find(it => !it.order_formula || !String(it.order_formula).trim() || Number(it.order_formula) === 0);
            if (missingQty) {
                const errMsg = `Order Qty is required and must be greater than 0 for "${missingQty.item_details || 'all items'}". Please fill it before proceeding.`;
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
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header — sticky */}
                <div className={`px-8 pt-6 pb-4 flex justify-between items-center flex-shrink-0 ${isPurchaseMode ? 'bg-white' : 'bg-gradient-to-r from-blue-50 to-purple-50 border-b border-blue-50 px-6 py-4'}`}>
                    <h3 className="font-bold text-gray-900 text-lg">Add Indents</h3>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <span className="text-2xl font-bold leading-none">&times;</span>
                    </button>
                </div>
                <form onSubmit={step === 'input' ? handleReview : (e) => { e.preventDefault(); handleFinalSubmit(); }} className="flex flex-col flex-1 min-h-0">
                    {step === 'input' ? (
                        /* Scrollable fields */
                        <div className="overflow-y-auto flex-1 px-8 py-5 space-y-6">
                            {/* List of items */}
                            <div className="space-y-5">
                                {items.map((item, index) => (
                                    <div
                                        key={index}
                                        className={
                                            isPurchaseMode
                                                ? "relative p-6 bg-white border border-gray-700 rounded-2xl space-y-4"
                                                : "relative p-5 bg-gray-50/50 border border-gray-155 rounded-2xl space-y-4"
                                        }
                                    >
                                        <div className={`flex items-center justify-between ${isPurchaseMode ? '' : 'border-b border-gray-100 pb-2'}`}>
                                            <span className={`font-bold ${isPurchaseMode ? 'text-sm text-gray-800' : 'text-xs text-gray-700'}`}>
                                                Item #{index + 1}
                                            </span>
                                            {items.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(index)}
                                                    className="text-xs font-semibold text-rose-500 hover:underline"
                                                >
                                                    Remove Item
                                                </button>
                                            )}
                                        </div>

                                        {isPurchaseMode ? (
                                            /* Exact 2-column layout for Indent Data matching screenshot */
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                                {/* Left Column (5 fields) */}
                                                <div className="space-y-4">
                                                    {/* ITEM NAME * */}
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                                                            ITEM NAME <span className="text-red-500">*</span>
                                                        </label>
                                                        <ComboSelect
                                                            table="purchase_indents"
                                                            column="item_details"
                                                            value={item.item_details}
                                                            onChange={(val) => handleItemNameChange(index, val)}
                                                            label="Item Name"
                                                            placeholder="Select or enter item name"
                                                            activePool={activePool}
                                                            normalize={normalizeFn}
                                                            options={itemOptions}
                                                            inputClassName="bg-white border border-gray-700 text-gray-800 placeholder-gray-400"
                                                        />
                                                        {item.item_details && item.item_details.trim() && (
                                                            <div className="pt-0.5">
                                                                {item.isNewItem ? (
                                                                    <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-lg shadow-xs">
                                                                        ✨ New item — will be saved to Master automatically
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-lg shadow-xs">
                                                                        ✓ Existing item from Master (details auto-filled)
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* CATEGORY */}
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                                                            CATEGORY
                                                        </label>
                                                        <ComboSelect
                                                            table="purchase_indents"
                                                            column="category"
                                                            value={item.category}
                                                            onChange={(val) => updateItem(index, 'category', val)}
                                                            label="Category"
                                                            placeholder="Search or enter Category..."
                                                            options={categoryOptions}
                                                            inputClassName="bg-white border border-gray-700 text-gray-800 placeholder-gray-400"
                                                        />
                                                    </div>

                                                    {/* VENDOR NAME * */}
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                                                            VENDOR NAME <span className="text-red-500">*</span>
                                                        </label>
                                                        <ComboSelect
                                                            table="vendors"
                                                            column="name"
                                                            value={item.vendor}
                                                            onChange={(val) => updateItem(index, 'vendor', val)}
                                                            label="Vendor"
                                                            placeholder="Select vendor name"
                                                            options={vendorOptions}
                                                            inputClassName="bg-white border border-gray-700 text-gray-800 placeholder-gray-400"
                                                        />
                                                    </div>

                                                    {/* PARENT GROUP */}
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                                                            PARENT GROUP
                                                        </label>
                                                        <ComboSelect
                                                            table="purchase_indents"
                                                            column="parent_group"
                                                            value={item.parent_group}
                                                            onChange={(val) => updateItem(index, 'parent_group', val)}
                                                            label="Parent Group"
                                                            placeholder="Search or enter Parent Group..."
                                                            options={parentGroupOptions}
                                                            inputClassName="bg-white border border-gray-700 text-gray-800 placeholder-gray-400"
                                                        />
                                                    </div>

                                                    {/* UNIT */}
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                                                            UNIT
                                                        </label>
                                                        <ComboSelect
                                                            table="purchase_indents"
                                                            column="unit"
                                                            value={item.unit}
                                                            onChange={(val) => updateItem(index, 'unit', val)}
                                                            label="Unit"
                                                            placeholder="Pcs."
                                                            options={unitOptions}
                                                            inputClassName="bg-white border border-gray-700 text-gray-800 placeholder-gray-400"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Right Column (4 fields + button) */}
                                                <div className="space-y-4 flex flex-col justify-between">
                                                    <div className="space-y-4">
                                                        {/* SHELF CAPACITY */}
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                                                                SHELF CAPACITY
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={item.shelf_capacity || ''}
                                                                onChange={(e) => updateItem(index, 'shelf_capacity', e.target.value)}
                                                                placeholder="Shelf Capacity"
                                                                className="w-full px-4 py-3 bg-white border border-gray-700 rounded-2xl text-xs font-semibold text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                                            />
                                                        </div>

                                                        {/* MAX LEVEL QTY */}
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                                                                MAX LEVEL QTY
                                                            </label>
                                                            <input
                                                                type="number"
                                                                value={item.max_level_qty || ''}
                                                                onChange={(e) => updateItem(index, 'max_level_qty', e.target.value)}
                                                                placeholder="Max Level Qty"
                                                                className="w-full px-4 py-3 bg-white border border-gray-700 rounded-2xl text-xs font-semibold text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                                            />
                                                        </div>

                                                        {/* ROL QTY */}
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                                                                ROL QTY
                                                            </label>
                                                            <input
                                                                type="number"
                                                                value={item.rol_qty || ''}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    updateItem(index, 'rol_qty', val);
                                                                    updateItem(index, 'reorder_level', val);
                                                                }}
                                                                placeholder="ROL Qty"
                                                                className="w-full px-4 py-3 bg-white border border-gray-700 rounded-2xl text-xs font-semibold text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                                            />
                                                        </div>

                                                        {/* ORDER QTY * */}
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                                                                ORDER QTY <span className="text-red-500">*</span>
                                                            </label>
                                                            <input
                                                                type="number"
                                                                value={item.order_formula || item.order_qty || ''}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    updateItem(index, 'order_formula', val);
                                                                    updateItem(index, 'order_qty', val);
                                                                    updateItem(index, 'orderQtyRequired', !val);
                                                                }}
                                                                placeholder="Enter order quantity"
                                                                className="w-full px-4 py-3 bg-white border border-gray-700 rounded-2xl text-xs font-semibold text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Row 5: + Add Another Item button */}
                                                    <div className="flex items-end justify-end pt-5">
                                                        {index === items.length - 1 ? (
                                                            <button
                                                                type="button"
                                                                onClick={addItem}
                                                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition"
                                                            >
                                                                <span className="text-base font-bold leading-none">+</span>
                                                                <span>Add Another Item</span>
                                                            </button>
                                                        ) : <div />}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            /* Standard layout with all fields for Item Master */
                                            <>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    {/* Left half UI section: Identification & Units */}
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
                                                                activePool={activePool}
                                                                normalize={normalizeFn}
                                                                options={itemOptions}
                                                            />
                                                            {item.item_details && item.item_details.trim() && (
                                                                <div className="pt-0.5">
                                                                    {item.isNewItem ? (
                                                                        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-lg shadow-xs">
                                                                            ✨ New item — will be saved to Master automatically
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-lg shadow-xs">
                                                                            ✓ Existing item from Master (details auto-filled)
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                                                Item Name for Online Portal
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={item.online_item_name || ''}
                                                                onChange={(e) => updateItem(index, 'online_item_name', e.target.value)}
                                                                placeholder="Enter online portal item name"
                                                                className="w-full px-4 py-3 bg-white border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
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
                                                                placeholder="Select or enter category"
                                                                options={categoryOptions}
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
                                                                options={vendorOptions}
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
                                                                placeholder="Select or enter parent group"
                                                                options={parentGroupOptions}
                                                            />
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="space-y-1">
                                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Unit</label>
                                                                <ComboSelect
                                                                    table="purchase_indents"
                                                                    column="unit"
                                                                    value={item.unit}
                                                                    onChange={(val) => updateItem(index, 'unit', val)}
                                                                    label="Unit"
                                                                    placeholder="Unit"
                                                                    options={unitOptions}
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Alt Unit</label>
                                                                <input
                                                                    type="text"
                                                                    value={item.alt_unit || ''}
                                                                    onChange={(e) => updateItem(index, 'alt_unit', e.target.value)}
                                                                    placeholder="Alt Unit (optional)"
                                                                    className="w-full px-4 py-3 bg-white border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Right half UI section: Quantities & Specs */}
                                                    <div className="space-y-4">
                                                        <div className="grid grid-cols-2 gap-3">
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
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="space-y-1">
                                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Reorder Level (ROL)</label>
                                                                <input
                                                                    type="text"
                                                                    value={item.rol_qty || ''}
                                                                    onChange={(e) => {
                                                                        updateItem(index, 'rol_qty', e.target.value);
                                                                        updateItem(index, 'reorder_level', e.target.value);
                                                                    }}
                                                                    placeholder="Reorder Level"
                                                                    className="w-full px-4 py-3 bg-white border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Minimum Order Qty</label>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    value={item.min_order_qty || ''}
                                                                    onChange={(e) => updateItem(index, 'min_order_qty', e.target.value)}
                                                                    placeholder="Min Order Qty"
                                                                    className="w-full px-4 py-3 bg-white border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1 text-gray-800">
                                                            <label className="text-[10px] font-bold uppercase tracking-wider block flex items-center gap-1"
                                                                style={{ color: item.orderQtyRequired && !item.order_formula ? '#ef4444' : '#9ca3af' }}
                                                            >
                                                                Order Qty <span className="text-rose-500">*</span>
                                                                {item.orderQtyRequired && !item.order_formula && (
                                                                    <span className="text-[9px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded-full">
                                                                        ⚠ Required — was 0 in records
                                                                    </span>
                                                                )}
                                                            </label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={item.order_formula}
                                                                onChange={(e) => {
                                                                    updateItem(index, 'order_formula', e.target.value);
                                                                    updateItem(index, 'order_qty', e.target.value);
                                                                    // Clear the required flag once user starts typing
                                                                    if (e.target.value && Number(e.target.value) > 0) {
                                                                        updateItem(index, 'orderQtyRequired', false);
                                                                    }
                                                                }}
                                                                placeholder="Enter order quantity"
                                                                className={`w-full px-4 py-3 bg-white border rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 transition-all ${
                                                                    item.orderQtyRequired && !item.order_formula
                                                                        ? 'border-rose-400 ring-2 ring-rose-200 bg-rose-50 focus:ring-rose-400'
                                                                        : 'border-gray-150 focus:ring-blue-500'
                                                                }`}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Bottom Section: Online Portal & Specs */}
                                                <div className="pt-3 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-4">
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="space-y-1">
                                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                                                    Eligible For Online
                                                                </label>
                                                                <select
                                                                    value={item.eligible_for_online || 'No'}
                                                                    onChange={(e) => updateItem(index, 'eligible_for_online', e.target.value)}
                                                                    className="w-full px-4 py-3 bg-white border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                                                >
                                                                    <option value="Yes">Yes</option>
                                                                    <option value="No">No</option>
                                                                </select>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                                                    Variant Available
                                                                </label>
                                                                <select
                                                                    value={item.variant_available || 'No'}
                                                                    onChange={(e) => updateItem(index, 'variant_available', e.target.value)}
                                                                    className="w-full px-4 py-3 bg-white border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                                                >
                                                                    <option value="Yes">Yes</option>
                                                                    <option value="No">No</option>
                                                                </select>
                                                            </div>
                                                        </div>

                                                        {/* Multiple Image upload / URL */}
                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                                                    Item Images (Multiple)
                                                                </label>
                                                                {(item.image_urls?.length > 0 || item.image_url) && (
                                                                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/60">
                                                                        {(item.image_urls?.length || (item.image_url ? 1 : 0))} image{(item.image_urls?.length || (item.image_url ? 1 : 0)) > 1 ? 's' : ''} added
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className="flex flex-wrap items-center gap-2">
                                                                {(item.image_urls?.length ? item.image_urls : (item.image_url ? [item.image_url] : [])).map((imgUrl, imgIdx) => (
                                                                    <div key={imgIdx} className="relative w-14 h-14 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 flex-shrink-0 group shadow-xs">
                                                                        <img src={imgUrl} alt={`Item ${imgIdx + 1}`} className="w-full h-full object-cover" />
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => removeImage(index, imgIdx)}
                                                                            className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                                            title="Remove this image"
                                                                        >
                                                                            <X size={15} />
                                                                        </button>
                                                                    </div>
                                                                ))}

                                                                {/* Upload button box */}
                                                                <label className="w-14 h-14 rounded-xl border border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/40 hover:bg-blue-50 flex flex-col items-center justify-center text-blue-600 cursor-pointer transition-all flex-shrink-0">
                                                                    <UploadCloud size={16} />
                                                                    <span className="text-[8.5px] font-bold mt-0.5">Upload</span>
                                                                    <input
                                                                        type="file"
                                                                        multiple
                                                                        accept="image/*"
                                                                        className="hidden"
                                                                        onChange={(e) => {
                                                                            if (e.target.files && e.target.files.length > 0) {
                                                                                handleImageFiles(index, e.target.files);
                                                                                e.target.value = '';
                                                                            }
                                                                        }}
                                                                    />
                                                                </label>
                                                            </div>

                                                            {/* URL add input */}
                                                            <div className="flex items-center gap-1.5 pt-1">
                                                                <input
                                                                    type="text"
                                                                    placeholder="Or paste image URL and press Enter..."
                                                                    id={`img-url-inp-${index}`}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            e.preventDefault();
                                                                            addImageUrl(index, e.target.value);
                                                                            e.target.value = '';
                                                                        }
                                                                    }}
                                                                    className="flex-1 px-3 py-2 bg-white border border-gray-150 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const el = document.getElementById(`img-url-inp-${index}`);
                                                                        if (el && el.value) {
                                                                            addImageUrl(index, el.value);
                                                                            el.value = '';
                                                                        }
                                                                    }}
                                                                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition"
                                                                >
                                                                    Add URL
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Item Description */}
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                                            Item Description
                                                        </label>
                                                        <textarea
                                                            rows={4}
                                                            value={item.item_description || ''}
                                                            onChange={(e) => updateItem(index, 'item_description', e.target.value)}
                                                            placeholder="Enter description for online portal or inventory specs..."
                                                            className="w-full px-4 py-3 bg-white border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                                                        />
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                        {!isPurchaseMode && index === items.length - 1 && (
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
                                                    {isPurchaseMode ? (
                                                        <>
                                                            <th className="px-3 py-2">Category</th>
                                                            <th className="px-3 py-2">Vendor</th>
                                                            <th className="px-3 py-2">Parent Group</th>
                                                            <th className="px-3 py-2">Unit</th>
                                                            <th className="px-3 py-2">Shelf Cap.</th>
                                                            <th className="px-3 py-2">Max Qty</th>
                                                            <th className="px-3 py-2">ROL Qty</th>
                                                            <th className="px-3 py-2">Order Qty</th>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <th className="px-3 py-2">Online Name</th>
                                                            <th className="px-3 py-2">Vendor</th>
                                                            <th className="px-3 py-2">Order Qty</th>
                                                            <th className="px-3 py-2">Min Qty</th>
                                                            <th className="px-3 py-2">Online?</th>
                                                        </>
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {previewData.toCreate.map((it, idx) => (
                                                    <tr key={idx} className="border-t border-gray-100 font-semibold text-gray-800">
                                                        <td className="px-3 py-2">
                                                            <div className="flex items-center gap-2">
                                                                {!isPurchaseMode && (
                                                                    it.image_urls?.length ? (
                                                                        <div className="flex -space-x-1.5 overflow-hidden">
                                                                            {it.image_urls.slice(0, 3).map((url, i) => (
                                                                                <img key={i} src={url} alt="" className="w-6 h-6 rounded-md object-cover border border-white shadow-xs" />
                                                                            ))}
                                                                        </div>
                                                                    ) : it.image_url ? (
                                                                        <img src={it.image_url} alt="" className="w-6 h-6 rounded-md object-cover border border-gray-200" />
                                                                    ) : null
                                                                )}
                                                                <span>{it.item_details}</span>
                                                            </div>
                                                        </td>
                                                        {isPurchaseMode ? (
                                                            <>
                                                                <td className="px-3 py-2 text-gray-600">{it.category || '—'}</td>
                                                                <td className="px-3 py-2 text-gray-600">{it.vendor || '—'}</td>
                                                                <td className="px-3 py-2 text-gray-600">{it.parent_group || '—'}</td>
                                                                <td className="px-3 py-2 text-gray-600">{it.unit || '—'}</td>
                                                                <td className="px-3 py-2 text-gray-600">{it.shelf_capacity || '—'}</td>
                                                                <td className="px-3 py-2 text-gray-600">{it.max_level_qty || '—'}</td>
                                                                <td className="px-3 py-2 text-gray-600">{it.rol_qty || '—'}</td>
                                                                <td className="px-3 py-2 font-bold text-gray-900">{it.order_formula || it.order_qty || '—'}</td>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <td className="px-3 py-2 text-gray-600">{it.online_item_name || '—'}</td>
                                                                <td className="px-3 py-2 text-gray-600">{it.vendor}</td>
                                                                <td className="px-3 py-2 font-bold text-gray-900">{it.order_formula}</td>
                                                                <td className="px-3 py-2 text-gray-600">{it.min_order_qty || '0'}</td>
                                                                <td className="px-3 py-2">
                                                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                                        it.eligible_for_online === 'Yes' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                                                                    }`}>
                                                                        {it.eligible_for_online || 'No'}
                                                                    </span>
                                                                </td>
                                                            </>
                                                        )}
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
                                                    <th className="px-3 py-2">Current Stage</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {previewData.toSkip.map((it, idx) => (
                                                    <tr key={idx} className="border-t border-rose-50/50 font-semibold text-rose-900 bg-rose-50/20">
                                                        <td className="px-3 py-2">{it.item_details}</td>
                                                        <td className="px-3 py-2 text-rose-700/80">{it.vendor}</td>
                                                        <td className="px-3 py-2 font-bold text-rose-600">{it.uniqueNo}</td>
                                                        <td className="px-3 py-2"><span className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[10.5px] font-bold text-rose-800">{it.stage}</span></td>
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
                    <div className={`flex justify-end gap-3 px-8 py-4 border-t ${isPurchaseMode ? 'border-gray-100 bg-white' : 'border-gray-100 bg-gray-50/50'} flex-shrink-0`}>
                        {step === 'input' ? (
                            <>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="rounded-xl border border-gray-300 px-5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-2 text-xs font-bold text-white disabled:opacity-60 shadow-sm hover:opacity-90 transition"
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
                                    className="rounded-xl border border-gray-300 px-5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                                >
                                    Back
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving || previewData.toCreate.length === 0}
                                    className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2 text-xs font-bold text-white disabled:opacity-50 shadow-sm hover:opacity-90 transition"
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
function ComboSelect({ table, column, value, onChange, label, placeholder, disableCustom, activePool, normalize, inputClassName, options: optionsProp }) {
    const [options, setOptions] = useState(optionsProp || []);
    const [loading, setLoading] = useState(!optionsProp);
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState(value || '');
    const containerRef = useRef(null);

    useEffect(() => {
        setSearch(value || '');
    }, [value]);

    useEffect(() => {
        if (optionsProp) {
            setOptions(optionsProp);
            setLoading(false);
            return;
        }
        let isMounted = true;
        async function fetchOptions() {
            try {
                const targetColumn = table === 'vendors' ? 'name' : column;
                let allVals = [];
                let from = 0;
                while (true) {
                    let query = supabase.from(table).select(targetColumn);
                    if (table === 'purchase_indents') {
                        query = query.or('hide_in_master.eq.false,hide_in_master.is.null');
                    }
                    const { data, error } = await query.range(from, from + 999);
                    if (error) throw error;
                    if (!data || !data.length) break;
                    data.forEach(r => {
                        if (r[targetColumn]) allVals.push(r[targetColumn]);
                    });
                    if (data.length < 1000) break;
                    from += 1000;
                }
                const vals = Array.from(new Set(allVals)).sort();
                if (isMounted) {
                    setOptions(vals);
                    setLoading(false);
                }
            } catch (err) {
                console.error(err);
                if (isMounted) setLoading(false);
            }
        }
        fetchOptions();
        return () => { isMounted = false; };
    }, [table, column, optionsProp]);

    useEffect(() => {
        function handleClickOutside(e) {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
                if (disableCustom) {
                    const exactMatch = options.find(opt => opt.toLowerCase() === search.trim().toLowerCase());
                    if (exactMatch) {
                        onChange(exactMatch);
                        setSearch(exactMatch);
                    } else {
                        onChange('');
                        setSearch('');
                    }
                } else {
                    const trimmed = search.trim();
                    if (trimmed && trimmed !== value) {
                        onChange(trimmed);
                    }
                }
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [search, options, disableCustom, onChange, value]);

    const trimmedSearch = search.trim();
    const hasExactMatch = options.some(opt => opt.toLowerCase() === trimmedSearch.toLowerCase());

    const fuse = useMemo(() => {
        return new Fuse(options, {
            threshold: 0.4,
            ignoreLocation: true,
        });
    }, [options]);

    const filtered = useMemo(() => {
        if (!trimmedSearch) return options;

        const lowerSearch = trimmedSearch.toLowerCase();
        const sub = options.filter(opt => String(opt).toLowerCase().includes(lowerSearch));
        const fuz = fuse.search(trimmedSearch).map(r => r.item);

        const words = trimmedSearch.split(/\s+/).filter(Boolean);
        let tokenMatches = [];
        if (words.length > 1) {
            const wordResults = words.map(w => new Set(fuse.search(w).map(r => r.item)));
            tokenMatches = options.filter(opt => wordResults.every(set => set.has(opt)));
        }

        return Array.from(new Set([...sub, ...tokenMatches, ...fuz]));
    }, [options, fuse, trimmedSearch]);

    if (loading) {
        return <div className="px-4 py-3 text-xs text-gray-400 bg-gray-50 border border-gray-155 rounded-2xl animate-pulse">Loading options...</div>;
    }

    const handleSelectCustom = () => {
        if (!trimmedSearch) return;
        onChange(trimmedSearch);
        setSearch(trimmedSearch);
        setIsOpen(false);
    };

    return (
        <div ref={containerRef} className="relative w-full">
            <div className="relative flex items-center">
                <input
                    type="text"
                    value={search}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            if (filtered.length > 0) {
                                onChange(filtered[0]);
                                setSearch(filtered[0]);
                                setIsOpen(false);
                            } else if (!disableCustom && trimmedSearch) {
                                handleSelectCustom();
                            }
                        } else if (e.key === 'Escape') {
                            setIsOpen(false);
                        }
                    }}
                    onChange={(e) => {
                        const val = e.target.value;
                        setSearch(val);
                        setIsOpen(true);
                        if (!disableCustom) {
                            onChange(val);
                        }
                    }}
                    placeholder={placeholder || `Search or enter ${label || column}...`}
                    className={`w-full px-4 py-3 ${inputClassName || 'bg-gray-50 border border-gray-150'} rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all pr-10`}
                />
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="absolute right-3 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <svg className={`w-4 h-4 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
            </div>

            {isOpen && (
                <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded-2xl shadow-xl max-h-60 overflow-y-auto py-1">
                    {/* Add / Use Custom Value Action */}
                    {!disableCustom && trimmedSearch && !hasExactMatch && (
                        <button
                            type="button"
                            onClick={handleSelectCustom}
                            className="w-full text-left px-4 py-2.5 text-xs font-bold text-blue-600 hover:bg-blue-50 border-b border-gray-100 flex items-center justify-between transition-colors bg-blue-50/40"
                        >
                            <span className="flex items-center gap-1.5 min-w-0">
                                <span className="text-blue-500 font-bold shrink-0">➕</span>
                                <span className="truncate">Use "<strong>{trimmedSearch}</strong>"</span>
                            </span>
                            <span className="text-[9.5px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full shrink-0 ml-2">
                                New {label || 'Value'}
                            </span>
                        </button>
                    )}

                    {filtered.length > 0 ? (
                        filtered.map((opt) => {
                            let isUnderProcess = false;
                            if (activePool && normalize) {
                                const norm = normalize(opt);
                                if (activePool[norm]) isUnderProcess = true;
                            }

                            let textColorClass = 'text-gray-700';
                            if (activePool && normalize) {
                                textColorClass = isUnderProcess ? 'text-rose-600' : 'text-emerald-600';
                            }

                            return (
                                <button
                                    key={opt}
                                    type="button"
                                    onClick={() => {
                                        onChange(opt);
                                        setSearch(opt);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors hover:bg-blue-50/60 ${
                                        value === opt ? 'bg-blue-50 text-blue-600 font-bold' : textColorClass
                                    }`}
                                >
                                    {opt}
                                    {activePool && normalize && (
                                        <span className={`ml-2 text-[9px] italic ${isUnderProcess ? 'text-rose-500' : 'text-emerald-500'}`}>
                                            {isUnderProcess ? '(Under Process)' : '(Can Create Indent)'}
                                        </span>
                                    )}
                                </button>
                            );
                        })
                    ) : (
                        !disableCustom && trimmedSearch ? (
                            <div className="px-4 py-2 text-[11px] text-gray-500 italic">
                                No existing matches. Click above or press Enter to use "{trimmedSearch}".
                            </div>
                        ) : (
                            <div className="px-4 py-3 text-xs text-gray-400 font-medium italic">
                                {disableCustom ? 'No matching records' : 'No matches'}
                            </div>
                        )
                    )}
                </div>
            )}
        </div>
    );
}
