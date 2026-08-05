import { useCallback, useEffect, useState } from 'react';
import supabase from '../../../../SupabaseClient';

const BASE_URL = 'https://script.google.com/macros/s/AKfycbzF-ERpUfrb0figpapH5q5-J1KRAnBHt-OaXYrN9Cw4wzwaacKhUPwGgtCIWfxw2Ruz9g/exec';
const sheetUrl = (sheet) => `${BASE_URL}?sheet=${encodeURIComponent(sheet)}&action=fetch`;

const EMPTY_COUNTS = {
  leaveManagementPending: 0,
  advancePending: 0,
  putthaPending: 0,
  findEnquiryPending: 0,
  callTrackerPending: 0,
  afterJoiningWorkPending: 0,
  leavingPending: 0,
  afterLeavingWorkPending: 0,
  total: 0,
};

async function fetchSheet(sheetName) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5s max timeout to prevent layout blocking
    const res = await fetch(sheetUrl(sheetName), { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const json = await res.json();
    const raw = json.data || json;
    return Array.isArray(raw) ? raw : null;
  } catch {
    return null;
  }
}

// Sheets with a header row at index 5 and data starting at index 6 (INDENT, ENQUIRY, JOINING)
function rowsFromRow6(raw) {
  if (!raw || raw.length < 7) return { headers: [], rows: [] };
  const headers = (raw[5] || []).map((h) => (h ? h.toString().trim() : ''));
  return { headers, rows: raw.slice(6) };
}
function getIndex(headers, name) {
  return headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
}

async function fetchHrFmsPendingCounts() {
  const [leaveRaw, advRes, putRes, indentRaw, enquiryRaw, followUpRaw, joiningRaw, leavingRaw] = await Promise.all([
    fetchSheet('Leave Management'),
    supabase.from('advances').select('id', { count: 'exact', head: true }).eq('status', 'Pending'),
    supabase.from('putthas').select('id', { count: 'exact', head: true }).eq('status', 'Pending'),
    fetchSheet('INDENT'),
    fetchSheet('ENQUIRY'),
    fetchSheet('Follow - Up'),
    fetchSheet('JOINING'),
    fetchSheet('LEAVING'),
  ]);

  // Leave Management: data from row index 1, status at column 7
  let leaveManagementPending = 0;
  if (leaveRaw) {
    const dataRows = leaveRaw.length > 1 ? leaveRaw.slice(1) : [];
    leaveManagementPending = dataRows.filter(
      (row) => row[7]?.toString().trim().toLowerCase() === 'pending'
    ).length;
  }

  const advancePending = advRes.count ?? (advRes.data || []).filter((a) => a.status === 'Pending').length;
  const putthaPending = putRes.count ?? (putRes.data || []).filter((p) => p.status === 'Pending').length;

  // Find Enquiry: INDENT sheet, Status === 'NeedMore', Planned 2 set, Actual 2 not
  let findEnquiryPending = 0;
  {
    const { headers, rows } = rowsFromRow6(indentRaw);
    if (headers.length) {
      const sIdx = getIndex(headers, 'Status');
      const p2Idx = getIndex(headers, 'Planned 2');
      const a2Idx = getIndex(headers, 'Actual 2');
      findEnquiryPending = rows.filter(
        (row) => row[sIdx] === 'NeedMore' && row[p2Idx] && (!row[a2Idx] || row[a2Idx] === '')
      ).length;
    }
  }

  // Call Tracker: ENQUIRY rows (planned, not actual) with no Joining/Reject in Follow-Up sheet
  let callTrackerPending = 0;
  {
    const { headers, rows } = rowsFromRow6(enquiryRaw);
    if (headers.length) {
      const plannedIdx = getIndex(headers, 'Planned');
      const actualIdx = getIndex(headers, 'Actual');
      const enqNoIdx = getIndex(headers, 'Candidate Enquiry Number');
      const enquiryData = rows
        .filter((row) => row[plannedIdx] && (!row[actualIdx] || row[actualIdx] === ''))
        .map((row) => row[enqNoIdx]);

      let followUpData = [];
      if (followUpRaw) {
        const fRows = Array.isArray(followUpRaw[0]) ? followUpRaw.slice(1) : followUpRaw;
        followUpData = fRows.map((row) => ({ enquiryNo: row[1] || '', status: row[2] || '' }));
      }

      callTrackerPending = enquiryData.filter((enqNo) => {
        const hasFinalStatus = followUpData.some(
          (f) => f.enquiryNo === enqNo && (f.status === 'Joining' || f.status === 'Reject')
        );
        return !hasFinalStatus;
      }).length;
    }
  }

  // After Joining Work: JOINING sheet, Planned Date set, Actual not
  let afterJoiningWorkPending = 0;
  let joiningCompleted = []; // needed for Leaving below
  {
    const { headers, rows } = rowsFromRow6(joiningRaw);
    if (headers.length) {
      const empIdx = getIndex(headers, 'Employee ID');
      const pdIdx = getIndex(headers, 'Planned Date');
      const actIdx = getIndex(headers, 'Actual');
      afterJoiningWorkPending = rows.filter(
        (row) => row[pdIdx] && (!row[actIdx] || row[actIdx] === '')
      ).length;
      joiningCompleted = rows
        .filter((row) => row[pdIdx] && row[actIdx])
        .map((row) => row[empIdx]);
    }
  }

  // Leaving: completed-joining employees not yet present in LEAVING sheet
  // After Leaving Work: LEAVING sheet rows, plannedDate (col 12) set, actual (col 13) not
  let leavingPending = 0;
  let afterLeavingWorkPending = 0;
  {
    const leavingDataRows = leavingRaw && leavingRaw.length > 6 ? leavingRaw.slice(6) : [];
    const leavingEmployeeIds = new Set(leavingDataRows.map((row) => row[1]));
    leavingPending = joiningCompleted.filter((empId) => !leavingEmployeeIds.has(empId)).length;
    afterLeavingWorkPending = leavingDataRows.filter(
      (row) => row[12] && !row[13]
    ).length;
  }

  return {
    leaveManagementPending,
    advancePending,
    putthaPending,
    findEnquiryPending,
    callTrackerPending,
    afterJoiningWorkPending,
    leavingPending,
    afterLeavingWorkPending,
    total:
      leaveManagementPending +
      advancePending +
      putthaPending +
      findEnquiryPending +
      callTrackerPending +
      afterJoiningWorkPending +
      leavingPending +
      afterLeavingWorkPending,
  };
}

const CACHE_KEY = 'hrFmsPendingCountsCache';

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(counts) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(counts));
  } catch {
    // ignore storage errors (e.g. private mode) — non-critical cache
  }
}

// Same exact counting logic as before (fetchHrFmsPendingCounts is untouched).
// Only change: show last-known counts instantly from cache while the real
// fetch runs in the background, and poll far less aggressively so this
// (layout-level, runs on every page) hook stops hammering the network.
export function useHrFmsPendingCounts(pollMs = 300000) {
  const cached = readCache();
  const [counts, setCounts] = useState(cached || EMPTY_COUNTS);

  const refresh = useCallback(() => {
    fetchHrFmsPendingCounts()
      .then((result) => {
        setCounts(result);
        writeCache(result);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    if (!pollMs) return undefined;
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
  }, [refresh, pollMs]);

  return counts;
}