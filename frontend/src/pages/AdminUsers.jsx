import { useEffect, useState } from 'react';
import api from '../api/api.js';
import SortableTable from '../components/SortableTable.jsx';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ name: '', email: '', address: '', role: '' });
  const [sortBy, setSortBy] = useState('name');
  const [order, setOrder] = useState('asc');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null); // user details shown below the table

  // Reload the list whenever a filter or the sorting changes
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get('/admin/users', { params: { ...filters, sortBy, order } });
        setUsers(res.data);
        setError('');
      } catch (err) {
        setError(err.response?.data?.message || 'Could not load users');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [filters, sortBy, order]);

  const handleFilterChange = (e) => setFilters({ ...filters, [e.target.name]: e.target.value });

  // Same column again = flip direction. New column = start ascending.
  const handleSort = (key) => {
    if (key === sortBy) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setOrder('asc');
    }
  };

  const showDetails = async (row) => {
    try {
      const res = await api.get(`/admin/users/${row.id}`);
      setSelected(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load user details');
    }
  };

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'address', label: 'Address' },
    { key: 'role', label: 'Role', render: (r) => <span className={`badge badge-${r.role}`}>{r.role}</span> },  ];

  return (
    <div className="container">
      <h2>Users</h2>
      {error && <div className="alert-error">{error}</div>}

      <div className="card">
        <div className="filters">
          <input name="name" placeholder="Filter by name" value={filters.name} onChange={handleFilterChange} />
          <input name="email" placeholder="Filter by email" value={filters.email} onChange={handleFilterChange} />
          <input name="address" placeholder="Filter by address" value={filters.address} onChange={handleFilterChange} />
          <select name="role" value={filters.role} onChange={handleFilterChange}>
            <option value="">All roles</option>
            <option value="ADMIN">ADMIN</option>
            <option value="USER">USER</option>
            <option value="OWNER">OWNER</option>
          </select>
        </div>

        {loading && <p className="muted">Loading...</p>}
        <SortableTable
          columns={columns}
          rows={users}
          sortBy={sortBy}
          order={order}
          onSort={handleSort}
          onRowClick={showDetails}
        />
        <p className="muted">Click a row to see the user's details.</p>
      </div>

      {selected && (
        <div className="card">
          <h3>User Details</h3>
          <div className="detail-row"><strong>Name:</strong> {selected.name}</div>
          <div className="detail-row"><strong>Email:</strong> {selected.email}</div>
          <div className="detail-row"><strong>Address:</strong> {selected.address}</div>
          <div className="detail-row"><strong>Role:</strong> {selected.role}</div>
          {selected.role === 'OWNER' && (
            <div className="detail-row">
              <strong>Store Rating:</strong>{' '}
              {selected.rating !== null ? <span className="stars">★ {selected.rating}</span> : 'No ratings yet'}
            </div>
          )}
          <button className="secondary" onClick={() => setSelected(null)}>Close</button>
        </div>
      )}
    </div>
  );
}