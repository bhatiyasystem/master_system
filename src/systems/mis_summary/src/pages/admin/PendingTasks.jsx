import React, { useState, useMemo } from 'react';
import { Search, Clock, X } from 'lucide-react';

// Employee data
const employees = [
  {
    id: 'emp-001',
    name: 'Pratap Kumar',
    email: 'pratap@company.com',
    image: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=600',
    department: 'Engineering',
    designation: 'CRM'
  },
  {
    id: 'emp-002',
    name: 'Chetan Sharma',
    email: 'chetan@company.com',
    image: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=600',
    department: 'Design',
    designation: 'PURCHASE'
  },
  {
    id: 'emp-003',
    name: 'Digendra Patel',
    email: 'digendra@company.com',
    image: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=600',
    department: 'Marketing',
    designation: 'HR'
  },
  {
    id: 'emp-004',
    name: 'Durgesh Gupta',
    email: 'durgesh@company.com',
    image: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=600',
    department: 'Sales',
    designation: 'EA'
  },
  {
    id: 'emp-005',
    name: 'Vikash Singh',
    email: 'vikash@company.com',
    image: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=600',
    department: 'Engineering',
    designation: 'ACCOUNTANT'
  },
  {
    id: 'emp-006',
    name: 'Anubhav Kumar',
    email: 'anubhav@company.com',
    image: 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=600',
    department: 'IT',
    designation: 'CRM'
  },
  {
    id: 'emp-007',
    name: 'Muzammil Ahmed',
    email: 'muzammil@company.com',
    image: 'https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=600',
    department: 'Operations',
    designation: 'PURCHASE'
  },
  {
    id: 'emp-008',
    name: 'Pooja Verma',
    email: 'pooja@company.com',
    image: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=600',
    department: 'HR',
    designation: 'HR'
  }
];

// Pending task data with employee references
const tasks = [
  {
    id: 'task-001',
    fmsName: 'Project Alpha',
    taskName: 'Frontend Development',
    assignedTo: 'emp-001',
    pendingTaskCount: 5,
    dueDate: '2025-10-15',
    actualDate: '2025-10-15',
    delayTime: '0000'
  },
  {
    id: 'task-002',
    fmsName: 'Project Beta',
    taskName: 'UI Design',
    assignedTo: 'emp-002',
    pendingTaskCount: 3,
    dueDate: '2025-10-14',
    actualDate: '',
    delayTime: '0000'
  },
  {
    id: 'task-003',
    fmsName: 'Project Gamma',
    taskName: 'Marketing Campaign',
    assignedTo: 'emp-003',
    pendingTaskCount: 8,
    dueDate: '2025-10-16',
    actualDate: '2025-10-18',
    delayTime: '02:30'
  },
  {
    id: 'task-004',
    fmsName: 'Project Delta',
    taskName: 'Sales Presentation',
    assignedTo: 'emp-004',
    pendingTaskCount: 2,
    dueDate: '2025-10-13',
    actualDate: '',
    delayTime: '01:15'
  },
  {
    id: 'task-005',
    fmsName: 'Project Epsilon',
    taskName: 'Backend Development',
    assignedTo: 'emp-005',
    pendingTaskCount: 12,
    dueDate: '2025-10-18',
    actualDate: '2025-10-18',
    delayTime: '0000'
  },
  {
    id: 'task-006',
    fmsName: 'Project Zeta',
    taskName: 'Quality Assurance',
    assignedTo: 'emp-006',
    pendingTaskCount: 7,
    dueDate: '2025-10-17',
    actualDate: '',
    delayTime: '0000'
  },
  {
    id: 'task-007',
    fmsName: 'Project Eta',
    taskName: 'Documentation',
    assignedTo: 'emp-007',
    pendingTaskCount: 4,
    dueDate: '2025-10-14',
    actualDate: '2025-10-15',
    delayTime: '00:45'
  },
  {
    id: 'task-008',
    fmsName: 'Project Theta',
    taskName: 'HR Process',
    assignedTo: 'emp-008',
    pendingTaskCount: 6,
    dueDate: '2025-10-15',
    actualDate: '2025-10-15',
    delayTime: '0000'
  },
  {
    id: 'task-009',
    fmsName: 'Checklist & Delegation',
    taskName: 'Checklist Task-Afroj Begam',
    assignedTo: 'emp-001',
    pendingTaskCount: 15,
    dueDate: '2025-10-20',
    actualDate: '',
    delayTime: '0000'
  },
  {
    id: 'task-010',
    fmsName: 'OTD V.2-HTML',
    taskName: 'Audit',
    assignedTo: 'emp-002',
    pendingTaskCount: 9,
    dueDate: '2025-10-19',
    actualDate: '2025-10-21',
    delayTime: '03:00'
  },
  {
    id: 'task-011',
    fmsName: 'Checklist & Delegation',
    taskName: 'Checklist Task-Amlan Dikshit',
    assignedTo: 'emp-003',
    pendingTaskCount: 11,
    dueDate: '2025-10-21',
    actualDate: '',
    delayTime: '0000'
  },
  {
    id: 'task-012',
    fmsName: 'OTD V.2-HTML',
    taskName: 'Billing',
    assignedTo: 'emp-004',
    pendingTaskCount: 10,
    dueDate: '2025-10-16',
    actualDate: '2025-10-16',
    delayTime: '0000'
  }
];

