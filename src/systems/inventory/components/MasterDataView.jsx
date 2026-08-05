// src/systems/inventory/components/MasterDataView.jsx
import React, { useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Plus,
  Search,
  SlidersHorizontal,
  ChevronDown,
  Download,
  Upload,
  Edit2,
  Trash2,
  X,
  FileSpreadsheet,
} from "lucide-react";
import Papa from "papaparse";
import {
  saveMaterial,
  deleteMaterial,
  saveList,
} from "../redux/slice/inventorySlice";

export default function MasterDataView({ activeUser }) {
  const dispatch = useDispatch();
  const {
    materials,
    units,
    locations,
    settings,
    materialNames = [],
  } = useSelector((state) => state.inventory);

  const isViewer = activeUser.role === "Viewer";

  // State
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [minMoq, setMinMoq] = useState("");

  // Pagination & Sorting state
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState("sku");
  const [sortDir, setSortDir] = useState(1); // 1 = asc, -1 = desc

  // Modal form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // 'add' or 'edit'
  const [formSku, setFormSku] = useState("");
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formSubCategory, setFormSubCategory] = useState("");
  const [formUnit, setFormUnit] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formOpening, setFormOpening] = useState(0);
  const [formAdc, setFormAdc] = useState(0);
  const [formLeadTime, setFormLeadTime] = useState(0);
  const [formSafetyFactor, setFormSafetyFactor] = useState(0);
  const [formMoq, setFormMoq] = useState(0);
  const [formSupplierName, setFormSupplierName] = useState("");
  const [formSupplierCode, setFormSupplierCode] = useState("");
  const [formStatus, setFormStatus] = useState("Active");
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showNameDropdown, setShowNameDropdown] = useState(false);

  // Categories list
  const categories = useMemo(() => {
    return [...new Set(materials.map((m) => m.category))].filter(Boolean);
  }, [materials]);

  // Material names list
  const materialNamesSuggestions = useMemo(() => {
    const activeNames = materials.map((m) => m.name);
    return [...new Set([...materialNames, ...activeNames])].filter(Boolean);
  }, [materials, materialNames]);

  const DEFAULT_CATEGORIES = ["Raw Material", "F G Material"];

  const filteredCategorySuggestions = useMemo(() => {
    const allCategories = [...new Set([...DEFAULT_CATEGORIES, ...categories])];
    return allCategories.filter((c) =>
      c.toLowerCase().includes(formCategory.toLowerCase()),
    );
  }, [categories, formCategory]);

  const filteredNameSuggestions = useMemo(() => {
    return materialNamesSuggestions.filter((n) =>
      n.toLowerCase().includes(formName.toLowerCase()),
    );
  }, [materialNamesSuggestions, formName]);

  // Derived columns calculation
  const calculatedRows = useMemo(() => {
    return materials.map((m) => {
      const safetyStock = (Number(m.adc) || 0) * (Number(m.safetyFactor) || 0);
      const reorderLevel =
        (Number(m.adc) || 0) * (Number(m.leadTime) || 0) + safetyStock;
      const maxLevel = reorderLevel + (Number(m.moq) || 0);
      return {
        ...m,
        safetyStock,
        reorderLevel,
        maxLevel,
      };
    });
  }, [materials]);

  // Filtered materials
  const filteredMaterials = useMemo(() => {
    let rows = activeUser.location
      ? calculatedRows.filter((m) => m.location === activeUser.location)
      : calculatedRows;

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.sku.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          (r.supplierName || "").toLowerCase().includes(q),
      );
    }
    if (category) {
      rows = rows.filter((r) => r.category === category);
    }
    if (status) {
      rows = rows.filter((r) => r.status === status);
    }
    if (supplier) {
      rows = rows.filter((r) =>
        (r.supplierName || "").toLowerCase().includes(supplier.toLowerCase()),
      );
    }
    if (unitFilter) {
      rows = rows.filter((r) => r.unit === unitFilter);
    }
    if (minMoq) {
      rows = rows.filter((r) => r.moq >= Number(minMoq));
    }

    // Sort
    return rows.sort((a, b) => {
      let va = a[sortKey],
        vb = b[sortKey];
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      if (va < vb) return -1 * sortDir;
      if (va > vb) return 1 * sortDir;
      return 0;
    });
  }, [
    calculatedRows,
    search,
    category,
    status,
    supplier,
    unitFilter,
    minMoq,
    sortKey,
    sortDir,
    activeUser,
  ]);

  // Pagination details
  const pageSize = settings?.pageSize?.master || 6;
  const totalPages = Math.max(
    1,
    Math.ceil(filteredMaterials.length / pageSize),
  );
  const paginatedMaterials = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMaterials.slice(start, start + pageSize);
  }, [filteredMaterials, currentPage, pageSize]);

  // Handle Sort Request
  const requestSort = (key) => {
    if (sortKey === key) {
      setSortDir((prev) => -prev);
    } else {
      setSortKey(key);
      setSortDir(1);
    }
    setCurrentPage(1);
  };

  // Calculations for Add/Edit Modal
  const modalSafetyStock =
    (Number(formAdc) || 0) * (Number(formSafetyFactor) || 0);
  const modalReorderLevel =
    (Number(formAdc) || 0) * (Number(formLeadTime) || 0) + modalSafetyStock;
  const modalMaxLevel = modalReorderLevel + (Number(formMoq) || 0);

  // Edit action
  const handleEdit = (sku) => {
    const item = materials.find((m) => m.sku === sku);
    if (!item) return;
    setModalMode("edit");
    setFormSku(item.sku);
    setFormName(item.name);
    setFormCategory(item.category);
    setFormSubCategory(item.subCategory || "");
    setFormUnit(item.unit);
    setFormLocation(item.location || "");
    setFormOpening(item.opening || 0);
    setFormAdc(item.adc || 0);
    setFormLeadTime(item.leadTime || 0);
    setFormSafetyFactor(item.safetyFactor || 0);
    setFormMoq(item.moq || 0);
    setFormSupplierName(item.supplierName || "");
    setFormSupplierCode(item.supplierCode || "");
    setFormStatus(item.status || "Active");
    setIsModalOpen(true);
  };

  // Delete action
  const handleDelete = (sku) => {
    if (
      window.confirm(
        `Are you sure you want to delete material ${sku}? This cannot be undone.`,
      )
    ) {
      dispatch(deleteMaterial({ sku, currentUser: activeUser.name }));
    }
  };

  // Open Add modal
  const handleAdd = () => {
    setModalMode("add");
    setFormSku("");
    setFormName("");
    setFormCategory("");
    setFormSubCategory("");
    setFormUnit(units[0] || "KG");
    setFormLocation(locations[0] || "");
    setFormOpening(0);
    setFormAdc(0);
    setFormLeadTime(0);
    setFormSafetyFactor(0);
    setFormMoq(0);
    setFormSupplierName("");
    setFormSupplierCode("");
    setFormStatus("Active");
    setIsModalOpen(true);
  };

  // Save material handler
  const handleSave = (e) => {
    e.preventDefault();
    if (!formSku || !formName || !formCategory || !formUnit) {
      alert("Please fill out all required fields marked with *");
      return;
    }

    if (
      modalMode === "add" &&
      materials.some(
        (m) => m.sku.toLowerCase() === formSku.trim().toLowerCase(),
      )
    ) {
      alert(`SKU ${formSku} already exists in master data!`);
      return;
    }

    const payload = {
      sku: formSku.trim(),
      name: formName.trim(),
      category: formCategory.trim(),
      subCategory: formSubCategory.trim(),
      unit: formUnit,
      location: formLocation,
      opening: Number(formOpening) || 0,
      adc: Number(formAdc) || 0,
      leadTime: Number(formLeadTime) || 0,
      safetyFactor: Number(formSafetyFactor) || 0,
      moq: Number(formMoq) || 0,
      supplierName: formSupplierName.trim(),
      supplierCode: formSupplierCode.trim(),
      status: formStatus,
    };

    dispatch(saveMaterial({ material: payload, currentUser: activeUser.name }));
    setIsModalOpen(false);
  };

  const handleAddNewUnitPrompt = () => {
    const val = prompt("Enter new Unit of Measurement (e.g. BAG, DRUM):");
    if (!val) return;
    const formatted = val.trim().toUpperCase();
    if (!formatted) return;
    if (units.includes(formatted)) {
      alert("Unit already exists.");
      return;
    }
    const updated = [...units, formatted];
    dispatch(
      saveList({ type: "units", list: updated, currentUser: activeUser.name }),
    );
    setFormUnit(formatted);
  };

  const handleAddNewCategoryPrompt = () => {
    const val = prompt("Enter new Category Name (e.g. Packaging, Spares):");
    if (!val) return;
    const formatted = val.trim();
    if (!formatted) return;
    setFormCategory(formatted);
  };

  // Export CSV
  const handleExport = () => {
    const exportData = filteredMaterials.map((m) => ({
      "SKU Code": m.sku,
      "Material Name": m.name,
      Category: m.category,
      "Sub Category": m.subCategory || "",
      Unit: m.unit,
      "Storage Location": m.location || "",
      "Opening Stock": m.opening || 0,
      "Average Daily Consumption (ADC)": m.adc,
      "Lead Time (Days)": m.leadTime,
      "Safety Factor": m.safetyFactor,
      MOQ: m.moq,
      "Supplier Name": m.supplierName || "",
      "Supplier Code": m.supplierCode || "",
      "Material Status": m.status,
    }));

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Master_Materials_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download template
  const handleDownloadTemplate = () => {
    const headers = [
      [
        "SKU Code",
        "Material Name",
        "Category",
        "Sub Category",
        "Unit",
        "Storage Location",
        "Opening Stock",
        "Average Daily Consumption (ADC)",
        "Lead Time (Days)",
        "Safety Factor",
        "MOQ",
        "Supplier Name",
        "Supplier Code",
        "Material Status",
      ],
    ];
    const csv = Papa.unparse(headers);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Master_Data_Template.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Import CSV
  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          let added = 0;
          let updated = 0;
          results.data.forEach((row) => {
            const sku = String(row["SKU Code"] || "").trim();
            if (!sku) return;

            const payload = {
              sku,
              name: String(row["Material Name"] || "").trim(),
              category: String(row["Category"] || "").trim(),
              subCategory: String(row["Sub Category"] || "").trim(),
              unit: String(row["Unit"] || "KG").trim(),
              location: String(row["Storage Location"] || "").trim(),
              opening: Number(row["Opening Stock"]) || 0,
              adc: Number(row["Average Daily Consumption (ADC)"]) || 0,
              leadTime: Number(row["Lead Time (Days)"]) || 0,
              safetyFactor: Number(row["Safety Factor"]) || 0,
              moq: Number(row["MOQ"]) || 0,
              supplierName: String(row["Supplier Name"] || "").trim(),
              supplierCode: String(row["Supplier Code"] || "").trim(),
              status:
                String(row["Material Status"] || "Active").trim() || "Active",
            };

            dispatch(
              saveMaterial({ material: payload, currentUser: activeUser.name }),
            );
            if (materials.some((m) => m.sku === sku)) updated++;
            else added++;
          });
          alert(`Import complete: ${added} added, ${updated} updated.`);
        } catch (err) {
          alert("Failed to parse file. Please verify CSV headers.");
        }
      },
    });
    e.target.value = "";
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 rounded-3xl p-4 shadow-xs">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
            size={18}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search SKU, material, category, supplier..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl bg-gray-50 text-gray-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setCurrentPage(1);
          }}
          className="px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 text-gray-900 text-sm cursor-pointer"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setCurrentPage(1);
          }}
          className="px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 text-gray-900 text-sm cursor-pointer"
        >
          <option value="">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>

        <button
          onClick={() => setShowFilters((prev) => !prev)}
          className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-bold transition-all cursor-pointer ${
            showFilters
              ? "border-indigo-500 bg-indigo-50 text-indigo-700"
              : "border-gray-200 text-gray-700 hover:border-indigo-500 hover:text-indigo-600"
          }`}
        >
          <SlidersHorizontal size={16} />
          Custom
        </button>

        {!isViewer && (
          <>
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 bg-white cursor-pointer"
            >
              <Download size={14} />
              Template
            </button>
            <label className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 bg-white cursor-pointer hover:border-indigo-500 hover:text-indigo-600">
              <Upload size={14} />
              Import
              <input
                type="file"
                accept=".csv"
                onChange={handleImportFile}
                className="hidden"
              />
            </label>
          </>
        )}

        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-755 bg-white cursor-pointer"
        >
          <FileSpreadsheet size={14} />
          Export
        </button>

        {!isViewer && (
          <button
            onClick={handleAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm cursor-pointer active:scale-95 transition-all"
          >
            <Plus size={16} />
            Add Material
          </button>
        )}
      </div>

      {/* Expanded Custom Filters */}
      {showFilters && (
        <div className="flex flex-wrap gap-4 bg-gray-50 border border-dashed border-gray-200 p-4 rounded-2xl">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Supplier
            </label>
            <input
              type="text"
              value={supplier}
              onChange={(e) => {
                setSupplier(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Tata Steel..."
              className="px-3.5 py-1.5 border border-gray-200 rounded-xl bg-white text-sm text-gray-900 w-44"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Unit
            </label>
            <select
              value={unitFilter}
              onChange={(e) => {
                setUnitFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3.5 py-1.5 border border-gray-200 rounded-xl bg-white text-sm text-gray-900 w-28 cursor-pointer"
            >
              <option value="">All Units</option>
              {units.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Min MOQ
            </label>
            <input
              type="number"
              value={minMoq}
              onChange={(e) => {
                setMinMoq(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="e.g. 100"
              className="px-3.5 py-1.5 border border-gray-200 rounded-xl bg-white text-sm text-gray-900 w-32"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setSupplier("");
                setUnitFilter("");
                setMinMoq("");
              }}
              className="px-4 py-2 text-xs font-bold text-indigo-650 bg-indigo-50 rounded-xl cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Grid Table */}
      <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs font-bold uppercase tracking-wider select-none">
                <th
                  className="px-5 py-4 cursor-pointer hover:text-indigo-500"
                  onClick={() => requestSort("sku")}
                >
                  SKU Code
                </th>
                <th
                  className="px-5 py-4 cursor-pointer hover:text-indigo-500"
                  onClick={() => requestSort("name")}
                >
                  Material Name
                </th>
                <th
                  className="px-5 py-4 cursor-pointer hover:text-indigo-500"
                  onClick={() => requestSort("category")}
                >
                  Category
                </th>
                <th
                  className="px-5 py-4 cursor-pointer hover:text-indigo-500"
                  onClick={() => requestSort("subCategory")}
                >
                  Sub Category
                </th>
                <th
                  className="px-5 py-4 cursor-pointer hover:text-indigo-500"
                  onClick={() => requestSort("unit")}
                >
                  Unit
                </th>
                <th
                  className="px-5 py-4 cursor-pointer hover:text-indigo-500"
                  onClick={() => requestSort("location")}
                >
                  Location
                </th>
                <th
                  className="px-5 py-4 cursor-pointer hover:text-indigo-500"
                  onClick={() => requestSort("adc")}
                >
                  ADC
                </th>
                <th
                  className="px-5 py-4 cursor-pointer hover:text-indigo-500"
                  onClick={() => requestSort("leadTime")}
                >
                  Lead Time
                </th>
                <th
                  className="px-5 py-4 cursor-pointer hover:text-indigo-500"
                  onClick={() => requestSort("safetyFactor")}
                >
                  Safety Fact
                </th>
                <th
                  className="px-5 py-4 cursor-pointer hover:text-indigo-500"
                  onClick={() => requestSort("safetyStock")}
                >
                  Safety Stk
                </th>
                <th
                  className="px-5 py-4 cursor-pointer hover:text-indigo-500"
                  onClick={() => requestSort("reorderLevel")}
                >
                  Reorder Lvl
                </th>
                <th
                  className="px-5 py-4 cursor-pointer hover:text-indigo-500"
                  onClick={() => requestSort("moq")}
                >
                  MOQ
                </th>
                <th
                  className="px-5 py-4 cursor-pointer hover:text-indigo-500"
                  onClick={() => requestSort("maxLevel")}
                >
                  Max Lvl
                </th>
                <th
                  className="px-5 py-4 cursor-pointer hover:text-indigo-500"
                  onClick={() => requestSort("supplierName")}
                >
                  Supplier
                </th>
                <th
                  className="px-5 py-4 cursor-pointer hover:text-indigo-500"
                  onClick={() => requestSort("status")}
                >
                  Status
                </th>
                {!isViewer && <th className="px-5 py-4">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-150 text-gray-700">
              {paginatedMaterials.length === 0 ? (
                <tr>
                  <td colSpan={16} className="text-center py-10 text-gray-400">
                    No materials found.
                  </td>
                </tr>
              ) : (
                paginatedMaterials.map((m) => (
                  <tr
                    key={m.sku}
                    className="hover:bg-gray-50/50"
                  >
                    <td className="px-5 py-4 font-mono font-bold text-gray-900">
                      {m.sku}
                    </td>
                    <td className="px-5 py-4 font-bold text-gray-900 whitespace-nowrap">
                      {m.name}
                    </td>
                    <td className="px-5 py-4">{m.category}</td>
                    <td className="px-5 py-4">{m.subCategory || "—"}</td>
                    <td className="px-5 py-4 font-semibold">{m.unit}</td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      {m.location || "—"}
                    </td>
                    <td className="px-5 py-4">{m.adc.toLocaleString()}</td>
                    <td className="px-5 py-4">{m.leadTime}d</td>
                    <td className="px-5 py-4">{m.safetyFactor}</td>
                    <td className="px-5 py-4">
                      {m.safetyStock.toLocaleString()}
                    </td>
                    <td className="px-5 py-4">
                      {m.reorderLevel.toLocaleString()}
                    </td>
                    <td className="px-5 py-4">{m.moq.toLocaleString()}</td>
                    <td className="px-5 py-4">{m.maxLevel.toLocaleString()}</td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      {m.supplierName || "—"}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          m.status === "Active"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${m.status === "Active" ? "bg-emerald-500" : "bg-gray-450"}`}
                        />
                        {m.status}
                      </span>
                    </td>
                    {!isViewer && (
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(m.sku)}
                            className="p-1 text-gray-450 hover:text-indigo-600 hover:bg-gray-100 rounded-lg cursor-pointer"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(m.sku)}
                            className="p-1 text-gray-450 hover:text-rose-600 hover:bg-gray-100 rounded-lg cursor-pointer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-gray-50 border-t border-gray-200 text-xs font-bold text-gray-550">
            <div>
              Showing{" "}
              {Math.min(
                filteredMaterials.length,
                (currentPage - 1) * pageSize + 1,
              )}
              –{Math.min(filteredMaterials.length, currentPage * pageSize)} of{" "}
              {filteredMaterials.length} items
            </div>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalPages }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentPage(idx + 1)}
                  className={`w-7 h-7 rounded-lg transition-colors cursor-pointer flex items-center justify-center border text-[11px] ${
                    currentPage === idx + 1
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white border-gray-200 text-gray-650 hover:bg-gray-50"
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ADD/EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative bg-white border border-gray-200 rounded-3xl w-full max-w-2xl shadow-2xl animate-scale-up flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-150 px-6 py-4">
              <h3 className="text-lg font-black text-gray-900">
                {modalMode === "edit"
                  ? "Edit Material specifications"
                  : "Add New Material to Master"}
              </h3>
              <div className="flex items-center gap-3">
                {modalMode === "add" && !isViewer && (
                  <label className="flex items-center gap-1.5 px-3 py-1.5 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-655 bg-indigo-50/50 hover:bg-indigo-50 cursor-pointer active:scale-95 transition-all">
                    <Upload size={13} />
                    Import CSV
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleImportFile}
                      className="hidden"
                    />
                  </label>
                )}
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSave}>
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    SKU Code *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={modalMode === "edit"}
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    placeholder="e.g. SKU-1001"
                    className="px-3.5 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                  />
                </div>

                <div className="flex flex-col gap-1.5 relative">
                  <label className="text-xs font-bold text-gray-505 uppercase tracking-wider">
                    Material Name *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => {
                        setFormName(e.target.value);
                        setShowNameDropdown(true);
                      }}
                      onFocus={() => setShowNameDropdown(true)}
                      onBlur={() =>
                        setTimeout(() => setShowNameDropdown(false), 200)
                      }
                      placeholder="e.g. Steel Rod 12mm"
                      className="w-full px-3.5 py-2 pr-10 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-955 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      tabIndex="-1"
                      onClick={() => setShowNameDropdown(!showNameDropdown)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <ChevronDown
                        size={16}
                        className={`transition-transform duration-200 ${showNameDropdown ? "rotate-180" : ""}`}
                      />
                    </button>
                  </div>

                  {showNameDropdown && filteredNameSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto z-50 divide-y divide-gray-100">
                      {filteredNameSuggestions.map((n) => (
                        <div
                          key={n}
                          onMouseDown={() => {
                            setFormName(n);
                            setShowNameDropdown(false);
                          }}
                          className="px-4 py-2 text-sm text-left text-gray-750 hover:bg-indigo-50 hover:text-indigo-705 cursor-pointer transition-colors"
                        >
                          {n}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5 relative">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-505 uppercase tracking-wider">
                      Category *
                    </label>
                    <button
                      type="button"
                      onClick={handleAddNewCategoryPrompt}
                      className="text-xs text-indigo-655 hover:text-indigo-700 font-bold flex items-center gap-0.5 cursor-pointer active:scale-95 transition-transform"
                      title="Add New Category"
                    >
                      <Plus size={12} />
                      New
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={formCategory}
                      onChange={(e) => {
                        setFormCategory(e.target.value);
                        setShowCategoryDropdown(true);
                      }}
                      onFocus={() => setShowCategoryDropdown(true)}
                      onBlur={() =>
                        setTimeout(() => setShowCategoryDropdown(false), 200)
                      }
                      placeholder="e.g. Raw Material"
                      className="w-full px-3.5 py-2 pr-10 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-955 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      tabIndex="-1"
                      onClick={() =>
                        setShowCategoryDropdown(!showCategoryDropdown)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <ChevronDown
                        size={16}
                        className={`transition-transform duration-200 ${showCategoryDropdown ? "rotate-180" : ""}`}
                      />
                    </button>
                  </div>

                  {showCategoryDropdown &&
                    filteredCategorySuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto z-50 divide-y divide-gray-100">
                        {filteredCategorySuggestions.map((c) => (
                          <div
                            key={c}
                            onMouseDown={() => {
                              setFormCategory(c);
                              setShowCategoryDropdown(false);
                            }}
                            className="px-4 py-2 text-sm text-left text-gray-750 hover:bg-indigo-50 hover:text-indigo-705 cursor-pointer transition-colors"
                          >
                            {c}
                          </div>
                        ))}
                      </div>
                    )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Sub Category
                  </label>
                  <input
                    type="text"
                    value={formSubCategory}
                    onChange={(e) => setFormSubCategory(e.target.value)}
                    placeholder="e.g. Metals"
                    className="px-3.5 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Unit *
                    </label>
                    <button
                      type="button"
                      onClick={handleAddNewUnitPrompt}
                      className="text-xs text-indigo-650 hover:text-indigo-700 font-bold flex items-center gap-0.5 cursor-pointer active:scale-95 transition-transform"
                      title="Add New Unit"
                    >
                      <Plus size={12} />
                      New
                    </button>
                  </div>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-900 cursor-pointer focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    {units.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Storage Location
                  </label>
                  <select
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="px-3.5 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-900 cursor-pointer focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select storage location...</option>
                    {locations.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>

                {modalMode === "add" && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Opening Stock Balance
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formOpening}
                      onChange={(e) =>
                        setFormOpening(Number(e.target.value) || 0)
                      }
                      className="px-3.5 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Avg Daily Consumption (ADC) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formAdc}
                    onChange={(e) => setFormAdc(Number(e.target.value) || 0)}
                    className="px-3.5 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Lead Time (Days) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formLeadTime}
                    onChange={(e) =>
                      setFormLeadTime(Number(e.target.value) || 0)
                    }
                    className="px-3.5 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Safety Factor *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    required
                    value={formSafetyFactor}
                    onChange={(e) =>
                      setFormSafetyFactor(Number(e.target.value) || 0)
                    }
                    className="px-3.5 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    MOQ *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formMoq}
                    onChange={(e) => setFormMoq(Number(e.target.value) || 0)}
                    className="px-3.5 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Supplier Name
                  </label>
                  <input
                    type="text"
                    value={formSupplierName}
                    onChange={(e) => setFormSupplierName(e.target.value)}
                    placeholder="Tata Steel Ltd."
                    className="px-3.5 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Supplier Code
                  </label>
                  <input
                    type="text"
                    value={formSupplierCode}
                    onChange={(e) => setFormSupplierCode(e.target.value)}
                    placeholder="e.g. SUP-001"
                    className="px-3.5 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Material Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="px-3.5 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-900 cursor-pointer focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                {/* Auto Calculated Preview Fields */}
                <div className="sm:col-span-2 grid grid-cols-3 gap-3 pt-3 border-t border-gray-150">
                  <div className="bg-indigo-500/5 p-3 rounded-2xl border border-indigo-500/10">
                    <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">
                      Safety Stock
                    </div>
                    <div className="text-sm font-black text-indigo-650">
                      {modalSafetyStock.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-amber-500/5 p-3 rounded-2xl border border-amber-500/10">
                    <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">
                      Reorder Lvl
                    </div>
                    <div className="text-sm font-black text-amber-650">
                      {modalReorderLevel.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-blue-500/5 p-3 rounded-2xl border border-blue-500/10">
                    <div className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">
                      Max Level
                    </div>
                    <div className="text-sm font-black text-blue-650">
                      {modalMaxLevel.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-gray-150 px-6 py-4 bg-gray-50 rounded-b-3xl">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2 text-sm font-bold bg-white text-gray-700 border border-gray-200 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs cursor-pointer"
                >
                  {modalMode === "edit"
                    ? "Save Specifications"
                    : "Add SKU Material"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
