// A positive whole number, or null (so "abc" never reaches the database)
const parseId = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : null;
};

module.exports = { parseId };