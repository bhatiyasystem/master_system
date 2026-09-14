import { useEffect, useMemo, useState } from 'react';
import { submitNewPO, revisePO, updateIndent } from '../services/purchaseService';
import { sendPOCreatedNotification } from '../services/purchaseWhatsappService';
import { generatePOPdfBlob } from '../utils/generatePOPdf';
import { uploadPOPdf } from '../utils/uploadPOPdf';
import EntitySelectInput from './EntitySelectInput';
import PreviewModal from './PreviewModal';
import supabase from '../../../SupabaseClient';

const DEFAULT_TERMS = `1. We deserve the right to cancel the purchase order anytime before product shipment.
2. Invoice raised to us should contain the details of purchase order with data mentioned.
3. Adherence to agreed product specifications is a must. Any deviation during delivery will result in cancellation of PO.
4. Packing and shipping charges to be borne by vendor, unless mentioned.
5. Delivery should be strictly done within 5 days from the date of purchase order.
6. It will be Vendor's responsibility for Incorrect GST No. In bill.`;

function itemsFromIndents(items) {
  return items.map((i) => ({
    indentId: i.dbId,
    productCode: '',
    productName: i.itemDetails,
    category: i.category || '',
    vendor: i.vendor || '',
    parentGroup: i.parentGroup || '',
    shelfCapacity: i.shelfCapacity || '',
    maxLevelQty: i.maxLevelQty != null && i.maxLevelQty !== '' ? i.maxLevelQty : '',
    rolQty: i.rolQty != null && i.rolQty !== '' ? i.rolQty : '',
    hsn: '',
    qty: (i.approvedQty != null ? i.approvedQty : i.orderFormula) || 0,
    units: i.unit || 'Pcs.',
    rate: 0,
    tax: 5,
    amount: 0,
    isExtra: false,
  }));
}

