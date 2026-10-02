import axios from 'axios';

// All requests go to our backend
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
});

// Before every request, attach the token (if the user is logged in)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If the server says "401" (token expired/invalid), log the user out.
// We skip the login request itself, because a wrong password also gives 401.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;