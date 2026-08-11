import { Plus, Search, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { supabaseFetchSheet, supabaseMutateSheet } from '../../../../services/supabaseApiAdapter';

const LeaveManagement = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [approvedLeaves, setApprovedLeaves] = useState([]);
  const [rejectedLeaves, setRejectedLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [actionInProgress, setActionInProgress] = useState(null);
  const [editableDates, setEditableDates] = useState({ from: '', to: '' });

  // New state for leave request modal
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [formData, setFormData] = useState({
    employeeId: '',
    employeeName: '',
    designation: '',
    hodName: '',
    leaveType: '',
    fromDate: '',
    toDate: '',
    reason: ''
  });

  const handleCheckboxChange = (leaveId, rowData) => {
    if (selectedRow?.serialNo === leaveId) {
      setSelectedRow(null);
      setEditableDates({ from: '', to: '' });
    } else {
      // Convert DD/MM/YYYY to YYYY-MM-DD for date input
      const formatForInput = (dateStr) => {
        if (!dateStr) return '';
        const [day, month, year] = dateStr.split('/');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      };

      setSelectedRow(rowData);
      setEditableDates({
        from: formatForInput(rowData.startDate),
        to: formatForInput(rowData.endDate)
      });
    }
  };

  const handleDateChange = (field, value) => {
    setEditableDates(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Fetch employees from JOINING sheet
  const fetchEmployees = async () => {
    try {
      const response = await supabaseFetchSheet('JOINING');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch employee data');
      }

      const rawData = result.data || result;

      if (!Array.isArray(rawData)) {
        throw new Error('Expected array data not received');
      }

      // Data starts from row 7 (index 6), Column E is index 4, Column B is index 1, Column I is index 8
      const employeeData = rawData.slice(6).map((row, index) => ({
        id: row[1] || '', // Column B (Employee ID)
        name: row[4] || '', // Column E (Employee Name)
        designation: row[8] || '', // Column I (Designation)
        rowIndex: index + 7 // Actual row number in sheet
      })).filter(emp => emp.name && emp.id); // Filter out empty entries

      setEmployees(employeeData);
    } catch (error) {
      console.error('Error fetching employee data:', error);
      toast.error(`Failed to load employee data: ${error.message}`);
    }
  };


  // Handle employee selection
  const handleEmployeeChange = (selectedName) => {
    const selectedEmployee = employees.find(emp => emp.name === selectedName);
    setFormData(prev => ({
      ...prev,
      employeeName: selectedName,
      employeeId: selectedEmployee ? selectedEmployee.id : '',
      designation: selectedEmployee ? selectedEmployee.designation : ''
    }));
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name === 'employeeName') {
      handleEmployeeChange(value);
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Calculate days between dates
  const calculateDays = (startDateStr, endDateStr) => {
    if (!startDateStr || !endDateStr) return 0;

    let startDate, endDate;

    // Handle different date formats
    if (startDateStr.includes('/')) {
      const [startDay, startMonth, startYear] = startDateStr.split('/').map(Number);
      startDate = new Date(startYear, startMonth - 1, startDay);
    } else {
      startDate = new Date(startDateStr);
    }

    if (endDateStr.includes('/')) {
      const [endDay, endMonth, endYear] = endDateStr.split('/').map(Number);
      endDate = new Date(endYear, endMonth - 1, endDay);
    } else {
      endDate = new Date(endDateStr);
    }

    const diffTime = endDate - startDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  // Format date to DD/MM/YYYY
  const formatDOB = (dateString) => {
    if (!dateString) return '';

    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString; // Return as-is if not a valid date
    }

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  };

  // Submit leave request
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.employeeName || !formData.leaveType || !formData.fromDate || !formData.toDate || !formData.reason || !formData.hodName) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      setSubmitting(true);
      const now = new Date();
      const formattedTimestamp = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

      const rowData = [
        formattedTimestamp,           // Timestamp
        "",                          // Serial number (empty for auto-increment)
        formData.employeeId,         // Employee ID
        formData.employeeName,       // Employee Name
        formatDOB(formData.fromDate), // Leave Date Start
        formatDOB(formData.toDate),   // Leave Date End
        formData.reason,             // Reason
        "Pending",                   // Status
        formData.leaveType,          // Leave Type
        formData.hodName,            // HOD Name (Column J, index 9)
        formData.designation         // Designation (Column K, index 10)
      ];

      const response = await supabaseMutateSheet('Leave Management', 'insert', { rowData });

      const result = await response.json();

      if (result.success) {
        toast.success('Leave Request submitted successfully!');
        setFormData({
          employeeId: '',
          employeeName: '',
          designation: '',
          hodName: '',
          leaveType: '',
          fromDate: '',
          toDate: '',
          reason: ''
        });
        setShowModal(false);
        // Refresh the data
        fetchLeaveData();
      } else {
        toast.error('Failed to insert: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Insert error:', error);
      toast.error('Something went wrong!');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLeaveAction = async (action) => {
    if (!selectedRow) {
      toast.error('Please select a leave request');
      return;
    }

    setActionInProgress(action);
    setLoading(true);

    try {
      const fullDataResponse = await supabaseFetchSheet('Leave Management');

      if (!fullDataResponse.ok) {
        throw new Error(`HTTP error! status: ${fullDataResponse.status}`);
      }

      const fullDataResult = await fullDataResponse.json();
      const allData = fullDataResult.data || fullDataResult;

      const headerRowIndex = 0;
      const _headers = allData[headerRowIndex].map(h => h?.toString().trim().toLowerCase());

      const timestampIndex = 0;
      const employeeIdIndex = 2;
      const startDateIndex = 4;
      const endDateIndex = 5;
      const statusIndex = 7;

      const rowIndex = allData.findIndex((row, idx) =>
        idx > headerRowIndex &&
        row[employeeIdIndex]?.toString().trim() === selectedRow.employeeId?.toString().trim()
      );

      if (rowIndex === -1) {
        throw new Error(`Employee ${selectedRow.employeeId} not found`);
      }

      let currentRow = [...allData[rowIndex]];

      const today = new Date();
      const day = String(today.getDate()).padStart(2, '0');
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const year = today.getFullYear();
      const formattedDate = `${day}/${month}/${year}`;

      // Update dates if they were changed
      if (editableDates.from && editableDates.from !== selectedRow.startDate) {
        const [year, month, day] = editableDates.from.split('-');
        currentRow[startDateIndex] = `${day}/${month}/${year}`;
      }

      if (editableDates.to && editableDates.to !== selectedRow.endDate) {
        const [year, month, day] = editableDates.to.split('-');
        currentRow[endDateIndex] = `${day}/${month}/${year}`;
      }

      currentRow[timestampIndex] = formattedDate;

      // FIX: Use the correct status values that match your filtering logic
      currentRow[statusIndex] = action === 'accept' ? 'Approved' : 'Rejected';

      const payload = {
        sheetName: "Leave Management",
        action: "update",
        rowIndex: rowIndex + 1,
        rowData: JSON.stringify(currentRow)
      };

      const response = await supabaseMutateSheet('Leave Management', 'update', payload);

      const result = await response.json();
      if (result.success) {
        toast.success(`Leave ${action === 'accept' ? 'approved' : 'rejected'} for ${selectedRow.employeeName || 'employee'}`);
        fetchLeaveData();
        setSelectedRow(null);
        setEditableDates({ from: '', to: '' });
      } else {
        throw new Error(result.error || "Update failed");
      }

    } catch (error) {
      console.error('Update error:', error);
      toast.error(`Failed to ${action} leave: ${error.message}`);
    } finally {
      setLoading(false);
      setActionInProgress(null);
    }
  };

  const fetchLeaveData = async () => {
    setLoading(true);
    setTableLoading(true);
    setError(null);

    try {
      const response = await supabaseFetchSheet('Leave Management');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch leave data');
      }

      const rawData = result.data || result;
      console.log(rawData);

      if (!Array.isArray(rawData)) {
        throw new Error('Expected array data not received');
      }

      const dataRows = rawData.length > 1 ? rawData.slice(1) : [];

      const processedData = dataRows.map(row => ({
        timestamp: row[0] || '',
        serialNo: row[1] || '',
        employeeId: row[2] || '',
        employeeName: row[3] || '',
        startDate: row[4] || '',
        endDate: row[5] || '',
        remark: row[6] || '',
        days: calculateDays(row[4], row[5]),
        status: row[7],
        leaveType: row[8],
      }));

      // Case-insensitive filtering
      setPendingLeaves(processedData.filter(leave =>
        leave.status?.toString().toLowerCase() === 'pending'
      ));
      setApprovedLeaves(processedData.filter(leave =>
        leave.status?.toString().toLowerCase() === 'approved'
      ));
      setRejectedLeaves(processedData.filter(leave =>
        leave.status?.toString().toLowerCase() === 'rejected'
      ));

    } catch (error) {
      console.error('Error fetching leave data:', error);
      setError(error.message);
      toast.error(`Failed to load leave data: ${error.message}`);
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaveData();
    fetchEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? dateString : date.toLocaleDateString();
  };

  const filteredPendingLeaves = pendingLeaves.filter(item => {
    const matchesSearch = item.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.employeeId?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const filteredApprovedLeaves = approvedLeaves.filter(item => {
    const matchesSearch = item.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.employeeId?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const filteredRejectedLeaves = rejectedLeaves.filter(item => {
    const matchesSearch = item.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.employeeId?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const leaveTypes = [
    'Casual Leave',
    'Earned Leave',
    'Normal Leave',
  ];

  const renderPendingLeavesTable = () => (
    <table className="min-w-full divide-y divide-white">
      <thead className="bg-gray-100">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Select
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee ID</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leave Type</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-white">
        {filteredPendingLeaves.length > 0 ? (
          filteredPendingLeaves.map((item, index) => (
            <tr key={index} className="hover:bg-white">
              <td className="px-6 py-4 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={selectedRow?.serialNo === item.serialNo}
                  onChange={() => handleCheckboxChange(item.serialNo, item)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.employeeId}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.employeeName}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {selectedRow?.serialNo === item.serialNo ? (
                  <input
                    type="date"
                    value={editableDates.from}
                    onChange={(e) => handleDateChange('from', e.target.value)}
                    className="border rounded p-1 text-sm"
                  />
                ) : (
                  formatDate(item.startDate)
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {selectedRow?.serialNo === item.serialNo ? (
                  <input
                    type="date"
                    value={editableDates.to}
                    onChange={(e) => handleDateChange('to', e.target.value)}
                    className="border rounded p-1 text-sm"
                  />
                ) : (
                  formatDate(item.endDate)
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {selectedRow?.serialNo === item.serialNo ?
                  calculateDays(editableDates.from, editableDates.to) :
                  item.days
                }
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.remark}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.leaveType}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleLeaveAction('accept')}
                    disabled={!selectedRow || selectedRow.serialNo !== item.serialNo || loading}
                    className={`px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700 min-h-[42px] flex items-center justify-center ${!selectedRow || selectedRow.serialNo !== item.serialNo || loading ? 'opacity-75 cursor-not-allowed' : ''
                      }`}
                  >
                    {loading && selectedRow?.serialNo === item.serialNo && actionInProgress === 'accept' ? (
                      <div className="flex items-center">
                        <svg
                          className="animate-spin h-4 w-4 text-white mr-2"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Accepting...</span>
                      </div>
                    ) : 'Accept'}
                  </button>
                  <button
                    onClick={() => handleLeaveAction('rejected')}
                    disabled={selectedRow?.serialNo !== item.serialNo || loading}
                    className={`px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 min-h-[42px] flex items-center justify-center ${selectedRow?.serialNo !== item.serialNo || (loading && actionInProgress === 'accept') ? 'opacity-75 cursor-not-allowed' : ''
                      }`}
                  >
                    {loading && selectedRow?.serialNo === item.serialNo && actionInProgress === 'rejected' ? (
                      <div className="flex items-center">
                        <svg
                          className="animate-spin h-4 w-4 text-white mr-2"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Rejecting...</span>
                      </div>
                    ) : 'Reject'}
                  </button>
                </div>
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan="9" className="px-6 py-12 text-center">
              <p className="text-gray-500">No pending leave requests found.</p>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );

  const renderApprovedLeavesTable = () => (
    <table className="min-w-full divide-y divide-white">
      <thead className="bg-gray-100">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee ID</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leave Type</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-white">
        {filteredApprovedLeaves.length > 0 ? (
          filteredApprovedLeaves.map((item, index) => (
            <tr key={index} className="hover:bg-white">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.employeeId}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.employeeName}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatDate(item.startDate)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatDate(item.endDate)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.days}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.remark}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.leaveType}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan="7" className="px-6 py-12 text-center">
              <p className="text-gray-500">No approved leave requests found.</p>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );

  const renderRejectedLeavesTable = () => (
    <table className="min-w-full divide-y divide-white">
      <thead className="bg-gray-100">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee ID</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leave Type</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-white">
        {filteredRejectedLeaves.length > 0 ? (
          filteredRejectedLeaves.map((item, index) => (
            <tr key={index} className="hover:bg-white">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.employeeId}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.employeeName}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatDate(item.startDate)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatDate(item.endDate)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.days}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.remark}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.leaveType}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan="7" className="px-6 py-12 text-center">
              <p className="text-gray-500">No rejected leave requests found.</p>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );

  const renderTable = () => {
    switch (activeTab) {
      case 'pending':
        return renderPendingLeavesTable();
      case 'approved':
        return renderApprovedLeavesTable();
      case 'rejected':
        return renderRejectedLeavesTable();
      default:
        return renderPendingLeavesTable();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leave Management</h1>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus size={16} className="mr-2" />
          New Leave Request
        </button>
      </div>

      <div className="bg-white p-4 rounded-lg shadow flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-4">
        <div className="flex flex-1 max-w-md">
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Search by name or employee ID..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('pending')}
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${activeTab === 'pending'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              Pending Leaves ({pendingLeaves.length})
            </button>
            <button
              onClick={() => setActiveTab('approved')}
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${activeTab === 'approved'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              Approved Leaves ({approvedLeaves.length})
            </button>
            <button
              onClick={() => setActiveTab('rejected')}
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${activeTab === 'rejected'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              Rejected Leaves ({rejectedLeaves.length})
            </button>
          </nav>
        </div>

        <div className="p-6">
          <div className="overflow-x-auto">
            {tableLoading ? (
              <div className="px-6 py-12 text-center">
                <div className="flex justify-center flex-col items-center">
                  <div className="w-6 h-6 border-4 border-indigo-500 border-dashed rounded-full animate-spin mb-2"></div>
                  <span className="text-gray-600 text-sm">
                    {loading ? 'Processing request...' : 'Loading leave data...'}
                  </span>
                </div>
              </div>
            ) : error ? (
              <div className="px-6 py-12 text-center">
                <p className="text-red-500">Error: {error}</p>
                <button
                  onClick={fetchLeaveData}
                  className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Retry
                </button>
              </div>
            ) : (
              renderTable()
            )}
          </div>
        </div>
      </div>

      {/* Modal for new leave request */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto scrollbar-hide">
            <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white z-10">
              <h3 className="text-lg font-medium">New Leave Request</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee Name *</label>
                <select
                  name="employeeName"
                  value={formData.employeeName}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">Select Employee</option>
                  {employees.map(employee => (
                    <option key={employee.id} value={employee.name}>{employee.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                <input
                  type="text"
                  name="employeeId"
                  value={formData.employeeId}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100 focus:outline-none"
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                <input
                  type="text"
                  name="designation"
                  value={formData.designation}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100 focus:outline-none"
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">HOD Name *</label>
                <select
                  name="hodName"
                  value={formData.hodName}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">Select HOD</option>
                  <option value="Deepak">Deepak</option>
                  <option value="Vikas">Vikas</option>
                  <option value="Dharam">Dharam</option>
                  <option value="Pratap">Pratap</option>
                  <option value="Aubhav">Aubhav</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type *</label>
                <select
                  name="leaveType"
                  value={formData.leaveType}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">Select Leave Type</option>
                  {leaveTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From Date *</label>
                  <input
                    type="date"
                    name="fromDate"
                    value={formData.fromDate}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To Date *</label>
                  <input
                    type="date"
                    name="toDate"
                    value={formData.toDate}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              {formData.fromDate && formData.toDate && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-800">
                    Total Days: <span className="font-semibold">{calculateDays(formData.fromDate, formData.toDate)}</span>
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                <textarea
                  name="reason"
                  value={formData.reason}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Please provide reason for leave..."
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700 min-h-[42px] flex items-center justify-center ${submitting ? 'opacity-75 cursor-not-allowed' : ''
                    }`}
                  disabled={submitting}
                >
                  {submitting ? (
                    <div className="flex items-center">
                      <svg
                        className="animate-spin h-4 w-4 text-white mr-2"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Submitting...</span>
                    </div>
                  ) : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveManagement;