// src/redux/api/inventoryApi.js
import supabase from "../../../../SupabaseClient";

const defaultUnits = ['KG', 'PCS', 'MTR', 'LTR', 'BOX', 'TON', 'SET', 'ROLL'];
const defaultLocations = [
  'WH-A / Rack 1', 'WH-A / Rack 2', 'WH-A / Rack 4',
  'WH-A / Rack 7', 'WH-A / Rack 9', 'WH-B / Rack 2',
  'WH-B / Rack 5', 'WH-C / Rack 1', 'WH-C / Rack 2', 'WH-D / Rack 1'
];
const defaultMaterialNames = [
  'Steel Rod 12mm', 'Copper Wire 2.5mm', 'Plastic Granules PP',
  'Packaging Carton (L)', 'Industrial Bearings 6204', 'Lubricant Oil 20L',
  'Stainless Sheet 2mm', 'Cardboard Box (S)', 'Hydraulic Hose 1in', 'LED Driver 24V'
];

const nowStr = () => new Date().toLocaleString();
const today = () => new Date().toISOString().slice(0, 10);

// Mappings between Database (snake_case) and Redux UI (camelCase)
const mapDBUserToUI = (u) => ({
  name: u.user_name || '',
  password: u.password || '',
  role: u.role || 'Viewer',
  department: u.department || 'General',
  location: u.location || '',
  pages: u.page_access === 'all' ? 'all' : (u.page_access ? u.page_access.split(',').map(p => p.trim()) : [])
});

const mapUIUserToDB = (u) => ({
  user_name: u.name,
  password: u.password,
  role: u.role,
  department: u.department,
  location: u.location || null,
  page_access: Array.isArray(u.pages) ? u.pages.join(',') : u.pages
});

const mapDBMaterialToUI = (m) => ({
  sku: m.sku,
  name: m.name,
  category: m.category,
  subCategory: m.sub_category || '',
  unit: m.unit,
  location: m.location || '',
  opening: Number(m.opening) || 0,
  adc: Number(m.adc) || 0,
  leadTime: Number(m.lead_time) || 0,
  safetyFactor: Number(m.safety_factor) || 0,
  moq: Number(m.moq) || 0,
  supplierName: m.supplier_name || '',
  supplierCode: m.supplier_code || '',
  status: m.status || 'Active'
});

const mapUIMaterialToDB = (m) => ({
  sku: m.sku,
  name: m.name,
  category: m.category,
  sub_category: m.subCategory || null,
  unit: m.unit,
  location: m.location || null,
  opening: Number(m.opening) || 0,
  adc: Number(m.adc) || 0,
  lead_time: Number(m.leadTime) || 0,
  safety_factor: Number(m.safetyFactor) || 0,
  moq: Number(m.moq) || 0,
  supplier_name: m.supplierName || null,
  supplier_code: m.supplierCode || null,
  status: m.status || 'Active'
});

const mapDBTxnToUI = (t) => ({
  id: t.id,
  date: t.date,
  sku: t.sku,
  name: t.name,
  qty: Number(t.qty) || 0,
  type: t.type,
  ref: t.ref || '',
  remarks: t.remarks || '',
  user: t.user_name || ''
});

const mapUITxnToDB = (t) => ({
  id: t.id,
  date: t.date,
  sku: t.sku,
  name: t.name,
  qty: Number(t.qty) || 0,
  type: t.type,
  ref: t.ref || null,
  remarks: t.remarks || null,
  user_name: t.user
});

const mapDBIndentToUI = (i) => ({
  indentNo: i.indent_no,
  date: i.date,
  requestedBy: i.requested_by,
  department: i.department,
  sku: i.sku,
  name: i.name,
  currentStock: Number(i.current_stock) || 0,
  reorderQty: Number(i.reorder_qty) || 0,
  supplierName: i.supplier_name || '',
  status: i.status || 'Pending'
});