export default function PoCreateView({ draft, onDone, onCancel }) {
  const existingPO = draft && draft.existingPO;
  const isRevision = !!existingPO;

  const [form, setForm] = useState(() => buildInitialForm(draft));
  const [items, setItems] = useState(() => (isRevision ? existingPO.items.map((it) => ({ ...it })) : itemsFromIndents(draft.items)));
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [vendors, setVendors] = useState([]);
  const [editingRowIdx, setEditingRowIdx] = useState(null);
  const [rowBackup, setRowBackup] = useState(null);
  const [editAll, setEditAll] = useState(false);
  const [allBackup, setAllBackup] = useState(null);

  useEffect(() => {
    supabase
      .from('vendors')
      .select('*')
      .order('name', { ascending: true })
      .then(({ data }) => setVendors(data || []));

    // Fetch Global Ship To Settings
    if (!existingPO) {
      supabase
        .from('festival_contacts')
        .select('extra_fields')
        .eq('name', 'GLOBAL_SHIP_TO')
        .maybeSingle()
        .then(({ data }) => {
          if (data && data.extra_fields) {
            const ship = data.extra_fields;
            setForm((prev) => ({
              ...prev,
              shipName: ship.name || prev.shipName,
              shipContact: ship.contact || prev.shipContact,
              shipEmail: ship.email || prev.shipEmail,
              shipGstin: ship.gstin || prev.shipGstin,
              shipAddr: ship.address || prev.shipAddr,
              terms: ship.term || prev.terms,
            }));
          }
        });
    }
  }, [existingPO]);

  // Auto-fill vendor details whenever vendorName or the vendors list changes.
  // This also covers the case where vendorName arrives from navigation state
  // before the vendors list has loaded.
  useEffect(() => {
    if (!form.vendorName || vendors.length === 0) return;
    const match = vendors.find(
      (v) => (v.name || '').trim().toLowerCase() === form.vendorName.trim().toLowerCase()
    );
    if (!match) return;
    setForm((prev) => ({
      ...prev,
      vendorAddr: match.address || '',
      vendorGstin: match.gstin || '',
      vendorContact: match.contact || '',
      vendorEmail: match.email || '',
      vendorCity: match.city || '',
      fixTransporter: match.fix_transporter || '',
      vendorPaymentTerms: match.payment_terms || '',
    }));
  }, [form.vendorName, vendors]);

  useEffect(() => {
    setForm(buildInitialForm(draft));
    setItems(draft && draft.existingPO ? draft.existingPO.items.map((it) => ({ ...it })) : itemsFromIndents(draft ? draft.items : []));
    setSubmitError('');
  }, [draft]);

  const totals = useMemo(() => {
    const total = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0);
    const taxAmount = items.reduce((s, it) => {
      const amt = (Number(it.qty) || 0) * (Number(it.rate) || 0);
      return s + amt * ((Number(it.tax) || 0) / 100);
    }, 0);
    const discount = Number(form.discount) || 0;
    return { total, taxAmount, grandTotal: total + taxAmount - discount };
  }, [items, form.discount]);

  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const updateItem = (idx, field, value) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const next = { ...it, [field]: ['qty', 'rate', 'tax'].includes(field) ? Number(value) || 0 : value };
        next.amount = (Number(next.qty) || 0) * (Number(next.rate) || 0);
        return next;
      }),
    );
  };
  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const saveIndentUpdate = (it) => {
    if (!it?.indentId) return;
    updateIndent(it.indentId, {
      itemDetails: it.productName,
      category: it.category,
      vendor: it.vendor,
      parentGroup: it.parentGroup,
      shelfCapacity: it.shelfCapacity,
      maxLevelQty: it.maxLevelQty,
      rolQty: it.rolQty,
      unit: it.units,
      orderFormula: it.qty,
    }).catch((err) => {
      console.error('Failed to update indent in database:', err);
    });
  };

  const startEditRow = (idx) => {
    setEditingRowIdx(idx);
    setRowBackup({ ...items[idx] });
  };

  const doneEditRow = (idx) => {
    const it = items[idx];
    if (it) {
      saveIndentUpdate(it);
    }
    setEditingRowIdx(null);
    setRowBackup(null);
  };

  const cancelEditRow = (idx) => {
    if (rowBackup) {
      setItems((prev) => prev.map((it, i) => (i === idx ? rowBackup : it)));
    }
    setEditingRowIdx(null);
    setRowBackup(null);
  };

  const startEditAll = () => {
    setAllBackup(items.map((it) => ({ ...it })));
    setEditAll(true);
    setEditingRowIdx(null);
  };

  const doneEditAll = () => {
    items.forEach((it) => saveIndentUpdate(it));
    setEditAll(false);
    setAllBackup(null);
  };

  const cancelEditAll = () => {
    if (allBackup) {
      setItems(allBackup);
    }
    setEditAll(false);
    setAllBackup(null);
  };

  const addExtra = () => {
    const newItem = {
      indentId: null,
      productCode: '',
      productName: '',
      category: '',
      vendor: form.vendorName || '',
      parentGroup: '',
      shelfCapacity: '',
      maxLevelQty: '',
      rolQty: '',
      hsn: '',
      qty: 1,
      units: 'Pcs.',
      rate: 0,
      tax: 5,
      amount: 0,
      isExtra: true,
    };
    setItems((prev) => [...prev, newItem]);
    setEditingRowIdx(items.length);
    setRowBackup({ ...newItem });
  };

  const buildPayload = () => ({
    poNo: form.poNo,
    poDate: form.poDate,
    requisitioner: form.requisitioner,
    shipVia: form.fixTransporter,
    fob: form.fob,
    shipTerms: form.shipTerms,
    vendor: { name: form.vendorName, addr: form.vendorAddr, gstin: form.vendorGstin, contact: form.vendorContact, email: form.vendorEmail, fixTransporter: form.fixTransporter, paymentTerms: form.vendorPaymentTerms },
    shipTo: { name: form.shipName, addr: form.shipAddr, gstin: form.shipGstin, contact: form.shipContact, email: form.shipEmail },
    terms: form.terms,
    discount: form.discount,
  });

  const handlePreview = () => {
    if (items.length === 0) return;
    const { total, taxAmount, grandTotal } = totals;
    setPreview({
      po: { ...buildPayload(), items, total, taxAmount, grandTotal },
      note: isRevision && existingPO.revision > 1 ? 'Revision' : '',
    });
  };

  const handleSubmit = async () => {
    if (items.length === 0) return;
    if (!form.vendorName) return;
    if (!form.vendorContact) { setSubmitError('Contact number is required.'); return; }
    const payload = buildPayload();
    setSaving(true);
    setSubmitError('');
    try {
      if (isRevision) {
        await revisePO({ poId: existingPO.id, form: payload, items });
      } else {
        const newPO = await submitNewPO({ form: payload, items });

        // Generate PDF, upload to storage, then send WhatsApp — all non-blocking
        (async () => {
          try {
            const poForPdf = {
              poNo: newPO.poNo,
              poDate: form.poDate,
              requisitioner: form.requisitioner,
              shipVia: form.fixTransporter,
              fob: form.fob,
              shipTerms: form.shipTerms,
              vendor: { name: form.vendorName, addr: form.vendorAddr, gstin: form.vendorGstin, contact: form.vendorContact, email: form.vendorEmail, fixTransporter: form.fixTransporter },
              shipTo: { name: form.shipName, addr: form.shipAddr, gstin: form.shipGstin, contact: form.shipContact, email: form.shipEmail },
              terms: form.terms,
              items,
            };
            const blob = await generatePOPdfBlob(poForPdf);
            const documentUrl = await uploadPOPdf(blob, newPO.poNo);
            await sendPOCreatedNotification({
              vendorName: form.vendorName,
              vendorContact: form.vendorContact,
              poNo: newPO.poNo,
              poDate: form.poDate,
              documentUrl,
            });
          } catch (err) {
            console.error('PO PDF/WhatsApp error:', err);
          }
        })();
      }
      onDone();
    } catch (err) {
      setSubmitError(err.message || 'Failed to save purchase order.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="mb-0.5 text-[15px] font-bold text-gray-900">{isRevision ? 'Revise Purchase Order' : 'Create Purchase Order'}</h2>
          <div className="text-[12.3px] text-gray-500">One PO per vendor — every selected product from that vendor appears together.</div>
        </div>
        <span className="inline-block whitespace-nowrap rounded-full bg-indigo-50 px-2.5 py-1 text-[10.6px] font-bold text-indigo-700">
          {isRevision ? `Revising ${existingPO.poNo}` : 'New PO'}
        </span>
      </div>

      <div className="mb-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="PO No.">
          <input className="form-input" value={form.poNo || 'Auto-generated on submit'} readOnly />
        </Field>
        <Field label="PO Date">
          <input type="date" className="form-input" value={form.poDate} onChange={(e) => updateField('poDate', e.target.value)} />
        </Field>

      </div>

      <hr className="my-4 border-gray-200" />
      <div className="mb-2 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <div className="mb-2 text-[13px] font-bold text-[#173254]">Vendor (Supplier) — all products below belong to this vendor</div>
          <EntitySelectInput
            className="form-input mb-2"
            placeholder="Supplier name (type new, or pick existing)"
            value={form.vendorName}
            onChange={(v) => updateField('vendorName', v)}
            options={vendors}
            onSelectOption={(v) =>
              setForm((prev) => ({
                ...prev,
                vendorName: v.name || '',
                vendorAddr: v.address || '',
                vendorGstin: v.gstin || '',
                vendorContact: v.contact || '',
                vendorEmail: v.email || '',
                vendorCity: v.city || '',
                fixTransporter: v.fix_transporter || '',
                vendorPaymentTerms: v.payment_terms || '',
              }))
            }
          />
          <input className="form-input mb-2" placeholder="Supplier address" value={form.vendorAddr} onChange={(e) => updateField('vendorAddr', e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <input className="form-input" placeholder="GSTIN" value={form.vendorGstin} onChange={(e) => updateField('vendorGstin', e.target.value)} />
            <input className="form-input" placeholder="Contact no. *" value={form.vendorContact} onChange={(e) => updateField('vendorContact', e.target.value)} autoComplete="new-password" required />
          </div>
          <input className="form-input mt-2" placeholder="City" value={form.vendorCity} onChange={(e) => updateField('vendorCity', e.target.value)} />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input className="form-input" placeholder="Email" value={form.vendorEmail} onChange={(e) => updateField('vendorEmail', e.target.value)} />
            <input className="form-input" placeholder="Ship Via" value={form.fixTransporter} onChange={(e) => updateField('fixTransporter', e.target.value)} />
          </div>
        </div>
        <div>
          <div className="mb-2 text-[13px] font-bold text-[#173254]">Ship To</div>
          <input className="form-input mb-2 bg-gray-50" value={form.shipName || 'Bhatia Enterprises'} readOnly />
          <textarea rows={2} className="form-input mb-2 bg-gray-50 resize-none" value={form.shipAddr || 'Nehru Chowk, Bilaspur (C.G.)'} readOnly />
          <div className="grid grid-cols-2 gap-2">
            <input className="form-input bg-gray-50" placeholder="GSTIN" value={form.shipGstin} readOnly />
            <input className="form-input bg-gray-50" placeholder="Contact no." value={form.shipContact} readOnly />
          </div>
          <input className="form-input mt-2 bg-gray-50" placeholder="Email" value={form.shipEmail} readOnly />
        </div>
      </div>

      <hr className="my-4 border-gray-200" />
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] font-bold text-[#173254]">Items</div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            editAll ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100 shadow-xs"
                  onClick={cancelEditAll}
                >
                  Cancel Edit
                </button>
                <button
                  type="button"
                  className="rounded-md bg-[#173254] px-3 py-1 text-xs font-semibold text-white hover:bg-[#122842] shadow-xs"
                  onClick={doneEditAll}
                >
                  Save All
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="rounded-md border border-[#173254] bg-white px-2.5 py-1 text-xs font-semibold text-[#173254] hover:bg-[#173254] hover:text-white transition shadow-xs"
                onClick={startEditAll}
              >
                Edit All
              </button>
            )
          )}
          <button
            type="button"
            className="rounded-lg border border-[#173254] px-3 py-1.5 text-xs font-semibold text-[#173254] hover:bg-blue-50"
            onClick={addExtra}
          >
            + Add Extra Material
          </button>
        </div>
      </div>
      <div className="mb-2 overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-[12.6px]">
          <thead>
            <tr className="bg-gray-50 text-gray-500">
              {['S.No', 'Product Name', 'Category', 'Vendor', 'Parent Group', 'Shelf Capacity', 'Max Level Qty', 'ROL Qty', 'Qty', 'Units', 'Actions'].map((h) => (
                <th key={h} className="whitespace-nowrap border-b border-gray-200 px-2.5 py-2 text-left text-[10.3px] font-bold uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-2.5 py-4 text-center text-gray-500">
                  No items yet — add extra material or go back and select items.
                </td>
              </tr>
            ) : (
              items.map((it, idx) => {
                const isEditing = editAll || editingRowIdx === idx;
                return (
                  <tr key={idx} className={`border-t border-gray-100 transition ${isEditing ? 'bg-amber-50/40' : 'hover:bg-gray-50/60'}`}>
                    <td className="whitespace-nowrap px-2.5 py-1.5 font-medium text-gray-900">
                      {idx + 1}
                      {it.isExtra && <span className="ml-1.5 inline-block rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700">Extra</span>}
                    </td>
                    <td className="px-1.5 py-1.5">
                      {isEditing ? (
                        <input
                          type="text"
                          className="table-input min-w-[150px]"
                          value={it.productName ?? ''}
                          onChange={(e) => updateItem(idx, 'productName', e.target.value)}
                          placeholder="Product Name"
                        />
                      ) : (
                        <span className="font-semibold text-gray-900 min-w-[140px] block px-1">{it.productName || '—'}</span>
                      )}
                    </td>
                    <td className="px-1.5 py-1.5">
                      {isEditing ? (
                        <input
                          type="text"
                          className="table-input min-w-[110px]"
                          value={it.category ?? ''}
                          onChange={(e) => updateItem(idx, 'category', e.target.value)}
                          placeholder="Category"
                        />
                      ) : (
                        <span className="whitespace-nowrap text-gray-600 block px-1">{it.category || '—'}</span>
                      )}
                    </td>
                    <td className="px-1.5 py-1.5">
                      {isEditing ? (
                        <input
                          type="text"
                          className="table-input min-w-[110px]"
                          value={it.vendor ?? ''}
                          onChange={(e) => updateItem(idx, 'vendor', e.target.value)}
                          placeholder="Vendor"
                        />
                      ) : (
                        <span className="whitespace-nowrap text-gray-600 block px-1">{it.vendor || '—'}</span>
                      )}
                    </td>
                    <td className="px-1.5 py-1.5">
                      {isEditing ? (
                        <input
                          type="text"
                          className="table-input min-w-[95px]"
                          value={it.parentGroup ?? ''}
                          onChange={(e) => updateItem(idx, 'parentGroup', e.target.value)}
                          placeholder="Parent Group"
                        />
                      ) : (
                        <span className="whitespace-nowrap text-gray-600 block px-1">{it.parentGroup || '—'}</span>
                      )}
                    </td>
                    <td className="px-1.5 py-1.5">
                      {isEditing ? (
                        <input
                          type="text"
                          className="table-input min-w-[80px]"
                          value={it.shelfCapacity ?? ''}
                          onChange={(e) => updateItem(idx, 'shelfCapacity', e.target.value)}
                          placeholder="Shelf Cap"
                        />
                      ) : (
                        <span className="whitespace-nowrap text-gray-600 block px-1">{it.shelfCapacity || '—'}</span>
                      )}
                    </td>
                    <td className="px-1.5 py-1.5">
                      {isEditing ? (
                        <input
                          type="number"
                          className="table-input min-w-[65px]"
                          value={it.maxLevelQty ?? ''}
                          onChange={(e) => updateItem(idx, 'maxLevelQty', e.target.value)}
                          placeholder="Max Qty"
                        />
                      ) : (
                        <span className="whitespace-nowrap text-gray-600 block px-1">{it.maxLevelQty != null && it.maxLevelQty !== '' ? it.maxLevelQty : '—'}</span>
                      )}
                    </td>
                    <td className="px-1.5 py-1.5">
                      {isEditing ? (
                        <input
                          type="number"
                          className="table-input min-w-[65px]"
                          value={it.rolQty ?? ''}
                          onChange={(e) => updateItem(idx, 'rolQty', e.target.value)}
                          placeholder="ROL Qty"
                        />
                      ) : (
                        <span className="whitespace-nowrap text-gray-600 block px-1">{it.rolQty != null && it.rolQty !== '' ? it.rolQty : '—'}</span>
                      )}
                    </td>
                    <td className="px-1.5 py-1.5">
                      <input
                        type="number"
                        min="0"
                        className="table-input min-w-[70px] font-semibold text-gray-900"
                        value={it.qty ?? ''}
                        onChange={(e) => updateItem(idx, 'qty', e.target.value)}
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      {isEditing ? (
                        <input
                          type="text"
                          className="table-input min-w-[60px]"
                          value={it.units ?? ''}
                          onChange={(e) => updateItem(idx, 'units', e.target.value)}
                          placeholder="Units"
                        />
                      ) : (
                        <span className="whitespace-nowrap text-gray-600 block px-1">{it.units || '—'}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-1.5 py-1.5 text-center">
                      {editingRowIdx === idx && !editAll ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            className="rounded bg-[#173254] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#122842] shadow-xs"
                            onClick={() => doneEditRow(idx)}
                          >
                            Done
                          </button>
                          <button
                            type="button"
                            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 shadow-xs"
                            onClick={() => cancelEditRow(idx)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          {!editAll && (
                            <button
                              type="button"
                              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100 hover:text-[#173254] transition shadow-xs"
                              onClick={() => startEditRow(idx)}
                              title="Edit item inline"
                            >
                              Edit
                            </button>
                          )}
                          <button
                            type="button"
                            className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                            onClick={() => removeItem(idx)}
                            title="Delete"
                          >
                            &times;
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-2">
        <label className="field-label">Terms &amp; Conditions</label>
        <textarea className="form-input" rows={4} value={form.terms} onChange={(e) => updateField('terms', e.target.value)} />
      </div>

      {submitError && <div className="mt-3 text-right text-sm text-rose-600">{submitError}</div>}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button className="rounded-lg border border-[#173254] px-4 py-2 text-sm font-semibold text-[#173254]" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button className="rounded-lg border border-[#173254] px-4 py-2 text-sm font-semibold text-[#173254]" onClick={handlePreview} disabled={saving}>
          Preview
        </button>
        <button className="rounded-lg bg-[#C99A3E] px-4 py-2 text-sm font-semibold text-[#1B2A3D] hover:bg-[#B98A2E] disabled:opacity-60" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Saving…' : isRevision ? 'Update / Revise PO' : 'Submit PO'}
        </button>
      </div>

      <PreviewModal po={preview && preview.po} revisionNote={preview && preview.note} onClose={() => setPreview(null)} />
    </div>
  );
}

function buildInitialForm(draft) {
  const existingPO = draft && draft.existingPO;
  if (existingPO) {
    return {
      poNo: existingPO.poNo,
      poDate: existingPO.poDate,
      requisitioner: existingPO.requisitioner,
      shipVia: existingPO.shipVia,
      fob: existingPO.fob,
      shipTerms: existingPO.shipTerms,
      vendorName: existingPO.vendor.name,
      vendorAddr: existingPO.vendor.addr,
      vendorGstin: existingPO.vendor.gstin,
      vendorContact: existingPO.vendor.contact,
      vendorEmail: existingPO.vendor.email,
      fixTransporter: existingPO.vendor.fixTransporter || '',
      vendorPaymentTerms: existingPO.vendor.paymentTerms || '',
      vendorCity: existingPO.vendor.city || '',
      shipName: existingPO.shipTo.name || '',
      shipAddr: existingPO.shipTo.addr || '',
      shipGstin: existingPO.shipTo.gstin || '',
      shipContact: existingPO.shipTo.contact || '',
      shipEmail: existingPO.shipTo.email || '',
      terms: existingPO.terms,
      discount: existingPO.discount,
    };
  }
  return {
    poNo: '',
    poDate: new Date().toISOString().slice(0, 10),
    requisitioner: 'Store Manager',
    shipVia: 'Road by truck',
    fob: 'On destination',
    shipTerms: 'Free shipping to destination',
    vendorName: (draft && draft.vendorName) || '',
    vendorAddr: '',
    vendorGstin: '',
    vendorContact: '',
    vendorEmail: '',
    fixTransporter: '',
    vendorPaymentTerms: '',
    vendorCity: '',
    shipName: 'Bhatia Enterprises',
    shipAddr: 'Nehru Chowk, Bilaspur (C.G.)',
    shipGstin: '22AAAFB4097G1ZR', // default fallback
    shipContact: 'Contact no.',
    shipEmail: 'purchase-team@bhatia.com',
    terms: DEFAULT_TERMS,
    discount: 0,
  };
}

function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}
