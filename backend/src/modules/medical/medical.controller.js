const medicalService = require('./medical.service');

async function getProviders(req, res, next) {
    try {
        const providers = await medicalService.getAllProviders();
        res.status(200).json({ providers });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getProviders
};
