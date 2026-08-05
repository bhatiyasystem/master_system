import { BrowserRouter as _Router, Router, Routes, Route, Navigate } from 'react-router-dom';
;

function App() {
  return (
    <div className="gradient-bg min-h-screen">
      <Router>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="indent" element={<Indent />} />
            {/* <Route path="social-site" element={<SocialSite />} /> */}
            <Route path="find-enquiry" element={<FindEnquiry />} />
            <Route path="call-tracker" element={<CallTracker />} />
            <Route path="after-joining-work" element={<AfterJoiningWork />} />
            <Route path="leaving" element={<Leaving />} />
            <Route path="after-leaving-work" element={<AfterLeavingWork />} />
            <Route path="employee" element={<Employee />} />
            <Route path="my-profile" element={<MyProfile />} />
            <Route path="my-attendance" element={<MyAttendance />} />
            <Route path="leave-request" element={<LeaveRequest />} />
            <Route path="my-salary" element={<MySalary />} />
            <Route path="company-calendar" element={<CompanyCalendar />} />
             <Route path="leave-management" element={<LeaveManagement />} />
              <Route path="attendance" element={<Attendance />} />
              <Route path="attendancedaily" element={<Attendancedaily />} />
              <Route path="report" element={<Report />} />
              <Route path="payroll" element={<Payroll />} />
              <Route path="salary-config" element={<SalaryConfig />} />
              <Route path="advance" element={<Advance />} />
              <Route path="puttha" element={<Puttha />} />
              <Route path="misreport" element={<MisReport />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;