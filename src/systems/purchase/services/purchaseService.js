import supabase from '../../../SupabaseClient';
import { startOrUpdateStage, completeStage, handleDeliveryReceived } from '../../../core/services/tatService';

function mapIndentRow(row) {
  return {
    dbId: row.id,
    id: row.unique_no,
    itemDetails: row.item_details,
    category: row.category,
    vendor: row.vendor,
    unit: row.unit,
    altUnit: row.alt_unit,
    parentGroup: row.parent_group,
    shelfCapacity: row.shelf_capacity,
    maxLevelQty: row.max_level_qty,
    rolQty: row.rol_qty,
    clQty: row.cl_qty,
    conversionUnit: row.conversion_unit,
    orderFormula: row.order_formula,
    status: row.status,
    remarks: row.remarks,
    approvedQty: row.approved_qty,
    decidedAt: row.decided_at,
    poNo: row.po_no,
    poId: row.po_id,
    createdAt: row.created_at,
  };
}

export async function deleteIndents(dbIds) {
  const { error } = await supabase.from('purchase_indents').delete().in('id', dbIds);
  if (error) throw error;
}

export async function fixIndentVendor(dbIds, vendorName) {
  const { error } = await supabase.from('purchase_indents').update({ vendor: vendorName }).in('id', dbIds);
  if (error) throw error;
}

export async function fetchIndents() {
  const { data, error } = await supabase
    .from('purchase_indents')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapIndentRow);
}

function mapHistoryRow(row) {
  return {
    status: row.status,
    remarks: row.remarks,
    approvedQty: row.approved_qty,
    decidedAt: row.decided_at ? new Date(row.decided_at).toLocaleString('en-IN') : null,
  };
}

export async function decideCategory({ ids, qtyById, status, remarks }) {
  const qtyPayload = {};
  ids.forEach((id) => {
    if (qtyById[id] != null) qtyPayload[id] = qtyById[id];
  });

  const { data, error } = await supabase.rpc('purchase_decide_category', {
    p_ids: ids,
    p_qty: qtyPayload,
    p_status: status,
    p_remarks: remarks,
  });
  if (error) throw error;

  // Complete Indent Approval stage and start Purchase Order stage if approved
  try {
    const timestamp = new Date().toISOString();
    await Promise.all(ids.map(async (id) => {
      await completeStage(id, 'indent_approval', timestamp);
      if (status === 'Approved') {
        await startOrUpdateStage(id, 'purchase_order', timestamp);
      }
    }));
  } catch (tatErr) {
    console.error('Error logging decideCategory TAT:', tatErr);
  }

  return (data || []).map(mapIndentRow);
}

export async function findOutstandingConflicts(candidates) {
  const conflicts = new Map();
  if (!candidates || candidates.length === 0) return conflicts;

  const [{ data: approvedIndents, error: indentErr }, { data: deliveries, error: delErr }] = await Promise.all([
    supabase.from('purchase_indents').select('id, vendor, item_details, po_id, po_no').eq('status', 'Approved'),
    supabase.from('purchase_deliveries').select('po_id, received'),
  ]);
  if (indentErr) throw indentErr;
  if (delErr) throw delErr;

  const receivedPoIds = new Set((deliveries || []).filter((d) => d.received && d.po_id).map((d) => d.po_id));

  const normKey = (vendor, itemDetails) => `${(vendor || '').trim().toLowerCase()}|${(itemDetails || '').trim().toLowerCase()}`;

  const outstandingByKey = new Map();
  (approvedIndents || []).forEach((row) => {
    const isReceived = row.po_id && receivedPoIds.has(row.po_id);
    if (isReceived) return;
    const key = normKey(row.vendor, row.item_details);
    if (!outstandingByKey.has(key)) {
      outstandingByKey.set(key, { poNo: row.po_no || null, hasPo: !!row.po_id });
    }
  });

  candidates.forEach((item) => {
    const key = normKey(item.vendor, item.itemDetails);
    const match = outstandingByKey.get(key);
    if (match) {
      conflicts.set(item.dbId, {
        vendor: item.vendor,
        itemDetails: item.itemDetails,
        reason: match.hasPo
          ? `Still awaiting receipt of an existing order${match.poNo ? ` (PO ${match.poNo})` : ''} for this item from this vendor.`
          : 'An earlier approved order for this item from this vendor is still awaiting a PO/receipt.',
      });
    }
  });

  return conflicts;
}

