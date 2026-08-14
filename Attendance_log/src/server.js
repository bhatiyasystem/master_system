import express from 'express';
import cors from 'cors';
import { login } from './auth.js';
import { fetchAttendanceLog, fetchAttendanceRange } from './fetchAttendance.js';

const app = express();
app.use(cors());
const PORT = process.env.PORT || 5000;

app.get('/api/attendance', async (req, res) => {
  const today = new Date();
  const day = Number(req.query.day ?? today.getDate());
  const month = Number(req.query.month ?? today.getMonth() + 1);
  const year = Number(req.query.year ?? today.getFullYear());
  const status = req.query.status ?? 'All';

  try {
    const client = await login();
    const { rows } = await fetchAttendanceLog(client, { day, month, year, status });
    res.json({ day, month, year, status, count: rows.length, rows });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Date-range query, e.g. this month to today: GET /api/attendance/range
// or a specific span: GET /api/attendance/range?from=2026-08-01&to=2026-08-13
app.get('/api/attendance/range', async (req, res) => {
  const pad = (n) => String(n).padStart(2, '0');
  const today = new Date();
  const defaultFrom = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`;
  const defaultTo = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const from = req.query.from || defaultFrom;
  const to = req.query.to || defaultTo;
  const status = req.query.status ?? 'All';

  try {
    const client = await login();
    const { rows } = await fetchAttendanceRange(client, { from, to, status });
    res.json({ from, to, status, count: rows.length, rows });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Attendance API running on port ${PORT}`);
});
