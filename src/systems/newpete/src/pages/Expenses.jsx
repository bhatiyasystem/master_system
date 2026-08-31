import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useMagicToast } from '@/context/MagicToastContext';
import { Upload, X, Eye, Check, XCircle, Plus, Search, ChevronLeft, ChevronRight, Calendar, Filter } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import {
  getExpenses,
  saveExpense,
  updateExpense,
  getCredits,
  getLedger,
  saveLedger,
  getUsers,
  deleteLedgerEntryByReference
} from '../utils/storageManager';
import {
  generateId,
  generateSerialNumber,
  formatDate,
  formatCurrency,
  fileToBase64,
  getTodayDate,
  createLedgerEntry,
  calculateBalance
} from '../utils/helpers';
import { fetchEmployees } from '../../../HR_fms/src/services/supabaseHR';

export default function Expenses() {
  const { showToast } = useMagicToast();
  const toast = {
    error: (msg) => showToast(msg, 'error'),
    success: (msg) => showToast(msg, 'success')
  };
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const { user } = useAuthStore();
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    personName: user?.name || '',
    date: getTodayDate(),
    amount: '',
    paymentMode: 'Cash',
    groupHead: 'IT',
    remarks: ''
  });

  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState('');
  const [showFormModal, setShowFormModal] = useState(false);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'history'
  const [statusFilter, setStatusFilter] = useState('');

  const [filters, setFilters] = useState({
    fromDate: '',
    toDate: '',
    personName: '',
    mode: '',
    groupHead: '',
    searchQuery: ''
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    fetchEmployees()
      .then(data => {
        if (data) setEmployees(data);
      })
      .catch(err => console.error("Error loading HR employees:", err));
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, activeTab, statusFilter]);

  const expenses = getExpenses();
  const credits = getCredits();
  const users = getUsers();
  const ledger = getLedger();

  // Get all users for dropdown
  const userList = employees.map(emp => emp.name).filter(Boolean);

  // Calculate balance for selected person
  const selectedPersonBalance = useMemo(() => {
    return calculateBalance(formData.personName, credits, expenses.filter(e => e.status === 'APPROVED'));
  }, [formData.personName, credits, expenses]);

  const pendingExpenses = expenses.filter(e => e.status === 'PENDING');
  const approvedExpenses = expenses.filter(e => e.status === 'APPROVED');
  const rejectedExpenses = expenses.filter(e => e.status === 'REJECTED');

  const displayExpenses = useMemo(() => {
    if (activeTab === 'pending') {
      return pendingExpenses;
    }
    // History tab
    const historyExpenses = [...approvedExpenses, ...rejectedExpenses];
    if (statusFilter) {
      return historyExpenses.filter(e => e.status === statusFilter);
    }
    return historyExpenses;
  }, [activeTab, statusFilter, pendingExpenses, approvedExpenses, rejectedExpenses]);

  const filteredExpenses = displayExpenses.filter(expense => {
    if (filters.fromDate && expense.date < filters.fromDate) return false;
    if (filters.toDate && expense.date > filters.toDate) return false;
    if (filters.personName && expense.personName !== filters.personName) return false;
    if (filters.mode && expense.paymentMode !== filters.mode) return false;
    if (filters.groupHead && expense.groupHead !== filters.groupHead) return false;

    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const match = (
        (expense.sn && String(expense.sn).toLowerCase().includes(q)) ||
        (expense.personName && expense.personName.toLowerCase().includes(q)) ||
        (expense.date && expense.date.includes(q)) ||
        (expense.amount && String(expense.amount).toLowerCase().includes(q)) ||
        (expense.paymentMode && expense.paymentMode.toLowerCase().includes(q)) ||
        (expense.groupHead && expense.groupHead.toLowerCase().includes(q)) ||
        (expense.remarks && expense.remarks.toLowerCase().includes(q))
      );
      if (!match) return false;
    }

    return true;
  });

  const sortedExpenses = filteredExpenses.slice().reverse();
  const totalPages = Math.ceil(sortedExpenses.length / itemsPerPage);
  const paginatedExpenses = sortedExpenses.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const pageTotalAmount = paginatedExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
  const totalAmount = sortedExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);


  const resetform = () => {
    setFormData({
      personName: user?.name || '',
      date: getTodayDate(),
      amount: '',
      paymentMode: 'Cash',
      groupHead: 'IT',
      remarks: ''
    });
    setImage(null);
    setImagePreview('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setTimeout(() => {
      setShowFormModal(false);
      setLoading(false);
    });
  }

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be less than 2MB');
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      setImage(base64);
      setImagePreview(base64);
    } catch (error) {
      toast.error('Error reading image');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("handleSubmit called. formData:", formData, "balance:", selectedPersonBalance);

    // Validation
    if (!formData.personName || !String(formData.personName).trim()) {
      toast.error('Please select person name');
      return;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('Please enter valid expense amount');
      return;
    }

    // Balance validation
    const parsedAmount = parseFloat(formData.amount) || 0;
    const balance = selectedPersonBalance || 0;
    if (parsedAmount > balance) {
      toast.error(
        `Insufficient Balance! Available: ${formatCurrency(balance)}`
      );
      return;
    }

    try {
      setLoading(true);

      const newExpense = {
        id: generateId(),
        sn: generateSerialNumber(),
        personName: formData.personName,
        date: formData.date,
        amount: parseFloat(formData.amount),
        paymentMode: formData.paymentMode,
        groupHead: formData.groupHead,
        image: image || '',
        remarks: formData.remarks,
        status: 'PENDING',
        timestamp: new Date().toISOString()
      };

      saveExpense(newExpense);

      toast.success(`Expense of ${formatCurrency(formData.amount)} submitted for approval!`);

      // Reset form
      // setFormData({
      //   personName: user?.name || '',
      //   date: getTodayDate(),
      //   amount: '',
      //   paymentMode: 'Cash',
      //   groupHead: 'IT',
      //   remarks: ''
      // });
      // setImage(null);
      // setImagePreview('');

      // if (fileInputRef.current) {
      //   fileInputRef.current.value = '';
      // }

      // setTimeout(() => {
      //   setShowFormModal(false);
      //   setLoading(false);
      // }, 3000);
      resetform()

    } catch (error) {
      console.error(error);
      toast.error('Error submitting expense');
      setLoading(false);
    }
  };

  const handleApproveExpense = (expense) => {
    try {
      const approvedExpense = { ...expense, status: 'APPROVED' };
      updateExpense(approvedExpense);

      // Create ledger entry
      const currentBalance = calculateBalance(expense.personName, credits, getExpenses().filter(e => e.status === 'APPROVED'));
      const ledgerEntry = createLedgerEntry(
        expense.id,
        expense.personName,
        'EXPENSE',
        expense.amount,
        expense.date,
        expense.id,
        currentBalance
      );

      saveLedger(ledgerEntry);

      toast.success(`Expense approved!`);
    } catch (error) {
      console.error(error);
      toast.error('Error approving expense');
    }
  };

  const handleRejectExpense = (expense) => {
    try {
      const rejectedExpense = { ...expense, status: 'REJECTED' };
      updateExpense(rejectedExpense);
      
      // Remove from ledger if it had been previously approved
      deleteLedgerEntryByReference(expense.id);

      toast.success(`Expense rejected!`);
    } catch (error) {
      console.error(error);
      toast.error('Error rejecting expense');
    }
  };

  const handleImageView = (imageBase64) => {
    setSelectedImage(imageBase64);
    setShowImageModal(true);
  };

  return (
    <div className="p-0 sm:p-2 md:p-6 space-y-2 md:space-y-6 flex flex-col h-full min-h-0">
      {/* Header Row: Tabs + Filters + Add Button */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center gap-2 lg:gap-3 w-full pb-2 border-b border-gray-100">

        {/* Tabs Row */}
        <div className="flex gap-2 w-full lg:w-auto flex-shrink-0 border-b lg:border-none border-gray-100 pb-2 lg:pb-0 mb-1 lg:mb-0">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 py-1.5 px-3 font-bold transition text-[11px] md:text-sm rounded-md whitespace-nowrap ${activeTab === 'pending'
              ? 'bg-indigo-50 text-indigo-700'
              : 'text-gray-500 hover:bg-gray-50'
              }`}
          >
            Pending ({pendingExpenses.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-1.5 px-3 font-bold transition text-[11px] md:text-sm rounded-md whitespace-nowrap ${activeTab === 'history'
              ? 'bg-indigo-50 text-indigo-700'
              : 'text-gray-500 hover:bg-gray-50'
              }`}
          >
            History ({approvedExpenses.length + rejectedExpenses.length})
          </button>
        </div>

        {/* Filters and Search Container */}
        <div className="flex flex-col lg:flex-row w-full gap-2 lg:gap-3 items-center flex-1">

          {/* Search + Add + Filter Button Row (Mobile grouping) */}
          <div className="flex items-center gap-2 w-full lg:w-auto lg:flex-[1.5]">
            <div className="flex-1 w-full relative">
              <Search className="absolute left-2.5 top-[9px] lg:top-[11px] text-gray-400" size={14} />
              <input
                type="text"
                placeholder="Search all fields..."
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
            {/* Mobile Add Button */}
            <button
              onClick={() => setShowFormModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center lg:hidden h-[32px] w-[32px] flex-shrink-0 shadow-sm transition"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Filters */}
          <div className={`${showMobileFilters ? 'grid' : 'hidden'} lg:flex grid-cols-2 md:grid-cols-4 lg:flex-row gap-2 w-full lg:w-auto lg:flex-[4] items-center`}>
            <input
              type="text"
              placeholder="From Date"
              onFocus={(e) => (e.target.type = 'date')}
              onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }}
              value={filters.fromDate}
              onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
              className="w-full bg-white border border-gray-300 rounded-lg lg:rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500 text-[11px] md:text-sm h-[32px] md:h-[38px]"
            />
            <input
              type="text"
              placeholder="To Date"
              onFocus={(e) => (e.target.type = 'date')}
              onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }}
              value={filters.toDate}
              onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
              className="w-full bg-white border border-gray-300 rounded-lg lg:rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500 text-[11px] md:text-sm h-[32px] md:h-[38px]"
            />
            <select
              value={filters.personName}
              onChange={(e) => setFilters({ ...filters, personName: e.target.value })}
              className="w-full bg-white border border-gray-300 rounded-lg lg:rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500 text-[11px] md:text-sm h-[32px] md:h-[38px]"
            >
              <option value="">All Persons</option>
              {Array.from(new Set(expenses.map(e => e.personName))).map(person => (
                <option key={person} value={person}>{person}</option>
              ))}
            </select>
            <select
              value={filters.mode}
              onChange={(e) => setFilters({ ...filters, mode: e.target.value })}
              className="w-full bg-white border border-gray-300 rounded-lg lg:rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500 text-[11px] md:text-sm h-[32px] md:h-[38px]"
            >
              <option value="">All Modes</option>
              <option value="Cash">Cash</option>
              <option value="Cheque">Cheque</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Online">Online</option>
            </select>
            <select
              value={filters.groupHead}
              onChange={(e) => setFilters({ ...filters, groupHead: e.target.value })}
              className="w-full bg-white border border-gray-300 rounded-lg lg:rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500 text-[11px] md:text-sm h-[32px] md:h-[38px]"
            >
              <option value="">All Groups</option>
              <option value="IT">IT</option>
              <option value="HR">HR</option>
              <option value="Finance">Finance</option>
              <option value="Operations">Operations</option>
              <option value="Marketing">Marketing</option>
            </select>
            {activeTab === 'history' && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-white border border-indigo-200 text-indigo-700 rounded-lg lg:rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500 text-[11px] md:text-sm font-medium h-[32px] md:h-[38px]"
              >
                <option value="">All Statuses</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            )}
          </div>
        </div>

        {/* Desktop Add Button */}
        <button
          onClick={() => setShowFormModal(true)}
          className="hidden lg:flex bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 h-[38px] rounded-lg font-semibold items-center justify-center gap-2 transition shadow-sm w-full lg:w-auto flex-shrink-0 whitespace-nowrap"
        >
          <Plus size={16} /> Add Expense
        </button>
      </div>

      {/* Form Section Modal */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center z-50 p-2 md:p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[95vh] md:max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-2 md:p-3 border-b border-gray-200 flex justify-between items-center bg-gray-50 flex-shrink-0">
              <h2 className="text-base md:text-lg font-bold text-gray-900">Expense Entry Form</h2>
              <button type="button" onClick={() => {resetform(); setShowFormModal(false)}} className="text-gray-400 hover:text-red-500 transition-colors">
                <X size={20} className="md:w-6 md:h-6" />
              </button>
            </div>
            <div className="p-2 md:p-4 overflow-y-auto flex-1">
              <form onSubmit={handleSubmit} className="space-y-1.5 md:space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 md:gap-2">
                  {/* Person Name */}
                  <div>
                    <label className="block text-[11px] md:text-sm font-medium text-gray-700 mb-0.5 md:mb-1">
                      Person Name *
                    </label>
                    <select
                      value={formData.personName}
                      onChange={(e) => setFormData({ ...formData, personName: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1 md:px-3 md:py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-400 text-[11px] md:text-sm appearance-none bg-white min-h-[30px] md:min-h-[38px]"
                      required
                    >
                      <option value="">Select Person</option>
                      {userList.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-[11px] md:text-sm font-medium text-gray-700 mb-0.5 md:mb-1">
                      Date *
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1 md:px-3 md:py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-400 text-[11px] md:text-sm appearance-none bg-white min-h-[30px] md:min-h-[38px]"
                      required
                    />
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="block text-[11px] md:text-sm font-medium text-gray-700 mb-0.5 md:mb-1">
                      Expense Amount (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="0.00"
                      className="w-full border border-gray-300 rounded-lg px-2 py-1 md:px-3 md:py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-400 text-[11px] md:text-sm appearance-none bg-white min-h-[30px] md:min-h-[38px]"
                      required
                    />
                    <p className="text-[9px] md:text-xs text-gray-600 mt-0.5 md:mt-1">
                      Available Balance: <span className={
                        (formData.personName ? selectedPersonBalance : 0) >= 0 ? 'text-green-600' : 'text-red-600'
                      }>{formatCurrency(formData.personName ? selectedPersonBalance : 0)}</span>
                    </p>
                  </div>

                  {/* Payment Mode */}
                  <div>
                    <label className="block text-[11px] md:text-sm font-medium text-gray-700 mb-0.5 md:mb-1">
                      Payment Mode *
                    </label>
                    <select
                      value={formData.paymentMode}
                      onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1 md:px-3 md:py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-400 text-[11px] md:text-sm appearance-none bg-white min-h-[30px] md:min-h-[38px]"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Online">Online</option>
                    </select>
                  </div>

                  {/* Group Head */}
                  <div className="md:col-span-2">
                    <label className="block text-[11px] md:text-sm font-medium text-gray-700 mb-0.5 md:mb-1">
                      Group Head *
                    </label>
                    <select
                      value={formData.groupHead}
                      onChange={(e) => setFormData({ ...formData, groupHead: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1 md:px-3 md:py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-400 text-[11px] md:text-sm appearance-none bg-white min-h-[30px] md:min-h-[38px]"
                    >
                      <option value="IT">IT</option>
                      <option value="HR">HR</option>
                      <option value="Finance">Finance</option>
                      <option value="Operations">Operations</option>
                      <option value="Marketing">Marketing</option>
                    </select>
                  </div>
                </div>

                {/* Remarks */}
                <div>
                  <label className="block text-[11px] md:text-sm font-medium text-gray-700 mb-0.5 md:mb-1">
                    Remarks
                  </label>
                  <textarea
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    placeholder="Add any remarks..."
                    rows="2"
                    className="w-full border border-gray-300 rounded-lg px-2 py-1 md:px-3 md:py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-400 text-[11px] md:text-sm"
                  />
                </div>

                {/* Image Upload */}
                <div>
                  <label className="block text-[11px] md:text-sm font-medium text-gray-700 mb-0.5 md:mb-1">
                    Upload Receipt (Optional)
                  </label>
                  <div className="relative">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full border border-dashed border-gray-300 rounded-lg p-1.5 md:p-2 hover:border-sky-400 hover:bg-sky-50 transition flex flex-col items-center justify-center cursor-pointer"
                    >
                      <Upload className="text-gray-400 mb-0.5 md:mb-1 w-4 h-4 md:w-6 md:h-6" />
                      <span className="text-[10px] md:text-sm font-medium text-gray-700">
                        Click to upload
                      </span>
                    </button>

                    {imagePreview && (
                      <div className="mt-2 md:mt-4">
                        <div className="relative inline-block">
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="h-20 w-20 md:h-40 md:w-40 object-cover rounded border border-gray-200"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setImage(null);
                              setImagePreview('');
                              if (fileInputRef.current) {
                                fileInputRef.current.value = '';
                              }
                            }}
                            className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex gap-2 md:gap-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold py-1.5 px-4 md:py-2 md:px-6 rounded-lg hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 transition text-[11px] md:text-base"
                  >
                    {loading ? 'Submitting...' : 'Submit'}
                  </button>
                  <button
                    type="reset"
                    className="px-4 py-1.5 md:px-6 md:py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium text-[11px] md:text-base"
                  >
                    Reset
                  </button>
                </div>

                <p className="text-[9px] md:text-xs text-gray-500 bg-orange-50 p-1.5 md:p-3 rounded border border-orange-200">
                  ℹ️ Expense requests require approval before being finalized.
                </p>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Expenses List Container */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col pt-1 mt-2 flex-1 min-h-0">

        {/* Mobile View: Cards */}
        <div className="md:hidden flex flex-col gap-2 p-2 overflow-y-auto flex-1 bg-slate-50/50 pb-2">
          {paginatedExpenses.map((expense) => (
            <div key={expense.id} className="bg-white rounded-lg border border-indigo-50 shadow-[0_2px_10px_-4px_rgba(79,70,229,0.1)] p-1.5 relative flex flex-col gap-1 transition-all">
              {/* Top Row: Info */}
              <div className="flex justify-between items-center mb-0">
                <div className="flex items-center gap-1.5">
                  <div>
                    <span className="text-[8px] font-medium text-gray-400 uppercase tracking-widest block leading-none mb-0.5"># {expense.sn}</span>
                    <h3 className="font-medium text-gray-900 text-[11px] uppercase tracking-tight leading-none mt-[2px]">
                      {expense.personName}
                    </h3>
                    <span className="text-[7px] font-medium text-indigo-500 uppercase tracking-wider bg-indigo-50/50 px-1 rounded mt-0.5 inline-block">{expense.groupHead}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-[1px]">
                  <span className="font-medium text-rose-600 text-[12px] tracking-tight leading-none">{formatCurrency(expense.amount)}</span>
                  <div className="flex gap-1" >
                    {(activeTab === 'history' || user?.role !== 'ADMIN') && (
                      <span className={`px-1 py-[1px] rounded text-[7px] font-medium tracking-widest uppercase leading-none ${
                        expense.status === 'APPROVED' 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : expense.status === 'REJECTED' 
                          ? 'bg-rose-100 text-rose-700' 
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {expense.status}
                      </span>
                    )}
                    <span className="bg-sky-100/80 text-sky-700 px-1 py-[1px] rounded text-[7px] font-medium tracking-widest uppercase leading-none">
                      {expense.paymentMode}
                    </span>
                  </div>
                </div>
              </div>

              {/* Remarks and Date */}
              <div className="bg-gradient-to-r from-slate-50 to-indigo-50/30 rounded p-1.5 border border-slate-100">
                <div className="flex items-center gap-1 mb-0.5 border-b border-slate-200/60 pb-0.5">
                  <Calendar size={9} className="text-indigo-400" />
                  <span className="text-[9px] font-medium text-slate-700 tracking-tight leading-none mt-[1px]">{formatDate(expense.date)}</span>
                  <span className="text-[8px] text-slate-400 font-medium ml-auto tracking-wider leading-none mt-[1px]">REF: {expense.sn}</span>
                </div>
                <div>
                  <p className="text-[8px] text-indigo-500 font-medium mb-0 uppercase tracking-wider leading-none">Remarks</p>
                  <p className="text-slate-700 text-[10px] leading-snug font-normal mt-[1px]">{expense.remarks || 'No remarks provided.'}</p>
                </div>
              </div>

              {/* Actions & Image */}
              <div className="flex flex-col gap-1">
                {activeTab === 'pending' && user?.role === 'ADMIN' && (
                  <div className="grid grid-cols-2 gap-1.5 mt-0">
                    <button
                      onClick={() => handleApproveExpense(expense)}
                      className="bg-gradient-to-tr from-emerald-500 to-emerald-400 text-white hover:from-emerald-600 hover:to-emerald-500 py-1 rounded text-[10px] font-medium flex items-center justify-center gap-1 shadow-sm shadow-emerald-200 transition-all"
                    >
                      <Check size={11} strokeWidth={2.5} /> Approve
                    </button>
                    <button
                      onClick={() => handleRejectExpense(expense)}
                      className="bg-rose-50 text-rose-600 hover:bg-rose-100 py-1 rounded text-[10px] font-medium flex items-center justify-center gap-1 transition-all"
                    >
                      <XCircle size={11} strokeWidth={2} /> Reject
                    </button>
                  </div>
                )}

                {expense.image && (
                  <button onClick={() => handleImageView(expense.image)} className="text-indigo-600 bg-indigo-50/80 hover:bg-indigo-100 py-1 rounded text-[9px] font-medium flex items-center justify-center gap-1 transition-colors w-full">
                    <Eye size={10} strokeWidth={2} /> View Attached Receipt
                  </button>
                )}
              </div>
            </div>
          ))}

          {filteredExpenses.length === 0 && (
            <div className="p-4 text-center text-gray-500 bg-white rounded-xl border border-gray-100 shadow-sm font-medium text-xs">
              No entries found.
            </div>
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto overflow-y-auto flex-1 min-h-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <table className="w-full min-w-[800px] relative">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">SN</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Person</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Date</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Amount</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Mode</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Group</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Image</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Remarks</th>
                {user?.role === 'ADMIN' ? (
                  <>
                    {activeTab === 'pending' && (
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Action</th>
                    )}
                    {activeTab === 'history' && (
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Status</th>
                    )}
                  </>
                ) : (
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Status</th>
                )}
              </tr>
            </thead>
            <tbody>
              {paginatedExpenses.map((expense) => (
                <tr key={expense.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-4 py-3 text-center text-sm font-medium text-gray-900">{expense.sn}</td>
                  <td className="px-4 py-3 text-center text-sm text-gray-700">{expense.personName}</td>
                  <td className="px-4 py-3 text-center text-sm text-gray-700">{formatDate(expense.date)}</td>
                  <td className="px-4 py-3 text-center text-sm font-semibold text-red-600">
                    {formatCurrency(expense.amount)}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-700">{expense.paymentMode}</td>
                  <td className="px-4 py-3 text-center text-sm text-gray-700">{expense.groupHead}</td>
                  <td className="px-4 py-3 text-center text-sm">
                    {expense.image ? (
                      <button
                        onClick={() => handleImageView(expense.image)}
                        className="mx-auto text-sky-600 hover:text-sky-800 flex items-center justify-center gap-1"
                      >
                        <Eye size={16} /> View
                      </button>
                    ) : (
                      <span className="text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-left text-sm text-gray-600 max-w-xs truncate">
                    {expense.remarks || '-'}
                  </td>
                  {user?.role === 'ADMIN' ? (
                    <>
                      {activeTab === 'pending' && (
                        <td className="px-4 py-3 text-center text-sm flex justify-center gap-2">
                          <button
                            onClick={() => handleApproveExpense(expense)}
                            className="text-green-600 hover:text-green-800 flex items-center gap-1 font-medium"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => handleRejectExpense(expense)}
                            className="text-red-600 hover:text-red-800 flex items-center gap-1 font-medium"
                          >
                            <XCircle size={16} />
                          </button>
                        </td>
                      )}
                      {activeTab === 'history' && (
                        <td className="px-4 py-3 text-center text-sm">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                            expense.status === 'APPROVED'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {expense.status}
                          </span>
                        </td>
                      )}
                    </>
                  ) : (
                    <td className="px-4 py-3 text-center text-sm">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                        expense.status === 'APPROVED'
                          ? 'bg-green-100 text-green-700'
                          : expense.status === 'REJECTED'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {expense.status}
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {filteredExpenses.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No entries found.
            </div>
          )}
        </div>

        {/* Footer & Pagination Controls */}
        <div className="px-2 md:px-4 py-2 border-t border-gray-200 bg-gray-50 flex flex-col lg:flex-row items-center justify-between gap-2 lg:gap-4 rounded-b-lg pb-2 md:pb-3">

          {/* Mobile Totals Row */}
          {paginatedExpenses.length > 0 && (
            <div className="flex w-full lg:w-auto justify-between lg:hidden items-center text-xs border-b border-gray-200 pb-2 mb-1 px-1">
              <div className="flex flex-col"><span className="text-gray-500 text-[9px] uppercase font-medium tracking-wider mb-0.5">Page Total</span> <span className="font-medium text-rose-600 text-[13px]">{formatCurrency(pageTotalAmount)}</span></div>
              <div className="flex flex-col text-right"><span className="text-gray-500 text-[9px] uppercase font-medium tracking-wider mb-0.5">Total Filtered</span> <span className="font-medium text-gray-900 text-[13px]">{formatCurrency(totalAmount)}</span></div>
            </div>
          )}

          {/* Desktop Totals (Hidden on Mobile) */}
          {paginatedExpenses.length > 0 && (
            <div className="hidden lg:flex items-center gap-6 text-sm order-2">
              <div><span className="text-gray-600">Page Total:</span> <span className="font-semibold text-rose-600 ml-1">{formatCurrency(pageTotalAmount)}</span></div>
              <div className="w-px h-4 bg-gray-300"></div>
              <div><span className="text-gray-500 text-xs mr-1">Filtered Total:</span> <span className="font-semibold text-gray-900">{formatCurrency(totalAmount)}</span></div>
            </div>
          )}

          {/* Controls Row */}
          <div className="flex w-full lg:w-auto justify-between items-center order-3 lg:order-1 gap-2">
            <div className="text-[10px] md:text-sm text-gray-600 flex items-center gap-1.5 md:gap-2 flex-shrink-0">
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border border-gray-300 rounded-md px-1 flex-shrink-0 md:px-2 py-1 focus:outline-none focus:border-indigo-500 bg-white font-medium text-[10px] md:text-sm shadow-sm"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-[10px] md:text-sm text-gray-500 whitespace-nowrap ml-1 font-medium">
                {filteredExpenses.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0}-{Math.min(currentPage * itemsPerPage, sortedExpenses.length)} of {sortedExpenses.length}
              </span>
            </div>

            <div className="flex gap-1.5 md:gap-2 justify-end items-center flex-shrink-0 text-gray-700">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 md:px-2 md:py-1 border border-gray-300 rounded-md bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition shadow-sm flex items-center justify-center text-indigo-600"
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

      {/* Image Modal */}
      {showImageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Image Preview</h3>
              <button
                onClick={() => setShowImageModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <img src={selectedImage} alt="Expense" className="w-full rounded" />
          </div>
        </div>
      )}
    </div>
  );
}
