import { useEffect, useState } from 'react';
import { fetchChecklistDelegationPendingCounts } from '../services/pendingApprovalsService';

const EMPTY_COUNTS = {
  delegationPending: 0,
  taskPending: 0,
  adminApprovalPending: 0,
  total: 0,
};

function getCacheKey() {
  const user = (localStorage.getItem('user-name') || 'guest').toLowerCase();
  const role = (localStorage.getItem('role') || 'user').toLowerCase();
  return `checklistDelegationPendingCountsCache_${user}_${role}`;
}

function readCache() {
  try {
    const key = getCacheKey();
    const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.total === 'number') {
        return parsed;
      }
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

function writeCache(counts) {
  try {
    const key = getCacheKey();
    localStorage.setItem(key, JSON.stringify(counts));
  } catch {
    // Storage quota or private mode fallback
  }
  try {
    const key = getCacheKey();
    sessionStorage.setItem(key, JSON.stringify(counts));
  } catch {
    // Ignore fallback errors
  }
}

// Module-level state & listener registry for deduplication across components
let currentCounts = readCache() || EMPTY_COUNTS;
const listeners = new Set();
let inFlightPromise = null;

function broadcastCounts(newCounts) {
  currentCounts = newCounts;
  writeCache(newCounts);
  listeners.forEach((fn) => {
    try {
      fn(newCounts);
    } catch {
      // Ignore listener notification error
    }
  });
}

export function refreshChecklistDelegationPendingCounts() {
  if (inFlightPromise) return inFlightPromise;
  inFlightPromise = fetchChecklistDelegationPendingCounts()
    .then((result) => {
      if (result && typeof result.total === 'number') {
        broadcastCounts(result);
      }
      return result;
    })
    .catch((err) => {
      // Fail silently to preserve last known cached counts
      console.warn('Failed to refresh checklist pending counts:', err);
      return currentCounts;
    })
    .finally(() => {
      inFlightPromise = null;
    });
  return inFlightPromise;
}

/**
 * Polls the Checklist & Delegation system's pending counts (used for
 * sidebar badges). Hydrates immediately from cache (0ms) so badges never flash or vanish.
 * Deduplicates in-flight fetches across multiple hook instances (MasterLayout + AdminLayout).
 */
export function useChecklistDelegationPendingCounts(pollMs = 60000) {
  const [counts, setCounts] = useState(() => readCache() || currentCounts);

  useEffect(() => {
    const freshFromCache = readCache();
    if (freshFromCache) {
      setCounts(freshFromCache);
      currentCounts = freshFromCache;
    }

    // Subscribe to shared updates
    listeners.add(setCounts);

    // Initial background refresh
    refreshChecklistDelegationPendingCounts();

    if (!pollMs) {
      return () => {
        listeners.delete(setCounts);
      };
    }

    const id = setInterval(refreshChecklistDelegationPendingCounts, pollMs);
    return () => {
      listeners.delete(setCounts);
      clearInterval(id);
    };
  }, [pollMs]);

  return counts;
}