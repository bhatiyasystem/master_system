import * as cheerio from 'cheerio';

function cellText($, el) {
  return $(el).text().replace(/\s+/g, ' ').trim();
}

function uniqueKey(base, seen) {
  let key = base || 'column';
  let i = 2;
  while (seen.has(key)) {
    key = `${base}_${i}`;
    i += 1;
  }
  seen.add(key);
  return key;
}

/**
 * The portal renders its grids with the "obout Grid" ASP.NET control
 * (id prefix like dg_EmployeeAttendeanceLogs), not a plain HTML table:
 *  - header cell text lives in elements with class "ob_gCH"
 *  - each data row is a <tr> containing one <td class="ob_gC"> per column
 *  - each cell's display text lives in a nested ".ob_gRC" element
 * The header row includes one extra leading entry for the row-select
 * checkbox column, which has no corresponding data cell, so headers are
 * aligned to data cells from the right-hand side.
 */
export function parseAttendanceTable(html) {
  const $ = cheerio.load(html);

  const rawHeaders = $('.ob_gCH').map((_, el) => cellText($, el)).toArray();

  const rowEls = new Set();
  $('td.ob_gC').each((_, td) => {
    rowEls.add($(td).closest('tr')[0]);
  });

  const dataRows = [];
  for (const tr of rowEls) {
    const cellValues = $(tr)
      .find('td.ob_gC')
      .map((_, td) => cellText($, $(td).find('.ob_gRC').first()))
      .toArray();
    if (cellValues.length === 0) continue;

    const alignedHeaders = rawHeaders.slice(Math.max(0, rawHeaders.length - cellValues.length));
    const seen = new Set();
    const record = {};
    cellValues.forEach((value, i) => {
      const key = uniqueKey(alignedHeaders[i] || `column_${i + 1}`, seen);
      record[key] = value;
    });
    dataRows.push(record);
  }

  const headers = dataRows.length > 0 ? Object.keys(dataRows[0]) : [];
  return { headers, rows: dataRows };
}
