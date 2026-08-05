import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import Header from './Header';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile sidebar backdrop - now handled inside Sidebar component */}
        {/* Sidebar components - now handled inside Sidebar component */}
      <Sidebar 
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden ">
        {/* Header with mobile menu button */}
        {/* <Header>
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md text-gray-700 md:hidden hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300"
          >
            <span className="sr-only">Open sidebar</span>
            <Menu className="h-6 w-6" />
          </button>
        </Header> */}
        
        <main className="flex-1 overflow-y-auto p-4">
          <div className="container mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>

        {/* Fixed Footer */}
        <footer className="bg-white bg-opacity-95 backdrop-blur-sm border-t border-gray-200 py-3 px-4 flex-shrink-0 shadow-lg">
          <div className="container mx-auto text-center text-sm text-gray-700">
            Powered by{' '}
            <a 
              href="https://www.botivate.in" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-indigo-600 hover:text-indigo-800 font-medium underline"
            >
              Botivate
            </a>
          </div>
        </footer>
      </div>

    
    </div>
  );
};

export default Layout;