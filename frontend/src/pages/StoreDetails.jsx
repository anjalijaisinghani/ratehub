import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/api.js';
import Stars from '../components/Stars.jsx';
import StarPicker from '../components/StarPicker.jsx';
import RatingBars from '../components/RatingBars.jsx';
import Pagination from '../components/Pagination.jsx';
import { categoryOf, safeUrl } from '../utils/storeCategories.js';
import { validateReviewText } from '../utils/validate.js';
import { toast, showError, confirmAction } from '../utils/alert.js';

const PAGE_SIZE = 10;
const MAX_LEN = 1000;

const SORTS = [
  { value: 'newest:desc', label: 'Newest first' },
  { value: 'newest:asc', label: 'Oldest first' },
  { value: 'rating:desc', label: 'Highest rating' },
  { value: 'rating:asc', label: 'Lowest rating' },
  { value: 'helpful:desc', label: 'Most helpful' },
];

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

const initialOf = (name) => {
  const first = [...(name || '').trim()][0];
  return first ? first.toUpperCase() : '?';
};

export default function StoreDetails() {
  const { id: storeId } = useParams();

  const [store, setStore] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [reviews, setReviews] = useState({ items: [], pagination: null });
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [ratingFilter, setRatingFilter] = useState('');
  const [sort, setSort] = useState('newest:desc');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0); // change this number to reload everything

  const [form, setForm] = useState({ rating: 0, text: '' });
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
    const [votingId, setVotingId] = useState(null);

  // Store profile + rating summary + my own review
  useEffect(() => {
    let cancelled = false;
    api
      .get(`/stores/${storeId}`)
      .then((res) => {
        if (cancelled) return;
        setStore(res.data.data);
        setNotFound(false);
        setLoadError('');
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.response?.status === 404) setNotFound(true);
        else setLoadError(err.response?.data?.message || 'Could not load this store');
      });
    return () => {
      cancelled = true;
    };
  }, [storeId, reloadKey]);

  // The list of written reviews
  useEffect(() => {
    let cancelled = false;
    const [sortBy, order] = sort.split(':');
    const params = { sortBy, order, page, limit: PAGE_SIZE };
    if (ratingFilter) params.rating = ratingFilter;

    setLoadingReviews(true);
    api
      .get(`/stores/${storeId}/reviews`, { params })
      .then((res) => {
        if (!cancelled) setReviews({ items: res.data.data, pagination: res.data.pagination });
      })
      .catch((err) => {
        if (!cancelled && err.response?.status !== 404) {
          showError(err.response?.data?.message || 'Could not load reviews');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingReviews(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId, ratingFilter, sort, page, reloadKey]);

  // Someone who rated from the list page starts with their stars already chosen
  useEffect(() => {
    if (store && !editing) {
      setForm((f) => (f.rating ? f : { ...f, rating: store.myRating || 0 }));
    }
  }, [store, editing]);

  const reloadAll = () => {
    setPage(1);
    setReloadKey((n) => n + 1);
  };

  const startEdit = () => {
    setForm({ rating: store.myReview.rating, text: store.myReview.text });
    setErrors({});
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setErrors({});
    setForm({ rating: store.myRating || 0, text: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = {
      rating: form.rating >= 1 ? '' : 'Please choose a star rating',
      text: validateReviewText(form.text),
    };
    setErrors(newErrors);
    if (newErrors.rating || newErrors.text) return;

    setSaving(true);
    try {
      const res = await api.put(`/stores/${storeId}/review`, { rating: form.rating, text: form.text.trim() });
      toast(res.data.message);
      setEditing(false);
      setForm({ rating: form.rating, text: '' });
      reloadAll();
    } catch (err) {
      showError(err.response?.data?.message || 'Could not save your review');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const yes = await confirmAction(
      'Delete your review?',
      'Your star rating and your written review will both be removed.',
      'Yes, delete'
    );
    if (!yes) return;

    try {
      await api.delete(`/stores/${storeId}/review`);
      toast('Review deleted');
      setEditing(false);
      setForm({ rating: 0, text: '' });
      reloadAll();
    } catch (err) {
      showError(err.response?.data?.message || 'Could not delete your review');
    }
  };

  // Mark a review helpful, or take the vote back. The server answers with the new count.
  const toggleHelpful = async (review) => {
    setVotingId(review.id);
    try {
      const url = `/stores/${storeId}/reviews/${review.id}/helpful`;
      const res = review.iVoted ? await api.delete(url) : await api.put(url);
      const { helpfulCount, iVoted } = res.data.data;
      setReviews((current) => ({
        ...current,
        items: current.items.map((r) => (r.id === review.id ? { ...r, helpfulCount, iVoted } : r)),
      }));
    } catch (err) {
      showError(err.response?.data?.message || 'Could not save your vote');
    } finally {
      setVotingId(null);
    }
  };

  if (notFound) {
    return (
      <div className="container">
        <div className="card empty-state">
          <div className="big-icon">🔎</div>
          <h2>Store not found</h2>
          <p className="muted">This store does not exist or is no longer available.</p>
          <Link className="btn" to="/stores">Back to stores</Link>
        </div>
      </div>
    );
  }
  if (loadError && !store) return <div className="container"><div className="alert-error">{loadError}</div></div>;
  if (!store) return <div className="container"><p className="muted">Loading store...</p></div>;

  const cat = categoryOf(store.category);
  const image = store.imageUrl ? safeUrl(store.imageUrl) : null;
  const website = store.website ? safeUrl(store.website) : null;
  const hasPosition = store.latitude !== null && store.longitude !== null;
  const my = store.myReview;
  const textLength = [...form.text].length;
  const { items, pagination } = reviews;

  return (
    <div className="container">
      <p><Link className="link" to="/stores">← Back to stores</Link></p>

      {/* ---------- Store profile and rating summary ---------- */}
      <div className="card store-hero">
        <div>
          <div className="store-img detail-img">
            {image ? (
              <img src={image} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />
            ) : (
              <span className="store-icon">{cat.icon}</span>
            )}
          </div>
          <h2 style={{ marginBottom: 8 }}>{store.name}</h2>
          <div className="tag-row">
            <span className="tag">{cat.icon} {cat.label}</span>
            {store.isVerified && <span className="tag verified">✓ Verified</span>}
            {store.isOpenNow === true && <span className="tag open">Open now</span>}
            {store.isOpenNow === false && <span className="tag closed">Closed</span>}
          </div>
          <p className="muted">📍 {store.address}{store.city ? ` · ${store.city}` : ''}</p>
          {store.openingTime && <p className="muted">🕒 {store.openingTime} – {store.closingTime}</p>}
          {store.phone && <p className="muted">📞 {store.phone}</p>}
          <p>
            {hasPosition && (
              <a
                className="link"
                href={`https://www.google.com/maps/search/?api=1&query=${store.latitude},${store.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Map ↗
              </a>
            )}
            {hasPosition && website && ' · '}
            {website && <a className="link" href={website} target="_blank" rel="noopener noreferrer">Website ↗</a>}
          </p>
          {store.description && <p style={{ whiteSpace: 'pre-wrap' }}>{store.description}</p>}
        </div>

        <div>
          <div className="avg-block">
            <div className="avg-number">{store.overallRating !== null ? store.overallRating.toFixed(1) : '—'}</div>
            <div>
              <Stars value={store.overallRating} />
              <div className="muted">
                {store.ratingCount} {store.ratingCount === 1 ? 'rating' : 'ratings'} · {store.reviewCount}{' '}
                {store.reviewCount === 1 ? 'written review' : 'written reviews'}
              </div>
            </div>
          </div>
          <RatingBars distribution={store.distribution} />
        </div>
      </div>

      {/* ---------- My review ---------- */}
      <div className={`card ${my && !editing ? 'my-review' : ''}`}>
        <h3>Your review</h3>

        {my && !editing ? (
          <>
            <div className="review-head">
              <Stars value={my.rating} />
              <span className="muted">
                {formatDate(my.editedAt || my.reviewedAt)}{my.editedAt ? ' (edited)' : ''}
              </span>
            </div>
            <p className="review-text">{my.text}</p>
            {my.reply && (
              <div className="owner-reply">
                <strong>Response from the owner</strong>
                <span className="muted">
                  {' '}· {formatDate(my.reply.editedAt || my.reply.repliedAt)}{my.reply.editedAt ? ' (edited)' : ''}
                </span>
                <p className="review-text">{my.reply.text}</p>
              </div>
            )}
            <p className="muted">👍 {my.helpfulCount} found this helpful</p>
            <div className="button-row">
              <button className="small" onClick={startEdit}>Edit review</button>
              <button className="small danger" onClick={handleDelete}>Delete review</button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            {!my && store.myRating && (
              <p className="muted">You rated this store {store.myRating}★. Add a written review to tell others more.</p>
            )}

            <label>Your rating</label>
            <StarPicker value={form.rating} onChange={(n) => setForm({ ...form, rating: n })} disabled={saving} />
            {errors.rating && <p className="error">{errors.rating}</p>}

            <label>Your review (10 to {MAX_LEN} characters)</label>
            <textarea
              rows="4"
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
              placeholder="What was your experience?"
            />
            <p className={`char-count ${textLength > MAX_LEN ? 'bad' : ''}`}>{textLength} / {MAX_LEN}</p>
            {errors.text && <p className="error">{errors.text}</p>}

            <div className="button-row">
              <button type="submit" disabled={saving}>
                {saving ? 'Saving...' : my ? 'Save changes' : 'Post review'}
              </button>
              {editing && <button type="button" className="secondary" onClick={cancelEdit}>Cancel</button>}
            </div>
          </form>
        )}
      </div>

      {/* ---------- All reviews ---------- */}
      <div className="card">
        <div className="row-between">
          <h3 style={{ margin: 0 }}>Reviews</h3>
          <select
            value={sort}
            style={{ width: 'auto' }}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="chip-row" style={{ margin: '14px 0' }}>
          {['', '5', '4', '3', '2', '1'].map((v) => (
            <button
              key={v || 'all'}
              type="button"
              className={`chip ${ratingFilter === v ? 'active' : ''}`}
              onClick={() => {
                setRatingFilter(v);
                setPage(1);
              }}
            >
              {v ? `${v}★` : 'All'}
            </button>
          ))}
        </div>

        {loadingReviews && items.length === 0 && <p className="muted">Loading reviews...</p>}
        {!loadingReviews && items.length === 0 && (
          <p className="muted">
            {ratingFilter ? 'No reviews with this rating yet.' : 'No written reviews yet. Be the first!'}
          </p>
        )}

        <ul className="review-list" style={{ opacity: loadingReviews ? 0.6 : 1 }}>
          {items.map((r) => (
            <li className="review-item" key={r.id}>
              <div className="avatar">{initialOf(r.reviewerName)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="review-head">
                  <strong>{r.reviewerName}</strong>
                  {r.isMine && <span className="tag mine">You</span>}
                  <Stars value={r.rating} />
                  <span className="muted">
                    {formatDate(r.reviewedAt)}{r.editedAt ? ' · edited' : ''}
                  </span>
                </div>
                {/* React escapes this text, so HTML typed by a user is shown literally and never runs */}
                <p className="review-text">{r.text}</p>
                {r.reply && (
                  <div className="owner-reply">
                    <strong>Response from the owner</strong>
                    <span className="muted">
                      {' '}· {formatDate(r.reply.editedAt || r.reply.repliedAt)}{r.reply.editedAt ? ' (edited)' : ''}
                    </span>
                    <p className="review-text">{r.reply.text}</p>
                  </div>
                )}
                <div className="helpful-row">
                  {r.isMine ? (
                    <span className="muted">👍 {r.helpfulCount} found this helpful</span>
                  ) : (
                    <button
                      type="button"
                      className={`chip ${r.iVoted ? 'active' : ''}`}
                      disabled={votingId === r.id}
                      onClick={() => toggleHelpful(r)}
                    >
                      👍 Helpful ({r.helpfulCount})
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>

        <Pagination pagination={pagination} onPage={setPage} />
      </div>
    </div>
  );
}