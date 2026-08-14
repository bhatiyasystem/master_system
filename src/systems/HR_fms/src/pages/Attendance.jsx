import { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import {
  FileSpreadsheet,
  X,
  Upload,
  Users,
  AlertCircle,
  CheckCircle,
  Search,
  RefreshCw,
  Calendar,
  Eye,
  Edit3
} from "lucide-react";
import {
  parseAttendanceExcel,
  createUploadRecord,
  updateUploadRecord,
  saveAttendanceRows,
  fetchAttendanceMonthlyPaginated,
  fetchAttendanceMonthlyStats,
  calculateRowLeaveStats,
  updatePayableDaysOverride,
  STATUS_COLORS,
  STATUS_LABELS,
  MONTHS,
  syncAttendanceFromPortal,
  fetchUploads
} from "../services/supabaseHR";
import { fillDailyStatusFromSummary } from "../services/supabaseHR";
import { getPreviousProcessingPeriod } from "../utils/dateUtils";

// ── Upload Zone ───────────────────────────────────────────────────────────────
const UploadZone = ({ onFile, uploading }) => {
  const inputRef = useRef();
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    e => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
    [onFile]
  );

  return (
    <div
      onDragOver={e => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !uploading && inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all
        ${dragOver ? "border-indigo-500 bg-indigo-50" : "border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50"}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={e => {
          if (e.target.files?.[0]) onFile(e.target.files[0]);
          e.target.value = "";
        }}
        disabled={uploading}
      />
      <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
        {uploading ? (
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <FileSpreadsheet size={32} className="text-indigo-600" />
        )}
      </div>
      <p className="text-lg font-semibold text-gray-800">
        {uploading ? "Reading Excel..." : "Drop Monthly Status Report here"}
      </p>
      <p className="text-sm text-gray-500 mt-1">
        {uploading ? "Please wait" : "or click to browse — supports .xlsx, .xls"}
      </p>
    </div>
  );
};

// ── Override Modal ────────────────────────────────────────────────────────────
const OverrideModal = ({ row, onSave, onClose }) => {
  const [days, setDays] = useState(row.payable_days_override ?? row.payable_days);
  const [reason, setReason] = useState(row.override_reason || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(row.id || row.emp_code, parseFloat(days), reason, row.year, row.month);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-96 max-w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900">Override Payable Days</h3>
          <button onClick={onClose}>
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          <span className="font-medium">{row.emp_name}</span> ({row.emp_code})<br />
          Computed: <span className="font-semibold text-indigo-600">{row.payable_days} days</span>
        </p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Override Days</label>
          <input
            type="number"
            step="0.5"
            min="0"
            max="31"
            value={days}
            onChange={e => setDays(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 resize-none"
            placeholder="Optional reason..."
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
          >
            {saving ? "Saving..." : "Save Override"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Daily Grid Modal ──────────────────────────────────────────────────────────
const DailyGridModal = ({ row, daysInMonth, onClose }) => {
  const leaveStats = calculateRowLeaveStats(row);
  const dailyStatusMap = fillDailyStatusFromSummary(row, row.year, row.month);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-screen overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{row.emp_name}</h3>
            <p className="text-sm text-gray-500">
              {row.emp_code} · {MONTHS[row.month - 1]} {row.year}
            </p>
          </div>
          <button onClick={onClose}>
            <X size={22} className="text-gray-500" />
          </button>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-7 gap-2 mb-6">
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const code = dailyStatusMap?.[day] || dailyStatusMap?.[String(day)];
              const color = code ? STATUS_COLORS[code] || "#94a3b8" : "#f3f4f6";
              return (
                <div
                  key={day}
                  className="rounded-lg p-2 flex flex-col items-center text-center"
                  style={{ backgroundColor: color + "22", border: `1px solid ${color}44` }}
                >
                  <span className="text-xs text-gray-500 font-medium">{day}</span>
                  <span className="mt-1 text-xs font-bold rounded px-1" style={{ color, fontSize: 10 }}>
                    {code}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Present (P)", value: row.total_present, color: "#22c55e" },
              { label: "Absent (A)", value: row.total_absent, color: "#ef4444" },
              { label: "Weekly Off", value: row.total_wo, color: "#94a3b8" },
              { label: "WO Present", value: row.total_wop, color: "#3b82f6" },
              { label: "Leave (L)", value: row.total_leave, color: "#f59e0b" },
              { label: "Holiday (H)", value: row.total_holiday, color: "#8b5cf6" },
              {
                label: "Overtime (OT)",
                value: row.total_ot || (row.ot_hours ? `${row.ot_hours} hrs` : "00:00"),
                color: "#d97706"
              },
              { label: "Payable Days", value: row.payable_days_override ?? row.payable_days, color: "#6366f1" }
            ].map(item => (
              <div key={item.label} className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold" style={{ color: item.color }}>
                  {item.value}
                </p>
                <p className="text-xs text-gray-500 mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const AttendanceMonthly = () => {
  const [tab, setTab] = useState("view"); // 'upload' | 'view'
  const [uploading, setUploading] = useState(false); // parsing phase
  const [submitting, setSubmitting] = useState(false); // DB write phase
  const [previewData, setPreviewData] = useState(null); // { uploadMeta, employees, year, month, fileName }
  const [previewErrors, setPreviewErrors] = useState([]);
  const [uploadResult, setUploadResult] = useState(null); // { success, count, meta, year, month }
  const [error, setError] = useState(null);

  // View tab state
  const prevPeriod = getPreviousProcessingPeriod();
  const [filterYear, setFilterYear] = useState(prevPeriod.year);
  const [filterMonth, setFilterMonth] = useState(prevPeriod.month);
  const [search, setSearch] = useState("");
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [overrideRow, setOverrideRow] = useState(null);
  const [gridRow, setGridRow] = useState(null);

  const daysInMonth = new Date(filterYear, filterMonth, 0).getDate();

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  const [syncing, setSyncing] = useState(false);
  const [isPortalSync, setIsPortalSync] = useState(false);

  const handlePortalSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await syncAttendanceFromPortal(filterYear, filterMonth);
      setUploadResult({
        success: true,
        count: res.count,
        meta: { company_name: "Portal Sync", department: "Portal Sync" },
        year: filterYear,
        month: filterMonth
      });
      setTab("view");
      loadData(filterYear, filterMonth);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  // ── Phase 1: Parse Excel → set previewData ──
  const handleFile = async file => {
    setError(null);
    setUploading(true);
    setPreviewData(null);
    setPreviewErrors([]);
    setUploadResult(null);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", raw: false, cellText: true, cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });

      if (!rawRows.some(row => row.some(cell => String(cell).trim() !== ""))) {
        setPreviewErrors(["Attendance Excel is empty. Upload an attendance Excel file."]);
        return;
      }

      const { uploadMeta, employees } = parseAttendanceExcel(rawRows);

      const errors = [];
      if (employees.length === 0) {
        errors.push("No attendance rows found. Upload an attendance Excel file with employee data.");
      }
      if (!uploadMeta.period_from) {
        errors.push("Could not detect pay period from the file. Ensure the period row is present.");
      }

      setPreviewErrors(errors);

      if (errors.length === 0) {
        setPreviewData({
          uploadMeta: {
            ...uploadMeta,
            period_from: `${filterYear}-${String(filterMonth).padStart(2, "0")}-01`,
            period_to: `${filterYear}-${String(filterMonth).padStart(2, "0")}-${new Date(filterYear, filterMonth, 0).getDate()}`
          },
          employees,
          year: filterYear,
          month: filterMonth,
          fileName: file.name
        });
      }
    } catch (err) {
      console.error("Parse error:", err);
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // ── Phase 2: Submit parsed data to DB ──
  const handleSubmit = async () => {
    if (!previewData) return;
    setSubmitting(true);
    setError(null);
    const { uploadMeta, employees, year, month, fileName } = previewData;
    try {
      const uploadRecord = await createUploadRecord({
        periodFrom: uploadMeta.period_from,
        periodTo: uploadMeta.period_to,
        companyName: uploadMeta.company_name,
        department: uploadMeta.department,
        printedOn: uploadMeta.printed_on,
        fileName,
        uploadedBy: null,
        year,
        month
      });

      await saveAttendanceRows(uploadRecord.id, employees, year, month, uploadMeta.company_name, uploadMeta.department);

      await updateUploadRecord(uploadRecord.id, {
        status: "processed",
        total_rows: employees.length,
        processed_rows: employees.length
      });

      setUploadResult({ success: true, count: employees.length, meta: uploadMeta, year, month });
      setPreviewData(null);
      setPreviewErrors([]);

      setFilterYear(year);
      setFilterMonth(month);
      setTimeout(() => {
        setTab("view");
        loadData(year, month);
      }, 600);
    } catch (err) {
      console.error("Submit error:", err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelPreview = () => {
    setPreviewData(null);
    setPreviewErrors([]);
    setUploadResult(null);
    setError(null);
  };

  // Pagination states
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // ── Load attendance data ──
  const loadData = async (year = filterYear, month = filterMonth) => {
    setLoading(true);
    setError(null);
    try {
      try {
        const uploads = await fetchUploads({ year, month });
        const hasPortalSync = uploads && uploads.some(u => u.file_name === "Portal Sync");
        setIsPortalSync(hasPortalSync);
      } catch (err) {
        console.warn("Failed to check portal sync status:", err);
        setIsPortalSync(false);
      }

      const res = await fetchAttendanceMonthlyPaginated({
        year,
        month,
        search,
        page,
        pageSize
      });
      setTableData(res.data || []);
      setTotalRecords(res.totalRecords || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchAsync = async () => {
      setLoading(true);
      setError(null);
      try {
        try {
          const uploads = await fetchUploads({ year: filterYear, month: filterMonth });
          const hasPortalSync = uploads && uploads.some(u => u.file_name === "Portal Sync");
          if (isMounted) setIsPortalSync(hasPortalSync);
        } catch (err) {
          console.warn("Failed to check portal sync status:", err);
          if (isMounted) setIsPortalSync(false);
        }

        const res = await fetchAttendanceMonthlyPaginated({
          year: filterYear,
          month: filterMonth,
          search,
          page,
          pageSize
        });
        if (isMounted) {
          setTableData(res.data || []);
          setTotalRecords(res.totalRecords || 0);
          setTotalPages(res.totalPages || 1);
        }
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchAsync();
    return () => {
      isMounted = false;
    };
  }, [filterYear, filterMonth, search, page]);

  const filteredData = tableData;

  const handleOverrideSave = async (id, days, reason, year, month) => {
    await updatePayableDaysOverride(id, days, reason, year || filterYear, month || filterMonth);
    await loadData();
  };

  const stats = {
    total: filteredData.length,
    avgPresent: filteredData.length
      ? (filteredData.reduce((s, r) => s + (r.total_present || 0), 0) / filteredData.length).toFixed(1)
      : 0,
    avgAbsent: filteredData.length
      ? (filteredData.reduce((s, r) => s + (r.total_absent || 0), 0) / filteredData.length).toFixed(1)
      : 0
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Monthly Attendance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Upload Excel report & view attendance data</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePortalSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-all shadow-md cursor-pointer"
          >
            {syncing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw size={16} /> Sync Attendance
              </>
            )}
          </button>

          <button
            onClick={() => {
              setTab("upload");
              handleCancelPreview();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all
              ${tab === "upload" ? "bg-indigo-600 text-white shadow-md" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
          >
            <Upload size={16} /> Upload Excel
          </button>
          <button
            onClick={() => {
              setTab("view");
              loadData();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all
              ${tab === "view" ? "bg-indigo-600 text-white shadow-md" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
          >
            <Users size={16} /> View Records
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
          <AlertCircle size={20} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Error</p>
            <p className="text-sm">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="ml-auto">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── UPLOAD TAB ── */}
      {tab === "upload" && (
        <div className="space-y-4">
          {/* Upload zone — hide when preview is showing */}
          {!previewData && (
            <>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-base font-semibold text-gray-800 mb-1">Upload Monthly Status Report</h2>
                <p className="text-sm text-gray-500 mb-4">
                  Upload the Excel file exported from your attendance system. The data will be previewed before saving.
                </p>
                <UploadZone onFile={handleFile} uploading={uploading} />
              </div>

              {/* Validation errors from parse */}
              {previewErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1">
                  <p className="text-sm font-semibold text-red-800 mb-2">Could not parse the file:</p>
                  {previewErrors.map((e, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-red-700">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      <span>{e}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Format Guide */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-blue-900 mb-2">Expected Attendance Calculation Format</p>
                <div className="text-xs text-blue-800 space-y-1">
                  <p>
                    • Pay Days Logic:{" "}
                    <code className="bg-blue-100 px-1.5 py-0.5 rounded font-bold text-blue-900">
                      P + WO + H + HP + WOP + Total Leave
                    </code>
                  </p>
                  <p>
                    • Summary columns:{" "}
                    <code className="bg-blue-100 px-1.5 py-0.5 rounded">
                      Emp. Code | EmployeeName | P | A | H | HP | WO | WOP | CL | PL | SL | Total Leave | Total Pay Days
                    </code>
                  </p>
                </div>
              </div>
            </>
          )}

          {/* ── Preview Panel ── */}
          {previewData && (
            <div className="space-y-4">
              {/* Preview header */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-gray-900">Preview —</h2>
                      <span className="bg-indigo-50 border border-indigo-200 rounded px-2.5 py-1 text-xs font-semibold text-indigo-900">
                        {MONTHS[previewData.month - 1]} {previewData.year}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1.5">
                      {previewData.uploadMeta.company_name ? `Company: ${previewData.uploadMeta.company_name} · ` : ""}
                      {previewData.employees.length} employees parsed · Select target period above if needed
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={handleCancelPreview}
                      disabled={submitting}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <X size={15} /> Re-upload
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 shadow-sm"
                    >
                      {submitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                          Saving…
                        </>
                      ) : (
                        <>
                          <CheckCircle size={15} /> Submit Attendance
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Summary chips */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {[
                    { label: "Employees", value: previewData.employees.length, color: "indigo" },
                    {
                      label: "Period",
                      value: `${previewData.uploadMeta.period_from} → ${previewData.uploadMeta.period_to}`,
                      color: "blue"
                    },
                    { label: "File", value: previewData.fileName, color: "gray" }
                  ].map(chip => (
                    <span
                      key={chip.label}
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-${chip.color}-50 text-${chip.color}-700 border border-${chip.color}-100`}
                    >
                      <span className="font-semibold">{chip.label}:</span> {chip.value}
                    </span>
                  ))}
                </div>

                {/* Preview table */}
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-indigo-50 border-b border-indigo-100">
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-indigo-900 uppercase">#</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-indigo-900 uppercase">
                          Emp Code
                        </th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-indigo-900 uppercase">Name</th>
                        {previewData &&
                          Array.from(
                            { length: new Date(previewData.year, previewData.month, 0).getDate() },
                            (_, i) => i + 1
                          ).map(d => (
                            <th key={d} className="px-1 py-2.5 text-center text-xs font-semibold text-indigo-900">
                              {d}
                            </th>
                          ))}
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-green-800">P</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-red-700">A</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-purple-700">H</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-indigo-700">HP</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600">WO</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-blue-700">WOP</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-amber-700">CL</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-amber-700">PL</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-amber-700">SL</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-amber-700">Other Leave</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-amber-800">Total Leave</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-green-900">Total Present</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-indigo-900">
                          Total Pay Days
                        </th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-amber-800">OT</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-red-800">Late</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-orange-800">Early</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {previewData.employees.map((emp, idx) => {
                        const leaveStats = calculateRowLeaveStats(emp);
                        const dailyStatusMap = fillDailyStatusFromSummary(emp, previewData.year, previewData.month);
                        const daysInMonthForPreview = new Date(previewData.year, previewData.month, 0).getDate();
                        return (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            <td className="px-3 py-2.5 text-gray-400 text-xs">{idx + 1}</td>
                            <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{emp.emp_code || "—"}</td>
                            <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">
                              {emp.emp_name || "—"}
                            </td>
                            {Array.from({ length: daysInMonthForPreview }, (_, i) => i + 1).map(d => {
                              const code = dailyStatusMap?.[d] || dailyStatusMap?.[String(d)] || "";
                              const textColor = code ? STATUS_COLORS[code] || "#475569" : "#d1d5db";
                              return (
                                <td key={d} className="px-1 py-2 text-center" style={{ minWidth: 26 }}>
                                  <span
                                    className="text-xs font-bold rounded"
                                    style={{ color: textColor, fontSize: 10 }}
                                    title={STATUS_LABELS[code] || code}
                                  >
                                    {code}
                                  </span>
                                </td>
                              );
                            })}
                            <td className="px-3 py-2.5 text-center font-semibold text-green-700">
                              {emp.total_present ?? 0}
                            </td>
                            <td className="px-3 py-2.5 text-center font-semibold text-red-600">
                              {emp.total_absent ?? 0}
                            </td>
                            <td className="px-3 py-2.5 text-center text-purple-700 font-semibold">
                              {emp.total_holiday ?? 0}
                            </td>
                            <td className="px-3 py-2.5 text-center text-indigo-600 font-semibold">
                              {emp.total_half_present ?? 0}
                            </td>
                            <td className="px-3 py-2.5 text-center text-gray-500">{emp.total_wo ?? 0}</td>
                            <td className="px-3 py-2.5 text-center text-blue-600">{emp.total_wop ?? 0}</td>
                            <td className="px-3 py-2.5 text-center text-amber-600 font-medium">{leaveStats.cl}</td>
                            <td className="px-3 py-2.5 text-center text-amber-600 font-medium">{leaveStats.pl}</td>
                            <td className="px-3 py-2.5 text-center text-amber-600 font-medium">{leaveStats.sl}</td>
                            <td className="px-3 py-2.5 text-center text-amber-600">{emp.total_other_leave ?? 0}</td>
                            <td className="px-3 py-2.5 text-center text-amber-700 font-semibold">
                              {emp.total_leave ?? leaveStats.totalLeave}
                            </td>
                            <td className="px-3 py-2.5 text-center text-green-800 font-bold">
                              {emp.total_present ?? 0}
                            </td>
                            <td className="px-3 py-2.5 text-center text-indigo-800 font-bold">
                              {emp.payable_days ?? 0}
                            </td>
                            <td className="px-3 py-2.5 text-center text-amber-700 font-medium">
                              {emp.total_ot || "00:00"}
                            </td>
                            <td className="px-3 py-2.5 text-center text-red-600">{emp.total_late ?? 0}</td>
                            <td className="px-3 py-2.5 text-center text-orange-600">{emp.total_early ?? 0}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Upload Success */}
          {uploadResult?.success && !previewData && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
              <CheckCircle size={20} className="text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-green-800">Attendance Saved!</p>
                <p className="text-sm text-green-700">
                  {uploadResult.count} employees processed for {MONTHS[uploadResult.month - 1]} {uploadResult.year}
                  {uploadResult.meta.company_name ? ` · ${uploadResult.meta.company_name}` : ""}
                </p>
                <button onClick={() => setTab("view")} className="mt-2 text-sm text-green-700 underline">
                  View Records →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── VIEW TAB ── */}
      {tab === "view" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search employee name or code..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={`${filterMonth}-${filterYear}`}
                  onChange={e => {
                    const [m, y] = e.target.value.split('-').map(Number);
                    setFilterMonth(m);
                    setFilterYear(y);
                    setPage(1);
                  }}
                  className="border rounded-lg px-3 py-2 text-sm font-medium bg-white text-gray-700 border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
                >
                  <option value={`${currentMonth}-${currentYear}`}>
                    {MONTHS[currentMonth - 1]} {currentYear}
                  </option>
                  <option value={`${currentMonth === 1 ? 12 : currentMonth - 1}-${currentMonth === 1 ? currentYear - 1 : currentYear}`}>
                    {MONTHS[currentMonth === 1 ? 11 : currentMonth - 2]} {currentMonth === 1 ? currentYear - 1 : currentYear}
                  </option>
                </select>
              </div>
              <button
                onClick={() => loadData()}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                {loading ? "Loading..." : "Load"}
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          {tableData.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Employees", value: stats.total, color: "indigo" },
                { label: "Avg Present", value: `${stats.avgPresent}d`, color: "green" },
                { label: "Avg Absent", value: `${stats.avgAbsent}d`, color: "red" }
              ].map(card => (
                <div key={card.label} className={`bg-${card.color}-50 rounded-xl p-4 border border-${card.color}-100`}>
                  <p className={`text-2xl font-bold text-${card.color}-700`}>{card.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{card.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredData.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Calendar size={48} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">No attendance data found</p>
                <p className="text-sm mt-1">Upload an Excel file or change the filters</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-indigo-50 border-b border-indigo-100">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-indigo-900 uppercase">#</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-indigo-900 uppercase">
                          Emp Code
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-indigo-900 uppercase">Name</th>
                        {isPortalSync &&
                          Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
                            <th key={d} className="px-1 py-3 text-center text-xs font-semibold text-indigo-900">
                              {d}
                            </th>
                          ))}
                        <th className="px-3 py-3 text-center text-xs font-semibold text-green-800 bg-green-50">P</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-red-800 bg-red-50">A</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-purple-800 bg-purple-50">H</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-indigo-800 bg-indigo-50">HP</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 bg-gray-50">WO</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-blue-800 bg-blue-50">WOP</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-amber-800 bg-amber-50">CL</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-amber-800 bg-amber-50">PL</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-amber-800 bg-amber-50">SL</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-amber-800 bg-amber-50">
                          Other Leave
                        </th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-amber-900 bg-amber-100">
                          Total Leave
                        </th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-green-900 bg-green-100">
                          Total Present
                        </th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-indigo-900 bg-indigo-100">
                          Total Pay Days
                        </th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-amber-800 bg-amber-50">OT</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-red-800 bg-red-50">Late</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-orange-800 bg-orange-50">
                          Early
                        </th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-indigo-900">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredData.map((row, idx) => {
                        const leaveStats = calculateRowLeaveStats(row);
                        const dailyStatusMap = fillDailyStatusFromSummary(
                          row,
                          row.year || filterYear,
                          row.month || filterMonth
                        );
                        const meta = row.daily_status?._meta || {};
                        const effectiveDays = row.payable_days_override ?? row.payable_days ?? meta.payable_days ?? 0;
                        const hasOverride = row.payable_days_override != null;
                        const hpCount = row.total_half_present ?? row.total_hp ?? meta.total_hp ?? 0;
                        const otherLeave = row.total_other_leave ?? meta.total_other_leave ?? 0;
                        const totalLeaveVal = row.total_leave ?? leaveStats.totalLeave ?? meta.total_leave ?? 0;
                        const totalPresentVal = row.total_present ?? meta.total_present ?? 0;
                        const lateVal = row.total_late ?? meta.total_late ?? 0;
                        const earlyVal = row.total_early ?? meta.total_early ?? 0;

                        return (
                          <tr
                            key={row.id || row.emp_code || `row-${idx}`}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-4 py-3 text-sm text-gray-400">{(page - 1) * pageSize + idx + 1}</td>
                            <td className="px-4 py-3 text-xs text-gray-500 font-mono">{row.emp_code}</td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                              {row.emp_name}
                            </td>
                            {isPortalSync &&
                              Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                                const code = dailyStatusMap?.[d] || dailyStatusMap?.[String(d)] || "";
                                const textColor = code ? STATUS_COLORS[code] || "#475569" : "#d1d5db";
                                return (
                                  <td key={d} className="px-1 py-2 text-center" style={{ minWidth: 28 }}>
                                    <span
                                      className="text-xs font-bold rounded"
                                      style={{ color: textColor, fontSize: 10 }}
                                      title={STATUS_LABELS[code] || code}
                                    >
                                      {code}
                                    </span>
                                  </td>
                                );
                              })}
                            <td className="px-3 py-3 text-center text-sm font-semibold text-green-700">
                              {row.total_present ?? 0}
                            </td>
                            <td className="px-3 py-3 text-center text-sm font-semibold text-red-600">
                              {row.total_absent ?? 0}
                            </td>
                            <td className="px-3 py-3 text-center text-sm text-purple-700 font-semibold">
                              {row.total_holiday ?? 0}
                            </td>
                            <td className="px-3 py-3 text-center text-sm text-indigo-600 font-semibold">{hpCount}</td>
                            <td className="px-3 py-3 text-center text-sm text-gray-500">{row.total_wo ?? 0}</td>
                            <td className="px-3 py-3 text-center text-sm text-blue-600">{row.total_wop ?? 0}</td>
                            <td className="px-3 py-3 text-center text-sm text-amber-600 font-medium">
                              {leaveStats.cl}
                            </td>
                            <td className="px-3 py-3 text-center text-sm text-amber-600 font-medium">
                              {leaveStats.pl}
                            </td>
                            <td className="px-3 py-3 text-center text-sm text-amber-600 font-medium">
                              {leaveStats.sl}
                            </td>
                            <td className="px-3 py-3 text-center text-sm text-amber-600">{otherLeave}</td>
                            <td className="px-3 py-3 text-center text-sm text-amber-700 font-semibold">
                              {totalLeaveVal}
                            </td>
                            <td className="px-3 py-3 text-center text-sm text-green-800 font-bold">
                              {totalPresentVal}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold
                              ${hasOverride ? "bg-amber-100 text-amber-800" : "bg-indigo-100 text-indigo-800"}`}
                              >
                                {effectiveDays}
                                {hasOverride && (
                                  <span className="ml-1 text-amber-500" title={`Override: ${row.override_reason}`}>
                                    ⚠
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-center text-sm text-amber-700 font-medium">
                              {row.total_ot || (row.ot_hours ? `${row.ot_hours} hrs` : "00:00")}
                            </td>
                            <td className="px-3 py-3 text-center text-sm text-red-600">{lateVal}</td>
                            <td className="px-3 py-3 text-center text-sm text-orange-600">{earlyVal}</td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-1 justify-center">
                                <button
                                  onClick={() => setGridRow(row)}
                                  title="View day-wise grid"
                                  className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600"
                                >
                                  <Eye size={14} />
                                </button>
                                <button
                                  onClick={() => setOverrideRow(row)}
                                  title="Override payable days"
                                  className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600"
                                >
                                  <Edit3 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-gray-100 bg-white gap-3 rounded-b-2xl">
                  <div className="text-xs text-gray-500 font-medium">
                    Showing{" "}
                    <span className="font-bold text-gray-800">{totalRecords > 0 ? (page - 1) * pageSize + 1 : 0}</span>{" "}
                    to <span className="font-bold text-gray-800">{Math.min(page * pageSize, totalRecords)}</span> of{" "}
                    <span className="font-bold text-gray-800">{totalRecords}</span> records (Page {page} of{" "}
                    {totalPages || 1})
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1 || loading}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="text-xs font-semibold px-2.5 py-1 bg-gray-100 rounded-md text-gray-800">
                      {page} / {totalPages || 1}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages || loading}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {overrideRow && (
        <OverrideModal row={overrideRow} onSave={handleOverrideSave} onClose={() => setOverrideRow(null)} />
      )}
      {gridRow && <DailyGridModal row={gridRow} daysInMonth={daysInMonth} onClose={() => setGridRow(null)} />}
    </div>
  );
};

export default AttendanceMonthly;
