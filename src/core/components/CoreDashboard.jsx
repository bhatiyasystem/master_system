import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as LucideIcons from "lucide-react";
import supabase from "../../SupabaseClient";
import systemRegistry from "../registry/systemRegistry";

const SYSTEM_COLORS = {
  "checklist-delegation": { bg: "bg-blue-50", border: "border-blue-100", icon: "text-blue-600", badge: "bg-blue-100 text-blue-700" },
  "mis-summary":          { bg: "bg-violet-50", border: "border-violet-100", icon: "text-violet-600", badge: "bg-violet-100 text-violet-700" },
  "hr-fms":               { bg: "bg-emerald-50", border: "border-emerald-100", icon: "text-emerald-600", badge: "bg-emerald-100 text-emerald-700" },
  "whatsapp-management":  { bg: "bg-green-50", border: "border-green-100", icon: "text-green-600", badge: "bg-green-100 text-green-700" },
};

const FALLBACK_COLOR = { bg: "bg-gray-50", border: "border-gray-100", icon: "text-gray-500", badge: "bg-gray-100 text-gray-600" };

export default function CoreDashboard() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const username   = localStorage.getItem("user-name") || "";
  const role       = localStorage.getItem("role") || "user";
  const isSuperAdmin = localStorage.getItem("is-super-admin") === "true";

  const systems = systemRegistry.getAllSystems();
  const allowedSystemsRaw = localStorage.getItem("allowed-systems");
  const allowedSystems = allowedSystemsRaw ? JSON.parse(allowedSystemsRaw) : [];

  const accessibleSystems = systems.filter(sys =>
    isSuperAdmin || allowedSystems.includes(sys.id)
  );

  useEffect(() => {
    if (!username) return;
    supabase
      .from("users")
      .select("id, user_name, role, Designation, profile_image, email_id, can_self_assign, system_access, page_access")
      .eq("user_name", username)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data);
      })
      .finally(() => setLoading(false));
  }, [username]);

  const roleLabel = isSuperAdmin
    ? "Super Admin"
    : role.toLowerCase() === "hod"
    ? "HOD"
    : role.toLowerCase() === "admin"
    ? "Admin"
    : "Staff";

  const designation = profile?.Designation || localStorage.getItem("designation") || null;
  const email       = profile?.email_id || localStorage.getItem("email_id") || null;
  const profileImg  = profile?.profile_image || localStorage.getItem("profile_image") || null;

  const initials = username
    ? username.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "U";

  const getFirstRoute = (sys) => {
    const roleLower = role.toLowerCase();
    return (
      sys.menuItems?.find(item => !item.showFor || item.showFor.some(r => r.toLowerCase() === roleLower))?.href ||
      sys.routes?.[0]?.path ||
      "/dashboard"
    );
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-8">

      {/* ── Profile Card ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Top gradient strip */}
        <div className="h-24 bg-gradient-to-r from-blue-600 to-purple-600" />

        <div className="px-6 pb-6">
          {/* Avatar row */}
          <div className="flex items-end gap-4 -mt-12 mb-4">
            <div className="w-20 h-20 rounded-2xl ring-4 ring-white shadow-md bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center overflow-hidden shrink-0">
              {profileImg ? (
                <img src={profileImg} alt={username} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-black text-white">{initials}</span>
              )}
            </div>
            <div className="mb-1">
              <h1 className="text-xl font-black text-gray-900 leading-tight">{username || "User"}</h1>
              <span className="inline-block mt-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 uppercase tracking-wide">
                {roleLabel}
              </span>
            </div>
          </div>

          {/* Info grid */}
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 mt-2">
              <LucideIcons.Loader2 size={14} className="animate-spin" />
              Loading profile…
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              {[
                { icon: "Mail",       label: "Email",       value: email },
                { icon: "Briefcase",  label: "Designation", value: designation },
                { icon: "ShieldCheck",label: "Access Level",value: isSuperAdmin ? "Full access" : `${accessibleSystems.length} module${accessibleSystems.length !== 1 ? "s" : ""}` },
                { icon: "ToggleRight",label: "Self-assign", value: profile?.can_self_assign ? "Enabled" : "Disabled" },
              ].filter(item => item.value != null).map(({ icon, label, value }) => {
                const Icon = LucideIcons[icon];
                return (
                  <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="w-7 h-7 rounded-lg bg-white border border-gray-100 flex items-center justify-center shrink-0">
                      <Icon size={13} className="text-gray-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
                      <p className="text-sm font-semibold text-gray-800 truncate">{value}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Accessible Modules ── */}
      <div>
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">
          Your Modules ({accessibleSystems.length})
        </h2>

        {accessibleSystems.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <LucideIcons.ShieldAlert size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-semibold text-gray-500">No modules assigned</p>
            <p className="text-xs text-gray-400 mt-1">Ask your administrator to configure system access.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {accessibleSystems.map(sys => {
              const colors = SYSTEM_COLORS[sys.id] || FALLBACK_COLOR;
              const Icon = LucideIcons[sys.icon] || LucideIcons.Layers;
              const route = getFirstRoute(sys);
              const itemCount = sys.menuItems?.filter(item =>
                !item.showFor || item.showFor.some(r => r.toLowerCase() === role.toLowerCase())
              ).length || 0;

              return (
                <button
                  key={sys.id}
                  onClick={() => navigate(route)}
                  className={`w-full text-left p-4 rounded-2xl border ${colors.bg} ${colors.border} hover:shadow-md transition-all duration-200 group`}
                >
                  <div className="flex items-start justify-between">
                    <div className={`w-10 h-10 rounded-xl bg-white border ${colors.border} flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform`}>
                      <Icon size={18} className={colors.icon} />
                    </div>
                    <LucideIcons.ArrowRight size={14} className="text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all mt-1" />
                  </div>
                  <div className="mt-3">
                    <p className="text-sm font-bold text-gray-900">{sys.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{itemCount} menu item{itemCount !== 1 ? "s" : ""}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
