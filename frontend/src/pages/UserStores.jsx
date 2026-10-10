import { useEffect, useState } from 'react';
import api from '../api/api.js';
import Stars from '../components/Stars.jsx';
import Pagination from '../components/Pagination.jsx';
import useDebounce from '../utils/useDebounce.js';
import { CATEGORIES, categoryOf, safeUrl } from '../utils/storeCategories.js';
import { askRating, toast, showError } from '../utils/alert.js';

const PAGE_SIZE = 12;

const SORTS = [
  { value: 'name:asc', label: 'Name (A to Z)' },
  { value: 'name:desc', label: 'Name (Z to A)' },
  { value: 'overallRating:desc', label: 'Highest rated' },
  { value: 'ratingCount:desc', label: 'Most reviewed' },
  { value: 'newest:desc', label: 'Newest first' },
];

const emptyFilters = { search: '', category: '', city: '', minRating: '', openNow: false };

export default function UserStores() {
  const [filters, setFilters] = useState(emptyFilters);
  const [sort, setSort] = useState('name:asc');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ items: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0); // change this number to reload the list

  // Wait until the user stops typing before asking the server
  const debounced = useDebounce(filters, 400);

  useEffect(() => {
    let cancelled = false; // ignore answers that arrive after a newer request was sent
    const [sortBy, order] = sort.split(':');

    const params = { sortBy, order, page, limit: PAGE_SIZE };
    if (debounced.search.trim()) params.search = debounced.search.trim();
    if (debounced.category) params.category = debounced.category;
    if (debounced.city.trim()) params.city = debounced.city.trim();
    if (debounced.minRating) params.minRating = debounced.minRating;
    if (debounced.openNow) params.openNow = 'true';

    setLoading(true);
    api
      .get('/stores', { params })
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
  }, [debounced, sort, page, refresh]);

  // Any change in the filters starts again from page 1
  const updateFilter = (name, value) => {
    setFilters((f) => ({ ...f, [name]: value }));
    setPage(1);
  };

  const handleRate = async (store) => {
    const rating = await askRating(store.name, store.myRating);
    if (rating === null) return; // cancelled

    try {
      await api.post(`/stores/${store.id}/rating`, { rating });
      toast(store.myRating ? 'Rating updated!' : 'Thanks for rating!');
      setRefresh((n) => n + 1);
    } catch (err) {
      showError(err.response?.data?.message || 'Could not save rating');
    }
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setPage(1);
  };

  const hasFilters = JSON.stringify(filters) !== JSON.stringify(emptyFilters);
  const { items, pagination } = result;

  return (
    <div className="container">
      <h2>Discover Stores</h2>
      {error && <div className="alert-error">{error}</div>}

      <div className="card">
        <div className="filter-bar">
          <div>
            <label>Search</label>
            <input
              placeholder="🔍 Name, address or city"
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
            />
          </div>
          <div>
            <label>Category</label>
            <select value={filters.category} onChange={(e) => updateFilter('category', e.target.value)}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label>City</label>
            <input placeholder="e.g. Pune" value={filters.city} onChange={(e) => updateFilter('city', e.target.value)} />
          </div>
          <div>
            <label>Minimum rating</label>
            <select value={filters.minRating} onChange={(e) => updateFilter('minRating', e.target.value)}>
              <option value="">Any rating</option>
              <option value="4">4★ and above</option>
              <option value="3">3★ and above</option>
              <option value="2">2★ and above</option>
            </select>
          </div>
          <div>
            <label>Sort by</label>
            <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="filter-actions">
          <label className="check-row">
            <input
              type="checkbox"
              checked={filters.openNow}
              onChange={(e) => updateFilter('openNow', e.target.checked)}
            />
            Open now
          </label>
          {hasFilters && (
            <button className="small secondary" onClick={clearFilters}>Clear filters</button>
          )}
        </div>
      </div>

      {loading && items.length === 0 && <p className="muted">Loading stores...</p>}

      {!loading && items.length === 0 && !error && (
        <div className="card empty-state">
          <div className="big-icon">🔎</div>
          <h3>No stores match your search</h3>
          <p className="muted">Try different words or remove some filters.</p>
        </div>
      )}

      <div className="store-grid" style={{ opacity: loading ? 0.6 : 1 }}>
        {items.map((s) => {
          const cat = categoryOf(s.category);
          const image = s.imageUrl ? safeUrl(s.imageUrl) : null;
          const website = s.website ? safeUrl(s.website) : null;

          return (
            <div className="store-card" key={s.id}>
              <div className="store-img">
                {image ? (
                  <img src={image} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.display = 'none')} />
                ) : (
                  <span className="store-icon">{cat.icon}</span>
                )}
              </div>
              <div className="store-body">
                <h3>{s.name}</h3>
                <div className="tag-row">
                  <span className="tag">{cat.icon} {cat.label}</span>
                  {s.isOpenNow === true && <span className="tag open">Open now</span>}
                  {s.isOpenNow === false && <span className="tag closed">Closed</span>}
                </div>
                <p className="muted">📍 {s.address}{s.city ? ` · ${s.city}` : ''}</p>
                {s.openingTime && <p className="muted">🕒 {s.openingTime} – {s.closingTime}</p>}
                {s.phone && <p className="muted">📞 {s.phone}</p>}
                {website && (
                  <p>
                    <a className="link" href={website} target="_blank" rel="noopener noreferrer">Website ↗</a>
                  </p>
                )}
                <p>
                  <Stars value={s.overallRating} />
                  <span className="muted"> ({s.ratingCount} {s.ratingCount === 1 ? 'rating' : 'ratings'})</span>
                </p>
                <p>Your rating: <Stars value={s.myRating} /></p>
                <div className="store-actions">
                  <button onClick={() => handleRate(s)}>
                    {s.myRating ? 'Modify my rating' : 'Rate this store'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Pagination pagination={pagination} onPage={setPage} />
    </div>
  );
}