import React from 'react';
import { Navigate } from 'react-router-dom';
import systemRegistry from '../../core/registry/systemRegistry';
import './purchase.css';

import DashboardPage from './pages/DashboardPage';
import IndentPage from './pages/IndentPage';
import ApprovalPage from './pages/ApprovalPage';
import PurchaseOrderPage from './pages/PurchaseOrderPage';
import PoCreatePage from './pages/PoCreatePage';
import DeliveryPage from './pages/DeliveryPage';
import ReceivingPage from './pages/ReceivingPage';
import PaymentApprovalPage from './pages/PaymentApprovalPage';
import PaymentPage from './pages/PaymentPage';

systemRegistry.register({
  id: 'purchase',
  name: 'Purchase',
  icon: 'ShoppingCart',

  menuItems: [
    {
      href: '/dashboard/purchase/dashboard',
      label: 'Dashboard',
      icon: 'LayoutDashboard',
      showFor: ['admin', 'HOD', 'user'],
    },

    {
      href: '/dashboard/purchase/indent',
      label: 'Indent Data',
      icon: 'ListChecks',
      showFor: ['admin', 'HOD', 'user'],
    },
    {
      href: '/dashboard/purchase/approval',
      label: 'Approvals',
      icon: 'CheckCircle2',
      showFor: ['admin', 'HOD'],
    },
    {
      href: '/dashboard/purchase/polist',
      label: 'Purchase Order',
      icon: 'FileText',
      showFor: ['admin', 'HOD', 'user'],
    },
    {
      href: '/dashboard/purchase/delivery',
      label: 'Delivery',
      icon: 'Truck',
      showFor: ['admin', 'HOD', 'user'],
    },
    {
      href: '/dashboard/purchase/receiving',
      label: 'Receiving',
      icon: 'PackageCheck',
      showFor: ['admin', 'HOD', 'user'],
    },
    {
      href: '/dashboard/purchase/payment-approval',
      label: 'Payment Approval',
      icon: 'CheckCircle2',
      showFor: ['admin', 'HOD'],
    },
    {
      href: '/dashboard/purchase/payment',
      label: 'Payment',
      icon: 'Wallet',
      showFor: ['admin', 'HOD'],
    },
  ],

  routes: [
    {
      path: '/dashboard/purchase',
      element: <Navigate to="/dashboard/purchase/dashboard" replace />,
      protected: true,
    },
    {
      path: '/dashboard/purchase/dashboard',
      element: <DashboardPage />,
      protected: true,
    },

    {
      path: '/dashboard/purchase/indent',
      element: <IndentPage />,
      protected: true,
    },
    {
      path: '/dashboard/purchase/approval',
      element: <ApprovalPage />,
      protected: true,
      allowedRoles: ['admin', 'HOD'],
    },
    {
      path: '/dashboard/purchase/pocreate',
      element: <PoCreatePage />,
      protected: true,
      allowedRoles: ['admin', 'HOD'],
    },
    {
      path: '/dashboard/purchase/polist',
      element: <PurchaseOrderPage />,
      protected: true,
    },
    {
      path: '/dashboard/purchase/delivery',
      element: <DeliveryPage />,
      protected: true,
    },
    {
      path: '/dashboard/purchase/receiving',
      element: <ReceivingPage />,
      protected: true,
    },
    {
      path: '/dashboard/purchase/payment-approval',
      element: <PaymentApprovalPage />,
      protected: true,
      allowedRoles: ['admin', 'HOD'],
    },
    {
      path: '/dashboard/purchase/payment',
      element: <PaymentPage />,
      protected: true,
      allowedRoles: ['admin', 'HOD'],
    },
  ],
});
