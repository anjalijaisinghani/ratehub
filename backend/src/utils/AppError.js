// An error we throw on purpose (wrong password, not found, no permission...).
// The global error handler turns it into a clean JSON response.
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = undefined) {
    super(message);
    this.statusCode = statusCode; // HTTP status, e.g. 404
    this.code = code;             // machine-readable, e.g. 'STORE_NOT_FOUND'
    this.details = details;       // optional extra info (validation errors)
    this.isOperational = true;    // marks "expected" errors, not bugs
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, code = 'BAD_REQUEST', details) {
    return new AppError(message, 400, code, details);
  }
  static unauthorized(message = 'Authentication required', code = 'UNAUTHORIZED') {
    return new AppError(message, 401, code);
  }
  static forbidden(message = 'You do not have permission to do this', code = 'FORBIDDEN') {
    return new AppError(message, 403, code);
  }
  static notFound(message = 'Resource not found', code = 'NOT_FOUND') {
    return new AppError(message, 404, code);
  }
  static conflict(message, code = 'CONFLICT') {
    return new AppError(message, 409, code);
  }
}

module.exports = AppError;