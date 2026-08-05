import { useCallback, useEffect, useState } from 'react';
import { fetchPurchasePendingCounts } from '../services/purchaseService';

const EMPTY_COUNTS = {
  approvalPending: 0,
  poPending: 0,
  deliveryPending: 0,
  receivingPending: 0,
  total: 0,
};

/**
 * Polls the Purchase system's pending counts (used for sidebar badges).
 * Fails silently — if the query errors out, the badge just stays at its
 * last known value instead of crashing the layout.
 */
export function usePurchasePendingCounts(pollMs = 60000) {
  const [counts, setCounts] = useState(EMPTY_COUNTS);

  const refresh = useCallback(() => {
    fetchPurchasePendingCounts()
      .then(setCounts)
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