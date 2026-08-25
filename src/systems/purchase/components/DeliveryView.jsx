import { Loader2, Truck, ImageIcon, Plus, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CardPanel, EmptyState, FilterBar } from './ui';
import { fmt, uniqueValues } from '../utils/helpers';
import { createDelivery, createTransporter, fetchDeliveries, fetchIndents, fetchPOs, fetchTransporters, updateDelivery } from '../services/purchaseService';
import Modal from './Modal';
import { fetchTatTracking, renderPlannedDateCell, fetchTatSettings } from '../../../core/services/tatService';

const emptyForm = {
    transportName: '',
    contact: '',
    builtyDate: '',
    builtyNumber: '',
    daggCount: '',
    billNumber: '',
    billDate: '',
};

function distinctIndentValues(po, indentMap, field) {
    const values = new Set();
    (po.items || []).forEach((item) => {
        if (!item.indentId) return;
        const indent = indentMap.get(item.indentId);
        if (!indent) return;
        const val = indent[field];
        if (val) values.add(val);
    });
    if (values.size === 0) return '—';
    return Array.from(values).join(', ');
}

export default function DeliveryView() {
    const [tab, setTab] = useState('pending');
    const [pos, setPos] = useState([]);
    const [deliveries, setDeliveries] = useState([]);
    const [indents, setIndents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [selectedPo, setSelectedPo] = useState(null);
    const [selectedDeliveryToEdit, setSelectedDeliveryToEdit] = useState(null);
    const [tatTracking, setTatTracking] = useState({});
    const [tatMins, setTatMins] = useState(60);
    const [, setTick] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => setTick(t => t + 1), 10000);
        return () => clearInterval(timer);
    }, []);

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            const [posData, delData, indentsData] = await Promise.all([fetchPOs(), fetchDeliveries(), fetchIndents()]);
            setPos(posData || []);
            setDeliveries(delData || []);
            setIndents(indentsData || []);

            const poIds = (posData || []).map(p => p.id);
            if (poIds.length > 0) {
                try {
                    const trackings = await fetchTatTracking('delivery', poIds);
                    const trackingMap = {};
                    trackings.forEach(t => {
                        trackingMap[t.entity_id] = t;
                    });
                    setTatTracking(trackingMap);
                } catch (tatErr) {
                    console.error('Failed to load TAT tracking:', tatErr);
                }
            }

            try {
                const settingsData = await fetchTatSettings();
                const deliverySetting = settingsData.find(s => s.stage_key === 'delivery');
                if (deliverySetting && deliverySetting.is_active) {
                    setTatMins(deliverySetting.tat_minutes);
                }
            } catch (settingsErr) {
                console.error('Failed to load TAT settings:', settingsErr);
            }
        } catch (err) {
            setError(err.message || 'Failed to load delivery data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const deliveredPoIds = useMemo(() => new Set((deliveries || []).filter((d) => d.poId).map((d) => d.poId)), [deliveries]);
    const pendingCount = useMemo(() => (pos || []).filter((p) => !deliveredPoIds.has(p.id)).length, [pos, deliveredPoIds]);

    return (
        <CardPanel title="Delivery Management" desc="Log truck & driver details for pending POs, or view historical deliveries.">
            <div className="mb-4 inline-flex rounded-lg bg-gray-100 p-1 items-center">
                <button
                    className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[13px] font-semibold transition ${tab === 'pending' ? 'bg-[#173254] text-white' : 'text-gray-600'
                        }`}
                    onClick={() => setTab('pending')}
                >
                    <span>Pending</span>
                    {pendingCount > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                            {pendingCount}
                        </span>
                    )}
                </button>
                <button
                    className={`rounded-md px-3.5 py-1.5 text-[13px] font-semibold transition ${tab === 'history' ? 'bg-[#173254] text-white' : 'text-gray-600'
                        }`}
                    onClick={() => setTab('history')}
                >
                    History
                </button>
            </div>

            {success && (
                <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-2.5 text-[12.5px] font-semibold text-emerald-700">
                    {success}
                </div>
            )}

            {loading ? (
                <EmptyState icon={<Loader2 size={36} className="animate-spin" />}>Loading delivery data…</EmptyState>
            ) : error ? (
                <EmptyState>{error}</EmptyState>
            ) : tab === 'pending' ? (
                <PendingDeliveryPanel
                    pos={pos}
                    deliveries={deliveries}
                    indents={indents}
                    tatTracking={tatTracking}
                    tatMins={tatMins}
                    onLogDelivery={(po) => setSelectedPo(po)}
                />
            ) : (
                <DeliveryHistoryPanel
                    deliveries={deliveries}
                    pos={pos}
                    indents={indents}
                    onRevise={(d, po) => {
                        setSelectedDeliveryToEdit(d);
                        setSelectedPo(po);
                    }}
                />
            )}

            {selectedPo && (
                <CreateDeliveryModal
                    po={selectedPo}
                    deliveryToEdit={selectedDeliveryToEdit}
                    onClose={() => {
                        setSelectedPo(null);
                        setSelectedDeliveryToEdit(null);
                    }}
                    onSuccess={() => {
                        setSelectedPo(null);
                        setSelectedDeliveryToEdit(null);
                        setSuccess(selectedDeliveryToEdit ? 'Delivery revised successfully.' : 'Delivery recorded successfully.');
                        setTimeout(() => setSuccess(''), 4000);
                        loadData();
                    }}
                />
            )}
        </CardPanel>
    );
}

function PendingDeliveryPanel({ pos, deliveries, indents, tatTracking, tatMins, onLogDelivery }) {
    const [search, setSearch] = useState('');
    const [vendor, setVendor] = useState('');

    const indentMap = useMemo(() => {
        const map = new Map();
        indents.forEach((indent) => map.set(indent.dbId, indent));
        return map;
    }, [indents]);

    const deliveredPoIds = useMemo(() => {
        return new Set(deliveries.filter((d) => d.poId).map((d) => d.poId));
    }, [deliveries]);

    const pendingPOs = useMemo(() => {
        return pos.filter((p) => !deliveredPoIds.has(p.id));
    }, [pos, deliveredPoIds]);

    const vendors = useMemo(() => {
        return uniqueValues(pendingPOs.map((p) => ({ vendor: p.vendor?.name })), 'vendor');
    }, [pendingPOs]);

    const filteredRows = useMemo(() => {
        const term = search.toLowerCase().trim();
        return pendingPOs.filter((po) => {
            if (term && !`${po.poNo} ${po.vendor?.name}`.toLowerCase().includes(term)) return false;
            if (vendor && po.vendor?.name !== vendor) return false;
            return true;
        });
    }, [pendingPOs, search, vendor]);

    const clearFilters = () => {
        setSearch('');
        setVendor('');
    };

    return (
        <div>
            <FilterBar onClear={clearFilters}>
                <input
                    type="text"
                    placeholder="Search PO no, vendor..."
                    className="min-w-[150px] flex-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-[12.5px]"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <select
                    className="min-w-[130px] rounded-lg border border-gray-300 px-2.5 py-1.5 text-[12.5px]"
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                >
                    <option value="">All Vendors</option>
                    {vendors.map((v) => (
                        <option key={v} value={v}>
                            {v}
                        </option>
                    ))}
                </select>
            </FilterBar>

            <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-[12.6px]">
                    <thead>
                        <tr className="bg-gray-50 text-gray-500">
                            {['Action', 'PO No.', 'Date', 'Vendor', 'Category', 'Unit', 'Parent Group', 'PO Delay', 'Planned Date'].map((h) => (
                                <th
                                    key={h}
                                    className="whitespace-nowrap border-b border-gray-200 px-3 py-2.5 text-left text-[10.3px] font-bold uppercase tracking-wide"
                                >
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {pendingPOs.length === 0 ? (
                            <tr><td colSpan={9} className="px-3 py-10 text-center text-gray-500">No purchase orders waiting for delivery.</td></tr>
                        ) : filteredRows.length === 0 ? (
                            <tr><td colSpan={9} className="px-3 py-10 text-center text-gray-500">No pending POs match the current filters.</td></tr>
                        ) : filteredRows.map((po) => (
                            <tr key={po.id} className="border-t border-gray-100 hover:bg-gray-50">
                                <td className="whitespace-nowrap px-3 py-2.5">
                                    <button
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#173254] px-3 py-1 text-xs font-semibold text-white hover:bg-[#10243e]"
                                        onClick={() => onLogDelivery(po)}
                                    >
                                        <Truck size={14} /> Update
                                    </button>
                                </td>
                                <td className="px-3 py-2.5 font-semibold text-gray-900">{po.poNo}</td>
                                <td className="px-3 py-2.5 text-gray-600">{po.poDate}</td>
                                <td className="px-3 py-2.5 text-gray-800">
                                    <div className="font-semibold text-gray-900">{po.vendor?.name || '—'}</div>
                                    {po.vendor && (
                                        <div className="text-[11px] text-gray-500 mt-0.5">
                                            {po.vendor.city && <span>{po.vendor.city}</span>}
                                            {po.vendor.contact && <span> • {po.vendor.contact}</span>}
                                            {po.vendor.paymentTerms && (
                                                <span className="ml-1.5 inline-flex items-center rounded-full bg-blue-50 px-1.5 py-0.5 text-[9.5px] font-medium text-blue-700">
                                                    {po.vendor.paymentTerms}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </td>
                                <td className="px-3 py-2.5 text-gray-700">{distinctIndentValues(po, indentMap, 'category')}</td>
                                <td className="px-3 py-2.5 text-gray-700">{distinctIndentValues(po, indentMap, 'unit')}</td>
                                <td className="px-3 py-2.5 text-gray-700">{distinctIndentValues(po, indentMap, 'parentGroup')}</td>
                                <td className="px-3 py-2.5 font-semibold text-gray-900">
                                    {po.poDate ? (() => {
                                        const d = Math.max(0, Math.floor((Date.now() - new Date(po.poDate).getTime()) / 86400000));
                                        return <span className={d > 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>{d}</span>;
                                    })() : '—'}
                                </td>
                                <td className="px-3 py-2.5">{renderPlannedDateCell(tatTracking[po.id], po.createdAt, tatMins)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function DeliveryHistoryPanel({ deliveries, pos, indents, onRevise }) {
    const [search, setSearch] = useState('');

    const poMap = useMemo(() => {
        const map = new Map();
        pos.forEach((p) => map.set(p.id, p));
        return map;
    }, [pos]);

    const indentMap = useMemo(() => {
        const map = new Map();
        indents.forEach((indent) => map.set(indent.dbId, indent));
        return map;
    }, [indents]);

    const filteredDeliveries = useMemo(() => {
        const term = search.toLowerCase().trim();
        if (!term) return deliveries;
        return deliveries.filter((d) => {
            const poNo = poMap.get(d.poId)?.poNo || '';
            return `${poNo} ${d.transportName} ${poMap.get(d.poId)?.vendor?.name} ${d.billNumber} ${d.builtyNumber}`.toLowerCase().includes(term);
        });
    }, [deliveries, search, poMap]);

    return (
        <div>
            <FilterBar onClear={() => setSearch('')}>
                <input
                    type="text"
                    placeholder="Search transport, bill, PO no..."
                    className="min-w-[150px] flex-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-[12.5px]"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </FilterBar>

            <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full min-w-[820px] text-left text-[12.5px]">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-[10.3px] font-bold uppercase tracking-wide text-gray-500">
                            <th className="px-3 py-2.5">Action</th>
                            <th className="px-3 py-2.5">PO No.</th>
                            <th className="px-3 py-2.5">Vendor</th>
                            <th className="px-3 py-2.5">Transport Name</th>
                            <th className="px-3 py-2.5">Bill No.</th>
                            <th className="px-3 py-2.5">Bill Date</th>
                            <th className="px-3 py-2.5">Contact</th>
                            <th className="px-3 py-2.5">Category</th>
                            <th className="px-3 py-2.5">Unit</th>
                            <th className="px-3 py-2.5">Parent Group</th>
                            <th className="px-3 py-2.5">Advance Amount</th>
                            <th className="px-3 py-2.5">Builty No.</th>
                            <th className="px-3 py-2.5">Builty Date</th>
                            <th className="px-3 py-2.5">No. of Dagg</th>
                            <th className="px-3 py-2.5">Builty Image</th>
                            <th className="px-3 py-2.5">Bill Image</th>
                            <th className="px-3 py-2.5">Arrived</th>
                        </tr>
                    </thead>
                    <tbody>
                        {deliveries.length === 0 ? (
                            <tr><td colSpan={16} className="px-3 py-10 text-center text-gray-500">No deliveries submitted yet.</td></tr>
                        ) : filteredDeliveries.length === 0 ? (
                            <tr><td colSpan={16} className="px-3 py-10 text-center text-gray-500">No deliveries match the search.</td></tr>
                        ) : filteredDeliveries.map((d) => {
                            const poNo = poMap.get(d.poId)?.poNo || '—';
                            const po = poMap.get(d.poId);
                            return (
                                <tr key={d.id} className="border-t border-gray-100 hover:bg-gray-50">
                                    <td className="px-3 py-2.5">
                                        <button
                                            onClick={() => onRevise(d, po)}
                                            className="rounded-lg bg-[#C99A3E] px-2.5 py-1 text-xs font-semibold text-[#1B2A3D] hover:bg-[#B98A2E]"
                                        >
                                            Revise
                                        </button>
                                    </td>
                                    <td className="px-3 py-2.5 font-semibold text-gray-900">{poNo}</td>
                                    <td className="px-3 py-2.5 text-gray-800">
                                        <div className="font-semibold text-gray-900">{po?.vendor?.name || '—'}</div>
                                        {po?.vendor && (
                                            <div className="text-[11px] text-gray-500 mt-0.5">
                                                {po.vendor.city && <span>{po.vendor.city}</span>}
                                                {po.vendor.contact && <span> • {po.vendor.contact}</span>}
                                                {po.vendor.paymentTerms && (
                                                    <span className="ml-1.5 inline-flex items-center rounded-full bg-blue-50 px-1.5 py-0.5 text-[9.5px] font-medium text-blue-700">
                                                        {po.vendor.paymentTerms}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                     <td className="px-3 py-2.5 font-semibold text-gray-900">{d.transportName}</td>
                                     <td className="px-3 py-2.5 text-gray-700">{d.billNumber || '—'}</td>
                                     <td className="px-3 py-2.5 text-gray-700">{d.billDate || '—'}</td>
                                     <td className="px-3 py-2.5 text-gray-600">{d.contact || '—'}</td>
                                    <td className="px-3 py-2.5 text-gray-700">{po ? distinctIndentValues(po, indentMap, 'category') : '—'}</td>
                                    <td className="px-3 py-2.5 text-gray-700">{po ? distinctIndentValues(po, indentMap, 'unit') : '—'}</td>
                                    <td className="px-3 py-2.5 text-gray-700">{po ? distinctIndentValues(po, indentMap, 'parentGroup') : '—'}</td>
                                    <td className="px-3 py-2.5">
                                        {po?.advanceRequired ? (
                                            <span className="font-semibold text-amber-700">₹ {fmt(po.advanceAmount)}</span>
                                        ) : (
                                            <span className="text-gray-400">—</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2.5 text-gray-600">{d.builtyNumber || '—'}</td>
                                    <td className="px-3 py-2.5 text-gray-600">{d.builtyDate || '—'}</td>
                                    <td className="px-3 py-2.5 text-gray-600">{d.daggCount ?? '—'}</td>
                                    <td className="px-3 py-2.5">
                                        {d.builtyImageUrl ? (
                                            <a
                                                href={d.builtyImageUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 font-semibold text-[#173254] underline hover:text-[#10243e]"
                                            >
                                                <ImageIcon size={14} /> View
                                            </a>
                                        ) : (
                                            '—'
                                        )}
                                    </td>
                                    <td className="px-3 py-2.5">
                                        {d.billImageUrl ? (
                                            <a
                                                href={d.billImageUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 font-semibold text-[#173254] underline hover:text-[#10243e]"
                                            >
                                                <ImageIcon size={14} /> View
                                            </a>
                                        ) : (
                                            '—'
                                        )}
                                    </td>
                                    <td className="px-3 py-2.5 text-gray-500">
                                        {d.createdAt ? new Date(d.createdAt).toLocaleString('en-IN') : '—'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function CreateDeliveryModal({ po, deliveryToEdit, onClose, onSuccess }) {
    const [form, setForm] = useState(deliveryToEdit ? {
        transportName: deliveryToEdit.transportName || '',
        contact: deliveryToEdit.contact || '',
        builtyDate: deliveryToEdit.builtyDate ? (() => {
            try {
                return new Date(deliveryToEdit.builtyDate).toISOString().split('T')[0];
            } catch (e) {
                return deliveryToEdit.builtyDate;
            }
        })() : '',
        builtyNumber: deliveryToEdit.builtyNumber || '',
        daggCount: deliveryToEdit.daggCount || '',
        billNumber: deliveryToEdit.billNumber || '',
        billDate: deliveryToEdit.billDate ? (() => {
            try {
                return new Date(deliveryToEdit.billDate).toISOString().split('T')[0];
            } catch (e) {
                return deliveryToEdit.billDate;
            }
        })() : '',
    } : emptyForm);
    const [transporters, setTransporters] = useState([]);
    const [showAddTransporter, setShowAddTransporter] = useState(false);
    const [builtyImageFile, setBuiltyImageFile] = useState(null);
    const [billImageFile, setBillImageFile] = useState(null);
    const [builtyImagePreview, setBuiltyImagePreview] = useState(null);
    const [billImagePreview, setBillImagePreview] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchTransporters().then(setTransporters).catch(() => setTransporters([]));
    }, []);

    function update(field, value) {
        setForm((f) => ({ ...f, [field]: value }));
    }

    function handleTransportSelect(name) {
        const t = transporters.find((tr) => tr.name === name);
        setForm((f) => ({ ...f, transportName: name, contact: t?.contacts?.[0] || '' }));
    }

    async function handleTransporterCreated(newTransporter) {
        const rows = await fetchTransporters();
        setTransporters(rows);
        setForm((f) => ({ ...f, transportName: newTransporter.name, contact: newTransporter.contacts?.[0] || '' }));
        setShowAddTransporter(false);
    }

    function handleFileChange(e) {
        const file = e.target.files?.[0] || null;
        setBuiltyImageFile(file);
        if (builtyImagePreview) URL.revokeObjectURL(builtyImagePreview);
        setBuiltyImagePreview(file ? URL.createObjectURL(file) : null);
    }
    function handleBillFileChange(e) {
        const file = e.target.files?.[0] || null;
        setBillImageFile(file);
        if (billImagePreview) URL.revokeObjectURL(billImagePreview);
        setBillImagePreview(file ? URL.createObjectURL(file) : null);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');

        if (!form.transportName || !form.builtyNumber || !form.builtyDate || !form.daggCount || !form.billDate) {
            setError('Transport name, builty number, builty date, bill date and number of dagg are required.');
            return;
        }

        setSubmitting(true);
        try {
            if (deliveryToEdit) {
                await updateDelivery({
                    id: deliveryToEdit.id,
                    ...form,
                    builtyImageFile,
                    billImageFile,
                    existingBuiltyUrl: deliveryToEdit.builtyImageUrl,
                    existingBillUrl: deliveryToEdit.billImageUrl
                });
            } else {
                await createDelivery({ ...form, poId: po.id, builtyImageFile, billImageFile });
            }
            if (builtyImagePreview) URL.revokeObjectURL(builtyImagePreview);
            onSuccess();
        } catch (err) {
            setError(err.message || 'Failed to save delivery.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Modal open={true} onClose={onClose} title={deliveryToEdit ? `Revise Delivery — ${po.poNo}` : `Create Delivery — ${po.poNo}`} size="lg">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2 rounded-xl bg-gray-50 px-4 py-2.5 text-[12.5px] text-gray-600">
                    Delivery against <span className="font-bold text-gray-900">{po.poNo}</span> ({po.vendor?.name})
                </div>

                <Field label="Transport Name" required>
                    <div className="flex items-center gap-2">
                        <select
                            className="input"
                            value={form.transportName}
                            onChange={(e) => handleTransportSelect(e.target.value)}
                        >
                            <option value="">Select transporter</option>
                            {transporters.map((t) => (
                                <option key={t.id} value={t.name}>{t.name}</option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={() => setShowAddTransporter(true)}
                            className="shrink-0 inline-flex items-center gap-1 rounded-xl border border-gray-300 px-3 h-[42px] text-[12px] font-bold text-gray-700 hover:bg-gray-50"
                        >
                            <Plus size={14} /> Add
                        </button>
                    </div>
                </Field>

                <Field label="Contact Detail" required>
                    <input
                        className="input"
                        type="tel"
                        required
                        value={form.contact}
                        maxLength={10}
                        inputMode="numeric"
                        pattern="[0-9]{10}"
                        onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                            update('contact', value);
                        }}
                        placeholder="10-digit mobile"
                    />

                    {/* <input
                        className="input"
                        type='tel'
                        value={form.contact}
                        pattern="[0-9]{10}"
                        onChange={(e) => update('contact', e.target.value)}
                        placeholder="10-digit mobile"
                    /> */}
                </Field>

                <Field label="Builty Number" required>
                    <input
                        className="input"
                        required
                        value={form.builtyNumber}
                        onChange={(e) => update('builtyNumber', e.target.value)}
                        placeholder="e.g. BLT-00123"
                    />
                </Field>

                <Field label="Builty Date" required>
                    <input
                        type="date"
                        className="input"
                        required
                        value={form.builtyDate}
                        onChange={(e) => update('builtyDate', e.target.value)}
                    />
                </Field>

                <Field label="Number of Dagg" required>
                    <input
                        type="number"
                        required
                        min={0} className="input"
                        value={form.daggCount}
                        onChange={(e) => update('daggCount', e.target.value)}
                        placeholder="0"
                    />
                </Field>

                <Field label="Bill Number">
                    <input
                        className="input"
                        value={form.billNumber}
                        onChange={(e) => update('billNumber', e.target.value)}
                        placeholder="e.g. BILL-00123"
                    />
                </Field>

                <Field label="Bill Date" required>
                    <input
                        type="date"
                        className="input"
                        required
                        value={form.billDate}
                        onChange={(e) => update('billDate', e.target.value)}
                    />
                </Field>

                <Field label="Builty Image">
                    <label className="flex h-[42px] cursor-pointer items-center gap-2 rounded-xl border border-dashed border-gray-300 px-3 text-[13px] text-gray-500 hover:border-gray-400">
                        <Upload size={16} />
                        {builtyImageFile ? builtyImageFile.name : 'Choose image'}
                        <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                    </label>
                </Field>
                <Field label="Bill Image">
                    <label className="flex h-[42px] cursor-pointer items-center gap-2 rounded-xl border border-dashed border-gray-300 px-3 text-[13px] text-gray-500 hover:border-gray-400">
                        <Upload size={16} />
                        {billImageFile ? billImageFile.name : 'Choose image'}
                        <input type="file" accept="image/*" className="hidden" onChange={handleBillFileChange} />
                    </label>
                </Field>

                {/* {builtyImagePreview && (
                    <div className="md:col-span-2">
                        <img src={builtyImagePreview} alt="Builty preview" className="max-h-48 rounded-xl border border-gray-200" />
                    </div>
                )} */}

                {error && <div className="md:col-span-2 text-[12.5px] font-semibold text-rose-600">{error}</div>}

                <div className="md:col-span-2 flex justify-end gap-2 pt-2 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-gray-300 px-4 py-2 text-[13px] font-semibold text-gray-700 hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#173254] px-5 py-2 text-[13px] font-bold text-white hover:bg-[#10243e] disabled:opacity-50"
                    >
                        <Truck size={16} />
                        {submitting ? 'Saving…' : deliveryToEdit ? 'Save Revision' : 'Save Delivery'}
                    </button>
                </div>
            </form>

            <style>{`
        .input { height: 42px; border-radius: 0.75rem; border: 1px solid #e5e7eb; padding: 0 0.75rem; font-size: 13px; width: 100%; }
        .input:focus { outline: none; border-color: #173254; }
      `}</style>

            {showAddTransporter && (
                <AddTransporterModal
                    onClose={() => setShowAddTransporter(false)}
                    onCreated={handleTransporterCreated}
                />
            )}
        </Modal>
    );
}

function AddTransporterModal({ onClose, onCreated }) {
    const [name, setName] = useState('');
    const [contact, setContact] = useState('');
    const [duration, setDuration] = useState('');
    const [cities, setCities] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        if (!name.trim()) {
            setError('Transporter name is required.');
            return;
        }
        setSaving(true);
        try {
            const created = await createTransporter({ name: name.trim(), contact: contact.trim(), duration: duration.trim(), cities: cities.trim() });
            await onCreated(created);
        } catch (err) {
            setError(err.message || 'Failed to save transporter.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal open={true} onClose={onClose} title="Add Transporter" size="md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <Field label="Transporter Name" required>
                    <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sharma Roadlines" />
                </Field>
                <Field label="Contact Number">
                    <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="10-digit mobile" />
                </Field>
                <Field label="Duration">
                    <input className="input" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 2 days" />
                </Field>
                <Field label="City">
                    <input className="input" value={cities} onChange={(e) => setCities(e.target.value)} placeholder="e.g. Raipur" />
                </Field>

                {error && <div className="text-[12.5px] font-semibold text-rose-600">{error}</div>}

                <div className="flex justify-end gap-2 border-t border-gray-100 pt-2">
                    <button type="button" onClick={onClose} className="rounded-xl border border-gray-300 px-4 py-2 text-[13px] font-semibold text-gray-700 hover:bg-gray-50">
                        Cancel
                    </button>
                    <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#173254] px-5 py-2 text-[13px] font-bold text-white hover:bg-[#10243e] disabled:opacity-50">
                        {saving ? 'Saving…' : 'Save Transporter'}
                    </button>
                </div>
            </form>

            <style>{`
        .input { height: 42px; border-radius: 0.75rem; border: 1px solid #e5e7eb; padding: 0 0.75rem; font-size: 13px; width: 100%; }
        .input:focus { outline: none; border-color: #173254; }
      `}</style>
        </Modal>
    );
}

function Field({ label, required, children }) {
    return (
        <div>
            <label className="mb-1 block text-[12px] font-bold text-gray-600">
                {label} {required && <span className="text-rose-500">*</span>}
            </label>
            {children}
        </div>
    );
}