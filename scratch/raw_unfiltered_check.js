import { login } from '../attendance/auth.js';
import * as cheerio from 'cheerio';
import { parseAttendanceTable } from '../attendance/parseHtml.js';

async function fetchRawDay(client, day, month, year) {
  const pad = (n) => String(n).padStart(2, '0');
  const url = `/iclock/Manage/AttendenceLog.aspx?Day=${pad(day)}&Month=${pad(month)}&Year=${year}&Status=All`;
  const res = await client.get(url, {
    headers: {
      Referer: `${client.defaults.baseURL}/iclock/Default.aspx`,
    },
  });

  const parsed = parseAttendanceTable(res.data);
  const allRows = [...parsed.rows];

  // Check pagination
  const $ = cheerio.load(res.data);
  const baseFormData = {};
  $('input').each((_, el) => {
    const name = $(el).attr('name');
    const val = $(el).attr('value');
    if (name) baseFormData[name] = val || '';
  });
  $('select').each((_, el) => {
    const name = $(el).attr('name');
    const val = $(el).find('option[selected]').attr('value') || $(el).find('option').first().attr('value');
    if (name) baseFormData[name] = val || '';
  });

  delete baseFormData['btnUpdate'];
  delete baseFormData['btn_AddManualPunch'];
  delete baseFormData['btn_recalculate'];
  delete baseFormData['btn_UpdateRemarks'];

  const pageSelectorKey = Object.keys(baseFormData).find(k => k.endsWith('PageSelector'));
  const totalRecordsKey = Object.keys(baseFormData).find(k => k.endsWith('TotalRecords'));
  const totalRecords = parseInt(baseFormData[totalRecordsKey] || '0', 10);

  if (totalRecords > 10 && pageSelectorKey) {
    const totalPages = Math.ceil(totalRecords / 10);
    for (let page = 1; page < totalPages; page++) {
      const formData = { ...baseFormData };
      formData[pageSelectorKey] = String(page);
      formData['__EVENTTARGET'] = '';
      formData['__EVENTARGUMENT'] = '';

      const body = new URLSearchParams(formData);
      const postResponse = await client.post(url, body.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Referer: `${client.defaults.baseURL}${url}`,
        },
      });

      const pageResult = parseAttendanceTable(postResponse.data);
      allRows.push(...pageResult.rows);

      const $postPage = cheerio.load(postResponse.data);
      baseFormData['__VIEWSTATE'] = $postPage('#__VIEWSTATE').attr('value') || baseFormData['__VIEWSTATE'];
      baseFormData['__VIEWSTATEGENERATOR'] = $postPage('#__VIEWSTATEGENERATOR').attr('value') || baseFormData['__VIEWSTATEGENERATOR'];
    }
  }

  return { totalRecords, rows: allRows };
}

async function run() {
  console.log('Connecting and logging into eSSL Web Portal...');
  const client = await login();
  console.log('Logged in successfully!');

  console.log('\n========================================================================');
  console.log('1. RAW UNFILTERED ESSL CHECK FOR ANJANI MIRAJ (SEP 1-7, 2026)');
  console.log('========================================================================');

  for (let day = 1; day <= 7; day++) {
    const { totalRecords, rows } = await fetchRawDay(client, day, 9, 2026);
    console.log(`\n--- Day ${day}/09/2026 (Total Portal Records: ${totalRecords || rows.length}) ---`);
    const matches = rows.filter(r => JSON.stringify(r).toLowerCase().includes('anjani') || JSON.stringify(r).includes('615481196122'));
    if (matches.length > 0) {
      console.log(`FOUND ${matches.length} MATCH:`, JSON.stringify(matches, null, 2));
    } else {
      console.log(`No match for Anjani Miraj on day ${day}. Sample 2 rows from portal:`, rows.slice(0, 2));
    }
  }

  console.log('\n========================================================================');
  console.log('2. CHECKING IF ANJANI MIRAJ APPEARS ANYWHERE IN AUGUST 2026 (MONTH 8)');
  console.log('========================================================================');
  let augFound = 0;
  for (let day = 1; day <= 31; day++) {
    const { rows } = await fetchRawDay(client, day, 8, 2026);
    const matches = rows.filter(r => JSON.stringify(r).toLowerCase().includes('anjani') || JSON.stringify(r).includes('615481196122'));
    if (matches.length > 0) {
      augFound++;
      console.log(`Aug Day ${day}:`, matches);
    }
  }
  if (augFound === 0) console.log('No matches in August 2026 either.');

  console.log('\n========================================================================');
  console.log('3. CHECKING ALL DISTINCT EMPLOYEES PRESENT ON ESSL PORTAL RIGHT NOW');
  console.log('========================================================================');
  const { rows: todayRows } = await fetchRawDay(client, 1, 9, 2026);
  console.log(`Total 41 Employees on portal:`);
  todayRows.forEach((r, idx) => {
    console.log(`${idx + 1}. [${r['Emp Code']}] ${r['Emp Name']} - Status: ${r['Status']} (In: ${r['InTime'] || '—'}, Out: ${r['OutTime'] || '—'})`);
  });
}

run().catch(console.error);
