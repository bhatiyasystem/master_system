import { BarChart } from 'recharts';
import { Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
;
;
import { fmt } from '../utils/helpers';
import { fetchIndents, fetchPOs } from '../services/purchaseService';

function aggregateVendors(indents, pos) {
  const map = {};
  indents.forEach((i) => {
    const v = i.vendor || 'Unspecified';
    if (!map[v]) map[v] = { vendor: v, indentCount: 0, amount: 0 };
    map[v].indentCount++;
  });
  pos.forEach((po) => {
    const v = po.vendor.name || 'Unspecified';
    if (!map[v]) map[v] = { vendor: v, indentCount: 0, amount: 0 };
    map[v].amount += po.grandTotal;
  });
  return Object.values(map)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);
}

function aggregateProducts(pos) {
  const map = {};
  pos.forEach((po) => {
    po.items.forEach((it) => {
      const name = it.productName || 'Unnamed';
      if (!map[name]) map[name] = { name, purchases: 0, qty: 0, amount: 0 };
      map[name].purchases++;
      map[name].qty += Number(it.qty) || 0;
      map[name].amount += Number(it.amount) || 0;
    });
  });
  return Object.values(map)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);
}

export default function DashboardView({ onTabChange }) {
  const [indents, setIndents] = useState([]);
  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchIndents(), fetchPOs()])
      .then(([indentRows, poRows]) => {
        if (!cancelled) {
          setIndents(indentRows);
          setPos(poRows);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load dashboard data.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const statIndent = indents.length;
  const statApproval = indents.filter((i) => i.orderFormula > 0 && i.status === 'Pending').length;
  const statPending = indents.filter((i) => i.status === 'Approved' && !i.poId).length;
  const totalAmount = pos.reduce((s, p) => s + p.grandTotal, 0);

  const vendors = useMemo(() => aggregateVendors(indents, pos), [indents, pos]);
  const products = useMemo(() => aggregateProducts(pos), [pos]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white p-10 text-sm text-gray-500">
        <Loader2 size={20} className="animate-spin" /> Loading dashboard…
      </div>
    );
  }
  if (error) {
    return <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-rose-600">{error}</div>;
  }

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total Indent" value={statIndent} foot="Items imported" accent="bg-[#C99A3E]" />
        <StatCard label="Pending Approvals" value={statApproval} foot="Order Formula > 0" accent="bg-amber-500" />
        <StatCard label="Pending PO" value={statPending} foot="Approved, no PO yet" accent="bg-emerald-600" />
        <StatCard label="Total PO Amount" value={'₹ ' + fmt(totalAmount)} foot={`${pos.length} purchase order${pos.length !== 1 ? 's' : ''}`} accent="bg-indigo-600" small />
      </div>

      <CardPanel title="Quick actions" desc="Follow the flow left to right — import, approve, then raise the PO.">
        <div className="flex flex-wrap gap-2">
          <button className="rounded-lg bg-[#173254] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0E2138]" onClick={() => onTabChange('import')}>
            1. Import Indent
          </button>
          <button className="rounded-lg border border-[#173254] px-3 py-1.5 text-xs font-semibold text-[#173254] hover:bg-[#173254] hover:text-white" onClick={() => onTabChange('approval')}>
            2. Approvals
          </button>
          <button className="rounded-lg border border-[#173254] px-3 py-1.5 text-xs font-semibold text-[#173254] hover:bg-[#173254] hover:text-white" onClick={() => onTabChange('popending')}>
            3. Create PO
          </button>
          <button className="rounded-lg border border-[#173254] px-3 py-1.5 text-xs font-semibold text-[#173254] hover:bg-[#173254] hover:text-white" onClick={() => onTabChange('polist')}>
            4. Purchase Orders
          </button>
        </div>
      </CardPanel>

      <div className="grid grid-cols-1 gap-0 lg:grid-cols-2 lg:gap-4">
        <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4.5">
          <h2 className="mb-3 text-[14.5px] font-bold text-gray-900">Top 10 Vendors</h2>
          <BarChart data={vendors.map((v) => ({ label: v.vendor, value: v.amount }))} color="#173254" />
        </div>
        <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4.5">
          <h2 className="mb-3 text-[14.5px] font-bold text-gray-900">Top 10 Products</h2>
          <BarChart data={products.map((p) => ({ label: p.name, value: p.amount }))} color="#C99A3E" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-0 lg:grid-cols-2 lg:gap-4">
        <CardPanel title="Vendor breakdown" desc="Ranked by total PO amount.">
          {vendors.length === 0 ? (
            <div className="py-4 text-center text-sm text-gray-500">No PO data yet.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-[12.6px]">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    <Th>#</Th>
                    <Th>Vendor</Th>
                    <Th>Indent Items</Th>
                    <Th>PO Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((v, idx) => (
                    <tr key={v.vendor} className="border-t border-gray-100 hover:bg-gray-50">
                      <Td>{idx + 1}</Td>
                      <Td>{v.vendor}</Td>
                      <Td>{v.indentCount}</Td>
                      <Td className="font-semibold">₹ {fmt(v.amount)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardPanel>
        <CardPanel title="Product breakdown" desc="Ranked by total PO amount.">
          {products.length === 0 ? (
            <div className="py-4 text-center text-sm text-gray-500">No PO data yet.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-[12.6px]">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    <Th>#</Th>
                    <Th>Product</Th>
                    <Th>Purchases</Th>
                    <Th>Total Qty</Th>
                    <Th>PO Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, idx) => (
                    <tr key={p.name} className="border-t border-gray-100 hover:bg-gray-50">
                      <Td>{idx + 1}</Td>
                      <Td>{p.name}</Td>
                      <Td>{p.purchases}</Td>
                      <Td>{p.qty}</Td>
                      <Td className="font-semibold">₹ {fmt(p.amount)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardPanel>
      </div>
    </div>
  );
}

function StatCard({ label, value, foot, accent, small }) {
  return (
    <div className="flex h-full flex-col gap-1.5 rounded-2xl border border-gray-200 bg-white p-4">
      <div className={`h-1 w-8 rounded ${accent}`} />
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`font-black text-[#173254] ${small ? 'text-xl' : 'text-2xl'}`}>{value}</div>
      <div className="text-[11px] text-gray-500">{foot}</div>
    </div>
  );
}

function Th({ children }) {
  return <th className="whitespace-nowrap border-b border-gray-200 px-2.5 py-2 text-left text-[10.3px] font-bold uppercase tracking-wide text-gray-500">{children}</th>;
}
function Td({ children, className = '' }) {
  return <td className={`px-2.5 py-2 ${className}`}>{children}</td>;
}
