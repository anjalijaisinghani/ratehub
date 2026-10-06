import axios from 'axios';
import { getAccessToken, setAccessToken } from './tokenStore.js';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

// withCredentials lets the browser send/receive the httpOnly refresh cookie
const api = axios.create({ baseURL, withCredentials: true });

export const SESSION_EXPIRED_EVENT = 'ratehub:session-expired';

// ---- Getting a new access token ----
// If five requests fail at once, they must share ONE refresh call. Refresh tokens work
// only once, so two parallel refreshes would look like theft. "refreshPromise" is shared.
let refreshPromise = null;

export const refreshSession = () => {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${baseURL}/auth/refresh`, null, { withCredentials: true })
      .then((res) => {
        setAccessToken(res.data.data.accessToken);
        return res.data.data; // { accessToken, user }
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

// ---- Attach the access token to every request ----
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ---- If the access token expired: refresh quietly, then repeat the request ----
const isAuthEndpoint = (url = '') => /\/auth\/(login|refresh|logout)$/.test(url);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && original && !original._retried && !isAuthEndpoint(original.url)) {
      original._retried = true; // never retry more than once
      try {
        await refreshSession();
        original.headers.Authorization = `Bearer ${getAccessToken()}`;
        return api(original);
      } catch {
        setAccessToken(null);
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT)); // AuthContext logs the user out
      }
    }
    return Promise.reject(error);
  }
);

export default api;