// Must match the ENUM in migration 006 (a test checks this)
const STORE_CATEGORIES = Object.freeze([
  'RESTAURANT',
  'CAFE',
  'GROCERY',
  'ELECTRONICS',
  'CLOTHING',
  'SALON',
  'FITNESS',
  'PHARMACY',
  'BOOKSTORE',
  'OTHER',
]);

const STORE_STATUS = Object.freeze({ ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' });

module.exports = { STORE_CATEGORIES, STORE_STATUS };