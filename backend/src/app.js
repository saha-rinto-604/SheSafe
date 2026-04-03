const express = require('express');
const cors = require('cors');
const authRoutes = require('./modules/auth/auth.routes');
const locationRoutes = require('./modules/locations/location.routes');
const incidentRoutes = require('./modules/incidents/incident.routes');
const medicalRoutes = require('./modules/medical/medical.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.status(200).json({ ok: true, message: 'Backend is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/medical', medicalRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((error, req, res, next) => {
  const status = error.status || 500;
  const message = error.message || 'Internal server error';
  res.status(status).json({ message });
});

module.exports = app;
