import React, { useState, useEffect } from 'react';
import { Search, Clock, CheckCircle, X, Upload } from 'lucide-react';
import useDataStore from '../store/dataStore';
import toast from 'react-hot-toast';

const FindEnquiry = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [indentData, setIndentData] = useState([]);
  const [enquiryData, setEnquiryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [generatedCandidateNo, setGeneratedCandidateNo] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);

const [formData, setFormData] = useState({
  candidateName: '',
  candidateDOB: '',
  candidatePhone: '',
  candidateEmail: '',
  previousCompany: '',
  jobExperience: '',
  previousPosition: '',
  maritalStatus: '',
  candidatePhoto: null,
  candidateResume: null,
  presentAddress: '',
  aadharNo: '',
  status: 'NeedMore'
});

  // Google Drive folder ID for file uploads
  const GOOGLE_DRIVE_FOLDER_ID = '12sCqWAuyGR3-Wsxt4qj_FMWR0lmNZIKa';

  // Fetch all necessary data
  const fetchAllData = async () => {
    setLoading(true);
    setTableLoading(true);
    setError(null);
    
    try {
      // Fetch INDENT data
      const indentResponse = await fetch(
        'https://script.google.com/macros/s/AKfycbzF-ERpUfrb0figpapH5q5-J1KRAnBHt-OaXYrN9Cw4wzwaacKhUPwGgtCIWfxw2Ruz9g/exec?sheet=INDENT&action=fetch'
      );
      
      if (!indentResponse.ok) {
        throw new Error(`HTTP error! status: ${indentResponse.status}`);
      }
      
      const indentResult = await indentResponse.json();
      
      if (indentResult.success && indentResult.data && indentResult.data.length >= 7) {
        const headers = indentResult.data[5].map(h => h.trim());
        const dataFromRow7 = indentResult.data.slice(6);
        
        const getIndex = (headerName) => headers.findIndex(h => h === headerName);
        
        const processedData = dataFromRow7
          .filter(row => {
            const status = row[getIndex('Status')];
            const planned2 = row[getIndex('Planned 2')];
            const actual2 = row[getIndex('Actual 2')];
            
            return status === 'NeedMore' && 
                   planned2 && 
                   (!actual2 || actual2 === '');
          })
          .map(row => ({
            id: row[getIndex('Timestamp')],
            indentNo: row[getIndex('Indent Number')],
            post: row[getIndex('Post')],
            gender: row[getIndex('Gender')],
            prefer: row[getIndex('Prefer')],
            numberOfPost: row[getIndex('Number Of Posts')],
            competitionDate: row[getIndex('Completion Date')],
            socialSite: row[getIndex('Social Site')],
            status: row[getIndex('Status')],
            plannedDate: row[getIndex('Planned 2')],
            actual: row[getIndex('Actual 2')]
          }));
         const pendingTasks = processedData.filter(
        task => task.plannedDate && !task.actual
      );
      
        setIndentData(pendingTasks);
      } else {
        throw new Error(indentResult.error || 'Not enough rows in INDENT sheet data');
      }

      // Fetch ENQUIRY data
      const enquiryResponse = await fetch(
        'https://script.google.com/macros/s/AKfycbzF-ERpUfrb0figpapH5q5-J1KRAnBHt-OaXYrN9Cw4wzwaacKhUPwGgtCIWfxw2Ruz9g/exec?sheet=ENQUIRY&action=fetch'
      );
      
      if (!enquiryResponse.ok) {
        throw new Error(`HTTP error! status: ${enquiryResponse.status}`);
      }
      
      const enquiryResult = await enquiryResponse.json();
      
      if (enquiryResult.success && enquiryResult.data && enquiryResult.data.length > 0) {
        // First row contains headers (row 6 in your sheet)
        const headers = enquiryResult.data[5].map(h => h ? h.trim() : '');
        const enquiryRows = enquiryResult.data.slice(6);
        
        const getEnquiryIndex = (headerName) => headers.findIndex(h => h === headerName);
        
        const processedEnquiryData = enquiryRows
          .filter(row => row[getEnquiryIndex('Timestamp')]) // Filter out empty rows
          .map(row => ({
            id: row[getEnquiryIndex('Timestamp')],
            indentNo: row[getEnquiryIndex('Indent Number')],
            candidateEnquiryNo: row[getEnquiryIndex('Candidate Enquiry Number')],
            applyingForPost: row[getEnquiryIndex('Applying For the Post')],
            candidateName: row[getEnquiryIndex('Candidate Name')],
            candidateDOB: row[getEnquiryIndex('DCB')], // DCB appears to be DOB in your sheet
            candidatePhone: row[getEnquiryIndex('Candidate Phone Number')],
            candidateEmail: row[getEnquiryIndex('Candidate Email')],
            previousCompany: row[getEnquiryIndex('Previous Company Name')],
            jobExperience: row[getEnquiryIndex('Job Experience')] || '',
            lastSalary: row[getEnquiryIndex('Last Salary')] || '',
            previousPosition: row[getEnquiryIndex('Previous Position')] || '',
            reasonForLeaving: row[getEnquiryIndex('Reason For Leaving')] || '',
            maritalStatus: row[getEnquiryIndex('Marital Status')] || '',
            lastEmployerMobile: row[getEnquiryIndex('Last Employer Mobile')] || '',
            candidatePhoto: row[getEnquiryIndex('Candidate Photo')] || '',
            candidateResume: row[19] || '',
            referenceBy: row[getEnquiryIndex('Reference By')] || '',
            presentAddress: row[getEnquiryIndex('Present Address')] || '',
            aadharNo: row[getEnquiryIndex('Aadhar No')] || ''
          }));
        
        setEnquiryData(processedEnquiryData);
       // addEnquiry(processedEnquiryData);
      } else {
        throw new Error(enquiryResult.error || 'Not enough rows in ENQUIRY sheet data');
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

  // Generate candidate number based on existing enquiries
  const generateCandidateNumber = () => {
    if (enquiryData.length === 0) {
      return 'ENQ-01';
    }
    
    // Find the highest existing candidate number
    const lastNumber = enquiryData.reduce((max, enquiry) => {
      if (!enquiry.candidateEnquiryNo) return max;
      
      const match = enquiry.candidateEnquiryNo.match(/ENQ-(\d+)/i);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        return num > max ? num : max;
      }
      return max;
    }, 0);
    
    const nextNumber = lastNumber + 1;
    return `ENQ-${String(nextNumber).padStart(2, '0')}`;
  };

  // Convert file to base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  // Upload file to Google Drive
  const uploadFileToGoogleDrive = async (file, type) => {
    try {
      const base64Data = await fileToBase64(file);
      
      const response = await fetch(
        'https://script.google.com/macros/s/AKfycbzF-ERpUfrb0figpapH5q5-J1KRAnBHt-OaXYrN9Cw4wzwaacKhUPwGgtCIWfxw2Ruz9g/exec',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            action: 'uploadFile',
            base64Data: base64Data,
            fileName: `${generatedCandidateNo}_${type}_${file.name}`,
            mimeType: file.type,
            folderId: GOOGLE_DRIVE_FOLDER_ID
          }),
        }
      );

      const result = await response.json();
      
      if (result.success) {
        return result.fileUrl;
      } else {
        throw new Error(result.error || 'File upload failed');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // const pendingData = indentData.filter(item => 
  //   !enquiryData.some(enquiry => enquiry.indentNo === item.indentNo)
  // );

  const historyData = enquiryData;

  const handleEnquiryClick = (item) => {
    setSelectedItem(item);
    const candidateNo = generateCandidateNumber();
    setGeneratedCandidateNo(candidateNo);
    setFormData({
      candidateName: '',
      candidateDOB: '',
      candidatePhone: '',
      candidateEmail: '',
      previousCompany: '',
      jobExperience: '',
      lastSalary: '',
      previousPosition: '',
      reasonForLeaving: '',
      maritalStatus: '',
      lastEmployerMobile: '',
      candidatePhoto: null,
      candidateResume: null,
      referenceBy: '',
      presentAddress: '',
      aadharNo: '',
      status: 'NeedMore'
    });
    setShowModal(true);
  };

  const formatDOB = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString; // Return as-is if not a valid date
    }
    
    const day = date.getDate();
    const month = date.toLocaleString('default', { month: 'long' });
    const year = date.getFullYear().toString().slice(-2);
    
    return `${day}-${month}-${year}`;
  };

