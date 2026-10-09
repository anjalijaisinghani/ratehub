import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api.js';
import { validateEmail } from '../utils/validate.js';
import { showError } from '../utils/alert.js';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sentMessage, setSentMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const problem = validateEmail(email);
    setError(problem);
    if (problem) return;

    setBusy(true);
    try {
      const res = await api.post('/auth/forgot-password', { email: email.trim() });
      setSentMessage(res.data.message); // the same text whether or not the account exists
    } catch (err) {
      showError(err.response?.data?.message || 'Could not connect to server');
    } finally {
      setBusy(false);
    }
  };

  if (sentMessage) {
    return (
      <div className="card auth-card center">
        <div className="big-icon">📧</div>
        <h2>Check your inbox</h2>
        <p className="muted">{sentMessage}</p>
        <p className="muted">The link works once and expires in 1 hour.</p>
        <Link className="btn" to="/login">Back to Login</Link>
      </div>
    );
  }

  return (
    <div className="card auth-card">
      <h2>Forgot your password?</h2>
      <p className="muted">Enter your email and we will send you a link to choose a new one.</p>
      <form onSubmit={handleSubmit}>
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        {error && <p className="error">{error}</p>}

        <button type="submit" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Sending...' : 'Send reset link'}
        </button>
      </form>
      <p style={{ textAlign: 'center' }}>
        <Link className="link" to="/login">Back to Login</Link>
      </p>
    </div>
  );
}