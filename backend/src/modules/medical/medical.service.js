const { getMedicalProviders } = require('./medical.repository');

async function getAllProviders(category) {
    return getMedicalProviders(category);
}

module.exports = {
    getAllProviders
};
