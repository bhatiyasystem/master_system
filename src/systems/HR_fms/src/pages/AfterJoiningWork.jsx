import { Search, Clock, CheckCircle, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';  
import { supabaseFetchSheet, supabaseMutateSheet } from '../../../../services/supabaseApiAdapter';  
import { fetchTatTracking, renderPlannedDateCell, fetchTatSettings } from '../../../../core/services/tatService';

// Helper to parse custom timestamp string formats to Date
const parseTimestamp = (ts) => {
  if (!ts) return null;
  const parsed = new Date(ts);
  if (!isNaN(parsed.getTime())) return parsed;

  const str = String(ts).trim();
  const parts = str.split(' ');
  const datePart = parts[0];
  const timePart = parts[1] || '00:00:00';

  const dateSplit = datePart.split(/[\/\-]/);
  const timeSplit = timePart.split(':');

  if (dateSplit.length === 3) {
    let day = parseInt(dateSplit[0], 10);
    let month = parseInt(dateSplit[1], 10) - 1;
    let year = parseInt(dateSplit[2], 10);
    
    // Support two-digit years if present
    if (year < 100) year += 2000;

    const hour = parseInt(timeSplit[0] || 0, 10);
    const minute = parseInt(timeSplit[1] || 0, 10);
    const second = parseInt(timeSplit[2] || 0, 10);

    if (month > 11) {
      // Swapped: MM/DD/YYYY format
      return new Date(year, day - 1, month + 1, hour, minute, second);
    }
    return new Date(year, month, day, hour, minute, second);
  }
  return new Date(ts);
};

const AfterJoiningWork = () => {
  const [activeTab, setActiveTab] = useState("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [tatTracking, setTatTracking] = useState({});
  const [tatMins, setTatMins] = useState(20);
  const [, setTick] = useState(0);
  const [_loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [employeeId, setEmployeeId] = useState("");

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (pendingData.length > 0) {
      const ids = pendingData.map(i => i.enquiryNo).filter(Boolean);
      fetchTatTracking('hr_after_joining_work', ids).then(trackings => {
        const trackingMap = {};
        trackings.forEach(t => {
          trackingMap[t.entity_id] = t;
        });
        setTatTracking(trackingMap);
      }).catch(err => console.error('Failed to fetch HR TAT tracking:', err));

      fetchTatSettings().then(settingsData => {
        const setting = settingsData.find(s => s.stage_key === 'hr_after_joining_work');
        if (setting && setting.is_active) {
          setTatMins(setting.tat_minutes);
        }
      }).catch(err => console.error('Failed to fetch HR TAT settings:', err));
    }
  }, [pendingData]);

  const [formData, setFormData] = useState({
    checkSalarySlipResume: false,
    offerLetterReceived: false,
    welcomeMeeting: false,
    biometricAccess: false,
    officialEmailId: false,
    assignAssets: false,
    pfEsic: false,
    companyDirectory: false,
    assets: [],
  });

  const fetchJoiningData = async () => {
    setLoading(true);
    setTableLoading(true);
    setError(null);

    try {
      const response = await supabaseFetchSheet("JOINING");

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log("Raw JOINING API response:", result);

      if (!result.success) {
        throw new Error(
          result.error || "Failed to fetch data from JOINING sheet"
        );
      }

      const rawData = result.data || result;

      if (!Array.isArray(rawData)) {
        throw new Error("Expected array data not received");
      }

      const headers = rawData[5];
      const dataRows = rawData.length > 6 ? rawData.slice(6) : [];

      const getIndex = (headerName) => {
        const index = headers.findIndex(
          (h) =>
            h && h.toString().trim().toLowerCase() === headerName.toLowerCase()
        );
        if (index === -1) {
          console.warn(`Column "${headerName}" not found in sheet`);
        }
        return index;
      };

      const processedData = dataRows.map((row) => ({
        timestamp: row[getIndex("Timestamp")] || "",
        joiningNo: row[getIndex("Employee ID")] || "",
        indentNo: row[getIndex("Indent No")] || "",
        enquiryNo: row[getIndex("Enquiry No")] || "",
        candidateName: row[getIndex("Name As Per Aadhar")] || "",
        fatherName: row[getIndex("Father Name")] || "",
        dateOfJoining: row[getIndex("Date Of Joining")] || "",
        joiningPlace: row[getIndex("Joining Place")] || "",
        designation: row[getIndex("Designation")] || "",
        salary: row[getIndex("Salary")] || "",
        aadharPhoto: row[getIndex("Aadhar Frontside Photo")] || "",
        panCard: row[getIndex("Pan card")] || "",
        candidatePhoto: row[getIndex("Candidate's Photo")] || "",
        currentAddress: row[getIndex("Current Address")] || "",
        addressAsPerAadhar: row[getIndex("Address As Per Aadhar Card")] || "",
        bodAsPerAadhar: row[getIndex("Date Of Birth As Per Aadhar Card")] || "",
        gender: row[getIndex("Gender")] || "",
        mobileNo: row[getIndex("Mobile No.")] || "",
        familyMobileNo: row[getIndex("Family Mobile No.")] || "",
        relationWithFamily:
          row[getIndex("Relationship With Family Person")] || "",
        pfId: row[getIndex("Past Pf Id No. (If Any)")] || "",
        accountNo: row[getIndex("Current Bank A.C No.")] || "",
        ifscCode: row[getIndex("Ifsc Code")] || "",
        branchName: row[getIndex("Branch Name")] || "",
        passbookPhoto: row[getIndex("Photo Of Front Bank Passbook")] || "",
        email: row[getIndex("Personal Email-Id")] || "",
        esicNo: row[getIndex("ESIC No (IF Any)")] || "",
        qualification: row[getIndex("Highest Qualification")] || "",
        pfEligible: row[getIndex("PF Eligible")] || "",
        esicEligible: row[getIndex("ESIC Eligible")] || "",
        companyName: row[getIndex("Joining Company Name")] || "",
        emailToBeIssue: row[getIndex("Email ID To Be Issue")] || "",
        issueMobile: row[getIndex("Issue Mobile")] || "",
        issueLaptop: row[getIndex("Issue Laptop")] || "",
        aadharNo: row[getIndex("Aadhar Card No")] || "",
        modeOfAttendance: row[getIndex("Mode Of Attendance")] || "",
        quaficationPhoto: row[getIndex("Quafication Photo")] || "",
        paymentMode: row[getIndex("Payment Mode")] || "",
        salarySlip: row[getIndex("Salary Slip")] || "",
        resumeCopy: row[getIndex("Resume Copy")] || "",
        plannedDate: row[getIndex("Planned Date")] || "",
        actual: row[getIndex("Actual")] || "",
      })).filter(item => item.candidateName && String(item.candidateName).trim() !== '');

      const pendingTasks = processedData.filter(
        (task) => !task.actual
      );
      console.log("Processed joining data:", processedData);
      setPendingData(pendingTasks);

      const historyTasks = processedData.filter(
        (task) => task.actual
      );
      setHistoryData(historyTasks);
    } catch (error) {
      console.error("Error fetching joining data:", error);
      setError(error.message);
      toast.error(`Failed to load joining data: ${error.message}`);
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  };

  useEffect(() => {
    fetchJoiningData();
  }, []);

  const handleAfterJoiningClick = async (item) => {
    // Reset form data first to prevent previous state from showing
    setFormData({
      checkSalarySlipResume: false,
      offerLetterReceived: false,
      welcomeMeeting: false,
      biometricAccess: false,
      officialEmailId: false,
      assignAssets: false,
      pfEsic: false,
      companyDirectory: false,
      assets: [],
    });
    
    setSelectedItem(item);
    setEmployeeId(item.joiningNo || "");
    setShowModal(true);
    setLoading(true);

    try {
      const fullDataResponse = await supabaseFetchSheet("JOINING");

      if (!fullDataResponse.ok) {
        throw new Error(`HTTP error! status: ${fullDataResponse.status}`);
      }

      const fullDataResult = await fullDataResponse.json();
      const allData = fullDataResult.data || fullDataResult;

      let headerRowIndex = allData.findIndex((row) =>
        row.some((cell) =>
          cell?.toString().trim().toLowerCase().includes("employee id")
        )
      );
      if (headerRowIndex === -1) headerRowIndex = 5;

      const headers = allData[headerRowIndex].map((h) => h?.toString().trim());

      const employeeIdIndex = headers.findIndex(
        (h) => h?.toLowerCase() === "employee id"
      );
      if (employeeIdIndex === -1) {
        throw new Error("Could not find 'Employee ID' column");
      }

      const enquiryNoIndex = headers.findIndex(
        (h) => h?.toLowerCase() === "enquiry no"
      );

      const rowIndex = allData.findIndex((row, idx) => {
        if (idx <= headerRowIndex) return false;
        const matchEmployeeId = item.joiningNo && row[employeeIdIndex]?.toString().trim() === item.joiningNo?.toString().trim();
        const matchEnquiryNo = item.enquiryNo && row[enquiryNoIndex]?.toString().trim() === item.enquiryNo?.toString().trim();
        return matchEmployeeId || matchEnquiryNo;
      });

      if (rowIndex === -1)
        throw new Error(`Employee matching ID or Enquiry not found`);

      const startColumnIndex = 43;

      const currentValues = {
        checkSalarySlipResume:
          allData[rowIndex][startColumnIndex + 2]
            ?.toString()
            .trim()
            .toLowerCase() === "yes",
        offerLetterReceived:
          allData[rowIndex][startColumnIndex + 3]
            ?.toString()
            .trim()
            .toLowerCase() === "yes",
        welcomeMeeting:
          allData[rowIndex][startColumnIndex + 4]
            ?.toString()
            .trim()
            .toLowerCase() === "yes",
        biometricAccess:
          allData[rowIndex][startColumnIndex + 5]
            ?.toString()
            .trim()
            .toLowerCase() === "yes",
        officialEmailId:
          allData[rowIndex][startColumnIndex + 6]
            ?.toString()
            .trim()
            .toLowerCase() === "yes",
        assignAssets:
          allData[rowIndex][startColumnIndex + 7]
            ?.toString()
            .trim()
            .toLowerCase() === "yes",
        pfEsic:
          allData[rowIndex][startColumnIndex + 8]
            ?.toString()
            .trim()
            .toLowerCase() === "yes",
        companyDirectory:
          allData[rowIndex][startColumnIndex + 9]
            ?.toString()
            .trim()
            .toLowerCase() === "yes",
      };

      setFormData(currentValues);
    } catch (error) {
      console.error("Error fetching current values:", error);
      // Keep the default reset values if there's an error
      toast.error("Failed to load current values");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckboxChange = (name) => {
    setFormData((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSubmitting(true);

    if ((!selectedItem.joiningNo && !selectedItem.enquiryNo) || !selectedItem.candidateName) {
      toast.error("Please fill all required fields");
      setSubmitting(false);
      return;
    }

    try {
      const fullDataResponse = await supabaseFetchSheet("JOINING");
      if (!fullDataResponse.ok) {
        throw new Error(`HTTP error! status: ${fullDataResponse.status}`);
      }

      const fullDataResult = await fullDataResponse.json();
      const allData = fullDataResult.data || fullDataResult;

      let headerRowIndex = allData.findIndex((row) =>
        row.some((cell) =>
          cell?.toString().trim().toLowerCase().includes("employee id")
        )
      );
      if (headerRowIndex === -1) headerRowIndex = 5;

      const headers = allData[headerRowIndex].map((h) => h?.toString().trim());

      const employeeIdIndex = headers.findIndex(
        (h) => h?.toLowerCase() === "employee id"
      );
      if (employeeIdIndex === -1) {
        throw new Error("Could not find 'Employee ID' column");
      }

      const enquiryNoIndex = headers.findIndex(
        (h) => h?.toLowerCase() === "enquiry no"
      );

      const rowIndex = allData.findIndex((row, idx) => {
        if (idx <= headerRowIndex) return false;
        const matchEmployeeId = selectedItem.joiningNo && row[employeeIdIndex]?.toString().trim() === selectedItem.joiningNo?.toString().trim();
        const matchEnquiryNo = selectedItem.enquiryNo && row[enquiryNoIndex]?.toString().trim() === selectedItem.enquiryNo?.toString().trim();
        return matchEmployeeId || matchEnquiryNo;
      });
      if (rowIndex === -1)
        throw new Error(`Employee not found`);

      const now = new Date();
      const formattedTimestamp = `${now.getDate()}/${
        now.getMonth() + 1
      }/${now.getFullYear()} `;

      const allFieldsYes =
        formData.checkSalarySlipResume &&
        formData.offerLetterReceived &&
        formData.welcomeMeeting &&
        formData.biometricAccess &&
        formData.officialEmailId &&
        formData.assignAssets &&
        formData.pfEsic &&
        formData.companyDirectory;

      const startColumnIndex = 43;

      const updatePromises = [];

      updatePromises.push(
        supabaseMutateSheet("JOINING", "updateCell", {
          rowIndex: (rowIndex + 1).toString(),
          columnIndex: (employeeIdIndex + 1).toString(),
          value: employeeId,
        })
      );

      // If all fields are checked, update both Actual (col 43) and Actual Date (col 44) columns with timestamp; otherwise, clear them.
      updatePromises.push(
        supabaseMutateSheet("JOINING", "updateCell", {
          rowIndex: (rowIndex + 1).toString(),
          columnIndex: "43",
          value: allFieldsYes ? formattedTimestamp : "",
        })
      );
      updatePromises.push(
        supabaseMutateSheet("JOINING", "updateCell", {
          rowIndex: (rowIndex + 1).toString(),
          columnIndex: (startColumnIndex + 1).toString(),
          value: allFieldsYes ? formattedTimestamp : "",
        })
      );

      const fields = [
        { value: formData.checkSalarySlipResume ? "Yes" : "No", offset: 2 },
        { value: formData.offerLetterReceived ? "Yes" : "No", offset: 3 },
        { value: formData.welcomeMeeting ? "Yes" : "No", offset: 4 },
        { value: formData.biometricAccess ? "Yes" : "No", offset: 5 },
        { value: formData.officialEmailId ? "Yes" : "No", offset: 6 },
        { value: formData.assignAssets ? "Yes" : "No", offset: 7 },
        { value: formData.pfEsic ? "Yes" : "No", offset: 8 },
        { value: formData.companyDirectory ? "Yes" : "No", offset: 9 },
      ];

      fields.forEach((field) => {
        updatePromises.push(
          supabaseMutateSheet("JOINING", "updateCell", {
            rowIndex: (rowIndex + 1).toString(),
            columnIndex: (startColumnIndex + field.offset + 1).toString(),
            value: field.value,
          })
        );
      });

      const responses = await Promise.all(updatePromises);
      const results = await Promise.all(responses.map((r) => r.json()));

      const hasError = results.some((result) => !result.success);
      if (hasError) {
        console.error("Some cell updates failed:", results);
        throw new Error("Some cell updates failed");
      }

      if (allFieldsYes) {
        toast.success("All conditions met! Actual date updated successfully.");
      } else {
        toast.success(
          "Conditions updated successfully. Actual date will be updated when all conditions are met."
        );
      }

      setShowModal(false);
      fetchJoiningData();
    } catch (error) {
      console.error("Update error:", error);
      toast.error(`Update failed: ${error.message}`);
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  const formatDOB = (dateString) => {
    if (!dateString) return "";

    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString;
    }

    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear().toString().slice(-2);

    return `${day}/${month}/${year}`;
  };

  const filteredPendingData = pendingData.filter((item) => {
    const matchesSearch =
      item.candidateName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.joiningNo?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const filteredHistoryData = historyData.filter((item) => {
    const matchesSearch =
      item.candidateName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.joiningNo?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold  ">After Joining Work</h1>
      </div>

      <div className="bg-white  p-4 rounded-lg shadow flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-4">
        <div className="flex flex-1 max-w-md">
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Search by name or employee ID..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300   rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white   text-gray-500    "
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search
              size={20}
              className="absolute left-3 top-1/2 transform -translate-y-1/2  text-gray-500  "
            />
          </div>
        </div>
      </div>

      <div className="bg-white  rounded-lg shadow overflow-hidden">
        <div className="border-b border-gray-300  ">
          <nav className="flex -mb-px">
            <button
              className={`py-4 px-6 font-medium text-sm border-b-2 ${
                activeTab === "pending"
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
              onClick={() => setActiveTab("pending")}
            >
              <Clock size={16} className="inline mr-2" />
              Pending ({filteredPendingData.length})
            </button>
            <button
              className={`py-4 px-6 font-medium text-sm border-b-2 ${
                activeTab === "history"
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
              onClick={() => setActiveTab("history")}
            >
              <CheckCircle size={16} className="inline mr-2" />
              History ({filteredHistoryData.length})
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === "pending" && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Father Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date Of Joining
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Designation
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Salary
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Planned Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white">
                  {tableLoading ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-12 text-center">
                        <div className="flex justify-center flex-col items-center">
                          <div className="w-6 h-6 border-4 border-indigo-500 border-dashed rounded-full animate-spin mb-2"></div>
                          <span className="text-gray-600 text-sm">
                            Loading pending calls...
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-12 text-center">
                        <p className="text-red-500">Error: {error}</p>
                        <button
                          onClick={fetchJoiningData}
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
                            onClick={() => handleAfterJoiningClick(item)}
                            className="px-3 py-1 bg-indigo-700 text-white rounded-md text-sm"
                          >
                            Process
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.joiningNo}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.candidateName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.fatherName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDOB(item.dateOfJoining)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.designation}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.salary}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {renderPlannedDateCell(tatTracking[item.enquiryNo], parseTimestamp(item.timestamp), tatMins)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" className="px-6 py-12 text-center">
                        <p className="text-gray-500">
                          No pending after joining work found.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "history" && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y   divide-white  ">
                <thead className="bg-gray-100  ">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium  text-gray-500 uppercase tracking-wider">
                      Employee ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium  text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium  text-gray-500 uppercase tracking-wider">
                      Designation
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium  text-gray-500 uppercase tracking-wider">
                      Date Of Joining
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium  text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y   divide-white  ">
                  {tableLoading ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center">
                        <div className="flex justify-center flex-col items-center">
                          <div className="w-6 h-6 border-4 border-indigo-500 border-dashed rounded-full animate-spin mb-2"></div>
                          <span className="text-gray-600 text-sm">
                            Loading call history...
                          </span>
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
                      <tr key={index} className="hover:bg-white hover: ">
                        <td className="px-6 py-4 whitespace-nowrap text-sm  text-gray-500">
                          {item.joiningNo}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm  text-gray-500">
                          {item.candidateName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm  text-gray-500">
                          {item.designation}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDOB(item.dateOfJoining)}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-sm  text-gray-500">
                          <span className="px-2 py-1 text-xs rounded-full bg-green-500 font-semibold  text-white">
                            Completed
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {filteredHistoryData.length === 0 && (
                <div className="px-6 py-12 text-center">
                  <p className=" text-gray-500  ">
                    No after joining work history found.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showModal && selectedItem && (
        <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50 p-4 ">
          <div className="bg-white  rounded-lg shadow-lg w-full max-w-2xl">
            <div className="flex justify-between items-center p-6 border-b  ">
              <h3 className="text-lg font-medium  text-gray-500">
                After Joining Work Checklist
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className=" text-gray-500  "
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium  text-gray-500 mb-1">
                    Employee ID
                  </label>
                  <input
                    type="text"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className="w-full border border-gray-300   rounded-md px-3 py-2 bg-white    text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium  text-gray-500 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={selectedItem.candidateName}
                    disabled
                    className="w-full border border-gray-300   rounded-md px-3 py-2 bg-white    text-gray-500"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-md font-medium  text-gray-500">
                  Checklist Items
                </h4>

                {[
                  {
                    key: "checkSalarySlipResume",
                    label: "Check Salary Slip & Resume Copy",
                  },
                  {
                    key: "offerLetterReceived",
                    label: "Offer Letter Received",
                  },
                  { key: "welcomeMeeting", label: "Welcome Meeting" },
                  { key: "biometricAccess", label: "Biometric Access" },
                  { key: "officialEmailId", label: "Official Email ID" },
                  { key: "assignAssets", label: "Assign Assets" },
                  { key: "pfEsic", label: "PF / ESIC" },
                  { key: "companyDirectory", label: "Company Directory" },
                ].map((item) => (
                  <div key={item.key} className="flex items-center">
                    <input
                      type="checkbox"
                      id={item.key}
                      checked={formData[item.key]}
                      onChange={() => handleCheckboxChange(item.key)}
                      className="h-4 w-4  text-gray-500  focus:ring-blue-500 border-gray-300   rounded bg-white"
                    />
                    <label
                      htmlFor={item.key}
                      className="ml-2 text-sm  text-gray-500"
                    >
                      {item.label}
                    </label>
                  </div>
                ))}
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300   rounded-md  text-gray-500 hover:bg-white  "
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-white bg-indigo-700 rounded-md hover:bg-indigo-800 min-h-[42px] flex items-center justify-center ${
                    submitting ? "opacity-90 cursor-not-allowed" : ""
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
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      <span>Submitting...</span>
                    </div>
                  ) : (
                    "Submit"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AfterJoiningWork;