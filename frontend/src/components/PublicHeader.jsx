import { Link } from 'react-router-dom';
import ThemeToggle from './ThemeToggle.jsx';

export default function PublicHeader() {
  return (
    <div className="navbar">
      <div className="nav-left">
        <Link to="/" className="brand">
          <img src="/logo-icon.png" alt="RateHub logo" />
          <span>Rate<b>Hub</b></span>
        </Link>
      </div>
      <div className="nav-right">
        <ThemeToggle />
        <Link to="/login" className="nav-link">Login</Link>
        <Link to="/signup" className="btn" style={{ marginTop: 0, padding: '8px 16px' }}>Sign Up</Link>
      </div>
    </div>
  );
}