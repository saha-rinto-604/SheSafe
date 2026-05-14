const { query } = require('./src/config/db');

const SPECIALISTS = [
    { id: 'doc-001', name: 'Dr. Anika Sultana', degree: 'MBBS, FCPS (Cardiology)', hospital: 'Evercare Hospital', specialty: 'Cardiologist', shift: 'morning', safeRouteVerified: true, bookingUrl: 'https://www.evercaredhaka.com/appointments', latitude: 23.8173, longitude: 90.4280, rating: 4.9, affiliation: 'Evercare Hospital Dhaka' },
    { id: 'doc-002', name: 'Dr. Rafiq Hasan', degree: 'MBBS, MD (Neurology)', hospital: 'United Hospital', specialty: 'Neurologist', shift: 'evening', safeRouteVerified: true, bookingUrl: 'https://www.uhlbd.com/appointment', latitude: 23.7926, longitude: 90.4167, rating: 4.7, affiliation: 'United Hospital Ltd.' },
    { id: 'doc-003', name: 'Dr. Tasneem Akhter', degree: 'MBBS, MS (Orthopedics)', hospital: 'Popular Diagnostic Centre', specialty: 'Orthopedic Surgeon', shift: 'now', safeRouteVerified: false, bookingUrl: 'https://www.populardiagnostic.com/appointment', latitude: 23.7465, longitude: 90.3747, rating: 4.5, affiliation: 'Popular Diagnostic Centre' },
    { id: 'doc-004', name: 'Dr. Kabir Ahmed', degree: 'MBBS, FCPS (Gynecology)', hospital: 'Evercare Hospital', specialty: 'Gynecologist', shift: 'morning', safeRouteVerified: true, bookingUrl: 'https://www.evercaredhaka.com/appointments', latitude: 23.8180, longitude: 90.4275, rating: 4.8, affiliation: 'Evercare Hospital Dhaka' },
    { id: 'doc-005', name: 'Dr. Nusrat Jahan', degree: 'MBBS, DCH (Pediatrics)', hospital: 'United Hospital', specialty: 'Pediatrician', shift: 'now', safeRouteVerified: true, bookingUrl: 'https://www.uhlbd.com/appointment', latitude: 23.7935, longitude: 90.4175, rating: 4.9, affiliation: 'United Hospital Ltd.' },
    { id: 'doc-006', name: 'Dr. Faisal Rahman', degree: 'MBBS, FCPS (Dermatology)', hospital: 'Ibn Sina Hospital', specialty: 'Dermatologist', shift: 'evening', safeRouteVerified: true, bookingUrl: 'https://www.ibnsinatrust.com/appointment', latitude: 23.7450, longitude: 90.3730, rating: 4.6, affiliation: 'Ibn Sina Trust' },
    { id: 'doc-007', name: 'Dr. Shirin Begum', degree: 'MBBS, MD (Psychiatry)', hospital: 'National Institute of Mental Health', specialty: 'Psychiatrist', shift: 'morning', safeRouteVerified: true, bookingUrl: 'https://www.nimhbd.org/', latitude: 23.7780, longitude: 90.3770, rating: 4.6, affiliation: 'NIMH Dhaka' },
    { id: 'doc-008', name: 'Dr. Mahbub Alam', degree: 'MBBS, MS (General Surgery)', hospital: 'Dhaka Medical College Hospital', specialty: 'General Surgeon', shift: 'now', safeRouteVerified: true, bookingUrl: 'https://dmch.gov.bd/', latitude: 23.7260, longitude: 90.3985, rating: 4.5, affiliation: 'DMCH' },
    { id: 'doc-009', name: 'Dr. Roksana Islam', degree: 'MBBS, FCPS (Ophthalmology)', hospital: 'Eye Care Hospital', specialty: 'Eye Specialist', shift: 'morning', safeRouteVerified: false, bookingUrl: null, latitude: 23.7612, longitude: 90.4002, rating: 4.4, affiliation: 'Eye Care BD' },
    { id: 'doc-010', name: 'Dr. Tariq Morshed', degree: 'MBBS, MD (Endocrinology)', hospital: 'BIRDEM General Hospital', specialty: 'Endocrinologist', shift: 'evening', safeRouteVerified: true, bookingUrl: 'https://www.birdem-general-hospital.com/', latitude: 23.7388, longitude: 90.3940, rating: 4.8, affiliation: 'BIRDEM Hospital' },
    { id: 'doc-011', name: 'Dr. Parvin Sultana', degree: 'MBBS, FCPS (Rheumatology)', hospital: 'Square Hospital', specialty: 'Rheumatologist', shift: 'morning', safeRouteVerified: true, bookingUrl: 'https://www.squarehospital.com/', latitude: 23.7512, longitude: 90.3815, rating: 4.7, affiliation: 'Square Hospital Ltd.' },
    { id: 'doc-012', name: 'Dr. Aminul Islam', degree: 'MBBS, DLO (ENT)', hospital: 'Mirpur ENT Centre', specialty: 'ENT Specialist', shift: 'now', safeRouteVerified: false, bookingUrl: null, latitude: 23.8040, longitude: 90.3660, rating: 4.3, affiliation: 'Mirpur ENT Centre' },
    { id: 'doc-013', name: 'Dr. Laila Anjum', degree: 'MBBS, MD (Oncology)', hospital: 'Ahsania Mission Cancer Hospital', specialty: 'Oncologist', shift: 'morning', safeRouteVerified: true, bookingUrl: 'https://ahsaniamissioncancerhospital.com/', latitude: 23.7895, longitude: 90.3780, rating: 4.9, affiliation: 'Ahsania Mission' },
    { id: 'doc-014', name: 'Dr. Zubayer Chowdhury', degree: 'MBBS, FCPS (Urology)', hospital: 'Labaid Specialized Hospital', specialty: 'Urologist', shift: 'evening', safeRouteVerified: true, bookingUrl: 'https://labaid.com.bd/', latitude: 23.7480, longitude: 90.3755, rating: 4.5, affiliation: 'Labaid Group' },
];

