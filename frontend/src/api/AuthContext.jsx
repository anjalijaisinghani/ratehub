import { createContext, useContext, useEffect, useState } from 'react';
import api, { refreshSession, SESSION_EXPIRED_EVENT } from './api.js';
import { setAccessToken } from './tokenStore.js';
import { toast } from '../utils/alert.js';

const AuthContext = createContext(null);

// A harmless "this browser has logged in before" marker. It is NOT a secret.
// It lets first-time visitors skip the silent refresh call (so no 401 in the console).
const SESSION_FLAG = 'ratehub_has_session';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true while we check for an existing session

  // On page load: if we logged in before, ask the server for a fresh access token
  useEffect(() => {
    // Remove leftovers from the old version of the app
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    if (localStorage.getItem(SESSION_FLAG) !== '1') {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    refreshSession()
      .then((data) => {
        if (!cancelled) setUser(data.user);
      })
      .catch((err) => {
        // Only forget the session if the server said "no" (not when the server is just offline)
        if (err.response?.status === 401) localStorage.removeItem(SESSION_FLAG);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // api.js announces this when a refresh fails mid-session
  useEffect(() => {
    const onExpired = () => {
      localStorage.removeItem(SESSION_FLAG);
      setUser(null);
      toast('Your session expired. Please log in again.', 'info');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const login = (accessToken, userData) => {
    setAccessToken(accessToken);
    localStorage.setItem(SESSION_FLAG, '1');
    setUser(userData);
  };

  const clearSession = () => {
    setAccessToken(null);
    localStorage.removeItem(SESSION_FLAG);
    setUser(null);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout'); // revokes this device's session on the server
    } catch {
      // even if the server is unreachable, log out locally
    }
    clearSession();
  };

  const logoutAll = async () => {
    await api.post('/auth/logout-all'); // revokes every device's session
    clearSession();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, logoutAll }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);