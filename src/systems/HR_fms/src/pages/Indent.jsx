import { Minus, Plus, X } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import useDataStore from '../store/dataStore';
import toast from 'react-hot-toast';
import { supabaseFetchSheet, supabaseMutateSheet } from '../../../../services/supabaseApiAdapter';

const Indent = () => {
  const { _addIndent } = useDataStore();
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    post: '',
    gender: '',
    prefer: '',
    numberOfPost: '',
    completionDate: '',
    socialSite: '',
    indentNumber: '',
    timestamp: '',
  });
  const [indentData, setIndentData] = useState([]);
  const [loading, _setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const findColIndex = (headersLower, names, defaultIdx) => {
    for (const n of names) {
      const idx = headersLower.indexOf(n.toLowerCase());
      if (idx !== -1) return idx;
    }
    return defaultIdx;
  };

  const fetchIndentDataFromRow7 = useCallback(async () => {
    try {
      const response = await supabaseFetchSheet('INDENT');
      const result = await response.json();

      if (result.success && result.data && result.data.length > 1) {
        let headerRowIndex = 0;
        while (
          headerRowIndex < result.data.length &&
          (!result.data[headerRowIndex] || result.data[headerRowIndex].every(cell => !cell || String(cell).trim() === ''))
        ) {
          headerRowIndex++;
        }

        if (headerRowIndex >= result.data.length) {
          return { success: false, error: 'No header row found in sheet' };
        }

        const headers = result.data[headerRowIndex].map(h => h ? String(h).trim() : '');
        const headersLower = headers.map(h => h.toLowerCase());

        const timestampIndex = findColIndex(headersLower, ['timestamp', 'time'], 0);
        const indentNumberIndex = findColIndex(headersLower, ['indent number', 'indentnumber', 'indent_no', 'indentno', 'indent'], 1);
        const postIndex = findColIndex(headersLower, ['post', 'post title', 'position'], 2);
        const genderIndex = findColIndex(headersLower, ['gender'], 3);
        const preferIndex = findColIndex(headersLower, ['prefer', 'preference'], 4);
        const noOFPostIndex = findColIndex(headersLower, ['number of posts', 'no of post', 'no. of post', 'number of post', 'posts', 'no_of_post'], 5);
        const completionDateIndex = findColIndex(headersLower, ['completion date', 'completiondate', 'date'], 6);
        const socialSiteIndex = findColIndex(headersLower, ['social site', 'socialsite', 'social_site'], 7);

        const dataRows = result.data.slice(headerRowIndex + 1);

        const processedData = dataRows
          .filter(row => row && row.some(cell => cell && String(cell).trim() !== ''))
          .map(row => ({
            timestamp: row[timestampIndex] || '',
            indentNumber: row[indentNumberIndex] || '',
            post: row[postIndex] || '',
            gender: row[genderIndex] || '',
            prefer: row[preferIndex] || '',
            noOfPost: row[noOFPostIndex] || '',
            completionDate: row[completionDateIndex] || '',
            socialSite: row[socialSiteIndex] || '',
          }));

        setIndentData(processedData);
        return {
          success: true,
          data: processedData,
          headers: headers
        };
      } else {
        return {
          success: false,
          error: 'Not enough rows in sheet data'
        };
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }, []);

  const fetchLastIndentNumber = async () => {
    try {
      const response = await supabaseFetchSheet('INDENT');
      const result = await response.json();

      if (result.success && result.data && result.data.length > 1) {
        let headerRowIndex = 0;
        while (headerRowIndex < result.data.length &&
          result.data[headerRowIndex].every(cell => !cell || String(cell).trim() === '')) {
          headerRowIndex++;
        }

        if (headerRowIndex >= result.data.length) {
          throw new Error('No header row found in sheet');
        }

        const headers = result.data[headerRowIndex].map(h => h ? String(h).trim().toLowerCase() : '');

        const possibleNames = ['indent number', 'indentnumber', 'indent_no', 'indentno', 'indent'];
        let indentNumberIndex = -1;

        for (const name of possibleNames) {
          indentNumberIndex = headers.indexOf(name);
          if (indentNumberIndex !== -1) break;
        }

        if (indentNumberIndex === -1) {
          indentNumberIndex = 1;
        }

        let lastDataRowIndex = result.data.length - 1;
        while (lastDataRowIndex > headerRowIndex &&
          (!result.data[lastDataRowIndex][indentNumberIndex] ||
            String(result.data[lastDataRowIndex][indentNumberIndex]).trim() === '')) {
          lastDataRowIndex--;
        }

        if (lastDataRowIndex <= headerRowIndex) {
          return {
            success: true,
            lastIndentNumber: 0,
            message: 'No data rows found'
          };
        }

        const lastIndentNumber = result.data[lastDataRowIndex][indentNumberIndex];

        let numericValue = 0;
        if (typeof lastIndentNumber === 'string') {
          const match = lastIndentNumber.match(/\d+/);
          numericValue = match ? parseInt(match[0]) : 0;
        } else {
          numericValue = parseInt(lastIndentNumber) || 0;
        }

        return {
          success: true,
          lastIndentNumber: numericValue,
          fullLastIndent: lastIndentNumber
        };
      } else {
        return {
          success: true,
          lastIndentNumber: 0,
          message: 'Sheet is empty or has no data rows'
        };
      }
    } catch (error) {
      console.error('Error in fetchLastIndentNumber:', error);
      return {
        success: false,
        error: error.message,
        lastIndentNumber: 0
      };
    }
  };

  const generateIndentNumber = async () => {
    try {
      const result = await fetchLastIndentNumber();
      if (result.success) {
        const nextNumber = result.lastIndentNumber + 1;
        return `REC-${String(nextNumber).padStart(2, '0')}`;
      }
      return 'REC-01';
    } catch (error) {
      console.error('Error generating indent number:', error);
      return 'REC-01';
    }
  };

  const getCurrentTimestamp = () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  };

  useEffect(() => {
    const loadData = async () => {
      setTableLoading(true);
      const result = await fetchIndentDataFromRow7();
      if (result.success) {
        console.log('Indent data loaded:', result.data);
      } else {
        console.error('Error fetching indent data:', result.error);
      }
      setTableLoading(false);
    };
    loadData();
  }, [fetchIndentDataFromRow7]);

  const filteredIndentData = indentData.filter(item =>
    [
      item.indentNumber,
      item.post,
      item.gender,
      item.prefer,
      item.noOfPost,
      item.completionDate,
      item.socialSite,
    ].some(value => value !== null && value !== undefined && String(value).trim() !== "")
  );

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !formData.post ||
      !formData.gender ||
      !formData.numberOfPost ||
      !formData.completionDate ||
      !formData.socialSite
    ) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      setSubmitting(true);
      const indentNumber = await generateIndentNumber();
      const timestamp = getCurrentTimestamp();
      const formattedDate = formatDateForSheet(formData.completionDate);

      const rowData = [
        timestamp,
        indentNumber,
        formData.post,
        formData.gender,
        formData.prefer,
        formData.numberOfPost,
        formattedDate,
        formData.socialSite,
        "NeedMore"
      ];

      const response = await supabaseMutateSheet('INDENT', 'insert', { rowData });
      const result = await response.json();

      if (result.success) {
        toast.success('Indent submitted successfully!');
        setFormData({
          post: '',
          gender: '',
          prefer: '',
          numberOfPost: '',
          completionDate: '',
          socialSite: '',
          indentNumber: '',
          timestamp: '',
        });
        setShowModal(false);
        setTableLoading(true);
        await fetchIndentDataFromRow7();
        setTableLoading(false);
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

  const formatDateForSheet = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const handleCancel = () => {
    setFormData({
      post: '',
      gender: '',
      prefer: '',
      numberOfPost: '',
      completionDate: '',
      socialSite: '',
      indentNumber: '',
      timestamp: '',
    });
    setShowModal(false);
  };

  return (
    <div className="space-y-6 page-content p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Indent</h1>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-all duration-200"
          disabled={loading}
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading...
            </>
          ) : (
            <>
              <Plus size={16} className="mr-2" />
              Create Indent
            </>
          )}
        </button>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50 p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-gray-50 shrink-0">
              <h3 className="text-lg font-bold text-gray-800">Create New Indent</h3>
              <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-200/50">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[calc(85vh-75px)]">
              {/* Post - Full Width */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Post *</label>
                <input
                  type="text"
                  name="post"
                  value={formData.post}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  placeholder="Enter post title"
                  required
                />
              </div>

              {/* Grid 2-columns: Gender & Prefer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    required
                  >
                    <option value="" disabled>Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Any">Any</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prefer</label>
                  <select
                    name="prefer"
                    value={formData.prefer}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  >
                    <option value="">Any</option>
                    <option value="Experience">Experience</option>
                    <option value="Fresher">Fresher</option>
                  </select>
                </div>
              </div>

              {/* Grid 2-columns: Number Of Post & Completion Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Number Of Post *</label>
                  <input
                    type="number"
                    name="numberOfPost"
                    value={formData.numberOfPost}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    placeholder="Enter number of posts"
                    min="1"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Completion Date *</label>
                  <input
                    type="date"
                    name="completionDate"
                    value={formData.completionDate}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    required
                  />
                </div>
              </div>

              {/* Grid 2-columns: Social Site */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Social Site *</label>
                  <select
                    name="socialSite"
                    value={formData.socialSite}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    required
                  >
                    <option value="">Select</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
              </div>

              {/* Buttons Footer */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-all text-sm font-medium"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-all text-sm font-medium flex items-center justify-center shadow-md disabled:opacity-50"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200 shadow">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Indent Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Post</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gender</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prefer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No. of Post</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completion Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Social Site</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {tableLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-6 h-6 border-4 border-blue-500 border-dashed rounded-full animate-spin mb-2" />
                        <span className="text-sm text-gray-600">
                          Loading indent data...
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (() => {
                  const displayValue = (value) =>
                    value === null ||
                      value === undefined ||
                      (typeof value === "string" && value.trim() === "")
                      ? "—"
                      : value;

                  if (filteredIndentData.length === 0) {
                    return (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center">
                          <p className="text-gray-500">No indent data found.</p>
                        </td>
                      </tr>
                    );
                  }

                  return filteredIndentData.map((item, index) => (
                    <tr key={item.id ?? index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {displayValue(item.indentNumber)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {displayValue(item.post)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {displayValue(item.gender)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {displayValue(item.prefer)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {displayValue(item.noOfPost)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.completionDate ? (
                          (() => {
                            const dStr = String(item.completionDate).trim();
                            const date = new Date(dStr);
                            if (isNaN(date.getTime())) {
                              return dStr || "—";
                            }
                            return date.toLocaleDateString();
                          })()
                        ) : ("—")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {displayValue(item.socialSite)}
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Indent;