const HOSPITALS = [
    { id: 'hosp-001', name: 'Evercare Hospital', address: 'Plot 81, Block E, Bashundhara R/A, Dhaka', latitude: 23.8173, longitude: 90.4280, bookingUrl: 'https://www.evercaredhaka.com/appointments', safeRouteVerified: true, rating: 4.8, affiliation: 'Evercare Group' },
    { id: 'hosp-002', name: 'United Hospital', address: 'Plot 15, Road 71, Gulshan, Dhaka', latitude: 23.7926, longitude: 90.4167, bookingUrl: 'https://www.uhlbd.com/appointment', safeRouteVerified: true, rating: 4.7, affiliation: 'United Group' },
    { id: 'hosp-003', name: 'Popular Diagnostic Centre', address: 'House 16, Road 2, Dhanmondi, Dhaka', latitude: 23.7465, longitude: 90.3747, bookingUrl: 'https://www.populardiagnostic.com/appointment', safeRouteVerified: false, rating: 4.5, affiliation: 'Popular Group' },
    { id: 'hosp-004', name: 'Ibn Sina Hospital', address: 'House 48, Road 9/A, Dhanmondi, Dhaka', latitude: 23.7450, longitude: 90.3730, bookingUrl: 'https://www.ibnsinatrust.com/appointment', safeRouteVerified: true, rating: 4.6, affiliation: 'Ibn Sina Trust' },
    { id: 'hosp-005', name: 'Dhaka Medical College Hospital', address: 'Bakshibazar, Dhaka 1000', latitude: 23.7260, longitude: 90.3985, bookingUrl: 'https://dmch.gov.bd/', safeRouteVerified: true, rating: 4.4, affiliation: 'Government' },
    { id: 'hosp-006', name: 'Square Hospital', address: 'West Panthapath, Dhaka', latitude: 23.7512, longitude: 90.3815, bookingUrl: 'https://www.squarehospital.com/', safeRouteVerified: true, rating: 4.7, affiliation: 'Square Group' },
    { id: 'hosp-007', name: 'Labaid Specialized Hospital', address: 'House 1, Road 4, Dhanmondi, Dhaka', latitude: 23.7480, longitude: 90.3755, bookingUrl: 'https://labaid.com.bd/', safeRouteVerified: true, rating: 4.5, affiliation: 'Labaid Group' },
    { id: 'hosp-008', name: 'BIRDEM General Hospital', address: 'Shahbag, Dhaka', latitude: 23.7388, longitude: 90.3940, bookingUrl: 'https://www.birdem-general-hospital.com/', safeRouteVerified: true, rating: 4.6, affiliation: 'BIRDEM' },
    { id: 'hosp-009', name: 'Mugda Medical College Hospital', address: 'Mugda, Dhaka', latitude: 23.7334, longitude: 90.4310, bookingUrl: null, safeRouteVerified: false, rating: 4.1, affiliation: 'Government' },
    { id: 'hosp-010', name: 'Shaheed Suhrawardy Medical College Hospital', address: 'Sher-E-Bangla Nagar, Dhaka', latitude: 23.7770, longitude: 90.3755, bookingUrl: null, safeRouteVerified: true, rating: 4.3, affiliation: 'Government' },
];

