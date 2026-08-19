import { UploadCloud } from 'lucide-react';
import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
;
import { importIndentRows } from '../services/purchaseService';
;
import { findColIndex } from '../utils/helpers';

export default function ImportView({ onImported }) {
  const fileInputRef = useRef(null);
  const [result, setResult] = useState(null);
  const [importing, setImporting] = useState(false);

  const handleFile = (file) => {
    if (!file) return;
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
          setResult({ type: 'danger', text: 'Could not find an "Item Details" column header. Please check the file format.' });
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
          setResult({ type: 'warning', text: 'No data rows found below the header.' });
          return;
        }
        setImporting(true);
        const { firstNo, lastNo, matchedCount, insertedCount } = await importIndentRows(parsed);
        let successText = `${parsed.length} item(s) processed. `;
        if (matchedCount > 0) {
          successText += `${matchedCount} existing item(s) recognized and preserved. `;
        }
        if (insertedCount > 0) {
          successText += `${insertedCount} new item(s) imported successfully (Unique numbers: ${firstNo} to ${lastNo}).`;
        } else {
          successText += `0 new items added.`;
        }
        setResult({
          type: 'success',
          text: successText,
        });
        onImported && onImported();
      } catch (err) {
        console.error(err);
        setResult({ type: 'danger', text: err.message || 'Error reading file. Please upload a valid .xlsx / .xls / .csv file.' });
      } finally {
        setImporting(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const alertClasses = {
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    danger: 'bg-rose-50 text-rose-800 border-rose-200',
  };

  return (
    <div className="mb-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={importing}
          onClick={() => fileInputRef.current.click()}
          className={`inline-flex items-center gap-2 rounded-lg bg-[#173254] px-4 py-2 text-[13px] font-semibold text-white transition ${importing ? 'cursor-wait opacity-60' : 'hover:bg-[#10243e]'}`}
        >
          <UploadCloud size={16} />
          {importing ? 'Importing…' : 'Import Indent (Excel)'}
        </button>
        <span className="text-[11.8px] text-gray-500">Supported: .xlsx, .xls, .csv</span>
      </div>
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
      {result && (
        <div className={`mt-2.5 rounded-lg border px-3.5 py-2.5 text-sm ${alertClasses[result.type]}`}>{result.text}</div>
      )}
    </div>
  );
}
