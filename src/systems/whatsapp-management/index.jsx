import React from 'react';
import systemRegistry from '../../core/registry/systemRegistry';
import WhatsappHistory from './src/pages/admin/WhatsappHistory';

systemRegistry.register({
  id: 'whatsapp-management',
  name: 'WhatsApp Logs',
  icon: 'MessageSquare',

  menuItems: [
    {
      label: 'WhatsApp Logs',
      href: '/dashboard/whatsapp-history',
      icon: 'MessageSquare',
      showFor: ['admin'],
    },
  ],

  routes: [
    {
      path: '/dashboard/whatsapp-history',
      element: <WhatsappHistory />,
      protected: true,
      allowedRoles: ['admin'],
    },
  ],
});
