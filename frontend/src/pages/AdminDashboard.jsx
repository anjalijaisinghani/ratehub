import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart, Bar,
  PieChart, Pie, Cell,
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import api from '../api/api.js';
import Stars from '../components/Stars.jsx';
import useTheme from '../utils/useTheme.js';
import useCountUp from '../utils/useCountUp.js';

const REFRESH_MS = 10000; // refresh every 10 seconds

const ROLE_META = {
  ADMIN: { label: 'Admins', color: '#8b3cf0' },
  USER: { label: 'Normal Users', color: '#1e6bff' },
  OWNER: { label: 'Store Owners', color: '#fbbf24' },
};

const shortName = (text, max = 18) => (text.length > max ? text.slice(0, max) + '…' : text);

const dayLabel = (day) =>
  new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });

const timeAgo = (iso) => {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
};

// A clickable stat card whose number counts up
function StatCard({ icon, label, value, to, hint }) {
  const shown = useCountUp(value);
  return (
    <Link to={to}>
      <div className="card stat">
        <div className="icon">{icon}</div>
        <p className="muted" style={{ margin: 0 }}>{label}</p>
        <h2>{shown}</h2>
        <p className="hint">{hint}</p>
      </div>
    </Link>
  );
}

export default function AdminDashboard() {
  const theme = useTheme();
  const dark = theme === 'dark';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [live, setLive] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [, setTick] = useState(0); // forces "x min ago" texts to refresh

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/analytics');
      setData(res.data);
      setUpdatedAt(new Date());
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load dashboard');
    }
  }, []);

  // First load
  useEffect(() => {
    load();
  }, [load]);

  // Auto refresh while "Live" is on (skips when the browser tab is hidden)
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      if (!document.hidden) load();
      setTick((n) => n + 1);
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [live, load]);

  if (error && !data) return <div className="container"><div className="alert-error">{error}</div></div>;
  if (!data) return <div className="container"><p className="muted">Loading dashboard...</p></div>;

  const { totals, ratingDistribution, usersByRole, topStores, activity, recentRatings } = data;

  // Chart colors that follow the theme
  const axis = dark ? '#9aa2d1' : '#6b7194';
  const grid = dark ? '#283070' : '#e4e7f5';
  const tooltipStyle = {
    background: dark ? '#141a45' : '#ffffff',
    border: `1px solid ${grid}`,
    borderRadius: 8,
    color: dark ? '#e6e9ff' : '#1b1f3b',
  };

  const roleData = usersByRole
    .filter((r) => r.count > 0)
    .map((r) => ({ name: ROLE_META[r.role].label, value: r.count, color: ROLE_META[r.role].color }));

  const activityData = activity.map((a) => ({ ...a, label: dayLabel(a.day) }));
  const topData = topStores.map((s) => ({ ...s, short: shortName(s.name) }));

  return (
    <div className="container">
      <div className="page-title" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Admin Dashboard</h2>
        <div className="dash-actions">
          <span className="live-badge">
            <span className={`live-dot ${live ? '' : 'paused'}`} />
            {live ? 'Live' : 'Paused'}
            {updatedAt && ` · updated ${updatedAt.toLocaleTimeString()}`}
          </span>
          <button className="small secondary" onClick={() => setLive(!live)}>
            {live ? '⏸ Pause' : '▶ Resume'}
          </button>
          <button className="small" onClick={load}>↻ Refresh</button>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {/* ---------- Numbers ---------- */}
      <div className="stats">
        <StatCard icon="👥" label="Total Users" value={totals.totalUsers} to="/admin/users" hint="View users →" />
        <StatCard icon="🏪" label="Total Stores" value={totals.totalStores} to="/admin/stores" hint="View stores →" />
        <StatCard icon="⭐" label="Total Ratings" value={totals.totalRatings} to="/admin/stores" hint="See store ratings →" />
        <div>
          <div className="card stat">
            <div className="icon">📈</div>
            <p className="muted" style={{ margin: 0 }}>Platform Average</p>
            <h2>{totals.averageRating !== null ? totals.averageRating.toFixed(1) : '—'}</h2>
            <p className="hint" style={{ color: 'var(--muted)' }}>out of 5 stars</p>
          </div>
        </div>
      </div>

      {/* ---------- Charts ---------- */}
      <div className="chart-grid">
        {/* 1. Rating distribution */}
        <div className="card chart-card">
          <h3>Ratings breakdown</h3>
          <p className="sub">How many ratings each star value received</p>
          {totals.totalRatings === 0 ? (
            <div className="chart-empty">No ratings yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={ratingDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                <XAxis dataKey="rating" stroke={axis} tickFormatter={(v) => `${v} ★`} />
                <YAxis stroke={axis} allowDecimals={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: dark ? 'rgba(255,255,255,0.06)' : 'rgba(30,107,255,0.08)' }}
                  formatter={(v) => [v, 'Ratings']}
                  labelFormatter={(v) => `${v} star${v > 1 ? 's' : ''}`}
                />
                <Bar dataKey="count" fill="#1e6bff" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 2. Users by role */}
        <div className="card chart-card">
          <h3>Users by role</h3>
          <p className="sub">Who is on RateHub</p>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={roleData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                {roleData.map((r) => (
                  <Cell key={r.name} fill={r.color} stroke="none" />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 3. Activity */}
        <div className="card chart-card chart-wide">
          <h3>Activity: last 7 days</h3>
          <p className="sub">New ratings and new sign-ups per day</p>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={activityData}>
              <defs>
                <linearGradient id="gRatings" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1e6bff" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#1e6bff" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gUsers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b3cf0" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#8b3cf0" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis dataKey="label" stroke={axis} />
              <YAxis stroke={axis} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Area type="monotone" dataKey="ratings" name="New ratings" stroke="#1e6bff" strokeWidth={2} fill="url(#gRatings)" />
              <Area type="monotone" dataKey="newUsers" name="New users" stroke="#8b3cf0" strokeWidth={2} fill="url(#gUsers)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* 4. Top stores */}
        <div className="card chart-card">
          <h3>Top rated stores</h3>
          <p className="sub">Highest average rating (top 5)</p>
          {topData.length === 0 ? (
            <div className="chart-empty">No rated stores yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                <XAxis type="number" domain={[0, 5]} stroke={axis} />
                <YAxis type="category" dataKey="short" width={130} stroke={axis} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: dark ? 'rgba(255,255,255,0.06)' : 'rgba(30,107,255,0.08)' }}
                  formatter={(v, name, item) => [`${v} ★ from ${item.payload.totalRatings} rating(s)`, 'Average']}
                  labelFormatter={(_, items) => items?.[0]?.payload?.name}
                />
                <Bar dataKey="averageRating" fill="#fbbf24" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 5. Recent activity */}
        <div className="card chart-card">
          <h3>Recent ratings</h3>
          <p className="sub">The latest activity on the platform</p>
          {recentRatings.length === 0 ? (
            <div className="chart-empty">Nothing yet. Ratings will appear here live.</div>
          ) : (
            <ul className="activity-list">
              {recentRatings.map((r) => (
                <li className="activity-item" key={r.id}>
                  <div>
                    <strong>{shortName(r.userName, 24)}</strong> rated <strong>{shortName(r.storeName, 24)}</strong>
                    <small>{timeAgo(r.ratedAt)}</small>
                  </div>
                  <Stars value={r.rating} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}