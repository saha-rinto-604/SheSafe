/**
 * app.js — Express Application Entry Point
 * ──────────────────────────────────────────────────────────────────────
 * Registers all route modules and applies global middleware.
 *
 * Route Organization:
 *   /api/auth              — Authentication (signup, login, password)
 *   /api/users             — User profile management
 *   /api/emergency-contacts — Emergency contacts CRUD
 *   /api/safety-settings   — SOS & alert configuration
 *   /api/verification      — Volunteer verification workflow
 *   /api/incidents         — Incident tracking
 *   /api/locations         — User location broadcasting
 *   /api/medical           — Medical providers
 *   /api/chat              — Chat messages
 *   /api/safe-places       — Community safe places
 */

const express = require('express');
const cors = require('cors');

// ── Route modules ────────────────────────────────────────────────────────────
const authRoutes            = require('./modules/auth/auth.routes');
const userRoutes            = require('./modules/users/user.routes');
const ecRoutes              = require('./modules/emergency-contacts/ec.routes');
const ssRoutes              = require('./modules/safety-settings/ss.routes');
const vfRoutes              = require('./modules/verification/vf.routes');
const locationRoutes        = require('./modules/locations/location.routes');
const incidentRoutes        = require('./modules/incidents/incident.routes');
const medicalRoutes         = require('./modules/medical/medical.routes');
const chatRoutes            = require('./modules/chat/chat.routes');
const safePlacesRoutes      = require('./modules/safe-places/safe-places.routes');

const app = express();

// ── Global middleware ────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased for Base64 payloads if needed
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.status(200).json({ ok: true, message: 'Backend is running' });
});

// ── API routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/emergency-contacts', ecRoutes);
app.use('/api/safety-settings', ssRoutes);
app.use('/api/verification', vfRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/medical', medicalRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/safe-places', safePlacesRoutes);

// ── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// ── Global error handler ─────────────────────────────────────────────────────
app.use((error, req, res, next) => {
  const status = error.status || 500;
  const message = error.message || 'Internal server error';
  console.error(`[ERROR] ${status} ${req.method} ${req.path}:`, message);
  res.status(status).json({ message });
});

module.exports = app;
