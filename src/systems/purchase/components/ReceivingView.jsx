import { Loader2, PackageCheck, ImageIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CardPanel, EmptyState, FilterBar } from './ui';
import { fetchDeliveries, fetchPOs, fetchReceivings, submitReceiving } from '../services/purchaseService';

export default function ReceivingView() {
    const [tab, setTab] = useState('pending');
    const [deliveries, setDeliveries] = useState([]);
    const [pos, setPos] = useState([]);
    const [receivings, setReceivings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [selectedDelivery, setSelectedDelivery] = useState(null);

    async function loadData() {
        setLoading(true);
        setError('');
        try {
            const [delData, posData, recData] = await Promise.all([fetchDeliveries(), fetchPOs(), fetchReceivings()]);
            setDeliveries(delData || []);
            setPos(posData || []);
            setReceivings(recData || []);
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

    return (
        <CardPanel title="Receiving" desc="Confirm goods received against each delivery, product by product.">
            <div className="mb-4 inline-flex rounded-lg bg-gray-100 p-1">
                <button
                    className={`rounded-md px-3.5 py-1.5 text-[13px] font-semibold transition ${tab === 'pending' ? 'bg-[#173254] text-white' : 'text-gray-600'}`}
                    onClick={() => setTab('pending')}
                >
                    Pending
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
                <PendingReceivingPanel deliveries={deliveries} poMap={poMap} onUpdate={(d) => setSelectedDelivery(d)} />
            ) : (
                <ReceivingHistoryPanel receivings={receivings} deliveries={deliveries} poMap={poMap} />
            )}

            {selectedDelivery && (
                <ReceiveItemsModal
                    delivery={selectedDelivery}
                    po={poMap.get(selectedDelivery.poId)}
                    receivings={receivings}
                    onClose={() => setSelectedDelivery(null)}
                    onSuccess={() => {
                        setSelectedDelivery(null);
                        setSuccess('Receiving recorded successfully.');
                        setTimeout(() => setSuccess(''), 4000);
                        loadData();
                    }}
                />
            )}
        </CardPanel>
    );
}

function PendingReceivingPanel({ deliveries, poMap, onUpdate }) {
    const [search, setSearch] = useState('');

    const pending = useMemo(() => deliveries.filter((d) => !d.received), [deliveries]);

    const filtered = useMemo(() => {
        const term = search.toLowerCase().trim();
        if (!term) return pending;
        return pending.filter((d) => {
            const poNo = poMap.get(d.poId)?.poNo || '';
            return `${poNo} ${d.transportName} ${d.builtyNumber}`.toLowerCase().includes(term);
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
                                <th className="px-3 py-2.5">Transporter</th>
                                <th className="px-3 py-2.5">Contact</th>
                                <th className="px-3 py-2.5">Builty No.</th>
                                <th className="px-3 py-2.5">Builty Image</th>
                                <th className="px-3 py-2.5">Arrived</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pending.length === 0 ? (
                                <tr><td colSpan={7} className="px-3 py-10 text-center text-gray-500">No deliveries waiting to be received.</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={7} className="px-3 py-10 text-center text-gray-500">No deliveries match the search.</td></tr>
                            ) : filtered.map((d) => {
                                const poNo = poMap.get(d.poId)?.poNo || '—';
                                return (
                                    <tr key={d.id} className="border-t border-gray-100 hover:bg-gray-50">
                                        <td className="px-3 py-2.5">
                                            <button
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-[#173254] px-3 py-1 text-xs font-semibold text-white hover:bg-[#10243e]"
                                                onClick={() => onUpdate(d)}
                                            >
                                                <PackageCheck size={14} /> Update
                                            </button>
                                        </td>
                                        <td className="px-3 py-2.5 font-semibold text-gray-900">{poNo}</td>
                                        <td className="px-3 py-2.5 font-semibold text-gray-900">{d.transportName}</td>
                                        <td className="px-3 py-2.5 text-gray-600">{d.contact || '—'}</td>
                                        <td className="px-3 py-2.5 text-gray-600">{d.builtyNumber || '—'}</td>
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
                                    </tr>
                                );
                            })}
                       </tbody>
                    </table>
                </div>
        </div>
    );
}

function ReceivingHistoryPanel({ receivings, deliveries, poMap }) {
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
            const poNo = delivery ? poMap.get(delivery.poId)?.poNo : null;
            (r.items || []).forEach((item) => {
                flat.push({
                    receivingId: r.id,
                    poNo: poNo || '—',
                    transportName: delivery?.transportName || '—',
                    productName: item.productName,
                    productCode: item.productCode,
                    orderedQty: item.orderedQty,
                    receivedQty: item.receivedQty,
                    receivedAt: r.receivedAt,
                });
            });
        });
        return flat;
    }, [receivings, deliveryMap, poMap]);

    const filtered = useMemo(() => {
        const term = search.toLowerCase().trim();
        if (!term) return rows;
        return rows.filter((r) => `${r.poNo} ${r.transportName} ${r.productName}`.toLowerCase().includes(term));
    }, [rows, search]);

    return (
        <div>
            <FilterBar onClear={() => setSearch('')}>
                <input
                    type="text"
                    placeholder="Search PO no, driver, product..."
                    className="min-w-[150px] flex-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-[12.5px]"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </FilterBar>

           <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full min-w-[820px] text-left text-[12.5px]">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-[10.3px] font-bold uppercase tracking-wide text-gray-500">
                                <th className="px-3 py-2.5">PO No.</th>
                                <th className="px-3 py-2.5">Transporter</th>
                                <th className="px-3 py-2.5">Product</th>
                                <th className="px-3 py-2.5">Ordered Qty</th>
                                <th className="px-3 py-2.5">Received Qty</th>
                                <th className="px-3 py-2.5">Received At</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr><td colSpan={6} className="px-3 py-10 text-center text-gray-500">No receivings submitted yet.</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={6} className="px-3 py-10 text-center text-gray-500">No receivings match the search.</td></tr>
                            ) : filtered.map((r, i) => (
                                <tr key={`${r.receivingId}-${i}`} className="border-t border-gray-100 hover:bg-gray-50">
                                    <td className="px-3 py-2.5 font-semibold text-gray-900">{r.poNo}</td>
                                    <td className="px-3 py-2.5 text-gray-700">{r.transportName}</td>
                                    <td className="px-3 py-2.5 text-gray-800">{r.productName || '—'}</td>
                                    <td className="px-3 py-2.5 text-gray-700">{r.orderedQty}</td>
                                    <td className="px-3 py-2.5 font-semibold text-gray-900">{r.receivedQty}</td>
                                    <td className="px-3 py-2.5 text-gray-500">
                                        {r.receivedAt ? new Date(r.receivedAt).toLocaleString('en-IN') : '—'}
                                    </td>
                                </tr>
                            ))}
                       </tbody>
                    </table>
                </div>
        </div>
    );
}