const AMBULANCES = [
    { id: 'amb-001', providerName: 'Evercare Ambulance', type: 'icu_ccu', contactNumber: '+880-1711-000001', eta: '8 min', safeRouteVerified: true, latitude: 23.8165, longitude: 90.4270, rating: 4.9, affiliation: 'Evercare Hospital' },
    { id: 'amb-002', providerName: 'United Rapid Response', type: 'ac', contactNumber: '+880-1711-000002', eta: '12 min', safeRouteVerified: true, latitude: 23.7940, longitude: 90.4160, rating: 4.7, affiliation: 'United Hospital' },
    { id: 'amb-003', providerName: 'Red Crescent Ambulance', type: 'standard', contactNumber: '+880-1711-000003', eta: '15 min', safeRouteVerified: false, latitude: 23.8100, longitude: 90.4220, rating: 4.3, affiliation: 'Bangladesh Red Crescent' },
    { id: 'amb-004', providerName: 'Bashundhara Medical', type: 'standard', contactNumber: '+880-1711-000004', eta: '10 min', safeRouteVerified: true, latitude: 23.8120, longitude: 90.4240, rating: 4.4, affiliation: 'Bashundhara Group' },
    { id: 'amb-005', providerName: 'Praava Health ICU', type: 'icu_ccu', contactNumber: '+880-1711-000005', eta: '18 min', safeRouteVerified: true, latitude: 23.7950, longitude: 90.4030, rating: 4.8, affiliation: 'Praava Health' },
    { id: 'amb-006', providerName: 'DMCH Emergency Ambulance', type: 'standard', contactNumber: '+880-1711-000006', eta: '20 min', safeRouteVerified: true, latitude: 23.7265, longitude: 90.3990, rating: 4.2, affiliation: 'Dhaka Medical College' },
    { id: 'amb-007', providerName: 'Square Hospital Ambulance', type: 'ac', contactNumber: '+880-1711-000007', eta: '14 min', safeRouteVerified: true, latitude: 23.7508, longitude: 90.3820, rating: 4.6, affiliation: 'Square Hospital' },
    { id: 'amb-008', providerName: 'Ibn Sina ICU Ambulance', type: 'icu_ccu', contactNumber: '+880-1711-000008', eta: '11 min', safeRouteVerified: true, latitude: 23.7455, longitude: 90.3738, rating: 4.7, affiliation: 'Ibn Sina Trust' },
    { id: 'amb-009', providerName: 'Mirpur Fire & Rescue EMS', type: 'standard', contactNumber: '+880-1711-000009', eta: '22 min', safeRouteVerified: false, latitude: 23.8060, longitude: 90.3690, rating: 4.0, affiliation: 'Fire Service BD' },
    { id: 'amb-010', providerName: 'Gulshan Emergency Care', type: 'ac', contactNumber: '+880-1711-000010', eta: '9 min', safeRouteVerified: true, latitude: 23.7840, longitude: 90.4120, rating: 4.5, affiliation: 'Gulshan Clinic' },
];

