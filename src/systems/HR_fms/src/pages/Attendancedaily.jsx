import React, { useEffect, useState } from 'react';
import { Search, Download } from 'lucide-react';

const Attendancedaily = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAttendanceData = async () => {
    setLoading(true);
    setTableLoading(true);
    setError(null);

    try {
      const response = await fetch(
        'https://script.google.com/macros/s/AKfycbzF-ERpUfrb0figpapH5q5-J1KRAnBHt-OaXYrN9Cw4wzwaacKhUPwGgtCIWfxw2Ruz9g/exec?sheet=Report Daily&action=fetch'
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Raw Report Daily API response:', result);

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch data from Report Daily sheet');
      }

      const rawData = result.data || result;

      if (!Array.isArray(rawData)) {
        throw new Error('Expected array data not received');
      }

      // Process data - assuming first row contains headers
      const headers = rawData[0]; // First row as headers
      const dataRows = rawData.length > 1 ? rawData.slice(1) : [];

      const processedData = dataRows.map((row) => ({
        year: row[0] || '', // Column A (index-0)
        monthName: row[1] || '', // Column B (index-1)
        date: row[2] || '', // Column C (index-2)
        day: row[3] || '', // Column D (index-3)
        companyName: row[4] || '', // Column E (index-4)
        empIdCode: row[5] || '', // Column F (index-5)
        name: row[6] || '', // Column G (index-6)
        designation: row[7] || '', // Column H (index-7)
        holiday: row[8] || '', // Column I (index-8)
        workingDay: row[9] || '', // Column J (index-9)
        nHoliday: row[10] || '', // Column K (index-10)
        status: row[11] || '', // Column L (index-11)
        inTime: row[12] || '', // Column M (index-12)
        outTime: row[13] || '', // Column N (index-13)
        workingHours: row[14] || '', // Column O (index-14)
        lateMinutes: row[15] || '', // Column P (index-15)
        earlyOut: row[16] || '', // Column Q (index-16)
        overtimeHours: row[17] || '', // Column R (index-17)
        punchMiss: row[18] || '', // Column S (index-18)
        remarks: row[19] || '', // Column T (index-19)
      }));

      console.log('Processed attendance data:', processedData);
      setAttendanceData(processedData);

    } catch (error) {
      console.error('Error fetching Report Daily data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceData();
  }, []);

  // Filter data based on search term and date range
  const filteredData = attendanceData.filter(item => {
    // Text search filter - now includes additional columns
    const matchesSearch = 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.empIdCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.year.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.monthName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.day.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.companyName.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Date range filter
    let matchesDateRange = true;
    if (startDate || endDate) {
      const itemDate = new Date(item.date);
      
      if (startDate) {
        const start = new Date(startDate);
        if (itemDate < start) matchesDateRange = false;
      }
      
      if (endDate && matchesDateRange) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Include the entire end date
        if (itemDate > end) matchesDateRange = false;
      }
    }
    
    return matchesSearch && matchesDateRange;
  });

  // Download CSV function
  const downloadCSV = () => {
    if (filteredData.length === 0) return;
    
    // Define CSV headers
    const headers = [
      'Year', 'Month Name', 'Date', 'Day', 'Company Name', 'Emp ID Code', 
      'Name', 'Designation', 'Holiday (Yes/No)', 'Working Day (Yes/No)', 
      'N-Holiday (Holiday Name)', 'Status', 'In Time', 'Out Time', 
      'Working Hours', 'Late Minutes', 'Early Out', 'Overtime Hours', 
      'Punch Miss', 'Remarks'
    ];
    
    // Convert data to CSV format
    const csvData = filteredData.map(item => [
      item.year, item.monthName, item.date, item.day, item.companyName,
      item.empIdCode, item.name, item.designation, item.holiday, item.workingDay,
      item.nHoliday, item.status, item.inTime, item.outTime, item.workingHours,
      item.lateMinutes, item.earlyOut, item.overtimeHours, item.punchMiss, item.remarks
    ]);
    
    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_data_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 ml-50 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Attendance Records Daily</h1>
      </div>

      {/* Filters Section */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search Bar */}
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
            </div>
          </div>
          
          {/* Date Range Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          
          {/* Download Button */}
          <div className="flex items-end">
            <button
              onClick={downloadCSV}
              disabled={filteredData.length === 0}
              className={`flex items-center px-4 py-2 rounded-lg ${filteredData.length === 0 
                ? 'bg-gray-300 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
            >
              <Download size={18} className="mr-2" />
              Download
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Day</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Emp ID Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Designation</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Holiday (Yes/No)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Working Day (Yes/No)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">N-Holiday</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">In Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Out Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Working Hours</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Late Minutes</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Early Out</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Overtime Hours</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Punch Miss</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remarks</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tableLoading ? (
                  <tr>
                    <td colSpan="20" className="px-6 py-12 text-center">
                      <div className="flex justify-center flex-col items-center">
                        <div className="w-6 h-6 border-4 border-indigo-500 border-dashed rounded-full animate-spin mb-2"></div>
                        <span className="text-gray-600 text-sm">Loading attendance data...</span>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan="20" className="px-6 py-12 text-center">
                      <p className="text-red-500">Error: {error}</p>
                      <button
                        onClick={fetchAttendanceData}
                        className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                      >
                        Retry
                      </button>
                    </td>
                  </tr>
                ) : filteredData.length > 0 ? (
                  filteredData.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.year}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.monthName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.date}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.day}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.companyName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.empIdCode}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.designation}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.holiday}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.workingDay}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.nHoliday}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.status}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.inTime}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.outTime}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.workingHours}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.lateMinutes}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.earlyOut}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.overtimeHours}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.punchMiss}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.remarks}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="20" className="px-6 py-12 text-center">
                      <p className="text-gray-500">No attendance records found.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Attendancedaily;