"use client"

import { useState, useEffect } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useNavigate } from "react-router-dom"

import { loginUser } from "../redux/slice/loginSlice"
import { LoginCredentialsApi } from "../redux/api/loginApi"
import { useMagicToast } from "../context/MagicToastContext"
import supabase from "../SupabaseClient"
import { sendPasswordResetOTP, isWhatsAppConnected } from "../services/whatsappService"
import { KeyRound, ShieldCheck, User as UserIcon, ArrowLeft, RefreshCw, Smartphone, Eye, EyeOff } from "lucide-react"
import bhatiyaLogo from "../assets/bhatiya_Logo.jpg"

const LoginPage = () => {
  const navigate = useNavigate()
  const { isLoggedIn, userData, error } = useSelector((state) => state.login);
  const dispatch = useDispatch();
  const { showToast } = useMagicToast();

  const [isLoginLoading, setIsLoginLoading] = useState(false)
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  })
  const [showPassword, setShowPassword] = useState(false)

  // Forgot Password State
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [forgotStep, setForgotStep] = useState('username') // 'username', 'otp', 'reset'
  const [forgotData, setForgotData] = useState({
    username: "",
    otp: "",
    newPassword: "",
    confirmPassword: "",
    generatedOtp: ""
  })
  const [isForgotLoading, setIsForgotLoading] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsLoginLoading(true);
    dispatch(loginUser(formData));
  };

  useEffect(() => {
    const handleLoginSuccess = async () => {
      if (isLoggedIn && userData) {
        console.log("User Data received:", userData); // Debug log

        let designation = userData.Designation || userData.designation || "";
        let canSelfAssign = userData.can_self_assign;
        let systemAccess = userData.system_access;
        let pageAccess = userData.page_access;
        let profileImage = userData.profile_image || "";
        let roleName = userData.role || "";
        let userId = userData.id || "";

        // Query the database directly to get the absolute latest status, role, system_access, page_access
        try {
          const { data: latestUser } = await supabase
            .from('users')
            .select('id, role, Designation, profile_image, can_self_assign, system_access, page_access')
            .eq('user_name', userData.user_name || userData.username)
            .single();

          if (latestUser) {
            designation = latestUser.Designation || designation;
            canSelfAssign = latestUser.can_self_assign ?? canSelfAssign;
            systemAccess = latestUser.system_access;
            pageAccess = latestUser.page_access;
            profileImage = latestUser.profile_image || profileImage;
            roleName = latestUser.role || roleName;
            userId = latestUser.id || userId;
          }
        } catch (err) {
          console.error("Error fetching latest user details:", err);
        }

        // Process systems & pages permissions
        let systemSlugs = [];
        if (systemAccess === "all") {
          systemSlugs = ["checklist-delegation", "mis-summary", "whatsapp-management", "hr-fms"];
        } else if (systemAccess === "none") {
          systemSlugs = [];
        } else if (systemAccess) {
          systemSlugs = systemAccess.split(",").map(s => s.trim()).filter(Boolean);
        } else {
          systemSlugs = ["checklist-delegation", "mis-summary", "whatsapp-management", "hr-fms"]; // legacy fallback
        }

        const roleLower = roleName.toLowerCase();
        const isLegacyAdmin = roleLower === "admin" || roleLower === "super admin" || roleLower === "superadmin" || (userData.user_name || "").toLowerCase() === "admin";

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
            "/dashboard/hr-attendancedaily", "/dashboard/hr-report", "/dashboard/hr-payroll", "/dashboard/hr-misreport"
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
            "/dashboard/hr-attendancedaily", "/dashboard/hr-report", "/dashboard/hr-payroll", "/dashboard/hr-misreport"
          ];
        } else {
          potentialRoutes = [
            "/dashboard/admin", "/dashboard/notifications", "/dashboard/delegation",
            "/dashboard/task", "/dashboard/calendar", "/dashboard/training-video",
            "/dashboard/mis-summary", "/dashboard/mis-history", "/dashboard/mis-kpi-kra",
            "/dashboard/whatsapp-history",
            "/dashboard/hr-dashboard", "/dashboard/hr-my-profile", "/dashboard/hr-my-attendance",
            "/dashboard/hr-leave-request", "/dashboard/hr-my-salary", "/dashboard/hr-company-calendar"
          ];
        }

        let finalAllowedPages = [];
        if (pageAccess === "all") {
          finalAllowedPages = potentialRoutes;
        } else if (pageAccess === "none") {
          finalAllowedPages = ["/dashboard", "/dashboard/notifications"];
        } else if (pageAccess) {
          finalAllowedPages = pageAccess.split(",").map(p => p.trim()).filter(Boolean);
          if (!finalAllowedPages.includes("/dashboard")) finalAllowedPages.push("/dashboard");
          if (!finalAllowedPages.includes("/dashboard/notifications")) finalAllowedPages.push("/dashboard/notifications");
        } else {
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
            if (route === "/dashboard" || route === "/dashboard/setting" || route === "/dashboard/global-settings") {
              return true;
            }
            return systemSlugs.includes("checklist-delegation");
          });
        }

        // Store all user data in localStorage
        localStorage.setItem('user-name', userData.user_name || userData.username || "");
        localStorage.setItem('user-id', userId || "");
        localStorage.setItem('role', roleName || "");
        localStorage.setItem('email_id', userData.email_id || userData.email || "");
        localStorage.setItem('user_access', userData.user_access || "");
        localStorage.setItem('profile_image', profileImage || "");
        localStorage.setItem('can_self_assign', canSelfAssign === true ? "true" : "false");
        localStorage.setItem('designation', designation || "");
        localStorage.setItem('is-super-admin', isLegacyAdmin ? "true" : "false");
        localStorage.setItem('allowed-systems', JSON.stringify(systemSlugs));
        localStorage.setItem('allowed-pages', JSON.stringify(finalAllowedPages));

        console.log("Stored email:", userData.email_id || userData.email); // Debug log

        showToast(`Welcome back, ${userData.user_name || userData.username}!`, "success");
        navigate("/dashboard");
      } else if (error) {
        showToast(error, "error");
        setIsLoginLoading(false);
      }
    };

    handleLoginSuccess();
  }, [isLoggedIn, userData, error, navigate, showToast]);

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50/50 via-slate-50 to-purple-50/50 p-6 relative overflow-hidden">
      {/* Decorative Blur Blobs */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-blue-400/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-purple-400/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-white/85 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-8 shadow-2xl shadow-slate-200/30 relative z-10 transition-all duration-300">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-48 h-16 rounded-2xl overflow-hidden shadow-sm border border-slate-100 mb-4 transition-all duration-300 hover:scale-[1.02] flex items-center justify-center bg-white p-1">
            <img
              src={bhatiyaLogo}
              alt="Bhaatiya Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <h2 className="text-2xl font-black bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent tracking-tight font-sleek uppercase text-center">
            Bhatia Enterprises
          </h2>
          <p className="text-slate-400 text-xs mt-1.5 font-semibold tracking-wide">Master System Platform</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="username" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block ml-1">
              Username
            </label>
            <div className="relative">
              <input
                id="username"
                name="username"
                type="text"
                placeholder="Enter your username"
                required
                value={formData.username}
                onChange={handleChange}
                className="w-full pl-11 pr-4 py-3 bg-slate-50/50 hover:bg-slate-50 border border-slate-200/80 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none text-slate-800 placeholder-slate-400 text-sm font-medium transition-all duration-200"
              />
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block ml-1">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full pl-11 pr-11 py-3 bg-slate-50/50 hover:bg-slate-50 border border-slate-200/80 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none text-slate-800 placeholder-slate-400 text-sm font-medium transition-all duration-200"
              />
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none flex items-center justify-center"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-3">
            <button
              type="submit"
              className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl font-bold hover:opacity-95 transition-all shadow-lg shadow-blue-500/15 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              disabled={isLoginLoading}
            >
              {isLoginLoading ? (
                <>
                  <RefreshCw className="animate-spin" size={18} />
                  <span>Logging in...</span>
                </>
              ) : (
                "Login"
              )}
            </button>
            
            <button
              type="button"
              onClick={() => setShowForgotModal(true)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors text-center mt-1"
            >
              Forgot Password?
            </button>
          </div>
        </form>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => !isForgotLoading && setShowForgotModal(false)}></div>
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="bg-gradient-to-br from-blue-50/50 to-white px-6 py-6 text-center border-b border-slate-50">
              <div className="mx-auto w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-3 border border-blue-100/50">
                {forgotStep === 'username' && <UserIcon className="text-blue-600" size={24} />}
                {forgotStep === 'otp' && <ShieldCheck className="text-blue-600" size={24} />}
                {forgotStep === 'reset' && <KeyRound className="text-blue-600" size={24} />}
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                {forgotStep === 'username' && "Find Your Account"}
                {forgotStep === 'otp' && "Verify Identity"}
                {forgotStep === 'reset' && "Set New Password"}
              </h3>
            </div>

            <div className="px-6 py-6 space-y-4">
              {forgotStep === 'username' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-500 text-center px-2">Enter your username. An OTP will be sent to the Admin for verification.</p>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Username"
                      value={forgotData.username}
                      onChange={(e) => setForgotData({ ...forgotData, username: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50/50 border border-slate-200/80 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none text-sm font-medium transition-all"
                    />
                    <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  </div>
                  <button
                    onClick={async () => {
                      if (!forgotData.username) return showToast("Please enter username", "error");
                      setIsForgotLoading(true);
                      try {
                        const { data, error } = await supabase.from('users').select('user_name').eq('user_name', forgotData.username).single();
                        if (error || !data) return showToast("User not found", "error");

                        if (!isWhatsAppConnected()) {
                          showToast("WhatsApp messaging is currently disabled. It will be enabled later.", "info");
                        } else {
                          showToast("OTP sent to Admin", "success");
                        }
                        const otp = Math.floor(100000 + Math.random() * 900000).toString();
                        await sendPasswordResetOTP(forgotData.username, otp);
                        setForgotData({ ...forgotData, generatedOtp: otp });
                        setForgotStep('otp');
                      } catch (err) {
                        showToast("Error processing request", "error");
                      } finally {
                        setIsForgotLoading(false);
                      }
                    }}
                    disabled={isForgotLoading}
                    className="w-full py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                  >
                    {isForgotLoading ? <RefreshCw className="animate-spin" size={18} /> : "Send OTP"}
                  </button>
                  <button onClick={() => setShowForgotModal(false)} className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-slate-600">Cancel</button>
                </div>
              )}

              {forgotStep === 'otp' && (
                <div className="space-y-4">
                  <div className="bg-amber-50/60 border border-amber-200/60 rounded-2xl p-3.5 flex gap-2">
                    <Smartphone className="text-amber-600 flex-shrink-0" size={16} />
                    <p className="text-[11px] text-amber-800 font-semibold leading-relaxed">OTP has been sent to the admin number (9028105766). Please contact them for the code.</p>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Enter 6-digit OTP"
                      value={forgotData.otp}
                      onChange={(e) => setForgotData({ ...forgotData, otp: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50/50 border border-slate-200/80 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none text-sm text-center tracking-[0.5em] font-black"
                      maxLength={6}
                    />
                    <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  </div>
                  <button
                    onClick={() => {
                      if (forgotData.otp === forgotData.generatedOtp) {
                        setForgotStep('reset');
                      } else {
                        showToast("Invalid OTP", "error");
                      }
                    }}
                    className="w-full py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all"
                  >
                    Verify OTP
                  </button>
                  <button onClick={() => setForgotStep('username')} className="w-full py-2 text-xs font-semibold text-blue-600 flex items-center justify-center gap-1 hover:text-blue-800"><ArrowLeft size={12} /> Back to Username</button>
                </div>
              )}

              {forgotStep === 'reset' && (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (forgotData.newPassword !== forgotData.confirmPassword) return showToast("Passwords don't match", "error");
                  if (forgotData.newPassword.length < 4) return showToast("Password too short", "error");

                  setIsForgotLoading(true);
                  try {
                    const { error } = await supabase.from('users').update({ password: forgotData.newPassword }).eq('user_name', forgotData.username);
                    if (error) throw error;
                    showToast("Password reset successfully!", "success");
                    setShowForgotModal(false);
                    setForgotStep('username');
                    setForgotData({ username: "", otp: "", newPassword: "", confirmPassword: "", generatedOtp: "" });
                  } catch (err) {
                    showToast("Error resetting password", "error");
                  } finally {
                    setIsForgotLoading(false);
                  }
                }} className="space-y-4">
                  <div className="relative">
                    <input
                      type="password"
                      placeholder="New Password"
                      required
                      value={forgotData.newPassword}
                      onChange={(e) => setForgotData({ ...forgotData, newPassword: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50/50 border border-slate-200/80 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none text-sm font-medium transition-all"
                    />
                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  </div>
                  <div className="relative">
                    <input
                      type="password"
                      placeholder="Confirm New Password"
                      required
                      value={forgotData.confirmPassword}
                      onChange={(e) => setForgotData({ ...forgotData, confirmPassword: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50/50 border border-slate-200/80 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none text-sm font-medium transition-all"
                    />
                    <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  </div>
                  <button
                    type="submit"
                    disabled={isForgotLoading}
                    className="w-full py-3 bg-green-600 text-white rounded-2xl font-bold hover:bg-green-700 transition-all flex items-center justify-center gap-2"
                  >
                    {isForgotLoading ? <RefreshCw className="animate-spin" size={18} /> : "Update Password"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="fixed left-0 right-0 bottom-0 py-3 bg-white/80 backdrop-blur-md text-center text-xs text-slate-500 shadow-sm border-t border-slate-100 z-10">
        <a
          href="https://www.botivate.in/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-blue-600 transition-colors inline-flex items-center gap-1 font-medium"
        >
          Powered by <span className="font-semibold text-slate-800">Botivate</span>
        </a>
      </div>
    </div>
  )
}

export default LoginPage
