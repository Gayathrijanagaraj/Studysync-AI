/**
 * Centralized API error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error(`[Error] ${req.method} ${req.url}:`, err.message || err);

  let statusCode = err.statusCode || 500;
  let message = err.message || 'An unexpected internal server error occurred.';

  // Handle Mongoose Validation Errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const firstKey = Object.keys(err.errors || {})[0];
    message = firstKey ? err.errors[firstKey].message : 'Validation error occurred.';
  }

  // Handle Mongoose CastError (e.g. invalid ObjectId format)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ID format for ${err.path}: ${err.value}`;
  }

  // Handle Mongo Duplicate Key Error (E11000)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate value for ${field}. Please use a unique value.`;
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors: err.errors || []
  });
};

module.exports = errorHandler;
