const { getMedicalProviders } = require('./medical.repository');

async function getAllProviders() {
    return getMedicalProviders();
}

module.exports = {
    getAllProviders
};