const mapUIIndentToDB = (i) => ({
  indent_no: i.indentNo,
  date: i.date,
  requested_by: i.requestedBy,
  department: i.department,
  sku: i.sku,
  name: i.name,
  current_stock: Number(i.currentStock) || 0,
  reorder_qty: Number(i.reorderQty) || 0,
  supplier_name: i.supplierName || null,
  status: i.status || 'Pending'
});

const mapDBSettingsToUI = (s) => ({
  pageSize: {
    master: s ? Number(s.page_size_master) : 6,
    txn: s ? Number(s.page_size_txn) : 6,
    stock: s ? Number(s.page_size_stock) : 6
  }
});

const mapUISettingsToDB = (s) => ({
  id: 1,
  page_size_master: s?.pageSize?.master || 6,
  page_size_txn: s?.pageSize?.txn || 6,
  page_size_stock: s?.pageSize?.stock || 6
});

const mapDBAuditToUI = (a) => ({
  ts: a.ts,
  action: a.action,
  user: a.user_name || '',
  detail: a.detail || ''
});

const mapUIAuditToDB = (a) => ({
  action: a.action,
  user_name: a.user,
  detail: a.detail
});

// Helper: Write Audit Log to DB
const writeAudit = async (action, user, detail) => {
  const dbAudit = mapUIAuditToDB({ action, user, detail });
  await supabase.from('inventory_audit').insert(dbAudit);
};

