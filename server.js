import express from "express";
import axios from "axios";
import cors from "cors";
import { login as getAuthenticatedClient } from "./Attendance_log/src/auth.js";
import { fetchAttendanceLog, fetchAttendanceRange, fetchAttendanceWithoutFilter } from "./Attendance_log/src/fetchAttendance.js";

const app = express();
app.use(cors());
app.use(express.json());

async function runWithAuth(fn) {
  try {
    const client = await getAuthenticatedClient();
    return await fn(client);
  } catch (err) {
    console.warn('Request failed, retrying with fresh authentication...', err.message);
    const client = await getAuthenticatedClient(true);
    return await fn(client);
  }
}

app.get("/api/health", async (_req, res) => {
  try {
    const response = await axios.get("https://script.google.com/a/macros/botivate.in/s/AKfycbxjYYdBHyeK1n65Er6c76ymzKvBvZr8ixit2_OUTRA/dev");
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/attendance', async (req, res) => {
  const today = new Date();
  const day = Number(req.query.day ?? today.getDate());
  const month = Number(req.query.month ?? today.getMonth() + 1);
  const year = Number(req.query.year ?? today.getFullYear());
  const status = req.query.status ?? 'All';

  try {
    const { rows } = await runWithAuth((client) =>
      fetchAttendanceLog(client, { day, month, year, status })
    );
    res.json({ day, month, year, status, count: rows.length, rows });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/attendance/without-filter', async (req, res) => {
  const today = new Date();
  const day = Number(req.query.day ?? today.getDate());
  const month = Number(req.query.month ?? today.getMonth() + 1);
  const year = Number(req.query.year ?? today.getFullYear());

  try {
    const { rows } = await runWithAuth((client) =>
      fetchAttendanceWithoutFilter(client, { day, month, year })
    );
    res.json({ day, month, year, count: rows.length, rows });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});


app.get('/api/attendance/range', async (req, res) => {
  const pad = (n) => String(n).padStart(2, '0');
  const today = new Date();
  const defaultFrom = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`;
  const defaultTo = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const from = req.query.from || defaultFrom;
  const to = req.query.to || defaultTo;
  const status = req.query.status ?? 'All';

  try {
    const { rows } = await runWithAuth((client) =>
      fetchAttendanceRange(client, { from, to, status })
    );
    res.json({ from, to, status, count: rows.length, rows });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Attendance API running on port ${PORT}`);
});

