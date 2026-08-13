#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getAuthenticatedClient, fetchAttendanceLog, fetchAttendanceRange, toCsv } from '../core/index.js';

const today = new Date();
const pad = (n) => String(n).padStart(2, '0');

const program = new Command();
program
  .name('attendance-log')
  .description('Fetch attendance log entries from the eSSL/ZKTeco web portal')
  .option('-d, --day <day>', 'day of month', String(today.getDate()))
  .option('-m, --month <month>', 'month (1-12)', String(today.getMonth() + 1))
  .option('-y, --year <year>', 'year', String(today.getFullYear()))
  .option('--from <date>', 'range start date YYYY-MM-DD (enables range mode; defaults to the 1st of the current month)')
  .option('--to <date>', 'range end date YYYY-MM-DD (defaults to today)')
  .option('-s, --status <status>', 'attendance status filter (All, CheckIn, CheckOut, ...)', 'All')
  .option('-f, --format <format>', 'output format: json or csv', 'json')
  .option('-o, --out <file>', 'write output to this file instead of stdout')
  .parse(process.argv);

const opts = program.opts();

async function main() {
  const client = await getAuthenticatedClient();

  const isRange = Boolean(opts.from || opts.to);
  const { headers, rows } = isRange
    ? await fetchAttendanceRange(client, {
        from: opts.from || `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`,
        to: opts.to || `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`,
        status: opts.status,
      })
    : await fetchAttendanceLog(client, {
        day: Number(opts.day),
        month: Number(opts.month),
        year: Number(opts.year),
        status: opts.status,
      });

  if (rows.length === 0) {
    console.error('No attendance rows found for the given date/status — the page layout may differ from what the parser expects.');
  }

  const output = opts.format === 'csv' ? toCsv(headers, rows) : JSON.stringify(rows, null, 2);

  if (opts.out) {
    await fs.mkdir(path.dirname(opts.out), { recursive: true });
    await fs.writeFile(opts.out, output);
    console.error(`Wrote ${rows.length} rows to ${opts.out}`);
  } else {
    console.log(output);
  }
}

main().catch((err) => {
  console.error('Failed to fetch attendance log:', err.message);
  process.exit(1);
});
