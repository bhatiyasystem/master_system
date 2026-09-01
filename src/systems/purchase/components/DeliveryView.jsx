import { Loader2, Truck, ImageIcon, Plus, AlertTriangle, ChevronDown, ChevronRight, Upload } from 'lucide-react';
import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { CardPanel, EmptyState, FilterBar } from './ui';
import { fmt, uniqueValues } from '../utils/helpers';
import { createDelivery, createTransporter, fetchDeliveries, fetchIndents, fetchPOs, fetchTransporters, updateDelivery, fetchPaymentApprovals, fetchPayments } from '../services/purchaseService';
import Modal from './Modal';
import { fetchTatTracking, renderPlannedDateCell, fetchTatSettings } from '../../../core/services/tatService';
import supabase from '../../../SupabaseClient';
import { sendWhatsAppTextMessage, sendWhatsAppTemplateMessage } from '../../../services/whatsappService';

const emptyForm = {
    transportName: '',
    contact: '',
    biltyDate: '',
    biltyNumber: '',
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
    const [approvals, setApprovals] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [selectedPos, setSelectedPos] = useState(null);
    const [selectedDeliveryToEdit, setSelectedDeliveryToEdit] = useState(null);
    const [warningPo, setWarningPo] = useState(null);
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
            const [posData, delData, indentsData, approvalsData, paymentsData] = await Promise.all([
                fetchPOs(),
                fetchDeliveries(),
                fetchIndents(),
                fetchPaymentApprovals(),
                fetchPayments()
            ]);
            setPos(posData || []);
            setDeliveries(delData || []);
            setIndents(indentsData || []);
            setApprovals(approvalsData || []);
            setPayments(paymentsData || []);

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

    const isPaymentCompleted = (po) => {
        if (!po) return true;
        if (po.vendor?.paymentTerms !== 'Advance') return true;
        const app = approvals.find((a) => a.poId === po.id && a.status === 'Approved');
        if (!app) return false;
        return payments.some((pay) => pay.paymentApprovalId === app.id);
    };

    const handleLogDeliveryClick = (posGroup) => {
        const notPaid = posGroup.filter(po => !isPaymentCompleted(po));
        if (notPaid.length > 0) {
            setWarningPo(notPaid[0]);
            return;
        }
        setSelectedPos(posGroup);
    };

    const handleReviseClick = (d, po) => {
        if (!isPaymentCompleted(po)) {
            setWarningPo(po);
            return;
        }
        setSelectedDeliveryToEdit(d);
        setSelectedPos([po]);
    };

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
                    onLogDelivery={handleLogDeliveryClick}
                />
            ) : (
                <DeliveryHistoryPanel
                    deliveries={deliveries}
                    pos={pos}
                    indents={indents}
                    onRevise={handleReviseClick}
                />
            )}

            {warningPo && (
                <Modal
                    open={!!warningPo}
                    onClose={() => setWarningPo(null)}
                    title="Advance Payment Required"
                    size="md"
                    footer={
                        <button
                            className="rounded-lg bg-[#173254] px-4 py-2 text-sm font-semibold text-white"
                            onClick={() => setWarningPo(null)}
                        >
                            Close
                        </button>
                    }
                >
                    <div className="p-6 text-center space-y-4">
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-amber-50">
                            <AlertTriangle size={24} className="text-amber-500" />
                        </div>
                        <p className="text-sm font-bold text-gray-800">
                            Advance payment is required before delivery can be processed. Please complete the payment first.
                        </p>
                    </div>
                </Modal>
            )}

            {selectedPos && (
                <CreateDeliveryModal
                    pos={selectedPos}
                    deliveryToEdit={selectedDeliveryToEdit}
                    onClose={() => {
                        setSelectedPos(null);
                        setSelectedDeliveryToEdit(null);
                    }}
                    onSuccess={() => {
                        setSelectedPos(null);
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
    const [transporters, setTransporters] = useState([]);
    const [alertStatuses, setAlertStatuses] = useState({});
    const [expanded, setExpanded] = useState({});
    const checkedAlertsRef = useRef({});

    const toggleVendor = (v) => {
        setExpanded((prev) => ({ ...prev, [v]: !prev[v] }));
    };

    useEffect(() => {
        fetchTransporters()
            .then((rows) => setTransporters(rows || []))
            .catch((err) => console.error("Error fetching transporters for alerts:", err));
    }, []);

    const handleSendAlerts = useCallback(async (po, isSilent = false) => {
        const delayDays = po.poDate ? Math.max(0, Math.floor((Date.now() - new Date(po.poDate).getTime()) / 86400000)) : 0;
        if (delayDays < 3) return;

        setAlertStatuses(prev => ({ ...prev, [po.id]: 'sending' }));
        let successCount = 0;
        let errors = [];

        // 1. Send to Vendor only - Template: dispatch_reminder_purchase
        const vendorPhone = po.vendor?.contact;
        if (vendorPhone) {
            try {
                const templateSent = await sendWhatsAppTemplateMessage(
                    vendorPhone,
                    'dispatch_reminder_purchase',
                    [po.vendor.name || 'Vendor', po.poNo, po.poDate, String(delayDays)],
                    'en',
                    { recipientName: po.vendor.name, stage: 'Delivery Delay Alert', referenceId: po.poNo }
                );
                if (templateSent) {
                    successCount++;
                } else {
                    const text = `Dear *${po.vendor.name}*, your delivery for PO *${po.poNo}* (dated ${po.poDate}) is pending. Please expedite delivery. Thank you, Bhatia Enterprises.`;
                    const textSent = await sendWhatsAppTextMessage(
                        vendorPhone,
                        text,
                        { recipientName: po.vendor.name, stage: 'Delivery Delay Alert (Text)', referenceId: po.poNo }
                    );
                    if (textSent) successCount++;
                }
            } catch (err) {
                console.error("Failed to alert vendor:", err);
            }
        } else {
            errors.push("Vendor phone number not found.");
        }

        if (successCount > 0) {
            setAlertStatuses(prev => ({ ...prev, [po.id]: 'sent' }));
        } else {
            setAlertStatuses(prev => ({ ...prev, [po.id]: 'error' }));
        }

        if (!isSilent) {
            if (successCount > 0) {
                alert(`Successfully sent ${successCount} WhatsApp reminder(s).`);
            } else {
                alert(`Failed to send reminders. ${errors.join(' ')}`);
            }
        }
    }, []);

    const pendingPOs = useMemo(() => {
        const deliveredIds = new Set((deliveries || []).map(d => d.poId));
        return (pos || []).filter(po => !deliveredIds.has(po.id));
    }, [pos, deliveries]);

    const indentMap = useMemo(() => {
        const map = new Map();
        indents.forEach((indent) => map.set(indent.dbId, indent));
        return map;
    }, [indents]);

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

    const groups = useMemo(() => {
        const g = {};
        filteredRows.forEach((po) => {
            const v = po.vendor?.name || 'Unknown Vendor';
            (g[v] = g[v] || []).push(po);
        });
        return g;
    }, [filteredRows]);

    const clearFilters = () => {
        setSearch('');
        setVendor('');
    };

    useEffect(() => {
        if (!pos.length) return;

        const checkAndSendAutoAlerts = async () => {
            for (const po of pendingPOs) {
                const delayDays = po.poDate ? Math.max(0, Math.floor((Date.now() - new Date(po.poDate).getTime()) / 86400000)) : 0;
                if (delayDays >= 3) {
                    const cacheKey = `delivery_alert_${po.id}`;
                    if (checkedAlertsRef.current[cacheKey]) continue;
                    checkedAlertsRef.current[cacheKey] = true;

                    try {
                        const { data, error } = await supabase
                            .from('whatsapp_logs')
                            .select('id')
                            .eq('reference_id', po.poNo)
                            .in('stage', ['Delivery Delay Alert', 'Delivery Delay Alert (Text)'])
                            .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

                        if (!error && data && data.length > 0) {
                            setAlertStatuses(prev => ({ ...prev, [po.id]: 'sent' }));
                        } else {
                            console.log(`[AutoAlert] Delay is ${delayDays} days. Triggering auto alerts for PO: ${po.poNo}`);
                            await handleSendAlerts(po, true);
                        }
                    } catch (err) {
                        console.error("[AutoAlert] Failed checking/sending alerts:", err);
                        checkedAlertsRef.current[cacheKey] = false;
                    }
                }
            }
        };

        checkAndSendAutoAlerts();
    }, [pos, pendingPOs, handleSendAlerts]);

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

            {pendingPOs.length === 0 ? (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-[12.6px]">
                        <thead>
                            <tr className="bg-gray-50 text-gray-500">
                                {['PO No.', 'Date', 'Category', 'Unit', 'Parent Group', 'PO Delay', 'Planned Date', 'Alerts'].map((h) => (
                                    <th key={h} className="whitespace-nowrap border-b border-gray-200 px-3 py-2.5 text-left text-[10.3px] font-bold uppercase tracking-wide">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td colSpan={8} className="px-3 py-10 text-center text-gray-500">No purchase orders waiting for delivery.</td></tr>
                        </tbody>
                    </table>
                </div>
            ) : filteredRows.length === 0 ? (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-[12.6px]">
                        <thead>
                            <tr className="bg-gray-50 text-gray-500">
                                {['PO No.', 'Date', 'Category', 'Unit', 'Parent Group', 'PO Delay', 'Planned Date', 'Alerts'].map((h) => (
                                    <th key={h} className="whitespace-nowrap border-b border-gray-200 px-3 py-2.5 text-left text-[10.3px] font-bold uppercase tracking-wide">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td colSpan={8} className="px-3 py-10 text-center text-gray-500">No pending POs match the current filters.</td></tr>
                        </tbody>
                    </table>
                </div>
            ) : (
                Object.keys(groups).sort().map((vendorName) => {
                    const list = groups[vendorName];
                    return (
                        <div key={vendorName} className="mb-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
                            <div className="flex flex-wrap items-center justify-between gap-2 p-4">
                                <button
                                    type="button"
                                    onClick={() => toggleVendor(vendorName)}
                                    className="flex items-center gap-1.5 text-left"
                                >
                                    {expanded[vendorName] ? <ChevronDown size={15} className="text-gray-500" /> : <ChevronRight size={15} className="text-gray-500" />}
                                    <span className="text-[14px] font-bold text-[#173254]">{vendorName}</span>
                                    <span className="text-[11.5px] text-gray-500">— {list.length} pending PO(s)</span>
                                </button>
                                <button
                                    className="rounded-lg bg-[#173254] px-4 py-2 text-xs font-bold text-white hover:bg-[#10243e] flex items-center gap-1.5 transition-colors"
                                    onClick={() => onLogDelivery(list)}
                                >
                                    <Truck size={14} /> Log Delivery
                                </button>
                            </div>
                            {expanded[vendorName] && (
                                <div className="overflow-x-auto border-t border-gray-200">
                                    <table className="w-full text-[12.6px]">
                                        <thead>
                                            <tr className="bg-gray-50 text-gray-500">
                                                {['PO No.', 'Date', 'Category', 'Unit', 'Parent Group', 'PO Delay', 'Planned Date', 'Alerts'].map((h) => (
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
                                            {list.map((po) => (
                                                <tr key={po.id} className="border-t border-gray-100 hover:bg-gray-50">
                                                    <td className="px-3 py-2.5 font-semibold text-gray-900">{po.poNo}</td>
                                                    <td className="px-3 py-2.5 text-gray-600">{po.poDate}</td>
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
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        {(() => {
                                                            const d = po.poDate ? Math.max(0, Math.floor((Date.now() - new Date(po.poDate).getTime()) / 86400000)) : 0;
                                                            if (d >= 3) {
                                                                const status = alertStatuses[po.id];
                                                                if (status === 'sent') {
                                                                    return <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">✅ Auto Sent</span>;
                                                                }
                                                                if (status === 'sending') {
                                                                    return <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-600/20">⏳ Sending...</span>;
                                                                }
                                                                if (status === 'error') {
                                                                    return <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20">❌ Error</span>;
                                                                }
                                                                return <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">⏳ Checking...</span>;
                                                            }
                                                            return <span className="text-gray-400 text-xs">—</span>;
                                                        })()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    );
                })
            )}
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
            return `${poNo} ${d.transportName} ${poMap.get(d.poId)?.vendor?.name} ${d.billNumber} ${d.biltyNumber}`.toLowerCase().includes(term);
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
                            <th className="px-3 py-2.5">Bilty No.</th>
                            <th className="px-3 py-2.5">Bilty Date</th>
                            <th className="px-3 py-2.5">No. of Dagg</th>
                            <th className="px-3 py-2.5">Bilty Image</th>
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
                                    <td className="px-3 py-2.5 text-gray-600">{d.biltyNumber || '—'}</td>
                                    <td className="px-3 py-2.5 text-gray-600">{d.biltyDate || '—'}</td>
                                    <td className="px-3 py-2.5 text-gray-600">{d.daggCount ?? '—'}</td>
                                    <td className="px-3 py-2.5">
                                        {d.biltyImageUrl ? (
                                            <a
                                                href={d.biltyImageUrl}
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

function CreateDeliveryModal({ pos, deliveryToEdit, onClose, onSuccess }) {
    const firstPo = pos[0];
    const [selectedPoIds, setSelectedPoIds] = useState(new Set(pos.map(p => p.id)));
    const [form, setForm] = useState(deliveryToEdit ? {
        transportName: deliveryToEdit.transportName || '',
        contact: deliveryToEdit.contact || '',
        biltyDate: deliveryToEdit.biltyDate ? (() => {
            try {
                return new Date(deliveryToEdit.biltyDate).toISOString().split('T')[0];
            } catch (e) {
                return deliveryToEdit.biltyDate;
            }
        })() : '',
        biltyNumber: deliveryToEdit.biltyNumber || '',
        daggCount: deliveryToEdit.daggCount || '',
        billNumber: deliveryToEdit.billNumber || '',
        billDate: deliveryToEdit.billDate ? (() => {
            try {
                return new Date(deliveryToEdit.billDate).toISOString().split('T')[0];
            } catch (e) {
                return deliveryToEdit.billDate;
            }
        })() : '',
    } : {
        transportName: firstPo?.vendor_fix_transporter || '',
        contact: '',
        biltyDate: '',
        biltyNumber: '',
        daggCount: '',
        billNumber: '',
        billDate: '',
    });
    const [transporters, setTransporters] = useState([]);
    const [showAddTransporter, setShowAddTransporter] = useState(false);
    const [biltyImageFile, setBiltyImageFile] = useState(null);
    const [billImageFile, setBillImageFile] = useState(null);
    const [biltyImagePreview, setBiltyImagePreview] = useState(null);
    const [billImagePreview, setBillImagePreview] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchTransporters().then((rows) => {
            setTransporters(rows);
            if (!deliveryToEdit && firstPo?.vendor_fix_transporter) {
                const t = rows.find(tr => String(tr.name || '').trim().toLowerCase() === String(firstPo.vendor_fix_transporter).trim().toLowerCase());
                if (t) {
                    setForm(f => ({ ...f, contact: t.contacts?.[0] || '' }));
                }
            }
        }).catch(() => setTransporters([]));
    }, [firstPo, deliveryToEdit]);

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
        setBiltyImageFile(file);
        if (biltyImagePreview) URL.revokeObjectURL(biltyImagePreview);
        setBiltyImagePreview(file ? URL.createObjectURL(file) : null);
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

        if (!form.transportName || !form.biltyNumber || !form.biltyDate || !form.daggCount) {
            setError('Transport name, builty number, builty date and number of dagg are required.');
            return;
        }

        setSubmitting(true);
        try {
            if (selectedPoIds.size === 0 && !deliveryToEdit) {
                setError('Please select at least one PO.');
                setSubmitting(false);
                return;
            }

            if (deliveryToEdit) {
                await updateDelivery({
                    id: deliveryToEdit.id,
                    ...form,
                    biltyImageFile,
                    billImageFile,
                    existingBiltyUrl: deliveryToEdit.biltyImageUrl,
                    existingBillUrl: deliveryToEdit.billImageUrl
                });
            } else {
                await createDelivery({ ...form, poIds: Array.from(selectedPoIds), biltyImageFile, billImageFile });
            }
            if (biltyImagePreview) URL.revokeObjectURL(biltyImagePreview);
            onSuccess();
        } catch (err) {
            setError(err.message || 'Failed to save delivery.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Modal open={true} onClose={onClose} title={deliveryToEdit ? `Revise Delivery — ${firstPo?.poNo}` : `Create Delivery — ${firstPo?.vendor?.name}`} size="lg">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2 rounded-xl bg-gray-50 px-4 py-2.5 text-[12.5px] text-gray-600">
                    Delivery against {pos.length === 1 ? <span className="font-bold text-gray-900">{firstPo?.poNo}</span> : `${pos.length} POs`} ({firstPo?.vendor?.name})
                </div>

                {/* PO Selection List */}
                {!deliveryToEdit && pos.length > 1 && (
                    <div className="md:col-span-2">
                        <label className="mb-2 block text-[12px] font-bold text-gray-600">Select POs to include in this delivery:</label>
                        <div className="flex flex-col gap-2 max-h-40 overflow-y-auto rounded-xl border border-gray-200 p-3 bg-white">
                            {pos.map(p => (
                                <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="h-4 w-4 rounded border-gray-300 text-[#173254] focus:ring-[#173254]"
                                        checked={selectedPoIds.has(p.id)}
                                        onChange={(e) => {
                                            const newSet = new Set(selectedPoIds);
                                            if (e.target.checked) newSet.add(p.id);
                                            else newSet.delete(p.id);
                                            setSelectedPoIds(newSet);
                                        }}
                                    />
                                    <span className="text-[13px] font-semibold text-gray-800">{p.poNo}</span>
                                    <span className="text-[12px] text-gray-500">— {p.poDate}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                <Field label="Transport Name" required>
                    <div className="flex items-center gap-2 w-full">
                        <div className="flex-1 min-w-0">
                            <SearchableTransporterSelect
                                options={transporters.map((t) => t.name)}
                                value={form.transportName}
                                onChange={handleTransportSelect}
                                placeholder="Select or type transporter..."
                            />
                        </div>
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

                <Field label="Bilty Number" required>
                    <input
                        className="input"
                        required
                        value={form.biltyNumber}
                        onChange={(e) => update('biltyNumber', e.target.value)}
                        placeholder="e.g. BLT-00123"
                    />
                </Field>

                <Field label="Bilty Date" required>
                    <input
                        type="date"
                        className="input"
                        required
                        value={form.biltyDate}
                        onChange={(e) => update('biltyDate', e.target.value)}
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

                <Field label="Bill Date (Optional)" >
                    <input
                        type="date"
                        className="input"
                        value={form.billDate}
                        onChange={(e) => update('billDate', e.target.value)}
                    />
                </Field>

                <Field label="Bilty Image">
                    <label className="flex h-[42px] cursor-pointer items-center gap-2 rounded-xl border border-dashed border-gray-300 px-3 text-[13px] text-gray-500 hover:border-gray-400">
                        <Upload size={16} />
                        {biltyImageFile ? biltyImageFile.name : 'Choose image'}
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

                {/* {biltyImagePreview && (
                    <div className="md:col-span-2">
                        <img src={biltyImagePreview} alt="Bilty preview" className="max-h-48 rounded-xl border border-gray-200" />
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
    const [form, setForm] = useState({
        name: '',
        contacts: [''],
        duration: '',
        cities: [''],
        address: '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    function update(key, value) {
        setForm((f) => ({ ...f, [key]: value }));
    }

    function updateMulti(key, index, value) {
        setForm((f) => {
            const arr = [...f[key]];
            arr[index] = value;
            return { ...f, [key]: arr };
        });
    }

    function addMultiRow(key) {
        setForm((f) => ({ ...f, [key]: [...f[key], ''] }));
    }

    function removeMultiRow(key, index) {
        setForm((f) => {
            const arr = f[key].filter((_, i) => i !== index);
            return { ...f, [key]: arr.length ? arr : [''] };
        });
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');

        const nameVal = String(form.name || '').trim();
        if (!nameVal) {
            setError('Transporter Name is required.');
            return;
        }

        const payload = {
            name: nameVal,
            contacts: (form.contacts || []).map((v) => v.trim()).filter(Boolean),
            duration: String(form.duration || '').trim(),
            cities: (form.cities || []).map((v) => v.trim()).filter(Boolean),
            address: String(form.address || '').trim(),
        };

        setSaving(true);
        try {
            const { data, error } = await supabase
                .from('transporters')
                .insert(payload)
                .select()
                .single();
            if (error) throw error;
            onCreated(data);
        } catch (err) {
            setError(err.message || 'Failed to save transporter.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal open={true} onClose={onClose} title="Add Transporter" size="lg">
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                <div className="overflow-y-auto flex-1 px-6 py-5">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                        <div className="col-span-2 space-y-1">
                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                                Transporter Name <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={(e) => update('name', e.target.value)}
                                placeholder="Enter transporter name"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                            />
                        </div>

                        <div className="col-span-2 space-y-2">
                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                                Contact Number
                            </label>
                            {form.contacts.map((val, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={val}
                                        onChange={(e) => updateMulti('contacts', i, e.target.value)}
                                        placeholder="Enter contact number"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                                    />
                                    {form.contacts.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeMultiRow('contacts', i)}
                                            className="shrink-0 text-gray-400 hover:text-rose-500"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => addMultiRow('contacts')}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
                            >
                                <Plus size={12} /> Add Contact Number
                            </button>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                                Duration
                            </label>
                            <input
                                type="text"
                                value={form.duration}
                                onChange={(e) => update('duration', e.target.value)}
                                placeholder="Enter duration"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                            />
                        </div>

                        <div className="col-span-2 space-y-2">
                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                                City
                            </label>
                            {form.cities.map((val, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={val}
                                        onChange={(e) => updateMulti('cities', i, e.target.value)}
                                        placeholder="City name"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                                    />
                                    {form.cities.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeMultiRow('cities', i)}
                                            className="shrink-0 text-gray-400 hover:text-rose-500"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => addMultiRow('cities')}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
                            >
                                <Plus size={12} /> Add City
                            </button>
                        </div>

                        <div className="col-span-2 space-y-1">
                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                                Address
                            </label>
                            <input
                                type="text"
                                value={form.address}
                                onChange={(e) => update('address', e.target.value)}
                                placeholder="Enter transporter address"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                            />
                        </div>
                    </div>
                </div>

                {error && <div className="px-6 pb-4 text-[12px] font-semibold text-rose-600">{error}</div>}

                <div className="flex justify-end gap-2 border-t border-gray-100 p-4 bg-gray-50 flex-shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-gray-300 px-4 py-2 text-[13px] font-semibold text-gray-700 hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#173254] px-5 py-2 text-[13px] font-bold text-white hover:bg-[#10243e] disabled:opacity-50"
                    >
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

function SearchableTransporterSelect({ options, value, onChange, placeholder }) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState(value || '');
    const containerRef = useRef(null);

    useEffect(() => {
        setSearch(value || '');
    }, [value]);

    useEffect(() => {
        function handleClickOutside(e) {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filtered = options.filter(opt =>
        String(opt).toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div ref={containerRef} className="relative w-full">
            <div className="relative flex items-center">
                <input
                    type="text"
                    value={search}
                    onFocus={() => setIsOpen(true)}
                    onChange={(e) => {
                        const val = e.target.value;
                        setSearch(val);
                        setIsOpen(true);
                        onChange(val);
                    }}
                    placeholder={placeholder}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all pr-10"
                />
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="absolute right-3 text-gray-400 hover:text-gray-600 transition-colors bg-transparent border-none outline-none cursor-pointer"
                >
                    <svg className={`w-4 h-4 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
            </div>

            {isOpen && (
                <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded-2xl shadow-xl max-h-60 overflow-y-auto py-1">
                    {filtered.length > 0 ? (
                        filtered.map((opt) => (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => {
                                    onChange(opt);
                                    setSearch(opt);
                                    setIsOpen(false);
                                }}
                                className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors hover:bg-blue-50/60 border-none bg-transparent cursor-pointer ${value === opt ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-700'
                                    }`}
                            >
                                {opt}
                            </button>
                        ))
                    ) : (
                        <div className="px-4 py-3 text-xs text-gray-400 font-medium italic">
                            No matches (press Enter to use custom value)
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}