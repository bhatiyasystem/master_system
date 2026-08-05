import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import toast from 'react-hot-toast';

const AfterLeavingWork = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    resignationLetterReceived: false,
    resignationAcceptance: false,
    handoverOfAssets: false,
    idCard: false,
    visitingCard: false,
    cancellationOfEmailId: false,
    biometricAccess: false,
    finalReleaseDate: '',
    removeBenefitEnrollment: false
  });

  const fetchLeavingData = async () => {
    setLoading(true);
    setTableLoading(true);
    setError(null);

    try {
      const response = await fetch(
        'https://script.google.com/macros/s/AKfycbzF-ERpUfrb0figpapH5q5-J1KRAnBHt-OaXYrN9Cw4wzwaacKhUPwGgtCIWfxw2Ruz9g/exec?sheet=LEAVING&action=fetch'
      );
      
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
        actual: row[13] || ''
      }));

      const pendingTasks = processedData.filter(
        task => task.plannedDate && !task.actual
      );
      setPendingData(pendingTasks);
      
      const historyTasks = processedData.filter(
        task => task.plannedDate && task.actual
      );
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
    fetchLeavingData();
  }, []);

  const handleAfterLeavingClick = async (item) => {
    // Reset form data first to prevent previous state from showing
    setFormData({
      resignationLetterReceived: false,
      resignationAcceptance: false,
      handoverOfAssets: false,
      idCard: false,
      visitingCard: false,
      cancellationOfEmailId: false,
      biometricAccess: false,
      finalReleaseDate: '',
      removeBenefitEnrollment: false
    });
    
    setSelectedItem(item);
    setShowModal(true);
    setLoading(true);

    try {
      // Fetch current values from the sheet
      const fullDataResponse = await fetch(
        'https://script.google.com/macros/s/AKfycbzF-ERpUfrb0figpapH5q5-J1KRAnBHt-OaXYrN9Cw4wzwaacKhUPwGgtCIWfxw2Ruz9g/exec?sheet=LEAVING&action=fetch'
      );
      
      if (!fullDataResponse.ok) {
        throw new Error(`HTTP error! status: ${fullDataResponse.status}`);
      }
      
      const fullDataResult = await fullDataResponse.json();
      const allData = fullDataResult.data || fullDataResult;

      // Find header row
      let headerRowIndex = allData.findIndex(row =>
        row.some(cell => cell?.toString().trim().toLowerCase().includes('employee id'))
      );
      if (headerRowIndex === -1) headerRowIndex = 4;

      const headers = allData[headerRowIndex].map(h => h?.toString().trim());

      // Find Employee ID column index
      const employeeIdIndex = headers.findIndex(h => h?.toLowerCase() === "employee id");
      if (employeeIdIndex === -1) {
        throw new Error("Could not find 'Employee ID' column");
      }

      // Find the employee row index
      const rowIndex = allData.findIndex((row, idx) =>
        idx > headerRowIndex &&
        row[employeeIdIndex]?.toString().trim() === item.employeeId?.toString().trim()
      );
      
      if (rowIndex === -1) {
        throw new Error(`Employee ${item.employeeId} not found in LEAVING sheet`);
      }

      // Get current values from the sheet
      // Column W is index 22 (0-based)
      const finalReleaseDateValue = allData[rowIndex][22] || "";
      
      // Format the date for the input field (YYYY-MM-DD format)
      let formattedDate = "";
      if (finalReleaseDateValue) {
        // Try to parse the date if it's in a different format
        const dateParts = finalReleaseDateValue.toString().split('/');
        if (dateParts.length === 3) {
          // Assuming DD/MM/YYYY format
          const day = dateParts[0].padStart(2, '0');
          const month = dateParts[1].padStart(2, '0');
          const year = dateParts[2];
          formattedDate = `${year}-${month}-${day}`;
        } else {
          // Try to parse as a Date object if it's in a different format
          const dateObj = new Date(finalReleaseDateValue);
          if (!isNaN(dateObj.getTime())) {
            formattedDate = dateObj.toISOString().split('T')[0];
          }
        }
      }

      const currentValues = {
        resignationLetterReceived: 
          allData[rowIndex][15]?.toString().trim().toLowerCase() === "yes",
        resignationAcceptance: 
          allData[rowIndex][16]?.toString().trim().toLowerCase() === "yes",
        handoverOfAssets: 
          allData[rowIndex][17]?.toString().trim().toLowerCase() === "yes",
        idCard: 
          allData[rowIndex][18]?.toString().trim().toLowerCase() === "yes",
        visitingCard: 
          allData[rowIndex][19]?.toString().trim().toLowerCase() === "yes",
        cancellationOfEmailId: 
          allData[rowIndex][20]?.toString().trim().toLowerCase() === "yes",
        biometricAccess: 
          allData[rowIndex][21]?.toString().trim().toLowerCase() === "yes",
        finalReleaseDate: formattedDate,
        removeBenefitEnrollment: 
          allData[rowIndex][23]?.toString().trim().toLowerCase() === "yes"
      };

      setFormData(currentValues);
    } catch (error) {
      console.error('Error fetching current values:', error);
      // Keep the default reset values if there's an error
      toast.error("Failed to load current values");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckboxChange = (name) => {
    setFormData(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSubmitting(true);

    if (!selectedItem.employeeId || !selectedItem.name) {
      toast.error('Please fill all required fields');
      setSubmitting(false);
      return;
    }

    try {
      // 1. First fetch the current data
      const fullDataResponse = await fetch(
        'https://script.google.com/macros/s/AKfycbzF-ERpUfrb0figpapH5q5-J1KRAnBHt-OaXYrN9Cw4wzwaacKhUPwGgtCIWfxw2Ruz9g/exec?sheet=LEAVING&action=fetch'
      );
      if (!fullDataResponse.ok) {
        throw new Error(`HTTP error! status: ${fullDataResponse.status}`);
      }

      const fullDataResult = await fullDataResponse.json();
      const allData = fullDataResult.data || fullDataResult;

      // Find header row in LEAVING sheet
      let headerRowIndex = allData.findIndex(row =>
        row.some(cell => cell?.toString().trim().toLowerCase().includes('employee id'))
      );
      if (headerRowIndex === -1) headerRowIndex = 4;

      const headers = allData[headerRowIndex].map(h => h?.toString().trim());

      // Find Employee ID column index
      const employeeIdIndex = headers.findIndex(h => h?.toLowerCase() === "employee id");
      if (employeeIdIndex === -1) {
        throw new Error("Could not find 'Employee ID' column");
      }

      // Find the employee row index
      const rowIndex = allData.findIndex((row, idx) =>
        idx > headerRowIndex &&
        row[employeeIdIndex]?.toString().trim() === selectedItem.employeeId?.toString().trim()
      );
      if (rowIndex === -1) throw new Error(`Employee ${selectedItem.employeeId} not found in LEAVING sheet`);

      const now = new Date();
      const formattedTimestamp = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} `;
      
      // Check if all conditions are met
      const allConditionsMet = 
        formData.resignationLetterReceived &&
        formData.resignationAcceptance &&
        formData.handoverOfAssets &&
        formData.idCard &&
        formData.visitingCard &&
        formData.cancellationOfEmailId &&
        formData.biometricAccess &&
        formData.removeBenefitEnrollment &&
        formData.finalReleaseDate;

      const updatePromises = [];

      // Only update actual date if all conditions are met
      if (allConditionsMet) {
        updatePromises.push(
          fetch(
            "https://script.google.com/macros/s/AKfycbzF-ERpUfrb0figpapH5q5-J1KRAnBHt-OaXYrN9Cw4wzwaacKhUPwGgtCIWfxw2Ruz9g/exec",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                sheetName: "LEAVING",
                action: "updateCell",
                rowIndex: (rowIndex + 1).toString(),
                columnIndex: "14", // Column N (Actual date)
                value: formattedTimestamp,
              }).toString(),
            }
          )
        );
      }

      // Update checklist columns regardless of allConditionsMet
      const fields = [
        { value: formData.resignationLetterReceived ? "Yes" : "No", offset: 15 },
        { value: formData.resignationAcceptance ? "Yes" : "No", offset: 16 },
        { value: formData.handoverOfAssets ? "Yes" : "No", offset: 17 },
        { value: formData.idCard ? "Yes" : "No", offset: 18 },
        { value: formData.visitingCard ? "Yes" : "No", offset: 19 },
        { value: formData.cancellationOfEmailId ? "Yes" : "No", offset: 20 },
        { value: formData.biometricAccess ? "Yes" : "No", offset: 21 },
        { value: formData.removeBenefitEnrollment ? "Yes" : "No", offset: 23 }
      ];

      // Convert final release date to DD/MM/YYYY
      let finalReleaseDateValue = "";
      if (formData.finalReleaseDate) {
        const dateParts = formData.finalReleaseDate.split('-');
        if (dateParts.length === 3) {
          finalReleaseDateValue = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
        } else {
          finalReleaseDateValue = formData.finalReleaseDate;
        }
      }

      // Add final release date update
      updatePromises.push(
        fetch(
          "https://script.google.com/macros/s/AKfycbzF-ERpUfrb0figpapH5q5-J1KRAnBHt-OaXYrN9Cw4wzwaacKhUPwGgtCIWfxw2Ruz9g/exec",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              sheetName: "LEAVING",
              action: "updateCell",
              rowIndex: (rowIndex + 1).toString(),
              columnIndex: "23", // Column W (Final Release Date)
              value: finalReleaseDateValue,
            }).toString(),
          }
        )
      );

      // Add all other field updates
      fields.forEach((field) => {
        updatePromises.push(
          fetch(
            "https://script.google.com/macros/s/AKfycbzF-ERpUfrb0figpapH5q5-J1KRAnBHt-OaXYrN9Cw4wzwaacKhUPwGgtCIWfxw2Ruz9g/exec",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                sheetName: "LEAVING",
                action: "updateCell",
                rowIndex: (rowIndex + 1).toString(),
                columnIndex: (field.offset + 1).toString(),
                value: field.value,
              }).toString(),
            }
          )
        );
      });

      const responses = await Promise.all(updatePromises);
      const results = await Promise.all(responses.map((r) => r.json()));

      const hasError = results.some((result) => !result.success);
      if (hasError) {
        console.error("Some cell updates failed:", results);
        throw new Error("Some cell updates failed");
      }

      if (allConditionsMet) {
        toast.success("All conditions met! Actual date updated successfully.");
      } else {
        toast.success(
          "Conditions updated successfully. Actual date will be updated when all conditions are met."
        );
      }

      setShowModal(false);
      fetchLeavingData();
    } catch (error) {
      console.error('Update error:', error);
      toast.error(`Update failed: ${error.message}`);
    } finally {
      setLoading(false);
      setSubmitting(false);
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

  const filteredPendingData = pendingData.filter(item => {
    const matchesSearch = item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.employeeId?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">After Leaving Work</h1>
      </div>

      {/* Filter and Search */}
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

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Of Joining</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Of Leaving</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Designation</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason Of Leaving</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white">
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
                ) : filteredPendingData.length > 0 ? (
                  filteredPendingData.map((item, index) => (
                    <tr key={index} className="hover:bg-white">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleAfterLeavingClick(item)}
                          className="px-3 py-1 text-white bg-indigo-700 rounded-md text-sm"
                        >
                          Process
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.employeeId}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.dateOfJoining ? new Date(item.dateOfJoining).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.dateOfLeaving ? new Date(item.dateOfLeaving).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.designation}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.reasonOfLeaving}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center">
                      <p className="text-gray-500">No pending after leaving work found.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-700">After Leaving Work Checklist</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-700">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                  <input
                    type="text"
                    value={selectedItem.employeeId}
                    disabled
                    className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100 text-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={selectedItem.name}
                    disabled
                    className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100 text-gray-700"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-md font-medium text-gray-700">Checklist Items</h4>
                
                {[
                  { key: 'resignationLetterReceived', label: 'Resignation Letter Received' },
                  { key: 'resignationAcceptance', label: 'Resignation Acceptance' },
                  { key: 'handoverOfAssets', label: 'Handover Of Assets' },
                  { key: 'idCard', label: 'ID Card' },
                  { key: 'visitingCard', label: 'Visiting Card' },
                  { key: 'cancellationOfEmailId', label: 'Cancellation Of Email ID' },
                  { key: 'biometricAccess', label: 'Biometric Access' },
                  { key: 'removeBenefitEnrollment', label: 'Remove Benefit Enrollment' }
                ].map((item) => (
                  <div key={item.key} className="flex items-center">
                    <input
                      type="checkbox"
                      id={item.key}
                      checked={formData[item.key]}
                      onChange={() => handleCheckboxChange(item.key)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor={item.key} className="ml-2 text-sm text-gray-700">
                      {item.label}
                    </label>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Final Release Date</label>
                <input
                  type="date"
                  name="finalReleaseDate"
                  value={formData.finalReleaseDate}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
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

export default AfterLeavingWork;