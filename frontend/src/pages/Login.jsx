import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/api.js';
import { useAuth } from '../api/AuthContext.jsx';
import { validateEmail } from '../utils/validate.js';
import { toast, showError, showSuccess, confirmAction } from '../utils/alert.js';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // The account exists but its email was never confirmed: offer a fresh link
  const offerResend = async () => {
    const yes = await confirmAction(
      'Email not verified',
      'Please click the link we emailed you. Lost it? We can send a new one.',
      'Send a new link'
    );
    if (!yes) return;
    try {
      const res = await api.post('/auth/resend-verification', { email: form.email.trim() });
      showSuccess('Check your inbox', res.data.message);
    } catch (err) {
      showError(err.response?.data?.message || 'Could not send the email');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Login only needs "something was typed". The strength rules apply when a password is created.
    const newErrors = {
      email: validateEmail(form.email),
      password: form.password ? '' : 'Password is required',
    };
    setErrors(newErrors);
    if (newErrors.email || newErrors.password) return;

    try {
      const res = await api.post('/auth/login', form);
      const { accessToken, user } = res.data.data;
      login(accessToken, user);
      toast(`Welcome back, ${user.name.split(' ')[0]}!`);
      navigate('/');
    } catch (err) {
      const data = err.response?.data;
      if (data?.code === 'EMAIL_NOT_VERIFIED') {
        offerResend();
      } else {
        showError(data?.message || 'Could not connect to server');
      }
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

        <p style={{ textAlign: 'right', margin: '8px 0 0' }}>
          <Link className="link" to="/forgot-password">Forgot password?</Link>
        </p>

        <button type="submit" style={{ width: '100%' }}>Login</button>
      </form>
      <p style={{ textAlign: 'center' }}>
        New to RateHub? <Link className="link" to="/signup">Create an account</Link>
      </p>
    </div>
  );
}