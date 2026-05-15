/**
 * middleware/validate.js — Centralized Input Validation Middleware
 * ──────────────────────────────────────────────────────────────────────
 * Why centralized validation:
 *   Instead of scattering validation logic across each controller, we define
 *   reusable validation schemas that run as Express middleware. This follows
 *   the "Fail Fast" principle — invalid requests are rejected before they
 *   reach the service layer, reducing wasted computation and preventing
 *   malformed data from touching the database.
 *
 * Password Standard:
 *   Enforces the same "Strong Format" as the frontend PasswordStrength component:
 *   ≥8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special character.
 *   This ensures backend-frontend parity — even if a client bypasses the UI,
 *   the server still enforces security.
 */

/**
 * Validates that a password meets the professional "Strong Format" standard.
 * Returns null if valid, or an error message string if invalid.
 *
 * @param {string} password
 * @returns {string|null}
 */
function validatePasswordStrength(password) {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter.';
  }
  if (!/\d/.test(password)) {
    return 'Password must contain at least one digit.';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must contain at least one special character.';
  }
  return null;
}

/**
 * Express middleware factory: validates request body fields.
 *
 * @param {Object} rules - Map of field names to validation functions.
 *   Each function receives the field value and returns null (valid)
 *   or an error message string (invalid).
 * @returns {Function} Express middleware
 *
 * Usage:
 *   router.post('/signup', validate({
 *     password: (v) => validatePasswordStrength(v),
 *     firstName: (v) => v?.trim() ? null : 'First name is required.',
 *   }), controller.signup);
 */
function validate(rules) {
  return (req, res, next) => {
    const errors = [];
    for (const [field, check] of Object.entries(rules)) {
      const error = check(req.body[field]);
      if (error) {
        errors.push({ field, message: error });
      }
    }
    if (errors.length > 0) {
      return res.status(400).json({
        message: 'Validation failed.',
        errors,
      });
    }
    next();
  };
}

/**
 * Common validators for reuse across modules.
 */
const validators = {
  required: (fieldName) => (value) =>
    value !== undefined && value !== null && String(value).trim() !== ''
      ? null
      : `${fieldName} is required.`,

  phone: (value) => {
    if (!value) return 'Phone number is required.';
    const digits = String(value).replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15
      ? null
      : 'Phone number must be 10-15 digits.';
  },

  password: validatePasswordStrength,

  enum: (fieldName, allowed) => (value) =>
    allowed.includes(value)
      ? null
      : `${fieldName} must be one of: ${allowed.join(', ')}.`,

  maxLength: (fieldName, max) => (value) =>
    !value || String(value).length <= max
      ? null
      : `${fieldName} must be at most ${max} characters.`,

  optional: () => () => null, // No validation, always passes
};

module.exports = {
  validate,
  validators,
  validatePasswordStrength,
};
