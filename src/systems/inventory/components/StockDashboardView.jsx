// src/systems/inventory/components/StockDashboardView.jsx
import { useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Search, FileSpreadsheet, Download, Upload, Plus, Edit2, Trash2, History, X, TrendingUp, LineChart, ChevronDown } from 'lucide-react';
import { ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, Line, ReferenceLine } from 'recharts';
import Papa from "papaparse";
import { saveMaterial, deleteMaterial, saveSettings, saveList, postTransaction,  } from '../redux/slice/inventorySlice';

const BAND_STYLES = {
  "Excess Stock": {
    rowCls: "bg-blue-500/5 hover:bg-blue-500/10 border-l-4 border-l-blue-500",
    badgeCls:
      "bg-blue-100 text-blue-700",
  },
  "Normal Stock": {
    rowCls:
      "bg-emerald-500/5 hover:bg-emerald-500/10 border-l-4 border-l-emerald-500",
    badgeCls:
      "bg-emerald-100 text-emerald-700",
  },
  "66.33% Stock": {
    rowCls:
      "bg-amber-500/5 hover:bg-amber-500/10 border-l-4 border-l-amber-500",
    badgeCls:
      "bg-amber-100 text-amber-700",
  },
  "Below 33%": {
    rowCls: "bg-rose-500/5 hover:bg-rose-500/10 border-l-4 border-l-rose-500",
    badgeCls:
      "bg-rose-100 text-rose-700",
  },
};

