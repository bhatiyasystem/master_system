import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, Link, Outlet } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import * as Lucide from "lucide-react";
import bhatiyaLogo from "../../assets/bhatiya_Logo.jpg";
import supabase from "../../SupabaseClient";
import { fetchNotifications } from '../../redux/slice/notificationSlice';
import systemRegistry from "../registry/systemRegistry";
import { usePurchasePendingCounts } from '../../systems/purchase/hooks/usePurchasePendingCounts';
import { useHrFmsPendingCounts } from '../../systems/HR_fms/src/hooks/useHrFmsPendingCounts';
import { useChecklistDelegationPendingCounts } from '../../systems/checklist-delegation/src/hooks/usePendingCounts';

export default function MasterLayout({ darkMode, toggleDarkMode, _showLayout = true }) {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { list: notifications } = useSelector((state) => state.notifications);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [userRole, setUserRole] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [profileImage, setProfileImage] = useState("");
  const [isUserPopupOpen, setIsUserPopupOpen] = useState(false);

  // Keep track of expanded state
  const [expandedSystems, setExpandedSystems] = useState({});
  const [expandedSubmenus, setExpandedSubmenus] = useState({});
  const [allowedSystems, setAllowedSystems] = useState([]);
  const [allowedPages, setAllowedPages] = useState([]);

  // Sync profile details and fetch RBAC permissions
  useEffect(() => {
    const storedUsername = localStorage.getItem("user-name");
    const storedRole = localStorage.getItem("role");
    const storedEmail = localStorage.getItem("email_id");

    if (!storedUsername) {
      navigate("/login");
      return;
    }

    setUsername(storedUsername);
    setUserRole(storedRole || "user");
    setUserEmail(storedEmail);

    const cachedImage = localStorage.getItem("profile_image");
    setProfileImage(cachedImage || "");

    // ── FETCH RBAC PERMISSIONS FROM DB ────────────────────────────────────
    const fetchPermissionsAndProfile = async () => {
      try {
        // Sync profile image and permissions
        const { data: userProfile } = await supabase
          .from("users")
          .select("id, profile_image, role, system_access, page_access")
          .eq("user_name", storedUsername)
          .single();

        if (userProfile) {
          if (userProfile.profile_image) {
            setProfileImage(userProfile.profile_image);
            localStorage.setItem("profile_image", userProfile.profile_image);
          }

          const _userId = userProfile.id;
          const userRoleName = userProfile.role || storedRole || "user";
          setUserRole(userRoleName);
          localStorage.setItem("role", userRoleName);

          const roleLower = userRoleName.toLowerCase();
          const isLegacyAdmin = roleLower === "admin" || roleLower === "super admin" || roleLower === "superadmin" || storedUsername.toLowerCase() === "admin";

          setIsSuperAdmin(isLegacyAdmin);
          localStorage.setItem("is-super-admin", isLegacyAdmin ? "true" : "false");

          // Parse allowed systems from database
          let systemSlugs = [];
          if (userProfile.system_access === "all") {
            systemSlugs = ["checklist-delegation", "mis-summary", "whatsapp-management", "hr-fms", "purchase", "inventory", "newpete", "greetings"];
          } else if (userProfile.system_access === "none") {
            systemSlugs = [];
          } else if (userProfile.system_access) {
            systemSlugs = userProfile.system_access.split(",").map(s => s.trim()).filter(Boolean);
          } else {
            // Fallback to active systems
            systemSlugs = ["checklist-delegation", "mis-summary", "whatsapp-management", "hr-fms", "purchase", "inventory", "newpete", "greetings"];
          }

          setAllowedSystems(systemSlugs);
          localStorage.setItem("allowed-systems", JSON.stringify(systemSlugs));

          // Define potential routes based on role
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

          let potentialRoutes = [];
          if (isLegacyAdmin) {
            potentialRoutes = [
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
          } else if (roleLower === "hod") {
            potentialRoutes = [
              "/dashboard/admin", "/dashboard/notifications", "/dashboard/assign-task",
              "/dashboard/delegation", "/dashboard/task", "/dashboard/calendar",
              "/dashboard/training-video", "/dashboard/bulk-import", "/dashboard/delegation-data",
              "/dashboard/admin-approval",
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
              ...allNewPeteRoutes
            ];
          } else {
            potentialRoutes = [
              "/dashboard/admin", "/dashboard/notifications", "/dashboard/delegation",
              "/dashboard/task", "/dashboard/calendar", "/dashboard/training-video",
              "/dashboard/mis-summary", "/dashboard/mis-history", "/dashboard/mis-kpi-kra",
              "/dashboard/whatsapp-history",
              "/dashboard/hr-dashboard", "/dashboard/hr-my-profile", "/dashboard/hr-my-attendance",
              "/dashboard/hr-leave-request", "/dashboard/hr-my-salary", "/dashboard/hr-company-calendar",
              "/dashboard/hr-advance", "/dashboard/hr-puttha",
              ...allPurchaseRoutes,
              ...allInventoryRoutes,
              ...allNewPeteRoutes
            ];
          }

          // Parse allowed pages
          let finalAllowedPages = [];
          if (userProfile.page_access === "all") {
            finalAllowedPages = potentialRoutes;
          } else if (userProfile.page_access === "none") {
            finalAllowedPages = ["/dashboard", "/dashboard/notifications"];
          } else if (userProfile.page_access) {
            finalAllowedPages = userProfile.page_access.split(",").map(p => p.trim()).filter(Boolean);
            // Always ensure the home dashboards and notifications are allowed for security
            if (!finalAllowedPages.includes("/dashboard")) finalAllowedPages.push("/dashboard");
            if (!finalAllowedPages.includes("/dashboard/notifications")) finalAllowedPages.push("/dashboard/notifications");
          } else {
            // Fallback: Filter potential routes based on allowed systems
            finalAllowedPages = potentialRoutes.filter(route => {
              if (route.startsWith("/dashboard/mis-")) {
                return systemSlugs.includes("mis-summary");
              }
              if (route.startsWith("/dashboard/hr-")) {
                return systemSlugs.includes("hr-fms");
              }
              if (route === "/dashboard/whatsapp-history") {
                return systemSlugs.includes("whatsapp-management");
              }
              if (route.startsWith("/dashboard/purchase")) {
                return systemSlugs.includes("purchase");
              }
              if (route.startsWith("/dashboard/inventory")) {
                return systemSlugs.includes("inventory");
              }
              if (route.startsWith("/dashboard/newpete")) {
                return systemSlugs.includes("newpete");
              }
              if (route.startsWith("/dashboard/greetings")) {
                return systemSlugs.includes("greetings");
              }
              if (route === "/dashboard" || route === "/dashboard/setting" || route === "/dashboard/global-settings") {
                return true;
              }
              // Default to checklist-delegation routes
              return systemSlugs.includes("checklist-delegation");
            });
          }

          setAllowedPages(finalAllowedPages);
          localStorage.setItem("allowed-pages", JSON.stringify(finalAllowedPages));
          window.dispatchEvent(new Event("permissions-updated"));
        }
      } catch (err) {
        console.warn("⚠️ Profile sync failed, falling back to legacy localStorage permissions:", err.message);

        // Graceful legacy fallback
        const roleLower = (storedRole || "user").toLowerCase();
        const isLegacyAdmin = roleLower === "admin" || roleLower === "super admin" || roleLower === "superadmin" || storedUsername.toLowerCase() === "admin";

        setIsSuperAdmin(isLegacyAdmin);
        localStorage.setItem("is-super-admin", isLegacyAdmin ? "true" : "false");
        const sysList = ["checklist-delegation", "mis-summary", "whatsapp-management", "hr-fms", "purchase", "inventory", "newpete", "greetings"];
        setAllowedSystems(sysList);
        localStorage.setItem("allowed-systems", JSON.stringify(sysList));

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

        if (isLegacyAdmin) {
          const allRts = [
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
          setAllowedPages(allRts);
          localStorage.setItem("allowed-pages", JSON.stringify(allRts));
        } else if (roleLower === "hod") {
          const hodRts = [
            "/dashboard/admin", "/dashboard/notifications", "/dashboard/assign-task",
            "/dashboard/delegation", "/dashboard/task", "/dashboard/calendar",
            "/dashboard/training-video", "/dashboard/bulk-import", "/dashboard/delegation-data",
            "/dashboard/admin-approval",
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
            ...allNewPeteRoutes
          ];
          setAllowedPages(hodRts);
          localStorage.setItem("allowed-pages", JSON.stringify(hodRts));
        } else {
          const userRts = [
            "/dashboard/admin", "/dashboard/notifications", "/dashboard/delegation",
            "/dashboard/task", "/dashboard/calendar", "/dashboard/training-video",
            "/dashboard/mis-summary", "/dashboard/mis-history", "/dashboard/mis-kpi-kra",
            "/dashboard/whatsapp-history",
            "/dashboard/hr-dashboard", "/dashboard/hr-my-profile", "/dashboard/hr-my-attendance",
            "/dashboard/hr-leave-request", "/dashboard/hr-my-salary", "/dashboard/hr-company-calendar",
            "/dashboard/hr-advance", "/dashboard/hr-puttha",
            ...allPurchaseRoutes,
            ...allInventoryRoutes,
            ...allNewPeteRoutes
          ];
          setAllowedPages(userRts);
          localStorage.setItem("allowed-pages", JSON.stringify(userRts));
        }
        window.dispatchEvent(new Event("permissions-updated"));
      }
    };

    if (storedUsername) {
      fetchPermissionsAndProfile();
    }
  }, [navigate]);

  // Fetch notifications
  useEffect(() => {
    const role = localStorage.getItem("role");
    const userId = localStorage.getItem("user-id");
    if (role) {
      dispatch(fetchNotifications({ role: role.toLowerCase(), userId }));
    }
  }, [dispatch, location.pathname]);

  // Expand systems automatically if current route is inside them
  useEffect(() => {
    const systemsList = systemRegistry.getAllSystems();
    const currentPath = location.pathname;

    const newExpandedSystems = { ...expandedSystems };
    const newExpandedSubmenus = { ...expandedSubmenus };

    systemsList.forEach((sys) => {
      let isSystemActive = false;

      if (sys.menuItems) {
        sys.menuItems.forEach((item) => {
          if (item.href && currentPath.startsWith(item.href)) {
            isSystemActive = true;
          }
          if (item.subItems) {
            item.subItems.forEach((sub) => {
              if (sub.href && currentPath.startsWith(sub.href)) {
                isSystemActive = true;
                newExpandedSubmenus[item.label] = true;
              }
            });
          }
        });
      }

      if (isSystemActive) {
        newExpandedSystems[sys.id] = true;
      }
    });

    setExpandedSystems(newExpandedSystems);
    setExpandedSubmenus(newExpandedSubmenus);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const toggleSystem = (systemId) => {
    setExpandedSystems((prev) => ({
      ...prev,
      [systemId]: !prev[systemId],
    }));
  };

  const toggleSubmenu = (menuLabel) => {
    setExpandedSubmenus((prev) => ({
      ...prev,
      [menuLabel]: !prev[menuLabel],
    }));
  };

  const activeSystemInfo = useMemo(() => {
    const currentPath = location.pathname;

    if (currentPath === "/dashboard") {
      return { title: "Bhatia Enterprises", subtitle: "Master System Platform" };
    }

    const systemsList = systemRegistry.getAllSystems();
    for (const sys of systemsList) {
      if (sys.routes) {
        const hasRoute = sys.routes.some(route => {
          const cleanRoute = route.path.split("/:")[0];
          return currentPath.startsWith(cleanRoute);
        });
        if (hasRoute) {
          return { title: sys.name, subtitle: "Bhatia Enterprises Module" };
        }
      }
    }

    return { title: "Bhatia Enterprises", subtitle: "Master System Platform" };
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  const getLucideIcon = (name, size = 18, strokeWidth = 2, className = "") => {
    const IconComponent = Lucide[name] || Lucide.Layers;
    return <IconComponent size={size} strokeWidth={strokeWidth} className={className} />;
  };

  const getFilteredMenuItems = (menuItems) => {
    const canSelfAssign = localStorage.getItem("can_self_assign") === "true";
    const roleNormalized = (userRole || "user").toLowerCase();

    return menuItems
      .filter((item) => {
        if (isSuperAdmin) return true;

        // Special dynamic guard for assign-task
        if (item.href === "/dashboard/assign-task" && roleNormalized === "user" && !canSelfAssign) {
          return false;
        }

        // Verify page-level permission
        const isExplicitlyAllowed = item.href ? allowedPages.some(route => {
          if (route.includes("/:")) {
            const cleanRoute = route.split("/:")[0];
            return item.href === cleanRoute || item.href.startsWith(cleanRoute + "/");
          }
          return item.href === route;
        }) : false;

        if (item.href && !isExplicitlyAllowed) {
          return false;
        }

        // Filter based on showFor roles if specified
        if (item.showFor) {
          const roles = item.showFor.map(r => r.toLowerCase());
          const userRoles = [roleNormalized];
          if (isSuperAdmin && !userRoles.includes("admin")) {
            userRoles.push("admin");
          }
          const hasMatchingRole = userRoles.some(r => roles.includes(r));
          if (!hasMatchingRole && !isExplicitlyAllowed) return false;
        }

        return true;
      })
      .map((item) => {
        if (item.subItems) {
          return {
            ...item,
            subItems: item.subItems.filter((sub) => {
              if (isSuperAdmin) return true;
              return allowedPages.some(route => {
                if (route.includes("/:")) {
                  const cleanRoute = route.split("/:")[0];
                  return sub.href === cleanRoute || sub.href.startsWith(cleanRoute + "/");
                }
                return sub.href === route;
              });
            }),
          };
        }
        return item;
      })
      .filter((item) => !item.isSubmenu || (item.subItems && item.subItems.length > 0));
  };

  // Filter systems the user has permission to access
  const activeSystemsList = systemRegistry.getAllSystems().filter((sys) => {
    return isSuperAdmin || allowedSystems.includes(sys.id);
  });

  const unreadNotificationsCount = notifications.filter((n) => !n.isRead).length;

  // ── Sidebar pending-task badges ──────────────────────────────────────────
  // Keyed by system id, then by menu item label, so new systems can plug in
  // their own pending counts the same way without touching the render code.
  const purchasePendingCounts = usePurchasePendingCounts();
  const checklistDelegationPendingCounts = useChecklistDelegationPendingCounts();
  const hrFmsPendingCounts = useHrFmsPendingCounts();
  const pendingCountsBySystem = {
    purchase: {
      total: purchasePendingCounts.total,
   items: {
        Approvals: purchasePendingCounts.approvalPending,
        "Purchase Order": purchasePendingCounts.poPending,
        Delivery: purchasePendingCounts.deliveryPending,
        Receiving: purchasePendingCounts.receivingPending,
        "Payment Approval": purchasePendingCounts.paymentApprovalPending,
        Payment: purchasePendingCounts.paymentPending,
      },
    },
    "checklist-delegation": {
      total: checklistDelegationPendingCounts.total,
      items: {
        Delegation: checklistDelegationPendingCounts.delegationPending,
        Task: checklistDelegationPendingCounts.taskPending,
        "Admin Approval": checklistDelegationPendingCounts.adminApprovalPending,
      },
    },
    "hr-fms": {
      total: hrFmsPendingCounts.total,
      items: {
        "Leave Management": hrFmsPendingCounts.leaveManagementPending,
        Advance: hrFmsPendingCounts.advancePending,
        Puttha: hrFmsPendingCounts.putthaPending,
        "Find Enquiry": hrFmsPendingCounts.findEnquiryPending,
        "Call Tracker": hrFmsPendingCounts.callTrackerPending,
        "After Joining Work": hrFmsPendingCounts.afterJoiningWorkPending,
        Leaving: hrFmsPendingCounts.leavingPending,
        "After Leaving Work": hrFmsPendingCounts.afterLeavingWorkPending,
      },
    },
  };

  const getSystemPendingTotal = (sysId) => pendingCountsBySystem[sysId]?.total || 0;
  const getItemPendingCount = (sysId, label) => pendingCountsBySystem[sysId]?.items?.[label] || 0;

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Sidebar for Desktop */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-blue-200 bg-white md:flex md:flex-col">
        <div className="flex h-14 items-center border-b border-blue-200 px-4 bg-gradient-to-r from-blue-100 to-purple-100">
          <Link to="/dashboard" className="flex items-center gap-2 font-bold text-blue-700 font-sleek">
            <img src={bhatiyaLogo} alt="Bhatia Enterprises Logo" className="h-8 w-8 rounded-full object-cover border border-blue-200" />
            <span className="tracking-wide text-sm font-black">Bhatia Enterprises</span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          <ul className="space-y-1">
            {/* Core Home Navigation */}
            <li>
              <Link
                to="/dashboard"
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${location.pathname === "/dashboard"
                    ? "bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700"
                    : "text-gray-700 hover:bg-blue-50"
                  }`}
              >
                {getLucideIcon("Home", 16)}
                <span>Platform Dashboard</span>
              </Link>
            </li>

            {/* Global Settings Navigation */}
            {isSuperAdmin && (
              <li>
                <Link
                  to="/dashboard/global-settings"
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${location.pathname === "/dashboard/global-settings"
                      ? "bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 font-bold"
                      : "text-gray-700 hover:bg-blue-50"
                    }`}
                >
                  {getLucideIcon("Sliders", 16)}
                  <span>Global Settings</span>
                </Link>
              </li>
            )}


            {/* Systems Separator */}
            {activeSystemsList.length > 0 && (
              <li className="pt-4 pb-1 px-3">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Modules</span>
              </li>
            )}

            {/* Registered Systems */}
            {activeSystemsList.map((sys) => {
              const filteredItems = getFilteredMenuItems(sys.menuItems || []);
              if (filteredItems.length === 0) return null;

              const isExpanded = !!expandedSystems[sys.id];

              return (
                <li key={sys.id} className="border border-blue-50/50 rounded-lg bg-gray-50/50 overflow-hidden mb-2">
                  <button
                    onClick={() => toggleSystem(sys.id)}
                    className={`flex items-center justify-between w-full px-3 py-2.5 text-xs font-bold transition-all text-left ${isExpanded
                        ? "bg-blue-50 text-blue-800 border-b border-blue-100"
                        : "text-gray-600 hover:bg-gray-100"
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`p-1 rounded-md ${isExpanded ? "bg-white text-blue-700" : "text-gray-500"}`}>
                        {getLucideIcon(sys.icon, 14)}
                      </div>
                      <span>{sys.name}</span>
                      {getSystemPendingTotal(sys.id) > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                          {getSystemPendingTotal(sys.id)}
                        </span>
                      )}
                    </div>
                    {isExpanded ? getLucideIcon("ChevronDown", 14) : getLucideIcon("ChevronRight", 14)}
                  </button>

                  {isExpanded && (
                    <ul className="py-1 px-1.5 space-y-0.5 bg-white">
                      {filteredItems.map((item) => {
                        const isSubOpen = !!expandedSubmenus[item.label];
                        const isCurrentActive = item.href && location.pathname === item.href;

                        if (item.isSubmenu) {
                          const isChildActive = item.subItems.some(sub => location.pathname === sub.href);
                          return (
                            <li key={item.label}>
                              <button
                                onClick={() => toggleSubmenu(item.label)}
                                className={`flex items-center justify-between w-full rounded-md px-3 py-2 text-xs font-semibold transition-colors ${isChildActive
                                    ? "bg-blue-50 text-blue-700"
                                    : "text-gray-700 hover:bg-blue-50/50"
                                  }`}
                              >
                                <div className="flex items-center gap-2">
                                  {getLucideIcon(item.icon, 14)}
                                  <span>{item.label}</span>
                                </div>
                                {isSubOpen ? getLucideIcon("ChevronDown", 12) : getLucideIcon("ChevronRight", 12)}
                              </button>
                              {isSubOpen && (
                                <ul className="mt-1 ml-4 border-l-2 border-blue-50 pl-2 space-y-0.5">
                                  {item.subItems.map((sub) => {
                                    const isSubActive = location.pathname === sub.href;
                                    return (
                                      <li key={sub.label}>
                                        <Link
                                          to={sub.href}
                                          className={`block rounded px-2.5 py-1.5 text-[11px] font-medium transition-colors ${isSubActive
                                              ? "text-blue-700 bg-blue-50"
                                              : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                                            }`}
                                        >
                                          {sub.label}
                                        </Link>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </li>
                          );
                        }

                        return (
                          <li key={item.label}>
                            <Link
                              to={item.href}
                              className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${isCurrentActive
                                  ? "bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 font-bold"
                                  : "text-gray-700 hover:bg-blue-50/50"
                                }`}
                            >
                              {getLucideIcon(item.icon, 14)}
                              <div className="flex items-center justify-between w-full">
                                <span>{item.label}</span>
                                {item.label === "Notifications" && unreadNotificationsCount > 0 && (
                                  <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                                    {unreadNotificationsCount}
                                  </span>
                                )}
                                {getItemPendingCount(sys.id, item.label) > 0 && (
                                  <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                                    {getItemPendingCount(sys.id, item.label)}
                                  </span>
                                )}
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}


          </ul>
        </nav>

        {/* Desktop Profile Section */}
        <div className="border-t border-blue-200 p-4 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full gradient-bg flex items-center justify-center overflow-hidden border border-blue-100">
                  {profileImage ? (
                    <img src={profileImage} alt={username} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm font-medium text-black">
                      {username ? username.charAt(0).toUpperCase() : "U"}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-blue-700 truncate">
                    {username || "User"}{" "}
                    {isSuperAdmin
                      ? "(Super Admin)"
                      : userRole.toLowerCase() === "hod"
                        ? "(HOD)"
                        : userRole.toLowerCase() === "admin"
                          ? "(Admin)"
                          : ""}
                  </p>
                  <p className="text-[10px] text-blue-600 truncate">{userEmail || "user@example.com"}</p>
                </div>
              </div>

              {toggleDarkMode && (
                <button
                  onClick={toggleDarkMode}
                  className="text-blue-700 hover:text-blue-900 p-1 rounded-full hover:bg-blue-100"
                >
                  {darkMode ? getLucideIcon("Sun", 14) : getLucideIcon("Moon", 14)}
                </button>
              )}
            </div>

            <div className="mt-2.5 flex justify-center">
              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-1 w-full py-1 text-xs text-blue-700 hover:text-blue-900 bg-white/50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
              >
                {getLucideIcon("LogOut", 12)}
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer and Page Structure */}
      <div className="flex flex-col flex-1 overflow-hidden relative">
        <header className="flex h-16 items-center justify-between border-b border-purple-100 bg-white px-4 md:px-6 shadow-sm z-30">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden text-blue-700 p-2 rounded-md hover:bg-blue-100 focus:outline-none"
          >
            {getLucideIcon("Menu", 20)}
            <span className="sr-only">Toggle menu</span>
          </button>

          <div className="flex flex-col items-center">
            <h1 className="text-lg font-bold bg-gradient-to-r from-blue-700 to-purple-700 bg-clip-text text-transparent">
              {activeSystemInfo.title}
            </h1>
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-[0.2em] -mt-1 hidden xs:block">
              {activeSystemInfo.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end mr-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Welcome</span>
              <span className="text-sm font-black text-purple-700 -mt-1">Hello, {username || "User"}</span>
            </div>
            <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center shadow-lg border-2 border-white ring-2 ring-purple-100/50 overflow-hidden">
              {profileImage ? (
                <img src={profileImage} alt={username} className="h-full w-full object-cover" />
              ) : (
                <span className="text-white text-sm font-black uppercase">{username ? username.charAt(0) : "U"}</span>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-24 md:px-6 md:pb-6 bg-gradient-to-br from-blue-50/50 to-purple-50/50">
          <Outlet />
        </main>

        <div className="bg-gradient-to-r from-blue-600 to-purple-600 h-5 flex items-center justify-center px-4 shadow-md z-40">
          <a
            href="https://www.botivate.in"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9px] text-white/90 font-medium tracking-[0.2em] uppercase hover:underline hover:text-white transition-colors"
          >
            Powered by <span className="font-bold">Botivate</span>
          </a>
        </div>

        {/* Premium Bottom Navigation for Mobile
        <div className="mobile-bottom-nav md:hidden fixed bottom-6 left-4 right-4 h-16 bg-white/80 backdrop-blur-xl border border-white/20 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] z-50 flex items-center justify-around px-2">
          <Link
            to="/dashboard"
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 ${location.pathname === "/dashboard" ? "text-purple-600 bg-purple-50" : "text-gray-400"
              }`}
          >
            {getLucideIcon("Home", 20, 2)}
            <span className="text-[10px] mt-1 font-bold">Home</span>
          </Link>

          <Link
            to="/dashboard/task"
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 ${location.pathname === "/dashboard/task" ? "text-purple-600 bg-purple-50" : "text-gray-400"
              }`}
          >
            {getLucideIcon("CalendarCheck", 20, 2)}
            <span className="text-[10px] mt-1 font-bold">Tasks</span>
          </Link>

          {(() => {
            const roleUpper = userRole.toUpperCase();
            return (
              roleUpper === "ADMIN" ||
              roleUpper === "HOD" ||
              (roleUpper === "USER" && localStorage.getItem("can_self_assign") === "true")
            );
          })() && (
              <div className="relative -mt-12">
                <Link
                  to="/dashboard/assign-task"
                  className="flex items-center justify-center w-14 h-14 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-2xl shadow-lg shadow-purple-200 text-white border-4 border-blue-50"
                >
                  {getLucideIcon("CirclePlus", 26, 2.5)}
                </Link>
              </div>
            )}

          <Link
            to="/dashboard/delegation"
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 ${location.pathname === "/dashboard/delegation" ? "text-purple-600 bg-purple-50" : "text-gray-400"
              }`}
          >
            {getLucideIcon("BookmarkCheck", 20, 2)}
            <span className="text-[10px] mt-1 font-bold">Status</span>
          </Link>

          <button
            onClick={() => setIsUserPopupOpen(true)}
            className="flex flex-col items-center justify-center w-12 h-12 rounded-xl text-gray-400"
          >
            {getLucideIcon("UserRound", 20, 2)}
            <span className="text-[10px] mt-1 font-bold">Profile</span>
          </button>
        </div> */}

        {/* Mobile Sidebar Drawer */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-[100] md:hidden">
            <div className="fixed inset-0 bg-black/35 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
            <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-2xl flex flex-col">
              <div className="flex h-14 items-center justify-between border-b border-blue-200 px-4 bg-gradient-to-r from-blue-100 to-purple-100">
                <Link to="/dashboard" className="flex items-center gap-2 font-bold text-blue-700 font-sleek" onClick={() => setIsMobileMenuOpen(false)}>
                  <img src={bhatiyaLogo} alt="Bhatia Enterprises Logo" className="h-8 w-8 rounded-full object-cover border border-blue-200" />
                  <span className="tracking-wide text-sm font-black">Bhatia Enterprises</span>
                </Link>
                <button onClick={() => setIsMobileMenuOpen(false)} className="text-blue-700 p-1 hover:bg-blue-100 rounded">
                  {getLucideIcon("X", 18)}
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto p-2 bg-white">
                <ul className="space-y-1">
                  <li>
                    <Link
                      to="/dashboard"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${location.pathname === "/dashboard"
                          ? "bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700"
                          : "text-gray-700 hover:bg-blue-50"
                        }`}
                    >
                      {getLucideIcon("Home", 16)}
                      <span>Platform Dashboard</span>
                    </Link>
                  </li>

                  {/* Mobile Global Settings Navigation */}
                  {isSuperAdmin && (
                    <li>
                      <Link
                        to="/dashboard/global-settings"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${location.pathname === "/dashboard/global-settings"
                            ? "bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 font-bold"
                            : "text-gray-700 hover:bg-blue-50"
                          }`}
                      >
                        {getLucideIcon("Sliders", 16)}
                        <span>Global Settings</span>
                      </Link>
                    </li>
                  )}


                  {activeSystemsList.length > 0 && (
                    <li className="pt-4 pb-1 px-3">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Modules</span>
                    </li>
                  )}

                  {activeSystemsList.map((sys) => {
                    const filteredItems = getFilteredMenuItems(sys.menuItems || []);
                    if (filteredItems.length === 0) return null;

                    const isExpanded = !!expandedSystems[sys.id];

                    return (
                      <li key={sys.id} className="border border-blue-50/50 rounded-lg bg-gray-50/50 overflow-hidden mb-2">
                        <button
                          onClick={() => toggleSystem(sys.id)}
                          className={`flex items-center justify-between w-full px-3 py-2.5 text-xs font-bold transition-all text-left ${isExpanded ? "bg-blue-50 text-blue-800 border-b border-blue-100" : "text-gray-600 hover:bg-gray-100"
                            }`}
                        >
                          <div className="flex items-center gap-2">
                            {getLucideIcon(sys.icon, 14)}
                           <span>{sys.name}</span>
                            {getSystemPendingTotal(sys.id) > 0 && (
                              <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                                {getSystemPendingTotal(sys.id)}
                              </span>
                            )}
                          </div>
                          {isExpanded ? getLucideIcon("ChevronDown", 14) : getLucideIcon("ChevronRight", 14)}
                        </button>
                        {isExpanded && (
                          <ul className="py-1 px-1.5 space-y-0.5 bg-white">
                            {filteredItems.map((item) => {
                              const isSubOpen = !!expandedSubmenus[item.label];
                              const isCurrentActive = item.href && location.pathname === item.href;

                              if (item.isSubmenu) {
                                const isChildActive = item.subItems.some(sub => location.pathname === sub.href);
                                return (
                                  <li key={item.label}>
                                    <button
                                      onClick={() => toggleSubmenu(item.label)}
                                      className={`flex items-center justify-between w-full rounded-md px-3 py-2 text-xs font-semibold transition-colors ${isChildActive ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-blue-50/50"
                                        }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        {getLucideIcon(item.icon, 14)}
                                        <span>{item.label}</span>
                                      </div>
                                      {isSubOpen ? getLucideIcon("ChevronDown", 12) : getLucideIcon("ChevronRight", 12)}
                                    </button>
                                    {isSubOpen && (
                                      <ul className="mt-1 ml-4 border-l-2 border-blue-50 pl-2 space-y-0.5">
                                        {item.subItems.map((sub) => {
                                          const isSubActive = location.pathname === sub.href;
                                          return (
                                            <li key={sub.label}>
                                              <Link
                                                to={sub.href}
                                                onClick={() => setIsMobileMenuOpen(false)}
                                                className={`block rounded px-2.5 py-1.5 text-[11px] font-medium transition-colors ${isSubActive ? "text-blue-700 bg-blue-50" : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                                                  }`}
                                              >
                                                {sub.label}
                                              </Link>
                                            </li>
                                          );
                                        })}
                                      </ul>
                                    )}
                                  </li>
                                );
                              }

                              return (
                                <li key={item.label}>
                                  <Link
                                    to={item.href}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${isCurrentActive ? "bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 font-bold" : "text-gray-700 hover:bg-blue-50/50"
                                      }`}
                                  >
                                    {getLucideIcon(item.icon, 14)}
                                    <div className="flex items-center justify-between w-full">
                                      <span>{item.label}</span>
                                      {item.label === "Notifications" && unreadNotificationsCount > 0 && (
                                        <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                                          {unreadNotificationsCount}
                                        </span>
                                      )}
                                      {getItemPendingCount(sys.id, item.label) > 0 && (
                                        <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                                          {getItemPendingCount(sys.id, item.label)}
                                        </span>
                                      )}
                                    </div>
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  })}


                </ul>
              </nav>

              <div className="border-t border-blue-200 p-4 bg-gradient-to-r from-blue-50 to-purple-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full gradient-bg flex items-center justify-center overflow-hidden border border-blue-100">
                      {profileImage ? (
                        <img src={profileImage} alt={username} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-sm font-medium text-black">
                          {username ? username.charAt(0).toUpperCase() : "U"}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-blue-700">
                        {username || "User"}{" "}
                        {isSuperAdmin ? "(Super)" : userRole === "HOD" ? "(HOD)" : ""}
                      </p>
                      <p className="text-[10px] text-blue-600 truncate max-w-[120px]">{userEmail || "user@example.com"}</p>
                    </div>
                  </div>
                  <button onClick={handleLogout} className="p-1 text-blue-700 hover:bg-blue-100 rounded">
                    {getLucideIcon("LogOut", 16)}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* User Popup Modal on Mobile */}
        {isUserPopupOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-md p-4 transition-all duration-300">
            <div className="bg-white rounded-[2rem] w-full max-w-[340px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden border border-white/50">
              <div className="h-32 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 relative">
                <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px]"></div>
                <button
                  onClick={() => setIsUserPopupOpen(false)}
                  className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 rounded-full text-white transition-all hover:rotate-90 z-10"
                >
                  {getLucideIcon("X", 20)}
                </button>
              </div>

              <div className="px-8 pb-8 text-center bg-white">
                <div className="relative -mt-16 mb-6 flex justify-center">
                  <div className="h-28 w-28 rounded-full bg-white p-1.5 shadow-2xl ring-4 ring-white/30">
                    <div className="h-full w-full rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center overflow-hidden border-2 border-white shadow-inner">
                      {profileImage ? (
                        <img src={profileImage} alt={username} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-4xl font-black text-white uppercase tracking-tighter">
                          {username ? username.charAt(0) : "U"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  <div>
                    <h3 className="text-2xl font-black text-gray-900 tracking-tight mb-1">{username || "User"}</h3>
                    <div className="flex justify-center flex-wrap gap-2">
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] px-3 py-1 bg-indigo-50 rounded-full border border-indigo-100/50">
                        {isSuperAdmin
                          ? "Super Admin"
                          : userRole?.toLowerCase() === "hod"
                            ? "HOD"
                            : "Staff"}
                      </span>
                    </div>
                  </div>

                  <div className="py-3 px-4 bg-gray-50 rounded-2xl flex items-center justify-center gap-2 border border-gray-100">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-xs font-bold text-gray-500 truncate">{userEmail || "user@example.com"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setIsUserPopupOpen(false)}
                    className="flex justify-center items-center py-3.5 px-4 rounded-2xl text-xs font-black text-gray-400 border-2 border-gray-50 hover:bg-gray-50 hover:text-gray-600 transition-all active:scale-95 uppercase tracking-widest"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={handleLogout}
                    className="flex justify-center items-center gap-2 py-3.5 px-4 rounded-2xl text-xs font-black text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-[0_10px_20px_-5px_rgba(79,70,229,0.4)] transition-all active:scale-95 uppercase tracking-widest"
                  >
                    Logout {getLucideIcon("LogOut", 14, 3)}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
