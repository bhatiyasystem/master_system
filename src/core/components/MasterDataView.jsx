import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import * as Lucide from 'lucide-react';
import supabase from '../../SupabaseClient';
import CreateIndentFormModal from '../../systems/purchase/components/CreateIndentFormModal';
import NewPeteSettings from '../../systems/newpete/src/pages/Settings';

const VENDOR_FIELDS = [
    { key: 'name', label: 'Vendor Name', placeholder: 'Enter vendor name', required: true },
    { key: 'contact', label: 'Contact Number', placeholder: 'Enter vendor number' },
    { key: 'address', label: 'Address', placeholder: 'Enter vendor address' },
    { key: 'email', label: 'Email ID', placeholder: 'Enter vendor email' },
    { key: 'city', label: 'City', placeholder: 'Enter vendor city' },
    { key: 'gstin', label: 'GST Number', placeholder: 'e.g. 27AAPFU0939F1ZV' },
    { key: 'payment_terms', label: 'Payment Terms', options: ['Credit', 'Advance', 'Saman aatey saath'] },
    { key: 'fix_transporter', label: 'Fix Transporter', fetchFrom: 'transporters' },
];

const TRANSPORTER_FIELDS = [
    { key: 'name', label: 'Transporter Name', placeholder: 'Enter transporter name', required: true },
    { key: 'contacts', label: 'Contact Number', placeholder: 'Enter transporter number', multi: true },
    { key: 'duration', label: 'Duration', placeholder: 'Enter duration' },
    { key: 'cities', label: 'City', multi: true },
    { key: 'address', label: 'Address', placeholder: 'Enter transporter address' },
];

function getTableFields(config) {
    if (config.table === 'purchase_indents') {
        const itemDetailsField = config.fields.find(f => f.key === 'item_details');
        const otherFields = config.fields.filter(f => f.key !== 'item_details');
        if (itemDetailsField) {
            return [itemDetailsField, ...otherFields];
        }
    }
    return config.fields;
}

function parseImageUrls(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(Boolean);
    if (typeof raw === 'string') {
        const str = raw.trim();
        if (!str) return [];
        if (str.startsWith('[') && str.endsWith(']')) {
            try {
                const parsed = JSON.parse(str);
                if (Array.isArray(parsed)) return parsed.filter(Boolean);
            } catch (e) {}
        }
        if (str.includes(',')) {
            return str.split(',').map((s) => s.trim()).filter(Boolean);
        }
        return [str];
    }
    return [];
}

function serializeImageUrls(urls) {
    const clean = (Array.isArray(urls) ? urls : [urls]).filter(Boolean);
    if (!clean.length) return null;
    if (clean.length === 1) return clean[0];
    return JSON.stringify(clean);
}

const CONFIG = {
    vendor: { table: 'vendors', fields: VENDOR_FIELDS, label: 'Vendor', pluralLabel: 'Vendors' },
    transporter: { table: 'transporters', fields: TRANSPORTER_FIELDS, label: 'Transporter', pluralLabel: 'Transporters' },
    indent: {
        table: 'purchase_indents',
        fields: [
            { key: 'item_details', label: 'Item Name', placeholder: 'Enter item name', required: true },
            { key: 'online_item_name', label: 'Item Name for online portal', placeholder: 'Enter item name for online portal' },
            { key: 'vendor', label: 'Vendor Name', placeholder: 'Enter vendor name', comboTable: 'vendors', comboColumn: 'name' },
            { key: 'category', label: 'Category', placeholder: 'Enter category', comboTable: 'purchase_indents', comboColumn: 'category' },
            { key: 'unit', label: 'Unit', placeholder: 'Enter unit', comboTable: 'purchase_indents', comboColumn: 'unit' },
            { key: 'parent_group', label: 'Parent Group', placeholder: 'Enter parent group', comboTable: 'purchase_indents', comboColumn: 'parent_group' },
            { key: 'shelf_capacity', label: 'Shelf Capacity', placeholder: 'Enter shelf capacity' },
            { key: 'max_level_qty', label: 'Max Level Qty', placeholder: 'Enter max level qty' },
            { key: 'rol_qty', label: 'Reorder Level', placeholder: 'Enter reorder level' },
            { key: 'order_formula', label: 'Order Qty', placeholder: 'Enter order qty' },
            { key: 'min_order_qty', label: 'Minimum Order Qty', placeholder: 'Enter minimum order qty' },
            { key: 'eligible_for_online', label: 'Eligible For Online', options: ['Yes', 'No'] },
            { key: 'variant_available', label: 'Variant Available', options: ['Yes', 'No'] },
            { key: 'image_url', label: 'Image', type: 'image', placeholder: 'Enter image URL or upload' },
            { key: 'item_description', label: 'Item Description', type: 'textarea', placeholder: 'Enter item description' },
        ],
        label: 'Master Item',
        pluralLabel: 'Master Items'
    },
    'NewPete Settings': {
        table: 'newpete_settings',
        fields: [
            { key: 'setting_name', label: 'Setting Name', placeholder: 'Enter setting name', required: true },
            { key: 'setting_value', label: 'Setting Value', placeholder: 'Enter setting value' },
        ],
        label: 'NewPete Setting',
        pluralLabel: 'NewPete Settings'
    }
};

