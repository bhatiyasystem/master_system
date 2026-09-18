import { Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Modal from './Modal';
import { CardPanel, EmptyState, FilterBar } from './ui';
import { uniqueValues } from '../utils/helpers';
import { fetchIndents, fixIndentVendor, deleteIndents } from '../services/purchaseService';
import { fetchTatTracking, renderPlannedDateCell, fetchTatSettings } from '../../../core/services/tatService';

export default function PoPendingView({ onCreatePO, onPendingCountChange }) {
  const location = useLocation();
  const hasData = useRef(false);
  const [indents, setIndents] = useState([]);
  const [tatTracking, setTatTracking] = useState({});
  const [tatMins, setTatMins] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [parentGroup, setParentGroup] = useState('');
  const [vendor, setVendor] = useState('');
  const [checkedByGroup, setCheckedByGroup] = useState({});
  const [expanded, setExpanded] = useState({});
  const [fixingVendorGroup, setFixingVendorGroup] = useState(null);

  const reload = useCallback(() => {
    let cancelled = false;
    if (!hasData.current) setLoading(true);
    setError(null);

    Promise.all([fetchIndents(), fetchTatSettings()])
      .then(async ([rows, settingsData]) => {
        if (cancelled) return;
        setIndents(rows);
        hasData.current = true;

        const setting = settingsData.find(s => s.stage_key === 'purchase_order');
        if (setting && setting.is_active) setTatMins(setting.tat_minutes);

        const dbIds = rows.map(r => r.dbId);
        if (dbIds.length > 0) {
          try {
            const trackings = await fetchTatTracking('purchase_order', dbIds);
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
    const timer = setInterval(() => reload(), 10000);
    return () => clearInterval(timer);
  }, [reload]);

  // Re-fetch whenever this page becomes active (navigation or initial mount)
  useEffect(() => {
    const cancel = reload();
    return cancel;
  }, [location.pathname, reload]);

  async function handleDeleteSelected(group, items) {
    const checkedItems = items.filter((i) => isChecked(group, i.id));
    if (checkedItems.length === 0) return;
    if (!window.confirm(`Delete ${checkedItems.length} selected item(s) from ${group}? This cannot be undone.`)) return;
    try {
      await deleteIndents(checkedItems.map((i) => i.dbId));
      reload();
    } catch (err) {
      setError(err.message || 'Failed to delete items.');
    }
  }

  const toggleGroup = (group) => {
    setExpanded((prev) => ({ ...prev, [group]: !prev[group] }));
  };
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


  const allPending = useMemo(() => indents.filter((i) => i.status === 'Approved' && !i.poId), [indents]);
  const parentGroups = useMemo(() => uniqueValues(allPending, 'parentGroup'), [allPending]);
  const vendors = useMemo(() => uniqueValues(allPending, 'vendor'), [allPending]);

  useEffect(() => {
    if (onPendingCountChange) {
      onPendingCountChange(parentGroups.length);
    }
  }, [parentGroups.length, onPendingCountChange]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return allPending.filter((i) => {
      if (term && !`${i.itemDetails} ${i.vendor} ${i.parentGroup}`.toLowerCase().includes(term)) return false;
      if (parentGroup && (i.parentGroup || 'Unassigned Group') !== parentGroup) return false;
      if (vendor && i.vendor !== vendor) return false;
      return true;
    });
  }, [allPending, search, parentGroup, vendor]);

  const groups = useMemo(() => {
    const g = {};
    filtered.forEach((i) => {
      const pg = i.parentGroup || 'Unassigned Group';
      (g[pg] = g[pg] || []).push(i);
    });
    return g;
  }, [filtered]);

  const groupKeys = useMemo(() => Object.keys(groups), [groups]);

  const isChecked = (group, id) => {
    const map = checkedByGroup[group];
    return map && map[id] !== undefined ? map[id] : true;
  };
  const setCheck = (group, id, val) => {
    setCheckedByGroup((prev) => ({ ...prev, [group]: { ...(prev[group] || {}), [id]: val } }));
  };
  const toggleAllForGroup = (group, items, val) => {
    const map = {};
    items.forEach((i) => (map[i.id] = val));
    setCheckedByGroup((prev) => ({ ...prev, [group]: map }));
  };

  const clear = () => {
    setSearch('');
    setParentGroup('');
    setVendor('');
  };

  return (
    <CardPanel title="PO Pending" desc="Approved items grouped by parent group. Select items from a parent group to create a Purchase Order.">
      <FilterBar onClear={clear}>
        <input
          type="text"
          placeholder="Search item, vendor, parent group..."
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

      {loading ? (
        <EmptyState icon={<Loader2 size={36} className="animate-spin" />}>Loading approved items…</EmptyState>
      ) : error ? (
        <EmptyState>{error}</EmptyState>
      ) : allPending.length === 0 ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-[12.6px]">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                {['', 'Unique No.', 'Item Details', 'Parent Group', 'Vendor', 'Unit', 'Order Qty', 'Approved Qty', 'Difference', 'Planned Date'].map((h) => (
                  <th key={h} className="whitespace-nowrap border-b border-gray-200 px-2.5 py-2 text-left text-[10.3px] font-bold uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={10} className="px-2.5 py-10 text-center text-gray-500">No approved items waiting for a Purchase Order.</td></tr>
            </tbody>
          </table>
        </div>
      ) : filtered.length === 0 ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-[12.6px]">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                {['', 'Unique No.', 'Item Details', 'Parent Group', 'Vendor', 'Unit', 'Order Qty', 'Approved Qty', 'Difference', 'Planned Date'].map((h) => (
                  <th key={h} className="whitespace-nowrap border-b border-gray-200 px-2.5 py-2 text-left text-[10.3px] font-bold uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={10} className="px-2.5 py-10 text-center text-gray-500">No items match the current filters.</td></tr>
            </tbody>
          </table>
        </div>
      ) : (
        groupKeys.map((pg) => {
          const items = groups[pg];
          const allChecked = items.every((i) => isChecked(pg, i.id));
          const vendorsInGroup = Array.from(new Set(items.map((i) => i.vendor).filter(Boolean)));
          const vendorsText = vendorsInGroup.length > 0 ? vendorsInGroup.join(', ') : 'No Vendor';
          return (
           <div key={pg} className="mb-5 overflow-hidden rounded-xl border border-gray-200">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 px-3.5 py-2.5">
                <button
                  type="button"
                  onClick={() => toggleGroup(pg)}
                  className="flex items-center gap-1.5 text-left text-[13px] font-bold text-[#173254]"
                >
                  {expanded[pg] ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  <span>{pg}</span>
                  <span className="text-[12.5px] font-medium text-gray-700">— {vendorsText}</span>
                  <span className="font-normal text-gray-500">({items.length} item{items.length > 1 ? 's' : ''})</span>
                </button>
               <div className="flex items-center gap-2">
                  <button
                    className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    onClick={() => handleDeleteSelected(pg, items)}
                  >
                    Delete Selected
                  </button>
                  <button
                    className="rounded-lg bg-[#C99A3E] px-3 py-1.5 text-xs font-semibold text-[#1B2A3D] hover:bg-[#B98A2E]"
                    onClick={() => {
                      const checkedItems = items.filter((i) => isChecked(pg, i.id));
                      if (checkedItems.length === 0) return;
                      const defaultVendor = checkedItems.find((i) => i.vendor)?.vendor || '';
                      onCreatePO(checkedItems, pg, defaultVendor);
                    }}
                  >
                    Create PO for selected
                  </button>
                </div>
              </div>
              {expanded[pg] && (
              <div className="overflow-x-auto border-t border-gray-200">
                <table className="w-full text-[12.6px]">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500">
                      <th className="px-2.5 py-2">
                        <input type="checkbox" checked={allChecked} onChange={(e) => toggleAllForGroup(pg, items, e.target.checked)} />
                      </th>
                     {['Unique No.', 'Item Details', 'Parent Group', 'Vendor', 'Unit', 'Order Qty', 'Approved Qty', 'Difference', 'Planned Date'].map((h) => (
                        <th key={h} className="whitespace-nowrap border-b border-gray-200 px-2.5 py-2 text-left text-[10.3px] font-bold uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i) => (
                      <tr key={i.id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-2.5 py-2">
                          <input type="checkbox" checked={isChecked(pg, i.id)} onChange={(e) => setCheck(pg, i.id, e.target.checked)} />
                        </td>
                        <td className="px-2.5 py-2">{i.id}</td>
                        <td className="px-2.5 py-2">{i.itemDetails}</td>
                        <td className="px-2.5 py-2">{i.parentGroup || '—'}</td>
                        <td className="px-2.5 py-2">{i.vendor || '—'}</td>
                        <td className="px-2.5 py-2">{i.unit}</td>
                        <td className="px-2.5 py-2">{i.orderFormula}</td>
                        <td className="px-2.5 py-2 font-semibold">{i.approvedQty != null ? i.approvedQty : i.orderFormula}</td>
                        <td className="px-2.5 py-2">
                          <DiffCell orderQty={i.orderFormula} approvedQty={i.approvedQty} />
                        </td>
                        <td className="px-2.5 py-2">{renderPlannedDateCell(tatTracking[i.dbId], i.decidedAt, tatMins)}</td>
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

      <FixVendorModal
        group={fixingVendorGroup}
        onClose={() => setFixingVendorGroup(null)}
        onFixed={() => {
          setFixingVendorGroup(null);
          reload();
        }}
      />
    </CardPanel>
  );
}

function FixVendorModal({ group, onClose, onFixed }) {
  const [vendorName, setVendorName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!group && vendorName) setVendorName('');

  async function handleSave() {
    if (!vendorName.trim()) {
      setError('Enter a vendor name.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await fixIndentVendor(group.items.map((i) => i.dbId), vendorName.trim());
      onFixed();
    } catch (err) {
      setError(err.message || 'Failed to update vendor.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={!!group}
      onClose={onClose}
      title="Fix Vendor"
      footer={
        <>
          <button className="rounded-lg border border-[#173254] px-4 py-2 text-sm font-semibold text-[#173254]" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="rounded-lg bg-[#173254] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Vendor'}
          </button>
        </>
      }
    >
      {group && (
        <>
          <p className="mb-3 text-[12.5px] text-gray-600">
            These {group.items.length} item(s) were imported without a vendor. Assign the correct vendor name so a Purchase Order can be created.
          </p>
          <input
            type="text"
            autoFocus
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="e.g. Lakhotiya Trade Links"
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
          />
          {error && <div className="mt-2 text-sm text-rose-600">{error}</div>}
        </>
      )}
    </Modal>
  );
}
