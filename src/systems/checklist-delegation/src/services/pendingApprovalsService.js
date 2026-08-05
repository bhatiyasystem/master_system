import supabase from '../SupabaseClient';
import { fetchDelegationDataSortByDate, fetchPendingApprovals } from '../redux/api/delegationApi';
import { fetchPendingMaintenanceApprovals } from '../redux/api/maintenanceApi';
import { fetchPendingRepairApprovals } from '../redux/api/repairApi';
import { fetchPendingEAApprovals } from '../redux/api/eaApi';
import { fetchPendingChecklistApprovals } from '../redux/api/quickTaskApi';

// Same de-dup rule AdminApprovalPage.jsx applies per tab, so counts match
// exactly what the page itself would show.
function dedupe(tasks) {
  const seen = new Set();
  return (tasks || []).filter((task) => {
    const baseId = task.task_id || task.original_task_id || task.id;
    if (!baseId || seen.has(baseId)) return false;
    seen.add(baseId);
    return true;
  });
}

// ── Sidebar badge counts ────────────────────────────────────────────────
export async function fetchChecklistDelegationPendingCounts() {
  const role = (localStorage.getItem('role') || '').toLowerCase();
  const username = localStorage.getItem('user-name') || '';
  const isAdmin = role === 'admin';

  // Admin sees every pending approval; HOD only sees their direct reports'
  // submissions (mirrors AdminApprovalPage.jsx's loadTasks filter).
  let reportingUsersLower = null;
  if (!isAdmin) {
    const { data: reports } = await supabase
      .from('users')
      .select('user_name')
      .eq('reported_by', username);
    reportingUsersLower = (reports || []).map((r) => (r.user_name || '').toLowerCase());
  }

  const scopeAndCount = (tasks) => {
    const deduped = dedupe(tasks);
    if (isAdmin) return deduped.length;
    return deduped.filter((t) => {
      const doer = (t.doer_name || t.name || t.filled_by || '').toLowerCase();
      return reportingUsersLower.includes(doer);
    }).length;
  };

  const [delegationMine, delegationApprovals, maintenanceApprovals, repairApprovals, eaApprovals, checklistApprovals] =
    await Promise.all([
      fetchDelegationDataSortByDate(), // already role-scoped to "my" pending delegation tasks
      fetchPendingApprovals(),
      fetchPendingMaintenanceApprovals(),
      fetchPendingRepairApprovals(),
      fetchPendingEAApprovals(),
      fetchPendingChecklistApprovals(),
    ]);

  const delegationPending = (delegationMine || []).length;

  const adminApprovalPending =
    scopeAndCount(delegationApprovals) +
    scopeAndCount(maintenanceApprovals) +
    scopeAndCount(repairApprovals) +
    scopeAndCount(eaApprovals) +
    scopeAndCount(checklistApprovals);

  return {
    delegationPending,
    adminApprovalPending,
    total: delegationPending + adminApprovalPending,
  };
}