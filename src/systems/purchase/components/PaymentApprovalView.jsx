import { Loader2, CheckCircle2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CardPanel, EmptyState, FilterBar } from './ui';
import { fetchPayablePOs, fetchPaymentApprovals, submitPaymentApproval } from '../services/purchaseService';
import { fmt } from '../utils/helpers';
import Modal from './Modal';
import { fetchTatTracking, renderPlannedDateCell, fetchTatSettings } from '../../../core/services/tatService';

export default function PaymentApprovalView() {
    const [tab, setTab] = useState('pending');
    const [payablePOs, setPayablePOs] = useState([]);
    const [approvals, setApprovals] = useState([]);
    const [tatTracking, setTatTracking] = useState({});
    const [tatMins, setTatMins] = useState(15);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [selectedPo, setSelectedPo] = useState(null);
    const [, setTick] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => setTick(t => t + 1), 10000);
        return () => clearInterval(timer);
    }, []);

    async function loadData() {
        setLoading(true);
        setError('');
        try {
            const [posData, approvalsData] = await Promise.all([fetchPayablePOs(), fetchPaymentApprovals()]);
            setPayablePOs(posData || []);
            setApprovals(approvalsData || []);

            const poIds = (posData || []).map(p => p.id);
            if (poIds.length > 0) {
                try {
                    const trackings = await fetchTatTracking('payment_approval', poIds);
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
                const approvalSetting = settingsData.find(s => s.stage_key === 'payment_approval');
                if (approvalSetting && approvalSetting.is_active) {
                    setTatMins(approvalSetting.tat_minutes);
                }
            } catch (settingsErr) {
                console.error('Failed to load TAT settings:', settingsErr);
            }
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
            <div className="mb-4 inline-flex rounded-lg bg-gray-100 p-1 items-center">
                <button
                    className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[13px] font-semibold transition ${tab === 'pending' ? 'bg-[#173254] text-white' : 'text-gray-600'}`}
                    onClick={() => setTab('pending')}
                >
                    <span>Pending</span>
                    {pendingPOs.length > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                            {pendingPOs.length}
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
                <EmptyState icon={<Loader2 size={36} className="animate-spin" />}>Loading payment approval data…</EmptyState>
            ) : tab === 'pending' ? (
                <PendingApprovalPanel pos={pendingPOs} tatTracking={tatTracking} tatMins={tatMins} onDecide={(po) => setSelectedPo(po)} />
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

function PendingApprovalPanel({ pos, tatTracking, tatMins, onDecide }) {
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
                            <th className="px-3 py-2.5">Planned Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pos.length === 0 ? (
                            <tr><td colSpan={6} className="px-3 py-10 text-center text-gray-500">No fully received POs waiting for payment approval.</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={6} className="px-3 py-10 text-center text-gray-500">No POs match the search.</td></tr>
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
                                <td className="px-3 py-2.5 text-gray-800">
                                    {po.vendor?.paymentTerms === 'Advance' || po.vendor?.paymentTerms === 'Saman aatey saath'
                                        ? po.vendor.paymentTerms
                                        : 'No'}
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
                            <th className="px-3 py-2.5">Vendor</th>
                            <th className="px-3 py-2.5">Status</th>
                            <th className="px-3 py-2.5">Remark</th>
                            <th className="px-3 py-2.5">Decided At</th>
                        </tr>
                    </thead>
                    <tbody>
                        {approvals.length === 0 ? (
                            <tr><td colSpan={5} className="px-3 py-10 text-center text-gray-500">No payment approval decisions yet.</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={5} className="px-3 py-10 text-center text-gray-500">No entries match the search.</td></tr>
                        ) : filtered.map((a) => {
                            const po = poMap.get(a.poId);
                            return (
                                <tr key={a.id} className="border-t border-gray-100 hover:bg-gray-50">
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
                                    <td className="px-3 py-2.5">
                                        <StatusPill status={a.status} />
                                    </td>
                                    <td className="px-3 py-2.5 text-gray-600">{a.remarks || '—'}</td>
                                    <td className="px-3 py-2.5 text-gray-500">
                                        {a.decidedAt ? new Date(a.decidedAt).toLocaleString('en-IN') : '—'}
                                    </td>
                                </tr>
                            )
                        })}
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
    const isAdvanceVendor = po.vendor?.paymentTerms === 'Advance' || po.vendor?.paymentTerms === 'Saman aatey saath';

    // Editable Field Values
    const [billDate, setBillDate] = useState(po.deliveries?.[0]?.billDate ? (() => {
        try {
            return new Date(po.deliveries[0].billDate).toISOString().split('T')[0];
        } catch (e) {
            return po.deliveries[0].billDate;
        }
    })() : '');
    const [vchNo, setVchNo] = useState(po.deliveries?.[0]?.billNumber || '');
    const [partyName, setPartyName] = useState(po.vendor?.name || '');
    const [ourName, setOurName] = useState('Bhatia Enterprises');
    const [ourGstNo, setOurGstNo] = useState(po.shipTo?.gstin || '');
    const [taxableAmount, setTaxableAmount] = useState(po.total || '');
    const [gstAmount, setGstAmount] = useState(po.taxAmount || '');
    const [billAmount, setBillAmount] = useState(po.grandTotal || '');
    const [seal, setSeal] = useState('Available');

    // Verification Checkbox States
    const [chkBillDate, setChkBillDate] = useState(false);
    const [chkVchNo, setChkVchNo] = useState(false);
    const [chkPartyName, setChkPartyName] = useState(false);
    const [chkOurName, setChkOurName] = useState(false);
    const [chkOurGstNo, setChkOurGstNo] = useState(false);
    const [chkTaxableAmount, setChkTaxableAmount] = useState(false);
    const [chkGstAmount, setChkGstAmount] = useState(false);
    const [chkBillAmount, setChkBillAmount] = useState(false);
    const [chkSeal, setChkSeal] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');

        // Enforce that selecting/checking all 9 checkboxes in the modal is mandatory
        if (!chkBillDate) { setError('Please verify and check Bill Date.'); return; }
        if (!chkVchNo) { setError('Please verify and check Vch No.'); return; }
        if (!chkPartyName) { setError('Please verify and check Party Name.'); return; }
        if (!chkOurName) { setError('Please verify and check Our Name.'); return; }
        if (!chkOurGstNo) { setError('Please verify and check Our GST No.'); return; }
        if (!chkTaxableAmount) { setError('Please verify and check Taxable Amount.'); return; }
        if (!chkGstAmount) { setError('Please verify and check GST Amount.'); return; }
        if (!chkBillAmount) { setError('Please verify and check Bill Amount.'); return; }
        if (!chkSeal) { setError('Please verify and check Seal.'); return; }

        setSubmitting(true);
        try {
            await submitPaymentApproval({
                poId: po.id,
                status,
                remarks,
                advanceAmount: isAdvanceVendor ? advanceAmount : null,
                checkBillDate: chkBillDate,
                checkVchNo: chkVchNo,
                checkPartyName: chkPartyName,
                checkOurName: chkOurName,
                checkOurGstNo: chkOurGstNo,
                checkTaxableAmount: chkTaxableAmount,
                checkGstAmount: chkGstAmount,
                checkBillAmount: chkBillAmount,
                checkSeal: chkSeal,
                editedBillDate: billDate,
                editedVchNo: vchNo,
                editedPartyName: partyName,
                editedTaxableAmount: taxableAmount,
                editedGstAmount: gstAmount,
                editedBillAmount: billAmount,
            });
            onSuccess();
        } catch (err) {
            setError(err.message || 'Failed to save decision.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Modal open={true} onClose={onClose} title={`Payment Decision — ${po.poNo}`} size="lg">
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
                            min={0}
                            value={advanceAmount}
                            onChange={(e) => setAdvanceAmount(e.target.value)}
                            placeholder="Enter advance amount"
                        />
                    </div>
                )}

                <div className="border border-gray-150 p-4 rounded-xl bg-white space-y-3 shadow-sm">
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-100 pb-1">Bill Verification Checklist</h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                        <CheckRow label="Bill Date" val={billDate} setVal={setBillDate} checked={chkBillDate} setChecked={setChkBillDate} type="date" />
                        <CheckRow label="Vch No." val={vchNo} setVal={setVchNo} checked={chkVchNo} setChecked={setChkVchNo} />
                        <CheckRow label="Party Name" val={partyName} setVal={setPartyName} checked={chkPartyName} setChecked={setChkPartyName} />
                        <CheckRow label="Our Name" val={ourName} setVal={setOurName} checked={chkOurName} setChecked={setChkOurName} readOnly />
                        <CheckRow label="Our GST No." val={ourGstNo} setVal={setOurGstNo} checked={chkOurGstNo} setChecked={setChkOurGstNo} />
                        <CheckRow label="Taxable Amount" val={taxableAmount} setVal={setTaxableAmount} checked={chkTaxableAmount} setChecked={setChkTaxableAmount} type="number" />
                        <CheckRow label="GST Amount" val={gstAmount} setVal={setGstAmount} checked={chkGstAmount} setChecked={setChkGstAmount} type="number" />
                        <CheckRow label="Bill Amount" val={billAmount} setVal={setBillAmount} checked={chkBillAmount} setChecked={setChkBillAmount} type="number" />
                        <div className="md:col-span-2">
                            <CheckRow label="Seal" val={seal} setVal={setSeal} checked={chkSeal} setChecked={setChkSeal} />
                        </div>
                    </div>
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

function CheckRow({ label, val, setVal, checked, setChecked, type = 'text', readOnly = false }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between py-1 text-[12.5px] border-b border-gray-50 last:border-0 pb-2 w-full">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-700 shrink-0">
                <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    checked={checked}
                    onChange={(e) => setChecked(e.target.checked)}
                />
                <span>{label}</span>
            </label>
            <input
                type={type}
                className="input py-1 px-3 h-[36px] border border-gray-300 rounded-lg text-xs font-semibold w-full sm:max-w-[160px]"
                value={val}
                onChange={(e) => setVal(e.target.value)}
                readOnly={readOnly}
                placeholder={readOnly ? '' : `Enter ${label}`}
            />
        </div>
    );
}