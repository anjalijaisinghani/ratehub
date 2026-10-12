import { useEffect, useState } from 'react';
import api from '../api/api.js';
import Stars from '../components/Stars.jsx';
import Pagination from '../components/Pagination.jsx';
import { askReply, toast, showError, confirmAction } from '../utils/alert.js';

const PAGE_SIZE = 10;

const SORTS = [
  { value: 'newest:desc', label: 'Newest first' },
  { value: 'newest:asc', label: 'Oldest first' },
  { value: 'rating:asc', label: 'Lowest rating first' },
  { value: 'rating:desc', label: 'Highest rating first' },
  { value: 'helpful:desc', label: 'Most helpful' },
];

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

export default function OwnerReviews() {
  const [filters, setFilters] = useState({ replied: '', rating: '' });
  const [sort, setSort] = useState('newest:desc');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ items: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0); // change this number to reload the list
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const [sortBy, order] = sort.split(':');
    const params = { sortBy, order, page, limit: PAGE_SIZE };
    if (filters.replied) params.replied = filters.replied;
    if (filters.rating) params.rating = filters.rating;

    setLoading(true);
    api
      .get('/owner/reviews', { params })
      .then((res) => {
        if (cancelled) return;
        setResult({ items: res.data.data, pagination: res.data.pagination });
        setError('');
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || 'Could not load reviews');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters, sort, page, reloadKey]);

  const updateFilter = (name, value) => {
    setFilters((f) => ({ ...f, [name]: value }));
    setPage(1);
  };

  const handleReply = async (review) => {
    const text = await askReply(review.text, review.reply ? review.reply.text : '');
    if (text === null) return; // cancelled

    setBusyId(review.id);
    try {
      const res = await api.put(`/owner/reviews/${review.id}/reply`, { text });
      toast(res.data.message);
      setReloadKey((n) => n + 1);
    } catch (err) {
      showError(err.response?.data?.message || 'Could not save your reply');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteReply = async (review) => {
    const yes = await confirmAction('Delete your reply?', 'The review itself stays.', 'Yes, delete');
    if (!yes) return;

    setBusyId(review.id);
    try {
      await api.delete(`/owner/reviews/${review.id}/reply`);
      toast('Reply deleted');
      setReloadKey((n) => n + 1);
    } catch (err) {
      showError(err.response?.data?.message || 'Could not delete your reply');
    } finally {
      setBusyId(null);
    }
  };

  const { items, pagination } = result;

  return (
    <div className="container">
      <h2>Reviews of my store</h2>
      {error && <div className="alert-error">{error}</div>}

      <div className="card">
        <div className="filters">
          <select value={filters.replied} onChange={(e) => updateFilter('replied', e.target.value)}>
            <option value="">All reviews</option>
            <option value="false">Needs a reply</option>
            <option value="true">Already replied</option>
          </select>
          <select value={filters.rating} onChange={(e) => updateFilter('rating', e.target.value)}>
            <option value="">Any rating</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>{n}★</option>
            ))}
          </select>
          <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {loading && items.length === 0 && <p className="muted">Loading reviews...</p>}
        {!loading && items.length === 0 && !error && (
          <p className="muted">
            {filters.replied || filters.rating ? 'No reviews match these filters.' : 'Your store has no written reviews yet.'}
          </p>
        )}

        <ul className="review-list" style={{ opacity: loading ? 0.6 : 1 }}>
          {items.map((r) => (
            <li className="review-item" key={r.id} style={{ display: 'block' }}>
              <div className="review-head">
                <strong>{r.reviewerName}</strong>
                <Stars value={r.rating} />
                <span className="muted">
                  {formatDate(r.reviewedAt)}{r.editedAt ? ' · edited' : ''}
                </span>
                <span className="muted">👍 {r.helpfulCount}</span>
                {!r.reply && <span className="tag closed">Needs a reply</span>}
              </div>
              {/* React escapes this text, so HTML typed by a customer is shown literally */}
              <p className="review-text">{r.text}</p>

              {r.reply && (
                <div className="owner-reply">
                  <strong>Your reply</strong>
                  <span className="muted">
                    {' '}· {formatDate(r.reply.editedAt || r.reply.repliedAt)}{r.reply.editedAt ? ' (edited)' : ''}
                  </span>
                  <p className="review-text">{r.reply.text}</p>
                </div>
              )}

              <div className="button-row">
                <button className="small" disabled={busyId === r.id} onClick={() => handleReply(r)}>
                  {r.reply ? 'Edit reply' : 'Reply'}
                </button>
                {r.reply && (
                  <button className="small danger" disabled={busyId === r.id} onClick={() => handleDeleteReply(r)}>
                    Delete reply
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>

        <Pagination pagination={pagination} onPage={setPage} />
      </div>
    </div>
  );
}