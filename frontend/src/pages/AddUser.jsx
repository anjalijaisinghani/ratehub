import { useState } from 'react';
import api from '../api/api.js';
import {
  validateName,
  validateEmail,
  validateAddress,
  validatePassword,
} from '../utils/validate.js';
import { showSuccess, showError } from '../utils/alert.js';

const emptyForm = { name: '', email: '', address: '', password: '', role: 'USER' };

export default function AddUser() {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = {
      name: validateName(form.name),
      email: validateEmail(form.email),
      address: validateAddress(form.address),
      password: validatePassword(form.password),
    };
    setErrors(newErrors);
    if (Object.values(newErrors).some((m) => m)) return;

    try {
      await api.post('/admin/users', form);
      showSuccess('User created!', `${form.name} was added as ${form.role}.`);
      setForm(emptyForm);
    } catch (err) {
      showError(err.response?.data?.message || 'Could not connect to server');
    }
  };

  return (
    <div className="container">
      <h2>Add New User</h2>
      <div className="card" style={{ maxWidth: 700 }}>
        <form onSubmit={handleSubmit}>
          <div className="two-col">
            <div>
              <label>Full Name (20 to 60 characters)</label>
              <input name="name" value={form.name} onChange={handleChange} />
              {errors.name && <p className="error">{errors.name}</p>}
            </div>
            <div>
              <label>Email</label>
              <input name="email" value={form.email} onChange={handleChange} />
              {errors.email && <p className="error">{errors.email}</p>}
            </div>
            <div>
              <label>Password (8 to 16 chars, 1 uppercase, 1 special)</label>
              <input type="password" name="password" value={form.password} onChange={handleChange} />
              {errors.password && <p className="error">{errors.password}</p>}
            </div>
            <div>
              <label>Role</label>
              <select name="role" value={form.role} onChange={handleChange}>
                <option value="USER">Normal User</option>
                <option value="ADMIN">Admin</option>
                <option value="OWNER">Store Owner</option>
              </select>
            </div>
          </div>

          <label>Address (max 400 characters)</label>
          <textarea name="address" rows="3" value={form.address} onChange={handleChange} />
          {errors.address && <p className="error">{errors.address}</p>}

          <button type="submit">Create User</button>
        </form>
      </div>
    </div>
  );
}