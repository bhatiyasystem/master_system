const masterUrl = 'https://sffvmdjtaxkfusgvgjbf.supabase.co';
const masterKey = 'sb_publishable_d08mS6BZwdJgaAuC2deEFg_4TBm0GcS';

const fieldsToCopy = [
  'item_details',
  'online_item_name',
  'vendor',
  'category',
  'unit',
  'parent_group',
  'shelf_capacity',
  'max_level_qty',
  'rol_qty',
  'reorder_level',
  'order_formula',
  'min_order_qty',
  'eligible_for_online',
  'variant_available',
  'image_url',
  'item_description'
];

async function fetchAll(table, select = '*') {
  let all = [];
  let from = 0;
  while (true) {
    const res = await fetch(`${masterUrl}/rest/v1/${table}?select=${select}&limit=1000&offset=${from}`, {
      headers: { 'apikey': masterKey, 'Authorization': 'Bearer ' + masterKey }
    });
    const d = await res.json();
    if (!d || d.length === 0) break;
    all.push(...d);
    if (d.length < 1000) break;
    from += 1000;
  }
  return all;
}

async function sync() {
  console.log('Fetching master items...');
  const existingMaster = await fetchAll('purchase_master_items', 'item_details');
  const existingNames = new Set(existingMaster.map(m => String(m.item_details || '').trim().toLowerCase()));
  console.log(`Existing master items count: ${existingNames.size}`);

  console.log('Fetching purchase indents...');
  const indents = await fetchAll('purchase_indents', '*');
  console.log(`Total indents: ${indents.length}`);

  const toInsert = [];
  const seenNew = new Set();

  indents.forEach(row => {
    const name = String(row.item_details || '').trim();
    const norm = name.toLowerCase();
    if (!name || norm === 'test' || norm === 'test1' || row.hide_in_master === true) return;
    if (!existingNames.has(norm) && !seenNew.has(norm)) {
      seenNew.add(norm);
      const item = {};
      fieldsToCopy.forEach(k => {
        if (row[k] !== undefined) item[k] = row[k];
      });
      // defaults
      if (!item.eligible_for_online) item.eligible_for_online = 'No';
      if (!item.variant_available) item.variant_available = 'No';
      toInsert.push(item);
    }
  });

  console.log(`Items to sync into purchase_master_items: ${toInsert.length}`);
  if (toInsert.length > 0) {
    toInsert.forEach(t => console.log('  ->', t.item_details, '|', t.vendor));
    const res = await fetch(`${masterUrl}/rest/v1/purchase_master_items`, {
      method: 'POST',
      headers: {
        'apikey': masterKey,
        'Authorization': 'Bearer ' + masterKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(toInsert)
    });
    console.log('Insert status:', res.status);
    const result = await res.json();
    console.log(`Successfully synced ${Array.isArray(result) ? result.length : 0} items into purchase_master_items.`);
  }

  // Final count
  const finalMaster = await fetchAll('purchase_master_items', 'id');
  console.log(`Final purchase_master_items count: ${finalMaster.length}`);
}

sync().catch(console.error);