export async function fetchIndentHistory(indentId) {
  const { data, error } = await supabase
    .from('purchase_indent_history')
    .select('*')
    .eq('indent_id', indentId)
    .order('archived_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapHistoryRow);
}

export async function importIndentRows(parsedRows) {
  if (!parsedRows || parsedRows.length === 0) return { rows: [], firstNo: null, lastNo: null, matchedCount: 0, insertedCount: 0 };

  // Fetch items currently in approval stage (Pending status)
  const { data: indents, error: indentErr } = await supabase
    .from('purchase_indents')
    .select('*')
    .eq('status', 'Pending');
  if (indentErr) throw indentErr;

  const normalizeName = (name) => (name || '').trim().toLowerCase().replace(/\s+/g, ' ');

  const activePool = {};
  (indents || []).forEach((row) => {
    const norm = normalizeName(row.item_details);
    if (!activePool[norm]) {
      activePool[norm] = [];
    }
    activePool[norm].push(row);
  });

  const newRowsToInsert = [];
  const matchedRows = [];

  parsedRows.forEach((r) => {
    const norm = normalizeName(r.itemDetails);
    const existingList = activePool[norm] || [];
    if (existingList.length > 0) {
      const matchedIndent = existingList.shift();
      matchedRows.push(matchedIndent);
    } else {
      newRowsToInsert.push(r);
    }
  });

  const year = new Date().getFullYear();
  let insertedRows = [];
  let firstNo = null;
  let lastNo = null;

  if (newRowsToInsert.length > 0) {
    const { data: reserved, error: reserveError } = await supabase.rpc('purchase_reserve_indent_numbers', {
      p_year: year,
      p_count: newRowsToInsert.length,
    });
    if (reserveError) throw reserveError;

    const createdBy = localStorage.getItem('user-id') || null;
    const importBatchId = crypto.randomUUID();

    const payload = newRowsToInsert.map((r, i) => ({
      unique_no: reserved[i].unique_no,
      import_batch_id: importBatchId,
      created_by: createdBy,
      item_details: r.itemDetails,
      category: r.category || 'Uncategorized',
      vendor: r.vendor || '',
      unit: r.unit || 'Pcs.',
      alt_unit: r.altUnit || '',
      parent_group: r.parentGroup || '',
      shelf_capacity: r.shelfCapacity || '',
      max_level_qty: Number(r.maxLevelQty) || 0,
      rol_qty: Number(r.rolQty) || 0,
      cl_qty: Number(r.clQty) || 0,
      conversion_unit: r.conversionUnit || '',
      order_formula: Number(r.orderFormula) || 0,
    }));

    const { data, error } = await supabase.from('purchase_indents').insert(payload).select();
    if (error) throw error;

    insertedRows = data || [];
    firstNo = reserved[0].unique_no;
    lastNo = reserved[reserved.length - 1].unique_no;

    // Start Indent Approval stage for newly imported indents
    try {
      if (insertedRows.length) {
        await Promise.all(insertedRows.map(row => startOrUpdateStage(row.id, 'indent_approval', row.created_at)));
      }
    } catch (tatErr) {
      console.error('Error logging import Indent TAT:', tatErr);
    }
  }

  const mappedMatched = matchedRows.map(mapIndentRow);
  const mappedInserted = insertedRows.map(mapIndentRow);

  return {
    rows: [...mappedMatched, ...mappedInserted],
    firstNo,
    lastNo,
    matchedCount: matchedRows.length,
    insertedCount: insertedRows.length,
  };
}

function mapPoItemRow(row) {
  return {
    indentId: row.indent_id,
    productCode: row.product_code,
    productName: row.product_name,
    hsn: row.hsn,
    qty: row.qty,
    units: row.units,
    rate: row.rate,
    tax: row.tax,
    amount: row.amount,
    isExtra: row.is_extra,
  };
}

function mapPoRow(row, itemRows) {
  return {
    id: row.id,
    poNo: row.po_no,
    baseNo: row.base_no,
    revision: row.revision,
    poDate: row.po_date,
    requisitioner: row.requisitioner,
    shipVia: row.ship_via,
    fob: row.fob,
    shipTerms: row.ship_terms,
    vendor: { name: row.vendor_name, addr: row.vendor_addr, gstin: row.vendor_gstin, contact: row.vendor_contact, email: row.vendor_email, fixTransporter: row.vendor_fix_transporter, paymentTerms: row.vendor_payment_terms },
    shipTo: { gstin: row.ship_gstin, contact: row.ship_contact, email: row.ship_email },
    terms: row.terms,
    discount: row.discount,
    total: row.total,
    taxAmount: row.tax_amount,
    grandTotal: row.grand_total,
    items: (itemRows || []).map(mapPoItemRow),
    createdAt: row.created_at,
  };
}

function computeTotals(items, discount) {
  const total = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0);
  const taxAmount = items.reduce((s, it) => {
    const amt = (Number(it.qty) || 0) * (Number(it.rate) || 0);
    return s + amt * ((Number(it.tax) || 0) / 100);
  }, 0);
  const disc = Number(discount) || 0;
  return { total, taxAmount, grandTotal: total + taxAmount - disc };
}

