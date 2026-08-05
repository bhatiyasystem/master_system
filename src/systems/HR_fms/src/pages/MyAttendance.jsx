import React, { useEffect, useState } from 'react';
import { Calendar, Clock, CheckCircle, XCircle } from 'lucide-react';

const MyAttendance = () => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState(null);
  const [attendanceData, setAttendanceData] = useState([]);
  const [userAttendanceData, setUserAttendanceData] = useState([]);

  // Get username from localStorage
  const getUsername = () => {
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        return parsedUser.username || parsedUser.Name || parsedUser.salesPersonName || '';
      }
      return '';
    } catch (error) {
      console.error('Error parsing user data from localStorage:', error);
      return '';
    }
  };

 const formatDOB = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString; // Return as-is if not a valid date
    }
    
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  };

  const fetchDataSheet = async () => {
    setLoading(true);
    setTableLoading(true);
    setError(null);

    try {
      const response = await fetch(
        'https://script.google.com/macros/s/AKfycbzF-ERpUfrb0figpapH5q5-J1KRAnBHt-OaXYrN9Cw4wzwaacKhUPwGgtCIWfxw2Ruz9g/exec?sheet=Data&action=fetch'
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Raw DATA API response:', result);

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch data from DATA sheet');
      }

      const rawData = result.data || result;

      if (!Array.isArray(rawData)) {
        throw new Error('Expected array data not received');
      }

      console.log('Raw data from sheet:', rawData);

      // Find the header row (look for "Date" column)
      let headerRowIndex = 0;
      for (let i = 0; i < rawData.length; i++) {
        if (rawData[i] && rawData[i].some(cell => cell && cell.toString().toLowerCase().includes('date'))) {
          headerRowIndex = i;
          break;
        }
      }

      console.log('Header row index:', headerRowIndex);

      // Get headers
      const headers = rawData[headerRowIndex].map(h => h?.toString().trim() || '');
      console.log('Headers:', headers);

      // Get data rows (skip header row)
      const dataRows = rawData.length > headerRowIndex + 1 ? rawData.slice(headerRowIndex + 1) : [];

      // Map data using header names - use display values directly
      const processedData = dataRows.map((row, index) => {
        const obj = {};
        headers.forEach((header, colIndex) => {
          // Keep the exact value as it appears in the sheet
          obj[header] = row[colIndex] !== undefined && row[colIndex] !== null ? row[colIndex].toString() : '';
        });
        return obj;
      });

      console.log('Processed DATA sheet:', processedData);

      // Save into state
      setAttendanceData(processedData);

    } catch (error) {
      console.error('Error fetching DATA sheet:', error);
      setError(error.message);
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  };

  // Filter attendance data for current user
  useEffect(() => {
    const username = getUsername();
    if (username && attendanceData.length > 0) {
      console.log('Filtering for username:', username);
      
      // Filter data to only show records where the name matches the username
      const filteredData = attendanceData.filter(record => {
        // Check all string values in the record for the username
        for (const key in record) {
          if (typeof record[key] === 'string' && 
              record[key].toLowerCase().includes(username.toLowerCase())) {
            return true;
          }
        }
        return false;
      });
      
      setUserAttendanceData(filteredData);
      console.log('Filtered attendance data:', filteredData);
    }
  }, [attendanceData]);

  useEffect(() => {
    fetchDataSheet();
  }, []);

  // Filter attendance by selected month and year from user-specific data
  const filteredAttendance = userAttendanceData.filter(record => {
    const dateValue = record.Date || record.date;
    if (!dateValue) return false;
    
    try {
      // Try to parse various date formats
      let recordDate;
      if (dateValue.includes('-')) {
        // Format: YYYY-MM-DD or similar
        const [year, month, day] = dateValue.split('-').map(Number);
        recordDate = new Date(year, month - 1, day);
      } else if (dateValue.includes('/')) {
        // Format: MM/DD/YYYY or similar
        const [month, day, year] = dateValue.split('/').map(Number);
        recordDate = new Date(year, month - 1, day);
      } else {
        return true; // Show records with unknown date formats
      }
      
      return recordDate.getMonth() === selectedMonth && recordDate.getFullYear() === selectedYear;
    } catch (error) {
      console.error('Error parsing date:', dateValue, error);
      return true; // Show records even if date parsing fails
    }
  });

  // Calculate statistics
  const totalDays = filteredAttendance.length;
  const presentDays = filteredAttendance.filter(record => 
    (record.In && record.In !== '' && record.In !== '-') || 
    (record.inTime && record.inTime !== '' && record.inTime !== '-')
  ).length;
  
  const absentDays = totalDays - presentDays;
  
  // Calculate working hours based on time strings
  const totalWorkingHours = filteredAttendance.reduce((sum, record) => {
    if (record.In && record.Out) {
      try {
        const inTime = parseTimeString(record.In);
        const outTime = parseTimeString(record.Out);
        
        if (inTime && outTime) {
          let hours = (outTime - inTime) / (1000 * 60 * 60);
          // Handle cases where out time might be next day (e.g., working past midnight)
          if (hours < 0) hours += 24;
          return sum + (hours > 0 ? hours : 0);
        }
      } catch (e) {
        console.log('Could not calculate hours from In/Out times:', e);
      }
    }
    return sum;
  }, 0);
  
  // Calculate overtime (assuming working hours > 8 is overtime)
  const totalOvertime = filteredAttendance.reduce((sum, record) => {
    if (record.In && record.Out) {
      try {
        const inTime = parseTimeString(record.In);
        const outTime = parseTimeString(record.Out);
        
        if (inTime && outTime) {
          let hours = (outTime - inTime) / (1000 * 60 * 60);
          if (hours < 0) hours += 24;
          return sum + Math.max(0, hours - 8);
        }
      } catch (e) {
        console.log('Could not calculate overtime from In/Out times');
      }
    }
    return sum;
  }, 0);

  // Helper function to parse time strings like "10:00:00 AM"
  const parseTimeString = (timeStr) => {
    if (!timeStr) return null;
    
    let cleanTime = timeStr.toString().trim();
    
    // Handle AM/PM format
    let isPM = false;
    if (cleanTime.toLowerCase().includes('pm')) {
      isPM = true;
      cleanTime = cleanTime.toLowerCase().replace('pm', '').trim();
    } else if (cleanTime.toLowerCase().includes('am')) {
      cleanTime = cleanTime.toLowerCase().replace('am', '').trim();
    }
    
    // Split by colon
    const parts = cleanTime.split(':');
    if (parts.length < 2) return null;
    
    let hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parts.length > 2 ? parseInt(parts[2], 10) : 0;
    
    // Adjust for PM
    if (isPM && hours < 12) hours += 12;
    if (!isPM && hours === 12) hours = 0; // 12 AM = 0 hours
    
    // Create a date object with fixed date and the parsed time
    return new Date(2000, 0, 1, hours, minutes, seconds);
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = [2023, 2024, 2025];

  // Determine status based on In time presence
  const getStatus = (record) => {
    if ((record.In && record.In !== '' && record.In !== '-') || 
        (record.inTime && record.inTime !== '' && record.inTime !== '-')) {
      return 'Present';
    }
    return 'Absent';
  };

  return (
    <div className="space-y-6 page-content p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">My Attendance</h1>
      </div>

      {/* Filter Section */}
      <div className="bg-white p-4 rounded-lg shadow border flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-4">
        <div className="flex items-center space-x-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {months.map((month, index) => (
                <option key={index} value={index}>{month}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white rounded-xl shadow-lg border p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 mr-4">
              <Calendar size={24} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 font-medium">Total Days</p>
              <h3 className="text-2xl font-bold text-gray-800">{totalDays}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg border p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 mr-4">
              <CheckCircle size={24} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 font-medium">Present Days</p>
              <h3 className="text-2xl font-bold text-gray-800">{presentDays}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg border p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-red-100 mr-4">
              <XCircle size={24} className="text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 font-medium">Absent Days</p>
              <h3 className="text-2xl font-bold text-gray-800">{absentDays}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg border p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-indigo-100 mr-4">
              <Clock size={24} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 font-medium">Working Hours</p>
              <h3 className="text-2xl font-bold text-gray-800">{totalWorkingHours.toFixed(1)}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg border p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-amber-100 mr-4">
              <Clock size={24} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 font-medium">Overtime Hours</p>
              <h3 className="text-2xl font-bold text-gray-800">{totalOvertime.toFixed(1)}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-lg shadow border overflow-hidden">
        <div className="p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            Attendance Records - {months[selectedMonth]} {selectedYear}
          </h2>
          {loading ? (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-500">Loading attendance data...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check In</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check Out</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Working Hours</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Overtime</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAttendance.map((record, index) => {
                    const status = getStatus(record);
                    let workingHours = 0;
                    let overtime = 0;

                    if (record.In && record.Out) {
                      try {
                        const inTime = parseTimeString(record.In);
                        const outTime = parseTimeString(record.Out);
                        
                        if (inTime && outTime) {
                          workingHours = (outTime - inTime) / (1000 * 60 * 60);
                          if (workingHours < 0) workingHours += 24;
                          workingHours = workingHours > 0 ? workingHours : 0;
                          overtime = Math.max(0, workingHours - 8);
                        }
                      } catch (e) {
                        console.log('Could not calculate hours from In/Out times');
                      }
                    }

                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDOB(record.Date) ||formatDOB(record.date) || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.In || record.inTime || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.Out || record.outTime || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            status === 'Present' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {workingHours.toFixed(1)} hrs
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {overtime.toFixed(1)} hrs
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredAttendance.length === 0 && !loading && (
                <div className="px-6 py-12 text-center">
                  <p className="text-gray-500">No attendance records found for the selected period.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyAttendance;