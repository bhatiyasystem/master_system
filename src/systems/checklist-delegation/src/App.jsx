

import { BrowserRouter as _Router, Navigate, Router, Routes, Route } from 'react-router-dom'
import "./index.css"

// --- Page Imports ---
// New
// New
// New
// New
// New
// New

// --- Data & Delegation Imports ---
// New
// New
// New

// --- Components ---


// --- Auth Wrapper ---
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
    const username = (localStorage.getItem("user-name") || "").toLowerCase();
    const role = (localStorage.getItem("role") || "").toLowerCase();
    const canSelfAssign = localStorage.getItem("can_self_assign") === "true";
    const path = window.location.pathname;

    if (!username) {
        return <Navigate to="/login" replace />
    }

    console.log(`🛣️ Route Guard: ${path} | Role: ${role} | SelfAssign: ${canSelfAssign}`);

    // Special Case: Allow 'user' role for assign-task and checklist if canSelfAssign is enabled
    if (path.startsWith("/dashboard/assign-task") || path.startsWith("/dashboard/checklist")) {
        if (role === "user" && canSelfAssign) {
            return children;
        }
    }

    if (allowedRoles.length > 0 && !allowedRoles.map(r => r.toLowerCase()).includes(role)) {
        console.warn(`🛑 Route Guard: Access denied to ${path} for role ${role}`);
        return <Navigate to="/dashboard/admin" replace />
    }

    return children
}

const SuperAdminRoute = ({ children }) => {
    const username = (localStorage.getItem("user-name") || "").toLowerCase();
    const role = (localStorage.getItem("role") || "").toLowerCase();

    if (!username || username !== "admin" || role !== "admin") {
        return <Navigate to="/dashboard/admin" replace />
    }

    return children
}

function App() {
    return (
        <MagicToastProvider>
            <Router>
                {/* Realtime listener handles logout logic across tabs */}
                <RealtimeLogoutListener />

                <Routes>
                    {/* --- Public Routes --- */}
                    <Route path="/" element={<Navigate to="/login" replace />} />
                    <Route path="/login" element={<LoginPage />} />

                    {/* --- Main Dashboard Redirect --- */}
                    {/* Redirects /dashboard to /dashboard/admin to ensure canonical URL */}
                    <Route path="/dashboard" element={<Navigate to="/dashboard/admin" replace />} />

                    {/* --- Core Dashboard Routes --- */}
                    <Route
                        path="/dashboard/admin"
                        element={
                            <ProtectedRoute>
                                <AdminDashboard />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/dashboard/demo"
                        element={
                            <ProtectedRoute>
                                <Demo />
                            </ProtectedRoute>
                        }
                    />

                    {/* --- Task Management (Admin Only) --- */}
                    <Route
                        path="/dashboard/assign-task"
                        element={
                            <ProtectedRoute allowedRoles={["admin", "HOD", "user"]}>
                                <AdminAssignTask />
                            </ProtectedRoute>
                        }
                    />

                    {/* --- Operational Tasks (All Authenticated Users) --- */}
                    {/* Based on snippet 2, these are open to all users. Add allowedRoles={['admin']} if they should be restricted. */}
                    <Route
                        path="/dashboard/quick-task"
                        element={
                            <ProtectedRoute>
                                <QuickTask />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard/checklist"
                        element={
                            <ProtectedRoute>
                                <ChecklistTask />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard/maintenance"
                        element={
                            <ProtectedRoute>
                                <MaintenanceTask />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard/repair"
                        element={
                            <ProtectedRoute>
                                <RepairTask />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard/ea-task"
                        element={
                            <ProtectedRoute>
                                <EATask />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard/calendar"
                        element={
                            <ProtectedRoute>
                                <CalendarPage />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/dashboard/task"
                        element={
                            <ProtectedRoute>
                                <AllTasks />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/dashboard/training-video"
                        element={
                            <ProtectedRoute>
                                <TrainingVideo />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/dashboard/bulk-import"
                        element={
                            <ProtectedRoute allowedRoles={["admin", "HOD"]}>
                                <BulkImport />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/dashboard/holiday-list"
                        element={
                            <SuperAdminRoute>
                                <HolidayListPage />
                            </SuperAdminRoute>
                        }
                    />

                    <Route
                        path="/dashboard/working-day-calendar"
                        element={
                            <ProtectedRoute>
                                <WorkingDayCalendarPage />
                            </ProtectedRoute>
                        }
                    />

                    {/* --- Data & Reporting (Admin Only) --- */}
                    <Route
                        path="/dashboard/data"
                        element={
                            <ProtectedRoute allowedRoles={["admin", "HOD"]}>
                                <DataPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard/data/:category"
                        element={
                            <ProtectedRoute>
                                <DataPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard/admin-data"
                        element={
                            <ProtectedRoute allowedRoles={["admin", "HOD"]}>
                                <AdminDataPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard/delegation"
                        element={
                            <ProtectedRoute>
                                <AccountDataPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard/delegation-data"
                        element={
                            <ProtectedRoute allowedRoles={["admin", "HOD"]}>
                                <AdminDelegationTask />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard/admin-approval"
                        element={
                            <ProtectedRoute allowedRoles={["admin", "HOD"]}>
                                <AdminApprovalPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard/mis-report"
                        element={
                            <ProtectedRoute allowedRoles={["admin"]}>
                                <MisReport />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard/notifications"
                        element={
                            <ProtectedRoute>
                                <NotificationsPage />
                            </ProtectedRoute>
                        }
                    />


                    {/* --- Settings (Admin Only) --- */}
                    <Route
                        path="/dashboard/setting"
                        element={
                            <SuperAdminRoute>
                                <Setting />
                            </SuperAdminRoute>
                        }
                    />

                    {/* --- Backward Compatibility Redirects (From Snippet 1) --- */}
                    {/* These catch old URLs and forward them to the new structure */}
                    <Route path="/admin/*" element={<Navigate to="/dashboard/admin" replace />} />
                    <Route path="/admin/dashboard" element={<Navigate to="/dashboard/admin" replace />} />
                    <Route path="/admin/quick" element={<Navigate to="/dashboard/quick-task" replace />} />
                    <Route path="/admin/assign-task" element={<Navigate to="/dashboard/assign-task" replace />} />
                    <Route path="/admin/delegation-task" element={<Navigate to="/dashboard/delegation-data" replace />} />
                    <Route path="/admin/mis-report" element={<Navigate to="/dashboard/mis-report" replace />} />
                    <Route path="/user/*" element={<Navigate to="/dashboard/admin" replace />} />

                </Routes>
            </Router>
        </MagicToastProvider>
    )
}

export default App