// Seed utility generator for local code reset trigger
function seedInitialData() {
  const materials = [
    { sku: 'SKU-1001', name: 'Steel Rod 12mm', category: 'Raw Material', subCategory: 'Metals', unit: 'KG', adc: 120, leadTime: 7, safetyFactor: 3, moq: 500, supplierName: 'Tata Steel', supplierCode: 'SUP-001', location: 'WH-A / Rack 1', opening: 1800, status: 'Active' },
    { sku: 'SKU-1002', name: 'Copper Wire 2.5mm', category: 'Raw Material', subCategory: 'Electricals', unit: 'MTR', adc: 300, leadTime: 5, safetyFactor: 4, moq: 1000, supplierName: 'Polycab', supplierCode: 'SUP-002', location: 'WH-A / Rack 4', opening: 4200, status: 'Active' },
    { sku: 'SKU-1003', name: 'Plastic Granules PP', category: 'Raw Material', subCategory: 'Polymers', unit: 'KG', adc: 80, leadTime: 10, safetyFactor: 2, moq: 300, supplierName: 'Reliance Polymers', supplierCode: 'SUP-003', location: 'WH-B / Rack 2', opening: 560, status: 'Active' },
    { sku: 'SKU-1004', name: 'Packaging Carton (L)', category: 'Packing Material', subCategory: 'Cartons', unit: 'PCS', adc: 450, leadTime: 4, safetyFactor: 3, moq: 2000, supplierName: 'Indo Pack', supplierCode: 'SUP-004', location: 'WH-C / Rack 1', opening: 1200, status: 'Active' },
    { sku: 'SKU-1005', name: 'Industrial Bearings 6204', category: 'Components', subCategory: 'Mechanical', unit: 'PCS', adc: 25, leadTime: 14, safetyFactor: 5, moq: 200, supplierName: 'SKF India', supplierCode: 'SUP-005', location: 'WH-A / Rack 7', opening: 90, status: 'Active' },
    { sku: 'SKU-1006', name: 'Lubricant Oil 20L', category: 'Consumables', subCategory: 'Maintenance', unit: 'LTR', adc: 15, leadTime: 6, safetyFactor: 2, moq: 100, supplierName: 'Castrol', supplierCode: 'SUP-006', location: 'WH-B / Rack 5', opening: 340, status: 'Active' },
    { sku: 'SKU-1007', name: 'Stainless Sheet 2mm', category: 'Raw Material', subCategory: 'Metals', unit: 'KG', adc: 60, leadTime: 9, safetyFactor: 3, moq: 400, supplierName: 'Jindal Steel', supplierCode: 'SUP-007', location: 'WH-A / Rack 2', opening: 75, status: 'Active' },
    { sku: 'SKU-1008', name: 'Cardboard Box (S)', category: 'Packing Material', subCategory: 'Cartons', unit: 'PCS', adc: 600, leadTime: 3, safetyFactor: 3, moq: 2500, supplierName: 'Indo Pack', supplierCode: 'SUP-004', location: 'WH-C / Rack 2', opening: 5400, status: 'Active' },
    { sku: 'SKU-1009', name: 'Hydraulic Hose 1in', category: 'Components', subCategory: 'Mechanical', unit: 'MTR', adc: 18, leadTime: 12, safetyFactor: 4, moq: 150, supplierName: 'Parker Hannifin', supplierCode: 'SUP-008', location: 'WH-A / Rack 9', opening: 40, status: 'Active' },
    { sku: 'SKU-1010', name: 'LED Driver 24V', category: 'Electronics', subCategory: 'Power', unit: 'PCS', adc: 35, leadTime: 8, safetyFactor: 3, moq: 300, supplierName: 'Philips', supplierCode: 'SUP-009', location: 'WH-D / Rack 1', opening: 0, status: 'Inactive' },
  ];

  const transactions = [];
  let txnSeq = 1;
  const days = 30;

  materials.forEach(m => {
    // Add consumption transactions
    for (let d = days; d >= 1; d -= Math.ceil(days / 6)) {
      const date = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
      transactions.push({
        id: 'TXN-' + String(txnSeq++).padStart(5, '0'),
        date,
        sku: m.sku,
        name: m.name,
        qty: Math.round(m.adc * 1.6 * (0.7 + Math.random() * 0.6)),
        type: 'OUT',
        ref: 'WO-' + Math.floor(1000 + Math.random() * 9000),
        remarks: 'Production consumption',
        user: 'Priya Sharma'
      });
    }
    // Add restock transactions
    transactions.push({
      id: 'TXN-' + String(txnSeq++).padStart(5, '0'),
      date: new Date(Date.now() - 18 * 86400000).toISOString().slice(0, 10),
      sku: m.sku,
      name: m.name,
      qty: Math.round(m.moq * 0.5),
      type: 'IN',
      ref: 'GRN-' + Math.floor(1000 + Math.random() * 9000),
      remarks: 'Goods received from supplier',
      user: 'Arjun Mehta'
    });
  });

  return {
    materials,
    transactions,
    settings: { pageSize: { master: 6, txn: 6, stock: 6 } },
    units: defaultUnits,
    locations: defaultLocations
  };
}

// ------------------------------------------
// API ENDPOINTS CONNECTING FRONTEND TO SUPABASE
// ------------------------------------------

