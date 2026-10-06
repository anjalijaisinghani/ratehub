const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

// Turns ?sortBy=...&order=... into a SAFE column name and direction.
// "allowed" maps public names to real SQL columns, e.g. { name: 's.name' }.
// hasOwn blocks tricks like ?sortBy=constructor or ?sortBy=__proto__.
const resolveSort = (sortBy, order, allowed, defaultKey) => {
  const key = typeof sortBy === 'string' && hasOwn(allowed, sortBy) ? sortBy : defaultKey;
  const direction = typeof order === 'string' && order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  return { key, column: allowed[key], direction };
};

// Query-string values can be arrays or objects (?name[]=a). Accept plain strings only.
const cleanString = (value) => (typeof value === 'string' ? value.trim() : '');

// % and _ are wildcards in LIKE. Escape them so searching "50%" means a literal "50%".
const likePattern = (value) => `%${value.replace(/[\\%_]/g, '\\$&')}%`;

module.exports = { resolveSort, cleanString, likePattern };