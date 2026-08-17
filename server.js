import express from "express";
import axios from "axios";
import cors from "cors";
import { login as getAuthenticatedClient } from "./attendance/auth.js";
import { fetchAttendanceLog, fetchAttendanceRange, fetchAttendanceWithoutFilter } from "./attendance/fetchAttendance.js";

const app = express();
app.use(cors());
app.use(express.json());

let cachedClientPromise = null;

function getClient() {
  if (!cachedClientPromise) {
    cachedClientPromise = getAuthenticatedClient().catch(err => {
      cachedClientPromise = null;
      throw err;
    });
  }
  return cachedClientPromise;
}

async function runWithAuth(fn) {
  try {
    const client = await getClient();
    return await fn(client);
  } catch (err) {
    console.warn('Request failed, retrying with fresh authentication...', err.message);
    cachedClientPromise = null;
    const client = await getClient();
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

  if (isNaN(day) || day < 1 || day > 31) {
    return res.status(400).json({ error: "Invalid day. Must be between 1 and 31." });
  }
  if (isNaN(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: "Invalid month. Must be between 1 and 12." });
  }
  if (isNaN(year) || year < 2000 || year > 2100) {
    return res.status(400).json({ error: "Invalid year." });
  }

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

  if (isNaN(day) || day < 1 || day > 31) {
    return res.status(400).json({ error: "Invalid day. Must be between 1 and 31." });
  }
  if (isNaN(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: "Invalid month. Must be between 1 and 12." });
  }
  if (isNaN(year) || year < 2000 || year > 2100) {
    return res.status(400).json({ error: "Invalid year." });
  }

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

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(from) || !dateRegex.test(to)) {
    return res.status(400).json({ error: "Invalid date format. Must be YYYY-MM-DD." });
  }

  try {
    const { rows } = await runWithAuth((client) =>
      fetchAttendanceRange(client, { from, to, status })
    );
    res.json({ from, to, status, count: rows.length, rows });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

export default app;

const isMain = process.argv[1] && (process.argv[1].includes('server.js') || process.argv[1].includes('server'));
if (isMain) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Attendance API running on port ${PORT}`);
  });
}


