import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api.js';
import SortableTable from '../components/SortableTable.jsx';

export default function AdminStores() {
  const [stores, setStores] = useState([]);
  const [filters, setFilters] = useState({ name: '', email: '', address: '' });
  const [sortBy, setSortBy] = useState('name');
  const [order, setOrder] = useState('asc');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get('/admin/stores', { params: { ...filters, sortBy, order } });
        setStores(res.data);
        setError('');
      } catch (err) {
        setError(err.response?.data?.message || 'Could not load stores');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [filters, sortBy, order]);

  const handleFilterChange = (e) => setFilters({ ...filters, [e.target.name]: e.target.value });

  const handleSort = (key) => {
    if (key === sortBy) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setOrder('asc');
    }
  };

  const columns = [
    { key: 'name', label: 'Store Name' },
    { key: 'email', label: 'Email' },
    { key: 'address', label: 'Address' },
    {
      key: 'rating',
      label: 'Rating',
      render: (r) =>
        r.rating !== null ? <span className="stars">★ {r.rating}</span> : <span className="muted">No ratings</span>,
    },
  ];

  return (
    <div className="container">
      <div className="page-title">
        <h2>Stores</h2>
        <Link className="btn" to="/admin/add-store" style={{ marginTop: 0 }}>+ Add Store</Link>
      </div>
      {error && <div className="alert-error">{error}</div>}

      <div className="card">
        <div className="filters">
          <input name="name" placeholder="Filter by name" value={filters.name} onChange={handleFilterChange} />
          <input name="email" placeholder="Filter by email" value={filters.email} onChange={handleFilterChange} />
          <input name="address" placeholder="Filter by address" value={filters.address} onChange={handleFilterChange} />
        </div>

        {loading && <p className="muted">Loading...</p>}
        <SortableTable columns={columns} rows={stores} sortBy={sortBy} order={order} onSort={handleSort} />
      </div>
    </div>
  );
}