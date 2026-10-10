const AppError = require('./AppError');
const { STORE_CATEGORIES } = require('../constants/storeCategories');

const text = (v) => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t; // empty text is stored as NULL
};

const number = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Cleans the optional store fields and applies the "both or neither" rules.
// Used when an admin creates or edits a store.
const normalizeStoreInput = (input = {}) => {
  const category = (text(input.category) || 'OTHER').toUpperCase();
  if (!STORE_CATEGORIES.includes(category)) {
    throw AppError.badRequest('Invalid category', 'INVALID_CATEGORY');
  }

  const profile = {
    category,
    description: text(input.description),
    phone: text(input.phone),
    city: text(input.city),
    state: text(input.state),
    pincode: text(input.pincode),
    website: text(input.website),
    imageUrl: text(input.imageUrl),
    latitude: number(input.latitude),
    longitude: number(input.longitude),
    openingTime: text(input.openingTime),
    closingTime: text(input.closingTime),
  };

  if ((profile.openingTime === null) !== (profile.closingTime === null)) {
    throw AppError.badRequest('Provide both opening and closing time, or neither', 'INVALID_HOURS');
  }
  if ((profile.latitude === null) !== (profile.longitude === null)) {
    throw AppError.badRequest('Provide both latitude and longitude, or neither', 'INVALID_COORDINATES');
  }
  return profile;
};

module.exports = { normalizeStoreInput };