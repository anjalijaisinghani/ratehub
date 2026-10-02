import { useEffect, useState } from 'react';
import api from '../api/api.js';
import SortableTable from '../components/SortableTable.jsx';
import Stars from '../components/Stars.jsx';
import { askRating, toast, showError } from '../utils/alert.js';

export default function UserStores() {
  const [stores, setStores] = useState([]);
  const [search, setSearch] = useState({ name: '', address: '' });
  const [sortBy, setSortBy] = useState('name');
  const [order, setOrder] = useState('asc');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0); // change this number to reload the list

  // Reload whenever the search, sorting or refresh counter changes
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get('/stores', { params: { ...search, sortBy, order } });
        setStores(res.data);
        setError('');
      } catch (err) {
        setError(err.response?.data?.message || 'Could not load stores');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [search, sortBy, order, refresh]);

  const handleSearchChange = (e) => setSearch({ ...search, [e.target.name]: e.target.value });

  const handleSort = (key) => {
    if (key === sortBy) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setOrder('asc');
    }
  };

  // Opens the popup, saves the rating, then reloads the list
  const handleRate = async (store) => {
    const rating = await askRating(store.name, store.myRating);
    if (rating === null) return; // user cancelled

    try {
      await api.post(`/stores/${store.id}/rating`, { rating });
      toast(store.myRating ? 'Rating updated!' : 'Thanks for rating!');
      setRefresh((n) => n + 1);
    } catch (err) {
      showError(err.response?.data?.message || 'Could not save rating');
    }
  };

  const columns = [
    { key: 'name', label: 'Store Name' },
    { key: 'address', label: 'Address' },
    { key: 'overallRating', label: 'Overall Rating', render: (r) => <Stars value={r.overallRating} /> },
    { key: 'myRating', label: 'My Rating', render: (r) => <Stars value={r.myRating} /> },
    {
      key: 'action',
      label: 'Action',
      sortable: false,
      render: (r) => (
        <button className="small" onClick={() => handleRate(r)}>
          {r.myRating ? 'Modify Rating' : 'Submit Rating'}
        </button>
      ),
    },
  ];

  return (
    <div className="container">
      <h2>Browse Stores</h2>
      {error && <div className="alert-error">{error}</div>}

      <div className="card">
        <div className="filters">
          <input name="name" placeholder="🔍 Search by store name" value={search.name} onChange={handleSearchChange} />
          <input name="address" placeholder="📍 Search by address" value={search.address} onChange={handleSearchChange} />
        </div>

        {loading && <p className="muted">Loading...</p>}
        <SortableTable
          columns={columns}
          rows={stores}
          sortBy={sortBy}
          order={order}
          onSort={handleSort}
          emptyText="No stores match your search"
        />
      </div>
    </div>
  );
}