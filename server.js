require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const connectDB = require('./backend/config/db');
const sessionConfig = require('./backend/config/session');
const errorHandler = require('./backend/middleware/errorHandler');
const initSocketIO = require('./backend/sockets/socketHandler');

// Initialize Express App & HTTP Server
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO Real-Time Engine
const io = initSocketIO(server);
app.set('io', io);

// Connect to Database
connectDB();

// Core Middleware
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Middleware
app.use(sessionConfig);

// Serve Static Frontend Assets
app.use(express.static(path.join(__dirname, 'frontend')));

// Root Redirect: Unauthenticated users go to /pages/login.html, authenticated users go to /pages/dashboard.html
app.get('/', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect('/pages/dashboard.html');
  }
  return res.redirect('/pages/login.html');
});

// API Routes
app.use('/api/auth', require('./backend/routes/authRoutes'));
app.use('/api/rooms', require('./backend/routes/roomRoutes'));
app.use('/api/dashboard', require('./backend/routes/dashboardRoutes'));
app.use('/api/ai', require('./backend/routes/aiRoutes'));
app.use('/api/knowledge', require('./backend/routes/knowledgeRoutes'));
// Admin module removed as requested by user

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    product: 'StudySync AI',
    timestamp: new Date().toISOString()
  });
});

// 404 for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API route not found: ${req.method} ${req.baseUrl}`
  });
});

// Global Error Handler
app.use(errorHandler);

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(` StudySync AI Server running on port ${PORT}`);
  console.log(` Access URL: http://localhost:${PORT}`);
  console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`===============================================`);
});

module.exports = { app, server };
