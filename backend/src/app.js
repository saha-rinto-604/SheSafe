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
const env = require('./config/env');

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
const volunteerRoutes       = require('./modules/volunteers/volunteer.routes');
const userChatRoutes        = require('./modules/users/user-chat.routes');

const app = express();

// ── Global middleware ────────────────────────────────────────────────────────
if (env.trustProxy) {
  app.set('trust proxy', 1);
}

const allowAllCorsOrigins = env.corsOrigins.includes('*');
const corsOptions = {
  // Public tunnel testing can use CORS_ORIGIN=*. Production should restrict this
  // to the deployed app origins or the current testing tunnel.
  origin: allowAllCorsOrigins
    ? '*'
    : (origin, callback) => {
        if (!origin || env.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
  credentials: !allowAllCorsOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' })); // Increased for Base64 payloads if needed
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const requestBaseUrl = `${req.protocol}://${req.get('host')}`;
  res.status(200).json({
    ok: true,
    status: 'healthy',
    service: 'resqher-backend',
    baseUrl: env.baseUrl || requestBaseUrl,
    timestamp: new Date().toISOString(),
  });
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
app.use('/api/volunteer', volunteerRoutes);
app.use('/api/user', userChatRoutes);

// ── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// ── Global error handler ─────────────────────────────────────────────────────
app.use((error, req, res, next) => {
  const status = error.status || 500;
  const isServerError = status >= 500;
  const message = isServerError ? 'Internal server error' : (error.message || 'Request failed');
  console.error(`[ERROR] ${status} ${req.method} ${req.path}:`, error.message || message);
  res.status(status).json({
    message,
    ...(!isServerError && error.code ? { code: error.code } : {}),
    ...(!isServerError && error.maxResponders ? { maxResponders: error.maxResponders } : {}),
  });
});

module.exports = app;
