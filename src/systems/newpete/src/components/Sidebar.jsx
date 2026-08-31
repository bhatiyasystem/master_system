import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Plus,
  TrendingDown,
  Settings,
  BookOpen,
  LogOut as LogOutIcon,
  X,
  User,
  Users,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const Sidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const adminMenuItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/add-case', icon: Plus, label: 'Add Case' },
    { path: '/expenses', icon: TrendingDown, label: 'Expenses' },
    { path: '/ledger', icon: BookOpen, label: 'Ledger' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  const employeeMenuItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/add-case', icon: Plus, label: 'Add Case' },
    { path: '/expenses', icon: TrendingDown, label: 'Expenses' },
  ];

  const menuItems = user?.role === 'ADMIN' ? adminMenuItems : employeeMenuItems;

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/30 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-56 bg-white border-r border-sky-200 z-50 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Logo Section */}
          <div className="p-6 border-b border-sky-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-sky-600 rounded-lg flex items-center justify-center">
                <Users size={20} className="text-white" />
              </div>
              <span className="text-xl font-bold text-sky-600 tracking-tight">Petty Cash</span>
            </div>
            <button onClick={onClose} className="lg:hidden p-2 hover:bg-sky-100 rounded-lg">
              <X size={20} className="text-sky-600" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-hide">
            {menuItems.map((item, idx) => (
              <React.Fragment key={idx}>
                {item.isNested ? (
                  <div className="space-y-1">
                    <button
                      onClick={item.onToggle}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 group hover:bg-sky-100 hover:text-sky-600 border-l-4 border-transparent`}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon size={20} className="group-hover:scale-110 transition-transform" />
                        <span className="font-medium">{item.label}</span>
                      </div>
                      {item.isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    
                    {item.isOpen && (
                      <div className="pl-9 space-y-1 animate-in slide-in-from-top-2 duration-200">
                        {item.subItems.map((sub) => (
                          <NavLink
                            key={sub.path}
                            to={sub.path}
                            onClick={onClose}
                            className={({ isActive }) => `
                              flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200
                              ${isActive 
                                ? 'bg-sky-100 text-sky-600 font-bold' 
                                : 'text-gray-600 hover:bg-sky-50 hover:text-sky-600'}
                            `}
                          >
                            <span className="text-sm">{sub.label}</span>
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group
                      ${isActive 
                        ? 'bg-sky-100 text-sky-600 border-l-4 border-sky-600' 
                        : 'text-gray-700 hover:bg-sky-50 hover:text-sky-600 border-l-4 border-transparent'}
                    `}
                  >
                    <item.icon size={20} className="group-hover:scale-110 transition-transform" />
                    <span className="font-medium">{item.label}</span>
                  </NavLink>
                )}
              </React.Fragment>
            ))}
          </nav>

          {/* User Profile Section */}
          <div className="p-4 border-t border-sky-200 bg-sky-50">
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-500 hover:text-white transition-all font-semibold shadow-sm"
            >
              <LogOutIcon size={18} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;