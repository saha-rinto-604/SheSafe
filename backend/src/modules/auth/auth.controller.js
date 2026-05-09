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

async function getRoles(req, res, next) {
  try {
    const roles = await authService.getRoles();
    res.status(200).json({ roles });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  signup,
  login,
  getRoles,
};
