import React from 'react';
import systemRegistry from '../../core/registry/systemRegistry';

// Import Checklist-Delegation pages
import AdminDashboard from './src/pages/admin/Dashboard';
import ChecklistTask from './src/pages/admin/ChecklistTask';
import MaintenanceTask from './src/pages/admin/MaintenanceTask';
import RepairTask from './src/pages/admin/RepairTask';
import EATask from './src/pages/admin/EATask';
import CalendarPage from './src/pages/admin/CalendarPage';
import QuickTask from './src/pages/QuickTask';
import Setting from './src/pages/Setting';
import BulkImport from './src/pages/BulkImport';
import DataPage from './src/pages/admin/DataPage';
import AdminDataPage from './src/pages/admin/admin-data-page';
import AccountDataPage from './src/pages/delegation';
import AdminDelegationTask from './src/pages/delegation-data';
import AllTasks from './src/pages/admin/AllTasks';
import HolidayListPage from './src/pages/admin/HolidayListPage';
import WorkingDayCalendarPage from './src/pages/admin/WorkingDayCalendarPage';
import AdminApprovalPage from './src/pages/admin/AdminApprovalPage';
import NotificationsPage from './src/pages/admin/Notifications';
import TrainingVideo from './src/pages/admin/TrainingVideo';
import AdminAssignTask from './src/pages/admin/AssignTask';
import Demo from './src/pages/user/Demo';
import MisReport from './src/pages/MisReport';

systemRegistry.register({
  id: 'checklist-delegation',
  name: 'Checklist & Delegation',
  icon: 'ClipboardCheck',

  menuItems: [
    {
      label: 'Dashboard',
      href: '/dashboard/admin',
      icon: 'Database',
      showFor: ['admin', 'user', 'HOD'],
    },
    {
      label: 'Notifications',
      href: '/dashboard/notifications',
      icon: 'Bell',
      showFor: ['admin', 'user', 'HOD'],
    },
    {
      label: 'Quick Task',
      href: '/dashboard/quick-task',
      icon: 'Zap',
      showFor: ['admin'],
    },
    {
      label: 'Assign Task',
      href: '/dashboard/assign-task',
      icon: 'CheckSquare',
      showFor: ['admin', 'HOD', 'user'],
    },
    {
      label: 'Delegation',
      href: '/dashboard/delegation',
      icon: 'ClipboardList',
      showFor: ['admin', 'user', 'HOD'],
    },
    {
      label: 'Task',
      href: '/dashboard/task',
      icon: 'CalendarCheck',
      showFor: ['admin', 'HOD', 'user'],
    },
    {
      label: 'Calendar',
      href: '/dashboard/calendar',
      icon: 'Calendar',
      showFor: ['admin', 'user', 'HOD'],
    },
    {
      label: 'Holiday',
      icon: 'Calendar',
      showFor: ['admin'],
      isSubmenu: true,
      subItems: [
        {
          href: '/dashboard/holiday-list',
          label: 'Holiday List',
          showFor: ['admin'],
        },
        {
          href: '/dashboard/working-day-calendar',
          label: 'Working Day Calendar',
          showFor: ['admin'],
        },
      ],
    },
    {
      label: 'Admin Approval',
      href: '/dashboard/admin-approval',
      icon: 'BookmarkCheck',
      showFor: ['admin', 'HOD'],
    },
    {
      label: 'Settings',
      href: '/dashboard/setting',
      icon: 'Settings',
      showFor: ['admin'],
    },
    {
      label: 'Training Video',
      href: '/dashboard/training-video',
      icon: 'Video',
      showFor: ['admin', 'user', 'HOD'],
    },
  ],

  routes: [
    {
      path: '/dashboard/admin',
      element: <AdminDashboard />,
      protected: true,
    },
    {
      path: '/dashboard/notifications',
      element: <NotificationsPage />,
      protected: true,
    },
    {
      path: '/dashboard/quick-task',
      element: <QuickTask />,
      protected: true,
      allowedRoles: ['admin'],
    },
    {
      path: '/dashboard/assign-task',
      element: <AdminAssignTask />,
      protected: true,
      allowedRoles: ['admin', 'HOD', 'user'],
    },
    {
      path: '/dashboard/delegation',
      element: <AccountDataPage />,
      protected: true,
    },
    {
      path: '/dashboard/task',
      element: <AllTasks />,
      protected: true,
    },
    {
      path: '/dashboard/calendar',
      element: <CalendarPage />,
      protected: true,
    },
    {
      path: '/dashboard/holiday-list',
      element: <HolidayListPage />,
      protected: true,
      superAdminOnly: true,
    },
    {
      path: '/dashboard/working-day-calendar',
      element: <WorkingDayCalendarPage />,
      protected: true,
    },
    {
      path: '/dashboard/admin-approval',
      element: <AdminApprovalPage />,
      protected: true,
      allowedRoles: ['admin', 'HOD'],
    },
    {
      path: '/dashboard/setting',
      element: <Setting />,
      protected: true,
      superAdminOnly: true,
    },
    {
      path: '/dashboard/training-video',
      element: <TrainingVideo />,
      protected: true,
    },
    {
      path: '/dashboard/checklist',
      element: <ChecklistTask />,
      protected: true,
    },
    {
      path: '/dashboard/maintenance',
      element: <MaintenanceTask />,
      protected: true,
    },
    {
      path: '/dashboard/repair',
      element: <RepairTask />,
      protected: true,
    },
    {
      path: '/dashboard/ea-task',
      element: <EATask />,
      protected: true,
    },
    {
      path: '/dashboard/bulk-import',
      element: <BulkImport />,
      protected: true,
      allowedRoles: ['admin', 'HOD'],
    },
    {
      path: '/dashboard/data',
      element: <DataPage />,
      protected: true,
      allowedRoles: ['admin', 'HOD'],
    },
    {
      path: '/dashboard/data/:category',
      element: <DataPage />,
      protected: true,
    },
    {
      path: '/dashboard/admin-data',
      element: <AdminDataPage />,
      protected: true,
      allowedRoles: ['admin', 'HOD'],
    },
    {
      path: '/dashboard/delegation-data',
      element: <AdminDelegationTask />,
      protected: true,
      allowedRoles: ['admin', 'HOD'],
    },
    {
      path: '/dashboard/mis-report',
      element: <MisReport />,
      protected: true,
      allowedRoles: ['admin'],
    },
    {
      path: '/dashboard/demo',
      element: <Demo />,
      protected: true,
    },
  ],
});
