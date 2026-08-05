import { useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { User, LayoutDashboard, FileText, Search, Phone, UserCheck, UserX, UserMinus, Users, Calendar, DollarSign, FileText as LeaveIcon, Clock, LogOut as LogOutIcon, Book, BadgeDollarSign, BookPlus, IndianRupee, Package, X, ChevronDown, ChevronUp, Menu } from 'lucide-react';

const Sidebar = ({ _onClose }) => {
  // const { logout, user } = useAuthStore();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);

  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : null;

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login', { replace: true });

  };

  const adminMenuItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/indent', icon: FileText, label: 'Indent' },
    { path: '/find-enquiry', icon: Search, label: 'Find Enquiry' },
    { path: '/call-tracker', icon: Phone, label: 'Call Tracker' },
    { path: '/after-joining-work', icon: UserCheck, label: 'After Joining Work' },
    { path: '/leaving', icon: UserX, label: 'Leaving' },
    { path: '/after-leaving-work', icon: UserMinus, label: 'After Leaving Work' },
    { path: '/employee', icon: Users, label: 'Employee' },
    { path: '/leave-management', icon: BookPlus, label: 'Leave Management' },
    {
      type: 'dropdown',
      icon: Book,
      label: 'Attendance',
      isOpen: attendanceOpen,
      toggle: () => setAttendanceOpen(!attendanceOpen),
      items: [
        { path: '/attendance', label: 'Monthly' },
        { path: '/attendancedaily', label: 'Daily' }
      ]
    },
    // { path: '/report', icon: NotebookPen, label: 'Report' },
    { path: '/payroll', icon: BadgeDollarSign, label: 'Payroll' },
    { path: '/advance', icon: IndianRupee, label: 'Advance' },
    { path: '/puttha', icon: Package, label: 'Puttha' },
  ];

  const employeeMenuItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/my-profile', icon: User, label: 'My Profile' },
    { path: '/my-attendance', icon: Clock, label: 'My Attendance' },
    { path: '/leave-request', icon: LeaveIcon, label: 'Leave Request' },
    { path: '/my-salary', icon: DollarSign, label: 'My Salary' },
    { path: '/advance', icon: IndianRupee, label: 'My Advance' },
    { path: '/puttha', icon: Package, label: 'My Puttha' },
    { path: '/company-calendar', icon: Calendar, label: 'Company Calendar' },
  ];

  const menuItems = user?.Admin === 'Yes' ? adminMenuItems : employeeMenuItems;

  const SidebarContent = ({ onClose, isCollapsed = false }) => (
    <div className={`flex flex-col h-full ${isCollapsed ? 'w-16' : 'w-64'} bg-indigo-900 text-white`}>
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-indigo-800">
        {!isCollapsed && (
          <h1 className="text-xl font-bold flex items-center gap-2 text-white">
            <Users size={24} />
            <span>HR FMS</span>
            {user?.role === 'employee' && (
              <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded">Employee</span>
            )}
          </h1>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
          >
            <span className="sr-only">Close sidebar</span>
            <X className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* Menu */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto scrollbar-hide">
        {menuItems.map((item) => {
          if (item.type === 'dropdown') {
            return (
              <div key={item.label}>
                <button
                  onClick={item.toggle}
                  className={`flex items-center justify-between w-full py-2.5 px-4 rounded-lg transition-colors ${item.isOpen
                    ? 'bg-indigo-800 text-white'
                    : 'text-indigo-100 hover:bg-indigo-800 hover:text-white'
                    }`}
                >
                  <div className="flex items-center">
                    <item.icon className={isCollapsed ? 'mx-auto' : 'mr-3'} size={20} />
                    {!isCollapsed && <span>{item.label}</span>}
                  </div>
                  {!isCollapsed && (item.isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}
                </button>

                {item.isOpen && !isCollapsed && (
                  <div className="ml-6 mt-1 space-y-1">
                    {item.items.map((subItem) => (
                      <NavLink
                        key={subItem.path}
                        to={subItem.path}
                        className={({ isActive }) =>
                          `flex items-center py-2 px-4 rounded-lg transition-colors ${isActive
                            ? 'bg-indigo-700 text-white'
                            : 'text-indigo-100 hover:bg-indigo-800 hover:text-white'
                          }`
                        }
                        onClick={onClose}
                      >
                        <span>{subItem.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center py-2.5 px-4 rounded-lg transition-colors ${isActive
                  ? 'bg-indigo-800 text-white'
                  : 'text-indigo-100 hover:bg-indigo-800 hover:text-white'
                }`
              }
              onClick={onClose}
            >
              <item.icon className={isCollapsed ? 'mx-auto' : 'mr-3'} size={20} />
              {!isCollapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer - Always visible */}
      <div className="p-4 border-t border-white border-opacity-20">
        <div className="flex items-center space-x-4 mb-4">
          <div className="flex items-center space-x-2 cursor-pointer">
            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center">
              <User size={20} className="text-indigo-600" />
            </div>
            {/* Show user info in mobile view regardless of collapsed state */}
            <div className={`${isCollapsed ? 'hidden' : 'block'} md:block`}>
              <p className="text-sm font-medium text-white">{user?.Name || user?.Username || 'Guest'}</p>
              <p className="text-xs text-white">{user?.Admin === 'Yes' ? 'Administrator' : 'Employee'}</p>

            </div>
          </div>
        </div>
        <button
          onClick={() => {
            handleLogout();
            onClose?.();
          }}
          className="flex items-center py-2.5 px-4 rounded-lg text-white opacity-80 hover:bg-white hover:bg-opacity-10 hover:opacity-100 cursor-pointer transition-colors w-full"
        >
          <LogOutIcon className={isCollapsed ? 'mx-auto' : 'mr-3'} size={20} />
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile menu button - visible only on mobile */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-indigo-900 text-white rounded-md shadow-md"
        onClick={() => setIsOpen(true)}
      >
        <Menu size={24} />
      </button>

      {/* Tablet menu button - visible on tablet (hidden on mobile and desktop) */}
      <button
        className="hidden md:block lg:hidden fixed top-4 left-4 z-50 p-2 bg-indigo-900 text-white rounded-md shadow-md"
        onClick={() => setIsOpen(true)}
      >
        <Menu size={24} />
      </button>

      {/* Desktop Sidebar - full width on desktop */}
      <div className="hidden lg:block fixed left-0 top-0 h-full">
        <SidebarContent />
      </div>

      {/* Tablet Sidebar - collapsible */}
      <div className={`hidden md:block lg:hidden fixed inset-0 z-40 transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div
          className="fixed inset-0 bg-black bg-opacity-50"
          onClick={() => setIsOpen(false)}
        />
        <div className={`fixed left-0 top-0 h-full z-50 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out`}>
          <SidebarContent />
        </div>
      </div>

      {/* Mobile Sidebar - collapsible */}
      <div className={`md:hidden fixed inset-0 z-40 transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div
          className="fixed inset-0 bg-black bg-opacity-50"
          onClick={() => setIsOpen(false)}
        />
        <div className={`fixed left-0 top-0 h-full z-50 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out`}>
          <SidebarContent />
        </div>
      </div>

      {/* Add padding to main content when sidebar is open on desktop */}
      <div className="lg:pl-64"></div>
    </>
  );
};

export default Sidebar;