const DIAGNOSTICS = [
    { id: 'diag-001', name: 'Popular Diagnostic Centre', address: 'Bashundhara R/A Branch, Dhaka', bookingUrl: 'https://www.populardiagnostic.com/', safeRouteVerified: true, latitude: 23.8130, longitude: 90.4255, rating: 4.6, affiliation: 'Popular Group' },
    { id: 'diag-002', name: 'Ibn Sina Diagnostic', address: 'Gulshan Branch, Dhaka', bookingUrl: 'https://www.ibnsinatrust.com/', safeRouteVerified: true, latitude: 23.7900, longitude: 90.4140, rating: 4.5, affiliation: 'Ibn Sina Trust' },
    { id: 'diag-003', name: 'Praava Health Lab', address: 'Banani, Dhaka', bookingUrl: 'https://praavahealth.com/', safeRouteVerified: false, latitude: 23.7945, longitude: 90.4035, rating: 4.7, affiliation: 'Praava Health' }
];

const PHARMACIES = [
    { id: 'pharm-001', name: 'Lazz Pharma', address: 'Bashundhara R/A, Dhaka', isDeliveryAvailable: true, contactNumber: '+880-1711-100001', safeRouteVerified: true, latitude: 23.8140, longitude: 90.4260, rating: 4.5, affiliation: 'Lazz Group' },
    { id: 'pharm-002', name: 'ACME Pharmacy', address: 'Gulshan 2, Dhaka', isDeliveryAvailable: true, contactNumber: '+880-1711-100002', safeRouteVerified: true, latitude: 23.7920, longitude: 90.4150, rating: 4.4, affiliation: 'ACME Laboratories' },
    { id: 'pharm-003', name: 'Model Pharmacy', address: 'Vatara, Dhaka', isDeliveryAvailable: false, contactNumber: '+880-1711-100003', safeRouteVerified: false, latitude: 23.8090, longitude: 90.4190, rating: 4.2, affiliation: 'Independent' }
];