const handleSubmit = async (e) => {
  e.preventDefault();
  setSubmitting(true);

  try {
    let photoUrl = '';
    let resumeUrl = '';

    // Upload photo if exists
    if (formData.candidatePhoto) {
      setUploadingPhoto(true);
      photoUrl = await uploadFileToGoogleDrive(formData.candidatePhoto, 'photo');
      setUploadingPhoto(false);
      toast.success('Photo uploaded successfully!');
    }

    // Upload resume if exists
    if (formData.candidateResume) {
      setUploadingResume(true);
      resumeUrl = await uploadFileToGoogleDrive(formData.candidateResume, 'resume');
      setUploadingResume(false);
      toast.success('Resume uploaded successfully!');
    }

    const now = new Date();
    const formattedTimestamp = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;

    const rowData = [
      formattedTimestamp,                           // Column A: Timestamp
      selectedItem.indentNo,                        // Column B: Indent Number
      generatedCandidateNo,                         // Column C: Candidate Enquiry Number
      selectedItem.post,                            // Column D: Applying For the Post
      formData.candidateName,                       // Column E: Candidate Name
      formatDOB(formData.candidateDOB),            // Column F: DCB (DOB)
      formData.candidatePhone,                      // Column G: Candidate Phone Number
      formData.candidateEmail,                      // Column H: Candidate Email
      formData.previousCompany || '',               // Column I: Previous Company Name
      formData.jobExperience || '',                 // Column J: Job Experience
      '',                    // Column K: Last Salary
      formData.previousPosition || '',              // Column L: Previous Position
      '',              // Column M: Reason For Leaving
      formData.maritalStatus || '',                 // Column N: Marital Status
      '',            // Column O: Last Employer Mobile
      photoUrl,                                     // Column P: Candidate Photo (URL)
      '',                   // Column Q: Reference By
      formData.presentAddress || '',                // Column R: Present Address
      formData.aadharNo || '',                      // Column S: Aadhar No
      resumeUrl,                                    // Column T: Candidate Resume (URL)
    ];

    console.log('Submitting to ENQUIRY sheet:', rowData);

    // Submit to ENQUIRY sheet
    const enquiryResponse = await fetch(
      'https://script.google.com/macros/s/AKfycbzF-ERpUfrb0figpapH5q5-J1KRAnBHt-OaXYrN9Cw4wzwaacKhUPwGgtCIWfxw2Ruz9g/exec',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          sheetName: 'ENQUIRY',
          action: 'insert',
          rowData: JSON.stringify(rowData)
        }),
      }
    );

    const enquiryResult = await enquiryResponse.json();
    console.log('ENQUIRY response:', enquiryResult);

    if (!enquiryResult.success) {
      throw new Error(enquiryResult.error || 'ENQUIRY submission failed');
    }

    // Only update INDENT sheet if status is Complete
    if (formData.status === 'Complete') {
      console.log('Updating INDENT sheet for status Complete');
      
      // Fetch INDENT data
      const indentFetchResponse = await fetch(
        'https://script.google.com/macros/s/AKfycbzF-ERpUfrb0figpapH5q5-J1KRAnBHt-OaXYrN9Cw4wzwaacKhUPwGgtCIWfxw2Ruz9g/exec?sheet=INDENT&action=fetch'
      );
      
      const indentData = await indentFetchResponse.json();
      console.log('INDENT data fetched:', indentData);

      if (!indentData.success) {
        throw new Error('Failed to fetch INDENT data: ' + (indentData.error || 'Unknown error'));
      }

      // Find the row index
      let rowIndex = -1;
      for (let i = 1; i < indentData.data.length; i++) {
        if (indentData.data[i][1] === selectedItem.indentNo) {
          rowIndex = i + 1; // Spreadsheet rows start at 1
          break;
        }
      }

      if (rowIndex === -1) {
        throw new Error(`Could not find indentNo: ${selectedItem.indentNo} in INDENT sheet`);
      }

      console.log('Found row index:', rowIndex);

      // Get headers
      const headers = indentData.data[5];
      console.log('Headers:', headers);

      // Find column indices
      const getColumnIndex = (columnName) => {
        return headers.findIndex(h => h && h.toString().trim() === columnName);
      };

      const statusIndex = getColumnIndex('Status');
      const actual2Index = getColumnIndex('Actual 2');

      console.log('Status column index:', statusIndex);
      console.log('Actual 2 column index:', actual2Index);

      // Update Status column
      if (statusIndex !== -1) {
        console.log('Updating Status column...');
        const statusResponse = await fetch(
          'https://script.google.com/macros/s/AKfycbzF-ERpUfrb0figpapH5q5-J1KRAnBHt-OaXYrN9Cw4wzwaacKhUPwGgtCIWfxw2Ruz9g/exec',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              sheetName: 'INDENT',
              action: 'updateCell',
              rowIndex: rowIndex.toString(),
              columnIndex: (statusIndex + 1).toString(), // Convert to string
              value: 'Complete'
            }),
          }
        );

        const statusResult = await statusResponse.json();
        console.log('Status update result:', statusResult);

        if (!statusResult.success) {
          console.error('Status update failed:', statusResult.error);
        }
      }

      // Update Actual 2 column
      if (actual2Index !== -1) {
        console.log('Updating Actual 2 column...');
        const actual2Response = await fetch(
          'https://script.google.com/macros/s/AKfycbzF-ERpUfrb0figpapH5q5-J1KRAnBHt-OaXYrN9Cw4wzwaacKhUPwGgtCIWfxw2Ruz9g/exec',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              sheetName: 'INDENT',
              action: 'updateCell',
              rowIndex: rowIndex.toString(),
              columnIndex: (actual2Index + 1).toString(), // Convert to string
              value: formattedTimestamp
            }),
          }
        );

        const actual2Result = await actual2Response.json();
        console.log('Actual 2 update result:', actual2Result);

        if (!actual2Result.success) {
          console.error('Actual 2 update failed:', actual2Result.error);
        }
      }
      
      toast.success('Enquiry submitted and INDENT marked as Complete!');
    } else {
      toast.success('Enquiry submitted successfully!');
    }

    setShowModal(false);
    fetchAllData();

  } catch (error) {
    console.error('Submission error:', error);
    toast.error(`Error: ${error.message}`);
  } finally {
    setSubmitting(false);
    setUploadingPhoto(false);
    setUploadingResume(false);
  }
};

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e, field) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }

      setFormData(prev => ({
        ...prev,
        [field]: file
      }));
    }
  };

  const filteredPendingData = indentData.filter(item => {
    const matchesSearch = item.post?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.indentNo?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const filteredHistoryData = historyData.filter(item => {
    const matchesSearch = item.candidateName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.candidateEnquiryNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.indentNo?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Find Enquiry</h1>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-lg shadow flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-4">
        <div className="flex flex-1 max-w-md">
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-10 pr-4 py-2 border border-gray-400 border-opacity-30 rounded-lg focus:outline-none focus:ring-2  bg-white bg-opacity-10 focus:ring-indigo-500 text-gray-600  "
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
                  ?'border-indigo-500 text-indigo-600'
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
              <table className="min-w-full divide-y divide-gray-200 ">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium  text-gray-500 uppercase tracking-wider">Action</th>
                    <th className="px-6 py-3 text-left text-xs font-medium  text-gray-500 uppercase tracking-wider">Indent No.</th>
                    <th className="px-6 py-3 text-left text-xs font-medium  text-gray-500 uppercase tracking-wider">Post</th>
                    <th className="px-6 py-3 text-left text-xs font-medium  text-gray-500 uppercase tracking-wider">Gender</th>
                    <th className="px-6 py-3 text-left text-xs font-medium  text-gray-500 uppercase tracking-wider">Prefer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium  text-gray-500 uppercase tracking-wider">Number Of Post</th>
                    <th className="px-6 py-3 text-left text-xs font-medium  text-gray-500 uppercase tracking-wider">Competition Date</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tableLoading ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-12 text-center">
                        <div className="flex justify-center flex-col items-center">
                          <div className="w-6 h-6 border-4 border-indigo-500 border-dashed rounded-full animate-spin mb-2"></div>
                          <span className="text-gray-600 text-sm">Loading pending enquiries...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredPendingData.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-12 text-center">
                        <p className="text-gray-500">No pending enquiries found.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredPendingData.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleEnquiryClick(item)}
                            className="px-3 py-1 text-white bg-indigo-700 rounded-md hover:bg-opacity-90 text-sm"
                          >
                            Enquiry
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.indentNo}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.post}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.gender}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.prefer || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.numberOfPost}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.competitionDate ? new Date(item.competitionDate).toLocaleDateString() : '-'}
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Indent No.</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Enquiry No.</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Post</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Candidate Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Experience</th>
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
                          <span className="text-gray-600 text-sm">Loading enquiry history...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredHistoryData.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="px-6 py-12 text-center">
                        <p className="text-gray-500">No enquiry history found.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredHistoryData.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.indentNo}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.candidateEnquiryNo}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.applyingForPost}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.candidateName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.candidatePhone}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.candidateEmail}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.jobExperience}</td>
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
        </div>
      </div>

      {/* Modal */}
      {showModal && selectedItem && (
        <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-300 border-opacity-20">
              <h3 className="text-lg font-medium text-gray-500">Candidate Enquiry Form</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-opacity-80">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Indent No.</label>
                  <input
                    type="text"
                    value={selectedItem.indentNo}
                    disabled
                    className="w-full border border-gray-300 border-opacity-30 rounded-md px-3 py-2 bg-white bg-opacity-5 text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Candidate Enquiry No.</label>
                  <input
                    type="text"
                    value={generatedCandidateNo}
                    disabled
                    className="w-full border border-gray-300 border-opacity-30 rounded-md px-3 py-2 bg-white bg-opacity-5 text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Applying For Post</label>
                  <input
                    type="text"
                    value={selectedItem.post}
                    disabled
                    className="w-full border border-gray-300 border-opacity-30 rounded-md px-3 py-2 bg-white bg-opacity-5 text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Candidate Name *</label>
                  <input
                    type="text"
                    name="candidateName"
                    value={formData.candidateName}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 border-opacity-30 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white bg-white bg-opacity-10 text-gray-500 placeholder-white placeholder-opacity-60"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Candidate DOB</label>
                  <input
                    type="date"
                    name="candidateDOB"
                    value={formData.candidateDOB}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 border-opacity-30 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white bg-white bg-opacity-10 text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Candidate Phone *</label>
                  <input
                    type="tel"
                    name="candidatePhone"
                    value={formData.candidatePhone}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 border-opacity-30 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white bg-white bg-opacity-10 text-gray-500 placeholder-white placeholder-opacity-60"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Candidate Email</label>
                  <input
                    type="email"
                    name="candidateEmail"
                    value={formData.candidateEmail}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 border-opacity-30 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white bg-white bg-opacity-10 text-gray-500 placeholder-white placeholder-opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Previous Company</label>
                  <input
                    type="text"
                    name="previousCompany"
                    value={formData.previousCompany}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 border-opacity-30 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white bg-white bg-opacity-10 text-gray-500 placeholder-white placeholder-opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Job Experience</label>
                  <input
                    type="text"
                    name="jobExperience"
                    value={formData.jobExperience}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 border-opacity-30 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white bg-white bg-opacity-10 text-gray-500 placeholder-white placeholder-opacity-60"
                  />
                </div>
                {/* <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Last Salary Drawn</label>
                  <input
                    type="number"
                    name="lastSalary"
                    value={formData.lastSalary}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 border-opacity-30 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white bg-white bg-opacity-10 text-gray-500 placeholder-white placeholder-opacity-60"
                  />
                </div> */}
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Previous Position</label>
                  <input
                    type="text"
                    name="previousPosition"
                    value={formData.previousPosition}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 border-opacity-30 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white bg-white bg-opacity-10 text-gray-500 placeholder-white placeholder-opacity-60"
                  />
                </div>
                {/* <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Reason for Leaving</label>
                  <input
                    type="text"
                    name="reasonForLeaving"
                    value={formData.reasonForLeaving}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 border-opacity-30 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white bg-white bg-opacity-10 text-gray-500 placeholder-white placeholder-opacity-60"
                  />
                </div> */}
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Marital Status</label>
                  <select
                    name="maritalStatus"
                    value={formData.maritalStatus}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 border-opacity-30 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white bg-white bg-opacity-10 text-gray-500"
                  >
                    <option value="">Select Status</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Divorced">Divorced</option>
                  </select>
                </div>
                {/* <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Last Employer Mobile</label>
                  <input
                    type="tel"
                    name="lastEmployerMobile"
                    value={formData.lastEmployerMobile}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 border-opacity-30 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white bg-white bg-opacity-10 text-gray-500 placeholder-white placeholder-opacity-60"
                  />
                </div> */}
                {/* <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Reference By</label>
                  <input
                    type="text"
                    name="referenceBy"
                    value={formData.referenceBy}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 border-opacity-30 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white bg-white bg-opacity-10 text-gray-500 placeholder-white placeholder-opacity-60"
                  />
                </div> */}
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Aadhar No.*</label>
                  <input
                    type="text"
                    name="aadharNo"
                    value={formData.aadharNo}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 border-opacity-30 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white bg-white bg-opacity-10 text-gray-500 placeholder-white placeholder-opacity-60"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Present Address</label>
                <textarea
                  name="presentAddress"
                  value={formData.presentAddress}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full border border-gray-300 border-opacity-30 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white bg-white bg-opacity-10 text-gray-500 placeholder-white placeholder-opacity-60"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Candidate Photo</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="file"
                      accept="image/*,.pdf,.doc,.docx"
                      onChange={(e) => handleFileChange(e, 'candidatePhoto')}
                      className="hidden"
                      id="photo-upload"
                    />
                    <label
                      htmlFor="photo-upload"
                      className="flex items-center px-4 py-2 border border-gray-300 border-opacity-30 rounded-md cursor-pointer hover:bg-white hover:bg-opacity-10 text-gray-500"
                    >
                      <Upload size={16} className="mr-2" />
                      {uploadingPhoto ? 'Uploading...' : 'Upload File'}
                    </label>
                    {formData.candidatePhoto && !uploadingPhoto && (
                      <span className="text-sm text-gray-500 opacity-80">{formData.candidatePhoto.name}</span>
                    )}
                    {uploadingPhoto && (
                      <div className="flex items-center">
                        <div className="w-4 h-4 border-2 border-indigo-500 border-dashed rounded-full animate-spin mr-2"></div>
                        <span className="text-sm text-gray-500">Uploading photo...</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Max 10MB. Supports: JPG, JPEG, PNG, PDF, DOC, DOCX</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Candidate Resume</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileChange(e, 'candidateResume')}
                      className="hidden"
                      id="resume-upload"
                    />
                    <label
                      htmlFor="resume-upload"
                      className="flex items-center px-4 py-2 border border-gray-300 border-opacity-30 rounded-md cursor-pointer hover:bg-white hover:bg-opacity-10 text-gray-500"
                    >
                      <Upload size={16} className="mr-2" />
                      {uploadingResume ? 'Uploading...' : 'Upload File'}
                    </label>
                    {formData.candidateResume && !uploadingResume && (
                      <span className="text-sm text-gray-500 opacity-80">{formData.candidateResume.name}</span>
                    )}
                    {uploadingResume && (
                      <div className="flex items-center">
                        <div className="w-4 h-4 border-2 border-indigo-500 border-dashed rounded-full animate-spin mr-2"></div>
                        <span className="text-sm text-gray-500">Uploading resume...</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Max 10MB. Supports: PDF, DOC, DOCX, JPG, JPEG, PNG</p>
                </div>
                
              </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Status *</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 border-opacity-30 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white bg-white bg-opacity-10 text-gray-500"
                    required
                  >
                    <option value="NeedMore">Need More </option>
                    <option value="Complete">Complete</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 border-opacity-30 rounded-md text-gray-500 hover:bg-white hover:bg-opacity-10"
                  disabled={submitting || uploadingPhoto || uploadingResume}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-indigo-700 rounded-md hover:bg-opacity-90 flex items-center justify-center"
                  disabled={submitting || uploadingPhoto || uploadingResume}
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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

export default FindEnquiry;