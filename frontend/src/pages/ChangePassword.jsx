import { useState } from 'react';
import api from '../api/api.js';
import { useAuth } from '../api/AuthContext.jsx';
import { validatePassword } from '../utils/validate.js';
import { showSuccess, showError, confirmAction, toast } from '../utils/alert.js';

export default function ChangePassword() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const { logoutAll } = useAuth();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = {
      currentPassword: form.currentPassword ? '' : 'Current password is required',
      newPassword: validatePassword(form.newPassword),
      confirm: form.confirm === form.newPassword ? '' : 'Passwords do not match',
    };
    setErrors(newErrors);
    if (Object.values(newErrors).some((m) => m)) return;

    try {
      const res = await api.put('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      showSuccess('Done!', `${res.data.message}. Your other devices were logged out.`);
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      showError(err.response?.data?.message || 'Could not connect to server');
    }
  };

  const handleLogoutAll = async () => {
    const yes = await confirmAction(
      'Log out everywhere?',
      'Every device, including this one, will be logged out.',
      'Yes, log out everywhere'
    );
    if (!yes) return;
    try {
      await logoutAll();
      toast('Logged out from all devices');
    } catch (err) {
      showError(err.response?.data?.message || 'Could not log out');
    }
  };

  return (
    <div className="card auth-card">
      <h2>Change Password</h2>
      <form onSubmit={handleSubmit}>
        <label>Current Password</label>
        <input type="password" name="currentPassword" value={form.currentPassword} onChange={handleChange} />
        {errors.currentPassword && <p className="error">{errors.currentPassword}</p>}

        <label>New Password (8 to 16 chars, 1 uppercase, 1 special)</label>
        <input type="password" name="newPassword" value={form.newPassword} onChange={handleChange} />
        {errors.newPassword && <p className="error">{errors.newPassword}</p>}

        <label>Confirm New Password</label>
        <input type="password" name="confirm" value={form.confirm} onChange={handleChange} />
        {errors.confirm && <p className="error">{errors.confirm}</p>}

        <button type="submit">Update Password</button>
      </form>

      <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid var(--border)' }} />
      <h3>Devices</h3>
      <p className="muted">Think someone else has access to your account? End every session.</p>
      <button type="button" className="danger" onClick={handleLogoutAll} style={{ marginTop: 4 }}>
        Log out from all devices
      </button>
    </div>
  );
}