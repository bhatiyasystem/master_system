import React from 'react';
import systemRegistry from '../../core/registry/systemRegistry';
import GreetingsAdmin from './src/pages/GreetingsAdmin';
import FestivalSchedulerAdmin from './src/pages/FestivalSchedulerAdmin';

systemRegistry.register({
  id: 'greetings',
  name: 'Greetings',
  icon: 'Gift',

  menuItems: [
    {
      label: 'Birthday Greetings',
      href: '/dashboard/greetings-birthdays',
      icon: 'Gift',
      showFor: ['admin'],
    },
    {
      label: 'Festival Scheduler',
      href: '/dashboard/greetings-festival-scheduler',
      icon: 'CalendarClock',
      showFor: ['admin'],
    },
  ],

  routes: [
    {
      path: '/dashboard/greetings-birthdays',
      element: <GreetingsAdmin />,
      protected: true,
      allowedRoles: ['admin'],
    },
    {
      path: '/dashboard/greetings-festival-scheduler',
      element: <FestivalSchedulerAdmin />,
      protected: true,
      allowedRoles: ['admin'],
    },
  ],
});