const OTHERS = [
    { id: 'oth-001', name: 'Quantum Blood Bank', address: 'Bashundhara R/A, Dhaka', contactNumber: '+880-1711-200001', bookingUrl: null, safeRouteVerified: true, latitude: 23.8145, longitude: 90.4265, rating: 4.7, affiliation: 'Quantum Foundation', subCategory: 'Blood Bank' },
    { id: 'oth-002', name: 'Medinova Diagnostic Centre', address: 'Gulshan 2, Dhaka', contactNumber: '+880-1711-200002', bookingUrl: 'https://www.medinova.com.bd/', safeRouteVerified: true, latitude: 23.7930, longitude: 90.4160, rating: 4.6, affiliation: 'Medinova Group', subCategory: 'Diagnostics' },
    { id: 'oth-003', name: 'National Mental Health Institute', address: 'Sher-E-Bangla Nagar, Dhaka', contactNumber: '+880-2-9144270', bookingUrl: 'https://www.nmhibd.org/', safeRouteVerified: true, latitude: 23.7775, longitude: 90.3768, rating: 4.4, affiliation: 'Government', subCategory: 'Mental Health' },
    { id: 'oth-004', name: 'Kaan Pete Roi Helpline', address: 'Online / Dhaka', contactNumber: '+880-1779-554391', bookingUrl: null, safeRouteVerified: false, latitude: 23.7500, longitude: 90.3800, rating: 4.9, affiliation: 'NGO', subCategory: 'Mental Health' },
    { id: 'oth-005', name: 'PhysioAid Rehabilitation', address: 'Banani, Dhaka', contactNumber: '+880-1711-200005', bookingUrl: 'https://physioaidbd.com/', safeRouteVerified: true, latitude: 23.7960, longitude: 90.4050, rating: 4.5, affiliation: 'PhysioAid Ltd.', subCategory: 'Physiotherapy' },
    { id: 'oth-006', name: 'Dhaka Blood Donation Society', address: 'Dhanmondi, Dhaka', contactNumber: '+880-1711-200006', bookingUrl: null, safeRouteVerified: false, latitude: 23.7480, longitude: 90.3760, rating: 4.8, affiliation: 'Voluntary', subCategory: 'Blood Bank' },
    { id: 'oth-007', name: 'Praava Women & Child Clinic', address: 'Baridhara, Dhaka', contactNumber: '+880-1711-200007', bookingUrl: 'https://praavahealth.com/', safeRouteVerified: true, latitude: 23.8010, longitude: 90.4220, rating: 4.7, affiliation: 'Praava Health', subCategory: 'Diagnostics' },
    { id: 'oth-008', name: 'BIRDEM Physiotherapy Dept.', address: 'Shahbag, Dhaka', contactNumber: '+880-2-8616641', bookingUrl: 'https://www.birdem-general-hospital.com/', safeRouteVerified: true, latitude: 23.7388, longitude: 90.3940, rating: 4.5, affiliation: 'BIRDEM Hospital', subCategory: 'Physiotherapy' },
    { id: 'oth-009', name: 'Sandhani Blood Bank', address: 'Dhaka Medical College, Dhaka', contactNumber: '+880-1711-200009', bookingUrl: null, safeRouteVerified: true, latitude: 23.7262, longitude: 90.3982, rating: 4.8, affiliation: 'Sandhani', subCategory: 'Blood Bank' },
    { id: 'oth-010', name: 'Spondylitis & Spine Rehab Centre', address: 'Gulshan 1, Dhaka', contactNumber: '+880-1711-200010', bookingUrl: null, safeRouteVerified: true, latitude: 23.7810, longitude: 90.4100, rating: 4.4, affiliation: 'Independent', subCategory: 'Physiotherapy' },
    { id: 'oth-011', name: 'Mind Aid Counselling Center', address: 'Mohakhali, Dhaka', contactNumber: '+880-1711-200011', bookingUrl: 'https://mindaidbd.com/', safeRouteVerified: false, latitude: 23.7790, longitude: 90.3995, rating: 4.6, affiliation: 'Mind Aid BD', subCategory: 'Mental Health' },
    { id: 'oth-012', name: 'Popular Blood Bank', address: 'Shyamoli, Dhaka', contactNumber: '+880-1711-200012', bookingUrl: null, safeRouteVerified: true, latitude: 23.7715, longitude: 90.3635, rating: 4.5, affiliation: 'Popular Group', subCategory: 'Blood Bank' },
    { id: 'oth-013', name: 'Dhaka PhysioTherapy & Rehab', address: 'Mirpur 10, Dhaka', contactNumber: '+880-1711-200013', bookingUrl: null, safeRouteVerified: false, latitude: 23.8065, longitude: 90.3685, rating: 4.2, affiliation: 'Independent', subCategory: 'Physiotherapy' },
];