const AdminPendingTasks = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [personFilter, setPersonFilter] = useState('all');
  const [fmsFilter, setFmsFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeDrillDown, setActiveDrillDown] = useState(null);

  const handleRowClick = (task) => {
    // Generate dummy data based on count
    const rows = Array.from({ length: task.pendingTaskCount }, (_, i) => {
      const planned = new Date(Date.now() - Math.floor(Math.random() * 10000000000));
      const hasActual = Math.random() > 0.3;
      const actual = hasActual ? new Date(planned.getTime() + Math.floor(Math.random() * 172800000)) : null;
      const isDelay = Math.random() > 0.5;
      const delay = isDelay ? `${String(Math.floor(Math.random() * 10)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}` : '0000';

      return {
        id: `TD-${Math.floor(Math.random() * 10000)}`,
        description: `Pending Task for ${task.taskName} - ${i + 1}`,
        plannedDate: planned.toLocaleDateString(),
        actualDate: actual ? actual.toLocaleDateString() : '',
        delayTime: delay
      };
    });

    setActiveDrillDown({
      taskId: task.taskName,
      count: task.pendingTaskCount,
      rows,
      title: `Pending Tasks (${task.pendingTaskCount})`
    });
  };

  // Get employee by ID
  const getEmployee = (employeeId) => {
    return employees.find(emp => emp.id === employeeId);
  };

  // Enrich tasks with employee data
  const enrichedTasks = useMemo(() => {
    return tasks.map(task => {
      const employee = getEmployee(task.assignedTo);
      return {
        ...task,
        personName: employee?.name || 'Unknown',
        personImage: employee?.image || '',
        department: employee?.department || 'N/A'
      };
    });
  }, []);

  // Extract unique persons and FMS names
  const persons = useMemo(() => {
    const uniquePersons = [...new Set(enrichedTasks.map(task => task.personName))];
    return uniquePersons.sort();
  }, [enrichedTasks]);

  const fmsNames = useMemo(() => {
    const uniqueFMS = [...new Set(enrichedTasks.map(task => task.fmsName))];
    return uniqueFMS.sort();
  }, [enrichedTasks]);

  // Filter tasks based on all criteria
  const filteredTasks = useMemo(() => {
    return enrichedTasks.filter(task => {
      const matchesSearch =
        task.taskName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.personName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.fmsName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesPerson = personFilter === 'all' || task.personName === personFilter;
      const matchesFMS = fmsFilter === 'all' || task.fmsName === fmsFilter;

      let matchesStatus = true;
      if (statusFilter === 'ontime') matchesStatus = task.delayTime === '0000';
      if (statusFilter === 'pending') matchesStatus = task.actualDate === '';
      if (statusFilter === 'delay') matchesStatus = task.delayTime !== '0000';

      return matchesSearch && matchesPerson && matchesFMS && matchesStatus;
    });
  }, [enrichedTasks, searchQuery, personFilter, fmsFilter, statusFilter]);

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Search and Filter Bar */}
        <div className="bg-white rounded shadow-sm p-4 mb-4">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search Input */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Person Filter */}
            <div className="w-full md:w-56">
              <select
                value={personFilter}
                onChange={(e) => setPersonFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 appearance-none bg-white"
              >
                <option value="all">All Persons</option>
                {persons.map(person => (
                  <option key={person} value={person}>{person}</option>
                ))}
              </select>
            </div>

            {/* FMS Name Filter */}
            <div className="w-full md:w-56">
              <select
                value={fmsFilter}
                onChange={(e) => setFmsFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 appearance-none bg-white"
              >
                <option value="all">All FMS Names</option>
                {fmsNames.map(fms => (
                  <option key={fms} value={fms}>{fms}</option>
                ))}
              </select>
            </div>
          </div>
        </div>


        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Total Persons Card */}
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Persons</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {personFilter === 'all'
                    ? persons.length
                    : 1
                  }
                </p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Total FMS Names Card */}
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total FMS Names</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {[...new Set(filteredTasks.map(task => task.fmsName))].length}
                </p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Total Task Names Card */}
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Task Names</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {[...new Set(filteredTasks.map(task => task.taskName))].length}
                </p>
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

          {/* Total Pending Tasks Card */}
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Pending Tasks</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {filteredTasks.reduce((total, task) => total + task.pendingTaskCount, 0)}
                </p>
              </div>
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </div>
        </div>
        {/* Tasks List */}
        <div className="bg-white rounded shadow-sm">
          {/* Section Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-base font-semibold text-gray-700">Pending Tasks</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${statusFilter === 'all' ? 'bg-gray-800 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('ontime')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${statusFilter === 'ontime' ? 'bg-green-600 text-white shadow-sm' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
              >
                On Time
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${statusFilter === 'pending' ? 'bg-red-600 text-white shadow-sm' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
              >
                Pending
              </button>
              <button
                onClick={() => setStatusFilter('delay')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${statusFilter === 'delay' ? 'bg-orange-600 text-white shadow-sm' : 'bg-orange-50 text-orange-700 hover:bg-orange-100'}`}
              >
                Delay
              </button>
            </div>
          </div>

          {filteredTasks.length > 0 ? (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Employee ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Link with Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        FMS Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Task Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Due Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actual
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Delay
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Pending Tasks
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredTasks.map(task => {
                      const isDelay = task.delayTime !== '0000';
                      const isPending = task.actualDate === '';
                      const isOnTime = task.delayTime === '0000' && !isPending;

                      let rowBg = 'hover:bg-blue-50';
                      if (isDelay) rowBg = 'bg-orange-50 hover:bg-orange-100';
                      else if (isPending) rowBg = 'bg-red-50 hover:bg-red-100';
                      else if (isOnTime) rowBg = 'bg-green-50 hover:bg-green-100';

                      return (
                        <tr key={task.id} className={`${rowBg} cursor-pointer transition-colors`} onClick={() => handleRowClick(task)}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {task.assignedTo}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <img
                                src={task.personImage}
                                alt={task.personName}
                                className="w-8 h-8 rounded-full object-cover mr-3"
                              />
                              <span className="text-sm text-gray-900">{task.personName}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {task.fmsName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {task.taskName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {formatDate(task.dueDate)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {task.actualDate || '-'}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isDelay ? 'text-orange-600' : 'text-gray-900'}`}>
                            {task.delayTime}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white border border-gray-200 text-gray-800 shadow-sm">
                              {task.pendingTaskCount}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-gray-200">
                {filteredTasks.map(task => {
                  const isDelay = task.delayTime !== '0000';
                  const isPending = task.actualDate === '';
                  const isOnTime = task.delayTime === '0000' && !isPending;

                  let rowBg = '';
                  if (isDelay) rowBg = 'bg-orange-50';
                  else if (isPending) rowBg = 'bg-red-50';
                  else if (isOnTime) rowBg = 'bg-green-50';

                  return (
                    <div key={task.id} className={`p-4 ${rowBg} hover:bg-opacity-80 cursor-pointer transition-colors border-b border-gray-100`} onClick={() => handleRowClick(task)}>
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center flex-1">
                          <img
                            src={task.personImage}
                            alt={task.personName}
                            className="w-10 h-10 rounded-full object-cover mr-3"
                          />
                          <div className="flex-1">
                            <div className="text-xs text-gray-500 mb-1">
                              ID: {task.assignedTo}
                            </div>
                            <div className="text-sm font-medium text-gray-900">{task.personName}</div>
                          </div>
                        </div>
                        <div className="ml-4 text-right">
                          <div className="text-xs text-gray-500 mb-1">Pending</div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white border border-gray-200 text-gray-800">
                            {task.pendingTaskCount}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-2">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">FMS Name</div>
                          <div className="text-sm text-gray-900">{task.fmsName}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Task Name</div>
                          <div className="text-sm text-gray-900">{task.taskName}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Due Date</div>
                          <div className="text-sm text-gray-600">{formatDate(task.dueDate)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Actual</div>
                          <div className="text-sm text-gray-900">{task.actualDate || '-'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Delay</div>
                          <div className={`text-sm font-medium ${isDelay ? 'text-orange-600' : 'text-gray-900'}`}>{task.delayTime}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="text-center py-12 px-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
                <Clock className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-base font-medium text-gray-900 mb-2">
                No Pending Tasks Found
              </h3>
              <p className="text-sm text-gray-500">
                Try adjusting your filters or search query
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Drill Down Modal */}
      {activeDrillDown && (
        <div className="fixed inset-0 bg-black bg-opacity-25 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-fadeIn border-2 border-gray-100">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {activeDrillDown.title}
                </h3>
                <p className="text-sm text-gray-500">
                  {activeDrillDown.taskId}
                </p>
              </div>
              <button
                onClick={() => setActiveDrillDown(null)}
                className="p-1 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-0">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Planned</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actual</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delay</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {activeDrillDown.rows.map((row, idx) => {
                    const isDelay = row.delayTime !== '0000';
                    const isPending = row.actualDate === '';
                    const isOnTime = row.delayTime === '0000' && !isPending;

                    let rowBg = '';
                    if (isDelay) rowBg = 'bg-orange-50';
                    else if (isPending) rowBg = 'bg-red-50';
                    else if (isOnTime) rowBg = 'bg-green-50';

                    return (
                      <tr key={idx} className={`${rowBg} hover:bg-opacity-80 transition-colors`}>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">{row.plannedDate}</td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">{row.actualDate || '-'}</td>
                        <td className={`px-6 py-3 whitespace-nowrap text-sm font-medium ${isDelay ? 'text-orange-600' : 'text-gray-900'}`}>
                          {row.delayTime}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-3 border-t border-gray-200 bg-gray-50 rounded-b-lg flex justify-end">
              <button
                onClick={() => setActiveDrillDown(null)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPendingTasks;