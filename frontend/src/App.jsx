import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './api/AuthContext.jsx';
import Navbar from './components/Navbar.jsx';
import PublicHeader from './components/PublicHeader.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import ChangePassword from './pages/ChangePassword.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import AdminUsers from './pages/AdminUsers.jsx';
import AdminStores from './pages/AdminStores.jsx';
import AddUser from './pages/AddUser.jsx';
import AddStore from './pages/AddStore.jsx';
import UserStores from './pages/UserStores.jsx';
import OwnerDashboard from './pages/OwnerDashboard.jsx';

// "/" shows the landing page to visitors, and sends logged-in users to their own home
function Home() {
  const { user } = useAuth();
  if (!user) return <Landing />;
  if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
  if (user.role === 'OWNER') return <Navigate to="/owner" replace />;
  return <Navigate to="/stores" replace />;
}

// Login and signup are only for visitors. Logged-in users are sent to their home.
function PublicOnly({ children }) {
  const { user } = useAuth();
  return user ? <Navigate to="/" replace /> : children;
}

// Small helpers so we don't repeat ProtectedRoute for every page
const AdminOnly = ({ children }) => <ProtectedRoute roles={['ADMIN']}>{children}</ProtectedRoute>;
const UserOnly = ({ children }) => <ProtectedRoute roles={['USER']}>{children}</ProtectedRoute>;
const OwnerOnly = ({ children }) => <ProtectedRoute roles={['OWNER']}>{children}</ProtectedRoute>;

export default function App() {
  const { user } = useAuth();

  return (
    <>
      {user ? <Navbar /> : <PublicHeader />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />

        <Route path="/admin" element={<AdminOnly><AdminDashboard /></AdminOnly>} />
        <Route path="/admin/users" element={<AdminOnly><AdminUsers /></AdminOnly>} />
        <Route path="/admin/stores" element={<AdminOnly><AdminStores /></AdminOnly>} />
        <Route path="/admin/add-user" element={<AdminOnly><AddUser /></AdminOnly>} />
        <Route path="/admin/add-store" element={<AdminOnly><AddStore /></AdminOnly>} />

        <Route path="/stores" element={<UserOnly><UserStores /></UserOnly>} />
        <Route path="/owner" element={<OwnerOnly><OwnerDashboard /></OwnerOnly>} />

        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <ChangePassword />
            </ProtectedRoute>
          }
        />

        {/* Any unknown address goes back to the start */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}