const DEFAULT_INCIDENT_ZONES = [
    { id: 'z2', name: 'Pragati Sarani', latitude: 23.8135, longitude: 90.4216, incidentCount: 3 },
    { id: 'z3', name: 'Kawran Bazar', latitude: 23.8155, longitude: 90.4255, incidentCount: 7 },
    { id: 'z4', name: 'Mirpur 10 Circle', latitude: 23.8069, longitude: 90.3687, incidentCount: 2 },
    { id: 'z5', name: 'Dhanmondi Lake', latitude: 23.7465, longitude: 90.3760, incidentCount: 6 },
    { id: 'z6', name: 'Gulshan 2', latitude: 23.7931, longitude: 90.4148, incidentCount: 1 },
    { id: 'z7', name: 'Banani', latitude: 23.7940, longitude: 90.4043, incidentCount: 9 },
    { id: 'z8', name: 'Mohakhali', latitude: 23.7788, longitude: 90.3989, incidentCount: 4 },
    { id: 'z9', name: 'Farmgate', latitude: 23.7561, longitude: 90.3872, incidentCount: 5 },
    { id: 'z11', name: 'Shyamoli', latitude: 23.7718, longitude: 90.3631, incidentCount: 2 },
    { id: 'z12', name: 'Banasree', latitude: 23.7634, longitude: 90.4323, incidentCount: 6 },
    { id: 'z13', name: 'Motijheel', latitude: 23.7286, longitude: 90.4173, incidentCount: 3 },
    { id: 'z15', name: 'Khilgaon', latitude: 23.7378, longitude: 90.4251, incidentCount: 4 },
    { id: 'z16', name: 'Lalbagh', latitude: 23.7176, longitude: 90.3855, incidentCount: 7 },
    { id: 'z17', name: 'Agargaon', latitude: 23.7784, longitude: 90.3756, incidentCount: 1 },
    { id: 'z18', name: 'Rampura', latitude: 23.7612, longitude: 90.4208, incidentCount: 3 }
];

