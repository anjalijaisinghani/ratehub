// Each function returns an error message, or '' if the value is valid

export const validateName = (v) =>
  v.trim().length < 20 || v.trim().length > 60
    ? 'Name must be between 20 and 60 characters'
    : '';

export const validateEmail = (v) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'Enter a valid email address';

export const validateAddress = (v) => {
  if (!v.trim()) return 'Address is required';
  if (v.trim().length > 400) return 'Address must be at most 400 characters';
  return '';
};

export const validatePassword = (v) => {
  if (v.length < 8 || v.length > 16) return 'Password must be 8 to 16 characters';
  if (!/[A-Z]/.test(v)) return 'Password must contain at least one uppercase letter';
  if (!/[^A-Za-z0-9]/.test(v)) return 'Password must contain at least one special character';
  return '';
};