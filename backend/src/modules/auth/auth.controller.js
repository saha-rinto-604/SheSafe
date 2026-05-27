const authService = require('./auth.service');

async function signup(req, res, next) {
  try {
    const result = await authService.signup(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function adminLogin(req, res, next) {
  try {
    const result = await authService.adminLogin(req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function getRoles(req, res, next) {
  try {
    const roles = await authService.getRoles();
    res.status(200).json({ roles });
  } catch (error) {
    next(error);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const result = await authService.requestOtp(req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function resetPassword(req, res, next) {
  try {
    const result = await authService.resetPassword(req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/change-password — Change password for authenticated user.
 * Requires JWT + current password confirmation.
 */
async function changePassword(req, res, next) {
  try {
    const result = await authService.changePassword({
      userId: req.user.id,
      currentPassword: req.body.currentPassword,
      newPassword: req.body.newPassword,
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  signup,
  login,
  adminLogin,
  getRoles,
  forgotPassword,
  resetPassword,
  changePassword,
};
