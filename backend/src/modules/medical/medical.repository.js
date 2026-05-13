const { query } = require('../../config/db');

async function getMedicalProviders(category) {
    const base = "SELECT id, provider_type as type, name, latitude, longitude, rating, affiliation, booking_url as bookingUrl, address, contact_number as contactNumber, shift, specialty, ambulance_type as ambulanceType, is_delivery_available as isDeliveryAvailable, eta, degree, hospital_affiliation as hospitalAffiliation, safe_route_verified as safeRouteVerified FROM medical_providers";

    if (category && category !== 'others') {
        return query(base + " WHERE provider_type = ? ORDER BY created_at DESC", [category]);
    }
    if (category === 'others') {
        // 'others' includes both 'others' and 'diagnostics' provider types
        return query(base + " WHERE provider_type IN ('others', 'diagnostics') ORDER BY created_at DESC");
    }
    return query(base + " ORDER BY created_at DESC");
}

module.exports = {
    getMedicalProviders
};
