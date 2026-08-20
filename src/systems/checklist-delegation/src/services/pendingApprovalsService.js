import supabase from '../SupabaseClient';
import { fetchDelegationDataSortByDate, fetchPendingApprovals } from '../redux/api/delegationApi';
import { fetchPendingMaintenanceApprovals } from '../redux/api/maintenanceApi';
import { fetchPendingRepairApprovals } from '../redux/api/repairApi';
import { fetchPendingEAApprovals } from '../redux/api/eaApi';
import { fetchPendingChecklistApprovals, fetchChecklistDataSortByDate } from '../redux/api/quickTaskApi';

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
      // Non-admins cannot approve their own tasks and only see direct reports' tasks
      return doer !== username.toLowerCase() && reportingUsersLower.includes(doer);
    }).length;
  };

  const [delegationMine, checklistMine, delegationApprovals, maintenanceApprovals, repairApprovals, eaApprovals, checklistApprovals] =
    await Promise.all([
      fetchDelegationDataSortByDate(), // already role-scoped to "my" pending delegation tasks
      fetchChecklistDataSortByDate(), // already role-scoped to "my" pending checklist tasks
      fetchPendingApprovals(),
      fetchPendingMaintenanceApprovals(),
      fetchPendingRepairApprovals(),
      fetchPendingEAApprovals(),
      fetchPendingChecklistApprovals(),
    ]);

  // Fetch holidays list to exclude them from the counts, matching the checklist & delegation frontend list logic
  let holidaysList = [];
  try {
    const { data: holidaysData } = await supabase.from('holidays').select('holiday_date');
    if (holidaysData) {
      holidaysList = holidaysData.map(h => h.holiday_date);
    }
  } catch (err) {
    console.error("Error fetching holidays in badge counts:", err);
  }

  const filterPending = (tasksList) => {
    return (tasksList || []).filter(item => {
      const taskDateStr = item.planned_date || item.task_start_date || item.created_at;
      if (!taskDateStr) return false;

      // Parse task date and compare with today (local date boundaries)
      const date = new Date(taskDateStr);
      if (isNaN(date.getTime())) return false;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const taskDate = new Date(date);
      taskDate.setHours(0, 0, 0, 0);

      const isExtended = item.status?.toLowerCase() === "extended" || item.status?.toLowerCase() === "extend";
      const timeStatus = (isExtended && taskDate >= today) ? "Today" : (taskDate < today ? "Overdue" : (taskDate.getTime() === today.getTime() ? "Today" : "Upcoming"));

      // Only count "Today" or "Overdue" tasks (Upcoming is excluded)
      if (timeStatus === "Upcoming") return false;

      const taskDateOnly = taskDateStr.split('T')[0];
      return !holidaysList.includes(taskDateOnly);
    }).length;
  };

  const delegationPending = filterPending(delegationMine);
  const taskPending = filterPending(checklistMine);

  const adminApprovalPending =
    scopeAndCount(delegationApprovals) +
    scopeAndCount(maintenanceApprovals) +
    scopeAndCount(repairApprovals) +
    scopeAndCount(eaApprovals) +
    scopeAndCount(checklistApprovals);

  return {
    delegationPending,
    taskPending,
    adminApprovalPending,
    total: delegationPending + taskPending + adminApprovalPending,
  };
}