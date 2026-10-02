import { useEffect, useState } from 'react';
import api from '../api/api.js';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/admin/dashboard');
        setStats(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Could not load dashboard');
      }
    };
    load();
  }, []);

  if (error) return <div className="container"><div className="alert-error">{error}</div></div>;
  if (!stats) return <div className="container"><p className="muted">Loading...</p></div>;

  return (
    <div className="container">
      <h2>Admin Dashboard</h2>
      <div className="stats">
        <div className="card stat">
          <div className="icon">👥</div>
          <p className="muted">Total Users</p>
          <h2>{stats.totalUsers}</h2>
        </div>
        <div className="card stat">
          <div className="icon">🏪</div>
          <p className="muted">Total Stores</p>
          <h2>{stats.totalStores}</h2>
        </div>
        <div className="card stat">
          <div className="icon">⭐</div>
          <p className="muted">Total Ratings</p>
          <h2>{stats.totalRatings}</h2>
        </div>
      </div>
    </div>
  );
}