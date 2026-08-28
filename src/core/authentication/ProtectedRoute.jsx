import { useLocation,Link, Navigate } from 'react-router-dom';
import * as Lucide from "lucide-react";


const ProtectedRoute = ({ children, _allowedRoles = [] }) => {
    const location = useLocation();
    const path = location.pathname;
    
    const username = (localStorage.getItem("user-name") || "").toLowerCase();
    const role = (localStorage.getItem("role") || "").toLowerCase();
    const isSuperAdmin = localStorage.getItem("is-super-admin") === "true" || username === "admin";
    const canSelfAssign = localStorage.getItem("can_self_assign") === "true";

    if (!username) {
        return <Navigate to="/login" replace />;
    }

    // Super Admin has access to everything
    if (isSuperAdmin) {
        return children;
    }

    // If path is core home, allow access
    if (path === "/dashboard" || path === "/dashboard/notifications") {
        return children;
    }

    // Retrieve allowed systems & pages cached from DB
    const allowedPages = JSON.parse(localStorage.getItem("allowed-pages") || "[]");
    const allowedSystems = JSON.parse(localStorage.getItem("allowed-systems") || "[]");

    // Special Case: Allow 'user' role for assign-task and checklist if canSelfAssign is enabled
    // We keep this legacy logic as a fallback override
    const isLegacySelfAssignAllowed = 
        (path.startsWith("/dashboard/assign-task") || path.startsWith("/dashboard/checklist")) && 
        role === "user" && 
        canSelfAssign;

    // Check if the route is explicitly allowed in cached page permissions
    const isPageAllowed = allowedPages.some(route => {
        if (route.includes("/:")) {
            const cleanRoute = route.split("/:")[0];
            return path === cleanRoute || path.startsWith(cleanRoute + "/");
        }
        return path === route;
    }) || isLegacySelfAssignAllowed;

    // Determine system from path
    let currentSystem = "checklist-delegation";
    if (path.startsWith("/dashboard/mis-")) {
        currentSystem = "mis-summary";
    } else if (path.startsWith("/dashboard/hr-")) {
        currentSystem = "hr-fms";
    } else if (path.startsWith("/dashboard/whatsapp-")) {
        currentSystem = "whatsapp-management";
    } else if (path.startsWith("/dashboard/purchase")) {
        currentSystem = "purchase";
    } else if (path.startsWith("/dashboard/inventory")) {
        currentSystem = "inventory";
    } else if (path.startsWith("/dashboard/global-settings") || path.startsWith("/dashboard/master")) {
        currentSystem = "global-settings";
    }

    const isSystemAllowed = allowedSystems.includes(currentSystem) || isLegacySelfAssignAllowed;

    if (!isSystemAllowed || !isPageAllowed) {
        console.warn(`🛑 Route Guard: Blocked access to ${path}. System: ${currentSystem}, PageAllowed: ${isPageAllowed}`);
        
        // Render a premium 403 - Access Denied page
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center">
                <div className="bg-white border border-red-100 rounded-3xl p-8 md:p-12 shadow-xl max-w-md w-full relative overflow-hidden">
                    <div className="absolute -right-10 -top-10 opacity-5 text-red-500">
                        <Lucide.ShieldAlert size={160} />
                    </div>
                    
                    <div className="mx-auto w-20 h-20 bg-red-50 rounded-2xl flex items-center justify-center mb-6 ring-4 ring-red-50/50">
                        <Lucide.Lock className="text-red-500" size={36} strokeWidth={2.5} />
                    </div>

                    <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2">403 - Access Denied</h1>
                    <p className="text-sm text-gray-500 leading-relaxed mb-8">
                        Oops! You do not have permission to access this page. Please contact your system administrator to request system or page access.
                    </p>

                    <div className="flex flex-col gap-3">
                        <Link
                            to="/dashboard"
                            className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all active:scale-95 text-xs uppercase tracking-wider"
                        >
                            Return to Dashboard
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return children;
};

export default ProtectedRoute;
