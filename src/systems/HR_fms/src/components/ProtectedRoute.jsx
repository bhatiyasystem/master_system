import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
  // Check if user exists in localStorage
  const user = JSON.parse(localStorage.getItem('user'));

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;