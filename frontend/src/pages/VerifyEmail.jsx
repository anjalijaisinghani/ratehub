import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/api.js';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token');

  const [state, setState] = useState(token ? 'loading' : 'error');
  const [message, setMessage] = useState(token ? '' : 'This verification link is incomplete.');
  const started = useRef(false); // the link must be used only ONCE, even if React runs this effect twice

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;

    api
      .post('/auth/verify-email', { token })
      .then((res) => {
        setState('success');
        setMessage(res.data.message);
      })
      .catch((err) => {
        setState('error');
        setMessage(err.response?.data?.message || 'Could not connect to the server.');
      });
  }, [token]);

  return (
    <div className="card auth-card center">
      {state === 'loading' && <p className="muted">Verifying your email...</p>}

      {state === 'success' && (
        <>
          <div className="big-icon">✅</div>
          <h2>Email verified!</h2>
          <p className="muted">{message}</p>
          <Link className="btn" to="/login">Go to Login</Link>
        </>
      )}

      {state === 'error' && (
        <>
          <div className="big-icon">⚠️</div>
          <h2>Could not verify</h2>
          <p className="muted">{message}</p>
          <p className="muted">
            Already verified? Just log in. Otherwise, try to log in and we will offer to send you a new link.
          </p>
          <Link className="btn" to="/login">Go to Login</Link>
        </>
      )}
    </div>
  );
}