import React, { useEffect, useMemo, useState } from 'react';
import { CardPanel, FilterBar, EmptyState } from './ui';
import Modal from './Modal';
import { uniqueValues } from '../utils/helpers';
import { fetchIndents, fixIndentVendor, deleteIndents } from '../services/purchaseService';
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react';

export default function PoPendingView({ onCreatePO }) {
  const [indents, setIndents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [vendor, setVendor] = useState('');
 const [checkedByVendor, setCheckedByVendor] = useState({});
  const [expanded, setExpanded] = useState({});
  const [fixingVendorGroup, setFixingVendorGroup] = useState(null);

  function reload() {
    setLoading(true);
    fetchIndents()
      .then((rows) => setIndents(rows))
      .catch((err) => setError(err.message || 'Failed to load indent data.'))
      .finally(() => setLoading(false));
  }

  async function handleDeleteSelected(v, items) {
    const checkedItems = items.filter((i) => isChecked(v, i.id));
    if (checkedItems.length === 0) return;
    if (!window.confirm(`Delete ${checkedItems.length} selected item(s) from ${v}? This cannot be undone.`)) return;
    try {
      await deleteIndents(checkedItems.map((i) => i.dbId));
      reload();
    } catch (err) {
      setError(err.message || 'Failed to delete items.');
    }
  }

  const toggleVendor = (v) => {
    setExpanded((prev) => ({ ...prev, [v]: !prev[v] }));
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
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchIndents()
      .then((rows) => {
        if (!cancelled) setIndents(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load indent data.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const allPending = useMemo(() => indents.filter((i) => i.status === 'Approved' && !i.poId), [indents]);
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
      const v = i.vendor || 'Unspecified Vendor';
      (g[v] = g[v] || []).push(i);
    });
    return g;
  }, [filtered]);

  const isChecked = (v, id) => {
    const map = checkedByVendor[v];
    return map && map[id] !== undefined ? map[id] : true;
  };
  const setCheck = (v, id, val) => {
    setCheckedByVendor((prev) => ({ ...prev, [v]: { ...(prev[v] || {}), [id]: val } }));
  };
  const toggleAllForVendor = (v, items, val) => {
    const map = {};
    items.forEach((i) => (map[i.id] = val));
    setCheckedByVendor((prev) => ({ ...prev, [v]: map }));
  };

  const clear = () => {
    setSearch('');
    setCategory('');
    setVendor('');
  };

  return (
    <CardPanel title="PO Pending" desc="Approved items grouped by vendor. A Purchase Order is always created vendor-wise — select items from a vendor group and create one PO for all of them.">
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

      {loading ? (
        <EmptyState icon={<Loader2 size={36} className="animate-spin" />}>Loading approved items…</EmptyState>
      ) : error ? (
        <EmptyState>{error}</EmptyState>
      ) : allPending.length === 0 ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-[12.6px]">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                {['', 'Unique No.', 'Item Details', 'Category', 'Unit', 'Order Qty', 'Approved Qty', 'Difference'].map((h) => (
                  <th key={h} className="whitespace-nowrap border-b border-gray-200 px-2.5 py-2 text-left text-[10.3px] font-bold uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={8} className="px-2.5 py-10 text-center text-gray-500">No approved items waiting for a Purchase Order.</td></tr>
            </tbody>
          </table>
        </div>
      ) : filtered.length === 0 ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-[12.6px]">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                {['', 'Unique No.', 'Item Details', 'Category', 'Unit', 'Order Qty', 'Approved Qty', 'Difference'].map((h) => (
                  <th key={h} className="whitespace-nowrap border-b border-gray-200 px-2.5 py-2 text-left text-[10.3px] font-bold uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={8} className="px-2.5 py-10 text-center text-gray-500">No items match the current filters.</td></tr>
            </tbody>
          </table>
        </div>
      ) : (
        Object.keys(groups).map((v) => {
          const items = groups[v];
          const allChecked = items.every((i) => isChecked(v, i.id));
          return (
           <div key={v} className="mb-5 overflow-hidden rounded-xl border border-gray-200">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 px-3.5 py-2.5">
                <button
                  type="button"
                  onClick={() => toggleVendor(v)}
                  className="flex items-center gap-1.5 text-left text-[13px] font-bold text-[#173254]"
                >
                  {expanded[v] ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  {v} <span className="font-normal text-gray-500">({items.length} item{items.length > 1 ? 's' : ''})</span>
                </button>
               <div className="flex items-center gap-2">
                  <button
                    className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    onClick={() => handleDeleteSelected(v, items)}
                  >
                    Delete Selected
                  </button>
                  {v === 'Unspecified Vendor' ? (
                    <button
                      className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                      onClick={() => setFixingVendorGroup({ vendor: v, items })}
                    >
                      Fix Vendor Before Ordering
                    </button>
                  ) : (
                    <button
                      className="rounded-lg bg-[#C99A3E] px-3 py-1.5 text-xs font-semibold text-[#1B2A3D] hover:bg-[#B98A2E]"
                      onClick={() => {
                        const checkedItems = items.filter((i) => isChecked(v, i.id));
                        if (checkedItems.length === 0) return;
                        onCreatePO(checkedItems, v);
                      }}
                    >
                      Create PO for selected
                    </button>
                  )}
                </div>
              </div>
              {expanded[v] && (
              <div className="overflow-x-auto border-t border-gray-200">
                <table className="w-full text-[12.6px]">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500">
                      <th className="px-2.5 py-2">
                        <input type="checkbox" checked={allChecked} onChange={(e) => toggleAllForVendor(v, items, e.target.checked)} />
                      </th>
                     {['Unique No.', 'Item Details', 'Category', 'Unit', 'Order Qty', 'Approved Qty', 'Difference'].map((h) => (
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
                          <input type="checkbox" checked={isChecked(v, i.id)} onChange={(e) => setCheck(v, i.id, e.target.checked)} />
                        </td>
                        <td className="px-2.5 py-2">{i.id}</td>
                        <td className="px-2.5 py-2">{i.itemDetails}</td>
                        <td className="px-2.5 py-2">{i.category}</td>
                        <td className="px-2.5 py-2">{i.unit}</td>
                       <td className="px-2.5 py-2">{i.orderFormula}</td>
                        <td className="px-2.5 py-2 font-semibold">{i.approvedQty != null ? i.approvedQty : i.orderFormula}</td>
                        <td className="px-2.5 py-2">
                          <DiffCell orderQty={i.orderFormula} approvedQty={i.approvedQty} />
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
