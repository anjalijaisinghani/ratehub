import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/api.js';
import {
  validateName,
  validateEmail,
  validateAddress,
  validatePassword,
} from '../utils/validate.js';
import { showSuccess, showError } from '../utils/alert.js';

export default function Signup() {
  const [form, setForm] = useState({ name: '', email: '', address: '', password: '' });
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

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
      await api.post('/auth/signup', form);
      await showSuccess('Account created!', 'Please log in to continue.');
      navigate('/login');
    } catch (err) {
      showError(err.response?.data?.message || 'Could not connect to server');
    }
  };

  return (
    <div className="card auth-card">
      <img className="auth-logo" src="/logo-full.png" alt="RateHub" style={{ height: 100 }} />
      <h2 style={{ textAlign: 'center' }}>Create your account</h2>
      <form onSubmit={handleSubmit}>
        <label>Full Name (20 to 60 characters)</label>
        <input name="name" value={form.name} onChange={handleChange} />
        {errors.name && <p className="error">{errors.name}</p>}

        <label>Email</label>
        <input name="email" value={form.email} onChange={handleChange} />
        {errors.email && <p className="error">{errors.email}</p>}

        <label>Address (max 400 characters)</label>
        <textarea name="address" rows="3" value={form.address} onChange={handleChange} />
        {errors.address && <p className="error">{errors.address}</p>}

        <label>Password (8 to 16 chars, 1 uppercase, 1 special)</label>
        <input type="password" name="password" value={form.password} onChange={handleChange} />
        {errors.password && <p className="error">{errors.password}</p>}

        <button type="submit" style={{ width: '100%' }}>Sign Up</button>
      </form>
      <p style={{ textAlign: 'center' }}>
        Already have an account? <Link className="link" to="/login">Login</Link>
      </p>
    </div>
  );
}