const { getVolunteerEligibility } = require('../modules/volunteers/volunteerEligibility');

async function requireApprovedVolunteer(req, res, next) {
  try {
    const { approved } = await getVolunteerEligibility(req.user?.id);
    if (!approved) {
      res.status(403).json({
        message: 'Volunteer verification is required before responding to SOS requests.',
        code: 'VOLUNTEER_NOT_VERIFIED',
      });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { requireApprovedVolunteer };
