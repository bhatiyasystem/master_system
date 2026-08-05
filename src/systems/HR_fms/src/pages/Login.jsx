import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, User, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';

const SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbzF-ERpUfrb0figpapH5q5-J1KRAnBHt-OaXYrN9Cw4wzwaacKhUPwGgtCIWfxw2Ruz9g/exec?sheet=USER&action=fetch';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

    const [submitting, setSubmitting] = useState(false);
    const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
setSubmitting(true)
    try {
      const res = await fetch(SHEET_API_URL);
      const json = await res.json();

      if (!json.success) {
        toast.error('Error fetching data');
        return;
      }

      const rows = json.data;
      const headers = rows[0];
      const users = rows.slice(1).map(row => {
        let obj = {};
        headers.forEach((h, i) => obj[h] = row[i]);
        return obj;
      });

      const matchedUser = users.find(
        (u) => u.Username === username && u.Password === password
      );
    if (matchedUser) {
  toast.success('Login successful!');
  localStorage.setItem('user', JSON.stringify(matchedUser));
  setSubmitting(false);
  navigate('/', { replace: true });  // Add replace: true to prevent going back to login
} else {
  toast.error('Invalid credentials');
  setSubmitting(false);
}

    } catch (err) {
      console.error(err);
      toast.error('Network error');
    }
  };

  return (
    <div className="min-h-screen  flex items-center justify-center p-4 ">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-2xl ">
        <div className="text-center ">
          <div className="flex justify-center">
            <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center">
              <Users className="h-8 w-8 text-indigo-700" />
            </div>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-indigo-700">HR FMS</h2>
          <p className="mt-2 text-sm text-indigo-700 opacity-80">
            Human Resource & File Management System
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="sr-only">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-indigo-700 " />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="appearance-none relative block w-full pl-10 pr-3 py-3  border-gray-500  border   text-indigo-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-700 focus:border-white focus:z-10 sm:text-sm bg-white bg-opacity-10"
                  placeholder="Username"
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-indigo-700 " />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none relative block w-full pl-10 pr-3 py-3 border border-gray-500   text-indigo-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-700 focus:border-white focus:z-10 sm:text-sm bg-white bg-opacity-10"
                  placeholder="Password"
                />
              </div>
            </div>
          </div>

          <div>
            {/* <button
              type="submit"
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-700  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white transition-all duration-200"
            >
              Sign in
            </button> */}
             <button
                  type="submit"
                  className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-700  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white transition-all duration-200 ${
                    submitting ? 'opacity-75 cursor-not-allowed' : ''
                  }`}
                  disabled={submitting}
                >
                  {submitting ? (
                    <div className="flex items-center">
                      <svg 
                        className="animate-spin h-4 w-4 text-white mr-2" 
                        xmlns="http://www.w3.org/2000/svg" 
                        fill="none" 
                        viewBox="0 0 24 24"
                      >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>   Sign in....</span>
                    </div>
                  ) : '   Sign in'}
                </button>
          </div>

          {/* <div className="text-sm text-center text-indigo-700 opacity-80">
            <p>Default Credentials:</p>
            <p>Admin: admin / admin123</p>
            <p>Employee: user / user123</p>
          </div> */}
        </form>
      </div>
    </div>
  );
};

export default Login;