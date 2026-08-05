import { Search, SlidersHorizontal, FileSpreadsheet, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
// src/systems/inventory/components/TransactionsView.jsx
import { useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
;
import Papa from 'papaparse';
import { saveSettings } from '../redux/slice/inventorySlice';

export default function TransactionsView({ activeUser }) {
  const dispatch = useDispatch();
  const { materials, transactions, settings, _locations = [] } = useSelector((state) => state.inventory);

  const _isViewer = activeUser.role === 'Viewer';

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Pagination & Sorting state
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState(-1);

  // Filter transactions
  const filteredTxns = useMemo(() => {
    let rows = transactions.slice();

    // Visibility filter based on warehouse location restrictions
    if (activeUser.location) {
      const locationSkus = new Set(materials.filter(m => m.location === activeUser.location).map(m => m.sku));
      rows = rows.filter(t => locationSkus.has(t.sku));
    }

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.id.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        (r.ref || '').toLowerCase().includes(q) ||
        (r.user || '').toLowerCase().includes(q)
      );
    }
    if (typeFilter) {
      rows = rows.filter(r => r.type === typeFilter);
    }
    if (fromDate) {
      rows = rows.filter(r => r.date >= fromDate);
    }
    if (toDate) {
      rows = rows.filter(r => r.date <= toDate);
    }

    // Sort
    return rows.sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey];
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return -1 * sortDir;
      if (va > vb) return 1 * sortDir;
      return 0;
    });
  }, [transactions, search, typeFilter, fromDate, toDate, sortKey, sortDir, materials, activeUser]);

  // Pagination details
  const pageSize = settings?.pageSize?.txn || 6;
  const totalPages = Math.max(1, Math.ceil(filteredTxns.length / pageSize));
  const paginatedTxns = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTxns.slice(start, start + pageSize);
  }, [filteredTxns, currentPage, pageSize]);

  const handlePageSizeChange = (e) => {
    const newSize = Number(e.target.value);
    dispatch(saveSettings({
      settings: {
        ...settings,
        pageSize: {
          ...settings?.pageSize,
          txn: newSize
        }
      },
      currentUser: activeUser.name
    }));
    setCurrentPage(1);
  };

  // Handle sort request
  const requestSort = (key) => {
    if (sortKey === key) {
      setSortDir(prev => -prev);
    } else {
      setSortKey(key);
      setSortDir(1);
    }
    setCurrentPage(1);
  };

  // Export CSV
  const handleExport = () => {
    const exportData = filteredTxns.map(t => ({
      'Transaction ID': t.id,
      'Date': t.date,
      'SKU Code': t.sku,
      'Material Name': t.name,
      'Quantity': t.qty,
      'Transaction Type': t.type,
      'Reference Number': t.ref || '',
      'Remarks': t.remarks || '',
      'Operator': t.user || ''
    }));

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Stock_Transactions_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 rounded-3xl p-4 shadow-xs">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            placeholder="Search Txn ID, SKU, material, reference, user..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl bg-gray-50 text-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
          className="px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 text-gray-900 text-sm cursor-pointer"
        >
          <option value="">All Types</option>
          <option value="IN">IN (Stock Received)</option>
          <option value="OUT">OUT (Stock Issued)</option>
        </select>

        <button
          onClick={() => setShowFilters(prev => !prev)}
          className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-bold transition-all cursor-pointer ${
            showFilters
              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
              : 'border-gray-200 text-gray-700 hover:border-indigo-500 hover:text-indigo-600'
          }`}
        >
          <SlidersHorizontal size={16} />
          Date Filter
        </button>

        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 bg-white cursor-pointer"
        >
          <FileSpreadsheet size={16} />
          Export CSV
        </button>

      </div>

      {/* Expanded Date Filters */}
      {showFilters && (
        <div className="flex flex-wrap gap-4 bg-gray-50 border border-dashed border-gray-200 p-4 rounded-2xl">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setCurrentPage(1); }}
              className="px-3.5 py-1.5 border border-gray-200 rounded-xl bg-white text-sm text-gray-950"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setCurrentPage(1); }}
              className="px-3.5 py-1.5 border border-gray-200 rounded-xl bg-white text-sm text-gray-955"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { setFromDate(''); setToDate(''); }}
              className="px-4 py-2 text-xs font-bold text-indigo-650 bg-indigo-50 rounded-xl cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Grid Ledger Table */}
      <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs font-bold uppercase tracking-wider select-none">
                <th className="px-5 py-4 cursor-pointer hover:text-indigo-500" onClick={() => requestSort('id')}>Txn ID</th>
                <th className="px-5 py-4 cursor-pointer hover:text-indigo-500" onClick={() => requestSort('date')}>Date</th>
                <th className="px-5 py-4 cursor-pointer hover:text-indigo-500" onClick={() => requestSort('sku')}>SKU</th>
                <th className="px-5 py-4 cursor-pointer hover:text-indigo-500" onClick={() => requestSort('name')}>Material Name</th>
                <th className="px-5 py-4 cursor-pointer hover:text-indigo-500" onClick={() => requestSort('qty')}>Quantity</th>
                <th className="px-5 py-4 cursor-pointer hover:text-indigo-500" onClick={() => requestSort('type')}>Type</th>
                <th className="px-5 py-4 cursor-pointer hover:text-indigo-500" onClick={() => requestSort('ref')}>Reference #</th>
                <th className="px-5 py-4 cursor-pointer hover:text-indigo-500" onClick={() => requestSort('user')}>User</th>
                <th className="px-5 py-4">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-150 text-gray-700">
              {paginatedTxns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-gray-400">No stock movements recorded.</td>
                </tr>
              ) : (
                paginatedTxns.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-4 font-mono font-bold text-gray-900">{t.id}</td>
                    <td className="px-5 py-4 whitespace-nowrap">{t.date}</td>
                    <td className="px-5 py-4 font-mono font-bold text-gray-800">{t.sku}</td>
                    <td className="px-5 py-4 font-bold text-gray-900 whitespace-nowrap">{t.name}</td>
                    <td className="px-5 py-4 font-black text-sm">{t.qty.toLocaleString()}</td>
                    <td className="px-5 py-4">
                      {t.type === 'IN' ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-850">
                          <ArrowDownLeft size={12} className="text-teal-600" />
                          IN (Receive)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-850">
                          <ArrowUpRight size={12} className="text-rose-600" />
                          OUT (Issue)
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 font-mono whitespace-nowrap">{t.ref || '—'}</td>
                    <td className="px-5 py-4 font-semibold whitespace-nowrap">{t.user || '—'}</td>
                    <td className="px-5 py-4 max-w-[200px] truncate" title={t.remarks}>{t.remarks || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-gray-50 border-t border-gray-200 text-xs font-bold text-gray-550">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div>
              Showing {filteredTxns.length === 0 ? 0 : Math.min(filteredTxns.length, (currentPage - 1) * pageSize + 1)}–
              {Math.min(filteredTxns.length, currentPage * pageSize)} of {filteredTxns.length} records
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase text-gray-400 tracking-wider">Rows per page:</span>
              <select
                value={pageSize}
                onChange={handlePageSizeChange}
                className="px-2 py-0.5 border border-gray-200 rounded-md bg-white text-gray-700 cursor-pointer focus:ring-1 focus:ring-indigo-500 font-normal"
              >
                <option value="6">6</option>
                <option value="12">12</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalPages }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentPage(idx + 1)}
                  className={`w-7 h-7 rounded-lg transition-colors cursor-pointer flex items-center justify-center border text-[11px] ${
                    currentPage === idx + 1
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white border-gray-200 text-gray-650 hover:bg-gray-50'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
