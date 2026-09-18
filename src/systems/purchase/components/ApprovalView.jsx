import { Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Fuse from 'fuse.js';
import { CardPanel, EmptyState, FilterBar, StatusBadge } from './ui';
import { uniqueValues } from '../utils/helpers';
import { fetchIndents, decideCategory, fetchIndentHistory, findOutstandingConflicts, updateIndent } from '../services/purchaseService';
import Modal from './Modal';
import { fetchTatTracking, renderPlannedDateCell, fetchTatSettings } from '../../../core/services/tatService';

export default function ApprovalView() {
  const location = useLocation();
  const hasData = useRef(false);
  const [tab, setTab] = useState('pending');
  const [indents, setIndents] = useState([]);
  const [tatTracking, setTatTracking] = useState({});
  const [tatMins, setTatMins] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    let cancelled = false;
    if (!hasData.current) setLoading(true);
    setError(null);

    Promise.all([fetchIndents(), fetchTatSettings()])
      .then(async ([rows, settingsData]) => {
        if (cancelled) return;
        setIndents(rows);
        hasData.current = true;

        const setting = settingsData.find(s => s.stage_key === 'indent_approval');
        if (setting && setting.is_active) setTatMins(setting.tat_minutes);

        const dbIds = rows.map(r => r.dbId);
        if (dbIds.length > 0) {
          try {
            const trackings = await fetchTatTracking('indent_approval', dbIds);
            if (!cancelled) {
              const trackingMap = {};
              trackings.forEach(t => { trackingMap[t.entity_id] = t; });
              setTatTracking(trackingMap);
            }
          } catch (tatErr) {
            console.error('Failed to load TAT tracking:', tatErr);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load indent data.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => load(), 10000);
    return () => clearInterval(timer);
  }, [load]);

  // Re-fetch whenever this page becomes active
  useEffect(() => {
    const cancel = load();
    return cancel;
  }, [location.pathname, load]);

  const pendingCount = useMemo(() => {
    const pendingItems = (indents || []).filter((i) => i.orderFormula > 0 && i.status === 'Pending');
    return new Set(pendingItems.map((i) => i.parentGroup || 'Unassigned')).size;
  }, [indents]);

  return (
    <CardPanel title="Second Stage Approval" desc="Items with Order Formula > 0, grouped by parent group — approve or reject a whole parent group's items in one action, and adjust quantity if needed.">
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
      {loading ? (
        <EmptyState icon={<Loader2 size={36} className="animate-spin" />}>Loading indent data…</EmptyState>
      ) : error ? (
        <EmptyState>{error}</EmptyState>
      ) : tab === 'pending' ? (
        <PendingPanel indents={indents} tatTracking={tatTracking} tatMins={tatMins} onDecided={load} />
      ) : (
        <HistoryPanel indents={indents} />
      )}
    </CardPanel>
  );
}

function PendingPanel({ indents, tatTracking, tatMins, onDecided }) {
  const [search, setSearch] = useState('');
  const [parentGroup, setParentGroup] = useState('');
  const [vendor, setVendor] = useState('');
  const [activeGroup, setActiveGroup] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [expanded, setExpanded] = useState({});

  const toggleGroup = (pg) => {
    setExpanded((prev) => ({ ...prev, [pg]: !prev[pg] }));
  };

  const allPending = useMemo(() => indents.filter((i) => i.orderFormula > 0 && i.status === 'Pending'), [indents]);
  const parentGroups = useMemo(() => uniqueValues(allPending, 'parentGroup'), [allPending]);
  const vendors = useMemo(() => uniqueValues(allPending, 'vendor'), [allPending]);

  const fuse = useMemo(() => {
    return new Fuse(allPending, {
      keys: ['itemDetails', 'vendor', 'parentGroup', 'category'],
      threshold: 0.38,
      ignoreLocation: true,
    });
  }, [allPending]);

  const filtered = useMemo(() => {
    const term = search.trim();
    let result = allPending;
    if (term) {
      result = fuse.search(term).map((res) => res.item);
    }
    return result.filter((i) => {
      if (parentGroup && (i.parentGroup || 'Unassigned') !== parentGroup) return false;
      if (vendor && i.vendor !== vendor) return false;
      return true;
    });
  }, [allPending, fuse, search, parentGroup, vendor]);

  const groups = useMemo(() => {
    const g = {};
    filtered.forEach((i) => {
      const pg = i.parentGroup || 'Unassigned';
      (g[pg] = g[pg] || []).push(i);
    });
    return g;
  }, [filtered]);

  const clear = () => {
    setSearch('');
    setParentGroup('');
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
        <select className="min-w-[130px] rounded-lg border border-gray-300 px-2.5 py-1.5 text-[12.5px]" value={parentGroup} onChange={(e) => setParentGroup(e.target.value)}>
          <option value="">All Parent Groups</option>
          {parentGroups.map((pg) => (
            <option key={pg} value={pg}>{pg}</option>
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
                {['Unique No.', 'Item Details', 'Parent Group', 'Vendor', 'Qty', 'Planned Date'].map((h) => (
                  <th key={h} className="whitespace-nowrap border-b border-gray-200 px-2.5 py-2 text-left text-[10.3px] font-bold uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={6} className="px-2.5 py-10 text-center text-gray-500">No pending items with Order Formula &gt; 0.</td></tr>
            </tbody>
          </table>
        </div>
      ) : filtered.length === 0 ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-[12.6px]">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                {['Unique No.', 'Item Details', 'Parent Group', 'Vendor', 'Qty', 'Planned Date'].map((h) => (
                  <th key={h} className="whitespace-nowrap border-b border-gray-200 px-2.5 py-2 text-left text-[10.3px] font-bold uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={6} className="px-2.5 py-10 text-center text-gray-500">No items match the current filters.</td></tr>
            </tbody>
          </table>
        </div>
      ) : (
        Object.keys(groups)
          .sort()
          .map((pg) => {
            const list = groups[pg];
            const totalQty = list.reduce((s, i) => s + i.orderFormula, 0);
            const vendorsInGroup = Array.from(new Set(list.map((i) => i.vendor).filter(Boolean)));
            const vendorsText = vendorsInGroup.length > 0 ? vendorsInGroup.join(', ') : 'No Vendor';
            return (
              <div key={pg} className="mb-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <button
                    type="button"
                    onClick={() => toggleGroup(pg)}
                    className="flex items-center gap-1.5 text-left"
                  >
                    {expanded[pg] ? <ChevronDown size={15} className="text-gray-500" /> : <ChevronRight size={15} className="text-gray-500" />}
                    <span className="text-[14px] font-bold text-[#173254]">{pg}</span>
                    <span className="text-[12.5px] font-medium text-gray-700">— {vendorsText}</span>
                    <span className="text-[11.5px] text-gray-500">({list.length} item(s), total qty {totalQty})</span>
                  </button>
                  <button
                    className="rounded-lg bg-[#C99A3E] px-3 py-1.5 text-xs font-semibold text-[#1B2A3D] hover:bg-[#B98A2E]"
                    onClick={() => setActiveGroup(pg)}
                  >
                    Review Parent Group
                  </button>
                </div>
                {expanded[pg] && (
                  <div className="overflow-x-auto border-t border-gray-200">
                    <table className="w-full text-[12.6px]">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500">
                          {['Unique No.', 'Item Details', 'Parent Group', 'Vendor', 'Qty', 'Planned Date'].map((h) => (
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
                            <td className="px-2.5 py-2">{i.parentGroup || '—'}</td>
                            <td className="px-2.5 py-2">{i.vendor}</td>
                            <td className="px-2.5 py-2 font-semibold">{i.orderFormula}</td>
                            <td className="px-2.5 py-2">{renderPlannedDateCell(tatTracking[i.dbId], i.createdAt, tatMins)}</td>
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
        parentGroup={activeGroup}
        items={activeGroup ? groups[activeGroup] || [] : []}
        vendors={activeGroup ? Array.from(new Set((groups[activeGroup] || []).map((i) => i.vendor).filter(Boolean))) : []}
        saving={saving}
        error={saveError}
        onDecided={onDecided}
        onClose={() => {
          setActiveGroup(null);
          setSaveError('');
        }}
        onSubmit={async (ids, qtyById, status, remarks) => {
          setSaving(true);
          setSaveError('');
          try {
            let idsToDecide = ids;
            const currentItems = activeGroup ? groups[activeGroup] || [] : [];

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
              setActiveGroup(null);
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
function CategoryApprovalModal({ parentGroup, category, items, vendors = [], saving, error: submitError, onClose, onSubmit, onDecided }) {
  const groupName = parentGroup || category || '';
  const [checked, setChecked] = useState({});
  const [qty, setQty] = useState({});
  const [status, setStatus] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  const [initedFor, setInitedFor] = useState(null);

  // Inline editing state
  const [editingRowIds, setEditingRowIds] = useState(() => new Set());
  const [rowEdits, setRowEdits] = useState({});
  const [rowSaving, setRowSaving] = useState({});
  const [savingAll, setSavingAll] = useState(false);
  const [inlineError, setInlineError] = useState('');

  if (groupName && initedFor !== groupName) {
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
    setInitedFor(groupName);
    setEditingRowIds(new Set());
    setRowEdits({});
    setRowSaving({});
    setSavingAll(false);
    setInlineError('');
  }

  const toggleAll = () => {
    const allChecked = items.length > 0 && items.every((i) => checked[i.dbId]);
    const next = {};
    items.forEach((i) => (next[i.dbId] = !allChecked));
    setChecked(next);
  };

  const startEditRow = (item) => {
    setInlineError('');
    setRowEdits((prev) => ({
      ...prev,
      [item.dbId]: {
        itemDetails: item.itemDetails || '',
        category: item.category || '',
        vendor: item.vendor || '',
        parentGroup: item.parentGroup || '',
        unit: item.unit || 'Pcs.',
        altUnit: item.altUnit || '',
        shelfCapacity: item.shelfCapacity || '',
        maxLevelQty: item.maxLevelQty != null && item.maxLevelQty !== '' ? String(item.maxLevelQty) : '',
        rolQty: item.rolQty != null && item.rolQty !== '' ? String(item.rolQty) : '',
        orderFormula: qty[item.dbId] != null && qty[item.dbId] !== '' ? String(qty[item.dbId]) : (item.orderFormula != null && item.orderFormula !== '' ? String(item.orderFormula) : ''),
      },
    }));
    setEditingRowIds((prev) => new Set(prev).add(item.dbId));
  };

  const cancelEditRow = (dbId) => {
    setEditingRowIds((prev) => {
      const next = new Set(prev);
      next.delete(dbId);
      return next;
    });
    setRowEdits((prev) => {
      const next = { ...prev };
      delete next[dbId];
      return next;
    });
  };

  const updateRowEditField = (dbId, field, val) => {
    setRowEdits((prev) => ({
      ...prev,
      [dbId]: {
        ...prev[dbId],
        [field]: val,
      },
    }));
  };

  const startEditAll = () => {
    setInlineError('');
    const newEdits = {};
    const allIds = new Set();
    items.forEach((item) => {
      allIds.add(item.dbId);
      newEdits[item.dbId] = {
        itemDetails: item.itemDetails || '',
        category: item.category || '',
        vendor: item.vendor || '',
        parentGroup: item.parentGroup || '',
        unit: item.unit || 'Pcs.',
        altUnit: item.altUnit || '',
        shelfCapacity: item.shelfCapacity || '',
        maxLevelQty: item.maxLevelQty != null && item.maxLevelQty !== '' ? String(item.maxLevelQty) : '',
        rolQty: item.rolQty != null && item.rolQty !== '' ? String(item.rolQty) : '',
        orderFormula: qty[item.dbId] != null && qty[item.dbId] !== '' ? String(qty[item.dbId]) : (item.orderFormula != null && item.orderFormula !== '' ? String(item.orderFormula) : ''),
      };
    });
    setRowEdits(newEdits);
    setEditingRowIds(allIds);
  };

  const cancelEditAll = () => {
    setEditingRowIds(new Set());
    setRowEdits({});
    setInlineError('');
  };

  const saveRow = async (dbId) => {
    const edit = rowEdits[dbId];
    if (!edit) return;
    if (!edit.itemDetails?.trim()) {
      setInlineError('Item Details is required.');
      return;
    }
    if (!edit.vendor?.trim()) {
      setInlineError('Vendor is required.');
      return;
    }

    setRowSaving((prev) => ({ ...prev, [dbId]: true }));
    setInlineError('');
    try {
      await updateIndent(dbId, edit);
      if (edit.orderFormula !== undefined && edit.orderFormula !== null && edit.orderFormula !== '') {
        setQty((prev) => ({ ...prev, [dbId]: Number(edit.orderFormula) || 0 }));
      }
      cancelEditRow(dbId);
      if (onDecided) await onDecided();
    } catch (err) {
      setInlineError(err.message || 'Failed to update item.');
    } finally {
      setRowSaving((prev) => ({ ...prev, [dbId]: false }));
    }
  };

  const saveAllRows = async () => {
    const ids = Array.from(editingRowIds);
    if (ids.length === 0) return;

    for (const id of ids) {
      const edit = rowEdits[id];
      if (edit) {
        if (!edit.itemDetails?.trim()) {
          setInlineError('Item Details is required for all edited items.');
          return;
        }
        if (!edit.vendor?.trim()) {
          setInlineError('Vendor is required for all edited items.');
          return;
        }
      }
    }

    setSavingAll(true);
    setInlineError('');
    const failures = [];
    let savedCount = 0;

    for (const id of ids) {
      const edit = rowEdits[id];
      if (!edit) continue;
      const original = items.find((i) => i.dbId === id);
      const changed =
        !original ||
        edit.itemDetails !== (original.itemDetails || '') ||
        edit.category !== (original.category || '') ||
        edit.vendor !== (original.vendor || '') ||
        edit.parentGroup !== (original.parentGroup || '') ||
        edit.unit !== (original.unit || 'Pcs.') ||
        edit.altUnit !== (original.altUnit || '') ||
        edit.shelfCapacity !== (original.shelfCapacity || '') ||
        edit.maxLevelQty !== (original.maxLevelQty != null && original.maxLevelQty !== '' ? String(original.maxLevelQty) : '') ||
        edit.rolQty !== (original.rolQty != null && original.rolQty !== '' ? String(original.rolQty) : '') ||
        edit.orderFormula !== (original.orderFormula != null && original.orderFormula !== '' ? String(original.orderFormula) : '');

      if (changed) {
        try {
          await updateIndent(id, edit);
          savedCount++;
          if (edit.orderFormula !== undefined && edit.orderFormula !== null && edit.orderFormula !== '') {
            setQty((prev) => ({ ...prev, [id]: Number(edit.orderFormula) || 0 }));
          }
        } catch (err) {
          failures.push(err.message || `Failed to update ${id}`);
        }
      }
    }

    if (failures.length > 0) {
      setInlineError(`Saved ${savedCount} item(s). Errors: ${failures.join('; ')}`);
      if (savedCount > 0 && onDecided) await onDecided();
    } else {
      setEditingRowIds(new Set());
      setRowEdits({});
      if (onDecided) await onDecided();
    }
    setSavingAll(false);
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
    const finalQtyById = {};
    ids.forEach((id) => {
      const it = items.find((x) => x.dbId === id);
      const val = editingRowIds.has(id) && rowEdits[id]?.orderFormula != null
        ? rowEdits[id].orderFormula
        : qty[id];
      finalQtyById[id] = (val !== '' && val != null && !isNaN(Number(val)))
        ? Number(val)
        : (it?.approvedQty != null ? it.approvedQty : (it?.orderFormula || 0));
    });
    onSubmit(ids, finalQtyById, status, remarks.trim());
  };

  const vendorsSubtitle = vendors && vendors.length > 0 ? vendors.join(', ') : '';
  const isAllEditing = items.length > 0 && editingRowIds.size === items.length;

  return (
    <Modal
      open={!!groupName}
      onClose={onClose}
      title={
        <div className="flex flex-wrap items-baseline gap-2">
          <span>Review Parent Group: {groupName}</span>
          {vendorsSubtitle && <span className="text-xs font-normal text-gray-200">— {vendorsSubtitle}</span>}
        </div>
      }
      size="3xl"
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
      <div className="mb-2 flex items-center justify-between gap-2">
        <label className="text-[11.2px] font-bold uppercase tracking-wide text-gray-500">
          Items in this parent group (uncheck to exclude from batch decision)
        </label>
        {isAllEditing || editingRowIds.size > 0 ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100 shadow-xs"
              onClick={cancelEditAll}
              disabled={savingAll}
            >
              Cancel Edit
            </button>
            <button
              type="button"
              className="rounded-md bg-[#173254] px-3 py-1 text-xs font-semibold text-white hover:bg-[#122842] shadow-xs disabled:opacity-60"
              onClick={saveAllRows}
              disabled={savingAll}
            >
              {savingAll ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="rounded-md border border-[#173254] bg-white px-2.5 py-1 text-xs font-semibold text-[#173254] hover:bg-[#173254] hover:text-white transition shadow-xs"
            onClick={startEditAll}
          >
            Edit All
          </button>
        )}
      </div>

      {inlineError && (
        <div className="mb-2 rounded-lg bg-rose-50 p-2.5 text-xs font-semibold text-rose-600 border border-rose-200 whitespace-pre-line">
          {inlineError}
        </div>
      )}

      <div className="mb-3.5 max-h-[440px] overflow-y-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-[11.5px]">
          <thead>
            <tr className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 text-gray-600">
              <th className="w-7 px-1.5 py-2 text-center">
                <input
                  type="checkbox"
                  checked={items.length > 0 && items.every((i) => checked[i.dbId])}
                  onChange={toggleAll}
                  className="h-3.5 w-3.5 rounded"
                  title="Toggle all"
                />
              </th>
              <th className="px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wide min-w-[70px]">Unique No.</th>
              <th className="px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wide min-w-[130px]">Item Details</th>
              <th className="px-1.5 py-2 text-center text-[10px] font-bold uppercase tracking-wide min-w-[70px]">Order Qty</th>
              <th className="px-1.5 py-2 text-left text-[10px] font-bold uppercase tracking-wide min-w-[80px]">Category</th>
              <th className="px-1.5 py-2 text-left text-[10px] font-bold uppercase tracking-wide min-w-[90px]">Vendor</th>
              <th className="px-1.5 py-2 text-left text-[10px] font-bold uppercase tracking-wide min-w-[80px]">Parent Group</th>
              <th className="px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wide min-w-[42px]">Unit</th>
              <th className="px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wide min-w-[45px]">Alt Unit</th>
              <th className="px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wide min-w-[48px]">Shelf Cap</th>
              <th className="px-1 py-2 text-right text-[10px] font-bold uppercase tracking-wide min-w-[50px]">Max Qty</th>
              <th className="px-1 py-2 text-right text-[10px] font-bold uppercase tracking-wide min-w-[50px]">ROL Qty</th>
              <th className="px-1.5 py-2 text-center text-[10px] font-bold uppercase tracking-wide min-w-[65px]">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-4 py-8 text-center text-xs text-gray-500">
                  No items in this parent group.
                </td>
              </tr>
            ) : (
              items.map((i) => {
                const isEditing = editingRowIds.has(i.dbId);
                const cur = rowEdits[i.dbId] || {};
                return (
                  <tr key={i.dbId} className={`border-b border-gray-100 transition ${isEditing ? 'bg-amber-50/40' : 'hover:bg-gray-50/80'}`}>
                    <td className="w-7 px-1.5 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={!!checked[i.dbId]}
                        onChange={(e) => setChecked((prev) => ({ ...prev, [i.dbId]: e.target.checked }))}
                        className="h-3.5 w-3.5 rounded"
                      />
                    </td>
                    <td className="px-2 py-1.5 font-semibold text-gray-900 break-words text-[11px] leading-tight">{i.id}</td>
                    <td className="px-2 py-1.5 break-words leading-tight">
                      {isEditing ? (
                        <input
                          type="text"
                          className="w-full rounded border border-gray-300 px-1.5 py-0.5 text-xs font-medium focus:border-blue-500 focus:outline-none"
                          value={cur.itemDetails ?? ''}
                          onChange={(e) => updateRowEditField(i.dbId, 'itemDetails', e.target.value)}
                        />
                      ) : (
                        <span className="font-medium text-gray-800 break-words text-[11.5px]">{i.itemDetails}</span>
                      )}
                    </td>
                    <td className="px-1.5 py-1.5 text-center">
                      <input
                        type="number"
                        min="0"
                        className="w-16 rounded border border-gray-300 px-1 py-0.5 text-xs font-semibold text-center focus:border-blue-500 focus:outline-none"
                        value={isEditing ? (cur.orderFormula ?? '') : (qty[i.dbId] ?? '')}
                        onChange={(e) => {
                          const val = e.target.value;
                          setQty((prev) => ({ ...prev, [i.dbId]: val }));
                          if (isEditing) {
                            updateRowEditField(i.dbId, 'orderFormula', val);
                          }
                        }}
                        title="Order Qty"
                      />
                    </td>
                    <td className="px-1.5 py-1.5 break-words text-gray-600 text-[11px] leading-tight">
                      {isEditing ? (
                        <input
                          type="text"
                          className="w-full rounded border border-gray-300 px-1 py-0.5 text-xs font-medium focus:border-blue-500 focus:outline-none"
                          value={cur.category ?? ''}
                          onChange={(e) => updateRowEditField(i.dbId, 'category', e.target.value)}
                        />
                      ) : (
                        <span className="text-gray-600 break-words text-[11px]">{i.category || '—'}</span>
                      )}
                    </td>
                    <td className="px-1.5 py-1.5 break-words text-gray-600 text-[11px] leading-tight">
                      {isEditing ? (
                        <input
                          type="text"
                          className="w-full rounded border border-gray-300 px-1 py-0.5 text-xs font-medium focus:border-blue-500 focus:outline-none"
                          value={cur.vendor ?? ''}
                          onChange={(e) => updateRowEditField(i.dbId, 'vendor', e.target.value)}
                        />
                      ) : (
                        <span className="text-gray-600 break-words text-[11px]">{i.vendor || '—'}</span>
                      )}
                    </td>
                    <td className="px-1.5 py-1.5 break-words text-gray-600 text-[11px] leading-tight">
                      {isEditing ? (
                        <input
                          type="text"
                          className="w-full rounded border border-gray-300 px-1 py-0.5 text-xs font-medium focus:border-blue-500 focus:outline-none"
                          value={cur.parentGroup ?? ''}
                          onChange={(e) => updateRowEditField(i.dbId, 'parentGroup', e.target.value)}
                        />
                      ) : (
                        <span className="text-gray-600 break-words text-[11px]">{i.parentGroup || '—'}</span>
                      )}
                    </td>
                    <td className="px-1 py-1.5 text-center text-gray-600 text-[11px] leading-tight">
                      {isEditing ? (
                        <input
                          type="text"
                          className="w-full rounded border border-gray-300 px-0.5 py-0.5 text-xs text-center font-medium focus:border-blue-500 focus:outline-none"
                          value={cur.unit ?? ''}
                          onChange={(e) => updateRowEditField(i.dbId, 'unit', e.target.value)}
                        />
                      ) : (
                        <span>{i.unit || '—'}</span>
                      )}
                    </td>
                    <td className="px-1 py-1.5 text-center text-gray-600 text-[11px] leading-tight">
                      {isEditing ? (
                        <input
                          type="text"
                          className="w-full rounded border border-gray-300 px-0.5 py-0.5 text-xs text-center font-medium focus:border-blue-500 focus:outline-none"
                          value={cur.altUnit ?? ''}
                          onChange={(e) => updateRowEditField(i.dbId, 'altUnit', e.target.value)}
                        />
                      ) : (
                        <span>{i.altUnit || '—'}</span>
                      )}
                    </td>
                    <td className="px-1 py-1.5 text-center text-gray-600 text-[11px] leading-tight">
                      {isEditing ? (
                        <input
                          type="text"
                          className="w-full rounded border border-gray-300 px-0.5 py-0.5 text-xs text-center font-medium focus:border-blue-500 focus:outline-none"
                          value={cur.shelfCapacity ?? ''}
                          onChange={(e) => updateRowEditField(i.dbId, 'shelfCapacity', e.target.value)}
                        />
                      ) : (
                        <span>{i.shelfCapacity || '—'}</span>
                      )}
                    </td>
                    <td className="px-1 py-1.5 text-right text-gray-600 text-[11px] leading-tight">
                      {isEditing ? (
                        <input
                          type="number"
                          className="w-full rounded border border-gray-300 px-0.5 py-0.5 text-xs text-right font-medium focus:border-blue-500 focus:outline-none"
                          value={cur.maxLevelQty ?? ''}
                          onChange={(e) => updateRowEditField(i.dbId, 'maxLevelQty', e.target.value)}
                        />
                      ) : (
                        <span>{i.maxLevelQty != null && i.maxLevelQty !== '' ? i.maxLevelQty : '—'}</span>
                      )}
                    </td>
                    <td className="px-1 py-1.5 text-right text-gray-600 text-[11px] leading-tight">
                      {isEditing ? (
                        <input
                          type="number"
                          className="w-full rounded border border-gray-300 px-0.5 py-0.5 text-xs text-right font-medium focus:border-blue-500 focus:outline-none"
                          value={cur.rolQty ?? ''}
                          onChange={(e) => updateRowEditField(i.dbId, 'rolQty', e.target.value)}
                        />
                      ) : (
                        <span>{i.rolQty != null && i.rolQty !== '' ? i.rolQty : '—'}</span>
                      )}
                    </td>
                    <td className="px-1.5 py-1.5 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            className="rounded bg-[#173254] px-1.5 py-0.5 text-[10.5px] font-semibold text-white hover:bg-[#122842] shadow-xs disabled:opacity-60"
                            onClick={() => saveRow(i.dbId)}
                            disabled={rowSaving[i.dbId]}
                          >
                            {rowSaving[i.dbId] ? '…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[10.5px] text-gray-700 hover:bg-gray-100 shadow-xs"
                            onClick={() => cancelEditRow(i.dbId)}
                            disabled={rowSaving[i.dbId]}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="rounded-md border border-gray-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-100 hover:text-[#173254] transition shadow-xs"
                          onClick={() => startEditRow(i)}
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-[11.2px] font-bold uppercase tracking-wide text-gray-500">
          Status (applies to all checked items)
        </label>
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

  const fuse = useMemo(() => {
    return new Fuse(base, {
      keys: ['itemDetails', 'vendor', 'category'],
      threshold: 0.38,
      ignoreLocation: true,
    });
  }, [base]);

  const rows = useMemo(() => {
    const term = search.trim();
    let result = base;
    if (term) {
      result = fuse.search(term).map((res) => res.item);
    }
    return result.filter((i) => {
      if (category && i.category !== category) return false;
      if (vendor && i.vendor !== vendor) return false;
      if (status && i.status !== status) return false;
      return true;
    });
  }, [base, fuse, search, category, vendor, status]);

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
