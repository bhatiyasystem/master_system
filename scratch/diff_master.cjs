const masterUrl = 'https://sffvmdjtaxkfusgvgjbf.supabase.co';
const masterKey = 'sb_publishable_d08mS6BZwdJgaAuC2deEFg_4TBm0GcS';

async function fetchAll(table, select) {
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

async function diff() {
  const indents = await fetchAll('purchase_indents', 'item_details,created_at,hide_in_master');
  const master = await fetchAll('purchase_master_items', 'item_details,created_at');

  const masterSet = new Set(master.map(m => String(m.item_details || '').trim().toLowerCase()));
  const indentMap = new Map();
  indents.forEach(i => {
    const norm = String(i.item_details || '').trim().toLowerCase();
    if (norm) {
      if (!indentMap.has(norm)) indentMap.set(norm, []);
      indentMap.get(norm).push(i);
    }
  });

  console.log('Total unique items in indents:', indentMap.size);
  console.log('Total unique items in master:', masterSet.size);

  const extraInIndents = [];
  for (const [norm, rows] of indentMap.entries()) {
    if (!masterSet.has(norm)) {
      extraInIndents.push({ name: rows[0].item_details, count: rows.length, created: rows[0].created_at, hidden: rows[0].hide_in_master });
    }
  }
  console.log('Items in purchase_indents that are NOT in purchase_master_items (' + extraInIndents.length + '):');
  console.log(extraInIndents);

  const extraInMaster = [];
  for (const norm of masterSet) {
    if (!indentMap.has(norm)) {
      extraInMaster.push(norm);
    }
  }
  console.log('Items in purchase_master_items that are NOT in purchase_indents (' + extraInMaster.length + '):');
  console.log(extraInMaster);
}
diff().catch(console.error);
