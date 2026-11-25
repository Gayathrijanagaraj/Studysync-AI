const bcrypt = require('bcryptjs');
const User = require('../models/User');

/**
 * Auth Controller
 */

// POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, confirmPassword, institution, department, termsAccepted } = req.body;

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Full name is required.' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'College email is required.' });
    }
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
    }
    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists. Please log in.'
      });
    }

    // Hash password with bcrypt
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user record
    const newUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      institution: institution ? institution.trim() : '',
      department: department ? department.trim() : '',
      role: 'student'
    });

    // Auto-login: establish session
    req.session.user = newUser.toSafeObject();

    return res.status(201).json({
      success: true,
      message: 'Account created successfully! Welcome to StudySync AI.',
      data: {
        user: newUser.toSafeObject()
      }
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    // Use generic error message for security
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support or admin.'
      });
    }

    // Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Establish session
    req.session.user = user.toSafeObject();

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      data: {
        user: user.toSafeObject()
      }
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/logout
exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('[Session Logout Error]:', err);
      return res.status(500).json({
        success: false,
        message: 'Could not log out. Please try again.'
      });
    }
    res.clearCookie('connect.sid');
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.'
    });
  });
};

// GET /api/auth/me
exports.getMe = (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated.'
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      user: req.session.user
    }
  });
};

// POST /api/auth/forgot-password
exports.forgotPassword = (req, res) => {
  // PRD FR-AUTH-08: If email delivery is not configured, show clear development limitation
  return res.status(200).json({
    success: true,
    message: 'Password reset email service is currently in development mode. Please contact your workspace administrator or team guide to reset credentials.'
  });
};
