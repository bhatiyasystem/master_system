import { parseAttendanceTable } from './parseHtml.js';

/**
 * @param {import('axios').AxiosInstance} client authenticated client from login()
 * @param {{ day: number, month: number, year: number, status?: string }} params
 */
export async function fetchAttendanceLog(client, { day, month, year, status = 'All' }) {
  const pad = (n) => String(n).padStart(2, '0');
  const response = await client.get('/iclock/Manage/AttendenceLog.aspx', {
    params: {
      Day: pad(day),
      Month: pad(month),
      Year: year,
      Status: status,
    },
    headers: {
      Referer: `${client.defaults.baseURL}/iclock/Default.aspx`,
    },
  });

  return parseAttendanceTable(response.data);
}
