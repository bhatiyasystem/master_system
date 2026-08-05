import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useDataStore = create(
  persist(
    (set, get) => ({
      // Indent Data
      indentData: [],
      addIndent: (data) => set((state) => ({
        indentData: [...state.indentData, { 
          ...data, 
          id: Date.now(), 
          indentNo: `IND-${String(state.indentData.length + 1).padStart(3, '0')}`,
          createdAt: new Date().toISOString() 
        }]
      })),

      // Social Site Data
      socialSiteData: [],
      moveSocialSiteToHistory: (id) => set((state) => ({
        socialSiteData: state.socialSiteData.map(item => 
          item.id === id ? { ...item, status: 'completed' } : item
        )
      })),

      // Find Enquiry Data
      findEnquiryData: [],
      addEnquiry: (data) => set((state) => ({
        findEnquiryData: [...state.findEnquiryData, { 
          ...data, 
          id: Date.now(),
          candidateEnquiryNo: `EN-${String(state.findEnquiryData.length + 1).padStart(3, '0')}`,
          createdAt: new Date().toISOString() 
        }]
      })),

      // Call Tracker Data
      callTrackerData: [],
      updateCallTracker: (id, data) => set((state) => ({
        callTrackerData: state.callTrackerData.map(item => 
          item.id === id ? { ...item, ...data, lastUpdated: new Date().toISOString() } : item
        )
      })),

      // Employee Data
      employeeData: [],
      addEmployee: (data) => set((state) => ({
        employeeData: [...state.employeeData, { 
          ...data, 
          id: Date.now(),
          employeeId: `EMP-${String(state.employeeData.length + 1).padStart(4, '0')}`,
          status: 'active',
          createdAt: new Date().toISOString() 
        }]
      })),

      // After Joining Work Data
      afterJoiningData: [],
      updateAfterJoining: (id, data) => set((state) => ({
        afterJoiningData: state.afterJoiningData.map(item => 
          item.id === id ? { ...item, ...data, completed: true } : item
        )
      })),

      // Leaving Data
      leavingData: [],
      addLeaving: (data) => set((state) => ({
        leavingData: [...state.leavingData, { 
          ...data, 
          id: Date.now(),
          status: 'pending',
          createdAt: new Date().toISOString() 
        }]
      })),

      // After Leaving Work Data
      afterLeavingData: [],
      updateAfterLeaving: (id, data) => set((state) => ({
        afterLeavingData: state.afterLeavingData.map(item => 
          item.id === id ? { ...item, ...data, completed: true } : item
        )
      })),

      // Employee Attendance Data
      attendanceData: [
        {
          id: 1,
          employeeId: 'EMP-0001',
          date: '2024-01-15',
          checkIn: '09:00',
          checkOut: '18:00',
          status: 'Present',
          workingHours: 9,
          overtime: 0
        },
        {
          id: 2,
          employeeId: 'EMP-0001',
          date: '2024-01-16',
          checkIn: '09:15',
          checkOut: '18:30',
          status: 'Present',
          workingHours: 9.25,
          overtime: 0.25
        },
        {
          id: 3,
          employeeId: 'EMP-0001',
          date: '2024-01-17',
          checkIn: null,
          checkOut: null,
          status: 'Absent',
          workingHours: 0,
          overtime: 0
        }
      ],
      addAttendance: (data) => set((state) => ({
        attendanceData: [...state.attendanceData, { 
          ...data, 
          id: Date.now(),
          createdAt: new Date().toISOString() 
        }]
      })),

      // Leave Requests Data
      leaveRequestsData: [
        {
          id: 1,
          employeeId: 'EMP-0001',
          leaveType: 'Sick Leave',
          fromDate: '2024-01-20',
          toDate: '2024-01-22',
          days: 3,
          reason: 'Medical treatment',
          status: 'Approved',
          appliedDate: '2024-01-18',
          approvedBy: 'HR Manager'
        },
        {
          id: 2,
          employeeId: 'EMP-0001',
          leaveType: 'Annual Leave',
          fromDate: '2024-02-10',
          toDate: '2024-02-12',
          days: 3,
          reason: 'Personal work',
          status: 'Pending',
          appliedDate: '2024-01-25',
          approvedBy: null
        }
      ],
      addLeaveRequest: (data) => set((state) => ({
        leaveRequestsData: [...state.leaveRequestsData, { 
          ...data, 
          id: Date.now(),
          appliedDate: new Date().toISOString().split('T')[0],
          status: 'Pending'
        }]
      })),

      // Salary Data
      salaryData: [
        {
          id: 1,
          employeeId: 'EMP-0001',
          month: 'January 2024',
          basicSalary: 50000,
          allowances: 10000,
          overtime: 2000,
          deductions: 5000,
          netSalary: 57000,
          status: 'Paid',
          payDate: '2024-01-31'
        },
        {
          id: 2,
          employeeId: 'EMP-0001',
          month: 'December 2023',
          basicSalary: 50000,
          allowances: 8000,
          overtime: 1500,
          deductions: 4500,
          netSalary: 55000,
          status: 'Paid',
          payDate: '2023-12-31'
        }
      ],

      // Employee Profile Data
      employeeProfileData: {
        'EMP-0001': {
          employeeId: 'EMP-0001',
          name: 'John Doe',
          email: 'john.doe@company.com',
          phone: '+1234567890',
          department: 'IT',
          designation: 'Software Developer',
          joiningDate: '2023-06-01',
          salary: 50000,
          manager: 'Jane Smith',
          workLocation: 'Head Office',
          employeeType: 'Full Time',
          bloodGroup: 'O+',
          emergencyContact: '+1234567891',
          address: '123 Main St, City, State 12345'
        }
      },

      // Helper function to get filtered data based on user role
      getFilteredData: (dataType, user) => {
        const state = get();
        if (user?.role === 'admin') {
          return state[dataType] || [];
        } else if (user?.role === 'employee') {
          // Filter data for specific employee
          const data = state[dataType] || [];
          if (dataType === 'attendanceData' || dataType === 'leaveRequestsData' || dataType === 'salaryData') {
            return data.filter(item => item.employeeId === user.employeeId);
          }
          return data;
        }
        return [];
      },

      // Initialize data from other stores
      initializeFromIndent: () => {
        const state = get();
        state.indentData.forEach(indent => {
          const existsInSocial = state.socialSiteData.find(item => item.indentId === indent.id);
          if (!existsInSocial) {
            state.socialSiteData.push({
              ...indent,
              indentId: indent.id,
              status: 'pending'
            });
          }
        });
      },

      initializeFromSocial: () => {
        const state = get();
        const completedSocial = state.socialSiteData.filter(item => item.status === 'completed');
        completedSocial.forEach(social => {
          const existsInEnquiry = state.findEnquiryData.find(item => item.indentId === social.indentId);
          if (!existsInEnquiry) {
            // This will be handled when enquiry is created
          }
        });
      }
    }),
    {
      name: 'hr-fms-data-storage',
    }
  )
);

export default useDataStore;