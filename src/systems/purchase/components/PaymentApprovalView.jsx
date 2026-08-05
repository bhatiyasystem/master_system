import { Loader2, CheckCircle2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
;
;
import { fetchPayablePOs, fetchPaymentApprovals, submitPaymentApproval } from '../services/purchaseService';
import { fmt } from '../utils/helpers';

export default function PaymentApprovalView() {
    const [tab, setTab] = useState('pending');
    const [payablePOs, setPayablePOs] = useState([]);
    const [approvals, setApprovals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [selectedPo, setSelectedPo] = useState(null);

    async function loadData() {
        setLoading(true);
        setError('');
        try {
            const [posData, approvalsData] = await Promise.all([fetchPayablePOs(), fetchPaymentApprovals()]);
            setPayablePOs(posData || []);
            setApprovals(approvalsData || []);
        } catch (err) {
            setError(err.message || 'Failed to load payment approval data.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadData();
    }, []);

    const decidedPoIds = useMemo(() => new Set(approvals.map((a) => a.poId)), [approvals]);
    const pendingPOs = useMemo(() => payablePOs.filter((p) => !decidedPoIds.has(p.id)), [payablePOs, decidedPoIds]);

    const poMap = useMemo(() => {
        const map = new Map();
        payablePOs.forEach((p) => map.set(p.id, p));
        return map;
    }, [payablePOs]);

    return (
        <CardPanel title="Payment Approval" desc="Approve, reject, or hold payments for fully received purchase orders.">
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
                <EmptyState icon={<Loader2 size={36} className="animate-spin" />}>Loading payment approval data…</EmptyState>
            ) : tab === 'pending' ? (
                <PendingApprovalPanel pos={pendingPOs} onDecide={(po) => setSelectedPo(po)} />
            ) : (
                <ApprovalHistoryPanel approvals={approvals} poMap={poMap} />
            )}

            {selectedPo && (
                <DecideModal
                    po={selectedPo}
                    onClose={() => setSelectedPo(null)}
                    onSuccess={() => {
                        setSelectedPo(null);
                        setSuccess('Payment approval decision recorded.');
                        setTimeout(() => setSuccess(''), 4000);
                        loadData();
                    }}
                />
            )}
        </CardPanel>
    );
}

function PendingApprovalPanel({ pos, onDecide }) {
    const [search, setSearch] = useState('');
    const filtered = useMemo(() => {
        const term = search.toLowerCase().trim();
        if (!term) return pos;
        return pos.filter((p) => `${p.poNo} ${p.vendor?.name}`.toLowerCase().includes(term));
    }, [pos, search]);

    return (
        <div>
            <FilterBar onClear={() => setSearch('')}>
                <input
                    type="text"
                    placeholder="Search PO no, vendor..."
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
                                <th className="px-3 py-2.5">Date</th>
                              <th className="px-3 py-2.5">Vendor</th>
                                <th className="px-3 py-2.5">Advance</th>
                            </tr>
                        </thead>
                        <tbody>
                           {pos.length === 0 ? (
                                <tr><td colSpan={5} className="px-3 py-10 text-center text-gray-500">No fully received POs waiting for payment approval.</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={5} className="px-3 py-10 text-center text-gray-500">No POs match the search.</td></tr>
                            ) : filtered.map((po) => (
                                <tr key={po.id} className="border-t border-gray-100 hover:bg-gray-50">
                                    <td className="px-3 py-2.5">
                                        <button
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#173254] px-3 py-1 text-xs font-semibold text-white hover:bg-[#10243e]"
                                            onClick={() => onDecide(po)}
                                        >
                                            <CheckCircle2 size={14} /> Decide
                                        </button>
                                    </td>
                                    <td className="px-3 py-2.5 font-semibold text-gray-900">{po.poNo}</td>
                                    <td className="px-3 py-2.5 text-gray-600">{po.poDate}</td>
                                    <td className="px-3 py-2.5 text-gray-800">{po.vendor?.name}</td>
                                    <td className="px-3 py-2.5 text-gray-800">
                                        {po.vendor?.paymentTerms === 'Advance' || po.vendor?.paymentTerms === 'Parli PI'
                                            ? po.vendor.paymentTerms
                                            : 'No'}
                                    </td>
                                </tr>
                            ))}
                       </tbody>
                    </table>
                </div>
        </div>
    );
}

function ApprovalHistoryPanel({ approvals, poMap }) {
    const [search, setSearch] = useState('');
    const filtered = useMemo(() => {
        const term = search.toLowerCase().trim();
        if (!term) return approvals;
        return approvals.filter((a) => {
            const poNo = poMap.get(a.poId)?.poNo || '';
            return `${poNo} ${a.status} ${a.remarks}`.toLowerCase().includes(term);
        });
    }, [approvals, search, poMap]);

    return (
        <div>
            <FilterBar onClear={() => setSearch('')}>
                <input
                    type="text"
                    placeholder="Search PO no, status, remark..."
                    className="min-w-[150px] flex-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-[12.5px]"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </FilterBar>

            <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-left text-[12.5px]">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-[10.3px] font-bold uppercase tracking-wide text-gray-500">
                                <th className="px-3 py-2.5">PO No.</th>
                                <th className="px-3 py-2.5">Status</th>
                                <th className="px-3 py-2.5">Remark</th>
                                <th className="px-3 py-2.5">Decided At</th>
                            </tr>
                        </thead>
                        <tbody>
                            {approvals.length === 0 ? (
                                <tr><td colSpan={4} className="px-3 py-10 text-center text-gray-500">No payment approval decisions yet.</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={4} className="px-3 py-10 text-center text-gray-500">No entries match the search.</td></tr>
                            ) : filtered.map((a) => (
                                <tr key={a.id} className="border-t border-gray-100 hover:bg-gray-50">
                                    <td className="px-3 py-2.5 font-semibold text-gray-900">{poMap.get(a.poId)?.poNo || '—'}</td>
                                    <td className="px-3 py-2.5">
                                        <StatusPill status={a.status} />
                                    </td>
                                    <td className="px-3 py-2.5 text-gray-600">{a.remarks || '—'}</td>
                                    <td className="px-3 py-2.5 text-gray-500">
                                        {a.decidedAt ? new Date(a.decidedAt).toLocaleString('en-IN') : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
        </div>
    );
}

function StatusPill({ status }) {
    const styles = {
        Approved: 'bg-emerald-50 text-emerald-700',
        Rejected: 'bg-rose-50 text-rose-700',
        Hold: 'bg-amber-50 text-amber-700',
    };
    return (
        <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[10.5px] font-bold ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
            {status}
        </span>
    );
}

function DecideModal({ po, onClose, onSuccess }) {
    const [status, setStatus] = useState('Approved');
    const [remarks, setRemarks] = useState('');
    const [advanceAmount, setAdvanceAmount] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const isAdvanceVendor = po.vendor?.paymentTerms === 'Advance' || po.vendor?.paymentTerms === 'Parli PI';

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            await submitPaymentApproval({ poId: po.id, status, remarks, advanceAmount: isAdvanceVendor ? advanceAmount : null });
            onSuccess();
        } catch (err) {
            setError(err.message || 'Failed to save decision.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Modal open={true} onClose={onClose} title={`Payment Decision — ${po.poNo}`} size="md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="rounded-xl bg-gray-50 px-4 py-2.5 text-[12.5px] text-gray-600">
                    PO <span className="font-bold text-gray-900">{po.poNo}</span> ({po.vendor?.name}) — ₹ {fmt(po.grandTotal)}
                </div>

                <div>
                    <label className="mb-1 block text-[12px] font-bold text-gray-600">Status</label>
                    <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                        <option value="Approved">Approve</option>
                        <option value="Rejected">Reject</option>
                        <option value="Hold">Hold</option>
                    </select>
                </div>

               {isAdvanceVendor && (
                    <div>
                        <label className="mb-1 block text-[12px] font-bold text-gray-600">Advance Amount (₹)</label>
                        <input
                            type="number"
                            className="input"
                            value={advanceAmount}
                            onChange={(e) => setAdvanceAmount(e.target.value)}
                            placeholder="Enter advance amount"
                        />
                    </div>
                )}

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
                        <CheckCircle2 size={16} />
                        {submitting ? 'Saving…' : 'Submit Decision'}
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