export default function MasterDataView() {
    const [type, setType] = useState('vendor');

    return (
        <div className="bg-white rounded-3xl border border-blue-100 p-6 sha0dow-sm">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Master Data</h2>
                    <p className="text-xs text-gray-400">Manage vendor and transporter details used across the platform</p>
                </div>
                <div className="flex bg-gray-50 border border-gray-150 rounded-2xl p-1">
                    <button
                        onClick={() => setType('vendor')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${type === 'vendor' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'
                            }`}
                    >
                        <Lucide.Building2 size={14} />
                        Vendor Details
                    </button>
                    <button
                        onClick={() => setType('transporter')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${type === 'transporter' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'
                            }`}
                    >
                        <Lucide.Truck size={14} />
                        Transporter Details
                    </button>
                    <button
                        onClick={() => setType('indent')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${type === 'indent' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'
                            }`}
                    >
                        <Lucide.ClipboardList size={14} />
                        Master Item
                    </button>
                    <button
                        onClick={() => setType('NewPete Settings')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${type === 'NewPete Settings' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'
                            }`}
                    >
                        <Lucide.Settings size={14} />
                        Petty Setting
                    </button>
                </div>
            </div>

            {type === 'NewPete Settings' ? (
                <NewPeteSettings />
            ) : (
                <MasterDataPanel key={type} type={type} />
            )}
        </div>
    );
}

