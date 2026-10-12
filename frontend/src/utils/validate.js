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


// ----- Store fields (all optional) -----
export const validatePhone = (v) =>
  !v.trim() || /^[0-9+()\-\s]{7,20}$/.test(v.trim()) ? '' : 'Phone must be 7 to 20 characters: digits, spaces, + ( ) -';

export const validatePincode = (v) =>
  !v.trim() || /^[A-Za-z0-9 -]{3,10}$/.test(v.trim()) ? '' : 'Pincode must be 3 to 10 letters or digits';

export const validateUrl = (v) => {
  if (!v.trim()) return '';
  try {
    const u = new URL(v.trim());
    return ['http:', 'https:'].includes(u.protocol) ? '' : 'Link must start with http:// or https://';
  } catch {
    return 'Enter a valid link starting with http:// or https://';
  }
};

const validateRange = (label, min, max) => (v) => {
  if (!v.trim()) return '';
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? '' : `${label} must be a number between ${min} and ${max}`;
};
export const validateLatitude = validateRange('Latitude', -90, 90);
export const validateLongitude = validateRange('Longitude', -180, 180);

export const validateMaxLength = (label, max) => (v) =>
  v.length > max ? `${label} must be at most ${max} characters` : '';



// ----- Reviews -----
// [...text] counts real characters (an emoji is 1), exactly like the server does
export const validateReviewText = (v) => {
  const length = [...v.trim()].length;
  if (length < 10) return 'Review must be at least 10 characters';
  if (length > 1000) return 'Review must be at most 1000 characters';
  return '';
};