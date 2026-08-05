import React, { useState } from 'react';
import { Search, Download, Filter, Calendar, Clock, UserCheck, UserX, BarChart3, MessageCircle } from 'lucide-react';

const Report = () => {
  const [activeReport, setActiveReport] = useState('attendanceDayEnd');
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });
  const [filters, setFilters] = useState({
    department: '',
    employee: ''
  });

  const reportHeaders = {
    attendanceDayEnd: 'Attendance Day End Report',
    attendanceAnalysis: 'Attendance Analysis Report',
    monthlyAttendance: 'Monthly Attendance Report',
    whatsappDayEnd: 'WhatsApp Day End Report',
    leaveReport: 'Leave Report',
    lateCutoff: 'Late & Early Cutoff Report',
    overtimeReport: 'Overtime Report'
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setDateRange(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const renderReportContent = () => {
    // This would be replaced with actual data fetching and rendering logic
    switch (activeReport) {
      case 'attendanceDayEnd':
        return (
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Attendance Day End Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <UserCheck className="text-blue-600 mr-2" size={20} />
                  <span className="text-sm font-medium">Present Today</span>
                </div>
                <p className="text-2xl font-bold mt-2">142</p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <Clock className="text-yellow-600 mr-2" size={20} />
                  <span className="text-sm font-medium">Late Arrivals</span>
                </div>
                <p className="text-2xl font-bold mt-2">8</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <UserX className="text-red-600 mr-2" size={20} />
                  <span className="text-sm font-medium">Absent Today</span>
                </div>
                <p className="text-2xl font-bold mt-2">15</p>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check-In</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check-Out</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">EMP001</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">John Doe</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">09:05 AM</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">06:15 PM</td>
                    <td className="px-6 py-4 whitespace-nowrap"><span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Present</span></td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">EMP002</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Jane Smith</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">09:25 AM</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">06:05 PM</td>
                    <td className="px-6 py-4 whitespace-nowrap"><span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Late</span></td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">EMP003</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Robert Johnson</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">-</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">-</td>
                    <td className="px-6 py-4 whitespace-nowrap"><span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Absent</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'attendanceAnalysis':
        return (
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Attendance Analysis Overview</h3>
            <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-medium">Attendance Trends</h4>
                <div className="flex space-x-2">
                  <span className="text-sm px-2 py-1 bg-blue-100 text-blue-800 rounded">This Week</span>
                  <span className="text-sm px-2 py-1 bg-gray-100 text-gray-800 rounded">This Month</span>
                </div>
              </div>
              <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                <BarChart3 size={48} className="text-gray-400" />
                <span className="ml-2 text-gray-500">Attendance chart visualization</span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h4 className="font-medium mb-3">Top Departments by Attendance</h4>
                <ul>
                  <li className="flex justify-between py-2 border-b border-gray-100">
                    <span>Engineering</span>
                    <span className="font-medium">96%</span>
                  </li>
                  <li className="flex justify-between py-2 border-b border-gray-100">
                    <span>Sales</span>
                    <span className="font-medium">92%</span>
                  </li>
                  <li className="flex justify-between py-2 border-b border-gray-100">
                    <span>Marketing</span>
                    <span className="font-medium">89%</span>
                  </li>
                </ul>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h4 className="font-medium mb-3">Frequent Late Arrivals</h4>
                <ul>
                  <li className="flex justify-between py-2 border-b border-gray-100">
                    <span>Michael Brown</span>
                    <span className="font-medium">8 times</span>
                  </li>
                  <li className="flex justify-between py-2 border-b border-gray-100">
                    <span>Sarah Wilson</span>
                    <span className="font-medium">6 times</span>
                  </li>
                  <li className="flex justify-between py-2 border-b border-gray-100">
                    <span>David Lee</span>
                    <span className="font-medium">5 times</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        );
      case 'monthlyAttendance':
        return (
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Monthly Attendance Summary</h3>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Days</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Present</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Absent</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leaves</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Late Days</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">John Doe</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">22</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">20</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">1</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">1</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">2</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Jane Smith</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">22</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">19</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">0</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">3</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">5</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'whatsappDayEnd':
        return (
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">WhatsApp Day End Report</h3>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sent Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Response</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">John Doe</td>
                    <td className="px-6 py-4 whitespace-nowrap"><span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Delivered</span></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">06:15 PM</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Acknowledged</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Jane Smith</td>
                    <td className="px-6 py-4 whitespace-nowrap"><span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Pending</span></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">06:15 PM</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">-</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center mb-2">
                <MessageCircle className="text-blue-600 mr-2" size={20} />
                <h4 className="font-medium">Message Statistics</h4>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm">Total Messages Sent</p>
                  <p className="text-xl font-bold">142</p>
                </div>
                <div>
                  <p className="text-sm">Acknowledgements Received</p>
                  <p className="text-xl font-bold">128 (90%)</p>
                </div>
              </div>
            </div>
          </div>
        );
      case 'leaveReport':
        return (
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Leave Report</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <Calendar className="text-blue-600 mr-2" size={20} />
                  <span className="text-sm font-medium">Total Leave Requests</span>
                </div>
                <p className="text-2xl font-bold mt-2">24</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <Calendar className="text-green-600 mr-2" size={20} />
                  <span className="text-sm font-medium">Approved Leaves</span>
                </div>
                <p className="text-2xl font-bold mt-2">18</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <Calendar className="text-red-600 mr-2" size={20} />
                  <span className="text-sm font-medium">Rejected Leaves</span>
                </div>
                <p className="text-2xl font-bold mt-2">3</p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <Calendar className="text-yellow-600 mr-2" size={20} />
                  <span className="text-sm font-medium">Pending Leaves</span>
                </div>
                <p className="text-2xl font-bold mt-2">3</p>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leave Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">John Doe</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Sick Leave</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">15/09/2023</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">16/09/2023</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">2</td>
                    <td className="px-6 py-4 whitespace-nowrap"><span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Approved</span></td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Jane Smith</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Annual Leave</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">20/09/2023</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">22/09/2023</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">3</td>
                    <td className="px-6 py-4 whitespace-nowrap"><span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Pending</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'lateCutoff':
        return (
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Late & Early Cutoff Report</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h4 className="font-medium mb-4 flex items-center">
                  <Clock className="text-red-500 mr-2" size={20} />
                  Late Arrivals Today
                </h4>
                <ul className="divide-y divide-gray-100">
                  <li className="py-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium">John Doe</p>
                      <p className="text-sm text-gray-500">EMP001</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-red-600">09:25 AM</p>
                      <p className="text-sm text-gray-500">25 mins late</p>
                    </div>
                  </li>
                  <li className="py-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium">Jane Smith</p>
                      <p className="text-sm text-gray-500">EMP002</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-red-600">09:35 AM</p>
                      <p className="text-sm text-gray-500">35 mins late</p>
                    </div>
                  </li>
                </ul>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h4 className="font-medium mb-4 flex items-center">
                  <Clock className="text-orange-500 mr-2" size={20} />
                  Early Departures Today
                </h4>
                <ul className="divide-y divide-gray-100">
                  <li className="py-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium">Robert Johnson</p>
                      <p className="text-sm text-gray-500">EMP003</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-orange-600">05:15 PM</p>
                      <p className="text-sm text-gray-500">45 mins early</p>
                    </div>
                  </li>
                  <li className="py-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium">Sarah Wilson</p>
                      <p className="text-sm text-gray-500">EMP004</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-orange-600">05:25 PM</p>
                      <p className="text-sm text-gray-500">35 mins early</p>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        );
      case 'overtimeReport':
        return (
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Overtime Report</h3>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-6">
              <div className="flex items-center mb-2">
                <Clock className="text-blue-600 mr-2" size={20} />
                <h4 className="font-medium">Overtime Summary</h4>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm">Total Overtime Hours</p>
                  <p className="text-xl font-bold">42.5 hrs</p>
                </div>
                <div>
                  <p className="text-sm">Employees with OT</p>
                  <p className="text-xl font-bold">18</p>
                </div>
                <div>
                  <p className="text-sm">Average OT/Employee</p>
                  <p className="text-xl font-bold">2.36 hrs</p>
                </div>
                <div>
                  <p className="text-sm">Highest OT</p>
                  <p className="text-xl font-bold">8.5 hrs</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Regular Hours</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Overtime Hours</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Hours</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">John Doe</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">15/09/2023</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">8.0</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">2.5</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">10.5</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Jane Smith</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">16/09/2023</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">8.0</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">3.0</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">11.0</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      default:
        return <div className="p-6">Select a report to view details</div>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reports Dashboard</h1>
        <div className="flex items-center space-x-4">
          <button className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
            <Download size={18} className="mr-2" />
            Export
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div className="flex flex-1 max-w-md">
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Search reports..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2">
          <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2">
            <Calendar size={18} className="text-gray-400 mr-2" />
            <input
              type="date"
              name="start"
              value={dateRange.start}
              onChange={handleDateChange}
              className="border-none focus:outline-none text-sm"
            />
            <span className="mx-2 text-gray-400">to</span>
            <input
              type="date"
              name="end"
              value={dateRange.end}
              onChange={handleDateChange}
              className="border-none focus:outline-none text-sm"
            />
          </div>
          
          <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2">
            <Filter size={18} className="text-gray-400 mr-2" />
            <select
              name="department"
              value={filters.department}
              onChange={handleFilterChange}
              className="border-none focus:outline-none text-sm bg-transparent"
            >
              <option value="">All Departments</option>
              <option value="engineering">Engineering</option>
              <option value="sales">Sales</option>
              <option value="marketing">Marketing</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex flex-wrap -mb-px">
            <button
              onClick={() => setActiveReport('attendanceDayEnd')}
              className={`py-4 px-4 text-center font-medium text-sm ${
                activeReport === 'attendanceDayEnd' 
                  ? 'border-b-2 border-indigo-500 text-indigo-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Attendance Day End
            </button>
            <button
              onClick={() => setActiveReport('attendanceAnalysis')}
              className={`py-4 px-4 text-center font-medium text-sm ${
                activeReport === 'attendanceAnalysis' 
                  ? 'border-b-2 border-indigo-500 text-indigo-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Attendance Analysis
            </button>
            <button
              onClick={() => setActiveReport('monthlyAttendance')}
              className={`py-4 px-4 text-center font-medium text-sm ${
                activeReport === 'monthlyAttendance' 
                  ? 'border-b-2 border-indigo-500 text-indigo-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Monthly Attendance
            </button>
            <button
              onClick={() => setActiveReport('whatsappDayEnd')}
              className={`py-4 px-4 text-center font-medium text-sm ${
                activeReport === 'whatsappDayEnd' 
                  ? 'border-b-2 border-indigo-500 text-indigo-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              WhatsApp Day End
            </button>
            <button
              onClick={() => setActiveReport('leaveReport')}
              className={`py-4 px-4 text-center font-medium text-sm ${
                activeReport === 'leaveReport' 
                  ? 'border-b-2 border-indigo-500 text-indigo-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Leave Report
            </button>
            <button
              onClick={() => setActiveReport('lateCutoff')}
              className={`py-4 px-4 text-center font-medium text-sm ${
                activeReport === 'lateCutoff' 
                  ? 'border-b-2 border-indigo-500 text-indigo-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Late/Early Cutoff
            </button>
            <button
              onClick={() => setActiveReport('overtimeReport')}
              className={`py-4 px-4 text-center font-medium text-sm ${
                activeReport === 'overtimeReport' 
                  ? 'border-b-2 border-indigo-500 text-indigo-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Overtime Report
            </button>
          </nav>
        </div>

        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">{reportHeaders[activeReport]}</h2>
        </div>

        <div className="overflow-x-auto">
          {renderReportContent()}
        </div>
      </div>
    </div>
  );
};

export default Report;