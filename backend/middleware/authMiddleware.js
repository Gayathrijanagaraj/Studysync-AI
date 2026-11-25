/**
 * Authentication & Access Control Middleware
 */

// Helper to detect if request is destined for an API endpoint
function isApiRequest(req) {
  return (
    (req.originalUrl && req.originalUrl.startsWith('/api/')) ||
    (req.baseUrl && req.baseUrl.startsWith('/api/')) ||
    (req.path && req.path.startsWith('/api/'))
  );
}

// Ensure student is logged in
const ensureAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  
  if (isApiRequest(req)) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized. Please log in to continue.'
    });
  }
  return res.redirect('/pages/login.html');
};

// Ensure guest (not logged in) - redirect to dashboard if already authenticated
const ensureGuest = (req, res, next) => {
  if (req.session && req.session.user) {
    if (isApiRequest(req)) {
      return res.status(400).json({
        success: false,
        message: 'Already authenticated.'
      });
    }
    return res.redirect('/pages/dashboard.html');
  }
  return next();
};

// Ensure user has admin role
const ensureAdmin = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  
  if (isApiRequest(req)) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden. Administrator access required.'
    });
  }
  return res.redirect('/pages/dashboard.html');
};

module.exports = { ensureAuth, ensureGuest, ensureAdmin };
