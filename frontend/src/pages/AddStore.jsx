import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api.js';
import { validateName, validateEmail, validateAddress } from '../utils/validate.js';
import { showSuccess, showError } from '../utils/alert.js';

const emptyForm = { name: '', email: '', address: '', ownerId: '' };

export default function AddStore() {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [owners, setOwners] = useState([]);

  // Load the list of Store Owners for the dropdown
  useEffect(() => {
    const loadOwners = async () => {
      try {
        const res = await api.get('/admin/users', { params: { role: 'OWNER', sortBy: 'name', order: 'asc' } });
        setOwners(res.data);
      } catch (err) {
        showError(err.response?.data?.message || 'Could not load owners');
      }
    };
    loadOwners();
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = {
      name: validateName(form.name),
      email: validateEmail(form.email),
      address: validateAddress(form.address),
      ownerId: form.ownerId ? '' : 'Please select a store owner',
    };
    setErrors(newErrors);
    if (Object.values(newErrors).some((m) => m)) return;

    try {
      await api.post('/admin/stores', { ...form, ownerId: Number(form.ownerId) });
      showSuccess('Store created!', `${form.name} was added to RateHub.`);
      setForm(emptyForm);
    } catch (err) {
      showError(err.response?.data?.message || 'Could not connect to server');
    }
  };

  return (
    <div className="container">
      <h2>Add New Store</h2>
      <div className="card" style={{ maxWidth: 700 }}>
        <form onSubmit={handleSubmit}>
                    <label>Store Name (20 to 60 characters)</label>
          <input name="name" value={form.name} onChange={handleChange} />
          {errors.name && <p className="error">{errors.name}</p>}

          <label>Store Email</label>
          <input name="email" value={form.email} onChange={handleChange} />
          {errors.email && <p className="error">{errors.email}</p>}

          <label>Store Owner</label>
          <select name="ownerId" value={form.ownerId} onChange={handleChange}>
            <option value="">-- Select an owner --</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>{o.name} ({o.email})</option>
            ))}
          </select>
          {errors.ownerId && <p className="error">{errors.ownerId}</p>}
          {owners.length === 0 && (
            <p className="muted">
              No store owners yet. <Link className="link" to="/admin/add-user">Add a user with the Store Owner role</Link> first.
            </p>
          )}

          <label>Address (max 400 characters)</label>
          <textarea name="address" rows="3" value={form.address} onChange={handleChange} />
          {errors.address && <p className="error">{errors.address}</p>}

          <button type="submit">Create Store</button>
        </form>
      </div>
    </div>
  );
}