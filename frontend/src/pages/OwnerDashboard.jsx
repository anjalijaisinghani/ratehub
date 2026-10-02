import { useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import api from '../api/api.js';
import SortableTable from '../components/SortableTable.jsx';
import Stars from '../components/Stars.jsx';
import useTheme from '../utils/useTheme.js';

const REFRESH_MS = 10000;

export default function OwnerDashboard() {
  const dark = useTheme() === 'dark';
  const [data, setData] = useState(null); // { stores: [], raters: [] }
  const [sortBy, setSortBy] = useState('name');
  const [order, setOrder] = useState('asc');
  const [error, setError] = useState('');

  // Load now, and again every 10 seconds, so new ratings appear by themselves
  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/owner/dashboard', { params: { sortBy, order } });
        setData(res.data);
        setError('');
      } catch (err) {
        setError(err.response?.data?.message || 'Could not load dashboard');
      }
    };
    load();
    const id = setInterval(() => {
      if (!document.hidden) load();
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [sortBy, order]);

  const handleSort = (key) => {
    if (key === sortBy) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setOrder('asc');
    }
  };

  if (error && !data) return <div className="container"><div className="alert-error">{error}</div></div>;
  if (!data) return <div className="container"><p className="muted">Loading...</p></div>;

  if (data.stores.length === 0) {
    return (
      <div className="container">
        <div className="card empty-state">
          <h2>No store assigned yet</h2>
          <p className="muted">Ask the system administrator to link a store to your account.</p>
        </div>
      </div>
    );
  }

  // Count how many raters gave 1, 2, 3, 4 and 5 stars
  const distribution = [1, 2, 3, 4, 5].map((star) => ({
    rating: star,
    count: data.raters.filter((r) => r.rating === star).length,
  }));

  const axis = dark ? '#9aa2d1' : '#6b7194';
  const grid = dark ? '#283070' : '#e4e7f5';

  const columns = [
    { key: 'name', label: 'User Name' },
    { key: 'email', label: 'Email' },
    { key: 'address', label: 'Address', sortable: false },
    { key: 'rating', label: 'Rating', render: (r) => <Stars value={r.rating} /> },
    { key: 'date', label: 'Rated On', render: (r) => new Date(r.ratedAt).toLocaleDateString() },
  ];

  return (
    <div className="container">
      <div className="page-title" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>My Store Dashboard</h2>
        <span className="live-badge"><span className="live-dot" /> Live · refreshes every 10 s</span>
      </div>

      {data.stores.map((store) => (
        <div className="card store-header" key={store.id}>
          <div>
            <h3 style={{ marginBottom: 4 }}>{store.name}</h3>
            <div className="muted">{store.address}</div>
            <div className="muted">{store.email}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p className="muted" style={{ margin: 0 }}>Average Rating</p>
            <div className="big-rating">
              {store.averageRating !== null ? `★ ${store.averageRating}` : '—'}
            </div>
            <p className="muted" style={{ margin: 0 }}>
              from {store.totalRatings} {store.totalRatings === 1 ? 'rating' : 'ratings'}
            </p>
          </div>
        </div>
      ))}

      <div className="card chart-card">
        <h3>Ratings breakdown</h3>
        <p className="sub">How your customers rated you</p>
        {data.raters.length === 0 ? (
          <div className="chart-empty">No ratings yet. They will appear here live.</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={distribution}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis dataKey="rating" stroke={axis} tickFormatter={(v) => `${v} ★`} />
              <YAxis stroke={axis} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: dark ? '#141a45' : '#fff',
                  border: `1px solid ${grid}`,
                  borderRadius: 8,
                  color: dark ? '#e6e9ff' : '#1b1f3b',
                }}
                cursor={{ fill: dark ? 'rgba(255,255,255,0.06)' : 'rgba(30,107,255,0.08)' }}
                formatter={(v) => [v, 'Customers']}
                labelFormatter={(v) => `${v} star${v > 1 ? 's' : ''}`}
              />
              <Bar dataKey="count" fill="#fbbf24" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card">
        <h3>Users who rated my store</h3>
        <SortableTable
          columns={columns}
          rows={data.raters}
          sortBy={sortBy}
          order={order}
          onSort={handleSort}
          emptyText="No one has rated your store yet"
        />
      </div>
    </div>
  );
}