function ReceiveItemsModal({ delivery, po, receivings, onClose, onSuccess }) {
    const alreadyReceivedMap = useMemo(() => {
        const map = {};
        receivings
            .filter((r) => r.deliveryId === delivery.id)
            .forEach((r) => {
                (r.items || []).forEach((it) => {
                    map[it.productName] = (map[it.productName] || 0) + Number(it.receivedQty || 0);
                });
            });
        return map;
    }, [receivings, delivery]);

    const initialItems = (po?.items || [])
        .map((it) => {
            const already = alreadyReceivedMap[it.productName] || 0;
            const remaining = Math.max(Number(it.qty) - already, 0);
            return {
                productCode: it.productCode,
                productName: it.productName,
                orderedQty: it.qty,
                alreadyReceived: already,
                remaining,
                receivedQty: remaining,
            };
        })
        .filter((it) => it.remaining > 0);

    const [items, setItems] = useState(initialItems);
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

        setSubmitting(true);
        try {
            const fullyReceived = items.every(
                (it) => it.alreadyReceived + Number(it.receivedQty || 0) >= Number(it.orderedQty)
            );
            await submitReceiving({ deliveryId: delivery.id, items, fullyReceived });
            onSuccess();
        } catch (err) {
            setError(err.message || 'Failed to save receiving.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Modal open={true} onClose={onClose} title={`Receive — ${po?.poNo || delivery.transportName}`} size="lg">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="rounded-xl bg-gray-50 px-4 py-2.5 text-[12.5px] text-gray-600">
                    Delivery by <span className="font-bold text-gray-900">{delivery.transportName}</span>
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