import React from 'react';
import systemRegistry from '../../core/registry/systemRegistry';
import InventoryPage from './pages/InventoryPage';

systemRegistry.register({
  id: 'inventory',
  name: 'Inventory',
  icon: 'Boxes',

  menuItems: [
    {
      href: '/dashboard/inventory/dashboard',
      label: 'Dashboard',
      icon: 'LayoutDashboard',
      showFor: ['admin', 'HOD', 'user'],
    },
    {
      href: '/dashboard/inventory/stock',
      label: 'IMS',
      icon: 'Boxes',
      showFor: ['admin', 'HOD', 'user'],
    },
    {
      href: '/dashboard/inventory/transactions',
      label: 'Stock Transactions',
      icon: 'History',
      showFor: ['admin', 'HOD', 'user'],
    },
    {
      href: '/dashboard/inventory/reorder',
      label: 'Reorder Management',
      icon: 'AlertTriangle',
      showFor: ['admin', 'HOD', 'user'],
    },
    {
      href: '/dashboard/inventory/indent',
      label: 'Indent Management',
      icon: 'ClipboardList',
      showFor: ['admin', 'HOD', 'user'],
    },
    {
      href: '/dashboard/inventory/settings',
      label: 'Master',
      icon: 'Settings',
      showFor: ['admin'],
    },
  ],

  routes: [
    {
      path: '/dashboard/inventory',
      element: <InventoryPage />,
      protected: true,
    },
    {
      path: '/dashboard/inventory/:tabId',
      element: <InventoryPage />,
      protected: true,
    },
  ],
});