export default function StockDashboardView({ activeUser }) {
  const dispatch = useDispatch();
  const {
    materials,
    transactions,
    settings,
    units = [],
    locations = [],
    materialNames = [],
  } = useSelector((state) => state.inventory);

  const isViewer = activeUser.role === "Viewer";

  // States
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [band, setBand] = useState("");
  const [materialFilter, setMaterialFilter] = useState("");

  // Table Pagination / Sorting state
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState("sku");
  const [sortDir, setSortDir] = useState(1); // 1 = asc, -1 = desc

  // Modal states
  const [historyModal, setHistoryModal] = useState({
    isOpen: false,
    sku: "",
    type: "",
  });
  const [trendModal, setTrendModal] = useState({ isOpen: false, sku: "" });

  // Add Material Modal States
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

  // Post Transaction Modal States
  const [isTxnModalOpen, setIsTxnModalOpen] = useState(false);
  const [txnFormSku, setTxnFormSku] = useState("");
  const [txnFormQty, setTxnFormQty] = useState("");
  const [txnFormType, setTxnFormType] = useState("IN");
  const [txnFormRef, setTxnFormRef] = useState("");
  const [txnFormRemarks, setTxnFormRemarks] = useState("");
  const [txnFormDate, setTxnFormDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [txnFormLocation, setTxnFormLocation] = useState("");

  // Download CSV template
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
    link.setAttribute("download", "Master_Data_Template.csv");
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
        } catch {
          alert("Failed to parse file. Please verify CSV headers.");
        }
      },
    });
    e.target.value = "";
  };

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

  const handleDelete = (sku) => {
    if (
      window.confirm(
        `Are you sure you want to delete material ${sku}? This cannot be undone.`,
      )
    ) {
      dispatch(deleteMaterial({ sku, currentUser: activeUser.name }));
    }
  };

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

  const modalSafetyStock =
    (Number(formAdc) || 0) * (Number(formSafetyFactor) || 0);
  const modalReorderLevel =
    (Number(formAdc) || 0) * (Number(formLeadTime) || 0) + modalSafetyStock;
  const modalMaxLevel = modalReorderLevel + (Number(formMoq) || 0);

  // Derived closing stock per SKU (for OUT warning in transaction modal)
  const currentClosingStocks = useMemo(() => {
    const balances = {};
    materials.forEach((m) => {
      balances[m.sku] = Number(m.opening) || 0;
    });
    transactions.forEach((t) => {
      if (balances[t.sku] !== undefined) {
        balances[t.sku] +=
          t.type === "IN" ? Number(t.qty) || 0 : -(Number(t.qty) || 0);
      }
    });
    return balances;
  }, [materials, transactions]);

  const activeMaterials = useMemo(
    () => materials.filter((m) => m.status === "Active"),
    [materials],
  );

  const handleTxnSkuChange = (sku) => {
    setTxnFormSku(sku);
    const mat = materials.find((m) => m.sku === sku);
    setTxnFormLocation(mat ? mat.location || "" : "");
  };

  const handleOpenTxnModal = () => {
    setTxnFormSku("");
    setTxnFormQty("");
    setTxnFormType("IN");
    setTxnFormRef("");
    setTxnFormRemarks("");
    setTxnFormLocation("");
    setTxnFormDate(new Date().toISOString().slice(0, 10));
    setIsTxnModalOpen(true);
  };

  const handlePostTransaction = (e) => {
    e.preventDefault();
    const qty = Number(txnFormQty);
    if (!txnFormSku || !qty || qty <= 0) {
      alert("Please fill out all required fields.");
      return;
    }
    const selectedMat = materials.find((m) => m.sku === txnFormSku);
    if (!selectedMat) {
      alert("Invalid material selection.");
      return;
    }

    if (txnFormType === "OUT") {
      const balance = currentClosingStocks[txnFormSku] || 0;
      if (qty > balance) {
        const proceed = window.confirm(
          `WARNING: Outward issue of ${qty.toLocaleString()} ${selectedMat.unit} exceeds current closing stock of ${balance.toLocaleString()} ${selectedMat.unit}.\n\nPost anyway?`,
        );
        if (!proceed) return;
      }
    }

    dispatch(
      postTransaction({
        transaction: {
          sku: txnFormSku,
          name: selectedMat.name,
          qty,
          type: txnFormType,
          date: txnFormDate,
          ref: txnFormRef.trim(),
          remarks: txnFormRemarks.trim(),
          user: activeUser.name,
        },
        currentUser: activeUser.name,
      }),
    );

    if (txnFormLocation && txnFormLocation !== selectedMat.location) {
      dispatch(
        saveMaterial({
          material: { ...selectedMat, location: txnFormLocation },
          currentUser: activeUser.name,
        }),
      );
    }

    setIsTxnModalOpen(false);
  };

  // Get categories for dropdown filter
  const categories = useMemo(() => {
    return [...new Set(materials.map((m) => m.category))].filter(Boolean);
  }, [materials]);

  // Get material names for dropdown filter
  const uniqueMaterialNames = useMemo(() => {
    return [...new Set(materials.map((m) => m.name))].filter(Boolean).sort();
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, formCategory]);

  const filteredNameSuggestions = useMemo(() => {
    return materialNamesSuggestions.filter((n) =>
      n.toLowerCase().includes(formName.toLowerCase()),
    );
  }, [materialNamesSuggestions, formName]);

  // Derived stock table calculations
  const tableRows = useMemo(() => {
    // 1. Calculate stock balances per SKU
    const matClosing = {};
    const matIn = {};
    const matOut = {};

    materials.forEach((m) => {
      matClosing[m.sku] = Number(m.opening) || 0;
      matIn[m.sku] = 0;
      matOut[m.sku] = 0;
    });

    transactions.forEach((t) => {
      if (matClosing[t.sku] !== undefined) {
        const qty = Number(t.qty) || 0;
        if (t.type === "IN") {
          matClosing[t.sku] += qty;
          matIn[t.sku] += qty;
        } else {
          matClosing[t.sku] -= qty;
          matOut[t.sku] += qty;
        }
      }
    });

    return materials.map((m) => {
      const closingStock = matClosing[m.sku] || 0;
      const safetyStock = (Number(m.adc) || 0) * (Number(m.safetyFactor) || 0);
      const reorderLevel =
        (Number(m.adc) || 0) * (Number(m.leadTime) || 0) + safetyStock;
      const maxLevel = reorderLevel + (Number(m.moq) || 0);

      // Determine stock band (only meaningful once ADC/consumption data exists —
      // otherwise maxLevel collapses to just the MOQ and any stock reads as "Excess")
      let bandName = "Normal Stock";
      if (maxLevel > 0 && (Number(m.adc) || 0) > 0) {
        const pct = (closingStock / maxLevel) * 100;
        if (pct > 100) bandName = "Excess Stock";
        else if (pct >= 66.33) bandName = "Normal Stock";
        else if (pct >= 33) bandName = "66.33% Stock";
        else bandName = "Below 33%";
      }

      return {
        ...m,
        closingStock,
        safetyStock,
        reorderLevel,
        maxLevel,
        totalIn: matIn[m.sku] || 0,
        totalOut: matOut[m.sku] || 0,
        band: bandName,
      };
    });
  }, [materials, transactions]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    let rows = activeUser.location
      ? tableRows.filter((m) => m.location === activeUser.location)
      : tableRows;

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.sku.toLowerCase().includes(q) || r.name.toLowerCase().includes(q),
      );
    }
    if (category) {
      rows = rows.filter((r) => r.category === category);
    }
    if (materialFilter) {
      rows = rows.filter((r) => r.name === materialFilter);
    }
    if (band) {
      rows = rows.filter((r) => r.band === band);
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
    tableRows,
    search,
    category,
    materialFilter,
    band,
    sortKey,
    sortDir,
    activeUser,
  ]);

  // Pagination details
  const pageSize = settings?.pageSize?.stock || 6;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const handlePageSizeChange = (e) => {
    const newSize = Number(e.target.value);
    dispatch(
      saveSettings({
        settings: {
          ...settings,
          pageSize: {
            ...settings?.pageSize,
            stock: newSize,
          },
        },
        currentUser: activeUser.name,
      }),
    );
    setCurrentPage(1);
  };

  // Handle Sort
  const requestSort = (key) => {
    if (sortKey === key) {
      setSortDir((prev) => -prev);
    } else {
      setSortKey(key);
      setSortDir(1);
    }
    setCurrentPage(1);
  };

  // Export CSV
  const handleExport = () => {
    const exportData = filteredRows.map((r) => ({
      "SKU Code": r.sku,
      "Material Name": r.name,
      Category: r.category,
      "Sub Category": r.subCategory || "",
      "Storage Location": r.location || "",
      "Opening Stock": r.opening || 0,
      ADC: r.adc,
      "Lead Time": r.leadTime,
      "Safety Stock": r.safetyStock,
      "Reorder Level": r.reorderLevel,
      MOQ: r.moq,
      "Max Level": r.maxLevel,
      "Total IN": r.totalIn,
      "Total OUT": r.totalOut,
      "Closing Stock": r.closingStock,
      "Stock Band": r.band,
    }));

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Stock_Report_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Transaction history modal content
  const historyData = useMemo(() => {
    if (!historyModal.isOpen) return [];
    return transactions
      .filter((t) => t.sku === historyModal.sku && t.type === historyModal.type)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, historyModal]);

  const targetMaterial = useMemo(() => {
    return materials.find(
      (m) => m.sku === (historyModal.sku || trendModal.sku),
    );
  }, [materials, historyModal, trendModal]);

  // Stock trend calculations
  const trendCalculations = useMemo(() => {
    if (!trendModal.isOpen || !targetMaterial)
      return { chartData: [], tableData: [], alert: null };

    const skuTxns = transactions
      .filter((t) => t.sku === trendModal.sku)
      .sort((a, b) => a.date.localeCompare(b.date));

    const safetyStock =
      (Number(targetMaterial.adc) || 0) *
      (Number(targetMaterial.safetyFactor) || 0);
    const reorderLevel =
      (Number(targetMaterial.adc) || 0) *
        (Number(targetMaterial.leadTime) || 0) +
      safetyStock;
    const maxLevel = reorderLevel + (Number(targetMaterial.moq) || 0);

    let running = Number(targetMaterial.opening) || 0;
    const chartData = [{ date: "Opening", closing: running }];
    const tableData = [
      {
        date: "Opening Balance",
        txn: "—",
        qty: "—",
        closing: running,
        ref: "—",
      },
    ];

    skuTxns.forEach((t) => {
      const qty = Number(t.qty) || 0;
      if (t.type === "IN") {
        running += qty;
      } else {
        running -= qty;
      }
      chartData.push({ date: t.date, closing: running });
      tableData.push({
        date: t.date,
        txn: t.type,
        qty: (t.type === "IN" ? "+" : "-") + qty.toLocaleString(),
        closing: running,
        ref: t.ref || "—",
      });
    });

    const finalClosing = running;
    let alertType = "healthy";
    let alertMsg = `Stock level is healthy. Current band: ${stockBandOf(finalClosing, maxLevel, targetMaterial.adc)}`;

    if (finalClosing <= safetyStock) {
      alertType = "critical";
      alertMsg = `CRITICAL ALERT: Stock (${finalClosing.toLocaleString()}) is below Safety Stock (${safetyStock.toLocaleString()}). Immediate reorder required!`;
    } else if (finalClosing <= reorderLevel) {
      alertType = "warning";
      alertMsg = `Reorder Alert: Stock (${finalClosing.toLocaleString()}) is below Reorder Level (${reorderLevel.toLocaleString()}). Plan a restock soon.`;
    }

    return {
      chartData,
      tableData: tableData.reverse(),
      alert: { type: alertType, message: alertMsg },
      safetyStock,
      reorderLevel,
    };
  }, [targetMaterial, transactions, trendModal]);

  function stockBandOf(closing, maxLevel, adc) {
    if (maxLevel <= 0 || (Number(adc) || 0) <= 0) return "Normal Stock";
    const pct = (closing / maxLevel) * 100;
    if (pct > 100) return "Excess Stock";
    if (pct >= 66.33) return "Normal Stock";
    if (pct >= 33) return "66.33% Stock";
    return "Below 33%";
  }

  return (
    <div className="space-y-6">
      {/* Legend Ribbon */}
      <div className="grid grid-cols-4 rounded-xl overflow-hidden shadow-sm text-center text-xs font-bold text-white tracking-wider border border-gray-200">
        <div className="bg-blue-600 py-3.5 px-2">
          Excess Stock (&gt;100%)
        </div>
        <div className="bg-emerald-600 py-3.5 px-2">
          Normal Stock (66-100%)
        </div>
        <div className="bg-amber-600 py-3.5 px-2 text-gray-900">
          66.33% Stock (33-66%)
        </div>
        <div className="bg-rose-600 py-3.5 px-2">
          Below 33% (Critical)
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 rounded-3xl p-4 shadow-xs">
        <div className="relative flex-1 min-w-[240px]">
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
            placeholder="Search SKU or material name..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl bg-gray-50 text-gray-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setCurrentPage(1);
          }}
          className="px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 text-gray-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={materialFilter}
          onChange={(e) => {
            setMaterialFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 text-gray-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
        >
          <option value="">All Products</option>
          {uniqueMaterialNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <select
          value={band}
          onChange={(e) => {
            setBand(e.target.value);
            setCurrentPage(1);
          }}
          className="px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 text-gray-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
        >
          <option value="">All Bands</option>
          <option value="Excess Stock">Excess Stock</option>
          <option value="Normal Stock">Normal Stock</option>
          <option value="66.33% Stock">66.33% Stock</option>
          <option value="Below 33%">Below 33%</option>
        </select>

        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-750 hover:border-indigo-500 hover:text-indigo-650 cursor-pointer bg-white"
        >
          <FileSpreadsheet size={16} />
          Export CSV
        </button>

        {!isViewer && (
          <>
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 bg-white hover:border-indigo-500 hover:text-indigo-600 cursor-pointer"
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
            <button
              onClick={handleAdd}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm cursor-pointer active:scale-95 transition-all"
            >
              <Plus size={16} />
              Add Material
            </button>
            <button
              onClick={handleOpenTxnModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm cursor-pointer active:scale-95 transition-all"
            >
              <Plus size={16} />
              Post Transaction
            </button>
          </>
        )}
      </div>

      {/* Grid Container */}
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
                  onClick={() => requestSort("opening")}
                >
                  Opening Stock
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
                  onClick={() => requestSort("safetyStock")}
                >
                  Safety Stock
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
                  onClick={() => requestSort("totalIn")}
                >
                  Total IN
                </th>
                <th
                  className="px-5 py-4 cursor-pointer hover:text-indigo-500"
                  onClick={() => requestSort("totalOut")}
                >
                  Total OUT
                </th>
                <th
                  className="px-5 py-4 cursor-pointer hover:text-indigo-500"
                  onClick={() => requestSort("closingStock")}
                >
                  Closing Stock
                </th>
                <th
                  className="px-5 py-4 cursor-pointer hover:text-indigo-500"
                  onClick={() => requestSort("band")}
                >
                  Stock Band
                </th>
                {!isViewer && <th className="px-5 py-4">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={isViewer ? 15 : 16}
                    className="text-center py-10 text-gray-400"
                  >
                    No matching stock items found.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => {
                  const style =
                    BAND_STYLES[row.band] || BAND_STYLES["Normal Stock"];
                  return (
                    <tr
                      key={row.sku}
                      className={`transition-all duration-150 ${style.rowCls}`}
                    >
                      <td
                        onClick={() =>
                          setTrendModal({ isOpen: true, sku: row.sku })
                        }
                        className="px-5 py-4 font-mono font-bold text-indigo-600 cursor-pointer hover:underline"
                      >
                        {row.sku}
                      </td>
                      <td
                        onClick={() =>
                          setTrendModal({ isOpen: true, sku: row.sku })
                        }
                        className="px-5 py-4 font-bold text-gray-900 cursor-pointer hover:underline whitespace-nowrap"
                      >
                        {row.name}
                      </td>
                      <td className="px-5 py-4 text-gray-600">
                        {row.category}
                      </td>
                      <td className="px-5 py-4 text-gray-500">
                        {row.subCategory || "—"}
                      </td>
                      <td className="px-5 py-4 text-gray-650 font-semibold">
                        {(Number(row.opening) || 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-4 font-bold text-gray-800">
                        {row.adc.toLocaleString()}
                      </td>
                      <td className="px-5 py-4 text-gray-600">
                        {row.leadTime}d
                      </td>
                      <td className="px-5 py-4 text-gray-500">
                        {row.safetyStock.toLocaleString()}
                      </td>
                      <td className="px-5 py-4 text-gray-500">
                        {row.reorderLevel.toLocaleString()}
                      </td>
                      <td className="px-5 py-4 text-gray-500">
                        {row.moq.toLocaleString()}
                      </td>
                      <td className="px-5 py-4 text-gray-500">
                        {row.maxLevel.toLocaleString()}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          onClick={() =>
                            setHistoryModal({
                              isOpen: true,
                              sku: row.sku,
                              type: "IN",
                            })
                          }
                          className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-teal-500/10 text-teal-600 cursor-pointer hover:bg-teal-500/20"
                        >
                          {row.totalIn.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          onClick={() =>
                            setHistoryModal({
                              isOpen: true,
                              sku: row.sku,
                              type: "OUT",
                            })
                          }
                          className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 cursor-pointer hover:bg-rose-500/20"
                        >
                          {row.totalOut.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-black text-gray-900 text-base">
                        {row.closingStock.toLocaleString()}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${style.badgeCls}`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              row.band === "Below 33%"
                                ? "bg-rose-500 animate-pulse"
                                : row.band === "66.33% Stock"
                                  ? "bg-amber-500"
                                  : row.band === "Normal Stock"
                                    ? "bg-emerald-500"
                                    : "bg-blue-500"
                            }`}
                          />
                          {row.band}
                        </span>
                      </td>
                      {!isViewer && (
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEdit(row.sku)}
                              className="p-1 text-gray-450 hover:text-indigo-600 hover:bg-gray-100 rounded-lg cursor-pointer"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => handleDelete(row.sku)}
                              className="p-1 text-gray-450 hover:text-rose-600 hover:bg-gray-100 rounded-lg cursor-pointer"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-gray-50 border-t border-gray-200 text-xs font-bold text-gray-500">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div>
              Showing{" "}
              {filteredRows.length === 0
                ? 0
                : Math.min(
                    filteredRows.length,
                    (currentPage - 1) * pageSize + 1,
                  )}
              –{Math.min(filteredRows.length, currentPage * pageSize)} of{" "}
              {filteredRows.length} items
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase text-gray-400 tracking-wider">
                Rows per page:
              </span>
              <select
                value={pageSize}
                onChange={handlePageSizeChange}
                className="px-2 py-0.5 border border-gray-200 rounded-md bg-white text-gray-700 cursor-pointer focus:ring-1 focus:ring-indigo-500 font-normal"
              >
                <option value="6">6</option>
                <option value="12">12</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalPages }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentPage(idx + 1)}
                  className={`w-7 h-7 rounded-lg transition-colors cursor-pointer flex items-center justify-center border text-[11px] ${
                    currentPage === idx + 1
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: Transaction History */}
      {historyModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative bg-white border border-gray-200 rounded-3xl w-full max-w-xl shadow-2xl animate-scale-up flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-150 px-6 py-4">
              <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <History className="text-indigo-500" size={20} />
                <span>{historyModal.type} Transaction History</span>
              </h3>
              <button
                onClick={() =>
                  setHistoryModal({ isOpen: false, sku: "", type: "" })
                }
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 mb-5 text-sm">
                <div className="grid grid-cols-2 gap-2 text-gray-700">
                  <div>
                    SKU Code:{" "}
                    <span className="font-mono font-bold text-gray-900">
                      {historyModal.sku}
                    </span>
                  </div>
                  <div>
                    Material:{" "}
                    <span className="font-bold text-gray-900">
                      {targetMaterial?.name}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-505 font-bold border-b border-gray-200">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Qty</th>
                      <th className="px-4 py-3">Reference</th>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-750">
                    {historyData.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="text-center py-6 text-gray-400"
                        >
                          No {historyModal.type} logs available.
                        </td>
                      </tr>
                    ) : (
                      historyData.map((log) => (
                        <tr key={log.id}>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {log.date}
                          </td>
                          <td className="px-4 py-3 font-bold text-gray-900">
                            {log.qty.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 font-mono">
                            {log.ref || "—"}
                          </td>
                          <td className="px-4 py-3 truncate max-w-[80px]">
                            {log.user}
                          </td>
                          <td
                            className="px-4 py-3 max-w-[120px] truncate"
                            title={log.remarks}
                          >
                            {log.remarks || "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex justify-end border-t border-gray-150 px-6 py-4">
              <button
                onClick={() =>
                  setHistoryModal({ isOpen: false, sku: "", type: "" })
                }
                className="px-5 py-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Stock Trend */}
      {trendModal.isOpen && targetMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative bg-white border border-gray-200 rounded-3xl w-full max-w-4xl shadow-2xl animate-scale-up flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-150 px-6 py-4">
              <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <TrendingUp className="text-indigo-500" size={20} />
                <span>
                  Stock Level Analytics — {targetMaterial.name} (
                  {trendModal.sku})
                </span>
              </h3>
              <button
                onClick={() => setTrendModal({ isOpen: false, sku: "" })}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[75vh] space-y-6">
              {/* Alert Ribbon */}
              {trendCalculations.alert && (
                <div
                  className={`p-4 rounded-2xl border text-sm font-bold flex items-center gap-2 ${
                    trendCalculations.alert.type === "critical"
                      ? "bg-rose-50 border-rose-200 text-rose-700"
                      : trendCalculations.alert.type === "warning"
                        ? "bg-amber-50 border-amber-200 text-amber-700"
                        : "bg-emerald-50 border-emerald-200 text-emerald-700"
                  }`}
                >
                  <span className="text-base">
                    {trendCalculations.alert.type === "critical"
                      ? "🚨"
                      : trendCalculations.alert.type === "warning"
                        ? "⚠️"
                        : "✅"}
                  </span>
                  {trendCalculations.alert.message}
                </div>
              )}

              {/* Line Chart */}
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                  Stock Level Timeline
                </h4>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={trendCalculations.chartData}
                      margin={{ top: 10, right: 25, left: -25, bottom: 0 }}
                    >
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        style={{ fontSize: "9px" }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        style={{ fontSize: "9px" }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(15, 23, 42, 0.9)",
                          border: "none",
                          borderRadius: "8px",
                          color: "#fff",
                          fontSize: "11px",
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={24}
                        iconSize={8}
                        wrapperStyle={{ fontSize: "10px" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="closing"
                        name="Stock Level"
                        stroke="#6366f1"
                        strokeWidth={2.5}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                      <ReferenceLine
                        y={trendCalculations.reorderLevel}
                        stroke="#d97706"
                        strokeDasharray="4 4"
                        label={{
                          value: "Reorder Level",
                          fill: "#d97706",
                          fontSize: 9,
                          position: "insideTopRight",
                        }}
                      />
                      <ReferenceLine
                        y={trendCalculations.safetyStock}
                        stroke="#ef4444"
                        strokeDasharray="3 3"
                        label={{
                          value: "Safety Stock",
                          fill: "#ef4444",
                          fontSize: 9,
                          position: "insideBottomRight",
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Transaction Stream */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Transaction Ledger
                </h4>
                <div className="border border-gray-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-550 font-bold border-b border-gray-200">
                        <th className="px-5 py-3">Date</th>
                        <th className="px-5 py-3">Transaction</th>
                        <th className="px-5 py-3">Quantity</th>
                        <th className="px-5 py-3">Closing Stock Balance</th>
                        <th className="px-5 py-3">Reference #</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-750">
                      {trendCalculations.tableData.map((row, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-gray-50/50"
                        >
                          <td className="px-5 py-3 font-semibold">
                            {row.date}
                          </td>
                          <td className="px-5 py-3">
                            {row.txn === "IN" ? (
                              <span className="inline-flex px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 font-bold">
                                IN
                              </span>
                            ) : row.txn === "OUT" ? (
                              <span className="inline-flex px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold font-bold">
                                OUT
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3 font-bold">{row.qty}</td>
                          <td className="px-5 py-3 text-gray-900 font-extrabold text-sm">
                            {row.closing.toLocaleString()}
                          </td>
                          <td className="px-5 py-3 font-mono">{row.ref}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="flex justify-end border-t border-gray-150 px-6 py-4">
              <button
                onClick={() => setTrendModal({ isOpen: false, sku: "" })}
                className="px-6 py-2.5 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs cursor-pointer active:scale-95 transition-transform"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD MATERIAL MODAL */}
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
                  <label className="flex items-center gap-1.5 px-3 py-1.5 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-650 bg-indigo-50/50 hover:bg-indigo-50 cursor-pointer active:scale-95 transition-all">
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
                <div className="flex flex-col gap-1.5 text-left">
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

                <div className="flex flex-col gap-1.5 text-left relative">
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
                          className="px-4 py-2 text-sm text-left text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer transition-colors"
                        >
                          {n}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5 text-left relative">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-505 uppercase tracking-wider">
                      Category *
                    </label>
                    <button
                      type="button"
                      onClick={handleAddNewCategoryPrompt}
                      className="text-xs text-indigo-650 hover:text-indigo-700 font-bold flex items-center gap-0.5 cursor-pointer active:scale-95 transition-transform"
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

                <div className="flex flex-col gap-1.5 text-left">
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

                <div className="flex flex-col gap-1.5 text-left">
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

                <div className="flex flex-col gap-1.5 text-left">
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
                  <div className="flex flex-col gap-1.5 text-left">
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

                <div className="flex flex-col gap-1.5 text-left">
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

                <div className="flex flex-col gap-1.5 text-left">
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

                <div className="flex flex-col gap-1.5 text-left">
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

                <div className="flex flex-col gap-1.5 text-left">
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

                <div className="flex flex-col gap-1.5 text-left">
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

                <div className="flex flex-col gap-1.5 text-left">
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

                <div className="flex flex-col gap-1.5 text-left">
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
                <div className="sm:col-span-2 grid grid-cols-3 gap-3 pt-3 border-t border-gray-150 text-left">
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

      {/* POST TRANSACTION MODAL */}
      {isTxnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-lg shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-gray-150 px-6 py-4">
              <h3 className="text-lg font-black text-gray-900">
                New Inventory Movement Entry
              </h3>
              <button
                onClick={() => setIsTxnModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handlePostTransaction}>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5 col-span-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Select SKU / Material Code *
                    </label>
                    <select
                      required
                      value={txnFormSku}
                      onChange={(e) => handleTxnSkuChange(e.target.value)}
                      className="px-3.5 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="">Select a material SKU...</option>
                      {activeMaterials.map((m) => (
                        <option key={m.sku} value={m.sku}>
                          {m.sku} — {m.name} ({m.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5 col-span-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Storage Location *
                    </label>
                    <select
                      required
                      value={txnFormLocation}
                      onChange={(e) => setTxnFormLocation(e.target.value)}
                      className="px-3.5 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="">Select a storage location...</option>
                      {[...new Set([...locations, txnFormLocation])]
                        .filter(Boolean)
                        .map((loc) => (
                          <option key={loc} value={loc}>
                            {loc}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Movement Type *
                    </label>
                    <select
                      value={txnFormType}
                      onChange={(e) => setTxnFormType(e.target.value)}
                      className="px-3.5 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-900 cursor-pointer focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="IN">IN (Stock Inward / Receipt)</option>
                      <option value="OUT">OUT (Stock Outward / Issue)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Quantity *
                    </label>
                    <input
                      type="number"
                      required
                      min="0.0001"
                      step="any"
                      value={txnFormQty}
                      onChange={(e) => setTxnFormQty(e.target.value)}
                      placeholder="e.g. 100"
                      className="px-3.5 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Transaction Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={txnFormDate}
                      onChange={(e) => setTxnFormDate(e.target.value)}
                      className="px-3.5 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Reference Number (PO / Invoice / WO)
                    </label>
                    <input
                      type="text"
                      value={txnFormRef}
                      onChange={(e) => setTxnFormRef(e.target.value)}
                      placeholder="e.g. PO-7491"
                      className="px-3.5 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Operator Name
                  </label>
                  <div className="px-3.5 py-2.5 border border-gray-200 rounded-xl bg-gray-100 text-sm font-semibold text-gray-700">
                    {activeUser.name} ({activeUser.role})
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Remarks
                  </label>
                  <textarea
                    rows="2"
                    value={txnFormRemarks}
                    onChange={(e) => setTxnFormRemarks(e.target.value)}
                    placeholder="Optional details..."
                    className="px-3.5 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-gray-150 px-6 py-4 bg-gray-50 rounded-b-3xl">
                <button
                  type="button"
                  onClick={() => setIsTxnModalOpen(false)}
                  className="px-5 py-2 text-sm font-bold bg-white text-gray-700 border border-gray-200 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs cursor-pointer"
                >
                  Post Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
