/**
 * user.controller.js — User Profile HTTP Handlers
 * ──────────────────────────────────────────────────────────────────────
 * Controller Responsibility:
 *   - Parse HTTP requests (req.body, req.file, req.user)
 *   - Delegate to the Service layer
 *   - Format HTTP responses (status codes, JSON shape)
 *   - Handle errors with consistent JSON error responses
 *
 * The Controller does NOT contain business logic or SQL.
 */

const userService = require('./user.service');

/**
 * GET /api/users/me — Get the authenticated user's full profile.
 *
 * Why /me instead of /:id:
 *   The user ID comes from the JWT token, not the URL. This prevents
 *   users from accessing other users' profiles by guessing IDs (IDOR attack).
 */
async function getProfile(req, res) {
  try {
    const profile = await userService.getProfile(req.user.id);
    res.json({ user: profile });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ message: err.message });
  }
}

/**
 * PATCH /api/users/me — Update profile fields.
 * Accepts JSON body with any subset of profile fields.
 *
 * Returns the full updated user object so the frontend can
 * synchronize its global state immediately without a second GET.
 */
async function updateProfile(req, res) {
  try {
    console.log('[USER_CTRL] PATCH /me body:', JSON.stringify(req.body));
    const updated = await userService.updateProfile(req.user.id, req.body);
    res.json({ user: updated });
  } catch (err) {
    const status = err.status || 500;
    console.error('[USER_CTRL] PATCH /me error:', err.message);
    res.status(status).json({ message: err.message });
  }
}

/**
 * POST /api/users/me/photo — Upload profile photo.
 * Expects multipart/form-data with a 'photo' field.
 *
 * Returns the full updated user with the new photo_url so the
 * frontend can update all avatar instances (Drawer, Header, Profile)
 * in a single state update.
 */
async function uploadPhoto(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided.' });
    }
    const updated = await userService.uploadPhoto(req.user.id, req.file.buffer);
    res.json({ user: updated });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ message: err.message });
  }
}

/**
 * DELETE /api/users/me/photo — Remove profile photo.
 */
async function removePhoto(req, res) {
  try {
    const updated = await userService.removePhoto(req.user.id);
    res.json({ user: updated });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ message: err.message });
  }
}

module.exports = {
  getProfile,
  updateProfile,
  uploadPhoto,
  removePhoto,
};
