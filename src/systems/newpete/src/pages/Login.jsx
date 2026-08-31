import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import { getUsers } from '../utils/storageManager';
import botivateLogoB from '../Assets/logo.png';

const Login = () => {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const users = getUsers();
      const matchedUser = users.find(
        (u) => u.id === id && u.password === password
      );

      if (!matchedUser) {
        toast.error('Invalid credentials');
        setSubmitting(false);
        return;
      }

      toast.success('Login successful!');
      login(matchedUser);
      navigate("/", { replace: true });
    } catch (err) {
      console.error(err);
      toast.error('Login error');
    } finally {
      setSubmitting(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleDemoCredential = (userId) => {
    if (userId === 'admin') {
      setId('admin');
      setPassword('admin123');
    } else if (userId === 'user') {
      setId('user');
      setPassword('user123');
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-gradient-to-br from-sky-50 to-sky-100">
      {/* Center Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 space-y-6">
          
          {/* Logo Section */}
          <div className="flex flex-col items-center space-y-6">
            <div className="w-28 h-28 rounded-full border-4 border-sky-400 flex items-center justify-center shadow-lg bg-transparent">
              <img
                src={botivateLogoB}
                alt="Botivate Logo"
                className="w-24 h-24 object-contain"
              />
            </div>
            <div className="text-center space-y-2">
              <h1 className="text-4xl font-bold text-gray-900">Petty Cash</h1>
              <p className="text-gray-600 text-base font-medium">Management System</p>
            </div>
          </div>

          {/* Form */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* User ID Input */}
            <div className="space-y-2">
              <label htmlFor="id" className="text-sm font-semibold text-gray-700">
                User ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="id"
                  name="id"
                  type="text"
                  required
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
                  placeholder="Enter user ID"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-semibold text-gray-700">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  onClick={togglePasswordVisibility}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={submitting}
              className={`w-full py-3 px-4 text-base font-bold bg-sky-600 text-white rounded-lg hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-600 transition-all ${
                submitting ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {submitting ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Signing in...</span>
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500 font-semibold">Demo Credentials</span>
            </div>
          </div>

          {/* Demo Credentials */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-500 text-center mb-3 uppercase tracking-wider">Quick Login Options</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleDemoCredential('admin')}
                className="flex flex-col items-center justify-center p-3 bg-white border border-gray-200 hover:border-sky-500 hover:shadow-md hover:bg-sky-50 rounded-lg transition-all group"
              >
                <span className="font-bold text-gray-800 text-sm group-hover:text-sky-700">Admin</span>
                <span className="text-[10px] text-gray-500 font-mono mt-1">ID: admin</span>
              </button>
              <button
                type="button"
                onClick={() => handleDemoCredential('user')}
                className="flex flex-col items-center justify-center p-3 bg-white border border-gray-200 hover:border-sky-500 hover:shadow-md hover:bg-sky-50 rounded-lg transition-all group"
              >
                <span className="font-bold text-gray-800 text-sm group-hover:text-sky-700">User</span>
                <span className="text-[10px] text-gray-500 font-mono mt-1">ID: user</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer at Bottom */}
      <div className="py-6 text-center">
        <p className="text-xs text-sky-700">
          Powered by <span className="font-semibold text-sky-600">Botivate</span>
        </p>
      </div>
    </div>
  );
};

export default Login;

