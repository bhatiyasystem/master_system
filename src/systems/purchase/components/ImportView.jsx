import { UploadCloud } from 'lucide-react';
import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { importIndentRows, previewIndentsManualBulk } from '../services/purchaseService';
import { findColIndex } from '../utils/helpers';

export default function ImportView({ onImported }) {
  const fileInputRef = useRef(null);
  const [result, setResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState('upload'); // 'upload', 'review', 'summary'
  const [error, setError] = useState('');
  const [previewData, setPreviewData] = useState({ toCreate: [], toSkip: [] });

  const handleDownloadTemplate = () => {
    const headers = [
      "Item Details",
      "Product Category",
      "Vendor",
      "Unit",
      "Alt Unit",
      "Parent Group",
      "Shelf Capacity",
      "Max Level",
      "Rol Qty",
      "Cl Qty",
      "Conversion Unit",
      "Order Formula"
    ];
    const sampleData = [
      [
        "Example Item A",
        "Stationery",
        "Ace Mark Stationary",
        "Pcs.",
        "",
        "",
        "",
        "100",
        "20",
        "10",
        "",
        "90"
      ]
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Indent_Import_Template.xlsx");
  };

  const handleFile = (file) => {
    if (!file) return;
    setError('');
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        let headerRowIdx = rows.findIndex((r) => r.some((c) => String(c).trim().toLowerCase() === 'item details'));
        if (headerRowIdx === -1)
          headerRowIdx = rows.findIndex((r) => r.some((c) => String(c).trim().toLowerCase().includes('item details')));
        if (headerRowIdx === -1) {
          setError('Could not find an "Item Details" column header. Please check the file format.');
          return;
        }
        const headers = rows[headerRowIdx].map((h) => String(h).trim());
        const idx = {
          item: findColIndex(headers, ['item details']),
          cat: findColIndex(headers, ['product category']),
          vendor: findColIndex(headers, ['vendor']),
          unit: headers.findIndex((h) => h.toLowerCase() === 'unit'),
          altUnit: findColIndex(headers, ['alt unit']),
          parentGroup: findColIndex(headers, ['parent group']),
          shelf: findColIndex(headers, ['shelf capacity']),
          maxLevel: findColIndex(headers, ['max level']),
          rol: findColIndex(headers, ['rol qty']),
          clQty: findColIndex(headers, ['cl. qty', 'cl qty']),
          conv: findColIndex(headers, ['conversion unit']),
          orderFormula: findColIndex(headers, ['order formula']),
        };
        const dataRows = rows.slice(headerRowIdx + 1).filter((r) => r.some((c) => String(c).trim() !== ''));
        const parsed = [];
        dataRows.forEach((r) => {
          const itemDetails = idx.item > -1 ? String(r[idx.item] || '').trim() : '';
          if (!itemDetails) return;
          parsed.push({
            itemDetails,
            item_details: itemDetails,
            category: idx.cat > -1 ? String(r[idx.cat] || '').trim() : 'Uncategorized',
            vendor: idx.vendor > -1 ? String(r[idx.vendor] || '').trim() : '',
            unit: idx.unit > -1 ? String(r[idx.unit] || '').trim() : 'Pcs.',
            altUnit: idx.altUnit > -1 ? String(r[idx.altUnit] || '').trim() : '',
            parentGroup: idx.parentGroup > -1 ? String(r[idx.parentGroup] || '').trim() : '',
            shelfCapacity: idx.shelf > -1 ? String(r[idx.shelf] || '').trim() : '',
            maxLevelQty: idx.maxLevel > -1 ? Number(r[idx.maxLevel]) || 0 : 0,
            rolQty: idx.rol > -1 ? Number(r[idx.rol]) || 0 : 0,
            clQty: idx.clQty > -1 ? Number(r[idx.clQty]) || 0 : 0,
            conversionUnit: idx.conv > -1 ? String(r[idx.conv] || '').trim() : '',
            orderFormula: idx.orderFormula > -1 ? Number(r[idx.orderFormula]) || 0 : 0,
          });
        });
        if (parsed.length === 0) {
          setError('No data rows found below the header.');
          return;
        }
        setImporting(true);
        const preview = await previewIndentsManualBulk(null, parsed);
        setPreviewData(preview);
        setStep('review');
      } catch (err) {
        console.error(err);
        setError(err.message || 'Error reading file. Please upload a valid .xlsx / .xls / .csv file.');
      } finally {
        setImporting(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfirmImport = async () => {
    setImporting(true);
    setError('');
    try {
      if (previewData.toCreate.length === 0) {
        setError('No new indents to import.');
        setImporting(false);
        return;
      }
      const payload = previewData.toCreate.map(it => ({
        itemDetails: it.itemDetails,
        category: it.category,
        vendor: it.vendor,
        unit: it.unit,
        altUnit: it.altUnit,
        parentGroup: it.parentGroup,
        shelfCapacity: it.shelfCapacity,
        maxLevelQty: it.maxLevelQty,
        rolQty: it.rolQty,
        clQty: it.clQty,
        conversionUnit: it.conversionUnit,
        orderFormula: it.orderFormula,
      }));
      const { firstNo, lastNo } = await importIndentRows(payload);
      setResult({
        type: 'success',
        text: `Import completed: Created ${previewData.toCreate.length} new indent(s) successfully (Unique numbers: ${firstNo} to ${lastNo}).`,
      });
      setStep('summary');
      onImported && onImported();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error importing indents.');
    } finally {
      setImporting(false);
    }
  };

  const alertClasses = {
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    danger: 'bg-rose-50 text-rose-800 border-rose-200',
  };

  return (
    <>
      <button
        onClick={() => {
          setResult(null);
          setShowModal(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-xs font-bold text-gray-750 shadow-sm hover:bg-gray-50 transition"
      >
        <UploadCloud size={15} />
        Import Indent
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        disabled={importing}
        onChange={(e) => {
          handleFile(e.target.files[0]);
          e.target.value = '';
        }}
      />

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] border border-blue-50 overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-4 flex justify-between items-center border-b border-blue-50 flex-shrink-0">
              <h3 className="font-black text-gray-900 text-lg">Import Indents</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700">
                <span className="text-xl font-bold">×</span>
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-6 py-6 min-h-[320px] flex flex-col justify-start">
              {step === 'upload' ? (
                <div className="flex flex-col items-center justify-center flex-1 space-y-6">
                  <div className="text-center space-y-3 max-w-md">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <UploadCloud size={32} />
                    </div>
                    <h4 className="text-base font-bold text-gray-900">Upload Stock/Indent Sheet</h4>
                    <p className="text-xs text-gray-500 leading-relaxed font-semibold">
                      Upload your excel sheet containing indent details. Supported formats are <strong>.xlsx, .xls, .csv</strong>. Make sure your sheet contains an <strong>"Item Details"</strong> column header.
                    </p>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleDownloadTemplate}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                      >
                        Download Excel Import Template (.xlsx)
                      </button>
                    </div>
                  </div>
                  {error && <div className="text-xs font-semibold text-rose-600 text-center">{error}</div>}
                </div>
              ) : step === 'review' ? (
                <div className="space-y-6 text-left w-full">
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs font-semibold text-blue-800 leading-relaxed">
                    Review parsed Excel items before final submission. Duplicate active indents will be skipped.
                  </div>

                  {/* To Create list */}
                  <div>
                    <h4 className="text-xs font-black text-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <span>New Indents to Create ({previewData.toCreate.length})</span>
                    </h4>
                    {previewData.toCreate.length === 0 ? (
                      <div className="text-xs text-gray-500 italic p-3 bg-gray-50 rounded-xl border border-gray-200">No new indents to create.</div>
                    ) : (
                      <div className="overflow-hidden border border-gray-200 rounded-xl max-h-[160px] overflow-y-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[10px] sticky top-0">
                              <th className="px-3 py-2 bg-gray-50">Item Name</th>
                              <th className="px-3 py-2 bg-gray-50">Vendor</th>
                              <th className="px-3 py-2 bg-gray-50">Qty/Formula</th>
                            </tr>
                          </thead>
                          <tbody>
                            {previewData.toCreate.map((it, idx) => (
                              <tr key={idx} className="border-t border-gray-100 font-semibold text-gray-800">
                                <td className="px-3 py-2">{it.itemDetails}</td>
                                <td className="px-3 py-2 text-gray-600">{it.vendor}</td>
                                <td className="px-3 py-2 font-bold text-gray-900">{it.orderFormula}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* To Skip list */}
                  {previewData.toSkip.length > 0 && (
                    <div>
                      <h4 className="text-xs font-black text-rose-700 uppercase tracking-wider mb-2">
                        Duplicate Indents to Skip ({previewData.toSkip.length})
                      </h4>
                      <div className="overflow-hidden border border-rose-100 rounded-xl max-h-[160px] overflow-y-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-rose-50/50 border-b border-rose-100 text-rose-700 font-bold uppercase tracking-wider text-[10px] sticky top-0">
                              <th className="px-3 py-2 bg-rose-50">Item Name</th>
                              <th className="px-3 py-2 bg-rose-50">Vendor</th>
                              <th className="px-3 py-2 bg-rose-50">Existing Indent No.</th>
                              <th className="px-3 py-2 bg-rose-50">Current Stage</th>
                            </tr>
                          </thead>
                          <tbody>
                            {previewData.toSkip.map((it, idx) => (
                              <tr key={idx} className="border-t border-rose-50/50 font-semibold text-rose-900 bg-rose-50/20">
                                <td className="px-3 py-2">{it.itemDetails}</td>
                                <td className="px-3 py-2 text-rose-700/80">{it.vendor}</td>
                                <td className="px-3 py-2 font-bold text-rose-600">{it.uniqueNo}</td>
                                <td className="px-3 py-2"><span className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[10.5px] font-bold text-rose-800">{it.stage}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {error && <div className="text-xs font-semibold text-rose-600 text-center mt-2">{error}</div>}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 py-8 space-y-6">
                  {result && (
                    <div className={`w-full max-w-xl rounded-2xl border p-5 text-sm ${alertClasses[result.type]} shadow-sm`}>
                      {result.text}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex-shrink-0">
              {step === 'upload' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={importing}
                    onClick={() => fileInputRef.current.click()}
                    className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-2.5 text-xs font-bold text-white disabled:opacity-60 shadow-md shadow-blue-200"
                  >
                    {importing ? 'Importing…' : 'Select & Upload File'}
                  </button>
                </>
              ) : step === 'review' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setStep('upload');
                    }}
                    className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={importing || previewData.toCreate.length === 0}
                    onClick={handleConfirmImport}
                    className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50 shadow-md shadow-emerald-200 animate-pulse"
                  >
                    {importing ? 'Importing…' : 'Confirm & Submit'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-200"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
