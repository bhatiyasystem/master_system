import { Navigate } from 'react-router-dom';
;

const SuperAdminRoute = ({ children }) => {
    const username = (localStorage.getItem("user-name") || "").toLowerCase();
    const role = (localStorage.getItem("role") || "").toLowerCase();
    const isSuperAdmin = localStorage.getItem("is-super-admin") === "true" || username === "admin" || role === "admin";

    if (!isSuperAdmin) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
};

export default SuperAdminRoute;