function poFieldsFromForm(form) {
  return {
    po_date: form.poDate || null,
    requisitioner: form.requisitioner,
    ship_via: form.shipVia,
    fob: form.fob,
    ship_terms: form.shipTerms,
    vendor_name: form.vendor.name,
    vendor_addr: form.vendor.addr,
    vendor_gstin: form.vendor.gstin,
    vendor_contact: form.vendor.contact,
    vendor_email: form.vendor.email,
    vendor_fix_transporter: form.vendor.fixTransporter || null,
    vendor_payment_terms: form.vendor.paymentTerms || null,
    ship_gstin: form.shipTo.gstin,
    ship_contact: form.shipTo.contact,
    ship_email: form.shipTo.email,
    terms: form.terms,
    discount: Number(form.discount) || 0,
  };
}

function poItemPayload(poId, items) {
  return items.map((it) => ({
    po_id: poId,
    indent_id: it.indentId || null,
    product_code: it.productCode,
    product_name: it.productName,
    hsn: it.hsn,
    qty: Number(it.qty) || 0,
    units: it.units,
    rate: Number(it.rate) || 0,
    tax: Number(it.tax) || 0,
    amount: Number(it.amount) || 0,
    is_extra: !!it.isExtra,
  }));
}

export async function fetchPOs() {
  const { data: poRows, error: poErr } = await supabase.from('purchase_pos').select('*').order('created_at', { ascending: false });
  if (poErr) throw poErr;

  const ids = (poRows || []).map((p) => p.id);
  let itemRows = [];
  if (ids.length) {
    const { data, error } = await supabase.from('purchase_po_items').select('*').in('po_id', ids);
    if (error) throw error;
    itemRows = data || [];
  }
  const itemsByPo = {};
  itemRows.forEach((r) => {
    (itemsByPo[r.po_id] = itemsByPo[r.po_id] || []).push(r);
  });

  return (poRows || []).map((row) => mapPoRow(row, itemsByPo[row.id]));
}

export async function fetchPO(poId) {
  const { data: row, error } = await supabase.from('purchase_pos').select('*').eq('id', poId).single();
  if (error) throw error;
  const { data: itemRows, error: itemErr } = await supabase.from('purchase_po_items').select('*').eq('po_id', poId);
  if (itemErr) throw itemErr;
  return mapPoRow(row, itemRows);
}

