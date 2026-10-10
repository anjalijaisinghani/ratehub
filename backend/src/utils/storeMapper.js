// Database rows -> JSON for the API. DECIMAL columns arrive as text, TIME as "HH:MM:SS".
const num = (v) => (v === null || v === undefined ? null : Number(v));
const hhmm = (t) => (t ? String(t).slice(0, 5) : null);
const toBool = (v) => (v === null || v === undefined ? null : Number(v) === 1);

const baseProfile = (r) => ({
  id: r.id,
  name: r.name,
  address: r.address,
  city: r.city,
  state: r.state,
  pincode: r.pincode,
  category: r.category,
  description: r.description,
  phone: r.phone,
  website: r.website,
  imageUrl: r.imageUrl,
  latitude: num(r.latitude),
  longitude: num(r.longitude),
  openingTime: hhmm(r.openingTime),
  closingTime: hhmm(r.closingTime),
});

// What a normal user sees (no store email, no status)
const toPublicStore = (r) => ({
  ...baseProfile(r),
  isOpenNow: toBool(r.isOpenNow), // null when the store has no opening hours
  overallRating: num(r.overallRating),
  ratingCount: Number(r.ratingCount),
  myRating: r.myRating ?? null,
});

// A row in the admin table
const toAdminStoreRow = (r) => ({
  ...baseProfile(r),
  email: r.email,
  status: r.status,
  rating: num(r.rating),
  ratingCount: Number(r.ratingCount),
  createdAt: r.createdAt,
});

// The admin edit page
const toAdminStoreDetails = (r) => ({
  ...baseProfile(r),
  email: r.email,
  status: r.status,
  createdAt: r.createdAt,
  ownerId: r.ownerId,
  ownerName: r.ownerName,
  ownerEmail: r.ownerEmail,
});

module.exports = { toPublicStore, toAdminStoreRow, toAdminStoreDetails };