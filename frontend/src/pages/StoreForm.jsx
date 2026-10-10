import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/api.js';
import { CATEGORIES } from '../utils/storeCategories.js';
import {
  validateName,
  validateEmail,
  validateAddress,
  validatePhone,
  validateUrl,
  validatePincode,
  validateLatitude,
  validateLongitude,
  validateMaxLength,
} from '../utils/validate.js';
import { showSuccess, showError, toast } from '../utils/alert.js';

const emptyForm = {
  name: '', email: '', category: 'OTHER', ownerId: '', phone: '', website: '', imageUrl: '',
  address: '', city: '', state: '', pincode: '', description: '',
  latitude: '', longitude: '', openingTime: '', closingTime: '', status: 'ACTIVE',
};

// Empty text is sent as null, so the database stores NULL (not an empty string)
const toNull = (v) => (v.trim() === '' ? null : v.trim());
const toNumberOrNull = (v) => (v.trim() === '' ? null : Number(v));
const str = (v) => (v === null || v === undefined ? '' : String(v));

export default function StoreForm() {
  const { id } = useParams(); // present on /admin/stores/:id/edit
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [owners, setOwners] = useState([]);
  const [ownerLabel, setOwnerLabel] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        if (isEdit) {
          const res = await api.get(`/admin/stores/${id}`);
          const s = res.data.data;
          setForm({
            name: s.name, email: s.email, category: s.category, ownerId: String(s.ownerId),
            phone: str(s.phone), website: str(s.website), imageUrl: str(s.imageUrl),
            address: s.address, city: str(s.city), state: str(s.state), pincode: str(s.pincode),
            description: str(s.description), latitude: str(s.latitude), longitude: str(s.longitude),
            openingTime: str(s.openingTime), closingTime: str(s.closingTime), status: s.status,
          });
          setOwnerLabel(`${s.ownerName} (${s.ownerEmail})`);
        } else {
          const res = await api.get('/admin/users', { params: { role: 'OWNER', sortBy: 'name', order: 'asc' } });
          setOwners(res.data.data);
        }
      } catch (err) {
        showError(err.response?.data?.message || 'Could not load the form');
        if (isEdit) navigate('/admin/stores');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, isEdit, navigate]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // Fills latitude and longitude from the browser's location (best done while standing at the store)
  const fillFromBrowserLocation = () => {
    if (!navigator.geolocation) {
      showError('Your browser does not support location.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        toast('Location filled in');
      },
      () => showError('Could not get your location. Allow location access, or type the coordinates.'),
      { timeout: 10000 }
    );
  };

  const validate = () => {
    const e = {
      name: validateName(form.name),
      email: validateEmail(form.email),
      address: validateAddress(form.address),
      ownerId: isEdit || form.ownerId ? '' : 'Please select a store owner',
      phone: validatePhone(form.phone),
      website: validateUrl(form.website),
      imageUrl: validateUrl(form.imageUrl),
      pincode: validatePincode(form.pincode),
      city: validateMaxLength('City', 100)(form.city),
      state: validateMaxLength('State', 100)(form.state),
      description: validateMaxLength('Description', 1000)(form.description),
      latitude: validateLatitude(form.latitude),
      longitude: validateLongitude(form.longitude),
    };

    // "Both or neither" rules (the server and the database enforce them too)
    const hasLat = form.latitude.trim() !== '';
    const hasLng = form.longitude.trim() !== '';
    if (hasLat !== hasLng) {
      const missing = hasLat ? 'longitude' : 'latitude';
      if (!e[missing]) e[missing] = 'Enter both latitude and longitude, or leave both empty';
    }
    if (Boolean(form.openingTime) !== Boolean(form.closingTime)) {
      e[form.openingTime ? 'closingTime' : 'openingTime'] = 'Enter both opening and closing time, or leave both empty';
    }
    return e;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();

    const newErrors = validate();
    setErrors(newErrors);
    if (Object.values(newErrors).some((m) => m)) return;

    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      category: form.category,
      description: toNull(form.description),
      phone: toNull(form.phone),
      city: toNull(form.city),
      state: toNull(form.state),
      pincode: toNull(form.pincode),
      website: toNull(form.website),
      imageUrl: toNull(form.imageUrl),
      latitude: toNumberOrNull(form.latitude),
      longitude: toNumberOrNull(form.longitude),
      openingTime: form.openingTime || null,
      closingTime: form.closingTime || null,
    };

    setBusy(true);
    try {
      if (isEdit) {
        await api.put(`/admin/stores/${id}`, { ...payload, status: form.status });
        toast('Store updated');
        navigate('/admin/stores');
      } else {
        await api.post('/admin/stores', { ...payload, ownerId: Number(form.ownerId) });
        showSuccess('Store created!', `${form.name} was added to RateHub.`);
        setForm(emptyForm);
      }
    } catch (err) {
      showError(err.response?.data?.message || 'Could not connect to server');
    } finally {
      setBusy(false);
    }
  };

  // A helper that draws one labelled input with its error message
  const field = (label, name, props = {}) => (
    <div>
      <label>{label}</label>
      <input name={name} value={form[name]} onChange={handleChange} {...props} />
      {errors[name] && <p className="error">{errors[name]}</p>}
    </div>
  );

  if (loading) return <div className="container"><p className="muted">Loading...</p></div>;

  return (
    <div className="container">
      <div className="page-title">
        <h2>{isEdit ? 'Edit Store' : 'Add New Store'}</h2>
        <Link className="link" to="/admin/stores">← Back to stores</Link>
      </div>

      <div className="card" style={{ maxWidth: 800 }}>
        <form onSubmit={handleSubmit}>
          <div className="two-col">
            {field('Store Name (20 to 60 characters)', 'name')}
            {field('Store Email', 'email')}

            <div>
              <label>Category</label>
              <select name="category" value={form.category} onChange={handleChange}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label>Store Owner</label>
              {isEdit ? (
                <input value={ownerLabel} disabled />
              ) : (
                <>
                  <select name="ownerId" value={form.ownerId} onChange={handleChange}>
                    <option value="">-- Select an owner --</option>
                    {owners.map((o) => (
                      <option key={o.id} value={o.id}>{o.name} ({o.email})</option>
                    ))}
                  </select>
                  {errors.ownerId && <p className="error">{errors.ownerId}</p>}
                  {owners.length === 0 && (
                    <p className="muted">
                      No store owners yet. <Link className="link" to="/admin/add-user">Add one</Link> first.
                    </p>
                  )}
                </>
              )}
            </div>

            {field('Phone (optional)', 'phone')}
            {field('Website (optional)', 'website', { placeholder: 'https://...' })}
            {field('Image link (optional)', 'imageUrl', { placeholder: 'https://.../photo.jpg' })}
            {isEdit && (
              <div>
                <label>Status</label>
                <select name="status" value={form.status} onChange={handleChange}>
                  <option value="ACTIVE">ACTIVE (visible to customers)</option>
                  <option value="INACTIVE">INACTIVE (hidden from customers)</option>
                </select>
              </div>
            )}
          </div>

          <label>Address (max 400 characters)</label>
          <textarea name="address" rows="2" value={form.address} onChange={handleChange} />
          {errors.address && <p className="error">{errors.address}</p>}

          <div className="two-col">
            {field('City (optional)', 'city')}
            {field('State (optional)', 'state')}
            {field('Pincode (optional)', 'pincode')}
            <div />
            {field('Opening time (optional)', 'openingTime', { type: 'time' })}
            {field('Closing time (optional)', 'closingTime', { type: 'time' })}
            {field('Latitude (optional)', 'latitude', { placeholder: 'e.g. 18.5204' })}
            {field('Longitude (optional)', 'longitude', { placeholder: 'e.g. 73.8567' })}
          </div>
          <button type="button" className="secondary small" onClick={fillFromBrowserLocation}>
            📍 Use my current location
          </button>
          <p className="muted" style={{ marginBottom: 0 }}>            Opening and closing time equal means open 24 hours. A closing time earlier than the opening time means it closes after midnight.
          </p>

          <label>Description (optional, max 1000 characters)</label>
          <textarea name="description" rows="3" value={form.description} onChange={handleChange} />
          {errors.description && <p className="error">{errors.description}</p>}

          <button type="submit" disabled={busy}>
            {busy ? 'Saving...' : isEdit ? 'Save changes' : 'Create Store'}
          </button>
        </form>
      </div>
    </div>
  );
}