export async function fetchPoRevisions(poId) {
  const { data, error } = await supabase
    .from('purchase_po_revisions')
    .select('*')
    .eq('po_id', poId)
    .order('revised_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => ({ ...r.snapshot, revisedAt: r.revised_at ? new Date(r.revised_at).toLocaleString('en-IN') : null }));
}

export async function submitNewPO({ form, items }) {
  const year = new Date().getFullYear();
  const { data: poNo, error: noErr } = await supabase.rpc('purchase_next_po_no', { p_year: year });
  if (noErr) throw noErr;

  const { total, taxAmount, grandTotal } = computeTotals(items, form.discount);
  const createdBy = localStorage.getItem('user-id') || null;

  const { data: poRow, error: poErr } = await supabase
    .from('purchase_pos')
    .insert({
      po_no: poNo,
      base_no: poNo,
      revision: 1,
      created_by: createdBy,
      ...poFieldsFromForm(form),
      total,
      tax_amount: taxAmount,
      grand_total: grandTotal,
    })
    .select()
    .single();
  if (poErr) throw poErr;

  const { data: itemRows, error: itemErr } = await supabase.from('purchase_po_items').insert(poItemPayload(poRow.id, items)).select();
  if (itemErr) throw itemErr;

  const indentIds = items.filter((it) => it.indentId).map((it) => it.indentId);
  if (indentIds.length) {
    const { error: updErr } = await supabase.from('purchase_indents').update({ po_no: poNo, po_id: poRow.id }).in('id', indentIds);
    if (updErr) throw updErr;
  }

  // Complete Purchase Order stage for these indents, and start Delivery stage for PO
  try {
    const timestamp = new Date().toISOString();
    if (indentIds.length) {
      await Promise.all(indentIds.map(id => completeStage(id, 'purchase_order', timestamp)));
    }
    await startOrUpdateStage(poRow.id, 'delivery', poRow.created_at || timestamp);
  } catch (tatErr) {
    console.error('Error logging PO submit TAT:', tatErr);
  }

  return mapPoRow(poRow, itemRows);
}

export async function revisePO({ poId, form, items }) {
  const { data: existing, error: exErr } = await supabase.from('purchase_pos').select('*').eq('id', poId).single();
  if (exErr) throw exErr;
  const { data: existingItems, error: exItemErr } = await supabase.from('purchase_po_items').select('*').eq('po_id', poId);
  if (exItemErr) throw exItemErr;

  const snapshot = mapPoRow(existing, existingItems);
  const { error: revErr } = await supabase.from('purchase_po_revisions').insert({ po_id: poId, po_no: existing.po_no, snapshot });
  if (revErr) throw revErr;

  const newRevision = (existing.revision || 1) + 1;
  const revisedPoNo = existing.base_no + '-R' + (newRevision - 1);
  const { total, taxAmount, grandTotal } = computeTotals(items, form.discount);

  const { data: poRow, error: updErr } = await supabase
    .from('purchase_pos')
    .update({
      po_no: revisedPoNo,
      revision: newRevision,
      ...poFieldsFromForm(form),
      total,
      tax_amount: taxAmount,
      grand_total: grandTotal,
      updated_at: new Date().toISOString(),
    })
    .eq('id', poId)
    .select()
    .single();
  if (updErr) throw updErr;

  const { error: delErr } = await supabase.from('purchase_po_items').delete().eq('po_id', poId);
  if (delErr) throw delErr;

  const { data: itemRows, error: itemErr } = await supabase.from('purchase_po_items').insert(poItemPayload(poId, items)).select();
  if (itemErr) throw itemErr;

  return mapPoRow(poRow, itemRows);
}
function mapDeliveryRow(row) {
  let billNumber = row.bill_number;
  let billImageUrl = row.bill_image_url || null;

  if (!billImageUrl) {
    if (row.bill_number && row.bill_number.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(row.bill_number);
        billNumber = parsed.billNumber || '';
        billImageUrl = parsed.billImageUrl || null;
      } catch (e) {
        // fallback
      }
    } else if (row.bill_number && (row.bill_number.startsWith('http://') || row.bill_number.startsWith('https://'))) {
      billImageUrl = row.bill_number;
      billNumber = '—';
    }
  }

  return {
    id: row.id,
    poId: row.po_id,
    transportName: row.transport_name,
    contact: row.contact,
    builtyDate: row.builty_date,
    builtyNumber: row.builty_number,
    builtyImageUrl: row.builty_image_url,
    daggCount: row.dagg_count,
    billNumber: billNumber,
    billImageUrl: billImageUrl,
    received: row.received,
    receivedAt: row.received_at,
    createdAt: row.created_at,
  };
}

