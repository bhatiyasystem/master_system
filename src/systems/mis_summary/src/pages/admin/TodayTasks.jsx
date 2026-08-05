import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Search, X, Loader2, Filter, Calendar, Clock, ChevronDown } from "lucide-react";
import { getDisplayableImageUrl } from '../../utils/imageUtils';

const AdminTodayTasks = () => {
  const [loading, setLoading] = useState(true);
  const [sheetEmployees, setSheetEmployees] = useState([]);
  const [dataSheetRows, setDataSheetRows] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [personFilter, setPersonFilter] = useState("all");
  const [fmsFilter, setFmsFilter] = useState("all");
  const [activeDrillDown, setActiveDrillDown] = useState(null);
  const [taskTodayCounts, setTaskTodayCounts] = useState({});
  const [fetchingTodayCounts, setFetchingTodayCounts] = useState(false);

  // Helper: Parse sheet reference like "FMS 1!O7:O"
  const parseSheetRef = useCallback((ref) => {
    if (!ref) return null;
    const str = String(ref).trim();
    const bangIndex = str.indexOf("!");
    if (bangIndex === -1) return { sheetName: str, colIndex: -1, startRowIndex: 0 };
    const sheetName = str.substring(0, bangIndex);
    const rangePart = str.substring(bangIndex + 1);
    const colMatch = rangePart.match(/^([A-Za-z]+)(\d*)/);
    if (!colMatch) return { sheetName, colIndex: -1, startRowIndex: 0 };
    const colLetter = colMatch[1].toUpperCase();
    let colIndex = 0;
    for (let i = 0; i < colLetter.length; i++) {
      colIndex = colIndex * 26 + (colLetter.charCodeAt(i) - 64);
    }
    colIndex -= 1;
    const startRow = colMatch[2] ? parseInt(colMatch[2]) : 1;
    const startRowIndex = startRow > 0 ? startRow - 1 : 0;
    return { sheetName, colIndex, startRowIndex };
  }, []);

  // Fetch Data from Google Sheet
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const scriptUrl = import.meta.env.VITE_APPS_SCRIPT_URL;
        if (!scriptUrl) {
          console.error("VITE_APPS_SCRIPT_URL not set");
          setLoading(false);
          return;
        }

        const [masterResponse, dataResponse, recordsResponse] = await Promise.all([
          fetch(`${scriptUrl}?sheet=Master`),
          fetch(`${scriptUrl}?sheet=Data`),
          fetch(`${scriptUrl}?sheet=For Records`)
        ]);

        const masterResult = await masterResponse.json();
        const dataResult = await dataResponse.json();
        const recordsResult = await recordsResponse.json();

        const imageMap = {};
        if (masterResult.success && Array.isArray(masterResult.data)) {
          masterResult.data.slice(1).forEach(row => {
            const name = row[0] ? String(row[0]).trim().toLowerCase() : "";
            const imageUrl = row[4];
            if (name && imageUrl) imageMap[name] = imageUrl;
          });
        }

        if (dataResult.success && Array.isArray(dataResult.data)) {
          setDataSheetRows(dataResult.data.slice(1));
        }

        if (recordsResult.success && Array.isArray(recordsResult.data)) {
          const parsed = recordsResult.data.slice(2)
            .filter(row => row[2] && String(row[2]).trim() !== "")
            .map((row, index) => {
              const empName = row[2] || "Unknown";
              const normalizedName = String(empName).trim().toLowerCase();
              let finalImageUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(empName)}&background=0D8ABC&color=fff&size=128`;
              const rawImageUrl = imageMap[normalizedName];
              if (rawImageUrl) {
                const processedUrl = getDisplayableImageUrl(rawImageUrl);
                if (processedUrl) finalImageUrl = processedUrl;
              }
              return {
                id: `emp-${100 + index}`,
                name: empName,
                image: finalImageUrl,
                department: row[0] || "N/A",
                designation: row[3] || "N/A"
              };
            });
          setSheetEmployees(parsed);
        }
      } catch (error) {
        console.error("Error fetching sheet data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Calculate "Today's" count for each task
  useEffect(() => {
    if (dataSheetRows.length === 0 || sheetEmployees.length === 0) return;

    const fetchTodayTasksCounts = async () => {
      setFetchingTodayCounts(true);
      const counts = {};
      const todayDate = new Date().toLocaleDateString('en-GB');

      const sheetGroups = {};
      dataSheetRows.forEach((row, idx) => {
        const scriptUrl = String(row[25] || "").trim();
        const plannedRef = parseSheetRef(row[7]);
        if (!scriptUrl || !plannedRef) return;
        const key = `${scriptUrl}|${plannedRef.sheetName}`;
        if (!sheetGroups[key]) sheetGroups[key] = { scriptUrl, sheetName: plannedRef.sheetName, taskIndices: [] };
        sheetGroups[key].taskIndices.push(idx);
      });

      await Promise.all(Object.values(sheetGroups).map(async (group) => {
        try {
          const res = await fetch(`${group.scriptUrl}?sheet=${encodeURIComponent(group.sheetName)}`);
          const result = await res.json();
          if (!result.success || !Array.isArray(result.data)) return;
          const sheetData = result.data;
          group.taskIndices.forEach((taskIdx) => {
            const row = dataSheetRows[taskIdx];
            const nameRef = parseSheetRef(row[9]);
            const plannedRef = parseSheetRef(row[7]);
            const personName = String(row[4] || "").trim();
            if (!nameRef || !plannedRef) return;
            let todayCount = 0;
            sheetData.slice(nameRef.startRowIndex).forEach((r) => {
              if (String(r[nameRef.colIndex] || "").trim() === personName) {
                const d = new Date(r[plannedRef.colIndex]);
                if (!isNaN(d.getTime()) && d.toLocaleDateString('en-GB') === todayDate) todayCount++;
              }
            });
            counts[taskIdx] = todayCount;
          });
        } catch (e) {
          console.error("Error fetching counts:", group.sheetName, e);
        }
      }));
      setTaskTodayCounts(counts);
      setFetchingTodayCounts(false);
    };
    fetchTodayTasksCounts();
  }, [dataSheetRows, sheetEmployees, parseSheetRef]);

  // Enrich tasks
  const enrichedTasks = useMemo(() => {
    return dataSheetRows.map((row, idx) => {
      const personName = row[4] ? String(row[4]).trim() : "Unknown";
      const normalizedName = personName.toLowerCase();
      const employee = sheetEmployees.find(e => e.name.toLowerCase() === normalizedName);
      return {
        id: `task-${idx}`,
        fmsName: row[2] || "N/A",
        taskName: row[3] || "N/A",
        assignedTo: employee?.id || "N/A",
        personName: personName,
        personImage: employee?.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(personName)}&background=0D8ABC&color=fff&size=128`,
        department: row[0] || "N/A",
        designation: employee?.designation || "N/A",
        plannedCount: taskTodayCounts[idx] !== undefined ? taskTodayCounts[idx] : (fetchingTodayCounts ? "..." : 0),
        scriptUrl: row[25] || "",
        plannedSheetRef: row[7] || "",
        actualSheetRef: row[8] || "",
        nameColRef: row[9] || "",
        taskNameColRef: row[26] || ""
      };
    });
  }, [dataSheetRows, sheetEmployees, taskTodayCounts, fetchingTodayCounts]);

  // Group by Employee Name
  const groupedEmployees = useMemo(() => {
    const groups = {};
    enrichedTasks.forEach(task => {
      const name = task.personName;
      if (!groups[name]) {
        groups[name] = {
          personName: name,
          personImage: task.personImage,
          assignedTo: task.assignedTo,
          designation: task.designation,
          plannedCount: 0,
          tasks: []
        };
      }
      groups[name].tasks.push(task);
      if (typeof task.plannedCount === 'number') {
        groups[name].plannedCount += task.plannedCount;
      }
    });
    return Object.values(groups);
  }, [enrichedTasks]);

  const persons = useMemo(() => [...new Set(groupedEmployees.map(e => e.personName))].sort(), [groupedEmployees]);

  const filteredEmployees = useMemo(() => {
    return groupedEmployees.filter((e) => {
      const matchesSearch = e.personName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPerson = personFilter === "all" || e.personName === personFilter;
      return matchesSearch && matchesPerson;
    });
  }, [groupedEmployees, searchQuery, personFilter]);

  const handleRowClick = async (empGroup) => {
    setActiveDrillDown({
      personName: empGroup.personName,
      title: `Today's Task Details`,
      rows: [],
      loading: true
    });

    try {
      const compiledRows = [];
      const todayDate = new Date().toLocaleDateString('en-GB');

      // Fetch for all tasks assigned to this person
      await Promise.all(empGroup.tasks.map(async (task) => {
        const scriptUrl = String(task.scriptUrl || "").trim();
        if (!scriptUrl) return;

        const plannedP = parseSheetRef(task.plannedSheetRef);
        const actualP = parseSheetRef(task.actualSheetRef);
        const nameP = parseSheetRef(task.nameColRef);
        const taskP = parseSheetRef(task.taskNameColRef);

        const sheets = new Set();
        if (plannedP?.sheetName) sheets.add(plannedP.sheetName);
        if (actualP?.sheetName) sheets.add(actualP.sheetName);
        if (nameP?.sheetName) sheets.add(nameP.sheetName);
        if (taskP?.sheetName) sheets.add(taskP.sheetName);

        const cache = {};
        await Promise.all([...sheets].map(async (name) => {
          const res = await fetch(`${scriptUrl}?sheet=${encodeURIComponent(name)}`);
          const result = await res.json();
          cache[name] = (result.success && Array.isArray(result.data)) ? result.data : [];
        }));

        const formatDate = (val) => {
          if (!val) return "";
          const d = new Date(val);
          return isNaN(d.getTime()) ? String(val) : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
        };

        const matchingIndices = [];
        if (nameP && nameP.sheetName) {
          const rows = cache[nameP.sheetName] || [];
          rows.slice(nameP.startRowIndex).forEach((r, idx) => {
            if (String(r[nameP.colIndex] || "").trim() === task.personName) matchingIndices.push(idx);
          });
        }

        const getVals = (p) => {
          if (!p || !p.sheetName) return [];
          const rows = (cache[p.sheetName] || []).slice(p.startRowIndex);
          return matchingIndices.map(idx => ({
            val: rows[idx]?.[p.colIndex],
            formatted: formatDate(rows[idx]?.[p.colIndex])
          }));
        };

        const pVals = getVals(plannedP);
        const aVals = getVals(actualP);
        const tVals = getVals(taskP);

        for (let i = 0; i < Math.max(pVals.length, aVals.length, tVals.length); i++) {
          const raw = pVals[i]?.val;
          if (raw && new Date(raw).toLocaleDateString('en-GB') === todayDate) {
            compiledRows.push({
              fmsName: task.fmsName,
              taskName: tVals[i]?.formatted || "",
              planned: pVals[i]?.formatted || "",
              actual: aVals[i]?.formatted || ""
            });
          }
        }
      }));

      setActiveDrillDown(prev => ({ ...prev, rows: compiledRows, loading: false }));
    } catch (error) {
      console.error("Drill down error:", error);
      setActiveDrillDown(prev => ({ ...prev, loading: false, error: error.message }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
          <p className="text-gray-600 font-medium">Fetching Today's Tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header & Filters */}
        <div className="bg-white rounded shadow-sm p-4 mb-4 border border-gray-200">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 shadow-sm"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={personFilter}
                onChange={(e) => setPersonFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 bg-white"
              >
                <option value="all">All Persons</option>
                {persons.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 flex items-center justify-between">
            <div><p className="text-xs font-medium text-gray-500 uppercase">Persons</p><p className="text-xl font-bold text-gray-900 mt-1">{groupedEmployees.length}</p></div>
            <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center"><Filter className="w-5 h-5 text-blue-600" /></div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 flex items-center justify-between">
            <div><p className="text-xs font-medium text-gray-500 uppercase">FMS Names</p><p className="text-xl font-bold text-gray-900 mt-1">{[...new Set(enrichedTasks.map(t => t.fmsName))].length}</p></div>
            <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center"><Calendar className="w-5 h-5 text-green-600" /></div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 flex items-center justify-between">
            <div><p className="text-xs font-medium text-gray-500 uppercase">Total Tasks</p><p className="text-xl font-bold text-gray-900 mt-1">{enrichedTasks.length}</p></div>
            <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center"><Clock className="w-5 h-5 text-purple-600" /></div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Total Planned</p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {fetchingTodayCounts ? "..." : groupedEmployees.reduce((t, e) => t + e.plannedCount, 0)}
              </p>
            </div>
            <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center"><Search className="w-5 h-5 text-orange-600" /></div>
          </div>
        </div>

        {/* Unique Employee Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h2 className="text-base font-bold text-gray-800">Unique Employees</h2>
            {fetchingTodayCounts && <span className="text-xs text-blue-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Updating counts...</span>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">S.No</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Target</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Today's Task</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEmployees.length > 0 ? filteredEmployees.map((e, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/50 cursor-pointer transition-colors" onClick={() => handleRowClick(e)}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">{idx + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <img src={e.personImage} alt={e.personName} className="w-8 h-8 rounded-full object-cover mr-3 border border-gray-200" />
                        <span className="text-sm font-semibold text-gray-900">{e.personName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">{e.designation}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${e.plannedCount > 0 ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-500"}`}>
                        {e.plannedCount}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="4" className="px-6 py-12 text-center text-gray-400 text-sm">No employees found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Drill Down Modal */}
      {activeDrillDown && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-hidden">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col animate-fadeIn">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50 rounded-t-xl">
              <div><h3 className="text-lg font-bold text-gray-900">{activeDrillDown.title}</h3><p className="text-sm text-gray-500">{activeDrillDown.personName}</p></div>
              <button onClick={() => setActiveDrillDown(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X className="w-5 h-5 text-gray-600" /></button>
            </div>
            <div className="overflow-y-auto flex-1 bg-white">
              {activeDrillDown.loading ? (
                <div className="flex flex-col items-center justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" /><p className="text-gray-500 font-medium">Compiling all tasks for today...</p></div>
              ) : activeDrillDown.error ? (
                <div className="p-10 text-center text-red-500 font-medium"><p>Error: {activeDrillDown.error}</p></div>
              ) : (
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50 sticky top-0 font-bold">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">FMS Name</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Sub Task</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Planned</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Actual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {activeDrillDown.rows.length > 0 ? activeDrillDown.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-6 py-4 text-sm text-blue-600 font-semibold">{row.fmsName}</td>
                        <td className="px-6 py-4 text-sm text-gray-800 font-medium">{row.taskName}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{row.planned}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{row.actual}</td>
                      </tr>
                    )) : <tr><td colSpan="4" className="px-6 py-10 text-center text-gray-400">No tasks found for today.</td></tr>}
                  </tbody>
                </table>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end">
              <button onClick={() => setActiveDrillDown(null)} className="px-6 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 font-bold transition-all">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTodayTasks;
