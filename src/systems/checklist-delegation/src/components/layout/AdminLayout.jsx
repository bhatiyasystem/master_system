"use client";
import bhatiyaLogo from "../../assets/bhatiya_Logo.jpg";

import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchNotifications } from '../../redux/slice/notificationSlice';
import supabase from "../../SupabaseClient";
import { CheckSquare, ClipboardList, Database, Zap, Settings, CalendarCheck, Calendar as CalendarIcon, BookmarkCheck, Bell, Video, Link, ChevronDown, ChevronRight, LogOut, Home, X, Menu, UserRound } from 'lucide-react';

import { useChecklistDelegationPendingCounts } from '../../hooks/usePendingCounts';

export default function AdminLayout({ children, darkMode, toggleDarkMode, showLayout = true }) {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { list: notifications } = useSelector((state) => state.notifications);
  const pendingCounts = useChecklistDelegationPendingCounts();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isHolidaySubmenuOpen, setIsHolidaySubmenuOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [userRole, setUserRole] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [profileImage, setProfileImage] = useState("");

  const [isUserPopupOpen, setIsUserPopupOpen] = useState(false);

  // Check authentication on component mount
  useEffect(() => {
    const storedUsername = localStorage.getItem("user-name");
    const storedRole = localStorage.getItem("role");
    const storedEmail = localStorage.getItem("email_id");

    if (!storedUsername) {
      // Redirect to login if not authenticated
      navigate("/login");
      return;
    }

    setUsername(storedUsername);
    setUserRole(storedRole || "user");
    setUserEmail(storedEmail);
    setIsSuperAdmin(storedUsername.toLowerCase() === "admin");

    // Centralized Security Guard for User Role
    const path = location.pathname;
    const restrictedPages = [
      "/dashboard/assign-task",
      "/dashboard/admin-approval",
      "/dashboard/checklist",
      "/dashboard/maintenance",
      "/dashboard/repair",
      "/dashboard/ea-task",
      "/dashboard/quick-task",
      "/dashboard/holiday-list",
      "/dashboard/working-day-calendar",
      "/dashboard/setting"
    ];

    const storedRoleLower = (storedRole || "user").toLowerCase();
    const canSelfAssign = localStorage.getItem("can_self_assign") === "true";

    console.log(`🛡️ SECURITY GUARD DEBUG:
      Path: "${path}"
      Role: "${storedRoleLower}"
      CanSelfAssign: ${canSelfAssign}
    `);

    // Case 1: USER role
    if (storedRoleLower === "user") {
      if (canSelfAssign) {
        // Authorized users can access a subset of pages
        const userAllowedPages = [
          "/dashboard/admin",
          "/dashboard/notifications",
          "/dashboard/assign-task",
          "/dashboard/checklist",
          "/dashboard/delegation",
          "/dashboard/task",
          "/dashboard/calendar",
          "/dashboard/training-video"
        ];
        const isAllowed = userAllowedPages.some(p => path.startsWith(p));
        console.log(`🔍 User Allowed Check: Path "${path}" matches allowed list: ${isAllowed}`);

        if (!isAllowed) {
          console.warn("🚫 Security: User with SelfAssign redirected from unauthorized page:", path);
          navigate("/dashboard/admin");
          return;
        }
      } else {
        // Non-authorized users are blocked from restricted pages
        const isRestricted = restrictedPages.some(p => path.startsWith(p));
        console.log(`🔍 User Restricted Check: Path "${path}" is restricted: ${isRestricted}`);

        if (isRestricted) {
          console.warn("🚫 Security: User WITHOUT SelfAssign redirected from restricted page:", path);
          navigate("/dashboard/admin");
          return;
        }
      }
    }

    if (storedRoleLower === "hod") {
      const designation = (localStorage.getItem("designation") || "").toLowerCase();
      const isMachineOperator = designation.includes("machin") || designation.includes("operat") || designation.includes("oprat");

      const hodRestrictedPages = [
        "/dashboard/maintenance",
        "/dashboard/ea-task",
        "/dashboard/quick-task",
        "/dashboard/holiday-list",
        "/dashboard/working-day-calendar",
        "/dashboard/setting"
      ];

      if (!isMachineOperator) {
        hodRestrictedPages.push("/dashboard/repair");
      }

      if (hodRestrictedPages.some(p => path.startsWith(p))) {
        navigate("/dashboard/admin");
        return;
      }
    }

    // Initial load from localStorage
    const cachedImage = localStorage.getItem("profile_image");
    setProfileImage(cachedImage || "");

    // Fetch reporting users for HOD role check
    let _reportingUsers = [storedUsername?.toLowerCase()];
    const currentUserRole = (localStorage.getItem("role") || "").toLowerCase();
    if (currentUserRole === "hod") {
      const fetchReportingUsers = async () => {
        const { data: reports } = await supabase
          .from("users")
          .select("user_name")
          .eq("reported_by", storedUsername);
        if (reports) {
          _reportingUsers = [storedUsername.toLowerCase(), ...reports.map(r => (r.user_name || "").toLowerCase())];
        }
      };
      fetchReportingUsers();
    }

    // Sync with database to get the latest image
    const syncProfileImage = async () => {
      try {
        const { data } = await supabase
          .from("users")
          .select("profile_image")
          .eq("user_name", storedUsername)
          .single();

        if (data && data.profile_image) {
          setProfileImage(data.profile_image);
          localStorage.setItem("profile_image", data.profile_image);
          console.log("✅ Profile image synced from DB:", data.profile_image);
        }
      } catch (err) {
        console.error("❌ Error syncing profile image:", err);
      }
    };

    if (storedUsername) {
      syncProfileImage();
    }

    console.log("AdminLayout - Profile Image URL (Cached):", cachedImage);

    // Check if this is the super admin (username = 'admin')
    const normalizedUsername = (storedUsername || "").toLowerCase();
    setIsSuperAdmin(normalizedUsername === "admin");
  }, [navigate, location.pathname]);

  // Fetch notifications globally for badge count
  useEffect(() => {
    const role = localStorage.getItem("role");
    const userId = localStorage.getItem("user-id");
    if (role) {
      dispatch(fetchNotifications({ role: role.toLowerCase(), userId }));
    }
  }, [dispatch, location.pathname]);

  // Set initial submenu state based on current location
  useEffect(() => {
    if (location.pathname.includes("/dashboard/holiday") || location.pathname.includes("/dashboard/working-day")) {
      setIsHolidaySubmenuOpen(true);
    }
  }, [location.pathname]);

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem("user-name");
    localStorage.removeItem("role");
    localStorage.removeItem("email_id");
    localStorage.removeItem("token");
    localStorage.removeItem("profile_image");
    window.location.href = "/login";
  };

  // No data categories needed as Task is now a main route

  // Update the routes array based on user role and super admin status
  const routes = [
    {
      href: "/dashboard/admin",
      label: "Dashboard",
      icon: Database,
      active: location.pathname === "/dashboard/admin",
      showFor: ["admin", "user", "HOD"],
    },
    {
      href: "/dashboard/notifications",
      label: "Notifications",
      icon: Bell,
      active: location.pathname === "/dashboard/notifications",
      showFor: ["admin", "user", "hod"],
      badge: notifications.filter(n => !n.isRead).length || null,
    },
    {
      href: "/dashboard/quick-task",
      label: "Quick Task",
      icon: Zap,
      active: location.pathname === "/dashboard/quick-task",
      // Show for super admin OR anyone with 'admin' role
      showFor: (isSuperAdmin || userRole.toLowerCase() === "admin") ? ["admin"] : [],
    },
    {
      href: "/dashboard/assign-task",
      label: "Assign Task",
      icon: CheckSquare,
      active: location.pathname === "/dashboard/assign-task",
      showFor: ["admin", "HOD", "user"],
    },
    {
      href: "/dashboard/delegation",
      label: "Delegation",
      icon: ClipboardList,
      active: location.pathname === "/dashboard/delegation",
      showFor: ["admin", "user", "HOD"],
      badge: pendingCounts.delegationPending || null,
    },
    {
      href: "/dashboard/task",
      label: "Task",
      icon: CalendarCheck,
      active: location.pathname === "/dashboard/task",
      showFor: ["admin", "HOD", "user"],
      badge: pendingCounts.taskPending || null,
    },
    {
      href: "/dashboard/calendar",
      label: "Calendar",
      icon: CalendarIcon,
      active: location.pathname === "/dashboard/calendar",
      showFor: ["admin", "user", "HOD"],
    },
    {
      label: "Holiday",
      icon: CalendarIcon, // Or a specific holiday icon
      showFor: (isSuperAdmin || userRole.toLowerCase() === "admin") ? ["admin"] : [],
      isSubmenu: true,
      isOpen: isHolidaySubmenuOpen,
      setIsOpen: setIsHolidaySubmenuOpen,
      active: location.pathname.includes("/dashboard/holiday") || location.pathname.includes("/dashboard/working-day"),
      subItems: [
        {
          href: "/dashboard/holiday-list",
          label: "Holiday List",
          active: location.pathname === "/dashboard/holiday-list",
          showFor: ["admin"],
        },
        {
          href: "/dashboard/working-day-calendar",
          label: "Working Day Calendar",
          active: location.pathname === "/dashboard/working-day-calendar",
          showFor: ["admin"],
        }
      ]
    },
    {
      href: "/dashboard/admin-approval",
      label: "Admin Approval",
      icon: BookmarkCheck,
      active: location.pathname === "/dashboard/admin-approval",
      showFor: ["admin", "HOD"],
      badge: pendingCounts.adminApprovalPending || null,
    },
    // {
    //   href: "/dashboard/mis-report",
    //   label: "MIS Report",
    //   icon: CheckSquare,
    //   active: location.pathname.includes("/dashboard/mis-report"),
    //   // Only show for super admin (username = 'admin')
    //   showFor: isSuperAdmin ? ["admin"] : [],
    // },
    {
      href: "/dashboard/setting",
      label: "Settings",
      icon: Settings,
      active: location.pathname.includes("/dashboard/setting"),
      // Only show for super admin (username = 'admin')
      showFor: isSuperAdmin ? ["admin"] : [],
    },
    {
      href: "/dashboard/training-video",
      label: "Training Video",
      icon: Video,
      active: location.pathname === "/dashboard/training-video",
      showFor: ["admin", "user", "HOD"],
    },
  ];

  const _getAccessibleDepartments = () => {
    return [];
  };

  // Filter routes based on user role and super admin status
  const getAccessibleRoutes = () => {
    const userRole = localStorage.getItem("role") || "user";
    const username = localStorage.getItem("user-name");

    return routes
      .filter((route) => {
        const userRoleNormalized = (userRole || "user").toLowerCase();
        const usernameNormalized = (username || "").toLowerCase();

        // If it's the Setting page, only show for super admin (admin username)
        if (route.label === "Settings") {
          return usernameNormalized === "admin";
        }

        // Holiday submenu logic handled by showFor in routes
        if (route.label === "Holiday") {
          return isSuperAdmin || userRoleNormalized === "admin";
        }
        if (route.href === "/dashboard/assign-task") {
          const canSelfAssign = localStorage.getItem("can_self_assign") === "true";
          console.log(`🔍 Sidebar Filter: Checking ${route.label} for ${userRoleNormalized}. CanSelfAssign=${canSelfAssign}`);
          if (userRoleNormalized === "user") return canSelfAssign;
        }

        const isAllowed = route.showFor.some(role => role.toLowerCase() === userRoleNormalized);
        return isAllowed;
      })
      .map(route => {
        if (route.subItems) {
          const userRoleNormalized = (userRole || "user").toLowerCase();
          return {
            ...route,
            subItems: route.subItems.filter(sub => sub.showFor.some(role => role.toLowerCase() === userRoleNormalized))
          };
        }
        return route;
      })
      .filter(route => !route.isSubmenu || (route.subItems && route.subItems.length > 0));
  };

  // Submenu logic removed

  // Get accessible routes
  const accessibleRoutes = getAccessibleRoutes();

  if (window.__IS_MASTER_SYSTEM__ || !showLayout) {
    return <>{children}</>;
  }

  return (
    <div
      className={`flex h-screen overflow-hidden bg-[#f8fafc]`}
    >
      {/* Sidebar for desktop */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
        <div className="flex h-14 items-center border-b border-slate-200 px-4 bg-white">
          <Link
            to="/dashboard/admin"
            className="flex items-center gap-2 font-bold text-[#173254] font-sleek"
          >
            <img src={bhatiyaLogo} alt="Bhatia Enterprises Logo" className="h-8 w-8 rounded-full object-cover border border-slate-200" />
            <span className="tracking-wide text-sm font-black">Bhatia Enterprises</span>
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          <ul className="space-y-1">
            {accessibleRoutes.map((route) => (
              <li key={route.label}>
                {route.isSubmenu ? (
                  <div className="flex flex-col">
                    <button
                      onClick={() => route.setIsOpen(!route.isOpen)}
                      className={`flex items-center justify-between w-full rounded-md px-3 py-2 text-sm font-medium transition-colors ${route.active
                        ? "bg-[#173254] text-white font-bold shadow-sm"
                        : "text-slate-700 hover:bg-slate-100"
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <route.icon
                          className={`h-4 w-4 ${route.active ? "text-white" : ""}`}
                        />
                        <div className="flex items-center justify-between w-full">
                          <span>{route.label}</span>
                          {route.badge && (
                            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                              {route.badge}
                            </span>
                          )}
                        </div>
                      </div>
                      {route.isOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    {route.isOpen && (
                      <ul className="mt-1 ml-4 space-y-1 border-l-2 border-slate-100 pl-2">
                        {route.subItems.map((sub) => (
                          <li key={sub.label}>
                            <Link
                              to={sub.href}
                              className={`flex items-center gap-3 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${sub.active
                                ? "text-[#173254] bg-slate-100 font-bold"
                                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                                }`}
                            >
                              {sub.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <Link
                    to={route.href}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${route.active
                      ? "bg-[#173254] text-white font-bold shadow-sm"
                      : "text-slate-700 hover:bg-slate-100"
                      }`}
                  >
                    <route.icon
                      className={`h-4 w-4 ${route.active ? "text-white" : ""}`}
                    />
                    <div className="flex items-center justify-between w-full">
                      <span>{route.label}</span>
                      {route.badge && (
                        <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                          {route.badge}
                        </span>
                      )}
                    </div>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-slate-200 p-4 bg-white">
          <div className="flex flex-col">
            {/* User info section */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-[#173254] flex items-center justify-center overflow-hidden border border-slate-200">
                  {profileImage ? (
                    <img src={profileImage} alt={username} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-white">
                      {username ? username.charAt(0).toUpperCase() : "U"}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#173254] truncate">
                    {username || "User"}{" "}
                    {userRole.toLowerCase() === "admin"
                      ? isSuperAdmin
                        ? "(Super Admin)"
                        : "(Admin)"
                      : userRole.toLowerCase() === "hod"
                        ? "(HOD)"
                        : ""}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {userEmail || "user@example.com"}
                  </p>
                </div>
              </div>

              {/* Dark mode toggle (if available) */}
              {toggleDarkMode && (
                <button
                  onClick={toggleDarkMode}
                  className="text-blue-700 hover:text-blue-900 p-1 rounded-full hover:bg-blue-100"
                >
                  {darkMode ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                      />
                    </svg>
                  )}
                  <span className="sr-only">
                    {darkMode ? "Light mode" : "Dark mode"}
                  </span>
                </button>
              )}
            </div>

            {/* Logout button positioned below user info */}
            <div className="mt-2 flex justify-center">
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 text-[#173254] hover:text-[#10243e] px-2 py-1 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-sm"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile menu button and sidebar */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="md:hidden absolute left-4 top-3 z-[110] text-[#173254] p-2 rounded-md hover:bg-slate-100"
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle menu</span>
      </button>

      {/* Mobile sidebar */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          <div
            className="fixed inset-0 bg-black/20"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>
          <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-lg">
            <div className="flex h-14 items-center border-b border-slate-200 px-4 bg-white">
              <Link
                to="/dashboard/admin"
                className="flex items-center gap-2 font-bold text-[#173254] font-sleek"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <img src={bhatiyaLogo} alt="Bhatia Enterprises Logo" className="h-8 w-8 rounded-full object-cover border border-slate-200" />
                <span className="tracking-wide text-sm font-black">Bhatia Enterprises</span>
              </Link>
            </div>
            <nav className="flex-1 overflow-y-auto p-2 bg-white">
              <ul className="space-y-1">
                {accessibleRoutes.map((route) => (
                  <li key={route.label}>
                    {route.isSubmenu ? (
                      <div className="flex flex-col">
                        <button
                          onClick={() => route.setIsOpen(!route.isOpen)}
                          className={`flex items-center justify-between w-full rounded-md px-3 py-2 text-sm font-medium transition-colors ${route.active
                            ? "bg-[#173254] text-white font-bold shadow-sm"
                            : "text-slate-700 hover:bg-slate-100"
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <route.icon
                              className={`h-4 w-4 ${route.active ? "text-white" : ""}`}
                            />
                            {route.label}
                          </div>
                          {route.isOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                        {route.isOpen && (
                          <ul className="mt-1 ml-4 space-y-1 border-l-2 border-slate-100 pl-2">
                            {route.subItems.map((sub) => (
                              <li key={sub.label}>
                                <Link
                                  to={sub.href}
                                  className={`flex items-center gap-3 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${sub.active
                                    ? "text-[#173254] bg-slate-100 font-bold"
                                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                                    }`}
                                  onClick={() => setIsMobileMenuOpen(false)}
                                >
                                  {sub.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : (
                      <Link
                        to={route.href}
                        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${route.active
                          ? "bg-[#173254] text-white font-bold shadow-sm"
                          : "text-slate-700 hover:bg-slate-100"
                          }`}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <route.icon
                          className={`h-4 w-4 ${route.active ? "text-white" : ""
                            }`}
                        />
                        <div className="flex items-center justify-between w-full">
                          <span>{route.label}</span>
                          {route.badge && (
                            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                              {route.badge}
                            </span>
                          )}
                        </div>
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
            <div className="border-t border-slate-200 p-4 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-[#173254] flex items-center justify-center overflow-hidden border border-slate-200">
                    {profileImage ? (
                      <img src={profileImage} alt={username} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-white">
                        {username ? username.charAt(0).toUpperCase() : "U"}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#173254]">
                      {username || "User"}{" "}
                      {userRole === "admin"
                        ? isSuperAdmin
                          ? "(Super Admin)"
                          : "(Admin)"
                        : userRole === "HOD"
                          ? "(HOD)"
                          : ""}
                    </p>
                    <p className="text-xs text-slate-500">
                      {userEmail || "user@example.com"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {toggleDarkMode && (
                    <button
                      onClick={toggleDarkMode}
                      className="text-[#173254] hover:text-[#10243e] p-1 rounded-full hover:bg-slate-100"
                    >
                      {darkMode ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                          />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M20.354 15.354A9 9 0 018.646 3.646A9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                          />
                        </svg>
                      )}
                      <span className="sr-only">
                        {darkMode ? "Light mode" : "Dark mode"}
                      </span>
                    </button>
                  )}

                </div>
              </div>
              <div className="mt-2 flex justify-center">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-[#173254] hover:text-[#10243e] px-2 py-1 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-sm"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6 shadow-sm z-30">
          <div className="flex md:hidden w-8"></div>
          <div className="flex flex-col items-center">
            <h1 className="text-lg font-bold text-[#173254] font-sleek">
              Bhatia Enterprises
            </h1>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-[0.2em] -mt-1 hidden xs:block font-sleek">
              Master System
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end mr-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Welcome</span>
              <span className="text-sm font-bold text-[#173254] -mt-1">Hello, {username || 'User'}</span>
            </div>
            <div className="h-10 w-10 rounded-full bg-[#173254] flex items-center justify-center shadow-md border-2 border-white ring-2 ring-slate-200 overflow-hidden">
              {profileImage ? (
                <img
                  src={profileImage}
                  alt={username}
                  className="h-full w-full object-cover"
                  onError={() => {
                    console.error("❌ AdminLayout Image Failed to Load:", profileImage);
                    setProfileImage(""); // Fallback to initials
                  }}
                />
              ) : (
                <span className="text-white text-sm font-black uppercase">{username ? username.charAt(0) : 'U'}</span>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4 md:px-6 md:pb-6 bg-[#f8fafc] pb-24 md:pb-6">
          {children}
        </main>

        <div className="bg-[#173254] h-5 flex items-center justify-center px-4 shadow-md z-40">
          <a
            href="https://www.botivate.in"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9px] text-white/90 font-medium tracking-[0.2em] uppercase hover:underline hover:text-white transition-colors"
          >
            Powered by <span className="font-bold">Botivate</span>
          </a>
        </div>

        {/* Premium Bottom Navigation for Mobile */}
        <div className="md:hidden fixed bottom-6 left-4 right-4 h-16 bg-white/80 backdrop-blur-xl border border-white/20 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] z-50 flex items-center justify-around px-2">
          <Link
            to="/dashboard/admin"
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 ${location.pathname === "/dashboard/admin"
              ? "text-[#173254] bg-blue-50"
              : "text-slate-400 hover:text-[#173254]"
              }`}
          >
            <Home size={22} strokeWidth={location.pathname === "/dashboard/admin" ? 2.5 : 2} />
            <span className="text-[10px] mt-1 font-bold">Home</span>
          </Link>



          <Link
            to="/dashboard/task"
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 ${location.pathname === "/dashboard/task"
              ? "text-[#173254] bg-blue-50"
              : "text-slate-400 hover:text-[#173254]"
              }`}
          >
            <CalendarCheck size={22} strokeWidth={location.pathname === "/dashboard/task" ? 2.5 : 2} />
            <span className="text-[10px] mt-1 font-bold">Tasks</span>
          </Link>

          {(() => {
            const showAddButton = (userRole?.toUpperCase() === "ADMIN" || userRole?.toUpperCase() === "HOD" || (userRole?.toLowerCase() === "user" && localStorage.getItem("can_self_assign") === "true"));
            console.log(`📱 Mobile Nav Debug: Role=${userRole}, CanSelfAssign=${localStorage.getItem("can_self_assign")}, ShowAddButton=${showAddButton}`);
            return showAddButton;
          })() && (
              <div className="relative -mt-12">
                <Link
                  to="/dashboard/assign-task"
                  className="flex items-center justify-center w-14 h-14 bg-[#173254] rounded-2xl shadow-lg shadow-slate-300 text-white transform active:scale-90 transition-all duration-300 border-4 border-slate-100"
                >
                  <CirclePlus size={28} strokeWidth={2.5} />
                </Link>
              </div>
            )}

          <Link
            to="/dashboard/delegation"
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 ${location.pathname === "/dashboard/delegation"
              ? "text-[#173254] bg-blue-50"
              : "text-slate-400 hover:text-[#173254]"
              }`}
          >
            <BookmarkCheck size={22} strokeWidth={location.pathname === "/dashboard/delegation" ? 2.5 : 2} />
            <span className="text-[10px] mt-1 font-bold">Status</span>
          </Link>

          <button
            onClick={() => setIsUserPopupOpen(true)}
            className="flex flex-col items-center justify-center w-12 h-12 rounded-xl text-slate-400 hover:text-[#173254] transition-all"
          >
            <UserRound size={22} strokeWidth={2} />
            <span className="text-[10px] mt-1 font-bold">Profile</span>
          </button>
        </div>

        {/* User Popup */}
        {isUserPopupOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-md p-4 transition-all duration-300">
            <div className="bg-white rounded-[2rem] w-full max-w-[340px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden animate-in fade-in zoom-in-95 duration-300 border border-white/50">
              {/* Header Gradient */}
              <div className="h-32 bg-[#173254] relative">
                <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px]"></div>
                <button
                  onClick={() => setIsUserPopupOpen(false)}
                  className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 rounded-full text-white transition-all hover:rotate-90 z-10"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Profile Info */}
              <div className="px-8 pb-8 text-center bg-white">
                <div className="relative -mt-16 mb-6 flex justify-center">
                  <div className="h-28 w-28 rounded-full bg-white p-1.5 shadow-2xl ring-4 ring-white/30">
                    <div className="h-full w-full rounded-full bg-[#173254] flex items-center justify-center overflow-hidden border-2 border-white shadow-inner">
                      {profileImage ? (
                        <img src={profileImage} alt={username} className="h-full w-full object-cover transform hover:scale-110 transition-transform duration-500" />
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
                    <h3 className="text-2xl font-black text-gray-900 tracking-tight mb-1">
                      {username || "User"}
                    </h3>
                    <div className="flex justify-center flex-wrap gap-2">
                      <span className="text-[10px] font-black text-[#173254] uppercase tracking-[0.2em] px-3 py-1 bg-slate-100 rounded-full border border-slate-200">
                        {userRole?.toLowerCase() === "admin" ? (isSuperAdmin ? "Super Admin" : "Administrator") : userRole?.toLowerCase() === "hod" ? "HOD / Supervisor" : "Staff"}
                      </span>
                    </div>
                  </div>

                  <div className="py-3 px-4 bg-slate-50 rounded-2xl flex items-center justify-center gap-2 border border-slate-200">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-xs font-bold text-slate-600 truncate">{userEmail || "user@example.com"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setIsUserPopupOpen(false)}
                    className="flex justify-center items-center py-3.5 px-4 rounded-2xl text-xs font-black text-slate-500 border-2 border-slate-200 hover:bg-slate-100 hover:text-slate-800 transition-all active:scale-95 uppercase tracking-widest"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={handleLogout}
                    className="flex justify-center items-center gap-2 py-3.5 px-4 rounded-2xl text-xs font-black text-white bg-[#173254] hover:bg-[#10243e] shadow-md transition-all active:scale-95 uppercase tracking-widest"
                  >
                    Logout <LogOut size={14} strokeWidth={3} />
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