export async function fetchTransporters() {
  const { data, error } = await supabase.from('transporters').select('*').order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createTransporter({ name, contact, duration, cities }) {
  const { data, error } = await supabase
    .from('transporters')
    .insert({
      name,
      contacts: contact ? [contact] : [],
      duration: duration || '',
      cities: cities ? [cities] : [],
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchDeliveries() {
  const { data, error } = await supabase
    .from('purchase_deliveries')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapDeliveryRow);
}

export async function uploadBuiltyImage(file) {
  const fileExt = file.name.split('.').pop();
  const fileName = `builty_${Date.now()}.${fileExt}`;
  const { error: uploadError } = await supabase.storage.from('purchase-builty').upload(fileName, file);
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from('purchase-builty').getPublicUrl(fileName);
  return data.publicUrl;
}

export async function createDelivery({ poId, transportName, contact, builtyDate, builtyNumber, daggCount, billNumber, builtyImageFile, billImageFile }) {
  let builtyImageUrl = null;
  if (builtyImageFile) {
    builtyImageUrl = await uploadBuiltyImage(builtyImageFile);
  }

  let billImageUrl = null;
  if (billImageFile) {
    const fileExt = billImageFile.name.split('.').pop();
    const fileName = `bill_${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('purchase-builty').upload(fileName, billImageFile);
    if (!uploadError) {
      const { data } = supabase.storage.from('purchase-builty').getPublicUrl(fileName);
      billImageUrl = data.publicUrl;
    }
  }

  const createdBy = localStorage.getItem('user-id') || null;

  const { data, error } = await supabase
    .from('purchase_deliveries')
    .insert({
      po_id: poId || null,
      transport_name: transportName,
      contact,
      builty_date: builtyDate || null,
      builty_number: builtyNumber,
      dagg_count: Number(daggCount) || 0,
      bill_number: billNumber || '',
      bill_image_url: billImageUrl,
      builty_image_url: builtyImageUrl,
      created_by: createdBy,
    })
    .select()
    .single();
  if (error) throw error;

  // Complete Delivery stage for PO and start Receiving stage for delivery
  try {
    if (poId) {
      await completeStage(poId, 'delivery', data.created_at);
    }
    await startOrUpdateStage(data.id, 'receiving', data.created_at);
  } catch (tatErr) {
    console.error('Error logging createDelivery TAT:', tatErr);
  }

  return mapDeliveryRow(data);
}

export async function markDeliveryReceived(deliveryId, received) {
  const receivedBy = localStorage.getItem('user-id') || null;
  const { data, error } = await supabase
    .from('purchase_deliveries')
    .update({
      received,
      received_at: received ? new Date().toISOString() : null,
      received_by: received ? receivedBy : null,
    })
    .eq('id', deliveryId)
    .select()
    .single();
  if (error) throw error;

  // Complete Receiving stage and conditionally trigger Payment Approval stage
  if (received) {
    try {
      await handleDeliveryReceived(deliveryId);
    } catch (tatErr) {
      console.error('Error handling TAT for delivery receive:', tatErr);
    }
  }

  return mapDeliveryRow(data);
}
function mapReceivingRow(row, itemRows) {
  return {
    id: row.id,
    deliveryId: row.delivery_id,
    receivedAt: row.received_at,
    receivedBy: row.received_by,
    items: (itemRows || []).map((i) => ({
      productCode: i.product_code,
      productName: i.product_name,
      orderedQty: i.ordered_qty,
      receivedQty: i.received_qty,
    })),
  };
}

export async function fetchReceivings() {
  const { data: receivingRows, error: recErr } = await supabase
    .from('purchase_receivings')
    .select('*')
    .order('received_at', { ascending: false });
  if (recErr) throw recErr;

  const ids = (receivingRows || []).map((r) => r.id);
  let itemRows = [];
  if (ids.length) {
    const { data, error } = await supabase.from('purchase_receiving_items').select('*').in('receiving_id', ids);
    if (error) throw error;
    itemRows = data || [];
  }
  const itemsByReceiving = {};
  itemRows.forEach((r) => {
    (itemsByReceiving[r.receiving_id] = itemsByReceiving[r.receiving_id] || []).push(r);
  });

  return (receivingRows || []).map((row) => mapReceivingRow(row, itemsByReceiving[row.id]));
}

export async function submitReceiving({ deliveryId, items, fullyReceived }) {
  const receivedBy = localStorage.getItem('user-id') || null;

  const { data: receivingRow, error: recErr } = await supabase
    .from('purchase_receivings')
    .insert({ delivery_id: deliveryId, received_by: receivedBy })
    .select()
    .single();
  if (recErr) throw recErr;

  const itemPayload = items
    .filter((it) => Number(it.receivedQty) > 0)
    .map((it) => ({
      receiving_id: receivingRow.id,
      product_code: it.productCode,
      product_name: it.productName,
      ordered_qty: Number(it.orderedQty) || 0,
      received_qty: Number(it.receivedQty) || 0,
    }));

  const { data: itemRows, error: itemErr } = await supabase
    .from('purchase_receiving_items')
    .insert(itemPayload)
    .select();
  if (itemErr) throw itemErr;

  if (fullyReceived) {
    const { error: updErr } = await supabase
      .from('purchase_deliveries')
      .update({ received: true, received_at: new Date().toISOString(), received_by: receivedBy })
      .eq('id', deliveryId);
    if (updErr) throw updErr;

    // Complete Receiving stage and conditionally trigger Payment Approval stage
    try {
      await handleDeliveryReceived(deliveryId);
    } catch (tatErr) {
      console.error('Error handling TAT for delivery receive:', tatErr);
    }
  }

  return mapReceivingRow(receivingRow, itemRows);
}

export async function updateDelivery({ id, transportName, contact, builtyDate, builtyNumber, daggCount, billNumber, builtyImageFile, billImageFile, existingBuiltyUrl, existingBillUrl }) {
  let builtyImageUrl = existingBuiltyUrl;
  if (builtyImageFile) {
    builtyImageUrl = await uploadBuiltyImage(builtyImageFile);
  }

  let billImageUrl = existingBillUrl;
  if (billImageFile) {
    const fileExt = billImageFile.name.split('.').pop();
    const fileName = `bill_${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('purchase-builty').upload(fileName, billImageFile);
    if (!uploadError) {
      const { data } = supabase.storage.from('purchase-builty').getPublicUrl(fileName);
      billImageUrl = data.publicUrl;
    }
  }

  const { data, error } = await supabase
    .from('purchase_deliveries')
    .update({
      transport_name: transportName,
      contact,
      builty_date: builtyDate || null,
      builty_number: builtyNumber,
      dagg_count: Number(daggCount) || 0,
      bill_number: billNumber || '',
      bill_image_url: billImageUrl,
      builty_image_url: builtyImageUrl,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return mapDeliveryRow(data);
}

export async function reviseReceiving({ receivingId, items, fullyReceived }) {
  const { data: exRec, error: exRecErr } = await supabase.from('purchase_receivings').select('*').eq('id', receivingId).single();
  if (exRecErr) throw exRecErr;

  const { error: delErr } = await supabase.from('purchase_receiving_items').delete().eq('receiving_id', receivingId);
  if (delErr) throw delErr;

  const itemPayload = items
    .filter((it) => Number(it.receivedQty) > 0)
    .map((it) => ({
      receiving_id: receivingId,
      product_code: it.productCode,
      product_name: it.productName,
      ordered_qty: Number(it.orderedQty) || 0,
      received_qty: Number(it.receivedQty) || 0,
    }));

  const { data: itemRows, error: itemErr } = await supabase
    .from('purchase_receiving_items')
    .insert(itemPayload)
    .select();
  if (itemErr) throw itemErr;

  const receivedBy = localStorage.getItem('user-id') || null;
  const { error: updErr } = await supabase
    .from('purchase_deliveries')
    .update({ received: fullyReceived, received_at: fullyReceived ? new Date().toISOString() : null, received_by: receivedBy })
    .eq('id', exRec.delivery_id);
  if (updErr) throw updErr;

  return mapReceivingRow(exRec, itemRows);
}
// ── Sidebar badge counts ────────────────────────────────────────────────
// Lightweight, column-limited queries (no joins) so this can be polled
// from the sidebar without the cost of the full fetch* functions above.
export async function fetchPurchasePendingCounts() {
  const [indentsRes, posRes, deliveriesRes, payablePOsRaw, approvalsRes, paymentsRes] = await Promise.all([
    supabase.from('purchase_indents').select('id, status, order_formula, po_id'),
    supabase.from('purchase_pos').select('id'),
    supabase.from('purchase_deliveries').select('id, po_id, received'),
    fetchPayablePOs(),
    supabase.from('purchase_payment_approvals').select('id, po_id, status'),
    supabase.from('purchase_payments').select('id, payment_approval_id'),
  ]);

  if (indentsRes.error) throw indentsRes.error;
  if (posRes.error) throw posRes.error;
  if (deliveriesRes.error) throw deliveriesRes.error;
  if (approvalsRes.error) throw approvalsRes.error;
  if (paymentsRes.error) throw paymentsRes.error;

  const indents = indentsRes.data || [];
  const pos = posRes.data || [];
  const deliveries = deliveriesRes.data || [];
  const approvals = approvalsRes.data || [];
  const payments = paymentsRes.data || [];

  // Indents awaiting an approve/reject decision
  const approvalPending = indents.filter(
    (i) => i.status === 'Pending' && Number(i.order_formula) > 0
  ).length;

  // Indents approved but not yet attached to a PO
  const poPending = indents.filter((i) => i.status === 'Approved' && !i.po_id).length;

  // POs with no delivery logged against them yet
  const deliveredPoIds = new Set(deliveries.filter((d) => d.po_id).map((d) => d.po_id));
  const deliveryPending = pos.filter((p) => !deliveredPoIds.has(p.id)).length;

  // Deliveries logged but not yet marked received
  const receivingPending = deliveries.filter((d) => !d.received).length;

  // Fully-received POs with no payment-approval decision yet
  const decidedPoIds = new Set(approvals.map((a) => a.po_id));
  const paymentApprovalPending = payablePOsRaw.filter((p) => !decidedPoIds.has(p.id)).length;

  // Approved payment-approvals that haven't been paid yet
  const paidApprovalIds = new Set(payments.map((p) => p.payment_approval_id));
  const paymentPending = approvals.filter(
    (a) => a.status === 'Approved' && !paidApprovalIds.has(a.id)
  ).length;

  return {
    approvalPending,
    poPending,
    deliveryPending,
    receivingPending,
    paymentApprovalPending,
    paymentPending,
    total:
      approvalPending +
      poPending +
      deliveryPending +
      receivingPending +
      paymentApprovalPending +
      paymentPending,
  };
}
function mapPaymentApprovalRow(row) {
  return {
    id: row.id,
    poId: row.po_id,
    status: row.status,
    remarks: row.remarks,
    advanceAmount: row.advance_amount,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
  };
}

export async function fetchPaymentApprovals() {
  const { data, error } = await supabase
    .from('purchase_payment_approvals')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapPaymentApprovalRow);
}

export async function fetchPayablePOs() {
  const [posRes, deliveriesRes, itemsRes] = await Promise.all([
    supabase.from('purchase_pos').select('*'),
    supabase.from('purchase_deliveries').select('id, po_id, received'),
    supabase.from('purchase_po_items').select('*'),
  ]);
  if (posRes.error) throw posRes.error;
  if (deliveriesRes.error) throw deliveriesRes.error;
  if (itemsRes.error) throw itemsRes.error;

  const deliveriesByPo = {};
  (deliveriesRes.data || []).forEach((d) => {
    (deliveriesByPo[d.po_id] = deliveriesByPo[d.po_id] || []).push(d);
  });
  const itemsByPo = {};
  (itemsRes.data || []).forEach((r) => {
    (itemsByPo[r.po_id] = itemsByPo[r.po_id] || []).push(r);
  });

  return (posRes.data || [])
    .filter((row) => {
      const dels = deliveriesByPo[row.id] || [];
      return dels.length > 0 && dels.every((d) => d.received);
    })
    .map((row) => mapPoRow(row, itemsByPo[row.id]));
}

export async function submitPaymentApproval({ poId, status, remarks, advanceAmount }) {
  const decidedBy = localStorage.getItem('user-id') || null;
  const { data, error } = await supabase
    .from('purchase_payment_approvals')
    .insert({ po_id: poId, status, remarks, decided_by: decidedBy, advance_amount: advanceAmount != null && advanceAmount !== '' ? Number(advanceAmount) || 0 : null })
    .select()
    .single();
  if (error) throw error;

  // Complete Payment Approval stage and start Payment stage if approved
  try {
    const timestamp = new Date().toISOString();
    await completeStage(poId, 'payment_approval', timestamp);
    if (status === 'Approved') {
      await startOrUpdateStage(data.id, 'payment', timestamp);
    }
  } catch (tatErr) {
    console.error('Error logging Payment Approval TAT:', tatErr);
  }

  return mapPaymentApprovalRow(data);
}

function mapPaymentRow(row) {
  return {
    id: row.id,
    paymentApprovalId: row.payment_approval_id,
    poId: row.po_id,
    proofUrl: row.proof_url,
    remarks: row.remarks,
    amountPaid: row.amount_paid,
    paidBy: row.paid_by,
    paidAt: row.paid_at,
    createdAt: row.created_at,
  };
}

export async function fetchPayments() {
  const { data, error } = await supabase
    .from('purchase_payments')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapPaymentRow);
}

export async function uploadPaymentProof(file) {
  const fileExt = file.name.split('.').pop();
  const fileName = `payment_${Date.now()}.${fileExt}`;
  const { error: uploadError } = await supabase.storage.from('purchase-payment-proof').upload(fileName, file);
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from('purchase-payment-proof').getPublicUrl(fileName);
  return data.publicUrl;
}

export async function submitPayment({ paymentApprovalId, poId, proofFile, remarks, amountPaid }) {
  let proofUrl = null;
  if (proofFile) proofUrl = await uploadPaymentProof(proofFile);
  const paidBy = localStorage.getItem('user-id') || null;

  const { data, error } = await supabase
    .from('purchase_payments')
    .insert({
      payment_approval_id: paymentApprovalId,
      po_id: poId,
      proof_url: proofUrl,
      remarks,
      amount_paid: Number(amountPaid) || 0,
      paid_by: paidBy,
    })
    .select()
    .single();
  if (error) throw error;

  // Complete Payment stage
  try {
    await completeStage(paymentApprovalId, 'payment', data.created_at || new Date().toISOString());
  } catch (tatErr) {
    console.error('Error logging complete Payment TAT:', tatErr);
  }

  return mapPaymentRow(data);
}

export async function createIndentsManualBulk(vendor, items) {
  if (!items || items.length === 0) return [];

  // Query existing Pending indents to prevent duplicates during approval stage
  const { data: existingIndents, error: fetchError } = await supabase
    .from('purchase_indents')
    .select('item_details')
    .eq('status', 'Pending');
  if (fetchError) throw fetchError;

  const normalize = (name) => String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const existingNames = new Set(
    (existingIndents || []).map((i) => normalize(i.item_details))
  );

  for (const item of items) {
    const norm = normalize(item.item_details);
    if (existingNames.has(norm)) {
      throw new Error(`An indent for item "${item.item_details}" is already in approval stage (Pending).`);
    }
  }

  const year = new Date().getFullYear();
  const { data: reserved, error: reserveError } = await supabase.rpc('purchase_reserve_indent_numbers', {
    p_year: year,
    p_count: items.length,
  });
  if (reserveError) throw reserveError;

  const createdBy = localStorage.getItem('user-id') || null;

  const payload = items.map((item, idx) => ({
    unique_no: reserved[idx].unique_no,
    created_by: createdBy,
    item_details: item.item_details,
    category: item.category || 'Uncategorized',
    vendor: vendor || '',
    unit: item.unit || 'Pcs.',
    alt_unit: item.alt_unit || '',
    parent_group: item.parent_group || '',
    shelf_capacity: item.shelf_capacity || '',
    max_level_qty: Number(item.max_level_qty) || 0,
    rol_qty: Number(item.rol_qty) || 0,
    cl_qty: Number(item.cl_qty) || 0,
    conversion_unit: item.conversion_unit || '',
    order_formula: Number(item.order_formula) || Number(item.qty) || 0,
    status: 'Pending',
  }));

  const { data, error } = await supabase.from('purchase_indents').insert(payload).select();
  if (error) throw error;

  try {
    await Promise.all((data || []).map(row => startOrUpdateStage(row.id, 'indent_approval', row.created_at)));
  } catch (tatErr) {
    console.error('Error logging manual Indent TAT:', tatErr);
  }

  return data;
}