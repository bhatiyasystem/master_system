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

function parseDateParam(value, label) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`"${label}" must be in YYYY-MM-DD format, got "${value}".`);
  }
  const [, year, month, day] = match;
  return { year: Number(year), month: Number(month), day: Number(day) };
}

function toUtcDate({ year, month, day }) {
  return new Date(Date.UTC(year, month - 1, day));
}

function fromUtcDate(date) {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The portal only exposes a single "From" date on AttendenceLog.aspx — there
 * is no server-side date-range query. To cover a range, this fetches every
 * day in [from, to] one at a time and concatenates the rows.
 *
 * @param {import('axios').AxiosInstance} client authenticated client from login()
 * @param {{ from: string, to: string, status?: string }} params from/to as YYYY-MM-DD
 */
export async function fetchAttendanceRange(client, { from, to, status = 'All' }) {
  const start = toUtcDate(parseDateParam(from, 'from'));
  const end = toUtcDate(parseDateParam(to, 'to'));
  if (start > end) {
    throw new Error('"from" date must not be after "to" date.');
  }

  const rows = [];
  let headers = [];
  for (let cursor = start; cursor <= end; cursor = new Date(cursor.getTime() + ONE_DAY_MS)) {
    const { year, month, day } = fromUtcDate(cursor);
    const result = await fetchAttendanceLog(client, { day, month, year, status });
    if (result.headers.length > headers.length) headers = result.headers;
    rows.push(...result.rows);
  }
  return { headers, rows };
}
