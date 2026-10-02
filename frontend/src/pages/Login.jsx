import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/api.js';
import { useAuth } from '../api/AuthContext.jsx';
import { validateEmail, validatePassword } from '../utils/validate.js';
import { toast, showError } from '../utils/alert.js';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = {
      email: validateEmail(form.email),
      password: validatePassword(form.password),
    };
    setErrors(newErrors);
    if (newErrors.email || newErrors.password) return;

    try {
      const res = await api.post('/auth/login', form);
      login(res.data.token, res.data.user);
      toast(`Welcome back, ${res.data.user.name.split(' ')[0]}!`);
      navigate('/');
    } catch (err) {
      showError(err.response?.data?.message || 'Could not connect to server');
    }
  };

  return (
    <div className="card auth-card">
      <img className="auth-logo" src="/logo-full.png" alt="RateHub" />
      <h2 style={{ textAlign: 'center' }}>Welcome back</h2>
      <p className="muted" style={{ textAlign: 'center', marginTop: -6 }}>Log in to continue</p>
      <form onSubmit={handleSubmit}>
        <label>Email</label>
        <input name="email" value={form.email} onChange={handleChange} placeholder="you@example.com" />
        {errors.email && <p className="error">{errors.email}</p>}

        <label>Password</label>
        <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="Your password" />
        {errors.password && <p className="error">{errors.password}</p>}

        <button type="submit" style={{ width: '100%' }}>Login</button>
      </form>
      <p style={{ textAlign: 'center' }}>
        New to RateHub? <Link className="link" to="/signup">Create an account</Link>
      </p>
    </div>
  );
}