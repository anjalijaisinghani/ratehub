// Copies only the listed fields. Anything else the client sent is ignored (no mass assignment).
const pick = (source, keys) =>
  Object.fromEntries(
    keys
      .filter((k) => source && Object.prototype.hasOwnProperty.call(source, k))
      .map((k) => [k, source[k]])
  );

module.exports = { pick };