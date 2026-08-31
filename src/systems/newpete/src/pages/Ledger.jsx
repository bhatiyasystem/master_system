import React, { useState, useMemo, useEffect } from 'react';
import { Download, Search, ChevronLeft, ChevronRight, Calendar, Filter } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { getLedger, getUsers } from '../utils/storageManager';
import { formatDate, formatCurrency, isDateInRange } from '../utils/helpers';

export default function Ledger() {
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const { user } = useAuthStore();
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    personName: user?.role === 'ADMIN' ? '' : user?.name,
    transactionType: '',
    searchQuery: ''
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const ledgerData = getLedger();
  const users = getUsers();

  const filteredLedger = useMemo(() => {
    return ledgerData.filter(entry => {
      // User can only see their own ledger
      if (user?.role !== 'ADMIN' && entry.personName !== user?.name) {
        return false;
      }

      // Apply date filter
      if (filters.dateFrom || filters.dateTo) {
        if (!isDateInRange(entry.date, filters.dateFrom, filters.dateTo)) {
          return false;
        }
      }

      // Apply person filter
      if (filters.personName && entry.personName !== filters.personName) {
        return false;
      }

      // Apply transaction type filter
      if (filters.transactionType && entry.type !== filters.transactionType) {
        return false;
      }

      // Apply search query
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        const match = (
          (entry.personName && entry.personName.toLowerCase().includes(q)) ||
          (entry.date && entry.date.includes(q)) ||
          (entry.type && entry.type.toLowerCase().includes(q)) ||
          (entry.amount && String(entry.amount).toLowerCase().includes(q)) ||
          (entry.referenceId && entry.referenceId.toLowerCase().includes(q))
        );
        if (!match) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [ledgerData, filters, user]);

  const totalPages = Math.ceil(filteredLedger.length / itemsPerPage);
  const paginatedLedger = filteredLedger.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Calculate statistics
  const statistics = useMemo(() => {
    const filtered = filteredLedger;
    const totalDebit = filtered
      .filter(e => e.type === 'CREDIT')
      .reduce((sum, e) => sum + e.amount, 0);
    const totalCredit = filtered
      .filter(e => e.type === 'EXPENSE')
      .reduce((sum, e) => sum + e.amount, 0);

    return {
      totalDebit,
      totalCredit,
      balance: totalDebit - totalCredit,
      entries: filtered.length
    };
  }, [filteredLedger]);

  const handleDownloadCSV = () => {
    const headers = ['Date', 'Person Name', 'Type', 'Amount', 'Balance After', 'Description'];
    const rows = filteredLedger.map(entry => [
      formatDate(entry.date),
      entry.personName,
      entry.type,
      entry.amount,
      entry.balance !== undefined ? entry.balance : entry.balanceAfter, // Fallback dynamically
      `Ref: ${entry.referenceId}`
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledger-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="p-0 sm:p-2 md:p-6 space-y-2 md:space-y-6 flex flex-col h-full min-h-0">
      {/* Header */}
      {/* Header Filters — single row */}
      {/* Header with Filters */}
      {/* Header with Filters */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-2 lg:gap-4 w-full pb-2 border-b border-gray-100">
        <div className="flex flex-col lg:flex-row w-full gap-2 items-center">
          
          {/* Search + Export Row (Mobile grouping) */}
          <div className="flex items-center gap-2 w-full lg:w-auto lg:flex-[1.5]">
            <div className="flex-1 w-full relative">
              <Search className="absolute left-2.5 top-[9px] lg:top-[11px] text-gray-400" size={14} />
              <input
                type="text"
                placeholder="Search ref ID, person, amount..."
                value={filters.searchQuery}
                onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                className="w-full bg-white border border-gray-300 rounded-lg lg:rounded pl-8 pr-2 py-1.5 focus:outline-none focus:border-indigo-500 text-xs md:text-sm h-[32px] md:h-[38px]"
              />
            </div>
            {/* Mobile Filter Button */}
            <button
               onClick={() => setShowMobileFilters(!showMobileFilters)}
               className={`lg:hidden flex items-center justify-center rounded-lg shadow-sm h-[32px] w-[32px] flex-shrink-0 transition ${showMobileFilters ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            >
              <Filter size={14} />
            </button>
            {/* Mobile Export Button */}
            <button
               onClick={handleDownloadCSV}
               className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center lg:hidden h-[32px] w-[32px] flex-shrink-0 shadow-sm transition"
            >
              <Download size={16} />
            </button>
          </div>

          {/* Filters */}
          <div className={`${showMobileFilters ? 'grid' : 'hidden'} lg:flex grid-cols-2 lg:flex-row gap-2 w-full lg:w-auto lg:flex-[4] items-center`}>
             <input
               type="text"
               placeholder="From Date"
               onFocus={(e) => (e.target.type = 'date')}
               onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }}
               value={filters.dateFrom}
               onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
               className="w-full bg-white border border-gray-300 rounded-lg lg:rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500 text-[11px] md:text-sm h-[32px] md:h-[38px]"
             />
             <input
               type="text"
               placeholder="To Date"
               onFocus={(e) => (e.target.type = 'date')}
               onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }}
               value={filters.dateTo}
               onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
               className="w-full bg-white border border-gray-300 rounded-lg lg:rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500 text-[11px] md:text-sm h-[32px] md:h-[38px]"
             />
             <div className="w-full">
               {user?.role === 'ADMIN' ? (
                 <select
                   value={filters.personName}
                   onChange={(e) => setFilters({ ...filters, personName: e.target.value })}
                   className="w-full bg-white border border-gray-300 rounded-lg lg:rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500 text-[11px] md:text-sm h-[32px] md:h-[38px]"
                 >
                   <option value="">All Persons</option>
                   {users.map(u => (
                     <option key={u.id} value={u.name}>{u.name}</option>
                   ))}
                 </select>
               ) : (
                 <div className="w-full border border-gray-200 bg-gray-50 rounded-lg lg:rounded px-2 py-1.5 text-[11px] md:text-sm text-gray-600 font-medium whitespace-nowrap overflow-hidden text-ellipsis flex items-center justify-center h-[32px] md:h-[38px]">
                   {user?.name}
                 </div>
               )}
             </div>
             <select
               value={filters.transactionType}
               onChange={(e) => setFilters({ ...filters, transactionType: e.target.value })}
               className="w-full bg-white border border-gray-300 rounded-lg lg:rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500 text-[11px] md:text-sm h-[32px] md:h-[38px]"
             >
               <option value="">All Types</option>
               <option value="CREDIT">Credit</option>
               <option value="EXPENSE">Expense</option>
             </select>
          </div>
        </div>

        {/* Desktop Export Button */}
        <button
           onClick={handleDownloadCSV}
           className="hidden lg:flex bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 h-[38px] rounded-lg font-semibold items-center justify-center gap-2 transition shadow-sm w-full lg:w-auto flex-shrink-0"
        >
          <Download size={16} /> Export
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 md:p-6 border border-green-200 shadow-sm flex flex-col justify-center">
          <p className="text-gray-600 text-[10px] md:text-sm font-bold uppercase tracking-wider">Total Credits</p>
          <p className="text-lg md:text-2xl font-black text-green-700 mt-1">
            {formatCurrency(statistics.totalDebit)}
          </p>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 md:p-6 border border-red-200 shadow-sm flex flex-col justify-center">
          <p className="text-gray-600 text-[10px] md:text-sm font-bold uppercase tracking-wider">Total Expenses</p>
          <p className="text-lg md:text-2xl font-black text-red-700 mt-1">
            {formatCurrency(statistics.totalCredit)}
          </p>
        </div>
        <div className={`rounded-lg p-4 md:p-6 border shadow-sm flex flex-col justify-center bg-gradient-to-br ${
          statistics.balance >= 0 
            ? 'from-blue-50 to-blue-100 border-blue-200' 
            : 'from-orange-50 to-orange-100 border-orange-200'
        }`}>
          <p className="text-gray-600 text-[10px] md:text-sm font-bold uppercase tracking-wider">Net Balance</p>
          <p className={`text-lg md:text-2xl font-black mt-1 ${
            statistics.balance >= 0 ? 'text-blue-700' : 'text-orange-700'
          }`}>
            {formatCurrency(statistics.balance)}
          </p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 md:p-6 border border-purple-200 shadow-sm flex flex-col justify-center">
          <p className="text-gray-600 text-[10px] md:text-sm font-bold uppercase tracking-wider">Total Entries</p>
          <p className="text-lg md:text-2xl font-black text-purple-700 mt-1">
            {statistics.entries}
          </p>
        </div>
      </div>

      {/* Ledger List Container */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col pt-1 mt-2 flex-1 min-h-0">
        
        {/* Mobile View: Cards */}
        <div className="md:hidden flex flex-col gap-2 p-2 overflow-y-auto flex-1 bg-slate-50/50 pb-2">
          {paginatedLedger.map((entry) => (
            <div key={entry.id} className="bg-white rounded-lg border border-gray-200 shadow-sm p-1.5 relative flex flex-col gap-1 transition-all">
              <div className="flex justify-between items-center bg-gray-50 -mx-1.5 -mt-1.5 px-1.5 py-1 border-b border-gray-100 rounded-t-lg mb-0">
                <span className="text-[8px] text-gray-500 font-medium font-mono leading-none">{entry.referenceId}</span>
                <span className={`px-1 py-[1px] rounded text-[7px] font-medium tracking-widest uppercase leading-none ${
                  entry.type === 'CREDIT' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {entry.type}
                </span>
              </div>

              <h3 className="font-medium text-gray-900 text-[11px] uppercase tracking-tight leading-tight mt-[2px]">
                {entry.personName}
              </h3>

              <div className="grid grid-cols-2 gap-y-1 gap-x-2 mt-0">
                <div>
                  <p className="text-[8px] text-gray-400 font-medium mb-0 uppercase tracking-wider leading-none">Date</p>
                  <p className="font-normal text-gray-800 flex items-center gap-1 mt-[2px] leading-none">
                    <Calendar size={9} className="text-sky-500" />
                    <span className="text-[9px]">{formatDate(entry.date)}</span>
                  </p>
                </div>
                <div>
                  <p className="text-[8px] text-gray-400 font-medium mb-0 uppercase tracking-wider leading-none">Amount</p>
                  <p className={`font-medium text-[11px] tracking-tight leading-none mt-[2px] ${entry.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                    {entry.type === 'CREDIT' ? '+' : '-'}{formatCurrency(entry.amount)}
                  </p>
                </div>
                <div className="col-span-2 bg-gray-50/50 border border-gray-100 rounded p-1 flex justify-between items-center mt-0">
                  <p className="text-[8px] text-gray-400 font-medium uppercase tracking-wider leading-none">Running Balance</p>
                  <p className={`font-medium text-[12px] tracking-tight leading-none ${
                    (entry.balance !== undefined ? entry.balance : entry.balanceAfter) >= 0 ? 'text-blue-600' : 'text-orange-600'
                  }`}>
                    {formatCurrency(entry.balance !== undefined ? entry.balance : entry.balanceAfter)}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {filteredLedger.length === 0 && (
            <div className="p-4 text-center text-gray-500 bg-white rounded-xl border border-gray-100 shadow-sm font-medium text-xs">
              No ledger entries found.
            </div>
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto overflow-y-auto flex-1 min-h-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <table className="w-full min-w-[800px] relative">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Date</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Person</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Type</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Amount</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Running Balance</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Ref ID</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLedger.map((entry) => (
                <tr key={entry.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-4 py-2 text-center text-sm text-gray-800 font-medium tracking-tight whitespace-nowrap">{formatDate(entry.date)}</td>
                  <td className="px-4 py-2 text-center text-sm text-gray-700 font-semibold">{entry.personName}</td>
                  <td className="px-4 py-2 text-center text-sm">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      entry.type === 'CREDIT' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {entry.type}
                    </span>
                  </td>
                  <td className={`px-4 py-2 text-center text-sm font-bold ${
                    entry.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {entry.type === 'CREDIT' ? '+' : '-'}{formatCurrency(entry.amount)}
                  </td>
                  <td className={`px-4 py-2 text-center text-sm font-bold ${
                    (entry.balance !== undefined ? entry.balance : entry.balanceAfter) >= 0 ? 'text-blue-600' : 'text-orange-600'
                  }`}>
                    {formatCurrency(entry.balance !== undefined ? entry.balance : entry.balanceAfter)}
                  </td>
                  <td className="px-4 py-2 text-center text-sm text-gray-500 font-mono tracking-tighter">
                    {entry.referenceId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredLedger.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No ledger entries found.
            </div>
          )}
        </div>

        {/* Footer & Pagination Controls */}
        <div className="px-2 md:px-4 py-2 md:py-3 border-t border-gray-200 bg-gray-50 flex flex-col lg:flex-row items-center justify-between gap-2 lg:gap-4 rounded-b-lg pb-2 md:pb-3">
          <div className="flex w-full lg:w-auto justify-between items-center gap-2">
            <div className="text-[10px] md:text-sm text-gray-600 flex items-center gap-1.5 md:gap-2 flex-shrink-0">
              <span className="hidden md:inline">Show</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border border-gray-300 rounded px-1 flex-shrink-0 md:px-1.5 py-1 focus:outline-none focus:border-sky-500 bg-white font-medium text-[10px] md:text-sm shadow-sm"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="hidden md:inline text-[10px] md:text-sm text-gray-500 whitespace-nowrap ml-1 font-medium">
                entries
              </span>
              <span className="text-[10px] md:text-sm text-gray-500 whitespace-nowrap ml-1 font-medium">
                {filteredLedger.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0}-{Math.min(currentPage * itemsPerPage, filteredLedger.length)} of {filteredLedger.length}
              </span>
            </div>

            <div className="flex gap-1.5 md:gap-2 justify-end items-center flex-shrink-0 text-gray-700">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 md:px-2 md:py-1 border border-gray-300 rounded-md bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition shadow-sm flex items-center justify-center text-indigo-600"
                title="Previous Page"
              >
                <ChevronLeft size={16} strokeWidth={2.5} />
              </button>
              <div className="flex items-center text-[10px] md:text-sm font-medium whitespace-nowrap">
                Pg {currentPage}/{totalPages || 1}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-1 md:px-2 md:py-1 border border-gray-300 rounded-md bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition shadow-sm flex items-center justify-center text-indigo-600"
                title="Next Page"
              >
                <ChevronRight size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
