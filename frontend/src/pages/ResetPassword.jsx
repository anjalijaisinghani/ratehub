import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/api.js';
import { validatePassword } from '../utils/validate.js';
import { showSuccess, showError } from '../utils/alert.js';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();

  const [form, setForm] = useState({ newPassword: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [linkProblem, setLinkProblem] = useState(token ? '' : 'This reset link is incomplete.');
  const [busy, setBusy] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = {
      newPassword: validatePassword(form.newPassword),
      confirm: form.confirm === form.newPassword ? '' : 'Passwords do not match',
    };
    setErrors(newErrors);
    if (Object.values(newErrors).some((m) => m)) return;

    setBusy(true);
    try {
      const res = await api.post('/auth/reset-password', { token, newPassword: form.newPassword });
      await showSuccess('Password reset!', res.data.message);
      navigate('/login');
    } catch (err) {
      const data = err.response?.data;
      if (['INVALID_TOKEN', 'TOKEN_USED', 'TOKEN_EXPIRED'].includes(data?.code)) {
        setLinkProblem(data.message); // the link is dead: offer a new one
      } else {
        showError(data?.message || 'Could not connect to server');
      }
    } finally {
      setBusy(false);
    }
  };

  if (linkProblem) {
    return (
      <div className="card auth-card center">
        <div className="big-icon">⚠️</div>
        <h2>Link problem</h2>
        <p className="muted">{linkProblem}</p>
        <Link className="btn" to="/forgot-password">Request a new link</Link>
      </div>
    );
  }

  return (
    <div className="card auth-card">
      <h2>Choose a new password</h2>
      <form onSubmit={handleSubmit}>
        <label>New Password (8 to 16 chars, 1 uppercase, 1 special)</label>
        <input type="password" name="newPassword" value={form.newPassword} onChange={handleChange} />
        {errors.newPassword && <p className="error">{errors.newPassword}</p>}

        <label>Confirm New Password</label>
        <input type="password" name="confirm" value={form.confirm} onChange={handleChange} />
        {errors.confirm && <p className="error">{errors.confirm}</p>}

        <button type="submit" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Saving...' : 'Reset password'}
        </button>
      </form>
    </div>
  );
}