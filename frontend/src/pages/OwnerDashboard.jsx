import { useEffect, useState } from 'react';
import api from '../api/api.js';
import SortableTable from '../components/SortableTable.jsx';
import Stars from '../components/Stars.jsx';

export default function OwnerDashboard() {
  const [data, setData] = useState(null); // { stores: [], raters: [] }
  const [sortBy, setSortBy] = useState('name');
  const [order, setOrder] = useState('asc');
  const [error, setError] = useState('');

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
  }, [sortBy, order]);

  const handleSort = (key) => {
    if (key === sortBy) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setOrder('asc');
    }
  };

  if (error) return <div className="container"><div className="alert-error">{error}</div></div>;
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

  const columns = [
    { key: 'name', label: 'User Name' },
    { key: 'email', label: 'Email' },
    { key: 'address', label: 'Address', sortable: false },
    { key: 'rating', label: 'Rating', render: (r) => <Stars value={r.rating} /> },
    { key: 'date', label: 'Rated On', render: (r) => new Date(r.ratedAt).toLocaleDateString() },
  ];

  return (
    <div className="container">
      <h2>My Store Dashboard</h2>

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