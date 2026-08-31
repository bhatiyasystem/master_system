import { create } from 'zustand';

const getGlobalUser = () => {
  if (typeof window === 'undefined') return null;
  const name = localStorage.getItem('user-name');
  if (!name) return null;
  
  const role = (localStorage.getItem('role') || 'user').toLowerCase();
  const isSuperAdmin = localStorage.getItem('is-super-admin') === 'true' || name.toLowerCase() === 'admin';
  const isAdmin = isSuperAdmin || role === 'admin';
  
  return {
    id: name.toLowerCase(),
    name: name,
    role: isAdmin ? 'ADMIN' : 'USER'
  };
};

const useAuthStore = create((set) => ({
  user: getGlobalUser(),
  isAuthenticated: !!getGlobalUser(),
  
  login: (userData) => {
    set({
      user: userData,
      isAuthenticated: true
    });
  },
  
  logout: () => {
    set({
      user: null,
      isAuthenticated: false
    });
    localStorage.clear();
  },
  
  initializeAuth: () => {
    const globalUser = getGlobalUser();
    set({
      user: globalUser,
      isAuthenticated: !!globalUser
    });
  }
}));

export { useAuthStore };
