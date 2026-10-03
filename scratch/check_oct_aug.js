import { login } from '../attendance/auth.js';
import { fetchAttendanceLog } from '../attendance/fetchAttendance.js';

async function main() {
  console.log('Logging into eSSL portal...');
  const client = await login();
  console.log('Login successful! Checking eSSL portal for Anjani Miraj across multiple months/dates...\n');

  // Check October 2026
  console.log('--- OCTOBER 2026 ---');
  for (let day = 1; day <= 31; day++) {
    try {
      const res = await fetchAttendanceLog(client, { day, month: 10, year: 2026, status: 'All' });
      const mirajRows = res.rows.filter(r => {
        const str = JSON.stringify(r).toLowerCase();
        return str.includes('anjani') || str.includes('615481196122') || str.includes('miraj');
      });
      if (mirajRows.length > 0) {
        console.log(`[Oct Day ${day}]:`, mirajRows.map(r => ({
          code: r['Emp Code'],
          name: r['Emp Name'],
          status: r['Status'],
          in: r['InTime'],
          out: r['OutTime'],
          shift: r['Shift']
        })));
      }
    } catch (e) {
      // ignore
    }
  }

  // Check August 2026
  console.log('\n--- AUGUST 2026 ---');
  for (let day = 1; day <= 31; day++) {
    try {
      const res = await fetchAttendanceLog(client, { day, month: 8, year: 2026, status: 'All' });
      const mirajRows = res.rows.filter(r => {
        const str = JSON.stringify(r).toLowerCase();
        return str.includes('anjani') || str.includes('615481196122') || str.includes('miraj');
      });
      if (mirajRows.length > 0) {
        console.log(`[Aug Day ${day}]:`, mirajRows.map(r => ({
          code: r['Emp Code'],
          name: r['Emp Name'],
          status: r['Status'],
          in: r['InTime'],
          out: r['OutTime'],
          shift: r['Shift']
        })));
      }
    } catch (e) {
      // ignore
    }
  }
}

main().catch(console.error);
