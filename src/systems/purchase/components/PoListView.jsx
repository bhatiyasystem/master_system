import { Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import PreviewModal from './PreviewModal';
import { CardPanel, EmptyState, FilterBar, RevisionChip } from './ui';
import { fmt, uniqueValues } from '../utils/helpers';
import { fetchPOs, fetchPoRevisions } from '../services/purchaseService';
import { fetchTatTracking, renderPlannedDateCell } from '../../../core/services/tatService';


export default function PoListView({ onRevise }) {
  const [pos, setPos] = useState([]);
  const [tatTracking, setTatTracking] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [vendor, setVendor] = useState('');
  const [versionsPO, setVersionsPO] = useState(null);
  const [preview, setPreview] = useState(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPOs()
      .then(async (rows) => {
        if (cancelled) return;
        setPos(rows);

        const poIds = rows.map(r => r.id);
        if (poIds.length > 0) {
          try {
            const trackings = await fetchTatTracking('delivery', poIds);
            const trackingMap = {};
            trackings.forEach(t => {
              trackingMap[t.entity_id] = t;
            });
            if (!cancelled) setTatTracking(trackingMap);
          } catch (tatErr) {
            console.error('Failed to load TAT tracking:', tatErr);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load purchase orders.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openPreview = (po, note) => setPreview({ po, note });

  const vendors = useMemo(() => uniqueValues(pos.map((p) => ({ vendor: p.vendor.name })), 'vendor'), [pos]);

  const rows = useMemo(() => {
    const term = search.toLowerCase().trim();
    return pos
      .filter((po) => {
        if (term && !`${po.poNo} ${po.vendor.name}`.toLowerCase().includes(term)) return false;
        if (vendor && po.vendor.name !== vendor) return false;
        return true;
      })
      .slice()
      .reverse();
  }, [pos, search, vendor]);

  const clear = () => {
    setSearch('');
    setVendor('');
  };

  return (
    <CardPanel title="Purchase Orders" desc="All POs raised so far. Preview to print, or revise to correct and re-issue.">
      <FilterBar onClear={clear}>
        <input
          type="text"
          placeholder="Search PO no, vendor..."
          className="min-w-[150px] flex-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-[12.5px]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="min-w-[130px] rounded-lg border border-gray-300 px-2.5 py-1.5 text-[12.5px]" value={vendor} onChange={(e) => setVendor(e.target.value)}>
          <option value="">All Vendors</option>
          {vendors.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </FilterBar>

      {loading ? (
        <EmptyState icon={<Loader2 size={36} className="animate-spin" />}>Loading purchase orders…</EmptyState>
      ) : error ? (
        <EmptyState>{error}</EmptyState>
      ) : pos.length === 0 ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-[12.6px]">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                {['PO No.', 'Date', 'Vendor', 'Items', 'Grand Total', 'Revision', 'Planned Date', ''].map((h) => (
                  <th key={h} className="whitespace-nowrap border-b border-gray-200 px-2.5 py-2 text-left text-[10.3px] font-bold uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
               <tr><td colSpan={8} className="px-2.5 py-10 text-center text-gray-500">No Purchase Orders created yet.</td></tr>
            </tbody>
          </table>
        </div>
      ) : rows.length === 0 ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-[12.6px]">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                {['PO No.', 'Date', 'Vendor', 'Items', 'Grand Total', 'Revision', 'Planned Date', ''].map((h) => (
                  <th key={h} className="whitespace-nowrap border-b border-gray-200 px-2.5 py-2 text-left text-[10.3px] font-bold uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
               <tr><td colSpan={8} className="px-2.5 py-10 text-center text-gray-500">No POs match the current filters.</td></tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-[12.6px]">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                {['PO No.', 'Date', 'Vendor', 'Items', 'Grand Total', 'Revision', 'Planned Date', ''].map((h) => (
                  <th key={h} className="whitespace-nowrap border-b border-gray-200 px-2.5 py-2 text-left text-[10.3px] font-bold uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((po) => (
                <tr key={po.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-2.5 py-2 font-semibold">{po.poNo}</td>
                  <td className="px-2.5 py-2">{po.poDate}</td>
                  <td className="px-2.5 py-2">{po.vendor.name}</td>
                  <td className="px-2.5 py-2">{po.items.length}</td>
                  <td className="px-2.5 py-2 font-semibold">₹ {fmt(po.grandTotal)}</td>
                  <td className="px-2.5 py-2">
                    <RevisionChip revision={po.revision} />
                  </td>
                  <td className="px-2.5 py-2">{renderPlannedDateCell(tatTracking[po.id])}</td>
                  <td className="whitespace-nowrap px-2.5 py-2">
                    <button
                      className="mr-1 rounded-lg border border-[#173254] px-2.5 py-1 text-xs font-semibold text-[#173254]"
                      onClick={() => openPreview(po, po.revision > 1 ? `Revision ${po.revision}` : '')}
                    >
                      Preview
                    </button>
                    {po.revision > 1 && (
                      <button className="mr-1 rounded-lg border border-[#173254] px-2.5 py-1 text-xs font-semibold text-[#173254]" onClick={() => setVersionsPO(po)}>
                        Versions
                      </button>
                    )}
                    <button className="rounded-lg bg-[#C99A3E] px-2.5 py-1 text-xs font-semibold text-[#1B2A3D]" onClick={() => onRevise(po)}>
                      Revise
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <VersionsModal po={versionsPO} onClose={() => setVersionsPO(null)} onPreviewVersion={(v) => openPreview(v, 'Old version — replaced by current PO')} />
      <PreviewModal po={preview && preview.po} revisionNote={preview && preview.note} onClose={() => setPreview(null)} />
    </CardPanel>
  );
}

function VersionsModal({ po, onClose, onPreviewVersion }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!po) return;
    let cancelled = false;
    setLoading(true);
    fetchPoRevisions(po.id)
      .then((rows) => {
        if (!cancelled) setVersions(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [po]);

  if (!po) return null;
  return (
    <Modal open={!!po} onClose={onClose} title={`Previous Versions — ${po.poNo}`} size="lg">
      {loading ? (
        <div className="py-3 text-sm text-gray-500">Loading versions…</div>
      ) : versions.length === 0 ? (
        <EmptyState>No previous versions.</EmptyState>
      ) : (
        versions.map((v, idx) => (
          <div key={idx} className="mb-3 rounded-xl border border-gray-200 bg-white p-4 last:mb-0">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <span className="text-[14px] font-bold text-[#173254]">{v.poNo}</span>{' '}
                <span className="text-[11.5px] text-gray-500">revised at {v.revisedAt}</span>
              </div>
              <button className="rounded-lg border border-[#173254] px-2.5 py-1 text-xs font-semibold text-[#173254]" onClick={() => onPreviewVersion(v)}>
                Preview
              </button>
            </div>
            <div className="flex justify-between text-[12.5px]">
              <span>Items: {v.items.length}</span>
              <span className="font-semibold">Grand Total: ₹ {fmt(v.grandTotal)}</span>
            </div>
          </div>
        ))
      )}
    </Modal>
  );
}
