import React, { useState } from 'react';
import { Calendar, Clock, BarChart3 } from 'lucide-react';
import DailyTab from './DailyTab';
import MonthlyTab from './MonthlyTab';

export default function EmployeeMIS() {
  const [activeTab, setActiveTab] = useState('daily');

  return (
    <div className="min-h-screen bg-gray-50/60 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-6 shadow-xs border border-gray-200/80">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Employee MIS</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  Daily biometric attendance, break tracking, and monthly performance insights
                </p>
              </div>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center p-1 bg-gray-100 rounded-xl border border-gray-200/80 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab('daily')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'daily'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Daily</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('monthly')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'monthly'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Monthly</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'daily' ? <DailyTab /> : <MonthlyTab />}
      </div>
    </div>
  );
}
