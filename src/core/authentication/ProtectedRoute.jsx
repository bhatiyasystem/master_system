import { useState, useEffect } from 'react';
import { useLocation, Link, Navigate } from 'react-router-dom';
import * as Lucide from "lucide-react";
import supabase from '../../SupabaseClient';

const ProtectedRoute = ({ children, _allowedRoles = [] }) => {
    const location = useLocation();
    const path = location.pathname;
    
    const username = (localStorage.getItem("user-name") || "").toLowerCase();
    const role = (localStorage.getItem("role") || "").toLowerCase();
    const isSuperAdmin = localStorage.getItem("is-super-admin") === "true" || username === "admin";
    const canSelfAssign = localStorage.getItem("can_self_assign") === "true";

    const [allowedPages, setAllowedPages] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem("allowed-pages") || "[]");
        } catch {
            return [];
        }
    });
    const [allowedSystems, setAllowedSystems] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem("allowed-systems") || "[]");
        } catch {
            return [];
        }
    });
    const [isRevalidating, setIsRevalidating] = useState(false);

    useEffect(() => {
        const handlePermUpdate = () => {
            try {
                setAllowedPages(JSON.parse(localStorage.getItem("allowed-pages") || "[]"));
                setAllowedSystems(JSON.parse(localStorage.getItem("allowed-systems") || "[]"));
            } catch (e) {
                console.error("Error reading permissions:", e);
            }
        };

        window.addEventListener("permissions-updated", handlePermUpdate);
        window.addEventListener("storage", handlePermUpdate);
        return () => {
            window.removeEventListener("permissions-updated", handlePermUpdate);
            window.removeEventListener("storage", handlePermUpdate);
        };
    }, []);

    // Special Case: Allow 'user' role for assign-task and checklist if canSelfAssign is enabled
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
    } else if (path.startsWith("/dashboard/newpete")) {
        currentSystem = "newpete";
    } else if (path.startsWith("/dashboard/greetings")) {
        currentSystem = "greetings";
    } else if (path.startsWith("/dashboard/global-settings") || path.startsWith("/dashboard/master")) {
        currentSystem = "global-settings";
    }

    const isSystemAllowed = allowedSystems.includes(currentSystem) || isLegacySelfAssignAllowed;

    const isBypass = isSuperAdmin || path === "/dashboard" || path === "/dashboard/notifications";

    // If locally blocked, attempt a fast live verify with DB in case permissions were updated
    useEffect(() => {
        if (!isBypass && username && (!isSystemAllowed || !isPageAllowed)) {
            let active = true;
            setIsRevalidating(true);
            const storedUser = localStorage.getItem("user-name");
            if (!storedUser) {
                setIsRevalidating(false);
                return;
            }

            supabase
                .from("users")
                .select("system_access, page_access, role")
                .eq("user_name", storedUser)
                .single()
                .then(({ data: userProfile, error }) => {
                    if (!active || error || !userProfile) return;

                    let slugs = [];
                    if (userProfile.system_access === "all") {
                        slugs = ["checklist-delegation", "mis-summary", "whatsapp-management", "hr-fms", "purchase", "inventory", "newpete", "greetings"];
                    } else if (userProfile.system_access) {
                        slugs = userProfile.system_access.split(",").map(s => s.trim()).filter(Boolean);
                    }

                    const allPurchaseRoutes = [
                        "/dashboard/purchase", "/dashboard/purchase/dashboard", "/dashboard/purchase/indent",
                        "/dashboard/purchase/approval", "/dashboard/purchase/pocreate", "/dashboard/purchase/polist",
                        "/dashboard/purchase/delivery", "/dashboard/purchase/receiving",
                        "/dashboard/purchase/payment-approval", "/dashboard/purchase/payment"
                    ];
                    const allInventoryRoutes = [
                        "/dashboard/inventory", "/dashboard/inventory/dashboard", "/dashboard/inventory/stock",
                        "/dashboard/inventory/transactions", "/dashboard/inventory/reorder", "/dashboard/inventory/indent",
                        "/dashboard/inventory/settings"
                    ];
                    const allNewPeteRoutes = [
                        "/dashboard/newpete", "/dashboard/newpete-add-case", "/dashboard/newpete-expenses",
                        "/dashboard/newpete-ledger", "/dashboard/newpete-settings"
                    ];

                    let rts = [];
                    if (userProfile.page_access === "all") {
                        rts = [
                            "/dashboard/admin", "/dashboard/notifications", "/dashboard/quick-task",
                            "/dashboard/assign-task", "/dashboard/checklist", "/dashboard/maintenance",
                            "/dashboard/repair", "/dashboard/ea-task", "/dashboard/calendar",
                            "/dashboard/task", "/dashboard/training-video", "/dashboard/bulk-import",
                            "/dashboard/holiday-list", "/dashboard/working-day-calendar",
                            "/dashboard/data", "/dashboard/admin-data", "/dashboard/delegation",
                            "/dashboard/delegation-data", "/dashboard/admin-approval",
                            "/dashboard/mis-report", "/dashboard/setting", "/dashboard/global-settings",
                            "/dashboard/mis-summary", "/dashboard/mis-history", "/dashboard/mis-kpi-kra",
                            "/dashboard/whatsapp-history",
                            "/dashboard/hr-dashboard", "/dashboard/hr-indent", "/dashboard/hr-find-enquiry",
                            "/dashboard/hr-call-tracker", "/dashboard/hr-after-joining-work", "/dashboard/hr-leaving",
                            "/dashboard/hr-after-leaving-work", "/dashboard/hr-employee", "/dashboard/hr-my-profile",
                            "/dashboard/hr-my-attendance", "/dashboard/hr-leave-request", "/dashboard/hr-my-salary",
                            "/dashboard/hr-company-calendar", "/dashboard/hr-leave-management", "/dashboard/hr-attendance",
                            "/dashboard/hr-attendancedaily", "/dashboard/hr-report", "/dashboard/hr-payroll",
                            "/dashboard/hr-salary-config", "/dashboard/hr-advance", "/dashboard/hr-puttha", "/dashboard/hr-misreport",
                            ...allPurchaseRoutes,
                            ...allInventoryRoutes,
                            ...allNewPeteRoutes,
                            "/dashboard/greetings-birthdays", "/dashboard/greetings-festival-scheduler"
                        ];
                    } else if (userProfile.page_access) {
                        rts = userProfile.page_access.split(",").map(p => p.trim()).filter(Boolean);
                        if (!rts.includes("/dashboard")) rts.push("/dashboard");
                        if (!rts.includes("/dashboard/notifications")) rts.push("/dashboard/notifications");
                    }

                    if (slugs.length > 0) {
                        localStorage.setItem("allowed-systems", JSON.stringify(slugs));
                        setAllowedSystems(slugs);
                    }
                    if (rts.length > 0) {
                        localStorage.setItem("allowed-pages", JSON.stringify(rts));
                        setAllowedPages(rts);
                    }
                    window.dispatchEvent(new Event("permissions-updated"));
                })
                .finally(() => {
                    if (active) setIsRevalidating(false);
                });

            return () => {
                active = false;
            };
        }
    }, [path, isSystemAllowed, isPageAllowed, isBypass, username]);

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

    if (!isSystemAllowed || !isPageAllowed) {
        if (isRevalidating) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                    <p className="text-xs text-gray-500 font-semibold">Verifying permissions...</p>
                </div>
            );
        }

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
