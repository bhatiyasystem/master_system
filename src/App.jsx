import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";

// --- Core Pages & Layouts ---
import LoginPage from "./pages/LoginPage";
import CoreDashboard from "./core/components/CoreDashboard";
import GlobalSettings from "./core/pages/GlobalSettings";
import MasterLayout from "./core/layout/MasterLayout";
import ProtectedRoute from "./core/authentication/ProtectedRoute";
import SuperAdminRoute from "./core/authentication/SuperAdminRoute";
import RealtimeLogoutListener from "./components/RealtimeLogoutListener";
import { MagicToastProvider } from "./context/MagicToastContext";
import systemRegistry from "./core/registry/systemRegistry";

// --- System Module Registrations ---
import "./systems/checklist-delegation";
import "./systems/mis_summary/index.jsx"; // MIS Summary system
import "./systems/whatsapp-management";
import "./systems/HR_fms";
import "./systems/greetings";
import "./systems/inventory";
import "./systems/purchase";

function App() {
  const systems = systemRegistry.getAllSystems();

  return (
    <MagicToastProvider>
      <Router>
        {/* Realtime listener handles logout logic across tabs */}
        <RealtimeLogoutListener />

        <Routes>
          {/* --- Public Routes --- */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />

          {/* --- Master Layout Protected Shell --- */}
          <Route element={<MasterLayout />}>
            {/* Core Platform Dashboard */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <CoreDashboard />
                </ProtectedRoute>
              }
            />

            {/* Global Settings */}
            <Route
              path="/dashboard/global-settings"
              element={
                <ProtectedRoute>
                  <SuperAdminRoute>
                    <GlobalSettings />
                  </SuperAdminRoute>
                </ProtectedRoute>
              }
            />

            {/* Dynamically register routes of all registered systems */}
            {systems.map((sys) =>
              sys.routes.map((route) => {
                let element = route.element;
                if (route.protected) {
                  if (route.superAdminOnly) {
                    element = <SuperAdminRoute>{element}</SuperAdminRoute>;
                  } else {
                    element = (
                      <ProtectedRoute allowedRoles={route.allowedRoles}>
                        {element}
                      </ProtectedRoute>
                    );
                  }
                }

                return (
                  <Route
                    key={route.path}
                    path={route.path}
                    element={element}
                  />
                );
              })
            )}
          </Route>

          {/* --- Backward Compatibility Redirects --- */}
          <Route path="/admin/*" element={<Navigate to="/dashboard/admin" replace />} />
          <Route path="/admin/dashboard" element={<Navigate to="/dashboard/admin" replace />} />
          <Route path="/admin/quick" element={<Navigate to="/dashboard/quick-task" replace />} />
          <Route path="/admin/assign-task" element={<Navigate to="/dashboard/assign-task" replace />} />
          <Route path="/admin/delegation-task" element={<Navigate to="/dashboard/delegation-data" replace />} />
          <Route path="/admin/mis-report" element={<Navigate to="/dashboard/mis-report" replace />} />
          <Route path="/user/*" element={<Navigate to="/dashboard/admin" replace />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </MagicToastProvider>
  );
}

export default App;