import React, { useEffect, useState } from 'react';
import { User, Mail, Phone, MapPin, Calendar, Building, Edit3, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';

const MyProfile = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchJoiningData = async () => {
    try {
      // Get user data from localStorage
      const userData = localStorage.getItem('user');
      if (!userData) {
        throw new Error('No user data found in localStorage');
      }

      const currentUser = JSON.parse(userData);
      const userName = currentUser.Name;

      // Fetch data from the sheet API
      const response = await fetch(
        'https://script.google.com/macros/s/AKfycbzF-ERpUfrb0figpapH5q5-J1KRAnBHt-OaXYrN9Cw4wzwaacKhUPwGgtCIWfxw2Ruz9g/exec?sheet=JOINING&action=fetch'
      );
      
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
        if (index === -1) {
          console.warn(`Column "${headerName}" not found in sheet`);
        }
        return index;
      };

      const processedData = dataRows.map(row => ({
        timestamp: row[getIndex('Timestamp')] || '',
        joiningNo: row[getIndex('Employee ID')] || '',
        candidateName: row[getIndex('Name As Per Aadhar')] || '',
         candidatePhoto: row[getIndex("Candidate's Photo")] || '',
        fatherName: row[getIndex('Father Name')] || '',
        dateOfJoining: row[getIndex('Date Of Joining')] || '',
        joiningPlace: row[getIndex('Joining Place')] || '',
        designation: row[getIndex('Designation')] || '',
        salary: row[getIndex('Salary')] || '',
        currentAddress: row[getIndex('Current Address')] || '',
        addressAsPerAadhar: row[getIndex('Address As Per Aadhar Card')] || '',
        bodAsPerAadhar: row[getIndex('Date Of Birth As Per Aadhar Card')] || '',
        gender: row[getIndex('Gender')] || '',
        mobileNo: row[getIndex('Mobile No.')] || '',
        familyMobileNo: row[getIndex('Family Mobile No.')] || '',
        relationWithFamily: row[getIndex('Relationship With Family Person')] || '',
        email: row[getIndex('Personal Email-Id')] || '', 
        companyName: row[getIndex('Joining Company Name')] || '',
        aadharNo: row[getIndex('Aadhar Card No')] || '',
      }));

      
      // Filter data for the current user
      const filteredData = processedData.filter(task => 
        task.candidateName?.trim().toLowerCase() === userName.trim().toLowerCase()
      );

     // Inside fetchJoiningData(), after filtering user data
if (filteredData.length > 0) {
  const profile = filteredData[0];
  setProfileData(profile);
  setFormData(profile);

  // ✅ Store employeeId in localStorage
  localStorage.setItem("employeeId", profile.joiningNo);
} else {
  toast.error('No profile data found for current user');
}

      
    } catch (error) {
      console.error('Error fetching joining data:', error);
      toast.error(`Failed to load profile data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJoiningData();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };


  const handleSave = async () => {
  try {
    setLoading(true);
    
    // 1. Fetch current data from JOINING sheet
    const fullDataResponse = await fetch(
      'https://script.google.com/macros/s/AKfycbzF-ERpUfrb0figpapH5q5-J1KRAnBHt-OaXYrN9Cw4wzwaacKhUPwGgtCIWfxw2Ruz9g/exec?sheet=JOINING&action=fetch'
    );
    
    if (!fullDataResponse.ok) {
      throw new Error(`HTTP error! status: ${fullDataResponse.status}`);
    }

    const fullDataResult = await fullDataResponse.json();
    const allData = fullDataResult.data || fullDataResult;

    // 2. Find header row (assuming it's row 6 as in your original code)
    let headerRowIndex = 5; // 0-based index for row 6
    const headers = allData[headerRowIndex].map(h => h?.toString().trim());

    // 3. Find Employee ID column index
    const employeeIdIndex = headers.findIndex(h => h?.toLowerCase() === "employee id");
    if (employeeIdIndex === -1) {
      throw new Error("Could not find 'Employee ID' column");
    }

    // 4. Find the employee row index
    const rowIndex = allData.findIndex((row, idx) =>
      idx > headerRowIndex &&
      row[employeeIdIndex]?.toString().trim() === profileData.joiningNo?.toString().trim()
    );
    
    if (rowIndex === -1) throw new Error(`Employee ${profileData.joiningNo} not found`);

    // 5. Get a copy of the existing row
    let currentRow = [...allData[rowIndex]];

    // 6. Apply updates to the row data
    // Map form fields to their respective column indices
    const headerMap = {
      'Mobile No.': headers.findIndex(h => h?.toLowerCase() === 'mobile no.'),
      'Family Mobile No.': headers.findIndex(h => h?.toLowerCase() === 'family mobile no.'),
      'Personal Email-Id': headers.findIndex(h => h?.toLowerCase() === 'personal email-id'),
      'Current Address': headers.findIndex(h => h?.toLowerCase() === 'current address')
      // Add more fields as needed
    };

    // Only update fields that are editable in the form
    if (headerMap['Mobile No.'] !== -1) {
      currentRow[headerMap['Mobile No.']] = formData.mobileNo || '';
    }
    if (headerMap['Family Mobile No.'] !== -1) {
      currentRow[headerMap['Family Mobile No.']] = formData.familyMobileNo || '';
    }
    if (headerMap['Personal Email-Id'] !== -1) {
      currentRow[headerMap['Personal Email-Id']] = formData.email || '';
    }
    if (headerMap['Current Address'] !== -1) {
      currentRow[headerMap['Current Address']] = formData.currentAddress || '';
    }

    // 7. Prepare payload
    const payload = {
      sheetName: "JOINING",
      action: "update",
      rowIndex: rowIndex + 1, // Convert to 1-based index
      rowData: JSON.stringify(currentRow)
    };

    console.log("Final payload being sent:", payload);

    // 8. Send update request
    const response = await fetch(
      "https://script.google.com/macros/s/AKfycbzF-ERpUfrb0figpapH5q5-J1KRAnBHt-OaXYrN9Cw4wzwaacKhUPwGgtCIWfxw2Ruz9g/exec",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(payload).toString(),
      }
    );

    const result = await response.json();
    console.log("Update result:", result);

    if (result.success) {
      // Update local state only after successful API update
      setProfileData(formData);
      toast.success('Profile updated successfully!');
      setIsEditing(false);
    } else {
      throw new Error(result.error || "Failed to update data");
    }

  } catch (error) {
    console.error('Error updating profile:', error);
    toast.error(`Failed to update profile: ${error.message}`);
  } finally {
    setLoading(false);
  }
};

  const handleCancel = () => {
    setFormData(profileData || {});
    setIsEditing(false);
  };

  if (loading) {
    return <div className="page-content p-6"><div className="flex justify-center flex-col items-center">
                        <div className="w-6 h-6 border-4 border-indigo-500 border-dashed rounded-full animate-spin mb-2"></div>
                        <span className="text-gray-600 text-sm">Loading pending calls...</span>
                      </div></div>;
  }

  if (!profileData) {
    return <div className="page-content p-6">No profile data available</div>;
  }


  return (
    <div className="space-y-6 page-content p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>
        <div className="flex space-x-2">
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Edit3 size={16} className="mr-2" />
              Edit Profile
            </button>
          ) : (
            <div className="flex space-x-2">
              <button
                onClick={handleSave}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Save size={16} className="mr-2" />
                Save
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                <X size={16} className="mr-2" />
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Picture & Basic Info */}
        <div className="bg-white rounded-xl shadow-lg border p-6">
          <div className="text-center">
            <div className="w-32 h-32 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
             <img className='h-10 w-10' src={profileData.candidatePhoto}/>
            </div>
            <h2 className="text-xl font-bold text-gray-800">{profileData.candidateName}</h2>
            <p className="text-gray-600">{profileData.designation}</p>
            <p className="text-sm text-gray-500">{profileData.joiningNo}</p>
          </div>
        </div>

        {/* Personal Information */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-lg border p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-6">Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Mail size={16} className="inline mr-2" />
                Email Address
              </label>
              {isEditing ? (
                <input
                  type="email"
                  name="email"
                  value={formData.email || ''}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              ) : (
                <p className="text-gray-800">{profileData.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Phone size={16} className="inline mr-2" />
                Phone Number
              </label>
              {isEditing ? (
                <input
                  type="tel"
                  name="mobileNo"
                  value={formData.mobileNo || ''}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              ) : (
                <p className="text-gray-800">{profileData.mobileNo}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Building size={16} className="inline mr-2" />
                Company
              </label>
              <p className="text-gray-800">{profileData.companyName}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar size={16} className="inline mr-2" />
                Joining Date
              </label>
              <p className="text-gray-800">{profileData.dateOfJoining}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Father's Name</label>
              <p className="text-gray-800">{profileData.fatherName}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
              <p className="text-gray-800">{profileData.gender}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
              <p className="text-gray-800">{profileData.bodAsPerAadhar}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Emergency Contact</label>
              {isEditing ? (
                <input
                  type="tel"
                  name="familyMobileNo"
                  value={formData.familyMobileNo || ''}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              ) : (
                <p className="text-gray-800">{profileData.familyMobileNo}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin size={16} className="inline mr-2" />
                Current Address
              </label>
              {isEditing ? (
                <textarea
                  name="currentAddress"
                  value={formData.currentAddress || ''}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              ) : (
                <p className="text-gray-800 whitespace-pre-line">{profileData.currentAddress}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin size={16} className="inline mr-2" />
                Aadhar Address
              </label>
              <p className="text-gray-800 whitespace-pre-line">{profileData.addressAsPerAadhar}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyProfile;