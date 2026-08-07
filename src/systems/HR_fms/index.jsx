/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from 'react';
import systemRegistry from '../../core/registry/systemRegistry';

// Import HR FMS pages
import Dashboard from './src/pages/Dashboard';
import Indent from './src/pages/Indent';
import FindEnquiry from './src/pages/FindEnquiry';
import CallTracker from './src/pages/CallTracker';
import AfterJoiningWork from './src/pages/AfterJoiningWork';
import Leaving from './src/pages/Leaving';
import AfterLeavingWork from './src/pages/AfterLeavingWork';
import Employee from './src/pages/Employee';
import MyProfile from './src/pages/MyProfile';
import MyAttendance from './src/pages/MyAttendance';
import LeaveRequest from './src/pages/LeaveRequest';
import MySalary from './src/pages/MySalary';
import CompanyCalendar from './src/pages/CompanyCalendar';
import LeaveManagement from './src/pages/LeaveManagement';
import Attendance from './src/pages/Attendance';
// import Attendancedaily from './src/pages/Attendancedaily';
import Report from './src/pages/Report';
import Payroll from './src/pages/Payroll';
import Advance from './src/pages/Advance';
import Puttha from './src/pages/Puttha';

import supabase from './src/services/supabaseHRClient';

/**
 * HrFmsPageWrapper - Auth Bridge
 * Ensures that the 'user' and 'employeeId' values in localStorage expected by HR FMS
 * pages are correctly synchronized with the master system's session.
 */
function HrFmsPageWrapper({ children }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const syncAuth = async () => {
      try {
        const masterUsername = localStorage.getItem("user-name") || "Admin";
        const isSuperAdmin = localStorage.getItem("is-super-admin") === "true";
        const masterRole = localStorage.getItem("role");

        const userObj = {
          Username: masterUsername,
          Name: masterUsername,
          Admin: (isSuperAdmin || masterRole?.toLowerCase() === 'admin' || masterRole?.toLowerCase() === 'superadmin') ? 'Yes' : 'No'
        };

        localStorage.setItem('user', JSON.stringify(userObj));

        // Fast Supabase employee ID resolution (10ms)
        let empId = localStorage.getItem("employeeId");
        if (!empId && masterUsername) {
          try {
            const { data } = await supabase
              .from('employees')
              .select('employee_id')
              .or(`name.ilike.%${masterUsername}%,employee_id.ilike.%${masterUsername}%`)
              .limit(1)
              .maybeSingle();

            if (data?.employee_id) {
              empId = data.employee_id;
              localStorage.setItem("employeeId", empId);
            }
          } catch (_e) {
            // ignore fallback
          }
        }

        console.log("📡 HR FMS Session Bridged:", { user: userObj, employeeId: empId || masterUsername });
      } catch (err) {
        console.error("📡 HR FMS Auth Bridge sync error:", err);
      } finally {
        setLoading(false);
      }
    };

    syncAuth();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center flex-col items-center min-h-[40vh] p-8">
        <div className="w-10 h-10 border-4 border-indigo-600 border-dashed rounded-full animate-spin mb-4"></div>
        <span className="text-gray-600 text-sm font-semibold animate-pulse">Synchronizing HR FMS Session...</span>
      </div>
    );
  }

  return children;
}

const wrap = (Component) => (
  <HrFmsPageWrapper>
    <Component />
  </HrFmsPageWrapper>
);

