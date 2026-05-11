const { query } = require('../../config/db');

async function getMedicalProviders() {
    return query("SELECT id, provider_type as type, name, latitude, longitude, rating, affiliation, booking_url as bookingUrl, address, contact_number as contactNumber, shift, specialty, ambulance_type as ambulanceType, is_delivery_available as isDeliveryAvailable, eta, degree, hospital_affiliation as hospitalAffiliation, safe_route_verified as safeRouteVerified FROM medical_providers ORDER BY created_at DESC");
}

module.exports = {
    getMedicalProviders
};
