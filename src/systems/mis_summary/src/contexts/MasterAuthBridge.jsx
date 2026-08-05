/**
 * MasterAuthBridge.jsx
 *
 * Bridges the master system's Supabase/localStorage-based auth
 * into the MIS Summary system's AuthContext shape.
 *
 * This allows all MIS pages to call `useAuth()` and receive a `user`
 * object that matches what they expect (name, role, department, etc.)
 * — without requiring the MIS sub-app's own login page or AuthProvider.
 */

/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';

const MasterAuthBridgeContext = createContext(undefined);

const getInitialUser = () => {
  if (typeof window === 'undefined') return null;
  const name = localStorage.getItem('user-name');
  if (!name) return null;

  const role = (localStorage.getItem('role') || 'user').toLowerCase();
  const email = localStorage.getItem('email_id') || '';
  const image = localStorage.getItem('profile_image') || '';
  const isSuperAdmin =
    localStorage.getItem('is-super-admin') === 'true' ||
    name.toLowerCase() === 'admin';

  // Map master system role to MIS Summary expected role format
  let misRole = 'user';
  if (isSuperAdmin || role === 'superadmin') misRole = 'superadmin';
  else if (role === 'admin') misRole = 'admin';
  else if (role === 'hod') misRole = 'hod';
  else misRole = 'user';

  return {
    id: name,
    name: name,
    email: email,
    role: misRole,
    image: image,
    department: '',   // populated dynamically by pages from sheet
    designation: '',  // populated dynamically by pages from sheet
    reportedBy: '',
    rowIndex: null,
  };
};

export function MasterAuthBridgeProvider({ children }) {
  const [user, setUser] = useState(getInitialUser);
  const [loading, setLoading] = useState(!user);

  useEffect(() => {
    // Read user info from master system's localStorage keys
    const syncUser = () => {
      const updatedUser = getInitialUser();
      setUser(updatedUser);
      setLoading(false);
    };

    // Re-sync when localStorage changes (e.g., login/logout in another tab)
    window.addEventListener('storage', syncUser);
    return () => window.removeEventListener('storage', syncUser);
  }, []);

  // No-op logout — master system handles logout
  const logout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  // No-op updateProfileImage — master system handles this
  const updateProfileImage = async () => ({ success: false, error: 'Use master system profile settings' });

  const value = { user, loading, logout, updateProfileImage };

  return (
    <MasterAuthBridgeContext.Provider value={value}>
      {children}
    </MasterAuthBridgeContext.Provider>
  );
}

export function useMasterAuthBridge() {
  const context = useContext(MasterAuthBridgeContext);
  if (context === undefined) {
    throw new Error('useMasterAuthBridge must be used within a MasterAuthBridgeProvider');
  }
  return context;
}
