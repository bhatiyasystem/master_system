import React from 'react';
import { Bell, Search, User } from 'lucide-react';
import useAuthStore from '../store/authStore';

const Header = ({ children }) => {
  const { user } = useAuthStore();

  return (
    <header className="bg-white border-b border-white border-opacity-20 shadow-sm flex-shrink-0">
      <div className="flex justify-between items-center py-3 px-4 sm:px-6">
        <div className="flex items-center">
          {children}
          <div className="ml-4 max-w-md hidden sm:block">
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                className="w-full py-2 pl-10 pr-4 rounded-lg border border-white border-opacity-30 focus:outline-none focus:ring-2 focus:ring-white focus:border-white bg-white bg-opacity-10 text-white placeholder-white placeholder-opacity-60"
              />
              <Search
                size={20}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white opacity-60"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Bell size={20} className="text-white opacity-80 cursor-pointer hover:opacity-100" />
            <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500"></span>
          </div>
          <div className="flex items-center space-x-2 cursor-pointer">
            <div className="w-9 h-9 rounded-full bg-white bg-opacity-20 flex items-center justify-center">
              <User size={20} className="text-white" />
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-white">{user?.name || 'Guest'}</p>
              <p className="text-xs text-white opacity-60">Administrator</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;