
import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import * as Lucide from "lucide-react";
import supabase from "../../SupabaseClient";
import { useMagicToast } from '../../context/MagicToastContext';
import systemRegistry from "../../core/registry/systemRegistry";
import MasterDataView from "../components/MasterDataView";
import { motion } from 'framer-motion';

export default function GlobalSettings() {
  const { showToast } = useMagicToast();
  const [activeTab, setActiveTab] = useState("users");
  const [showGlobalShipToModal, setShowGlobalShipToModal] = useState(false);
  const [globalShipToForm, setGlobalShipToForm] = useState({
    name: 'Bhatia Enterprises',
    contact: '9028105766',
    email: 'purchase-team@bhatia.com',
    gstin: '22AAAFB4097G1ZR',
    address: 'Nehru Chowk, Bilaspur (C.G.)'
  });
  const [savingGlobalShipTo, setSavingGlobalShipTo] = useState(false);

  // Load Ship To Config on mount
  useEffect(() => {
    supabase
      .from('festival_contacts')
      .select('extra_fields')
      .eq('name', 'GLOBAL_SHIP_TO')
      .maybeSingle()
      .then(({ data }) => {
        if (data && data.extra_fields) {
          setGlobalShipToForm({
            name: data.extra_fields.name || 'Bhatia Enterprises',
            contact: data.extra_fields.contact || '9028105766',
            email: data.extra_fields.email || 'purchase-team@bhatia.com',
            gstin: data.extra_fields.gstin || '22AAAFB4097G1ZR',
            address: data.extra_fields.address || 'Nehru Chowk, Bilaspur (C.G.)'
          });
        }
      });
  }, []);

  const handleSaveGlobalShipTo = async (e) => {
    e.preventDefault();
    setSavingGlobalShipTo(true);
    try {
      // Check if existing record exists
      const { data: existing } = await supabase
        .from('festival_contacts')
        .select('id')
        .eq('name', 'GLOBAL_SHIP_TO')
        .maybeSingle();

      const payload = {
        name: 'GLOBAL_SHIP_TO',
        phone_number: globalShipToForm.contact || '0000000000',
        is_active: false,
        extra_fields: globalShipToForm
      };

      let error;
      if (existing) {
        const res = await supabase
          .from('festival_contacts')
          .update(payload)
          .eq('id', existing.id);
        error = res.error;
      } else {
        const res = await supabase
          .from('festival_contacts')
          .insert([payload]);
        error = res.error;
      }

      if (error) throw error;
      showToast('Global Ship To settings updated successfully!', 'success');
      setShowGlobalShipToModal(false);
    } catch (err) {
      showToast('Failed to save settings: ' + err.message, 'error');
    } finally {
      setSavingGlobalShipTo(false);
    }
  };

  // Data States
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // User Editor Modal State
  const [editingUser, setEditingUser] = useState(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [modalTab, setModalTab] = useState("profile"); // 'profile' or 'permissions'

  // Form State
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState(null);
  const [removeProfileImage, setRemoveProfileImage] = useState(false);

  const [userForm, setUserForm] = useState({
    user_name: "",
    password: "",
    email_id: "",
    number: "",
    employee_id: "",
    role: "user",
    status: "active",
    department: "",
    Designation: "",
    reported_by: "",
    can_self_assign: false,
  });

  // Selected Permissions States for the Editor
  const [selectedSystems, setSelectedSystems] = useState([]);
  const [selectedPages, setSelectedPages] = useState([]);
  const [activePermissionSystem, setActivePermissionSystem] = useState(null);

  // Load registered systems and their pages dynamically
  const registeredSystems = systemRegistry.getAllSystems();

  // Helper to compile routes/pages for a system dynamically from registry
  const getPagesForSystem = (system) => {
    const pages = [];

    // 1. Process menuItems
    if (system.menuItems) {
      system.menuItems.forEach((item) => {
        if (item.isSubmenu && item.subItems) {
          item.subItems.forEach((sub) => {
            if (sub.href) {
              pages.push({
                label: sub.label,
                path: sub.href,
                parentLabel: item.label
              });
            }
          });
        } else if (item.href) {
          pages.push({
            label: item.label,
            path: item.href,
            parentLabel: null
          });
        }
      });
    }

    // 2. Process routes (capture any routes that are not in menuItems)
    if (system.routes) {
      system.routes.forEach((route) => {
        if (!route.path) return;

        // Skip dynamic parameters for listing, clean up path
        const cleanPath = route.path.split("/:")[0];
        if (cleanPath === "*" || cleanPath === "") return;

        const exists = pages.some(p => p.path === cleanPath);
        if (exists) return;

        // Humanize route name
        const parts = cleanPath.split("/");
        const lastPart = parts[parts.length - 1];
        const label = lastPart
          ? lastPart.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
          : cleanPath;

        pages.push({
          label: label,
          path: cleanPath,
          parentLabel: "Additional Route"
        });
      });
    }

    return pages;
  };

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Users
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("*")
        .order("user_name", { ascending: true });

      if (usersError) throw usersError;
      setUsers(usersData || []);

      // 2. Fetch Departments
      const { data: deptsData } = await supabase
        .from("departments")
        .select("id, name")
        .order("name", { ascending: true });
      setDepartments(deptsData || []);

    } catch (err) {
      console.error("Error fetching data:", err.message);
      showToast("Failed to load users: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quick toggle active/inactive status
  const handleToggleUserStatus = async (user) => {
    const newStatus = user.status === "active" ? "inactive" : "active";
    try {
      const { error } = await supabase
        .from("users")
        .update({ status: newStatus })
        .eq("id", user.id);

      if (error) throw error;

      setUsers(prev =>
        prev.map(u => u.id === user.id ? { ...u, status: newStatus } : u)
      );
      showToast(`User ${user.user_name} is now ${newStatus}!`, "success");
    } catch (err) {
      showToast("Error updating status: " + err.message, "error");
    }
  };

  // Quick delete user
  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Are you sure you want to permanently delete user "${user.user_name}"?`)) return;
    try {
      const { error } = await supabase
        .from("users")
        .delete()
        .eq("id", user.id);

      if (error) throw error;

      setUsers(prev => prev.filter(u => u.id !== user.id));
      showToast(`User ${user.user_name} deleted successfully!`, "success");
    } catch (err) {
      showToast("Error deleting user: " + err.message, "error");
    }
  };

  // Open modal for editing
  const startEditUser = (user) => {
    setIsNewUser(false);
    setEditingUser(user);
    setModalTab("profile");

    // Set form fields
    setUserForm({
      user_name: user.user_name || "",
      password: "", // Blank initially for editing
      email_id: user.email_id || "",
      number: user.number || "",
      employee_id: user.employee_id || "",
      role: user.role || "user",
      status: user.status || "active",
      department: user.department || "",
      Designation: user.Designation || "",
      reported_by: user.reported_by || "",
      can_self_assign: user.can_self_assign || false,
      dob: user.dob || "",
    });

    setProfileImageFile(null);
    setProfileImagePreview(user.profile_image || null);
    setRemoveProfileImage(false);

    // Parse permissions
    if (user.system_access === "all") {
      setSelectedSystems(registeredSystems.map(s => s.id));
    } else if (user.system_access) {
      setSelectedSystems(user.system_access.split(",").map(s => s.trim()));
    } else {
      setSelectedSystems([]);
    }

    if (user.page_access === "all") {
      const allPages = [];
      registeredSystems.forEach(sys => {
        getPagesForSystem(sys).forEach(p => allPages.push(p.path));
      });
      setSelectedPages(allPages);
    } else if (user.page_access) {
      setSelectedPages(user.page_access.split(",").map(p => p.trim()));
    } else {
      setSelectedPages([]);
    }

    if (registeredSystems.length > 0) {
      setActivePermissionSystem(registeredSystems[0].id);
    }
  };

  // Open modal for creating new user
  const startCreateUser = () => {
    setIsNewUser(true);
    setEditingUser({ id: null });
    setModalTab("profile");

    setUserForm({
      user_name: "",
      password: "",
      email_id: "",
      number: "",
      employee_id: "",
      role: "user",
      status: "active",
      department: departments[0]?.name || "",
      Designation: "",
      reported_by: "",
      can_self_assign: false,
      dob: "",
    });

    setProfileImageFile(null);
    setProfileImagePreview(null);
    setRemoveProfileImage(false);

    // Default permission: All systems and pages allowed
    setSelectedSystems(registeredSystems.map(s => s.id));
    const allPages = [];
    registeredSystems.forEach(sys => {
      getPagesForSystem(sys).forEach(p => allPages.push(p.path));
    });
    setSelectedPages(allPages);

    if (registeredSystems.length > 0) {
      setActivePermissionSystem(registeredSystems[0].id);
    }
  };

  // Handle system access checkbox change
  const handleSystemToggle = (systemId) => {
    setSelectedSystems(prev => {
      const isSelected = prev.includes(systemId);
      let updated;
      if (isSelected) {
        updated = prev.filter(id => id !== systemId);
        // Also remove all pages associated with this system
        const system = registeredSystems.find(s => s.id === systemId);
        if (system) {
          const sysPagePaths = getPagesForSystem(system).map(p => p.path);
          setSelectedPages(pages => pages.filter(p => !sysPagePaths.includes(p)));
        }
      } else {
        updated = [...prev, systemId];
        // Automatically check all pages in this system by default
        const system = registeredSystems.find(s => s.id === systemId);
        if (system) {
          const sysPagePaths = getPagesForSystem(system).map(p => p.path);
          setSelectedPages(pages => [...new Set([...pages, ...sysPagePaths])]);
        }
      }
      return updated;
    });
  };

  // Handle page access checkbox change
  const handlePageToggle = (pagePath) => {
    setSelectedPages(prev =>
      prev.includes(pagePath) ? prev.filter(p => p !== pagePath) : [...prev, pagePath]
    );
  };

  // Toggle all pages for a specific system
  const handleToggleAllPagesForSystem = (systemId, checkAll) => {
    const system = registeredSystems.find(s => s.id === systemId);
    if (!system) return;
    const sysPagePaths = getPagesForSystem(system).map(p => p.path);

    setSelectedPages(prev => {
      if (checkAll) {
        return [...new Set([...prev, ...sysPagePaths])];
      } else {
        return prev.filter(p => !sysPagePaths.includes(p));
      }
    });
  };

  // Profile image handlers
  const handleProfileImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileImageFile(file);
    setRemoveProfileImage(false);
    if (profileImagePreview && profileImagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(profileImagePreview);
    }
    setProfileImagePreview(URL.createObjectURL(file));
  };

  const handleRemoveProfileImage = () => {
    if (profileImagePreview && profileImagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(profileImagePreview);
    }
    setProfileImageFile(null);
    setProfileImagePreview(null);
    setRemoveProfileImage(true);
  };

  // Save changes to database
  const handleSaveUser = async (e) => {
    e.preventDefault();
    const usernameStr = userForm.user_name ? String(userForm.user_name).trim() : "";
    if (!usernameStr) {
      showToast("Username is required", "error");
      return;
    }

    try {
      // Handle profile image upload/removal
      let profileImageUrl;
      if (profileImageFile) {
        const fileExt = profileImageFile.name.split(".").pop();
        const fileName = `profile_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from("user-profiles").upload(fileName, profileImageFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("user-profiles").getPublicUrl(fileName);
        profileImageUrl = urlData.publicUrl;
      } else if (removeProfileImage) {
        profileImageUrl = null;
      }

      // Determine permission strings
      let systemAccessStr = selectedSystems.join(",");
      if (selectedSystems.length === 0) {
        systemAccessStr = "none";
      } else if (selectedSystems.length === registeredSystems.length) {
        systemAccessStr = "all";
      }

      let pageAccessStr = selectedPages.join(",");
      const totalPages = registeredSystems.reduce((acc, sys) => acc + getPagesForSystem(sys).length, 0);
      if (selectedPages.length === 0) {
        pageAccessStr = "none";
      } else if (selectedPages.length === totalPages) {
        pageAccessStr = "all";
      }

      const payload = {
        user_name: usernameStr,
        ...(profileImageUrl !== undefined ? { profile_image: profileImageUrl } : {}),
        email_id: userForm.email_id ? String(userForm.email_id).trim() : null,
        number: userForm.number ? String(userForm.number).trim() : null,
        role: userForm.role,
        status: userForm.status,
        department: userForm.department || null,
        Designation: userForm.Designation ? String(userForm.Designation).trim() : null,
        reported_by: userForm.reported_by || null,
        can_self_assign: userForm.can_self_assign,
        dob: userForm.dob || null,
        system_access: systemAccessStr,
        page_access: pageAccessStr,
      };

      if (isNewUser) {
        // Find highest existing ID to increment
        const { data: maxIdData, error: maxIdError } = await supabase
          .from("users")
          .select("id")
          .order("id", { ascending: false })
          .limit(1);

        if (maxIdError) throw maxIdError;
        const nextId = (maxIdData?.[0]?.id || 0) + 1;

        // Auto-generate employee id if empty
        const empIdRaw = userForm.employee_id ? String(userForm.employee_id).trim() : "";
        const empId = empIdRaw || `EMP-${Date.now().toString().slice(-6)}`;

        payload.id = nextId;
        payload.employee_id = empId;
        payload.password = userForm.password ? String(userForm.password).trim() : "123456"; // Default password

        const { error: insertError } = await supabase
          .from("users")
          .insert([payload]);

        if (insertError) throw insertError;
        showToast(`User "${userForm.user_name}" created successfully!`, "success");
      } else {
        // Update user
        const empIdRaw = userForm.employee_id ? String(userForm.employee_id).trim() : "";
        payload.employee_id = empIdRaw || null;

        // Add password if edited
        const passwordStr = userForm.password ? String(userForm.password).trim() : "";
        if (passwordStr) {
          payload.password = passwordStr;
        }

        const { error: updateError } = await supabase
          .from("users")
          .update(payload)
          .eq("id", editingUser.id);

        if (updateError) throw updateError;

        // CRITICAL: If current user updated their own record, update localStorage
        const currentLoggedName = localStorage.getItem("user-name");
        if (editingUser.user_name === currentLoggedName) {
          localStorage.setItem("role", payload.role);
          localStorage.setItem("email_id", payload.email_id || "");
          localStorage.setItem("can_self_assign", payload.can_self_assign ? "true" : "false");
          localStorage.setItem("designation", payload.Designation || "");

          // Re-serialize slugs for local verification
          let slugs = [];
          if (payload.system_access === "all") {
            slugs = ["checklist-delegation", "mis-summary"];
          } else if (payload.system_access === "none") {
            slugs = [];
          } else if (payload.system_access) {
            slugs = payload.system_access.split(",").map(s => s.trim()).filter(Boolean);
          } else {
            slugs = ["checklist-delegation", "mis-summary"];
          }
          localStorage.setItem("allowed-systems", JSON.stringify(slugs));

          // Calculate allowed page paths
          let allowedRts = [];
          if (payload.page_access === "all") {
            const roleLower = payload.role.toLowerCase();
            const isLegacyAdmin = roleLower === "admin" || roleLower === "super admin" || roleLower === "superadmin" || currentLoggedName.toLowerCase() === "admin";
            if (isLegacyAdmin) {
              allowedRts = [
                "/dashboard/admin", "/dashboard/notifications", "/dashboard/quick-task",
                "/dashboard/assign-task", "/dashboard/checklist", "/dashboard/maintenance",
                "/dashboard/repair", "/dashboard/ea-task", "/dashboard/calendar",
                "/dashboard/task", "/dashboard/training-video", "/dashboard/bulk-import",
                "/dashboard/holiday-list", "/dashboard/working-day-calendar",
                "/dashboard/data", "/dashboard/admin-data", "/dashboard/delegation",
                "/dashboard/delegation-data", "/dashboard/admin-approval",
                "/dashboard/mis-report", "/dashboard/setting", "/dashboard/global-settings",
                "/dashboard/mis-summary", "/dashboard/mis-history", "/dashboard/mis-kpi-kra"
              ];
            } else if (roleLower === "hod") {
              allowedRts = [
                "/dashboard/admin", "/dashboard/notifications", "/dashboard/assign-task",
                "/dashboard/delegation", "/dashboard/task", "/dashboard/calendar",
                "/dashboard/training-video", "/dashboard/bulk-import", "/dashboard/delegation-data",
                "/dashboard/admin-approval",
                "/dashboard/mis-summary", "/dashboard/mis-history", "/dashboard/mis-kpi-kra"
              ];
            } else {
              allowedRts = [
                "/dashboard/admin", "/dashboard/notifications", "/dashboard/delegation",
                "/dashboard/task", "/dashboard/calendar", "/dashboard/training-video",
                "/dashboard/mis-summary", "/dashboard/mis-history", "/dashboard/mis-kpi-kra"
              ];
            }
          } else if (payload.page_access === "none") {
            allowedRts = ["/dashboard", "/dashboard/notifications"];
          } else if (payload.page_access) {
            allowedRts = payload.page_access.split(",").map(p => p.trim()).filter(Boolean);
            if (!allowedRts.includes("/dashboard")) allowedRts.push("/dashboard");
            if (!allowedRts.includes("/dashboard/notifications")) allowedRts.push("/dashboard/notifications");
          } else {
            allowedRts = ["/dashboard", "/dashboard/notifications"];
          }
          localStorage.setItem("allowed-pages", JSON.stringify(allowedRts));
        }

        showToast(`User "${userForm.user_name}" updated successfully!`, "success");
      }

      setEditingUser(null);
      fetchData();
    } catch (err) {
      showToast("Failed to save user: " + err.message, "error");
    }
  };

  // Filter users based on search and drop-downs
  const filteredUsers = users.filter((u) => {
    const nameMatch = u.user_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const roleMatch = roleFilter === "all" || u.role?.toLowerCase() === roleFilter.toLowerCase();
    const statusMatch = statusFilter === "all" || u.status?.toLowerCase() === statusFilter.toLowerCase();
    return nameMatch && roleMatch && statusMatch;
  });

  const getLucideIcon = (name, size = 18, className = "") => {
    const IconComponent = Lucide[name] || Lucide.Layers;
    return <IconComponent size={size} className={className} />;
  };

  return (
    <div className="py-6 max-w-7xl mx-auto px-2">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-blue-700 to-purple-700 bg-clip-text text-transparent flex items-center gap-2">
            <Lucide.Sliders className="text-blue-600" size={28} />
            Global Settings
          </h1>
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest mt-1">
            Master System Permissions & Modules Controller
          </p>
        </div>

        {/* Tab & Settings Controls */}
        <div className="flex items-center gap-3">
          <div className="flex bg-white/60 backdrop-blur-md border border-blue-100 rounded-2xl p-1 shadow-sm">
            <button
              onClick={() => setActiveTab("users")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${activeTab === "users"
                ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md shadow-blue-100"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                }`}
            >
              <Lucide.Users size={14} />
              User Accounts
            </button>
            <button
              onClick={() => setActiveTab("modules")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${activeTab === "modules"
                ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md shadow-blue-100"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                }`}
            >
              <Lucide.Grid size={14} />
              Master
            </button>
          </div>

          <button
            onClick={async () => {
              // Fetch latest configuration from Supabase before opening the modal
              try {
                const { data } = await supabase
                  .from('festival_contacts')
                  .select('extra_fields')
                  .eq('name', 'GLOBAL_SHIP_TO')
                  .maybeSingle();
                if (data && data.extra_fields) {
                  setGlobalShipToForm({
                    name: data.extra_fields.name || '',
                    contact: data.extra_fields.contact || '',
                    email: data.extra_fields.email || '',
                    gstin: data.extra_fields.gstin || '',
                    address: data.extra_fields.address || ''
                  });
                }
              } catch (err) {
                console.error("Error loading global settings:", err);
              }
              setShowGlobalShipToModal(true);
            }}
            className="flex items-center gap-2 px-5 py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-md shadow-blue-100 active:scale-98"
          >
            <Lucide.Settings size={14} />
            Global Settings
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-[50vh] items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Lucide.Loader className="h-8 w-8 animate-spin text-blue-600" />
            <span className="text-sm font-semibold text-gray-500">Loading master settings...</span>
          </div>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {/* TAB 1: USER ACCOUNT MANAGEMENT */}
          {activeTab === "users" && (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Filter Bar */}
              <div className="bg-white rounded-3xl border border-blue-100 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1 flex flex-wrap items-center gap-3">
                  {/* Search */}
                  <div className="relative flex-1 min-w-[200px]">
                    <Lucide.Search className="absolute left-3.5 top-3.5 text-gray-400" size={16} />
                    <input
                      type="text"
                      placeholder="Search users by name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50/50 border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    />
                  </div>

                  {/* Role Filter */}
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="bg-gray-50/50 border border-gray-150 rounded-2xl px-4 py-3 text-xs font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  >
                    <option value="all">All Roles</option>
                    <option value="admin">Admins</option>
                    <option value="hod">HODs</option>
                    <option value="user">Users</option>
                  </select>

                  {/* Status Filter */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-gray-50/50 border border-gray-150 rounded-2xl px-4 py-3 text-xs font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="on_leave">On Leave</option>
                  </select>
                </div>

                <button
                  onClick={startCreateUser}
                  className="px-5 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-md shadow-blue-100 flex items-center justify-center gap-2 active:scale-98"
                >
                  <Lucide.UserPlus size={14} />
                  Create New User
                </button>
              </div>

              {/* Users Grid */}
              <div className="bg-white rounded-3xl border border-blue-100 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-blue-50 bg-gradient-to-r from-blue-50/30 to-purple-50/30 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        <th className="py-4 px-6">Employee ID</th>
                        <th className="py-4 px-6">Name</th>
                        <th className="py-4 px-6">Role / Designation</th>
                        <th className="py-4 px-6">Department</th>
                        <th className="py-4 px-6">Access Modules</th>
                        <th className="py-4 px-6">Status</th>
                        <th className="py-4 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-50/50 text-xs text-gray-600">
                      {filteredUsers.length > 0 ? (
                        filteredUsers.map((u) => {
                          const systemCount = u.system_access === "all"
                            ? registeredSystems.length
                            : (u.system_access || "").split(",").filter(Boolean).length;

                          return (
                            <tr key={u.id} className="hover:bg-blue-50/20 transition-colors duration-200">
                              <td className="py-4 px-6 font-mono text-[11px] text-gray-400">{u.employee_id || "—"}</td>
                              <td className="py-4 px-6">
                                <div className="flex items-center gap-3">
                                  <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-blue-500/20 to-purple-500/20 border border-blue-100/50 flex items-center justify-center overflow-hidden flex-shrink-0">
                                    {u.profile_image ? (
                                      <img src={u.profile_image} alt={u.user_name} className="h-full w-full object-cover" />
                                    ) : (
                                      <span className="font-black text-xs text-blue-700 uppercase">{u.user_name?.charAt(0)}</span>
                                    )}
                                  </div>
                                  <div>
                                    <div className="font-bold text-gray-900 text-sm">{u.user_name}</div>
                                    <div className="text-[10px] text-gray-400">{u.email_id || u.number || "No contact info"}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 px-6">
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${u.role === "admin"
                                  ? "bg-purple-50 text-purple-700 border border-purple-100"
                                  : u.role === "hod"
                                    ? "bg-blue-50 text-blue-700 border border-blue-100"
                                    : "bg-gray-50 text-gray-500 border border-gray-150"
                                  }`}>
                                  {u.role}
                                </span>
                                {u.Designation && <span className="block text-[10px] text-gray-400 font-semibold mt-0.5">{u.Designation}</span>}
                              </td>
                              <td className="py-4 px-6 font-semibold text-gray-700">{u.department || "—"}</td>
                              <td className="py-4 px-6">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-black text-gray-800 bg-blue-50 border border-blue-100 rounded-md px-2 py-0.5 text-[10px]">
                                    {systemCount} Modules
                                  </span>
                                  {u.system_access === "all" && (
                                    <span className="text-[9px] font-bold text-purple-700 bg-purple-50 border border-purple-100 px-1.5 py-0.2 rounded uppercase">Full</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-4 px-6">
                                <button
                                  onClick={() => handleToggleUserStatus(u)}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition-all border ${u.status === "active"
                                    ? "bg-green-50 text-green-700 border-green-150 hover:bg-green-100"
                                    : u.status === "inactive"
                                      ? "bg-red-50 text-red-700 border-red-150 hover:bg-red-100"
                                      : "bg-amber-50 text-amber-700 border-amber-150 hover:bg-amber-100"
                                    }`}
                                >
                                  <span className={`h-1.5 w-1.5 rounded-full ${u.status === "active" ? "bg-green-500" : u.status === "inactive" ? "bg-red-500" : "bg-amber-500"
                                    }`} />
                                  {u.status || "active"}
                                </button>
                              </td>
                              <td className="py-4 px-6 text-right">
                                <div className="flex justify-end gap-1">
                                  <button
                                    onClick={() => startEditUser(u)}
                                    title="Edit User & Permissions"
                                    className="p-2 text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 rounded-xl transition-all"
                                  >
                                    <Lucide.UserCog size={15} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteUser(u)}
                                    title="Delete User"
                                    className="p-2 text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-xl transition-all"
                                  >
                                    <Lucide.Trash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-gray-400">
                            <Lucide.Inbox className="mx-auto text-gray-300 mb-3" size={36} />
                            No users found matching filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: SYSTEM MODULES CONTROLLER */}
          {/* TAB 2: MASTER DATA (VENDORS / TRANSPORTERS) */}
          {activeTab === "modules" && (
            <motion.div
              key="modules"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
            >
              <MasterDataView />
            </motion.div>
          )}



        </AnimatePresence>
      )}

      {/* USER EDITOR MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setEditingUser(null)}></div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-blue-50 flex flex-col h-[90vh] max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-4 flex justify-between items-center border-b border-blue-50">
              <div>
                <h3 className="font-black text-gray-900 text-lg">
                  {isNewUser ? "Create User Account" : `Edit User: ${editingUser.user_name}`}
                </h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  Configuring general profile & systems authorization
                </p>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Lucide.X size={20} />
              </button>
            </div>

            {/* Modal Subtabs Selector */}
            <div className="flex border-b border-gray-100 bg-gray-50/50 p-2">
              <button
                type="button"
                onClick={() => setModalTab("profile")}
                className={`flex-1 py-2 text-xs font-black uppercase tracking-wider text-center rounded-xl transition-all duration-200 ${modalTab === "profile"
                  ? "bg-white text-blue-600 shadow-sm font-black border border-blue-50"
                  : "text-gray-400 hover:text-gray-600"
                  }`}
              >
                1. General Profile
              </button>
              <button
                type="button"
                onClick={() => setModalTab("permissions")}
                className={`flex-1 py-2 text-xs font-black uppercase tracking-wider text-center rounded-xl transition-all duration-200 ${modalTab === "permissions"
                  ? "bg-white text-blue-600 shadow-sm font-black border border-blue-50"
                  : "text-gray-400 hover:text-gray-600"
                  }`}
              >
                2. System & Page Permissions
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveUser} className="flex-1 overflow-y-auto flex flex-col min-h-0">
              {modalTab === "profile" ? (
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto flex-1 min-h-0">
                  {/* Profile Image */}
                  <div className="md:col-span-2 flex items-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-blue-500/20 to-purple-500/20 border border-blue-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {profileImagePreview ? (
                        <img src={profileImagePreview} alt="Profile" className="h-full w-full object-cover" />
                      ) : (
                        <span className="font-black text-lg text-blue-700 uppercase">{userForm.user_name?.charAt(0) || "?"}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3.5 py-2 text-[11px] font-bold text-gray-700 hover:bg-gray-50">
                        <Lucide.Upload size={13} />
                        {profileImagePreview ? "Change Photo" : "Upload Photo"}
                        <input type="file" accept="image/*" className="hidden" onChange={handleProfileImageChange} />
                      </label>
                      {profileImagePreview && (
                        <button
                          type="button"
                          onClick={handleRemoveProfileImage}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-red-150 px-3.5 py-2 text-[11px] font-bold text-red-600 hover:bg-red-50"
                        >
                          <Lucide.Trash2 size={13} />
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Username */}
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Username *</label>
                    <input
                      type="text"
                      required
                      value={userForm.user_name}
                      onChange={(e) => setUserForm({ ...userForm, user_name: e.target.value })}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    />
                  </div>

                  {/* Password */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      {isNewUser ? "Password *" : "New Password (leave blank to keep current)"}
                    </label>
                    <input
                      type="password"
                      required={isNewUser}
                      value={userForm.password}
                      onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                      placeholder={isNewUser ? "Password" : "••••••••"}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    />
                  </div>

                  {/* Employee ID */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Employee ID (Optional)</label>
                    <input
                      type="text"
                      value={userForm.employee_id}
                      onChange={(e) => setUserForm({ ...userForm, employee_id: e.target.value })}
                      placeholder="Leave blank to auto-generate"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    />
                  </div>

                  {/* Email ID */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Email Address</label>
                    <input
                      type="email"
                      value={userForm.email_id}
                      onChange={(e) => setUserForm({ ...userForm, email_id: e.target.value })}
                      placeholder="e.g. user@bhatiya.com"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    />
                  </div>

                  {/* Phone number */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Phone Number</label>
                    <input
                      type="tel"
                      value={userForm.number}
                      onChange={(e) => setUserForm({ ...userForm, number: e.target.value })}
                      placeholder="e.g. 9876543210"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    />
                  </div>

                  {/* Role */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">System Role</label>
                    <select
                      value={userForm.role}
                      onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-gray-600"
                    >
                      <option value="user">User (Doer)</option>
                      <option value="hod">HOD (Head of Department)</option>
                      <option value="admin">Administrator (Full Access)</option>
                    </select>
                  </div>

                  {/* Status */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Account Status</label>
                    <select
                      value={userForm.status}
                      onChange={(e) => setUserForm({ ...userForm, status: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-gray-600"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="on_leave">On Leave</option>
                    </select>
                  </div>



                  {/* Department */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Department</label>
                    <select
                      value={userForm.department}
                      onChange={(e) => setUserForm({ ...userForm, department: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-gray-600"
                    >
                      <option value="">No Department</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Designation */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Designation</label>
                    <input
                      type="text"
                      value={userForm.Designation}
                      onChange={(e) => setUserForm({ ...userForm, Designation: e.target.value })}
                      placeholder="e.g. Sales Executive"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    />
                  </div>

                  {/* Date of Birth */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      Date of Birth
                      <span className="ml-1 text-[9px] font-semibold text-pink-500 bg-pink-50 border border-pink-100 px-1.5 py-0.5 rounded uppercase">Birthday Greetings</span>
                    </label>
                    <input
                      type="date"
                      value={userForm.dob}
                      onChange={(e) => setUserForm({ ...userForm, dob: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-gray-600"
                    />
                  </div>

                  {/* Reported By */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Reported To / Manager</label>
                    <select
                      value={userForm.reported_by}
                      onChange={(e) => setUserForm({ ...userForm, reported_by: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-gray-600"
                    >
                      <option value="">No Manager Assigned</option>
                      {users
                        .filter(u => u.id !== editingUser?.id && u.status === "active")
                        .map((u) => (
                          <option key={u.id} value={u.user_name}>{u.user_name}</option>
                        ))}
                    </select>
                  </div>

                  {/* Can Self Assign */}
                  <div className="flex items-center gap-3 pt-6 md:col-span-1">
                    <input
                      type="checkbox"
                      id="can_self_assign"
                      checked={userForm.can_self_assign}
                      onChange={(e) => setUserForm({ ...userForm, can_self_assign: e.target.checked })}
                      className="h-4.5 w-4.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor="can_self_assign" className="text-xs font-black text-gray-700 cursor-pointer uppercase tracking-wider">
                      Can Self-Assign Tasks
                    </label>
                  </div>
                </div>
              ) : (
                <div className="p-6 space-y-6 flex flex-col flex-1 overflow-y-auto min-h-0">
                  {/* System Level Access */}
                  <div>
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">System Module Access</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {registeredSystems.map((sys) => {
                        const isSelected = selectedSystems.includes(sys.id);
                        return (
                          <button
                            key={sys.id}
                            type="button"
                            onClick={() => handleSystemToggle(sys.id)}
                            className={`flex items-center justify-between p-4 border rounded-2xl text-left transition-all duration-300 ${isSelected
                              ? "bg-gradient-to-br from-blue-50/50 to-purple-50/50 border-blue-300 text-blue-800 font-bold"
                              : "border-gray-200 text-gray-600 bg-white hover:bg-gray-50"
                              }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-xl border ${isSelected ? "bg-white border-blue-200 text-blue-600" : "bg-gray-50 border-gray-200 text-gray-400"}`}>
                                {getLucideIcon(sys.icon, 16)}
                              </div>
                              <span>{sys.name}</span>
                            </div>
                            {isSelected ? (
                              <Lucide.CheckCircle2 size={18} className="text-blue-600" />
                            ) : (
                              <div className="h-5 w-5 border-2 border-gray-200 rounded-full"></div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Page Level Access Matrix */}
                  <div className="flex flex-col">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Page & Navigation Access</h4>

                    {/* System tabs for page matrix */}
                    <div className="flex gap-2 mb-3 bg-gray-100 p-1 rounded-xl max-w-max border">
                      {registeredSystems
                        .filter(sys => selectedSystems.includes(sys.id))
                        .map(sys => (
                          <button
                            key={sys.id}
                            type="button"
                            onClick={() => setActivePermissionSystem(sys.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${activePermissionSystem === sys.id
                              ? "bg-white text-blue-600 shadow-sm border border-blue-50"
                              : "text-gray-500 hover:text-gray-800"
                              }`}
                          >
                            {sys.name}
                          </button>
                        ))}
                      {registeredSystems.filter(sys => selectedSystems.includes(sys.id)).length === 0 && (
                        <div className="text-[10px] text-gray-400 italic px-3 py-1.5 font-semibold">Enable system modules above to configure pages.</div>
                      )}
                    </div>
                    {activePermissionSystem && selectedSystems.includes(activePermissionSystem) && (
                      <div className="border border-blue-50 rounded-2xl p-4 bg-gray-50/50 flex flex-col">
                        <div className="flex items-center justify-between mb-3 border-b border-gray-200/50 pb-2">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Pages Available</span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleAllPagesForSystem(activePermissionSystem, true)}
                              className="text-[10px] font-bold text-blue-600 hover:underline"
                            >
                              Check All
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                              type="button"
                              onClick={() => handleToggleAllPagesForSystem(activePermissionSystem, false)}
                              className="text-[10px] font-bold text-gray-400 hover:underline"
                            >
                              Clear All
                            </button>
                          </div>
                        </div>

                        <div className="max-h-72 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-2 pr-1">
                          {getPagesForSystem(registeredSystems.find(s => s.id === activePermissionSystem))
                            .map((page) => {
                              const isAllowed = selectedPages.includes(page.path);
                              return (
                                <button
                                  key={page.path}
                                  type="button"
                                  onClick={() => handlePageToggle(page.path)}
                                  className={`flex items-center justify-between p-3 border rounded-xl text-left bg-white transition-all border-blue-50/30 ${isAllowed
                                    ? "border-purple-300 text-purple-800 font-bold bg-purple-50/10 shadow-sm"
                                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                                    }`}
                                >
                                  <div>
                                    <span className="text-xs font-bold block">{page.label}</span>
                                    <span className="text-[9px] text-gray-400 block font-normal">{page.path}</span>
                                  </div>
                                  {isAllowed ? (
                                    <Lucide.CheckCircle2 size={16} className="text-purple-600" />
                                  ) : (
                                    <div className="h-4.5 w-4.5 border-2 border-gray-200 rounded-full"></div>
                                  )}
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="bg-gray-50 border-t border-gray-100 px-6 py-4 flex gap-4">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-3 text-xs font-bold text-gray-400 border border-gray-200 bg-white rounded-2xl hover:bg-gray-50 hover:text-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 text-xs font-black text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl hover:opacity-90 transition-opacity shadow-md shadow-blue-100 uppercase tracking-wider"
                >
                  {isNewUser ? "Create User" : "Save Changes"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {/* GLOBAL SHIP TO SETTINGS MODAL */}
      {showGlobalShipToModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowGlobalShipToModal(false)}></div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-blue-50 flex flex-col max-h-[90vh] overflow-hidden"
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-6 py-4 flex justify-between items-center border-b border-blue-50 flex-shrink-0">
              <div>
                <h3 className="font-black text-gray-900 text-lg">Global Ship To Settings</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  Centrally configure the default delivery address
                </p>
              </div>
              <button
                onClick={() => setShowGlobalShipToModal(false)}
                className="p-1 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Lucide.X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveGlobalShipTo} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* Scrollable Form Body */}
              <div className="overflow-y-auto flex-1 p-6 space-y-4">
                {/* Name */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Company/Name *</label>
                  <input
                    type="text"
                    required
                    value={globalShipToForm.name}
                    onChange={(e) => setGlobalShipToForm({ ...globalShipToForm, name: e.target.value })}
                    placeholder="e.g. Bhatia Enterprises"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                </div>

                {/* Contact */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Contact Number *</label>
                  <input
                    type="text"
                    required
                    value={globalShipToForm.contact}
                    onChange={(e) => setGlobalShipToForm({ ...globalShipToForm, contact: e.target.value })}
                    placeholder="e.g. 9876543210"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Email Address</label>
                  <input
                    type="email"
                    value={globalShipToForm.email}
                    onChange={(e) => setGlobalShipToForm({ ...globalShipToForm, email: e.target.value })}
                    placeholder="e.g. shipping@bhatia.com"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                </div>

                {/* GSTIN */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">GSTIN</label>
                  <input
                    type="text"
                    value={globalShipToForm.gstin}
                    onChange={(e) => setGlobalShipToForm({ ...globalShipToForm, gstin: e.target.value })}
                    placeholder="e.g. 22AAAFB4097G1ZR"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                </div>

                {/* Address */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Address *</label>
                  <textarea
                    rows={2}
                    required
                    value={globalShipToForm.address}
                    onChange={(e) => setGlobalShipToForm({ ...globalShipToForm, address: e.target.value })}
                    placeholder="Enter complete shipping address"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all resize-none"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-gray-50 border-t border-gray-100 px-6 py-4 flex gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowGlobalShipToModal(false)}
                  className="flex-1 py-3 text-xs font-bold text-gray-400 border border-gray-200 bg-white rounded-2xl hover:bg-gray-50 hover:text-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingGlobalShipTo}
                  className="flex-1 py-3 text-xs font-black text-white bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl hover:opacity-90 transition-opacity shadow-md shadow-blue-100 uppercase tracking-wider disabled:opacity-60"
                >
                  {savingGlobalShipTo ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
