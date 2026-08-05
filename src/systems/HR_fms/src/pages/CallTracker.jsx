import React, { useState, useEffect } from 'react';
import { Search, Clock, CheckCircle, X, Upload } from 'lucide-react';
import toast from 'react-hot-toast';

const CallTracker = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showJoiningModal, setShowJoiningModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [followUpData, setFollowUpData] = useState([]);

    const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    candidateSays: '',
    status: '',
    nextDate: ''
  });
  const [joiningFormData, setJoiningFormData] = useState({
    nameAsPerAadhar: '',
    fatherName: '',
    dateOfJoining: '',
    joiningPlace: '',
    designation: '',
    salary: '',
    aadharFrontPhoto: null,
    aadharBackPhoto: null,
    panCard: null,
    candidatePhoto: null,
    currentAddress: '',
    addressAsPerAadhar: '',
    dobAsPerAadhar: '',
    gender: '',
    mobileNo: '',
    familyMobileNo: '',
    relationshipWithFamily: '',
    pastPfId: '',
    currentBankAc: '',
    ifscCode: '',
    branchName: '',
    bankPassbookPhoto: null,
    personalEmail: '',
    esicNo: '',
    highestQualification: '',
    pfEligible: '',
    esicEligible: '',
    joiningCompanyName: '',
    emailToBeIssue: '',
    issueMobile: '',
    issueLaptop: '',
    aadharCardNo: '',
    modeOfAttendance: '',
    qualificationPhoto: null,
    paymentMode: '',
    salarySlip: null,
    resumeCopy: null
  });
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [enquiryData, setEnquiryData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [error, setError] = useState(null);

  const fetchEnquiryData = async () => {
    setLoading(true);
    setTableLoading(true);
    setError(null);

    try {
      const [enquiryResponse, followUpResponse] = await Promise.all([
        fetch('https://script.google.com/macros/s/AKfycbzF-ERpUfrb0figpapH5q5-J1KRAnBHt-OaXYrN9Cw4wzwaacKhUPwGgtCIWfxw2Ruz9g/exec?sheet=ENQUIRY&action=fetch'),
        fetch('https://script.google.com/macros/s/AKfycbzF-ERpUfrb0figpapH5q5-J1KRAnBHt-OaXYrN9Cw4wzwaacKhUPwGgtCIWfxw2Ruz9g/exec?sheet=Follow - Up&action=fetch')
      ]);
      
      if (!enquiryResponse.ok || !followUpResponse.ok) {
        throw new Error(`HTTP error! status: ${enquiryResponse.status} or ${followUpResponse.status}`);
      }
      
      const [enquiryResult, followUpResult] = await Promise.all([
        enquiryResponse.json(),
        followUpResponse.json()
      ]);
      
      if (!enquiryResult.success || !enquiryResult.data || enquiryResult.data.length < 7) {
        throw new Error(enquiryResult.error || 'Not enough rows in enquiry sheet data');
      }
      
      // Process enquiry data
      const enquiryHeaders = enquiryResult.data[5].map(h => h.trim());
      const enquiryDataFromRow7 = enquiryResult.data.slice(6);
      
      const getIndex = (headerName) => enquiryHeaders.findIndex(h => h === headerName);
      
      const processedEnquiryData = enquiryDataFromRow7
        .filter(row => {
          const plannedIndex = getIndex('Planned');
          const actualIndex = getIndex('Actual');
          const planned = row[plannedIndex];
          const actual = row[actualIndex];
          return planned && (!actual || actual === '');
        })
        .map(row => ({
          id: row[getIndex('Timestamp')],
          indentNo: row[getIndex('Indent Number')],
          candidateEnquiryNo: row[getIndex('Candidate Enquiry Number')],
          applyingForPost: row[getIndex('Applying For the Post')],
          candidateName: row[getIndex('Candidate Name')],
          candidateDOB: row[getIndex('DOB')],
          candidatePhone: row[getIndex('Candidate Phone Number')],
          candidateEmail: row[getIndex('Candidate Email')],
          previousCompany: row[getIndex('Previous Company Name')],
          jobExperience: row[getIndex('Job Experience')] || '',
          lastSalary: row[getIndex('Last Salary Drawn')] || '',
          previousPosition: row[getIndex('Previous Position')] || '',
          reasonForLeaving: row[getIndex('Reason Of Leaving Previous Company')] || '',
          maritalStatus: row[getIndex('Marital Status')] || '',
          lastEmployerMobile: row[getIndex('Last Employer Mobile Number')] || '',
          candidatePhoto: row[getIndex('Candidate Photo')] || '',
          candidateResume: row[19] || '',
          referenceBy: row[getIndex('Reference By')] || '',
          presentAddress: row[getIndex('Present Address')] || '',
          aadharNo: row[getIndex('Aadhar Number')] || ''
        }));
      
      setEnquiryData(processedEnquiryData);
      
      // Process follow-up data for filtering
      if (followUpResult.success && followUpResult.data) {
        const rawFollowUpData = followUpResult.data || followUpResult;
        const followUpRows = Array.isArray(rawFollowUpData[0]) ? rawFollowUpData.slice(1) : rawFollowUpData;
        
        const processedFollowUpData = followUpRows.map(row => ({
          enquiryNo: row[1] || '',       // Column B (index 1) - Enquiry No
          status: row[2] || ''           // Column C (index 2) - Status
        }));
        
        setFollowUpData(processedFollowUpData);
      }
      
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error.message);
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  };

const fetchFollowUpData = async () => {
  setLoading(true);
  setTableLoading(true);
  setError(null);

  try {
    const response = await fetch(
      'https://script.google.com/macros/s/AKfycbzF-ERpUfrb0figpapH5q5-J1KRAnBHt-OaXYrN9Cw4wzwaacKhUPwGgtCIWfxw2Ruz9g/exec?sheet=Follow - Up&action=fetch'
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('Raw API response:', result);

    if (!result.success) {
      throw new Error(result.error || 'Google Script returned an error');
    }

    // Handle both array formats (direct data or result.data)
    const rawData = result.data || result;
    
    if (!Array.isArray(rawData)) {
      throw new Error('Expected array data not received');
    }

    // Process data - skip header row if present
    const dataRows = rawData.length > 0 && Array.isArray(rawData[0]) ? rawData.slice(1) : rawData;
    
    const processedData = dataRows.map(row => ({
      timestamp: row[0] || '',       // Column A (index 0) - Timestamp
      enquiryNo: row[1] || '',       // Column B (index 1) - Enquiry No
      status: row[2] || '',          // Column C (index 2) - Status
      candidateSays: row[3] || '',   // Column D (index 3) - Candidates Says
      nextDate: row[4] || ''         // Column E (index 4) - Next Date
    }));

    console.log('Processed follow-up data:', processedData);
    setHistoryData(processedData);
    
  } catch (error) {
    console.error('Error in fetchFollowUpData:', error);
    setError(error.message);
    toast.error(`Failed to load follow-ups: ${error.message}`);
  } finally {
    setLoading(false);
    setTableLoading(false);
  }
};

  useEffect(() => {
    fetchEnquiryData();
    fetchFollowUpData();
  }, []);

 const pendingData = enquiryData.filter(item => {
    const hasFinalStatus = followUpData.some(followUp => 
      followUp.enquiryNo === item.candidateEnquiryNo && 
      (followUp.status === 'Joining' || followUp.status === 'Reject')
    );
    return !hasFinalStatus;
  });

  const handleCallClick = (item) => {
    setSelectedItem(item);
    setFormData({
      candidateSays: '',
      status: '',
      nextDate: ''
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

  const handleJoiningInputChange = (e) => {
    const { name, value } = e.target;
    setJoiningFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e, fieldName) => {
    const file = e.target.files[0];
    if (file) {
      setJoiningFormData(prev => ({
        ...prev,
        [fieldName]: file
      }));
    }
  };

  const postToJoiningSheet = async (rowData) => {
  const URL = 'https://script.google.com/macros/s/AKfycbzF-ERpUfrb0figpapH5q5-J1KRAnBHt-OaXYrN9Cw4wzwaacKhUPwGgtCIWfxw2Ruz9g/exec';

  try {
    console.log('Attempting to post:', {
      sheetName: 'JOINING',
      rowData: rowData
    });

    const params = new URLSearchParams();
    params.append('sheetName', 'JOINING');
    params.append('action', 'insert');
    params.append('rowData', JSON.stringify(rowData));

    const response = await fetch(URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('Server response:', data);

    if (!data.success) {
      throw new Error(data.error || 'Server returned unsuccessful response');
    }

    return data;
  } catch (error) {
    console.error('Full error details:', {
      error: error.message,
      stack: error.stack,
      rowData: rowData,
      timestamp: new Date().toISOString()
    });
    throw new Error(`Failed to update sheet: ${error.message}`);
  }
};


const postToSheet = async (rowData) => {
  const URL = 'https://script.google.com/macros/s/AKfycbzF-ERpUfrb0figpapH5q5-J1KRAnBHt-OaXYrN9Cw4wzwaacKhUPwGgtCIWfxw2Ruz9g/exec';

  try {
    console.log('Attempting to post:', {
      sheetName: 'Follow - Up',
      rowData: rowData
    });

    const params = new URLSearchParams();
    params.append('sheetName', 'Follow - Up');
    params.append('action', 'insert');
    params.append('rowData', JSON.stringify(rowData));

    const response = await fetch(URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('Server response:', data);

    if (!data.success) {
      throw new Error(data.error || 'Server returned unsuccessful response');
    }

    return data;
  } catch (error) {
    console.error('Full error details:', {
      error: error.message,
      stack: error.stack,
      rowData: rowData,
      timestamp: new Date().toISOString()
    });
    throw new Error(`Failed to update sheet: ${error.message}`);
  }
};

// utils/dateFormatter.js
 const formatDateTime=(isoString)=>{
  const d = new Date(isoString);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

 const uploadFileToDrive = async (file, folderId = '12sCqWAuyGR3-Wsxt4qj_FMWR0lmNZIKa') => {
    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64Data = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const params = new URLSearchParams();
      params.append('action', 'uploadFile');
      params.append('base64Data', base64Data);
      params.append('fileName', file.name);
      params.append('mimeType', file.type);
      params.append('folderId', folderId);

      const response = await fetch(
        'https://script.google.com/macros/s/AKfycbzF-ERpUfrb0figpapH5q5-J1KRAnBHt-OaXYrN9Cw4wzwaacKhUPwGgtCIWfxw2Ruz9g/exec',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'File upload failed');
      }

      return data.fileUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error(`Failed to upload file: ${error.message}`);
      throw error;
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
    const year = date.getFullYear().toString().slice(-2);
    
    return `${day}/${month}/${year}`;
  };

const handleSubmit = async (e) => {
  e.preventDefault();
  setSubmitting(true);

  if (!formData.candidateSays || !formData.status) {
    toast.error('Please fill all required fields');
    setSubmitting(false);
    return;
  }

  try {
    const now = new Date();
    const formattedTimestamp = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

    const rowData = [
      formattedTimestamp,
      selectedItem.candidateEnquiryNo || '',
      formData.status,
      formData.candidateSays,
      formatDOB(formData.nextDate) || '',
    ];

    // Always post to Follow-Up sheet first, regardless of status
    await postToSheet(rowData);
    toast.success('Update successful!');
    
    // If status is Joining, show the joining modal after successful submission
    if (formData.status === 'Joining') {
      setShowModal(false);
      setShowJoiningModal(true);
    } else {
      setShowModal(false);
    }
    
    fetchEnquiryData();
  } catch (error) {
    console.error('Submission failed:', error);
    toast.error(`Failed to update: ${error.message}`);
    if (error.message.includes('appendRow')) {
      toast('Please verify the "Follow-Up" sheet exists', {
        icon: 'ℹ️',
        duration: 8000
      });
    }
  } finally {
    setSubmitting(false);
  }
};

 const handleJoiningSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      // Upload files and get URLs
      const uploadPromises = {};
      const fileFields = [
        'aadharFrontPhoto',
        'aadharBackPhoto',
        'bankPassbookPhoto',
        'qualificationPhoto',
        'salarySlip',
        'resumeCopy'
      ];

      for (const field of fileFields) {
        if (joiningFormData[field]) {
          uploadPromises[field] = uploadFileToDrive(joiningFormData[field]);
        } else {
          uploadPromises[field] = Promise.resolve('');
        }
      }

      // Wait for all uploads to complete
      const uploadedUrls = await Promise.all(
        Object.values(uploadPromises).map(promise => 
          promise.catch(error => {
            console.error('Upload failed:', error);
            return ''; // Return empty string if upload fails
          })
        )
      );

      // Map uploaded URLs to their respective fields
      const fileUrls = {};
      Object.keys(uploadPromises).forEach((field, index) => {
        fileUrls[field] = uploadedUrls[index];
      });

      const now = new Date();
      const formattedTimestamp = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;

      // Create an array with all column values in order
      const rowData = [];
      
      // Assign values directly to array indices
      rowData[0] = formattedTimestamp;           // Timestamp
      // rowData[1] = "employee no";                // Employee No (placeholder)
      rowData[2] = selectedItem.indentNo;        // Indent No
      rowData[3] = selectedItem.candidateEnquiryNo || ''; // Candidate Enquiry No
      rowData[4] = selectedItem.candidateName;   // Candidate Name
      rowData[5] = joiningFormData.fatherName;   // Father Name
      rowData[6] = formatDOB(joiningFormData.dateOfJoining); // Date of Joining
      rowData[7] = joiningFormData.joiningPlace;  // Joining Place
      rowData[8] = joiningFormData.designation;   // Designation
      rowData[9] = joiningFormData.salary;        // Salary
      rowData[10] = fileUrls.aadharFrontPhoto;    // Aadhar Front Photo (Column K)
      rowData[11] = fileUrls.aadharBackPhoto;     // PAN Card Photo (Column L)
      rowData[12] = "";                           // Candidate Photo (placeholder)
      rowData[13] = selectedItem.presentAddress;  // Present Address
      rowData[14] = joiningFormData.addressAsPerAadhar; // Address as per Aadhar
      rowData[15] = formatDOB(joiningFormData.dobAsPerAadhar); // DOB as per Aadhar
      rowData[16] = joiningFormData.gender;       // Gender
      rowData[17] = selectedItem.candidatePhone;  // Candidate Phone
      rowData[18] = joiningFormData.familyMobileNo; // Family Mobile No
      rowData[19] = joiningFormData.relationshipWithFamily; // Relationship with Family
      rowData[20] = joiningFormData.pastPfId;     // Past PF ID
      rowData[21] = joiningFormData.currentBankAc; // Current Bank Account
      rowData[22] = joiningFormData.ifscCode;     // IFSC Code
      rowData[23] = joiningFormData.branchName;   // Branch Name
      rowData[24] = fileUrls.bankPassbookPhoto;   // Bank Passbook Photo (Column Y)
      rowData[25] = selectedItem.candidateEmail;  // Candidate Email
      rowData[26] = joiningFormData.esicNo;       // ESIC No
      rowData[27] = joiningFormData.highestQualification; // Highest Qualification
      rowData[28] = joiningFormData.pfEligible;   // PF Eligible
      rowData[29] = joiningFormData.esicEligible; // ESIC Eligible
      rowData[30] = joiningFormData.joiningCompanyName; // Joining Company Name
      rowData[31] = joiningFormData.emailToBeIssue; // Email to be Issued
      rowData[32] = joiningFormData.issueMobile;   // Issue Mobile
      rowData[33] = joiningFormData.issueLaptop;   // Issue Laptop
      rowData[34] = selectedItem.aadharNo;        // Aadhar No
      rowData[35] = joiningFormData.modeOfAttendance; // Mode of Attendance
      rowData[36] = fileUrls.qualificationPhoto;  // Qualification Photo (Column AK)
      rowData[37] = joiningFormData.paymentMode;   // Payment Mode
      rowData[38] = fileUrls.salarySlip;          // Salary Slip (Column AM)
      rowData[39] = fileUrls.resumeCopy;          // Resume Copy (Column AN)

      await postToJoiningSheet(rowData);

      console.log("Joining Form Data:", rowData);

      toast.success('Employee added successfully!');
      setShowJoiningModal(false);
      setSelectedItem(null);
      fetchEnquiryData();
    } catch (error) {
      console.error('Error submitting joining form:', error);
      toast.error(`Failed to submit joining form: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPendingData = pendingData.filter(item => {
    const matchesSearch = item.candidateName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       item.candidateEnquiryNo?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const filteredHistoryData = historyData.filter(item => {
  const matchesSearch = item.enquiryNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                     item.candidateSays?.toLowerCase().includes(searchTerm.toLowerCase());
  return matchesSearch;
});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Call Tracker</h1>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-lg shadow flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-4">
        <div className="flex flex-1 max-w-md">
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Search by candidate name or enquiry number..."
              className="w-full pl-10 pr-4 py-2 border border-gray-400 border-opacity-30 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-600"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600 opacity-60" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="border-b border-gray-300 border-opacity-20">
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
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Indent No.</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Candidate Enquiry No.</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applying For Post</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Candidate Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Photo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resume</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tableLoading ? (
                    <tr>
                      <td colSpan="9" className="px-6 py-12 text-center">
                        <div className="flex justify-center flex-col items-center">
                          <div className="w-6 h-6 border-4 border-indigo-500 border-dashed rounded-full animate-spin mb-2"></div>
                          <span className="text-gray-600 text-sm">Loading pending calls...</span>
                        </div>
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan="9" className="px-6 py-12 text-center">
                        <p className="text-red-500">Error: {error}</p>
                        <button 
                          onClick={fetchEnquiryData}
                          className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                        >
                          Retry
                        </button>
                      </td>
                    </tr>
                  ) : filteredPendingData.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="px-6 py-12 text-center">
                        <p className="text-gray-500">No pending calls found.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredPendingData.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleCallClick(item)}
                            className="px-3 py-1 text-white bg-indigo-700 rounded-md hover:bg-opacity-90 text-sm"
                          >
                            Call
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.indentNo}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.candidateEnquiryNo}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.applyingForPost}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.candidateName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.candidatePhone}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.candidateEmail}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.candidatePhoto ? (
                            <a 
                              href={item.candidatePhoto} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-indigo-600 hover:text-indigo-800"
                            >
                              View
                            </a>
                          ) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
  {item.candidateResume ? (
    <a 
      href={item.candidateResume} 
      target="_blank" 
      rel="noopener noreferrer"
      className="text-indigo-600 hover:text-indigo-800"
    >
      View
    </a>
  ) : '-'}
</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

         {activeTab === 'history' && (
  <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Enquiry No</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Candidate Says</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Next Date</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {tableLoading ? (
          <tr>
            <td colSpan="5" className="px-6 py-12 text-center">
              <div className="flex justify-center flex-col items-center">
                <div className="w-6 h-6 border-4 border-indigo-500 border-dashed rounded-full animate-spin mb-2"></div>
                <span className="text-gray-600 text-sm">Loading call history...</span>
              </div>
            </td>
          </tr>
        ) : filteredHistoryData.length === 0 ? (
          <tr>
            <td colSpan="5" className="px-6 py-12 text-center">
              <p className="text-gray-500">No call history found.</p>
            </td>
          </tr>
        ) : (
          filteredHistoryData.map((item, index) => (
            <tr key={index} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.enquiryNo}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <span className={`px-2 py-1 text-xs rounded-full ${
                  item.status === 'Joining' 
                    ? 'bg-green-100 text-green-800' 
                    : item.status === 'Reject'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {item.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.candidateSays}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.nextDate || '-'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {item.timestamp || '-'}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
)}
        </div>
      </div>

      {/* Call Modal */}
{showModal && selectedItem && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
      <div className="flex justify-between items-center p-6 border-b border-gray-300">
        <h3 className="text-lg font-medium text-gray-900">Call Tracker</h3>
        <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
          <X size={20} />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Candidate Enquiry No.</label>
          <input
            type="text"
            value={selectedItem.candidateEnquiryNo}
            disabled
            className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100 text-gray-700"
          />
        </div> 
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
          <select
            name="status"
            value={formData.status}
            onChange={handleInputChange}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
            required
          >
            <option value="">Select Status</option>
            <option value="Follow-up">Follow-up</option>
            <option value="Interview">Interview</option>
            <option value="Negotiation">Negotiation</option>
            <option value="On Hold">On Hold</option>
            <option value="Joining">Joining</option>
            <option value="Reject">Reject</option>
          </select>
        </div>
        
        {/* Dynamic Label for Candidate Says Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {formData.status === 'Negotiation' 
              ? "What's Customer Requirement *" 
              : formData.status === 'On Hold'
              ? "Reason For Holding the Candidate *"
              : formData.status === 'Joining'
              ? "When the candidate will join the company *"
              : formData.status === 'Reject'
              ? "Reason for Rejecting the Candidate *"
              : "What Did The Candidate Says *"}
          </label>
          <textarea
            name="candidateSays"
            value={formData.candidateSays}
            onChange={handleInputChange}
            rows={3}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
            required
          />
        </div>
        
        {/* Dynamic Label for Next Date Field */}
        {formData.status && !['Joining', 'Reject'].includes(formData.status) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {formData.status === 'Interview' 
                ? "Schedule Date *" 
                : formData.status === 'On Hold'
                ? "ReCalling Date *"
                : "Next Date *"}
            </label>
            <input
              type="date"
              name="nextDate"
              value={formData.nextDate}
              onChange={handleInputChange}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
              required
            />
          </div>
        )}
        
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

      {/* Joining Modal */}
      {showJoiningModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-300">
              <h3 className="text-lg font-medium text-gray-900">Employee Joining Form</h3>
              <button onClick={() => setShowJoiningModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
       <form onSubmit={handleJoiningSubmit} className="p-6 space-y-6">
  {/* Section 1: Basic Information */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
      <input
        type="text"
        value={selectedItem.candidateEnquiryNo}
        disabled
        className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100 text-gray-700"
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Indent No</label>
      <input
        type="text"
        value={selectedItem.indentNo}
        disabled
        className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100 text-gray-700"
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Name As Per Aadhar *</label>
      <input
        type="text"
         disabled
        value={selectedItem.candidateName}
        onChange={handleJoiningInputChange}
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
     
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Father Name</label>
      <input
        type="text"
        name="fatherName"
        value={joiningFormData.fatherName}
        onChange={handleJoiningInputChange}
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Date Of Birth *</label>
      <input
        type="date"
     name="dobAsPerAadhar"
        value={joiningFormData.dobAsPerAadhar}
        onChange={handleJoiningInputChange}
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
        
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
      <select
        name="gender"
        value={joiningFormData.gender}
        onChange={handleJoiningInputChange}
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
      >
        <option value="">Select Gender</option>
        <option value="Male">Male</option>
        <option value="Female">Female</option>
        <option value="Other">Other</option>
      </select>
    </div>
  </div>

  {/* Section 2: Contact Information */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Mobile No. *</label>
      <input
        type="tel"
        disabled
        value={selectedItem.candidatePhone}
        onChange={handleJoiningInputChange}
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
       
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Candidate Email *</label>
      <input
        type="email"
         disabled
        value={selectedItem.candidateEmail}
        onChange={handleJoiningInputChange}
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
        
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Family Mobile Number *</label>
      <input
        name="familyMobileNo"
        value={joiningFormData.familyMobileNo}
        onChange={handleJoiningInputChange}
      
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Relationship With Family *</label>
      <input
        name="relationshipWithFamily"
        value={joiningFormData.relationshipWithFamily}
        onChange={handleJoiningInputChange}
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
       
      />
    </div>
  </div>

  {/* Section 3: Address Information */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Current Address *</label>
      <textarea
         disabled
        value={selectedItem.presentAddress}
        onChange={handleJoiningInputChange}
        rows={3}
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
        
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Address as per Aadhar *</label>
      <textarea
        name="addressAsPerAadhar"
        value={joiningFormData.addressAsPerAadhar}
        onChange={handleJoiningInputChange}
        rows={3}
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
       
      />
    </div>
  </div>

  {/* Section 4: Employment Details */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Date Of Joining *</label>
      <input
        type="date"
        name="dateOfJoining"
        value={joiningFormData.dateOfJoining}
        onChange={handleJoiningInputChange}
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
       
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Joining Place</label>
      <input
        type="text"
        name="joiningPlace"
        value={joiningFormData.joiningPlace}
        onChange={handleJoiningInputChange}
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Designation *</label>
      <input
        type="text"
        name="designation"
        value={joiningFormData.designation}
        onChange={handleJoiningInputChange}
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
      
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Salary</label>
      <input
        type="number"
        name="salary"
        value={joiningFormData.salary}
        onChange={handleJoiningInputChange}
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Joining Company Name *</label>
      <input
        name="joiningCompanyName"
        value={joiningFormData.joiningCompanyName}
        onChange={handleJoiningInputChange}
        
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Mode of Attendance *</label>
      <input
        name="modeOfAttendance"
        value={joiningFormData.modeOfAttendance}
        onChange={handleJoiningInputChange}
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
     
      />
    </div>
  </div>

  {/* Section 5: Bank & Financial Details */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Aadhar Number *</label>
      <input
       
     disabled
        value={selectedItem.aadharNo}
        onChange={handleJoiningInputChange}
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Current Account No*</label>
      <input
        
        name="currentBankAc"
        value={joiningFormData.currentBankAc}
        onChange={handleJoiningInputChange}
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code*</label>
      <input
        
        name="ifscCode"
        value={joiningFormData.ifscCode}
        onChange={handleJoiningInputChange}
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Branch Name*</label>
      <input
       
        name="branchName"
        value={joiningFormData.branchName}
        onChange={handleJoiningInputChange}
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode *</label>
      <input
        name="paymentMode"
        value={joiningFormData.paymentMode}
        onChange={handleJoiningInputChange}
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
        
      />
    </div>
  </div>

  {/* Section 6: Company Provisions */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Email ID to be Issue</label>
      <select
        name="emailToBeIssue"
        value={joiningFormData.emailToBeIssue}
        onChange={handleJoiningInputChange}
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
      >
        <option value="">Select</option>
        <option value="Yes">Yes</option>
        <option value="No">No</option>
      </select>
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Issue</label>
      <select
        name="issueMobile"
        value={joiningFormData.issueMobile}
        onChange={handleJoiningInputChange}
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
      >
        <option value="">Select</option>
        <option value="Yes">Yes</option>
        <option value="No">No</option>
      </select>
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Laptop Issue</label>
      <select
        name="issueLaptop"
        value={joiningFormData.issueLaptop}
        onChange={handleJoiningInputChange}
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
      >
        <option value="">Select</option>
        <option value="Yes">Yes</option>
        <option value="No">No</option>
      </select>
    </div>
  </div>

  {/* Section 7: PF/ESIC Details */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Past PF No(if any)</label>
      <input
        name="pastPfId"
        value={joiningFormData.pastPfId}
        onChange={handleJoiningInputChange}
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">ESIC No (IF Any)</label>
      <input
        name="esicNo"
        value={joiningFormData.esicNo}
        onChange={handleJoiningInputChange}
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">PF Eligible</label>
      <select
        name="pfEligible"
        value={joiningFormData.pfEligible}
        onChange={handleJoiningInputChange}
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
      >
        <option value="">Select</option>
        <option value="Yes">Yes</option>
        <option value="No">No</option>
      </select>
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">ESIC Eligible</label>
      <select
        name="esicEligible"
        value={joiningFormData.esicEligible}
        onChange={handleJoiningInputChange}
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
      >
        <option value="">Select</option>
        <option value="Yes">Yes</option>
        <option value="No">No</option>
      </select>
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Highest Qualification</label>
      <input
        name="highestQualification"
        value={joiningFormData.highestQualification}
        onChange={handleJoiningInputChange}
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
      />
    </div>
  </div>

  {/* Section 8: Document Uploads */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Aadhar Card</label>
      <div className="flex items-center space-x-2">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleFileChange(e, 'aadharFrontPhoto')}
          className="hidden"
          id="aadhar-front-upload"
        />
        <label
          htmlFor="aadhar-front-upload"
          className="flex items-center px-4 py-2 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 text-gray-700"
        >
          <Upload size={16} className="mr-2" />
          Upload Photo
        </label>
        {joiningFormData.aadharFrontPhoto && (
          <span className="text-sm text-gray-700">{joiningFormData.aadharFrontPhoto.name}</span>
        )}
      </div>
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Pan Card</label>
      <div className="flex items-center space-x-2">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleFileChange(e, 'aadharBackPhoto')}
          className="hidden"
          id="aadhar-back-upload"
        />
        <label
          htmlFor="aadhar-back-upload"
          className="flex items-center px-4 py-2 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 text-gray-700"
        >
          <Upload size={16} className="mr-2" />
          Upload Photo
        </label>
        {joiningFormData.aadharBackPhoto && (
          <span className="text-sm text-gray-700">{joiningFormData.aadharBackPhoto.name}</span>
        )}
      </div>
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Photo Of Front Bank Passbook</label>
      <div className="flex items-center space-x-2">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleFileChange(e, 'bankPassbookPhoto')}
          className="hidden"
          id="bank-passbook-upload"
        />
        <label
          htmlFor="bank-passbook-upload"
          className="flex items-center px-4 py-2 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 text-gray-700"
        >
          <Upload size={16} className="mr-2" />
          Upload Photo
        </label>
        {joiningFormData.bankPassbookPhoto && (
          <span className="text-sm text-gray-700">{joiningFormData.bankPassbookPhoto.name}</span>
        )}
      </div>
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Qualification Photo</label>
      <div className="flex items-center space-x-2">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleFileChange(e, 'qualificationPhoto')}
          className="hidden"
          id="qualification-photo-upload"
        />
        <label
          htmlFor="qualification-photo-upload"
          className="flex items-center px-4 py-2 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 text-gray-700"
        >
          <Upload size={16} className="mr-2" />
          Upload Photo
        </label>
        {joiningFormData.qualificationPhoto && (
          <span className="text-sm text-gray-700">{joiningFormData.qualificationPhoto.name}</span>
        )}
      </div>
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Salary Slip</label>
      <div className="flex items-center space-x-2">
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => handleFileChange(e, 'salarySlip')}
          className="hidden"
          id="salary-slip-upload"
        />
        <label
          htmlFor="salary-slip-upload"
          className="flex items-center px-4 py-2 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 text-gray-700"
        >
          <Upload size={16} className="mr-2" />
          Upload Document
        </label>
        {joiningFormData.salarySlip && (
          <span className="text-sm text-gray-700">{joiningFormData.salarySlip.name}</span>
        )}
      </div>
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Upload Resume</label>
      <div className="flex items-center space-x-2">
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => handleFileChange(e, 'resumeCopy')}
          className="hidden"
          id="resume-upload"
        />
        <label
          htmlFor="resume-upload"
          className="flex items-center px-4 py-2 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 text-gray-700"
        >
          <Upload size={16} className="mr-2" />
          Upload Resume
        </label>
        {joiningFormData.resumeCopy && (
          <span className="text-sm text-gray-700">{joiningFormData.resumeCopy.name}</span>
        )}
      </div>
    </div>
  </div>

  {/* Form Actions */}
  <div className="flex justify-end space-x-2 pt-4">
    <button
      type="button"
      onClick={() => setShowJoiningModal(false)}
      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
    >
      Cancel
    </button>
    <button
      type="submit"
      className={`px-4 py-2 text-white bg-indigo-700 rounded-md hover:bg-indigo-800 flex items-center justify-center min-h-[42px] ${
        submitting ? 'opacity-90 cursor-not-allowed' : ''
      }`}
      disabled={submitting}
    >
      {submitting ? (
        <>
          <svg className="animate-spin h-4 w-4 text-white mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Submitting...
        </>
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

export default CallTracker;