import { login } from '../attendance/auth.js';
import { fetchAttendanceLog } from '../attendance/fetchAttendance.js';

async function check() {
  const client = await login();
  console.log('Logged into portal. Checking months 1 to 12 in 2026:');
  for (let m = 1; m <= 12; m++) {
    try {
      const res = await fetchAttendanceLog(client, { day: 1, month: m, year: 2026, status: 'All' });
      console.log(`Month ${m}/2026 (Day 1): ${res.rows.length} rows`);
    } catch (e) {
      console.log(`Month ${m}/2026 Error: ${e.message}`);
    }
  }
}

check().catch(console.error);