async function run() {
    try {
        console.log('Creating medical_providers table...');
        
        await query(`
            CREATE TABLE IF NOT EXISTS medical_providers (
                id VARCHAR(100) NOT NULL,
                provider_type VARCHAR(50) NOT NULL,
                name VARCHAR(255) NOT NULL,
                latitude DECIMAL(10,7) NOT NULL,
                longitude DECIMAL(10,7) NOT NULL,
                rating DECIMAL(3,1) DEFAULT NULL,
                affiliation VARCHAR(255) DEFAULT NULL,
                booking_url VARCHAR(500) DEFAULT NULL,
                address VARCHAR(500) DEFAULT NULL,
                contact_number VARCHAR(50) DEFAULT NULL,
                shift VARCHAR(50) DEFAULT NULL,
                specialty VARCHAR(100) DEFAULT NULL,
                ambulance_type VARCHAR(50) DEFAULT NULL,
                is_delivery_available BOOLEAN DEFAULT NULL,
                eta VARCHAR(50) DEFAULT NULL,
                degree VARCHAR(255) DEFAULT NULL,
                hospital_affiliation VARCHAR(255) DEFAULT NULL,
                safe_route_verified BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id)
            );
        `);
        
        await query(`DELETE FROM medical_providers`);

        console.log('Inserting specialists...');
        for (const prov of SPECIALISTS) {
            await query(
                `INSERT INTO medical_providers (id, provider_type, name, latitude, longitude, rating, affiliation, booking_url, shift, specialty, degree, safe_route_verified)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [prov.id, 'specialists', prov.name, prov.latitude, prov.longitude, prov.rating, prov.affiliation || prov.hospital, prov.bookingUrl, prov.shift, prov.specialty, prov.degree, prov.safeRouteVerified]
            );
        }

        console.log('Inserting hospitals...');
        for (const prov of HOSPITALS) {
            await query(
                `INSERT INTO medical_providers (id, provider_type, name, latitude, longitude, address, rating, affiliation, booking_url, safe_route_verified)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [prov.id, 'hospital', prov.name, prov.latitude, prov.longitude, prov.address, prov.rating, prov.affiliation, prov.bookingUrl, prov.safeRouteVerified]
            );
        }

        console.log('Inserting ambulances...');
        for (const prov of AMBULANCES) {
            await query(
                `INSERT INTO medical_providers (id, provider_type, name, latitude, longitude, contact_number, rating, affiliation, ambulance_type, eta, safe_route_verified)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [prov.id, 'ambulance', prov.providerName, prov.latitude, prov.longitude, prov.contactNumber, prov.rating, prov.affiliation, prov.type, prov.eta, prov.safeRouteVerified]
            );
        }

        console.log('Inserting diagnostics...');
        for (const prov of DIAGNOSTICS) {
            await query(
                `INSERT INTO medical_providers (id, provider_type, name, latitude, longitude, address, rating, affiliation, booking_url, safe_route_verified)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [prov.id, 'diagnostics', prov.name, prov.latitude, prov.longitude, prov.address, prov.rating, prov.affiliation, prov.bookingUrl, prov.safeRouteVerified]
            );
        }

        console.log('Inserting pharmacies...');
        for (const prov of PHARMACIES) {
            await query(
                `INSERT INTO medical_providers (id, provider_type, name, latitude, longitude, address, contact_number, is_delivery_available, rating, affiliation, safe_route_verified)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [prov.id, 'pharmacy', prov.name, prov.latitude, prov.longitude, prov.address, prov.contactNumber, prov.isDeliveryAvailable, prov.rating, prov.affiliation, prov.safeRouteVerified]
            );
        }

        console.log('Inserting others (blood bank / mental health / physio / diagnostics)...');
        for (const prov of OTHERS) {
            await query(
                `INSERT INTO medical_providers (id, provider_type, name, latitude, longitude, address, contact_number, booking_url, rating, affiliation, safe_route_verified)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [prov.id, 'others', prov.name, prov.latitude, prov.longitude, prov.address, prov.contactNumber, prov.bookingUrl, prov.rating, prov.affiliation, prov.safeRouteVerified]
            );
        }

        console.log('Seeding incident locations into incidents table...');
        /* Ensure we have at least 5 dummy users to spread incidents across */
        console.log('Validating users for incident seeding...');
        let roleResult = await query("SELECT id FROM roles LIMIT 1");
        let roleId = roleResult.length > 0 ? roleResult[0].id : 1;
        
        for (let j = 1; j <= 5; j++) {
            let uRes = await query("SELECT id FROM users WHERE phone_number = ?", [`0000000${j}`]);
            if (uRes.length === 0) {
                await query("INSERT INTO users (role_id, first_name, last_name, phone_number, password_hash) VALUES (?, 'System', ?, ?, 'hash')", [roleId, `User${j}`, `0000000${j}`]);
            }
        }
        
        let dbUsers = await query("SELECT id FROM users ORDER BY id ASC LIMIT 10");
        let userIds = dbUsers.map(u => u.id);

        await query("DELETE FROM incidents WHERE address LIKE '%(Seeded)'");

        for (const zone of DEFAULT_INCIDENT_ZONES) {
            for (let i = 0; i < zone.incidentCount; i++) {
                const latDiff = (Math.random() - 0.5) * 0.001;
                const lngDiff = (Math.random() - 0.5) * 0.001;
                const randUserId = userIds[Math.floor(Math.random() * userIds.length)];
                const randHours = Math.floor(Math.random() * 48); // Spread within last 48 hours
                const randMins = Math.floor(Math.random() * 60);

                await query(
                    "INSERT INTO incidents (user_id, latitude, longitude, address, status, created_at) VALUES (?, ?, ?, ?, 'ACTIVE', DATE_SUB(DATE_SUB(NOW(), INTERVAL ? HOUR), INTERVAL ? MINUTE))",
                    [randUserId, zone.latitude + latDiff, zone.longitude + lngDiff, zone.name + " (Seeded)", randHours, randMins]
                );
            }
        }
        
        console.log('Seed completed successfully!');
        process.exit(0);
    } catch (e) {
        console.error('Seed failed:', e);
        process.exit(1);
    }
}

run();
