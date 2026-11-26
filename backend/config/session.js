const session = require('express-session');

const sessionConfig = session({
  secret: process.env.SESSION_SECRET || 'studysync_dev_secret_2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    sameSite: 'lax'
  }
});

module.exports = sessionConfig;