function MasterDataPanel({ type }) {
    const config = CONFIG[type];
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const fileInputRef = useRef(null);

    const filteredRows = searchTerm.trim()
        ? rows.filter((r) => {
            const term = searchTerm.trim().toLowerCase();
            return (
                String(r.name || '').toLowerCase().includes(term) ||
                String(r.item_details || '').toLowerCase().includes(term) ||
                String(r.online_item_name || '').toLowerCase().includes(term) ||
                String(r.vendor || '').toLowerCase().includes(term) ||
                String(r.category || '').toLowerCase().includes(term)
            );
        })
        : rows;

    async function handleDelete(row) {
        if (!window.confirm(`Delete this ${config.label.toLowerCase()}?`)) return;
        try {
            if (type === 'indent') {
                const { data, error } = await supabase
                    .from('purchase_indents')
                    .update({ hide_in_master: true })
                    .eq('item_details', row.item_details)
                    .select();
                if (error) throw error;
                if (!data || data.length === 0) {
                    setError('Delete blocked — no row was updated.');
                    return;
                }
            } else {
                const { data, error } = await supabase.from(config.table).delete().eq('id', row.id).select();
                if (error) throw error;
                if (!data || data.length === 0) {
                    setError('Delete blocked — no row was removed. This is usually a Supabase Row Level Security policy preventing deletes on this table.');
                    return;
                }
            }
            load();
        } catch (err) {
            setError(err.message || 'Failed to delete record.');
        }
    }
    const [showFieldFormat, setShowFieldFormat] = useState(false);


    function downloadTemplate() {
        const headers = config.fields.map((f) => f.label);
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, config.pluralLabel);
        XLSX.writeFile(wb, `${config.table}_template.xlsx`);
    }

    async function load() {
        setLoading(true);
        setError('');
        try {
            let query = supabase.from(config.table).select('*');
            if (type === 'indent') {
                query = query.or('hide_in_master.eq.false,hide_in_master.is.null').order('item_details', { ascending: true });
            } else {
                query = query.order('name', { ascending: true });
            }
            const { data, error } = await query;
            if (error) throw error;

            if (type === 'indent') {
                const seen = new Set();
                const distinctData = [];
                (data || []).forEach(row => {
                    const norm = String(row.item_details || '').trim().toLowerCase();
                    if (norm && !seen.has(norm)) {
                        seen.add(norm);
                        distinctData.push(row);
                    }
                });
                setRows(distinctData);
            } else {
                setRows(data || []);
            }
        } catch (err) {
            setError(err.message || `Failed to load ${config.pluralLabel.toLowerCase()}.`);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [type]);

    function handleFile(file) {
        if (!file) return;
        setImporting(true);
        setImportResult(null);
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const wb = XLSX.read(data, { type: 'array' });
                const sheet = wb.Sheets[wb.SheetNames[0]];
                const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

                if (raw.length < 2) throw new Error('The file has no data rows.');

                const header = raw[0].map((h) => String(h).trim().toLowerCase());
                const colIndex = (labels) => header.findIndex((h) => labels.some((l) => h.includes(l)));

                const idx = {};
                config.fields.forEach((f) => {
                    idx[f.key] = colIndex([f.label.toLowerCase(), f.key.toLowerCase()]);
                });

                const payload = raw
                    .slice(1)
                    .filter((r) => r.some((c) => String(c).trim() !== ''))
                    .map((r) => {
                        const obj = {};
                        config.fields.forEach((f) => {
                            const raw = idx[f.key] >= 0 ? String(r[idx[f.key]] || '').trim() : '';
                            if (f.multi) {
                                obj[f.key] = raw
                                    ? raw.split(/[,;/|]/).map((v) => v.trim()).filter(Boolean)
                                    : [];
                            } else {
                                obj[f.key] = raw;
                            }
                        });
                        return obj;
                    })
                    .filter((obj) => obj.name);

                if (payload.length === 0) throw new Error('No valid rows found — make sure the header row matches the expected columns.');

                const { error } = await supabase.from(config.table).insert(payload);
                if (error) throw error;

                setImportResult({ type: 'success', text: `Imported ${payload.length} ${config.pluralLabel.toLowerCase()} successfully.` });
                load();
            } catch (err) {
                setImportResult({ type: 'error', text: err.message || 'Failed to import file.' });
            } finally {
                setImporting(false);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    return (
        <div>
            <div className="mb-4 flex flex-wrap items-center gap-3">
                {type === 'indent' ? (
                    <button
                        type="button"
                        onClick={() => setShowForm(true)}
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:from-blue-700 hover:to-purple-700 transition"
                    >
                        <Lucide.Plus size={15} />
                        Add Master Item Manually
                    </button>
                ) : (
                    <>
                        <button
                            type="button"
                            disabled={importing}
                            onClick={() => setShowFieldFormat(true)}
                            className={`inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-xs font-bold text-white transition ${importing ? 'cursor-wait opacity-60' : 'hover:bg-gray-800'
                                }`}
                        >
                            <Lucide.UploadCloud size={15} />
                            {importing ? 'Importing…' : `Import ${config.pluralLabel} (Excel/CSV)`}
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
                        <button
                            type="button"
                            onClick={() => setShowForm(true)}
                            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
                        >
                            <Lucide.Plus size={15} />
                            Add {config.label} Manually
                        </button>
                    </>
                )}
                {/* <span className="text-[11px] text-gray-400">
                    Expected columns: {config.fields.map((f) => f.label).join(', ')}
                </span> */}
                <div className="relative flex-1 min-w-[200px]">
                    <Lucide.Search className="absolute left-3.5 top-3.5 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search users by name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50/50 border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    />
                </div>
            </div>

            {importResult && (
                <div
                    className={`mb-4 rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${importResult.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'
                        }`}
                >
                    {importResult.text}
                </div>
            )}

            {error && <div className="mb-4 text-xs font-semibold text-rose-600">{error}</div>}

            {loading ? (
                <div className="py-10 text-center text-sm text-gray-500">Loading {config.pluralLabel.toLowerCase()}…</div>
            ) : filteredRows.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-500">
                    {searchTerm.trim() ? `No ${config.pluralLabel.toLowerCase()} match "${searchTerm}".` : `No ${config.pluralLabel.toLowerCase()} added yet.`}
                </div>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-[12.6px]">
                        <thead>
                            <tr className="bg-gray-50 text-gray-500">
                                <th className="whitespace-nowrap border-b border-gray-200 px-3 py-2.5 text-left text-[10.3px] font-bold uppercase tracking-wide">
                                    Action
                                </th>
                                {getTableFields(config).map((f) => (
                                    <th key={f.key} className="whitespace-nowrap border-b border-gray-200 px-3 py-2.5 text-left text-[10.3px] font-bold uppercase tracking-wide">
                                        {f.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.map((r) => (
                                <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                                    <td className="whitespace-nowrap px-3 py-2.5">
                                        <button
                                            type="button"
                                            onClick={() => setEditingRecord(r)}
                                            className="mr-1.5 inline-flex items-center gap-1 rounded-lg border border-blue-200 px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-50"
                                        >
                                            <Lucide.Pencil size={12} /> Edit
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(r)}
                                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50"
                                        >
                                            <Lucide.Trash2 size={12} /> Delete
                                        </button>
                                    </td>
                                    {getTableFields(config).map((f) => {
                                        const val = r[f.key];
                                        if (f.key === 'image_url' || f.key === 'image_urls') {
                                            const imgs = parseImageUrls(r.image_url);
                                            return (
                                                <td key={f.key} className="px-3 py-2 text-gray-800 whitespace-nowrap">
                                                    {imgs.length > 0 ? (
                                                        <div className="flex items-center gap-1.5">
                                                            {imgs.slice(0, 3).map((imgSrc, i) => (
                                                                <a
                                                                    key={i}
                                                                    href={imgSrc}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="block w-9 h-9 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 hover:opacity-80 transition shadow-xs flex-shrink-0"
                                                                    title={`View image ${i + 1}`}
                                                                >
                                                                    <img src={imgSrc} alt="" className="w-full h-full object-cover" />
                                                                </a>
                                                            ))}
                                                            {imgs.length > 3 && (
                                                                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-md">
                                                                    +{imgs.length - 3}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-300 text-[11px] italic">No image</span>
                                                    )}
                                                </td>
                                            );
                                        }
                                        if (f.key === 'eligible_for_online' || f.key === 'variant_available') {
                                            const isYes = String(val || '').toLowerCase() === 'yes';
                                            return (
                                                <td key={f.key} className="px-3 py-2 text-gray-800 whitespace-nowrap">
                                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                                                        isYes ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500'
                                                    }`}>
                                                        {val || 'No'}
                                                    </span>
                                                </td>
                                            );
                                        }
                                        if (f.key === 'item_description') {
                                            return (
                                                <td key={f.key} className="px-3 py-2 text-gray-700 max-w-[180px]" title={val}>
                                                    <span className="truncate block">{val || '—'}</span>
                                                </td>
                                            );
                                        }
                                        return (
                                            <td key={f.key} className="px-3 py-2.5 text-gray-800 whitespace-nowrap">
                                                {Array.isArray(val)
                                                    ? (val.length ? val.join(', ') : '—')
                                                    : (val !== null && val !== undefined && val !== '' ? String(val) : '—')}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showFieldFormat && (
                <FieldFormatModal
                    config={config}
                    onClose={() => setShowFieldFormat(false)}
                    onDownloadTemplate={downloadTemplate}
                    onUploadClick={() => {
                        setShowFieldFormat(false);
                        fileInputRef.current.click();
                    }}
                />
            )}

            {showForm && (
                type === 'indent' ? (
                    <CreateIndentFormModal
                        onClose={() => setShowForm(false)}
                        onSaved={() => {
                            setShowForm(false);
                            load();
                        }}
                    />
                ) : (
                    <AddRecordModal
                        config={config}
                        onClose={() => setShowForm(false)}
                        onSaved={() => {
                            setShowForm(false);
                            load();
                        }}
                    />
                )
            )}

            {editingRecord && (
                <AddRecordModal
                    config={config}
                    record={editingRecord}
                    onClose={() => setEditingRecord(null)}
                    onSaved={() => {
                        setEditingRecord(null);
                        load();
                    }}
                />
            )}
        </div>
    );
}

function FieldFormatModal({ config, onClose, onDownloadTemplate, onUploadClick }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] border border-blue-50 overflow-hidden">
                {/* Header — sticky */}
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-5 flex justify-between items-center flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 rounded-xl p-2.5">
                            <Lucide.Table size={22} className="text-white" />
                        </div>
                        <div>
                            <h3 className="font-black text-white text-lg">Field Format</h3>
                            <p className="text-[11px] font-bold text-white/80 uppercase tracking-wider">Required CSV Structure</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white">
                        <Lucide.X size={22} />
                    </button>
                </div>

                {/* Scrollable body */}
                <div className="overflow-y-auto flex-1 px-6 py-5">
                    <div className="mb-4 flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wide">
                        <Lucide.Info size={14} />
                        Column header alignment: provide data according to format below
                    </div>

                    <div className={`grid gap-3 mb-5`} style={{ gridTemplateColumns: `repeat(${config.fields.length}, minmax(0,1fr))` }}>
                        {config.fields.map((f) => (
                            <div key={f.key} className="rounded-xl bg-gray-50 border border-gray-150 p-3">
                                <div className="text-[11px] font-black text-gray-800 uppercase mb-1">{f.label}</div>
                                <div className={`inline-block text-[9px] font-bold uppercase px-1.5 py-0.5 rounded mb-2 ${f.required ? 'bg-rose-100 text-rose-600' : 'bg-gray-200 text-gray-500'}`}>
                                    {f.required ? 'Required' : 'Optional'}
                                </div>
                                <div className="text-[11px] text-gray-400">e.g. {f.label}</div>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={onDownloadTemplate}
                            className="flex-1 min-w-[200px] inline-flex items-center justify-center gap-2 rounded-xl border-2 border-gray-200 px-4 py-3 text-sm font-bold text-gray-800 hover:bg-gray-50"
                        >
                            <Lucide.Download size={16} />
                            Download Template
                        </button>
                        <button
                            type="button"
                            onClick={onUploadClick}
                            className="flex-1 min-w-[200px] inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-bold text-white hover:bg-gray-800"
                        >
                            <Lucide.Upload size={16} />
                            Upload CSV Now
                        </button>
                    </div>

                    {config.fields.some((f) => f.multi) && (
                        <p className="mt-4 text-[11px] text-gray-400">
                            For multi-value columns (e.g. {config.fields.filter((f) => f.multi).map((f) => f.label).join(', ')}), separate multiple values with , ; or |
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

function AddRecordModal({ config, record, onClose, onSaved, zClass = 'fixed inset-0 z-50' }) {
    const initialForm = {};
    config.fields.forEach((f) => {
        if (record) {
            if (f.key === 'image_url') {
                initialForm[f.key] = parseImageUrls(record.image_url);
            } else {
                initialForm[f.key] = f.multi
                    ? (record[f.key]?.length ? record[f.key] : [''])
                    : (record[f.key] !== null && record[f.key] !== undefined ? String(record[f.key]) : '');
            }
        } else {
            if (f.key === 'image_url') {
                initialForm[f.key] = [];
            } else {
                initialForm[f.key] = f.multi ? [''] : '';
            }
        }
    });
    const [form, setForm] = useState(initialForm);
    const [saving, setSaving] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [error, setError] = useState('');

    function update(key, value) {
        setForm((f) => ({ ...f, [key]: value }));
    }

    function updateMulti(key, index, value) {
        setForm((f) => {
            const arr = [...f[key]];
            arr[index] = value;
            return { ...f, [key]: arr };
        });
    }

    function addMultiRow(key) {
        setForm((f) => ({ ...f, [key]: [...f[key], ''] }));
    }

    function removeMultiRow(key, index) {
        setForm((f) => {
            const arr = f[key].filter((_, i) => i !== index);
            return { ...f, [key]: arr.length ? arr : [''] };
        });
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');

        // Build cleaned payload: trim strings safely, drop blanks from multi-value arrays
        const payload = {};
        config.fields.forEach((f) => {
            if (f.key === 'image_url') {
                const arr = Array.isArray(form[f.key])
                    ? form[f.key].filter(Boolean)
                    : (form[f.key] ? [form[f.key]] : []);
                payload.image_url = serializeImageUrls(arr);
            } else if (f.multi) {
                payload[f.key] = (form[f.key] || [])
                    .map((v) => (typeof v === 'string' ? v.trim() : String(v ?? '').trim()))
                    .filter(Boolean);
            } else {
                const rawVal = form[f.key];
                payload[f.key] = typeof rawVal === 'string'
                    ? rawVal.trim()
                    : (rawVal !== null && rawVal !== undefined ? String(rawVal).trim() : '');
            }
        });

        const requiredMissing = config.fields.find((f) => {
            if (!f.required) return false;
            return f.multi ? payload[f.key].length === 0 : !payload[f.key];
        });
        if (requiredMissing) {
            setError(`${requiredMissing.label} is required.`);
            return;
        }
        setSaving(true);
        try {
            let error;
            if (config.table === 'purchase_indents') {
                if (payload.order_formula !== undefined && payload.order_formula !== '') {
                    payload.order_qty = payload.order_formula;
                }
                if (payload.rol_qty !== undefined && payload.rol_qty !== '') {
                    payload.reorder_level = payload.rol_qty;
                }

                // Numeric sanitation for Postgres
                const numFields = ['shelf_capacity', 'max_level_qty', 'rol_qty', 'reorder_level', 'order_qty', 'min_order_qty'];
                numFields.forEach((k) => {
                    if (payload[k] !== undefined) {
                        if (payload[k] === '' || payload[k] === null) {
                            payload[k] = null;
                        } else if (!isNaN(Number(payload[k]))) {
                            payload[k] = Number(payload[k]);
                        }
                    }
                });

                payload.hide_in_master = false;

                if (record) {
                    const query = supabase.from('purchase_indents').update(payload);
                    const res = record.item_details
                        ? await query.eq('item_details', record.item_details)
                        : await query.eq('id', record.id);
                    error = res.error;
                } else {
                    const res = await supabase.from('purchase_indents').insert(payload);
                    error = res.error;
                }
            } else {
                const res = record
                    ? await supabase.from(config.table).update(payload).eq('id', record.id)
                    : await supabase.from(config.table).insert(payload);
                error = res.error;
            }
            if (error) throw error;

            if (config.table === 'vendors' && payload.fix_transporter) {
                const trName = typeof payload.fix_transporter === 'string' ? payload.fix_transporter.trim() : '';
                if (trName) {
                    const { data: existingTr } = await supabase
                        .from('transporters')
                        .select('id')
                        .eq('name', trName);
                    if (!existingTr || existingTr.length === 0) {
                        await supabase.from('transporters').insert({
                            name: trName,
                            contacts: []
                        });
                    }
                }
            }

            onSaved(payload.name || payload.item_details);
        } catch (err) {
            setError(err.message || 'Failed to save.');
        } finally {
            setSaving(false);
        }
    }

    return createPortal(
        <div className={`${zClass} flex items-center justify-center p-4`}>
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] border border-blue-50 overflow-hidden">
                {/* Header — sticky */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-4 flex justify-between items-center border-b border-blue-50 flex-shrink-0">
                    <h3 className="font-black text-gray-900 text-lg">{record ? 'Edit' : 'Add'} {config.label}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
                        <Lucide.X size={20} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    {/* Scrollable fields */}
                    <div className="overflow-y-auto flex-1 px-6 py-5">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                            {config.fields.map((f) => (
                                <div key={f.key} className={`space-y-1 ${f.multi || f.key === 'address' || f.key === 'item_description' || f.key === 'image_url' ? 'col-span-2' : ''}`}>
                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                        {f.label} {f.required && <span className="text-rose-500">*</span>}
                                    </label>

                                    {f.multi ? (
                                        <div className="space-y-2">
                                            {form[f.key].map((val, i) => (
                                                <div key={i} className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={val}
                                                        onChange={(e) => updateMulti(f.key, i, e.target.value)}
                                                        placeholder={f.label}
                                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                                                    />
                                                    {form[f.key].length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeMultiRow(f.key, i)}
                                                            className="shrink-0 text-gray-400 hover:text-rose-500"
                                                            title={`Remove ${f.label}`}
                                                        >
                                                            <Lucide.X size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => addMultiRow(f.key)}
                                                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700"
                                            >
                                                <Lucide.Plus size={13} />
                                                Add {f.label}
                                            </button>
                                        </div>
                                    ) : f.options ? (
                                        <select
                                            value={form[f.key]}
                                            onChange={(e) => update(f.key, e.target.value)}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                                        >
                                            <option value="" disabled>Select {f.label}</option>
                                            {f.options.map((opt) => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    ) : f.fetchFrom ? (
                                        <TransporterComboField
                                            table={f.fetchFrom}
                                            value={form[f.key]}
                                            onChange={(val) => update(f.key, val)}
                                            parentConfig={config}
                                        />
                                    ) : f.comboTable ? (
                                        <ComboSelect
                                            table={f.comboTable}
                                            column={f.comboColumn}
                                            value={form[f.key]}
                                            onChange={(val) => update(f.key, val)}
                                            label={f.label}
                                            placeholder={f.placeholder}
                                        />
                                    ) : f.key === 'address' || f.type === 'textarea' ? (
                                        <textarea
                                            rows={2}
                                            value={form[f.key]}
                                            onChange={(e) => update(f.key, e.target.value)}
                                            placeholder={f.placeholder}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all resize-none"
                                        />
                                    ) : f.type === 'image' || f.key === 'image_url' ? (
                                        <div className="space-y-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                {(Array.isArray(form[f.key]) ? form[f.key] : (form[f.key] ? [form[f.key]] : [])).map((imgSrc, imgIdx) => (
                                                    <div key={imgIdx} className="relative w-14 h-14 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 flex-shrink-0 group shadow-xs">
                                                        <img src={imgSrc} alt="" className="w-full h-full object-cover" />
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const list = Array.isArray(form[f.key]) ? form[f.key] : (form[f.key] ? [form[f.key]] : []);
                                                                update(f.key, list.filter((_, i) => i !== imgIdx));
                                                            }}
                                                            className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                            title="Remove image"
                                                        >
                                                            <Lucide.X size={15} />
                                                        </button>
                                                    </div>
                                                ))}

                                                <label className={`w-14 h-14 rounded-xl border border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/40 hover:bg-blue-50 flex flex-col items-center justify-center text-blue-600 cursor-pointer transition-all flex-shrink-0 ${uploadingImage ? 'opacity-50 pointer-events-none' : ''}`}>
                                                    <Lucide.UploadCloud size={16} className={uploadingImage ? 'animate-bounce' : ''} />
                                                    <span className="text-[8.5px] font-bold mt-0.5">{uploadingImage ? 'Wait…' : 'Upload'}</span>
                                                    <input
                                                        type="file"
                                                        multiple
                                                        accept="image/*"
                                                        className="hidden"
                                                        disabled={uploadingImage}
                                                        onChange={async (e) => {
                                                            const files = Array.from(e.target.files || []);
                                                            if (!files.length) return;
                                                            setUploadingImage(true);
                                                            try {
                                                                const uploaded = [];
                                                                for (const file of files) {
                                                                    const ext = file.name.split('.').pop();
                                                                    const fileName = `item-images/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
                                                                    const { error: upErr } = await supabase.storage.from('purchase-builty').upload(fileName, file);
                                                                    if (upErr) throw upErr;
                                                                    const { data } = supabase.storage.from('purchase-builty').getPublicUrl(fileName);
                                                                    uploaded.push(data.publicUrl);
                                                                }
                                                                const list = Array.isArray(form[f.key]) ? form[f.key] : (form[f.key] ? [form[f.key]] : []);
                                                                update(f.key, [...list, ...uploaded]);
                                                            } catch (err) {
                                                                setError(err.message || 'Image upload failed');
                                                            } finally {
                                                                setUploadingImage(false);
                                                            }
                                                            e.target.value = '';
                                                        }}
                                                    />
                                                </label>
                                            </div>

                                            <div className="flex items-center gap-1.5 pt-1">
                                                <input
                                                    type="text"
                                                    id="modal-img-url-input"
                                                    placeholder="Or paste image URL and press Enter..."
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            const val = e.target.value.trim();
                                                            if (val) {
                                                                const list = Array.isArray(form[f.key]) ? form[f.key] : (form[f.key] ? [form[f.key]] : []);
                                                                update(f.key, [...list, val]);
                                                                e.target.value = '';
                                                            }
                                                        }
                                                    }}
                                                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-150 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const el = document.getElementById('modal-img-url-input');
                                                        if (el && el.value.trim()) {
                                                            const list = Array.isArray(form[f.key]) ? form[f.key] : (form[f.key] ? [form[f.key]] : []);
                                                            update(f.key, [...list, el.value.trim()]);
                                                            el.value = '';
                                                        }
                                                    }}
                                                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition"
                                                >
                                                    Add URL
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <input
                                            type={f.type || "text"}
                                            value={form[f.key]}
                                            onChange={(e) => update(f.key, e.target.value)}
                                            placeholder={f.placeholder || ''}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                                        />
                                    )}
                                </div>
                            ))}
                        </div>

                        {error && <div className="mt-3 text-xs font-semibold text-rose-600">{error}</div>}
                    </div>

                    {/* Footer — sticky */}
                    <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex-shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-2.5 text-xs font-bold text-white disabled:opacity-60"
                        >
                            {saving ? 'Saving…' : record ? 'Update' : 'Save'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}

function TransporterComboField({ table, value, onChange }) {
    const [options, setOptions] = useState([]);
    const [loadingOpts, setLoadingOpts] = useState(true);
    const [showAddTransporter, setShowAddTransporter] = useState(false);

    const transporterConfig = CONFIG['transporter'];

    function loadOptions(selectName) {
        return supabase
            .from(table)
            .select('name')
            .order('name', { ascending: true })
            .then(({ data }) => {
                const names = (data || []).map((r) => r.name).filter(Boolean);
                setOptions(names);
                setLoadingOpts(false);
                if (selectName) onChange(selectName);
            });
    }

    useEffect(() => {
        loadOptions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [table]);

    const inputCls = 'w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all';

    if (loadingOpts) {
        return <div className="px-4 py-3 text-xs text-gray-400 bg-gray-50 border border-gray-150 rounded-2xl">Loading transporters…</div>;
    }

    return (
        <>
            <div className="space-y-2">
                <select
                    value={value}
                    onChange={(e) => {
                        if (e.target.value === '__add_new__') {
                            setShowAddTransporter(true);
                        } else {
                            onChange(e.target.value);
                        }
                    }}
                    className={inputCls}
                >
                    <option value="">Select Transporter</option>
                    {options.map((name) => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                    <option value="__add_new__">➕ Add New Transporter</option>
                </select>
                {options.length === 0 && (
                    <p className="text-[11px] text-gray-400">
                        No transporters found.{' '}
                        <button
                            type="button"
                            className="text-blue-600 font-bold hover:underline"
                            onClick={() => setShowAddTransporter(true)}
                        >
                            Add one now
                        </button>
                    </p>
                )}
            </div>

            {showAddTransporter && (
                <AddRecordModal
                    config={transporterConfig}
                    onClose={() => setShowAddTransporter(false)}
                    onSaved={(savedName) => {
                        setShowAddTransporter(false);
                        loadOptions(savedName);
                    }}
                    zClass="fixed inset-0 z-[60]"
                />
            )}
        </>
    );
}

function ComboSelect({ table, column, value, onChange, label, placeholder, disableCustom }) {
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState(value || '');
    const containerRef = useRef(null);

    useEffect(() => {
        setSearch(value || '');
    }, [value]);

    useEffect(() => {
        let isMounted = true;
        async function fetchOptions() {
            try {
                const targetColumn = table === 'vendors' ? 'name' : column;
                const { data, error } = await supabase
                    .from(table)
                    .select(targetColumn);
                if (error) throw error;
                const vals = Array.from(
                    new Set((data || []).map((r) => r[targetColumn]).filter(Boolean))
                ).sort();
                if (isMounted) {
                    setOptions(vals);
                    setLoading(false);
                }
            } catch (err) {
                console.error(err);
                if (isMounted) setLoading(false);
            }
        }
        fetchOptions();
        return () => { isMounted = false; };
    }, [table, column]);

    useEffect(() => {
        function handleClickOutside(e) {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
                if (disableCustom) {
                    const exactMatch = options.find(opt => opt.toLowerCase() === search.toLowerCase());
                    if (exactMatch) {
                        onChange(exactMatch);
                        setSearch(exactMatch);
                    } else {
                        onChange('');
                        setSearch('');
                    }
                }
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [search, options, disableCustom, onChange]);

    const filtered = options.filter(opt =>
        String(opt).toLowerCase().includes(search.toLowerCase())
    );

    if (loading) {
        return <div className="px-4 py-3 text-xs text-gray-400 bg-gray-50 border border-gray-155 rounded-2xl animate-pulse">Loading options...</div>;
    }

    return (
        <div ref={containerRef} className="relative w-full">
            <div className="relative flex items-center">
                <input
                    type="text"
                    value={search}
                    onFocus={() => setIsOpen(true)}
                    onChange={(e) => {
                        const val = e.target.value;
                        setSearch(val);
                        setIsOpen(true);
                        if (!disableCustom) {
                            onChange(val);
                        }
                    }}
                    placeholder={placeholder || `Search or enter ${label || column}...`}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-155 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all pr-10"
                />
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="absolute right-3 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <svg className={`w-4 h-4 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
            </div>

            {isOpen && (
                <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded-2xl shadow-xl max-h-60 overflow-y-auto py-1">
                    {filtered.length > 0 ? (
                        filtered.map((opt) => (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => {
                                    onChange(opt);
                                    setSearch(opt);
                                    setIsOpen(false);
                                }}
                                className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors hover:bg-blue-50/60 ${value === opt ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-700'
                                    }`}
                            >
                                {opt}
                            </button>
                        ))
                    ) : (
                        <div className="px-4 py-3 text-xs text-gray-400 font-medium italic">
                            {disableCustom ? 'No matching records' : 'No matches (press Enter to use custom value)'}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
