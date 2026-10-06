const AppError = require('../utils/AppError');

// Runs when no route matched
const notFoundHandler = (req, res, next) => {
  next(AppError.notFound('Route not found', 'ROUTE_NOT_FOUND'));
};

// Runs whenever next(error) is called or an error is thrown.
// It needs exactly 4 parameters, or Express won't treat it as an error handler.
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  // Translate known library errors into our own error type
  if (err.type === 'entity.parse.failed') {
    err = AppError.badRequest('Invalid JSON in request body', 'INVALID_JSON');
  } else if (err.type === 'entity.too.large') {
    err = new AppError('Request body is too large', 413, 'PAYLOAD_TOO_LARGE');
  } else if (err.code === 'ER_DUP_ENTRY') {
    err = AppError.conflict('This record already exists', 'DUPLICATE_ENTRY');
  }

  const isExpected = err instanceof AppError;

  // Unexpected errors are bugs: log them, but never show details to the client
  if (!isExpected) console.error(err);

  const body = {
    success: false,
    message: isExpected ? err.message : 'Something went wrong',
    code: isExpected ? err.code : 'INTERNAL_ERROR',
  };
  if (isExpected && err.details) body.errors = err.details;

  // Stack traces only while developing, never in production
  if (!isExpected && process.env.NODE_ENV === 'development') body.stack = err.stack;

  res.status(isExpected ? err.statusCode : 500).json(body);
};

module.exports = { notFoundHandler, errorHandler };