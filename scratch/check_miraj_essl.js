import { login } from '../attendance/auth.js';
import { fetchAttendanceLog } from '../attendance/fetchAttendance.js';

async function main() {
  console.log('Logging into eSSL portal...');
  const client = await login();
  console.log('Login successful! Fetching logs for September 2026 (Days 1-30)...');

  const allMatches = [];

  for (let day = 1; day <= 30; day++) {
    try {
      const res = await fetchAttendanceLog(client, { day, month: 9, year: 2026, status: 'All' });
      const mirajRows = res.rows.filter(r => {
        const str = JSON.stringify(r).toLowerCase();
        return str.includes('anjani') || str.includes('615481196122') || str.includes('miraj');
      });

      if (mirajRows.length > 0) {
        console.log(`[Day ${day}]: Found ${mirajRows.length} row(s) for Anjani Miraj:`, mirajRows);
        allMatches.push({ day, rows: mirajRows });
      } else {
        console.log(`[Day ${day}]: No record for Anjani Miraj. (Total employees in portal for day: ${res.rows.length})`);
      }
    } catch (err) {
      console.error(`[Day ${day}] Error:`, err.message);
    }
  }

  console.log('\n================== FINAL REPORT: ESSL PAYLOAD FOR ANJANI MIRAJ ==================');
  console.log(JSON.stringify(allMatches, null, 2));
}

main().catch(console.error);
