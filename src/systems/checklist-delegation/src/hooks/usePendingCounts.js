import { useCallback, useEffect, useState } from 'react';
import { fetchChecklistDelegationPendingCounts } from '../services/pendingApprovalsService';

const EMPTY_COUNTS = {
  delegationPending: 0,
  adminApprovalPending: 0,
  total: 0,
};

/**
 * Polls the Checklist & Delegation system's pending counts (used for
 * sidebar badges). Fails silently — if the query errors out, the badge
 * just stays at its last known value instead of crashing the layout.
 */
export function useChecklistDelegationPendingCounts(pollMs = 60000) {
  const [counts, setCounts] = useState(EMPTY_COUNTS);

  const refresh = useCallback(() => {
    fetchChecklistDelegationPendingCounts()
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