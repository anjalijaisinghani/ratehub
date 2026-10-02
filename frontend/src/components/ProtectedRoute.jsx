import { Navigate } from 'react-router-dom';
import { useAuth } from '../api/AuthContext.jsx';

// roles = list of roles allowed to see this page
export default function ProtectedRoute({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return children;
}