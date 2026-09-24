import { useEffect, useState } from 'react';
import { fetchPurchasePendingCounts } from '../services/purchaseService';

const CACHE_KEY = 'purchasePendingCountsCache';

const EMPTY_COUNTS = {
  approvalPending: 0,
  poPending: 0,
  deliveryPending: 0,
  receivingPending: 0,
  paymentApprovalPending: 0,
  paymentPending: 0,
  total: 0,
};

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY) || sessionStorage.getItem(CACHE_KEY);
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
    localStorage.setItem(CACHE_KEY, JSON.stringify(counts));
  } catch {
    // Storage quota or private mode fallback
  }
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(counts));
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

export function refreshPurchasePendingCounts() {
  if (inFlightPromise) return inFlightPromise;
  inFlightPromise = fetchPurchasePendingCounts()
    .then((result) => {
      if (result && typeof result.total === 'number') {
        broadcastCounts(result);
      }
      return result;
    })
    .catch((err) => {
      // Fail silently to preserve last known cached counts
      console.warn('Failed to refresh purchase pending counts:', err);
      return currentCounts;
    })
    .finally(() => {
      inFlightPromise = null;
    });
  return inFlightPromise;
}

/**
 * Polls the Purchase system's pending counts (used for sidebar badges).
 * Hydrates immediately from cache (0ms) so badges never flash or vanish.
 * Deduplicates in-flight fetches across multiple hook instances.
 */
export function usePurchasePendingCounts(pollMs = 60000) {
  const [counts, setCounts] = useState(currentCounts);

  useEffect(() => {
    // Subscribe to shared updates
    listeners.add(setCounts);

    // Initial background refresh
    refreshPurchasePendingCounts();

    if (!pollMs) {
      return () => {
        listeners.delete(setCounts);
      };
    }

    const id = setInterval(refreshPurchasePendingCounts, pollMs);
    return () => {
      listeners.delete(setCounts);
      clearInterval(id);
    };
  }, [pollMs]);

  return counts;
}