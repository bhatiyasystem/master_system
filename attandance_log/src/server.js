import express from 'express';
import { login } from './auth.js';
import { fetchAttendanceLog } from './fetchAttendance.js';

const app = express();
const PORT = process.env.PORT || 3000;

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

app.listen(PORT, () => {
  console.log(`Attendance API running at http://localhost:${PORT}/api/attendance`);
});
