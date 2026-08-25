import { Loader2, PackageCheck, ImageIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CardPanel, EmptyState, FilterBar } from './ui';
import { fetchDeliveries, fetchPOs, fetchReceivings, submitReceiving, reviseReceiving } from '../services/purchaseService';
import Modal from './Modal';
import { fetchTatTracking, renderPlannedDateCell, fetchTatSettings } from '../../../core/services/tatService';

// Helper function to format delay in terms of days and hours
const formatDelay = (builtyDate) => {
    if (!builtyDate) return '—';
    const diffMs = Date.now() - new Date(builtyDate).getTime();
    if (diffMs <= 0) return '0 hours';
    const totalHours = Math.floor(diffMs / 3600000);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const parts = [];
    if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
    return parts.join(' ') || '0 hours';
};

export default function ReceivingView() {
    const [tab, setTab] = useState('pending');
    const [deliveries, setDeliveries] = useState([]);
    const [pos, setPos] = useState([]);
    const [receivings, setReceivings] = useState([]);
    const [tatTracking, setTatTracking] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [tatMins, setTatMins] = useState(20);

    const [selectedDelivery, setSelectedDelivery] = useState(null);
    const [selectedReceivingToEdit, setSelectedReceivingToEdit] = useState(null);
    const [, setTick] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => setTick(t => t + 1), 10000);
        return () => clearInterval(timer);
    }, []);

    async function loadData() {
        setLoading(true);
        setError('');
        try {
            const [delData, posData, recData] = await Promise.all([fetchDeliveries(), fetchPOs(), fetchReceivings()]);
            setDeliveries(delData || []);
            setPos(posData || []);
            setReceivings(recData || []);

            const delIds = (delData || []).map(d => d.id);
            if (delIds.length > 0) {
                try {
                    const trackings = await fetchTatTracking('receiving', delIds);
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
                const receivingSetting = settingsData.find(s => s.stage_key === 'receiving');
                if (receivingSetting && receivingSetting.is_active) {
                    setTatMins(receivingSetting.tat_minutes);
                }
            } catch (settingsErr) {
                console.error('Failed to load TAT settings:', settingsErr);
            }
        } catch (err) {
            setError(err.message || 'Failed to load receiving data.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadData();
    }, []);

    const poMap = useMemo(() => {
        const map = new Map();
        pos.forEach((p) => map.set(p.id, p));
        return map;
    }, [pos]);

    const deliveryDaggStatus = useMemo(() => {
        const statusMap = {};
        (deliveries || []).forEach(d => {
            statusMap[d.id] = {
                assigned: Number(d.daggCount) || 0,
                received: 0,
            };
        });
        (receivings || []).forEach(r => {
            if (statusMap[r.deliveryId]) {
                statusMap[r.deliveryId].received += Number(r.receivedDagg) || 0;
            }
        });
        return statusMap;
    }, [deliveries, receivings]);

    const pendingDeliveries = useMemo(() => {
        return (deliveries || []).filter((d) => {
            const dStatus = deliveryDaggStatus[d.id];
            if (!dStatus) return true;
            return dStatus.received < dStatus.assigned;
        });
    }, [deliveries, deliveryDaggStatus]);

    const pendingCount = pendingDeliveries.length;

    return (
        <CardPanel title="Receiving" desc="Confirm goods received against each delivery, product by product.">
            <div className="mb-4 inline-flex rounded-lg bg-gray-100 p-1 items-center">
                <button
                    className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[13px] font-semibold transition ${tab === 'pending' ? 'bg-[#173254] text-white' : 'text-gray-600'}`}
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
                    className={`rounded-md px-3.5 py-1.5 text-[13px] font-semibold transition ${tab === 'history' ? 'bg-[#173254] text-white' : 'text-gray-600'}`}
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
            {error && <div className="mb-3 text-[12.5px] font-semibold text-rose-600">{error}</div>}

            {loading ? (
                <EmptyState icon={<Loader2 size={36} className="animate-spin" />}>Loading receiving data…</EmptyState>
            ) : tab === 'pending' ? (
                <PendingReceivingPanel deliveries={pendingDeliveries} deliveryDaggStatus={deliveryDaggStatus} poMap={poMap} tatTracking={tatTracking} tatMins={tatMins} onUpdate={(d) => setSelectedDelivery(d)} />
            ) : (
                <ReceivingHistoryPanel
                    receivings={receivings}
                    deliveries={deliveries}
                    poMap={poMap}
                    onRevise={(rec, del) => {
                        setSelectedReceivingToEdit(rec);
                        setSelectedDelivery(del);
                    }}
                />
            )}

            {selectedDelivery && (
                <ReceiveItemsModal
                    delivery={selectedDelivery}
                    po={poMap.get(selectedDelivery.poId)}
                    receivings={receivings}
                    receivingToEdit={selectedReceivingToEdit}
                    onClose={() => {
                        setSelectedDelivery(null);
                        setSelectedReceivingToEdit(null);
                    }}
                    onSuccess={() => {
                        setSelectedDelivery(null);
                        setSelectedReceivingToEdit(null);
                        setSuccess(selectedReceivingToEdit ? 'Receiving revised successfully.' : 'Receiving recorded successfully.');
                        setTimeout(() => setSuccess(''), 4000);
                        loadData();
                    }}
                />
            )}
        </CardPanel>
    );
}

function PendingReceivingPanel({ deliveries, deliveryDaggStatus, poMap, tatTracking, tatMins, onUpdate }) {
    const [search, setSearch] = useState('');

    const pending = deliveries;

    const filtered = useMemo(() => {
        const term = search.toLowerCase().trim();
        if (!term) return pending;
        return pending.filter((d) => {
            const po = poMap.get(d.poId);
            const poNo = po?.poNo || '';
            const vendorName = po?.vendor?.name || '';
            return `${poNo} ${vendorName} ${d.transportName} ${d.builtyNumber}`.toLowerCase().includes(term);
        });
    }, [pending, search, poMap]);

    return (
        <div>
            <FilterBar onClear={() => setSearch('')}>
                <input
                    type="text"
                    placeholder="Search transporter, PO no..."
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
                            <th className="px-3 py-2.5">Transporter</th>
                            <th className="px-3 py-2.5">Contact</th>
                            <th className="px-3 py-2.5">Builty No.</th>
                            <th className="px-3 py-2.5">Builty Date</th>
                            <th className="px-3 py-2.5">Bill Date</th>
                            <th className="px-3 py-2.5">Assigned Dagg</th>
                            <th className="px-3 py-2.5">Remaining Dagg</th>
                            <th className="px-3 py-2.5">Builty Image</th>
                            <th className="px-3 py-2.5">Arrived</th>
                            <th className="px-3 py-2.5">Delay</th>
                            <th className="px-3 py-2.5">Planned Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pending.length === 0 ? (
                            <tr><td colSpan={14} className="px-3 py-10 text-center text-gray-500">No deliveries waiting to be received.</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={14} className="px-3 py-10 text-center text-gray-500">No deliveries match the search.</td></tr>
                        ) : filtered.map((d) => {
                            const po = poMap.get(d.poId);
                            const poNo = po?.poNo || '—';
                            const diffDays = d.builtyDate ? Math.max(0, Math.floor((Date.now() - new Date(d.builtyDate).getTime()) / 86400000)) : null;
                            const isDelayed = diffDays !== null && diffDays >= 1;
                            const dStatus = deliveryDaggStatus[d.id];
                            return (
                                <tr key={d.id} className={`border-t border-gray-100 transition-colors ${isDelayed ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}`}>
                                    <td className="px-3 py-2.5">
                                        <button
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#173254] px-3 py-1 text-xs font-semibold text-white hover:bg-[#10243e]"
                                            onClick={() => onUpdate(d)}
                                        >
                                            <PackageCheck size={14} /> Update
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
                                    <td className="px-3 py-2.5 text-gray-600">{d.contact || '—'}</td>
                                    <td className="px-3 py-2.5 text-gray-600">{d.builtyNumber || '—'}</td>
                                    <td className="px-3 py-2.5 text-gray-600">
                                        {d.builtyDate ? (
                                            <span className={isDelayed ? 'text-red-700 font-semibold' : ''}>
                                                {d.builtyDate}
                                            </span>
                                        ) : '—'}
                                    </td>
                                    <td className="px-3 py-2.5 text-gray-600">{d.billDate || '—'}</td>
                                    <td className="px-3 py-2.5 text-gray-600">{dStatus ? dStatus.assigned : d.daggCount}</td>
                                    <td className="px-3 py-2.5 text-gray-600 font-bold">{dStatus ? (dStatus.assigned - dStatus.received) : d.daggCount}</td>
                                    <td className="px-3 py-2.5">
                                        {d.builtyImageUrl ? (
                                            <a href={d.builtyImageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#173254] underline hover:text-[#10243e]">
                                                <ImageIcon size={14} /> View
                                            </a>
                                        ) : (
                                            '—'
                                        )}
                                    </td>
                                    <td className="px-3 py-2.5 text-gray-500">
                                        {d.createdAt ? new Date(d.createdAt).toLocaleString('en-IN') : '—'}
                                    </td>
                                    <td className="px-3 py-2.5 text-gray-500">
                                        {diffDays !== null ? `${diffDays} ${diffDays === 1 ? 'day' : 'days'}` : '—'}
                                    </td>
                                    <td className="px-3 py-2.5">{renderPlannedDateCell(tatTracking[d.id], d.createdAt, tatMins)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function ReceivingHistoryPanel({ receivings, deliveries, poMap, onRevise }) {
    const [search, setSearch] = useState('');

    const deliveryMap = useMemo(() => {
        const map = new Map();
        deliveries.forEach((d) => map.set(d.id, d));
        return map;
    }, [deliveries]);

    const rows = useMemo(() => {
        const flat = [];
        receivings.forEach((r) => {
            const delivery = deliveryMap.get(r.deliveryId);
            const po = delivery ? poMap.get(delivery.poId) : null;
            const poNo = po?.poNo || null;
            (r.items || []).forEach((item) => {
                flat.push({
                    receivingId: r.id,
                    deliveryId: r.deliveryId,
                    delivery: delivery,
                    receivingRow: r,
                    poNo: poNo || '—',
                    po: po,
                    transportName: delivery?.transportName || '—',
                    productName: item.productName,
                    productCode: item.productCode,
                    orderedQty: item.orderedQty,
                    receivedQty: item.receivedQty,
                    receivedAt: r.receivedAt,
                    receiptDate: r.receiptDate,
                    receiptTime: r.receiptTime,
                    receivedDagg: r.receivedDagg,
                    receivedBy: r.receivedBy,
                });
            });
        });
        return flat;
    }, [receivings, deliveryMap, poMap]);

    const filtered = useMemo(() => {
        const term = search.toLowerCase().trim();
        if (!term) return rows;
        return rows.filter((r) => {
            const vendorName = r.po?.vendor?.name || '';
            return `${r.poNo} ${vendorName} ${r.transportName} ${r.productName}`.toLowerCase().includes(term);
        });
    }, [rows, search]);

    return (
        <div>
            <FilterBar onClear={() => setSearch('')}>
                <input
                    type="text"
                    placeholder="Search PO no, vendor, product..."
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
                            <th className="px-3 py-2.5">Transporter</th>
                            <th className="px-3 py-2.5">Product</th>
                            <th className="px-3 py-2.5">Ordered Qty</th>
                            <th className="px-3 py-2.5">Received Qty</th>
                            <th className="px-3 py-2.5">Received Dagg</th>
                            <th className="px-3 py-2.5">Receipt Date</th>
                            <th className="px-3 py-2.5">Receipt Time</th>
                            <th className="px-3 py-2.5">Received By</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr><td colSpan={11} className="px-3 py-10 text-center text-gray-500">No receivings submitted yet.</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={11} className="px-3 py-10 text-center text-gray-500">No receivings match the search.</td></tr>
                        ) : filtered.map((r, idx) => (
                            <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50">
                                <td className="px-3 py-2.5">
                                    <button
                                        onClick={() => onRevise(r.receivingRow, r.delivery)}
                                        className="rounded-lg bg-[#C99A3E] px-2.5 py-1 text-xs font-semibold text-[#1B2A3D] hover:bg-[#B98A2E]"
                                    >
                                        Revise
                                    </button>
                                </td>
                                <td className="px-3 py-2.5 font-semibold text-gray-900">{r.poNo}</td>
                                <td className="px-3 py-2.5 text-gray-800">
                                    <div className="font-semibold text-gray-900">{r.po?.vendor?.name || '—'}</div>
                                    {r.po?.vendor && (
                                        <div className="text-[11px] text-gray-500 mt-0.5">
                                            {r.po.vendor.city && <span>{r.po.vendor.city}</span>}
                                            {r.po.vendor.contact && <span> • {r.po.vendor.contact}</span>}
                                            {r.po.vendor.paymentTerms && (
                                                <span className="ml-1.5 inline-flex items-center rounded-full bg-blue-50 px-1.5 py-0.5 text-[9.5px] font-medium text-blue-700">
                                                    {r.po.vendor.paymentTerms}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </td>
                                <td className="px-3 py-2.5 text-gray-700">{r.transportName}</td>
                                <td className="px-3 py-2.5 text-gray-800">{r.productName || '—'}</td>
                                <td className="px-3 py-2.5 text-gray-700">{r.orderedQty}</td>
                                <td className="px-3 py-2.5 font-semibold text-gray-900">{r.receivedQty}</td>
                                <td className="px-3 py-2.5 text-gray-700 font-semibold">{r.receivedDagg ?? '—'}</td>
                                <td className="px-3 py-2.5 text-gray-600">{r.receiptDate || (r.receivedAt ? new Date(r.receivedAt).toISOString().split('T')[0] : '—')}</td>
                                <td className="px-3 py-2.5 text-gray-600">{r.receiptTime || '—'}</td>
                                <td className="px-3 py-2.5 text-[11.5px] text-gray-500 truncate max-w-[120px]" title={r.receivedBy}>{r.receivedBy || '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function ReceiveItemsModal({ delivery, po, receivings, receivingToEdit, onClose, onSuccess }) {
    const alreadyReceivedMap = useMemo(() => {
        const map = {};
        receivings
            .filter((r) => r.deliveryId === delivery.id && (!receivingToEdit || r.id !== receivingToEdit.id))
            .forEach((r) => {
                (r.items || []).forEach((it) => {
                    map[it.productName] = (map[it.productName] || 0) + Number(it.receivedQty || 0);
                });
            });
        return map;
    }, [receivings, delivery, receivingToEdit]);

    const totalReceivedDagg = useMemo(() => {
        return (receivings || [])
            .filter((r) => r.deliveryId === delivery.id && (!receivingToEdit || r.id !== receivingToEdit.id))
            .reduce((sum, r) => sum + (Number(r.receivedDagg) || 0), 0);
    }, [receivings, delivery, receivingToEdit]);

    const remainingDagg = Math.max((Number(delivery.daggCount) || 0) - totalReceivedDagg, 0);

    const initialItems = (po?.items || [])
        .map((it) => {
            const already = alreadyReceivedMap[it.productName] || 0;
            const remaining = Math.max(Number(it.qty) - already, 0);

            let curReceived = 0;
            if (receivingToEdit) {
                const foundItem = (receivingToEdit.items || []).find(x => x.productName === it.productName);
                if (foundItem) curReceived = Number(foundItem.receivedQty) || 0;
            }

            return {
                productCode: it.productCode,
                productName: it.productName,
                orderedQty: it.qty,
                alreadyReceived: already,
                remaining,
                receivedQty: receivingToEdit ? curReceived : remaining,
            };
        })
        .filter((it) => it.remaining > 0 || (receivingToEdit && it.alreadyReceived > 0));

    const [items, setItems] = useState(initialItems);
    const [receiptDate, setReceiptDate] = useState(receivingToEdit ? (receivingToEdit.receiptDate ? new Date(receivingToEdit.receiptDate).toISOString().split('T')[0] : '') : new Date().toISOString().split('T')[0]);
    const [receiptTime, setReceiptTime] = useState(receivingToEdit ? (receivingToEdit.receiptTime || '') : new Date().toLocaleTimeString('en-US', { hour12: false }).slice(0, 5));
    const [receivedDagg, setReceivedDagg] = useState(receivingToEdit ? (receivingToEdit.receivedDagg || '') : remainingDagg);
    const [receivedBy, setReceivedBy] = useState(receivingToEdit ? (receivingToEdit.receivedBy || '') : '');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    function updateQty(index, value) {
        setItems((rows) => rows.map((r, i) => (i === index ? { ...r, receivedQty: value } : r)));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');

        const overEntry = items.find((it) => Number(it.receivedQty) > it.remaining);
        if (overEntry) {
            setError(`Received qty for "${overEntry.productName}" can't exceed the remaining ${overEntry.remaining}.`);
            return;
        }

        const inputDagg = Number(receivedDagg);
        if (isNaN(inputDagg) || inputDagg < 0) {
            setError('Received Dagg must be a non-negative number.');
            return;
        }
        if (inputDagg > remainingDagg) {
            setError(`Received Dagg cannot exceed the remaining ${remainingDagg} daggs.`);
            return;
        }

        if (!receivedBy || !receivedBy.trim()) {
            setError('Received By is required.');
            return;
        }

        setSubmitting(true);
        try {
            const fullyReceived = items.every(
                (it) => it.alreadyReceived + Number(it.receivedQty || 0) >= Number(it.orderedQty)
            );
            if (receivingToEdit) {
                await reviseReceiving({ receivingId: receivingToEdit.id, items, fullyReceived, receiptDate, receiptTime, receivedDagg: inputDagg, receivedBy });
            } else {
                await submitReceiving({ deliveryId: delivery.id, items, fullyReceived, receiptDate, receiptTime, receivedDagg: inputDagg, receivedBy });
            }
            onSuccess();
        } catch (err) {
            setError(err.message || 'Failed to save receiving.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Modal open={true} onClose={onClose} title={receivingToEdit ? `Revise Receiving — ${po?.poNo || delivery.transportName}` : `Receive — ${po?.poNo || delivery.transportName}`} size="lg">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl bg-gray-50 px-4 py-3 text-[12.5px] text-gray-600">
                    <div>
                        <span className="font-semibold text-gray-500">Transporter:</span> <span className="font-bold text-gray-900">{delivery.transportName}</span>
                    </div>
                    <div>
                        <span className="font-semibold text-gray-500">Bill Date:</span> <span className="font-bold text-gray-900">{delivery.billDate || '—'}</span>
                    </div>
                    <div>
                        <span className="font-semibold text-gray-500">Assigned Dagg:</span> <span className="font-bold text-gray-900">{delivery.daggCount || '0'}</span>
                    </div>
                    <div>
                        <span className="font-semibold text-gray-500">Remaining Dagg:</span> <span className="font-bold text-gray-900">{remainingDagg}</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-gray-150 p-4 rounded-xl bg-white shadow-sm">
                    <div>
                        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-500">Received By</label>
                        <input
                            type="text"
                            required
                            className="input border-gray-300 font-bold"
                            value={receivedBy}
                            onChange={(e) => setReceivedBy(e.target.value)}
                            placeholder="Received by"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-500">Received Dagg</label>
                        <input
                            type="number"
                            required
                            min="0"
                            max={remainingDagg}
                            className="input border-gray-300 font-bold"
                            value={receivedDagg}
                            onChange={(e) => setReceivedDagg(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-500">Receipt Date</label>
                        <input
                            type="date"
                            required
                            className="input border-gray-300"
                            value={receiptDate}
                            onChange={(e) => setReceiptDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-500">Receipt Time</label>
                        <input
                            type="time"
                            required
                            className="input border-gray-300"
                            value={receiptTime}
                            onChange={(e) => setReceiptTime(e.target.value)}
                        />
                    </div>
                </div>

                {items.length === 0 ? (
                    <div className="text-[12.5px] text-gray-500">No product line items found for this PO.</div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                        <table className="w-full text-left text-[12.5px]">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200 text-[10.3px] font-bold uppercase tracking-wide text-gray-500">
                                    <th className="px-3 py-2.5">Product</th>
                                    <th className="px-3 py-2.5">Ordered Qty</th>
                                    <th className="px-3 py-2.5">Already Received</th>
                                    <th className="px-3 py-2.5">Remaining</th>
                                    <th className="px-3 py-2.5">Receiving Now</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, i) => (
                                    <tr key={i} className="border-t border-gray-100">
                                        <td className="px-3 py-2.5 font-semibold text-gray-900">{item.productName}</td>
                                        <td className="px-3 py-2.5 text-gray-700">{item.orderedQty}</td>
                                        <td className="px-3 py-2.5 text-gray-700">{item.alreadyReceived}</td>
                                        <td className="px-3 py-2.5 font-semibold text-gray-900">{item.remaining}</td>
                                        <td className="px-3 py-2.5">
                                            <input
                                                type="number"
                                                step="0.01"
                                                max={item.remaining}
                                                className="input"
                                                value={item.receivedQty}
                                                onChange={(e) => updateQty(i, e.target.value)}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {error && <div className="text-[12.5px] font-semibold text-rose-600">{error}</div>}

                <div className="flex justify-end gap-2 border-t border-gray-100 pt-2">
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
                        <PackageCheck size={16} />
                        {submitting ? 'Saving…' : 'Confirm Receiving'}
                    </button>
                </div>
            </form>

            <style>{`
        .input { height: 38px; border-radius: 0.6rem; border: 1px solid #e5e7eb; padding: 0 0.6rem; font-size: 13px; width: 100%; }
        .input:focus { outline: none; border-color: #173254; }
      `}</style>
        </Modal>
    );
}