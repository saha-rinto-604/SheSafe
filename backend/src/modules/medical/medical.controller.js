const medicalService = require('./medical.service');

async function getProviders(req, res, next) {
    try {
        const { category } = req.query;
        const providers = await medicalService.getAllProviders(category || null);
        res.status(200).json({ providers });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getProviders
};
