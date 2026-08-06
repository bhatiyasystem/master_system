import { Search, Clock, CheckCircle, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { supabaseFetchSheet, supabaseMutateSheet } from '../../../../services/supabaseApiAdapter';

const Leaving = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [_loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    dateOfLeaving: '',
    mobileNumber: '',
    reasonOfLeaving: ''
  });

  // Fetch joining data
  const fetchJoiningData = async () => {
    setLoading(true);
    setTableLoading(true);
    setError(null);

    try {
      const response = await supabaseFetchSheet('JOINING');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch data from JOINING sheet');
      }
      
      const rawData = result.data || result;
      
      if (!Array.isArray(rawData)) {
        throw new Error('Expected array data not received');
      }

      const headers = rawData[5];
      const dataRows = rawData.length > 6 ? rawData.slice(6) : [];
      
      const getIndex = (headerName) => {
        const index = headers.findIndex(h => 
          h && h.toString().trim().toLowerCase() === headerName.toLowerCase()
        );
        return index;
      };

      const processedData = dataRows.map(row => ({
        employeeNo: row[getIndex('Employee ID')] || '',
        candidateName: row[getIndex('Name As Per Aadhar')] || '',
        fatherName: row[getIndex('Father Name')] || '',
        dateOfJoining: row[getIndex('Date Of Joining')] || '',
        designation: row[getIndex('Designation')] || '',
        salary: row[getIndex('Salary')] || '',
        mobileNo: row[getIndex('Mobile No.')] || '',
        firmName: row[getIndex('Joining Company Name')] || '', 
        workingPlace: row[getIndex('Joining Place')] || '',
        plannedDate: row[getIndex('Planned Date')] || '',
        actual: row[getIndex('Actual')] || '',
      }));

      // Filter for completed joining tasks
      const completedTasks = processedData.filter(
        (task) => task.plannedDate && task.actual
      );
      
      setPendingData(completedTasks);
    } catch (error) {
      console.error('Error fetching joining data:', error);
      setError(error.message);
      toast.error(`Failed to load joining data: ${error.message}`);
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  };

  // Fetch leaving data
  const fetchLeavingData = async () => {
    setLoading(true);
    setTableLoading(true);
    setError(null);

    try {
      const response = await supabaseFetchSheet('LEAVING');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch data from LEAVING sheet');
      }
      
      const rawData = result.data || result;
      
      if (!Array.isArray(rawData)) {
        throw new Error('Expected array data not received');
      }

      // Process data starting from row 7 (index 6) - skip headers
      const dataRows = rawData.length > 6 ? rawData.slice(6) : [];
      
      const processedData = dataRows.map(row => ({
        timestamp: row[0] || '',
        employeeId: row[1] || '',
        name: row[2] || '',
        dateOfLeaving: row[3] || '',
        mobileNo: row[4] || '',
        reasonOfLeaving: row[5] || '',
        firmName: row[6] || '',
        fatherName: row[7] || '', 
        dateOfJoining: row[8] || '', 
        workingLocation: row[9] || '', 
        designation: row[10] || '', 
        salary: row[11] || '', 
        plannedDate: row[12] || '', 
        actual: row[13] || '', 
      }));

      const historyTasks = processedData;
      setHistoryData(historyTasks);
    } catch (error) {
      console.error('Error fetching leaving data:', error);
      setError(error.message);
      toast.error(`Failed to load leaving data: ${error.message}`);
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  };

  useEffect(() => {
    fetchJoiningData();
    fetchLeavingData();
  }, []);

  // Filter out employees who already have leaving records
  const filteredPendingData = pendingData
    .filter(item => {
      // Remove items that exist in history
      const isInHistory = historyData.some(historyItem => 
        historyItem.employeeId === item.employeeNo
      );
      return !isInHistory;
    })
    .filter(item => {
      // Apply search filter
      const matchesSearch = item.candidateName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.employeeNo?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });

  const filteredHistoryData = historyData.filter(item => {
    const matchesSearch = item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.employeeId?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // Rest of your component remains the same...
  const handleLeavingClick = (item) => {
    setSelectedItem(item);
    setFormData({
      dateOfLeaving: '',
      mobileNumber: item.mobileNo || '',
      reasonOfLeaving: ''
    });
    setShowModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const formatDOB = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString;
    }
    
    const day = date.getDate();
    const month = date.getMonth() + 1; // Fixed: months are 0-indexed
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  };

  const handleSubmit = async(e) => {
    e.preventDefault();
    if (!formData.dateOfLeaving || !formData.reasonOfLeaving) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      setSubmitting(true);
      const now = new Date();
      const formattedTimestamp = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} `;

      const rowData = [
        formattedTimestamp,
        selectedItem.employeeNo,
        selectedItem.candidateName,
        formatDOB(formData.dateOfLeaving),
        formData.mobileNumber,
        formData.reasonOfLeaving,
        selectedItem.firmName,
        selectedItem.fatherName,
        formatDOB(selectedItem.dateOfJoining),
        selectedItem.workingPlace,
        selectedItem.designation,
        selectedItem.salary,
      ];

      const response = await supabaseMutateSheet('LEAVING', 'insert', { rowData });

      const result = await response.json();

      if (result.success) {
        setFormData({
          dateOfLeaving: '',
          reasonOfLeaving: '',
        });
        setShowModal(false);
        toast.success('Leaving request added successfully!');
        setSelectedItem(null);
        
        // Refresh both datasets
        await fetchJoiningData();
        await fetchLeavingData();
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold ">Leaving</h1>
      </div>

      {/* Filter and Search */}
      <div className="bg-white  p-4 rounded-lg shadow flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-4">
        <div className="flex flex-1 max-w-md">
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Search by name or employee ID..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300   rounded-lg focus:outline-none focus:ring-2  focus:ring-blue-500 bg-white   text-gray-500    "
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500  " />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className=" bg-white  rounded-lg shadow overflow-hidden">
        <div className="border-b border-gray-300  ">
          <nav className="flex -mb-px">
            <button
              className={`py-4 px-6 font-medium text-sm border-b-2 ${
                activeTab === 'pending'
              ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
               }`}
              onClick={() => setActiveTab('pending')}
            >
              <Clock size={16} className="inline mr-2" />
              Pending ({filteredPendingData.length})
            </button>
            <button
              className={`py-4 px-6 font-medium text-sm border-b-2 ${
                activeTab === 'history'
           ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              onClick={() => setActiveTab('history')}
            >
              <CheckCircle size={16} className="inline mr-2" />
              History ({filteredHistoryData.length})
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'pending' && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white  ">
                <thead className="bg-gray-100 ">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Father Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Of Joining</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Designation</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Salary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white  ">
                  {tableLoading ? (
            <tr>
              <td colSpan="7" className="px-6 py-12 text-center">
                <div className="flex justify-center flex-col items-center">
                  <div className="w-6 h-6 border-4 border-indigo-500 border-dashed rounded-full animate-spin mb-2"></div>
                  <span className="text-gray-600 text-sm">Loading pending calls...</span>
                </div>
              </td>
            </tr>
          ) : error ? (
            <tr>
              <td colSpan="7" className="px-6 py-12 text-center">
                <p className="text-red-500">Error: {error}</p>
                <button 
                  onClick={fetchJoiningData}
                  className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Retry
                </button>
              </td>
            </tr>
          ) :filteredPendingData.map((item,index) => (
                    <tr key={index} className="hover:bg-white hover: ">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleLeavingClick(item)}
                          className="px-3 py-1  bg-indigo-700 text-white rounded-md  text-sm"
                        >
                          Leaving
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.employeeNo}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.candidateName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.fatherName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.dateOfJoining ? new Date(item.dateOfJoining).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.designation}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.salary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {! tableLoading &&filteredPendingData.length === 0 && (
                <div className="px-6 py-12 text-center">
                  <p className="text-gray-500  ">No pending leaving requests found.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white  ">
                <thead className="bg-gray-100 ">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Of Joining</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Of Leaving</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Designation</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason Of Leaving</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white  ">
                  {tableLoading ? (
            <tr>
              <td colSpan="7" className="px-6 py-12 text-center">
                <div className="flex justify-center flex-col items-center">
                  <div className="w-6 h-6 border-4 border-indigo-500 border-dashed rounded-full animate-spin mb-2"></div>
                  <span className="text-gray-600 text-sm">Loading pending calls...</span>
                </div>
              </td>
            </tr>
          ) : error ? (
            <tr>
              <td colSpan="7" className="px-6 py-12 text-center">
                <p className="text-red-500">Error: {error}</p>
                <button 
                  onClick={fetchLeavingData}
                  className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Retry
                </button>
              </td>
            </tr>
          ) :filteredHistoryData.map((item,index) => (
                    <tr key={index} className="hover:bg-white hover: ">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.employeeId}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.dateOfJoining ? formatDOB(item.dateOfJoining) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.dateOfLeaving ?formatDOB(item.dateOfLeaving) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.designation}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.reasonOfLeaving}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredHistoryData.length === 0 && (
                <div className="px-6 py-12 text-center">
                  <p className="text-gray-500  ">No leaving history found.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && selectedItem && (
        <div className=" fixed inset-0 modal-backdrop flex items-center justify-center z-50 p-4">
          <div className=" bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b border-gray-300  ">
              <h3 className="text-lg font-medium text-gray-700">Leaving Form</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-700  ">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                <input
                  type="text"
                  value={selectedItem.employeeNo}
                  disabled
                  className="w-full border border-gray-500   rounded-md px-3 py-2 bg-white   text-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={selectedItem.candidateName}
                  disabled
                  className="w-full border border-gray-500   rounded-md px-3 py-2 bg-white   text-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Date Of Leaving *</label>
                <input
                  type="date"
                  name="dateOfLeaving"
                  value={formData.dateOfLeaving}
                  onChange={handleInputChange}
                  className="w-full border border-gray-500   rounded-md px-3 py-2 focus:outline-none focus:ring-2  focus:ring-blue-500 bg-white   text-gray-700"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Mobile Number</label>
                <input
                  type="tel"
                  name="mobileNumber"
                  value={formData.mobileNumber}
                  onChange={handleInputChange}
                  className="w-full border border-gray-500   rounded-md px-3 py-2 focus:outline-none focus:ring-2  focus:ring-blue-500 bg-white   text-gray-700    "
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason Of Leaving *</label>
                <textarea
                  name="reasonOfLeaving"
                  value={formData.reasonOfLeaving}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full border border-gray-500   rounded-md px-3 py-2 focus:outline-none focus:ring-2  focus:ring-blue-500 bg-white   text-gray-700    "
                  required
                />
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300   rounded-md text-gray-700 hover:bg-white  "
                >
                  Cancel
                </button>
               <button
    type="submit"
    className={`px-4 py-2 text-white bg-indigo-700 rounded-md hover:bg-indigo-800 min-h-[42px] flex items-center justify-center ${
      submitting ? 'opacity-90 cursor-not-allowed' : ''
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
    ) : 'Submit'}
  </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leaving;