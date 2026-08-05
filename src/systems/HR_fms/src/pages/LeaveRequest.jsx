import React, { useEffect, useState } from 'react';
import { Plus, X, Calendar, Clock, CheckCircle, AlertCircle, Filter, Search } from 'lucide-react';
import useAuthStore from '../store/authStore';
import useDataStore from '../store/dataStore';
import toast from 'react-hot-toast';

const LeaveRequest = () => {
  const employeeId = localStorage.getItem("employeeId");
  const rawUser = localStorage.getItem("user");
  const user = rawUser ? JSON.parse(rawUser) : {}; 
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [leavesData, setLeavesData] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [employees, setEmployees] = useState([]);
  const [formData, setFormData] = useState({
    employeeId: employeeId,
    employeeName: user.Name || '',
    designation: user.Designation || '',
    hodName: '',
    leaveType: '',
    fromDate: '',
    toDate: '',
    reason: ''
  });

  const fetchEmployeeData = async () => {
  try {
    const response = await fetch(
      'https://script.google.com/macros/s/AKfycbw4owzmbghov5H20X2JiuOTiz4lH-jtHZQyPRuMPeO-iZQfD0EGdmgDfk9F2HdZjO9l/exec?sheet=JOINING&action=fetch'
    );
    
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

    // Find the employee data based on employeeId
    const employeeRow = rawData.find(row => 
      row[1]?.toString().trim() === employeeId?.toString().trim()
    );
    
    if (employeeRow) {
      // Column I (index 8) contains designation
      const designation = employeeRow[8] || '';
      setFormData(prev => ({
        ...prev,
        designation: designation
      }));
    }
  } catch (error) {
    console.error('Error fetching employee data:', error);
  }
};

// Call this function in useEffect
useEffect(() => {
  fetchLeaveData();
  fetchEmployeeData(); // Add this line
}, []);

  // Fetch employees from JOINING sheet
  const fetchEmployees = async () => {
    try {
      const response = await fetch(
        'https://script.google.com/macros/s/AKfycbw4owzmbghov5H20X2JiuOTiz4lH-jtHZQyPRuMPeO-iZQfD0EGdmgDfk9F2HdZjO9l/exec?sheet=JOINING&action=fetch'
      );
      
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleMonthChange = (e) => {
    setSelectedMonth(e.target.value);
  };

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

  // Function to parse date string in DD/MM/YYYY format
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    
    // Handle different date formats that might come from the API
    if (dateStr.includes('/')) {
      const [day, month, year] = dateStr.split('/').map(Number);
      return new Date(year, month - 1, day);
    } else if (dateStr.includes('-')) {
      return new Date(dateStr);
    }
    
    return null;
  };

  // Check if a date falls within a specific month
  const isDateInMonth = (dateStr, monthIndex) => {
    if (!dateStr || monthIndex === 'all') return true;
    
    const date = parseDate(dateStr);
    if (!date) return false;
    
    return date.getMonth() === parseInt(monthIndex);
  };

  const fetchLeaveData = async () => {
    setLoading(true);
    setTableLoading(true);
    setError(null);

    try {
      const response = await fetch(
        'https://script.google.com/macros/s/AKfycbw4owzmbghov5H20X2JiuOTiz4lH-jtHZQyPRuMPeO-iZQfD0EGdmgDfk9F2HdZjO9l/exec?sheet=Leave Management&action=fetch'
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch leave data');
      }
      
      const rawData = result.data || result;
      console.log("Raw data from API:", rawData);
      
      if (!Array.isArray(rawData)) {
        throw new Error('Expected array data not received');
      }

      const dataRows = rawData.length > 1 ? rawData.slice(1) : [];
      
      // Process and filter data by employee name
      const processedData = dataRows
        .map((row, index) => ({
          id: index + 1,
          timestamp: row[0] || '',
          serialNo: row[1] || '',
          employeeId: row[2] || '',
          employeeName: row[3] || '',
          startDate: row[4] || '',
          endDate: row[5] || '',
          reason: row[6] || '',
          days: calculateDays(row[4], row[5]),
          status: row[7] || 'Pending',
          leaveType: row[8] || '',
          appliedDate: row[0] || '', // Using timestamp as applied date
          approvedBy: row[9] || '', // Adjust index if needed
        }))
        .filter(item => item.employeeName === user.Name);
      
      console.log("Filtered leave data:", processedData);
      setLeavesData(processedData);
     
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
  }, []);

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

      const response = await fetch('https://script.google.com/macros/s/AKfycbw4owzmbghov5H20X2JiuOTiz4lH-jtHZQyPRuMPeO-iZQfD0EGdmgDfk9F2HdZjO9l/exec', {
        method: 'POST',
        body: new URLSearchParams({
          sheetName: 'Leave Management',
          action: 'insert',
          rowData: JSON.stringify(rowData),
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Leave Request submitted successfully!');
        setFormData({
          employeeId: employeeId,
          employeeName: user.Name || '',
          designation: user.Designation || '',
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

  const leaveTypes = [
    'Casual Leave',
    'Earned Leave',
    'Normal Leave',
  ];

  // Calculate leave balance based on approved leaves for the specific employee
  const calculateLeaveBalance = () => {
    // Filter for approved leaves for this specific employee
    const approvedLeaves = leavesData.filter(leave => 
      leave.status && leave.status.toLowerCase() === 'approved' && 
      leave.employeeName === user.Name &&
      (selectedMonth === 'all' || 
       isDateInMonth(leave.startDate, selectedMonth) || 
       isDateInMonth(leave.endDate, selectedMonth))
    );
    
    return {
      'Casual Leave': 7 - approvedLeaves
        .filter(leave => leave.leaveType === 'Casual Leave')
        .reduce((sum, leave) => sum + (leave.days || 0), 0),
      'Earned Leave': 15 - approvedLeaves
        .filter(leave => leave.leaveType === 'Earned Leave')
        .reduce((sum, leave) => sum + (leave.days || 0), 0),
      'Normal Leave': 10 - approvedLeaves
        .filter(leave => leave.leaveType === 'Normal Leave')
        .reduce((sum, leave) => sum + (leave.days || 0), 0),
    };
  };

  // Calculate approved leave counts for each type for this employee
  const calculateApprovedLeaveCounts = () => {
    const approvedLeaves = leavesData.filter(leave => 
      leave.status && leave.status.toLowerCase() === 'approved' && 
      leave.employeeName === user.Name &&
      (selectedMonth === 'all' || 
       isDateInMonth(leave.startDate, selectedMonth) || 
       isDateInMonth(leave.endDate, selectedMonth))
    );
    
    return {
      'Casual Leave': approvedLeaves
        .filter(leave => leave.leaveType === 'Casual Leave')
        .reduce((sum, leave) => sum + (leave.days || 0), 0),
      'Earned Leave': approvedLeaves
        .filter(leave => leave.leaveType === 'Earned Leave')
        .reduce((sum, leave) => sum + (leave.days || 0), 0),
      'Normal Leave': approvedLeaves
        .filter(leave => leave.leaveType === 'Normal Leave')
        .reduce((sum, leave) => sum + (leave.days || 0), 0),
    };
  };

  const leaveBalance = calculateLeaveBalance();
  const approvedCounts = calculateApprovedLeaveCounts();

  // Generate month options for the dropdown
  const monthOptions = [
    { value: 'all', label: 'All Months' },
    { value: '0', label: 'January' },
    { value: '1', label: 'February' },
    { value: '2', label: 'March' },
    { value: '3', label: 'April' },
    { value: '4', label: 'May' },
    { value: '5', label: 'June' },
    { value: '6', label: 'July' },
    { value: '7', label: 'August' },
    { value: '8', label: 'September' },
    { value: '9', label: 'October' },
    { value: '10', label: 'November' },
    { value: '11', label: 'December' }
  ];

  return (
    <div className="space-y-6 page-content p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Leave Request</h1>
        <button 
          onClick={() => setShowModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus size={16} className="mr-2" />
          New Leave Request
        </button>
      </div>

      {/* Month Filter */}
      <div className="bg-white rounded-lg shadow border p-4">
        <div className="flex items-center">
          <Filter size={18} className="text-gray-500 mr-2" />
          <label htmlFor="monthFilter" className="text-sm font-medium text-gray-700 mr-3">
            Filter by Month:
          </label>
          <select
            id="monthFilter"
            value={selectedMonth}
            onChange={handleMonthChange}
            className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {monthOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Leave Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(leaveBalance).map(([leaveType, remaining]) => {
          const total = 
            leaveType === 'Casual Leave' ? 7 :
            leaveType === 'Earned Leave' ? 15 : 10;
          
          const used = approvedCounts[leaveType];
          const percentage = total > 0 ? (used / total) * 100 : 0;
          
          return (
            <div key={leaveType} className="bg-white rounded-xl shadow-lg border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">{leaveType}</p>
                  <h3 className="text-2xl font-bold text-gray-800">{used}</h3>
                  <p className="text-xs text-gray-500">
                    {used} of {total} days used
                  </p>
                  <p className="text-xs text-indigo-600 font-medium mt-1">
                    {remaining} day{remaining !== 1 ? 's' : ''} remaining
                  </p>
                </div>
                <div className="p-3 rounded-full bg-indigo-100">
                  <Calendar size={24} className="text-indigo-600" />
                </div>
              </div>
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-indigo-600 h-2 rounded-full" 
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Leave Requests Table */}
      <div className="bg-white rounded-lg shadow border overflow-hidden">
        <div className="p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">My Leave Requests</h2>
          {tableLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leave Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applied Date</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {leavesData
                    .filter(leave => 
                      selectedMonth === 'all' || 
                      isDateInMonth(leave.startDate, selectedMonth) || 
                      isDateInMonth(leave.endDate, selectedMonth)
                    )
                    .map((request) => (
                    <tr key={request.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{request.leaveType}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {request.startDate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {request.endDate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{request.days}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">{request.reason}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          request.status === 'approved' 
                            ? 'bg-green-100 text-green-800' 
                            : request.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {request.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {request.appliedDate}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {leavesData.length === 0 && (
                <div className="px-6 py-12 text-center">
                  <p className="text-gray-500">No leave requests found.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal for new leave request - Updated to match LeaveManagement */}
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
                <input
                  type="text"
                  name="employeeName"
                  value={formData.employeeName}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100 focus:outline-none"
                  readOnly
                />
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
                  className={`px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700 min-h-[42px] flex items-center justify-center ${
                    submitting ? 'opacity-75 cursor-not-allowed' : ''
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

export default LeaveRequest;