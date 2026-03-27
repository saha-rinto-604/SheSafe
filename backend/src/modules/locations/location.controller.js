const locationService = require('./location.service');

async function save(req, res, next) {
  try {
    const location = await locationService.save(req.user.id, req.body);
    res.status(201).json({ location });
  } catch (error) {
    next(error);
  }
}

async function getLast(req, res, next) {
  try {
    const location = await locationService.getLast(req.user.id);
    res.status(200).json({ location });
  } catch (error) {
    next(error);
  }
}

module.exports = { save, getLast };