export const fetchInventoryDataApi = async () => {
  try {
    const [
      resMaterials,
      resTransactions,
      resIndents,
      resUnits,
      resLocations,
      resSettings,
      resUsers,
      resAudit
    ] = await Promise.all([
      supabase.from('inventory_materials').select('*'),
      supabase.from('inventory_transactions').select('*'),
      supabase.from('inventory_indents').select('*'),
      supabase.from('inventory_units').select('unit'),
      supabase.from('inventory_locations').select('location'),
      supabase.from('inventory_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('users').select('*'),
      supabase.from('inventory_audit').select('*').order('ts', { ascending: false }).limit(300)
    ]);

    const errors = [
      resMaterials.error,
      resTransactions.error,
      resIndents.error,
      resUnits.error,
      resLocations.error,
      resSettings.error,
      resUsers.error,
      resAudit.error
    ].filter(Boolean);

    if (errors.length > 0) {
      throw new Error(errors.map(e => e.message).join(' | '));
    }

    const units = resUnits.data && resUnits.data.length > 0 ? resUnits.data.map(r => r.unit) : defaultUnits;
    const locations = resLocations.data && resLocations.data.length > 0 ? resLocations.data.map(r => r.location) : defaultLocations;
    const settings = resSettings.data ? mapDBSettingsToUI(resSettings.data) : { pageSize: { master: 6, txn: 6, stock: 6 } };

    let materialNames = defaultMaterialNames;
    const local = localStorage.getItem('sp_custom_material_names');
    if (local) {
      try {
        materialNames = JSON.parse(local);
      } catch (e) {}
    }

    return {
      data: {
        materials: (resMaterials.data || []).map(mapDBMaterialToUI),
        transactions: (resTransactions.data || []).map(mapDBTxnToUI),
        indents: (resIndents.data || []).map(mapDBIndentToUI),
        units,
        locations,
        materialNames,
        settings,
        users: (resUsers.data || []).map(mapDBUserToUI),
        audit: (resAudit.data || []).map(mapDBAuditToUI)
      },
      error: null
    };
  } catch (err) {
    console.error("fetchInventoryDataApi failed", err);
    return { data: null, error: err.message };
  }
};

export const saveMaterialApi = async (materialData, currentUser = 'Admin') => {
  try {
    const dbMaterial = mapUIMaterialToDB(materialData);
    const existing = await supabase.from('inventory_materials').select('opening').eq('sku', materialData.sku).maybeSingle();

    if (existing.data) {
      dbMaterial.opening = existing.data.opening;
    }

    const { error } = await supabase.from('inventory_materials').upsert(dbMaterial);
    if (error) throw new Error(error.message);

    const action = existing.data ? 'Material updated' : 'Material created';
    const detail = existing.data 
      ? `SKU ${materialData.sku} master data edited.`
      : `New SKU ${materialData.sku} (${materialData.name}) added.`;
    await writeAudit(action, currentUser, detail);

    return await fetchInventoryDataApi();
  } catch (err) {
    console.error("saveMaterialApi failed", err);
    return { data: null, error: err.message };
  }
};

export const deleteMaterialApi = async (sku, currentUser = 'Admin') => {
  try {
    const { error } = await supabase.from('inventory_materials').delete().eq('sku', sku);
    if (error) throw new Error(error.message);

    await writeAudit('Material deleted', currentUser, `SKU ${sku} removed from master data.`);
    return await fetchInventoryDataApi();
  } catch (err) {
    console.error("deleteMaterialApi failed", err);
    return { data: null, error: err.message };
  }
};

export const postTransactionApi = async (transactionData, currentUser = 'Admin') => {
  try {
    const { data: lastTxn, error: queryErr } = await supabase
      .from('inventory_transactions')
      .select('id')
      .order('id', { ascending: false })
      .limit(1);

    if (queryErr) throw new Error(queryErr.message);

    let nextNum = 1;
    if (lastTxn && lastTxn.length > 0) {
      const lastId = lastTxn[0].id;
      const match = lastId.match(/TXN-(\d+)/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    const nextTxnId = 'TXN-' + String(nextNum).padStart(5, '0');

    const dbTxn = mapUITxnToDB({
      ...transactionData,
      id: nextTxnId
    });

    const { error } = await supabase.from('inventory_transactions').insert(dbTxn);
    if (error) throw new Error(error.message);

    const detail = `${dbTxn.type} ${dbTxn.qty} of SKU ${dbTxn.sku} (${dbTxn.name}) — ${dbTxn.id}`;
    await writeAudit('Transaction posted', currentUser, detail);

    return await fetchInventoryDataApi();
  } catch (err) {
    console.error("postTransactionApi failed", err);
    return { data: null, error: err.message };
  }
};

export const createIndentsApi = async (indentItems, requestedBy, department, currentUser = 'Admin') => {
  try {
    const { data: lastIndent, error: queryErr } = await supabase
      .from('inventory_indents')
      .select('indent_no')
      .order('indent_no', { ascending: false })
      .limit(1);

    if (queryErr) throw new Error(queryErr.message);

    let nextSeq = 1;
    if (lastIndent && lastIndent.length > 0) {
      const lastId = lastIndent[0].indent_no;
      const match = lastId.match(/IND-(\d+)/);
      if (match) {
        nextSeq = parseInt(match[1], 10) + 1;
      }
    }

    const dbIndents = [];
    const created = [];

    indentItems.forEach(item => {
      const indentNo = 'IND-' + String(nextSeq++).padStart(4, '0');
      const newIndent = {
        indentNo,
        date: today(),
        requestedBy,
        department,
        sku: item.sku,
        name: item.name,
        closingStock: item.closingStock,
        reorderQty: item.reorderQty,
        supplierName: item.supplierName || '—',
        status: 'Pending'
      };
      dbIndents.push(mapUIIndentToDB(newIndent));
      created.push(newIndent);
    });

    const { error } = await supabase.from('inventory_indents').insert(dbIndents);
    if (error) throw new Error(error.message);

    const detail = `${created.length} indent(s) created by ${requestedBy} for ${department}.`;
    await writeAudit('Indent(s) generated', currentUser, detail);

    return await fetchInventoryDataApi();
  } catch (err) {
    console.error("createIndentsApi failed", err);
    return { data: null, error: err.message };
  }
};

export const updateIndentStatusApi = async (indentNo, status, currentUser = 'Admin') => {
  try {
    const { error } = await supabase
      .from('inventory_indents')
      .update({ status })
      .eq('indent_no', indentNo);

    if (error) throw new Error(error.message);

    await writeAudit('Indent status updated', currentUser, `${indentNo} marked as "${status}".`);
    return await fetchInventoryDataApi();
  } catch (err) {
    console.error("updateIndentStatusApi failed", err);
    return { data: null, error: err.message };
  }
};

export const saveSettingsApi = async (settings, currentUser = 'Admin') => {
  try {
    const dbSettings = mapUISettingsToDB(settings);
    const { error } = await supabase.from('inventory_settings').upsert(dbSettings);
    if (error) throw new Error(error.message);

    await writeAudit('Settings updated', currentUser, 'Pagination preferences changed.');
    return await fetchInventoryDataApi();
  } catch (err) {
    console.error("saveSettingsApi failed", err);
    return { data: null, error: err.message };
  }
};

export const saveListApi = async (type, newList, currentUser = 'Admin') => {
  try {
    if (type === 'units') {
      const { error: delError } = await supabase.from('inventory_units').delete().neq('id', 0);
      if (delError) throw new Error(delError.message);

      if (newList.length > 0) {
        const { error: insError } = await supabase
          .from('inventory_units')
          .insert(newList.map(u => ({ unit: u })));
        if (insError) throw new Error(insError.message);
      }
      await writeAudit('Units list updated', currentUser, `Custom units list saved.`);
    } else if (type === 'locations') {
      const { error: delError } = await supabase.from('inventory_locations').delete().neq('id', 0);
      if (delError) throw new Error(delError.message);

      if (newList.length > 0) {
        const { error: insError } = await supabase
          .from('inventory_locations')
          .insert(newList.map(l => ({ location: l })));
        if (insError) throw new Error(insError.message);
      }
      await writeAudit('Locations list updated', currentUser, `Custom locations list saved.`);
    } else if (type === 'materialNames') {
      localStorage.setItem('sp_custom_material_names', JSON.stringify(newList));
      await writeAudit('Material names list updated', currentUser, `Custom material names list saved.`);
    }

    return await fetchInventoryDataApi();
  } catch (err) {
    console.error("saveListApi failed", err);
    return { data: null, error: err.message };
  }
};

export const saveUsersApi = async (users, currentUser = 'Admin') => {
  try {
    const dbUsers = users.map(mapUIUserToDB);

    const { data: dbCurrent, error: queryErr } = await supabase.from('users').select('user_name');
    if (queryErr) throw new Error(queryErr.message);

    const currentNames = dbCurrent ? dbCurrent.map(u => u.user_name) : [];
    const newNames = dbUsers.map(u => u.user_name.toLowerCase());
    const toDelete = currentNames.filter(name => name && !newNames.includes(name.toLowerCase()));

    if (toDelete.length > 0) {
      const { error: delError } = await supabase
        .from('users')
        .delete()
        .in('user_name', toDelete);
      if (delError) throw new Error(delError.message);
    }

    for (const user of dbUsers) {
      if (!user.user_name) continue;
      const { data: existing, error: findErr } = await supabase
        .from('users')
        .select('id')
        .eq('user_name', user.user_name)
        .maybeSingle();

      if (findErr) throw new Error(findErr.message);

      if (existing) {
        const { error: updErr } = await supabase
          .from('users')
          .update(user)
          .eq('id', existing.id);
        if (updErr) throw new Error(updErr.message);
      } else {
        const { error: insErr } = await supabase
          .from('users')
          .insert(user);
        if (insErr) throw new Error(insErr.message);
      }
    }

    await writeAudit('Users updated', currentUser, 'User accounts updated.');
    return await fetchInventoryDataApi();
  } catch (err) {
    console.error("saveUsersApi failed", err);
    return { data: null, error: err.message };
  }
};

export const logAuditApi = async (action, detail, currentUser = 'Admin') => {
  try {
    await writeAudit(action, currentUser, detail);
    return await fetchInventoryDataApi();
  } catch (err) {
    console.error("logAuditApi failed", err);
    return { data: null, error: err.message };
  }
};

export const resetToDummyDataApi = async (currentUser = 'Admin') => {
  try {
    // Delete all records from all tables
    await Promise.all([
      supabase.from('inventory_materials').delete().neq('sku', ''),
      supabase.from('inventory_transactions').delete().neq('id', ''),
      supabase.from('inventory_indents').delete().neq('indent_no', ''),
      supabase.from('inventory_units').delete().neq('id', 0),
      supabase.from('inventory_locations').delete().neq('id', 0),
      supabase.from('inventory_settings').delete().neq('id', 0),
      supabase.from('inventory_audit').delete().neq('id', 0)
    ]);

    const fresh = seedInitialData();

    // 1. Save materials
    const dbMaterials = fresh.materials.map(mapUIMaterialToDB);
    const { error: matErr } = await supabase.from('inventory_materials').insert(dbMaterials);
    if (matErr) throw new Error(matErr.message);

    // 2. Save transactions
    const dbTxns = fresh.transactions.map(mapUITxnToDB);
    const { error: txnErr } = await supabase.from('inventory_transactions').insert(dbTxns);
    if (txnErr) throw new Error(txnErr.message);

    // 3. Save units
    const { error: unitErr } = await supabase.from('inventory_units').insert(fresh.units.map(u => ({ unit: u })));
    if (unitErr) throw new Error(unitErr.message);

    // 4. Save locations
    const { error: locErr } = await supabase.from('inventory_locations').insert(fresh.locations.map(l => ({ location: l })));
    if (locErr) throw new Error(locErr.message);

    // 5. Save settings
    const dbSettings = mapUISettingsToDB(fresh.settings);
    const { error: setErr } = await supabase.from('inventory_settings').insert(dbSettings);
    if (setErr) throw new Error(setErr.message);

    // 6. Write database reset audit log
    await writeAudit('Database Reset', currentUser, 'All tables reset to system default dummy seed configuration.');

    return await fetchInventoryDataApi();
  } catch (err) {
    console.error("resetToDummyDataApi failed", err);
    return { data: null, error: err.message };
  }
};
