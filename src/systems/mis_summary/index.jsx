/**
 * MIS Summary System — Master System Registration
 *
 * Registers the MIS Summary module with the master systemRegistry so it
 * appears in the sidebar navigation and its routes are loaded into the
 * master app's router.
 *
 * Auth Bridge Strategy:
 * ─────────────────────
 * The MIS pages use `useAuth()` from their own `AuthContext.jsx`, which
 * normally requires the MIS system's own `AuthProvider` (Google Sheets login).
 * Inside the master system we DON'T want a second login — users are already
 * authenticated via Supabase/localStorage.
 *
 * Solution: Each route element wraps the page in a `MisAuthBridgeProvider`
 * that reads from the master system's localStorage and injects the value
 * directly into the same `AuthContext` object the pages read from.
 * This makes `useAuth()` work in every MIS page without any page modifications.
 */

import React from 'react';
import systemRegistry from '../../core/registry/systemRegistry';
import { AuthContext } from './src/contexts/AuthContext';
import { MasterAuthBridgeProvider, useMasterAuthBridge } from './src/contexts/MasterAuthBridge';

// Import MIS pages
import AdminDashboard from './src/pages/admin/Dashboard';
import AdminHistoryCommitment from './src/pages/admin/HistoryCommitment';
import KpiKra from './src/pages/admin/KpiKra';

// ─── Bridge Injector ─────────────────────────────────────────────────────────

/**
 * Reads auth data from MasterAuthBridgeProvider and injects it into the
 * MIS system's own AuthContext so all pages' useAuth() calls are satisfied.
 */
function MisAuthBridgeInjector({ children }) {
  const bridge = useMasterAuthBridge();
  return (
    <AuthContext.Provider value={bridge}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Wraps any MIS page with the full auth bridge stack.
 */
function MisPageWrapper({ children }) {
  return (
    <MasterAuthBridgeProvider>
      <MisAuthBridgeInjector>
        {children}
      </MisAuthBridgeInjector>
    </MasterAuthBridgeProvider>
  );
}

/** Helper — wraps a component in the auth bridge */
const wrap = (PageComponent) => (
  <MisPageWrapper>
    <PageComponent />
  </MisPageWrapper>
);

// ─── System Registration ─────────────────────────────────────────────────────

systemRegistry.register({
  id: 'mis-summary',
  name: 'MIS Summary',
  icon: 'BarChart2',

  menuItems: [
    {
      label: 'MIS Dashboard',
      href: '/dashboard/mis-summary',
      icon: 'LayoutDashboard',
      showFor: ['admin', 'HOD', 'user'],
    },
    {
      label: 'MIS History',
      href: '/dashboard/mis-history',
      icon: 'History',
      showFor: ['admin', 'HOD', 'user'],
    },
    {
      label: 'KPI & KRA',
      href: '/dashboard/mis-kpi-kra',
      icon: 'Target',
      showFor: ['admin', 'HOD', 'user'],
    },
  ],

  routes: [
    {
      path: '/dashboard/mis-summary',
      element: wrap(AdminDashboard),
      protected: true,
    },
    {
      path: '/dashboard/mis-history',
      element: wrap(AdminHistoryCommitment),
      protected: true,
    },
    {
      path: '/dashboard/mis-kpi-kra',
      element: wrap(KpiKra),
      protected: true,
    },
  ],
});
