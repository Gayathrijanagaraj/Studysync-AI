const bcrypt = require('bcryptjs');
const User = require('../models/User');
const RoomMember = require('../models/RoomMember');
const Doubt = require('../models/Doubt');
const StudySession = require('../models/StudySession');
const KnowledgeItem = require('../models/KnowledgeItem');

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
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid college email address.' });
    }

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

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Please provide both valid email and password strings.'
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

// GET /api/auth/profile
exports.getProfile = async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.'
      });
    }

    // Aggregate student learning metrics
    const [roomsCount, doubtsCount, solvedDoubtsCount, sessionsCount, knowledgeCount] = await Promise.all([
      RoomMember.countDocuments({ userId }),
      Doubt.countDocuments({ author: userId }),
      Doubt.countDocuments({ author: userId, status: 'resolved' }),
      StudySession.countDocuments({
        $or: [{ startedBy: userId }, { endedBy: userId }],
        status: 'completed'
      }),
      KnowledgeItem.countDocuments({ userId })
    ]);

    return res.status(200).json({
      success: true,
      data: {
        user: user.toSafeObject(),
        stats: {
          roomsCount,
          doubtsCount,
          solvedDoubtsCount,
          sessionsCount,
          knowledgeCount
        }
      }
    });
  } catch (error) {
    return next(error);
  }
};

// PUT /api/auth/profile
exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const { name, institution, department, bio } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    if (name && name.trim()) user.name = name.trim();
    if (institution !== undefined) user.institution = institution.trim();
    if (department !== undefined) user.department = department.trim();
    if (bio !== undefined) user.bio = bio.trim();

    await user.save();

    // Update session user cache
    const safeUser = user.toSafeObject();
    req.session.user = safeUser;

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: {
        user: safeUser
      }
    });
  } catch (error) {
    return next(error);
  }
};

// PUT /api/auth/change-password
exports.changePassword = async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Both current password and new password are required.'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters.'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect.'
      });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully.'
    });
  } catch (error) {
    return next(error);
  }
};
