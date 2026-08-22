import { Loader2, Wallet, ImageIcon, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CardPanel, EmptyState, FilterBar } from './ui';
import { fetchPaymentApprovals, fetchPayments, fetchPOs, submitPayment } from '../services/purchaseService';
import { fmt } from '../utils/helpers';
import Modal from './Modal';
import { fetchTatTracking, renderPlannedDateCell, fetchTatSettings } from '../../../core/services/tatService';

export default function PaymentView() {
    const [tab, setTab] = useState('pending');
    const [approvals, setApprovals] = useState([]);
    const [payments, setPayments] = useState([]);
    const [pos, setPos] = useState([]);
    const [tatTracking, setTatTracking] = useState({});
    const [tatMins, setTatMins] = useState(10);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [selectedApproval, setSelectedApproval] = useState(null);
    const [, setTick] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => setTick(t => t + 1), 10000);
        return () => clearInterval(timer);
    }, []);

    async function loadData() {
        setLoading(true);
        setError('');
        try {
            const [approvalsData, paymentsData, posData] = await Promise.all([fetchPaymentApprovals(), fetchPayments(), fetchPOs()]);
            setApprovals(approvalsData || []);
            setPayments(paymentsData || []);
            setPos(posData || []);

            const approvalIds = (approvalsData || []).map(a => a.id);
            if (approvalIds.length > 0) {
                try {
                    const trackings = await fetchTatTracking('payment', approvalIds);
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
                const paymentSetting = settingsData.find(s => s.stage_key === 'payment');
                if (paymentSetting && paymentSetting.is_active) {
                    setTatMins(paymentSetting.tat_minutes);
                }
            } catch (settingsErr) {
                console.error('Failed to load TAT settings:', settingsErr);
            }
        } catch (err) {
            setError(err.message || 'Failed to load payment data.');
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

    const paidApprovalIds = useMemo(() => new Set(payments.map((p) => p.paymentApprovalId)), [payments]);
    const pendingApprovals = useMemo(
        () => approvals.filter((a) => a.status === 'Approved' && !paidApprovalIds.has(a.id)),
        [approvals, paidApprovalIds]
    );

    return (
        <CardPanel title="Payment" desc="Record payment against approved purchase orders.">
            <div className="mb-4 inline-flex rounded-lg bg-gray-100 p-1 items-center">
                <button
                    className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[13px] font-semibold transition ${tab === 'pending' ? 'bg-[#173254] text-white' : 'text-gray-600'}`}
                    onClick={() => setTab('pending')}
                >
                    <span>Pending</span>
                    {pendingApprovals.length > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                            {pendingApprovals.length}
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
                <EmptyState icon={<Loader2 size={36} className="animate-spin" />}>Loading payment data…</EmptyState>
            ) : tab === 'pending' ? (
                <PendingPaymentsPanel approvals={pendingApprovals} poMap={poMap} tatTracking={tatTracking} tatMins={tatMins} onPay={(a) => setSelectedApproval(a)} />
            ) : (
                <PaymentHistoryPanel payments={payments} poMap={poMap} />
            )}

            {selectedApproval && (
                <RecordPaymentModal
                    approval={selectedApproval}
                    po={poMap.get(selectedApproval.poId)}
                    onClose={() => setSelectedApproval(null)}
                    onSuccess={() => {
                        setSelectedApproval(null);
                        setSuccess('Payment recorded successfully.');
                        setTimeout(() => setSuccess(''), 4000);
                        loadData();
                    }}
                />
            )}
        </CardPanel>
    );
}

function PendingPaymentsPanel({ approvals, poMap, tatTracking, tatMins, onPay }) {
    const [search, setSearch] = useState('');
    const filtered = useMemo(() => {
        const term = search.toLowerCase().trim();
        if (!term) return approvals;
        return approvals.filter((a) => (poMap.get(a.poId)?.poNo || '').toLowerCase().includes(term));
    }, [approvals, search, poMap]);

    return (
        <div>
            <FilterBar onClear={() => setSearch('')}>
                <input
                    type="text"
                    placeholder="Search PO no..."
                    className="min-w-[150px] flex-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-[12.5px]"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </FilterBar>

            <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-left text-[12.5px]">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-[10.3px] font-bold uppercase tracking-wide text-gray-500">
                                <th className="px-3 py-2.5">Action</th>
                                <th className="px-3 py-2.5">PO No.</th>
                                <th className="px-3 py-2.5">Vendor</th>
                                
                                <th className="px-3 py-2.5">Approved At</th>
                                <th className="px-3 py-2.5">Planned Date</th>
                            </tr>
                        </thead>
                        <tbody>
                             {approvals.length === 0 ? (
                                <tr><td colSpan={5} className="px-3 py-10 text-center text-gray-500">No approved POs waiting for payment.</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={5} className="px-3 py-10 text-center text-gray-500">No entries match the search.</td></tr>
                            ) : filtered.map((a) => {
                                const po = poMap.get(a.poId);
                                return (
                                    <tr key={a.id} className="border-t border-gray-100 hover:bg-gray-50">
                                        <td className="px-3 py-2.5">
                                            <button
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-[#173254] px-3 py-1 text-xs font-semibold text-white hover:bg-[#10243e]"
                                                onClick={() => onPay(a)}
                                            >
                                                <Wallet size={14} /> Pay
                                            </button>
                                        </td>
                                        <td className="px-3 py-2.5 font-semibold text-gray-900">{po?.poNo || '—'}</td>
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
                                        
                                        <td className="px-3 py-2.5 text-gray-500">
                                            {a.decidedAt ? new Date(a.decidedAt).toLocaleString('en-IN') : '—'}
                                        </td>
                                         <td className="px-3 py-2.5">{renderPlannedDateCell(tatTracking[a.id], a.decidedAt, tatMins)}</td>
                                     </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
        </div>
    );
}

function PaymentHistoryPanel({ payments, poMap }) {
    const [search, setSearch] = useState('');
    const filtered = useMemo(() => {
        const term = search.toLowerCase().trim();
        if (!term) return payments;
        return payments.filter((p) => {
            const poNo = poMap.get(p.poId)?.poNo || '';
            return `${poNo} ${p.remarks}`.toLowerCase().includes(term);
        });
    }, [payments, search, poMap]);

    return (
        <div>
            <FilterBar onClear={() => setSearch('')}>
                <input
                    type="text"
                    placeholder="Search PO no, remark..."
                    className="min-w-[150px] flex-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-[12.5px]"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </FilterBar>

           <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full min-w-[760px] text-left text-[12.5px]">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-[10.3px] font-bold uppercase tracking-wide text-gray-500">
                                <th className="px-3 py-2.5">PO No.</th>
                                <th className="px-3 py-2.5">Vendor</th>
                                <th className="px-3 py-2.5">Amount Paid</th>
                                <th className="px-3 py-2.5">Remark</th>
                                <th className="px-3 py-2.5">Payment Proof</th>
                                <th className="px-3 py-2.5">Paid At</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payments.length === 0 ? (
                                <tr><td colSpan={6} className="px-3 py-10 text-center text-gray-500">No payments recorded yet.</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={6} className="px-3 py-10 text-center text-gray-500">No entries match the search.</td></tr>
                            ) : filtered.map((p) => {
                                const po = poMap.get(p.poId);
                                return (
                                <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                                    <td className="px-3 py-2.5 font-semibold text-gray-900">{po?.poNo || '—'}</td>
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
                                    <td className="px-3 py-2.5 font-semibold text-gray-900">₹ {fmt(p.amountPaid)}</td>
                                    <td className="px-3 py-2.5 text-gray-600">{p.remarks || '—'}</td>
                                    <td className="px-3 py-2.5">
                                        {p.proofUrl ? (
                                            <a href={p.proofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#173254] underline hover:text-[#10243e]">
                                                <ImageIcon size={14} /> View
                                            </a>
                                        ) : (
                                            '—'
                                        )}
                                    </td>
                                    <td className="px-3 py-2.5 text-gray-500">
                                        {p.paidAt ? new Date(p.paidAt).toLocaleString('en-IN') : '—'}
                                    </td>
                                </tr>
                            )})}
                       </tbody>
                    </table>
                </div>
        </div>
    );
}

function RecordPaymentModal({ approval, po, onClose, onSuccess }) {
    const [amountPaid, setAmountPaid] = useState('');
    const [remarks, setRemarks] = useState('');
    const [proofFile, setProofFile] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    function handleFileChange(e) {
        setProofFile(e.target.files?.[0] || null);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        if (!amountPaid) {
            setError('Amount paid is required.');
            return;
        }
        setSubmitting(true);
        try {
            await submitPayment({ paymentApprovalId: approval.id, poId: approval.poId, proofFile, remarks, amountPaid });
            onSuccess();
        } catch (err) {
            setError(err.message || 'Failed to record payment.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Modal open={true} onClose={onClose} title={`Record Payment — ${po?.poNo || ''}`} size="md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="rounded-xl bg-gray-50 px-4 py-2.5 text-[12.5px] text-gray-600">
                    PO <span className="font-bold text-gray-900">{po?.poNo}</span> ({po?.vendor?.name}) — Grand Total ₹ {fmt(po?.grandTotal)}
                </div>

                <div>
                    <label className="mb-1 block text-[12px] font-bold text-gray-600">Amount Paid (₹)</label>
                    <input type="number" step="0.01" className="input" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder="0.00" />
                </div>

                <div>
                    <label className="mb-1 block text-[12px] font-bold text-gray-600">Payment Proof</label>
                    <label className="flex h-[42px] cursor-pointer items-center gap-2 rounded-xl border border-dashed border-gray-300 px-3 text-[13px] text-gray-500 hover:border-gray-400">
                        <Upload size={16} />
                        {proofFile ? proofFile.name : 'Choose file'}
                        <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileChange} />
                    </label>
                </div>

                <div>
                    <label className="mb-1 block text-[12px] font-bold text-gray-600">Remark</label>
                    <textarea className="input h-20 py-2" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional remark" />
                </div>

                {error && <div className="text-[12.5px] font-semibold text-rose-600">{error}</div>}

                <div className="flex justify-end gap-2 border-t border-gray-100 pt-2">
                    <button type="button" onClick={onClose} className="rounded-xl border border-gray-300 px-4 py-2 text-[13px] font-semibold text-gray-700 hover:bg-gray-50">
                        Cancel
                    </button>
                    <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-[#173254] px-5 py-2 text-[13px] font-bold text-white hover:bg-[#10243e] disabled:opacity-50">
                        <Wallet size={16} />
                        {submitting ? 'Saving…' : 'Record Payment'}
                    </button>
                </div>
            </form>

            <style>{`
        .input { min-height: 42px; border-radius: 0.75rem; border: 1px solid #e5e7eb; padding: 0 0.75rem; font-size: 13px; width: 100%; }
        .input:focus { outline: none; border-color: #173254; }
      `}</style>
        </Modal>
    );
}