systemRegistry.register({
  id: 'hr-fms',
  name: 'HR FMS',
  icon: 'Users',

  menuItems: [
    {
      label: 'HR Dashboard',
      href: '/dashboard/hr-dashboard',
      icon: 'LayoutDashboard',
      showFor: ['admin', 'HOD', 'user'],
    },
    {
      label: 'My Profile',
      href: '/dashboard/hr-my-profile',
      icon: 'User',
      showFor: ['user'],
    },
    {
      label: 'My Attendance',
      href: '/dashboard/hr-my-attendance',
      icon: 'Clock',
      showFor: ['user'],
    },
    {
      label: 'Leave Request',
      href: '/dashboard/hr-leave-request',
      icon: 'FileText',
      showFor: ['user'],
    },
    {
      label: 'My Salary',
      href: '/dashboard/hr-my-salary',
      icon: 'DollarSign',
      showFor: ['user'],
    },
    {
      label: 'Company Calendar',
      href: '/dashboard/hr-company-calendar',
      icon: 'Calendar',
      showFor: ['user'],
    },
    {
      label: 'Indent',
      href: '/dashboard/hr-indent',
      icon: 'FileText',
      showFor: ['admin', 'HOD'],
    },
    {
      label: 'Find Enquiry',
      href: '/dashboard/hr-find-enquiry',
      icon: 'Search',
      showFor: ['admin', 'HOD'],
    },
    {
      label: 'Call Tracker',
      href: '/dashboard/hr-call-tracker',
      icon: 'Phone',
      showFor: ['admin', 'HOD'],
    },
    {
      label: 'After Joining Work',
      href: '/dashboard/hr-after-joining-work',
      icon: 'UserCheck',
      showFor: ['admin', 'HOD'],
    },
    {
      label: 'Leaving',
      href: '/dashboard/hr-leaving',
      icon: 'UserX',
      showFor: ['admin', 'HOD'],
    },
    {
      label: 'After Leaving Work',
      href: '/dashboard/hr-after-leaving-work',
      icon: 'UserMinus',
      showFor: ['admin', 'HOD'],
    },
    {
      label: 'Employee Management',
      href: '/dashboard/hr-employee',
      icon: 'Users',
      showFor: ['admin', 'HOD'],
    },
    {
      label: 'Leave Management',
      href: '/dashboard/hr-leave-management',
      icon: 'BookOpen',
      showFor: ['admin', 'HOD'],
    },
    {
      label: 'Attendance Records',
      icon: 'Book',
      showFor: ['admin', 'HOD'],
      isSubmenu: true,
      subItems: [
        {
          href: '/dashboard/hr-attendance',
          label: 'Monthly Attendance',
          showFor: ['admin', 'HOD'],
        }
        // {
        //   href: '/dashboard/hr-attendancedaily',
        //   label: 'Daily Attendance',
        //   showFor: ['admin', 'HOD'],
        // },
      ],
    },
    {
      label: 'Payroll',
      href: '/dashboard/hr-payroll',
      icon: 'BadgeDollarSign',
      showFor: ['admin', 'HOD'],
    },

    {
      label: 'Advance',
      href: '/dashboard/hr-advance',
      icon: 'DollarSign',
      showFor: ['admin', 'HOD'],
    },
    {
      label: 'My Advance',
      href: '/dashboard/hr-advance',
      icon: 'DollarSign',
      showFor: ['user'],
    },
    {
      label: 'Puttha',
      href: '/dashboard/hr-puttha',
      icon: 'Package',
      showFor: ['admin', 'HOD'],
    },
    {
      label: 'My Puttha',
      href: '/dashboard/hr-puttha',
      icon: 'Package',
      showFor: ['user'],
    },

  ],

  routes: [
    {
      path: '/dashboard/hr-dashboard',
      element: wrap(Dashboard),
      protected: true,
    },
    {
      path: '/dashboard/hr-my-profile',
      element: wrap(MyProfile),
      protected: true,
    },
    {
      path: '/dashboard/hr-my-attendance',
      element: wrap(MyAttendance),
      protected: true,
    },
    {
      path: '/dashboard/hr-leave-request',
      element: wrap(LeaveRequest),
      protected: true,
    },
    {
      path: '/dashboard/hr-my-salary',
      element: wrap(MySalary),
      protected: true,
    },
    {
      path: '/dashboard/hr-company-calendar',
      element: wrap(CompanyCalendar),
      protected: true,
    },
    {
      path: '/dashboard/hr-indent',
      element: wrap(Indent),
      protected: true,
      allowedRoles: ['admin', 'HOD'],
    },
    {
      path: '/dashboard/hr-find-enquiry',
      element: wrap(FindEnquiry),
      protected: true,
      allowedRoles: ['admin', 'HOD'],
    },
    {
      path: '/dashboard/hr-call-tracker',
      element: wrap(CallTracker),
      protected: true,
      allowedRoles: ['admin', 'HOD'],
    },
    {
      path: '/dashboard/hr-after-joining-work',
      element: wrap(AfterJoiningWork),
      protected: true,
      allowedRoles: ['admin', 'HOD'],
    },
    {
      path: '/dashboard/hr-leaving',
      element: wrap(Leaving),
      protected: true,
      allowedRoles: ['admin', 'HOD'],
    },
    {
      path: '/dashboard/hr-after-leaving-work',
      element: wrap(AfterLeavingWork),
      protected: true,
      allowedRoles: ['admin', 'HOD'],
    },
    {
      path: '/dashboard/hr-employee',
      element: wrap(Employee),
      protected: true,
      allowedRoles: ['admin', 'HOD'],
    },
    {
      path: '/dashboard/hr-leave-management',
      element: wrap(LeaveManagement),
      protected: true,
      allowedRoles: ['admin', 'HOD'],
    },
    {
      path: '/dashboard/hr-attendance',
      element: wrap(Attendance),
      protected: true,
      allowedRoles: ['admin', 'HOD'],
    },
    // {
    //   path: '/dashboard/hr-attendancedaily',
    //   element: wrap(Attendancedaily),
    //   protected: true,
    //   allowedRoles: ['admin', 'HOD'],
    // },
    {
      path: '/dashboard/hr-report',
      element: wrap(Report),
      protected: true,
      allowedRoles: ['admin', 'HOD'],
    },
    {
      path: '/dashboard/hr-payroll',
      element: wrap(Payroll),
      protected: true,
      allowedRoles: ['admin', 'HOD'],
    },

    {
      path: '/dashboard/hr-advance',
      element: wrap(Advance),
      protected: true,
    },
    {
      path: '/dashboard/hr-puttha',
      element: wrap(Puttha),
      protected: true,
    },

  ],
});
