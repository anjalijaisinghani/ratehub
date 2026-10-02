import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../api/AuthContext.jsx';
import { confirmAction, toast } from '../utils/alert.js';
import ThemeToggle from './ThemeToggle.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    const yes = await confirmAction('Log out?', 'You will need to log in again.', 'Yes, log out');
    if (!yes) return;
    logout();
    navigate('/');
    toast('Logged out successfully');
  };

  if (!user) return null;

  // "end" makes /admin highlight only on /admin, not on /admin/users
  const link = ({ isActive }) => (isActive ? 'nav-link active' : 'nav-link');

  return (
    <div className="navbar">
      <div className="nav-left">
        <span className="brand">
          <img src="/logo-icon.png" alt="RateHub logo" />
          <span>Rate<b>Hub</b></span>
        </span>
        {user.role === 'ADMIN' && (
          <>
            <NavLink to="/admin" end className={link}>Dashboard</NavLink>
            <NavLink to="/admin/users" className={link}>Users</NavLink>
            <NavLink to="/admin/stores" className={link}>Stores</NavLink>
            <NavLink to="/admin/add-user" className={link}>Add User</NavLink>
            <NavLink to="/admin/add-store" className={link}>Add Store</NavLink>
          </>
        )}
        {user.role === 'USER' && <NavLink to="/stores" className={link}>Stores</NavLink>}
        {user.role === 'OWNER' && <NavLink to="/owner" className={link}>My Store</NavLink>}
        <NavLink to="/change-password" className={link}>Change Password</NavLink>
      </div>
      <div className="nav-right">
        <ThemeToggle />
        <span className="user-chip">{user.name} · {user.role}</span>
        <button onClick={handleLogout}>Logout</button>
      </div>
    </div>
  );
}