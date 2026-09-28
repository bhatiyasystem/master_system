const masterUrl = 'https://sffvmdjtaxkfusgvgjbf.supabase.co';
const masterKey = 'sb_publishable_d08mS6BZwdJgaAuC2deEFg_4TBm0GcS';

async function fetchAllRows(table, select = '*') {
  let all = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const url = `${masterUrl}/rest/v1/${table}?select=${select}&limit=${pageSize}&offset=${from}`;
    const res = await fetch(url, {
      headers: {
        'apikey': masterKey,
        'Authorization': 'Bearer ' + masterKey,
        'Range': `${from}-${from + pageSize - 1}`,
        'Prefer': 'count=exact'
      }
    });
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function detailedStats() {
  const indents = await fetchAllRows('purchase_indents', 'id,unique_no,item_details,status,hide_in_master,category,vendor,po_no,order_formula,created_at');
  
  const vendorCounts = {};
  const categoryCounts = {};
  const statusCounts = {};
  const poCounts = {};
  let withOrderFormula = 0;
  let nonZeroFormula = 0;

  indents.forEach(r => {
    statusCounts[r.status || 'Pending'] = (statusCounts[r.status || 'Pending'] || 0) + 1;
    if (r.vendor) vendorCounts[r.vendor] = (vendorCounts[r.vendor] || 0) + 1;
    if (r.category) categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1;
    if (r.po_no) poCounts[r.po_no] = (poCounts[r.po_no] || 0) + 1;
    if (r.order_formula) {
      withOrderFormula++;
      if (r.order_formula !== '0') nonZeroFormula++;
    }
  });

  console.log('Total indents:', indents.length);
  console.log('Statuses:', statusCounts);
  console.log('Top 5 Vendors:', Object.entries(vendorCounts).sort((a,b) => b[1] - a[1]).slice(0, 5));
  console.log('Top 5 Categories:', Object.entries(categoryCounts).sort((a,b) => b[1] - a[1]).slice(0, 5));
  console.log('PO Numbers created:', poCounts);
  console.log('With order formula:', withOrderFormula, 'Non-zero formula:', nonZeroFormula);
}

detailedStats().catch(console.error);
