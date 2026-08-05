import React, { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  Users,
  UserCheck,
  UserX,
  UserPlus,
  TrendingUp,
  Clock
} from 'lucide-react';
import supabase from '../services/supabaseHRClient';

const Dashboard = () => {
  const [totalEmployee, setTotalEmployee] = useState(0);
  const [activeEmployee, setActiveEmployee] = useState(0);
  const [leftEmployee, setLeftEmployee] = useState(0);
  const [leaveThisMonth, setLeaveThisMonth] = useState(0);
  const [monthlyHiringData, setMonthlyHiringData] = useState([]);
  const [designationData, setDesignationData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Data for employee status distribution chart
  const employeeStatusData = [
    { name: 'Active', value: activeEmployee, color: '#10B981' },
    { name: 'Resigned', value: leftEmployee, color: '#EF4444' }
  ];

  useEffect(() => {
    let isMounted = true;

    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const startTotalLoad = performance.now();
        const startDbFetch = performance.now();

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const startOfMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;

        // Individual timing trackers for dev mode metrics
        const t1 = performance.now();
        const totalPromise = supabase.from('employees').select('id', { count: 'exact', head: true }).then(r => ({ res: r, dur: performance.now() - t1 }));

        const t2 = performance.now();
        const activePromise = supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'active').then(r => ({ res: r, dur: performance.now() - t2 }));

        const t3 = performance.now();
        const leftPromise = supabase.from('employees').select('id', { count: 'exact', head: true }).neq('status', 'active').then(r => ({ res: r, dur: performance.now() - t3 }));

        const t4 = performance.now();
        const leaveMonthPromise = supabase.from('employees').select('id', { count: 'exact', head: true }).gte('date_of_leaving', startOfMonthStr).then(r => ({ res: r, dur: performance.now() - t4 }));

        const t5 = performance.now();
        const empDataPromise = supabase.from('employees').select('status, date_of_joining, date_of_leaving, designation').then(r => ({ res: r, dur: performance.now() - t5 }));

        const t6 = performance.now();
        const attendanceSummaryPromise = supabase.from('attendance_monthly').select('id', { count: 'exact', head: true }).eq('year', currentYear).eq('month', currentMonth + 1).then(r => ({ res: r, dur: performance.now() - t6 }));

        const [totalObj, activeObj, leftObj, leaveMonthObj, empDataObj, attSummaryObj] = await Promise.all([
          totalPromise, activePromise, leftPromise, leaveMonthPromise, empDataPromise, attendanceSummaryPromise
        ]);

        const dbFetchTotal = performance.now() - startDbFetch;

        if (!isMounted) return;

        const startStateUpdate = performance.now();

        const totalRes = totalObj.res;
        const activeRes = activeObj.res;
        const leftRes = leftObj.res;
        const thisMonthLeaveRes = leaveMonthObj.res;
        const empDataRes = empDataObj.res;

        const data = empDataRes.data || [];
        
        let activeCount = activeRes.count !== null && activeRes.count !== undefined ? activeRes.count : 0;
        let leftCount = leftRes.count !== null && leftRes.count !== undefined ? leftRes.count : 0;
        let thisMonthLeaveCount = thisMonthLeaveRes.count !== null && thisMonthLeaveRes.count !== undefined ? thisMonthLeaveRes.count : 0;

        const designationCounts = {};
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // Prepare last 6 months data structure
        const monthlyHiring = {};
        const monthlyLeaving = {};
        const monthKeysInOrder = [];

        for (let i = 5; i >= 0; i--) {
          const d = new Date(currentYear, currentMonth - i, 1);
          const monthName = months[d.getMonth()];
          const yearNum = d.getFullYear();
          const monthYear = `${monthName} ${yearNum}`;

          monthKeysInOrder.push({
            label: monthName,
            key: monthYear
          });
          monthlyHiring[monthYear] = 0;
          monthlyLeaving[monthYear] = 0;
        }

        const parseDate = (dateVal) => {
          if (!dateVal) return null;
          if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? null : dateVal;
          const d = new Date(dateVal);
          return isNaN(d.getTime()) ? null : d;
        };

        // Fallback calculations if count queries return null
        let fallbackActive = 0;
        let fallbackLeft = 0;
        let fallbackThisMonthLeave = 0;

        data.forEach(row => {
          const statusStr = row.status?.toString().trim().toLowerCase();
          const doj = parseDate(row.date_of_joining);
          const dol = parseDate(row.date_of_leaving);

          const isLeft = statusStr === 'left' || statusStr === 'resigned' || statusStr === 'inactive' || Boolean(dol && statusStr !== 'active');
          const isActive = statusStr === 'active' || (!statusStr && !dol);

          if (isActive) fallbackActive++;
          else if (isLeft) fallbackLeft++;
          else fallbackActive++;

          if (dol && dol.getMonth() === currentMonth && dol.getFullYear() === currentYear) {
            fallbackThisMonthLeave++;
          }

          // Aggregate monthly hiring
          if (doj) {
            const dojKey = `${months[doj.getMonth()]} ${doj.getFullYear()}`;
            if (Object.prototype.hasOwnProperty.call(monthlyHiring, dojKey)) {
              monthlyHiring[dojKey]++;
            }
          }

          // Aggregate monthly leaving
          if (dol) {
            const dolKey = `${months[dol.getMonth()]} ${dol.getFullYear()}`;
            if (Object.prototype.hasOwnProperty.call(monthlyLeaving, dolKey)) {
              monthlyLeaving[dolKey]++;
            }
          }

          // Aggregate designation counts
          const designation = row.designation?.toString().trim();
          if (designation) {
            designationCounts[designation] = (designationCounts[designation] || 0) + 1;
          }
        });

        if (totalRes.error || activeRes.error || leftRes.error) {
          activeCount = fallbackActive;
          leftCount = fallbackLeft;
          thisMonthLeaveCount = fallbackThisMonthLeave;
        }

        const formattedMonthlyData = monthKeysInOrder.map(item => ({
          month: item.label,
          hired: monthlyHiring[item.key] || 0,
          left: monthlyLeaving[item.key] || 0
        }));

        const formattedDesignationData = Object.keys(designationCounts).map(desig => ({
          designation: desig,
          employees: designationCounts[desig]
        }));

        setTotalEmployee(totalRes.count ?? data.length);
        setActiveEmployee(activeCount);
        setLeftEmployee(leftCount);
        setLeaveThisMonth(thisMonthLeaveCount);
        setMonthlyHiringData(formattedMonthlyData);
        setDesignationData(formattedDesignationData);

        const stateUpdateDur = performance.now() - startStateUpdate;

        // Dev Mode Performance Logger
        if (import.meta.env.DEV) {
          const renderStart = performance.now();
          requestAnimationFrame(() => {
            const dashboardRender = performance.now() - renderStart;
            const totalDashboardLoad = performance.now() - startTotalLoad;

            console.log(
              `\n================ HR FMS Dashboard Performance ================\n\n` +
              `Employee Count Query        : ${Math.round(totalObj.dur)} ms\n` +
              `Active Employee Query       : ${Math.round(activeObj.dur)} ms\n` +
              `Left Employee Query         : ${Math.round(leftObj.dur)} ms\n` +
              `Designation Query           : ${Math.round(empDataObj.dur)} ms\n` +
              `Monthly Hiring Query        : ${Math.round(empDataObj.dur)} ms\n` +
              `Attendance Query            : ${Math.round(attSummaryObj.dur)} ms\n\n` +
              `--------------------------------------------------------------\n\n` +
              `Database Fetch Total        : ${Math.round(dbFetchTotal)} ms\n` +
              `React State Update          : ${Math.round(stateUpdateDur)} ms\n` +
              `Dashboard Render            : ${Math.round(dashboardRender)} ms\n\n` +
              `--------------------------------------------------------------\n\n` +
              `Dashboard Total Load        : ${Math.round(totalDashboardLoad)} ms\n\n` +
              `==============================================================\n`
            );
          });
        }

      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDashboardData();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-6 page-content p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">HR Dashboard</h1>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-lg border p-6 flex items-start">
          <div className="p-3 rounded-full bg-blue-100 mr-4">
            <Users size={24} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600 font-medium">Total Employees</p>
            <h3 className="text-2xl font-bold text-gray-800">{loading ? '...' : totalEmployee}</h3>
            <p className="text-xs text-green-600 mt-1">+12% from last month</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg border p-6 flex items-start">
          <div className="p-3 rounded-full bg-green-100 mr-4">
            <UserCheck size={24} className="text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600 font-medium">Active Employees</p>
            <h3 className="text-2xl font-bold text-gray-800">{loading ? '...' : activeEmployee}</h3>
            <p className="text-xs text-green-600 mt-1">+8% from last month</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg border p-6 flex items-start">
          <div className="p-3 rounded-full bg-amber-100 mr-4">
            <Clock size={24} className="text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600 font-medium">On Resigned</p>
            <h3 className="text-2xl font-bold text-gray-800">{loading ? '...' : leftEmployee}</h3>
            <p className="text-xs text-amber-600 mt-1">2 pending approvals</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg border p-6 flex items-start">
          <div className="p-3 rounded-full bg-red-100 mr-4">
            <UserX size={24} className="text-red-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600 font-medium">Left This Month</p>
            <h3 className="text-2xl font-bold text-gray-800">{loading ? '...' : leaveThisMonth}</h3>
            <p className="text-xs text-red-600 mt-1">2 resignations, 1 termination</p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-lg border p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
            <Users size={20} className="mr-2" />
            Employee Status Distribution
          </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={employeeStatusData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {employeeStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ color: '#374151' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg border p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
            <TrendingUp size={20} className="mr-2" />
            Monthly Hiring vs Attrition
          </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyHiringData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                <XAxis dataKey="month" stroke="#374151" />
                <YAxis stroke="#374151" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    color: '#374151'
                  }}
                />
                <Legend wrapperStyle={{ color: '#374151' }} />
                <Bar dataKey="hired" name="Hired" fill="#10B981" />
                <Bar dataKey="left" name="Left" fill="#EF4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
          <UserPlus size={20} className="mr-2" />
          Designation-wise Employee Count
        </h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={designationData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
              <XAxis dataKey="designation" stroke="#374151" />
              <YAxis stroke="#374151" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  color: '#374151'
                }}
              />
              <Bar dataKey="employees" name="Employees">
                {designationData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={index % 3 === 0 ? '#EF4444' : index % 3 === 1 ? '#10B981' : '#3B82F6'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;