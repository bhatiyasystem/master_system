import { Loader2, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CardPanel, EmptyState, FilterBar, StatusBadge } from './ui';
import { uniqueValues } from '../utils/helpers';
import { fetchIndents } from '../services/purchaseService';
import ImportView from './ImportView';
import { fetchTatTracking, renderPlannedDateCell, fetchTatSettings } from '../../../core/services/tatService';

export default function IndentView({ onTabChange, refreshKey, onImported }) {
  const [indents, setIndents] = useState([]);
  const [tatTracking, setTatTracking] = useState({});
  const [tatMins, setTatMins] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [vendor, setVendor] = useState('');
  const [status, setStatus] = useState('');
  const [expanded, setExpanded] = useState({});
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  const toggleVendor = (v) => {
    setExpanded((prev) => ({ ...prev, [v]: !prev[v] }));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchIndents()
      .then(async (rows) => {
        if (cancelled) return;
        setIndents(rows);

        const dbIds = rows.map(r => r.dbId);
        if (dbIds.length > 0) {
          try {
            const trackings = await fetchTatTracking('indent_approval', dbIds);
            const trackingMap = {};
            trackings.forEach(t => {
              trackingMap[t.entity_id] = t;
            });
            if (!cancelled) setTatTracking(trackingMap);
          } catch (tatErr) {
            console.error('Failed to load TAT tracking:', tatErr);
          }
        }

        try {
          const settingsData = await fetchTatSettings();
          const setting = settingsData.find(s => s.stage_key === 'indent_approval');
          if (setting && setting.is_active) {
            setTatMins(setting.tat_minutes);
          }
        } catch (settingsErr) {
          console.error('Failed to load TAT settings:', settingsErr);
        }
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
  }, [refreshKey]);

  const categories = useMemo(() => uniqueValues(indents, 'category'), [indents]);
  const vendors = useMemo(() => uniqueValues(indents, 'vendor'), [indents]);

  const rows = useMemo(() => {
    const term = search.toLowerCase().trim();
    return indents.filter((i) => {
      if (term && !`${i.itemDetails} ${i.vendor} ${i.category}`.toLowerCase().includes(term)) return false;
      if (category && i.category !== category) return false;
      if (vendor && i.vendor !== vendor) return false;
      if (status && i.status !== status) return false;
      return true;
    });
  }, [indents, search, category, vendor, status]);

  const groups = useMemo(() => {
    const g = {};
    rows.forEach((i) => {
      const v = i.vendor || 'Unspecified Vendor';
      (g[v] = g[v] || []).push(i);
    });
    return g;
  }, [rows]);

  const clear = () => {
    setSearch('');
    setCategory('');
    setVendor('');
    setStatus('');
  };

  return (
    <CardPanel
      title="Indent Data"
      desc="Every item imported from Excel, with its generated Unique Number."
      action={<ImportView onImported={onImported} />}
    >
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
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>
      </FilterBar>

      {loading ? (
        <EmptyState icon={<Loader2 size={36} className="animate-spin" />}>Loading indent data…</EmptyState>
      ) : error ? (
        <EmptyState icon={<FileText size={36} />}>{error}</EmptyState>
      ) : indents.length === 0 ? (
        <EmptyState icon={<FileText size={36} />} action={
          <button className="mt-3 rounded-lg bg-[#173254] px-4 py-2 text-sm font-semibold text-white" onClick={() => onTabChange('import')}>
            Import Indent
          </button>
        }>
          No indent data yet. Import an Excel file to get started.
        </EmptyState>
      ) : (
        <>
          {Object.keys(groups).sort().map((v) => {
            const items = groups[v];
            const isOpen = !!expanded[v];
            return (
              <div key={v} className="mb-3 overflow-hidden rounded-xl border border-gray-200">
                <button
                  type="button"
                  onClick={() => toggleVendor(v)}
                  className="flex w-full items-center justify-between gap-2 bg-gray-50 px-3.5 py-2.5 text-left hover:bg-gray-100"
                >
                  <span className="flex items-center gap-1.5 text-[13px] font-bold text-[#173254]">
                    {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    {v}
                    <span className="font-normal text-gray-500">({items.length} item{items.length > 1 ? 's' : ''})</span>
                  </span>
                </button>
                {isOpen && (
                  <div className="overflow-x-auto border-t border-gray-200">
                    <table className="w-full text-[12.6px]">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500">
                          {['Unique No.', 'Item Details', 'Category', 'Vendor', 'Unit', 'Parent Group', 'Shelf Cap.', 'Max Level', 'ROL Qty', 'Cl. Qty', 'Conv. Unit', 'Order Formula', 'Status', 'Planned Date'].map((h) => (
                            <th key={h} className="whitespace-nowrap border-b border-gray-200 px-2.5 py-2 text-left text-[10.3px] font-bold uppercase tracking-wide">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((i) => (
                          <tr key={i.dbId} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="px-2.5 py-2 font-semibold">{i.id}</td>
                            <td className="px-2.5 py-2">{i.itemDetails}</td>
                            <td className="px-2.5 py-2">{i.category}</td>
                            <td className="px-2.5 py-2">{i.vendor}</td>
                            <td className="px-2.5 py-2">{i.unit}</td>
                            <td className="px-2.5 py-2">{i.parentGroup}</td>
                            <td className="px-2.5 py-2">{i.shelfCapacity}</td>
                            <td className="px-2.5 py-2">{i.maxLevelQty}</td>
                            <td className="px-2.5 py-2">{i.rolQty}</td>
                            <td className="px-2.5 py-2">{i.clQty}</td>
                            <td className="px-2.5 py-2">{i.conversionUnit}</td>
                            <td className="px-2.5 py-2 font-semibold">{i.orderFormula}</td>
                            <td className="px-2.5 py-2"><StatusBadge status={i.status} /></td>
                            <td className="px-2.5 py-2">{renderPlannedDateCell(tatTracking[i.dbId], i.createdAt, tatMins)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
          <div className="mt-2 text-sm text-gray-500">
            Showing {rows.length} of {indents.length} item(s) across {Object.keys(groups).length} vendor(s).
          </div>
        </>
      )}
    </CardPanel>
  );
}
