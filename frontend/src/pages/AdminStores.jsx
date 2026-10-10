import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api.js';
import SortableTable from '../components/SortableTable.jsx';
import Pagination from '../components/Pagination.jsx';
import useDebounce from '../utils/useDebounce.js';
import { CATEGORIES, categoryOf } from '../utils/storeCategories.js';

const PAGE_SIZE = 10;
const emptyFilters = { name: '', email: '', address: '', city: '', category: '', status: '' };

export default function AdminStores() {
  const [filters, setFilters] = useState(emptyFilters);
  const [sortBy, setSortBy] = useState('name');
  const [order, setOrder] = useState('asc');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ items: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const debounced = useDebounce(filters, 400);

  useEffect(() => {
    let cancelled = false;

    // Send only the filters that have a value
    const params = { sortBy, order, page, limit: PAGE_SIZE };
    Object.entries(debounced).forEach(([key, value]) => {
      if (value.trim() !== '') params[key] = value.trim();
    });

    setLoading(true);
    api
      .get('/admin/stores', { params })
      .then((res) => {
        if (cancelled) return;
        setResult({ items: res.data.data, pagination: res.data.pagination });
        setError('');
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || 'Could not load stores');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debounced, sortBy, order, page]);

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
    setPage(1);
  };

  const handleSort = (key) => {
    if (key === sortBy) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setOrder('asc');
    }
    setPage(1);
  };

  const columns = [
    {
      key: 'name',
      label: 'Store Name',
    },
    { key: 'email', label: 'Email' },
    { key: 'address', label: 'Address' },
    {
      key: 'category',
      label: 'Category',
      render: (r) => `${categoryOf(r.category).icon} ${categoryOf(r.category).label}`,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <span className={`badge badge-${r.status}`}>{r.status}</span>,
    },
    {
      key: 'rating',
      label: 'Rating',
      render: (r) =>
        r.rating !== null ? (
          <span className="stars">★ {r.rating.toFixed(1)}</span>
        ) : (
          <span className="muted">No ratings</span>
        ),
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (r) => (
        <Link className="btn" to={`/admin/stores/${r.id}/edit`} style={{ marginTop: 0, padding: '6px 12px', fontSize: 13 }}>
          Edit
        </Link>
      ),
    },
  ];

  const { items, pagination } = result;

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
          <input name="city" placeholder="Filter by city" value={filters.city} onChange={handleFilterChange} />
          <select name="category" value={filters.category} onChange={handleFilterChange}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <select name="status" value={filters.status} onChange={handleFilterChange}>
            <option value="">Any status</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </div>

        {loading && <p className="muted">Loading...</p>}
        <SortableTable
          columns={columns}
          rows={items}
          sortBy={sortBy}
          order={order}
          onSort={handleSort}
          emptyText="No stores found"
        />
        <Pagination pagination={pagination} onPage={setPage} />
      </div>
    </div>
  );
}