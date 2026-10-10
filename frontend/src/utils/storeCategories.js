export const CATEGORIES = [
  { value: 'RESTAURANT', label: 'Restaurant', icon: '🍽️' },
  { value: 'CAFE', label: 'Cafe', icon: '☕' },
  { value: 'GROCERY', label: 'Grocery', icon: '🛒' },
  { value: 'ELECTRONICS', label: 'Electronics', icon: '🔌' },
  { value: 'CLOTHING', label: 'Clothing', icon: '👕' },
  { value: 'SALON', label: 'Salon', icon: '💇' },
  { value: 'FITNESS', label: 'Fitness', icon: '🏋️' },
  { value: 'PHARMACY', label: 'Pharmacy', icon: '💊' },
  { value: 'BOOKSTORE', label: 'Bookstore', icon: '📚' },
  { value: 'OTHER', label: 'Other', icon: '🏪' },
];

export const categoryOf = (value) =>
  CATEGORIES.find((c) => c.value === value) || CATEGORIES[CATEGORIES.length - 1];

// Only http/https links are ever put into an <img src> or <a href> (blocks "javascript:" links)
export const safeUrl = (url) => {
  try {
    const u = new URL(url);
    return ['http:', 'https:'].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
};