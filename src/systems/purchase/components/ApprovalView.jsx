import { Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CardPanel, EmptyState, FilterBar, StatusBadge } from './ui';
import { uniqueValues } from '../utils/helpers';
import { fetchIndents, decideCategory, fetchIndentHistory, findOutstandingConflicts } from '../services/purchaseService';
import Modal from './Modal';

export default function ApprovalView() {
  const [tab, setTab] = useState('pending');
  const [indents, setIndents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    return fetchIndents()
      .then((rows) => setIndents(rows))
      .catch((err) => setError(err.message || 'Failed to load indent data.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <CardPanel title="Second Stage Approval" desc="Items with Order Formula > 0, grouped by vendor — approve or reject a whole vendor's items in one action, and adjust quantity if needed.">
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
      {loading ? (
        <EmptyState icon={<Loader2 size={36} className="animate-spin" />}>Loading indent data…</EmptyState>
      ) : error ? (
        <EmptyState>{error}</EmptyState>
      ) : tab === 'pending' ? (
        <PendingPanel indents={indents} onDecided={load} />
      ) : (
        <HistoryPanel indents={indents} />
      )}
    </CardPanel>
  );
}

function PendingPanel({ indents, onDecided }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [vendor, setVendor] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [expanded, setExpanded] = useState({});

  const toggleVendor = (v) => {
    setExpanded((prev) => ({ ...prev, [v]: !prev[v] }));
  };

  const allPending = useMemo(() => indents.filter((i) => i.orderFormula > 0 && i.status === 'Pending'), [indents]);
  const categories = useMemo(() => uniqueValues(allPending, 'category'), [allPending]);
  const vendors = useMemo(() => uniqueValues(allPending, 'vendor'), [allPending]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return allPending.filter((i) => {
      if (term && !`${i.itemDetails} ${i.vendor}`.toLowerCase().includes(term)) return false;
      if (category && i.category !== category) return false;
      if (vendor && i.vendor !== vendor) return false;
      return true;
    });
  }, [allPending, search, category, vendor]);

  const groups = useMemo(() => {
    const g = {};
    filtered.forEach((i) => {
      const v = i.vendor || 'Unknown Vendor';
      (g[v] = g[v] || []).push(i);
    });
    return g;
  }, [filtered]);

  const clear = () => {
    setSearch('');
    setCategory('');
    setVendor('');
  };

  return (
    <div>
      <FilterBar onClear={clear}>
        <input
          type="text"
          placeholder="Search item, vendor..."
          className="min-w-[150px] flex-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-[12.5px]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="min-w-[130px] rounded-lg border border-gray-300 px-2.5 py-1.5 text-[12.5px]" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select className="min-w-[130px] rounded-lg border border-gray-300 px-2.5 py-1.5 text-[12.5px]" value={vendor} onChange={(e) => setVendor(e.target.value)}>
          <option value="">All Vendors</option>
          {vendors.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </FilterBar>

      {allPending.length === 0 ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-[12.6px]">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                {['Unique No.', 'Item Details', 'Category', 'Vendor', 'Qty'].map((h) => (
                  <th key={h} className="whitespace-nowrap border-b border-gray-200 px-2.5 py-2 text-left text-[10.3px] font-bold uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={5} className="px-2.5 py-10 text-center text-gray-500">No pending items with Order Formula &gt; 0.</td></tr>
            </tbody>
          </table>
        </div>
      ) : filtered.length === 0 ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-[12.6px]">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                {['Unique No.', 'Item Details', 'Category', 'Vendor', 'Qty'].map((h) => (
                  <th key={h} className="whitespace-nowrap border-b border-gray-200 px-2.5 py-2 text-left text-[10.3px] font-bold uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={5} className="px-2.5 py-10 text-center text-gray-500">No items match the current filters.</td></tr>
            </tbody>
          </table>
        </div>
      ) : (
        Object.keys(groups)
          .sort()
          .map((cat) => {
            const list = groups[cat];
            const totalQty = list.reduce((s, i) => s + i.orderFormula, 0);
            return (
              <div key={cat} className="mb-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <button
                    type="button"
                    onClick={() => toggleVendor(cat)}
                    className="flex items-center gap-1.5 text-left"
                  >
                    {expanded[cat] ? <ChevronDown size={15} className="text-gray-500" /> : <ChevronRight size={15} className="text-gray-500" />}
                    <span className="text-[14px] font-bold text-[#173254]">{cat}</span>
                    <span className="text-[11.5px] text-gray-500">— {list.length} item(s), total qty {totalQty}</span>
                  </button>
                  <button
                    className="rounded-lg bg-[#C99A3E] px-3 py-1.5 text-xs font-semibold text-[#1B2A3D] hover:bg-[#B98A2E]"
                    onClick={() => setActiveCategory(cat)}
                  >
                    Review Vendor
                  </button>
                </div>
                {expanded[cat] && (
                  <div className="overflow-x-auto border-t border-gray-200">
                    <table className="w-full text-[12.6px]">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500">
                          {['Unique No.', 'Item Details', 'Category', 'Vendor', 'Qty'].map((h) => (
                            <th key={h} className="whitespace-nowrap border-b border-gray-200 px-2.5 py-2 text-left text-[10.3px] font-bold uppercase tracking-wide">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((i) => (
                          <tr key={i.dbId} className="border-t border-gray-100">
                            <td className="px-2.5 py-2 font-semibold">{i.id}</td>
                            <td className="px-2.5 py-2">{i.itemDetails}</td>
                            <td className="px-2.5 py-2">{i.category}</td>
                            <td className="px-2.5 py-2">{i.vendor}</td>
                            <td className="px-2.5 py-2 font-semibold">{i.orderFormula}</td>
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

      <CategoryApprovalModal
        category={activeCategory}
        items={activeCategory ? groups[activeCategory] || [] : []}
        saving={saving}
        error={saveError}
        onClose={() => {
          setActiveCategory(null);
          setSaveError('');
        }}
        onSubmit={async (ids, qtyById, status, remarks) => {
          setSaving(true);
          setSaveError('');
          try {
            let idsToDecide = ids;
            const currentItems = activeCategory ? groups[activeCategory] || [] : [];

            if (status === 'Approved') {
              const candidates = currentItems
                .filter((i) => ids.includes(i.dbId))
                .map((i) => ({ dbId: i.dbId, vendor: i.vendor, itemDetails: i.itemDetails }));
              const conflicts = await findOutstandingConflicts(candidates);

              if (conflicts.size > 0) {
                idsToDecide = ids.filter((id) => !conflicts.has(id));
                const skippedLines = Array.from(conflicts.values()).map((c) => `• ${c.itemDetails} (${c.vendor}) — ${c.reason}`);
                if (idsToDecide.length === 0) {
                  setSaveError(`Nothing approved — all selected items are still awaiting receipt of an earlier order:\n${skippedLines.join('\n')}`);
                  setSaving(false);
                  return;
                }
                setSaveError(`Skipped ${conflicts.size} item(s) still awaiting receipt of an earlier order:\n${skippedLines.join('\n')}`);
              }
            }

            await decideCategory({ ids: idsToDecide, qtyById, status, remarks });
            await onDecided();
            if (status !== 'Approved' || idsToDecide.length === ids.length) {
              setActiveCategory(null);
            }
          } catch (err) {
            setSaveError(err.message || 'Failed to save decision.');
          } finally {
            setSaving(false);
          }
        }}
      />
    </div>
  );
}

function CategoryApprovalModal({ category, items, saving, error: submitError, onClose, onSubmit }) {
  const [checked, setChecked] = useState({});
  const [qty, setQty] = useState({});
  const [status, setStatus] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  const [initedFor, setInitedFor] = useState(null);

  if (category && initedFor !== category) {
    const initChecked = {};
    const initQty = {};
    items.forEach((i) => {
      initChecked[i.dbId] = true;
      initQty[i.dbId] = i.approvedQty != null ? i.approvedQty : i.orderFormula;
    });
    setChecked(initChecked);
    setQty(initQty);
    setStatus('');
    setRemarks('');
    setError('');
    setInitedFor(category);
  }

  const toggleAll = () => {
    const allChecked = items.every((i) => checked[i.dbId]);
    const next = {};
    items.forEach((i) => (next[i.dbId] = !allChecked));
    setChecked(next);
  };

  const submit = () => {
    if (!status) {
      setError('Please select a status.');
      return;
    }
    if (status === 'Rejected' && !remarks.trim()) {
      setError('Remarks are required when rejecting.');
      return;
    }
    const ids = items.filter((i) => checked[i.dbId]).map((i) => i.dbId);
    if (ids.length === 0) {
      setError('Select at least one item.');
      return;
    }
    onSubmit(ids, qty, status, remarks.trim());
  };

  return (
    <Modal
      open={!!category}
      onClose={onClose}
      title={<>Review Vendor: {category}</>}
      size="lg"
      footer={
        <>
          <button className="rounded-lg border border-[#173254] px-4 py-2 text-sm font-semibold text-[#173254]" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="rounded-lg bg-[#173254] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Save Decision'}
          </button>
        </>
      }
    >
      <div className="mb-2 flex items-center justify-between">
        <label className="text-[11.2px] font-bold uppercase tracking-wide text-gray-500">Items in this batch (uncheck to exclude)</label>
        <span className="cursor-pointer text-[11.8px] text-gray-500 underline" onClick={toggleAll}>
          toggle all
        </span>
      </div>
      <div className="mb-3.5 max-h-[220px] overflow-y-auto rounded-lg border border-gray-200 px-3 py-2">
        {items.map((i) => (
          <div key={i.dbId} className="flex items-center gap-2 border-b border-gray-100 py-1.5 last:border-b-0">
            <input
              type="checkbox"
              checked={!!checked[i.dbId]}
              onChange={(e) => setChecked((prev) => ({ ...prev, [i.dbId]: e.target.checked }))}
              className="h-4 w-4 flex-shrink-0"
            />
            <label className="flex-grow text-[13px]">
              {i.itemDetails} — <span className="text-gray-500">{i.vendor}</span>
            </label>
            <input
              type="number"
              className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm"
              value={qty[i.dbId] ?? ''}
              onChange={(e) => setQty((prev) => ({ ...prev, [i.dbId]: Number(e.target.value) || 0 }))}
              title="Qty to order"
            />
          </div>
        ))}
      </div>
      <div className="mb-3">
        <label className="mb-1 block text-[11.2px] font-bold uppercase tracking-wide text-gray-500">Status (applies to all checked items)</label>
        <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Select status</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>
      </div>
      <div className="mb-1">
        <label className="mb-1 block text-[11.2px] font-bold uppercase tracking-wide text-gray-500">Remarks</label>
        <textarea
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          rows={3}
          placeholder="Optional for Approved, required for Rejected"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
      </div>
      {(error || submitError) && <div className="mt-1 whitespace-pre-line text-sm text-rose-600">{error || submitError}</div>}
    </Modal>
  );
}
function DiffCell({ orderQty, approvedQty }) {
  if (approvedQty == null) return <span className="text-gray-400">—</span>;
  const diff = Number(approvedQty) - Number(orderQty);
  if (diff === 0) return <span className="text-gray-400">0</span>;
  const positive = diff > 0;
  return (
    <span className={`font-bold ${positive ? 'text-emerald-600' : 'text-rose-600'}`}>
      {positive ? `+${diff}` : diff}
    </span>
  );
}
function HistoryPanel({ indents }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [vendor, setVendor] = useState('');
  const [status, setStatus] = useState('');
  const [timelineItem, setTimelineItem] = useState(null);

  const base = useMemo(() => indents.filter((i) => i.status !== 'Pending'), [indents]);
  const categories = useMemo(() => uniqueValues(indents, 'category'), [indents]);
  const vendors = useMemo(() => uniqueValues(indents, 'vendor'), [indents]);

  const rows = useMemo(() => {
    const term = search.toLowerCase().trim();
    return base.filter((i) => {
      if (term && !`${i.itemDetails} ${i.vendor}`.toLowerCase().includes(term)) return false;
      if (category && i.category !== category) return false;
      if (vendor && i.vendor !== vendor) return false;
      if (status && i.status !== status) return false;
      return true;
    });
  }, [base, search, category, vendor, status]);

  const clear = () => {
    setSearch('');
    setCategory('');
    setVendor('');
    setStatus('');
  };

  return (
    <div>
      <FilterBar onClear={clear}>
        <input
          type="text"
          placeholder="Search item, vendor..."
          className="min-w-[150px] flex-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-[12.5px]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="min-w-[130px] rounded-lg border border-gray-300 px-2.5 py-1.5 text-[12.5px]" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select className="min-w-[130px] rounded-lg border border-gray-300 px-2.5 py-1.5 text-[12.5px]" value={vendor} onChange={(e) => setVendor(e.target.value)}>
          <option value="">All Vendors</option>
          {vendors.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <select className="min-w-[130px] rounded-lg border border-gray-300 px-2.5 py-1.5 text-[12.5px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>
      </FilterBar>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-[12.6px]">
          <thead>
            <tr className="bg-gray-50 text-gray-500">
              {['Unique No.', 'Item Details', 'Category', 'Vendor', 'Order Qty', 'Approved Qty', 'Difference', 'Current Status', 'Remarks', 'Decided At', ''].map((h) => (
                <th key={h} className="whitespace-nowrap border-b border-gray-200 px-2.5 py-2 text-left text-[10.3px] font-bold uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={11} className="px-2.5 py-10 text-center text-gray-500">No approval decisions recorded yet.</td></tr>
            ) : rows.map((i) => (
              <tr key={i.dbId} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-2.5 py-2 font-semibold">{i.id}</td>
                <td className="px-2.5 py-2">{i.itemDetails}</td>
                <td className="px-2.5 py-2">{i.category}</td>
                <td className="px-2.5 py-2">{i.vendor}</td>
                <td className="px-2.5 py-2">{i.orderFormula}</td>
                <td className="px-2.5 py-2 font-semibold">{i.approvedQty != null ? i.approvedQty : i.orderFormula}</td>
                <td className="px-2.5 py-2">
                  <DiffCell orderQty={i.orderFormula} approvedQty={i.approvedQty} />
                </td>
                <td className="px-2.5 py-2"><StatusBadge status={i.status} /></td>
                <td className="max-w-[160px] whitespace-normal px-2.5 py-2">{i.remarks || '—'}</td>
                <td className="px-2.5 py-2">{i.decidedAt ? new Date(i.decidedAt).toLocaleString('en-IN') : '—'}</td>
                <td className="px-2.5 py-2">
                  <button className="rounded-lg border border-[#173254] px-2.5 py-1 text-xs font-semibold text-[#173254]" onClick={() => setTimelineItem(i)}>
                    Timeline
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TimelineModal item={timelineItem} onClose={() => setTimelineItem(null)} />
    </div>
  );
}

function TimelineModal({ item, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    setLoading(true);
    fetchIndentHistory(item.dbId)
      .then((rows) => {
        if (!cancelled) setHistory(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [item]);

  if (!item) return null;
  const entries = [...history, { status: item.status, remarks: item.remarks, decidedAt: item.decidedAt ? new Date(item.decidedAt).toLocaleString('en-IN') : null }];

  return (
    <Modal open={!!item} onClose={onClose} title="Decision Timeline">
      <div className="mb-2 font-semibold">{item.itemDetails}</div>
      {loading ? (
        <div className="py-3 text-sm text-gray-500">Loading history…</div>
      ) : (
        entries.map((e, idx) => (
          <div key={idx} className="flex items-start justify-between border-b border-dashed border-gray-200 py-2 last:border-b-0">
            <div>
              <StatusBadge status={e.status} />
              <div className="mt-1 text-sm text-gray-500">{e.remarks || 'No remarks'}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">{e.decidedAt || '—'}</div>
              {idx === entries.length - 1 ? (
                <span className="mt-0.5 inline-block rounded-full bg-indigo-50 px-2.5 py-1 text-[10.5px] font-bold text-indigo-700">Current</span>
              ) : (
                <span className="text-sm text-gray-400">Previous</span>
              )}
            </div>
          </div>
        ))
      )}
    </Modal>
  );
}
