/**
 * user.routes.js — User Profile API Routes
 * ──────────────────────────────────────────────────────────────────────
 * All routes are protected by the authenticate middleware.
 * The /me endpoint pattern ensures users can only access their own data.
 */

const router = require('express').Router();
const { authenticate } = require('../../middleware/authenticate');
const { requireActiveAccount } = require('../../middleware/accountStatus');
const upload = require('../../middleware/upload');
const userController = require('./user.controller');

// All user routes require authentication
router.use(authenticate);

/**
 * GET /api/users/me — Fetch authenticated user's profile
 * Returns: { user: { id, role, firstName, lastName, phoneNumber, photoUrl, ... } }
 */
router.get('/me', userController.getProfile);

/**
 * PATCH /api/users/me — Update profile fields (JSON body)
 * Body: { firstName?, lastName?, dobISO?, gender?, bloodGroup?, medicalInfo?, homeAddress? }
 * Returns: { user: <full updated profile> }
 */
router.patch('/me', requireActiveAccount, userController.updateProfile);

/**
 * POST /api/users/me/photo — Upload profile photo (multipart/form-data)
 * Field: 'photo' — single image file (JPEG, PNG, WebP, HEIC; max 5MB)
 * Returns: { user: <full updated profile with new photoUrl> }
 */
router.post('/me/photo', requireActiveAccount, upload.single('photo'), userController.uploadPhoto);

/**
 * DELETE /api/users/me/photo — Remove profile photo
 * Returns: { user: <profile with photoUrl: ''> }
 */
router.delete('/me/photo', requireActiveAccount, userController.removePhoto);

module.exports = router;
