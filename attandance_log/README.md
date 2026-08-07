# attendance-log

Fetches attendance log entries from the eSSL/ZKTeco web attendance portal
(`AttendenceLog.aspx`) and exports them as JSON or CSV.

## Setup

```bash
npm install
cp .env.example .env
# edit .env with your portal URL and login credentials
```

## Usage

```bash
# Today's log, printed as JSON
node src/index.js

# A specific date, saved as CSV
node src/index.js --day 27 --month 7 --year 2026 --status All --format csv --out output/2026-07-27.csv
```

Options:

| Flag | Description | Default |
|---|---|---|
| `-d, --day` | day of month | today |
| `-m, --month` | month (1-12) | today |
| `-y, --year` | year | today |
| `-s, --status` | status filter (`All`, etc., as used by the portal) | `All` |
| `-f, --format` | `json` or `csv` | `json` |
| `-o, --out` | write to a file instead of stdout | — |

## How it works

The portal is a classic ASP.NET WebForms app:

1. `src/auth.js` loads the login page, reads the `__VIEWSTATE` and a
   per-session `txtKey`, encrypts the password with AES-ECB/PKCS7 keyed by
   `txtKey` (mirroring the page's own client-side `Encrypt()` JS), and posts
   the login form. It then loads `Default.aspx` once, which the report pages
   require to be visited first in the session before they'll render real
   data instead of a redirect stub.
2. `src/fetchAttendance.js` requests `AttendenceLog.aspx` with the
   `Day`/`Month`/`Year`/`Status` query params (a `Referer` of `Default.aspx`
   is required or the page returns an empty placeholder).
3. `src/parseHtml.js` parses the result. The grid is rendered by the "obout
   Grid" ASP.NET control rather than a plain `<table>`: header text lives in
   `.ob_gCH` elements and each data row is a `<tr>` of `td.ob_gC` cells whose
   visible text is in a nested `.ob_gRC` element. Headers are aligned to
   data cells from the right, since the header row has one extra leading
   entry for the row-select checkbox column.

Session cookies live only in memory for the duration of one run — nothing
is persisted, so each run logs in fresh.
