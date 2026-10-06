// Wraps an async controller so any error is passed to the global error handler.
// Without this, every controller would need its own try/catch.
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;